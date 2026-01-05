// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import mysql from "mysql2/promise";
import AdmZip from "adm-zip";
import { upload } from "./upload.js";

import { generateCnf } from "./generateCnf.js";
import { generateCSRAndKey, getCSRMD5, getKeyMD5, getCRTMD5, generatePFX } from "./opensslActions.js";
import { initMongo, uploadToGridFS, downloadFromGridFS } from "./gridfs.js";
import { createCSRZipBuffer } from "./zipUtils.js";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// ----------------------------
// MySQL Connection
// ----------------------------
const mysqlPool = mysql.createPool({
  host: "10.45.28.84",
  user: "rilssllab_rw",
  password: "RilSSLabrw2k#25",
  database: "rilssllab",
  waitForConnections: true,
  connectionLimit: 10,
});

// ----------------------------
// MongoDB GridFS init
// ----------------------------
await initMongo();

// ----------------------------
const EMPTY_MD5 = "d41d8cd98f00b204e9800998ecf8427e";

// ----------------------------
// Activity endpoint
// ----------------------------
app.get("/api/certificates/activity", async (req, res) => {
  try {
    const [rows] = await mysqlPool.execute(
      `SELECT 
         application_name,
         common_name,
         application_owner,
         application_spoc,
         certificate_type,
         date,
         csr_md5,
         key_md5,
         remarks
       FROM CSR
       ORDER BY date DESC
       LIMIT 1000`
    );

    const formatted = rows.map((item, idx) => ({
      id: `SSL${String(idx + 1).padStart(4, "0")}`,
      type: "New",
      dns: item.common_name,
      appName: item.application_name,
      owner: item.application_owner,
      spoc: item.application_spoc,
      ca: item.certificate_type,
      createdAt: item.date,
      status: "Completed",
      csr_md5: item.csr_md5,
      key_md5: item.key_md5,
      remarks: item.remarks,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Activity fetch error:", err);
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
});

// ----------------------------
// Download CSR
// ----------------------------
app.get("/api/certificates/download-zip/:dns", async (req, res) => {
  try {
    const filename = `${req.params.dns}.zip`;
    const stream = await downloadFromGridFS(filename);

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });

    stream.pipe(res);
  } catch (err) {
    console.error("ZIP download error:", err);
    res.status(404).json({ message: "ZIP file not found" });
  }
});

// ----------------------------
// Main CSR creation endpoint
// ----------------------------
app.post("/api/certificates", async (req, res) => {
  const {
    appName,
    appOwner,
    appSPOC,
    dns,
    ca = "Godaddy",
    san = [],
    remarks,
    created_by,
  } = req.body;

  if (!appName || !appOwner || !dns)
    return res.status(400).json({ message: "Missing required fields." });

  console.log("📩 New Certificate Request Received:", req.body);

  const cnfPath = `${dns}.cnf`;
  fs.writeFileSync(cnfPath, generateCnf(dns, san || []));

  let csrPath, keyPath, csrContent, keyContent;

  try {
    const gen = await generateCSRAndKey(dns, cnfPath, san);
    csrPath = gen.csrPath;
    keyPath = gen.keyPath;
    csrContent = gen.csrContent;
    keyContent = gen.keyContent;
  } catch (err) {
    if (fs.existsSync(cnfPath)) fs.unlinkSync(cnfPath);
    return res
      .status(500)
      .json({ message: "OpenSSL failed", error: String(err) });
  }

  try {
    const csr_md5 = await getCSRMD5(csrPath);
    const key_md5 = await getKeyMD5(keyPath);

    console.log("CSR MD5:", csr_md5);
    console.log("KEY MD5:", key_md5);

    if (!csr_md5 || !key_md5 || csr_md5 === EMPTY_MD5 || key_md5 === EMPTY_MD5)
      return res
        .status(422)
        .json({ message: "Invalid CSR/Key modulus", csr_md5, key_md5 });

    // --------------------------
    // Upload CSR + KEY to GridFS
    // --------------------------
    // Create ZIP containing CSR + KEY
    const zipBuffer = await createCSRZipBuffer(dns, csrContent, keyContent);

    // Upload ZIP to GridFS
    const zipFile = await uploadToGridFS(`${dns}.zip`, zipBuffer);

    if (!zipFile || !zipFile._id) {
      throw new Error("GridFS ZIP upload failed");
    }

    // --------------------------
    // Check duplicate in MySQL
    // --------------------------
    const [existing] = await mysqlPool.execute(
      `SELECT csr_md5 FROM CSR WHERE csr_md5 = ? AND key_md5 = ? LIMIT 1`,
      [csr_md5, key_md5]
    );

    if (existing.length > 0)
      return res.status(409).json({
        message: "CSR with same modulus already exists",
        csr_md5,
        key_md5,
      });

    // --------------------------
    // Insert metadata into MySQL
    // --------------------------
    const [result] = await mysqlPool.execute(
      `INSERT INTO CSR 
        (application_name, common_name, san, application_owner, application_spoc,
        certificate_type, date, created_by, csr_md5, key_md5, remarks)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [
        appName,
        dns,
        JSON.stringify(san),
        appOwner,
        appSPOC,
        ca,
        created_by || "system",
        csr_md5,
        key_md5,
        remarks,
      ]
    );

    console.log("✅ MySQL Insert:", result);

    // cleanup temp files
    fs.unlinkSync(cnfPath);
    fs.unlinkSync(csrPath);
    fs.unlinkSync(keyPath);

    return res.status(201).json({
      message: `CSR & Key generated successfully for ${dns}`,
      csr_md5,
      key_md5,
      zip_filename: `${dns}.zip`,
      zip_gridfs_id: zipFile._id,
      mysqlResult: result,
    });
  } catch (err) {
    console.error("❌ CSR Generation Error:", err);

    // cleanup temp files
    if (fs.existsSync(cnfPath)) fs.unlinkSync(cnfPath);
    if (fs.existsSync(csrPath)) fs.unlinkSync(csrPath);
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);

    return res
      .status(500)
      .json({ message: "CSR processing failed", error: String(err) });
  }
});

// ----------------------------
// RENEW / DOWNLOAD KEY & CSR FROM CRT
// ----------------------------
app.post(
  "/api/certificates/renew",
  upload.single("existingCrt"),
  async (req, res) => {
    let crtPath;

    try {
      const { dns } = req.body;
      const crtBuffer = req.file?.buffer;

      if (!dns || !crtBuffer) {
        return res.status(400).json({ message: "DNS and existing CRT are required" });
      }

      console.log(`♻️ Renewal Request for: ${dns}`);

      // ----------------------------
      // TEMP FILE
      // ----------------------------
      crtPath = `${dns}_renew_temp.crt`;
      fs.writeFileSync(crtPath, crtBuffer);

      // ----------------------------
      // Compute MD5
      // ----------------------------
      const crt_md5 = await getCRTMD5(crtPath);
      console.log(`Existing CRT MD5: ${crt_md5}`);

      // ----------------------------
      // Find Matching CSR in DB
      // ----------------------------
      const [rows] = await mysqlPool.execute(
        `SELECT common_name, csr_md5 FROM CSR WHERE csr_md5 = ? LIMIT 1`,
        [crt_md5]
      );

      if (rows.length === 0) {
        return res.status(404).json({ 
          message: "No matching original request found for this certificate." 
        });
      }

      const match = rows[0];

      // Security Check: Verify DNS matches
      if (match.common_name !== dns) {
        return res.status(400).json({ 
          message: `DNS mismatch. This certificate belongs to ${match.common_name}, not ${dns}.` 
        });
      }

      // ----------------------------
      // Retrieve ZIP from GridFS
      // ----------------------------
      // Attempt to download ZIP by common_name (assuming format: dns.zip)
      // Note: If multiple exists, this simple logic might need improvement, 
      // but typically we overwrite or rely on the latest.
      const filename = `${match.common_name}.zip`;
      
      try {
        const zipStream = await downloadFromGridFS(filename);
        
        res.set({
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
        });

        zipStream.pipe(res);
      } catch (gridErr) {
        console.error("GridFS Download Error:", gridErr);
        return res.status(404).json({ message: "Original Key/CSR files not found in storage." });
      }

    } catch (err) {
      console.error("❌ Renewal Error:", err);
      res.status(500).json({ message: "Renewal process failed", error: String(err) });
    } finally {
      // Cleanup
      if (crtPath && fs.existsSync(crtPath)) {
        try { fs.unlinkSync(crtPath); } catch (_) {}
      }
    }
  }
);

// ----------------------------
// PFX GENERATION (NO FILE RETENTION)
// ----------------------------
app.post(
  "/api/certificates/pfx",
  upload.single("newCrt"),
  async (req, res) => {
    let crtPath, keyPath, pfxPath;

    try {
      const { dns } = req.body;
      const crtBuffer = req.file?.buffer;

      if (!dns || !crtBuffer) {
        return res.status(400).json({ message: "DNS and CRT are required" });
      }

      // ----------------------------
      // TEMP FILE PATHS
      // ----------------------------
      crtPath = `${dns}.crt`;
      keyPath = `${dns}.key`;
      pfxPath = `${dns}.pfx`;

      // Save CRT temporarily
      fs.writeFileSync(crtPath, crtBuffer);

      // Compute CRT modulus MD5
      const crt_md5 = await getCRTMD5(crtPath);

      // ----------------------------
      // Find matching CSR
      // ----------------------------
      const [rows] = await mysqlPool.execute(
        `SELECT csr_md5, key_md5 FROM CSR WHERE csr_md5 = ? LIMIT 1`,
        [crt_md5]
      );

      if (rows.length === 0) {
        throw new Error("No matching CSR found for uploaded CRT");
      }

      // ----------------------------
      // Download existing ZIP from MongoDB
      // ----------------------------
      const zipStream = await downloadFromGridFS(`${dns}.zip`);
      const zipBuffer = await streamToBuffer(zipStream);
      const zip = new AdmZip(zipBuffer);

      const csrEntry = zip.getEntry(`${dns}.csr`);
      const keyEntry = zip.getEntry(`${dns}.key`);

      if (!csrEntry || !keyEntry) {
        throw new Error("ZIP does not contain CSR or KEY");
      }

      // Write KEY temporarily
      fs.writeFileSync(keyPath, keyEntry.getData());

      // ----------------------------
      // Generate PFX
      // ----------------------------
      const PFX_PASSWORD = "password";

      await generatePFX(crtPath, keyPath, pfxPath, PFX_PASSWORD);

      // ----------------------------
      // Build NEW ZIP (overwrite old one)
      // ----------------------------
      const newZip = new AdmZip();
      newZip.addFile(`${dns}.csr`, csrEntry.getData());
      newZip.addFile(`${dns}.key`, keyEntry.getData());
      newZip.addFile(`${dns}.crt`, crtBuffer);
      newZip.addFile(`${dns}.pfx`, fs.readFileSync(pfxPath));

      const finalZipBuffer = newZip.toBuffer();

      // Upload updated ZIP to MongoDB
      await uploadToGridFS(`${dns}.zip`, finalZipBuffer);

      // ----------------------------
      // Insert DB record
      // ----------------------------
      await mysqlPool.execute(
        `INSERT INTO CRTPFX
         (cert_upload_date, cert_upload_user, crt_md5, csr_md5, key_md5, pfx_generation_status)
         VALUES (NOW(), ?, ?, ?, ?, ?)`,
        ["system", crt_md5, rows[0].csr_md5, rows[0].key_md5, "PFX Generated"]
      );

      return res.json({
        message: "PFX generated successfully",
        password: PFX_PASSWORD,
      });

    } catch (err) {
      console.error("❌ PFX generation failed:", err);
      return res.status(500).json({ message: err.message });
    } finally {
      // ----------------------------
      // HARD CLEANUP (NO RETENTION)
      // ----------------------------
      [crtPath, keyPath, pfxPath].forEach((file) => {
        if (file && fs.existsSync(file)) {
          try {
            fs.unlinkSync(file);
          } catch (_) {}
        }
      });
    }
  }
);


// MAIN BACKEND RUNNING---------------------
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

// HELPER FUNCTION----------------------
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

