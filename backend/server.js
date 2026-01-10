// server.js
import "./logger.js"; // Initialize logging first
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import mysql from "mysql2/promise";
import AdmZip from "adm-zip";
import { upload } from "./upload.js";

import { generateCnf } from "./generateCnf.js";
import { generateCSRAndKey, getCSRMD5, getKeyMD5, getCRTMD5, generatePFX, getCertInfo, generateCSRFromCert, generateCSRFromKey } from "./opensslActions.js";
import { initMongo, uploadToGridFS, downloadFromGridFS } from "./gridfs.js";
import { createCSRZipBuffer } from "./zipUtils.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ----------------------------
// AUTHENTICATION
// ----------------------------
import { login } from "./authController.js";
app.post("/api/auth/login", login);

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

// DB Migration: Add activity_status if not exists
try {
  const [cols] = await mysqlPool.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'rilssllab' AND TABLE_NAME = 'CSR' AND COLUMN_NAME = 'activity_status'"
  );
  if (cols.length === 0) {
    console.log("⚠️ Column 'activity_status' missing. Adding it...");
    await mysqlPool.execute("ALTER TABLE CSR ADD COLUMN activity_status VARCHAR(50) DEFAULT 'Pending'");
    console.log("✅ Column 'activity_status' added.");
  }

  // DB Migration: Add 'id' if not exists (For Static IDs)
  const [idCol] = await mysqlPool.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'rilssllab' AND TABLE_NAME = 'CSR' AND COLUMN_NAME = 'id'"
  );
  if (idCol.length === 0) {
    console.log("⚠️ Column 'id' missing in CSR. Adding it...");
    // Retrieve all rows to sort by date before adding ID to ensure chronological order if possible, 
    // or just add it (MySQL adds to existing rows automatically).
    // Note: If PRIMARY KEY exists (e.g. common_name), we might need to DROP it first or add UNIQUE.
    // Let's assume common_name is PK. We'll try to add 'id' as unique index auto_increment first.
    // Safest strategy: Add id INT AUTO_INCREMENT UNIQUE KEY first.
    try {
      await mysqlPool.execute("ALTER TABLE CSR ADD COLUMN id INT AUTO_INCREMENT UNIQUE KEY FIRST");
      console.log("✅ Column 'id' added to CSR.");
    } catch (e) {
      console.error("Failed to add id column:", e);
    }
  }

  // Create ActivityLogs table
  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS ActivityLogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dns VARCHAR(255) NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      performed_by VARCHAR(100) DEFAULT 'system',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      details JSON
    )
  `);
} catch (err) {
  console.error("Migration Error:", err);
}

// ----------------------------
// Helper: Log Activity
// ----------------------------
async function logActivity(dns, actionType, performedBy, details = {}) {
  try {
    await mysqlPool.execute(
      `INSERT INTO ActivityLogs (dns, action_type, performed_by, details, timestamp) VALUES (?, ?, ?, ?, NOW())`,
      [dns, actionType, performedBy || "system", JSON.stringify(details)]
    );
    console.log(`📝 Logged activity: ${actionType} for ${dns}`);
  } catch (err) {
    console.error("❌ Failed to log activity:", err);
  }
}

// ----------------------------
const EMPTY_MD5 = "d41d8cd98f00b204e9800998ecf8427e";

// ----------------------------
// Activity endpoint
// ----------------------------
const getDerivedType = (status) => {
  if (!status) return "New";
  if (status.includes("SAN")) return "SAN Update";
  if (status.includes("PFX")) return "PFX";
  if (status.includes("Import")) return "Upload";
  return "New";
};

app.get("/api/certificates/activity", async (req, res) => {
  try {
    const [rows] = await mysqlPool.execute(
      `SELECT 
         id,
         application_name,
         common_name,
         san,
         application_owner,
         application_spoc,
         certificate_type,
         date,
         csr_md5,
         key_md5,
         created_by,
         activity_status,
         remarks
       FROM CSR
       ORDER BY date DESC
       LIMIT 1000`
    );

    const formatted = rows.map((item, idx) => ({
      id: `SSL${String(item.id).padStart(4, "0")}`,
      type: getDerivedType(item.activity_status),
      dns: item.common_name,
      sanList: item.san ? JSON.parse(item.san) : [],
      appName: item.application_name,
      owner: item.application_owner,
      spoc: item.application_spoc,
      ca: item.certificate_type,
      createdAt: item.date,
      status: item.activity_status || "Completed",
      csr_md5: item.csr_md5,
      key_md5: item.key_md5,
      createdBy: item.created_by,
      remarks: item.remarks,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Activity fetch error:", err);
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
});

// ----------------------------
// Recent Activity Endpoint (Global)
// ----------------------------
app.get("/api/certificates/recent-activity", async (req, res) => {
  try {
    const [rows] = await mysqlPool.execute(
      `SELECT * FROM ActivityLogs ORDER BY timestamp DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Recent Activity fetch error:", err);
    res.status(500).json({ message: "Failed to fetch recent activity" });
  }
});

