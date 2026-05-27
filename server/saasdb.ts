import { eq, desc, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getDb } from "./db";
import {
  organizations,
  users,
  brandingSettings,
  smsSettings,
  auditLogs,
  teams,
  positions,
  educationInstitutions,
  saasInquiries,
  saasSignupRequests,
  billingRegistrationTokens,
  subscriptionPayments,
  subscriptionPaymentEvents,
} from "../drizzle/schema";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);

  return rows[0] || null;
}

export async function listOrganizations() {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      businessName: organizations.businessName,
      businessNumber: organizations.businessNumber,

      ownerUserId: organizations.ownerUserId,

      planCode: organizations.planCode,
      status: organizations.status,
      subscriptionStatus: organizations.subscriptionStatus,

      trialStartedAt: organizations.trialStartedAt,
      trialEndsAt: organizations.trialEndsAt,
      nextBillingAt: organizations.nextBillingAt,
      lastPaidAt: organizations.lastPaidAt,
billingAmount: organizations.billingAmount,
nextBillingAmount: organizations.nextBillingAmount,
customPlanName: organizations.customPlanName,
paymentFailedAt: organizations.paymentFailedAt,
paymentFailureCount: organizations.paymentFailureCount,
graceUntilAt: organizations.graceUntilAt,
billingKey: organizations.billingKey,
customerKey: organizations.customerKey,
      cancelledAt: organizations.cancelledAt,
      refundedAt: organizations.refundedAt,

      maxUsers: organizations.maxUsers,
      maxStudents: organizations.maxStudents,
      maxLandingForms: organizations.maxLandingForms,
      maxAdForms: organizations.maxAdForms,
      maxSmsPerMonth: organizations.maxSmsPerMonth,
      maxStorageMb: organizations.maxStorageMb,

      allowBackup: organizations.allowBackup,
      allowAutoBackup: organizations.allowAutoBackup,
      allowAuditLog: organizations.allowAuditLog,
      allowMessenger: organizations.allowMessenger,
      allowPracticeCenter: organizations.allowPracticeCenter,
      allowSettlementReport: organizations.allowSettlementReport,
      allowPrivateCertificate: organizations.allowPrivateCertificate,

      memo: organizations.memo,
      createdBy: organizations.createdBy,
      updatedBy: organizations.updatedBy,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,

      hostId: users.id,
      hostUsername: users.username,
      hostName: users.name,
      hostEmail: users.email,
      hostPhone: users.phone,
    })
    .from(organizations)
    .leftJoin(users, eq(users.id, organizations.ownerUserId))
    .orderBy(desc(organizations.id));

  return rows;
}

function getLocalNoticeUploadUsageBytes(organizationId: number) {
  const dir = path.resolve(
    process.cwd(),
    "uploads",
    "notices",
    `org-${organizationId}`
  );

  if (!fs.existsSync(dir)) return 0;

  return fs.readdirSync(dir).reduce((sum, filename) => {
    const fullPath = path.join(dir, filename);
    const stat = fs.statSync(fullPath);
    return stat.isFile() ? sum + stat.size : sum;
  }, 0);
}

