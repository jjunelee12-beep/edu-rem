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

const DEV_USER = {
  id: 1,
  name: "DEV",
  role: "host",
} as any;

function isAdminOrHost(user: any) {
  return user?.role === "admin" || user?.role === "host";
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