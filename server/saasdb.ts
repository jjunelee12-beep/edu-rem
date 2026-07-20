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
  saasAnnouncements,
  practiceMasterSyncHistory,
  practiceInstitutionMasters,
  practiceEducationCenterMasters,
} from "../drizzle/schema";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export type PracticeMasterSyncDataType =
  | "institution"
  | "education_center";

export type PracticeMasterSyncSourceType =
  | "social_worker_association"
  | "educanvas";

export type PracticeMasterSyncStatus =
  | "analyzing"
  | "preview_ready"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type PracticeMasterInstitutionUploadRow = {
  rowNumber: number;

  categoryName?: string | null;
  name: string;
  representativeName?: string | null;
  phone?: string | null;

  address: string;
  detailAddress?: string | null;

  availableCourse?: string | null;

  price?: string | null;

  associationManagementNo?: string | null;
  selectionValidFrom?: string | null;
  selectionValidTo?: string | null;
  selectionStatus?: string | null;
};

export type PracticeMasterEducationCenterUploadRow = {
  rowNumber: number;

  categoryName?: string | null;
  name: string;
  representativeName?: string | null;
  phone?: string | null;

  address?: string | null;
  detailAddress?: string | null;

  availableCourse?: string | null;
};

type PracticeMasterPreviewIncoming = {
  rowNumber?: number;

  categoryName?: string | null;
  name?: string | null;
  representativeName?: string | null;
  phone?: string | null;

  address?: string | null;
  detailAddress?: string | null;

  availableCourse?: string | null;
  price?: string | null;

  associationManagementNo?: string | null;
  selectionValidFrom?: string | null;
  selectionValidTo?: string | null;
  selectionStatus?: string | null;
};

type PracticeMasterPreviewAction = {
  rowNumber?: number;
  masterId?: number;

  incoming?: PracticeMasterPreviewIncoming;
  existing?: Record<string, unknown>;

  changedFields?: string[];
  matchType?: string;
  reason?: string;
};

type PracticeMasterSyncPreview = {
  version: number;
  dataType: PracticeMasterSyncDataType;
  analyzedAt: string;

  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;

    unchangedCount: number;
    insertCount: number;
    updateCount: number;
    deactivateCount: number;
    reactivateCount: number;
    reviewCount: number;
  };

  unchanged: PracticeMasterPreviewAction[];
  inserts: PracticeMasterPreviewAction[];
  updates: PracticeMasterPreviewAction[];
  deactivates: PracticeMasterPreviewAction[];
  reactivates: PracticeMasterPreviewAction[];
  reviews: unknown[];
  invalidRows: unknown[];
};

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

isBillingExempt: organizations.isBillingExempt,
billingExemptReason: organizations.billingExemptReason,

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
isBillingExempt?: boolean;
billingExemptReason?: string | null;
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
isBillingExempt: input.isBillingExempt ?? false,
billingExemptReason: input.billingExemptReason?.trim() || null,
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
isBillingExempt?: boolean;
billingExemptReason?: string | null;
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
isBillingExempt: input.isBillingExempt,
billingExemptReason:
  input.billingExemptReason === undefined
    ? undefined
    : input.billingExemptReason?.trim() || null,
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

  organization: {
    id: org.id,
    slug: org.slug,
    status: org.status,
    subscriptionStatus: org.subscriptionStatus,
    paymentFailureCount: org.paymentFailureCount,
    paymentFailedAt: org.paymentFailedAt,
    graceUntilAt: org.graceUntilAt,
  },
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
  maxStorageMb: 2048,
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
  enterprise: 299000,
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
  billingKey: string;
  customerKey: string;
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
    billingKey: input.billingKey,
    customerKey: input.customerKey,
    paymentFailureCount: 0,
    paymentFailedAt: null,
    graceUntilAt: null,
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
  graceUntilAt.setDate(graceUntilAt.getDate() + 3);
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

export async function listSaasAnnouncements() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db
    .select()
    .from(saasAnnouncements)
    .orderBy(desc(saasAnnouncements.createdAt))
    .limit(100);
}

export async function getActiveSaasAnnouncement() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select()
    .from(saasAnnouncements)
    .where(sql`
      ${saasAnnouncements.isActive} = true
      AND (${saasAnnouncements.startsAt} IS NULL OR ${saasAnnouncements.startsAt} <= NOW())
      AND (${saasAnnouncements.endsAt} IS NULL OR ${saasAnnouncements.endsAt} >= NOW())
    `)
    .orderBy(desc(saasAnnouncements.createdAt))
    .limit(1);

  return rows[0] || null;
}

export async function createSaasAnnouncement(input: {
  title: string;
  content: string;
  type?: "notice" | "update" | "maintenance" | "billing";
  versionLabel?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  actorUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(saasAnnouncements).values({
    title: input.title.trim(),
    content: input.content.trim(),
    type: input.type || "notice",
    versionLabel: input.versionLabel?.trim() || null,
    ctaText: input.ctaText?.trim() || null,
    ctaUrl: input.ctaUrl?.trim() || null,
    isActive: input.isActive ?? true,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    createdBy: input.actorUserId ?? null,
    updatedBy: input.actorUserId ?? null,
  } as any);

  return {
    ok: true,
    id: Number(result?.insertId ?? result?.[0]?.insertId ?? 0),
  };
}

export async function updateSaasAnnouncement(input: {
  id: number;
  title?: string;
  content?: string;
  type?: "notice" | "update" | "maintenance" | "billing";
  versionLabel?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  actorUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(saasAnnouncements)
    .set({
      title: input.title === undefined ? undefined : input.title.trim(),
      content: input.content === undefined ? undefined : input.content.trim(),
      type: input.type,
      versionLabel:
        input.versionLabel === undefined
          ? undefined
          : input.versionLabel?.trim() || null,
      ctaText:
        input.ctaText === undefined
          ? undefined
          : input.ctaText?.trim() || null,
      ctaUrl:
        input.ctaUrl === undefined
          ? undefined
          : input.ctaUrl?.trim() || null,
      isActive: input.isActive,
      startsAt: input.startsAt === undefined ? undefined : input.startsAt,
      endsAt: input.endsAt === undefined ? undefined : input.endsAt,
      updatedBy: input.actorUserId ?? undefined,
      updatedAt: new Date(),
    } as any)
    .where(eq(saasAnnouncements.id, input.id));

  return { ok: true };
}

export async function deleteSaasAnnouncement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(saasAnnouncements)
    .set({
      isActive: false,
      updatedAt: new Date(),
    } as any)
    .where(eq(saasAnnouncements.id, id));

  return { ok: true };
}

export async function deactivateExpiredOverdueOrganizations() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [rows] = await db.execute(sql`
    SELECT id
    FROM organizations
    WHERE subscriptionStatus = 'overdue'
	 AND isBillingExempt = false
      AND graceUntilAt IS NOT NULL
      AND graceUntilAt < NOW()
  `);

  const targets = (rows as any[]) || [];

  for (const row of targets) {
    const organizationId = Number(row.id);

    await db
      .update(organizations)
      .set({
        subscriptionStatus: "paused",
        status: "inactive",
        updatedAt: new Date(),
      } as any)
      .where(eq(organizations.id, organizationId));

    await recordSubscriptionPaymentEvent({
      organizationId,
      eventType: "subscription.paused",
      message: "결제 유예기간 만료로 서비스 비활성화 처리",
    });
  }

  return {
    ok: true,
    count: targets.length,
  };
}

export async function processTrialEndedOrganizations() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [rows] = await db.execute(sql`
    SELECT id
    FROM organizations
    WHERE subscriptionStatus = 'trial'
AND isBillingExempt = false
      AND trialEndsAt IS NOT NULL
      AND trialEndsAt < NOW()
      AND status = 'active'
  `);

  const targets = (rows as any[]) || [];

  for (const row of targets) {
    const organizationId = Number(row.id);
    const graceUntilAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await db
      .update(organizations)
      .set({
        subscriptionStatus: "overdue",
        paymentFailedAt: new Date(),
        paymentFailureCount: 1,
        graceUntilAt,
        updatedAt: new Date(),
      } as any)
      .where(eq(organizations.id, organizationId));

    await recordSubscriptionPaymentEvent({
      organizationId,
      eventType: "trial.payment_failed",
message: "Trial 종료 후 자동결제 실패로 3일 유예 상태 전환",
    });
  }

  return {
    ok: true,
    count: targets.length,
  };
}

