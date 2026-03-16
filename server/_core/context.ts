import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../drizzle/schema";
import { sdk } from "./sdk";

import {
  upsertUser,
  getUserByOpenId,
  getUserById,
} from "../db";

import { readUserIdFromCookie } from "./auth/session";
import { SESSION_COOKIE } from "./auth/session";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function getCookieHeader(req: CreateExpressContextOptions["req"]) {
  return req?.headers?.cookie ?? "";
}

function hasManualSessionCookie(req: CreateExpressContextOptions["req"]) {
  const cookieHeader = getCookieHeader(req);
  return cookieHeader.includes(`${SESSION_COOKIE}=`);
}

function looksLikeSdkAuthRequest(req: CreateExpressContextOptions["req"]) {
  const authHeader = req?.headers?.authorization;
  if (authHeader && authHeader.trim()) {
    return true;
  }

  const cookieHeader = getCookieHeader(req);

  // 수동 로그인 세션 쿠키가 있으면 SDK 인증은 시도하지 않음
  if (cookieHeader.includes(`${SESSION_COOKIE}=`)) {
    return false;
  }

  // 수동 세션 쿠키는 없지만, 다른 인증성 쿠키가 있으면 SDK 인증 시도
  if (cookieHeader.trim()) {
    return true;
  }

  return false;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const { req, res } = opts;
  let user: User | null = null;

  try {
    const secret = process.env.SESSION_SECRET || "dev-secret";

    console.log("[createContext] SESSION_SECRET exists =", !!process.env.SESSION_SECRET);
    console.log("[createContext] hasManualSessionCookie =", hasManualSessionCookie(req));

    // 1) 수동 세션 쿠키 인증 최우선
    const manualUserId = readUserIdFromCookie(req, secret);
    console.log("[createContext] manualUserId =", manualUserId);

    if (manualUserId) {
      const dbUser = await getUserById(manualUserId);

      console.log("[createContext] manual dbUser exists =", !!dbUser);
      console.log("[createContext] manual dbUser active =", dbUser?.isActive !== false);

      if (dbUser && dbUser.isActive !== false) {
        return {
          req,
          res,
          user: dbUser as any,
        };
      }

      return {
        req,
        res,
        user: null,
      };
    }

    // 2) 수동 세션 쿠키가 있었는데도 userId 파싱 실패면
    //    SDK로 넘기지 말고 바로 비인증 처리
    if (hasManualSessionCookie(req)) {
      console.log("[createContext] manual session cookie exists but userId invalid");
      return {
        req,
        res,
        user: null,
      };
    }

    // 3) SDK 인증이 필요한 요청만 SDK 시도
    if (!looksLikeSdkAuthRequest(req)) {
      console.log("[createContext] skip sdk auth");
      return {
        req,
        res,
        user: null,
      };
    }

    console.log("[createContext] trying sdk auth");

    const authUser: any = await sdk.authenticateRequest(req);

    const openId =
      authUser?.openId ??
      authUser?.openid ??
      authUser?.id ??
      authUser?.sub;

    console.log("[createContext] sdk openId =", openId ?? null);

    if (openId) {
      await upsertUser({
        openId: String(openId),
        name: authUser?.name ?? authUser?.username ?? null,
        email: authUser?.email ?? null,
        loginMethod: authUser?.loginMethod ?? authUser?.provider ?? null,
      } as any);

      const dbUser = await getUserByOpenId(String(openId));

      console.log("[createContext] sdk dbUser exists =", !!dbUser);
      console.log("[createContext] sdk dbUser active =", dbUser?.isActive !== false);

      if (dbUser && dbUser.isActive !== false) {
        user = dbUser as any;
      } else {
        user = null;
      }
    } else {
      user = null;
    }
  } catch (error: any) {
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
    req,
    res,
    user,
  };
}