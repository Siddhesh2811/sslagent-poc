import archiver from "archiver";
import { PassThrough } from "stream";

export function createCSRZipBuffer(dns, csrBuffer, keyBuffer, cnfBuffer = null) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();
    const chunks = [];

    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);

    archive.pipe(stream);

    archive.append(csrBuffer, { name: `${dns}.csr` });
    archive.append(keyBuffer, { name: `${dns}.key` });

    if (cnfBuffer) {
      archive.append(cnfBuffer, { name: `${dns}.cnf` });
    }

    archive.finalize();
  });
}
