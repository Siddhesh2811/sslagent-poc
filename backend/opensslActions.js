import { exec } from "child_process";
import fs from "fs";

export function runOpenSSL(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) return reject(stderr || stdout);
      resolve(stdout);
    });
  });
}

export async function generateCSRAndKey(fqdn, cnfPath, sanList = []) {
  const csrFile = `${fqdn}.csr`;
  const keyFile = `${fqdn}.key`;

  // Use v3_req when SAN entries are present
  const extFlag = sanList.length > 0 ? `-extensions v3_req` : "";

  // Generate CSR and KEY
  await runOpenSSL(
    `openssl req -config "${cnfPath}" -newkey rsa:2048 -keyout "${keyFile}" -sha256 -nodes -new -out "${csrFile}" ${extFlag}`
  );

  // Read files (prevent crash if empty)
  const csrContent = fs.existsSync(csrFile)
    ? fs.readFileSync(csrFile)
    : Buffer.from("");

  const keyContent = fs.existsSync(keyFile)
    ? fs.readFileSync(keyFile)
    : Buffer.from("");

  // RETURN FILE PATHS — THIS WAS MISSING
  return {
    csrContent,
    keyContent,
    csrPath: csrFile,
    keyPath: keyFile
  };
}

export async function getCSRMD5(csrPath) {
  // Extract modulus and pipe to md5
  const output = await runOpenSSL(
    `openssl req -noout -modulus -in "${csrPath}" | openssl md5`
  );

  // Output looks like: "(stdin)= 2646b804b7b37b5577dd733882a4baa1"
  return output.split("=").pop().trim();
}

export async function getKeyMD5(keyPath) {
  const output = await runOpenSSL(
    `openssl rsa -noout -modulus -in "${keyPath}" | openssl md5`
  );

  return output.split("=").pop().trim();
}