function createR2Client() {
  if (
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY ||
    !process.env.R2_BUCKET_NAME
  ) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function getR2UploadUsageBytes(organizationId: number) {
  const s3 = createR2Client();
  if (!s3) return 0;

  const prefixes = [
    `org-${organizationId}/`,
    `organization-backups/${organizationId}/`,
  ];

  let totalBytes = 0;

  for (const prefix of prefixes) {
    let continuationToken: string | undefined = undefined;

    do {
      const result = await s3.send(
        new ListObjectsV2Command({
          Bucket: process.env.R2_BUCKET_NAME!,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      for (const item of result.Contents || []) {
        totalBytes += Number(item.Size || 0);
      }

      continuationToken = result.NextContinuationToken;
    } while (continuationToken);
  }

  return totalBytes;
}

async function createSaasAuditLog(input: {
  organizationId: number;
  actorUserId?: number | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: number | null;
  beforeJson?: string | null;
  afterJson?: string | null;
  memo?: string | null;
}) {
  const db = await getDb();
  if (!db) return null;

  const result: any = await db.insert(auditLogs).values(input as any);
  return result?.insertId ?? result?.[0]?.insertId ?? null;
}

export async function createOrganization(input: {
  name: string;
  slug: string;
  businessName?: string | null;
  businessNumber?: string | null;
  planCode?: "free" | "basic" | "pro" | "enterprise";
  maxUsers?: number;
maxStudents?: number;
  maxLandingForms?: number;
maxAdForms?: number;
allowBackup?: boolean;
allowAutoBackup?: boolean;
allowAuditLog?: boolean;
allowMessenger?: boolean;
allowPracticeCenter?: boolean;
allowSettlementReport?: boolean;
allowPrivateCertificate?: boolean;
  maxSmsPerMonth?: number;
maxStorageMb?: number;
  memo?: string | null;
  createdBy?: number | null;
billingAmount?: number;
nextBillingAmount?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(organizations).values({
  name: input.name.trim(),
  slug: input.slug.trim().toLowerCase(),
    businessName: input.businessName?.trim() || null,
    businessNumber: input.businessNumber?.trim() || null,
    planCode: input.planCode || "basic",
    status: "active",
    maxUsers: input.maxUsers ?? 10,
maxStudents: input.maxStudents ?? 500,
    maxLandingForms: input.maxLandingForms ?? 10,
    maxSmsPerMonth: input.maxSmsPerMonth ?? 1000,
maxStorageMb: input.maxStorageMb ?? 1024,
maxAdForms: input.maxAdForms ?? 10,
allowBackup: input.allowBackup ?? true,
allowAutoBackup: input.allowAutoBackup ?? false,
allowAuditLog: input.allowAuditLog ?? true,
allowMessenger: input.allowMessenger ?? true,
allowPracticeCenter: input.allowPracticeCenter ?? true,
allowSettlementReport: input.allowSettlementReport ?? true,
allowPrivateCertificate: input.allowPrivateCertificate ?? true,
    memo: input.memo?.trim() || null,
    createdBy: input.createdBy ?? null,
    updatedBy: input.createdBy ?? null,
billingAmount: input.billingAmount ?? 0,
nextBillingAmount: input.nextBillingAmount ?? null,
  } as any);

  const insertId = result?.insertId ?? result?.[0]?.insertId;
  return getOrganizationById(Number(insertId));
}

export async function updateOrganization(input: {
  id: number;
  name?: string;
  slug?: string;
  businessName?: string | null;
  businessNumber?: string | null;
  planCode?: "free" | "basic" | "pro" | "enterprise";
  status?: "active" | "inactive" | "suspended";
  maxUsers?: number;
maxStudents?: number;
  maxLandingForms?: number;
maxAdForms?: number;
allowBackup?: boolean;
allowAutoBackup?: boolean;
allowAuditLog?: boolean;
allowMessenger?: boolean;
allowPracticeCenter?: boolean;
allowSettlementReport?: boolean;
allowPrivateCertificate?: boolean;
  maxSmsPerMonth?: number;
maxStorageMb?: number;
  memo?: string | null;
  updatedBy?: number | null;
billingAmount?: number;
nextBillingAmount?: number | null;
customPlanName?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const before = await getOrganizationById(input.id);

  await db
    .update(organizations)
    .set({
  name: input.name?.trim(),
  slug:
    input.slug === undefined
      ? undefined
      : input.slug.trim().toLowerCase(),
      businessName:
        input.businessName === undefined
          ? undefined
          : input.businessName?.trim() || null,
      businessNumber:
        input.businessNumber === undefined
          ? undefined
          : input.businessNumber?.trim() || null,
      planCode: input.planCode,
      status: input.status,
      maxUsers: input.maxUsers,
maxStudents: input.maxStudents,
      maxLandingForms: input.maxLandingForms,
      maxSmsPerMonth: input.maxSmsPerMonth,
maxStorageMb: input.maxStorageMb,
maxAdForms: input.maxAdForms,
allowBackup: input.allowBackup,
allowAutoBackup: input.allowAutoBackup,
allowAuditLog: input.allowAuditLog,
allowMessenger: input.allowMessenger,
allowPracticeCenter: input.allowPracticeCenter,
allowSettlementReport: input.allowSettlementReport,
allowPrivateCertificate: input.allowPrivateCertificate,
      memo:
        input.memo === undefined
          ? undefined
          : input.memo?.trim() || null,
      updatedBy: input.updatedBy ?? undefined,
billingAmount: input.billingAmount,
nextBillingAmount: input.nextBillingAmount,
customPlanName:
  input.customPlanName === undefined
    ? undefined
    : input.customPlanName?.trim() || null,
    } as any)
    .where(eq(organizations.id, input.id));

  const after = await getOrganizationById(input.id);

await createSaasAuditLog({
  organizationId: input.id,
  actorUserId: input.updatedBy ?? null,
  actorRole: "superhost",
  action: "organization.update",
  targetType: "organization",
  targetId: input.id,
  beforeJson: JSON.stringify(before ?? {}),
  afterJson: JSON.stringify(after ?? {}),
  memo: "superhost company update",
});

return after;

}

export async function createOrganizationDefaults(input: {
  organizationId: number;
  actorUserId?: number | null;
  companyName: string;
  defaultTeams?: string[];
  defaultPositions?: string[];
  defaultEducationInstitution?: string;
  defaultPayoutDay?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = Number(input.organizationId);

  const defaultTeams =
    input.defaultTeams?.length
      ? input.defaultTeams
      : ["상담팀", "학사팀", "정산팀"];

  const defaultPositions =
    input.defaultPositions?.length
      ? input.defaultPositions
      : ["사원", "관리자", "대표"];

  const defaultEducationInstitution =
    input.defaultEducationInstitution?.trim() || "기본 교육원";

  const defaultPayoutDay = Math.min(
    31,
    Math.max(1, Number(input.defaultPayoutDay || 25))
  );

  const existingBranding = await db
    .select()
    .from(brandingSettings)
    .where(eq(brandingSettings.organizationId, organizationId))
    .limit(1);

  if (existingBranding.length === 0) {
    await db.insert(brandingSettings).values({
      organizationId,
      companyName: input.companyName,
      messengerSubtitle: "사내 메신저",
      createdBy: input.actorUserId ?? null,
      updatedBy: input.actorUserId ?? null,
    } as any);
  }

  const existingSms = await db
    .select()
    .from(smsSettings)
    .where(eq(smsSettings.organizationId, organizationId))
    .limit(1);

  if (existingSms.length === 0) {
    await db.insert(smsSettings).values({
      organizationId,
      provider: "aligo",
      isActive: false,
    } as any);
  }

  const existingTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.organizationId, organizationId))
    .limit(1);

  if (existingTeams.length === 0) {
    await db.insert(teams).values(
      defaultTeams.map((name, index) => ({
        organizationId,
        name,
        sortOrder: index + 1,
        isActive: true,
      })) as any
    );
  }

  const existingPositions = await db
    .select()
    .from(positions)
    .where(eq(positions.organizationId, organizationId))
    .limit(1);

  if (existingPositions.length === 0) {
    await db.insert(positions).values(
      defaultPositions.map((name, index) => ({
        organizationId,
        name,
        sortOrder: index + 1,
        isActive: true,
        settlementUnitAmount: "0",
      })) as any
    );
  }

  const [existingSystemSettings] = await db.execute(sql`
  SELECT id
  FROM settlement_settings
  WHERE organizationId = ${organizationId}
  LIMIT 1
`);

if (((existingSystemSettings as any[]) || []).length === 0) {
  await db.execute(sql`
    INSERT INTO settlement_settings (organizationId, payoutDay)
    VALUES (${organizationId}, ${defaultPayoutDay})
  `);
}

  const existingInstitutions = await db
    .select()
    .from(educationInstitutions)
    .where(eq(educationInstitutions.organizationId, organizationId))
    .limit(1);

  if (existingInstitutions.length === 0) {
    await db.insert(educationInstitutions).values({
      organizationId,
      name: defaultEducationInstitution,
      settlementType: "subject",
      normalSubjectPrice: "75000",
      unitCostAmount: "0",
      isActive: true,
    } as any);
  }

  await createSaasAuditLog({
    organizationId,
    actorUserId: input.actorUserId ?? null,
    actorRole: "superhost",
    action: "organization.defaults.create",
    targetType: "organization",
    targetId: organizationId,
    memo: "신규 회사 기본 세팅 자동 생성",
  });

  return { ok: true };
}

export async function getOrganizationUsageStats(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [rows] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM users WHERE organizationId = ${organizationId}) as userCount,
            (SELECT COUNT(*) FROM lead_forms WHERE organizationId = ${organizationId}) as totalFormCount,
      (SELECT COUNT(*) FROM lead_forms WHERE organizationId = ${organizationId} AND formType = 'landing') as landingFormCount,
      (SELECT COUNT(*) FROM lead_forms WHERE organizationId = ${organizationId} AND formType = 'ad') as adFormCount,
      (SELECT COUNT(*) FROM consultations WHERE organizationId = ${organizationId}) as consultationCount,
      (SELECT COUNT(*) FROM students WHERE organizationId = ${organizationId}) as studentCount,
      (SELECT COUNT(*) FROM settlement_items WHERE organizationId = ${organizationId}) as settlementItemCount,
(SELECT COUNT(*)
 FROM sms_logs
 WHERE organizationId = ${organizationId}
   AND status = 'success'
   AND createdAt >= DATE_FORMAT(CONVERT_TZ(NOW(), '+00:00', '+09:00'), '%Y-%m-01')
) as smsSentThisMonth
  `);

const row = (rows as any)?.[0] || {};

const localNoticeBytes = getLocalNoticeUploadUsageBytes(organizationId);
const r2Bytes = await getR2UploadUsageBytes(organizationId);
const totalStorageBytes = localNoticeBytes + r2Bytes;

return {
  ...row,
  smsCountThisMonth: Number(row.smsSentThisMonth || 0),
  storageUsedBytes: totalStorageBytes,
  storageUsedMb: Number((totalStorageBytes / 1024 / 1024).toFixed(2)),
  localNoticeStorageBytes: localNoticeBytes,
  r2StorageBytes: r2Bytes,
};
}

export async function getOrganizationLimitStatus(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const org = await getOrganizationById(organizationId);
  if (!org) throw new Error("회사를 찾을 수 없습니다.");

  const usage = await getOrganizationUsageStats(organizationId);

  const maxUsers = Number((org as any).maxUsers || 0);
  const maxLandingForms = Number((org as any).maxLandingForms || 0);
  const maxAdForms = Number((org as any).maxAdForms || 0);
  const maxSmsPerMonth = Number((org as any).maxSmsPerMonth || 0);
  const maxStorageMb = Number((org as any).maxStorageMb || 0);

  return {
    organization: org,
    usage,
    limits: {
      maxUsers,
      maxLandingForms,
      maxAdForms,
      maxSmsPerMonth,
      maxStorageMb,
    },
    exceeded: {
      users:
        maxUsers > 0 &&
        Number(usage.userCount || 0) >= maxUsers,

      landingForms:
        maxLandingForms > 0 &&
        Number(usage.landingFormCount || 0) >= maxLandingForms,

      adForms:
        maxAdForms > 0 &&
        Number(usage.adFormCount || 0) >= maxAdForms,

      sms:
        maxSmsPerMonth > 0 &&
        Number((usage as any).smsCountThisMonth || 0) >= maxSmsPerMonth,

      storage:
        maxStorageMb > 0 &&
        Number(usage.storageUsedBytes || 0) >= maxStorageMb * 1024 * 1024,
    },
  };
}

export async function listOrganizationAuditLogs(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select()
    .from(auditLogs)
    .where(sql`${auditLogs.organizationId} = ${organizationId}`)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return rows;
}

export async function getOrganizationFeatureFlags(
  organizationId: number
) {
  const organizations = await listOrganizations();

  const org = organizations.find(
    (item: any) => Number(item.id) === Number(organizationId)
  );

  if (!org) {
    throw new Error("Organization not found");
  }

  return {
    allowBackup: Boolean(org.allowBackup),
    allowAuditLog: Boolean(org.allowAuditLog),
    allowMessenger: Boolean(org.allowMessenger),
    allowPracticeCenter: Boolean(org.allowPracticeCenter),
    allowSettlementReport: Boolean(org.allowSettlementReport),
    allowPrivateCertificate: Boolean(org.allowPrivateCertificate),
  };
}

export async function getOrganizationOnboardingStatus(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [rows] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM teams WHERE organizationId = ${organizationId}) as teamCount,
      (SELECT COUNT(*) FROM positions WHERE organizationId = ${organizationId}) as positionCount,
      (SELECT COUNT(*) FROM education_institutions WHERE organizationId = ${organizationId}) as educationInstitutionCount,
      (SELECT payoutDay FROM settlement_settings WHERE organizationId = ${organizationId} LIMIT 1) as payoutDay
  `);

  const row = (rows as any)?.[0] || {};

  return {
    teamCount: Number(row.teamCount || 0),
    positionCount: Number(row.positionCount || 0),
    educationInstitutionCount: Number(row.educationInstitutionCount || 0),
    payoutDay: row.payoutDay ? Number(row.payoutDay) : null,
    completed:
      Number(row.teamCount || 0) > 0 &&
      Number(row.positionCount || 0) > 0 &&
      Number(row.educationInstitutionCount || 0) > 0 &&
      Boolean(row.payoutDay),
  };
}

export async function createSaasInquiry(input: {
  inquiryType?: "beta" | "demo" | "pricing" | "contact";
  clientName: string;
  phone: string;
  companyName?: string | null;
  businessType?: string | null;
  email?: string | null;
  message?: string | null;
  source?: string | null;
  pagePath?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(saasInquiries).values({
    inquiryType: input.inquiryType || "beta",
    clientName: input.clientName.trim(),
    phone: input.phone.trim(),
    companyName: input.companyName?.trim() || null,
    businessType: input.businessType?.trim() || null,
    email: input.email?.trim() || null,
    message: input.message?.trim() || null,
    source: input.source?.trim() || "homepage",
    pagePath: input.pagePath?.trim() || null,
    utmSource: input.utmSource?.trim() || null,
    utmMedium: input.utmMedium?.trim() || null,
    utmCampaign: input.utmCampaign?.trim() || null,
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
  } as any);

  return {
    ok: true,
    id: Number(result?.insertId ?? result?.[0]?.insertId ?? 0),
  };
}

export async function listSaasInquiries(input?: {
  status?: "new" | "contacted" | "qualified" | "closed" | "spam" | "all";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const status = input?.status || "all";

  if (status === "all") {
    return db
      .select()
      .from(saasInquiries)
      .orderBy(desc(saasInquiries.createdAt))
      .limit(300);
  }

  return db
    .select()
    .from(saasInquiries)
    .where(eq(saasInquiries.status, status))
    .orderBy(desc(saasInquiries.createdAt))
    .limit(300);
}

export async function updateSaasInquiry(input: {
  id: number;
  status?: "new" | "contacted" | "qualified" | "closed" | "spam";
  memo?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(saasInquiries)
    .set({
      status: input.status,
      memo:
        input.memo === undefined
          ? undefined
          : input.memo?.trim() || null,
    } as any)
    .where(eq(saasInquiries.id, input.id));

  return { ok: true };
}

export async function assignUserToOrganization(input: {
  userId: number;
  organizationId: number;
  updatedBy?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(users)
    .set({
      organizationId: Number(input.organizationId),
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, Number(input.userId)));

  await createSaasAuditLog({
    organizationId: Number(input.organizationId),
    actorUserId: input.updatedBy ?? null,
    actorRole: "superhost",
    action: "organization.user.assign",
    targetType: "user",
    targetId: Number(input.userId),
    memo: `사용자 조직 이동: ${input.userId} -> ${input.organizationId}`,
  });

  return {
    ok: true,
  };
}

const PLAN_LIMITS: Record<string, any> = {
  basic: {
    maxUsers: 5,
    maxLandingForms: 10,
    maxAdForms: 10,
    maxSmsPerMonth: 1000,
    maxStorageMb: 1024,
  },
  pro: {
    maxUsers: 15,
    maxLandingForms: 30,
    maxAdForms: 30,
    maxSmsPerMonth: 3000,
    maxStorageMb: 3072,
  },
  enterprise: {
    maxUsers: 30,
    maxLandingForms: 60,
    maxAdForms: 60,
    maxSmsPerMonth: 10000,
    maxStorageMb: 10240,
  },
};

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  basic: 99000,
  pro: 199000,
  enterprise: 399000,
};

function getPlanBillingAmount(planCode?: string | null) {
  return PLAN_PRICES[planCode || "basic"] ?? 0;
}

export async function getUserByUsernameForSaas(username: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username.trim()))
    .limit(1);

  return rows[0] || null;
}

export async function getOrganizationBySlug(slug: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug.trim().toLowerCase()))
    .limit(1);

  return rows[0] || null;
}

export async function checkUsernameAvailable(username: string) {
  const existing = await getUserByUsernameForSaas(username);
  return { available: !existing };
}

export async function checkOrganizationSlugAvailable(slug: string) {
  const existing = await getOrganizationBySlug(slug);
  return { available: !existing };
}

export async function createHostUserForOrganization(input: {
  organizationId: number;
  username: string;
  passwordHash: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(users).values({
    organizationId: input.organizationId,
    openId: `manual_${input.username}`,
    username: input.username,
    passwordHash: input.passwordHash,
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    role: "host",
    loginMethod: "manual",
    isActive: true,
  } as any);

  return Number(result?.insertId ?? result?.[0]?.insertId ?? 0);
}

export async function createTenantSignup(input: {
  companyName: string;
  slug: string;
  businessName?: string | null;
  businessNumber?: string | null;
  managerName: string;
  phone: string;
  birthDate?: string | null;
  username: string;
  passwordHash: string;
  planCode: "basic" | "pro" | "enterprise";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const limits = PLAN_LIMITS[input.planCode];

  const organization = await createOrganization({
    name: input.companyName,
    slug: input.slug,
    businessName: input.businessName,
    businessNumber: input.businessNumber,
    planCode: input.planCode,
    status: "active",
    maxUsers: limits.maxUsers,
    maxLandingForms: limits.maxLandingForms,
    maxAdForms: limits.maxAdForms,
    maxSmsPerMonth: limits.maxSmsPerMonth,
    maxStorageMb: limits.maxStorageMb,
    allowBackup: true,
    allowAuditLog: true,
    allowMessenger: true,
    allowPracticeCenter: true,
    allowSettlementReport: true,
    allowPrivateCertificate: true,
    memo: "자동가입 trial",
    createdBy: null,
billingAmount: getPlanBillingAmount(input.planCode),
nextBillingAmount: getPlanBillingAmount(input.planCode),
  } as any);

  if (!organization?.id) {
    throw new Error("회사 생성에 실패했습니다.");
  }

  await db
    .update(organizations)
    .set({
      subscriptionStatus: "trial",
      trialStartedAt: now,
      trialEndsAt,
      nextBillingAt: trialEndsAt,
    } as any)
    .where(eq(organizations.id, Number(organization.id)));

  const hostUserId = await createHostUserForOrganization({
    organizationId: Number(organization.id),
    username: input.username,
    passwordHash: input.passwordHash,
    name: input.managerName,
    phone: input.phone,
  });

  await db
    .update(organizations)
    .set({
      ownerUserId: hostUserId,
    } as any)
    .where(eq(organizations.id, Number(organization.id)));

  await createOrganizationDefaults({
    organizationId: Number(organization.id),
    actorUserId: hostUserId,
    companyName: input.businessName || input.companyName,
  });

  const signupResult: any = await db.insert(saasSignupRequests).values({
    organizationId: Number(organization.id),
    planCode: input.planCode,
    companyName: input.companyName,
    slug: input.slug,
    businessName: input.businessName || null,
    businessNumber: input.businessNumber || null,
    managerName: input.managerName,
    phone: input.phone,
    birthDate: input.birthDate || null,
    username: input.username,
    status: "trial",
    trialStartedAt: now,
    trialEndsAt,
  } as any);

  return {
    ok: true,
    organizationId: Number(organization.id),
    hostUserId,
    signupRequestId: Number(signupResult?.insertId ?? signupResult?.[0]?.insertId ?? 0),
    slug: input.slug,
    trialEndsAt,
  };
}

export async function createBillingRegistrationToken(input: {
  organizationId: number;
  createdBy?: number | null;
  expiresInMinutes?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + (input.expiresInMinutes ?? 60 * 24) * 60 * 1000
  );

  await db.insert(billingRegistrationTokens).values({
    organizationId: input.organizationId,
    token,
    expiresAt,
    createdBy: input.createdBy ?? null,
  } as any);

  await createSaasAuditLog({
    organizationId: input.organizationId,
    actorUserId: input.createdBy ?? null,
    actorRole: "superhost",
    action: "billing.token.create",
    targetType: "billing_registration_token",
    memo: "카드 등록 링크 생성",
  });

 const appBaseUrl =
  process.env.APP_BASE_URL ||
  process.env.PUBLIC_APP_URL ||
  process.env.VITE_APP_BASE_URL ||
  "https://educrm.june.kr";

return {
  ok: true,
  token,
  expiresAt,
  billingRegistrationUrl: `${appBaseUrl}/billing/register/${token}`,
};
}

export async function getBillingRegistrationToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select()
    .from(billingRegistrationTokens)
    .where(eq(billingRegistrationTokens.token, token))
    .limit(1);

  return rows[0] || null;
}

export async function saveOrganizationBillingKey(input: {
  token: string;
  billingKey: string;
  customerKey: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const tokenRow = await getBillingRegistrationToken(input.token);

  if (!tokenRow) {
    throw new Error("유효하지 않은 카드 등록 토큰입니다.");
  }

  if ((tokenRow as any).usedAt) {
    throw new Error("이미 사용된 카드 등록 링크입니다.");
  }

  if (new Date((tokenRow as any).expiresAt).getTime() < Date.now()) {
    throw new Error("만료된 카드 등록 링크입니다.");
  }

  const organizationId = Number((tokenRow as any).organizationId);

  await db
    .update(organizations)
    .set({
      billingKey: input.billingKey,
      customerKey: input.customerKey,
      subscriptionStatus: "active",
      paymentFailureCount: 0,
      paymentFailedAt: null,
      graceUntilAt: null,
      updatedAt: new Date(),
    } as any)
    .where(eq(organizations.id, organizationId));

  await db
    .update(billingRegistrationTokens)
    .set({
      usedAt: new Date(),
    } as any)
    .where(eq(billingRegistrationTokens.token, input.token));

  await createSaasAuditLog({
    organizationId,
    action: "billing.key.save",
    targetType: "organization",
    targetId: organizationId,
    memo: "Toss billingKey 저장 완료",
  });

  return {
    ok: true,
    organizationId,
  };
}

export async function createSubscriptionPayment(input: {
  organizationId: number;
  planCode: string;
  customPlanName?: string | null;
  billingAmount: number;
  billingCycleStart?: Date | null;
  billingCycleEnd?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(subscriptionPayments).values({
    organizationId: input.organizationId,
    planCode: input.planCode,
    customPlanName: input.customPlanName ?? null,
    billingAmount: input.billingAmount,
    paymentStatus: "pending",
    billingCycleStart: input.billingCycleStart ?? null,
    billingCycleEnd: input.billingCycleEnd ?? null,
  } as any);

  const paymentId = Number(result?.insertId ?? result?.[0]?.insertId ?? 0);

  await recordSubscriptionPaymentEvent({
    organizationId: input.organizationId,
    paymentId,
    eventType: "payment.created",
    message: "구독 결제 원장 생성",
  });

  return {
    ok: true,
    paymentId,
  };
}

export async function recordSubscriptionPaymentEvent(input: {
  organizationId: number;
  paymentId?: number | null;
  eventType: string;
  message?: string | null;
  rawJson?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.insert(subscriptionPaymentEvents).values({
    organizationId: input.organizationId,
    paymentId: input.paymentId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    rawJson:
      input.rawJson === undefined || input.rawJson === null
        ? null
        : JSON.stringify(input.rawJson),
  } as any);

  return { ok: true };
}

export async function markSubscriptionPaymentPaid(input: {
  organizationId: number;
  paymentId: number;
  tossPaymentKey?: string | null;
  tossOrderId?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const nextBillingAt = new Date();
  nextBillingAt.setMonth(nextBillingAt.getMonth() + 1);

  await db
    .update(subscriptionPayments)
    .set({
      paymentStatus: "paid",
      paidAt: new Date(),
      tossPaymentKey: input.tossPaymentKey ?? null,
      tossOrderId: input.tossOrderId ?? null,
    } as any)
    .where(eq(subscriptionPayments.id, input.paymentId));

  await db
    .update(organizations)
    .set({
      subscriptionStatus: "active",
      status: "active",
      lastPaidAt: new Date(),
      nextBillingAt,
      paymentFailureCount: 0,
      paymentFailedAt: null,
      graceUntilAt: null,
    } as any)
    .where(eq(organizations.id, input.organizationId));

  await recordSubscriptionPaymentEvent({
    organizationId: input.organizationId,
    paymentId: input.paymentId,
    eventType: "payment.paid",
    message: "구독 결제 성공",
  });

  return { ok: true };
}

export async function markSubscriptionPaymentFailed(input: {
  organizationId: number;
  paymentId: number;
  failureReason?: string | null;
  rawJson?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const org = await getOrganizationById(input.organizationId);
  const failureCount = Number((org as any)?.paymentFailureCount || 0) + 1;

  const graceUntilAt = new Date();
  graceUntilAt.setDate(graceUntilAt.getDate() + 7);

  const nextStatus = failureCount >= 3 ? "paused" : "overdue";

  await db
    .update(subscriptionPayments)
    .set({
      paymentStatus: "failed",
      failedAt: new Date(),
      failureReason: input.failureReason ?? null,
    } as any)
    .where(eq(subscriptionPayments.id, input.paymentId));

  await db
    .update(organizations)
    .set({
      subscriptionStatus: nextStatus,
      paymentFailureCount: failureCount,
      paymentFailedAt: new Date(),
      graceUntilAt,
    } as any)
    .where(eq(organizations.id, input.organizationId));

  await recordSubscriptionPaymentEvent({
    organizationId: input.organizationId,
    paymentId: input.paymentId,
    eventType: "payment.failed",
    message: input.failureReason || "구독 결제 실패",
    rawJson: input.rawJson,
  });

  return {
    ok: true,
    failureCount,
    subscriptionStatus: nextStatus,
    graceUntilAt,
  };
}

export async function cancelTenant(input: {
  organizationId: number;
  actorUserId?: number | null;
  reason?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const before = await getOrganizationById(input.organizationId);

  await db
    .update(organizations)
    .set({
      status: "inactive",
      subscriptionStatus: "cancelled",
      cancelledAt: new Date(),
      memo: input.reason?.trim() || "superhost cancelled tenant",
      updatedBy: input.actorUserId ?? null,
    } as any)
    .where(eq(organizations.id, input.organizationId));

  const after = await getOrganizationById(input.organizationId);

  await createSaasAuditLog({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? null,
    actorRole: "superhost",
    action: "organization.cancel",
    targetType: "organization",
    targetId: input.organizationId,
    beforeJson: JSON.stringify(before ?? {}),
    afterJson: JSON.stringify(after ?? {}),
    memo: input.reason || "테넌트 중지/삭제 처리",
  });

  return { ok: true };
}

const SAAS_ADMIN_UNLOCK_MINUTES = 30;

export async function getSaasAdminLockStatus(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select({
      id: users.id,
      saasAdminPasswordHash: users.saasAdminPasswordHash,
      saasAdminUnlockedAt: users.saasAdminUnlockedAt,
    })
    .from(users)
    .where(eq(users.id, Number(userId)))
    .limit(1);

  const user = rows[0] as any;
  if (!user) throw new Error("사용자를 찾을 수 없습니다.");

  const hasPassword = Boolean(user.saasAdminPasswordHash);
  const unlockedAt = user.saasAdminUnlockedAt
    ? new Date(user.saasAdminUnlockedAt)
    : null;

  const unlockExpiresAt = unlockedAt
    ? new Date(unlockedAt.getTime() + SAAS_ADMIN_UNLOCK_MINUTES * 60 * 1000)
    : null;

  const unlocked =
    hasPassword &&
    Boolean(unlockExpiresAt) &&
    unlockExpiresAt!.getTime() > Date.now();

  return {
    hasPassword,
    unlocked,
    unlockedAt,
    unlockExpiresAt,
  };
}

export async function setSaasAdminPassword(input: {
  userId: number;
  password: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const passwordHash = await bcrypt.hash(input.password, 12);

  await db
    .update(users)
    .set({
      saasAdminPasswordHash: passwordHash,
      saasAdminUnlockedAt: null,
    } as any)
    .where(eq(users.id, Number(input.userId)));

  return { ok: true };
}

export async function unlockSaasAdmin(input: {
  userId: number;
  password: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select({
      id: users.id,
      saasAdminPasswordHash: users.saasAdminPasswordHash,
    })
    .from(users)
    .where(eq(users.id, Number(input.userId)))
    .limit(1);

  const user = rows[0] as any;
  if (!user?.saasAdminPasswordHash) {
    throw new Error("SaaS 관리자 암호가 설정되어 있지 않습니다.");
  }

  const ok = await bcrypt.compare(
    input.password,
    String(user.saasAdminPasswordHash)
  );

  if (!ok) {
    throw new Error("SaaS 관리자 암호가 일치하지 않습니다.");
  }

  const now = new Date();

  await db
    .update(users)
    .set({
      saasAdminUnlockedAt: now,
    } as any)
    .where(eq(users.id, Number(input.userId)));

  return {
    ok: true,
    unlockedAt: now,
    unlockExpiresAt: new Date(
      now.getTime() + SAAS_ADMIN_UNLOCK_MINUTES * 60 * 1000
    ),
  };
}

export async function lockSaasAdmin(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(users)
    .set({
      saasAdminUnlockedAt: null,
    } as any)
    .where(eq(users.id, Number(userId)));

  return { ok: true };
}

export async function requireSaasAdminUnlocked(userId: number) {
  const status = await getSaasAdminLockStatus(userId);

  if (!status.hasPassword) {
    throw new Error("SaaS 관리자 암호를 먼저 설정해야 합니다.");
  }

  if (!status.unlocked) {
    throw new Error("SaaS 관리자 잠금 해제가 필요합니다.");
  }

  return true;
}

export async function listSubscriptionPayments(input?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  if (input?.organizationId) {
    return db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.organizationId, input.organizationId))
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(300);
  }

  return db
    .select()
    .from(subscriptionPayments)
    .orderBy(desc(subscriptionPayments.createdAt))
    .limit(300);
}

export async function listSubscriptionPaymentEvents(input: {
  paymentId?: number | null;
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  if (input.paymentId) {
    return db
      .select()
      .from(subscriptionPaymentEvents)
      .where(eq(subscriptionPaymentEvents.paymentId, input.paymentId))
      .orderBy(desc(subscriptionPaymentEvents.createdAt))
      .limit(300);
  }

  if (input.organizationId) {
    return db
      .select()
      .from(subscriptionPaymentEvents)
      .where(eq(subscriptionPaymentEvents.organizationId, input.organizationId))
      .orderBy(desc(subscriptionPaymentEvents.createdAt))
      .limit(300);
  }

  return [];
}