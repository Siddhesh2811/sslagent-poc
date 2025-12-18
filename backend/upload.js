import multer from "multer";

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.originalname.endsWith(".crt")) {
      return cb(new Error("Only .crt files allowed"));
    }
    cb(null, true);
  }
});
