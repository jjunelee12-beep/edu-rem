import { z } from "zod";
import { throwAppError } from "./_core/appError";
import { ERROR_CODES } from "./_core/errorCodes";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
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
getOrganizationOnboardingStatus,
  createSaasInquiry,
  listSaasInquiries,
  updateSaasInquiry,
  checkUsernameAvailable,
  checkOrganizationSlugAvailable,
  createTenantSignup,
  cancelTenant as cancelTenantInDb,
  getSaasAdminLockStatus,
  setSaasAdminPassword,
  unlockSaasAdmin,
  lockSaasAdmin,
  requireSaasAdminUnlocked,
  createBillingRegistrationToken,
  getBillingRegistrationToken,
  saveOrganizationBillingKey,
  createSubscriptionPayment,
  markSubscriptionPaymentPaid,
  markSubscriptionPaymentFailed,
  listSubscriptionPayments,
  listSubscriptionPaymentEvents,
deactivateExpiredOverdueOrganizations,
} from "./saasdb";
import bcrypt from "bcryptjs";
import * as db from "./db";

function assertSuperhost(ctx: any) {
  if (ctx.user?.role !== "superhost") {
    throwAppError(
  ERROR_CODES.SUPERHOST_REQUIRED,
  "superhost만 접근 가능합니다.",
  403
);
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
    throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "회사 URL은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.",
  400
);
  }

  if (RESERVED_ORGANIZATION_SLUGS.has(normalized)) {
    throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "예약된 회사 URL입니다. 다른 값을 입력해주세요.",
  400
);
  }

  return normalized;
}

export const saasRouter = router({

checkAdminUnlocked: protectedProcedure.query(async ({ ctx }) => {
  assertSuperhost(ctx);

  return getSaasAdminLockStatus(Number(ctx.user.id));
}),

setAdminPassword: protectedProcedure
  .input(
    z.object({
      password: z.string().min(8, "관리자 암호는 최소 8자 이상이어야 합니다."),
      passwordConfirm: z.string().min(8),
    })
  )
  .mutation(async ({ ctx, input }) => {
    assertSuperhost(ctx);

    if (input.password !== input.passwordConfirm) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "관리자 암호가 일치하지 않습니다.",
        400
      );
    }

    return setSaasAdminPassword({
      userId: Number(ctx.user.id),
      password: input.password,
    });
  }),

unlockAdmin: protectedProcedure
  .input(
    z.object({
      password: z.string().min(1),
    })
  )
  .mutation(async ({ ctx, input }) => {
    assertSuperhost(ctx);

    try {
      return await unlockSaasAdmin({
        userId: Number(ctx.user.id),
        password: input.password,
      });
    } catch (err: any) {
      throwAppError(
        ERROR_CODES.PERMISSION_DENIED,
        err?.message || "SaaS 관리자 암호 확인에 실패했습니다.",
        403
      );
    }
  }),

lockAdmin: protectedProcedure.mutation(async ({ ctx }) => {
  assertSuperhost(ctx);

  return lockSaasAdmin(Number(ctx.user.id));
}),

checkUsername: publicProcedure
  .input(
    z.object({
      username: z
        .string()
        .regex(/^[a-z0-9]{4,20}$/, "아이디는 영문 소문자+숫자 4~20자만 가능합니다."),
    })
  )
  .query(async ({ input }) => {
    const username = input.username.trim().toLowerCase();
    return checkUsernameAvailable(username);
  }),

checkSlug: publicProcedure
  .input(
    z.object({
      slug: z
        .string()
        .regex(/^[a-z0-9-]{3,30}$/, "회사 URL은 영문 소문자, 숫자, 하이픈 3~30자만 가능합니다."),
    })
  )
  .query(async ({ input }) => {
    const slug = assertValidOrganizationSlug(input.slug);
    return checkOrganizationSlugAvailable(slug);
  }),

