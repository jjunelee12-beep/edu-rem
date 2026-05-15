import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import {
  listOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  createOrganizationDefaults,
  assignUserToOrganization,
getOrganizationUsageStats,
getOrganizationLimitStatus,
listOrganizationAuditLogs,
} from "./saasdb";
import bcrypt from "bcryptjs";
import * as db from "./db";

function assertSuperhost(ctx: any) {
  if (ctx.user?.role !== "superhost") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "superhost만 접근 가능합니다.",
    });
  }
}

const RESERVED_ORGANIZATION_SLUGS = new Set([
  "saas",
  "api",
  "login",
  "logout",
  "uploads",
  "form",
  "ad-form",
  "go",
  "admin",
  "settings",
  "dashboard",
  "superhost",
]);

function normalizeOrganizationSlug(slug: string) {
  return slug.trim().toLowerCase();
}

function assertValidOrganizationSlug(slug: string) {
  const normalized = normalizeOrganizationSlug(slug);

  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "회사 URL은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.",
    });
  }

  if (RESERVED_ORGANIZATION_SLUGS.has(normalized)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "예약된 회사 URL입니다. 다른 값을 입력해주세요.",
    });
  }

  return normalized;
}

export const saasRouter = router({
  listOrganizations: protectedProcedure.query(async ({ ctx }) => {
    assertSuperhost(ctx);
    return listOrganizations();
  }),

  getOrganization: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      assertSuperhost(ctx);
      return getOrganizationById(input.id);
    }),

getOrganizationUsageStats: protectedProcedure
  .input(
    z.object({
      organizationId: z.number(),
    })
  )
  .query(async ({ ctx, input }) => {
    assertSuperhost(ctx);

    const organization = await getOrganizationById(input.organizationId);
    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "회사를 찾을 수 없습니다.",
      });
    }

    return getOrganizationUsageStats(input.organizationId);
  }),

listOrganizationLimitStatuses: protectedProcedure.query(async ({ ctx }) => {
  assertSuperhost(ctx);

  const organizations = await listOrganizations();

  const items = await Promise.all(
    organizations.map(async (organization: any) => {
      const limitStatus = await getOrganizationLimitStatus(Number(organization.id));

      return {
        organization,
        limits: limitStatus.limits,
        usage: limitStatus.usage,
        exceeded: limitStatus.exceeded,
      };
    })
  );

  return items;
}),

  createOrganization: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
slug: z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, "회사 URL은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다."),
        businessName: z.string().optional().nullable(),
        businessNumber: z.string().optional().nullable(),
        planCode: z.enum(["free", "basic", "pro", "enterprise"]).default("basic"),
        maxUsers: z.number().optional(),
        maxLandingForms: z.number().optional(),
        maxSmsPerMonth: z.number().optional(),
maxStorageMb: z.number().optional(),
maxAdForms: z.number().optional(),

allowBackup: z.boolean().optional(),
allowAuditLog: z.boolean().optional(),
allowMessenger: z.boolean().optional(),
allowPracticeCenter: z.boolean().optional(),
allowSettlementReport: z.boolean().optional(),
allowPrivateCertificate: z.boolean().optional(),
memo: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertSuperhost(ctx);

      const normalizedSlug = assertValidOrganizationSlug(input.slug);

const organization = await createOrganization({
  ...input,
  slug: normalizedSlug,
  createdBy: Number(ctx.user.id),
});

      if (organization?.id) {
        await createOrganizationDefaults({
          organizationId: Number(organization.id),
          actorUserId: Number(ctx.user.id),
          companyName: input.businessName || input.name,
        });
      }

      return organization;
    }),

listOrganizationAuditLogs: protectedProcedure
  .input(
    z.object({
      organizationId: z.number(),
    })
  )
  .query(async ({ ctx, input }) => {
    assertSuperhost(ctx);

    const organization = await getOrganizationById(input.organizationId);
    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "회사를 찾을 수 없습니다.",
      });
    }

    return listOrganizationAuditLogs(input.organizationId);
  }),


  updateOrganization: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
	slug: z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, "회사 URL은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.")
  .optional(),
        businessName: z.string().optional().nullable(),
        businessNumber: z.string().optional().nullable(),
        planCode: z.enum(["free", "basic", "pro", "enterprise"]).optional(),
        status: z.enum(["active", "inactive", "suspended"]).optional(),
        maxUsers: z.number().optional(),
        maxLandingForms: z.number().optional(),
        maxSmsPerMonth: z.number().optional(),
maxStorageMb: z.number().optional(),
maxAdForms: z.number().optional(),

allowBackup: z.boolean().optional(),
allowAuditLog: z.boolean().optional(),
allowMessenger: z.boolean().optional(),
allowPracticeCenter: z.boolean().optional(),
allowSettlementReport: z.boolean().optional(),
allowPrivateCertificate: z.boolean().optional(),
memo: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertSuperhost(ctx);

      const normalizedSlug =
  input.slug === undefined
    ? undefined
    : assertValidOrganizationSlug(input.slug);

return updateOrganization({
  ...input,
  slug: normalizedSlug,
  updatedBy: Number(ctx.user.id),
});
    }),

  assignUserToOrganization: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        organizationId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertSuperhost(ctx);
      return assignUserToOrganization(input);
    }),

createHostAccount: protectedProcedure
  .input(
    z.object({
      organizationId: z.number(),
      username: z.string().min(1),
      password: z.string().min(4),
      name: z.string().min(1),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    assertSuperhost(ctx);

    const organization = await getOrganizationById(input.organizationId);
    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "회사를 찾을 수 없습니다.",
      });
    }

const limitStatus = await getOrganizationLimitStatus(input.organizationId);

if (limitStatus.exceeded.users) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `사용자 수 제한을 초과했습니다. 현재 ${limitStatus.usage.userCount}명 / 제한 ${limitStatus.limits.maxUsers}명`,
  });
}

const normalizedUsername = input.username.trim();

const existingUser = await db.getUserByUsername(normalizedUsername);

if (existingUser) {
  throw new TRPCError({
    code: "CONFLICT",
    message: "이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.",
  });
}

    const passwordHash = await bcrypt.hash(input.password, 10);

    const id = await db.createUserAccount({
      openId: `manual_${normalizedUsername}`,
username: normalizedUsername,
      passwordHash,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      role: "host",
      organizationId: input.organizationId,
      loginMethod: "manual",
      isActive: true,
    });

    return {
      success: true,
      id,
    };
  }),
});