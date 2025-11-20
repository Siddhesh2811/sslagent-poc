// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import mysql from "mysql2/promise";

import { generateCnf } from "./generateCnf.js";
import { generateCSRAndKey, getCSRMD5, getKeyMD5 } from "./opensslActions.js";
import { initMongo, uploadToGridFS, downloadFromGridFS } from "./gridfs.js";

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
app.get("/api/certificates/download/:filename", async (req, res) => {
  try {
    const stream = await downloadFromGridFS(req.params.filename);
    res.set({
      "Content-Type": "application/pkcs10",
      "Content-Disposition": `attachment; filename="${req.params.filename}"`,
    });
    stream.pipe(res);
  } catch (err) {
    console.error("CSR download error:", err);
    res.status(404).json({ message: "CSR not found" });
  }
});

// ----------------------------
// Main CSR creation endpoint
// ----------------------------
app.post("/api/certificates", async (req, res) => {
  const { appName, appOwner, appSPOC, dns, ca = "Godaddy", san = [], remarks, created_by } = req.body;

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
    return res.status(500).json({ message: "OpenSSL failed", error: String(err) });
  }

  try {
    const csr_md5 = await getCSRMD5(csrPath);
    const key_md5 = await getKeyMD5(keyPath);

    console.log("CSR MD5:", csr_md5);
    console.log("KEY MD5:", key_md5);

    if (!csr_md5 || !key_md5 || csr_md5 === EMPTY_MD5 || key_md5 === EMPTY_MD5)
      return res.status(422).json({ message: "Invalid CSR/Key modulus", csr_md5, key_md5 });

    // --------------------------
    // Upload CSR + KEY to GridFS
    // --------------------------
    const csrFile = await uploadToGridFS(`${dns}.csr`, csrContent);
    const keyFile = await uploadToGridFS(`${dns}.key`, keyContent);

    if (!csrFile || !csrFile._id)
      throw new Error("GridFS upload failed: csrFile._id missing");

    if (!keyFile || !keyFile._id)
      throw new Error("GridFS upload failed: keyFile._id missing");

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
      csr_gridfs_id: csrFile._id,
      key_gridfs_id: keyFile._id,
      mysql: result,
    });

  } catch (err) {
    console.error("❌ CSR Generation Error:", err);

    // cleanup temp files
    if (fs.existsSync(cnfPath)) fs.unlinkSync(cnfPath);
    if (fs.existsSync(csrPath)) fs.unlinkSync(csrPath);
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);

    return res.status(500).json({ message: "CSR processing failed", error: String(err) });
  }
});

// ----------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