createSignup: publicProcedure
  .input(
    z.object({
      companyName: z.string().min(1),
      slug: z
        .string()
        .regex(/^[a-z0-9-]{3,30}$/, "회사 URL은 영문 소문자, 숫자, 하이픈 3~30자만 가능합니다."),
      businessName: z.string().optional().nullable(),
      businessNumber: z.string().optional().nullable(),
      managerName: z.string().min(1),
      phone: z.string().min(1),
      birthDate: z.string().optional().nullable(),
      username: z
        .string()
        .regex(/^[a-z0-9]{4,20}$/, "아이디는 영문 소문자+숫자 4~20자만 가능합니다."),
      password: z.string().min(4),
      passwordConfirm: z.string().min(4),
      planCode: z.enum(["starter", "business", "enterprise"]),
    })
  )
  .mutation(async ({ input }) => {
    if (input.password !== input.passwordConfirm) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "비밀번호가 일치하지 않습니다.",
        400
      );
    }

    const username = input.username.trim().toLowerCase();
    const slug = assertValidOrganizationSlug(input.slug);

    const usernameAvailable = await checkUsernameAvailable(username);
    if (!usernameAvailable.available) {
      throwAppError(
        ERROR_CODES.DUPLICATE_RESOURCE,
        "이미 사용 중인 아이디입니다.",
        409
      );
    }

    const slugAvailable = await checkOrganizationSlugAvailable(slug);
    if (!slugAvailable.available) {
      throwAppError(
        ERROR_CODES.DUPLICATE_RESOURCE,
        "이미 사용 중인 회사 URL입니다.",
        409
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    return createTenantSignup({
      companyName: input.companyName.trim(),
      slug,
      businessName: input.businessName?.trim() || null,
      businessNumber: input.businessNumber?.trim() || null,
      managerName: input.managerName.trim(),
      phone: input.phone.trim(),
      birthDate: input.birthDate?.trim() || null,
      username,
      passwordHash,
      planCode:
  input.planCode === "starter"
    ? "basic"
    : input.planCode === "business"
      ? "pro"
      : "enterprise",
    });
  }),

