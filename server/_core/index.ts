import "dotenv/config";
import express from "express";
import cors from "cors";
import cookie from "cookie";
import crypto from "crypto";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "path";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { authRouter } from "./routes/auth";
import noticeUploadRouter from "../routes/notice-upload";
import holidayRouter from "../routes/holiday.router";
import {
  createChatAttachment,
  createChatMessage,
  getDirectChatRoomBetweenUsers,
  addChatRoomMember,
  createChatRoom,
  markChatRoomRead,
  listChatRoomMembers,
  getChatRoomById,
  getUserById,
  setChatRoomMuted,
  leaveChatRoom,
  createScheduleNotifications,
  createNotification,
updateChatRoomTitle,
} from "../db";

console.log("R2_ACCOUNT_ID:", !!process.env.R2_ACCOUNT_ID);
console.log("R2_ACCESS_KEY_ID:", !!process.env.R2_ACCESS_KEY_ID);
console.log("R2_SECRET_ACCESS_KEY:", !!process.env.R2_SECRET_ACCESS_KEY);
console.log("R2_BUCKET_NAME:", !!process.env.R2_BUCKET_NAME);
console.log("R2_PUBLIC_BASE_URL:", !!process.env.R2_PUBLIC_BASE_URL);

const SESSION_COOKIE = "educrm_session";

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function readUserIdFromSocketToken(
  rawValue: string,
  secret: string
): number | null {
  try {
    const parts = String(rawValue || "").split(".");
    if (parts.length !== 3) return null;

    const [userIdStr, timestampStr, sig] = parts;
    const payload = `${userIdStr}.${timestampStr}`;
    const expected = sign(payload, secret);

    if (sig !== expected) return null;

    const userId = Number(userIdStr);
    const issuedAt = Number(timestampStr);

    if (!Number.isFinite(userId) || userId <= 0) return null;
    if (!Number.isFinite(issuedAt)) return null;

    // 12시간 유효
    if (Date.now() - issuedAt > 1000 * 60 * 60 * 12) return null;

    return userId;
  } catch {
    return null;
  }
}

function readUserIdFromSessionCookieValue(
  rawValue: string,
  secret: string
): number | null {
  try {
    const parts = rawValue.split(".");
    if (parts.length !== 3) return null;

    const [userIdStr, timestampStr, sig] = parts;
    const payload = `${userIdStr}.${timestampStr}`;
    const expected = sign(payload, secret);

    if (sig !== expected) return null;

    const userId = Number(userIdStr);
    if (!Number.isFinite(userId) || userId <= 0) return null;

    return userId;
  } catch {
    return null;
  }
}

function decodeKoreanFilename(name: string) {
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
}

function sanitizeFilename(name: string) {
  return name
    .normalize("NFC")
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "");
}

