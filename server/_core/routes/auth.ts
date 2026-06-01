import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
  makeSessionCookie,
  clearSessionCookie,
  readUserIdFromCookie,
} from "../auth/session";
import { getDb } from "../../db";
import { users, organizations } from "../../../drizzle/schema";
import { getOrganizationById } from "../../saasdb";

export const authRouter = Router();

function signSocketToken(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function makeSocketToken(userId: number, secret: string) {
  const issuedAt = Date.now();
  const payload = `${userId}.${issuedAt}`;
  const sig = signSocketToken(payload, secret);
  return `${payload}.${sig}`;
}

async function getUserOrganizationLoginBlockMessage(user: any) {
  if (!user) {
    return "사용자 정보를 확인할 수 없습니다.";
  }

  if (user.role === "superhost") {
    return null;
  }

  const organizationId = Number(user.organizationId || 0);

  if (!organizationId) {
    return "소속 회사 정보를 확인할 수 없습니다. 관리자에게 문의해주세요.";
  }

  const organization = await getOrganizationById(organizationId);

  if (!organization) {
    return "소속 회사를 찾을 수 없습니다. 관리자에게 문의해주세요.";
  }

  if (organization.status === "inactive") {
    return "서비스가 비활성화되었습니다. 결제 상태를 확인하거나 관리자에게 문의해주세요.";
  }

  if (organization.status === "suspended") {
    return "서비스 이용이 일시정지되었습니다. 관리자에게 문의해주세요.";
  }

  if (organization.subscriptionStatus === "overdue") {
    return "결제 확인이 필요합니다. 결제 정보를 확인하거나 관리자에게 문의해주세요.";
  }

  if (organization.subscriptionStatus === "paused") {
    return "결제 유예기간이 만료되어 서비스가 비활성화되었습니다. 관리자에게 문의해주세요.";
  }

  if (organization.subscriptionStatus === "cancelled") {
    return "구독이 해지된 회사 계정입니다. 관리자에게 문의해주세요.";
  }

  if (organization.status !== "active") {
    return "현재 이용이 제한된 회사 계정입니다. 관리자에게 문의해주세요.";
  }

  return null;
}

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

    if (!user || user.isActive === false) {
      return res.status(401).json({
        message: "아이디 또는 비밀번호가 올바르지 않습니다.",
      });
    }

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

const organizationBlockMessage = await getUserOrganizationLoginBlockMessage(user);

if (organizationBlockMessage) {
  return res.status(403).json({
    message: organizationBlockMessage,
  });
}

    const secret = process.env.SESSION_SECRET || "dev-secret";

    res.append("Set-Cookie", makeSessionCookie(user.id, secret));

   const organization =
  user.role === "superhost"
    ? null
    : await getOrganizationById(Number(user.organizationId || 0));

return res.json({
  user: {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    organizationId: user.organizationId,
    organizationSlug: organization?.slug ?? null,
    organizationName: organization?.name ?? null,
    organizationStatus: organization?.status ?? null,
    profileImageUrl: user.profileImageUrl ?? null,
  },
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
    organizationId: users.organizationId,
    isActive: users.isActive,
    profileImageUrl: users.profileImageUrl,

    organizationName: organizations.name,
    organizationSlug: organizations.slug,
    organizationStatus: organizations.status,
  })
  .from(users)
  .leftJoin(
    organizations,
    eq(users.organizationId, organizations.id)
  )
  .where(eq(users.id, userId))
  .limit(1);

    const user = found[0];

    if (!user || user.isActive === false) {
      res.setHeader("Set-Cookie", clearSessionCookie());
      return res.status(401).json({
        message: "not logged in",
      });
    }

    const organizationBlockMessage = await getUserOrganizationLoginBlockMessage(user);

if (organizationBlockMessage) {
  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(403).json({
    message: organizationBlockMessage,
  });
}

    return res.json({
  user: {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    organizationId: user.organizationId,
    organizationSlug: user.organizationSlug,
    organizationName: user.organizationName,
    organizationStatus: user.organizationStatus,
    profileImageUrl: user.profileImageUrl ?? null,
  },
});
  } catch (error) {
    console.error("[auth/me] error:", error);
    return res.status(500).json({
      message: "사용자 조회 중 오류가 발생했습니다.",
    });
  }
});

authRouter.get("/socket-token", async (req, res) => {
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
        role: users.role,
        organizationId: users.organizationId,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = found[0];

    if (!user || user.isActive === false) {
      return res.status(401).json({
        message: "not logged in",
      });
    }

    const organizationBlockMessage = await getUserOrganizationLoginBlockMessage(user);

if (organizationBlockMessage) {
  return res.status(403).json({
    message: organizationBlockMessage,
  });
}

    const socketToken = makeSocketToken(userId, secret);

    return res.json({
  ok: true,
  socketToken,
  userId,
  organizationId: user.organizationId,
  role: user.role,
});
  } catch (error) {
    console.error("[auth/socket-token] error:", error);
    return res.status(500).json({
      message: "소켓 토큰 발급 중 오류가 발생했습니다.",
    });
  }
});