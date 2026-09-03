import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import cookie from "cookie";
import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  getUserById,
  createAuditLog,
  createWorkPostAttachment,
getWorkPostAttachmentForDownload,
getWorkPostAttachmentForDelete,
deleteWorkPostAttachmentRecord,
} from "../db";

import { getOrganizationLimitStatus } from "../saasdb";

const router = express.Router();

const SESSION_COOKIE = "educrm_session";

const MAX_FILE_SIZE_BYTES =
  20 * 1024 * 1024;

/**
 * 기존 notice-upload.ts와 동일한 세션 형식을 사용한다.
 */
function readUserIdFromSessionCookieValue(
  rawValue: string,
  secret: string
): number | null {
  try {
    const parts = String(
      rawValue || ""
    ).split(".");

    if (parts.length !== 3) {
      return null;
    }

    const [
      userIdStr,
      timestampStr,
      signature,
    ] = parts;

    const payload =
      `${userIdStr}.${timestampStr}`;

    const expectedSignature =
      createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

    const receivedBuffer =
      Buffer.from(signature, "utf8");

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        "utf8"
      );

    if (
      receivedBuffer.length !==
      expectedBuffer.length
    ) {
      return null;
    }

    if (
      !timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      )
    ) {
      return null;
    }

    const userId = Number(userIdStr);
    const issuedAt = Number(timestampStr);

    if (
      !Number.isFinite(userId) ||
      userId <= 0
    ) {
      return null;
    }

    if (!Number.isFinite(issuedAt)) {
      return null;
    }

    return userId;
  } catch {
    return null;
  }
}

/**
 * 업로드 요청의 로그인 사용자 확인
 */
async function getUploadUser(
  req: express.Request
) {
  const cookieHeader =
    req.headers.cookie || "";

  const parsedCookies =
    cookie.parse(cookieHeader);

  const rawSession =
    parsedCookies[SESSION_COOKIE];

  const secret =
    process.env.SESSION_SECRET;

  if (!rawSession || !secret) {
    return null;
  }

  const userId =
    readUserIdFromSessionCookieValue(
      rawSession,
      secret
    );

  if (!userId) {
    return null;
  }

  return await getUserById(userId);
}

/**
 * 회사별 업무 커뮤니티 업로드 폴더
 *
 * uploads/
 *   work-community/
 *     org-1/
 *     org-2/
 */
function getWorkCommunityUploadDir(
  organizationId: number
) {
  return path.resolve(
  process.cwd(),
  "private-uploads",
  "work-community",
  `org-${organizationId}`
);
}

/**
 * 삭제 대상 파일의 실제 경로 생성
 *
 * path.basename을 사용해서 ../ 경로 조작을 차단한다.
 */
function getStoredFilePath(
  organizationId: number,
  storedName: string
) {
  const uploadDir =
    getWorkCommunityUploadDir(
      organizationId
    );

  const safeStoredName =
    path.basename(storedName);

  const filePath = path.resolve(
    uploadDir,
    safeStoredName
  );

  const allowedPrefix =
    `${uploadDir}${path.sep}`;

  if (!filePath.startsWith(allowedPrefix)) {
    throw new Error(
      "허용되지 않은 파일 경로입니다."
    );
  }

  return filePath;
}

/**
 * 실패한 업로드 파일 안전 삭제
 */
function removeUploadedFileSafely(
  filePath?: string | null
) {
  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(
      "[WORK_COMMUNITY_UPLOAD_REMOVE_FAILED]",
      error
    );
  }
}

/**
 * 회사 상태와 저장공간 제한 확인
 */
