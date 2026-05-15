import { Router } from "express";
import bcrypt from "bcryptjs";
import { makeSessionCookie, clearSessionCookie, readUserIdFromCookie } from "../auth/session";
import { eq } from "drizzle-orm";

// ✅ 너 프로젝트의 drizzle DB 객체 가져오는 경로로 바꾸기
// 예: "../db" / "../db/client" / "../drizzle" 등
import { db } from "../db";

// ✅ schema 경로는 보통 여기임(네가 올린 코드 기준 drizzle/schema.ts)
// 필요하면 실제 위치로 수정
import { users, organizations } from "../../drizzle/schema";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ message: "username/password required" });

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user || user.isActive === false) return res.status(401).json({ message: "invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash ?? "");
  if (!ok) return res.status(401).json({ message: "invalid credentials" });

const organization = await db.query.organizations.findFirst({
  where: eq(organizations.id, Number(user.organizationId || 0)),
});

if (user.role !== "superhost" && (!organization || organization.status !== "active")) {
  return res.status(403).json({
    message: "현재 이용이 제한된 회사 계정입니다.",
  });
}

  const secret = process.env.SESSION_SECRET || "dev-secret";
  res.setHeader("Set-Cookie", makeSessionCookie(user.id, secret));

  return res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
  });
});

authRouter.post("/logout", async (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.json({ ok: true });
});

authRouter.get("/me", async (req, res) => {
  const secret = process.env.SESSION_SECRET || "dev-secret";
  const userId = readUserIdFromCookie(req, secret);
  if (!userId) return res.status(401).json({ message: "not logged in" });

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || user.isActive === false) return res.status(401).json({ message: "not logged in" });

const organization = await db.query.organizations.findFirst({
  where: eq(organizations.id, Number(user.organizationId || 0)),
});

if (user.role !== "superhost" && (!organization || organization.status !== "active")) {
  return res.status(403).json({
    message: "현재 이용이 제한된 회사 계정입니다.",
  });
}

  return res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
  });
});