export async function reactivateTenant(input: {
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
      status: "active",
      subscriptionStatus: "active",
      paymentFailureCount: 0,
      paymentFailedAt: null,
      graceUntilAt: null,
      updatedBy: input.actorUserId ?? null,
      updatedAt: new Date(),
    } as any)
    .where(eq(organizations.id, input.organizationId));

  const after = await getOrganizationById(input.organizationId);

  await createSaasAuditLog({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? null,
    actorRole: "superhost",
    action: "organization.reactivate",
    targetType: "organization",
    targetId: input.organizationId,
    beforeJson: JSON.stringify(before ?? {}),
    afterJson: JSON.stringify(after ?? {}),
    memo: input.reason || "superhost manual reactivate",
  });

  await recordSubscriptionPaymentEvent({
    organizationId: input.organizationId,
    eventType: "subscription.reactivated",
    message: input.reason || "슈퍼호스트 수동 복구 처리",
  });

  return { ok: true };
}

// ─── Practice Master Sync (슈퍼호스트 공용 실습 데이터 관리) ───────

export async function getPracticeMasterSummary() {
  const db = await getDb();

  if (!db) {
    throw new Error("DB not available");
  }

  const [rows] = await db.execute(sql`
    SELECT
      (
        SELECT COUNT(*)
        FROM practice_institution_masters
      ) AS institutionTotalCount,

      (
        SELECT COUNT(*)
        FROM practice_institution_masters
        WHERE isActive = true
      ) AS institutionActiveCount,

      (
        SELECT COUNT(*)
        FROM practice_institution_masters
        WHERE isActive = false
      ) AS institutionInactiveCount,

      (
        SELECT COUNT(*)
        FROM practice_education_center_masters
      ) AS educationCenterTotalCount,

      (
        SELECT COUNT(*)
        FROM practice_education_center_masters
        WHERE isActive = true
      ) AS educationCenterActiveCount,

      (
        SELECT COUNT(*)
        FROM practice_education_center_masters
        WHERE isActive = false
      ) AS educationCenterInactiveCount,

      (
        SELECT completedAt
        FROM practice_master_sync_history
        WHERE
          dataType = 'institution'
          AND status = 'completed'
        ORDER BY id DESC
        LIMIT 1
      ) AS institutionLastSyncedAt,

      (
        SELECT sourceVersion
        FROM practice_master_sync_history
        WHERE
          dataType = 'institution'
          AND status = 'completed'
        ORDER BY id DESC
        LIMIT 1
      ) AS institutionSourceVersion,

      (
        SELECT completedAt
        FROM practice_master_sync_history
        WHERE
          dataType = 'education_center'
          AND status = 'completed'
        ORDER BY id DESC
        LIMIT 1
      ) AS educationCenterLastSyncedAt,

      (
        SELECT sourceVersion
        FROM practice_master_sync_history
        WHERE
          dataType = 'education_center'
          AND status = 'completed'
        ORDER BY id DESC
        LIMIT 1
      ) AS educationCenterSourceVersion
  `);

  const row = ((rows as any[]) || [])[0] || {};

  return {
    institution: {
      totalCount: Number(row.institutionTotalCount || 0),
      activeCount: Number(row.institutionActiveCount || 0),
      inactiveCount: Number(row.institutionInactiveCount || 0),
      lastSyncedAt: row.institutionLastSyncedAt || null,
      sourceVersion: row.institutionSourceVersion || null,
    },

    educationCenter: {
      totalCount: Number(row.educationCenterTotalCount || 0),
      activeCount: Number(row.educationCenterActiveCount || 0),
      inactiveCount: Number(row.educationCenterInactiveCount || 0),
      lastSyncedAt: row.educationCenterLastSyncedAt || null,
      sourceVersion: row.educationCenterSourceVersion || null,
    },
  };
}

const practiceMasterSyncHistoryListSelect = {
  id:
    practiceMasterSyncHistory.id,

  dataType:
    practiceMasterSyncHistory.dataType,

  sourceType:
    practiceMasterSyncHistory.sourceType,

  sourceFileName:
    practiceMasterSyncHistory.sourceFileName,

  sourceFileKey:
    practiceMasterSyncHistory.sourceFileKey,

  sourceFileUrl:
    practiceMasterSyncHistory.sourceFileUrl,

  sourceFileHash:
    practiceMasterSyncHistory.sourceFileHash,

  sourceVersion:
    practiceMasterSyncHistory.sourceVersion,

  status:
    practiceMasterSyncHistory.status,

  totalRows:
    practiceMasterSyncHistory.totalRows,

  validRows:
    practiceMasterSyncHistory.validRows,

  invalidRows:
    practiceMasterSyncHistory.invalidRows,

  unchangedCount:
    practiceMasterSyncHistory.unchangedCount,

  insertCount:
    practiceMasterSyncHistory.insertCount,

  updateCount:
    practiceMasterSyncHistory.updateCount,

  deactivateCount:
    practiceMasterSyncHistory.deactivateCount,

  reactivateCount:
    practiceMasterSyncHistory.reactivateCount,

  reviewCount:
    practiceMasterSyncHistory.reviewCount,

  memo:
    practiceMasterSyncHistory.memo,

  createdBy:
    practiceMasterSyncHistory.createdBy,

  executedBy:
    practiceMasterSyncHistory.executedBy,

  startedAt:
    practiceMasterSyncHistory.startedAt,

  completedAt:
    practiceMasterSyncHistory.completedAt,

  createdAt:
    practiceMasterSyncHistory.createdAt,

  updatedAt:
    practiceMasterSyncHistory.updatedAt,
};

export async function listPracticeMasterSyncHistory(input?: {
  dataType?: PracticeMasterSyncDataType | "all";
  status?: PracticeMasterSyncStatus | "all";
  limit?: number;
}) {
  const db = await getDb();

  if (!db) {
    throw new Error("DB not available");
  }

  const dataType = input?.dataType || "all";
  const status = input?.status || "all";

  const limit = Math.min(
    300,
    Math.max(1, Number(input?.limit || 100))
  );

  if (dataType !== "all" && status !== "all") {
    return db
      .select(
  practiceMasterSyncHistoryListSelect
)
.from(practiceMasterSyncHistory)
      .where(
        sql`
          ${practiceMasterSyncHistory.dataType} = ${dataType}
          AND ${practiceMasterSyncHistory.status} = ${status}
        `
      )
      .orderBy(desc(practiceMasterSyncHistory.createdAt))
      .limit(limit);
  }

  if (dataType !== "all") {
    return db
     .select(
  practiceMasterSyncHistoryListSelect
)
.from(practiceMasterSyncHistory)
      .where(
        eq(
          practiceMasterSyncHistory.dataType,
          dataType
        )
      )
      .orderBy(desc(practiceMasterSyncHistory.createdAt))
      .limit(limit);
  }

  if (status !== "all") {
    return db
      .select(
  practiceMasterSyncHistoryListSelect
)
.from(practiceMasterSyncHistory)
      .where(
        eq(
          practiceMasterSyncHistory.status,
          status
        )
      )
      .orderBy(desc(practiceMasterSyncHistory.createdAt))
      .limit(limit);
  }

  return db
    .select(
  practiceMasterSyncHistoryListSelect
)
.from(practiceMasterSyncHistory)
    .orderBy(desc(practiceMasterSyncHistory.createdAt))
    .limit(limit);
}

export async function getPracticeMasterSyncHistoryById(id: number) {
  const db = await getDb();

  if (!db) {
    throw new Error("DB not available");
  }

  const rows = await db
    .select()
    .from(practiceMasterSyncHistory)
    .where(
      eq(
        practiceMasterSyncHistory.id,
        Number(id)
      )
    )
    .limit(1);

  return rows[0] || null;
}

export async function createPracticeMasterSyncHistory(input: {
  dataType: PracticeMasterSyncDataType;
  sourceType: PracticeMasterSyncSourceType;
  sourceFileName: string;
  sourceFileKey?: string | null;
  sourceFileUrl?: string | null;
  sourceFileHash?: string | null;
  sourceVersion?: string | null;
  memo?: string | null;
  createdBy: number;
}) {
  const db = await getDb();

  if (!db) {
    throw new Error("DB not available");
  }

  const result: any = await db
    .insert(practiceMasterSyncHistory)
    .values({
      dataType: input.dataType,
      sourceType: input.sourceType,

      sourceFileName: input.sourceFileName.trim(),

      sourceFileKey:
        input.sourceFileKey?.trim() || null,

      sourceFileUrl:
        input.sourceFileUrl?.trim() || null,

      sourceFileHash:
        input.sourceFileHash?.trim() || null,

      sourceVersion:
        input.sourceVersion?.trim() || null,

      status: "analyzing",

      totalRows: 0,
      validRows: 0,
      invalidRows: 0,

      unchangedCount: 0,
      insertCount: 0,
      updateCount: 0,
      deactivateCount: 0,
      reactivateCount: 0,
      reviewCount: 0,

      previewJson: null,
      errorJson: null,

      memo:
        input.memo?.trim() || null,

      createdBy: Number(input.createdBy),

      startedAt: new Date(),
      completedAt: null,
    } as any);

  const id = Number(
    result?.insertId ??
      result?.[0]?.insertId ??
      0
  );

  if (!id) {
    throw new Error(
      "공용 실습 데이터 동기화 이력 생성에 실패했습니다."
    );
  }

  return getPracticeMasterSyncHistoryById(id);
}

