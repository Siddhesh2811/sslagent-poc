import multer from "multer";

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(crt|key)$/)) {
      return cb(new Error("Only .crt and .key files allowed"));
    }
    cb(null, true);
  }
});