async function startServer() {
  const app = express();

  const exactAllowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://edu-crm-five.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  const isAllowedOrigin = (origin: string) => {
    if (exactAllowedOrigins.includes(origin)) return true;

    if (
      /^https:\/\/edu-[a-z0-9-]+-jjunelee12-4678s-projects\.vercel\.app$/i.test(
        origin
      )
    ) {
      return true;
    }

    return false;
  };

  const corsOptions: cors.CorsOptions = {
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.error("[CORS BLOCKED]", origin);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    optionsSuccessStatus: 204,
  };

  const server = createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin(origin, callback) {
        if (!origin) return callback(null, true);

        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }

        console.error("[SOCKET CORS BLOCKED]", origin);
        return callback(new Error(`Socket CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  const onlineUserSocketCounts = new Map<number, number>();

  const getOnlineUserIds = () => {
    return Array.from(onlineUserSocketCounts.entries())
      .filter(([, count]) => count > 0)
      .map(([userId]) => userId);
  };

  const increaseOnlineUser = (userId: number) => {
    const prev = onlineUserSocketCounts.get(userId) ?? 0;
    onlineUserSocketCounts.set(userId, prev + 1);
  };

  const decreaseOnlineUser = (userId: number) => {
    const prev = onlineUserSocketCounts.get(userId) ?? 0;
    const next = Math.max(prev - 1, 0);

    if (next <= 0) {
      onlineUserSocketCounts.delete(userId);
    } else {
      onlineUserSocketCounts.set(userId, next);
    }
  };

  io.use((socket, next) => {
  try {
    const origin = socket.handshake.headers.origin;
    const secret = process.env.SESSION_SECRET;
    const socketToken = socket.handshake.auth?.socketToken;

    console.log("[SOCKET AUTH]", {
      origin,
      hasSocketToken: !!socketToken,
      hasCookieHeader: !!socket.handshake.headers.cookie,
    });

    if (!secret) {
      return next(new Error("SESSION_SECRET is missing"));
    }

    // 1) 소켓 토큰 인증 우선
    if (socketToken) {
      const userId = readUserIdFromSocketToken(String(socketToken), secret);

      console.log("[SOCKET AUTH TOKEN]", { userId });

      if (!userId) {
        return next(new Error("UNAUTHORIZED"));
      }

      socket.data.userId = userId;
      return next();
    }

    // 2) fallback: 기존 쿠키 인증
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      return next(new Error("UNAUTHORIZED"));
    }

    const parsed = cookie.parse(cookieHeader);
    const rawSession = parsed[SESSION_COOKIE];

    console.log("[SOCKET AUTH PARSED]", {
      hasSessionCookie: !!rawSession,
    });

    if (!rawSession) {
      return next(new Error("UNAUTHORIZED"));
    }

    const userId = readUserIdFromSessionCookieValue(rawSession, secret);

    console.log("[SOCKET AUTH USER]", { userId });

    if (!userId) {
      return next(new Error("UNAUTHORIZED"));
    }

    socket.data.userId = userId;
    return next();
  } catch (error) {
    console.error("[SOCKET AUTH ERROR]", error);
    return next(new Error("UNAUTHORIZED"));
  }
});



  io.on("connection", (socket) => {
    const userId = Number(socket.data.userId);

    console.log("[SOCKET CONNECT]", { socketId: socket.id, userId });

    socket.join(`user:${userId}`);

    increaseOnlineUser(userId);

    socket.emit("online:users", {
      userIds: getOnlineUserIds(),
    });

    socket.broadcast.emit("user:online", {
      userId,
    });

    socket.on("room:join", async (payload: { roomId: number }) => {
      try {
        const roomId = Number(payload?.roomId);
        if (!roomId) return;

        socket.join(`room:${roomId}`);
        socket.emit("room:joined", { roomId });
      } catch (error) {
        console.error("[SOCKET room:join ERROR]", error);
      }
    });

    socket.on("room:leave", async (payload: { roomId: number }) => {
      try {
        const roomId = Number(payload?.roomId);
        if (!roomId) return;

        socket.leave(`room:${roomId}`);
        socket.emit("room:left", { roomId });
      } catch (error) {
        console.error("[SOCKET room:leave ERROR]", error);
      }
    });

    socket.on(
      "message:send",
      async (
        payload: {
          roomId: number;
          messageType?: "text" | "image" | "file" | "system";
          content?: string;
          fileUrl?: string | null;
          fileName?: string | null;
          fileType?: string | null;
          fileSize?: number | null;
        },
        callback?: (data: any) => void
      ) => {
        try {
          const roomId = Number(payload?.roomId);
          const messageType = payload?.messageType ?? "text";
          const content = (payload?.content ?? "").trim();

          if (!roomId) {
            const response = {
              success: false,
              message: "roomId가 필요합니다.",
            };
            if (callback) callback(response);
            socket.emit("message:error", response);
            return;
          }

          if (messageType === "text" && !content) {
            const response = {
              success: false,
              message: "메시지 내용을 입력해주세요.",
            };
            if (callback) callback(response);
            socket.emit("message:error", response);
            return;
          }

          const messageId = await createChatMessage({
            roomId,
            senderId: userId,
            messageType,
            content: content || null,
          });

          if (!messageId) {
            const response = {
              success: false,
              message: "메시지 저장에 실패했습니다.",
            };
            if (callback) callback(response);
            socket.emit("message:error", response);
            return;
          }

          let attachmentId: number | null = null;

          if (payload?.fileUrl && payload?.fileName) {
            attachmentId = await createChatAttachment({
              messageId: Number(messageId),
              fileName: payload.fileName,
              fileUrl: payload.fileUrl,
              fileType: payload.fileType ?? null,
              fileSize: payload.fileSize ?? null,
            });
          }

          const sender = await getUserById(userId);
	const senderAny = sender as any;

          const emittedMessage = {
            id: Number(messageId),
            roomId,
            senderId: userId,
           senderName: senderAny?.name ?? "",
senderUsername: senderAny?.username ?? "",
senderProfileImageUrl: senderAny?.profileImageUrl ?? null,
senderAvatarUrl: senderAny?.avatarUrl ?? null,
senderPositionName: senderAny?.positionName ?? null,
            messageType,
            content: content || "",
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: null,
            attachmentId: attachmentId ? Number(attachmentId) : null,
            fileUrl: payload?.fileUrl ?? null,
            fileName: payload?.fileName ?? null,
            fileType: payload?.fileType ?? null,
            fileSize: payload?.fileSize ?? null,
          };

          const members = await listChatRoomMembers(roomId, userId);

// 방 안에서 보고 있는 사용자용 보조 이벤트
io.to(`room:${roomId}`).emit("typing:stop", {
  roomId,
  userId,
});

// 실제 새 메시지 이벤트는 참여자 개인 room으로 전송
for (const member of members) {
  const memberUserId = Number(member.userId);

  io.to(`user:${memberUserId}`).emit("message:new", emittedMessage);

  io.to(`user:${memberUserId}`).emit("room:list:update", {
    roomId,
    lastMessage: emittedMessage,
  });

  if (memberUserId === userId) continue;

  await createNotification({
    userId: memberUserId,
    type: "messenger",
    message:
      messageType === "text"
        ? `[메신저] ${sender?.name ?? "사용자"}님의 새 메시지`
        : `[메신저] ${sender?.name ?? "사용자"}님이 파일을 보냈습니다.`,
    relatedId: roomId,
    isRead: false,
  } as any);
}

          if (callback) {
            callback({
              success: true,
              roomId,
              messageId: Number(messageId),
              attachmentId,
            });
          }
        } catch (error: any) {
          console.error("[SOCKET message:send ERROR]", error);

          const response = {
            success: false,
            message: error?.message || "메시지 전송 중 오류가 발생했습니다.",
          };

          if (callback) callback(response);
          socket.emit("message:error", response);
        }
      }
    );

    socket.on(
      "read:update",
      async (
        payload: { roomId: number; lastReadMessageId: number },
        callback?: (data: any) => void
      ) => {
        try {
          const roomId = Number(payload?.roomId);
          const lastReadMessageId = Number(payload?.lastReadMessageId);

          if (!roomId || !lastReadMessageId) {
            const response = {
              success: false,
              message: "roomId와 lastReadMessageId가 필요합니다.",
            };
            if (callback) callback(response);
            return;
          }

          await markChatRoomRead({
            roomId,
            userId,
            lastReadMessageId,
          });

          io.to(`room:${roomId}`).emit("read:update", {
            roomId,
            userId,
            lastReadMessageId,
          });

          io.to(`user:${userId}`).emit("room:list:update", {
            roomId,
            unreadCount: 0,
          });

          if (callback) {
            callback({
              success: true,
              roomId,
              lastReadMessageId,
            });
          }
        } catch (error: any) {
          console.error("[SOCKET read:update ERROR]", error);

          if (callback) {
            callback({
              success: false,
              message: error?.message || "읽음 처리 중 오류가 발생했습니다.",
            });
          }
        }
      }
    );

    socket.on(
      "typing:start",
      async (payload: { roomId: number }) => {
        try {
          const roomId = Number(payload?.roomId);
          if (!roomId) return;

          socket.to(`room:${roomId}`).emit("typing:start", {
            roomId,
            userId,
          });
        } catch (error) {
          console.error("[SOCKET typing:start ERROR]", error);
        }
      }
    );

    socket.on(
      "typing:stop",
      async (payload: { roomId: number }) => {
        try {
          const roomId = Number(payload?.roomId);
          if (!roomId) return;

          socket.to(`room:${roomId}`).emit("typing:stop", {
            roomId,
            userId,
          });
        } catch (error) {
          console.error("[SOCKET typing:stop ERROR]", error);
        }
      }
    );

    socket.on(
      "room:mute",
      async (
        payload: { roomId: number; isMuted: boolean },
        callback?: (data: any) => void
      ) => {
        try {
          const roomId = Number(payload?.roomId);
          const isMuted = !!payload?.isMuted;

          if (!roomId) {
            const response = {
              success: false,
              message: "roomId가 필요합니다.",
            };
            if (callback) callback(response);
            return;
          }

          await setChatRoomMuted({
            roomId,
            userId,
            isMuted,
          });

          socket.emit("room:muted", {
            roomId,
            isMuted,
          });

          socket.emit("room:list:update", {
            roomId,
          });

          if (callback) {
            callback({
              success: true,
              roomId,
              isMuted,
            });
          }
        } catch (error: any) {
          console.error("[SOCKET room:mute ERROR]", error);
          if (callback) {
            callback({
              success: false,
              message: error?.message || "알림 설정 변경 중 오류가 발생했습니다.",
            });
          }
        }
      }
    );

    socket.on(
      "room:leave:confirm",
      async (
        payload: { roomId: number },
        callback?: (data: any) => void
      ) => {
        try {
          const roomId = Number(payload?.roomId);

          if (!roomId) {
            const response = {
              success: false,
              message: "roomId가 필요합니다.",
            };
            if (callback) callback(response);
            return;
          }

          const actor = await getUserById(userId);
const actorName = actor?.name || actor?.username || "사용자";

const systemText = `${actorName}님이 채팅방을 나갔습니다.`;

const systemMessageId = await createChatMessage({
  roomId,
  senderId: userId,
  messageType: "system",
  content: systemText,
});

const emittedSystemMessage = {
  id: Number(systemMessageId),
  roomId,
  senderId: userId,
  senderName: "system",
  senderUsername: "system",
  messageType: "system",
  content: systemText,
  isDeleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: null,
  attachmentId: null,
  fileUrl: null,
  fileName: null,
  fileType: null,
  fileSize: null,
};

const membersBeforeLeave = await listChatRoomMembers(roomId, userId);

// 참여자 개인 room에도 시스템 메시지 전송
for (const member of membersBeforeLeave) {
  const memberUserId = Number(member.userId);

  io.to(`user:${memberUserId}`).emit("message:new", emittedSystemMessage);
  io.to(`user:${memberUserId}`).emit("room:list:update", {
    roomId,
    lastMessage: emittedSystemMessage,
  });
}

await leaveChatRoom({
  roomId,
  userId,
});

socket.leave(`room:${roomId}`);
socket.emit("room:list:update", { roomId });

if (callback) {
  callback({
    success: true,
    roomId,
  });
}
        } catch (error: any) {
          console.error("[SOCKET room:leave:confirm ERROR]", error);
          if (callback) {
            callback({
              success: false,
              message: error?.message || "방 나가기 처리 중 오류가 발생했습니다.",
            });
          }
        }
      }
    );

    socket.on(
      "direct:create",
      async (
        payload: { targetUserId: number },
        callback?: (data: any) => void
      ) => {
        try {
          const targetUserId = Number(payload?.targetUserId);

          if (!targetUserId || targetUserId === userId) {
            const response = {
              success: false,
              message: "잘못된 사용자입니다.",
            };
            if (callback) callback(response);
            return;
          }

          const existingRoom = await getDirectChatRoomBetweenUsers(
            userId,
            targetUserId
          );

          if (existingRoom?.id) {
            const response = {
              success: true,
              roomId: Number(existingRoom.id),
              existing: true,
            };

            if (callback) callback(response);

            io.to(`user:${userId}`).emit("room:list:update", {
              roomId: Number(existingRoom.id),
            });
            io.to(`user:${targetUserId}`).emit("room:list:update", {
              roomId: Number(existingRoom.id),
            });
            return;
          }

          const roomId = await createChatRoom({
            roomType: "direct",
            title: null,
            createdBy: userId,
          });

          await addChatRoomMember({
            roomId: Number(roomId),
            userId,
          });

          await addChatRoomMember({
            roomId: Number(roomId),
            userId: targetUserId,
          });

          const createdRoom = await getChatRoomById(Number(roomId));

          const response = {
            success: true,
            roomId: Number(createdRoom?.id ?? roomId),
            existing: false,
          };

          if (callback) callback(response);

          io.to(`user:${userId}`).emit("room:list:update", {
            roomId: Number(roomId),
          });
          io.to(`user:${targetUserId}`).emit("room:list:update", {
            roomId: Number(roomId),
          });
        } catch (error: any) {
          console.error("[SOCKET direct:create ERROR]", error);

          const response = {
            success: false,
            message: error?.message || "1:1 채팅방 생성 중 오류가 발생했습니다.",
          };

          if (callback) callback(response);
        }
      }
    );

socket.on(
  "room:members:add",
  async (
    payload: { roomId: number; userIds: number[] },
    callback?: (data: any) => void
  ) => {
    try {
      const roomId = Number(payload?.roomId);
      const userIds = (payload?.userIds || []).map(Number);

      if (!roomId || userIds.length === 0) {
        return callback?.({
          success: false,
          message: "roomId / userIds 필요",
        });
      }

      // 현재 방 멤버 확인
      const members = await listChatRoomMembers(roomId, userId);
      const existingIds = members.map((m) => Number(m.userId));

      const newUserIds = userIds.filter(
        (id) => !existingIds.includes(id)
      );

      for (const uid of newUserIds) {
        await addChatRoomMember({
          roomId,
          userId: uid,
        });

        // 방 join
        io.to(`user:${uid}`).emit("room:list:update", { roomId });
      }

      io.to(`room:${roomId}`).emit("room:list:update", { roomId });

      callback?.({
        success: true,
        addedUserIds: newUserIds,
      });
    } catch (err: any) {
      console.error("[room:members:add ERROR]", err);
      callback?.({
        success: false,
        message: err?.message || "멤버 추가 실패",
      });
    }
  }
);

socket.on(
  "room:title:update",
  async (
    payload: { roomId: number; title: string },
    callback?: (data: any) => void
  ) => {
    try {
      const roomId = Number(payload?.roomId);
      const title = (payload?.title || "").trim();

      if (!roomId || !title) {
        return callback?.({
          success: false,
          message: "roomId / title 필요",
        });
      }

      // DB 업데이트 (직접 쿼리 or 함수 필요)
      await updateChatRoomTitle({
        roomId,
        title,
      });

      const systemText = `채팅방 이름이 "${title}"(으)로 변경되었습니다.`;

      const messageId = await createChatMessage({
        roomId,
        senderId: userId,
        messageType: "system",
        content: systemText,
      });

      const emittedMessage = {
        id: Number(messageId),
        roomId,
        senderId: userId,
        senderName: "system",
        senderUsername: "system",
        messageType: "system",
        content: systemText,
        createdAt: new Date().toISOString(),
      };

      const members = await listChatRoomMembers(roomId, userId);

for (const m of members) {
  const memberUserId = Number(m.userId);

  io.to(`user:${memberUserId}`).emit("message:new", emittedMessage);
  io.to(`user:${memberUserId}`).emit("room:list:update", {
    roomId,
    lastMessage: emittedMessage,
  });
}

      callback?.({
        success: true,
        roomId,
        title,
      });
    } catch (err: any) {
      console.error("[room:title:update ERROR]", err);
      callback?.({
        success: false,
        message: err?.message || "이름 변경 실패",
      });
    }
  }
);

    socket.on("disconnect", (reason) => {
      decreaseOnlineUser(userId);

      console.log("[SOCKET DISCONNECT]", { socketId: socket.id, userId, reason });

      if (!onlineUserSocketCounts.has(userId)) {
        socket.broadcast.emit("user:offline", {
          userId,
        });
      }
    });
  });

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
      const allowedExt = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".hwp",
      ];

      const ext = path.extname(file.originalname).toLowerCase();

      if (!allowedExt.includes(ext)) {
        return cb(new Error("지원하지 않는 파일 형식입니다."));
      }

      cb(null, true);
    },
  });

  app.set("trust proxy", 1);

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  app.use("/api/auth", authRouter);
  app.use("/api/holidays", holidayRouter);
  app.use(noticeUploadRouter);

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          message: "파일이 없습니다.",
        });
      }

      const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
      const bucketName = process.env.R2_BUCKET_NAME;

      if (!publicBaseUrl) {
        return res.status(500).json({
          message: "R2_PUBLIC_BASE_URL 환경변수가 설정되지 않았습니다.",
        });
      }

      if (!bucketName) {
        return res.status(500).json({
          message: "R2_BUCKET_NAME 환경변수가 설정되지 않았습니다.",
        });
      }

      const decodedOriginalName = decodeKoreanFilename(file.originalname);
      const safeOriginalName = sanitizeFilename(decodedOriginalName);

      const ext = path.extname(safeOriginalName);
      const base = path.basename(safeOriginalName, ext);

      const key = `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}_${base}${ext}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      return res.json({
        success: true,
        fileName: safeOriginalName,
        fileUrl: `${publicBaseUrl}/${encodeURIComponent(key)}`,
      });
    } catch (error: any) {
      console.error("[UPLOAD ERROR]", error);
      return res.status(500).json({
        message: error?.message || "파일 업로드 중 오류가 발생했습니다.",
      });
    }
  });

  registerOAuthRoutes(app);

  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          message: err.message || "업로드 오류가 발생했습니다.",
        });
      }

      if (err?.message?.includes("지원하지 않는 파일 형식")) {
        return res.status(400).json({
          message: err.message,
        });
      }

      next(err);
    }
  );

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "3000", 10);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
    console.log("Exact CORS allowed origins:", exactAllowedOrigins);
  });
}

// 🔔 일정 알림 자동 실행 (1분마다)
setInterval(async () => {
  try {
    const result = await createScheduleNotifications();

    if (result?.count > 0) {
      console.log("[SCHEDULE NOTIFY]", result.count);
    }
  } catch (err) {
    console.error("[SCHEDULE NOTIFY ERROR]", err);
  }
}, 60 * 1000);

startServer().catch((error) => {
  console.error("[SERVER START ERROR]", error);
  process.exit(1);
});