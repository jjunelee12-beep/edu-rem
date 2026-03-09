import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../drizzle/schema";
import { sdk } from "./sdk";

import {
  upsertUser,
  getUserByOpenId,
  getUserById,
} from "../db";

import { readUserIdFromCookie } from "./auth/session";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function hasManualSessionCookie(req: CreateExpressContextOptions["req"]) {
  const cookie = req.headers.cookie ?? "";
  return cookie.includes("app_session_id=");
}

function looksLikeSdkAuthRequest(req: CreateExpressContextOptions["req"]) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.trim()) return true;

  const cookie = req.headers.cookie ?? "";

  // Manus/sdk 쪽 세션 쿠키 이름을 정확히 모르면
  // app_session_id만 제외하고, 다른 인증성 쿠키가 있을 때만 시도
  if (cookie && !cookie.includes("app_session_id=")) return true;

  return false;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // 1) 수동 로그인 세션 먼저 확인
    const secret = process.env.SESSION_SECRET || "dev-secret";
    const manualUserId = readUserIdFromCookie(opts.req, secret);

    if (manualUserId) {
      const dbUser = await getUserById(manualUserId);

      if (dbUser && dbUser.isActive !== false) {
        return {
          req: opts.req,
          res: opts.res,
          user: dbUser as any,
        };
      }

      return {
        req: opts.req,
        res: opts.res,
        user: null,
      };
    }

    // 2) 수동 세션 쿠키도 없고, SDK 인증처럼 보이지 않으면 그냥 비로그인 처리
    if (!looksLikeSdkAuthRequest(opts.req)) {
      return {
        req: opts.req,
        res: opts.res,
        user: null,
      };
    }

    // 3) SDK 인증 시도
    const authUser: any = await sdk.authenticateRequest(opts.req);

    const openId =
      authUser?.openId ??
      authUser?.openid ??
      authUser?.id ??
      authUser?.sub;

    if (openId) {
      await upsertUser({
        openId: String(openId),
        name: authUser?.name ?? authUser?.username ?? null,
        email: authUser?.email ?? null,
        loginMethod: authUser?.loginMethod ?? authUser?.provider ?? null,
      } as any);

      const dbUser = await getUserByOpenId(String(openId));

      if (dbUser && dbUser.isActive !== false) {
        user = dbUser as any;
      } else {
        user = null;
      }
    } else {
      user = null;
    }
  } catch (error: any) {
    // SDK 403 / invalid session cookie 는 흔한 상황이라 조용히 무시
    const statusCode = error?.statusCode ?? error?.status;
    const message = String(error?.message ?? "");

    const isIgnorableSdkAuthError =
      statusCode === 403 ||
      message.includes("Invalid session cookie") ||
      message.includes("Missing session cookie");

    if (!isIgnorableSdkAuthError) {
      console.error("[createContext] auth error:", error);
    }

    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}