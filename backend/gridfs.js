// gridfs.js
import { MongoClient, GridFSBucket } from "mongodb";

let mongoClient;
let bucket;

export async function initMongo() {
  const uri = "mongodb://ril_ssl_files_rw:RilSSLabrw2k%2325@10.45.28.81:27017/ril_ssl_files?directConnection=true";

  mongoClient = new MongoClient(uri);

  await mongoClient.connect();
  console.log("✅ MongoDB connected");

  const db = mongoClient.db("ril_ssl_files");

  bucket = new GridFSBucket(db, {
    bucketName: "certfiles",
  });

  console.log("✅ GridFSBucket initialized");
}

/**
 * Upload file buffer to GridFS
 */
export async function uploadToGridFS(filename, buffer) {
  if (!bucket) {
    throw new Error("GridFS bucket not initialized");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename);

    uploadStream.end(buffer);

    uploadStream.on("finish", () => {
      resolve({ _id: uploadStream.id, filename });
    });

    uploadStream.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Download file from GridFS
 */
export async function downloadFromGridFS(filename) {
  if (!bucket) {
    throw new Error("GridFS bucket not initialized");
  }

  return bucket.openDownloadStreamByName(filename);
}