cancelTenant: protectedProcedure
  .input(
    z.object({
      organizationId: z.number(),
      reason: z.string().optional().nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    assertSuperhost(ctx);
await requireSaasAdminUnlocked(Number(ctx.user.id));

const organization = await getOrganizationById(input.organizationId);
    if (!organization) {
      throwAppError(
        ERROR_CODES.ORGANIZATION_NOT_FOUND,
        "회사를 찾을 수 없습니다.",
        404
      );
    }

    return cancelTenantInDb({
      organizationId: input.organizationId,
      actorUserId: Number(ctx.user.id),
      reason: input.reason,
    });
  }),

  listOrganizations: protectedProcedure.query(async ({ ctx }) => {
  assertSuperhost(ctx);
  await requireSaasAdminUnlocked(Number(ctx.user.id));

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
await requireSaasAdminUnlocked(Number(ctx.user.id));

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
await requireSaasAdminUnlocked(Number(ctx.user.id));

const organization = await getOrganizationById(input.organizationId);
    if (!organization) {
      throwAppError(
  ERROR_CODES.ORGANIZATION_NOT_FOUND,
  "회사를 찾을 수 없습니다.",
  404
);
    }

    return getOrganizationUsageStats(input.organizationId);
  }),

listOrganizationLimitStatuses: protectedProcedure.query(async ({ ctx }) => {
  assertSuperhost(ctx);
await requireSaasAdminUnlocked(Number(ctx.user.id));

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

listOrganizationOnboardingStatuses: protectedProcedure.query(async ({ ctx }) => {
 assertSuperhost(ctx);
await requireSaasAdminUnlocked(Number(ctx.user.id));

const organizations = await listOrganizations();

  const items = await Promise.all(
    organizations.map(async (organization: any) => {
      const onboarding = await getOrganizationOnboardingStatus(
        Number(organization.id)
      );

      return {
        organizationId: Number(organization.id),
        onboarding,
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
maxStudents: z.number().optional(),
        maxLandingForms: z.number().optional(),
        maxSmsPerMonth: z.number().optional(),
maxStorageMb: z.number().optional(),
maxAdForms: z.number().optional(),

allowBackup: z.boolean().optional(),
allowAutoBackup: z.boolean().optional(),
allowAuditLog: z.boolean().optional(),
allowMessenger: z.boolean().optional(),
allowPracticeCenter: z.boolean().optional(),
allowSettlementReport: z.boolean().optional(),
allowPrivateCertificate: z.boolean().optional(),
memo: z.string().optional().nullable(),
defaultTeams: z.array(z.string()).optional(),
defaultPositions: z.array(z.string()).optional(),
defaultEducationInstitution: z.string().optional(),
defaultPayoutDay: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
     assertSuperhost(ctx);
await requireSaasAdminUnlocked(Number(ctx.user.id));

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
  defaultTeams: input.defaultTeams,
  defaultPositions: input.defaultPositions,
  defaultEducationInstitution: input.defaultEducationInstitution,
  defaultPayoutDay: input.defaultPayoutDay,
});
      }

      return organization;
    }),

listSaasInquiries: protectedProcedure
  .input(
    z.object({
      status: z
        .enum(["new", "contacted", "qualified", "closed", "spam", "all"])
        .default("all"),
    }).optional()
  )
  .query(async ({ ctx, input }) => {
    assertSuperhost(ctx);
await requireSaasAdminUnlocked(Number(ctx.user.id));

return listSaasInquiries(input);
  }),

updateSaasInquiry: protectedProcedure
  .input(
    z.object({
      id: z.number(),
      status: z.enum(["new", "contacted", "qualified", "closed", "spam"]).optional(),
      memo: z.string().optional().nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
   assertSuperhost(ctx);
await requireSaasAdminUnlocked(Number(ctx.user.id));

return updateSaasInquiry(input);
  }),


repairOrganizationDefaults: protectedProcedure
  .input(
    z.object({
      organizationId: z.number(),
    })
  )
  .mutation(async ({ ctx, input }) => {
   assertSuperhost(ctx);
await requireSaasAdminUnlocked(Number(ctx.user.id));

const organization = await getOrganizationById(input.organizationId);
    if (!organization) {
      throwAppError(
        ERROR_CODES.ORGANIZATION_NOT_FOUND,
        "회사를 찾을 수 없습니다.",
        404
      );
    }

    await createOrganizationDefaults({
      organizationId: Number(organization.id),
      actorUserId: Number(ctx.user.id),
      companyName: organization.businessName || organization.name,
    });

    return { ok: true };
  }),

listOrganizationAuditLogs: protectedProcedure
  .input(
    z.object({
      organizationId: z.number(),
    })
  )
  .query(async ({ ctx, input }) => {
    assertSuperhost(ctx);
await requireSaasAdminUnlocked(Number(ctx.user.id));

const organization = await getOrganizationById(input.organizationId);
    if (!organization) {
      throwAppError(
  ERROR_CODES.ORGANIZATION_NOT_FOUND,
  "회사를 찾을 수 없습니다.",
  404
);
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
maxStudents: z.number().optional(),
        maxLandingForms: z.number().optional(),
        maxSmsPerMonth: z.number().optional(),
maxStorageMb: z.number().optional(),
maxAdForms: z.number().optional(),

allowBackup: z.boolean().optional(),
allowAutoBackup: z.boolean().optional(),
allowAuditLog: z.boolean().optional(),
allowMessenger: z.boolean().optional(),
allowPracticeCenter: z.boolean().optional(),
allowSettlementReport: z.boolean().optional(),
allowPrivateCertificate: z.boolean().optional(),
memo: z.string().optional().nullable(),
billingAmount: z.number().optional(),
nextBillingAmount: z.number().optional().nullable(),
customPlanName: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertSuperhost(ctx);
await requireSaasAdminUnlocked(Number(ctx.user.id));

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
await requireSaasAdminUnlocked(Number(ctx.user.id));

return assignUserToOrganization(input);
    }),

createBillingToken: protectedProcedure
  .input(
    z.object({
      organizationId: z.number(),
      expiresInMinutes: z.number().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    assertSuperhost(ctx);
    await requireSaasAdminUnlocked(Number(ctx.user.id));

    const organization = await getOrganizationById(input.organizationId);
    if (!organization) {
      throwAppError(
        ERROR_CODES.ORGANIZATION_NOT_FOUND,
        "회사를 찾을 수 없습니다.",
        404
      );
    }

    return createBillingRegistrationToken({
      organizationId: input.organizationId,
      createdBy: Number(ctx.user.id),
      expiresInMinutes: input.expiresInMinutes,
    });
  }),

getBillingToken: publicProcedure
  .input(
    z.object({
      token: z.string().min(1),
    })
  )
  .query(async ({ input }) => {
    const row = await getBillingRegistrationToken(input.token);

    if (!row) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "유효하지 않은 카드 등록 링크입니다.",
        400
      );
    }

    if ((row as any).usedAt) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "이미 사용된 카드 등록 링크입니다.",
        400
      );
    }

    if (new Date((row as any).expiresAt).getTime() < Date.now()) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "만료된 카드 등록 링크입니다.",
        400
      );
    }

    const organization = await getOrganizationById(Number((row as any).organizationId));

    return {
      ok: true,
      token: (row as any).token,
      organizationId: Number((row as any).organizationId),
      expiresAt: (row as any).expiresAt,
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            planCode: organization.planCode,
            customPlanName: (organization as any).customPlanName,
            billingAmount: (organization as any).billingAmount,
            nextBillingAmount: (organization as any).nextBillingAmount,
          }
        : null,
    };
  }),

