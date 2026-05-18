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
} from "../drizzle/schema";

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

  return db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.id));
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
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.insert(brandingSettings).values({
    organizationId: input.organizationId,
    companyName: input.companyName,
    messengerSubtitle: "사내 메신저",
    createdBy: input.actorUserId ?? null,
    updatedBy: input.actorUserId ?? null,
  } as any);

  await db.insert(smsSettings).values({
    organizationId: input.organizationId,
    provider: "aligo",
    isActive: false,
  } as any);

  return { ok: true };
}

export async function assignUserToOrganization(input: {
  userId: number;
  organizationId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(users)
    .set({
      organizationId: input.organizationId,
    } as any)
    .where(eq(users.id, input.userId));

  return { ok: true };
}

export async function getOrganizationUsageStats(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [rows] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM users WHERE organizationId = ${organizationId}) as userCount,
      (SELECT COUNT(*) FROM lead_forms WHERE organizationId = ${organizationId}) as landingFormCount,
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

  return {
    organization: org,
    usage,
    limits: {
  maxUsers: Number((org as any).maxUsers || 0),
  maxLandingForms: Number((org as any).maxLandingForms || 0),
  maxSmsPerMonth: Number((org as any).maxSmsPerMonth || 0),
  maxStorageMb: Number((org as any).maxStorageMb || 0),
},
    exceeded: {
  users:
    Number((org as any).maxUsers || 0) > 0 &&
    Number(usage.userCount || 0) >= Number((org as any).maxUsers || 0),

  landingForms:
    Number((org as any).maxLandingForms || 0) > 0 &&
    Number(usage.landingFormCount || 0) >=
      Number((org as any).maxLandingForms || 0),

  storage:
    Number((org as any).maxStorageMb || 0) > 0 &&
    Number(usage.storageUsedBytes || 0) >=
      Number((org as any).maxStorageMb || 0) * 1024 * 1024,
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