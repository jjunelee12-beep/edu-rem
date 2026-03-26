import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const DEV_AUTH_BYPASS =
  (process.env.DEV_AUTH_BYPASS ?? "").toLowerCase() === "true"
    ? true
    : (process.env.DEV_AUTH_BYPASS ?? "").toLowerCase() === "false"
      ? false
      : process.env.NODE_ENV === "development";

/**
 * 개발용 기본 유저
 * 필요 시 role만 바꿔가며 테스트 가능
 * 예:
 * role: "host"
 * role: "superhost"
 */
const DEV_USER = {
  id: 1,
  name: "DEV",
  role: "host",
} as any;

function isAdminOrHost(user: any) {
  return user?.role === "admin" || user?.role === "host";
}

function isSuperhost(user: any) {
  return user?.role === "superhost";
}

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (DEV_AUTH_BYPASS && !ctx.user) {
    return next({
      ctx: {
        ...ctx,
        user: DEV_USER,
      },
    });
  }

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: UNAUTHED_ERR_MSG,
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * admin / host 전용
 * superhost는 포함하지 않음
 * -> superhost는 별도 콘솔/별도 권한으로 완전 분리
 */
export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (DEV_AUTH_BYPASS && !ctx.user) {
      return next({
        ctx: {
          ...ctx,
          user: DEV_USER,
        },
      });
    }

    if (!ctx.user || !isAdminOrHost(ctx.user)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: NOT_ADMIN_ERR_MSG,
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);

/**
 * host 전용
 * superhost 포함 안 함
 */
export const hostProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (DEV_AUTH_BYPASS && !ctx.user) {
      return next({
        ctx: {
          ...ctx,
          user: DEV_USER,
        },
      });
    }

    if (!ctx.user || ctx.user.role !== "host") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "호스트 권한이 필요합니다.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);

/**
 * superhost 전용
 * host / admin / staff 모두 접근 불가
 */
export const superHostProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (DEV_AUTH_BYPASS && !ctx.user) {
      return next({
        ctx: {
          ...ctx,
          user: DEV_USER,
        },
      });
    }

    if (!ctx.user || !isSuperhost(ctx.user)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "슈퍼호스트 권한이 필요합니다.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);