// ----------------------------
// Activity History Endpoint
// ----------------------------
app.get("/api/certificates/activity/:dns", async (req, res) => {
  try {
    const { dns } = req.params;
    const [rows] = await mysqlPool.execute(
      `SELECT * FROM ActivityLogs WHERE dns = ? ORDER BY timestamp DESC`,
      [dns]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ History fetch error:", err);
    res.status(500).json({ message: "Failed to fetch history" });
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
    // Upload CSR + KEY + CNF to GridFS
    // --------------------------
    // Create ZIP containing CSR + KEY + CNF
    const cnfContent = fs.existsSync(cnfPath) ? fs.readFileSync(cnfPath) : null;
    const zipBuffer = await createCSRZipBuffer(dns, csrContent, keyContent, cnfContent);

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
        certificate_type, date, created_by, csr_md5, key_md5, remarks, activity_status)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
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
        "CSR Generated"
      ]
    );

    console.log("✅ MySQL Insert:", result);

    // Activity Log
    await logActivity(dns, "CSR Generated", created_by, {
      appName, appOwner, ca, san
    });

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
        // Activity Log
        // Note: 'created_by' is not passed in the current body of this endpoint in server.js analysis, 
        // we might need to assume 'system' or update frontend to pass it.
        // Looking at line 328: const { dns } = req.body;
        // We should extract created_by too.

        await logActivity(dns, "Renew", req.body.created_by, {
          message: "Certificate renewed/downloaded via Agent"
        });

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
        try { fs.unlinkSync(crtPath); } catch (_) { }
      }
    }
  }
);