export async function updatePracticeMasterSyncHistory(input: {
  id: number;

  status?: PracticeMasterSyncStatus;

  sourceFileKey?: string | null;
  sourceFileUrl?: string | null;
  sourceFileHash?: string | null;
  sourceVersion?: string | null;

  totalRows?: number;
  validRows?: number;
  invalidRows?: number;

  unchangedCount?: number;
  insertCount?: number;
  updateCount?: number;
  deactivateCount?: number;
  reactivateCount?: number;
  reviewCount?: number;

  previewJson?: unknown;
  errorJson?: unknown;

  memo?: string | null;

  startedAt?: Date | null;
  completedAt?: Date | null;
}) {
  const db = await getDb();

  if (!db) {
    throw new Error("DB not available");
  }

  const before =
    await getPracticeMasterSyncHistoryById(
      Number(input.id)
    );

  if (!before) {
    throw new Error(
      "공용 실습 데이터 동기화 이력을 찾을 수 없습니다."
    );
  }

  await db
    .update(practiceMasterSyncHistory)
    .set({
      status: input.status,

      sourceFileKey:
        input.sourceFileKey === undefined
          ? undefined
          : input.sourceFileKey?.trim() || null,

      sourceFileUrl:
        input.sourceFileUrl === undefined
          ? undefined
          : input.sourceFileUrl?.trim() || null,

      sourceFileHash:
        input.sourceFileHash === undefined
          ? undefined
          : input.sourceFileHash?.trim() || null,

      sourceVersion:
        input.sourceVersion === undefined
          ? undefined
          : input.sourceVersion?.trim() || null,

      totalRows:
        input.totalRows === undefined
          ? undefined
          : Math.max(0, Number(input.totalRows)),

      validRows:
        input.validRows === undefined
          ? undefined
          : Math.max(0, Number(input.validRows)),

      invalidRows:
        input.invalidRows === undefined
          ? undefined
          : Math.max(0, Number(input.invalidRows)),

      unchangedCount:
        input.unchangedCount === undefined
          ? undefined
          : Math.max(
              0,
              Number(input.unchangedCount)
            ),

      insertCount:
        input.insertCount === undefined
          ? undefined
          : Math.max(
              0,
              Number(input.insertCount)
            ),

      updateCount:
        input.updateCount === undefined
          ? undefined
          : Math.max(
              0,
              Number(input.updateCount)
            ),

      deactivateCount:
        input.deactivateCount === undefined
          ? undefined
          : Math.max(
              0,
              Number(input.deactivateCount)
            ),

      reactivateCount:
        input.reactivateCount === undefined
          ? undefined
          : Math.max(
              0,
              Number(input.reactivateCount)
            ),

      reviewCount:
        input.reviewCount === undefined
          ? undefined
          : Math.max(
              0,
              Number(input.reviewCount)
            ),

      previewJson:
        input.previewJson === undefined
          ? undefined
          : input.previewJson,

      errorJson:
        input.errorJson === undefined
          ? undefined
          : input.errorJson,

      memo:
        input.memo === undefined
          ? undefined
          : input.memo?.trim() || null,

      startedAt:
        input.startedAt === undefined
          ? undefined
          : input.startedAt,

      completedAt:
        input.completedAt === undefined
          ? undefined
          : input.completedAt,
    } as any)
    .where(
      eq(
        practiceMasterSyncHistory.id,
        Number(input.id)
      )
    );

  return getPracticeMasterSyncHistoryById(
    Number(input.id)
  );
}

function normalizePracticeMasterText(
  value?: string | null
) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePracticeMasterName(
  value?: string | null
) {
  return normalizePracticeMasterText(value)
    .replace(/\s*㈜\s*/g, "(주)")
    .replace(/\s*\(주\)\s*/gi, "(주)")
    .toLowerCase();
}

function normalizePracticeMasterPhone(
  value?: string | null
) {
  return String(value || "")
    .replace(/[^0-9]/g, "")
    .trim();
}

