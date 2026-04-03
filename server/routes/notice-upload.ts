import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

const uploadDir = path.resolve(process.cwd(), "uploads/notices");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post("/api/notices/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "이미지 파일이 없습니다." });
  }

  return res.json({
    ok: true,
    url: `/uploads/notices/${req.file.filename}`,
  });
});

router.post("/api/notices/upload-file", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "첨부파일이 없습니다." });
  }

  return res.json({
    ok: true,
    url: `/uploads/notices/${req.file.filename}`,
    fileUrl: `/uploads/notices/${req.file.filename}`,
    fileName: req.file.originalname,
    storedName: req.file.filename,
    size: req.file.size,
  });
});

export default router;