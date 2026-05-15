import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import cookie from "cookie";
import { getUserById, createAuditLog } from "../db";
import { getOrganizationLimitStatus } from "../saasdb";

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

async function getUploadUser(req: express.Request) {
  const cookieHeader = req.headers.cookie || "";
  const parsedCookies = cookie.parse(cookieHeader);
  const rawSession = parsedCookies[SESSION_COOKIE];
  const secret = process.env.SESSION_SECRET;

  if (!rawSession || !secret) return null;

  const userId = readUserIdFromSessionCookieValue(rawSession, secret);
  if (!userId) return null;

  return getUserById(userId);
}

function getOrgUploadDir(organizationId: number) {
  return path.resolve(
    process.cwd(),
    "uploads",
    "notices",
    `org-${organizationId}`
  );
}

function getOrgUploadUsageBytes(organizationId: number) {
  const dir = getOrgUploadDir(organizationId);
  if (!fs.existsSync(dir)) return 0;

  const files = fs.readdirSync(dir);
  return files.reduce((sum, filename) => {
    const fullPath = path.join(dir, filename);
    const stat = fs.statSync(fullPath);
    return stat.isFile() ? sum + stat.size : sum;
  }, 0);
}

async function assertNoticeUploadAllowed(req: express.Request, fileSize: number) {
  const user = await getUploadUser(req);

  if (!user) {
    return {
      ok: false as const,
      status: 401,
      message: "로그인이 필요합니다.",
      user: null,
      organizationId: 0,
    };
  }

  const organizationId = Number((user as any)?.organizationId || 0);

if ((user as any)?.role !== "superhost" && !organizationId) {
  return {
    ok: false as const,
    status: 403,
    message: "organizationId is required",
    user,
    organizationId,
  };
}

  if ((user as any)?.role !== "superhost") {
    const limitStatus = await getOrganizationLimitStatus(organizationId);
    const organization = limitStatus.organization as any;

    if (!organization || organization.status !== "active") {
      return {
        ok: false as const,
        status: 403,
        message: "현재 이용이 제한된 회사 계정입니다.",
        user,
        organizationId,
      };
    }

    const maxStorageMb = Number(limitStatus.limits.maxStorageMb || 0);

    if (maxStorageMb > 0) {
  const currentBytes = Number((limitStatus.usage as any)?.storageUsedBytes || 0);
  const nextBytes = currentBytes + Number(fileSize || 0);
  const maxBytes = maxStorageMb * 1024 * 1024;

  if (nextBytes > maxBytes) {
        return {
          ok: false as const,
          status: 403,
          message: `저장공간 제한(${maxStorageMb}MB)을 초과했습니다.`,
          user,
          organizationId,
        };
      }
    }
  }

  return {
    ok: true as const,
    user,
    organizationId,
  };
}

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
  try {
    const user = await getUploadUser(req);

    if (!user) {
      return cb(new Error("로그인이 필요합니다."), "");
    }

    const organizationId = Number((user as any)?.organizationId || 0);

if ((user as any)?.role !== "superhost" && !organizationId) {
  return cb(new Error("organizationId is required"), "");
}

const uploadDir = getOrgUploadDir(organizationId);

    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  } catch (error: any) {
    cb(error, "");
  }
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

  const allowed = await assertNoticeUploadAllowed(req, req.file.size);
  if (!allowed.ok) {
    fs.unlinkSync(req.file.path);
    return res.status(allowed.status).json({ message: allowed.message });
  }

  const organizationId = allowed.organizationId;
  const url = `/uploads/notices/org-${organizationId}/${req.file.filename}`;

  await createAuditLog({
    organizationId,
    actorUserId: Number((allowed.user as any).id),
    actorRole: String((allowed.user as any).role || ""),
    action: "notice.upload.image",
    targetType: "notice_upload",
    targetId: null,
    beforeJson: null,
    afterJson: JSON.stringify({
      url,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
    }),
    memo: "notice image upload",
  });

  return res.json({
    ok: true,
    url,
  });
});

router.post("/api/notices/upload-file", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "첨부파일이 없습니다." });
  }

  const allowed = await assertNoticeUploadAllowed(req, req.file.size);
  if (!allowed.ok) {
    fs.unlinkSync(req.file.path);
    return res.status(allowed.status).json({ message: allowed.message });
  }

  const organizationId = allowed.organizationId;
  const url = `/uploads/notices/org-${organizationId}/${req.file.filename}`;

  await createAuditLog({
    organizationId,
    actorUserId: Number((allowed.user as any).id),
    actorRole: String((allowed.user as any).role || ""),
    action: "notice.upload.file",
    targetType: "notice_upload",
    targetId: null,
    beforeJson: null,
    afterJson: JSON.stringify({
      url,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
    }),
    memo: "notice file upload",
  });

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