import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "path";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { authRouter } from "./routes/auth";

async function startServer() {
  const app = express();
  const server = createServer(app);

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
      fileSize: 20 * 1024 * 1024, // 20MB
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

  const exactAllowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://edu-crm-five.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  const isAllowedOrigin = (origin: string) => {
    if (exactAllowedOrigins.includes(origin)) return true;

    // Vercel preview deployments 허용
    if (
      /^https:\/\/edu-[a-z0-9-]+-jjunelee12-4678s-projects\.vercel\.app$/i.test(origin)
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

  app.set("trust proxy", 1);

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.use("/api/auth", authRouter);

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          message: "파일이 없습니다.",
        });
      }

      const ext = path.extname(file.originalname);
      const base = path
        .basename(file.originalname, ext)
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-가-힣]/g, "");

      const key = `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}_${base}${ext}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

      if (!publicBaseUrl) {
        return res.status(500).json({
          message: "R2_PUBLIC_BASE_URL 환경변수가 설정되지 않았습니다.",
        });
      }

      return res.json({
        success: true,
        fileName: file.originalname,
        fileUrl: `${publicBaseUrl}/${key}`,
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
    (err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
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

startServer().catch((error) => {
  console.error("[SERVER START ERROR]", error);
  process.exit(1);
});