import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { authRouter } from "./routes/auth";

async function startServer() {
  const app = express();
  const server = createServer(app);

  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://edu-rem.vercel.app",
    "https://edu-crm-five.vercel.app",
    "https://edu-6h3ot14kk-jjunelee12-4678s-projects.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  const corsOptions: cors.CorsOptions = {
    origin(origin, callback) {
      // 서버-서버 호출이나 일부 툴 요청 허용
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
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
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 204,
  };

  app.set("trust proxy", 1);

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.originalUrl} origin=${req.headers.origin ?? "-"}`);
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.use("/api/auth", authRouter);

  registerOAuthRoutes(app);

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
    console.log("CORS allowed origins:", allowedOrigins);
    console.log("FRONTEND_URL =", process.env.FRONTEND_URL);
    console.log("NODE_ENV =", process.env.NODE_ENV);
  });
}

startServer().catch((error) => {
  console.error("[SERVER START ERROR]", error);
  process.exit(1);
});