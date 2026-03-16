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

function hasManualSessionCookie(req: CreateExpressContextOptions["req"]) {
  const cookie = req.headers.cookie ?? "";
  return cookie.includes(`${SESSION_COOKIE}=`);
}

function looksLikeSdkAuthRequest(req: CreateExpressContextOptions["req"]) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.trim()) return true;

  const cookie = req.headers.cookie ?? "";

  // 수동 로그인 쿠키가 있으면 SDK 인증 시도 안 함
  if (cookie.includes(`${SESSION_COOKIE}=`)) return false;

  // 다른 인증성 쿠키가 있을 때만 SDK 시도
  if (cookie) return true;

  return false;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
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

    if (!looksLikeSdkAuthRequest(opts.req)) {
      return {
        req: opts.req,
        res: opts.res,
        user: null,
      };
    }

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