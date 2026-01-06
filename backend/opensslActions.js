import { exec } from "child_process";
import fs from "fs";

import util from "util";
const execAsync = util.promisify(exec);

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

export async function getCRTMD5(crtPath) {
  const { stdout } = await execAsync(
    `openssl x509 -noout -modulus -in "${crtPath}" | openssl md5`
  );
  return stdout.split("=").pop().trim();
}

export async function generatePFX(crtPath, keyPath, pfxPath, password) {
  await execAsync(
    `openssl pkcs12 -export -out "${pfxPath}" -inkey "${keyPath}" -in "${crtPath}" -password pass:${password}`
  );
}

export async function getCertInfo(crtPath) {
  // Extract Subject manually
  const { stdout: subjectOut } = await execAsync(
    `openssl x509 -noout -subject -in "${crtPath}"`
  );

  // Extract Issuer manually
  const { stdout: issuerOut } = await execAsync(
    `openssl x509 -noout -issuer -in "${crtPath}"`
  );

  // Format is usually: subject=CN = example.com
  // Issuer example: issuer=C = US, O = DigiCert Inc, CN = DigiCert...

  // Extract Subject CN
  const subjectMatch = subjectOut.match(/CN\s*=\s*([^,\n]+)/);

  // Extract Issuer CN or O
  // Try CN first, then O
  let issuer = "Imported";
  const issuerCN = issuerOut.match(/CN\s*=\s*([^,\n]+)/);
  const issuerO = issuerOut.match(/O\s*=\s*([^,\n]+)/);

  if (issuerCN) {
    issuer = issuerCN[1].trim();
  } else if (issuerO) {
    issuer = issuerO[1].trim();
  }

  // Extract SANs manually
  let sans = [];
  try {
    const { stdout: extOut } = await execAsync(
      `openssl x509 -noout -ext subjectAltName -in "${crtPath}"`
    );
    // Output example: 
    // X509v3 Subject Alternative Name: 
    //      DNS:example.com, DNS:www.example.com, IP Address:1.2.3.4

    if (extOut.includes("Subject Alternative Name")) {
      const sanString = extOut.split("Name:")[1] || "";
      const items = sanString.split(",").map(s => s.trim());

      items.forEach(item => {
        if (item.startsWith("DNS:")) {
          sans.push(item.replace("DNS:", ""));
        } else if (item.startsWith("IP Address:")) {
          sans.push(item.replace("IP Address:", ""));
        }
        // Can add other types if needed
      });
    }
  } catch (e) {
    // Ignore if no SAN extension found or error
    console.log("No SANs found or error extracting:", e.message);
  }

  return {
    commonName: subjectMatch ? subjectMatch[1].trim() : null,
    fullSubject: subjectOut.trim(),
    issuer: issuer,
    san: sans
  };
}

export async function generateCSRFromCert(crtPath, keyPath, csrPath) {
  await execAsync(
    `openssl x509 -x509toreq -in "${crtPath}" -signkey "${keyPath}" -out "${csrPath}"`
  );

  return fs.existsSync(csrPath) ? fs.readFileSync(csrPath) : null;
}
