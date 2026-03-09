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
    "https://edu-crm-five.vercel.app",
    "https://edu-6h3ot14kk-jjunelee12-4678s-projects.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.use(
    cors({
      origin(origin, callback) {
        // 서버-서버 요청이나 same-origin 없는 경우 허용
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.options("*", cors());

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
  });
}

startServer().catch((error) => {
  console.error("[SERVER START ERROR]", error);
  process.exit(1);
});