async function assertUploadAllowed(
  req: express.Request,
  fileSize: number
) {
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

  const organizationId = Number(
    (user as any)?.organizationId || 0
  );

  /**
   * Superhost라도 업무 커뮤니티는
   * 대상 회사 organizationId가 반드시 필요하다.
   */
  if (
    !Number.isFinite(organizationId) ||
    organizationId <= 0
  ) {
    return {
      ok: false as const,
      status: 403,
      message: "organizationId is required",
      user,
      organizationId: 0,
    };
  }

  if ((user as any)?.role !== "superhost") {
    const limitStatus =
      await getOrganizationLimitStatus(
        organizationId
      );

    const organization =
      limitStatus.organization as any;

    if (
      !organization ||
      organization.status !== "active"
    ) {
      return {
        ok: false as const,
        status: 403,
        message:
          "현재 이용이 제한된 회사 계정입니다.",
        user,
        organizationId,
      };
    }

    const maxStorageMb = Number(
      limitStatus.limits.maxStorageMb || 0
    );

    if (maxStorageMb > 0) {
      const currentBytes = Number(
        (limitStatus.usage as any)
          ?.storageUsedBytes || 0
      );

      const nextBytes =
        currentBytes +
        Number(fileSize || 0);

      const maxBytes =
        maxStorageMb * 1024 * 1024;

      if (nextBytes > maxBytes) {
        return {
          ok: false as const,
          status: 403,
          message:
            `저장공간 제한(${maxStorageMb}MB)을 초과했습니다.`,
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

/**
 * Multer 저장 설정
 */
const storage = multer.diskStorage({
  destination: async (
    req,
    _file,
    callback
  ) => {
    try {
      const user =
        await getUploadUser(req);

      if (!user) {
        return callback(
          new Error("로그인이 필요합니다."),
          ""
        );
      }

      const organizationId = Number(
        (user as any)?.organizationId || 0
      );

      if (
        !Number.isFinite(organizationId) ||
        organizationId <= 0
      ) {
        return callback(
          new Error(
            "organizationId is required"
          ),
          ""
        );
      }

      const uploadDir =
        getWorkCommunityUploadDir(
          organizationId
        );

      fs.mkdirSync(uploadDir, {
        recursive: true,
      });

      callback(null, uploadDir);
    } catch (error: any) {
      callback(error, "");
    }
  },

  filename: (
    _req,
    file,
    callback
  ) => {
    const extension =
      path.extname(file.originalname)
        .toLowerCase()
        .slice(0, 20);

    const originalBaseName =
      path.basename(
        file.originalname,
        path.extname(file.originalname)
      );

    const safeBaseName =
      originalBaseName
        .replace(/\s+/g, "-")
        .replace(/[^\w가-힣.-]/g, "")
        .slice(0, 80) || "file";

    const uniqueName =
      `${Date.now()}-${randomUUID()}-${safeBaseName}${extension}`;

    callback(null, uniqueName);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },

  fileFilter: (
    _req,
    file,
    callback
  ) => {
    /**
     * 실행 파일 및 스크립트 업로드 차단
     */
    const blockedExtensions = new Set([
      ".exe",
      ".com",
      ".bat",
      ".cmd",
      ".msi",
      ".scr",
      ".ps1",
      ".sh",
      ".js",
      ".mjs",
      ".cjs",
      ".php",
      ".jsp",
      ".asp",
      ".aspx",
    ]);

    const extension =
      path.extname(file.originalname)
        .toLowerCase();

    if (
      blockedExtensions.has(extension)
    ) {
      return callback(
        new Error(
          "허용되지 않는 파일 형식입니다."
        )
      );
    }

    callback(null, true);
  },
});

/**
 * 첨부파일 등록
 *
 * 요청 형식:
 * POST /api/work-community/:postId/attachments
 *
 * FormData:
 * file = 실제 파일
 */
router.post(
  "/api/work-community/:postId/attachments",
  upload.single("file"),
  async (req, res) => {
    try {
      const postId = Number(
        req.params.postId
      );

      if (
        !Number.isFinite(postId) ||
        postId <= 0
      ) {
        removeUploadedFileSafely(
          req.file?.path
        );

        return res.status(400).json({
          message:
            "올바른 게시글 ID가 아닙니다.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message:
            "첨부파일이 없습니다.",
        });
      }

      const allowed =
        await assertUploadAllowed(
          req,
          req.file.size
        );

      if (!allowed.ok) {
        removeUploadedFileSafely(
          req.file.path
        );

        return res
          .status(allowed.status)
          .json({
            message: allowed.message,
          });
      }

      const organizationId =
        allowed.organizationId;

      const userId = Number(
        (allowed.user as any).id
      );

      const role = String(
        (allowed.user as any).role || ""
      );

      /**
 * 업무 커뮤니티 첨부파일은 공개 URL을 저장하지 않는다.
 * 다운로드는 인증 API를 통해서만 처리한다.
 */
const url = "";

      let attachmentId: number;

      try {
        attachmentId =
          await createWorkPostAttachment({
            organizationId,
            postId,
            userId,
            role,
            originalName:
              req.file.originalname,
            storedName:
              req.file.filename,
            url,
            mimeType:
              req.file.mimetype,
            sizeBytes:
              req.file.size,
          });
      } catch (error) {
        /**
         * DB 등록이나 게시글 권한 검사 실패 시
         * 이미 저장된 실제 파일을 제거한다.
         */
        removeUploadedFileSafely(
          req.file.path
        );

        throw error;
      }

      await createAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: role,
        action:
          "work_community.attachment.upload",
        targetType:
          "work_post_attachment",
        targetId: attachmentId,
        beforeJson: null,
        afterJson: JSON.stringify({
          postId,
          attachmentId,
          url,
          originalName:
            req.file.originalname,
          storedName:
            req.file.filename,
          sizeBytes:
            req.file.size,
          mimeType:
            req.file.mimetype,
        }),
        memo:
          "work community attachment upload",
      });

      return res.json({
        ok: true,

        attachment: {
          id: attachmentId,
          postId,
          originalName:
            req.file.originalname,
          storedName:
            req.file.filename,
          url,
          mimeType:
            req.file.mimetype,
          sizeBytes:
            req.file.size,
        },
      });
    } catch (error: any) {
      console.error(
        "[WORK_COMMUNITY_UPLOAD_ERROR]",
        error
      );

      removeUploadedFileSafely(
        req.file?.path
      );

      return res.status(400).json({
        message:
          error?.message ||
          "첨부파일 업로드 중 오류가 발생했습니다.",
      });
    }
  }
);

/**
 * 첨부파일 보호 다운로드
 *
 * GET /api/work-community/attachments/:attachmentId/download
 */
router.get(
  "/api/work-community/attachments/:attachmentId/download",
  async (req, res) => {
    try {
      const attachmentId = Number(
        req.params.attachmentId
      );

      if (
        !Number.isFinite(attachmentId) ||
        attachmentId <= 0
      ) {
        return res.status(400).json({
          message:
            "올바른 첨부파일 ID가 아닙니다.",
        });
      }

      const user =
        await getUploadUser(req);

      if (!user) {
        return res.status(401).json({
          message:
            "로그인이 필요합니다.",
        });
      }

      const organizationId = Number(
        (user as any).organizationId || 0
      );

      const userId = Number(
        (user as any).id
      );

      const role = String(
        (user as any).role || ""
      );

      if (
        !Number.isFinite(
          organizationId
        ) ||
        organizationId <= 0
      ) {
        return res.status(403).json({
          message:
            "organizationId is required",
        });
      }

      const attachment =
        await getWorkPostAttachmentForDownload({
          organizationId,
          attachmentId,
          userId,
          role,
        });

      if (!attachment) {
        return res.status(404).json({
          message:
            "첨부파일을 찾을 수 없거나 접근 권한이 없습니다.",
        });
      }

      const storedName = String(
        (attachment as any).storedName ||
          ""
      );

      if (!storedName) {
        return res.status(404).json({
          message:
            "첨부파일 저장 정보가 없습니다.",
        });
      }

      const filePath =
        getStoredFilePath(
          organizationId,
          storedName
        );

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          message:
            "첨부파일이 서버에 존재하지 않습니다.",
        });
      }

      const originalName =
        path.basename(
          String(
            (attachment as any)
              .originalName ||
              storedName
          )
        );

      const mimeType = String(
        (attachment as any).mimeType ||
          ""
      );

      res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
      );

      if (mimeType) {
        res.type(mimeType);
      }

      return res.download(
        filePath,
        originalName,
        error => {
          if (
            error &&
            !res.headersSent
          ) {
            console.error(
              "[WORK_COMMUNITY_ATTACHMENT_DOWNLOAD_ERROR]",
              error
            );

            res.status(500).json({
              message:
                "첨부파일 다운로드 중 오류가 발생했습니다.",
            });
          }
        }
      );
    } catch (error) {
      console.error(
        "[WORK_COMMUNITY_ATTACHMENT_DOWNLOAD_ERROR]",
        error
      );

      return res.status(500).json({
        message:
          "첨부파일 다운로드 중 오류가 발생했습니다.",
      });
    }
  }
);

