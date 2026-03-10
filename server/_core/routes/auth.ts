import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  makeSessionCookie,
  clearSessionCookie,
  readUserIdFromCookie,
} from "../auth/session";
import { getDb } from "../../db";
import { users } from "../../../drizzle/schema";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res.status(400).json({
        message: "아이디와 비밀번호를 입력해주세요.",
      });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({
        message: "db not available",
      });
    }

    const found = await db
      .select()
      .from(users)
      .where(eq(users.username, String(username).trim()))
      .limit(1);

    const user = found[0];

    // 계정 없거나 비활성화면 동일 문구 처리
    if (!user || user.isActive === false) {
      return res.status(401).json({
        message: "아이디 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    // passwordHash 없으면 실패
    if (!user.passwordHash) {
      return res.status(401).json({
        message: "아이디 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);

    if (!ok) {
      return res.status(401).json({
        message: "아이디 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    const secret = process.env.SESSION_SECRET || "dev-secret";

    res.append("Set-Cookie", makeSessionCookie(user.id, secret));

    return res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    });
  } catch (error) {
    console.error("[auth/login] error:", error);
    return res.status(500).json({
      message: "로그인 처리 중 오류가 발생했습니다.",
    });
  }
});

authRouter.post("/logout", async (_req, res) => {
  try {
    res.append("Set-Cookie", clearSessionCookie());
    return res.json({ ok: true });
  } catch (error) {
    console.error("[auth/logout] error:", error);
    return res.status(500).json({
      message: "로그아웃 처리 중 오류가 발생했습니다.",
    });
  }
});

authRouter.get("/me", async (req, res) => {
  try {
    const secret = process.env.SESSION_SECRET || "dev-secret";
    const userId = readUserIdFromCookie(req, secret);

    if (!userId) {
      return res.status(401).json({
        message: "not logged in",
      });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({
        message: "db not available",
      });
    }

    const found = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = found[0];

    // 비활성 계정은 세션 있어도 로그인 해제처럼 처리
    if (!user || user.isActive === false) {
      res.setHeader("Set-Cookie", clearSessionCookie());
      return res.status(401).json({
        message: "not logged in",
      });
    }

    return res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    });
  } catch (error) {
    console.error("[auth/me] error:", error);
    return res.status(500).json({
      message: "사용자 조회 중 오류가 발생했습니다.",
    });
  }
});