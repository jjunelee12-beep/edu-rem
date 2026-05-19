import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getOrganizationById } from "../saasdb";
import * as db from "../db";
import { ERROR_CODES } from "./errorCodes";
import { throwAppError } from "./appError";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,

  errorFormatter({ shape, error }) {
    const cause = error.cause as any;

    return {
      ...shape,
      data: {
        ...shape.data,
        appCode:
          cause?.code ||
          cause?.data?.code ||
          ERROR_CODES.INTERNAL_SERVER_ERROR,
        appMessage:
          cause?.message ||
          error.message ||
          "서버 오류가 발생했습니다.",
        appStatus:
          cause?.status ||
          shape.data?.httpStatus ||
          500,
      },
    };
  },
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
  organizationId: 1,
} as any;

function isAdminOrHost(user: any) {
  return (
    user?.role === "admin" ||
    user?.role === "host" ||
    user?.role === "superhost"
  );
}

function isSuperhost(user: any) {
  return user?.role === "superhost";
}

async function assertOrganizationActive(user: any) {
  if (!user) return;

  if (user.role === "superhost") return;

  const organizationId = Number(user.organizationId || 0);

if (!organizationId) {
  throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
}

const organization = await getOrganizationById(organizationId);

  if (!organization || organization.status !== "active") {
    throwAppError(
  ERROR_CODES.ORGANIZATION_INACTIVE,
  "현재 이용이 제한된 회사 계정입니다.",
  403
);
  }
}

const apiErrorLogMiddleware = t.middleware(
  async ({ ctx, path, type, rawInput, next }) => {
    const result = await next();

    if (!result.ok) {
      const user = (ctx as any)?.user;
      const input = rawInput as any;

      const organizationId = Number(
        user?.organizationId ||
          input?.organizationId ||
          input?.json?.organizationId ||
          0
      );

      if (organizationId > 0) {
        await db.createApiErrorLog({
          organizationId,
          userId: Number(user?.id || 0) || null,
          userRole: String(user?.role || "") || null,
          path,
          method: type,
          statusCode: 500,
          errorName: result.error?.name || "TRPCError",
          errorMessage: result.error?.message || "Unknown error",
          errorStack:
            process.env.NODE_ENV === "production"
              ? null
              : result.error?.stack || null,
          inputJson:
            rawInput === undefined
              ? null
              : JSON.stringify(rawInput).slice(0, 5000),
        } as any);
      }
    }

    return result;
  }
);

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
    throwAppError(
  ERROR_CODES.AUTH_REQUIRED,
  UNAUTHED_ERR_MSG,
  401
);
  }

await assertOrganizationActive(ctx.user);

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure
  .use(requireUser)
  .use(apiErrorLogMiddleware);
/**
 * admin / host 전용
 * superhost는 포함하지 않음
 * -> superhost는 별도 콘솔/별도 권한으로 완전 분리
 */
export const adminProcedure = t.procedure
  .use(
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
        throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  NOT_ADMIN_ERR_MSG,
  403
);
      }

      await assertOrganizationActive(ctx.user);

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    })
  )
  .use(apiErrorLogMiddleware);

/**
 * host 전용
 * superhost 포함 안 함
 */
export const hostProcedure = t.procedure
  .use(
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

      if (
        !ctx.user ||
        (ctx.user.role !== "host" && ctx.user.role !== "superhost")
      ) {
        throwAppError(
  ERROR_CODES.HOST_REQUIRED,
  "호스트 권한이 필요합니다.",
  403
);
      }

      await assertOrganizationActive(ctx.user);

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    })
  )
  .use(apiErrorLogMiddleware);

/**
 * superhost 전용
 * host / admin / staff 모두 접근 불가
 */
export const superHostProcedure = t.procedure
  .use(
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
       throwAppError(
  ERROR_CODES.SUPERHOST_REQUIRED,
  "슈퍼호스트 권한이 필요합니다.",
  403
);
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    })
  )
  .use(apiErrorLogMiddleware);