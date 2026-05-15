import { eq, and, or, sql, desc, like, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
users,
organizations,
consultations,
  InsertConsultation,
  students,
  InsertStudent,
  semesters,
  InsertSemester,
  plans,
  InsertPlan,
  refunds,
  InsertRefund,
  leadForms,
  InsertLeadForm,
  formBlueprints,
  InsertFormBlueprint,
  planSemesters,
  InsertPlanSemester,
  transferSubjects,
  InsertTransferSubject,
  educationInstitutions,
  educationInstitutionPositionRates,
  type InsertEducationInstitutionPositionRate,
  transferAttachments,
  InsertTransferAttachment,
  courseSubjectTemplates,
  InsertCourseSubjectTemplate,
  privateCertificateMasters,
  InsertPrivateCertificateMaster,
  subjectCatalogs,
  InsertSubjectCatalog,
  subjectCatalogItems,
  InsertSubjectCatalogItem,
  privateCertificateRequests,
  InsertPrivateCertificateRequest,
  practiceSupportRequests,
  InsertPracticeSupportRequest,
settlementItems,
settlementItemLogs,
settlementGrades,
settlementRules,
settlementRuleGroups,
practiceListCategories,
InsertPracticeListCategory,
  practiceInstitutions,
  InsertPracticeInstitution,
  jobSupportRequests,
  InsertJobSupportRequest,
practiceEducationCenters,
  InsertPracticeEducationCenter,
  notifications,
  InsertNotification,
deviceTokens,
  InsertDeviceToken,
aiActionLogs,
 teams,
  type InsertTeam,
  positions,
  type InsertPosition,
  userOrgMappings,
  type InsertUserOrgMapping,
  chatRooms,
  type InsertChatRoom,
  chatRoomMembers,
  type InsertChatRoomMember,
    chatMessages,
  type InsertChatMessage,
  chatAttachments,
  type InsertChatAttachment,
  chatRoomSettings,
attendanceRecords,
  type InsertAttendanceRecord,
attendanceAdjustmentLogs,
type InsertAttendanceAdjustmentLog,
attendancePolicies,
notices, InsertNotice,
schedules,
InsertSchedule,
approvalPrintSettings,
type InsertApprovalPrintSetting,
approvalDocuments,
type InsertApprovalDocument,
approvalDocumentLines,
type InsertApprovalDocumentLine,
approvalSettings,
type InsertApprovalSetting,
approvalLogs,
brandingSettings,
type InsertBrandingSetting,
smsSettings,
type InsertSmsSetting,
smsLogs,
type InsertSmsLog,
type InsertApprovalLog,
organizationBackups,
type InsertOrganizationBackup,
auditLogs,
type InsertAuditLog,
} from "../drizzle/schema";

import { ENV } from "./_core/env";
import bcrypt from "bcryptjs";
import { emitLiveNotification } from "./_core/live-notifications";

import { FEATURE_FLAGS } from "./_core/featureFlags";


async function geocodeAddressServer(address: string) {
  const restKey =
    process.env.KAKAO_REST_API_KEY ||
    (ENV as any)?.KAKAO_REST_API_KEY ||
    "";

  if (!restKey) {
    throw new Error("KAKAO_REST_API_KEY가 설정되지 않았습니다.");
  }

  const url =
    "https://dapi.kakao.com/v2/local/search/address.json?query=" +
    encodeURIComponent(address);

  const res = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${restKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`카카오 주소 변환 요청 실패 (${res.status})`);
  }

  const json = await res.json();

  if (!json?.documents?.length) {
    throw new Error("주소 변환 결과가 없습니다.");
  }

  return {
    lat: Number(json.documents[0].y),
    lng: Number(json.documents[0].x),
  };
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    console.log("[DB] DATABASE_URL =", process.env.DATABASE_URL);
    _db = drizzle(process.env.DATABASE_URL);
    const [r] = await _db.execute(
      sql`SELECT DATABASE() as db, @@port as port, @@hostname as host`
    );
    console.log("[DB] CONNECTED:", (r as any)[0]);
  }
  return _db;
}


function requireOrganizationId(value: any) {
  const organizationId = Number(value || 0);

  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    throw new Error("organizationId is required");
  }

  return organizationId;
}

export async function getStudentById(
  studentId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(students)
    .where(
      and(
  eq(students.id, studentId),
  eq(students.organizationId, organizationId),
  sql`${students.deletedAt} IS NULL`
)
    )
    .limit(1);

  return result[0];
}

function getInsertId(result: any) {
  return result?.insertId ?? result?.[0]?.insertId ?? null;
}

function toNumber(v: any) {
  return Number(String(v ?? "0").replace(/,/g, "").trim()) || 0;
}

function toNullableNumber(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseApprovalTimeToDate(dateStr: string, timeStr?: string | null) {
  if (!dateStr || !timeStr) return null;

  const raw = String(timeStr).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hh = Number(match[1]);
  const mm = Number(match[2]);

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  return new Date(`${dateStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);
}

function calcMinutesBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return 0;
  const diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.floor(diff / 60000);
}

function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getNextUserDisplayNo() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [rows] = await db.execute(
    sql`SELECT COALESCE(MAX(displayNo), 0) as maxNo FROM users`
  );

  const maxNo = Number((rows as any)?.[0]?.maxNo || 0);
  return maxNo + 1;
}

export async function getRefundById(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(refunds)
    .where(
      and(
        eq(refunds.id, id),
        eq(refunds.organizationId, organizationId)
      )
    )
    .limit(1);

  return result[0];
}

// ==============================
// AI HELPERS
// ==============================

// AI 액션 로그 저장
export async function createAiActionLog(params: {
organizationId?: number | null;
  userId: number;
  userName: string;
  action: string;
  targetStudentId?: number | null;
  targetStudentName?: string | null;
  payload?: any;
}) {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(aiActionLogs).values({
organizationId: requireOrganizationId(params.organizationId),
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      targetStudentId: params.targetStudentId ?? null,
      targetStudentName: params.targetStudentName ?? null,
      payload: params.payload ? JSON.stringify(params.payload) : null,
    } as any);
  } catch (e) {
    console.error("[AI LOG ERROR]", e);
  }
}

export async function createAuditLog(
  input: Omit<InsertAuditLog, "id" | "createdAt">
) {
  const db = await getDb();
  if (!db) return null;

  const result: any = await db.insert(auditLogs).values(input as any);
  return getInsertId(result);
}

export async function listAuditLogs(params: {
  organizationId?: number | null;
  isSuperhost?: boolean;
  action?: string | null;
  actorUserId?: number | null;
  targetType?: string | null;
  limit?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const limit = Math.min(Math.max(Number(params.limit || 100), 1), 300);

  const conditions: any[] = [];

  if (!params.isSuperhost) {
    const organizationId = requireOrganizationId(params.organizationId);
    conditions.push(eq(auditLogs.organizationId, organizationId));
  } else if (params.organizationId) {
    conditions.push(eq(auditLogs.organizationId, Number(params.organizationId)));
  }

  if (params.action?.trim()) {
    conditions.push(like(auditLogs.action, `%${params.action.trim()}%`));
  }

  if (params.actorUserId) {
    conditions.push(eq(auditLogs.actorUserId, Number(params.actorUserId)));
  }

  if (params.targetType?.trim()) {
    conditions.push(like(auditLogs.targetType, `%${params.targetType.trim()}%`));
  }

  const whereExpr =
    conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select()
    .from(auditLogs)
    .where(whereExpr)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

// ==============================
// ORGANIZATION BACKUPS
// ==============================

export async function createOrganizationBackupRecord(input: {
  organizationId?: number | null;
  requestedBy: number;
  backupType?: "manual" | "auto" | "restore_snapshot";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(input.organizationId);

  const result: any = await db.insert(organizationBackups).values({
    organizationId,
    requestedBy: input.requestedBy,
    backupType: input.backupType || "manual",
    status: "pending",
  } as any);

  return getInsertId(result);
}

export async function listOrganizationBackups(params: {
  organizationId?: number | null;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);
  const limit = Math.min(Math.max(Number(params.limit || 30), 1), 100);

  return db
    .select()
    .from(organizationBackups)
    .where(eq(organizationBackups.organizationId, organizationId))
    .orderBy(desc(organizationBackups.createdAt))
    .limit(limit);
}

export async function getOrganizationBackupById(
  id: number,
  params: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select()
    .from(organizationBackups)
    .where(
      and(
        eq(organizationBackups.id, id),
        eq(organizationBackups.organizationId, organizationId)
      )
    )
    .limit(1);

  return rows[0] || null;
}

export async function markOrganizationBackupCompleted(input: {
  id: number;
  organizationId?: number | null;
  fileUrl?: string | null;
  fileKey?: string | null;
  fileSizeBytes?: number | null;
  tableCount?: number | null;
  rowCount?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(input.organizationId);

  await db
    .update(organizationBackups)
    .set({
      status: "completed",
      fileUrl: input.fileUrl ?? null,
      fileKey: input.fileKey ?? null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      tableCount: input.tableCount ?? null,
      rowCount: input.rowCount ?? null,
      errorMessage: null,
      completedAt: new Date(),
    } as any)
    .where(
      and(
        eq(organizationBackups.id, input.id),
        eq(organizationBackups.organizationId, organizationId)
      )
    );

  return getOrganizationBackupById(input.id, { organizationId });
}

export async function markOrganizationBackupFailed(input: {
  id: number;
  organizationId?: number | null;
  errorMessage: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(input.organizationId);

  await db
    .update(organizationBackups)
    .set({
      status: "failed",
      errorMessage: input.errorMessage || "백업 처리 중 오류가 발생했습니다.",
      completedAt: new Date(),
    } as any)
    .where(
      and(
        eq(organizationBackups.id, input.id),
        eq(organizationBackups.organizationId, organizationId)
      )
    );

  return getOrganizationBackupById(input.id, { organizationId });
}

export async function markOrganizationBackupRestored(input: {
  id: number;
  organizationId?: number | null;
  restoredBy: number;
  restoreReason?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(input.organizationId);

  await db
    .update(organizationBackups)
    .set({
      status: "restored",
      restoredAt: new Date(),
      restoredBy: input.restoredBy,
	restoreReason: input.restoreReason ?? null,
    } as any)
    .where(
      and(
        eq(organizationBackups.id, input.id),
        eq(organizationBackups.organizationId, organizationId)
      )
    );

  return getOrganizationBackupById(input.id, { organizationId });
}

// ==============================
// ORGANIZATION BACKUP EXPORT
// SaaS 전체가 아니라 로그인한 회사 organizationId 데이터만 내보낸다.
// ==============================

const ORGANIZATION_BACKUP_TABLES = [
  "lead_forms",
  "form_blueprints",
  "users",
  "branding_settings",
  "sms_settings",
  "sms_logs",

  "consultations",
  "students",
  "semesters",
  "plans",
  "plan_semesters",
  "transfer_subjects",
  "refunds",

  "education_institutions",
  "education_institution_position_rates",
  "transfer_attachments",
  "course_subject_templates",
  "private_certificate_masters",
  "subject_catalogs",
  "subject_catalog_items",

  "private_certificate_requests",
  "practice_support_requests",
  "practice_list_categories",
  "practice_institutions",
  "practice_education_centers",
  "job_support_requests",

  "chat_rooms",
  "chat_room_members",
  "chat_messages",
  "chat_attachments",
  "chat_room_settings",

  "teams",
  "positions",
  "user_org_mappings",

  "attendance_records",
  "attendance_adjustment_logs",
  "attendance_policies",

  "notices",
  "schedules",

  "approval_documents",
  "approval_document_lines",
  "approval_settings",
  "approval_print_settings",
  "approval_logs",
  "approval_form_field_settings",

  "device_tokens",
  "notifications",

  "ai_action_logs",
  "ai_learning_entries",

  "settlement_grades",
  "settlement_items",
  "settlement_item_logs",
  "settlement_settings",
  "audit_logs",
];

function sanitizeBackupFilePart(value: any) {
  return String(value || "organization")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function exportOrganizationBackupData(params: {
  organizationId?: number | null;
  requestedBy: number;
  actorRole?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params.organizationId);

if (params.actorRole === "superhost") {
  throw new Error("슈퍼호스트는 회사 백업 원문을 생성할 수 없습니다.");
}

  const orgRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const organization = orgRows[0];

  if (!organization) {
    throw new Error("회사를 찾을 수 없습니다.");
  }

  const [columnRows] = await db.execute(sql`
    SELECT TABLE_NAME as tableName
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME = 'organizationId'
  `);

  const orgScopedTables = new Set(
    ((columnRows as any[]) || []).map((row: any) => String(row.tableName))
  );

  const tables: Record<string, any[]> = {};
  let tableCount = 0;
  let rowCount = 0;

  for (const tableName of ORGANIZATION_BACKUP_TABLES) {
    if (!orgScopedTables.has(tableName)) continue;

    const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, "");

    const [rows] = await db.execute(sql.raw(`
      SELECT *
      FROM \`${safeTableName}\`
      WHERE organizationId = ${organizationId}
    `));

    const list = Array.isArray(rows) ? rows : [];

    tables[safeTableName] = list;
    tableCount += 1;
    rowCount += list.length;
  }

  const createdAt = new Date().toISOString();

  const backup = {
    version: 1,
    app: "Edu-CRM",
    backupType: "organization_full",
    createdAt,

    // 복구 시 이 값과 로그인한 host organizationId가 반드시 같아야 함
    organizationId,

    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      businessName: organization.businessName,
      businessNumber: organization.businessNumber,
      planCode: organization.planCode,
      status: organization.status,
    },

    meta: {
      requestedBy: params.requestedBy,
      tableCount,
      rowCount,
    },

    tables,
  };

  const json = JSON.stringify(backup, null, 2);
  const fileSizeBytes = Buffer.byteLength(json, "utf8");

  const slug = sanitizeBackupFilePart((organization as any).slug || organizationId);
  const stamp = createdAt
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");

  return {
    backup,
    json,
    fileName: `edu-crm-backup_${slug}_${stamp}.json`,
    fileSizeBytes,
    tableCount,
    rowCount,
  };
}

export async function restoreOrganizationBackupData(params: {
  organizationId?: number | null;
  backup: any;
  restoredBy: number;
  actorRole?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params.organizationId);

if (params.actorRole === "superhost") {
  throw new Error("슈퍼호스트는 회사 백업 원문을 복구할 수 없습니다.");
}

  const backup = params.backup;

  if (!backup || backup.app !== "Edu-CRM") {
    throw new Error("Edu-CRM 백업 파일이 아닙니다.");
  }

  if (backup.backupType !== "organization_full") {
    throw new Error("지원하지 않는 백업 유형입니다.");
  }

  if (Number(backup.organizationId) !== Number(organizationId)) {
    throw new Error("다른 회사의 백업 파일은 복구할 수 없습니다.");
  }

  const tables = backup.tables || {};
  const tableNames = Object.keys(tables);

  const allowedTables = new Set(ORGANIZATION_BACKUP_TABLES);

  let restoredTableCount = 0;
  let restoredRowCount = 0;

  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);

  try {
    // 1) 기존 organization 데이터 삭제
    // 역순 삭제: 자식 테이블부터 최대한 먼저 삭제
    for (const tableName of [...tableNames].reverse()) {
      if (!allowedTables.has(tableName)) continue;

      const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, "");
      if (!safeTableName) continue;

      await db.execute(sql.raw(`
        DELETE FROM \`${safeTableName}\`
        WHERE organizationId = ${organizationId}
      `));
    }

    // 2) 백업 데이터 재삽입
    for (const tableName of tableNames) {
      if (!allowedTables.has(tableName)) continue;

      const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, "");
      if (!safeTableName) continue;

      const rows = Array.isArray(tables[tableName])
        ? tables[tableName]
        : [];

      if (rows.length === 0) {
        restoredTableCount += 1;
        continue;
      }

      for (const row of rows) {
        const nextRow = {
          ...row,
          organizationId,
        };

        const columns = Object.keys(nextRow).filter((key) =>
          /^[a-zA-Z0-9_]+$/.test(key)
        );

        if (columns.length === 0) continue;

        const columnSql = columns
          .map((column) => `\`${column}\``)
          .join(", ");

        const valueSql = columns
          .map((column) => {
            const value = nextRow[column];

            if (value === null || value === undefined) return "NULL";

            if (typeof value === "number") {
              return String(value);
            }

            if (typeof value === "boolean") {
              return value ? "1" : "0";
            }

            return `'${String(value).replace(/'/g, "''")}'`;
          })
          .join(", ");

        await db.execute(sql.raw(`
          INSERT INTO \`${safeTableName}\` (${columnSql})
          VALUES (${valueSql})
        `));

        restoredRowCount += 1;
      }

      restoredTableCount += 1;
    }
  } finally {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  }

  return {
    success: true,
    restoredTableCount,
    restoredRowCount,
  };
}

export async function getStudentWithCoords(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const student = await getStudent(studentId, {
    organizationId: requireOrganizationId(params?.organizationId),
  });
  if (!student) return null;

  return {
    ...student,
    latitude: student.latitude ? Number(student.latitude) : null,
    longitude: student.longitude ? Number(student.longitude) : null,
  };
}

export async function listActivePracticeInstitutions(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(practiceInstitutions)
    .where(
      and(
        eq(practiceInstitutions.organizationId, organizationId),
        eq(practiceInstitutions.isActive, 1)
      )
    );
}

export async function listActivePracticeEducationCenters(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(practiceEducationCenters)
    .where(
      and(
        eq(practiceEducationCenters.organizationId, organizationId),
        eq(practiceEducationCenters.isActive, 1)
      )
    );
}

export async function getPracticeRecommendationsForStudent(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const organizationId = requireOrganizationId(params?.organizationId);

  const student = await getStudentWithCoords(studentId, {
    organizationId,
  });

  if (!student || !student.latitude || !student.longitude) {
    throw new Error("학생 주소 좌표 없음");
  }

  const institutions = await listActivePracticeInstitutions({
    organizationId,
  });
  const centers = await listActivePracticeEducationCenters({
    organizationId,
  });

  const calc = (list: any[]) =>
    list
      .map((item) => {
        if (!item.latitude || !item.longitude) return null;

        const dist = haversineDistanceKm(
          Number(student.latitude),
          Number(student.longitude),
          Number(item.latitude),
          Number(item.longitude)
        );

        return {
          ...item,
          distanceKm: Number(dist.toFixed(2)),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
      .slice(0, 5);

  return {
    student,
    institutions: calc(institutions),
    educationCenters: calc(centers),
  };
}

export async function fixMissingCoordinates(params: {
  organizationId?: number | null;
  type: "education" | "institution";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const limit = params.limit ?? 100;

const organizationId = requireOrganizationId(params.organizationId);

  const table =
    params.type === "education"
      ? practiceEducationCenters
      : practiceInstitutions;

  const rows = await db
    .select()
    .from(table)
    .where(
  and(
    eq((table as any).organizationId, organizationId),
    sql`(${table.latitude} IS NULL OR ${table.longitude} IS NULL)`
  )
)
    .limit(limit);

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    const address = String(row.address || "").trim();
    if (!address) {
      failed++;
      continue;
    }

    try {
      const geo = await geocodeAddressServer(address);

      await db
        .update(table)
        .set({
          latitude: String(geo.lat),
          longitude: String(geo.lng),
        } as any)
        .where(
  and(
    eq(table.id, row.id),
    eq((table as any).organizationId, organizationId)
  )
);

      success++;
    } catch (e) {
      failed++;
    }
  }

  return {
    total: rows.length,
    success,
    failed,
  };
}

// ==============================
// AI LEARNING
// ==============================

// 학습 데이터 저장
export async function createAiLearningEntry(params: {
organizationId?: number | null;
  userId: number;
  userName: string;
  learningType: string;
  inputText: string;
  normalizedKey?: string;
  payload?: any;
  targetStudentId?: number | null;
  targetStudentName?: string | null;
}) {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
  INSERT INTO ai_learning_entries
  (organizationId, userId, userName, learningType, inputText, normalizedKey, payload, targetStudentId, targetStudentName)
  VALUES (
    ${requireOrganizationId(params.organizationId)},
    ${params.userId},
    ${params.userName},
    ${params.learningType},
    ${params.inputText},
    ${params.normalizedKey ?? null},
    ${params.payload ? JSON.stringify(params.payload) : null},
    ${params.targetStudentId ?? null},
    ${params.targetStudentName ?? null}
  )
`);
}

// 유사 학습 조회
export async function findSimilarAiLearning(params: {
organizationId?: number | null;
  learningType?: string;
  normalizedKey?: string;
  keyword?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT *
    FROM ai_learning_entries
    WHERE 
organizationId = ${requireOrganizationId(params.organizationId)}
AND
      (${params.normalizedKey ?? null} IS NULL OR normalizedKey = ${params.normalizedKey ?? null})
    ORDER BY createdAt DESC
    LIMIT 5
  `);

  return rows as any[];
}


export async function getStudentRegistrationSummary(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();

const organizationId = requireOrganizationId(params?.organizationId);

  if (!db) {
    return {
      status: "",
      startDate: null,
      paymentAmount: 0,
      subjectCount: 0,
      paymentDate: null,
      institution: "",
    };
  }

  const student = await getStudent(studentId, { organizationId });
  if (!student) {
    return {
      status: "",
      startDate: null,
      paymentAmount: 0,
      subjectCount: 0,
      paymentDate: null,
      institution: "",
    };
  }

  const semesterRows = await listSemesters(studentId, { organizationId });

  const actualSemesters = semesterRows
    .filter(
      (s: any) =>
        s.actualStartDate ||
        s.actualInstitution ||
        s.actualSubjectCount ||
        s.actualAmount ||
        s.actualPaymentDate
    )
    .sort((a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder));

  const firstActual = actualSemesters[0];
  const sortedSemesters = [...semesterRows].sort(
    (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
  );
  const lastSemester = sortedSemesters[sortedSemesters.length - 1];

   const [settlementResult] = await db.execute(sql`
  SELECT
    COALESCE(
      SUM(
        CASE
          WHEN settlementStatus = 'confirmed'
           AND revenueType != 'refund'
          THEN grossAmount ELSE 0
        END
      ),
      0
    ) as totalPaid,
    COALESCE(
      SUM(
        CASE
          WHEN revenueType = 'refund'
          THEN ABS(grossAmount) ELSE 0
        END
      ),
      0
    ) as totalRefund
  FROM settlement_items
WHERE studentId = ${studentId}
  AND organizationId = ${organizationId}
`);

const totalPaid = toNumber((settlementResult as any)[0]?.totalPaid);
const totalRefund = toNumber((settlementResult as any)[0]?.totalRefund);
const rawPaymentAmount = totalPaid - totalRefund;

  return {
    status:
      lastSemester?.status === "등록 종료"
        ? "등록 종료"
        : student.status || "등록",
    startDate: firstActual?.actualStartDate || student.startDate || null,
        paymentAmount: Math.max(rawPaymentAmount, 0),
    subjectCount: firstActual?.actualSubjectCount ?? student.subjectCount ?? 0,
    paymentDate: firstActual?.actualPaymentDate || student.paymentDate || null,
    institution: firstActual?.actualInstitution || student.institution || "",
  };
}

// ─── Helper: Asia/Seoul 기준 이번달 범위 ────────────────────────────
function getKSTMonthRange() {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const year = kstNow.getUTCFullYear();
  const month = kstNow.getUTCMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const today = `${year}-${String(month).padStart(2, "0")}-${String(
    kstNow.getUTCDate()
  ).padStart(2, "0")}`;
  return { year, month, monthStart, monthEnd, today };
}

function safeJsonStringify(value: any) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

function parseUiConfigJson(value: any) {
  if (!value) return {};
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

// ─── Form Blueprints ─────────────────────────────────────────────────
export async function listFormBlueprints(
  formType: "landing" | "ad",
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

 const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(formBlueprints)
    .where(
      and(
        eq(formBlueprints.organizationId, organizationId),
        eq(formBlueprints.formType, formType)
      )
    )
    .orderBy(desc(formBlueprints.isDefault), desc(formBlueprints.id));

  return rows.map((row: any) => ({
    ...row,
    uiConfig: parseUiConfigJson(row.uiConfigJson),
  }));
}

export async function getDefaultFormBlueprint(
  formType: "landing" | "ad",
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(formBlueprints)
    .where(
      and(
        eq(formBlueprints.organizationId, organizationId),
        eq(formBlueprints.formType, formType),
        eq(formBlueprints.isDefault, true),
        eq(formBlueprints.isActive, true)
      )
    )
    .orderBy(desc(formBlueprints.id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    uiConfig: parseUiConfigJson(row.uiConfigJson),
  };
}

export async function getFormBlueprintById(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(formBlueprints)
    .where(
      and(
        eq(formBlueprints.id, id),
        eq(formBlueprints.organizationId, organizationId)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    uiConfig: parseUiConfigJson(row.uiConfigJson),
  };
}

export async function createFormBlueprint(input: {
  organizationId?: number | null;
  formType: "landing" | "ad";
  name: string;
  description?: string | null;
  uiConfig: any;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(input.organizationId);

  const exists = await db
    .select()
    .from(formBlueprints)
    .where(
      and(
        eq(formBlueprints.organizationId, organizationId),
        eq(formBlueprints.formType, input.formType),
        eq(formBlueprints.name, input.name.trim())
      )
    )
    .limit(1);

  if (exists[0]) {
    throw new Error("같은 이름의 뼈대가 이미 존재합니다.");
  }

  const result: any = await db.insert(formBlueprints).values({
    organizationId,
    formType: input.formType,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    uiConfigJson: safeJsonStringify(input.uiConfig),
    isActive: true,
    isDefault: false,
    createdBy: input.createdBy,
  } as any);

  const insertedId = Number(getInsertId(result));

  return getFormBlueprintById(insertedId, {
    organizationId,
  });
}

export async function updateFormBlueprint(input: {
  organizationId?: number | null;
  id: number;
  name?: string;
  description?: string | null;
  uiConfig?: any;
  isActive?: boolean;
  isDefault?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(input.organizationId);

  const target = await getFormBlueprintById(input.id, {
    organizationId,
  });

  if (!target) {
    throw new Error("수정할 뼈대를 찾을 수 없습니다.");
  }

  if (input.name && input.name.trim() !== target.name) {
    const exists = await db
      .select()
      .from(formBlueprints)
      .where(
        and(
          eq(formBlueprints.organizationId, organizationId),
          eq(formBlueprints.formType, target.formType),
          eq(formBlueprints.name, input.name.trim())
        )
      )
      .limit(1);

    if (exists[0] && Number(exists[0].id) !== Number(input.id)) {
      throw new Error("같은 이름의 뼈대가 이미 존재합니다.");
    }
  }

  if (input.isDefault === true) {
    await db
      .update(formBlueprints)
      .set({ isDefault: false } as any)
      .where(
        and(
          eq(formBlueprints.organizationId, organizationId),
          eq(formBlueprints.formType, target.formType)
        )
      );
  }

  await db
    .update(formBlueprints)
    .set({
      name: input.name?.trim() || undefined,
      description:
        input.description === undefined
          ? undefined
          : input.description?.trim() || null,
      uiConfigJson:
        input.uiConfig === undefined
          ? undefined
          : safeJsonStringify(input.uiConfig),
      isActive:
        input.isActive === undefined ? undefined : Boolean(input.isActive),
      isDefault:
        input.isDefault === undefined ? undefined : Boolean(input.isDefault),
    } as any)
    .where(
      and(
        eq(formBlueprints.id, input.id),
        eq(formBlueprints.organizationId, organizationId)
      )
    );

  return getFormBlueprintById(input.id, {
    organizationId,
  });
}

export async function deleteFormBlueprint(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  const target = await getFormBlueprintById(id, {
    organizationId,
  });

  if (!target) {
    throw new Error("삭제할 뼈대를 찾을 수 없습니다.");
  }

  await db
    .delete(formBlueprints)
    .where(
      and(
        eq(formBlueprints.id, id),
        eq(formBlueprints.organizationId, organizationId)
      )
    );

  return {
    ok: true,
    id,
  };
}

export async function createLeadFormFromBlueprint(input: {
  organizationId?: number | null;
  blueprintId: number;
  assigneeId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(input.organizationId);

  const blueprint = await getFormBlueprintById(input.blueprintId, {
    organizationId,
  });

  if (!blueprint) {
    throw new Error("뼈대를 찾을 수 없습니다.");
  }

  const token =
    blueprint.formType === "ad"
      ? `ad_${Math.random().toString(36).slice(2, 12)}`
      : `lf_${Math.random().toString(36).slice(2, 12)}`;

  await db.insert(leadForms).values({
    organizationId,
    assigneeId: input.assigneeId,
    token,
    formType: blueprint.formType,
    isActive: true,
    uiConfigJson: safeJsonStringify(blueprint.uiConfig),
    blueprintId: Number(blueprint.id),
    sourceBlueprintName: blueprint.name,
  } as any);

  return { token };
}

// ─── Lead Forms ──────────────────────────────────────────────────────
function getLeadFormTemplateToken(formType: "landing" | "ad") {
  return formType === "ad" ? "__template_ad__" : "__template_landing__";
}

export async function getLeadFormTemplate(
  formType: "landing" | "ad",
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);
  const token = getLeadFormTemplateToken(formType);

  const result = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.formType, formType),
        eq(leadForms.token, token)
      )
    )
    .limit(1);

  return result[0];
}

export async function saveLeadFormTemplate(params: {
  organizationId?: number | null;
  formType: "landing" | "ad";
  actorUserId: number;
  uiConfig: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params.organizationId);

  const token = getLeadFormTemplateToken(params.formType);
  const existing = await getLeadFormTemplate(params.formType, {
    organizationId,
  });

  if (existing) {
    await db
      .update(leadForms)
      .set({
        assigneeId: params.actorUserId,
        isActive: false,
        uiConfigJson: JSON.stringify(params.uiConfig),
      } as any)
      .where(
        and(
          eq(leadForms.id, existing.id),
          eq(leadForms.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db.insert(leadForms).values({
    organizationId,
    assigneeId: params.actorUserId,
    token,
    formType: params.formType,
    isActive: false,
    uiConfigJson: JSON.stringify(params.uiConfig),
  } as any);

  return getInsertId(result);
}

export async function saveNamedLeadFormTemplate(input: {
  organizationId?: number | null;
  formType: "landing" | "ad";
  templateName: string;
  uiConfig: any;
  actorUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(input.organizationId);

  const token = getNamedLeadFormTemplateToken(input.formType, input.templateName);
  const uiConfigJson = safeJsonStringify(input.uiConfig || {});

  const existing = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.token, token)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(leadForms)
      .set({
        uiConfigJson,
        assigneeId: input.actorUserId ?? existing[0].assigneeId ?? 0,
      } as any)
      .where(
        and(
          eq(leadForms.id, existing[0].id),
          eq(leadForms.organizationId, organizationId)
        )
      );

    return {
      ...existing[0],
      organizationId,
      token,
      uiConfigJson,
      assigneeId: input.actorUserId ?? existing[0].assigneeId ?? 0,
    };
  }

  await db.insert(leadForms).values({
    organizationId,
    formType: input.formType,
    token,
    uiConfigJson,
    assigneeId: input.actorUserId ?? 0,
    isActive: false,
  } as any);

  const created = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.token, token)
      )
    )
    .limit(1);

  return created[0];
}

function safeJsonParse(value: any) {
  if (!value) return null;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
const REQUIRED_FORM_FIELD_KEYS = [
  "clientName",
  "phone",
  "finalEducation",
  "desiredCourse",
  "channel",
  "notes",
  "agreed",
];

const DEFAULT_FORM_MAPPING = {
  clientName: "clientName",
  phone: "phone",
  finalEducation: "finalEducation",
  desiredCourse: "desiredCourse",
  channel: "channel",
  notes: "notes",
};

function getFallbackFormUiConfig(formType: "landing" | "ad") {
  return {
    title: "목표를 향한 배움의 길, 위드원 교육이 함께할게요",
    subtitle: "상담은 100% 무료로 진행됩니다.",
    logoUrl: "/images/logo.png",
    heroImageUrl: "",
    primaryColor: "#5fc065",
    submitButtonText: "1:1 맞춤 상담 받기",
    agreementText: "개인정보 수집 및 이용에 동의합니다.",
    layoutType: formType === "ad" ? "bottomSheet" : "card",
    description: "",
    tags: "",
    isPinned: false,
    lastUsedAt: "",
    canvas: {
      enabled: false,
      width: 1080,
      height: 1920,
      backgroundColor: "#ffffff",
      elements: [],
    },
    mapping: DEFAULT_FORM_MAPPING,
    fields: [
      {
        fieldKey: "clientName",
        label: "이름",
        placeholder: "이름",
        required: true,
        hidden: false,
        order: 1,
        type: "text",
      },
      {
        fieldKey: "phone",
        label: "전화번호",
        placeholder: "전화번호",
        required: true,
        hidden: false,
        order: 2,
        type: "phone",
      },
      {
        fieldKey: "finalEducation",
        label: "최종학력",
        placeholder: "최종학력 선택",
        required: true,
        hidden: false,
        order: 3,
        type: "select",
        options: [
          { label: "고등학교 졸업", value: "고등학교 졸업" },
          { label: "전문학사", value: "전문학사" },
          { label: "학사", value: "학사" },
          { label: "석사 이상", value: "석사 이상" },
          { label: "기타", value: "기타" },
        ],
      },
      {
        fieldKey: "desiredCourse",
        label: "희망과정",
        placeholder: "희망과정 선택",
        required: true,
        hidden: false,
        order: 4,
        type: "select",
        options: [
          { label: "사회복지사", value: "사회복지사" },
          { label: "보육교사", value: "보육교사" },
          { label: "평생교육사", value: "평생교육사" },
          { label: "건강가정사", value: "건강가정사" },
          { label: "한국어교원", value: "한국어교원" },
          { label: "청소년지도사", value: "청소년지도사" },
          { label: "산업기사/기사", value: "산업기사/기사" },
          { label: "전문학사/학사", value: "전문학사/학사" },
          { label: "기타", value: "기타" },
        ],
      },
      {
        fieldKey: "channel",
        label: "문의경로",
        placeholder: "문의경로 (예. 블로그, 인스타, 지인추천)",
        required: false,
        hidden: false,
        order: 5,
        type: "text",
      },
      {
        fieldKey: "notes",
        label: "상담내역",
        placeholder: "진행하시면서 걱정되시는 부분 적어주세요!",
        required: false,
        hidden: false,
        order: 6,
        type: "textarea",
      },
      {
        fieldKey: "agreed",
        label: "개인정보 수집 및 이용에 동의합니다.",
        placeholder: "",
        required: true,
        hidden: false,
        order: 7,
        type: "checkbox",
      },
    ],
  };
}

function normalizeFormUiConfigForSave(
  rawConfig: any,
  formType: "landing" | "ad"
) {
  const fallback = getFallbackFormUiConfig(formType);
  const raw = rawConfig && typeof rawConfig === "object" ? rawConfig : {};

  const incomingFields = Array.isArray(raw.fields) ? raw.fields : [];
  const incomingMap = new Map(
    incomingFields.map((field: any) => [String(field.fieldKey || ""), field])
  );

  const mergedFields = fallback.fields.map((defaultField: any) => {
    const saved = incomingMap.get(defaultField.fieldKey) as any;

    if (!saved) return defaultField;

    return {
      ...defaultField,
      ...saved,
      fieldKey: defaultField.fieldKey,
      hidden: false,
      required:
        defaultField.fieldKey === "notes"
          ? Boolean(saved.required ?? defaultField.required)
          : true,
      type: saved.type || defaultField.type,
      options:
        (saved.type || defaultField.type) === "select"
          ? Array.isArray(saved.options) && saved.options.length > 0
            ? saved.options
            : defaultField.options || []
          : undefined,
    };
  });

  const extraFields = incomingFields.filter(
    (field: any) =>
      field?.fieldKey &&
      !REQUIRED_FORM_FIELD_KEYS.includes(String(field.fieldKey))
  );

  return {
    ...fallback,
    ...raw,
    layoutType:
      raw.layoutType === "card" || raw.layoutType === "bottomSheet"
        ? raw.layoutType
        : fallback.layoutType,
    mapping: {
      ...DEFAULT_FORM_MAPPING,
      ...(raw.mapping && typeof raw.mapping === "object" ? raw.mapping : {}),
      ...DEFAULT_FORM_MAPPING,
    },
    fields: [...mergedFields, ...extraFields].sort(
      (a: any, b: any) => Number(a.order || 0) - Number(b.order || 0)
    ),
    canvas: {
      ...fallback.canvas,
      ...(raw.canvas && typeof raw.canvas === "object" ? raw.canvas : {}),
      elements: Array.isArray(raw.canvas?.elements) ? raw.canvas.elements : [],
    },
  };
}

export async function applyNamedLeadFormTemplateToToken(input: {
  organizationId?: number | null;
  formType: "landing" | "ad";
  templateName: string;
  targetToken: string;
  actorUserId: number;
}) {
  const db = await getDb();
const organizationId = requireOrganizationId(input.organizationId);

  const template = await getNamedLeadFormTemplate(
    input.formType,
    input.templateName,
    {
      organizationId,
    }
  );

  if (!template) {
    throw new Error("템플릿을 찾을 수 없습니다.");
  }

  const targetRows = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.token, input.targetToken)
      )
    )
    .limit(1);

  const target = targetRows[0];
  if (!target) {
    throw new Error("대상 폼을 찾을 수 없습니다.");
  }

  if (target.formType !== input.formType) {
    throw new Error("폼 타입이 맞지 않습니다.");
  }

  await updateMyLeadFormUiConfig({
    organizationId,
    token: input.targetToken,
    formType: input.formType,
    userId: input.actorUserId,
    uiConfig: safeJsonParse(template.uiConfigJson),
  } as any);

  const updated = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.token, input.targetToken)
      )
    )
    .limit(1);

  return updated[0];
}


export async function deleteNamedLeadFormTemplate(
  formType: "landing" | "ad",
  templateName: string,
  actorUserId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  const organizationId = requireOrganizationId(params?.organizationId);
  const token = getNamedLeadFormTemplateToken(formType, templateName);

  const existing = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.formType, formType),
        eq(leadForms.token, token)
      )
    )
    .limit(1);

  if (!existing[0]) {
    throw new Error("삭제할 템플릿을 찾을 수 없습니다.");
  }

  if (Number(existing[0].assigneeId) !== Number(actorUserId)) {
    throw new Error("본인 템플릿만 삭제할 수 있습니다.");
  }

  await db.delete(leadForms).where(
    and(
      eq(leadForms.id, existing[0].id),
      eq(leadForms.organizationId, organizationId)
    )
  );

  return {
    ok: true,
    token,
  };
}

export async function renameNamedLeadFormTemplate(input: {
  organizationId?: number | null;
  formType: "landing" | "ad";
  oldTemplateName: string;
  newTemplateName: string;
  actorUserId: number;
}) {
  const dbConn = await getDb();
const organizationId = requireOrganizationId(input.organizationId);

  const oldToken = getNamedLeadFormTemplateToken(
    input.formType,
    input.oldTemplateName
  );

  const newToken = getNamedLeadFormTemplateToken(
    input.formType,
    input.newTemplateName
  );

  if (oldToken === newToken) {
    throw new Error("이전 이름과 새 이름이 같습니다.");
  }

  const existingOld = await dbConn
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.formType, input.formType),
        eq(leadForms.token, oldToken)
      )
    )
    .limit(1);

  if (!existingOld[0]) {
    throw new Error("변경할 템플릿을 찾을 수 없습니다.");
  }

  const existingNew = await dbConn
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.formType, input.formType),
        eq(leadForms.token, newToken)
      )
    )
    .limit(1);

  if (existingNew[0]) {
    throw new Error("같은 이름의 템플릿이 이미 존재합니다.");
  }

  if (Number(existingOld[0].assigneeId) !== Number(input.actorUserId)) {
    throw new Error("본인 템플릿만 이름 변경할 수 있습니다.");
  }

  await dbConn
    .update(leadForms)
    .set({
      token: newToken,
    } as any)
    .where(
      and(
        eq(leadForms.id, existingOld[0].id),
        eq(leadForms.organizationId, organizationId)
      )
    );

  const updated = await dbConn
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.id, existingOld[0].id),
        eq(leadForms.organizationId, organizationId)
      )
    )
    .limit(1);

  return updated[0];
}

export async function duplicateNamedLeadFormTemplate(input: {
  organizationId?: number | null;
  formType: "landing" | "ad";
  sourceTemplateName: string;
  newTemplateName: string;
  actorUserId?: number | null;
}) {
  const dbConn = await getDb();
const organizationId = requireOrganizationId(input.organizationId);

  const sourceToken = getNamedLeadFormTemplateToken(
    input.formType,
    input.sourceTemplateName
  );

  const newToken = getNamedLeadFormTemplateToken(
    input.formType,
    input.newTemplateName
  );

  if (sourceToken === newToken) {
    throw new Error("복제할 새 이름이 기존 이름과 같습니다.");
  }

  const sourceRows = await dbConn
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.formType, input.formType),
        eq(leadForms.token, sourceToken)
      )
    )
    .limit(1);

  const source = sourceRows[0];
  if (!source) {
    throw new Error("복제할 템플릿을 찾을 수 없습니다.");
  }

  if (Number(source.assigneeId) !== Number(input.actorUserId)) {
    throw new Error("본인 템플릿만 복제할 수 있습니다.");
  }

  const existingNew = await dbConn
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.formType, input.formType),
        eq(leadForms.token, newToken)
      )
    )
    .limit(1);

  if (existingNew[0]) {
    throw new Error("같은 이름의 템플릿이 이미 존재합니다.");
  }

  await dbConn.insert(leadForms).values({
    organizationId,
    formType: input.formType,
    token: newToken,
    uiConfigJson: source.uiConfigJson,
    assigneeId: input.actorUserId ?? source.assigneeId ?? 0,
    isActive: false,
  } as any);

  const created = await dbConn
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.formType, input.formType),
        eq(leadForms.token, newToken)
      )
    )
    .limit(1);

  return created[0];
}

export async function getNamedLeadFormTemplate(
  formType: "landing" | "ad",
  templateName: string,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  const organizationId = requireOrganizationId(params?.organizationId);
  const token = getNamedLeadFormTemplateToken(formType, templateName);

  const rows = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.formType, formType),
        eq(leadForms.token, token)
      )
    )
    .limit(1);

  return rows[0] || null;
}

function normalizeTemplateName(templateName: string) {
  return String(templateName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_가-힣-]/g, "");
}

export async function listLeadFormTemplates(
  formType: "landing" | "ad",
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  const organizationId = requireOrganizationId(params?.organizationId);

  const prefix = `__template_${formType}_`;

  const rows = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.formType, formType),
        like(leadForms.token, `${prefix}%`)
      )
    )
    .orderBy(desc(leadForms.id));

  return rows.map((row) => {
    const token = String(row.token || "");
    const name = token
      .replace(`__template_${formType}_`, "")
      .replace(/__$/, "");

    return {
      ...row,
      templateName: name,
    };
  });
}

export function getNamedLeadFormTemplateToken(
  formType: "landing" | "ad",
  templateName: string
) {
  const safeName = normalizeTemplateName(templateName);
  if (!safeName) {
    throw new Error("템플릿 이름이 비어 있습니다.");
  }

  return `__template_${formType}_${safeName}__`;
}

export async function getLeadFormByToken(
  token: string,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.token, token)
      )
    )
    .limit(1);

  return result[0];
}

export async function getPublicFormByToken(
  token: string,
  formType: "landing" | "ad"
) {
  const db = await getDb();
  if (!db) return { ok: false };

  const result = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.token, token),
        eq(leadForms.formType, formType),
        eq(leadForms.isActive, true)
      )
    )
    .limit(1);

  const form = result[0];
  if (!form) return { ok: false };

  const organizationId = requireOrganizationId((form as any).organizationId);

  const userResult = await db
    .select({
      id: users.id,
      organizationId: users.organizationId,
      name: users.name,
      phone: users.phone,
    })
    .from(users)
    .where(
      and(
        eq(users.id, form.assigneeId),
        eq(users.organizationId, organizationId)
      )
    )
    .limit(1);

  const assignee = userResult[0];
  const parsed = form.uiConfigJson ? safeJsonParse(form.uiConfigJson) || {} : {};

  const safeUiConfig = {
    ...parsed,
    mapping:
      parsed && typeof parsed.mapping === "object" && parsed.mapping
        ? parsed.mapping
        : {},
    fields: Array.isArray(parsed?.fields) ? parsed.fields : [],
  };

  return {
    ok: true,
    form,
    assigneeId: form.assigneeId,
    assigneeName: assignee?.name ?? "",
    phone: assignee?.phone ?? "",
    uiConfig: safeUiConfig,
  };
}

export async function updateLeadFormUiConfig(
  id: number,
  uiConfig: any,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(leadForms)
    .set({
      uiConfigJson: safeJsonStringify(
        normalizeFormUiConfigForSave(uiConfig, "landing")
      ),
    } as any)
    .where(
      and(
        eq(leadForms.id, id),
        eq(leadForms.organizationId, organizationId)
      )
    );
}

export async function updateMyLeadFormUiConfig(input: {
  organizationId?: number | null;
  token: string;
  formType: "landing" | "ad";
  userId: number;
  uiConfig: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(input.organizationId);

  const rows = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.token, input.token),
        eq(leadForms.formType, input.formType)
      )
    )
    .limit(1);

  const target = rows[0];
  if (!target) {
    throw new Error("수정할 폼을 찾을 수 없습니다.");
  }

  if (Number(target.assigneeId) !== Number(input.userId)) {
    throw new Error("본인 페이지 외에는 수정할 수 없습니다.");
  }

  await db
    .update(leadForms)
    .set({
      uiConfigJson: safeJsonStringify(
        normalizeFormUiConfigForSave(input.uiConfig, input.formType)
      ),
    } as any)
    .where(
      and(
        eq(leadForms.id, target.id),
        eq(leadForms.organizationId, organizationId)
      )
    );

  return target.id;
}

export async function listLeadForms(
  formType: "landing" | "ad",
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.organizationId, organizationId),
        eq(leadForms.formType, formType),
        sql`${leadForms.token} NOT LIKE '__template%'`
      )
    )
    .orderBy(desc(leadForms.id));
}

export async function createLeadForm(
  assigneeId: number,
  formType: "landing" | "ad",
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  const template = await getLeadFormTemplate(formType, {
    organizationId,
  });

  const token =
    formType === "ad"
      ? `ad_${Math.random().toString(36).slice(2, 12)}`
      : `lf_${Math.random().toString(36).slice(2, 12)}`;

  const fallbackUiConfig = getFallbackFormUiConfig(formType);

  const templateConfig = template?.uiConfigJson
    ? safeJsonParse(template.uiConfigJson)
    : fallbackUiConfig;

  const uiConfigJson = safeJsonStringify(
    normalizeFormUiConfigForSave(templateConfig, formType)
  );

  await db.insert(leadForms).values({
    organizationId,
    assigneeId,
    token,
    formType,
    isActive: true,
    uiConfigJson,
    blueprintId: null,
    sourceBlueprintName: null,
  } as any);

  return { token };
}

export async function updateLeadFormActive(
  id: number,
  isActive: boolean,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(leadForms)
    .set({ isActive } as any)
    .where(
      and(
        eq(leadForms.id, id),
        eq(leadForms.organizationId, organizationId)
      )
    );
}

// ─── Users ───────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const existing = await getUserByOpenId(user.openId);
    const nextDisplayNo = existing?.displayNo ?? (await getNextUserDisplayNo());

    const values: InsertUser = {
      openId: user.openId,
      displayNo: nextDisplayNo,
    };

    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "phone", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      (values as any)[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: users.id,
      displayNo: users.displayNo,
      name: users.name,
      role: users.role,
    })
    .from(users);
}

export async function getAllUsersDetailed(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  let query = db
    .select({
      id: users.id,
      displayNo: users.displayNo,
      organizationId: users.organizationId,
      openId: users.openId,
      username: users.username,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      bankName: users.bankName,
      bankAccount: users.bankAccount,
      isActive: users.isActive,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users);

  if (organizationId > 0) {
    query = query.where(eq(users.organizationId, organizationId)) as any;
  }

  return query.orderBy(users.displayNo, users.id);
}

// ─── Branding Settings ──────────────────────────────────────────────
export async function getBrandingSettings(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(brandingSettings)
    .where(eq(brandingSettings.organizationId, organizationId))
    .limit(1);

  if (!result[0]) {
    return {
      organizationId,
      companyName: "위드원 교육",
      companyLogoUrl: null,
      messengerSubtitle: "사내 메신저",
    };
  }

  return result[0];
}

export async function saveBrandingSettings(
  data: InsertBrandingSetting & {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId((data as any).organizationId);

  const existing = await db
    .select()
    .from(brandingSettings)
    .where(eq(brandingSettings.organizationId, organizationId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(brandingSettings)
      .set({
        companyName: data.companyName,
        companyLogoUrl: data.companyLogoUrl ?? null,
        messengerSubtitle: data.messengerSubtitle,
        updatedBy: data.updatedBy ?? null,
      } as any)
      .where(
        and(
          eq(brandingSettings.id, existing[0].id),
          eq(brandingSettings.organizationId, organizationId)
        )
      );

    return existing[0].id;
  }

  const result: any = await db.insert(brandingSettings).values({
    organizationId,
    companyName: data.companyName,
    companyLogoUrl: data.companyLogoUrl ?? null,
    messengerSubtitle: data.messengerSubtitle,
    createdBy: data.createdBy ?? null,
    updatedBy: data.updatedBy ?? null,
  } as any);

  return getInsertId(result);
}

export async function getSmsSettings(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(smsSettings)
    .where(eq(smsSettings.organizationId, organizationId))
    .orderBy(desc(smsSettings.id))
    .limit(1);

  return rows[0] || null;
}

export async function saveSmsSettings(data: {
  organizationId?: number | null;
  provider?: string;
  apiKey?: string | null;
  apiSecret?: string | null;
  userId?: string | null;
  accessKey?: string | null;
  secretKey?: string | null;
  serviceId?: string | null;
  senderNumber?: string | null;
  senderName?: string | null;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(data.organizationId);

  const existing = await getSmsSettings({
    organizationId,
  });

  const payload = {
    organizationId,
    provider: data.provider || "aligo",
    apiKey: data.apiKey?.trim() || null,
    apiSecret: data.apiSecret?.trim() || null,
    userId: data.userId?.trim() || null,
    accessKey: data.accessKey?.trim() || null,
    secretKey: data.secretKey?.trim() || null,
    serviceId: data.serviceId?.trim() || null,
    senderNumber: data.senderNumber?.replace(/\D/g, "") || null,
    senderName: data.senderName?.trim() || null,
    isActive: data.isActive ?? true,
  };

  if (existing?.id) {
    await db
      .update(smsSettings)
      .set(payload as any)
      .where(
        and(
          eq(smsSettings.id, Number(existing.id)),
          eq(smsSettings.organizationId, organizationId)
        )
      );

    return Number(existing.id);
  }

  const result: any = await db.insert(smsSettings).values(payload as any);
  return getInsertId(result);
}

export async function createSmsLogs(
  rows: Array<
    Omit<InsertSmsLog, "id" | "createdAt"> & {
      organizationId?: number | null;
    }
  >
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (!rows.length) return { success: true, count: 0 };

  const values = rows.map((row) => ({
    organizationId: requireOrganizationId(row.organizationId),
    senderUserId: row.senderUserId ?? null,
    phone: row.phone,
    message: row.message,
    status: row.status ?? "success",
    provider: row.provider ?? null,
  }));

  await db.insert(smsLogs).values(values as any);

  return {
    success: true,
    count: values.length,
  };
}

export async function createUserAccount(data: {
  openId: string;
  username: string;
  passwordHash?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: "staff" | "admin" | "host" | "superhost";
organizationId?: number;
  bankName?: string | null;
  bankAccount?: string | null;
  loginMethod?: string | null;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const displayNo = await getNextUserDisplayNo();

  const result = await db.insert(users).values({
    displayNo,
    openId: data.openId,
    username: data.username,
    passwordHash: data.passwordHash ?? null,
    name: data.name,
    email: data.email ?? null,
    phone: data.phone ?? null,
    role: data.role,
organizationId: data.organizationId ?? 1,
    bankName: data.bankName ?? null,
    bankAccount: data.bankAccount ?? null,
    loginMethod: data.loginMethod ?? "manual",
    isActive: data.isActive ?? true,
  } as any);

  return getInsertId(result);
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;

  const normalizedUsername = username.trim();

  if (!normalizedUsername) return null;

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, normalizedUsername))
    .limit(1);

  return rows[0] ?? null;
}

export async function updateUserAccount(
  id: number,
  data: {
    username?: string;
    passwordHash?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
  },
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  if (!data || Object.keys(data).length === 0) return;

  await db
    .update(users)
    .set(data as any)
    .where(
      and(
        eq(users.id, id),
        eq(users.organizationId, organizationId)
      )
    );
}

export async function updateUserRole(
  id: number,
  role: "staff" | "admin" | "host" | "superhost",
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  // SaaS 기준: superhost도 전체 유저를 보지 않음.
  // 같은 조직 안에서만 superhost 중복 방지.
  if (role === "superhost") {
    const existing = await getAllUsersDetailed({ organizationId });
    const current = existing.find((u: any) => Number(u.id) === Number(id));

    if (!current) {
      throw new Error("유저 없음");
    }

    const count = existing.filter((u: any) => u.role === "superhost").length;

    if (current.role !== "superhost" && count >= 1) {
      throw new Error("해당 조직의 슈퍼호스트는 1명만 가능합니다.");
    }
  }

  await db
    .update(users)
    .set({ role } as any)
    .where(
      and(
        eq(users.id, id),
        eq(users.organizationId, organizationId)
      )
    );
}

export async function updateUserActive(
  id: number,
  isActive: boolean,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(users)
    .set({ isActive } as any)
    .where(
      and(
        eq(users.id, id),
        eq(users.organizationId, organizationId)
      )
    );
}

export async function getUserById(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = Number(params?.organizationId || 0);

  const result = await db
    .select()
    .from(users)
    .where(
      organizationId > 0
        ? and(
            eq(users.id, id),
            eq(users.organizationId, organizationId)
          )
        : eq(users.id, id)
    )
    .limit(1);

  return result[0];
}

// ─── Consultations ───────────────────────────────────────────────────
export async function listConsultations(
  assigneeId?: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  const baseQuery = db
    .select()
    .from(consultations);

  if (assigneeId) {
  return baseQuery
    .where(
      and(
        eq(consultations.organizationId, organizationId),
        eq(consultations.assigneeId, assigneeId),
        sql`${consultations.deletedAt} IS NULL`
      )
    )
    .orderBy(desc(consultations.createdAt));
}

return baseQuery
  .where(
    and(
      eq(consultations.organizationId, organizationId),
      sql`${consultations.deletedAt} IS NULL`
    )
  )
  .orderBy(desc(consultations.createdAt));
}

export async function getConsultation(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(consultations)
    .where(
      and(
  eq(consultations.id, id),
  eq(consultations.organizationId, organizationId),
  sql`${consultations.deletedAt} IS NULL`
)
    )
    .limit(1);

  return result[0];
}

export async function createConsultation(data: InsertConsultation) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(consultations).values(data);
  const insertId = getInsertId(result);

  console.log("[DB] createConsultation insertId:", insertId);
  return insertId;
}

export async function bulkCreateConsultations(dataList: InsertConsultation[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (dataList.length === 0) return [];

  console.log("[DB] bulkCreateConsultations count:", dataList.length);
  console.log(
    "[DB] bulkCreateConsultations first keys:",
    Object.keys((dataList[0] ?? {}) as any)
  );
  console.log("[DB] bulkCreateConsultations first row:", dataList[0]);

  const result = await db.insert(consultations).values(dataList);

  console.log("[DB] bulkCreateConsultations result:", result);
  return result;
}

export async function updateConsultation(
  id: number,
  data: Partial<InsertConsultation>,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  if (!data || Object.keys(data).length === 0) {
    console.log("[DB] updateConsultation skip (empty):", id);
    return;
  }

  console.log("[DB] updateConsultation id:", id);
  console.log("[DB] updateConsultation keys:", Object.keys(data as any));
  console.log("[DB] updateConsultation data:", data);

  await db
    .update(consultations)
    .set(data)
    .where(
      and(
        eq(consultations.id, id),
        eq(consultations.organizationId, organizationId)
      )
    );

  console.log("[DB] updateConsultation OK:", id);
}

export async function deleteConsultation(
  id: number,
  params?: {
    organizationId?: number | null;
    deletedBy?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);
  const deletedBy = params?.deletedBy ? Number(params.deletedBy) : null;
  const now = new Date();

  const linkedStudents = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.consultationId, id),
        eq(students.organizationId, organizationId),
        sql`${students.deletedAt} IS NULL`
      )
    );

  for (const row of linkedStudents) {
    await softDeleteStudent(Number(row.id), {
      organizationId,
      deletedBy,
    });
  }

  await db
    .update(consultations)
    .set({
      deletedAt: now,
      deletedBy,
    } as any)
    .where(
      and(
        eq(consultations.id, id),
        eq(consultations.organizationId, organizationId),
        sql`${consultations.deletedAt} IS NULL`
      )
    );
}

export async function listDeletedConsultations(params?: {
  organizationId?: number | null;
  limit?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);
  const limit = Math.min(Math.max(Number(params?.limit || 100), 1), 300);

  return db
    .select()
    .from(consultations)
    .where(
      and(
        eq(consultations.organizationId, organizationId),
        sql`${consultations.deletedAt} IS NOT NULL`
      )
    )
    .orderBy(desc(consultations.deletedAt))
    .limit(limit);
}

export async function restoreConsultation(params: {
  id: number;
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params.organizationId);

  await db
    .update(consultations)
    .set({
      deletedAt: null,
      deletedBy: null,
    } as any)
    .where(
      and(
        eq(consultations.id, params.id),
        eq(consultations.organizationId, organizationId),
        sql`${consultations.deletedAt} IS NOT NULL`
      )
    );

  await db
    .update(students)
    .set({
      deletedAt: null,
      deletedBy: null,
    } as any)
    .where(
      and(
        eq(students.consultationId, params.id),
        eq(students.organizationId, organizationId),
        sql`${students.deletedAt} IS NOT NULL`
      )
    );
}

export async function softDeleteStudent(
  id: number,
  params?: {
    organizationId?: number | null;
    deletedBy?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);
  const deletedBy = params?.deletedBy ? Number(params.deletedBy) : null;

  await db
    .update(students)
    .set({
      deletedAt: new Date(),
      deletedBy,
    } as any)
    .where(
      and(
        eq(students.id, id),
        eq(students.organizationId, organizationId),
        sql`${students.deletedAt} IS NULL`
      )
    );
}

export async function getStudentByConsultationId(
  consultationId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(students)
    .where(
      and(
  eq(students.consultationId, consultationId),
  eq(students.organizationId, organizationId),
  sql`${students.deletedAt} IS NULL`
)
    )
    .limit(1);

  return result[0];
}

export async function syncStudentFromConsultation(
  consultationId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  const consultation = await getConsultation(consultationId, {
    organizationId,
  });

  if (!consultation) {
    throw new Error("상담 기록을 찾을 수 없습니다.");
  }

  const linkedStudent = await getStudentByConsultationId(consultationId, {
    organizationId,
  });

  if (!linkedStudent) {
    console.log(
      "[syncStudentFromConsultation] linked student not found:",
      consultationId
    );
    return null;
  }

  const nextStudentData: any = {
    clientName: consultation.clientName ?? "",
    phone: consultation.phone ?? "",
    finalEducation: consultation.finalEducation ?? "",
    course: consultation.desiredCourse ?? "",
    assigneeId: consultation.assigneeId ?? linkedStudent.assigneeId,
  };

  console.log(
    "[syncStudentFromConsultation] consultationId:",
    consultationId,
    "studentId:",
    linkedStudent.id,
    "data:",
    nextStudentData
  );

  await db
    .update(students)
    .set(nextStudentData)
    .where(
      and(
        eq(students.id, linkedStudent.id),
        eq(students.organizationId, organizationId)
      )
    );

  return linkedStudent.id;
}
// ─── Notifications ───────────────────────────────────────────────────
export async function createNotification(data: InsertNotification & {
  title?: string | null;
  level?: "normal" | "important" | "urgent" | "success" | "danger" | null;
  imageUrl?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(notifications).values({
  organizationId: requireOrganizationId((data as any).organizationId),
  type: "lead",
  isRead: false,
  title: data.title ?? null,
  level: data.level ?? "normal",
  imageUrl: data.imageUrl ?? null,
  ...data,
} as any);

  return getInsertId(result);
}

export async function listNotifications(
  userId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.organizationId, organizationId)
      )
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id));
}

export async function createNoticeNotifications(params: {
  organizationId: number;
  noticeId: number;
  actorUserId: number;
  title: string;
  importance?: "normal" | "important" | "urgent";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params.organizationId);

const allUsers = await getAllUsersDetailed({
  organizationId,
});

  const targets = (allUsers || []).filter(
    (u: any) => Number(u.id) !== Number(params.actorUserId) && !!u.isActive
  );

  const prefix =
  params.importance === "urgent"
    ? "[긴급 공지]"
    : params.importance === "important"
    ? "[중요 공지]"
    : "[공지]";

for (const user of targets) {
  await createNotification({
organizationId,
    userId: Number(user.id),
    type: "notice",
    title:
      params.importance === "urgent"
        ? "긴급 공지"
        : params.importance === "important"
        ? "중요 공지"
        : "공지 알림",
    level:
      params.importance === "urgent"
        ? "urgent"
        : params.importance === "important"
        ? "important"
        : "normal",
    message: `${prefix} ${params.title}`,
    relatedId: Number(params.noticeId),
    isRead: false,
  } as any);
}

  return {
    count: targets.length,
  };
}

export async function markNotificationRead(
  id: number,
  userId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(notifications)
    .set({ isRead: true } as any)
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        eq(notifications.organizationId, organizationId)
      )
    );
}

export async function markAllNotificationsRead(
  userId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(notifications)
    .set({ isRead: true } as any)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.organizationId, organizationId)
      )
    );
}

export async function listPendingScheduleNotifications() {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT *
    FROM schedules
    WHERE isActive = 1
      AND isNotified = 0
      AND startAt IS NOT NULL
      AND startAt <= DATE_ADD(NOW(), INTERVAL 10 MINUTE)
      AND startAt > NOW()
      AND organizationId IS NOT NULL
    ORDER BY organizationId ASC, startAt ASC
  `);

  return (rows as any[]) ?? [];
}

export async function markScheduleNotified(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  await db.execute(sql`
    UPDATE schedules
    SET isNotified = 1
    WHERE id = ${id}
      AND organizationId = ${organizationId}
  `);
}

export async function createScheduleNotifications() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const schedules = await listPendingScheduleNotifications();
  if (!schedules.length) {
    return { count: 0 };
  }

  let createdCount = 0;

  for (const item of schedules) {
    const organizationId = requireOrganizationId(item.organizationId);

    const title = String(item.title ?? "일정");
    const message =
      item.scope === "global"
        ? `[전체 일정] ${title} 할 시간입니다.`
        : `[일정 알림] ${title} 할 시간입니다.`;

    if (item.scope === "global") {
      const allUsers = await getAllUsersDetailed({
        organizationId,
      });

      const targets = (allUsers || []).filter((u: any) => !!u.isActive);

      for (const user of targets) {
        const notificationId = await createNotification({
          organizationId,
          userId: Number(user.id),
          type: "schedule",
          title: "전체 일정 알림",
          level: "important",
          message,
          relatedId: Number(item.id),
          isRead: false,
        } as any);

        emitLiveNotification({
          id: Number(notificationId),
          organizationId,
          userId: Number(user.id),
          type: "schedule",
          title: "전체 일정 알림",
          level: "important",
          message,
          relatedId: Number(item.id),
          isRead: false,
        } as any);

        createdCount += 1;
      }
    } else {
      if (item.ownerUserId) {
        const notificationId = await createNotification({
          organizationId,
          userId: Number(item.ownerUserId),
          type: "schedule",
          title: "일정 알림",
          level: "normal",
          message,
          relatedId: Number(item.id),
          isRead: false,
        } as any);

        emitLiveNotification({
          id: Number(notificationId),
          organizationId,
          userId: Number(item.ownerUserId),
          type: "schedule",
          title: "일정 알림",
          level: "normal",
          message,
          relatedId: Number(item.id),
          isRead: false,
        } as any);

        createdCount += 1;
      }
    }

    await markScheduleNotified(Number(item.id), {
      organizationId,
    });
  }

  return { count: createdCount };
}

// ─── Approval Print Settings ─────────────────────────────────────────
export async function getApprovalPrintSettings(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(approvalPrintSettings)
    .where(eq(approvalPrintSettings.organizationId, organizationId))
    .limit(1);

  if (!result[0]) {
    return {
      organizationId,
      companyName: "(주)위드원 교육",
      documentTitle: "전자결재 문서",
      applicantSignLabel: "신청자 서명",
      finalApproverSignLabel: "최종 승인자 서명",
    };
  }

  return result[0];
}

export async function saveApprovalPrintSettings(
  data: InsertApprovalPrintSetting & {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId((data as any).organizationId);

  const existing = await db
    .select()
    .from(approvalPrintSettings)
    .where(eq(approvalPrintSettings.organizationId, organizationId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(approvalPrintSettings)
      .set({
        companyName: data.companyName,
        documentTitle: data.documentTitle,
        applicantSignLabel: data.applicantSignLabel,
        finalApproverSignLabel: data.finalApproverSignLabel,
        updatedBy: data.updatedBy ?? null,
      } as any)
      .where(
        and(
          eq(approvalPrintSettings.id, existing[0].id),
          eq(approvalPrintSettings.organizationId, organizationId)
        )
      );

    return existing[0].id;
  }

  const result: any = await db.insert(approvalPrintSettings).values({
    organizationId,
    companyName: data.companyName,
    documentTitle: data.documentTitle,
    applicantSignLabel: data.applicantSignLabel,
    finalApproverSignLabel: data.finalApproverSignLabel,
    createdBy: data.createdBy ?? null,
    updatedBy: data.updatedBy ?? null,
  } as any);

  return getInsertId(result);
}

// ─── Approval Form Field Settings ─────────────────────────

export async function listApprovalFormFieldSettings(
  formType: string,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
    SELECT *
    FROM approval_form_field_settings
    WHERE organizationId = ${organizationId}
      AND formType = ${formType}
    ORDER BY sortOrder ASC, id ASC
  `);

  return (rows as any[]) ?? [];
}

export async function saveApprovalFormFieldSettings(params: {
  organizationId?: number | null;
  formType: string;
  items: any[];
  actorUserId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params.organizationId);

  await db.execute(sql`
    DELETE FROM approval_form_field_settings
    WHERE organizationId = ${organizationId}
      AND formType = ${params.formType}
  `);

  for (const item of params.items || []) {
    await db.execute(sql`
      INSERT INTO approval_form_field_settings
      (
        organizationId,
        formType,
        fieldKey,
        label,
        isVisible,
        isRequired,
        sortOrder,
        createdBy,
        updatedBy
      )
      VALUES (
        ${organizationId},
        ${params.formType},
        ${item.fieldKey},
        ${item.label},
        ${item.isVisible ? 1 : 0},
        ${item.isRequired ? 1 : 0},
        ${item.sortOrder || 0},
        ${params.actorUserId ?? null},
        ${params.actorUserId ?? null}
      )
    `);
  }

  return true;
}

// ─── Device Tokens ───────────────────────────────────────────────────
export async function upsertDeviceToken(data: {
  organizationId?: number | null;
  userId: number;
  platform: string;
  expoPushToken: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(data.organizationId);

  const existing = await db
    .select()
    .from(deviceTokens)
    .where(
      and(
        eq(deviceTokens.organizationId, organizationId),
        eq(deviceTokens.userId, data.userId),
        eq(deviceTokens.expoPushToken, data.expoPushToken)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(deviceTokens)
      .set({
        platform: data.platform,
        isActive: true,
      } as any)
      .where(
        and(
          eq(deviceTokens.id, existing[0].id),
          eq(deviceTokens.organizationId, organizationId)
        )
      );

    return existing[0].id;
  }

  const result: any = await db.insert(deviceTokens).values({
    organizationId,
    userId: data.userId,
    platform: data.platform,
    expoPushToken: data.expoPushToken,
    isActive: true,
  } as any);

  return getInsertId(result);
}

export async function listActiveDeviceTokensByUserId(
  userId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(deviceTokens)
    .where(
      and(
        eq(deviceTokens.organizationId, organizationId),
        eq(deviceTokens.userId, userId),
        eq(deviceTokens.isActive, true)
      )
    )
    .orderBy(desc(deviceTokens.id));
}

export async function listActiveExpoPushTokensByUserId(
  userId: number,
  params?: { organizationId?: number | null }
) {
  const rows = await listActiveDeviceTokensByUserId(userId, {
    organizationId: requireOrganizationId(params?.organizationId),
  });

  return (rows || [])
    .map((row: any) => row.expoPushToken)
    .filter((token: any) => typeof token === "string" && token.trim() !== "");
}

// ─── Students ────────────────────────────────────────────────────────
export async function listStudents(
  assigneeId?: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

const assigneeFilter = assigneeId
  ? sql`WHERE s.organizationId = ${organizationId} AND s.assigneeId = ${assigneeId} AND s.deletedAt IS NULL`
  : sql`WHERE s.organizationId = ${organizationId} AND s.deletedAt IS NULL`;

  const [rows] = await db.execute(sql`
  SELECT s.*,
    COALESCE(
      (SELECT SUM(sem.plannedAmount)
       FROM semesters sem
       WHERE sem.studentId = s.id),
      0
    ) as totalRequired,

    COALESCE(
      (SELECT SUM(sem2.actualAmount)
       FROM semesters sem2
       WHERE sem2.studentId = s.id
         AND sem2.isCompleted = true),
      0
    ) as paidAmount,

    COALESCE(
      (SELECT SUM(r.refundAmount)
       FROM refunds r
       WHERE r.studentId = s.id
         AND r.approvalStatus = '승인'),
      0
    ) as approvedRefundAmount,

    (
      COALESCE(
        (SELECT SUM(sem2.actualAmount)
         FROM semesters sem2
         WHERE sem2.studentId = s.id
           AND sem2.isCompleted = true),
        0
      )
      -
      COALESCE(
        (SELECT SUM(r.refundAmount)
         FROM refunds r
         WHERE r.studentId = s.id
           AND r.approvalStatus = '승인'),
        0
      )
    ) as netPaidAmount,

    (
      SELECT sem3.actualStartDate
      FROM semesters sem3
      WHERE sem3.studentId = s.id
        AND (
          sem3.actualStartDate IS NOT NULL OR
          sem3.actualInstitutionId IS NOT NULL OR
          sem3.actualSubjectCount IS NOT NULL OR
          sem3.actualAmount IS NOT NULL OR
          sem3.actualPaymentDate IS NOT NULL
        )
      ORDER BY sem3.semesterOrder ASC
      LIMIT 1
    ) as firstActualStartDate,

    (
      SELECT sem4.actualInstitutionId
      FROM semesters sem4
      WHERE sem4.studentId = s.id
        AND (
          sem4.actualStartDate IS NOT NULL OR
          sem4.actualInstitutionId IS NOT NULL OR
          sem4.actualSubjectCount IS NOT NULL OR
          sem4.actualAmount IS NOT NULL OR
          sem4.actualPaymentDate IS NOT NULL
        )
      ORDER BY sem4.semesterOrder ASC
      LIMIT 1
    ) as firstActualInstitutionId,

    (
      SELECT ei.name
      FROM semesters sem5
      LEFT JOIN education_institutions ei
        ON ei.id = sem5.actualInstitutionId
      WHERE sem5.studentId = s.id
        AND (
          sem5.actualStartDate IS NOT NULL OR
          sem5.actualInstitutionId IS NOT NULL OR
          sem5.actualSubjectCount IS NOT NULL OR
          sem5.actualAmount IS NOT NULL OR
          sem5.actualPaymentDate IS NOT NULL
        )
      ORDER BY sem5.semesterOrder ASC
      LIMIT 1
    ) as firstActualInstitutionName,

    (
      SELECT sem6.actualPaymentDate
      FROM semesters sem6
      WHERE sem6.studentId = s.id
        AND (
          sem6.actualStartDate IS NOT NULL OR
          sem6.actualInstitutionId IS NOT NULL OR
          sem6.actualSubjectCount IS NOT NULL OR
          sem6.actualAmount IS NOT NULL OR
          sem6.actualPaymentDate IS NOT NULL
        )
      ORDER BY sem6.semesterOrder ASC
      LIMIT 1
    ) as firstActualPaymentDate,

    (SELECT p.practiceStatus
 FROM plans p
 WHERE p.studentId = s.id
   AND p.organizationId = s.organizationId
 LIMIT 1) as practiceStatus,

(SELECT p.hasPractice
 FROM plans p
 WHERE p.studentId = s.id
   AND p.organizationId = s.organizationId
 LIMIT 1) as hasPractice,
COALESCE(
  (SELECT COUNT(*)
   FROM semesters semc
   WHERE semc.studentId = s.id
     AND semc.isCompleted = true),
  0
) as completedSemesterCount
  FROM students s
  ${assigneeFilter}
  ORDER BY s.createdAt DESC
`);

return (rows as any[]).map((row: any) => ({
  ...row,
  startDate: row.firstActualStartDate || row.startDate || null,
  institutionId: row.firstActualInstitutionId || row.institutionId || null,
  institution: row.firstActualInstitutionName || row.institution || "",
  paymentDate: row.firstActualPaymentDate || row.paymentDate || null,
}));
}

export async function getStudent(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(students)
    .where(
      and(
  eq(students.id, id),
  eq(students.organizationId, organizationId),
  sql`${students.deletedAt} IS NULL`
)
    )
    .limit(1);

  return result[0];
}

export async function createStudent(data: InsertStudent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.insert(students).values({
  organizationId: requireOrganizationId((data as any).organizationId),
  ...data,
} as any);
  return getInsertId(result);
}

export async function updateStudent(
  id: number,
  data: Partial<InsertStudent>,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(students)
    .set(data)
    .where(
      and(
        eq(students.id, id),
        eq(students.organizationId, organizationId)
      )
    );
}

export async function updateStudentAddressAndCoords(params: {
  organizationId?: number | null;
  studentId: number;
  address?: string | null;
  detailAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(students)
    .set({
      address: params.address ?? null,
      detailAddress: params.detailAddress ?? null,
      latitude:
        params.latitude === null || params.latitude === undefined
          ? null
          : String(params.latitude),
      longitude:
        params.longitude === null || params.longitude === undefined
          ? null
          : String(params.longitude),
      geocodedAt:
        params.latitude !== null &&
        params.latitude !== undefined &&
        params.longitude !== null &&
        params.longitude !== undefined
          ? new Date()
          : null,
    } as any)
    .where(
  and(
    eq(students.id, params.studentId),
    eq(students.organizationId, requireOrganizationId(params.organizationId))
  )
);
}

export async function deleteStudent(
  id: number,
  params?: {
    organizationId?: number | null;
    deletedBy?: number | null;
  }
) {
  return softDeleteStudent(id, {
    organizationId: params?.organizationId,
    deletedBy: params?.deletedBy,
  });
}

export async function deleteStudentCascadeById(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();

const organizationId = requireOrganizationId(params?.organizationId);

  if (!db) throw new Error("DB not available");

  const student = await getStudent(studentId, { organizationId });
  if (!student) return false;

  // 1) semester id 먼저 수집
  const studentSemesters = await db
    .select({ id: semesters.id })
    .from(semesters)
    .where(
  and(
    eq(semesters.studentId, studentId),
    eq(semesters.organizationId, organizationId)
  )
);

  const semesterIds = studentSemesters.map((x: any) => Number(x.id)).filter(Boolean);

  // 2) settlement_items 로그 먼저 삭제
  const studentSettlementRows = await db
    .select({ id: settlementItems.id })
    .from(settlementItems)
    .where(
  and(
    eq(settlementItems.studentId, studentId),
    eq(settlementItems.organizationId, organizationId)
  )
);

  const settlementIds = studentSettlementRows
    .map((x: any) => Number(x.id))
    .filter(Boolean);

  for (const settlementItemId of settlementIds) {
    await db
      .delete(settlementItemLogs)
      .where(eq(settlementItemLogs.settlementItemId, settlementItemId));
  }

  // 3) semester 기반 settlement 로그/정산도 삭제
  for (const semesterId of semesterIds) {
    const semesterSettlementRows = await db
      .select({ id: settlementItems.id })
      .from(settlementItems)
      .where(
        and(
          eq(settlementItems.revenueType, "subject"),
          eq(settlementItems.sourceId, semesterId)
        )
      );

    const semesterSettlementIds = semesterSettlementRows
      .map((x: any) => Number(x.id))
      .filter(Boolean);

    for (const settlementItemId of semesterSettlementIds) {
      await db
        .delete(settlementItemLogs)
        .where(eq(settlementItemLogs.settlementItemId, settlementItemId));
    }

    await db
      .delete(settlementItems)
      .where(
        and(
          eq(settlementItems.revenueType, "subject"),
          eq(settlementItems.sourceId, semesterId)
        )
      );
  }

  // 4) studentId 기준 settlement 삭제
  await db
  .delete(settlementItems)
  .where(
    and(
      eq(settlementItems.studentId, studentId),
      eq(settlementItems.organizationId, organizationId)
    )
  );

  // 5) 실습배정지원 정산/원본 삭제
  const practiceRows = await db
  .select({ id: practiceSupportRequests.id })
  .from(practiceSupportRequests)
  .where(
    and(
      eq(practiceSupportRequests.studentId, studentId),
      eq(practiceSupportRequests.organizationId, organizationId)
    )
  );

for (const row of practiceRows) {
  await deletePracticeSupportRequest(Number(row.id), {
    organizationId,
  });
}

  // 6) 민간자격증 정산/원본 삭제
  const privateCertRows = await db
  .select({ id: privateCertificateRequests.id })
  .from(privateCertificateRequests)
  .where(
    and(
      eq(privateCertificateRequests.studentId, studentId),
      eq(privateCertificateRequests.organizationId, organizationId)
    )
  );

for (const row of privateCertRows) {
  await deletePrivateCertificateRequest(Number(row.id), {
    organizationId,
  });
}

  // 7) 환불 삭제
  await db
  .delete(refunds)
  .where(
    and(
      eq(refunds.studentId, studentId),
      eq(refunds.organizationId, organizationId)
    )
  );

  // 8) 전적대 과목 삭제
  await db
  .delete(transferSubjects)
  .where(
    and(
      eq(transferSubjects.studentId, studentId),
      eq(transferSubjects.organizationId, organizationId)
    )
  );

  // 9) 우리플랜 학기 삭제
  await db
  .delete(planSemesters)
  .where(
    and(
      eq(planSemesters.studentId, studentId),
      eq(planSemesters.organizationId, organizationId)
    )
  );

  // 10) 우리플랜 삭제
  await db
  .delete(plans)
  .where(
    and(
      eq(plans.studentId, studentId),
      eq(plans.organizationId, organizationId)
    )
  );

  // 11) 학기 삭제
  await db
  .delete(semesters)
  .where(
    and(
      eq(semesters.studentId, studentId),
      eq(semesters.organizationId, organizationId)
    )
  );

  // 12) 마지막에 학생 삭제
  await db
  .delete(students)
  .where(
    and(
      eq(students.id, studentId),
      eq(students.organizationId, organizationId)
    )
  );

  return true;
}

// ─── Semesters ───────────────────────────────────────────────────────
export async function listSemesters(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(semesters)
    .where(
      and(
        eq(semesters.studentId, studentId),
        eq(semesters.organizationId, organizationId)
      )
    )
    .orderBy(semesters.semesterOrder);

  return rows.map((row: any) => ({
    ...row,
    registeredCourses: parseJsonArray(row.registeredCoursesJson),
  }));
}

export async function getSemester(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(semesters)
    .where(
      and(
        eq(semesters.id, id),
        eq(semesters.organizationId, organizationId)
      )
    )
    .limit(1);

  const row = result[0];
  if (!row) return undefined;

  return {
    ...row,
    registeredCourses: parseJsonArray((row as any).registeredCoursesJson),
  };
}

export async function createSemester(data: InsertSemester) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  let nextData: any = {
    ...data,
    status: (data as any).status ?? "등록",
    practiceStatus: (data as any).practiceStatus ?? "미섭외",
  };

  if (!(data as any).primaryCourse || !(data as any).registeredCoursesJson) {
    const organizationId = requireOrganizationId((data as any).organizationId);

const student = await getStudent(Number((data as any).studentId), {
  organizationId,
});

    const defaultCourse =
      String((data as any).primaryCourse || student?.course || "").trim() || null;

    nextData.primaryCourse = defaultCourse;
    nextData.registeredCoursesJson = defaultCourse
      ? JSON.stringify([defaultCourse])
      : JSON.stringify([]);
  }

  const result = await db.insert(semesters).values(nextData);
  return getInsertId(result);
}

export async function updateSemester(
  id: number,
  data: Partial<InsertSemester> & {
    registeredCourses?: string[];
  },
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const nextData: any = { ...data };

const organizationId = requireOrganizationId(
  params?.organizationId ?? (data as any).organizationId
);

if ((data as any).approvalStatus !== undefined) {
  nextData.approvalStatus = (data as any).approvalStatus;
}

if ((data as any).approvedAt !== undefined) {
  nextData.approvedAt = (data as any).approvedAt;
}

if ((data as any).rejectedAt !== undefined) {
  nextData.rejectedAt = (data as any).rejectedAt;
}

if ((data as any).isLocked !== undefined) {
  nextData.isLocked = (data as any).isLocked;
}

  if ((data as any).registeredCourses !== undefined) {
    const cleaned = Array.isArray((data as any).registeredCourses)
      ? (data as any).registeredCourses
          .map((x: any) => String(x || "").trim())
          .filter(Boolean)
      : [];

    nextData.registeredCoursesJson = JSON.stringify(cleaned);

    if (!nextData.primaryCourse) {
      nextData.primaryCourse = cleaned[0] || null;
    }
  }

    await db
  .update(semesters)
  .set(nextData)
  .where(
    and(
      eq(semesters.id, id),
      eq(semesters.organizationId, organizationId)
    )
  );

const updatedSemester = await getSemester(id, {
  organizationId,
});
  if (!updatedSemester) return;

  const nextPrimaryCourse =
    String(nextData.primaryCourse || updatedSemester.primaryCourse || "").trim() || null;

  if (!nextPrimaryCourse) return;

  // 1) 학생 대표과정 동기화
await updateStudent(Number(updatedSemester.studentId), {
  course: nextPrimaryCourse,
} as any, {
  organizationId,
});

  // 2) 플랜 요약 희망과정 동기화
  await upsertPlan({
  organizationId,
  studentId: Number(updatedSemester.studentId),
  desiredCourse: nextPrimaryCourse,
} as any);

  // 3) 상담DB 희망과정 동기화
const student = await getStudent(Number(updatedSemester.studentId), {
  organizationId,
});
  if (student?.consultationId) {
    await updateConsultation(
  Number(student.consultationId),
  {
    desiredCourse: nextPrimaryCourse,
  } as any,
  { organizationId }
);
  }

  // 4) 실습배정지원센터 과정 동기화
  const practiceRows = await listPracticeSupportRequestsByStudent(
  Number(updatedSemester.studentId),
  { organizationId }
);

  for (const row of practiceRows || []) {
    await updatePracticeSupportRequest(
  Number(row.id),
  {
    course: nextPrimaryCourse,
  } as any,
  { organizationId }
);
  }
}

function safeJsonArrayString(value: any) {
  if (!Array.isArray(value)) return null;
  return JSON.stringify(
    value
      .map((x) => String(x || "").trim())
      .filter(Boolean)
  );
}

function parseJsonArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((x) => String(x || "").trim()).filter(Boolean);
  }

  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => String(x || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function deleteSemester(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await cancelSettlementItemBySource({
  organizationId,
  revenueType: "subject",
  sourceId: id,
  note: "학기 삭제로 일반과목 정산 취소",
} as any);

  await db
  .delete(semesters)
  .where(
    and(
      eq(semesters.id, id),
      eq(semesters.organizationId, organizationId)
    )
  );
}

// ─── 학기별 전체 리스트 ──────────────────────────────────────────────
export async function listAllSemesters(
  assigneeId?: number,
  plannedMonthFilter?: string
) {
  const db = await getDb();
  if (!db) return [];

 const conditions: any[] = [];
if (assigneeId) conditions.push(sql`s.assigneeId = ${assigneeId}`);
if (plannedMonthFilter) conditions.push(sql`sem.plannedMonth = ${plannedMonthFilter}`);

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    const [rows] = await db.execute(sql`
 SELECT sem.*,
  s.clientName,
  s.phone,
  COALESCE(sem.primaryCourse, s.course) as course,
  s.assigneeId,
  s.status as studentStatus,
  sem.approvalStatus as approvalStatus,
  sem.approvedAt as approvedAt,
  sem.rejectedAt as rejectedAt,
  s.approvalStatus as studentApprovalStatus,
  u.name as assigneeName,

    COALESCE(
      actualEi.name,
      sem.actualInstitution,
      plannedEi.name,
      sem.plannedInstitution,
      '-'
    ) as institutionDisplayName,

    COALESCE(
      actualEi.name,
      sem.actualInstitution,
      '-'
    ) as actualInstitutionDisplayName,

    COALESCE(
      plannedEi.name,
      sem.plannedInstitution,
      '-'
    ) as plannedInstitutionDisplayName,

    COALESCE(
      (SELECT SUM(r.refundAmount)
       FROM refunds r
       WHERE r.studentId = s.id
         AND r.approvalStatus = '승인'),
      0
    ) as approvedRefundAmount,

    (SELECT p.hasPractice FROM plans p WHERE p.studentId = s.id LIMIT 1) as hasPractice,
    (SELECT p.practiceHours FROM plans p WHERE p.studentId = s.id LIMIT 1) as practiceHours,
    sem.practiceStatus as practiceStatus
  FROM semesters sem
  INNER JOIN students s ON sem.studentId = s.id
  LEFT JOIN users u ON u.id = s.assigneeId
  LEFT JOIN education_institutions actualEi
    ON actualEi.id = sem.actualInstitutionId
  LEFT JOIN education_institutions plannedEi
    ON plannedEi.id = sem.plannedInstitutionId
  ${whereClause}
  ORDER BY sem.plannedMonth ASC, s.clientName ASC
`);

    return ((rows as unknown) as any[]).map((row: any) => ({
    ...row,
    institution:
      row.institutionDisplayName ||
      row.actualInstitutionDisplayName ||
      row.plannedInstitutionDisplayName ||
      row.actualInstitution ||
      row.plannedInstitution ||
      "-",
  }));
}

function validatePlanSummaryCounts(data: Partial<InsertPlan>) {
  const totalTheorySubjects = Number(data.totalTheorySubjects ?? 0);
  const requiredMajorCount = Number((data as any).requiredMajorCount ?? 0);
  const electiveMajorCount = Number((data as any).electiveMajorCount ?? 0);
  const liberalCount = Number((data as any).liberalCount ?? 0);
  const generalCount = Number((data as any).generalCount ?? 0);

  const values = [
    totalTheorySubjects,
    requiredMajorCount,
    electiveMajorCount,
    liberalCount,
    generalCount,
  ];

  if (values.some((n) => !Number.isFinite(n) || n < 0)) {
    throw new Error("플랜 과목 수는 0 이상의 숫자만 저장할 수 있습니다.");
  }

  if (!FEATURE_FLAGS.PLAN_REQUIREMENT_ENFORCE) {
    return;
  }

  const sum =
    requiredMajorCount +
    electiveMajorCount +
    liberalCount +
    generalCount;

  if (sum !== totalTheorySubjects) {
    throw new Error(
      `총 이론 과목 수(${totalTheorySubjects})와 분류 합계(${sum})가 일치하지 않습니다.`
    );
  }
}

// ─── Plans ───────────────────────────────────────────────────────────
export async function getPlan(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  console.log("[db.getPlan] db exists =", !!db);

  if (!db) return null;

const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(plans)
    .where(
      and(
        eq(plans.studentId, studentId),
        eq(plans.organizationId, organizationId)
      )
    )
    .limit(1);

  console.log("[db.getPlan] result =", result);

  return result[0] ?? null;
}

export async function upsertPlan(data: InsertPlan) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  validatePlanSummaryCounts(data);

  const existing = await getPlan(data.studentId, {
  organizationId: requireOrganizationId((data as any).organizationId),
});

  if (existing) {
  const organizationId = requireOrganizationId((data as any).organizationId);

  await db
    .update(plans)
    .set(data)
    .where(
      and(
        eq(plans.studentId, data.studentId),
        eq(plans.organizationId, organizationId)
      )
    );

  return existing.id;
} else {
    const result = await db.insert(plans).values(data);
    return getInsertId(result);
  }
}

// ─── Refunds ─────────────────────────────────────────────────────────
export async function listRefunds(
  assigneeId?: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  if (assigneeId) {
    return db
      .select()
      .from(refunds)
      .where(
  and(
    eq(refunds.organizationId, organizationId),
    eq(refunds.assigneeId, assigneeId)
  )
)
      .orderBy(desc(refunds.createdAt));
  }

  return db
  .select()
  .from(refunds)
  .where(eq(refunds.organizationId, organizationId))
  .orderBy(desc(refunds.createdAt));
}

export async function listRefundsByStudent(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(refunds)
    .where(
  and(
    eq(refunds.studentId, studentId),
    eq(refunds.organizationId, organizationId)
  )
)
    .orderBy(desc(refunds.createdAt));
}

export async function listApprovedRefundsByStudent(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(refunds)
   .where(
  and(
    eq(refunds.studentId, studentId),
    eq(refunds.organizationId, organizationId),
    eq(refunds.approvalStatus, "승인")
  )
)
    .orderBy(desc(refunds.createdAt));
}

export async function listPendingRefunds(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
    SELECT
      r.*,
      s.clientName,
      s.phone,
      s.course,
      s.assigneeId,
      u.name as assigneeName,
      sem.semesterOrder,
      sem.actualStartDate,
      sem.plannedMonth
    FROM refunds r
    INNER JOIN students s ON s.id = r.studentId
    LEFT JOIN users u ON u.id = s.assigneeId
    LEFT JOIN semesters sem ON sem.id = r.semesterId
    WHERE r.organizationId = ${organizationId}
      AND s.organizationId = ${organizationId}
      AND r.approvalStatus = '대기'
    ORDER BY r.createdAt DESC
  `);

  return (rows as unknown) as any[];
}

export async function createRefund(data: InsertRefund) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.insert(refunds).values(data);
  return getInsertId(result);
}

export async function updateRefund(
  id: number,
  data: Partial<InsertRefund>,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(refunds)
    .set(data)
    .where(
      and(
        eq(refunds.id, id),
        eq(refunds.organizationId, organizationId)
      )
    );
}

export async function approveRefund(
  id: number,
  approvedBy: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(refunds)
    .set({
      approvalStatus: "승인",
      approvedAt: new Date(),
      rejectedAt: null,
      approvedBy,
    } as any)
    .where(
      and(
        eq(refunds.id, id),
        eq(refunds.organizationId, organizationId)
      )
    );

  const refundRow = await db
    .select()
    .from(refunds)
    .where(
      and(
        eq(refunds.id, id),
        eq(refunds.organizationId, organizationId)
      )
    )
    .limit(1);

  const refund = refundRow[0];
  if (!refund) return;

  if (refund.semesterId) {
    console.log("🔥 [approveRefund] before refundSettlementItemBySource", {
      refundId: id,
      refund,
    });

    await refundSettlementItemBySource({
      organizationId,
      revenueType: "subject",
      sourceId: Number(refund.semesterId),
      refundAmount: refund.refundAmount,
      refundDate: refund.refundDate,
      actorUserId: approvedBy,
      note: "학점은행제 일반과목 환불 승인",
      payload: {
        refundId: Number(refund.id),
        studentId: Number(refund.studentId),
        semesterId: Number(refund.semesterId),
        refundType: refund.refundType ?? null,
      },
    } as any);
  }
}

export async function rejectRefund(
  id: number,
  approvedBy: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(refunds)
    .set({
      approvalStatus: "불승인",
      approvedAt: null,
      rejectedAt: new Date(),
      approvedBy,
    } as any)
    .where(
      and(
        eq(refunds.id, id),
        eq(refunds.organizationId, organizationId)
      )
    );
}

export async function deleteRefund(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .delete(refunds)
    .where(
      and(
        eq(refunds.id, id),
        eq(refunds.organizationId, organizationId)
      )
    );
}

export async function createSettlementItemLog(params: {
  settlementItemId: number;
  actionType: "create" | "recalculate" | "confirm" | "cancel" | "refund" | "manual_edit";
  actorUserId?: number | null;
  note?: string | null;
  payload?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.insert(settlementItemLogs).values({
    settlementItemId: params.settlementItemId,
    actionType: params.actionType,
    actorUserId: params.actorUserId ?? null,
    note: params.note ?? null,
    payload: params.payload ?? null,
  } as any);
}

export async function upsertSettlementItem(params: {
  revenueType: "subject" | "practice_support" | "private_certificate" | "refund";
  sourceId: number;
  studentId: number;
  assigneeId?: number | null;
  freelancerUserId?: number | null;
  freelancerPositionId?: number | null;
  settlementGradeId?: number | null;
  educationInstitutionId?: number | null;
  privateCertificateMasterId?: number | null;
institutionName?: string | null;
  title: string;
  quantity?: number;
  subjectType?: "general" | "face_to_face" | "practice" | "certificate" | "practice_support" | null;
  subjectCount?: number;
  actualUnitPrice?: string | number;
  normalUnitPrice?: string | number;
  institutionUnitCost?: string | number;
  institutionCost?: string | number;
  freelancerUnitAmount?: string | number;
  taxAmount?: string | number;
  finalPayoutAmount?: string | number;
  actualCredits?: number | null;
  settlementCredits?: number | null;
  grossAmount: string | number;
  companyAmount: string | number;
  freelancerAmount: string | number;
  settlementStatus?: "pending" | "confirmed" | "cancelled" | "refunded";
  occurredAt?: string | Date | null;
  note?: string | null;
  actorUserId?: number | null;
  logNote?: string | null;
  payload?: any;
}) {
  console.log("🔥 [upsertSettlementItem] params =", params);

  const db = await getDb();
  if (!db) throw new Error("DB not available");

    const grossAmount = toNumber(params.grossAmount);
  const companyAmount = toNumber(params.companyAmount);
  const freelancerAmount = toNumber(params.freelancerAmount);
  const companyProfit = companyAmount - freelancerAmount;

  const actualUnitPrice = toNumber(params.actualUnitPrice ?? 0);
  const normalUnitPrice = toNumber(params.normalUnitPrice ?? 0);
  const institutionUnitCost = toNumber(params.institutionUnitCost ?? 0);
  const institutionCost = toNumber(params.institutionCost ?? 0);
  const freelancerUnitAmount = toNumber(params.freelancerUnitAmount ?? 0);
  const taxAmount = toNumber(params.taxAmount ?? 0);
  const finalPayoutAmount = toNumber(params.finalPayoutAmount ?? 0);

console.log("최종 결과", {
  companyAmount,
  freelancerAmount,
  taxAmount,
  finalPayoutAmount,
  companyProfit,
});

  const exists = await db
    .select()
    .from(settlementItems)
    .where(
      and(
        eq(settlementItems.revenueType, params.revenueType),
        eq(settlementItems.sourceId, params.sourceId)
      )
    )
    .limit(1);

  if (exists[0]) {
    const item = exists[0];

    await db
      .update(settlementItems)
      .set({
        studentId: params.studentId,
        assigneeId: params.assigneeId ?? null,
        freelancerUserId: params.freelancerUserId ?? null,
        freelancerPositionId: params.freelancerPositionId ?? null,
        settlementGradeId: params.settlementGradeId ?? null,
        educationInstitutionId: params.educationInstitutionId ?? null,
        privateCertificateMasterId: params.privateCertificateMasterId ?? null,
institutionName: params.institutionName ?? null,
        title: params.title,
        quantity: params.quantity ?? 1,
        actualCredits: params.actualCredits ?? null,
        settlementCredits: params.settlementCredits ?? null,
        subjectType: params.subjectType ?? null,
        subjectCount: params.subjectCount ?? 0,
        actualUnitPrice: String(actualUnitPrice),
        normalUnitPrice: String(normalUnitPrice),
        institutionUnitCost: String(institutionUnitCost),
        institutionCost: String(institutionCost),
        freelancerUnitAmount: String(freelancerUnitAmount),
        taxAmount: String(taxAmount),
        finalPayoutAmount: String(finalPayoutAmount),
        grossAmount: String(grossAmount),
        companyAmount: String(companyAmount),
        freelancerAmount: String(freelancerAmount),
        companyProfit: String(companyProfit),
        settlementStatus: params.settlementStatus ?? "confirmed",
        occurredAt: params.occurredAt ?? null,
        note: params.note ?? null,
      } as any)
      .where(eq(settlementItems.id, item.id));

    await createSettlementItemLog({
      settlementItemId: Number(item.id),
      actionType: "recalculate",
      actorUserId: params.actorUserId ?? null,
      note: params.logNote ?? "정산 항목 재계산",
      payload: params.payload ? JSON.stringify(params.payload) : null,
    });

    return { id: Number(item.id), mode: "update" as const };
  }
console.log("🔥 [upsertSettlementItem] before insert");

  const result: any = await db.insert(settlementItems).values({
    revenueType: params.revenueType,
    sourceId: params.sourceId,
    studentId: params.studentId,
    assigneeId: params.assigneeId ?? null,
    freelancerUserId: params.freelancerUserId ?? null,
    freelancerPositionId: params.freelancerPositionId ?? null,
    settlementGradeId: params.settlementGradeId ?? null,
    educationInstitutionId: params.educationInstitutionId ?? null,
    privateCertificateMasterId: params.privateCertificateMasterId ?? null,
institutionName: params.institutionName ?? null,
    title: params.title,
    quantity: params.quantity ?? 1,
    actualCredits: params.actualCredits ?? null,
    settlementCredits: params.settlementCredits ?? null,
    subjectType: params.subjectType ?? null,
    subjectCount: params.subjectCount ?? 0,
    actualUnitPrice: String(actualUnitPrice),
    normalUnitPrice: String(normalUnitPrice),
    institutionUnitCost: String(institutionUnitCost),
    institutionCost: String(institutionCost),
    freelancerUnitAmount: String(freelancerUnitAmount),
    taxAmount: String(taxAmount),
    finalPayoutAmount: String(finalPayoutAmount),
    grossAmount: String(grossAmount),
    companyAmount: String(companyAmount),
    freelancerAmount: String(freelancerAmount),
    companyProfit: String(companyProfit),
    settlementStatus: params.settlementStatus ?? "confirmed",
    occurredAt: params.occurredAt ?? null,
    note: params.note ?? null,
  } as any);

  const insertedId = Number(getInsertId(result));
console.log("🔥 [upsertSettlementItem] insertedId =", insertedId);

  await createSettlementItemLog({
    settlementItemId: insertedId,
    actionType: "create",
    actorUserId: params.actorUserId ?? null,
    note: params.logNote ?? "정산 항목 생성",
    payload: params.payload ? JSON.stringify(params.payload) : null,
  });

  return { id: insertedId, mode: "insert" as const };
}

export async function cancelSettlementItemBySource(params: {
  organizationId?: number | null;
  revenueType: "subject" | "practice_support" | "private_certificate";
  sourceId: number;
  actorUserId?: number | null;
  note?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  const exists = await db
    .select()
    .from(settlementItems)
    .where(
      and(
  eq(settlementItems.organizationId, organizationId),
  eq(settlementItems.revenueType, params.revenueType),
  eq(settlementItems.sourceId, params.sourceId)
)
    )
    .limit(1);

  if (!exists[0]) {
    return null;
  }

  const item = exists[0];

  await db
    .update(settlementItems)
    .set({
      settlementStatus: "cancelled",
    } as any)
    .where(
  and(
    eq(settlementItems.id, item.id),
    eq(settlementItems.organizationId, organizationId)
  )
);

  await createSettlementItemLog({
    settlementItemId: Number(item.id),
    actionType: "cancel",
    actorUserId: params.actorUserId ?? null,
    note: params.note ?? "결제 취소 또는 요청 삭제로 정산 취소",
  });

  return Number(item.id);
}

export async function refundSettlementItemBySource(params: {
  revenueType: "subject" | "practice_support" | "private_certificate" | "refund";
  sourceId: number;
  refundAmount?: number | string | null;
  refundDate?: string | Date | null;
  actorUserId?: number | null;
  note?: string | null;
  payload?: any;
}) {
console.log("🔥 [refundSettlementItemBySource] START", params);
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const exists = await db
    .select()
    .from(settlementItems)
    .where(
      and(
        eq(settlementItems.revenueType, params.revenueType),
        eq(settlementItems.sourceId, params.sourceId),
        or(
          eq(settlementItems.settlementStatus, "confirmed"),
          eq(settlementItems.settlementStatus, "pending")
        )
      )
    )
    .orderBy(desc(settlementItems.id))
    .limit(1);

  if (!exists[0]) {
    return null;
  }

  const baseItem = exists[0];
console.log("🔥 [refundSettlementItemBySource] baseItem =", baseItem);

const baseGrossAmount = toNumber(baseItem.grossAmount);
  const requestedRefundAmount = toNumber(params.refundAmount ?? 0);
 const refundAmount = Math.max(
  0,
  Math.min(requestedRefundAmount || baseGrossAmount, baseGrossAmount)
);

console.log("🔥 [refundSettlementItemBySource] amounts =", {
  baseGrossAmount,
  requestedRefundAmount,
  refundAmount,
});

if (refundAmount <= 0) {
  console.log("🔥 [refundSettlementItemBySource] refundAmount <= 0, return null");
  return null;
}

  const ratio =
    baseGrossAmount > 0 ? Math.min(refundAmount / baseGrossAmount, 1) : 0;

  const refundCompanyAmount = Math.round(toNumber(baseItem.companyAmount) * ratio);
  const refundFreelancerAmount = Math.round(
    toNumber(baseItem.freelancerAmount) * ratio
  );
  const refundTaxAmount = Math.round(toNumber(baseItem.taxAmount) * ratio);
  const refundFinalPayoutAmount = Math.round(
    toNumber(baseItem.finalPayoutAmount) * ratio
  );
  const refundCompanyProfit = Math.round(
    toNumber(baseItem.companyProfit) * ratio
  );

  const refundOccurredAt =
  params.refundDate instanceof Date
    ? params.refundDate
    : params.refundDate
    ? new Date(params.refundDate)
    : new Date();

console.log("🔥 [refundSettlementItemBySource] refundOccurredAt =", refundOccurredAt);

  const refundTitle =
    params.revenueType === "subject"
      ? `${baseItem.title || "일반과목"} 환불`
      : params.revenueType === "practice_support"
      ? `${baseItem.title || "실습배정"} 환불`
      : `${baseItem.title || "민간자격증"} 환불`;


console.log("🔥 [refundSettlementItemBySource] about to call upsertSettlementItem", {
  revenueType: "refund",
  sourceId: Number(params.sourceId),
  studentId: Number(baseItem.studentId),
  refundAmount,
  refundOccurredAt,
  title: refundTitle,
});

 const refundSettlement = await upsertSettlementItem({
  revenueType: "refund" as any,
  sourceId: Number((params.payload as any)?.refundId || params.sourceId),
  studentId: Number(baseItem.studentId),
  assigneeId: toNullableNumber(baseItem.assigneeId),
  freelancerUserId: toNullableNumber(baseItem.freelancerUserId),
  freelancerPositionId: toNullableNumber(baseItem.freelancerPositionId),

  settlementGradeId:
    toNullableNumber(baseItem.settlementGradeId) ??
    1,

  educationInstitutionId: toNullableNumber(baseItem.educationInstitutionId),
  privateCertificateMasterId: toNullableNumber(baseItem.privateCertificateMasterId),
  institutionName: String(baseItem.institutionName || "").trim() || null,

  title: refundTitle,
  quantity: 1,
  subjectType: (baseItem.subjectType as any) ?? null,
  subjectCount: toNullableNumber(baseItem.subjectCount) ?? 0,

  actualCredits: toNullableNumber(baseItem.actualCredits),
  settlementCredits: toNullableNumber(baseItem.settlementCredits),

  actualUnitPrice: toNumber(baseItem.actualUnitPrice),
  normalUnitPrice: toNumber(baseItem.normalUnitPrice),
  institutionUnitCost: toNumber(baseItem.institutionUnitCost),
  institutionCost: refundCompanyAmount + refundFreelancerAmount,
  freelancerUnitAmount: toNumber(baseItem.freelancerUnitAmount),

  grossAmount: -refundAmount,
  companyAmount: -refundCompanyAmount,
  freelancerAmount: -refundFreelancerAmount,
  taxAmount: -refundTaxAmount,
  finalPayoutAmount: -refundFinalPayoutAmount,
  settlementStatus: "confirmed",
  occurredAt: refundOccurredAt,
  note: params.note ?? `${refundTitle} 승인 처리`,
  actorUserId: params.actorUserId ?? null,
  logNote: `${refundTitle} 정산 생성`,
  payload: {
    refundAmount,
    refundRatio: ratio,
    refundDate: refundOccurredAt,
    originalSettlementItemId: Number(baseItem.id),
    originalRevenueType: params.revenueType,
    sourceId: params.sourceId,
    ...(params.payload ?? {}),
  },
});

console.log("🔥 [refundSettlementItemBySource] refundSettlement =", refundSettlement);

const refundSettlementItemId = Number(refundSettlement.id);

  await createSettlementItemLog({
  settlementItemId: refundSettlementItemId,
  actionType: "refund",
  actorUserId: params.actorUserId ?? null,
  note: params.note ?? "환불 정산 항목 생성",
  payload: JSON.stringify({
    refundAmount,
    refundRatio: ratio,
    refundDate: params.refundDate ?? null,
    originalSettlementItemId: Number(baseItem.id),
    originalRevenueType: params.revenueType,
    sourceId: params.sourceId,
    ...(params.payload ?? {}),
  }),
});

  return refundSettlementItemId;
}

export async function syncPrivateCertificateSettlementItemByRequestId(
  requestId: number,
  actorUserId?: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select({
      request: privateCertificateRequests,
      master: privateCertificateMasters,
    })
    .from(privateCertificateRequests)
    .leftJoin(
      privateCertificateMasters,
      eq(privateCertificateRequests.privateCertificateMasterId, privateCertificateMasters.id)
    )
    .where(
  and(
    eq(privateCertificateRequests.id, requestId),
    eq(privateCertificateRequests.organizationId, organizationId)
  )
)
    .limit(1);

  const row = rows[0];
  if (!row?.request) {
    throw new Error("민간자격증 요청 데이터를 찾을 수 없습니다.");
  }

  const request = row.request;
  const master = row.master;

  if (request.paymentStatus !== "결제") {
    await cancelSettlementItemBySource({
  organizationId,
  revenueType: "private_certificate",
  sourceId: Number(request.id),
  actorUserId,
  note: "민간자격증 결제 상태가 결제가 아니어서 정산 취소",
} as any);
    return null;
  }

   const requestFeeAmount = toNumber((request as any).feeAmount ?? 0);
const requestFreelancerInputAmount = toNumber(
  (request as any).freelancerInputAmount ?? 0
);

const masterDefaultFeeAmount = toNumber(
  (master as any)?.defaultFeeAmount ?? 0
);

const masterDefaultCompanyShareAmount = toNumber(
  (master as any)?.defaultCompanyShareAmount ?? 0
);

const masterDefaultFreelancerAmount = toNumber(
  (master as any)?.defaultFreelancerAmount ?? 0
);

const isSettlementEnabled =
  (master as any)?.isSettlementEnabled === undefined
    ? true
    : Boolean((master as any)?.isSettlementEnabled);

// 총매출: 고객 결제금액
const feeAmount =
  requestFeeAmount > 0 ? requestFeeAmount : masterDefaultFeeAmount;

// 우리회사 몫 원금: 민간자격증 회사와 나눈 뒤 우리 회사로 들어오는 금액
// 예: 고객 결제 88,000원 중 우리회사 몫 원금 38,000원
const companyShareAmount =
  masterDefaultCompanyShareAmount > 0
    ? masterDefaultCompanyShareAmount
    : feeAmount;

// 우리회사 몫 실수령: 우리회사 몫 원금에서 3.3% 차감
// 예: 38,000 - 1,254 = 36,746
const companyShareTaxAmount = Math.floor(companyShareAmount * 0.033);
const netCompanyShareAmount = Math.max(
  0,
  companyShareAmount - companyShareTaxAmount
);

const resolvedFreelancerAmount =
  requestFreelancerInputAmount > 0
    ? requestFreelancerInputAmount
    : masterDefaultFreelancerAmount;

// 프리랜서 지급액: 입력 단가 그대로
const freelancerAmount = isSettlementEnabled
  ? Math.max(0, Math.min(companyShareAmount, resolvedFreelancerAmount))
  : 0;

// 정산표에 표시되는 세금: 프리랜서 지급액 기준 3.3%
// 예: 20,000 * 3.3% = 660
const taxAmount = isSettlementEnabled
  ? Math.floor(freelancerAmount * 0.033)
  : 0;

const finalPayoutAmount = Math.max(0, freelancerAmount - taxAmount);

// 정산 원장의 우리회사 몫은 실수령 기준
const companyAmount = netCompanyShareAmount;

// 회사 순이익 = 우리회사 몫 실수령 - 프리랜서 지급액
// 예: 36,746 - 20,000 = 16,746
const companyProfit = Math.max(0, netCompanyShareAmount - freelancerAmount);

  return await upsertSettlementItem({
    revenueType: "private_certificate",
    sourceId: Number(request.id),
    studentId: Number(request.studentId),
    assigneeId: Number((request as any).assigneeId ?? 0) || null,
    privateCertificateMasterId: Number((request as any).privateCertificateMasterId ?? 0) || null,
    title: `${master?.name || "민간자격증"} 결제`,
    quantity: 1,
        grossAmount: feeAmount,
companyAmount,
companyProfit,
freelancerAmount,
taxAmount,
finalPayoutAmount,
settlementStatus: "confirmed",
    occurredAt: (request as any).paidAt ?? (request as any).updatedAt ?? new Date(),
        note: "민간자격증 요청값 및 마스터 기본값 기준으로 자동 생성",
    actorUserId: actorUserId ?? null,
    logNote: "민간자격증 결제 완료 반영",
        payload: {
companyShareAmount,
companyShareTaxAmount,
netCompanyShareAmount,
  requestId: request.id,
  paymentStatus: request.paymentStatus,
  requestFeeAmount,
  requestFreelancerInputAmount,
  feeAmount,
  masterDefaultFeeAmount,
  masterDefaultFreelancerAmount,
  resolvedFreelancerAmount,
  isSettlementEnabled,
  freelancerAmount,
  taxAmount,
  finalPayoutAmount,
  privateCertificateMasterId: (request as any).privateCertificateMasterId ?? null,
companyProfitPreview: companyAmount - freelancerAmount,
},
  });
}

export async function syncPracticeSupportSettlementItemByRequestId(
  requestId: number,
  actorUserId?: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(practiceSupportRequests)
    .where(
  and(
    eq(practiceSupportRequests.id, requestId),
    eq(practiceSupportRequests.organizationId, organizationId)
  )
)
    .limit(1);

  const request = rows[0];
  if (!request) {
    return null;
  }

  if (request.paymentStatus !== "결제") {
    await cancelSettlementItemBySource({
  organizationId,
  revenueType: "practice_support",
      sourceId: Number(request.id),
      actorUserId,
      note: "실습배정지원 결제 상태가 결제가 아니어서 정산 취소",
    });
    return null;
  }

  const feeAmount = toNumber((request as any).feeAmount ?? 0);

  return await upsertSettlementItem({
  organizationId,
  revenueType: "practice_support",
    sourceId: Number(request.id),
    studentId: Number(request.studentId),
    assigneeId: Number((request as any).assigneeId ?? 0) || null,
    title: "실습배정지원 결제",
    quantity: 1,
    grossAmount: feeAmount,
    companyAmount: feeAmount,
    freelancerAmount: 0,
    settlementStatus: "confirmed",
    occurredAt: (request as any).paidAt ?? (request as any).updatedAt ?? new Date(),
    note: "실습배정지원 결제 완료로 자동 생성",
    actorUserId: actorUserId ?? null,
    logNote: "실습배정지원 결제 완료 반영",
    payload: {
      requestId: request.id,
      paymentStatus: request.paymentStatus,
      feeAmount,
    },
  });
}

export async function backfillSettlementItems(
  actorUserId?: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  let subjectProcessed = 0;
  let subjectSuccess = 0;
  let subjectFailed = 0;

  let privateProcessed = 0;
  let privateSuccess = 0;
  let privateFailed = 0;

  let practiceProcessed = 0;
  let practiceSuccess = 0;
  let practiceFailed = 0;

  const errors: string[] = [];

  // 1) 일반과목(semester) 백필
  const semesterRows = await db
  .select({ id: semesters.id })
  .from(semesters)
  .where(eq(semesters.organizationId, organizationId))
  .orderBy(asc(semesters.id));

  for (const row of semesterRows) {
    subjectProcessed += 1;
    try {
      await syncSubjectSettlementItemBySemesterId(
  Number(row.id),
  actorUserId,
  {
    organizationId,
  }
);
      subjectSuccess += 1;
    } catch (err: any) {
      subjectFailed += 1;
      errors.push(
        `[subject][semesterId=${row.id}] ${err?.message || String(err)}`
      );
    }
  }

  // 2) 민간자격증 백필
  const privateRows = await db
  .select({ id: privateCertificateRequests.id })
  .from(privateCertificateRequests)
  .where(eq(privateCertificateRequests.organizationId, organizationId))
  .orderBy(asc(privateCertificateRequests.id));

  for (const row of privateRows) {
    privateProcessed += 1;
    try {
      await syncPrivateCertificateSettlementItemByRequestId(
  Number(row.id),
  actorUserId,
  {
    organizationId,
  }
);
      privateSuccess += 1;
    } catch (err: any) {
      privateFailed += 1;
      errors.push(
        `[private_certificate][requestId=${row.id}] ${err?.message || String(err)}`
      );
    }
  }

  // 3) 실습배정 백필
  const practiceRows = await db
  .select({ id: practiceSupportRequests.id })
  .from(practiceSupportRequests)
  .where(eq(practiceSupportRequests.organizationId, organizationId))
  .orderBy(asc(practiceSupportRequests.id));

  for (const row of practiceRows) {
    practiceProcessed += 1;
    try {
      await syncPracticeSupportSettlementItemByRequestId(
  Number(row.id),
  actorUserId,
  {
    organizationId,
  }
);
      practiceSuccess += 1;
    } catch (err: any) {
      practiceFailed += 1;
      errors.push(
        `[practice_support][requestId=${row.id}] ${err?.message || String(err)}`
      );
    }
  }

  return {
    success: true,
    summary: {
      subject: {
        processed: subjectProcessed,
        success: subjectSuccess,
        failed: subjectFailed,
      },
      privateCertificate: {
        processed: privateProcessed,
        success: privateSuccess,
        failed: privateFailed,
      },
      practiceSupport: {
        processed: practiceProcessed,
        success: practiceSuccess,
        failed: practiceFailed,
      },
      totalProcessed:
        subjectProcessed + privateProcessed + practiceProcessed,
      totalSuccess:
        subjectSuccess + privateSuccess + practiceSuccess,
      totalFailed:
        subjectFailed + privateFailed + practiceFailed,
    },
    errors,
  };
}

export async function syncSubjectSettlementItemBySemesterId(
  semesterId: number,
  actorUserId?: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();

const organizationId = requireOrganizationId(params?.organizationId);

  if (!db) throw new Error("DB not available");

  const sem = await getSemester(semesterId, { organizationId });
  if (!sem) {
    throw new Error("학기 데이터를 찾을 수 없습니다.");
  }

const studentId = Number(sem.studentId);
const student = await getStudent(studentId, { organizationId });

if (!student) {
  const dbStudent = await db
    .select({
      id: students.id,
      clientName: students.clientName,
      assigneeId: students.assigneeId,
    })
    .from(students)
    .where(
  and(
    eq(students.id, studentId),
    eq(students.organizationId, organizationId)
  )
)
    .limit(1);

  throw new Error(
    `[학생조회실패] semesterId=${sem.id}, studentId=${studentId}, directCount=${dbStudent.length}`
  );
}

  const grossAmount = toNumber((sem as any).actualAmount ?? 0);
  const subjectCount = Number((sem as any).actualSubjectCount ?? 0);
  const educationInstitutionId = Number((sem as any).actualInstitutionId ?? 0) || null;
  const occurredAt = (sem as any).actualPaymentDate ?? (sem as any).actualStartDate ?? null;

if ((sem as any).approvalStatus !== "승인") {
  await cancelSettlementItemBySource({
  organizationId,
  revenueType: "subject",
  sourceId: Number(sem.id),
  actorUserId: actorUserId ?? null,
  note: `학기 승인상태가 승인 아님(${(sem as any).approvalStatus || "요청전"})이라 과목 정산 취소`,
});
  return null;
}

  // 실제 결제 완료 전이면 정산 원장 취소
  if (!grossAmount || !subjectCount || !educationInstitutionId || !occurredAt) {
  await cancelSettlementItemBySource({
  organizationId,
  revenueType: "subject",
  sourceId: Number(sem.id),
  actorUserId: actorUserId ?? null,
  note: `학기 실제 결제정보 미완성으로 과목 정산 취소 (grossAmount=${grossAmount}, subjectCount=${subjectCount}, educationInstitutionId=${educationInstitutionId}, occurredAt=${occurredAt})`,
});
  return null;
}

  const institution = await getEducationInstitutionById(educationInstitutionId, {
  organizationId,
});
  if (!institution) {
    throw new Error("교육원 정보를 찾을 수 없습니다.");
  }

  const userOrg = await getUserOrgMapping(Number(student.assigneeId), {
  organizationId,
});
  const positionId = Number(userOrg?.positionId ?? 0) || null;

    let positionUnitAmount = 0;
  if (positionId && educationInstitutionId) {
    const institutionPositionRate = await getEducationInstitutionPositionRate(
  educationInstitutionId,
  positionId,
  { organizationId }
);

    if (institutionPositionRate) {
      positionUnitAmount = toNumber(
        (institutionPositionRate as any).freelancerUnitAmount ?? 0
      );
    } else {
      const position = await getPosition(positionId, {
  organizationId,
});
      positionUnitAmount = toNumber(
        (position as any)?.settlementUnitAmount ?? 0
      );
    }
  } else if (positionId) {
    const position = await getPosition(positionId, { organizationId });
    positionUnitAmount = toNumber(
      (position as any)?.settlementUnitAmount ?? 0
    );
  }

  const normalSubjectPrice = toNumber((institution as any).normalSubjectPrice ?? 75000);
const institutionUnitCost = toNumber((institution as any).unitCostAmount ?? 0);

const actualUnitPrice =
  subjectCount > 0 ? Math.floor(grossAmount / subjectCount) : 0;

const actualCredits = subjectCount * 3;

// ✅ 과목당 금액 기준 학점 계산
let settlementCreditPerSubject = 0;

if (actualUnitPrice >= normalSubjectPrice) {
  // 75,000 이상
  settlementCreditPerSubject = 3;
} else if (actualUnitPrice >= 60000) {
// 60,000 이상
  settlementCreditPerSubject = 2;
} else if (actualUnitPrice >= 45000) {
// 45,000 이상
  settlementCreditPerSubject = 1;
} else {
  // 45,000 미만
  settlementCreditPerSubject = 0;
}

// 총 정산 학점
const settlementCredits = subjectCount * settlementCreditPerSubject;

// 교육원 몫
let institutionCost = 0;

if ((institution as any).settlementType === "credit") {
  // 학점 기준
  institutionCost = institutionUnitCost * actualCredits;
} else if ((institution as any).settlementType === "subject") {
  // 과목 기준
  institutionCost = institutionUnitCost * subjectCount;
} else {
  // fixed 또는 기타값이면 입력값 그대로 1회 반영
  institutionCost = institutionUnitCost;
}

// 교육원 차감 후 우리회사 몫
const companyAmount = Math.max(0, grossAmount - institutionCost);

console.log("정산 디버그", {
  semesterId: sem.id,
  grossAmount,
  subjectCount,
  actualUnitPrice,
  settlementCredits,
  institutionUnitCost,
  institutionCost,
  companyAmount,
});

// 프리랜서 기본 계산값
// 현재는 정산기준 학점(settlementCredits) × 직급 단가(positionUnitAmount)로 계산

const rawFreelancerAmount = settlementCredits * positionUnitAmount;

// ❗ 0학점이면 지급 0
const freelancerAmount =
  settlementCredits <= 0
    ? 0
    : Math.max(0, Math.min(companyAmount, rawFreelancerAmount));

console.log("프리랜서 계산", {
  settlementCredits,
  positionUnitAmount,
  rawFreelancerAmount,
  freelancerAmount,
});

const taxAmount =
  freelancerAmount > 0
    ? Math.floor(freelancerAmount * 0.033)
    : 0;

const finalPayoutAmount = freelancerAmount - taxAmount;

const title = `${student.clientName || "학생"} ${Number(sem.semesterOrder)}학기 일반과목`;

  const result = await upsertSettlementItem({
  organizationId,
    revenueType: "subject",
    sourceId: Number(sem.id),
    studentId: Number(student.id),
    assigneeId: Number(student.assigneeId),
    freelancerUserId: Number(student.assigneeId),
    freelancerPositionId: positionId,
    educationInstitutionId,
institutionName: institution?.name || sem.actualInstitution || null,
    title,
    quantity: subjectCount,
    subjectType: "general",
    subjectCount,
    actualUnitPrice,
    normalUnitPrice: normalSubjectPrice,
    institutionUnitCost,
    institutionCost,
    freelancerUnitAmount: positionUnitAmount,
    taxAmount,
    finalPayoutAmount,
    actualCredits,
    settlementCredits,
    grossAmount,
    companyAmount,
    freelancerAmount,
    occurredAt,
    settlementStatus: "confirmed",
    note: "학점은행제 일반과목 정산 자동 계산",
    actorUserId: actorUserId ?? null,
    logNote: "학점은행제 일반과목 정산 생성/재계산",
    payload: {
  semesterId: Number(sem.id),
  semesterOrder: Number((sem as any).semesterOrder ?? 0),
  studentId: Number(student.id),
  studentName: student.clientName ?? null,
  assigneeId: Number(student.assigneeId),
  positionId,
  educationInstitutionId,
  grossAmount,
  subjectCount,
  actualUnitPrice,
  normalSubjectPrice,
  actualCredits,
  settlementCredits,
  institutionUnitCost,
  institutionCost,
  companyAmount,
  positionUnitAmount,
  rawFreelancerAmount,
  freelancerAmount,
  taxAmount,
  finalPayoutAmount,
},
  });

  return result;
}

// ─── Dashboard Stats ────────────────────────────────────────────────
export async function getDashboardStats(
  assigneeId?: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
const organizationId = requireOrganizationId(params?.organizationId);
  if (!db) {
    return {
      monthConsultationCount: 0,
      monthRegistered: 0,
      todaySales: 0,
      monthSales: 0,
      totalSales: 0,
      todayFirstSales: 0,
      monthFirstSales: 0,
      todaySemesterSales: 0,
      monthSemesterSales: 0,
      monthRefund: 0,
      totalRefund: 0,
      monthApprovedCount: 0,
      monthRejectedCount: 0,
      monthPendingCount: 0,
      totalConsultationCount: 0,
      totalRegisteredCount: 0,
      totalApprovedCount: 0,
      totalRejectedCount: 0,
      totalPendingCount: 0,
    };
  }

  const { monthStart, monthEnd, today } = getKSTMonthRange();
  const todayStart = `${today} 00:00:00`;
  const tomorrow = new Date(`${today}T00:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(
    tomorrow.getMonth() + 1
  ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")} 00:00:00`;

  const assigneeStudentCond = assigneeId
  ? sql`AND s.assigneeId = ${assigneeId}`
  : sql``;

const assigneeConsultCond = assigneeId
  ? sql`AND c.assigneeId = ${assigneeId}`
  : sql``;

const assigneeSettlementCond = assigneeId
  ? sql`AND si.assigneeId = ${assigneeId}`
  : sql``;

const organizationStudentCond = sql`AND s.organizationId = ${organizationId}`;
const organizationConsultCond = sql`AND c.organizationId = ${organizationId}`;
const organizationSettlementCond = sql`AND si.organizationId = ${organizationId}`;

  const [consultRows] = await db.execute(sql`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN c.consultDate >= ${monthStart}
             AND c.consultDate < ${monthEnd}
            THEN 1 ELSE 0
          END
        ),
        0
      ) as monthConsultationCount,
      COUNT(*) as totalConsultationCount
    FROM consultations c
    WHERE 1=1
${organizationConsultCond}
${assigneeConsultCond}
  `);

  const [studentRows] = await db.execute(sql`
  SELECT
    COALESCE(
      SUM(
        CASE
          WHEN sem.approvalStatus = '승인'
           AND sem.approvedAt >= ${monthStart}
           AND sem.approvedAt < ${monthEnd}
          THEN 1 ELSE 0
        END
      ),
      0
    ) as monthRegistered,

    COALESCE(
      SUM(
        CASE
          WHEN sem.approvalStatus = '승인'
           AND sem.approvedAt >= ${monthStart}
           AND sem.approvedAt < ${monthEnd}
          THEN 1 ELSE 0
        END
      ),
      0
    ) as monthApprovedCount,

    COALESCE(
      SUM(
        CASE
          WHEN sem.approvalStatus = '불승인'
           AND sem.rejectedAt >= ${monthStart}
           AND sem.rejectedAt < ${monthEnd}
          THEN 1 ELSE 0
        END
      ),
      0
    ) as monthRejectedCount,

    COALESCE(
      SUM(
        CASE
          WHEN sem.approvalStatus = '대기'
          THEN 1 ELSE 0
        END
      ),
      0
    ) as monthPendingCount,

    COALESCE(
      SUM(CASE WHEN sem.approvalStatus = '승인' THEN 1 ELSE 0 END),
      0
    ) as totalRegisteredCount,

    COALESCE(
      SUM(CASE WHEN sem.approvalStatus = '승인' THEN 1 ELSE 0 END),
      0
    ) as totalApprovedCount,

    COALESCE(
      SUM(CASE WHEN sem.approvalStatus = '불승인' THEN 1 ELSE 0 END),
      0
    ) as totalRejectedCount,

    COALESCE(
      SUM(CASE WHEN sem.approvalStatus = '대기' THEN 1 ELSE 0 END),
      0
    ) as totalPendingCount
  FROM semesters sem
  INNER JOIN students s
    ON s.id = sem.studentId
  WHERE 1=1
${organizationStudentCond}
${assigneeStudentCond}
`);

  const [settlementRows] = await db.execute(sql`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN si.settlementStatus = 'confirmed'
             AND si.occurredAt >= ${today}
             AND si.occurredAt < DATE(${tomorrowStr})
            THEN COALESCE(si.grossAmount, 0)
            ELSE 0
          END
        ),
        0
      ) as todaySales,

      COALESCE(
        SUM(
          CASE
            WHEN si.settlementStatus = 'confirmed'
             AND si.occurredAt >= ${monthStart}
             AND si.occurredAt < ${monthEnd}
            THEN COALESCE(si.grossAmount, 0)
            ELSE 0
          END
        ),
        0
      ) as monthSales,

      COALESCE(
        SUM(
          CASE
            WHEN si.settlementStatus = 'confirmed'
            THEN COALESCE(si.grossAmount, 0)
            ELSE 0
          END
        ),
        0
      ) as totalSales,

      COALESCE(
        SUM(
          CASE
            WHEN si.settlementStatus = 'refunded'
             AND si.updatedAt >= ${monthStart}
             AND si.updatedAt < ${monthEnd}
            THEN COALESCE(si.grossAmount, 0)
            ELSE 0
          END
        ),
        0
      ) as monthRefund,

      COALESCE(
        SUM(
          CASE
            WHEN si.settlementStatus = 'refunded'
            THEN COALESCE(si.grossAmount, 0)
            ELSE 0
          END
        ),
        0
      ) as totalRefund,

      COALESCE(
        SUM(
          CASE
            WHEN si.revenueType = 'subject'
             AND si.settlementStatus = 'confirmed'
             AND si.occurredAt >= ${today}
             AND si.occurredAt < DATE(${tomorrowStr})
            THEN COALESCE(si.grossAmount, 0)
            ELSE 0
          END
        ),
        0
      ) as todaySemesterSales,

      COALESCE(
        SUM(
          CASE
            WHEN si.revenueType = 'subject'
             AND si.settlementStatus = 'confirmed'
             AND si.occurredAt >= ${monthStart}
             AND si.occurredAt < ${monthEnd}
            THEN COALESCE(si.grossAmount, 0)
            ELSE 0
          END
        ),
        0
      ) as monthSemesterSales,

      COALESCE(
        SUM(
          CASE
            WHEN si.revenueType = 'private_certificate'
             AND si.settlementStatus = 'confirmed'
             AND si.occurredAt >= ${today}
             AND si.occurredAt < DATE(${tomorrowStr})
            THEN COALESCE(si.grossAmount, 0)
            ELSE 0
          END
        ),
        0
      ) as todayFirstSales,

      COALESCE(
        SUM(
          CASE
            WHEN si.revenueType = 'private_certificate'
             AND si.settlementStatus = 'confirmed'
             AND si.occurredAt >= ${monthStart}
             AND si.occurredAt < ${monthEnd}
            THEN COALESCE(si.grossAmount, 0)
            ELSE 0
          END
        ),
        0
      ) as monthFirstSales
    FROM settlement_items si
    WHERE 1=1
${organizationSettlementCond}
${assigneeSettlementCond}
  `);

  const consult = (consultRows as any)?.[0] ?? {};
  const student = (studentRows as any)?.[0] ?? {};
  const settlement = (settlementRows as any)?.[0] ?? {};

  return {
    monthConsultationCount: toNumber(consult.monthConsultationCount),
    monthRegistered: toNumber(student.monthRegistered),

    todaySales: toNumber(settlement.todaySales),
    monthSales: toNumber(settlement.monthSales),
    totalSales: toNumber(settlement.totalSales),

    todayFirstSales: toNumber(settlement.todayFirstSales),
    monthFirstSales: toNumber(settlement.monthFirstSales),
    todaySemesterSales: toNumber(settlement.todaySemesterSales),
    monthSemesterSales: toNumber(settlement.monthSemesterSales),

    monthRefund: toNumber(settlement.monthRefund),
    totalRefund: toNumber(settlement.totalRefund),

    monthApprovedCount: toNumber(student.monthApprovedCount),
    monthRejectedCount: toNumber(student.monthRejectedCount),
    monthPendingCount: toNumber(student.monthPendingCount),

    totalConsultationCount: toNumber(consult.totalConsultationCount),
    totalRegisteredCount: toNumber(student.totalRegisteredCount),
    totalApprovedCount: toNumber(student.totalApprovedCount),
    totalRejectedCount: toNumber(student.totalRejectedCount),
    totalPendingCount: toNumber(student.totalPendingCount),
  };
}

// ─── 이번달 매출 엔트리 ──────────────────────────────────────────────
export async function getMonthSalesEntries(
  assigneeId?: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) {
    return {
      entries: [],
      totalCount: 0,
      totalAmount: 0,
    };
  }

  const { monthStart, monthEnd } = getKSTMonthRange();
const organizationId = requireOrganizationId(params?.organizationId);

  const conditions = [
eq(settlementItems.organizationId, organizationId),
  sql`${settlementItems.occurredAt} >= ${monthStart}`,
  sql`${settlementItems.occurredAt} < ${monthEnd}`,
  sql`${settlementItems.settlementStatus} = 'confirmed'`,
];

  if (assigneeId) {
    conditions.push(eq(settlementItems.assigneeId, assigneeId));
  }

  const rows = await db
    .select({
      id: settlementItems.id,
      revenueType: settlementItems.revenueType,
      sourceId: settlementItems.sourceId,
      studentId: settlementItems.studentId,
      assigneeId: settlementItems.assigneeId,
      title: settlementItems.title,
      subjectType: settlementItems.subjectType,
      subjectCount: settlementItems.subjectCount,
      quantity: settlementItems.quantity,
      grossAmount: settlementItems.grossAmount,
      companyAmount: settlementItems.companyAmount,
      freelancerAmount: settlementItems.freelancerAmount,
      taxAmount: settlementItems.taxAmount,
      finalPayoutAmount: settlementItems.finalPayoutAmount,
      settlementStatus: settlementItems.settlementStatus,
      occurredAt: settlementItems.occurredAt,
      note: settlementItems.note,
institutionName: settlementItems.institutionName,
clientName: students.clientName,
phone: students.phone,
course: students.course,
    })
    .from(settlementItems)
    .leftJoin(
  students,
  and(
    eq(settlementItems.studentId, students.id),
    eq(students.organizationId, organizationId)
  )
)
    .where(and(...conditions))
    .orderBy(desc(settlementItems.occurredAt), desc(settlementItems.id));

  const entries = (rows || []).map((r: any) => {
  const isRefund = r.revenueType === "refund";

  return {
    id: Number(r.id),
    settlementItemId: Number(r.id),
    sourceId: Number(r.sourceId),
    studentId: Number(r.studentId || 0),
    assigneeId: Number(r.assigneeId || 0),
    type: isRefund ? "refund" : String(r.revenueType || "unknown"),
    revenueType: r.revenueType,
    settlementStatus: r.settlementStatus,
    title: r.title || "",
    institutionName: r.institutionName || "",
    clientName: r.clientName || "",
    phone: r.phone || "",
    course: r.course || "",
    subjectType: r.subjectType || null,
    subjectCount: Number(r.subjectCount || 0),
    quantity: Number(r.quantity || 0),
    amount: toNumber(r.grossAmount),
    grossAmount: toNumber(r.grossAmount),
    companyAmount: toNumber(r.companyAmount),
    freelancerAmount: toNumber(r.freelancerAmount),
    taxAmount: toNumber(r.taxAmount),
    finalPayoutAmount: toNumber(r.finalPayoutAmount),
    paymentDate: r.occurredAt,
    note: r.note || "",
  };
});

  const totalAmount = entries.reduce(
    (sum: number, x: any) => sum + toNumber(x.amount),
    0
  );

  return {
    entries,
    totalCount: entries.length,
    totalAmount,
  };
}

export async function getSettlementEntries(params: {
  year: number;
  month: number;
  assigneeId?: number;
}) {
  const db = await getDb();
  if (!db) {
    return {
      entries: [],
      totalCount: 0,
      totalAmount: 0,
    };
  }

  const startDate = `${params.year}-${String(params.month).padStart(2, "0")}-01`;
  const nextMonth = params.month === 12 ? 1 : params.month + 1;
  const nextYear = params.month === 12 ? params.year + 1 : params.year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

const prevMonth = params.month === 1 ? 12 : params.month - 1;
const prevYear = params.month === 1 ? params.year - 1 : params.year;
const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
const prevEndDate = startDate;

  const conditions = [
  sql`${settlementItems.occurredAt} >= ${startDate}`,
  sql`${settlementItems.occurredAt} < ${endDate}`,
  sql`${settlementItems.settlementStatus} = 'confirmed'`,
];

  if (params.assigneeId) {
    conditions.push(eq(settlementItems.assigneeId, params.assigneeId));
  }

  const subjectApprovedCondition = or(
    sql`${settlementItems.revenueType} <> 'subject'`,
    and(
      eq(settlementItems.revenueType, "subject"),
      eq(semesters.id, settlementItems.sourceId),
      eq(semesters.approvalStatus, "승인")
    )
  );

  conditions.push(subjectApprovedCondition);

  const rows = await db
    .select({
      id: settlementItems.id,
      revenueType: settlementItems.revenueType,
      sourceId: settlementItems.sourceId,
      studentId: settlementItems.studentId,
      assigneeId: settlementItems.assigneeId,
      title: settlementItems.title,
institutionName: settlementItems.institutionName,
      subjectType: settlementItems.subjectType,
      subjectCount: settlementItems.subjectCount,
      quantity: settlementItems.quantity,
      grossAmount: settlementItems.grossAmount,
      companyAmount: settlementItems.companyAmount,
      freelancerAmount: settlementItems.freelancerAmount,
      taxAmount: settlementItems.taxAmount,
      finalPayoutAmount: settlementItems.finalPayoutAmount,
      companyProfit: settlementItems.companyProfit,
      settlementStatus: settlementItems.settlementStatus,
      occurredAt: settlementItems.occurredAt,
      note: settlementItems.note,
      clientName: students.clientName,
      phone: students.phone,
      course: students.course,
      assigneeName: users.name,
    })
        .from(settlementItems)
    .leftJoin(
      semesters,
      and(
        eq(settlementItems.revenueType, "subject"),
        eq(semesters.id, settlementItems.sourceId)
      )
    )
    .leftJoin(students, eq(settlementItems.studentId, students.id))
    .leftJoin(users, eq(settlementItems.assigneeId, users.id))
    .where(and(...conditions))
    .orderBy(desc(settlementItems.occurredAt), desc(settlementItems.id));

const prevRows = await db
  .select({
    institutionName: settlementItems.institutionName,
    revenueType: settlementItems.revenueType,
    grossAmount: settlementItems.grossAmount,
    companyAmount: settlementItems.companyAmount,
    settlementStatus: settlementItems.settlementStatus,
  })
  .from(settlementItems)
  .where(
    and(
      sql`${settlementItems.occurredAt} >= ${prevStartDate}`,
      sql`${settlementItems.occurredAt} < ${prevEndDate}`,
      sql`${settlementItems.settlementStatus} = 'confirmed'`
    )
  )
  .orderBy(asc(settlementItems.institutionName), desc(settlementItems.occurredAt));

  const entries = (rows || []).map((r: any) => {
  const isRefund = r.revenueType === "refund";

  return {
    id: Number(r.id),
    settlementItemId: Number(r.id),
    sourceId: Number(r.sourceId),
    studentId: Number(r.studentId || 0),
    assigneeId: Number(r.assigneeId || 0),

    type: isRefund ? "refund" : String(r.revenueType || "unknown"),
    revenueType: r.revenueType,
    settlementStatus: r.settlementStatus,

    assigneeName: r.assigneeName || "",
    occurredAt: r.occurredAt || null,

    title: r.title || "",
    institutionName: r.institutionName || "",
    clientName: r.clientName || "",
    phone: r.phone || "",
    course: r.course || "",
    subjectType: r.subjectType || null,
    subjectCount: Number(r.subjectCount || 0),
    quantity: Number(r.quantity || 0),

    amount: toNumber(r.grossAmount),
    grossAmount: toNumber(r.grossAmount),
    companyAmount: toNumber(r.companyAmount),
    freelancerAmount: toNumber(r.freelancerAmount),
    taxAmount: toNumber(r.taxAmount),
    finalPayoutAmount: toNumber(r.finalPayoutAmount),
    companyProfit: toNumber(r.companyProfit),

    paymentDate: r.occurredAt || null,
    note: r.note || "",
  };
});

  const totalAmount = entries.reduce(
    (sum: number, row: any) => sum + toNumber(row.grossAmount),
    0
  );

  return {
    entries,
    totalCount: entries.length,
    totalAmount,
  };
}

export async function getSettlementInstitutionSummary(params: {
  year: number;
  month: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const startDate = `${params.year}-${String(params.month).padStart(2, "0")}-01`;
  const nextMonth = params.month === 12 ? 1 : params.month + 1;
  const nextYear = params.month === 12 ? params.year + 1 : params.year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const rows = await db
  .select({
    institutionName: settlementItems.institutionName,
    revenueType: settlementItems.revenueType,
    grossAmount: settlementItems.grossAmount,
    companyAmount: settlementItems.companyAmount,
    freelancerAmount: settlementItems.freelancerAmount,
    taxAmount: settlementItems.taxAmount,
    finalPayoutAmount: settlementItems.finalPayoutAmount,
    companyProfit: settlementItems.companyProfit,
    settlementStatus: settlementItems.settlementStatus,
  })
  .from(settlementItems)
  .where(
    and(
      sql`${settlementItems.occurredAt} >= ${startDate}`,
      sql`${settlementItems.occurredAt} < ${endDate}`,
      sql`${settlementItems.settlementStatus} = 'confirmed'`
    )
  )
  .orderBy(asc(settlementItems.institutionName), desc(settlementItems.occurredAt));

  const map = new Map<string, any>();

  for (const row of rows as any[]) {
  const institutionName = String(row.institutionName || "미지정 교육원");

  if (!map.has(institutionName)) {
    map.set(institutionName, {
      institutionName,
      totalGrossAmount: 0,
      totalCompanyAmount: 0,
      totalFreelancerAmount: 0,
      totalTaxAmount: 0,
      totalFinalPayoutAmount: 0,
      totalCompanyProfit: 0,
      prevGrossAmount: 0,
      prevCompanyAmount: 0,
      grossDiffAmount: 0,
      companyDiffAmount: 0,
      grossDiffRate: 0,
      companyDiffRate: 0,
      count: 0,
    });
  }

  const target = map.get(institutionName);
  target.totalGrossAmount += toNumber(row.grossAmount);
  target.totalCompanyAmount += toNumber(row.companyAmount);
  target.totalFreelancerAmount += toNumber(row.freelancerAmount);
  target.totalTaxAmount += toNumber(row.taxAmount);
  target.totalFinalPayoutAmount += toNumber(row.finalPayoutAmount);
  target.totalCompanyProfit += toNumber(row.companyProfit);
  target.count += 1;
}

  return Array.from(map.values()).sort(
    (a, b) => b.totalGrossAmount - a.totalGrossAmount
  );
}

export async function getSettlementInstitutionEntries(params: {
  year: number;
  month: number;
  institutionName: string;
}) {
  const db = await getDb();
  if (!db) {
    return {
      entries: [],
      totalCount: 0,
    };
  }

  const startDate = `${params.year}-${String(params.month).padStart(2, "0")}-01`;
  const nextMonth = params.month === 12 ? 1 : params.month + 1;
  const nextYear = params.month === 12 ? params.year + 1 : params.year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const rows = await db
    .select({
      id: settlementItems.id,
      occurredAt: settlementItems.occurredAt,
      revenueType: settlementItems.revenueType,
      settlementStatus: settlementItems.settlementStatus,
      assigneeName: users.name,
      clientName: students.clientName,
      title: settlementItems.title,
      institutionName: settlementItems.institutionName,
      grossAmount: settlementItems.grossAmount,
      companyAmount: settlementItems.companyAmount,
      freelancerAmount: settlementItems.freelancerAmount,
      taxAmount: settlementItems.taxAmount,
      finalPayoutAmount: settlementItems.finalPayoutAmount,
      companyProfit: settlementItems.companyProfit,
      studentId: settlementItems.studentId,
    })
    .from(settlementItems)
    .leftJoin(students, eq(settlementItems.studentId, students.id))
    .leftJoin(users, eq(settlementItems.assigneeId, users.id))
    .where(
  and(
    sql`${settlementItems.occurredAt} >= ${startDate}`,
    sql`${settlementItems.occurredAt} < ${endDate}`,
    eq(settlementItems.institutionName, params.institutionName),
    sql`${settlementItems.settlementStatus} = 'confirmed'`
  )
)
    .orderBy(desc(settlementItems.occurredAt), desc(settlementItems.id));

  const entries = (rows as any[]).map((row) => ({
    id: Number(row.id),
    occurredAt: row.occurredAt,
    revenueType: row.revenueType,
    settlementStatus: row.settlementStatus,
    assigneeName: row.assigneeName || "",
    clientName: row.clientName || "",
    title: row.title || "",
    institutionName: row.institutionName || "",
    grossAmount: toNumber(row.grossAmount),
    companyAmount: toNumber(row.companyAmount),
    freelancerAmount: toNumber(row.freelancerAmount),
    taxAmount: toNumber(row.taxAmount),
    finalPayoutAmount: toNumber(row.finalPayoutAmount),
    companyProfit: toNumber(row.companyProfit),
    studentId: Number(row.studentId || 0),
  }));

  return {
    entries,
    totalCount: entries.length,
  };
}

export async function getSettlementInstitutionMonthlyTrend(params: {
  year: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const startDate = `${params.year}-01-01`;
  const endDate = `${params.year + 1}-01-01`;

  const rows = await db
  .select({
    institutionName: settlementItems.institutionName,
    revenueType: settlementItems.revenueType,
    occurredAt: settlementItems.occurredAt,
    grossAmount: settlementItems.grossAmount,
    companyAmount: settlementItems.companyAmount,
    settlementStatus: settlementItems.settlementStatus,
  })
  .from(settlementItems)
  .where(
    and(
      sql`${settlementItems.occurredAt} >= ${startDate}`,
      sql`${settlementItems.occurredAt} < ${endDate}`,
      sql`${settlementItems.settlementStatus} = 'confirmed'`
    )
  )
  .orderBy(asc(settlementItems.institutionName), asc(settlementItems.occurredAt));

  const map = new Map<string, any>();

 for (const row of rows as any[]) {
  const institutionName = String(row.institutionName || "미지정 교육원");
  const occurredAt = row.occurredAt ? new Date(row.occurredAt) : null;
  const month = occurredAt ? occurredAt.getMonth() + 1 : 0;

  if (!month || month < 1 || month > 12) continue;

  if (!map.has(institutionName)) {
    map.set(institutionName, {
      institutionName,
      monthlyGross: {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
        7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
      },
      monthlyCompany: {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
        7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
      },
      yearTotalGross: 0,
      yearTotalCompany: 0,
    });
  }

  const target = map.get(institutionName);

  const gross = toNumber(row.grossAmount);
  const company = toNumber(row.companyAmount);

  target.monthlyGross[month] += gross;
  target.monthlyCompany[month] += company;
  target.yearTotalGross += gross;
  target.yearTotalCompany += company;
}


  return Array.from(map.values())
  .map((row: any) => {
    const grossDiffAmount = Number(row.totalGrossAmount || 0) - Number(row.prevGrossAmount || 0);
    const companyDiffAmount = Number(row.totalCompanyAmount || 0) - Number(row.prevCompanyAmount || 0);

    const grossDiffRate =
      Number(row.prevGrossAmount || 0) === 0
        ? 0
        : (grossDiffAmount / Number(row.prevGrossAmount)) * 100;

    const companyDiffRate =
      Number(row.prevCompanyAmount || 0) === 0
        ? 0
        : (companyDiffAmount / Number(row.prevCompanyAmount)) * 100;

    return {
      ...row,
      grossDiffAmount,
      companyDiffAmount,
      grossDiffRate,
      companyDiffRate,
    };
  })
  .sort((a, b) => b.totalGrossAmount - a.totalGrossAmount);
}

// ─── 학생별 결제 요약 ────────────────────────────────────────────────
export async function getStudentPaymentSummary(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
const organizationId = requireOrganizationId(params?.organizationId);

  if (!db) {
    return {
      totalRequired: 0,
      totalPaid: 0,
      totalRefund: 0,
      netPaid: 0,
      remainingAmount: 0,
    };
  }

  const student = await getStudent(studentId, { organizationId });
  if (!student) {
    return {
      totalRequired: 0,
      totalPaid: 0,
      totalRefund: 0,
      netPaid: 0,
      remainingAmount: 0,
    };
  }

  const [plannedResult] = await db.execute(sql`
    SELECT COALESCE(SUM(plannedAmount), 0) as total
    FROM semesters
    WHERE studentId = ${studentId}
      AND organizationId = ${organizationId}
  `);

  const totalRequired = toNumber((plannedResult as any)[0]?.total);

  const [settlementResult] = await db.execute(sql`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN settlementStatus = 'confirmed'
             AND revenueType != 'refund'
            THEN grossAmount
            ELSE 0
          END
        ),
        0
      ) as totalPaid,

      COALESCE(
        SUM(
          CASE
            WHEN revenueType = 'refund'
            THEN ABS(grossAmount)
            ELSE 0
          END
        ),
        0
      ) as totalRefund
    FROM settlement_items
    WHERE studentId = ${studentId}
      AND organizationId = ${organizationId}
  `);

  const totalPaid = toNumber((settlementResult as any)[0]?.totalPaid);
  const totalRefund = toNumber((settlementResult as any)[0]?.totalRefund);

  const netPaid = totalPaid - totalRefund;
  const remainingAmount = Math.max(totalRequired - netPaid, 0);

  return {
    totalRequired,
    totalPaid,
    totalRefund,
    netPaid,
    remainingAmount,
  };
}

export async function cleanupOrphanSettlementItems(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const summary = {
    checkedSettlementItems: 0,
    deletedSettlementItems: 0,
    deletedSettlementLogs: 0,
    orphanStudentItems: 0,
    orphanSemesterItems: 0,
    orphanPracticeItems: 0,
    orphanPrivateCertificateItems: 0,
    skippedRows: 0,
  };

  const orphanSettlementIds = new Set<number>();

  // 1) studentId는 있는데 같은 조직 students 원본이 없는 정산
  const studentRows = await db.execute(sql`
    SELECT si.id
    FROM settlement_items si
    LEFT JOIN students s
      ON s.id = si.studentId
     AND s.organizationId = ${organizationId}
    WHERE si.organizationId = ${organizationId}
      AND si.studentId IS NOT NULL
      AND s.id IS NULL
  `);

  for (const row of (studentRows as any)[0] || []) {
    orphanSettlementIds.add(Number(row.id));
    summary.orphanStudentItems += 1;
  }

  // 2) 일반과목(subject)인데 같은 조직 semester 원본이 없는 정산
  const semesterRows = await db.execute(sql`
    SELECT si.id
    FROM settlement_items si
    LEFT JOIN semesters sem
      ON sem.id = si.sourceId
     AND sem.organizationId = ${organizationId}
    WHERE si.organizationId = ${organizationId}
      AND si.revenueType = 'subject'
      AND si.sourceId IS NOT NULL
      AND sem.id IS NULL
  `);

  for (const row of (semesterRows as any)[0] || []) {
    orphanSettlementIds.add(Number(row.id));
    summary.orphanSemesterItems += 1;
  }

  // 3) 실습배정(practice_support)인데 같은 조직 request 원본이 없는 정산
  const practiceRows = await db.execute(sql`
    SELECT si.id
    FROM settlement_items si
    LEFT JOIN practice_support_requests psr
      ON psr.id = si.sourceId
     AND psr.organizationId = ${organizationId}
    WHERE si.organizationId = ${organizationId}
      AND si.revenueType = 'practice_support'
      AND si.sourceId IS NOT NULL
      AND psr.id IS NULL
  `);

  for (const row of (practiceRows as any)[0] || []) {
    orphanSettlementIds.add(Number(row.id));
    summary.orphanPracticeItems += 1;
  }

  // 4) 민간자격증(private_certificate)인데 같은 조직 request 원본이 없는 정산
  const privateCertificateRows = await db.execute(sql`
    SELECT si.id
    FROM settlement_items si
    LEFT JOIN private_certificate_requests pcr
      ON pcr.id = si.sourceId
     AND pcr.organizationId = ${organizationId}
    WHERE si.organizationId = ${organizationId}
      AND si.revenueType = 'private_certificate'
      AND si.sourceId IS NOT NULL
      AND pcr.id IS NULL
  `);

  for (const row of (privateCertificateRows as any)[0] || []) {
    orphanSettlementIds.add(Number(row.id));
    summary.orphanPrivateCertificateItems += 1;
  }

  const finalIds = Array.from(orphanSettlementIds).filter(
    (id) => Number.isFinite(id) && id > 0
  );

  summary.checkedSettlementItems = finalIds.length;

  if (finalIds.length === 0) {
    return {
      success: true,
      summary,
      deletedIds: [],
    };
  }

  for (const settlementItemId of finalIds) {
    const logDeleteResult: any = await db
      .delete(settlementItemLogs)
      .where(eq(settlementItemLogs.settlementItemId, settlementItemId));

    const deletedLogCount =
      Number(logDeleteResult?.rowsAffected || 0) ||
      Number(logDeleteResult?.[0]?.affectedRows || 0) ||
      0;

    summary.deletedSettlementLogs += deletedLogCount;

    const settlementDeleteResult: any = await db
      .delete(settlementItems)
      .where(
        and(
          eq(settlementItems.id, settlementItemId),
          eq(settlementItems.organizationId, organizationId)
        )
      );

    const deletedSettlementCount =
      Number(settlementDeleteResult?.rowsAffected || 0) ||
      Number(settlementDeleteResult?.[0]?.affectedRows || 0) ||
      0;

    if (deletedSettlementCount > 0) {
      summary.deletedSettlementItems += deletedSettlementCount;
    } else {
      summary.skippedRows += 1;
    }
  }

  return {
    success: true,
    summary,
    deletedIds: finalIds,
  };
}

// ─── Settlement ──────────────────────────────────────────────────────
export async function getSettlementReport(
  year: number,
  month: number,
  filterAssigneeId?: number
) {
  const db = await getDb();
  if (!db) return [];

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const conditions = [
    sql`${settlementItems.occurredAt} >= ${startDate}`,
    sql`${settlementItems.occurredAt} < ${endDate}`,
  ];

  if (filterAssigneeId) {
    conditions.push(eq(settlementItems.assigneeId, filterAssigneeId));
  }

  const subjectApprovedCondition = or(
    sql`${settlementItems.revenueType} <> 'subject'`,
    and(
      eq(settlementItems.revenueType, "subject"),
      eq(semesters.id, settlementItems.sourceId),
      eq(semesters.approvalStatus, "승인")
    )
  );

  conditions.push(subjectApprovedCondition);
     
  const rows = await db
    .select({
      assigneeId: settlementItems.assigneeId,

      totalGrossSales: sql<string>`
  COALESCE(SUM(
    CASE
      WHEN ${settlementItems.settlementStatus} = 'confirmed'
       AND ${settlementItems.revenueType} != 'refund'
      THEN ${settlementItems.grossAmount}
      ELSE 0
    END
  ), 0)
`,

     totalRefundGross: sql<string>`
  COALESCE(SUM(
    CASE
      WHEN ${settlementItems.revenueType} = 'refund'
      THEN ABS(${settlementItems.grossAmount})
      ELSE 0
    END
  ), 0)
`,

      totalCompanyAmount: sql<string>`
        COALESCE(SUM(
          CASE
            WHEN ${settlementItems.settlementStatus} = 'confirmed'
            THEN ${settlementItems.companyAmount}
            ELSE 0
          END
        ), 0)
      `,

      totalRefundCompanyAmount: sql<string>`
  COALESCE(SUM(
    CASE
      WHEN ${settlementItems.revenueType} = 'refund'
      THEN ABS(${settlementItems.companyAmount})
      ELSE 0
    END
  ), 0)
`,

      totalInstitutionCost: sql<string>`
        COALESCE(SUM(
          CASE
            WHEN ${settlementItems.settlementStatus} = 'confirmed'
            THEN ${settlementItems.institutionCost}
            ELSE 0
          END
        ), 0)
      `,

      totalRefundInstitutionCost: sql<string>`
  COALESCE(SUM(
    CASE
      WHEN ${settlementItems.revenueType} = 'refund'
      THEN ABS(${settlementItems.institutionCost})
      ELSE 0
    END
  ), 0)
`,

      totalFreelancerAmount: sql<string>`
        COALESCE(SUM(
          CASE
            WHEN ${settlementItems.settlementStatus} = 'confirmed'
            THEN ${settlementItems.freelancerAmount}
            ELSE 0
          END
        ), 0)
      `,

      totalRefundFreelancerAmount: sql<string>`
  COALESCE(SUM(
    CASE
      WHEN ${settlementItems.revenueType} = 'refund'
      THEN ABS(${settlementItems.freelancerAmount})
      ELSE 0
    END
  ), 0)
`,

      totalTaxAmount: sql<string>`
        COALESCE(SUM(
          CASE
            WHEN ${settlementItems.settlementStatus} = 'confirmed'
            THEN ${settlementItems.taxAmount}
            ELSE 0
          END
        ), 0)
      `,

      totalRefundTaxAmount: sql<string>`
  COALESCE(SUM(
    CASE
      WHEN ${settlementItems.revenueType} = 'refund'
      THEN ABS(${settlementItems.taxAmount})
      ELSE 0
    END
  ), 0)
`,

      totalFinalPayoutAmount: sql<string>`
        COALESCE(SUM(
          CASE
            WHEN ${settlementItems.settlementStatus} = 'confirmed'
            THEN ${settlementItems.finalPayoutAmount}
            ELSE 0
          END
        ), 0)
      `,

     totalRefundFinalPayoutAmount: sql<string>`
  COALESCE(SUM(
    CASE
      WHEN ${settlementItems.revenueType} = 'refund'
      THEN ABS(${settlementItems.finalPayoutAmount})
      ELSE 0
    END
  ), 0)
`,

 totalCompanyProfit: sql<string>`
  COALESCE(SUM(
    CASE
      WHEN ${settlementItems.settlementStatus} = 'confirmed'
      THEN ${sql.raw("`companyProfit`")}
      ELSE 0
    END
  ), 0)
`,

totalRefundCompanyProfit: sql<string>`
  COALESCE(SUM(
    CASE
      WHEN ${settlementItems.revenueType} = 'refund'
      THEN ABS(${sql.raw("`companyProfit`")})
      ELSE 0
    END
  ), 0)
`,
    })
        .from(settlementItems)
    .leftJoin(
      semesters,
      and(
        eq(settlementItems.revenueType, "subject"),
        eq(semesters.id, settlementItems.sourceId)
      )
    )
    .where(and(...conditions))
    .groupBy(settlementItems.assigneeId);

  const allUserRows = await db
    .select({
      id: users.id,
      name: users.name,
    })
    .from(users);

  const userMap = new Map(
    allUserRows.map((u) => [Number(u.id), u.name || "이름없음"])
  );

  return rows.map((row: any) => {
    const assigneeId = Number(row.assigneeId || 0);

    const totalGrossSales = toNumber(row.totalGrossSales);
    const totalRefundGross = toNumber(row.totalRefundGross);
    const netSales = totalGrossSales - totalRefundGross;

    const totalCompanyAmount = toNumber(row.totalCompanyAmount);
    const totalRefundCompanyAmount = toNumber(row.totalRefundCompanyAmount);
    const netCompanyAmount = totalCompanyAmount - totalRefundCompanyAmount;

    const totalInstitutionCost = toNumber(row.totalInstitutionCost);
    const totalRefundInstitutionCost = toNumber(row.totalRefundInstitutionCost);
    const netInstitutionCost = totalInstitutionCost - totalRefundInstitutionCost;

    const totalFreelancerAmount = toNumber(row.totalFreelancerAmount);
    const totalRefundFreelancerAmount = toNumber(row.totalRefundFreelancerAmount);
    const netFreelancerAmount =
      totalFreelancerAmount - totalRefundFreelancerAmount;

    const totalTaxAmount = toNumber(row.totalTaxAmount);
    const totalRefundTaxAmount = toNumber(row.totalRefundTaxAmount);
    const netTaxAmount = totalTaxAmount - totalRefundTaxAmount;

    const totalFinalPayoutAmount = toNumber(row.totalFinalPayoutAmount);
    const totalRefundFinalPayoutAmount = toNumber(row.totalRefundFinalPayoutAmount);
    const netFinalPayoutAmount =
      totalFinalPayoutAmount - totalRefundFinalPayoutAmount;

    const totalCompanyProfit = toNumber(row.totalCompanyProfit);
    const totalRefundCompanyProfit = toNumber(row.totalRefundCompanyProfit);
    const netCompanyProfit =
      totalCompanyProfit - totalRefundCompanyProfit;

    return {
      assigneeId,
      assigneeName: userMap.get(assigneeId) || "이름없음",

      totalGrossSales,
      totalRefundGross,
      netSales,

      totalCompanyAmount,
      totalRefundCompanyAmount,
      netCompanyAmount,

      totalInstitutionCost,
      totalRefundInstitutionCost,
      netInstitutionCost,

      totalFreelancerAmount,
      totalRefundFreelancerAmount,
      netFreelancerAmount,

      totalTaxAmount,
      totalRefundTaxAmount,
      netTaxAmount,

      totalFinalPayoutAmount,
      totalRefundFinalPayoutAmount,
      netFinalPayoutAmount,

      totalCompanyProfit,
      totalRefundCompanyProfit,
      netCompanyProfit,
    };
  });
}

export async function getSettlementSettings(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
    SELECT *
    FROM settlement_settings
    WHERE organizationId = ${organizationId}
    ORDER BY id DESC
    LIMIT 1
  `);

  return (rows as any[])[0] || { organizationId, payoutDay: 25 };
}

export async function saveSettlementSettings(data: {
  organizationId?: number | null;
  payoutDay: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(data.organizationId);

  const [rows] = await db.execute(sql`
    SELECT id
    FROM settlement_settings
    WHERE organizationId = ${organizationId}
    ORDER BY id DESC
    LIMIT 1
  `);

  const existing = (rows as any[])[0];

  if (existing?.id) {
    await db.execute(sql`
      UPDATE settlement_settings
      SET payoutDay = ${data.payoutDay}
      WHERE id = ${existing.id}
        AND organizationId = ${organizationId}
    `);

    return Number(existing.id);
  }

  const [result]: any = await db.execute(sql`
    INSERT INTO settlement_settings (organizationId, payoutDay)
    VALUES (${organizationId}, ${data.payoutDay})
  `);

  return Number(result?.insertId || 0);
}

export async function getSettlementPayslip(params: {
organizationId?: number | null;
  year: number;
  month: number;
  assigneeId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const start = new Date(params.year, params.month - 1, 1);
  const end = new Date(params.year, params.month, 1);
const settings = await getSettlementSettings({
  organizationId: requireOrganizationId(params.organizationId),
});

    const organizationId = requireOrganizationId(params.organizationId);

const [profileRows] = await db.execute(sql`
  SELECT
    u.id,
    u.name,
    u.username,
    u.role,
    u.bankName,
    u.bankAccount,
    map.teamId,
    map.positionId,
    t.name AS teamName,
    p.name AS positionName
  FROM users u
  LEFT JOIN user_org_mappings map
    ON map.userId = u.id
   AND map.organizationId = ${organizationId}
  LEFT JOIN teams t
    ON t.id = map.teamId
   AND t.organizationId = ${organizationId}
  LEFT JOIN positions p
    ON p.id = map.positionId
   AND p.organizationId = ${organizationId}
  WHERE u.id = ${params.assigneeId}
    AND u.organizationId = ${organizationId}
  LIMIT 1
`);

  const profile = (profileRows as any[])?.[0];
  if (!profile) {
    throw new Error("담당자 정보를 찾을 수 없습니다.");
  }

  const branding = await getBrandingSettings({
  organizationId: requireOrganizationId(params.organizationId),
});

  const payoutDay = Math.max(
    1,
    Math.min(31, Number((settings as any)?.payoutDay || 25))
  );

  const paymentDate = new Date(params.year, params.month - 1, payoutDay);

  const companyName =
    String((branding as any)?.companyName || "").trim() || "위드원 교육";

  const [entryRows] = await db.execute(sql`
    SELECT
      s.id,
      s.assigneeId,
      s.studentId,
      s.revenueType,
      s.title,
s.institutionName,
      s.grossAmount,
      s.companyAmount,
      s.companyProfit,
      s.freelancerAmount,
      s.taxAmount,
      s.finalPayoutAmount,
      s.settlementStatus,
      s.occurredAt,
      st.clientName
    FROM settlement_items s
   LEFT JOIN students st
  ON st.id = s.studentId
 AND st.organizationId = ${requireOrganizationId(params.organizationId)}

WHERE s.organizationId = ${requireOrganizationId(params.organizationId)}
  AND s.assigneeId = ${params.assigneeId}
      AND s.occurredAt >= ${start}
      AND s.occurredAt < ${end}
      AND s.settlementStatus = 'confirmed'
    ORDER BY s.occurredAt ASC, s.id ASC
  `);

  const entries = ((entryRows as any[]) ?? []).map((row: any) => ({
    ...row,
    grossAmount: toNumber(row.grossAmount),
    companyAmount: toNumber(row.companyAmount),
    companyProfit: toNumber(row.companyProfit),
    freelancerAmount: toNumber(row.freelancerAmount),
    taxAmount: toNumber(row.taxAmount),
    finalPayoutAmount: toNumber(row.finalPayoutAmount),
  }));

  let educationSupportAmount = 0;
  let subjectAllowanceAmount = 0;
  let privateCertificateAllowanceAmount = 0;
  let practiceSupportAllowanceAmount = 0;

  let refundDeductionAmount = 0;
  let taxDeductionAmount = 0;
  let contractDeductionAmount = 0;

  for (const row of entries) {
  if (row.revenueType === "subject") {
    subjectAllowanceAmount += row.freelancerAmount;
  }

  if (row.revenueType === "private_certificate") {
    privateCertificateAllowanceAmount += row.freelancerAmount;
  }

  if (row.revenueType === "practice_support") {
    practiceSupportAllowanceAmount += row.freelancerAmount;
  }

  if (row.revenueType === "refund") {
    refundDeductionAmount += Math.abs(row.grossAmount);
  }

  taxDeductionAmount += Math.abs(row.taxAmount);
}

  const totalGrossAmount =
    educationSupportAmount +
    subjectAllowanceAmount +
    privateCertificateAllowanceAmount +
    practiceSupportAllowanceAmount;

  const totalDeductionAmount =
    refundDeductionAmount + taxDeductionAmount + contractDeductionAmount;

  const totalReceivableAmount = totalGrossAmount - totalDeductionAmount;

  const totalNetPayoutAmount = entries.reduce((sum: number, row: any) => {
  return sum + row.finalPayoutAmount;
}, 0);

    return {
    year: params.year,
    month: params.month,
    assigneeId: Number(profile.id),
    assigneeName: profile.name || profile.username || "이름없음",
    teamName: profile.teamName || "-",
    positionName: profile.positionName || "-",

    companyName,
    paymentDate,
    bankName: profile.bankName || "-",
    bankAccount: profile.bankAccount || "-",

    summary: {
      totalGrossAmount,
      totalDeductionAmount,
      totalReceivableAmount,
      totalNetPayoutAmount,
    },

    paymentItems: {
      educationSupportAmount,
      subjectAllowanceAmount,
      privateCertificateAllowanceAmount,
      practiceSupportAllowanceAmount,
    },

    deductionItems: {
      refundDeductionAmount,
      taxDeductionAmount,
      contractDeductionAmount,
    },

    entries: entries.map((row: any) => ({
      id: Number(row.id),
      occurredAt: row.occurredAt,
      revenueType: row.revenueType,
      title: row.title || "",
institutionName: row.institutionName || "",
      clientName: row.clientName || "",
      grossAmount: row.grossAmount,
      freelancerAmount: row.freelancerAmount,
      taxAmount: row.taxAmount,
      finalPayoutAmount: row.finalPayoutAmount,
      settlementStatus: row.settlementStatus,
    })),
  };
}

// ─── Plan Semesters ──────────────────────────────────────────────────
function normalizeSubjectName(name: string) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

export async function findDuplicatePlanSubject(params: {
  organizationId?: number | null;
  studentId: number;
  subjectName: string;
  excludeId?: number;
  excludeSemesterNo?: number;
}) {
  const organizationId = requireOrganizationId(params.organizationId);

  const rows = await listPlanSemesters(params.studentId, {
    organizationId,
  });

  const target = normalizeSubjectName(params.subjectName);

  if (!target) return null;

  return (
    rows.find((row: any) => {
      if (params.excludeId && Number(row.id) === Number(params.excludeId)) {
        return false;
      }

      if (
        params.excludeSemesterNo !== undefined &&
        Number(row.semesterNo) === Number(params.excludeSemesterNo)
      ) {
        return false;
      }

      return normalizeSubjectName(row.subjectName) === target;
    }) || null
  );
}

async function validatePlanRequirementLimit(params: {
organizationId?: number | null;
  studentId: number;
  requirementType?: "전공필수" | "전공선택" | "교양" | "일반" | null;
  excludePlanSemesterId?: number;
}) {
  const requirementType = params.requirementType ?? null;

  if (!requirementType) return;

  const plan = await getPlan(params.studentId, {
  organizationId: requireOrganizationId(params?.organizationId),
})
;
  if (!plan) return;

  const rows = await listPlanSemesters(params.studentId, {
  organizationId: requireOrganizationId((params as any)?.organizationId),
});

  const filteredRows = rows.filter((row: any) => {
    if (
      params.excludePlanSemesterId &&
      Number(row.id) === Number(params.excludePlanSemesterId)
    ) {
      return false;
    }
    return true;
  });

  const currentCount = filteredRows.filter(
    (row: any) => String(row.planRequirementType || "") === String(requirementType)
  ).length;

  const limitMap: Record<string, number> = {
    "전공필수": Number((plan as any).requiredMajorCount ?? 0),
    "전공선택": Number((plan as any).electiveMajorCount ?? 0),
    "교양": Number((plan as any).liberalCount ?? 0),
    "일반": Number((plan as any).generalCount ?? 0),
  };

  const limit = limitMap[requirementType] ?? 0;

  if (currentCount + 1 > limit) {
    throw new Error(`${requirementType} 허용 개수(${limit}개)를 초과할 수 없습니다.`);
  }
}

export async function listPlanSemesters(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(planSemesters)
    .where(
      and(
        eq(planSemesters.studentId, studentId),
        eq(planSemesters.organizationId, organizationId)
      )
    )
    .orderBy(planSemesters.semesterNo, planSemesters.sortOrder, planSemesters.id);
}

export async function createPlanSemester(data: InsertPlanSemester) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId((data as any).organizationId);

  const duplicate = await findDuplicatePlanSubject({
    studentId: Number(data.studentId),
    subjectName: String(data.subjectName || ""),
    organizationId,
  } as any);

  if (duplicate) {
    throw new Error(
      `이미 ${duplicate.semesterNo}학기에 등록된 과목입니다: ${duplicate.subjectName}`
    );
  }

  if (FEATURE_FLAGS.PLAN_REQUIREMENT_ENFORCE) {
    await validatePlanRequirementLimit({
      studentId: Number(data.studentId),
      requirementType: (data as any).planRequirementType ?? null,
      organizationId,
    } as any);
  }

  const result: any = await db.insert(planSemesters).values({
    ...data,
    organizationId,
  } as any);

  return getInsertId(result);
}

export async function updatePlanSemester(
  id: number,
  data: Partial<InsertPlanSemester>,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const current = await db
    .select()
    .from(planSemesters)
    .where(
      and(
        eq(planSemesters.id, id),
        eq(planSemesters.organizationId, organizationId)
      )
    )
    .limit(1);

  const row = current[0];
  if (!row) throw new Error("우리 플랜 과목을 찾을 수 없습니다");

  if (data.subjectName !== undefined) {
    const duplicate = await findDuplicatePlanSubject({
      studentId: Number(row.studentId),
      subjectName: String(data.subjectName || ""),
      excludeId: id,
      organizationId,
    } as any);

    if (duplicate) {
      throw new Error(
        `이미 ${duplicate.semesterNo}학기에 등록된 과목입니다: ${duplicate.subjectName}`
      );
    }
  }

  const nextRequirementType =
    data.planRequirementType !== undefined
      ? data.planRequirementType
      : row.planRequirementType;

  if (FEATURE_FLAGS.PLAN_REQUIREMENT_ENFORCE) {
    await validatePlanRequirementLimit({
      studentId: Number(row.studentId),
      requirementType: (nextRequirementType as any) ?? null,
      excludePlanSemesterId: id,
      organizationId,
    } as any);
  }

  await db
    .update(planSemesters)
    .set(data as any)
    .where(
      and(
        eq(planSemesters.id, id),
        eq(planSemesters.organizationId, organizationId)
      )
    );
}

export async function deletePlanSemester(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .delete(planSemesters)
    .where(
      and(
        eq(planSemesters.id, id),
        eq(planSemesters.organizationId, organizationId)
      )
    );
}

export async function syncPlanSemestersByCount(
  studentId: number,
  semesterNo: number,
  targetCount: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(planSemesters)
    .where(
      and(
        eq(planSemesters.studentId, studentId),
        eq(planSemesters.semesterNo, semesterNo),
        eq(planSemesters.organizationId, organizationId)
      )
    )
    .orderBy(planSemesters.sortOrder, planSemesters.id);

  const currentCount = rows.length;

  if (currentCount < targetCount) {
    for (let i = currentCount; i < targetCount; i++) {
      await db.insert(planSemesters).values({
        organizationId,
        studentId,
        semesterNo,
        subjectName: `새 과목${i + 1}`,
        planCategory: "전공",
        planRequirementType: "전공선택",
        credits: 3,
        sortOrder: i,
      } as any);
    }
  }

  if (currentCount > targetCount) {
    const toDelete = rows.slice(targetCount);
    for (const row of toDelete) {
      await db
        .delete(planSemesters)
        .where(
          and(
            eq(planSemesters.id, row.id),
            eq(planSemesters.organizationId, organizationId)
          )
        );
    }
  }

  return true;
}

// ─── Transfer Subjects ───────────────────────────────────────────────
export async function listTransferSubjects(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(transferSubjects)
    .where(
      and(
        eq(transferSubjects.studentId, studentId),
        eq(transferSubjects.organizationId, organizationId)
      )
    )
    .orderBy(transferSubjects.sortOrder, transferSubjects.id);
}

export async function createTransferSubject(data: InsertTransferSubject) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId((data as any).organizationId);

  const result: any = await db.insert(transferSubjects).values({
    ...data,
    organizationId,
  } as any);

  return getInsertId(result);
}

export async function updateTransferSubject(
  id: number,
  data: Partial<InsertTransferSubject>,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(transferSubjects)
    .set(data as any)
    .where(
      and(
        eq(transferSubjects.id, id),
        eq(transferSubjects.organizationId, organizationId)
      )
    );
}

export async function deleteTransferSubject(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .delete(transferSubjects)
    .where(
      and(
        eq(transferSubjects.id, id),
        eq(transferSubjects.organizationId, organizationId)
      )
    );
}

export async function bulkCreateTransferSubjects(dataList: InsertTransferSubject[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (!dataList.length) return [];

  const normalized = dataList.map((row: any) => ({
    ...row,
    organizationId: requireOrganizationId(row.organizationId),
  }));

  const result = await db.insert(transferSubjects).values(normalized as any);
  return result;
}

// ─── 학기 완료 시 자동 종료 체크 ─────────────────────────────────────
export async function checkAndAutoComplete(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();

const organizationId = requireOrganizationId(params?.organizationId);

  if (!db) return;

  const student = await getStudent(studentId, { organizationId });
  if (!student) return;

  const allSems = await listSemesters(studentId, { organizationId });
  if (!allSems.length) return;

  const sorted = [...allSems].sort(
    (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
  );
  const lastSem = sorted[sorted.length - 1];

await updateStudent(
  studentId,
  {
    status: lastSem?.status === "등록 종료" ? "등록 종료" : "등록",
  } as any,
  { organizationId }
);
}

// ─── 교육원 ──────────────────────────────────────────────────────────
export async function listEducationInstitutions(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(educationInstitutions)
    .where(
      and(
        eq(educationInstitutions.organizationId, organizationId),
        eq(educationInstitutions.isActive, true)
      )
    )
    .orderBy(educationInstitutions.sortOrder, educationInstitutions.id);
}

export async function createEducationInstitution(data: {
organizationId?: number | null;
  name: string;
  isActive?: boolean;
  sortOrder?: number;
  settlementType?: "credit" | "subject" | "fixed";
  unitCostAmount?: string | number;
  normalSubjectPrice?: string | number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

  const result = await db.insert(educationInstitutions).values({
organizationId: requireOrganizationId(data.organizationId),
    name: data.name,
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder ?? 0,
    settlementType: data.settlementType ?? "credit",
    unitCostAmount: String(data.unitCostAmount ?? "0"),
    normalSubjectPrice: String(data.normalSubjectPrice ?? "75000"),
  } as any);

  return Number(getInsertId(result));
}

export async function reassignConsultationAndLinkedStudent(
  consultationId: number,
  assigneeId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(consultations)
    .set({ assigneeId } as any)
    .where(
  and(
    eq(consultations.id, consultationId),
    eq(consultations.organizationId, organizationId)
  )
);

  await db
    .update(students)
    .set({ assigneeId } as any)
    .where(
  and(
    eq(students.consultationId, consultationId),
    eq(students.organizationId, organizationId)
  )
);
}

export async function listEducationInstitutionPositionRates(
  educationInstitutionId?: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const whereConditions = [
    eq(educationInstitutionPositionRates.organizationId, organizationId),
    eq(educationInstitutionPositionRates.isActive, true),
  ];

  if (educationInstitutionId) {
    whereConditions.push(
      eq(
        educationInstitutionPositionRates.educationInstitutionId,
        educationInstitutionId
      )
    );
  }

  const rows = await db
    .select({
      id: educationInstitutionPositionRates.id,
      educationInstitutionId:
        educationInstitutionPositionRates.educationInstitutionId,
      positionId: educationInstitutionPositionRates.positionId,
      freelancerUnitAmount:
        educationInstitutionPositionRates.freelancerUnitAmount,
      isActive: educationInstitutionPositionRates.isActive,
      createdAt: educationInstitutionPositionRates.createdAt,
      updatedAt: educationInstitutionPositionRates.updatedAt,
      institutionName: educationInstitutions.name,
      positionName: positions.name,
      positionSortOrder: positions.sortOrder,
    })
    .from(educationInstitutionPositionRates)
    .leftJoin(
      educationInstitutions,
      and(
        eq(
          educationInstitutionPositionRates.educationInstitutionId,
          educationInstitutions.id
        ),
        eq(educationInstitutions.organizationId, organizationId)
      )
    )
    .leftJoin(
      positions,
      eq(educationInstitutionPositionRates.positionId, positions.id)
    )
    .where(and(...whereConditions))
    .orderBy(
      asc(educationInstitutionPositionRates.educationInstitutionId),
      asc(positions.sortOrder),
      asc(educationInstitutionPositionRates.positionId)
    );

  return rows;
}

export async function getEducationInstitutionPositionRate(
  educationInstitutionId: number,
  positionId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return null;

const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(educationInstitutionPositionRates)
    .where(
      and(
        eq(educationInstitutionPositionRates.organizationId, organizationId),
        eq(
          educationInstitutionPositionRates.educationInstitutionId,
          educationInstitutionId
        ),
        eq(educationInstitutionPositionRates.positionId, positionId),
        eq(educationInstitutionPositionRates.isActive, true)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertEducationInstitutionPositionRate(data: {
  organizationId?: number | null;
  educationInstitutionId: number;
  positionId: number;
  freelancerUnitAmount: string | number;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

  const organizationId = requireOrganizationId(data.organizationId);

  const exists = await db
    .select()
    .from(educationInstitutionPositionRates)
    .where(
      and(
        eq(educationInstitutionPositionRates.organizationId, organizationId),
        eq(
          educationInstitutionPositionRates.educationInstitutionId,
          data.educationInstitutionId
        ),
        eq(educationInstitutionPositionRates.positionId, data.positionId)
      )
    )
    .limit(1);

  if (exists[0]) {
    await db
      .update(educationInstitutionPositionRates)
      .set({
        freelancerUnitAmount: String(data.freelancerUnitAmount ?? 0),
        isActive: data.isActive ?? true,
      } as any)
      .where(
        and(
          eq(educationInstitutionPositionRates.id, exists[0].id),
          eq(educationInstitutionPositionRates.organizationId, organizationId)
        )
      );

    return Number(exists[0].id);
  }

  const result: any = await db.insert(educationInstitutionPositionRates).values({
    organizationId,
    educationInstitutionId: data.educationInstitutionId,
    positionId: data.positionId,
    freelancerUnitAmount: String(data.freelancerUnitAmount ?? 0),
    isActive: data.isActive ?? true,
  } as any);

  return Number(getInsertId(result));
}

export async function deleteEducationInstitutionPositionRate(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(educationInstitutionPositionRates)
    .set({ isActive: false } as any)
    .where(
      and(
        eq(educationInstitutionPositionRates.id, id),
        eq(educationInstitutionPositionRates.organizationId, organizationId)
      )
    );
}

export async function getEducationInstitutionById(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(educationInstitutions)
    .where(
      and(
        eq(educationInstitutions.id, id),
        eq(educationInstitutions.organizationId, organizationId)
      )
    )
    .limit(1);

  return rows[0];
}

export async function bulkReassignConsultationsAndLinkedStudents(
  fromAssigneeId: number,
  toAssigneeId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(consultations)
    .set({ assigneeId: toAssigneeId } as any)
    .where(
  and(
    eq(consultations.assigneeId, fromAssigneeId),
    eq(consultations.organizationId, organizationId)
  )
);

  await db
    .update(students)
    .set({ assigneeId: toAssigneeId } as any)
    .where(
  and(
    eq(students.assigneeId, fromAssigneeId),
    eq(students.organizationId, organizationId)
  )
);
}

export async function updateEducationInstitution(
  id: number,
  data: {
    name?: string;
    isActive?: boolean;
    sortOrder?: number;
    settlementType?: "credit" | "subject" | "fixed";
    unitCostAmount?: string | number;
    normalSubjectPrice?: string | number;
  },
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

  const payload: Record<string, any> = {};

  if (data.name !== undefined) payload.name = data.name;
  if (data.isActive !== undefined) payload.isActive = data.isActive;
  if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder;
  if (data.settlementType !== undefined) payload.settlementType = data.settlementType;
  if (data.unitCostAmount !== undefined) payload.unitCostAmount = String(data.unitCostAmount);
  if (data.normalSubjectPrice !== undefined)
    payload.normalSubjectPrice = String(data.normalSubjectPrice);

  if (Object.keys(payload).length === 0) return;

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(educationInstitutions)
    .set(payload as any)
    .where(
  and(
    eq(educationInstitutions.id, id),
    eq(educationInstitutions.organizationId, organizationId)
  )
);
}

// ─── Transfer Attachments ────────────────────────────────────────────
export async function listTransferAttachments(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(transferAttachments)
    .innerJoin(students, eq(students.id, transferAttachments.studentId))
    .where(
      and(
        eq(transferAttachments.studentId, studentId),
        eq(students.organizationId, organizationId)
      )
    )
    .orderBy(transferAttachments.sortOrder, transferAttachments.id);
}

export async function createTransferAttachment(data: InsertTransferAttachment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(transferAttachments).values(data);
  return getInsertId(result);
}

export async function updateTransferAttachment(
  id: number,
  data: Partial<InsertTransferAttachment>,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select({ id: transferAttachments.id })
    .from(transferAttachments)
    .innerJoin(students, eq(students.id, transferAttachments.studentId))
    .where(
      and(
        eq(transferAttachments.id, id),
        eq(students.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!rows[0]) {
    throw new Error("첨부파일을 찾을 수 없습니다.");
  }

  await db
    .update(transferAttachments)
    .set(data as any)
    .where(eq(transferAttachments.id, id));
}

export async function deleteTransferAttachment(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select({ id: transferAttachments.id })
    .from(transferAttachments)
    .innerJoin(students, eq(students.id, transferAttachments.studentId))
    .where(
      and(
        eq(transferAttachments.id, id),
        eq(students.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!rows[0]) {
    throw new Error("첨부파일을 찾을 수 없습니다.");
  }

  await db.delete(transferAttachments).where(eq(transferAttachments.id, id));
}

// ─── Course Templates ────────────────────────────────────────────────
// ─── Course Templates ────────────────────────────────────────────────
export async function listCourseSubjectTemplates(
  courseKey?: string,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  const conditions: any[] = [
    eq(courseSubjectTemplates.organizationId, organizationId),
    eq(courseSubjectTemplates.isActive, true),
  ];

  if (courseKey) {
    conditions.push(eq(courseSubjectTemplates.courseKey, courseKey));
  }

  return db
    .select()
    .from(courseSubjectTemplates)
    .where(and(...conditions))
    .orderBy(
      courseSubjectTemplates.courseKey,
      courseSubjectTemplates.sortOrder,
      courseSubjectTemplates.id
    );
}

export async function createCourseSubjectTemplate(
  data: InsertCourseSubjectTemplate & { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId((data as any).organizationId);

  const result: any = await db.insert(courseSubjectTemplates).values({
    ...data,
    organizationId,
  } as any);

  return getInsertId(result);
}

export async function bulkCreatePlanSemestersFromTemplate(params: {
  organizationId?: number | null;
  studentId: number;
  semesterNo: number;
  subjectIds: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params.organizationId);

  const student = await getStudent(params.studentId, {
    organizationId,
  });

  if (!student) {
    throw new Error("학생을 찾을 수 없습니다.");
  }

  const subjectIds = Array.from(
    new Set(
      (params.subjectIds || [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0)
    )
  );

  if (!subjectIds.length) {
    return { count: 0 };
  }

  if (subjectIds.length > 8) {
    throw new Error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다");
  }

  const templates = await db
    .select()
    .from(courseSubjectTemplates)
    .where(
      and(
        eq(courseSubjectTemplates.organizationId, organizationId),
        sql`${courseSubjectTemplates.id} IN (${sql.join(
          subjectIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        eq(courseSubjectTemplates.isActive, true)
      )
    )
    .orderBy(courseSubjectTemplates.sortOrder, courseSubjectTemplates.id);

  if (!templates.length) {
    return { count: 0 };
  }

  if (templates.length !== subjectIds.length) {
    throw new Error("선택한 과목 중 현재 회사에 없는 과목이 포함되어 있습니다.");
  }

  if (templates.length > 8) {
    throw new Error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다");
  }

  const templateNames = templates.map((t: any) =>
    normalizeSubjectName(t.subjectName)
  );

  const duplicateInsideSelection = templateNames.find(
    (name: string, idx: number) => templateNames.indexOf(name) !== idx
  );

  if (duplicateInsideSelection) {
    throw new Error(
      `선택한 템플릿 안에 중복 과목이 있습니다: ${duplicateInsideSelection}`
    );
  }

  const existingRows = await listPlanSemesters(params.studentId, {
    organizationId,
  });

  const duplicateInOtherSemester = templates.find((t: any) =>
    existingRows.some(
      (row: any) =>
        Number(row.semesterNo) !== Number(params.semesterNo) &&
        normalizeSubjectName(row.subjectName) ===
          normalizeSubjectName(t.subjectName)
    )
  );

  if (duplicateInOtherSemester) {
    const found = existingRows.find(
      (row: any) =>
        Number(row.semesterNo) !== Number(params.semesterNo) &&
        normalizeSubjectName(row.subjectName) ===
          normalizeSubjectName(duplicateInOtherSemester.subjectName)
    );

    throw new Error(
      `이미 ${found?.semesterNo}학기에 등록된 과목입니다: ${duplicateInOtherSemester.subjectName}`
    );
  }

  await db
    .delete(planSemesters)
    .where(
      and(
        eq(planSemesters.organizationId, organizationId),
        eq(planSemesters.studentId, params.studentId),
        eq(planSemesters.semesterNo, params.semesterNo)
      )
    );

  const rows = templates.map((t: any, idx: number) => ({
    organizationId,
    studentId: params.studentId,
    semesterNo: params.semesterNo,
    subjectName: t.subjectName,
    planCategory: t.category,
    planRequirementType: t.requirementType ?? null,
    credits: 3,
    sortOrder: idx,
  }));

  await db.insert(planSemesters).values(rows as any);

  return { count: rows.length };
}

// 민간자격증 마스터
export async function listPrivateCertificateMasters(options?: {
  organizationId?: number | null;
  activeOnly?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(options?.organizationId);

  const conditions: any[] = [
    eq(privateCertificateMasters.organizationId, organizationId),
  ];

  if (options?.activeOnly) {
    conditions.push(eq(privateCertificateMasters.isActive, true));
  }

  return db
    .select()
    .from(privateCertificateMasters)
    .where(and(...conditions))
    .orderBy(
      asc(privateCertificateMasters.sortOrder),
      asc(privateCertificateMasters.id)
    );
}

export async function createPrivateCertificateMaster(
  data: InsertPrivateCertificateMaster & { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId((data as any).organizationId);

  const name = String(data.name || "").trim();
  if (!name) {
    throw new Error("자격증명을 입력해주세요.");
  }

  const existing = await db
    .select()
    .from(privateCertificateMasters)
    .where(
      and(
        eq(privateCertificateMasters.organizationId, organizationId),
        eq(privateCertificateMasters.name, name)
      )
    )
    .limit(1);

  if (existing[0]) {
    throw new Error("이미 등록된 민간자격증입니다.");
  }

  const [maxRows] = await db.execute(sql`
    SELECT COALESCE(MAX(sortOrder), 0) as maxSortOrder
    FROM private_certificate_masters
    WHERE organizationId = ${organizationId}
  `);

  const nextSortOrder = Number((maxRows as any)?.[0]?.maxSortOrder || 0) + 1;

  const result: any = await db.insert(privateCertificateMasters).values({
    organizationId,
    name,
    sortOrder: (data as any).sortOrder ?? nextSortOrder,
    isActive: (data as any).isActive ?? true,

    defaultFeeAmount: (data as any).defaultFeeAmount ?? "0",
    defaultCompanyShareAmount:
      (data as any).defaultCompanyShareAmount ?? "0",
    defaultFreelancerAmount:
      (data as any).defaultFreelancerAmount ?? "0",
    isSettlementEnabled: (data as any).isSettlementEnabled ?? true,

    createdBy: (data as any).createdBy ?? null,
    updatedBy: (data as any).updatedBy ?? null,
  } as any);

  return getInsertId(result);
}

export async function updatePrivateCertificateMaster(
  id: number,
  data: Partial<InsertPrivateCertificateMaster>,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select({ id: privateCertificateMasters.id })
    .from(privateCertificateMasters)
    .where(
      and(
        eq(privateCertificateMasters.id, id),
        eq(privateCertificateMasters.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!rows[0]) {
    throw new Error("수정할 민간자격증 마스터를 찾을 수 없습니다.");
  }

  await db
    .update(privateCertificateMasters)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.defaultFeeAmount !== undefined
        ? { defaultFeeAmount: data.defaultFeeAmount }
        : {}),
      ...((data as any).defaultCompanyShareAmount !== undefined
        ? {
            defaultCompanyShareAmount:
              (data as any).defaultCompanyShareAmount,
          }
        : {}),
      ...(data.defaultFreelancerAmount !== undefined
        ? { defaultFreelancerAmount: data.defaultFreelancerAmount }
        : {}),
      ...(data.isSettlementEnabled !== undefined
        ? { isSettlementEnabled: data.isSettlementEnabled }
        : {}),
      ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
    } as any)
    .where(
      and(
        eq(privateCertificateMasters.id, id),
        eq(privateCertificateMasters.organizationId, organizationId)
      )
    );
}

export async function deletePrivateCertificateMaster(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .delete(privateCertificateMasters)
    .where(
      and(
        eq(privateCertificateMasters.id, id),
        eq(privateCertificateMasters.organizationId, organizationId)
      )
    );
}

// 과정 마스터
export async function listSubjectCatalogs(options?: {
  organizationId?: number | null;
  activeOnly?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(options?.organizationId);

  const conditions: any[] = [
    eq(subjectCatalogs.organizationId, organizationId),
  ];

  if (options?.activeOnly) {
    conditions.push(eq(subjectCatalogs.isActive, true));
  }

  return db
    .select()
    .from(subjectCatalogs)
    .where(and(...conditions))
    .orderBy(asc(subjectCatalogs.sortOrder), asc(subjectCatalogs.id));
}

export async function createSubjectCatalog(
  data: InsertSubjectCatalog & { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId((data as any).organizationId);

  const name = String(data.name || "").trim();
  if (!name) {
    throw new Error("과정명을 입력해주세요.");
  }

  const existing = await db
    .select()
    .from(subjectCatalogs)
    .where(
      and(
        eq(subjectCatalogs.organizationId, organizationId),
        eq(subjectCatalogs.name, name)
      )
    )
    .limit(1);

  if (existing[0]) {
    throw new Error("이미 등록된 과정입니다.");
  }

  const [maxRows] = await db.execute(sql`
    SELECT COALESCE(MAX(sortOrder), 0) as maxSortOrder
    FROM subject_catalogs
    WHERE organizationId = ${organizationId}
  `);

  const nextSortOrder = Number((maxRows as any)?.[0]?.maxSortOrder || 0) + 1;

  const result: any = await db.insert(subjectCatalogs).values({
    organizationId,
    name,
    sortOrder: (data as any).sortOrder ?? nextSortOrder,
    isActive: (data as any).isActive ?? true,
    createdBy: (data as any).createdBy ?? null,
    updatedBy: (data as any).updatedBy ?? null,
  } as any);

  return getInsertId(result);
}

export async function deleteSubjectCatalog(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select({ id: subjectCatalogs.id })
    .from(subjectCatalogs)
    .where(
      and(
        eq(subjectCatalogs.id, id),
        eq(subjectCatalogs.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!rows[0]) {
    throw new Error("삭제할 과정을 찾을 수 없습니다.");
  }

  await db
    .delete(subjectCatalogItems)
    .where(
      and(
        eq(subjectCatalogItems.catalogId, id),
        eq(subjectCatalogItems.organizationId, organizationId)
      )
    );

  await db
    .delete(subjectCatalogs)
    .where(
      and(
        eq(subjectCatalogs.id, id),
        eq(subjectCatalogs.organizationId, organizationId)
      )
    );
}

// 과목 마스터
export async function listSubjectCatalogItems(params: {
  organizationId?: number | null;
  catalogId: number;
  activeOnly?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);

  const catalogRows = await db
    .select({ id: subjectCatalogs.id })
    .from(subjectCatalogs)
    .where(
      and(
        eq(subjectCatalogs.id, Number(params.catalogId)),
        eq(subjectCatalogs.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!catalogRows[0]) {
    return [];
  }

  const conditions: any[] = [
    eq(subjectCatalogItems.organizationId, organizationId),
    eq(subjectCatalogItems.catalogId, Number(params.catalogId)),
  ];

  if (params.activeOnly) {
    conditions.push(eq(subjectCatalogItems.isActive, true));
  }

  return db
    .select()
    .from(subjectCatalogItems)
    .where(and(...conditions))
    .orderBy(
      asc(subjectCatalogItems.requirementType),
      asc(subjectCatalogItems.sortOrder),
      asc(subjectCatalogItems.id)
    );
}

export async function createSubjectCatalogItem(
  data: InsertSubjectCatalogItem & { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId((data as any).organizationId);

  const subjectName = String(data.subjectName || "").trim();
  if (!subjectName) {
    throw new Error("과목명을 입력해주세요.");
  }

  const requirementType = data.requirementType;
  if (!requirementType) {
    throw new Error("과목 구분을 선택해주세요.");
  }

  const catalogId = Number(data.catalogId || 0);
  if (!catalogId) {
    throw new Error("과정 정보가 없습니다.");
  }

  const catalogRows = await db
    .select({ id: subjectCatalogs.id })
    .from(subjectCatalogs)
    .where(
      and(
        eq(subjectCatalogs.id, catalogId),
        eq(subjectCatalogs.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!catalogRows[0]) {
    throw new Error("현재 회사의 과정이 아닙니다.");
  }

  const existing = await db
    .select()
    .from(subjectCatalogItems)
    .where(
      and(
        eq(subjectCatalogItems.organizationId, organizationId),
        eq(subjectCatalogItems.catalogId, catalogId),
        eq(subjectCatalogItems.subjectName, subjectName),
        eq(subjectCatalogItems.requirementType, requirementType)
      )
    )
    .limit(1);

  if (existing[0]) {
    throw new Error("이미 등록된 과목입니다.");
  }

  const [maxRows] = await db.execute(sql`
    SELECT COALESCE(MAX(sortOrder), 0) as maxSortOrder
    FROM subject_catalog_items
    WHERE organizationId = ${organizationId}
      AND catalogId = ${catalogId}
  `);

  const nextSortOrder = Number((maxRows as any)?.[0]?.maxSortOrder || 0) + 1;

  const result: any = await db.insert(subjectCatalogItems).values({
    organizationId,
    catalogId,
    subjectName,
    requirementType,
    category:
      (data.category as any) ??
      resolveCategoryFromRequirementType(requirementType),
    credits: Number((data as any).credits ?? 3),
    sortOrder: (data as any).sortOrder ?? nextSortOrder,
    isActive: (data as any).isActive ?? true,
    createdBy: (data as any).createdBy ?? null,
    updatedBy: (data as any).updatedBy ?? null,
  } as any);

  return getInsertId(result);
}

export async function deleteSubjectCatalogItem(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .delete(subjectCatalogItems)
    .where(
      and(
        eq(subjectCatalogItems.id, id),
        eq(subjectCatalogItems.organizationId, organizationId)
      )
    );
}

// ─── Private Certificate Requests (민간자격증 요청) ─────────────────
export async function listPrivateCertificateRequests(
  assigneeId?: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select({
      request: privateCertificateRequests,
      studentClientName: students.clientName,
      studentPhone: students.phone,
      studentAddress: students.address,
      userName: users.name,
    })
    .from(privateCertificateRequests)
    .leftJoin(
      students,
      and(
        eq(privateCertificateRequests.studentId, students.id),
        eq(students.organizationId, organizationId)
      )
    )
    .leftJoin(
      users,
      and(
        eq(privateCertificateRequests.assigneeId, users.id),
        eq(users.organizationId, organizationId)
      )
    )
    .where(
      assigneeId
        ? and(
            eq(privateCertificateRequests.organizationId, organizationId),
            eq(privateCertificateRequests.assigneeId, assigneeId)
          )
        : eq(privateCertificateRequests.organizationId, organizationId)
    )
    .orderBy(desc(privateCertificateRequests.id));

  return rows.map((row: any) => ({
    ...row.request,
    clientName:
      String(row.request?.clientName || "").trim() ||
      String(row.studentClientName || "").trim() ||
      null,
    phone:
      String(row.request?.phone || "").trim() ||
      String(row.studentPhone || "").trim() ||
      null,
    assigneeName:
      String(row.request?.assigneeName || "").trim() ||
      String(row.userName || "").trim() ||
      null,
    inputAddress:
      String(row.request?.inputAddress || "").trim() ||
      String(row.studentAddress || "").trim() ||
      null,
  }));
}

export async function listPrivateCertificateRequestsByStudent(
  studentId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select({
      request: privateCertificateRequests,
      studentClientName: students.clientName,
      studentPhone: students.phone,
      studentAddress: students.address,
      userName: users.name,
    })
    .from(privateCertificateRequests)
    .leftJoin(
      students,
      and(
        eq(privateCertificateRequests.studentId, students.id),
        eq(students.organizationId, organizationId)
      )
    )
    .leftJoin(
      users,
      and(
        eq(privateCertificateRequests.assigneeId, users.id),
        eq(users.organizationId, organizationId)
      )
    )
    .where(
      and(
        eq(privateCertificateRequests.organizationId, organizationId),
        eq(privateCertificateRequests.studentId, studentId)
      )
    )
    .orderBy(desc(privateCertificateRequests.id));

  return rows.map((row: any) => ({
    ...row.request,
    clientName:
      String(row.request?.clientName || "").trim() ||
      String(row.studentClientName || "").trim() ||
      null,
    phone:
      String(row.request?.phone || "").trim() ||
      String(row.studentPhone || "").trim() ||
      null,
    assigneeName:
      String(row.request?.assigneeName || "").trim() ||
      String(row.userName || "").trim() ||
      null,
    inputAddress:
      String(row.request?.inputAddress || "").trim() ||
      String(row.studentAddress || "").trim() ||
      null,
  }));
}

export async function updatePrivateCertificateMaster(
  id: number,
  data: Partial<InsertPrivateCertificateMaster>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(privateCertificateMasters)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.defaultFeeAmount !== undefined
  ? { defaultFeeAmount: data.defaultFeeAmount }
  : {}),
...((data as any).defaultCompanyShareAmount !== undefined
  ? { defaultCompanyShareAmount: (data as any).defaultCompanyShareAmount }
  : {}),
...(data.defaultFreelancerAmount !== undefined
  ? { defaultFreelancerAmount: data.defaultFreelancerAmount }
  : {}),
      ...(data.isSettlementEnabled !== undefined
        ? { isSettlementEnabled: data.isSettlementEnabled }
        : {}),
      ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
    } as any)
    .where(eq(privateCertificateMasters.id, id));

  return true;
}

export async function createPrivateCertificateRequest(data: InsertPrivateCertificateRequest) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

   const result: any = await db.insert(privateCertificateRequests).values({
  ...data,
  feeAmount: data.feeAmount ?? "0",
  freelancerInputAmount: data.freelancerInputAmount ?? "0",
  paymentStatus: data.paymentStatus ?? "결제대기",
});

  const insertId = getInsertId(result);

  if (insertId) {
    await syncPrivateCertificateSettlementItemByRequestId(
  Number(insertId),
  undefined,
  {
    organizationId,
  }
);
  }

  return insertId;
}

export async function updatePrivateCertificateRequest(
  id: number,
  data: Partial<InsertPrivateCertificateRequest>,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  try {
    console.log("[privateCertificate.update] id =", id);
    console.log("[privateCertificate.update] organizationId =", organizationId);
    console.log("[privateCertificate.update] data =", data);

    await db
      .update(privateCertificateRequests)
      .set(data as any)
      .where(
        and(
          eq(privateCertificateRequests.id, id),
          eq(privateCertificateRequests.organizationId, organizationId)
        )
      );

    await syncPrivateCertificateSettlementItemByRequestId(id, undefined, {
      organizationId,
    });
  } catch (err: any) {
    console.error("[privateCertificate.update ERROR]", err);
    console.error("[privateCertificate.update ERROR message]", err?.message);
    console.error("[privateCertificate.update ERROR cause]", err?.cause);
    console.error("[privateCertificate.update ERROR sqlMessage]", err?.sqlMessage);
    console.error("[privateCertificate.update ERROR code]", err?.code);
    console.error("[privateCertificate.update ERROR errno]", err?.errno);
    console.error("[privateCertificate.update ERROR sql]", err?.sql);
    console.error("[privateCertificate.update ERROR params]", err?.params);

    throw err;
  }
}

export async function deletePrivateCertificateRequest(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await cancelSettlementItemBySource({
    organizationId,
    revenueType: "private_certificate",
    sourceId: id,
    note: "민간자격증 요청 삭제로 정산 취소",
  } as any);

  await db
    .delete(privateCertificateRequests)
    .where(
      and(
        eq(privateCertificateRequests.id, id),
        eq(privateCertificateRequests.organizationId, organizationId)
      )
    );
}

export async function requestPrivateCertificateRefund(params: {
  organizationId?: number | null;
  requestId: number;
  refundAmount: string | number;
  refundReason?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select()
    .from(privateCertificateRequests)
    .where(
  and(
    eq(privateCertificateRequests.id, params.requestId),
    eq(privateCertificateRequests.organizationId, organizationId)
  )
)
    .limit(1);

  const request = rows[0];
  if (!request) {
    throw new Error("민간자격증 요청 데이터를 찾을 수 없습니다.");
  }

  if (request.paymentStatus !== "결제") {
    throw new Error("결제 완료된 건만 환불 요청할 수 있습니다.");
  }

  await db
    .update(privateCertificateRequests)
    .set({
      refundStatus: "환불요청",
      refundAmount: String(toNumber(params.refundAmount)),
      refundReason: params.refundReason ?? null,
      refundRequestedAt: new Date(),
    } as any)
    .where(
  and(
    eq(privateCertificateRequests.id, params.requestId),
    eq(privateCertificateRequests.organizationId, organizationId)
  )
);

  return true;
}

export async function approvePrivateCertificateRefund(params: {
  organizationId?: number | null;
  requestId: number;
  approvedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select({
      request: privateCertificateRequests,
      master: privateCertificateMasters,
    })
    .from(privateCertificateRequests)
    .leftJoin(
      privateCertificateMasters,
      eq(privateCertificateRequests.privateCertificateMasterId, privateCertificateMasters.id)
    )
    .where(
  and(
    eq(privateCertificateRequests.id, params.requestId),
    eq(privateCertificateRequests.organizationId, organizationId)
  )
)
    .limit(1);

  const row = rows[0];
  if (!row?.request) {
    throw new Error("민간자격증 요청 데이터를 찾을 수 없습니다.");
  }

  const request = row.request;
  const refundAmount = toNumber((request as any).refundAmount ?? request.feeAmount ?? 0);

  await db
    .update(privateCertificateRequests)
    .set({
      refundStatus: "환불승인",
      refundApprovedAt: new Date(),
      refundApprovedBy: params.approvedBy,
      paymentStatus: "환불",
    } as any)
    .where(
  and(
    eq(privateCertificateRequests.id, params.requestId),
    eq(privateCertificateRequests.organizationId, organizationId)
  )
);

  await refundSettlementItemBySource({
  organizationId,
  revenueType: "private_certificate",
  sourceId: Number(request.id),
  refundAmount,
  refundDate: new Date(),
  actorUserId: params.approvedBy,
  note: "민간자격증 환불 승인",
  payload: {
    requestId: request.id,
    privateCertificateMasterId: (request as any).privateCertificateMasterId ?? null,
    privateCertificateName: row.master?.name ?? null,
    refundAmount,
  },
} as any);

  return true;
}



// ─── Practice Support Requests (실습배정지원센터) ───────────────────
export async function listPracticeSupportRequests(params?: {
  organizationId?: number | null;
  assigneeId?: number;
  month?: string;
  status?: "전체" | "미섭외" | "섭외중" | "섭외완료";
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const conditions: any[] = [
  sql`s.organizationId = ${organizationId}`,
  sql`(psr.organizationId IS NULL OR psr.organizationId = ${organizationId})`,
  sql`s.approvalStatus = '승인'`,
];

  if (params?.assigneeId) {
    conditions.push(sql`s.assigneeId = ${params.assigneeId}`);
  }

  if (params?.month && params.month !== "전체") {
  conditions.push(
    sql`LEFT(TRIM(COALESCE(psr.practiceDate, p.practiceDate, '')), 7) = ${params.month}`
  );
}

  if (params?.status && params.status !== "전체") {
    conditions.push(
      sql`COALESCE(psr.coordinationStatus, '미섭외') = ${params.status}`
    );
  }

  if (params?.search?.trim()) {
    const keyword = `%${params.search.trim()}%`;

    conditions.push(sql`
      (
        COALESCE(psr.clientName, s.clientName, '') LIKE ${keyword}
        OR COALESCE(psr.phone, s.phone, '') LIKE ${keyword}
        OR COALESCE(psr.course, s.course, p.desiredCourse, '') LIKE ${keyword}
        OR COALESCE(psr.managerName, psr.assigneeName, u.name, '') LIKE ${keyword}
        OR COALESCE(psr.inputAddress, s.address, '') LIKE ${keyword}
      )
    `);
  }

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

  const [rows] = await db.execute(sql`
  SELECT
    psr.id,
    psr.studentId,
    psr.assigneeId,
    psr.clientName,
    psr.phone,
    psr.course,
    psr.inputAddress,
    psr.detailAddress,
    psr.assigneeName,
    psr.managerName,
    psr.practiceHours,
    psr.practiceDate,
    psr.includeEducationCenter,
    psr.includePracticeInstitution,
    psr.coordinationStatus,
    psr.selectedEducationCenterId,
    psr.selectedEducationCenterName,
    psr.selectedEducationCenterAddress,
    psr.selectedEducationCenterDistanceKm,
    psr.selectedPracticeInstitutionId,
    psr.selectedPracticeInstitutionName,
    psr.selectedPracticeInstitutionAddress,
    psr.selectedPracticeInstitutionDistanceKm,
    psr.feeAmount,
    psr.paymentStatus,
    psr.note,
    psr.createdAt,
    psr.updatedAt,

    s.clientName AS studentClientName,
    s.phone AS studentPhone,
    s.assigneeId AS studentAssigneeId,
    s.address AS studentAddress,
    s.detailAddress AS studentDetailAddress,
    s.course AS studentCourse,

    p.practiceDate AS planPracticeDate,
    p.practiceHours AS planPracticeHours,
    p.desiredCourse AS planDesiredCourse,

    u.name AS userName
  FROM practice_support_requests psr
  INNER JOIN students s
    ON s.id = psr.studentId
  LEFT JOIN plans p
    ON p.studentId = s.id
  LEFT JOIN users u
    ON u.id = s.assigneeId
  ${whereClause}
  ORDER BY
    LEFT(TRIM(COALESCE(psr.practiceDate, p.practiceDate, '')), 7) ASC,
    psr.id DESC
`);

  return (rows as any[]).map((row) => ({
    id: row.id ? Number(row.id) : null,
    practiceSupportRequestId: row.id ? Number(row.id) : null,
    hasPracticeSupportRequest: !!row.id,

    studentId: Number(row.studentId),
    semesterId: null,
    semesterOrder: 1,
    semesterUpdatedAt: row.updatedAt || null,

    clientName: row.clientName || row.studentClientName || "",
    phone: row.phone || row.studentPhone || "",
    course: row.course || row.studentCourse || row.planDesiredCourse || "",
    inputAddress: row.inputAddress || row.studentAddress || null,
    detailAddress: row.detailAddress || row.studentDetailAddress || null,
    assigneeId: row.assigneeId ?? row.studentAssigneeId ?? null,
    assigneeName: row.assigneeName || row.userName || null,
    managerName: row.managerName || row.userName || "",
    practiceHours: row.practiceHours ?? row.planPracticeHours ?? null,
    practiceDate: row.practiceDate || row.planPracticeDate || null,
    coordinationStatus: row.coordinationStatus || "미섭외",

    selectedEducationCenterId: row.selectedEducationCenterId || null,
    selectedEducationCenterName: row.selectedEducationCenterName || "",
    selectedEducationCenterAddress: row.selectedEducationCenterAddress || "",
    selectedEducationCenterDistanceKm: row.selectedEducationCenterDistanceKm || "",

    selectedPracticeInstitutionId: row.selectedPracticeInstitutionId || null,
    selectedPracticeInstitutionName: row.selectedPracticeInstitutionName || "",
    selectedPracticeInstitutionAddress: row.selectedPracticeInstitutionAddress || "",
    selectedPracticeInstitutionDistanceKm: row.selectedPracticeInstitutionDistanceKm || "",

    feeAmount: row.feeAmount || "0",
    paymentStatus: row.paymentStatus || "미결제",
    note: row.note || "",
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  }));
}

export async function listPracticeSupportRequestsByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
  SELECT
    psr.id,
    psr.studentId,
    psr.assigneeId,
    psr.clientName,
    psr.phone,
    psr.course,
    psr.inputAddress,
    psr.detailAddress,
    psr.assigneeName,
    psr.managerName,
    psr.practiceHours,
    psr.practiceDate,
    psr.includeEducationCenter,
    psr.includePracticeInstitution,
    psr.coordinationStatus,
    psr.selectedEducationCenterId,
    psr.selectedEducationCenterName,
    psr.selectedEducationCenterAddress,
    psr.selectedEducationCenterDistanceKm,
    psr.selectedPracticeInstitutionId,
    psr.selectedPracticeInstitutionName,
    psr.selectedPracticeInstitutionAddress,
    psr.selectedPracticeInstitutionDistanceKm,
    psr.feeAmount,
    psr.paymentStatus,
    psr.note,
    psr.createdAt,
    psr.updatedAt,

    s.clientName AS studentClientName,
    s.phone AS studentPhone,
    s.assigneeId AS studentAssigneeId,
    s.address AS studentAddress,
    s.detailAddress AS studentDetailAddress,
    s.course AS studentCourse,

    p.practiceDate AS planPracticeDate,
    p.practiceHours AS planPracticeHours,
    p.desiredCourse AS planDesiredCourse,

    u.name AS userName
  FROM students s
  LEFT JOIN practice_support_requests psr
    ON psr.studentId = s.id
  LEFT JOIN plans p
    ON p.studentId = s.id
  LEFT JOIN users u
    ON u.id = s.assigneeId
  WHERE s.id = ${studentId}
  LIMIT 1
`);

  const row = (rows as any[])[0];
if (!row) return [];

return [
  {
    id: row.id ? Number(row.id) : null,
    practiceSupportRequestId: row.id ? Number(row.id) : null,
    hasPracticeSupportRequest: !!row.id,

    studentId: Number(row.studentId),
    semesterId: null,
    semesterOrder: 1,

    clientName: row.clientName || row.studentClientName || "",
    phone: row.phone || row.studentPhone || "",
    course: row.course || row.studentCourse || row.planDesiredCourse || "",
    inputAddress: row.inputAddress || row.studentAddress || "",
    detailAddress: row.detailAddress || row.studentDetailAddress || "",
    assigneeId: row.assigneeId ?? row.studentAssigneeId ?? null,
    assigneeName: row.assigneeName || row.userName || null,
    managerName: row.managerName || row.userName || "",
    practiceHours: row.practiceHours ?? row.planPracticeHours ?? null,
    practiceDate: row.practiceDate || row.planPracticeDate || null,
    coordinationStatus: row.coordinationStatus || "미섭외",

    selectedEducationCenterId: row.selectedEducationCenterId || null,
    selectedEducationCenterName: row.selectedEducationCenterName || "",
    selectedEducationCenterAddress: row.selectedEducationCenterAddress || "",
    selectedEducationCenterDistanceKm: row.selectedEducationCenterDistanceKm || "",

    selectedPracticeInstitutionId: row.selectedPracticeInstitutionId || null,
    selectedPracticeInstitutionName: row.selectedPracticeInstitutionName || "",
    selectedPracticeInstitutionAddress: row.selectedPracticeInstitutionAddress || "",
    selectedPracticeInstitutionDistanceKm: row.selectedPracticeInstitutionDistanceKm || "",

    feeAmount: row.feeAmount || "0",
    paymentStatus: row.paymentStatus || "미결제",
    note: row.note || "",
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  },
];
}

export async function getPracticeSupportRequest(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return undefined;

const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
    SELECT
      psr.id,
      psr.studentId,
      psr.assigneeId,
      psr.clientName,
      psr.phone,
      psr.course,
      psr.inputAddress,
      psr.detailAddress,
      psr.assigneeName,
      psr.managerName,
      psr.practiceHours,
      psr.practiceDate,
      psr.includeEducationCenter,
      psr.includePracticeInstitution,
      psr.coordinationStatus,
      psr.selectedEducationCenterId,
      psr.selectedEducationCenterName,
      psr.selectedEducationCenterAddress,
      psr.selectedEducationCenterDistanceKm,
      psr.selectedPracticeInstitutionId,
      psr.selectedPracticeInstitutionName,
      psr.selectedPracticeInstitutionAddress,
      psr.selectedPracticeInstitutionDistanceKm,
      psr.feeAmount,
      psr.paymentStatus,
      psr.note,
      psr.createdAt,
      psr.updatedAt,

      s.clientName AS studentClientName,
      s.phone AS studentPhone,
      s.assigneeId AS studentAssigneeId,
      s.address AS studentAddress,
      s.detailAddress AS studentDetailAddress,
      s.course AS studentCourse,

      p.practiceDate AS planPracticeDate,
      p.practiceHours AS planPracticeHours,
      p.desiredCourse AS planDesiredCourse,

      u.name AS userName
    FROM practice_support_requests psr
    INNER JOIN students s
      ON s.id = psr.studentId
    LEFT JOIN plans p
      ON p.studentId = s.id
    LEFT JOIN users u
      ON u.id = COALESCE(psr.assigneeId, s.assigneeId)
    WHERE psr.id = ${id}
  AND psr.organizationId = ${organizationId}
  AND s.organizationId = ${organizationId}
LIMIT 1
  `);

  const row = (rows as any[])[0];
  if (!row) return undefined;

  return {
    id: Number(row.id),
    practiceSupportRequestId: Number(row.id),
    hasPracticeSupportRequest: true,

    studentId: Number(row.studentId),
    semesterId: null,
    semesterOrder: 1,

    clientName: row.clientName || row.studentClientName || "",
    phone: row.phone || row.studentPhone || "",
    course: row.course || row.studentCourse || row.planDesiredCourse || "",
    inputAddress: row.inputAddress || row.studentAddress || "",
    detailAddress: row.detailAddress || row.studentDetailAddress || "",
    assigneeId: row.assigneeId || row.studentAssigneeId || null,
    assigneeName: row.assigneeName || row.userName || "",
    managerName: row.managerName || row.userName || "",
    practiceHours: row.practiceHours ?? row.planPracticeHours ?? null,
    practiceDate: row.practiceDate || row.planPracticeDate || null,
    coordinationStatus: row.coordinationStatus || "미섭외",

    selectedEducationCenterId: row.selectedEducationCenterId || null,
    selectedEducationCenterName: row.selectedEducationCenterName || "",
    selectedEducationCenterAddress: row.selectedEducationCenterAddress || "",
    selectedEducationCenterDistanceKm: row.selectedEducationCenterDistanceKm || "",

    selectedPracticeInstitutionId: row.selectedPracticeInstitutionId || null,
    selectedPracticeInstitutionName: row.selectedPracticeInstitutionName || "",
    selectedPracticeInstitutionAddress: row.selectedPracticeInstitutionAddress || "",
    selectedPracticeInstitutionDistanceKm: row.selectedPracticeInstitutionDistanceKm || "",

    feeAmount: row.feeAmount || "0",
    paymentStatus: row.paymentStatus || "미결제",
    note: row.note || "",
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

export async function createPracticeSupportRequest(data: InsertPracticeSupportRequest) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(practiceSupportRequests).values({
    ...data,
    feeAmount: data.feeAmount ?? "0",
    paymentStatus: data.paymentStatus ?? "미결제",
    coordinationStatus: data.coordinationStatus ?? "미섭외",
  });

  const insertId = getInsertId(result);

  if (insertId) {
    await syncPracticeSupportSettlementItemByRequestId(Number(insertId));
  }

  return insertId;
}

export async function updatePracticeSupportRequest(
  id: number,
  data: Partial<InsertPracticeSupportRequest>,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(practiceSupportRequests)
    .set(data as any)
    .where(
  and(
    eq(practiceSupportRequests.id, id),
    eq(practiceSupportRequests.organizationId, requireOrganizationId(params?.organizationId))
  )
);

  await syncPracticeSupportSettlementItemByRequestId(id, undefined, {
  organizationId: requireOrganizationId(params?.organizationId),
});
}

export async function deletePracticeSupportRequest(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await cancelSettlementItemBySource({
  organizationId,
  revenueType: "practice_support",
  sourceId: id,
  note: "실습배정지원 요청 삭제로 정산 취소",
});

  await db
  .delete(practiceSupportRequests)
  .where(
    and(
      eq(practiceSupportRequests.id, id),
      eq(practiceSupportRequests.organizationId, organizationId)
    )
  );
}

export async function requestPracticeSupportRefund(params: {
  organizationId?: number | null;
  requestId: number;
  refundAmount: string | number;
  refundReason?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select()
    .from(practiceSupportRequests)
    .where(
  and(
    eq(practiceSupportRequests.id, params.requestId),
    eq(practiceSupportRequests.organizationId, organizationId)
  )
)
    .limit(1);

  const request = rows[0];
  if (!request) {
    throw new Error("실습배정지원 요청 데이터를 찾을 수 없습니다.");
  }

  if (request.paymentStatus !== "결제") {
    throw new Error("결제 완료된 건만 환불 요청할 수 있습니다.");
  }

  await db
    .update(practiceSupportRequests)
    .set({
      refundStatus: "환불요청",
      refundAmount: String(toNumber(params.refundAmount)),
      refundReason: params.refundReason ?? null,
      refundRequestedAt: new Date(),
    } as any)
    .where(
  and(
    eq(practiceSupportRequests.id, params.requestId),
    eq(practiceSupportRequests.organizationId, organizationId)
  )
);

  return true;
}

export async function approvePracticeSupportRefund(params: {
  organizationId?: number | null;
  requestId: number;
  approvedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select()
    .from(practiceSupportRequests)
    .where(
  and(
    eq(practiceSupportRequests.id, params.requestId),
    eq(practiceSupportRequests.organizationId, organizationId)
  )
)
    .limit(1);

  const request = rows[0];
  if (!request) {
    throw new Error("실습배정지원 요청 데이터를 찾을 수 없습니다.");
  }

  const refundAmount = toNumber((request as any).refundAmount ?? request.feeAmount ?? 0);

  await db
    .update(practiceSupportRequests)
    .set({
      refundStatus: "환불승인",
      refundApprovedAt: new Date(),
      refundApprovedBy: params.approvedBy,
      paymentStatus: "환불",
    } as any)
    .where(
  and(
    eq(practiceSupportRequests.id, params.requestId),
    eq(practiceSupportRequests.organizationId, organizationId)
  )
);

  await refundSettlementItemBySource({
    revenueType: "practice_support",
  organizationId,
    sourceId: Number(request.id),
    refundAmount,
    refundDate: new Date(),
    actorUserId: params.approvedBy,
    note: "실습배정지원 환불 승인",
    payload: {
      requestId: request.id,
      refundAmount,
    },
  });

  return true;
}

export async function upsertPracticeSupportRequestByStudent(params: {
  organizationId?: number | null;
  studentId: number;
  semesterId?: number | null;
  assigneeId: number;
  clientName: string;
  phone: string;
  course: string;
  inputAddress?: string | null;
  detailAddress?: string | null;
  assigneeName?: string | null;
  managerName?: string | null;
  practiceHours?: number | null;
  practiceDate?: string | null;
  includeEducationCenter?: boolean;
  includePracticeInstitution?: boolean;
  coordinationStatus?: "미섭외" | "섭외중" | "섭외완료";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  const existing = await db
  .select()
  .from(practiceSupportRequests)
  .where(
  and(
    eq(practiceSupportRequests.organizationId, organizationId),
    eq(practiceSupportRequests.studentId, params.studentId)
  )
)
  .limit(1);

  const nextCoordinationStatus =
  params.coordinationStatus ?? "미섭외";

const payload: any = {
organizationId,
  studentId: params.studentId,
  semesterId: null,
  assigneeId: params.assigneeId,
  clientName: params.clientName,
  phone: params.phone,
  course: params.course,
  inputAddress: params.inputAddress ?? null,
  detailAddress: params.detailAddress ?? null,
  assigneeName: params.assigneeName ?? null,
  managerName: params.managerName ?? null,
  practiceHours: params.practiceHours ?? null,
  practiceDate: params.practiceDate ?? null,
  includeEducationCenter: params.includeEducationCenter ?? true,
  includePracticeInstitution: params.includePracticeInstitution ?? true,
  coordinationStatus: params.coordinationStatus ?? "미섭외",
  paymentStatus: "미결제",
  feeAmount: "0",
};

  if (existing[0]) {
    await db
      .update(practiceSupportRequests)
      .set(payload)
      .where(
  and(
    eq(practiceSupportRequests.id, existing[0].id),
    eq(practiceSupportRequests.organizationId, organizationId)
  )
);

    if (params.semesterId) {
     await db
  .update(semesters)
  .set({
    practiceStatus: nextCoordinationStatus,
    practiceSupportRequestId: existing[0].id,
  } as any)
  .where(
  and(
    eq(semesters.id, params.semesterId),
    eq(semesters.organizationId, organizationId)
  )
);
    }

    await db
  .update(plans)
  .set({
    hasPractice: true,
    practiceHours: params.practiceHours ?? null,
    practiceStatus: nextCoordinationStatus,
  } as any)
  .where(
  and(
    eq(plans.studentId, params.studentId),
    eq(plans.organizationId, organizationId)
  )
);

    return existing[0].id;
  }

  const result: any = await db.insert(practiceSupportRequests).values(payload);
  const insertId = getInsertId(result);

  if (params.semesterId && insertId) {
    await db
  .update(semesters)
  .set({
    practiceStatus: nextCoordinationStatus,
    practiceSupportRequestId: insertId,
  } as any)
  .where(
  and(
    eq(semesters.id, params.semesterId),
    eq(semesters.organizationId, organizationId)
  )
);
  }

  await db
  .update(plans)
  .set({
    hasPractice: true,
    practiceHours: params.practiceHours ?? null,
    practiceStatus: nextCoordinationStatus,
  } as any)
  .where(
  and(
    eq(plans.studentId, params.studentId),
    eq(plans.organizationId, organizationId)
  )
);

  return insertId;
}

export async function updatePracticeSupportStatusAndSyncSemester(params: {
  organizationId?: number | null;
  practiceSupportRequestId: number;
  coordinationStatus: "미섭외" | "섭외중" | "섭외완료";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  const row = await db
    .select()
    .from(practiceSupportRequests)
    .where(
  and(
    eq(practiceSupportRequests.id, params.practiceSupportRequestId),
    eq(practiceSupportRequests.organizationId, organizationId)
  )
)
    .limit(1);

  const target = row[0];
  if (!target) throw new Error("Practice support request not found");

  await db
    .update(practiceSupportRequests)
    .set({
      coordinationStatus: params.coordinationStatus,
    } as any)
    .where(
  and(
    eq(practiceSupportRequests.id, params.practiceSupportRequestId),
    eq(practiceSupportRequests.organizationId, organizationId)
  )
);
  if (target.semesterId) {
    await db
      .update(semesters)
      .set({
        practiceStatus: params.coordinationStatus,
        practiceSupportRequestId: target.id,
      } as any)
      .where(
  and(
    eq(semesters.id, target.semesterId),
    eq(semesters.organizationId, organizationId)
  )
);
  }

  await db
    .update(plans)
    .set({
      practiceStatus: params.coordinationStatus,
    } as any)
    .where(
  and(
    eq(plans.studentId, target.studentId),
    eq(plans.organizationId, organizationId)
  )
);

  return true;
}

export async function selectPracticeInstitutionForRequest(params: {
  organizationId?: number | null;
  practiceSupportRequestId: number;
  institutionId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  const requestRows = await db
    .select()
    .from(practiceSupportRequests)
    .where(
  and(
    eq(practiceSupportRequests.id, params.practiceSupportRequestId),
    eq(practiceSupportRequests.organizationId, organizationId)
  )
)
    .limit(1);

  const institutionRows = await db
    .select()
    .from(practiceInstitutions)
    .where(
  and(
    eq(practiceInstitutions.id, params.institutionId),
    eq(practiceInstitutions.organizationId, organizationId)
  )
)
    .limit(1);

  const request = requestRows[0];
  const institution = institutionRows[0];

  if (!request) throw new Error("Practice support request not found");
  if (!institution) throw new Error("Practice institution not found");

  const updateData: any = {};

  const student = await getStudent(request.studentId, {
  organizationId,
});
  const studentLat = toNullableNumber((student as any)?.latitude);
  const studentLng = toNullableNumber((student as any)?.longitude);
  const institutionLat = toNullableNumber((institution as any)?.latitude);
  const institutionLng = toNullableNumber((institution as any)?.longitude);

  let distanceKm: number | null = null;
  if (
    studentLat !== null &&
    studentLng !== null &&
    institutionLat !== null &&
    institutionLng !== null
  ) {
    distanceKm = Number(
      haversineDistanceKm(studentLat, studentLng, institutionLat, institutionLng).toFixed(2)
    );
  }

  if (institution.institutionType === "education") {
    updateData.selectedEducationCenterId = institution.id;
    updateData.selectedEducationCenterName = institution.name;
    updateData.selectedEducationCenterAddress = institution.address;
    updateData.selectedEducationCenterDistanceKm =
      distanceKm === null ? null : String(distanceKm);
  }

  if (institution.institutionType === "institution") {
    updateData.selectedPracticeInstitutionId = institution.id;
    updateData.selectedPracticeInstitutionName = institution.name;
    updateData.selectedPracticeInstitutionAddress = institution.address;
    updateData.selectedPracticeInstitutionDistanceKm =
      distanceKm === null ? null : String(distanceKm);
  }

  await db
    .update(practiceSupportRequests)
    .set(updateData)
    .where(
  and(
    eq(practiceSupportRequests.id, params.practiceSupportRequestId),
    eq(practiceSupportRequests.organizationId, organizationId)
  )
);

  return true;
}

// ─── Practice Institutions (실습기관/실습교육원 마스터) ──────────────
export async function listPracticeListCategories(
  listType?: "education" | "institution",
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  if (listType) {
    return db
      .select()
      .from(practiceListCategories)
      .where(
        and(
  eq(practiceListCategories.organizationId, organizationId),
  eq(practiceListCategories.listType, listType),
  eq(practiceListCategories.isActive, true)
)
      )
      .orderBy(practiceListCategories.sortOrder, desc(practiceListCategories.createdAt));
  }

  return db
    .select()
    .from(practiceListCategories)
    .where(
  and(
    eq(practiceListCategories.organizationId, organizationId),
    eq(practiceListCategories.isActive, true)
  )
)
    .orderBy(practiceListCategories.sortOrder, desc(practiceListCategories.createdAt));
}

export async function createPracticeListCategory(
  data: InsertPracticeListCategory & {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(data.organizationId);

  const result: any = await db.insert(practiceListCategories).values({
    ...data,
  organizationId,
    sortOrder: (data as any).sortOrder ?? 0,
    isActive: (data as any).isActive ?? true,
  });

  return getInsertId(result);
}

export async function updatePracticeListCategory(
  id: number,
  data: Partial<InsertPracticeListCategory>,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(practiceListCategories)
    .set(data as any)
    .where(
  and(
    eq(practiceListCategories.id, id),
    eq(practiceListCategories.organizationId, organizationId)
  )
);
}

export async function deletePracticeListCategory(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .delete(practiceListCategories)
    .where(
  and(
    eq(practiceListCategories.id, id),
    eq(practiceListCategories.organizationId, organizationId)
  )
);
}

export async function listPracticeInstitutions(params?: {
  organizationId?: number | null;
  institutionType?: "education" | "institution";
  categoryId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const conditions = [
  eq(practiceInstitutions.organizationId, organizationId),
  eq(practiceInstitutions.isActive, true),
];

  if (params?.institutionType) {
    conditions.push(
      eq(practiceInstitutions.institutionType, params.institutionType)
    );
  }

  if (params?.categoryId) {
    conditions.push(eq(practiceInstitutions.categoryId, params.categoryId));
  }

  return db
    .select()
    .from(practiceInstitutions)
    .where(and(...conditions))
    .orderBy(
      practiceInstitutions.sortOrder,
      desc(practiceInstitutions.createdAt)
    );
}

export async function getPracticeInstitution(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(practiceInstitutions)
    .where(
      and(
        eq(practiceInstitutions.id, id),
        eq(practiceInstitutions.organizationId, organizationId)
      )
    )
    .limit(1);

  return rows[0];
}

export async function createPracticeInstitution(data: InsertPracticeInstitution) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(practiceInstitutions).values({
    ...data,
    price: data.price ?? "0",
    isActive: data.isActive ?? true,
  });

  return getInsertId(result);
}

export async function updatePracticeInstitution(
  id: number,
  data: Partial<InsertPracticeInstitution>,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(practiceInstitutions)
    .set(data as any)
    .where(
      and(
        eq(practiceInstitutions.id, id),
        eq(practiceInstitutions.organizationId, organizationId)
      )
    );
}

export async function deletePracticeInstitution(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .delete(practiceInstitutions)
    .where(
      and(
        eq(practiceInstitutions.id, id),
        eq(practiceInstitutions.organizationId, organizationId)
      )
    );
}

export async function bulkCreatePracticeInstitutions(
  dataList: InsertPracticeInstitution[],
  options?: {
    organizationId?: number | null;
    mode?: "append" | "replace";
    categoryId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (!dataList.length) return { success: true, count: 0 };

  const organizationId = requireOrganizationId(options?.organizationId);

  if (options?.mode === "replace" && options?.categoryId) {
    await db
      .delete(practiceInstitutions)
      .where(
        and(
          eq(practiceInstitutions.organizationId, organizationId),
          eq(practiceInstitutions.categoryId, options.categoryId)
        )
      );
  }

  let createdCount = 0;
  let updatedCount = 0;
  const failedRows: Array<{
    rowIndex: number;
    name?: string;
    address?: string;
    reason: string;
  }> = [];

  for (let idx = 0; idx < dataList.length; idx++) {
    const row = dataList[idx];

    try {
      const value = {
        organizationId,
        institutionType: row.institutionType ?? "institution",
        categoryId: row.categoryId ?? options?.categoryId ?? null,
        name: row.name.trim(),
        representativeName: row.representativeName?.trim() || null,
        phone: row.phone?.trim() || null,
        address: row.address?.trim() || null,
        detailAddress: row.detailAddress?.trim() || null,
        price: row.price || "0",
        latitude: row.latitude || null,
        longitude: row.longitude || null,
        availableCourse: row.availableCourse?.trim() || null,
        memo: row.memo || null,
        isActive: row.isActive ?? true,
        sortOrder: row.sortOrder ?? idx,
      };

      if (!value.name) {
        failedRows.push({
          rowIndex: idx + 2,
          name: row.name,
          address: row.address,
          reason: "이름이 비어 있습니다.",
        });
        continue;
      }

      const existing = await db
        .select()
        .from(practiceInstitutions)
        .where(
          and(
            eq(practiceInstitutions.organizationId, organizationId),
            eq(practiceInstitutions.institutionType, value.institutionType),
            eq(practiceInstitutions.categoryId, value.categoryId),
            eq(practiceInstitutions.name, value.name),
            eq(practiceInstitutions.address, value.address)
          )
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(practiceInstitutions)
          .set(value as any)
          .where(
            and(
              eq(practiceInstitutions.id, existing[0].id),
              eq(practiceInstitutions.organizationId, organizationId)
            )
          );

        updatedCount += 1;
      } else {
        await db.insert(practiceInstitutions).values(value as any);
        createdCount += 1;
      }
    } catch (error: any) {
      failedRows.push({
        rowIndex: idx + 2,
        name: row.name,
        address: row.address,
        reason: error?.message || "등록 중 오류가 발생했습니다.",
      });
    }
  }

  return {
    success: true,
    mode: options?.mode ?? "append",
    total: dataList.length,
    created: createdCount,
    updated: updatedCount,
    failed: failedRows.length,
    failedRows,
  };
}

export async function bulkDeactivatePracticeInstitutions(params: {
  institutionType?: "education" | "institution";
  inactiveReason?: string | null;
  inactiveStartDate?: string | null;
  inactiveEndDate?: string | null;
  hideOnMapWhenInactive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  if (params.institutionType) {
    await db
      .update(practiceInstitutions)
      .set({
        isInactive: true,
        inactiveReason: params.inactiveReason ?? "일괄 비활성화",
        inactiveStartDate: params.inactiveStartDate ?? null,
        inactiveEndDate: params.inactiveEndDate ?? null,
        hideOnMapWhenInactive: params.hideOnMapWhenInactive ?? true,
      } as any)
      .where(eq(practiceInstitutions.institutionType, params.institutionType));
  } else {
    await db
      .update(practiceInstitutions)
      .set({
        isInactive: true,
        inactiveReason: params.inactiveReason ?? "일괄 비활성화",
        inactiveStartDate: params.inactiveStartDate ?? null,
        inactiveEndDate: params.inactiveEndDate ?? null,
        hideOnMapWhenInactive: params.hideOnMapWhenInactive ?? true,
      } as any);
  }

  return { success: true };
}


export async function listPracticeEducationCenters(
  categoryId?: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  if (categoryId) {
    return db
      .select()
      .from(practiceEducationCenters)
      .where(
        and(
  eq(practiceEducationCenters.organizationId, organizationId),
  eq(practiceEducationCenters.isActive, true),
  eq(practiceEducationCenters.categoryId, categoryId)
)
      )
      .orderBy(practiceEducationCenters.sortOrder, desc(practiceEducationCenters.createdAt));
  }

  return db
    .select()
    .from(practiceEducationCenters)
    .where(
  and(
    eq(practiceEducationCenters.organizationId, organizationId),
    eq(practiceEducationCenters.isActive, true)
  )
)
    .orderBy(practiceEducationCenters.sortOrder, desc(practiceEducationCenters.createdAt));
}

export async function getPracticeEducationCenter(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(practiceEducationCenters)
    .where(
      and(
        eq(practiceEducationCenters.id, id),
        eq(practiceEducationCenters.organizationId, organizationId)
      )
    )
    .limit(1);

  return rows[0];
}

export async function createPracticeEducationCenter(
  data: InsertPracticeEducationCenter & {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(data.organizationId);

  const result: any = await db.insert(practiceEducationCenters).values({
  ...data,
  organizationId,
  feeAmount: (data as any).feeAmount ?? "0",
  isActive: (data as any).isActive ?? true,
  sortOrder: (data as any).sortOrder ?? 0,
} as any);

  return getInsertId(result);
}

export async function bulkCreatePracticeEducationCenters(
  rows: Array<{
    categoryId?: number | null;
    representativeName?: string | null;
    availableCourse?: string | null;
    memo?: string | null;
    name: string;
    phone?: string | null;
    address?: string | null;
    detailAddress?: string | null;
    feeAmount?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    note?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }>,
  options?: {
  organizationId?: number | null;
  mode?: "append" | "replace";
  categoryId?: number | null;
}
) {
    const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(options?.organizationId);

  if (!rows.length) return { success: true, count: 0 };

  if (options?.mode === "replace" && options?.categoryId) {
    await db
      .delete(practiceEducationCenters)
      .where(
  and(
    eq(practiceEducationCenters.organizationId, organizationId),
    eq(practiceEducationCenters.categoryId, options.categoryId)
  )
);
  }

  let createdCount = 0;
let updatedCount = 0;
const failedRows: Array<{ rowIndex: number; name?: string; address?: string; reason: string }> = [];

  for (let idx = 0; idx < rows.length; idx++) {
  const row = rows[idx];

  try {
    const value = {
organizationId,
      categoryId: row.categoryId ?? null,
      representativeName: row.representativeName?.trim() || null,
      availableCourse: row.availableCourse?.trim() || null,
      memo: row.memo || null,
      name: row.name.trim(),
      phone: row.phone?.trim() || null,
      address: row.address?.trim() || null,
      detailAddress: row.detailAddress?.trim() || null,
      feeAmount: row.feeAmount || "0",
      latitude: row.latitude || null,
      longitude: row.longitude || null,
      note: row.note || null,
      isActive: row.isActive ?? true,
      sortOrder: row.sortOrder ?? idx,
    };

    if (!value.name) {
      failedRows.push({
        rowIndex: idx + 2,
        name: row.name,
        address: row.address,
        reason: "이름이 비어 있습니다.",
      });
      continue;
    }

    const existing = await db
      .select()
      .from(practiceEducationCenters)
      .where(
        and(
eq(practiceEducationCenters.organizationId, organizationId),
          eq(practiceEducationCenters.categoryId, value.categoryId),
          eq(practiceEducationCenters.name, value.name),
          eq(practiceEducationCenters.address, value.address)
        )
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(practiceEducationCenters)
        .set(value as any)
        .where(
  and(
    eq(practiceEducationCenters.id, existing[0].id),
    eq(practiceEducationCenters.organizationId, organizationId)
  )
);
      updatedCount += 1;
    } else {
      await db.insert(practiceEducationCenters).values(value as any);
      createdCount += 1;
    }
  } catch (error: any) {
    failedRows.push({
      rowIndex: idx + 2,
      name: row.name,
      address: row.address,
      reason: error?.message || "등록 중 오류가 발생했습니다.",
    });
  }
}

  return {
  success: true,
  mode: options?.mode ?? "append",
  total: rows.length,
  created: createdCount,
  updated: updatedCount,
  failed: failedRows.length,
  failedRows,
};
}

export async function bulkDeactivatePracticeEducationCenters(params?: {
  inactiveReason?: string | null;
  inactiveStartDate?: string | null;
  inactiveEndDate?: string | null;
  hideOnMapWhenInactive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(practiceEducationCenters)
    .set({
      isInactive: true,
      inactiveReason: params?.inactiveReason ?? "일괄 비활성화",
      inactiveStartDate: params?.inactiveStartDate ?? null,
      inactiveEndDate: params?.inactiveEndDate ?? null,
      hideOnMapWhenInactive: params?.hideOnMapWhenInactive ?? true,
    } as any);

  return { success: true };
}

export async function updatePracticeEducationCenter(
  id: number,
  data: Partial<InsertPracticeEducationCenter>,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(practiceEducationCenters)
    .set(data as any)
    .where(
  and(
    eq(practiceEducationCenters.id, id),
    eq(practiceEducationCenters.organizationId, organizationId)
  )
);
}

type PracticeAvailabilityUpdateInput = {
  isInactive: boolean;
  inactiveReason?: string | null;
  inactiveStartDate?: string | null;
  inactiveEndDate?: string | null;
  hideOnMapWhenInactive?: boolean | null;
};

export async function updatePracticeInstitutionAvailability(
  id: number,
  data: PracticeAvailabilityUpdateInput,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(practiceInstitutions)
    .set({
      isInactive: data.isInactive,
      inactiveReason: data.inactiveReason ?? null,
      inactiveStartDate: data.inactiveStartDate ?? null,
      inactiveEndDate: data.inactiveEndDate ?? null,
      hideOnMapWhenInactive: data.hideOnMapWhenInactive ?? true,
    } as any)
    .where(
  and(
    eq(practiceInstitutions.id, id),
    eq(practiceInstitutions.organizationId, organizationId)
  )
);
}

export async function updatePracticeEducationCenterAvailability(
  id: number,
  data: PracticeAvailabilityUpdateInput,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(practiceEducationCenters)
    .set({
      isInactive: data.isInactive,
      inactiveReason: data.inactiveReason ?? null,
      inactiveStartDate: data.inactiveStartDate ?? null,
      inactiveEndDate: data.inactiveEndDate ?? null,
      hideOnMapWhenInactive: data.hideOnMapWhenInactive ?? true,
    } as any)
    .where(
  and(
    eq(practiceEducationCenters.id, id),
    eq(practiceEducationCenters.organizationId, organizationId)
  )
);
}

export async function deletePracticeEducationCenter(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .delete(practiceEducationCenters)
    .where(
  and(
    eq(practiceEducationCenters.id, id),
    eq(practiceEducationCenters.organizationId, organizationId)
  )
);
}

export async function listNearbyPracticeInstitutions(params: {
  organizationId?: number | null;
  studentId: number;
  institutionType: "education" | "institution";
  limit?: number;
}) {
  const db = await getDb();

const organizationId = requireOrganizationId(params.organizationId);

  if (!db) return [];

  const student = await getStudent(params.studentId, { organizationId });
  if (!student) throw new Error("Student not found");

  const studentLat = toNullableNumber((student as any).latitude);
  const studentLng = toNullableNumber((student as any).longitude);

  if (studentLat === null || studentLng === null) {
    throw new Error("Student latitude/longitude not found");
  }

  const rows = await db
    .select()
    .from(practiceInstitutions)
    .where(
  and(
    eq(practiceInstitutions.organizationId, organizationId),
    eq(practiceInstitutions.institutionType, params.institutionType),
    eq(practiceInstitutions.isActive, true)
      )
    );

  const mapped = rows
    .map((row: any) => {
      const lat = toNullableNumber(row.latitude);
      const lng = toNullableNumber(row.longitude);

      if (lat === null || lng === null) return null;

      const distanceKm = haversineDistanceKm(studentLat, studentLng, lat, lng);

      return {
        ...row,
        distanceKm: Number(distanceKm.toFixed(2)),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

  return mapped.slice(0, params.limit ?? 30);
}

// ─── Job Support Requests (취업지원센터) ────────────────────────────
export async function listJobSupportRequests(assigneeId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (assigneeId) {
    return db
      .select()
      .from(jobSupportRequests)
      .where(eq(jobSupportRequests.assigneeId, assigneeId))
      .orderBy(desc(jobSupportRequests.createdAt));
  }

  return db
    .select()
    .from(jobSupportRequests)
    .orderBy(desc(jobSupportRequests.createdAt));
}

export async function listJobSupportRequestsByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(jobSupportRequests)
    .where(eq(jobSupportRequests.studentId, studentId))
    .orderBy(desc(jobSupportRequests.createdAt));
}

export async function createJobSupportRequest(data: InsertJobSupportRequest) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(jobSupportRequests).values({
    ...data,
    feeAmount: data.feeAmount ?? "0",
    paymentStatus: data.paymentStatus ?? "결제대기",
  });

  return getInsertId(result);
}

export async function updateJobSupportRequest(
  id: number,
  data: Partial<InsertJobSupportRequest>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(jobSupportRequests)
    .set(data as any)
    .where(eq(jobSupportRequests.id, id));
}

export async function deleteJobSupportRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(jobSupportRequests).where(eq(jobSupportRequests.id, id));
}

export async function createAiActionLogV2(data: {
  userId: number;
  userName?: string;
  action: string;
  targetStudentId?: number;
  targetStudentName?: string;
  payload?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return await db.insert(aiActionLogs).values({
    userId: data.userId,
    userName: data.userName,
    action: data.action,
    targetStudentId: data.targetStudentId,
    targetStudentName: data.targetStudentName,
    payload: JSON.stringify(data.payload ?? {}),
  });
}

// =====================================================
// ORG / SUPERHOST GUARD / MESSENGER
// =====================================================

function normalizeNullableString(v: any) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export async function assertUserExists(userId: number) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("유저를 찾을 수 없습니다.");
  }
  return user;
}

export async function assertTargetUserNotProtectedByActor(params: {
  actorRole: "staff" | "admin" | "host" | "superhost";
  targetUserId: number;
}) {
  const target = await getUserById(params.targetUserId);
  if (!target) {
    throw new Error("대상 유저를 찾을 수 없습니다.");
  }

  if (target.role === "superhost" && params.actorRole !== "superhost") {
    throw new Error("슈퍼호스트 계정은 수정할 수 없습니다.");
  }

  return target;
}

// -----------------------------------------------------
// ORG: Teams
// -----------------------------------------------------

export async function listTeams(params?: { organizationId?: number | null }) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(teams)
    .where(eq(teams.organizationId, organizationId))
    .orderBy(teams.sortOrder, teams.id);
}

export async function getTeam(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return undefined;

const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(teams)
    .where(
      and(
        eq(teams.id, id),
        eq(teams.organizationId, organizationId)
      )
    )
    .limit(1);

  return result[0];
}

export async function createTeam(data: {
  organizationId?: number | null;
  name: string;
  sortOrder?: number | null;
  isActive?: boolean | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(data.organizationId);

  const result: any = await db.insert(teams).values({
    organizationId,
    name: data.name.trim(),
    sortOrder: data.sortOrder ?? 0,
    isActive: data.isActive ?? true,
  } as InsertTeam);

  return getInsertId(result);
}

export async function updateTeam(
  id: number,
  data: {
    name?: string | null;
    sortOrder?: number | null;
    isActive?: boolean | null;
  },
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const payload: Record<string, any> = {};
  if (data.name !== undefined) payload.name = normalizeNullableString(data.name);
  if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder ?? 0;
  if (data.isActive !== undefined) payload.isActive = !!data.isActive;

  if (Object.keys(payload).length === 0) return;

  await db
    .update(teams)
    .set(payload)
    .where(
      and(
        eq(teams.id, id),
        eq(teams.organizationId, organizationId)
      )
    );
}

export async function deleteTeam(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .delete(teams)
    .where(
      and(
        eq(teams.id, id),
        eq(teams.organizationId, organizationId)
      )
    );
}

// -----------------------------------------------------
// ORG: Positions
// -----------------------------------------------------

export async function listPositions(params?: { organizationId?: number | null }) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  return db
    .select()
    .from(positions)
    .where(eq(positions.organizationId, organizationId))
    .orderBy(positions.sortOrder, positions.id);
}

export async function getPosition(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return undefined;

const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.id, id),
        eq(positions.organizationId, organizationId)
      )
    )
    .limit(1);

  return result[0];
}

export async function getPositionById(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return undefined;

const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.id, id),
        eq(positions.organizationId, organizationId)
      )
    )
    .limit(1);

  return rows[0];
}

export async function createPosition(data: {
  organizationId?: number | null;
  name: string;
  sortOrder?: number | null;
  isActive?: boolean | null;
  settlementUnitAmount?: string | number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(data.organizationId);

  const result: any = await db.insert(positions).values({
    organizationId,
    name: data.name.trim(),
    sortOrder: data.sortOrder ?? 0,
    isActive: data.isActive ?? true,
    settlementUnitAmount: String(data.settlementUnitAmount ?? "0"),
  } as any);

  return getInsertId(result);
}

export async function updatePosition(
  id: number,
  data: {
    name?: string | null;
    sortOrder?: number | null;
    isActive?: boolean | null;
    settlementUnitAmount?: string | number | null;
  },
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const payload: Record<string, any> = {};
  if (data.name !== undefined) payload.name = data.name?.trim() || null;
  if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder ?? 0;
  if (data.isActive !== undefined) payload.isActive = !!data.isActive;
  if (data.settlementUnitAmount !== undefined) {
    payload.settlementUnitAmount = String(data.settlementUnitAmount ?? "0");
  }

  if (Object.keys(payload).length === 0) return;

  await db
    .update(positions)
    .set(payload)
    .where(
      and(
        eq(positions.id, id),
        eq(positions.organizationId, organizationId)
      )
    );
}

export async function deletePosition(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .delete(positions)
    .where(
      and(
        eq(positions.id, id),
        eq(positions.organizationId, organizationId)
      )
    );
}

// -----------------------------------------------------
// ORG: User Mapping
// -----------------------------------------------------

export async function getUserOrgMapping(
  userId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return undefined;

const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(userOrgMappings)
    .where(
      and(
        eq(userOrgMappings.userId, userId),
        eq(userOrgMappings.organizationId, organizationId)
      )
    )
    .limit(1);

  return result[0];
}

export async function upsertUserOrgMapping(data: {
  organizationId?: number | null;
  userId: number;
  teamId?: number | null;
  positionId?: number | null;
  sortOrder?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(data.organizationId);

  await assertUserExists(data.userId);

  if (data.teamId) {
    const team = await getTeam(data.teamId, { organizationId });
    if (!team) throw new Error("팀을 찾을 수 없습니다.");
  }

  if (data.positionId) {
    const position = await getPosition(data.positionId, { organizationId });
    if (!position) throw new Error("직급을 찾을 수 없습니다.");
  }

  const existing = await getUserOrgMapping(data.userId, { organizationId });

  const payload = {
    organizationId,
    userId: data.userId,
    teamId: data.teamId ?? null,
    positionId: data.positionId ?? null,
    sortOrder: data.sortOrder ?? 0,
  } as InsertUserOrgMapping;

  if (existing) {
    await db
      .update(userOrgMappings)
      .set({
        teamId: payload.teamId,
        positionId: payload.positionId,
        sortOrder: payload.sortOrder,
      } as any)
      .where(
        and(
          eq(userOrgMappings.userId, data.userId),
          eq(userOrgMappings.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db.insert(userOrgMappings).values(payload);
  return getInsertId(result);
}

export async function deleteUserOrgMapping(
  userId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .delete(userOrgMappings)
    .where(
      and(
        eq(userOrgMappings.userId, userId),
        eq(userOrgMappings.organizationId, organizationId)
      )
    );
}

export async function getUsersWithOrg() {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT
      u.id,
      u.displayNo,
      u.openId,
      u.username,
      u.name,
      u.email,
      u.phone,
      u.role,
u.profileImageUrl as avatarUrl,
      u.bankName,
      u.bankAccount,
      u.isActive,
      u.loginMethod,
      u.createdAt,
      u.updatedAt,
      u.lastSignedIn,

      m.id as mappingId,
      m.teamId,
      m.positionId,
      COALESCE(m.sortOrder, 0) as orgSortOrder,

      t.name as teamName,
      t.sortOrder as teamSortOrder,
      t.isActive as teamIsActive,

      p.name as positionName,
      p.sortOrder as positionSortOrder,
      p.isActive as positionIsActive

    FROM users u
    LEFT JOIN user_org_mappings m ON m.userId = u.id
    LEFT JOIN teams t ON t.id = m.teamId
    LEFT JOIN positions p ON p.id = m.positionId
    ORDER BY
      COALESCE(t.sortOrder, 999999) ASC,
      COALESCE(m.sortOrder, 999999) ASC,
      u.displayNo ASC,
      u.id ASC
  `);

  return (rows as any[]) ?? [];
}

// -----------------------------------------------------
// USER wrappers with superhost protection
// -----------------------------------------------------

export async function updateUserAccountProtected(params: {
  actorRole: "staff" | "admin" | "host" | "superhost";
  targetUserId: number;
  data: {
    username?: string;
    passwordHash?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
  };
}) {
  await assertTargetUserNotProtectedByActor({
    actorRole: params.actorRole,
    targetUserId: params.targetUserId,
  });

  return updateUserAccount(params.targetUserId, params.data);
}

export async function updateUserRoleProtected(params: {
  actorRole: "staff" | "admin" | "host" | "superhost";
  targetUserId: number;
  role: "staff" | "admin" | "host" | "superhost";
}) {
  const target = await assertTargetUserNotProtectedByActor({
    actorRole: params.actorRole,
    targetUserId: params.targetUserId,
  });

  if (target.role === "superhost" && params.role !== "superhost") {
    throw new Error("슈퍼호스트 권한은 변경할 수 없습니다.");
  }

  return updateUserRole(params.targetUserId, params.role);
}

export async function updateUserActiveProtected(params: {
  actorRole: "staff" | "admin" | "host" | "superhost";
  targetUserId: number;
  isActive: boolean;
}) {
  await assertTargetUserNotProtectedByActor({
    actorRole: params.actorRole,
    targetUserId: params.targetUserId,
  });

  return updateUserActive(params.targetUserId, params.isActive);
}

export async function upsertUserOrgMappingProtected(params: {
  organizationId?: number | null;
  actorRole: "staff" | "admin" | "host" | "superhost";
  targetUserId: number;
  teamId?: number | null;
  positionId?: number | null;
  sortOrder?: number | null;
}) {
  await assertTargetUserNotProtectedByActor({
    actorRole: params.actorRole,
    targetUserId: params.targetUserId,
  });

  return upsertUserOrgMapping({
  organizationId: requireOrganizationId(params.organizationId),
  userId: params.targetUserId,
  teamId: params.teamId ?? null,
  positionId: params.positionId ?? null,
  sortOrder: params.sortOrder ?? 0,
});
}

// -----------------------------------------------------
// Messenger helpers
// -----------------------------------------------------

export async function getDirectChatRoomBetweenUsers(
  userAId: number,
  userBId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return null;

const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
    SELECT r.*
    FROM chat_rooms r
    INNER JOIN chat_room_members m1 ON m1.roomId = r.id
    INNER JOIN chat_room_members m2 ON m2.roomId = r.id
    WHERE r.roomType = 'direct'
      AND r.organizationId = ${organizationId}
      AND r.isActive = true
      AND m1.userId = ${userAId}
      AND m1.isActive = true
      AND m2.userId = ${userBId}
      AND m2.isActive = true
    LIMIT 1
  `);

  return ((rows as any[]) ?? [])[0] ?? null;
}

export async function createChatRoom(data: {
  organizationId?: number | null;
  roomType: "direct" | "group";
  title?: string | null;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(data.organizationId);

  const result: any = await db.insert(chatRooms).values({
organizationId,
    roomType: data.roomType,
    title: normalizeNullableString(data.title),
    createdBy: data.createdBy,
    isActive: true,
  } as InsertChatRoom);

  return getInsertId(result);
}

export async function addChatRoomMember(data: {
  organizationId?: number | null;
  roomId: number;
  userId: number;
  lastReadMessageId?: number | null;
  isActive?: boolean | null;
}) {
  const db = await getDb();

const organizationId = requireOrganizationId(data.organizationId);

  if (!db) throw new Error("DB not available");

  const existing = await db
    .select()
    .from(chatRoomMembers)
    .where(
  and(
    eq(chatRoomMembers.organizationId, organizationId),
    eq(chatRoomMembers.roomId, data.roomId),
    eq(chatRoomMembers.userId, data.userId)
  )
)
    .limit(1);

  if (existing[0]) {
    await db
      .update(chatRoomMembers)
      .set({
        isActive: data.isActive ?? true,
        lastReadMessageId: data.lastReadMessageId ?? existing[0].lastReadMessageId ?? null,
        leftAt: null,
      } as any)
      .where(
  and(
    eq(chatRoomMembers.id, existing[0].id),
    eq(chatRoomMembers.organizationId, organizationId)
  )
);

    return existing[0].id;
  }

  const result: any = await db.insert(chatRoomMembers).values({
  organizationId,
  roomId: data.roomId,
    userId: data.userId,
    lastReadMessageId: data.lastReadMessageId ?? null,
    isActive: data.isActive ?? true,
    joinedAt: new Date(),
    leftAt: null,
  } as InsertChatRoomMember);

  return getInsertId(result);
}

export async function getOrCreateDirectChatRoom(params: {
  organizationId?: number | null;
  actorUserId: number;
  otherUserId: number;
}) {

const organizationId = requireOrganizationId(params.organizationId);

  if (params.actorUserId === params.otherUserId) {
    throw new Error("자기 자신과의 채팅방은 만들 수 없습니다.");
  }

  await assertUserExists(params.actorUserId);
  await assertUserExists(params.otherUserId);

  const existing = await getDirectChatRoomBetweenUsers(
  params.actorUserId,
  params.otherUserId,
  {
    organizationId,
  }
);

  if (existing?.id) {
    return existing;
  }

  const roomId = await createChatRoom({
  organizationId,
  roomType: "direct",
  title: null,
  createdBy: params.actorUserId,
});

  await addChatRoomMember({
  organizationId,
  roomId: Number(roomId),
  userId: params.actorUserId,
});

  await addChatRoomMember({
  organizationId,
  roomId: Number(roomId),
  userId: params.otherUserId,
});

  return await getChatRoomById(Number(roomId), {
  organizationId,
});
}

export async function getChatRoomById(
  roomId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select()
    .from(chatRooms)
    .where(
      and(
        eq(chatRooms.id, roomId),
        eq(chatRooms.organizationId, organizationId)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

export async function ensureChatRoomMember(
  roomId: number,
  userId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params?.organizationId);

  const result = await db
    .select({
      id: chatRoomMembers.id,
      roomId: chatRoomMembers.roomId,
      userId: chatRoomMembers.userId,
      lastReadMessageId: chatRoomMembers.lastReadMessageId,
      isActive: chatRoomMembers.isActive,
      joinedAt: chatRoomMembers.joinedAt,
      leftAt: chatRoomMembers.leftAt,
    })
    .from(chatRoomMembers)
    .innerJoin(
      chatRooms,
      and(
        eq(chatRooms.id, chatRoomMembers.roomId),
        eq(chatRooms.organizationId, organizationId)
      )
    )
    .where(
      and(
        eq(chatRoomMembers.roomId, roomId),
        eq(chatRoomMembers.userId, userId),
        eq(chatRoomMembers.isActive, true),
        eq(chatRooms.isActive, true)
      )
    )
    .limit(1);

  if (!result[0]) {
    throw new Error("해당 채팅방에 접근 권한이 없습니다.");
  }

  return result[0];
}

export async function createChatMessage(data: {
  organizationId?: number | null;
  roomId: number;
  senderId: number;
  messageType?: "text" | "image" | "file" | "system";
  content?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(data.organizationId);

  await ensureChatRoomMember(data.roomId, data.senderId, {
  organizationId,
});

  const result: any = await db.insert(chatMessages).values({
  organizationId,
  roomId: data.roomId,
  senderId: data.senderId,
  messageType: data.messageType ?? "text",
  content: normalizeNullableString(data.content),
  isDeleted: false,
} as InsertChatMessage);

const messageId = getInsertId(result);

await db
  .update(chatRooms)
  .set({
    updatedAt: new Date(),
  } as any)
  .where(
  and(
    eq(chatRooms.id, data.roomId),
    eq(chatRooms.organizationId, organizationId)
  )
);

return messageId;
}

export async function updateChatRoomTitle({
organizationId,
  roomId,
  title,
}: {
organizationId?: number | null;
  roomId: number;
  title: string;
}) {
  const db = await getDb();

const orgId = requireOrganizationId(organizationId);

  if (!db) throw new Error("DB not available");

  await db
    .update(chatRooms)
    .set({
      title,
      updatedAt: new Date(),
    } as any)
   .where(
  and(
    eq(chatRooms.id, roomId),
    eq(chatRooms.organizationId, orgId)
  )
);
}

export async function updateChatRoomType({
organizationId,
  roomId,
  roomType,
}: {
organizationId?: number | null;
  roomId: number;
  roomType: "direct" | "group";
}) {
  const db = await getDb();

const orgId = requireOrganizationId(organizationId);

  if (!db) throw new Error("DB not available");

  await db
    .update(chatRooms)
    .set({
      roomType,
      updatedAt: new Date(),
    } as any)
    .where(
  and(
    eq(chatRooms.id, roomId),
    eq(chatRooms.organizationId, orgId)
  )
);
}

export async function createChatAttachment(data: {
  organizationId?: number | null;
  messageId: number;
  fileName: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(data.organizationId);

  const [messageRows] = await db.execute(sql`
    SELECT m.id
    FROM chat_messages m
    INNER JOIN chat_rooms r ON r.id = m.roomId
    WHERE m.id = ${data.messageId}
      AND r.organizationId = ${organizationId}
AND m.organizationId = ${organizationId}
    LIMIT 1
  `);

  const message = ((messageRows as any[]) ?? [])[0];
  if (!message) {
    throw new Error("첨부파일을 추가할 메시지를 찾을 수 없습니다.");
  }

  const result: any = await db.insert(chatAttachments).values({
organizationId,
    messageId: data.messageId,
    fileName: data.fileName.trim(),
    fileUrl: data.fileUrl.trim(),
    fileType: normalizeNullableString(data.fileType),
    fileSize: data.fileSize ?? null,
  } as InsertChatAttachment);

  return getInsertId(result);
}

export async function listChatMessages(
  roomId: number,
  userId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  await ensureChatRoomMember(roomId, userId, {
  organizationId,
});

  const [rows] = await db.execute(sql`
    SELECT
      m.id,
      m.roomId,
      m.senderId,
      m.messageType,
      m.content,
      m.isDeleted,
      m.createdAt,
      m.updatedAt,

      u.name as senderName,
      u.username as senderUsername,

      a.id as attachmentId,
      a.fileName as fileName,
      a.fileUrl as fileUrl,
      a.fileType as fileType,
      a.fileSize as fileSize

    FROM chat_messages m
INNER JOIN chat_rooms r ON r.id = m.roomId
INNER JOIN users u ON u.id = m.senderId
    LEFT JOIN chat_attachments a ON a.messageId = m.id
    WHERE m.roomId = ${roomId}
  AND r.organizationId = ${organizationId}
    ORDER BY m.id ASC
  `);

  return (rows as any[]) ?? [];
}

export async function markChatRoomRead(params: {
  organizationId?: number | null;
  roomId: number;
  userId: number;
  lastReadMessageId: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  await ensureChatRoomMember(params.roomId, params.userId, {
  organizationId,
});

let resolvedLastReadMessageId = params.lastReadMessageId ?? null;

if (resolvedLastReadMessageId === null) {
  const [rows] = await db.execute(sql`
    SELECT MAX(m.id) as lastMessageId
FROM chat_messages m
INNER JOIN chat_rooms r ON r.id = m.roomId
WHERE m.roomId = ${params.roomId}
  AND r.organizationId = ${organizationId}
  `);

  resolvedLastReadMessageId = Number((rows as any[])?.[0]?.lastMessageId || 0) || null;
}

await db
  .update(chatRoomMembers)
  .set({
    lastReadMessageId: resolvedLastReadMessageId,
  } as any)
  .where(
  and(
    eq(chatRoomMembers.roomId, params.roomId),
    eq(chatRoomMembers.userId, params.userId)
  )
);
}

export async function listMyChatRooms(
  userId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
    SELECT
      r.id,
      r.roomType,
      r.title,
      r.createdBy,
      r.isActive,
      r.createdAt,
      r.updatedAt,

      me.lastReadMessageId,

      COALESCE(rs.isMuted, 0) as isMuted,

      lm.id as lastMessageId,
      lm.content as lastMessageContent,
      lm.messageType as lastMessageType,
      lm.createdAt as lastMessageCreatedAt,
      lm.senderId as lastMessageSenderId,

      otherUser.id as otherUserId,
      otherUser.name as otherUserName,
      otherUser.username as otherUsername,
	otherUser.profileImageUrl as otherUserProfileImageUrl,

      (
        SELECT COUNT(*)
        FROM chat_messages unread
        WHERE unread.roomId = r.id
          AND (
            me.lastReadMessageId IS NULL
            OR unread.id > me.lastReadMessageId
          )
          AND unread.senderId <> ${userId}
      ) as unreadCount

    FROM chat_room_members me
    INNER JOIN chat_rooms r ON r.id = me.roomId

    LEFT JOIN chat_room_settings rs
      ON rs.roomId = r.id
     AND rs.userId = ${userId}

    LEFT JOIN chat_messages lm
      ON lm.id = (
        SELECT MAX(m2.id)
        FROM chat_messages m2
        WHERE m2.roomId = r.id
      )

    LEFT JOIN chat_room_members otherMember
      ON otherMember.roomId = r.id
     AND otherMember.userId <> ${userId}
     AND otherMember.isActive = true

    LEFT JOIN users otherUser
      ON otherUser.id = otherMember.userId

    WHERE me.userId = ${userId}
      AND me.isActive = true
      AND r.isActive = true
  AND r.organizationId = ${organizationId}

    ORDER BY
      COALESCE(lm.createdAt, r.createdAt) DESC,
      r.id DESC
  `);

  return (rows as any[]) ?? [];
}

export async function listChatRoomMembers(
  roomId: number,
  userId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  await ensureChatRoomMember(roomId, userId, {
    organizationId,
  });

  const [rows] = await db.execute(sql`
    SELECT
      m.id,
      m.roomId,
      m.userId,
      m.lastReadMessageId,
      m.isActive,
      m.joinedAt,
      m.leftAt,

      u.displayNo,
      u.username,
      u.name,
      u.phone,
      u.email,
      u.role,
u.profileImageUrl,
      u.isActive as userIsActive,

      map.teamId,
      map.positionId,
      t.name as teamName,
      p.name as positionName

    FROM chat_room_members m
INNER JOIN chat_rooms r ON r.id = m.roomId
INNER JOIN users u ON u.id = m.userId
    LEFT JOIN user_org_mappings map ON map.userId = u.id
    LEFT JOIN teams t ON t.id = map.teamId
    LEFT JOIN positions p ON p.id = map.positionId

    WHERE m.roomId = ${roomId}
  AND m.isActive = true
  AND r.organizationId = ${organizationId}

    ORDER BY u.id ASC
  `);

  return (rows as any[]) ?? [];
}

export async function getChatMessageById(messageId: number) {
  const db = await getDb();
  if (!db) return null;

  const [rows] = await db.execute(sql`
    SELECT
      m.id,
      m.roomId,
      m.senderId,
      m.messageType,
      m.content,
      m.isDeleted,
      m.createdAt,
      m.updatedAt,
      u.name as senderName,
      u.username as senderUsername,
      a.id as attachmentId,
      a.fileName,
      a.fileUrl,
      a.fileType,
      a.fileSize
    FROM chat_messages m
    INNER JOIN users u ON u.id = m.senderId
    LEFT JOIN chat_attachments a ON a.messageId = m.id
    WHERE m.id = ${messageId}
    LIMIT 1
  `);

  return ((rows as any[]) ?? [])[0] ?? null;
}

export async function setChatRoomMuted(params: {
organizationId?: number | null;
  roomId: number;
  userId: number;
  isMuted: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  await ensureChatRoomMember(params.roomId, params.userId, {
  organizationId,
});

  const existing = await db
    .select()
    .from(chatRoomSettings)
    .where(
      and(
        eq(chatRoomSettings.roomId, params.roomId),
        eq(chatRoomSettings.userId, params.userId)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(chatRoomSettings)
      .set({
        isMuted: params.isMuted,
        updatedAt: new Date(),
      } as any)
      .where(
and(
  eq(chatRoomSettings.organizationId, organizationId),
  eq(chatRoomSettings.roomId, params.roomId),
  eq(chatRoomSettings.userId, params.userId)
)
);
    return existing[0].id;
  }

  const result: any = await db.insert(chatRoomSettings).values({
organizationId,
    roomId: params.roomId,
    userId: params.userId,
    isMuted: params.isMuted,
    pinnedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  return getInsertId(result);
}

export async function leaveChatRoom(params: {
organizationId?: number | null;
  roomId: number;
  userId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  await ensureChatRoomMember(params.roomId, params.userId, {
  organizationId,
});

  await db
    .update(chatRoomMembers)
    .set({
      isActive: false,
      leftAt: new Date(),
    } as any)
    .where(
      and(
  eq(chatRoomMembers.organizationId, organizationId),
  eq(chatRoomMembers.roomId, params.roomId),
  eq(chatRoomMembers.userId, params.userId)
)
    );

  return true;
}

function getTodayDateStringKST() {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + kstOffset);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function calcWorkMinutes(start?: Date | string | null, end?: Date | string | null) {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!s || !e || e <= s) return 0;
  return Math.floor((e - s) / 1000 / 60);
}

export async function getTodayAttendanceRecord(
  userId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return null;

const organizationId = requireOrganizationId(params?.organizationId);
  const today = getTodayDateStringKST();

  const result = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.organizationId, organizationId),
        eq(attendanceRecords.userId, userId),
        eq(attendanceRecords.workDate, today)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

export async function clockInAttendance(
  userId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const today = getTodayDateStringKST();
  const existing = await getTodayAttendanceRecord(userId, {
  organizationId,
});

  if (existing?.clockInAt) {
    throw new Error("이미 오늘 출근 처리되었습니다.");
  }

  const now = new Date();
const late = await calcLateInfo(now, {
  organizationId,
});

  if (existing?.id) {
    await db
      .update(attendanceRecords)
     .set({
  clockInAt: now,
  status: late.isLate ? "지각" : "근무중",
  isLate: late.isLate,
  lateMinutes: late.lateMinutes,
  isAbsent: 0,
} as any)
      .where(
  and(
    eq(attendanceRecords.id, existing.id),
    eq(attendanceRecords.organizationId, organizationId)
  )
);

    return await getTodayAttendanceRecord(userId, {
  organizationId,
});
  }

  const result: any = await db.insert(attendanceRecords).values({
organizationId,
    userId,
    workDate: today,
    clockInAt: now,
    clockOutAt: null,
    workMinutes: 0,
status: late.isLate ? "지각" : "근무중",
    isLate: late.isLate,
    lateMinutes: late.lateMinutes,
isAbsent: 0,
isAutoClockOut: 0,
leaveType: null,
    isEarlyLeave: 0,
    earlyLeaveMinutes: 0,
    note: null,
  } as InsertAttendanceRecord);

  const insertId = getInsertId(result);

  const row = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, Number(insertId)))
    .limit(1);

  return row[0] ?? null;
}

export async function clockOutAttendance(
  userId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const todayRow = await getTodayAttendanceRecord(userId, {
  organizationId,
});

  if (!todayRow?.clockInAt) {
    throw new Error("출근 기록이 없어 퇴근 처리할 수 없습니다.");
  }

  if (todayRow?.clockOutAt) {
    throw new Error("이미 오늘 퇴근 처리되었습니다.");
  }

  const clockOutAt = new Date();
  const workMinutes = calcWorkMinutes(todayRow.clockInAt, clockOutAt);
const early = await calcEarlyLeaveInfo(clockOutAt, {
  organizationId,
});

  await db
  .update(attendanceRecords)
  .set({
    clockOutAt,
    workMinutes,
    status: early.isEarlyLeave
      ? "조퇴"
      : todayRow.isLate
      ? "지각"
      : "퇴근완료",
    isEarlyLeave: early.isEarlyLeave,
    earlyLeaveMinutes: early.earlyLeaveMinutes,
    isAbsent: 0,
  } as any)
    .where(
  and(
    eq(attendanceRecords.id, todayRow.id),
    eq(attendanceRecords.organizationId, organizationId)
  )
);

  return await getTodayAttendanceRecord(userId, {
  organizationId,
});
}


export async function listMyAttendanceRecords(
  userId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
    SELECT
      a.id,
      a.userId,
      a.workDate,
      a.clockInAt,
      a.clockOutAt,
      a.workMinutes,
      a.status,
      a.note,
      a.createdAt,
      a.updatedAt,
      u.name,
      u.role,
u.username,
u.phone,
a.isLate,
a.isEarlyLeave,
a.lateMinutes,
a.earlyLeaveMinutes,
a.isAbsent,
a.isAutoClockOut,
a.leaveType,
map.teamId,
map.positionId,
t.name as teamName,
p.name as positionName
    FROM attendance_records a
    INNER JOIN users u ON u.id = a.userId
LEFT JOIN user_org_mappings map ON map.userId = u.id
LEFT JOIN teams t ON t.id = map.teamId
LEFT JOIN positions p ON p.id = map.positionId
    WHERE a.organizationId = ${organizationId}
  AND a.userId = ${userId}
    ORDER BY a.workDate DESC, a.id DESC
  `);

  return (rows as any[]) ?? [];
}

export async function listAllAttendanceRecords(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
  SELECT
    a.id,
    a.userId,
    a.workDate,
    a.clockInAt,
    a.clockOutAt,
    a.workMinutes,
    a.status,
    a.note,
    a.createdAt,
    a.updatedAt,
    u.name,
    u.role,
    u.username,
    u.phone,
    a.isLate,
    a.isEarlyLeave,
    a.lateMinutes,
    a.earlyLeaveMinutes,
    a.isAbsent,
    a.isAutoClockOut,
    a.leaveType,
    map.teamId,
    map.positionId,
    t.name as teamName,
    p.name as positionName
    FROM attendance_records a
  INNER JOIN users u ON u.id = a.userId
  LEFT JOIN user_org_mappings map ON map.userId = u.id
  LEFT JOIN teams t ON t.id = map.teamId
  LEFT JOIN positions p ON p.id = map.positionId
  WHERE a.organizationId = ${organizationId}
  ORDER BY a.workDate DESC, a.id DESC
`);

const normalizedRows = (rows as any[]) ?? [];

for (const row of normalizedRows) {
  await autoClockOutIfNeeded(row);
}

const [freshRows] = await db.execute(sql`
  SELECT
    a.id,
    a.userId,
    a.workDate,
    a.clockInAt,
    a.clockOutAt,
    a.workMinutes,
    a.status,
    a.note,
    a.createdAt,
    a.updatedAt,
    u.name,
    u.role,
    u.username,
    u.phone,
    a.isLate,
    a.isEarlyLeave,
    a.lateMinutes,
    a.earlyLeaveMinutes,
    a.isAbsent,
    a.isAutoClockOut,
    a.leaveType,
    map.teamId,
    map.positionId,
    t.name as teamName,
    p.name as positionName
  FROM attendance_records a
  INNER JOIN users u ON u.id = a.userId
  LEFT JOIN user_org_mappings map ON map.userId = u.id
  LEFT JOIN teams t ON t.id = map.teamId
  LEFT JOIN positions p ON p.id = map.positionId
  WHERE a.organizationId = ${organizationId}
  ORDER BY a.workDate DESC, a.id DESC
`);

return (freshRows as any[]) ?? [];
}

export async function listTeamAttendanceRecords(
  adminUserId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const myTeamId = await getMyTeamId(adminUserId, {
  organizationId,
});
  if (!myTeamId) return [];

  const [rows] = await db.execute(sql`
    SELECT
      a.id,
      a.userId,
      a.workDate,
      a.clockInAt,
      a.clockOutAt,
      a.workMinutes,
      a.status,
      a.note,
      a.createdAt,
      a.updatedAt,
      a.isLate,
      a.isEarlyLeave,
      a.lateMinutes,
      a.earlyLeaveMinutes,
      a.isAbsent,
      a.isAutoClockOut,
      a.leaveType,
      u.name,
      u.role,
      u.username,
      u.phone,
      map.teamId,
      map.positionId,
      t.name as teamName,
      p.name as positionName
    FROM attendance_records a
    INNER JOIN users u ON u.id = a.userId
    LEFT JOIN user_org_mappings map ON map.userId = u.id
    LEFT JOIN teams t ON t.id = map.teamId
    LEFT JOIN positions p ON p.id = map.positionId
    WHERE a.organizationId = ${organizationId}
  AND map.teamId = ${myTeamId}
    ORDER BY a.workDate DESC, a.id DESC
  `);

  return (rows as any[]) ?? [];
}


async function calcLateInfo(
  clockInAt?: Date | string | null,
  params?: { organizationId?: number | null }
) {
  if (!clockInAt) {
    return { isLate: 0, lateMinutes: 0 };
  }

  const d = new Date(clockInAt);
  const policy = await getAttendancePolicy({
  organizationId: requireOrganizationId(params?.organizationId),
});

  const startHour = Number(policy?.workStartHour ?? 9);
  const startMinute = Number(policy?.workStartMinute ?? 0);

  const base = new Date(d);
  base.setHours(startHour, startMinute, 0, 0);

  if (d <= base) {
    return { isLate: 0, lateMinutes: 0 };
  }

  const diff = Math.floor((d.getTime() - base.getTime()) / 60000);

  return { isLate: 1, lateMinutes: diff };
}


async function calcEarlyLeaveInfo(
  clockOutAt?: Date | string | null,
  params?: { organizationId?: number | null }
) {
  if (!clockOutAt) {
    return { isEarlyLeave: 0, earlyLeaveMinutes: 0 };
  }

  const d = new Date(clockOutAt);
  const policy = await getAttendancePolicy({
  organizationId: requireOrganizationId(params?.organizationId),
});

  const endHour = Number(policy?.workEndHour ?? 18);
  const endMinute = Number(policy?.workEndMinute ?? 0);

  const base = new Date(d);
  base.setHours(endHour, endMinute, 0, 0);

  if (d >= base) {
    return { isEarlyLeave: 0, earlyLeaveMinutes: 0 };
  }

  const diff = Math.floor((base.getTime() - d.getTime()) / 60000);

  return { isEarlyLeave: 1, earlyLeaveMinutes: diff };
}

async function getMyTeamId(
  userId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return null;

const organizationId = requireOrganizationId(params?.organizationId);

  const row = await db
    .select()
    .from(userOrgMappings)
    .where(
      and(
        eq(userOrgMappings.userId, userId),
        eq(userOrgMappings.organizationId, organizationId)
      )
    )
    .limit(1);

  return row[0]?.teamId ? Number(row[0].teamId) : null;
}

async function getDefaultAttendancePolicy() {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(attendancePolicies)
    .where(eq(attendancePolicies.scopeType, "global"))
    .limit(1);

  return rows[0] ?? null;
}

export async function getAttendancePolicy(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;

const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(attendancePolicies)
    .where(
      and(
        eq(attendancePolicies.scopeType, "global"),
        eq(attendancePolicies.organizationId, organizationId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function autoClockOutIfNeeded(record: any) {
  if (!record || !record.clockInAt || record.clockOutAt) return;

  const db = await getDb();
  if (!db) return;

  const organizationId = requireOrganizationId(record.organizationId);

  const policy = await getAttendancePolicy({
    organizationId,
  });

  const endHour = Number(policy?.workEndHour ?? 18);
  const endMinute = Number(policy?.workEndMinute ?? 0);

  // 자동퇴근 = 퇴근시간 + 10분
  const autoBase = new Date(record.workDate);
  autoBase.setHours(endHour, endMinute + 10, 0, 0);

  const now = new Date();
  if (now < autoBase) return;

  const clockInAt = new Date(record.clockInAt);
  const clockOutAt = autoBase;

  const workMinutes = calcWorkMinutes(clockInAt, clockOutAt);
  const early = await calcEarlyLeaveInfo(clockOutAt, {
  organizationId,
});
  const late = await calcLateInfo(clockInAt, {
  organizationId,
});

  let status:
    | "출근전"
    | "근무중"
    | "퇴근완료"
    | "지각"
    | "조퇴"
    | "병가"
    | "연차"
    | "출장"
    | "반차"
    | "결근" = "퇴근완료";

  if (early.isEarlyLeave) {
    status = "조퇴";
  } else if (late.isLate) {
    status = "지각";
  } else {
    status = "퇴근완료";
  }

  await db
    .update(attendanceRecords)
    .set({
      clockOutAt,
      workMinutes,
      status,
      isEarlyLeave: early.isEarlyLeave,
      earlyLeaveMinutes: early.earlyLeaveMinutes,
      isLate: late.isLate,
      lateMinutes: late.lateMinutes,
      isAutoClockOut: 1,
      isAbsent: 0,
    } as any)
    .where(
  and(
    eq(attendanceRecords.id, Number(record.id)),
    eq(attendanceRecords.organizationId, organizationId)
  )
);
  await db.insert(attendanceAdjustmentLogs).values({
  organizationId,
    attendanceId: Number(record.id),
    targetUserId: Number(record.userId),
    actorUserId: Number(record.userId),
    beforeClockInAt: record.clockInAt ?? null,
    beforeClockOutAt: record.clockOutAt ?? null,
    afterClockInAt: clockInAt,
    afterClockOutAt: clockOutAt,
    reason: "자동퇴근 처리",
    actionType: "auto_clock_out",
    beforeStatus: record.status ?? null,
    afterStatus: status,
    note: "퇴근시간 + 10분 기준 자동퇴근",
  } as any);
}

export async function saveAttendancePolicy(params: {
organizationId?: number | null;
  actorUserId: number;
  workStartHour: number;
  workStartMinute: number;
  workEndHour: number;
  workEndMinute: number;
  autoClockOutEnabled: boolean;
  autoClockOutHour: number;
  autoClockOutMinute: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결이 없습니다.");

const organizationId = requireOrganizationId(params.organizationId);

  const current = await getAttendancePolicy({ organizationId });

  if (!current) {
    await db.insert(attendancePolicies).values({
organizationId,
      scopeType: "global",
      scopeId: null,
      workStartHour: params.workStartHour,
      workStartMinute: params.workStartMinute,
      workEndHour: params.workEndHour,
      workEndMinute: params.workEndMinute,
      lateGraceMinutes: 0,
      autoClockOutEnabled: params.autoClockOutEnabled ? 1 : 0,
      autoClockOutHour: params.autoClockOutHour,
      autoClockOutMinute: params.autoClockOutMinute,
      absentMarkNextDayEnabled: 1,
      timezone: "Asia/Seoul",
      createdBy: params.actorUserId,
      updatedBy: params.actorUserId,
    } as any);

    return await getAttendancePolicy();
  }

  await db
    .update(attendancePolicies)
    .set({
      workStartHour: params.workStartHour,
      workStartMinute: params.workStartMinute,
      workEndHour: params.workEndHour,
      workEndMinute: params.workEndMinute,
      autoClockOutEnabled: params.autoClockOutEnabled ? 1 : 0,
      autoClockOutHour: params.autoClockOutHour,
      autoClockOutMinute: params.autoClockOutMinute,
      updatedBy: params.actorUserId,
    } as any)
    .where(
  and(
    eq(attendancePolicies.id, current.id),
    eq(attendancePolicies.organizationId, organizationId)
  )
);

  return await getAttendancePolicy({ organizationId });
}

export async function updateAttendanceStatusByManager(params: {
organizationId?: number | null;
  attendanceId: number;
  actorUserId: number;
  actorRole: string;
  status:
    | "출근전"
    | "근무중"
    | "퇴근완료"
    | "지각"
    | "조퇴"
    | "병가"
    | "연차"
    | "출장"
    | "반차"
    | "결근";
  reason?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결이 없습니다.");

const organizationId = requireOrganizationId(params.organizationId);

  const row = await db
    .select()
    .from(attendanceRecords)
    .where(
  and(
    eq(attendanceRecords.id, params.attendanceId),
    eq(attendanceRecords.organizationId, organizationId)
  )
)
    .limit(1);

  const current = row[0];
  if (!current) {
    throw new Error("근태 기록을 찾을 수 없습니다.");
  }

  // admin은 자기 팀만 수정 가능
  if (params.actorRole === "admin") {
   const myTeamId = await getMyTeamId(params.actorUserId, {
  organizationId,
});
    if (!myTeamId) {
      throw new Error("관리자 팀 정보를 찾을 수 없습니다.");
    }

    const [targetRows] = await db.execute(sql`
      SELECT map.teamId
      FROM users u
      LEFT JOIN user_org_mappings map ON map.userId = u.id
      WHERE u.id = ${current.userId}
      LIMIT 1
    `);

    const targetTeamId = Number((targetRows as any[])?.[0]?.teamId || 0);

    if (!targetTeamId || targetTeamId !== myTeamId) {
      throw new Error("자기 팀 직원의 근태만 수정할 수 있습니다.");
    }
  }

  let nextClockInAt = current.clockInAt ? new Date(current.clockInAt) : null;
  let nextClockOutAt = current.clockOutAt ? new Date(current.clockOutAt) : null;
  let nextWorkMinutes = Number(current.workMinutes || 0);
  let isLate = Number(current.isLate || 0);
  let lateMinutes = Number(current.lateMinutes || 0);
  let isEarlyLeave = Number(current.isEarlyLeave || 0);
  let earlyLeaveMinutes = Number(current.earlyLeaveMinutes || 0);
  let isAbsent = Number(current.isAbsent || 0);

  // 퇴근완료로 바꿀 때 출퇴근 시간이 비어 있으면 정책 시간 자동 주입
  if (params.status === "퇴근완료" && !nextClockInAt && !nextClockOutAt) {
    const policy = await getAttendancePolicy({
  organizationId,
});

    const workDate = String(current.workDate).slice(0, 10);
    const startHour = Number(policy?.workStartHour ?? 9);
    const startMinute = Number(policy?.workStartMinute ?? 0);
    const endHour = Number(policy?.workEndHour ?? 18);
    const endMinute = Number(policy?.workEndMinute ?? 0);

    nextClockInAt = new Date(
      `${workDate}T${String(startHour).padStart(2, "0")}:${String(
        startMinute
      ).padStart(2, "0")}:00`
    );
    nextClockOutAt = new Date(
      `${workDate}T${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(
        2,
        "0"
      )}:00`
    );

    nextWorkMinutes = calcWorkMinutes(nextClockInAt, nextClockOutAt);

const late = await calcLateInfo(nextClockInAt, {
  organizationId,
});

const early = await calcEarlyLeaveInfo(nextClockOutAt, {
  organizationId,
});

    isLate = late.isLate ? 1 : 0;
    lateMinutes = late.lateMinutes;
    isEarlyLeave = early.isEarlyLeave ? 1 : 0;
    earlyLeaveMinutes = early.earlyLeaveMinutes;
    isAbsent = 0;
  }

  // 출근전 / 결근 같은 상태면 시간 비우기
  if (params.status === "출근전" || params.status === "결근") {
    nextClockInAt = null;
    nextClockOutAt = null;
    nextWorkMinutes = 0;
    isLate = 0;
    lateMinutes = 0;
    isEarlyLeave = 0;
    earlyLeaveMinutes = 0;
    isAbsent = params.status === "결근" ? 1 : 0;
  }

  // 병가/연차/출장/반차는 시간 없이 상태만 반영
  if (
    params.status === "병가" ||
    params.status === "연차" ||
    params.status === "출장" ||
    params.status === "반차"
  ) {
    nextClockInAt = null;
    nextClockOutAt = null;
    nextWorkMinutes = 0;
    isLate = 0;
    lateMinutes = 0;
    isEarlyLeave = 0;
    earlyLeaveMinutes = 0;
    isAbsent = 0;
  }

  await db
    .update(attendanceRecords)
    .set({
      clockInAt: nextClockInAt,
      clockOutAt: nextClockOutAt,
      workMinutes: nextWorkMinutes,
      status: params.status,
      isLate,
      lateMinutes,
      isEarlyLeave,
      earlyLeaveMinutes,
      isAbsent,
      isAutoClockOut: 0,
      note: params.reason ?? current.note ?? null,
    } as any)
    .where(
  and(
    eq(attendanceRecords.id, params.attendanceId),
    eq(attendanceRecords.organizationId, organizationId)
  )
);

  await db.insert(attendanceAdjustmentLogs).values({
  organizationId,
    attendanceId: current.id,
    targetUserId: current.userId,
    actorUserId: params.actorUserId,
    beforeClockInAt: current.clockInAt ?? null,
    beforeClockOutAt: current.clockOutAt ?? null,
    afterClockInAt: nextClockInAt,
    afterClockOutAt: nextClockOutAt,
    reason: params.reason ?? null,
    actionType: "manual_edit",
    beforeStatus: current.status ?? null,
    afterStatus: nextStatus,
    note: params.reason ?? null,
  } as any);

  const updated = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, current.id))
    .limit(1);

  return updated[0] ?? null;
}



function getNowKSTDate() {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(now.getTime() + kstOffset);
}

export async function updateAttendanceRecordByManager(params: {
organizationId?: number | null;
  attendanceId: number;
  actorUserId: number;
actorRole: string;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  reason?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

  const row = await db
    .select()
    .from(attendanceRecords)
    .where(
  and(
    eq(attendanceRecords.id, params.attendanceId),
    eq(attendanceRecords.organizationId, organizationId)
  )
)
    .limit(1);

  const current = row[0];
if (!current) {
  throw new Error("근태 기록을 찾을 수 없습니다.");
}

if (params.actorRole === "admin") {
  const myTeamId = await getMyTeamId(params.actorUserId, {
  organizationId,
});
  if (!myTeamId) {
    throw new Error("관리자 팀 정보를 찾을 수 없습니다.");
  }

  const [targetRows] = await db.execute(sql`
    SELECT map.teamId
    FROM users u
    LEFT JOIN user_org_mappings map ON map.userId = u.id
    WHERE u.id = ${current.userId}
    LIMIT 1
  `);

  const targetTeamId = Number((targetRows as any[])?.[0]?.teamId || 0);

  if (!targetTeamId || targetTeamId !== myTeamId) {
    throw new Error("자기 팀 직원의 근태만 수정할 수 있습니다.");
  }
}

  const nextClockInAt = params.clockInAt ? new Date(params.clockInAt) : null;
  const nextClockOutAt = params.clockOutAt ? new Date(params.clockOutAt) : null;

  const workMinutes = calcWorkMinutes(nextClockInAt, nextClockOutAt);
const late = await calcLateInfo(nextClockInAt, {
  organizationId,
});

const early = await calcEarlyLeaveInfo(nextClockOutAt, {
  organizationId,
});

  let status:
  | "출근전"
  | "근무중"
  | "퇴근완료"
  | "지각"
  | "조퇴"
  | "병가"
  | "연차"
  | "출장"
  | "반차"
  | "결근" = "출근전";

if (nextClockInAt && !nextClockOutAt) {
  status = late.isLate ? "지각" : "근무중";
}

if (nextClockInAt && nextClockOutAt) {
  if (early.isEarlyLeave) {
    status = "조퇴";
  } else if (late.isLate) {
    status = "지각";
  } else {
    status = "퇴근완료";
  }
}

  await db
    .update(attendanceRecords)
    .set({
      clockInAt: nextClockInAt,
      clockOutAt: nextClockOutAt,
      workMinutes,
      status,
      isLate: late.isLate,
      lateMinutes: late.lateMinutes,
      isEarlyLeave: early.isEarlyLeave,
      earlyLeaveMinutes: early.earlyLeaveMinutes,
      note: params.reason ?? current.note ?? null,
isAbsent: nextClockInAt || nextClockOutAt ? 0 : 1,
isAutoClockOut: 0,
    } as any)
    .where(
  and(
    eq(attendanceRecords.id, params.attendanceId),
    eq(attendanceRecords.organizationId, organizationId)
  )
);

  await db.insert(attendanceAdjustmentLogs).values({
  organizationId,
    attendanceId: current.id,
    targetUserId: current.userId,
    actorUserId: params.actorUserId,
    beforeClockInAt: current.clockInAt ?? null,
    beforeClockOutAt: current.clockOutAt ?? null,
    afterClockInAt: nextClockInAt,
    afterClockOutAt: nextClockOutAt,
    reason: params.reason ?? null,
actionType: "manual_edit",
beforeStatus: current.status ?? null,
afterStatus: status,
note: params.reason ?? null,
  } as InsertAttendanceAdjustmentLog);

  const updated = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, params.attendanceId))
    .limit(1);

  return updated[0] ?? null;
}

export async function listAttendanceAdjustmentLogs(
  attendanceId?: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  if (attendanceId) {
    const [rows] = await db.execute(sql`
      SELECT
        l.*,
        targetUser.name as targetUserName,
        actorUser.name as actorUserName,
targetUser.username as targetUserUsername,
targetUser.phone as targetUserPhone
      FROM attendance_adjustment_logs l
INNER JOIN attendance_records a ON a.id = l.attendanceId
INNER JOIN users targetUser ON targetUser.id = l.targetUserId
INNER JOIN users actorUser ON actorUser.id = l.actorUserId
WHERE l.attendanceId = ${attendanceId}
  AND a.organizationId = ${organizationId}
      ORDER BY l.createdAt DESC, l.id DESC
    `);

    return (rows as any[]) ?? [];
  }

  const [rows] = await db.execute(sql`
  SELECT
    l.*,
    targetUser.name as targetUserName,
    actorUser.name as actorUserName,
    targetUser.username as targetUserUsername,
    targetUser.phone as targetUserPhone
  FROM attendance_adjustment_logs l
INNER JOIN attendance_records a ON a.id = l.attendanceId
INNER JOIN users targetUser ON targetUser.id = l.targetUserId
INNER JOIN users actorUser ON actorUser.id = l.actorUserId
WHERE a.organizationId = ${organizationId}
ORDER BY l.createdAt DESC, l.id DESC
`);

  return (rows as any[]) ?? [];
}

export async function listTeamAttendanceAdjustmentLogs(
  adminUserId: number,
  attendanceId?: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const myTeamId = await getMyTeamId(adminUserId, {
  organizationId,
});
  if (!myTeamId) return [];

  if (attendanceId) {
    const [rows] = await db.execute(sql`
      SELECT
        l.*,
        targetUser.name as targetUserName,
        targetUser.username as targetUserUsername,
        targetUser.phone as targetUserPhone,
        actorUser.name as actorUserName,
        map.teamId,
        t.name as teamName
      FROM attendance_adjustment_logs l
INNER JOIN attendance_records a ON a.id = l.attendanceId
INNER JOIN users targetUser ON targetUser.id = l.targetUserId
INNER JOIN users actorUser ON actorUser.id = l.actorUserId
LEFT JOIN user_org_mappings map ON map.userId = targetUser.id
LEFT JOIN teams t ON t.id = map.teamId
WHERE l.attendanceId = ${attendanceId}
  AND a.organizationId = ${organizationId}
  AND map.teamId = ${myTeamId}
      ORDER BY l.createdAt DESC, l.id DESC
    `);

    return (rows as any[]) ?? [];
  }

  const [rows] = await db.execute(sql`
    SELECT
      l.*,
      targetUser.name as targetUserName,
      targetUser.username as targetUserUsername,
      targetUser.phone as targetUserPhone,
      actorUser.name as actorUserName,
      map.teamId,
      t.name as teamName
    FROM attendance_adjustment_logs l
INNER JOIN attendance_records a ON a.id = l.attendanceId
    INNER JOIN users targetUser ON targetUser.id = l.targetUserId
    INNER JOIN users actorUser ON actorUser.id = l.actorUserId
    LEFT JOIN user_org_mappings map ON map.userId = targetUser.id
    LEFT JOIN teams t ON t.id = map.teamId
    WHERE a.organizationId = ${organizationId}
  AND map.teamId = ${myTeamId}
    ORDER BY l.createdAt DESC, l.id DESC
  `);

  return (rows as any[]) ?? [];
}

export async function getMyProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [rows] = await db.execute(sql`
    SELECT
      u.id,
      u.displayNo,
      u.username,
      u.name,
      u.email,
      u.phone,
      u.role,
      u.profileImageUrl,
      map.teamId,
      map.positionId,
      t.name as teamName,
      p.name as positionName
    FROM users u
    LEFT JOIN user_org_mappings map ON map.userId = u.id
    LEFT JOIN teams t ON t.id = map.teamId
    LEFT JOIN positions p ON p.id = map.positionId
    WHERE u.id = ${userId}
    LIMIT 1
  `);

  return ((rows as any[]) ?? [])[0] ?? null;
}

export async function updateMyProfilePhoto(params: {
  userId: number;
  profileImageUrl: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(users)
    .set({
      profileImageUrl: params.profileImageUrl,
    } as any)
    .where(eq(users.id, params.userId));

  return await getMyProfile(params.userId);
}

export async function changeMyPassword(params: {
  userId: number;
  newPassword: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const passwordHash = await bcrypt.hash(params.newPassword, 10);

  await db
    .update(users)
    .set({
      passwordHash,
    } as any)
    .where(eq(users.id, params.userId));

  return { success: true };
}

// ─── Notices (공지사항) ─────────────────────────────

export async function listNotices(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

const [rows] = await db.execute(sql`
  SELECT *
  FROM notices
  WHERE isActive = 1
    AND organizationId = ${organizationId}
  ORDER BY isPinned DESC, id DESC
`);

  return (rows as any[]) ?? [];
}

export async function getNotice(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return null;

const organizationId = requireOrganizationId(params?.organizationId);

const [rows] = await db.execute(sql`
  SELECT *
  FROM notices
  WHERE id = ${id}
    AND organizationId = ${organizationId}
    AND isActive = 1
  LIMIT 1
`);

  return ((rows as any[]) ?? [])[0] ?? null;
}

export async function createNotice(data: {
organizationId: number;
  title: string;
  content: string;
  authorId: number;
  authorName?: string | null;
  isPinned?: boolean;
importance?: "normal" | "important" | "urgent";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.execute(sql`
   INSERT INTO notices (
organizationId,
  title,
  content,
  authorId,
  authorName,
  isPinned,
  importance,
  isActive,
  viewCount
)
VALUES (
  ${requireOrganizationId(data.organizationId)},
  ${data.title},
  ${data.content},
  ${data.authorId},
  ${data.authorName ?? null},
  ${data.isPinned ? 1 : 0},
  ${data.importance ?? "normal"},
  1,
  0
)
  `);

  return getInsertId(result);
}

export async function updateNotice(
  id: number,
  data: {
    organizationId?: number | null;
    title?: string;
    content?: string;
    isPinned?: boolean;
    importance?: "normal" | "important" | "urgent";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(data.organizationId);

  await db.execute(sql`
    UPDATE notices
    SET
      title = COALESCE(${data.title ?? null}, title),
      content = COALESCE(${data.content ?? null}, content),
      isPinned = COALESCE(${data.isPinned !== undefined ? (data.isPinned ? 1 : 0) : null}, isPinned),
      importance = COALESCE(${data.importance ?? null}, importance)
    WHERE id = ${id}
      AND organizationId = ${organizationId}
      AND isActive = 1
  `);
}

export async function deleteNotice(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db.execute(sql`
    UPDATE notices
    SET isActive = 0
    WHERE id = ${id}
      AND organizationId = ${organizationId}
  `);
}

export async function bulkDeleteNotices(
  ids: number[],
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const cleanIds = Array.from(
    new Set((ids || []).map((id) => Number(id)).filter(Boolean))
  );

  if (!cleanIds.length) return;

const organizationId = requireOrganizationId(params?.organizationId);

  await db.execute(sql`
    UPDATE notices
    SET isActive = 0
    WHERE organizationId = ${organizationId}
      AND id IN (${sql.join(cleanIds.map((id) => sql`${id}`), sql`, `)})
  `);
}

export async function increaseNoticeView(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  await db.execute(sql`
    UPDATE notices
    SET viewCount = COALESCE(viewCount, 0) + 1
    WHERE id = ${id}
      AND organizationId = ${organizationId}
      AND isActive = 1
  `);
}

// ─── Schedules (일정/캘린더) ─────────────────────────────

export async function listMonthSchedules(
  year: number,
  month: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const [rows] = await db.execute(sql`
    SELECT *
    FROM schedules
    WHERE organizationId = ${organizationId}
      AND scheduleDate >= ${start}
      AND scheduleDate < ${end}
      AND isActive = 1
    ORDER BY scheduleDate ASC, startAt ASC, id ASC
  `);

  return (rows as any[]) ?? [];
}

export async function listTodaySchedules(
  userId: number,
  role?: "staff" | "admin" | "host" | "superhost" | string,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const now = new Date();
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + kstOffsetMs);
  const today = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(
    kst.getUTCDate()
  ).padStart(2, "0")}`;

  if (role === "host" || role === "superhost") {
    const [rows] = await db.execute(sql`
      SELECT *
      FROM schedules
      WHERE organizationId = ${organizationId}
        AND scheduleDate = ${today}
        AND isActive = 1
      ORDER BY startAt ASC, id ASC
    `);

    return (rows as any[]) ?? [];
  }

  const [rows] = await db.execute(sql`
    SELECT *
    FROM schedules
    WHERE organizationId = ${organizationId}
      AND scheduleDate = ${today}
      AND isActive = 1
      AND (
        ownerUserId = ${userId}
        OR scope = 'global'
      )
    ORDER BY startAt ASC, id ASC
  `);

  return (rows as any[]) ?? [];
}

export async function createSchedule(data: {
  organizationId?: number | null;
  title: string;
  description?: string | null;
  scheduleDate: string;
  meridiem: "AM" | "PM";
  hour12: number;
  minute: number;
  startAt: string;
  scope: "personal" | "global";
  ownerUserId: number;
  ownerUserName?: string | null;
  createdByRole: "staff" | "admin" | "host" | "superhost" | string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(data.organizationId);

  const result: any = await db.execute(sql`
    INSERT INTO schedules (
      organizationId,
      title,
      description,
      scheduleDate,
      meridiem,
      hour12,
      minute,
      startAt,
      scope,
      ownerUserId,
      ownerUserName,
      createdByRole,
      isActive,
      isNotified
    )
    VALUES (
      ${organizationId},
      ${data.title},
      ${data.description ?? null},
      ${data.scheduleDate},
      ${data.meridiem},
      ${data.hour12},
      ${data.minute},
      ${data.startAt},
      ${data.scope},
      ${data.ownerUserId},
      ${data.ownerUserName ?? null},
      ${data.createdByRole},
      1,
      0
    )
  `);

  return getInsertId(result);
}

export async function updateSchedule(
  id: number,
  userId: number,
  role: "staff" | "admin" | "host" | "superhost" | string,
  data: {
    organizationId?: number | null;
    title?: string;
    description?: string | null;
    scheduleDate?: string;
    meridiem?: "AM" | "PM";
    hour12?: number;
    minute?: number;
    startAt?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(data.organizationId);

  const [rows] = await db.execute(sql`
    SELECT *
    FROM schedules
    WHERE id = ${id}
      AND organizationId = ${organizationId}
      AND isActive = 1
    LIMIT 1
  `);

  const row = ((rows as any[]) ?? [])[0] ?? null;

  if (!row) {
    throw new Error("일정을 찾을 수 없습니다.");
  }

  const isOwner = Number(row.ownerUserId) === Number(userId);
  const isPrivileged = role === "host" || role === "superhost";

  if (!isOwner && !isPrivileged) {
    throw new Error("수정 권한이 없습니다.");
  }

  await db.execute(sql`
    UPDATE schedules
    SET
      title = COALESCE(${data.title ?? null}, title),
      description = COALESCE(${data.description ?? null}, description),
      scheduleDate = COALESCE(${data.scheduleDate ?? null}, scheduleDate),
      meridiem = COALESCE(${data.meridiem ?? null}, meridiem),
      hour12 = COALESCE(${data.hour12 ?? null}, hour12),
      minute = COALESCE(${data.minute ?? null}, minute),
      startAt = COALESCE(${data.startAt ?? null}, startAt),
      isNotified = 0
    WHERE id = ${id}
      AND organizationId = ${organizationId}
      AND isActive = 1
  `);
}

export async function deleteSchedule(
  id: number,
  userId: number,
  role: "staff" | "admin" | "host" | "superhost" | string,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
    SELECT *
    FROM schedules
    WHERE id = ${id}
      AND organizationId = ${organizationId}
      AND isActive = 1
    LIMIT 1
  `);

  const row = ((rows as any[]) ?? [])[0] ?? null;

  if (!row) {
    throw new Error("일정을 찾을 수 없습니다.");
  }

  const isOwner = Number(row.ownerUserId) === Number(userId);
  const isPrivileged = role === "host" || role === "superhost";

  if (!isOwner && !isPrivileged) {
    throw new Error("삭제 권한이 없습니다.");
  }

  await db.execute(sql`
    UPDATE schedules
    SET isActive = 0
    WHERE id = ${id}
      AND organizationId = ${organizationId}
  `);
}




function pad2(n: number) {
  return String(n).padStart(2, "0");
}

async function getNextApprovalDocumentNumber(
  formType: "attendance" | "business_trip" | "general",
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params?.organizationId);

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);

  const prefix =
    formType === "attendance"
      ? "ATT"
      : formType === "business_trip"
      ? "BIZ"
      : "GEN";

  const likePrefix = `${prefix}-${yyyy}${mm}-%`;

  const [rows] = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM approval_documents
    WHERE organizationId = ${organizationId}
      AND documentNumber LIKE ${likePrefix}
  `);

  const count = Number((rows as any)?.[0]?.cnt ?? 0) + 1;
  return `${prefix}-${yyyy}${mm}-${String(count).padStart(4, "0")}`;
}

export async function getApprovalSetting(
  formType: "attendance" | "business_trip" | "general",
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return null;

const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(approvalSettings)
    .where(
      and(
        eq(approvalSettings.organizationId, organizationId),
        eq(approvalSettings.formType, formType)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function saveApprovalSetting(params: {
  organizationId?: number | null;
  formType: "attendance" | "business_trip" | "general";
  firstApproverUserId?: number | null;
  secondApproverUserId?: number | null;
  thirdApproverUserId?: number | null;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params.organizationId);

  const existing = await getApprovalSetting(params.formType, {
    organizationId,
  });

  const payload: InsertApprovalSetting = {
    organizationId,
    formType: params.formType,
    firstApproverUserId: params.firstApproverUserId ?? null,
    secondApproverUserId: params.secondApproverUserId ?? null,
    thirdApproverUserId: params.thirdApproverUserId ?? null,
    isActive: true,
    createdBy: params.actorUserId,
    updatedBy: params.actorUserId,
  } as any;

  if (existing) {
    await db
      .update(approvalSettings)
      .set({
        firstApproverUserId: params.firstApproverUserId ?? null,
        secondApproverUserId: params.secondApproverUserId ?? null,
        thirdApproverUserId: params.thirdApproverUserId ?? null,
        updatedBy: params.actorUserId,
      } as any)
      .where(
        and(
          eq(approvalSettings.id, existing.id),
          eq(approvalSettings.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db.insert(approvalSettings).values(payload as any);
  return getInsertId(result);
}

export async function createApprovalLog(data: InsertApprovalLog) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(approvalLogs).values({
    organizationId: requireOrganizationId((data as any).organizationId),
    ...data,
  } as any);

  return getInsertId(result);
}

export async function createApprovalDocument(params: {
  organizationId?: number | null;

  formType: "attendance" | "business_trip" | "general";
  subType: string;
  title: string;
  reason?: string | null;

  applicantUserId: number;
  applicantUserName?: string | null;
  applicantTeamId?: number | null;
  applicantTeamName?: string | null;
  applicantPositionId?: number | null;
  applicantPositionName?: string | null;

  targetDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;

  attachmentName?: string | null;
  attachmentUrl?: string | null;

  attendanceDetailType?: string | null;
  attendanceStartTime?: string | null;
  attendanceEndTime?: string | null;

  destination?: string | null;
  visitPlace?: string | null;
  companion?: string | null;

  requestDepartment?: string | null;
  extraNote?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params.organizationId);

  const documentNumber = await getNextApprovalDocumentNumber(params.formType, {
    organizationId,
  });

  const setting = await getApprovalSetting(params.formType, {
    organizationId,
  });

  if (params.formType === "attendance" && !params.targetDate) {
    throw new Error("근태 문서는 시행일자 필수");
  }

  if (
    params.formType === "business_trip" &&
    !params.targetDate &&
    !(params.startDate && params.endDate)
  ) {
    throw new Error("출장 문서는 시행일자 또는 시작일/종료일이 필요합니다.");
  }

  const approverIds = [
    setting?.firstApproverUserId,
    setting?.secondApproverUserId,
    setting?.thirdApproverUserId,
  ].filter((x) => Number(x || 0) > 0);

  if (!approverIds.length) {
    throw new Error("전자결재 승인자가 설정되지 않았습니다.");
  }

  const attendanceTargetStatus =
    params.formType === "attendance"
      ? (params.subType as any)
      : params.formType === "business_trip"
      ? "출장"
      : null;

  const result: any = await db.insert(approvalDocuments).values({
    organizationId,
    documentNumber,
    formType: params.formType,
    subType: params.subType,
    title: params.title,
    reason: params.reason ?? null,

    applicantUserId: params.applicantUserId,
    applicantUserName: params.applicantUserName ?? null,
    applicantTeamId: params.applicantTeamId ?? null,
    applicantTeamName: params.applicantTeamName ?? null,
    applicantPositionId: params.applicantPositionId ?? null,
    applicantPositionName: params.applicantPositionName ?? null,

    targetDate: params.targetDate ?? null,
    startDate: params.startDate ?? null,
    endDate: params.endDate ?? null,

    status: "pending",
    currentStepOrder: 1,

    attendanceApplied: false,
    attendanceTargetStatus: attendanceTargetStatus as any,

    attachmentName: params.attachmentName ?? null,
    attachmentUrl: params.attachmentUrl ?? null,

    attendanceDetailType: params.attendanceDetailType ?? null,
    attendanceStartTime: params.attendanceStartTime ?? null,
    attendanceEndTime: params.attendanceEndTime ?? null,

    destination: params.destination ?? null,
    visitPlace: params.visitPlace ?? null,
    companion: params.companion ?? null,

    requestDepartment: params.requestDepartment ?? null,
    extraNote: params.extraNote ?? null,
  } as any);

  const documentId = Number(getInsertId(result));

  const lines: InsertApprovalDocumentLine[] = [];

  const approverUsers = await getAllUsersDetailed({
    organizationId,
  });

  let step = 1;

  for (const approverUserId of approverIds) {
    const found = approverUsers.find(
      (u: any) => Number(u.id) === Number(approverUserId)
    );

    lines.push({
      organizationId,
      documentId,
      stepOrder: step,
      approverUserId: Number(approverUserId),
      approverName: found?.name ?? null,
      approverRole: found?.role ?? null,
      stepStatus: "pending",
    } as any);

    step += 1;
  }

  if (lines.length) {
    await db.insert(approvalDocumentLines).values(lines as any);
  }

  await createApprovalLog({
    organizationId,
    documentId,
    actorUserId: params.applicantUserId,
    actorUserName: params.applicantUserName ?? null,
    actionType: "create",
    note: `${params.formType} 문서 생성`,
  } as any);

  return documentId;
}

export async function listMyApprovalDocuments(
  userId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
    SELECT *
    FROM approval_documents
    WHERE organizationId = ${organizationId}
      AND applicantUserId = ${userId}
    ORDER BY createdAt DESC, id DESC
  `);

  return (rows as any[]) ?? [];
}

export async function getApprovalDocument(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return null;

const organizationId = requireOrganizationId(params?.organizationId);

  const [docRows] = await db.execute(sql`
    SELECT *
    FROM approval_documents
    WHERE id = ${id}
      AND organizationId = ${organizationId}
    LIMIT 1
  `);

  const doc = ((docRows as any[]) ?? [])[0] ?? null;
  if (!doc) return null;

  const [lineRows] = await db.execute(sql`
    SELECT *
    FROM approval_document_lines
    WHERE organizationId = ${organizationId}
      AND documentId = ${id}
    ORDER BY stepOrder ASC, id ASC
  `);

  const [logRows] = await db.execute(sql`
    SELECT *
    FROM approval_logs
    WHERE organizationId = ${organizationId}
      AND documentId = ${id}
    ORDER BY createdAt DESC, id DESC
  `);

  return {
    document: doc,
    lines: (lineRows as any[]) ?? [],
    logs: (logRows as any[]) ?? [],
  };
}

export async function listPendingApprovalDocumentsForApprover(
  userId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
    SELECT d.*, l.id as lineId, l.stepOrder, l.stepStatus
    FROM approval_documents d
    INNER JOIN approval_document_lines l
      ON l.documentId = d.id
     AND l.organizationId = d.organizationId
    WHERE d.organizationId = ${organizationId}
      AND l.organizationId = ${organizationId}
      AND l.approverUserId = ${userId}
      AND l.stepStatus = 'pending'
      AND d.status = 'pending'
      AND d.currentStepOrder = l.stepOrder
    ORDER BY d.createdAt DESC, d.id DESC
  `);

  return (rows as any[]) ?? [];
}

export async function applyApprovedDocumentToAttendance(params: {
  organizationId?: number | null;
  documentId: number;
  actorUserId: number;
  actorUserName?: string | null;
}) {
  const db = await getDb();
if (!db) throw new Error("DB not available");

const organizationId = requireOrganizationId(params.organizationId);

const detail = await getApprovalDocument(params.documentId, {
  organizationId,
});
  if (!detail?.document) throw new Error("전자결재 문서를 찾을 수 없습니다.");

  const doc: any = detail.document;

const targetDate = String(doc.targetDate || "").slice(0, 10);

const approvedClockInAt = parseApprovalTimeToDate(
  targetDate,
  doc.attendanceStartTime
);

const approvedClockOutAt = parseApprovalTimeToDate(
  targetDate,
  doc.attendanceEndTime
);

const lateInfo = await calcLateInfo(approvedClockInAt);
const earlyInfo = await calcEarlyLeaveInfo(approvedClockOutAt);


  if (doc.attendanceApplied) {
    return true;
  }

  if (doc.formType !== "attendance" && doc.formType !== "business_trip") {
    await db
  .update(approvalDocuments)
  .set({
    attendanceApplied: true,
    attendanceAppliedAt: new Date(),
  } as any)
  .where(
    and(
      eq(approvalDocuments.id, params.documentId),
      eq(approvalDocuments.organizationId, organizationId)
    )
  );

    return true;
  }

if (doc.formType === "business_trip" && doc.startDate && doc.endDate) {
  const start = new Date(doc.startDate);
  const end = new Date(doc.endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

    const [rows] = await db.execute(sql`
      SELECT *
      FROM attendance_records
      WHERE userId = ${doc.applicantUserId}
        AND workDate = ${dateStr}
      LIMIT 1
    `);

    const attendanceRow = ((rows as any[]) ?? [])[0] ?? null;

    if (!attendanceRow) {
      const insertResult: any = await db.insert(attendanceRecords).values({
        userId: Number(doc.applicantUserId),
        workDate: dateStr,
        status: "출장" as any,
leaveType: "출장",
        note: `[전자결재 승인 반영] 출장 / ${doc.reason ?? ""}`,
        isAbsent: 0,
      } as any);

      const attendanceId = Number(getInsertId(insertResult));

      await db.insert(attendanceAdjustmentLogs).values({
  organizationId,
        attendanceId,
        targetUserId: Number(doc.applicantUserId),
        actorUserId: params.actorUserId,
        beforeClockInAt: null,
        beforeClockOutAt: null,
        afterClockInAt: null,
        afterClockOutAt: null,
        reason: "출장",
        actionType: "apply_business_trip",
        beforeStatus: null,
        afterStatus: "출장",
        note: `[전자결재 승인 반영] ${doc.reason ?? ""}`,
      } as any);
    } else {
      const beforeStatus = attendanceRow.status ?? null;

      await db
        .update(attendanceRecords)
        .set({
          status: "출장" as any,
leaveType: "출장",
          note: `[전자결재 승인 반영] 출장 / ${doc.reason ?? ""}`,
          isAbsent: 0,
        } as any)
        .where(eq(attendanceRecords.id, Number(attendanceRow.id)));

      await db.insert(attendanceAdjustmentLogs).values({
  organizationId,
        attendanceId: Number(attendanceRow.id),
        targetUserId: Number(doc.applicantUserId),
        actorUserId: params.actorUserId,
        beforeClockInAt,
        beforeClockOutAt,
        afterClockInAt: attendanceRow.clockInAt ?? null,
        afterClockOutAt: attendanceRow.clockOutAt ?? null,
        reason: "출장",
        actionType: "apply_business_trip",
        beforeStatus,
        afterStatus: "출장",
        note: `[전자결재 승인 반영] ${doc.reason ?? ""}`,
      } as any);
    }
  }

  await db
  .update(approvalDocuments)
  .set({
    attendanceApplied: true,
    attendanceAppliedAt: new Date(),
  } as any)
  .where(
    and(
      eq(approvalDocuments.id, params.documentId),
      eq(approvalDocuments.organizationId, organizationId)
    )
  );

  await createApprovalLog({
  organizationId,
  documentId: params.documentId,
  actorUserId: params.actorUserId,
    actorUserName: params.actorUserName ?? null,
    actionType: "apply_attendance",
    note: "출장 기간 근태 기록부 자동 반영 완료",
  } as any);

  return true;
}

 const applyDate = doc.targetDate || doc.startDate || doc.endDate;
  if (!targetDate) {
    throw new Error("근태 반영 대상 날짜가 없습니다.");
  }

  const [rows] = await db.execute(sql`
    SELECT *
    FROM attendance_records
    WHERE userId = ${doc.applicantUserId}
      AND workDate = ${targetDate}
    LIMIT 1
  `);

  let attendanceRow = ((rows as any[]) ?? [])[0] ?? null;

const beforeClockInAt = attendanceRow?.clockInAt ?? null;
const beforeClockOutAt = attendanceRow?.clockOutAt ?? null;
const beforeStatus = attendanceRow?.status ?? null;

  if (!attendanceRow) {
  const insertResult: any = await db.insert(attendanceRecords).values({
    userId: Number(doc.applicantUserId),
    workDate: applyDate,
    status: (doc.attendanceTargetStatus || (doc.formType === "business_trip" ? "출장" : "출근전")) as any,
    leaveType:
      doc.formType === "attendance"
        ? (doc.subType ?? doc.attendanceTargetStatus ?? null)
        : doc.formType === "business_trip"
        ? "출장"
        : null,

    clockInAt:
      doc.subType === "지각" || doc.subType === "반차"
        ? approvedClockInAt
        : null,

    clockOutAt:
      doc.subType === "조퇴" || doc.subType === "반차"
        ? approvedClockOutAt
        : null,

    workMinutes: calcMinutesBetween(
      doc.subType === "지각" || doc.subType === "반차" ? approvedClockInAt : null,
      doc.subType === "조퇴" || doc.subType === "반차" ? approvedClockOutAt : null
    ),

isLate:
  doc.subType === "지각" || doc.subType === "반차"
    ? lateInfo.isLate
    : 0,

lateMinutes:
  doc.subType === "지각" || doc.subType === "반차"
    ? lateInfo.lateMinutes
    : 0,

isEarlyLeave:
  doc.subType === "조퇴" || doc.subType === "반차"
    ? earlyInfo.isEarlyLeave
    : 0,

earlyLeaveMinutes:
  doc.subType === "조퇴" || doc.subType === "반차"
    ? earlyInfo.earlyLeaveMinutes
    : 0,

    note: `[전자결재 승인 반영] ${doc.subType}`,
    isAbsent: doc.attendanceTargetStatus === "결근" ? 1 : 0,
  } as any);

    const attendanceId = Number(getInsertId(insertResult));

    const [newRows] = await db.execute(sql`
      SELECT *
      FROM attendance_records
      WHERE id = ${attendanceId}
      LIMIT 1
    `);

    attendanceRow = ((newRows as any[]) ?? [])[0] ?? null;
  } else {
    await db
  .update(attendanceRecords)
  .set({
    status: (doc.attendanceTargetStatus || (doc.formType === "business_trip" ? "출장" : attendanceRow.status)) as any,
    leaveType:
      doc.formType === "attendance"
        ? (doc.subType ?? doc.attendanceTargetStatus ?? null)
        : doc.formType === "business_trip"
        ? "출장"
        : null,

    clockInAt:
      doc.subType === "지각" || doc.subType === "반차"
        ? (approvedClockInAt ?? attendanceRow.clockInAt ?? null)
        : attendanceRow.clockInAt ?? null,

    clockOutAt:
      doc.subType === "조퇴" || doc.subType === "반차"
        ? (approvedClockOutAt ?? attendanceRow.clockOutAt ?? null)
        : attendanceRow.clockOutAt ?? null,

    workMinutes: calcMinutesBetween(
      doc.subType === "지각" || doc.subType === "반차"
        ? (approvedClockInAt ?? attendanceRow.clockInAt ?? null)
        : attendanceRow.clockInAt ?? null,
      doc.subType === "조퇴" || doc.subType === "반차"
        ? (approvedClockOutAt ?? attendanceRow.clockOutAt ?? null)
        : attendanceRow.clockOutAt ?? null
    ),

isLate:
  doc.subType === "지각" || doc.subType === "반차"
    ? lateInfo.isLate
    : attendanceRow.isLate ?? 0,

lateMinutes:
  doc.subType === "지각" || doc.subType === "반차"
    ? lateInfo.lateMinutes
    : attendanceRow.lateMinutes ?? 0,

isEarlyLeave:
  doc.subType === "조퇴" || doc.subType === "반차"
    ? earlyInfo.isEarlyLeave
    : attendanceRow.isEarlyLeave ?? 0,

earlyLeaveMinutes:
  doc.subType === "조퇴" || doc.subType === "반차"
    ? earlyInfo.earlyLeaveMinutes
    : attendanceRow.earlyLeaveMinutes ?? 0,

    note: `[전자결재 승인 반영] ${doc.subType} / ${doc.reason ?? ""}`,
    isAbsent:
      doc.attendanceTargetStatus === "결근"
        ? 1
        : doc.attendanceTargetStatus === "병가" ||
          doc.attendanceTargetStatus === "연차" ||
          doc.attendanceTargetStatus === "출장" ||
          doc.attendanceTargetStatus === "반차"
        ? 0
        : attendanceRow.isAbsent,
  } as any)
  .where(eq(attendanceRecords.id, Number(attendanceRow.id)));
  }

  await db.insert(attendanceAdjustmentLogs).values({
  organizationId,
    attendanceId: Number(attendanceRow.id),
    targetUserId: Number(doc.applicantUserId),
    actorUserId: params.actorUserId,
    beforeClockInAt: attendanceRow.clockInAt ?? null,
    beforeClockOutAt: attendanceRow.clockOutAt ?? null,
    afterClockInAt:
  doc.subType === "지각" || doc.subType === "반차"
    ? (approvedClockInAt ?? attendanceRow.clockInAt ?? null)
    : attendanceRow.clockInAt ?? null,

afterClockOutAt:
  doc.subType === "조퇴" || doc.subType === "반차"
    ? (approvedClockOutAt ?? attendanceRow.clockOutAt ?? null)
    : attendanceRow.clockOutAt ?? null,
    reason: doc.subType,
    actionType:
      doc.formType === "business_trip"
        ? "apply_business_trip"
        : doc.subType === "병가"
        ? "apply_sick_leave"
        : doc.subType === "연차"
        ? "apply_annual_leave"
        : doc.subType === "반차"
        ? "apply_half_day"
        : "manual_edit",
    beforeStatus,
    afterStatus: doc.attendanceTargetStatus ?? (doc.formType === "business_trip" ? "출장" : attendanceRow.status),
    note: `[전자결재 승인 반영] ${doc.reason ?? ""}`,
  } as any);

  await db
    .update(approvalDocuments)
    .set({
      attendanceApplied: true,
      attendanceAppliedAt: new Date(),
    } as any)
    .where(eq(approvalDocuments.id, params.documentId));

  await createApprovalLog({
    documentId: params.documentId,
    actorUserId: params.actorUserId,
    actorUserName: params.actorUserName ?? null,
    actionType: "apply_attendance",
    note: "근태 기록부 자동 반영 완료",
  } as any);

  return true;
}

export async function approveApprovalDocument(params: {
  organizationId?: number | null;
  documentId: number;
  approverUserId: number;
  approverUserName?: string | null;
  comment?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params.organizationId);

  const detail = await getApprovalDocument(params.documentId, {
    organizationId,
  });
  if (!detail?.document) throw new Error("문서를 찾을 수 없습니다.");

  const doc: any = detail.document;

  const currentLine = (detail.lines || []).find(
    (line: any) =>
      Number(line.approverUserId) === Number(params.approverUserId) &&
      Number(line.stepOrder) === Number(doc.currentStepOrder) &&
      line.stepStatus === "pending"
  );

  if (!currentLine) {
    throw new Error("현재 승인 권한이 없습니다.");
  }

  await db
    .update(approvalDocumentLines)
    .set({
      stepStatus: "approved",
      actedAt: new Date(),
      comment: params.comment ?? null,
    } as any)
    .where(
      and(
        eq(approvalDocumentLines.id, Number(currentLine.id)),
        eq(approvalDocumentLines.organizationId, organizationId)
      )
    );

  const nextLine = (detail.lines || []).find(
    (line: any) =>
      Number(line.stepOrder) === Number(doc.currentStepOrder) + 1
  );

  if (nextLine) {
    await db
      .update(approvalDocuments)
      .set({
        currentStepOrder: Number(doc.currentStepOrder) + 1,
      } as any)
      .where(
        and(
          eq(approvalDocuments.id, params.documentId),
          eq(approvalDocuments.organizationId, organizationId)
        )
      );
  } else {
    await db
      .update(approvalDocuments)
      .set({
        status: "approved",
        finalApprovedAt: new Date(),
      } as any)
      .where(
        and(
          eq(approvalDocuments.id, params.documentId),
          eq(approvalDocuments.organizationId, organizationId)
        )
      );

    await applyApprovedDocumentToAttendance({
  organizationId,
  documentId: params.documentId,
  actorUserId: params.approverUserId,
  actorUserName: params.approverUserName ?? null,
});
  }

  await createApprovalLog({
    organizationId,
    documentId: params.documentId,
    actorUserId: params.approverUserId,
    actorUserName: params.approverUserName ?? null,
    actionType: "approve",
    note: params.comment ?? "승인 처리",
  } as any);

  return true;
}

export async function rejectApprovalDocument(params: {
  organizationId?: number | null;
  documentId: number;
  approverUserId: number;
  approverUserName?: string | null;
  comment?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = requireOrganizationId(params.organizationId);

  const detail = await getApprovalDocument(params.documentId, {
    organizationId,
  });
  if (!detail?.document) throw new Error("문서를 찾을 수 없습니다.");

  const doc: any = detail.document;

  const currentLine = (detail.lines || []).find(
    (line: any) =>
      Number(line.approverUserId) === Number(params.approverUserId) &&
      Number(line.stepOrder) === Number(doc.currentStepOrder) &&
      line.stepStatus === "pending"
  );

  if (!currentLine) {
    throw new Error("현재 반려 권한이 없습니다.");
  }

  await db
    .update(approvalDocumentLines)
    .set({
      stepStatus: "rejected",
      actedAt: new Date(),
      comment: params.comment ?? null,
    } as any)
    .where(
      and(
        eq(approvalDocumentLines.id, Number(currentLine.id)),
        eq(approvalDocumentLines.organizationId, organizationId)
      )
    );

  await db
    .update(approvalDocuments)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
    } as any)
    .where(
      and(
        eq(approvalDocuments.id, params.documentId),
        eq(approvalDocuments.organizationId, organizationId)
      )
    );

  await createApprovalLog({
    organizationId,
    documentId: params.documentId,
    actorUserId: params.approverUserId,
    actorUserName: params.approverUserName ?? null,
    actionType: "reject",
    note: params.comment ?? "반려 처리",
  } as any);

  return true;
}

// ===============================
// 학점은행제 템플릿 → subjectCatalog 이관 (1회용)
// ===============================
export async function migrateCourseTemplatesToSubjectCatalogs(db: any) {
  console.log("🚀 courseTemplate → subjectCatalog 이관 시작");

  // 1. 기존 템플릿 가져오기
  const templates = await db
    .select()
    .from(courseTemplate); // 기존 테이블명

  if (!templates.length) {
    console.log("⚠️ courseTemplate 데이터 없음");
    return;
  }

  // 2. courseKey 기준 그룹핑
  const map = new Map<string, any[]>();

  for (const row of templates) {
    const key = row.courseKey || "기타";

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key)!.push(row);
  }

  // 3. catalog 생성 + item 넣기
  for (const [courseKey, items] of map.entries()) {
    console.log(`📦 과정 생성: ${courseKey}`);

    // catalog 존재 체크
    let [catalog] = await db
      .select()
      .from(subjectCatalogs)
      .where(eq(subjectCatalogs.name, courseKey))
      .limit(1);

    // 없으면 생성
    if (!catalog) {
      const [created] = await db
        .insert(subjectCatalogs)
        .values({
          name: courseKey,
        })
        .returning();

      catalog = created;
    }

    // 4. item 삽입
    for (const item of items) {
      // 중복 체크
      const exists = await db
        .select()
        .from(subjectCatalogItems)
        .where(
          and(
            eq(subjectCatalogItems.catalogId, catalog.id),
            eq(subjectCatalogItems.subjectName, item.subjectName),
            eq(
              subjectCatalogItems.requirementType,
              item.requirementType || "선택"
            )
          )
        )
        .limit(1);

      if (exists.length > 0) continue;

      await db.insert(subjectCatalogItems).values({
        catalogId: catalog.id,
        subjectName: item.subjectName,
        requirementType: item.requirementType || "선택",
        category: item.category || null,
        sortOrder: item.sortOrder || 0,
      });
    }
  }

  console.log("✅ 이관 완료");
}