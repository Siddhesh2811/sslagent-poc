import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";

let bucket;
let connection;

export async function initMongo() {
  try {
    connection = await mongoose.createConnection(
      "mongodb://ril_ssl_files_rw:RilSSLabrw2k%2325@10.45.28.81:27017/ril_ssl_files?directConnection=true"
    );

    connection.once("open", () => {
      bucket = new GridFSBucket(connection.db, {
        bucketName: "certfiles"
      });
      console.log("✅ MongoDB connected");
      console.log("✅ GridFSBucket initialized");
    });

  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
  }
}

export function uploadToGridFS(filename, buffer) {
  return new Promise((resolve, reject) => {
    if (!bucket) return reject("❌ GridFSBucket not initialized");

    const uploadStream = bucket.openUploadStream(filename);
    uploadStream.end(buffer);

    uploadStream.on("finish", (file) => resolve(file));
    uploadStream.on("error", (err) => reject(err));
  });
}