/**
 * 첨부파일 삭제
 *
 * DELETE /api/work-community/attachments/:attachmentId
 */
router.delete(
  "/api/work-community/attachments/:attachmentId",
  async (req, res) => {
    try {
      const attachmentId = Number(
        req.params.attachmentId
      );

      if (
        !Number.isFinite(attachmentId) ||
        attachmentId <= 0
      ) {
        return res.status(400).json({
          message:
            "올바른 첨부파일 ID가 아닙니다.",
        });
      }

      const user =
        await getUploadUser(req);

      if (!user) {
        return res.status(401).json({
          message: "로그인이 필요합니다.",
        });
      }

      const organizationId = Number(
        (user as any)?.organizationId || 0
      );

      if (
        !Number.isFinite(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(403).json({
          message:
            "organizationId is required",
        });
      }

      const userId = Number(
        (user as any).id
      );

      const role = String(
        (user as any).role || ""
      );

      /**
       * DB 삭제 전에 파일 정보와 권한을 먼저 확인한다.
       */
      const attachment =
        await getWorkPostAttachmentForDelete({
          organizationId,
          attachmentId,
          userId,
          role,
        });

      if (!attachment) {
        return res.status(404).json({
          message:
            "첨부파일을 찾을 수 없습니다.",
        });
      }

      const storedName = String(
        (attachment as any).storedName || ""
      );

      if (!storedName) {
        return res.status(400).json({
          message:
            "첨부파일 저장 정보가 없습니다.",
        });
      }

      const filePath =
        getStoredFilePath(
          organizationId,
          storedName
        );

      /**
       * 실제 파일부터 삭제한다.
       *
       * 이미 파일이 없으면 DB 기록 정리는 계속 진행한다.
       */
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await deleteWorkPostAttachmentRecord({
        organizationId,
        attachmentId,
        userId,
        role,
      });

      await createAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: role,
        action:
          "work_community.attachment.delete",
        targetType:
          "work_post_attachment",
        targetId: attachmentId,
        beforeJson: JSON.stringify({
          postId: Number(
            (attachment as any).postId
          ),
          originalName:
            (attachment as any).originalName,
          storedName:
            (attachment as any).storedName,
          url:
            (attachment as any).url,
          sizeBytes:
            (attachment as any).sizeBytes,
          mimeType:
            (attachment as any).mimeType,
        }),
        afterJson: null,
        memo:
          "work community attachment delete",
      });

      return res.json({
        ok: true,
      });
    } catch (error: any) {
      console.error(
        "[WORK_COMMUNITY_ATTACHMENT_DELETE_ERROR]",
        error
      );

      return res.status(400).json({
        message:
          error?.message ||
          "첨부파일 삭제 중 오류가 발생했습니다.",
      });
    }
  }
);

/**
 * Multer 오류 처리
 *
 * 파일이 20MB를 초과하거나 차단 확장자인 경우
 * JSON 오류 메시지를 반환한다.
 */
router.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!error) {
      return next();
    }

    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
      return res.status(413).json({
        message:
          "첨부파일은 최대 20MB까지 업로드할 수 있습니다.",
      });
    }

    return res.status(400).json({
      message:
        error?.message ||
        "첨부파일 처리 중 오류가 발생했습니다.",
    });
  }
);

export default router;