// ----------------------------
// IMPORT CRT & KEY (Reverse CSR Gen)
// ----------------------------
app.post(
  "/api/certificates/import",
  upload.fields([{ name: "existingCrt" }, { name: "existingKey" }]),
  async (req, res) => {
    let crtPath, keyPath, csrPath;

    try {
      const {
        appName,
        appOwner,
        appSPOC,
        remarks,
        ca = "Imported",
        created_by,
      } = req.body;

      const files = req.files;
      const crtBuffer = files["existingCrt"]?.[0]?.buffer;
      const keyBuffer = files["existingKey"]?.[0]?.buffer;

      if (!crtBuffer || !keyBuffer || !appName || !appOwner) {
        return res.status(400).json({
          message: "CRT, Key, App Name, and Owner are required."
        });
      }

      // ----------------------------
      // TEMP FILES
      // ----------------------------
      const id = Date.now();
      crtPath = `import_${id}.crt`;
      keyPath = `import_${id}.key`;
      csrPath = `import_${id}.csr`;

      fs.writeFileSync(crtPath, crtBuffer);
      fs.writeFileSync(keyPath, keyBuffer);

      // ----------------------------
      // 1. Validate Match (MD5)
      // ----------------------------
      const crt_md5 = await getCRTMD5(crtPath);
      const key_md5 = await getKeyMD5(keyPath);

      console.log(`Import Check | CRT MD5: ${crt_md5} | Key MD5: ${key_md5}`);

      // Basic Check: In a valid pair, CRT modulus == Key modulus
      // (Using CSR MD5 logic since CRT Modulus matches CSR Modulus matches Key Modulus)

      // Note: getCRTMD5 gets modulus md5. getKeyMD5 gets modulus md5. 
      // They MUST match.
      if (crt_md5 !== key_md5) {
        throw new Error("The uploaded Certificate and Private Key do not match.");
      }

      // ----------------------------
      // 2. Extract Common Name
      // ----------------------------
      const certInfo = await getCertInfo(crtPath);
      const dns = certInfo.commonName;
      const san = certInfo.san || [];

      if (!dns) {
        throw new Error("Could not extract Common Name (CN) from certificate.");
      }

      console.log(`Extracted DNS: ${dns}`);

      // ----------------------------
      // 3. Check Duplicate in DB
      // ----------------------------
      const [existing] = await mysqlPool.execute(
        `SELECT csr_md5 FROM CSR WHERE csr_md5 = ? LIMIT 1`,
        [crt_md5]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          message: "This certificate already exists in the system.",
          existing_md5: crt_md5
        });
      }

      // ----------------------------
      // 4. Generate CSR (Reverse)
      // ----------------------------
      const csrBuffer = await generateCSRFromCert(crtPath, keyPath, csrPath);
      if (!csrBuffer) {
        throw new Error("Failed to generate CSR from Certificate and Key.");
      }
      const csr_md5 = await getCSRMD5(csrPath); // Should be same as crt_md5

      // ----------------------------
      // 5. Store in GridFS (ZIP)
      // ----------------------------
      // We store CSR + Key. (CRT is usually stored separately or not stored in the ZIP in the original flow, 
      // but here we have it. The original flow stores CSR+KEY in ZIP.
      // We will stick to the standard: ZIP = CSR + KEY. 
      // The user HAS the CRT, or we can store it too. 
      // Let's store ALL THREE for imported items to be safe.

      // Reuse zipUtils logic? No, let's just make a zip here.
      const zip = new AdmZip();
      zip.addFile(`${dns}.csr`, csrBuffer);
      zip.addFile(`${dns}.key`, keyBuffer);
      zip.addFile(`${dns}.crt`, crtBuffer); // Bonus: Store the CRT too since we have it.

      // Generate and store CNF
      const cnfContent = generateCnf(dns, san);
      zip.addFile(`${dns}.cnf`, Buffer.from(cnfContent));

      const zipBuffer = zip.toBuffer();
      const zipFile = await uploadToGridFS(`${dns}.zip`, zipBuffer);

      // ----------------------------
      // 6. Insert MySQL
      // ----------------------------
      const [result] = await mysqlPool.execute(
        `INSERT INTO CSR 
          (application_name, common_name, san, application_owner, application_spoc,
          certificate_type, date, created_by, csr_md5, key_md5, remarks, activity_status)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
        [
          appName,
          dns,
          JSON.stringify(san), // Store extracted SANs
          appOwner,
          appSPOC || "",
          certInfo.issuer || "Imported", // Use extracted Issuer
          created_by || "Imported",
          csr_md5,
          key_md5,
          remarks || "Imported via Uploader",
          "Imported"
        ]
      );

      console.log("✅ Import Success:", result);

      // Activity Log
      await logActivity(dns, "Imported", created_by, {
        remarks: "Imported via Uploader",
        issuer: certInfo.issuer
      });

      return res.status(201).json({
        message: "Certificate imported successfully",
        dns,
        csr_md5,
        zip_gridfs_id: zipFile._id
      });

    } catch (err) {
      console.error("❌ Import Failed:", err);
      return res.status(500).json({ message: err.message });
    } finally {
      // Cleanup
      [crtPath, keyPath, csrPath].forEach(f => {
        if (f && fs.existsSync(f)) try { fs.unlinkSync(f); } catch (_) { }
      });
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
      const created_by = req.body.created_by || "system"; // Get from FormData

      await mysqlPool.execute(
        `INSERT INTO CRTPFX
         (cert_upload_date, cert_upload_user, crt_md5, csr_md5, key_md5, pfx_generation_status)
         VALUES (NOW(), ?, ?, ?, ?, ?)`,
        [created_by, crt_md5, rows[0].csr_md5, rows[0].key_md5, "PFX Generated"]
      );

      // Update CSR table status as well
      await mysqlPool.execute(
        `UPDATE CSR SET activity_status = 'PFX Generated' WHERE csr_md5 = ?`,
        [rows[0].csr_md5]
      );

      // Activity Log
      await logActivity(dns, "PFX Generated", created_by, {
        message: "PFX regenerated from CRT"
      });

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
          } catch (_) { }
        }
      });
    }
  }
);




// MAIN BACKEND RUNNING---------------------
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

// ----------------------------
// SAN ADDITION / UPDATE
// ----------------------------

// 1. Analyze Uploaded CRT
app.post("/api/certificates/analyze", upload.single("existingCrt"), async (req, res) => {
  let crtPath;
  try {
    const crtBuffer = req.file?.buffer;
    if (!crtBuffer) return res.status(400).json({ message: "Certificate file is required" });

    const id = Date.now();
    crtPath = `analyze_${id}.crt`;
    fs.writeFileSync(crtPath, crtBuffer);

    // Get MD5 to check if we have the key
    const crt_md5 = await getCRTMD5(crtPath);
    console.log(`Analyze | CRT MD5: ${crt_md5}`);

    // Check DB
    const [rows] = await mysqlPool.execute(
      `SELECT common_name, csr_md5, key_md5 FROM CSR WHERE csr_md5 = ? LIMIT 1`,
      [crt_md5]
    );

    const isKeyAvailable = rows.length > 0;

    // Extract Info
    const certInfo = await getCertInfo(crtPath);

    // Cleanup
    fs.unlinkSync(crtPath);

    if (!isKeyAvailable) {
      return res.status(404).json({
        message: "This certificate is not in our system. Please import it first via the 'CRT & Key Uploader'."
      });
    }

    res.json({
      dns: certInfo.commonName,
      san: certInfo.san || [],
      isKeyAvailable,
      dbRecord: rows[0]
    });

  } catch (err) {
    console.error("Analyze Error:", err);
    if (crtPath && fs.existsSync(crtPath)) fs.unlinkSync(crtPath);
    res.status(500).json({ message: err.message });
  }
});

// 2. Update SAN & Regenerate CSR
app.post("/api/certificates/update-san", async (req, res) => {
  let tempKeyPath, tempCnfPath, tempCsrPath;
  try {
    const { dns, sanList, created_by } = req.body;
    if (!dns || !sanList) return res.status(400).json({ message: "DNS and SAN List are required" });

    console.log(`Update SAN for ${dns} by ${created_by || 'unknown'}:`, sanList);

    // 1. Download existing ZIP to get the Key
    const filename = `${dns}.zip`;
    const zipStream = await downloadFromGridFS(filename);
    const zipBuffer = await streamToBuffer(zipStream);
    const zip = new AdmZip(zipBuffer);

    const keyEntry = zip.getEntry(`${dns}.key`);
    if (!keyEntry) throw new Error("Original Private Key not found in storage");

    const keyBuffer = keyEntry.getData();
    // We can also keep the original CRT if we want, but for now we are generating a NEW CSR request.
    const crtEntry = zip.getEntry(`${dns}.crt`);
    const crtBuffer = crtEntry ? crtEntry.getData() : null;

    // 2. Setup Temp Files
    const id = Date.now();
    tempKeyPath = `update_${id}.key`;
    tempCnfPath = `update_${id}.cnf`;
    tempCsrPath = `update_${id}.csr`;

    fs.writeFileSync(tempKeyPath, keyBuffer);

    // 3. Generate New CNF
    const cnfContent = generateCnf(dns, sanList);
    fs.writeFileSync(tempCnfPath, cnfContent);

    // 4. Generate New CSR using Existing Key + New CNF
    // We need a helper for this: generateCSRFromKey(keyPath, cnfPath, csrPath)
    const csrBuffer = await generateCSRFromKey(tempKeyPath, tempCnfPath, tempCsrPath);

    if (!csrBuffer) throw new Error("Failed to regenerate CSR");

    // 5. Update DB (SAN column and CSR MD5)
    // Calculate new CSR MD5
    const new_csr_md5 = await getCSRMD5(tempCsrPath);

    // Update MySQL
    // Update MySQL
    // Be careful with SQL injection on remarks if simpler concatenation used, but params are safe.
    // We'll append " | updated by: <user>"
    const updateMsg = ` | SAN Updated by ${created_by || 'system'}`;

    await mysqlPool.execute(
      `UPDATE CSR SET san = ?, csr_md5 = ?, remarks = CONCAT(remarks, ?), activity_status = ? WHERE common_name = ?`,
      [JSON.stringify(sanList), new_csr_md5, updateMsg, "SAN Updated", dns]
    );

    // Activity Log
    await logActivity(dns, "SAN Updated", created_by, {
      sanList: sanList
    });

    // 6. Upload New ZIP
    const newZip = new AdmZip();
    newZip.addFile(`${dns}.csr`, csrBuffer);
    newZip.addFile(`${dns}.key`, keyBuffer); // Same Key
    newZip.addFile(`${dns}.cnf`, Buffer.from(cnfContent));
    if (crtBuffer) newZip.addFile(`${dns}.crt`, crtBuffer); // Keep old CRT if present

    const newZipBuffer = newZip.toBuffer();
    // Start fresh or replace? GridFS logic usually accumulates or we can just upload with same name (GridFS allows duplicates, we download latest)
    // Ideally delete old, but for safety lets just upload new version.
    await uploadToGridFS(`${dns}.zip`, newZipBuffer);

    res.json({ message: "SAN List Updated & CSR Regenerated", new_csr_md5 });

  } catch (err) {
    console.error("Update SAN Error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    [tempKeyPath, tempCnfPath, tempCsrPath].forEach(f => {
      if (f && fs.existsSync(f)) try { fs.unlinkSync(f); } catch (_) { }
    });
  }
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
