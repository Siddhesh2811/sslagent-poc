import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import mysql from "mysql2/promise";

// Import our modules
import { generateCnf } from "./generateCnf.js";
import {
  generateCSRAndKey,
  getCSRMD5,
  getKeyMD5
} from "./opensslActions.js";
import { initMongo, uploadToGridFS } from "./gridfs.js";

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
// MongoDB / GridFS Initialization
// ----------------------------
await initMongo();

// ----------------------------
// MAIN API ENDPOINT
// ----------------------------
app.post("/api/certificates", async (req, res) => {
  try {
    const { appName, appOwner, appSPOC, dns, ca, san, remarks, created_by } =
      req.body;

    if (!appName || !appOwner || !dns) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    console.log("📩 New Certificate Request Received:");
    console.log(req.body);

    // 1️⃣ Generate .cnf file
    const cnfContent = generateCnf(dns, san || []);
    const cnfPath = `${dns}.cnf`;
    fs.writeFileSync(cnfPath, cnfContent);

    // 2️⃣ Generate CSR + Key using OpenSSL
    const { csrContent, keyContent, csrPath, keyPath } = await generateCSRAndKey(
      dns,
      cnfPath
    );

    // 3️⃣ Generate MD5 using OpenSSL modulus
    const csr_md5 = await getCSRMD5(csrPath);
    const key_md5 = await getKeyMD5(keyPath);

    console.log("CSR MODULUS MD5:", csr_md5);
    console.log("KEY MODULUS MD5:", key_md5);

    // 4️⃣ Upload CSR + KEY to MongoDB GridFS
    const csrFile = await uploadToGridFS(`${dns}.csr`, csrContent);
    const keyFile = await uploadToGridFS(`${dns}.key`, keyContent);

    // 5️⃣ MySQL INSERT — FIXED created_by with default value
    console.log("➡️ Saving to MySQL with values:", [
      appName,
      dns,
      JSON.stringify(san || []),
      appOwner,
      appSPOC,
      ca,
      created_by || "system",
      csr_md5,
      key_md5,
      remarks,
    ]);

    const [result] = await mysqlPool.execute(
      `INSERT INTO CSR 
      (application_name, common_name, san, application_owner, application_spoc,
       certificate_type, date, created_by, csr_md5, key_md5, remarks)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [
        appName,
        dns,
        JSON.stringify(san || []),
        appOwner,
        appSPOC,
        ca,
        created_by || "system", // <--- FIXED HERE
        csr_md5,
        key_md5,
        remarks,
      ]
    );

    console.log("✅ MySQL Insert:", result);

    // 6️⃣ Cleanup temp files safely
    try {
      if (cnfPath && fs.existsSync(cnfPath)) fs.unlinkSync(cnfPath);
      if (csrPath && fs.existsSync(csrPath)) fs.unlinkSync(csrPath);
      if (keyPath && fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
    } catch (cleanupErr) {
      console.warn("⚠️ Cleanup warning:", cleanupErr.message);
    }

    // 7️⃣ Response
    return res.status(201).json({
      message: `CSR & Key generated successfully for ${dns}`,
      csr_md5,
      key_md5,
      csr_file_id: csrFile?._id || null,
      key_file_id: keyFile?._id || null,
    });

  } catch (error) {
    console.error("❌ CSR Generation Error:", error);
    return res.status(500).json({ message: "Failed to generate CSR", error });
  }
});

// ----------------------------
// Start Server
// ----------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

