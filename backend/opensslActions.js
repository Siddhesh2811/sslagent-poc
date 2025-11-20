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

export async function generateCSRAndKey(fqdn, cnfPath) {
  const csrFile = `${fqdn}.csr`;
  const keyFile = `${fqdn}.key`;

  // FIXED OPENSSL COMMAND FOR LINUX
  await runOpenSSL(
    `openssl req -config "${cnfPath}" -newkey rsa:2048 -keyout "${keyFile}" -sha256 -nodes -new -out "${csrFile}"`
  );

  // Read CSR + Key
  const csrContent = fs.readFileSync(csrFile);
  const keyContent = fs.readFileSync(keyFile);

  return { csrContent, keyContent };
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

