import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import cookie from "cookie";
import { getUserById } from "../db";

const router = express.Router();

const SESSION_COOKIE = "educrm_session";

function readUserIdFromSessionCookieValue(raw: string, secret: string) {
  try {
    const [userIdStr] = String(raw || "").split(".");
    const userId = Number(userIdStr);
    return Number.isFinite(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}

async function getOrganizationId(req: express.Request) {
  const cookieHeader = req.headers.cookie || "";
  const parsedCookies = cookie.parse(cookieHeader);
  const rawSession = parsedCookies[SESSION_COOKIE];
  const secret = process.env.SESSION_SECRET;

  if (rawSession && secret) {
    const userId = readUserIdFromSessionCookieValue(rawSession, secret);
    if (userId) {
      const user = await getUserById(userId);
      return Number((user as any)?.organizationId || 1);
    }
  }

  return 1;
}

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
  const organizationId = await getOrganizationId(req);
    const uploadDir = path.resolve(
      process.cwd(),
      "uploads",
      "notices",
      `org-${organizationId}`
    );

    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "-")
      .replace(/[^\w가-힣.-]/g, "");

    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post("/api/notices/upload-image", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "이미지 파일이 없습니다." });
  }

  const organizationId = await getOrganizationId(req);
  const url = `/uploads/notices/org-${organizationId}/${req.file.filename}`;

  return res.json({
    ok: true,
    url,
  });
});

router.post("/api/notices/upload-file", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "첨부파일이 없습니다." });
  }

  const organizationId = await getOrganizationId(req);
  const url = `/uploads/notices/org-${organizationId}/${req.file.filename}`;

  return res.json({
    ok: true,
    url,
    fileUrl: url,
    fileName: req.file.originalname,
    storedName: req.file.filename,
    size: req.file.size,
  });
});

export default router;