function normalizePracticeManagementNo(
  value?: string | null
) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizePracticeMasterAddress(
  value?: string | null
) {
  return normalizePracticeMasterText(value)
    .replace(/\s*,\s*/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function createPracticeMasterExactKey(input: {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
}) {
  return [
    normalizePracticeMasterName(input.name),
    normalizePracticeMasterPhone(input.phone),
    normalizePracticeMasterAddress(input.address),
  ].join("|");
}

function createPracticeMasterNameAddressKey(input: {
  name?: string | null;
  address?: string | null;
}) {
  return [
    normalizePracticeMasterName(input.name),
    normalizePracticeMasterAddress(input.address),
  ].join("|");
}

function createPracticeMasterNamePhoneKey(input: {
  name?: string | null;
  phone?: string | null;
}) {
  return [
    normalizePracticeMasterName(input.name),
    normalizePracticeMasterPhone(input.phone),
  ].join("|");
}

function addPracticeMasterMapItem<T extends { id: number }>(
  map: Map<string, T[]>,
  key: string,
  row: T
) {
  if (!key) return;

  const current = map.get(key) || [];
  current.push(row);
  map.set(key, current);
}

function practiceMasterNullableText(
  value?: string | null
) {
  const normalized =
    normalizePracticeMasterText(value);

  return normalized || null;
}

function normalizePracticeMasterDate(
  value?: string | null
) {
  const raw =
    normalizePracticeMasterText(value);

  if (!raw) return null;

  const normalized =
    raw
      .replace(/[./]/g, "-")
      .replace(/\s+/g, "");

  const match =
    normalized.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date =
    new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function resolvePracticeInstitutionActive(input: {
  selectionStatus?: string | null;
  selectionValidTo?: string | null;
}) {
  const status =
    normalizePracticeMasterText(
      input.selectionStatus
    );

  if (status.includes("취소")) {
    return false;
  }

  const validTo =
    normalizePracticeMasterDate(
      input.selectionValidTo
    );

  if (!validTo) {
    return true;
  }

  const now = new Date();

  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return validTo >= today;
}

function arePracticeMasterValuesEqual(
  left?: string | null,
  right?: string | null
) {
  return (
    normalizePracticeMasterText(left) ===
    normalizePracticeMasterText(right)
  );
}

function getPracticeMasterChangedFields(input: {
  existing: {
    categoryName?: string | null;
    name?: string | null;
    representativeName?: string | null;
    phone?: string | null;
    address?: string | null;
    detailAddress?: string | null;
    availableCourse?: string | null;
    price?: string | null;

    associationManagementNo?: string | null;
    selectionValidFrom?: string | null;
    selectionValidTo?: string | null;
    selectionStatus?: string | null;
  };

  incoming: {
    categoryName?: string | null;
    name?: string | null;
    representativeName?: string | null;
    phone?: string | null;
    address?: string | null;
    detailAddress?: string | null;
    availableCourse?: string | null;
    price?: string | null;

    associationManagementNo?: string | null;
    selectionValidFrom?: string | null;
    selectionValidTo?: string | null;
    selectionStatus?: string | null;
  };
}) {
  const changedFields: string[] = [];

  if (
    !arePracticeMasterValuesEqual(
      input.existing.categoryName,
      input.incoming.categoryName
    )
  ) {
    changedFields.push("categoryName");
  }

  if (
    !arePracticeMasterValuesEqual(
      input.existing.name,
      input.incoming.name
    )
  ) {
    changedFields.push("name");
  }

  if (
    !arePracticeMasterValuesEqual(
      input.existing.representativeName,
      input.incoming.representativeName
    )
  ) {
    changedFields.push("representativeName");
  }

  if (
    normalizePracticeMasterPhone(
      input.existing.phone
    ) !==
    normalizePracticeMasterPhone(
      input.incoming.phone
    )
  ) {
    changedFields.push("phone");
  }

  if (
    normalizePracticeMasterAddress(
      input.existing.address
    ) !==
    normalizePracticeMasterAddress(
      input.incoming.address
    )
  ) {
    changedFields.push("address");
  }

  if (
    !arePracticeMasterValuesEqual(
      input.existing.detailAddress,
      input.incoming.detailAddress
    )
  ) {
    changedFields.push("detailAddress");
  }

  if (
    !arePracticeMasterValuesEqual(
      input.existing.availableCourse,
      input.incoming.availableCourse
    )
  ) {
    changedFields.push("availableCourse");
  }

  if (
    normalizePracticeMasterText(
      input.existing.price
    ).replace(/,/g, "") !==
    normalizePracticeMasterText(
      input.incoming.price
    ).replace(/,/g, "")
  ) {
    changedFields.push("price");
  }

  if (
    normalizePracticeManagementNo(
      input.existing.associationManagementNo
    ) !==
    normalizePracticeManagementNo(
      input.incoming.associationManagementNo
    )
  ) {
    changedFields.push(
      "associationManagementNo"
    );
  }

  if (
    normalizePracticeMasterDate(
      input.existing.selectionValidFrom
    ) !==
    normalizePracticeMasterDate(
      input.incoming.selectionValidFrom
    )
  ) {
    changedFields.push(
      "selectionValidFrom"
    );
  }

  if (
    normalizePracticeMasterDate(
      input.existing.selectionValidTo
    ) !==
    normalizePracticeMasterDate(
      input.incoming.selectionValidTo
    )
  ) {
    changedFields.push(
      "selectionValidTo"
    );
  }

  if (
    !arePracticeMasterValuesEqual(
      input.existing.selectionStatus,
      input.incoming.selectionStatus
    )
  ) {
    changedFields.push(
      "selectionStatus"
    );
  }

  return changedFields;
}

function createPracticeMasterLookupMaps<
  T extends {
    id: number;
    name?: string | null;
    phone?: string | null;
    address?: string | null;
  }
>(rows: T[]) {
  const exactMap = new Map<string, T[]>();
  const nameAddressMap = new Map<string, T[]>();
  const namePhoneMap = new Map<string, T[]>();

  for (const row of rows) {
    const exactKey =
      createPracticeMasterExactKey(row);

    const nameAddressKey =
      createPracticeMasterNameAddressKey(row);

    const phone =
      normalizePracticeMasterPhone(row.phone);

    const namePhoneKey =
      phone
        ? createPracticeMasterNamePhoneKey(row)
        : "";

    addPracticeMasterMapItem(
      exactMap,
      exactKey,
      row
    );

    addPracticeMasterMapItem(
      nameAddressMap,
      nameAddressKey,
      row
    );

    if (namePhoneKey) {
      addPracticeMasterMapItem(
        namePhoneMap,
        namePhoneKey,
        row
      );
    }
  }

  return {
    exactMap,
    nameAddressMap,
    namePhoneMap,
  };
}

export async function analyzePracticeMasterSync(input: {
  syncHistoryId: number;

  dataType: PracticeMasterSyncDataType;

  institutionRows?:
    PracticeMasterInstitutionUploadRow[];

  educationCenterRows?:
    PracticeMasterEducationCenterUploadRow[];
}) {
  const db = await getDb();

  if (!db) {
    throw new Error("DB not available");
  }

  const syncHistory =
    await getPracticeMasterSyncHistoryById(
      Number(input.syncHistoryId)
    );

  if (!syncHistory) {
    throw new Error(
      "공용 실습 데이터 동기화 이력을 찾을 수 없습니다."
    );
  }

  if (
    syncHistory.dataType !== input.dataType
  ) {
    throw new Error(
      "동기화 이력의 자료 유형과 분석 요청 유형이 일치하지 않습니다."
    );
  }

  if (
    ![
      "analyzing",
      "failed",
      "cancelled",
    ].includes(String(syncHistory.status))
  ) {
    throw new Error(
      "현재 상태에서는 다시 분석할 수 없습니다."
    );
  }

  const sourceRows =
    input.dataType === "institution"
      ? input.institutionRows || []
      : input.educationCenterRows || [];

  if (sourceRows.length === 0) {
    throw new Error(
      "분석할 데이터가 없습니다."
    );
  }

  await updatePracticeMasterSyncHistory({
    id: Number(input.syncHistoryId),
    status: "analyzing",
    totalRows: sourceRows.length,
    validRows: 0,
    invalidRows: 0,
    unchangedCount: 0,
    insertCount: 0,
    updateCount: 0,
    deactivateCount: 0,
    reactivateCount: 0,
    reviewCount: 0,
    previewJson: null,
    errorJson: null,
    startedAt: new Date(),
    completedAt: null,
  });

  try {
    const existingRows =
      input.dataType === "institution"
        ? await db
            .select()
            .from(practiceInstitutionMasters)
            .orderBy(
              practiceInstitutionMasters.id
            )
        : await db
            .select()
            .from(practiceEducationCenterMasters)
            .orderBy(
              practiceEducationCenterMasters.id
            );

    const existingRowsAsCommon =
      existingRows.map((row: any) => ({
        id: Number(row.id),

        categoryName:
          row.categoryName || null,

        name:
          row.name || "",

        representativeName:
          row.representativeName || null,

        phone:
          row.phone || null,

        address:
          row.address || "",

        detailAddress:
          row.detailAddress || null,

        availableCourse:
          row.availableCourse || null,

        price:
          row.price !== undefined &&
          row.price !== null
            ? String(row.price)
            : null,

        associationManagementNo:
          row.associationManagementNo || null,

        selectionValidFrom:
          row.selectionValidFrom
            ? String(row.selectionValidFrom).slice(0, 10)
            : null,

        selectionValidTo:
          row.selectionValidTo
            ? String(row.selectionValidTo).slice(0, 10)
            : null,

        selectionStatus:
          row.selectionStatus || null,

        isActive:
          Boolean(row.isActive),
      }));

    const {
      exactMap,
      nameAddressMap,
      namePhoneMap,
    } = createPracticeMasterLookupMaps(
      existingRowsAsCommon
    );

    const managementNoMap =
      new Map<string, any[]>();

    if (input.dataType === "institution") {
      for (const row of existingRowsAsCommon) {
        const managementNo =
          normalizePracticeManagementNo(
            row.associationManagementNo
          );

        if (!managementNo) continue;

        const current =
          managementNoMap.get(
            managementNo
          ) || [];

        current.push(row);

        managementNoMap.set(
          managementNo,
          current
        );
      }
    }

    const unchanged: any[] = [];
    const inserts: any[] = [];
    const updates: any[] = [];
    const reactivates: any[] = [];
    const deactivates: any[] = [];
    const reviews: any[] = [];
    const invalidRows: any[] = [];

    const matchedMasterIds =
      new Set<number>();

    const protectedMasterIds =
      new Set<number>();

    const sourceExactKeys =
      new Map<string, number[]>();

    const sourceManagementNoRows =
      new Map<string, number[]>();

    for (const rawRow of sourceRows as any[]) {
      const rowNumber =
        Number(rawRow.rowNumber || 0);

      const incoming = {
        rowNumber,

        categoryName:
          practiceMasterNullableText(
            rawRow.categoryName
          ),

        name:
          normalizePracticeMasterText(
            rawRow.name
          ),

        representativeName:
          practiceMasterNullableText(
            rawRow.representativeName
          ),

        phone:
          practiceMasterNullableText(
            rawRow.phone
          ),

        address:
          practiceMasterNullableText(
            rawRow.address
          ),

        detailAddress:
          practiceMasterNullableText(
            rawRow.detailAddress
          ),

                availableCourse:
          practiceMasterNullableText(
            rawRow.availableCourse
          ),

        price:
          input.dataType === "institution"
            ? practiceMasterNullableText(
                rawRow.price
              )?.replace(/,/g, "") || null
            : null,

        associationManagementNo:
          input.dataType === "institution"
            ? practiceMasterNullableText(
                rawRow.associationManagementNo
              )
            : null,

        selectionValidFrom:
          input.dataType === "institution"
            ? normalizePracticeMasterDate(
                rawRow.selectionValidFrom
              )
            : null,

        selectionValidTo:
          input.dataType === "institution"
            ? normalizePracticeMasterDate(
                rawRow.selectionValidTo
              )
            : null,

        selectionStatus:
          input.dataType === "institution"
            ? practiceMasterNullableText(
                rawRow.selectionStatus
              )
            : null,
      };

      const rowErrors: string[] = [];

      if (
        !Number.isInteger(rowNumber) ||
        rowNumber <= 0
      ) {
        rowErrors.push(
          "엑셀 행 번호가 올바르지 않습니다."
        );
      }

      if (!incoming.name) {
        rowErrors.push(
          "기관명이 없습니다."
        );
      }

      if (
        input.dataType === "institution" &&
        !incoming.address
      ) {
        rowErrors.push(
          "실습기관 주소가 없습니다."
        );
      }

      if (
        input.dataType === "institution" &&
        !incoming.associationManagementNo
      ) {
        rowErrors.push(
          "협회 관리번호가 없습니다."
        );
      }

      if (
        input.dataType === "institution" &&
        !incoming.selectionValidFrom
      ) {
        rowErrors.push(
          "선정유효기간 시작일이 없습니다."
        );
      }

      if (
        input.dataType === "institution" &&
        !incoming.selectionValidTo
      ) {
        rowErrors.push(
          "선정유효기간 종료일이 없습니다."
        );
      }

      if (
        input.dataType === "institution" &&
        !incoming.selectionStatus
      ) {
        rowErrors.push(
          "선정상태가 없습니다."
        );
      }

	      if (
        input.dataType === "institution" &&
        rawRow.selectionValidFrom &&
        !incoming.selectionValidFrom
      ) {
        rowErrors.push(
          "선정유효기간 시작일 형식이 올바르지 않습니다."
        );
      }

      if (
        input.dataType === "institution" &&
        rawRow.selectionValidTo &&
        !incoming.selectionValidTo
      ) {
        rowErrors.push(
          "선정유효기간 종료일 형식이 올바르지 않습니다."
        );
      }

      if (
        incoming.selectionValidFrom &&
        incoming.selectionValidTo &&
        incoming.selectionValidFrom >
          incoming.selectionValidTo
      ) {
        rowErrors.push(
          "선정유효기간 시작일이 종료일보다 늦습니다."
        );
      }

      if (
        input.dataType === "institution" &&
        incoming.price &&
        !/^\d+$/.test(incoming.price)
      ) {
        rowErrors.push(
          "실습비는 숫자만 입력되어야 합니다."
        );
      }

      if (rowErrors.length > 0) {
        invalidRows.push({
          rowNumber,
          row: incoming,
          errors: rowErrors,
        });

        continue;
      }

      const incomingManagementNo =
        input.dataType === "institution"
          ? normalizePracticeManagementNo(
              incoming.associationManagementNo
            )
          : "";

      if (incomingManagementNo) {
        const sourceManagementRows =
          sourceManagementNoRows.get(
            incomingManagementNo
          ) || [];

        sourceManagementRows.push(
          rowNumber
        );

        sourceManagementNoRows.set(
          incomingManagementNo,
          sourceManagementRows
        );

        if (
          sourceManagementRows.length > 1
        ) {
          continue;
        }
      }

      if (incomingManagementNo) {
        const managementCandidates =
          managementNoMap.get(
            incomingManagementNo
          ) || [];

        if (
          managementCandidates.length === 1
        ) {
          const existing =
            managementCandidates[0];

          matchedMasterIds.add(
            existing.id
          );

          const changedFields =
            getPracticeMasterChangedFields({
              existing,
              incoming,
            });

          const shouldBeActive =
            resolvePracticeInstitutionActive({
              selectionStatus:
                incoming.selectionStatus,

              selectionValidTo:
                incoming.selectionValidTo,
            });

                    if (!shouldBeActive) {
            if (
              existing.isActive ||
              changedFields.length > 0
            ) {
              updates.push({
                rowNumber,
                masterId: existing.id,
                existing,
                incoming,
                changedFields:
                  existing.isActive
                    ? [
                        ...changedFields,
                        "isActive",
                      ]
                    : changedFields,
                matchType:
                  "management_no",
              });
            } else {
              unchanged.push({
                rowNumber,
                masterId: existing.id,
                incoming,
              });
            }

            continue;
          }

          if (!existing.isActive) {
            reactivates.push({
              rowNumber,
              masterId: existing.id,
              existing,
              incoming,
              changedFields: [
                ...changedFields,
                "isActive",
              ],
              matchType:
                "management_no",
            });
          } else if (
            changedFields.length > 0
          ) {
            updates.push({
              rowNumber,
              masterId: existing.id,
              existing,
              incoming,
              changedFields,
              matchType:
                "management_no",
            });
          } else {
            unchanged.push({
              rowNumber,
              masterId: existing.id,
              incoming,
            });
          }

          continue;
        }

        if (
          managementCandidates.length > 1
        ) {
          for (
            const candidate of
            managementCandidates
          ) {
            protectedMasterIds.add(
              candidate.id
            );
          }

          reviews.push({
            type:
              "multiple_management_no_matches",

            rowNumber,
            incoming,

            candidateMasterIds:
              managementCandidates.map(
                (row) => row.id
              ),

            message:
              "동일한 협회 관리번호를 가진 기존 마스터가 여러 건 존재합니다.",
          });

          continue;
        }
      }

      const exactKey =
        createPracticeMasterExactKey(
          incoming
        );

            const duplicateRows =
        sourceExactKeys.get(exactKey) || [];

      duplicateRows.push(rowNumber);

      sourceExactKeys.set(
        exactKey,
        duplicateRows
      );

      if (duplicateRows.length > 1) {
        continue;
      }

      const exactCandidates =
        exactMap.get(exactKey) || [];

      if (exactCandidates.length === 1) {
        const existing =
          exactCandidates[0];

        matchedMasterIds.add(
          existing.id
        );

        const changedFields =
          getPracticeMasterChangedFields({
            existing,
            incoming,
          });

                const shouldBeActive =
          input.dataType === "institution"
            ? resolvePracticeInstitutionActive({
                selectionStatus:
                  incoming.selectionStatus,
                selectionValidTo:
                  incoming.selectionValidTo,
              })
            : true;

        const activeStateChanged =
          Boolean(existing.isActive) !==
          shouldBeActive;

        if (
          changedFields.length === 0 &&
          !activeStateChanged
        ) {
          unchanged.push({
            rowNumber,
            masterId: existing.id,
            incoming,
          });
        } else if (
          shouldBeActive &&
          !existing.isActive
        ) {
          reactivates.push({
            rowNumber,
            masterId: existing.id,
            existing,
            incoming,
            changedFields:
              activeStateChanged
                ? [
                    ...changedFields,
                    "isActive",
                  ]
                : changedFields,
            matchType: "exact",
          });
        } else {
          updates.push({
            rowNumber,
            masterId: existing.id,
            existing,
            incoming,
            changedFields:
              activeStateChanged
                ? [
                    ...changedFields,
                    "isActive",
                  ]
                : changedFields,
            matchType: "exact",
          });
        }

        continue;
      }

      if (exactCandidates.length > 1) {
        for (
          const candidate of exactCandidates
        ) {
          protectedMasterIds.add(
            candidate.id
          );
        }

        reviews.push({
          type: "multiple_exact_matches",
          rowNumber,
          incoming,
          candidateMasterIds:
            exactCandidates.map(
              (row) => row.id
            ),
          message:
            "기존 마스터에 동일한 기관명·전화번호·주소가 여러 건 존재합니다.",
        });

        continue;
      }

      const nameAddressKey =
        createPracticeMasterNameAddressKey(
          incoming
        );

      const nameAddressCandidates =
        nameAddressMap.get(
          nameAddressKey
        ) || [];

      if (
        nameAddressCandidates.length === 1
      ) {
        const existing =
          nameAddressCandidates[0];

        matchedMasterIds.add(
          existing.id
        );

        const changedFields =
          getPracticeMasterChangedFields({
            existing,
            incoming,
          });

                const shouldBeActive =
          input.dataType === "institution"
            ? resolvePracticeInstitutionActive({
                selectionStatus:
                  incoming.selectionStatus,
                selectionValidTo:
                  incoming.selectionValidTo,
              })
            : true;

        const activeStateChanged =
          Boolean(existing.isActive) !==
          shouldBeActive;

        const action = {
          rowNumber,
          masterId: existing.id,
          existing,
          incoming,
          changedFields:
            activeStateChanged
              ? [
                  ...changedFields,
                  "isActive",
                ]
              : changedFields,
          matchType: "name_address",
        };

        if (
          shouldBeActive &&
          !existing.isActive
        ) {
          reactivates.push(action);
        } else if (
          changedFields.length > 0 ||
          activeStateChanged
        ) {
          updates.push(action);
        } else {
          unchanged.push(action);
        }

        continue;
      }

      if (
        nameAddressCandidates.length > 1
      ) {
        for (
          const candidate of
          nameAddressCandidates
        ) {
          protectedMasterIds.add(
            candidate.id
          );
        }

        reviews.push({
          type:
            "multiple_name_address_matches",
          rowNumber,
          incoming,
          candidateMasterIds:
            nameAddressCandidates.map(
              (row) => row.id
            ),
          message:
            "동일한 기관명과 주소를 가진 기존 마스터가 여러 건 존재합니다.",
        });

        continue;
      }

      const normalizedPhone =
        normalizePracticeMasterPhone(
          incoming.phone
        );

      if (normalizedPhone) {
        const namePhoneKey =
          createPracticeMasterNamePhoneKey(
            incoming
          );

        const namePhoneCandidates =
          namePhoneMap.get(
            namePhoneKey
          ) || [];

                if (
          namePhoneCandidates.length === 1
        ) {
          const existing =
            namePhoneCandidates[0];

          matchedMasterIds.add(
            existing.id
          );

          const changedFields =
            getPracticeMasterChangedFields({
              existing,
              incoming,
            });

          const shouldBeActive =
            input.dataType === "institution"
              ? resolvePracticeInstitutionActive({
                  selectionStatus:
                    incoming.selectionStatus,

                  selectionValidTo:
                    incoming.selectionValidTo,
                })
              : true;

          const activeStateChanged =
            Boolean(existing.isActive) !==
            shouldBeActive;

          const finalChangedFields = [
            ...changedFields,
          ];

          if (
            activeStateChanged &&
            !finalChangedFields.includes(
              "isActive"
            )
          ) {
            finalChangedFields.push(
              "isActive"
            );
          }

          if (
            shouldBeActive &&
            !existing.isActive
          ) {
            reactivates.push({
              rowNumber,
              masterId: existing.id,
              existing,
              incoming,
              changedFields:
                finalChangedFields,
              matchType:
                "name_phone_initial_migration",
            });
          } else {
            updates.push({
              rowNumber,
              masterId: existing.id,
              existing,
              incoming,
              changedFields:
                finalChangedFields,
              matchType:
                "name_phone_initial_migration",
            });
          }

          continue;
        }

        if (
          namePhoneCandidates.length > 1
        ) {
          for (
            const candidate of
            namePhoneCandidates
          ) {
            protectedMasterIds.add(
              candidate.id
            );
          }

          reviews.push({
            type:
              "multiple_name_phone_matches",
            rowNumber,
            incoming,
            candidateMasterIds:
              namePhoneCandidates.map(
                (row) => row.id
              ),
            message:
              "동일한 기관명과 전화번호를 가진 기존 마스터가 여러 건 존재합니다.",
          });

          continue;
        }
      }

      inserts.push({
        rowNumber,
        incoming,
      });
    }

        const duplicatedSourceRowNumbers =
      new Set<number>();

    for (
      const [
        managementNo,
        rowNumbers,
      ] of sourceManagementNoRows.entries()
    ) {
      if (rowNumbers.length <= 1) {
        continue;
      }

      for (const rowNumber of rowNumbers) {
        duplicatedSourceRowNumbers.add(
          rowNumber
        );

        const sourceRow =
          (sourceRows as any[]).find(
            (row) =>
              Number(row.rowNumber) ===
              Number(rowNumber)
          );

        reviews.push({
          type:
            "source_management_no_duplicate",

          rowNumber,

          sourceRowNumbers: [
            ...rowNumbers,
          ],

          incoming: sourceRow
            ? {
                rowNumber:
                  Number(
                    sourceRow.rowNumber
                  ),

                categoryName:
                  practiceMasterNullableText(
                    sourceRow.categoryName
                  ),

                name:
                  normalizePracticeMasterText(
                    sourceRow.name
                  ),

                representativeName:
                  practiceMasterNullableText(
                    sourceRow.representativeName
                  ),

                phone:
                  practiceMasterNullableText(
                    sourceRow.phone
                  ),

                address:
                  practiceMasterNullableText(
                    sourceRow.address
                  ),

                detailAddress:
                  practiceMasterNullableText(
                    sourceRow.detailAddress
                  ),

                availableCourse:
                  practiceMasterNullableText(
                    sourceRow.availableCourse
                  ),

                price:
                  practiceMasterNullableText(
                    sourceRow.price
                  )?.replace(/,/g, "") ||
                  null,

                associationManagementNo:
                  practiceMasterNullableText(
                    sourceRow.associationManagementNo
                  ),

                selectionValidFrom:
                  normalizePracticeMasterDate(
                    sourceRow.selectionValidFrom
                  ),

                selectionValidTo:
                  normalizePracticeMasterDate(
                    sourceRow.selectionValidTo
                  ),

                selectionStatus:
                  practiceMasterNullableText(
                    sourceRow.selectionStatus
                  ),
              }
            : undefined,

          managementNo,

          message:
            "업로드 파일에 동일한 협회 관리번호가 여러 행 존재합니다.",
        });
      }
    }

    for (
      const [
        exactKey,
        rowNumbers,
      ] of sourceExactKeys.entries()
    ) {
      if (rowNumbers.length <= 1) {
        continue;
      }

      for (
        const rowNumber of rowNumbers
      ) {
        duplicatedSourceRowNumbers.add(
          rowNumber
        );

        const sourceRow =
          (sourceRows as any[]).find(
            (row) =>
              Number(row.rowNumber) ===
              Number(rowNumber)
          );

        reviews.push({
          type: "source_duplicate",

          rowNumber,

          sourceRowNumbers: [
            ...rowNumbers,
          ],

          incoming: sourceRow
            ? {
                rowNumber:
                  Number(
                    sourceRow.rowNumber
                  ),

                categoryName:
                  practiceMasterNullableText(
                    sourceRow.categoryName
                  ),

                name:
                  normalizePracticeMasterText(
                    sourceRow.name
                  ),

                representativeName:
                  practiceMasterNullableText(
                    sourceRow.representativeName
                  ),

                phone:
                  practiceMasterNullableText(
                    sourceRow.phone
                  ),

                address:
                  practiceMasterNullableText(
                    sourceRow.address
                  ),

                detailAddress:
                  practiceMasterNullableText(
                    sourceRow.detailAddress
                  ),

                availableCourse:
                  practiceMasterNullableText(
                    sourceRow.availableCourse
                  ),
              }
            : null,

          exactKey,

          candidateMasterIds: [],

          message:
            "업로드 자료 안에 동일한 기관명·전화번호·주소가 중복되어 있습니다.",
        });
      }
    }

    if (
      duplicatedSourceRowNumbers.size > 0
    ) {
      const removeDuplicatedRows = (
        rows: any[]
      ) =>
        rows.filter(
          (row) =>
            !duplicatedSourceRowNumbers.has(
              Number(row.rowNumber)
            )
        );

      unchanged.splice(
        0,
        unchanged.length,
        ...removeDuplicatedRows(
          unchanged
        )
      );

      inserts.splice(
        0,
        inserts.length,
        ...removeDuplicatedRows(
          inserts
        )
      );

      updates.splice(
        0,
        updates.length,
        ...removeDuplicatedRows(
          updates
        )
      );

      reactivates.splice(
        0,
        reactivates.length,
        ...removeDuplicatedRows(
          reactivates
        )
      );
    }

    for (
      const existing of
      existingRowsAsCommon
    ) {
      if (!existing.isActive) {
        continue;
      }

      if (
        matchedMasterIds.has(existing.id)
      ) {
        continue;
      }

      if (
        protectedMasterIds.has(
          existing.id
        )
      ) {
        continue;
      }

      deactivates.push({
        masterId: existing.id,
        existing,
        reason:
          "최신 업로드 자료에서 확인되지 않음",
      });
    }

    const preview = {
      version: 1,

      dataType: input.dataType,

      analyzedAt:
        new Date().toISOString(),

      summary: {
        totalRows:
          sourceRows.length,

        validRows:
          sourceRows.length -
          invalidRows.length,

        invalidRows:
          invalidRows.length,

        unchangedCount:
          unchanged.length,

        insertCount:
          inserts.length,

        updateCount:
          updates.length,

        deactivateCount:
          deactivates.length,

        reactivateCount:
          reactivates.length,

        reviewCount:
          reviews.length,
      },

      unchanged,
      inserts,
      updates,
      deactivates,
      reactivates,
      reviews,
      invalidRows,
    };

    const updatedHistory =
      await updatePracticeMasterSyncHistory({
        id: Number(
          input.syncHistoryId
        ),

        status: "preview_ready",

        totalRows:
          preview.summary.totalRows,

        validRows:
          preview.summary.validRows,

        invalidRows:
          preview.summary.invalidRows,

        unchangedCount:
          preview.summary
            .unchangedCount,

        insertCount:
          preview.summary.insertCount,

        updateCount:
          preview.summary.updateCount,

        deactivateCount:
          preview.summary
            .deactivateCount,

        reactivateCount:
          preview.summary
            .reactivateCount,

        reviewCount:
          preview.summary.reviewCount,

        previewJson: preview,

        errorJson: null,

        completedAt: null,
      });

    return {
      ok: true,
      history: updatedHistory,
      preview,
    };
  } catch (error: any) {
    const errorPayload = {
      message:
        error?.message ||
        "공용 실습 데이터 분석 중 오류가 발생했습니다.",

      analyzedAt:
        new Date().toISOString(),
    };

    await updatePracticeMasterSyncHistory({
      id: Number(
        input.syncHistoryId
      ),

      status: "failed",

      errorJson: errorPayload,

      completedAt: new Date(),
    });

    throw error;
  }
}

function parsePracticeMasterPreview(
  value: unknown
): PracticeMasterSyncPreview {
  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(
        "저장된 동기화 미리보기 데이터를 해석할 수 없습니다."
      );
    }
  }

  if (
    !parsed ||
    typeof parsed !== "object"
  ) {
    throw new Error(
      "저장된 동기화 미리보기 데이터가 없습니다."
    );
  }

  const preview =
    parsed as Partial<PracticeMasterSyncPreview>;

  if (
    preview.version !== 1 ||
    !preview.summary ||
    !Array.isArray(preview.inserts) ||
    !Array.isArray(preview.updates) ||
    !Array.isArray(preview.deactivates) ||
    !Array.isArray(preview.reactivates) ||
    !Array.isArray(preview.reviews) ||
    !Array.isArray(preview.invalidRows)
  ) {
    throw new Error(
      "저장된 동기화 미리보기 데이터 형식이 올바르지 않습니다."
    );
  }

  if (
    preview.dataType !== "institution" &&
    preview.dataType !== "education_center"
  ) {
    throw new Error(
      "저장된 동기화 미리보기 자료 유형이 올바르지 않습니다."
    );
  }

  return preview as PracticeMasterSyncPreview;
}

function getPracticeMasterIncomingValues(
  action: PracticeMasterPreviewAction
) {
  const incoming = action.incoming;

  if (!incoming) {
    throw new Error(
      "동기화 대상 행의 입력 데이터가 없습니다."
    );
  }

  const name =
    normalizePracticeMasterText(
      incoming.name
    );

  const address =
    practiceMasterNullableText(
      incoming.address
    );

  if (!name) {
    throw new Error(
      `동기화 대상 ${Number(
        action.rowNumber || 0
      )}행의 기관명이 없습니다.`
    );
  }

  return {
    categoryName:
      practiceMasterNullableText(
        incoming.categoryName
      ),

    name,

    representativeName:
      practiceMasterNullableText(
        incoming.representativeName
      ),

    phone:
      practiceMasterNullableText(
        incoming.phone
      ),

    address,

    detailAddress:
      practiceMasterNullableText(
        incoming.detailAddress
      ),

        availableCourse:
      practiceMasterNullableText(
        incoming.availableCourse
      ),

    price:
      practiceMasterNullableText(
        incoming.price
      )?.replace(/,/g, "") || null,

    associationManagementNo:
      practiceMasterNullableText(
        incoming.associationManagementNo
      ),

    selectionValidFrom:
      normalizePracticeMasterDate(
        incoming.selectionValidFrom
      ),

    selectionValidTo:
      normalizePracticeMasterDate(
        incoming.selectionValidTo
      ),

    selectionStatus:
      practiceMasterNullableText(
        incoming.selectionStatus
      ),
  };
}

function assertPracticeMasterActionId(
  action: PracticeMasterPreviewAction
) {
  const masterId =
    Number(action.masterId || 0);

  if (
    !Number.isInteger(masterId) ||
    masterId <= 0
  ) {
    throw new Error(
      "동기화 대상 마스터 ID가 올바르지 않습니다."
    );
  }

  return masterId;
}

export async function executePracticeMasterSync(input: {
  syncHistoryId: number;
  actorUserId: number;
}) {
  const db = await getDb();

  if (!db) {
    throw new Error("DB not available");
  }

  const syncHistoryId =
    Number(input.syncHistoryId);

  const actorUserId =
    Number(input.actorUserId);

  if (
    !Number.isInteger(syncHistoryId) ||
    syncHistoryId <= 0
  ) {
    throw new Error(
      "동기화 이력 ID가 올바르지 않습니다."
    );
  }

  if (
    !Number.isInteger(actorUserId) ||
    actorUserId <= 0
  ) {
    throw new Error(
      "실행 사용자 정보가 올바르지 않습니다."
    );
  }

  try {
    const result = await db.transaction(
      async (tx) => {
        const [lockedRows] =
          await tx.execute(sql`
            SELECT *
            FROM practice_master_sync_history
            WHERE id = ${syncHistoryId}
            LIMIT 1
            FOR UPDATE
          `);

        const syncHistory =
          ((lockedRows as any[]) || [])[0];

        if (!syncHistory) {
          throw new Error(
            "공용 실습 데이터 동기화 이력을 찾을 수 없습니다."
          );
        }

        if (
          String(syncHistory.status) !==
          "preview_ready"
        ) {
          throw new Error(
            "미리보기 준비가 완료된 동기화만 실행할 수 있습니다."
          );
        }

        const preview =
          parsePracticeMasterPreview(
            syncHistory.previewJson
          );

        if (
          preview.dataType !==
          syncHistory.dataType
        ) {
          throw new Error(
            "동기화 이력과 미리보기의 자료 유형이 일치하지 않습니다."
          );
        }

        const invalidCount =
          Number(
            preview.summary.invalidRows || 0
          );

        const reviewCount =
          Number(
            preview.summary.reviewCount || 0
          );

        if (
          invalidCount > 0 ||
          preview.invalidRows.length > 0
        ) {
          throw new Error(
            `오류 행 ${Math.max(
              invalidCount,
              preview.invalidRows.length
            )}건이 있어 동기화를 실행할 수 없습니다.`
          );
        }

        if (
          reviewCount > 0 ||
          preview.reviews.length > 0
        ) {
          throw new Error(
            `확인 필요 항목 ${Math.max(
              reviewCount,
              preview.reviews.length
            )}건이 있어 동기화를 실행할 수 없습니다.`
          );
        }

        if (
          Number(
            syncHistory.invalidRows || 0
          ) > 0
        ) {
          throw new Error(
            "동기화 이력에 오류 행이 남아 있어 실행할 수 없습니다."
          );
        }

        if (
          Number(
            syncHistory.reviewCount || 0
          ) > 0
        ) {
          throw new Error(
            "동기화 이력에 확인 필요 항목이 남아 있어 실행할 수 없습니다."
          );
        }

        await tx
          .update(
            practiceMasterSyncHistory
          )
                    .set({
            status: "running",
            executedBy: actorUserId,
            errorJson: null,
            completedAt: null,
          } as any)
          .where(
            eq(
              practiceMasterSyncHistory.id,
              syncHistoryId
            )
          );

        let insertedCount = 0;
        let updatedCount = 0;
        let deactivatedCount = 0;
        let reactivatedCount = 0;

        if (
          preview.dataType ===
          "institution"
        ) {
          for (
            const action of
            preview.inserts
          ) {
            const values =
              getPracticeMasterIncomingValues(
                action
              );

            if (!values.address) {
              throw new Error(
                `신규 실습기관 ${Number(
                  action.rowNumber || 0
                )}행의 주소가 없습니다.`
              );
            }

            await tx
              .insert(
                practiceInstitutionMasters
              )
              .values({
                institutionType:
                  "institution",

                categoryName:
                  values.categoryName,

                name:
                  values.name,

                representativeName:
                  values.representativeName,

                phone:
                  values.phone,

                address:
                  values.address,

                detailAddress:
                  values.detailAddress,

                                availableCourse:
                  values.availableCourse,

                price:
                  values.price,

                associationManagementNo:
                  values.associationManagementNo,

                selectionValidFrom:
                  values.selectionValidFrom,

                selectionValidTo:
                  values.selectionValidTo,

                selectionStatus:
                  values.selectionStatus,

                isActive:
                  resolvePracticeInstitutionActive({
                    selectionStatus:
                      values.selectionStatus,

                    selectionValidTo:
                      values.selectionValidTo,
                  }),
              } as any);

            insertedCount += 1;
          }

          for (
            const action of
            preview.updates
          ) {
            const masterId =
              assertPracticeMasterActionId(
                action
              );

            const values =
              getPracticeMasterIncomingValues(
                action
              );

            if (!values.address) {
              throw new Error(
                `변경 실습기관 ${Number(
                  action.rowNumber || 0
                )}행의 주소가 없습니다.`
              );
            }

            const [targetRows] =
              await tx.execute(sql`
                SELECT id
                FROM practice_institution_masters
                WHERE id = ${masterId}
                LIMIT 1
                FOR UPDATE
              `);

            if (
              ((targetRows as any[]) || [])
                .length !== 1
            ) {
              throw new Error(
                `변경 대상 실습기관 ID ${masterId}를 찾을 수 없습니다.`
              );
            }

            await tx
              .update(
                practiceInstitutionMasters
              )
              .set({
                categoryName:
                  values.categoryName,

                name:
                  values.name,

                representativeName:
                  values.representativeName,

                phone:
                  values.phone,

                address:
                  values.address,

                detailAddress:
                  values.detailAddress,

                                availableCourse:
                  values.availableCourse,

                price:
                  values.price,

                associationManagementNo:
                  values.associationManagementNo,

                selectionValidFrom:
                  values.selectionValidFrom,

                selectionValidTo:
                  values.selectionValidTo,

                selectionStatus:
                  values.selectionStatus,

                isActive:
                  resolvePracticeInstitutionActive({
                    selectionStatus:
                      values.selectionStatus,

                    selectionValidTo:
                      values.selectionValidTo,
                  }),
              } as any)
              .where(
                eq(
                  practiceInstitutionMasters.id,
                  masterId
                )
              );

            updatedCount += 1;
          }

          for (
            const action of
            preview.reactivates
          ) {
            const masterId =
              assertPracticeMasterActionId(
                action
              );

            const values =
              getPracticeMasterIncomingValues(
                action
              );

            if (!values.address) {
              throw new Error(
                `재활성 실습기관 ${Number(
                  action.rowNumber || 0
                )}행의 주소가 없습니다.`
              );
            }

            const [targetRows] =
              await tx.execute(sql`
                SELECT id
                FROM practice_institution_masters
                WHERE id = ${masterId}
                LIMIT 1
                FOR UPDATE
              `);

            if (
              ((targetRows as any[]) || [])
                .length !== 1
            ) {
              throw new Error(
                `재활성 대상 실습기관 ID ${masterId}를 찾을 수 없습니다.`
              );
            }

            await tx
              .update(
                practiceInstitutionMasters
              )
              .set({
                categoryName:
                  values.categoryName,

                name:
                  values.name,

                representativeName:
                  values.representativeName,

                phone:
                  values.phone,

                address:
                  values.address,

                detailAddress:
                  values.detailAddress,

                                availableCourse:
                  values.availableCourse,

                price:
                  values.price,

                associationManagementNo:
                  values.associationManagementNo,

                selectionValidFrom:
                  values.selectionValidFrom,

                selectionValidTo:
                  values.selectionValidTo,

                selectionStatus:
                  values.selectionStatus,

                isActive:
                  resolvePracticeInstitutionActive({
                    selectionStatus:
                      values.selectionStatus,

                    selectionValidTo:
                      values.selectionValidTo,
                  }),
              } as any)
              .where(
                eq(
                  practiceInstitutionMasters.id,
                  masterId
                )
              );

            reactivatedCount += 1;
          }

          for (
            const action of
            preview.deactivates
          ) {
            const masterId =
              assertPracticeMasterActionId(
                action
              );

            const [targetRows] =
              await tx.execute(sql`
                SELECT id
                FROM practice_institution_masters
                WHERE id = ${masterId}
                LIMIT 1
                FOR UPDATE
              `);

            if (
              ((targetRows as any[]) || [])
                .length !== 1
            ) {
              throw new Error(
                `비활성 대상 실습기관 ID ${masterId}를 찾을 수 없습니다.`
              );
            }

            await tx
              .update(
                practiceInstitutionMasters
              )
              .set({
                isActive: false,
              } as any)
              .where(
                eq(
                  practiceInstitutionMasters.id,
                  masterId
                )
              );

            deactivatedCount += 1;
          }
        } else {
          for (
            const action of
            preview.inserts
          ) {
            const values =
              getPracticeMasterIncomingValues(
                action
              );

            await tx
              .insert(
                practiceEducationCenterMasters
              )
              .values({
                categoryName:
                  values.categoryName,

                name:
                  values.name,

                representativeName:
                  values.representativeName,

                phone:
                  values.phone,

                address:
                  values.address,

                detailAddress:
                  values.detailAddress,

                availableCourse:
                  values.availableCourse,

                isActive: true,
              } as any);

            insertedCount += 1;
          }

          for (
            const action of
            preview.updates
          ) {
            const masterId =
              assertPracticeMasterActionId(
                action
              );

            const values =
              getPracticeMasterIncomingValues(
                action
              );

            const [targetRows] =
              await tx.execute(sql`
                SELECT id
                FROM practice_education_center_masters
                WHERE id = ${masterId}
                LIMIT 1
                FOR UPDATE
              `);

            if (
              ((targetRows as any[]) || [])
                .length !== 1
            ) {
              throw new Error(
                `변경 대상 실습교육원 ID ${masterId}를 찾을 수 없습니다.`
              );
            }

            await tx
              .update(
                practiceEducationCenterMasters
              )
              .set({
                categoryName:
                  values.categoryName,

                name:
                  values.name,

                representativeName:
                  values.representativeName,

                phone:
                  values.phone,

                address:
                  values.address,

                detailAddress:
                  values.detailAddress,

                availableCourse:
                  values.availableCourse,
              } as any)
              .where(
                eq(
                  practiceEducationCenterMasters.id,
                  masterId
                )
              );

            updatedCount += 1;
          }

          for (
            const action of
            preview.reactivates
          ) {
            const masterId =
              assertPracticeMasterActionId(
                action
              );

            const values =
              getPracticeMasterIncomingValues(
                action
              );

            const [targetRows] =
              await tx.execute(sql`
                SELECT id
                FROM practice_education_center_masters
                WHERE id = ${masterId}
                LIMIT 1
                FOR UPDATE
              `);

            if (
              ((targetRows as any[]) || [])
                .length !== 1
            ) {
              throw new Error(
                `재활성 대상 실습교육원 ID ${masterId}를 찾을 수 없습니다.`
              );
            }

            await tx
              .update(
                practiceEducationCenterMasters
              )
              .set({
                categoryName:
                  values.categoryName,

                name:
                  values.name,

                representativeName:
                  values.representativeName,

                phone:
                  values.phone,

                address:
                  values.address,

                detailAddress:
                  values.detailAddress,

                availableCourse:
                  values.availableCourse,

                isActive: true,
              } as any)
              .where(
                eq(
                  practiceEducationCenterMasters.id,
                  masterId
                )
              );

            reactivatedCount += 1;
          }

          for (
            const action of
            preview.deactivates
          ) {
            const masterId =
              assertPracticeMasterActionId(
                action
              );

            const [targetRows] =
              await tx.execute(sql`
                SELECT id
                FROM practice_education_center_masters
                WHERE id = ${masterId}
                LIMIT 1
                FOR UPDATE
              `);

            if (
              ((targetRows as any[]) || [])
                .length !== 1
            ) {
              throw new Error(
                `비활성 대상 실습교육원 ID ${masterId}를 찾을 수 없습니다.`
              );
            }

            await tx
              .update(
                practiceEducationCenterMasters
              )
              .set({
                isActive: false,
              } as any)
              .where(
                eq(
                  practiceEducationCenterMasters.id,
                  masterId
                )
              );

            deactivatedCount += 1;
          }
        }

        if (
          insertedCount !==
          preview.inserts.length
        ) {
          throw new Error(
            "신규 추가 처리 건수가 미리보기와 일치하지 않습니다."
          );
        }

        if (
          updatedCount !==
          preview.updates.length
        ) {
          throw new Error(
            "정보 변경 처리 건수가 미리보기와 일치하지 않습니다."
          );
        }

        if (
          deactivatedCount !==
          preview.deactivates.length
        ) {
          throw new Error(
            "비활성 처리 건수가 미리보기와 일치하지 않습니다."
          );
        }

        if (
          reactivatedCount !==
          preview.reactivates.length
        ) {
          throw new Error(
            "재활성 처리 건수가 미리보기와 일치하지 않습니다."
          );
        }

        const completedAt =
          new Date();

        await tx
          .update(
            practiceMasterSyncHistory
          )
          .set({
            status: "completed",

            insertCount:
              insertedCount,

            updateCount:
              updatedCount,

            deactivateCount:
              deactivatedCount,

            reactivateCount:
              reactivatedCount,

            errorJson: null,

            completedAt,
          } as any)
          .where(
            eq(
              practiceMasterSyncHistory.id,
              syncHistoryId
            )
          );

        return {
          ok: true,

          syncHistoryId,

          dataType:
            preview.dataType,

          unchangedCount:
            preview.unchanged.length,

          insertCount:
            insertedCount,

          updateCount:
            updatedCount,

          deactivateCount:
            deactivatedCount,

          reactivateCount:
            reactivatedCount,

          completedAt,
        };
      }
    );

    return result;
  } catch (error: any) {
    const current =
      await getPracticeMasterSyncHistoryById(
        syncHistoryId
      );

    if (
      current &&
      String(current.status) !==
        "completed"
    ) {
      await updatePracticeMasterSyncHistory({
        id: syncHistoryId,

        status: "failed",

        errorJson: {
          message:
            error?.message ||
            "공용 실습 데이터 동기화 실행 중 오류가 발생했습니다.",

          failedAt:
            new Date().toISOString(),

          actorUserId,
        },

        completedAt: new Date(),
      });
    }

    throw error;
  }
}