saveBillingKey: publicProcedure
  .input(
    z.object({
      token: z.string().min(1),
      billingKey: z.string().min(1),
      customerKey: z.string().min(1),
    })
  )
  .mutation(async ({ input }) => {
    return saveOrganizationBillingKey({
      token: input.token,
      billingKey: input.billingKey,
      customerKey: input.customerKey,
    });
  }),

createSubscriptionPayment: protectedProcedure
  .input(
    z.object({
      organizationId: z.number(),
      billingCycleStart: z.date().optional().nullable(),
      billingCycleEnd: z.date().optional().nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    assertSuperhost(ctx);
    await requireSaasAdminUnlocked(Number(ctx.user.id));

    const organization = await getOrganizationById(input.organizationId);
    if (!organization) {
      throwAppError(
        ERROR_CODES.ORGANIZATION_NOT_FOUND,
        "회사를 찾을 수 없습니다.",
        404
      );
    }

    const billingAmount =
      Number((organization as any).nextBillingAmount || 0) ||
      Number((organization as any).billingAmount || 0);

    if (billingAmount <= 0) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "결제 금액이 0원입니다. 먼저 요금제를 설정해주세요.",
        400
      );
    }

    return createSubscriptionPayment({
      organizationId: input.organizationId,
      planCode: String(organization.planCode || "basic"),
      customPlanName: (organization as any).customPlanName || null,
      billingAmount,
      billingCycleStart: input.billingCycleStart ?? null,
      billingCycleEnd: input.billingCycleEnd ?? null,
    });
  }),

markSubscriptionPaymentPaid: protectedProcedure
  .input(
    z.object({
      organizationId: z.number(),
      paymentId: z.number(),
      tossPaymentKey: z.string().optional().nullable(),
      tossOrderId: z.string().optional().nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    assertSuperhost(ctx);
    await requireSaasAdminUnlocked(Number(ctx.user.id));

    return markSubscriptionPaymentPaid(input);
  }),

markSubscriptionPaymentFailed: protectedProcedure
  .input(
    z.object({
      organizationId: z.number(),
      paymentId: z.number(),
      failureReason: z.string().optional().nullable(),
      rawJson: z.any().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    assertSuperhost(ctx);
    await requireSaasAdminUnlocked(Number(ctx.user.id));

    return markSubscriptionPaymentFailed(input);
  }),

listSubscriptionPayments: protectedProcedure
  .input(
    z
      .object({
        organizationId: z.number().optional().nullable(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
    assertSuperhost(ctx);
    await requireSaasAdminUnlocked(Number(ctx.user.id));

    return listSubscriptionPayments({
      organizationId: input?.organizationId ?? null,
    });
  }),

listSubscriptionPaymentEvents: protectedProcedure
  .input(
    z.object({
      paymentId: z.number().optional().nullable(),
      organizationId: z.number().optional().nullable(),
    })
  )
  .query(async ({ ctx, input }) => {
    assertSuperhost(ctx);
    await requireSaasAdminUnlocked(Number(ctx.user.id));

    return listSubscriptionPaymentEvents({
      paymentId: input.paymentId ?? null,
      organizationId: input.organizationId ?? null,
    });
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
await requireSaasAdminUnlocked(Number(ctx.user.id));

const organization = await getOrganizationById(input.organizationId);
    if (!organization) {
      throwAppError(
  ERROR_CODES.ORGANIZATION_NOT_FOUND,
  "회사를 찾을 수 없습니다.",
  404
);
    }

const limitStatus = await getOrganizationLimitStatus(input.organizationId);

if (limitStatus.exceeded.users) {
  throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  `사용자 수 제한을 초과했습니다. 현재 ${limitStatus.usage.userCount}명 / 제한 ${limitStatus.limits.maxUsers}명`,
  403
);
}

const normalizedUsername = input.username.trim().toLowerCase();

if (!/^[a-z0-9]{4,20}$/.test(normalizedUsername)) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "아이디는 영문 소문자+숫자 4~20자만 가능합니다.",
    400
  );
}

const existingUser = await db.getUserByUsername(normalizedUsername);

if (existingUser) {
  throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  "이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.",
  409
);
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
deactivateExpiredOverdueOrganizations: protectedProcedure.mutation(
  async ({ ctx }) => {
    assertSuperhost(ctx);
    await requireSaasAdminUnlocked(Number(ctx.user.id));

    return deactivateExpiredOverdueOrganizations();
  }
),
});