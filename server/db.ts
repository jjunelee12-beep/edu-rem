import { eq, and, or, sql, desc, like, asc, inArray } from "drizzle-orm";
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
settlementSubjectPriceRules,
settlementInstitutionPriceRules,
settlementMonthLocks,
practiceListCategories,
InsertPracticeListCategory,
  practiceInstitutions,
  InsertPracticeInstitution,
  jobSupportRequests,
  InsertJobSupportRequest,
practiceEducationCenters,
  InsertPracticeEducationCenter,
practiceInstitutionMasters,
organizationPracticeInstitutionOverrides,
practiceEducationCenterMasters,
organizationPracticeEducationCenterOverrides,
  notifications,
  InsertNotification,
deviceTokens,
  InsertDeviceToken,
aiActionLogs,
aiPendingActions,
type InsertAiPendingAction,
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
smsOptOuts,
type InsertSmsOptOut,
type InsertApprovalLog,
organizationBackups,
type InsertOrganizationBackup,
auditLogs,
type InsertAuditLog,
studentAuditLogs,
type InsertStudentAuditLog,
emailVerificationCodes,
type InsertEmailVerificationCode,
apiErrorLogs,
type InsertApiErrorLog,
creditSummaryRules,
type InsertCreditSummaryRule,
studentCreditSummaryItems,
type InsertStudentCreditSummaryItem,
} from "../drizzle/schema";

import { ENV } from "./_core/env";
import bcrypt from "bcryptjs";
import {
  createHmac,
  randomUUID,
} from "node:crypto";
import { emitLiveNotification } from "./_core/live-notifications";
import { getSocketStatus } from "./_core/socket-status";
import { throwAppError } from "./_core/appError";
import { ERROR_CODES } from "./_core/errorCodes";
import type {
  AiDocumentImportDraft,
  AiPendingActionType,
  StudentRegistrationDraft,
} from "./ai/ai.types";

import { FEATURE_FLAGS } from "./_core/featureFlags";
import {
  encryptPersonalData,
  decryptPersonalData,
  createEmailHash,
  createNameHash,
  createPhoneHash,
  createBankAccountHash,
  getPhoneLast4,
  getBankAccountLast4,
} from "./security/crypto";


async function geocodeAddressServer(address: string) {
  const restKey =
    process.env.KAKAO_REST_API_KEY ||
    (ENV as any)?.KAKAO_REST_API_KEY ||
    "";

  if (!restKey) {
    throwAppError(
  ERROR_CODES.EXTERNAL_API_FAILED,
  "KAKAO_REST_API_KEY가 설정되지 않았습니다.",
  500
);
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
    throwAppError(
  ERROR_CODES.EXTERNAL_API_FAILED,
  `카카오 주소 변환 요청 실패 (${res.status})`,
  502
);
  }

  const json = await res.json();

  if (!json?.documents?.length) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "주소 변환 결과가 없습니다.",
  404
);
  }

  return {
    lat: Number(json.documents[0].y),
    lng: Number(json.documents[0].x),
  };
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(process.env.DATABASE_URL);
    const [r] = await _db.execute(
      sql`SELECT DATABASE() as db, @@port as port, @@hostname as host`
    );
  }
  return _db;
}

export async function getSystemHealthStatus() {
  const startedAt = new Date(Date.now() - process.uptime() * 1000);
  const checkedAt = new Date();

  let dbStatus: "ok" | "error" = "error";
  let dbName: string | null = null;
  let dbHost: string | null = null;
  let dbPort: number | null = null;
  let dbError: string | null = null;

  try {
    const db = await getDb();

    if (!db) {
      throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);
    }

    const [rows] = await db.execute(sql`
      SELECT
        1 as ok,
        DATABASE() as dbName,
        @@hostname as dbHost,
        @@port as dbPort
    `);

    const row = (rows as any)?.[0];

    dbStatus = Number(row?.ok || 0) === 1 ? "ok" : "error";
    dbName = row?.dbName || null;
    dbHost = row?.dbHost || null;
    dbPort = row?.dbPort ? Number(row.dbPort) : null;
  } catch (error: any) {
    dbStatus = "error";
    dbError = error?.message || String(error);
  }

  const envStatus = {
    nodeEnv: process.env.NODE_ENV || null,
    railwayEnvironment: process.env.RAILWAY_ENVIRONMENT || null,
    railwayServiceName: process.env.RAILWAY_SERVICE_NAME || null,
    railwayProjectName: process.env.RAILWAY_PROJECT_NAME || null,
    railwayDeploymentId: process.env.RAILWAY_DEPLOYMENT_ID || null,
    railwayGitCommitSha: process.env.RAILWAY_GIT_COMMIT_SHA || null,
  };

const gitCommitSha = process.env.RAILWAY_GIT_COMMIT_SHA || null;

  return {
  api: {
    status: "ok",
    checkedAt: checkedAt.toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: startedAt.toISOString(),
  },
  socket: getSocketStatus(),
  db: {
      status: dbStatus,
      dbName,
      dbHost,
      dbPort,
      error: dbError,
    },
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      memoryMb: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    },
    env: {
  ...envStatus,
  gitCommitShort: gitCommitSha ? gitCommitSha.slice(0, 8) : null,
  serverStartedAt: startedAt.toISOString(),
  checkedAt: checkedAt.toISOString(),
},
  };
}


function requireOrganizationId(value: any) {
  const organizationId = Number(value || 0);

  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    throwAppError(
      ERROR_CODES.ORGANIZATION_REQUIRED,
      "organizationId is required",
      400
    );
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

  return result[0]
  ? decryptStudentPersonalData(result[0])
  : undefined;
}

function getInsertId(result: any) {
  return result?.insertId ?? result?.[0]?.insertId ?? null;
}

function decryptUserPersonalData<T extends Record<string, any>>(
  row: T | null | undefined
): T | null | undefined {
  if (!row) {
    return row;
  }

  return {
    ...row,

    name:
      row.name === null || row.name === undefined
        ? row.name
        : decryptPersonalData(row.name),

    email:
      row.email === null || row.email === undefined
        ? row.email
        : decryptPersonalData(row.email),

    phone:
      row.phone === null || row.phone === undefined
        ? row.phone
        : decryptPersonalData(row.phone),

    bankAccount:
      row.bankAccount === null || row.bankAccount === undefined
        ? row.bankAccount
        : decryptPersonalData(row.bankAccount),
  };
}

function decryptConsultationPersonalData<T extends Record<string, any>>(
  row: T | null | undefined
): T | null | undefined {
  if (!row) {
    return row;
  }

  return {
    ...row,

    clientName:
      row.clientName === null || row.clientName === undefined
        ? row.clientName
        : decryptPersonalData(row.clientName),

    phone:
      row.phone === null || row.phone === undefined
        ? row.phone
        : decryptPersonalData(row.phone),
  };
}

function prepareConsultationPersonalData<
  T extends Record<string, any>
>(data: T): T & Record<string, any> {
  const nextData: Record<string, any> = {
    ...data,
  };

  if (data.clientName !== undefined) {
    const plainClientName =
      data.clientName === null
        ? null
        : String(data.clientName).trim() || null;

    nextData.clientName = plainClientName
      ? encryptPersonalData(plainClientName)
      : null;

    nextData.clientNameHash = plainClientName
      ? createNameHash(plainClientName)
      : null;
  }

  if (data.phone !== undefined) {
    const plainPhone =
      data.phone === null
        ? null
        : String(data.phone).replace(/\D/g, "") || null;

    nextData.phone = plainPhone
      ? encryptPersonalData(plainPhone)
      : null;

    nextData.phoneHash = plainPhone
      ? createPhoneHash(plainPhone)
      : null;

    nextData.phoneLast4 = plainPhone
      ? getPhoneLast4(plainPhone)
      : null;
  }

  return nextData as T & Record<string, any>;
}

function decryptStudentPersonalData<T extends Record<string, any>>(
  row: T | null | undefined
): T | null | undefined {
  if (!row) {
    return row;
  }

  return {
    ...row,

    clientName:
      row.clientName === null || row.clientName === undefined
        ? row.clientName
        : decryptPersonalData(row.clientName),

    phone:
      row.phone === null || row.phone === undefined
        ? row.phone
        : decryptPersonalData(row.phone),

    address:
      row.address === null || row.address === undefined
        ? row.address
        : decryptPersonalData(row.address),

    detailAddress:
      row.detailAddress === null ||
      row.detailAddress === undefined
        ? row.detailAddress
        : decryptPersonalData(row.detailAddress),

    studentLoginId:
      row.studentLoginId === null ||
      row.studentLoginId === undefined
        ? row.studentLoginId
        : decryptPersonalData(row.studentLoginId),
  };
}

function prepareStudentPersonalData<
  T extends Record<string, any>
>(data: T): T & Record<string, any> {
  const nextData: Record<string, any> = {
    ...data,
  };

  if (data.clientName !== undefined) {
    const plainClientName =
      data.clientName === null
        ? null
        : String(data.clientName).trim() || null;

    nextData.clientName = plainClientName
      ? encryptPersonalData(plainClientName)
      : null;

    nextData.clientNameHash = plainClientName
      ? createNameHash(plainClientName)
      : null;
  }

  if (data.phone !== undefined) {
    const plainPhone =
      data.phone === null
        ? null
        : String(data.phone).replace(/\D/g, "") || null;

    nextData.phone = plainPhone
      ? encryptPersonalData(plainPhone)
      : null;

    nextData.phoneHash = plainPhone
      ? createPhoneHash(plainPhone)
      : null;

    nextData.phoneLast4 = plainPhone
      ? getPhoneLast4(plainPhone)
      : null;
  }

  if (data.address !== undefined) {
    const plainAddress =
      data.address === null
        ? null
        : String(data.address).trim() || null;

    nextData.address = plainAddress
      ? encryptPersonalData(plainAddress)
      : null;
  }

  if (data.detailAddress !== undefined) {
    const plainDetailAddress =
      data.detailAddress === null
        ? null
        : String(data.detailAddress).trim() || null;

    nextData.detailAddress = plainDetailAddress
      ? encryptPersonalData(plainDetailAddress)
      : null;
  }

  if (data.studentLoginId !== undefined) {
    const plainStudentLoginId =
      data.studentLoginId === null
        ? null
        : String(data.studentLoginId).trim() || null;

    nextData.studentLoginId = plainStudentLoginId
      ? encryptPersonalData(plainStudentLoginId)
      : null;
  }

  return nextData as T & Record<string, any>;
}

function decryptStudentJoinedRow<T extends Record<string, any>>(
  row: T
): T & Record<string, any> {
  return {
    ...row,

    clientName:
      row.clientName === null || row.clientName === undefined
        ? row.clientName
        : decryptPersonalData(row.clientName),

    phone:
      row.phone === null || row.phone === undefined
        ? row.phone
        : decryptPersonalData(row.phone),

    address:
      row.address === null || row.address === undefined
        ? row.address
        : decryptPersonalData(row.address),

    detailAddress:
      row.detailAddress === null ||
      row.detailAddress === undefined
        ? row.detailAddress
        : decryptPersonalData(row.detailAddress),

    studentLoginId:
      row.studentLoginId === null ||
      row.studentLoginId === undefined
        ? row.studentLoginId
        : decryptPersonalData(row.studentLoginId),

    assigneeName:
      row.assigneeName === null ||
      row.assigneeName === undefined
        ? row.assigneeName
        : decryptPersonalData(row.assigneeName),
  };
}

function decryptPracticeSupportPersonalData<
  T extends Record<string, any>
>(
  row: T | null | undefined
): T | null | undefined {
  if (!row) {
    return row;
  }

  return {
    ...row,

    clientName:
      row.clientName === null ||
      row.clientName === undefined
        ? row.clientName
        : decryptPersonalData(row.clientName),

    phone:
      row.phone === null ||
      row.phone === undefined
        ? row.phone
        : decryptPersonalData(row.phone),

    inputAddress:
      row.inputAddress === null ||
      row.inputAddress === undefined
        ? row.inputAddress
        : decryptPersonalData(row.inputAddress),

    detailAddress:
      row.detailAddress === null ||
      row.detailAddress === undefined
        ? row.detailAddress
        : decryptPersonalData(row.detailAddress),

    assigneeName:
      row.assigneeName === null ||
      row.assigneeName === undefined
        ? row.assigneeName
        : decryptPersonalData(row.assigneeName),

    managerName:
      row.managerName === null ||
      row.managerName === undefined
        ? row.managerName
        : decryptPersonalData(row.managerName),

    studentClientName:
      row.studentClientName === null ||
      row.studentClientName === undefined
        ? row.studentClientName
        : decryptPersonalData(row.studentClientName),

    studentPhone:
      row.studentPhone === null ||
      row.studentPhone === undefined
        ? row.studentPhone
        : decryptPersonalData(row.studentPhone),

    studentAddress:
      row.studentAddress === null ||
      row.studentAddress === undefined
        ? row.studentAddress
        : decryptPersonalData(row.studentAddress),

    studentDetailAddress:
      row.studentDetailAddress === null ||
      row.studentDetailAddress === undefined
        ? row.studentDetailAddress
        : decryptPersonalData(row.studentDetailAddress),

    userName:
      row.userName === null ||
      row.userName === undefined
        ? row.userName
        : decryptPersonalData(row.userName),
  };
}

function preparePracticeSupportPersonalData<
  T extends Record<string, any>
>(data: T): T & Record<string, any> {
  const nextData: Record<string, any> = {
    ...data,
  };

  if (data.clientName !== undefined) {
    const plainValue =
      data.clientName === null
        ? null
        : String(data.clientName).trim() || null;

    nextData.clientName = plainValue
      ? encryptPersonalData(plainValue)
      : null;
  }

  if (data.phone !== undefined) {
    const plainValue =
      data.phone === null
        ? null
        : String(data.phone).replace(/\D/g, "") || null;

    nextData.phone = plainValue
      ? encryptPersonalData(plainValue)
      : null;
  }

  if (data.inputAddress !== undefined) {
    const plainValue =
      data.inputAddress === null
        ? null
        : String(data.inputAddress).trim() || null;

    nextData.inputAddress = plainValue
      ? encryptPersonalData(plainValue)
      : null;
  }

  if (data.detailAddress !== undefined) {
    const plainValue =
      data.detailAddress === null
        ? null
        : String(data.detailAddress).trim() || null;

    nextData.detailAddress = plainValue
      ? encryptPersonalData(plainValue)
      : null;
  }

  if (data.assigneeName !== undefined) {
    const plainValue =
      data.assigneeName === null
        ? null
        : String(data.assigneeName).trim() || null;

    nextData.assigneeName = plainValue
      ? encryptPersonalData(plainValue)
      : null;
  }

  if (data.managerName !== undefined) {
    const plainValue =
      data.managerName === null
        ? null
        : String(data.managerName).trim() || null;

    nextData.managerName = plainValue
      ? encryptPersonalData(plainValue)
      : null;
  }

  return nextData as T & Record<string, any>;
}

function decryptPrivateCertificatePersonalData<
  T extends Record<string, any>
>(
  row: T | null | undefined
): T | null | undefined {
  if (!row) {
    return row;
  }

  return {
    ...row,

    clientName:
      row.clientName === null ||
      row.clientName === undefined
        ? row.clientName
        : decryptPersonalData(row.clientName),

    phone:
      row.phone === null ||
      row.phone === undefined
        ? row.phone
        : decryptPersonalData(row.phone),

    inputAddress:
      row.inputAddress === null ||
      row.inputAddress === undefined
        ? row.inputAddress
        : decryptPersonalData(row.inputAddress),

    assigneeName:
      row.assigneeName === null ||
      row.assigneeName === undefined
        ? row.assigneeName
        : decryptPersonalData(row.assigneeName),

    studentClientName:
      row.studentClientName === null ||
      row.studentClientName === undefined
        ? row.studentClientName
        : decryptPersonalData(row.studentClientName),

    studentPhone:
      row.studentPhone === null ||
      row.studentPhone === undefined
        ? row.studentPhone
        : decryptPersonalData(row.studentPhone),

    studentAddress:
      row.studentAddress === null ||
      row.studentAddress === undefined
        ? row.studentAddress
        : decryptPersonalData(row.studentAddress),

    userName:
      row.userName === null ||
      row.userName === undefined
        ? row.userName
        : decryptPersonalData(row.userName),
  };
}

function encryptStudentAuditJson(value: any) {
  if (value === null || value === undefined) {
    return null;
  }

  return encryptPersonalData(
    JSON.stringify(value)
  );
}

function decryptStudentAuditJson(value: any) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    const decrypted =
      decryptPersonalData(String(value));

    return JSON.parse(decrypted);
  } catch {
    return value;
  }
}

function decryptStudentAuditLogPersonalData<
  T extends Record<string, any>
>(
  row: T | null | undefined
): T | null | undefined {
  if (!row) {
    return row;
  }

  return {
    ...row,

    actorName:
      row.actorName === null ||
      row.actorName === undefined
        ? row.actorName
        : decryptPersonalData(row.actorName),

    beforeJson:
      decryptStudentAuditJson(
        row.beforeJson
      ),

    afterJson:
      decryptStudentAuditJson(
        row.afterJson
      ),

    diffJson:
      decryptStudentAuditJson(
        row.diffJson
      ),
  };
}

function preparePrivateCertificatePersonalData<
  T extends Record<string, any>
>(data: T): T & Record<string, any> {
  const nextData: Record<string, any> = {
    ...data,
  };

  if (data.clientName !== undefined) {
  const plainValue =
    data.clientName === null
      ? null
      : String(data.clientName).trim() || null;

  nextData.clientName = plainValue
    ? encryptPersonalData(plainValue)
    : null;

  nextData.clientNameHash = plainValue
    ? createNameHash(plainValue)
    : null;
}

 if (data.phone !== undefined) {
  const plainValue =
    data.phone === null
      ? null
      : String(data.phone).replace(/\D/g, "") || null;

  nextData.phone = plainValue
    ? encryptPersonalData(plainValue)
    : null;

  nextData.phoneHash = plainValue
    ? createPhoneHash(plainValue)
    : null;

  nextData.phoneLast4 = plainValue
    ? getPhoneLast4(plainValue)
    : null;
}

  if (data.inputAddress !== undefined) {
    const plainValue =
      data.inputAddress === null
        ? null
        : String(data.inputAddress).trim() || null;

    nextData.inputAddress = plainValue
      ? encryptPersonalData(plainValue)
      : null;
  }

  if (data.assigneeName !== undefined) {
    const plainValue =
      data.assigneeName === null
        ? null
        : String(data.assigneeName).trim() || null;

    nextData.assigneeName = plainValue
      ? encryptPersonalData(plainValue)
      : null;
  }

  return nextData as T & Record<string, any>;
}

function decryptJobSupportPersonalData<
  T extends Record<string, any>
>(
  row: T | null | undefined
): T | null | undefined {
  if (!row) {
    return row;
  }

  return {
    ...row,

    clientName:
      row.clientName === null ||
      row.clientName === undefined
        ? row.clientName
        : decryptPersonalData(row.clientName),

    phone:
      row.phone === null ||
      row.phone === undefined
        ? row.phone
        : decryptPersonalData(row.phone),

    assigneeName:
      row.assigneeName === null ||
      row.assigneeName === undefined
        ? row.assigneeName
        : decryptPersonalData(row.assigneeName),

    inputAddress:
      row.inputAddress === null ||
      row.inputAddress === undefined
        ? row.inputAddress
        : decryptPersonalData(row.inputAddress),
  };
}

function prepareJobSupportPersonalData<
  T extends Record<string, any>
>(data: T): T & Record<string, any> {
  const nextData: Record<string, any> = {
    ...data,
  };

  if (data.clientName !== undefined) {
    const plainValue =
      data.clientName === null
        ? null
        : String(data.clientName).trim() || null;

    nextData.clientName = plainValue
      ? encryptPersonalData(plainValue)
      : null;

    nextData.clientNameHash = plainValue
      ? createNameHash(plainValue)
      : null;
  }

  if (data.phone !== undefined) {
    const plainValue =
      data.phone === null
        ? null
        : String(data.phone).replace(/\D/g, "") || null;

    nextData.phone = plainValue
      ? encryptPersonalData(plainValue)
      : null;

    nextData.phoneHash = plainValue
      ? createPhoneHash(plainValue)
      : null;

    nextData.phoneLast4 = plainValue
      ? getPhoneLast4(plainValue)
      : null;
  }

  if (data.assigneeName !== undefined) {
    const plainValue =
      data.assigneeName === null
        ? null
        : String(data.assigneeName).trim() || null;

    nextData.assigneeName = plainValue
      ? encryptPersonalData(plainValue)
      : null;
  }

  if (data.inputAddress !== undefined) {
    const plainValue =
      data.inputAddress === null
        ? null
        : String(data.inputAddress).trim() || null;

    nextData.inputAddress = plainValue
      ? encryptPersonalData(plainValue)
      : null;
  }

  return nextData as T & Record<string, any>;
}

function normalizeSmsPhone(value: any) {
  return String(value || "")
    .replace(/\D/g, "")
    .trim();
}

function getPhoneHashSecret() {
  const secret = String(process.env.PHONE_HASH_SECRET || "").trim();

  if (!secret) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "PHONE_HASH_SECRET 환경변수가 설정되지 않았습니다.",
      500
    );
  }

  if (secret.length < 32) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "PHONE_HASH_SECRET는 최소 32자 이상이어야 합니다.",
      500
    );
  }

  return secret;
}

export function createSmsPhoneHash(phone: any) {
  const normalizedPhone = normalizeSmsPhone(phone);

  if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "올바른 전화번호를 입력해주세요.",
      400
    );
  }

  return createHmac("sha256", getPhoneHashSecret())
    .update(normalizedPhone, "utf8")
    .digest("hex");
}

function getSmsPhoneLast4(phone: any) {
  const normalizedPhone = normalizeSmsPhone(phone);

  if (normalizedPhone.length < 4) {
    return null;
  }

  return normalizedPhone.slice(-4);
}

function toNumber(v: any) {
  return Number(String(v ?? "0").replace(/,/g, "").trim()) || 0;
}

function toNullableNumber(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function resolvePlanSemesterSettlementIncluded(subjectName: any, explicitValue?: any) {
  if (explicitValue !== undefined && explicitValue !== null) {
    return Boolean(explicitValue);
  }

  const name = String(subjectName || "").trim();

  if (/실습|이벤트|무료/.test(name)) {
    return false;
  }

  return true;
}

function resolveCategoryFromRequirementType(requirementType: any) {
  const value = String(requirementType || "").trim();

  if (value === "교양") return "교양";
  if (value === "일반") return "일반";

  return "전공";
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

export type ExecuteDocumentImportTransactionInput = {
  organizationId:
    number;

  studentId:
    number;

  draft:
    AiDocumentImportDraft;

  actorUserId:
    number;

  actorName?:
    string |
    null;

  actorRole?:
    string |
    null;
};

export type ExecuteDocumentImportTransactionResult = {
  studentId:
    number;

  semesterId:
    number |
    null;

  planSubjectIds:
    number[];

  transferSubjectIds:
    number[];

  paymentUpdated:
    boolean;

  completedSteps:
    string[];
};

function normalizeDocumentImportSubjectName(
  value:
    unknown
) {
  return String(
    value ||
    ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

function normalizeDocumentImportDate(
  value:
    unknown
): string | null {
  const text =
    String(
      value ||
      ""
    ).trim();

  if (!text) {
    return null;
  }

  const matched =
    text.match(
      /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/
    );

  if (!matched) {
    return null;
  }

  const year =
    Number(
      matched[1]
    );

  const month =
    Number(
      matched[2]
    );

  const day =
    Number(
      matched[3]
    );

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return null;
  }

  return [
    String(
      year
    ).padStart(
      4,
      "0"
    ),

    String(
      month
    ).padStart(
      2,
      "0"
    ),

    String(
      day
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
}

function normalizeDocumentImportDraft(
  value:
    unknown
): AiDocumentImportDraft {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서 CRM 반영 초안 데이터가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    value as
      AiDocumentImportDraft;

  const allowedActionTypes =
    new Set<
      AiDocumentImportDraft["actionType"]
    >([
      "document_transfer_import",
      "document_plan_import",
      "document_payment_import",
      "document_plan_payment_import",
    ]);

  if (
    !allowedActionTypes.has(
      draft.actionType
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "지원하지 않는 문서 CRM 반영 유형입니다.",
      400
    );
  }

  if (
    draft.canConfirm !==
      true ||
    !Array.isArray(
      draft.missingFields
    ) ||
    draft.missingFields
      .length > 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "필수 정보가 누락된 문서 CRM 반영 초안입니다.",
      409
    );
  }

  const studentId =
    Number(
      draft.studentId ||
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서 반영 대상 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    !String(
      draft.analysisId ||
      ""
    ).trim()
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서 분석 ID가 없습니다.",
      400
    );
  }

  const requiresSubjects =
    draft.actionType ===
      "document_transfer_import" ||
    draft.actionType ===
      "document_plan_import" ||
    draft.actionType ===
      "document_plan_payment_import";

  const selectedSubjects =
    Array.isArray(
      draft.subjects
    )
      ? draft.subjects.filter(
          (
            subject
          ) =>
            subject?.selected !==
              false &&
            normalizeDocumentImportSubjectName(
              subject?.subjectName
            ).length >= 2
        )
      : [];

  if (
    requiresSubjects &&
    selectedSubjects.length ===
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서에서 CRM에 반영할 과목이 없습니다.",
      400
    );
  }

  const requiresPayment =
    draft.actionType ===
      "document_payment_import" ||
    draft.actionType ===
      "document_plan_payment_import";

  if (
    requiresPayment &&
    draft.paymentAmount ===
      null &&
    !String(
      draft.paymentStatus ||
      ""
    ).trim() &&
    !String(
      draft.paidAt ||
      ""
    ).trim()
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서에서 반영할 결제정보가 없습니다.",
      400
    );
  }

  return {
    ...draft,

    studentId:
      Math.floor(
        studentId
      ),

    subjects:
      selectedSubjects.map(
        (
          subject,
          index
        ) => ({
          ...subject,

          rowId:
            String(
              subject.rowId ||
              `document-subject-${index + 1}`
            ),

          selected:
            true,

          subjectName:
            normalizeDocumentImportSubjectName(
              subject.subjectName
            ),

          credits:
            Number(
              subject.credits
            ) > 0
              ? Math.floor(
                  Number(
                    subject.credits
                  )
                )
              : 3,

          semesterNo:
            Number(
              subject.semesterNo
            ) > 0
              ? Math.floor(
                  Number(
                    subject.semesterNo
                  )
                )
              : null,
        })
      ),
  };
}

// ==============================
// AI HELPERS
// ==============================

/**
 * AI 승인 초안 JSON 암호화
 *
 * 학생명, 연락처, 결제정보 등 개인정보가
 * ai_pending_actions JSON 컬럼에 평문으로
 * 저장되지 않도록 전체 JSON을 암호화한다.
 */
function encryptAiPendingJson(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return encryptPersonalData(
    JSON.stringify(value)
  );
}

/**
 * AI 승인 초안 JSON 복호화
 *
 * 신규 암호화 데이터와
 * 기존 평문 JSON 데이터를 모두 처리한다.
 */
function decryptAiPendingJson<T>(
  value: unknown,
  fallback: T
): T {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  /**
   * 기존에 JSON 컬럼에 객체 형태로
   * 저장된 평문 데이터 호환
   */
  if (
    typeof value === "object"
  ) {
    return value as T;
  }

  const text =
    String(value);

  /**
   * 암호화된 데이터 우선 복호화
   */
  try {
    const decrypted =
      decryptPersonalData(text);

    return JSON.parse(
      decrypted
    ) as T;
  } catch {
    /**
     * 기존 평문 JSON 문자열 호환
     */
    try {
      return JSON.parse(
        text
      ) as T;
    } catch {
      return fallback;
    }
  }
}

/**
 * ai_pending_actions 조회 결과의
 * JSON 컬럼을 복호화한다.
 */
function decryptAiPendingActionRow<
  T extends Record<string, any>
>(
  row: T | null | undefined
): T | null | undefined {
  if (!row) {
    return row;
  }

  return {
    ...row,

    previewJson:
      decryptAiPendingJson(
        row.previewJson,
        null
      ),

    payloadJson:
      decryptAiPendingJson(
        row.payloadJson,
        null
      ),

    sourceSnapshotJson:
      decryptAiPendingJson(
        row.sourceSnapshotJson,
        null
      ),

    missingFieldsJson:
      decryptAiPendingJson<string[]>(
        row.missingFieldsJson,
        []
      ),

    warningsJson:
      decryptAiPendingJson<string[]>(
        row.warningsJson,
        []
      ),

    executionResultJson:
      decryptAiPendingJson(
        row.executionResultJson,
        null
      ),
  };
}

type AiPendingActionRole =
  | "staff"
  | "admin"
  | "host"
  | "superhost";

type AiPendingActionCreateInput = {
  organizationId?: number | null;

  requestedByUserId: number;
  requestedByRole: AiPendingActionRole;

  actionType:
  AiPendingActionType;

  consultationId?: number | null;
  studentId?: number | null;
  semesterId?: number | null;

  preview: {
    title: string;
    summary: string;

    sections: Array<{
      label: string;
      items: string[];
    }>;

    changes: Array<{
      label: string;
      before:
        | string
        | number
        | boolean
        | null;
      after:
        | string
        | number
        | boolean
        | null;
    }>;

    executionSteps: string[];
    missingFields: string[];
    warnings: string[];

    canConfirm: boolean;
  };

  payload: Record<string, unknown>;

  sourceSnapshot?: Record<
    string,
    unknown
  > | null;

  /**
   * 기본 30분
   * 최소 5분, 최대 24시간
   */
  expiresInMinutes?: number | null;
};

const AI_PENDING_ACTION_TYPES =
  new Set<AiPendingActionType>([
    "student_registration_create",
    "student_update",
    "semester_create",
    "semester_update",
    "plan_create",
    "plan_update",
    "plan_subjects_create",
    "plan_subjects_update",
    "payment_update",
    "practice_request_create",
    "consultation_update",

    "document_transfer_import",
    "document_plan_import",
    "document_payment_import",
    "document_plan_payment_import",
  ]);

const AI_PENDING_ACTION_ROLES =
  new Set([
    "staff",
    "admin",
    "host",
    "superhost",
  ]);

function normalizeAiPendingActionId(
  value: unknown
) {
  const id = Number(value || 0);

  if (
    !Number.isFinite(id) ||
    id <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "올바른 AI 승인 요청 ID가 필요합니다.",
      400
    );
  }

  return Math.floor(id);
}

function normalizeAiPendingActionVersion(
  value: unknown
) {
  const version = Number(value || 0);

  if (
    !Number.isFinite(version) ||
    version <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "올바른 AI 초안 버전이 필요합니다.",
      400
    );
  }

  return Math.floor(version);
}

/**
 * AI 등록·수정 승인 초안 생성
 *
 * 실제 학생·학기·플랜 데이터는 변경하지 않는다.
 * 초안만 ai_pending_actions에 저장한다.
 */
export async function createAiPendingAction(
  input: AiPendingActionCreateInput
) {
  const db = await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId =
    requireOrganizationId(
      input.organizationId
    );

  const requestedByUserId =
    Number(
      input.requestedByUserId || 0
    );

  if (
    !Number.isFinite(
      requestedByUserId
    ) ||
    requestedByUserId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 초안 요청 사용자 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    !AI_PENDING_ACTION_ROLES.has(
      String(input.requestedByRole)
    )
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "AI 초안을 생성할 수 없는 사용자 권한입니다.",
      403
    );
  }

  if (
    !AI_PENDING_ACTION_TYPES.has(
      String(input.actionType)
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "지원하지 않는 AI 작업 유형입니다.",
      400
    );
  }

  const preview =
    input.preview &&
    typeof input.preview === "object"
      ? input.preview
      : null;

  const payload =
    input.payload &&
    typeof input.payload === "object"
      ? input.payload
      : null;

  if (!preview || !payload) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 등록 초안 내용이 필요합니다.",
      400
    );
  }

  const missingFields =
    Array.isArray(
      preview.missingFields
    )
      ? preview.missingFields
      : [];

  const warnings =
    Array.isArray(preview.warnings)
      ? preview.warnings
      : [];

  /**
   * 필수값이 누락되어 있으면
   * 사용자가 승인할 수 없는 draft 상태로 저장한다.
   */
  const canConfirm =
    preview.canConfirm === true &&
    missingFields.length === 0;

  const status =
    canConfirm
      ? "awaiting_confirmation"
      : "draft";

  const rawExpiresInMinutes =
    Number(
      input.expiresInMinutes ?? 30
    );

  const expiresInMinutes =
    Math.min(
      Math.max(
        Number.isFinite(
          rawExpiresInMinutes
        )
          ? rawExpiresInMinutes
          : 30,
        5
      ),
      24 * 60
    );

  const expiresAt =
    new Date(
      Date.now() +
        expiresInMinutes *
          60 *
          1000
    );

  /**
   * 프론트가 전달하는 키를 사용하지 않고
   * 서버에서만 생성한다.
   */
  const idempotencyKey =
    randomUUID();

  const result: any =
    await db
      .insert(aiPendingActions)
      .values({
        organizationId,

        requestedByUserId:
          Math.floor(
            requestedByUserId
          ),

        requestedByRole:
          input.requestedByRole,

        confirmedByUserId:
          null,

        actionType:
          input.actionType,

        status,

        consultationId:
          input.consultationId ??
          null,

        studentId:
          input.studentId ??
          null,

        semesterId:
          input.semesterId ??
          null,

       previewJson:
  encryptAiPendingJson(
    preview
  ),

payloadJson:
  encryptAiPendingJson(
    payload
  ),

sourceSnapshotJson:
  encryptAiPendingJson(
    input.sourceSnapshot ??
    null
  ),

missingFieldsJson:
  encryptAiPendingJson(
    missingFields
  ),

warningsJson:
  encryptAiPendingJson(
    warnings
  ),

version: 1,

idempotencyKey,

executionResultJson:
  null,

        errorMessage:
          null,

        expiresAt,

        confirmedAt:
          null,

        executedAt:
          null,

        cancelledAt:
          null,

        failedAt:
          null,
      } satisfies Omit<
        InsertAiPendingAction,
        "id" |
        "createdAt" |
        "updatedAt"
      >);

  const pendingActionId =
    Number(getInsertId(result) || 0);

  if (!pendingActionId) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "AI 승인 초안을 생성하지 못했습니다.",
      500
    );
  }

  return getAiPendingActionForConfirmation({
    id: pendingActionId,
    organizationId,
    requestedByUserId:
      Math.floor(
        requestedByUserId
      ),
  });
}

/**
 * AI 승인 초안 조회
 *
 * 현재 단계에서는 초안을 생성한 본인만 조회한다.
 * organizationId와 requestedByUserId를 모두 검사한다.
 */
export async function getAiPendingActionForConfirmation(
  params: {
    id: number;
    organizationId?: number | null;
    requestedByUserId: number;
  }
) {
  const db = await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId =
    requireOrganizationId(
      params.organizationId
    );

  const id =
    normalizeAiPendingActionId(
      params.id
    );

  const requestedByUserId =
    Number(
      params.requestedByUserId || 0
    );

  if (
    !Number.isFinite(
      requestedByUserId
    ) ||
    requestedByUserId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 초안 요청 사용자 정보가 올바르지 않습니다.",
      400
    );
  }

  const rows =
    await db
      .select()
      .from(aiPendingActions)
      .where(
        and(
          eq(
            aiPendingActions.id,
            id
          ),

          eq(
            aiPendingActions.organizationId,
            organizationId
          ),

          eq(
            aiPendingActions.requestedByUserId,
            Math.floor(
              requestedByUserId
            )
          )
        )
      )
      .limit(1);

  const rawRow =
  rows[0];

if (!rawRow) {
  throwAppError(
    ERROR_CODES.DATA_NOT_FOUND,
    "AI 승인 초안을 찾을 수 없습니다.",
    404
  );
}

const row =
  decryptAiPendingActionRow(
    rawRow
  );

if (!row) {
  throwAppError(
    ERROR_CODES.DATA_NOT_FOUND,
    "AI 승인 초안을 복호화하지 못했습니다.",
    404
  );
}

  /**
   * 승인 대기 중인데 만료 시각이 지났으면
   * 조회 시 expired 상태로 전환한다.
   */
  const isPendingStatus =
    row.status === "draft" ||
    row.status ===
      "awaiting_confirmation";

  const expiresAt =
    row.expiresAt
      ? new Date(row.expiresAt)
      : null;

  if (
    isPendingStatus &&
    expiresAt &&
    expiresAt.getTime() <=
      Date.now()
  ) {
    await db
      .update(aiPendingActions)
      .set({
        status: "expired",
      })
      .where(
        and(
          eq(
            aiPendingActions.id,
            id
          ),

          eq(
            aiPendingActions.organizationId,
            organizationId
          ),

          eq(
            aiPendingActions.requestedByUserId,
            Math.floor(
              requestedByUserId
            )
          ),

          or(
            eq(
              aiPendingActions.status,
              "draft"
            ),
            eq(
              aiPendingActions.status,
              "awaiting_confirmation"
            )
          )
        )
      );

    const expiredRows =
      await db
        .select()
        .from(aiPendingActions)
        .where(
          and(
            eq(
              aiPendingActions.id,
              id
            ),

            eq(
              aiPendingActions.organizationId,
              organizationId
            ),

            eq(
              aiPendingActions.requestedByUserId,
              Math.floor(
                requestedByUserId
              )
            )
          )
        )
        .limit(1);

    return decryptAiPendingActionRow(
  expiredRows[0]
) || null;
  }

  return row;
}

/**
 * AI 승인 초안 취소
 *
 * draft 또는 awaiting_confirmation 상태만 취소한다.
 * 실제 CRM 데이터는 변경하지 않는다.
 */
export async function cancelAiPendingAction(
  params: {
    id: number;
    organizationId?: number | null;
    requestedByUserId: number;
    expectedVersion: number;
  }
) {
  const db = await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId =
    requireOrganizationId(
      params.organizationId
    );

  const id =
    normalizeAiPendingActionId(
      params.id
    );

  const expectedVersion =
    normalizeAiPendingActionVersion(
      params.expectedVersion
    );

  const requestedByUserId =
    Number(
      params.requestedByUserId || 0
    );

  if (
    !Number.isFinite(
      requestedByUserId
    ) ||
    requestedByUserId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 초안 요청 사용자 정보가 올바르지 않습니다.",
      400
    );
  }

  const current =
    await getAiPendingActionForConfirmation({
      id,
      organizationId,
      requestedByUserId:
        Math.floor(
          requestedByUserId
        ),
    });

  if (!current) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "AI 승인 초안을 찾을 수 없습니다.",
      404
    );
  }

  if (
    Number(current.version) !==
    expectedVersion
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 초안 내용이 변경되었습니다. 최신 내용을 다시 확인해주세요.",
      409
    );
  }

  /**
   * 이미 취소된 요청은
   * 같은 결과를 그대로 반환한다.
   */
  if (
    current.status ===
    "cancelled"
  ) {
    return current;
  }

  if (
    current.status ===
    "expired"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "만료된 AI 초안은 취소할 수 없습니다.",
      409
    );
  }

  if (
    current.status ===
      "executing" ||
    current.status ===
      "executed"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "이미 실행되었거나 실행 중인 AI 작업은 취소할 수 없습니다.",
      409
    );
  }

  if (
    current.status === "failed"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "실패 처리된 AI 작업은 취소할 수 없습니다.",
      409
    );
  }

  const updateResult: any =
  await db
    .update(aiPendingActions)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
    })
    .where(
      and(
        eq(
          aiPendingActions.id,
          id
        ),

        eq(
          aiPendingActions.organizationId,
          organizationId
        ),

        eq(
          aiPendingActions.requestedByUserId,
          Math.floor(
            requestedByUserId
          )
        ),

        eq(
          aiPendingActions.version,
          expectedVersion
        ),

        or(
          eq(
            aiPendingActions.status,
            "draft"
          ),

          eq(
            aiPendingActions.status,
            "awaiting_confirmation"
          )
        )
      )
    );

const affectedRows =
  Number(
    updateResult?.rowsAffected ??
    updateResult?.affectedRows ??
    updateResult?.[0]?.affectedRows ??
    0
  );

if (affectedRows <= 0) {
  const latest =
    await getAiPendingActionForConfirmation({
      id,
      organizationId,
      requestedByUserId:
        Math.floor(
          requestedByUserId
        ),
    });

  if (
    latest?.status === "cancelled"
  ) {
    return latest;
  }

  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "AI 초안 상태가 변경되어 취소하지 못했습니다. 최신 내용을 다시 확인해주세요.",
    409
  );
}

  return getAiPendingActionForConfirmation({
    id,
    organizationId,
    requestedByUserId:
      Math.floor(
        requestedByUserId
      ),
  });
}

type AiPendingActionExecutionClaimInput = {
  /**
   * 승인할 AI 초안 ID
   */
  id: number;

  /**
   * 현재 회사
   */
  organizationId?: number | null;

  /**
   * 초안을 생성한 사용자
   */
  requestedByUserId: number;

  /**
   * 실제 승인 버튼을 누른 사용자
   */
  confirmedByUserId: number;

  /**
   * 화면에 표시된 초안 버전
   */
  expectedVersion: number;
};

/**
 * AI 승인 초안 실행 선점
 *
 * awaiting_confirmation 상태의 초안을
 * executing 상태로 원자적으로 변경한다.
 *
 * 중복 클릭이나 재요청으로 동일 작업이
 * 두 번 실행되는 것을 방지한다.
 *
 * 이 함수는 실제 학생 데이터를 생성하지 않는다.
 */
export async function claimAiPendingActionForExecution(
  input: AiPendingActionExecutionClaimInput
) {
  const db =
    await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId =
    requireOrganizationId(
      input.organizationId
    );

  const id =
    normalizeAiPendingActionId(
      input.id
    );

  const expectedVersion =
    normalizeAiPendingActionVersion(
      input.expectedVersion
    );

  const requestedByUserId =
    Number(
      input.requestedByUserId || 0
    );

  const confirmedByUserId =
    Number(
      input.confirmedByUserId || 0
    );

  if (
    !Number.isFinite(
      requestedByUserId
    ) ||
    requestedByUserId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 초안 요청 사용자 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    !Number.isFinite(
      confirmedByUserId
    ) ||
    confirmedByUserId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 초안 승인 사용자 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 현재 상태와 만료 여부를 먼저 확인한다.
   */
  const current =
    await getAiPendingActionForConfirmation({
      id,

      organizationId,

      requestedByUserId:
        Math.floor(
          requestedByUserId
        ),
    });

  if (!current) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "AI 승인 초안을 찾을 수 없습니다.",
      404
    );
  }

  if (
    Number(current.version) !==
    expectedVersion
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 초안 내용이 변경되었습니다. 최신 내용을 다시 확인해주세요.",
      409
    );
  }

 const executableActionTypes =
  new Set<AiPendingActionType>([
    "student_registration_create",

    "document_transfer_import",
    "document_plan_import",
    "document_payment_import",
    "document_plan_payment_import",
  ]);

if (
  !executableActionTypes.has(
    current.actionType as
      AiPendingActionType
  )
) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "현재 실행할 수 없는 AI 승인 작업입니다.",
    400
  );
}

  if (
    current.status ===
    "draft"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "필수 정보가 누락된 초안은 승인할 수 없습니다.",
      409
    );
  }

  if (
    current.status ===
    "expired"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "만료된 AI 초안은 승인할 수 없습니다.",
      409
    );
  }

  if (
    current.status ===
    "cancelled"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "취소된 AI 초안은 승인할 수 없습니다.",
      409
    );
  }

  if (
    current.status ===
    "failed"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "실패 처리된 AI 작업입니다.",
      409
    );
  }

  /**
   * 이미 실행된 경우 기존 결과를 반환한다.
   *
   * 동일 요청 재전송에 대한 멱등성 처리다.
   */
  if (
    current.status ===
    "executed"
  ) {
    return {
      claimed:
        false,

      alreadyExecuted:
        true,

      action:
        current,
    };
  }

  /**
   * 다른 요청이 이미 실행 중인 경우
   */
  if (
    current.status ===
    "executing"
  ) {
    return {
      claimed:
        false,

      alreadyExecuted:
        false,

      action:
        current,
    };
  }

  if (
    current.status !==
    "awaiting_confirmation"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "현재 상태에서는 AI 초안을 승인할 수 없습니다.",
      409
    );
  }

  /**
   * 상태, 버전, 사용자, 회사 조건을 모두 걸어서
   * awaiting_confirmation → executing을 한 번만 허용한다.
   */
  const updateResult: any =
    await db
      .update(aiPendingActions)
      .set({
        status:
          "executing",

        confirmedByUserId:
          Math.floor(
            confirmedByUserId
          ),

        confirmedAt:
          new Date(),

        errorMessage:
          null,
      })
      .where(
        and(
          eq(
            aiPendingActions.id,
            id
          ),

          eq(
            aiPendingActions.organizationId,
            organizationId
          ),

          eq(
            aiPendingActions.requestedByUserId,
            Math.floor(
              requestedByUserId
            )
          ),

          eq(
            aiPendingActions.version,
            expectedVersion
          ),

          eq(
            aiPendingActions.status,
            "awaiting_confirmation"
          ),

          sql`${aiPendingActions.expiresAt} > NOW()`
        )
      );

  const affectedRows =
    Number(
      updateResult?.rowsAffected ??
      updateResult?.affectedRows ??
      updateResult?.[0]
        ?.affectedRows ??
      0
    );

  /**
   * 업데이트된 행이 없다면
   * 다른 요청이 먼저 상태를 변경했을 가능성이 있다.
   */
  if (
    affectedRows <= 0
  ) {
    const latest =
      await getAiPendingActionForConfirmation({
        id,

        organizationId,

        requestedByUserId:
          Math.floor(
            requestedByUserId
          ),
      });

    if (
      latest?.status ===
      "executing"
    ) {
      return {
        claimed:
          false,

        alreadyExecuted:
          false,

        action:
          latest,
      };
    }

    if (
      latest?.status ===
      "executed"
    ) {
      return {
        claimed:
          false,

        alreadyExecuted:
          true,

        action:
          latest,
      };
    }

    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 초안 상태가 변경되어 승인하지 못했습니다. 최신 내용을 다시 확인해주세요.",
      409
    );
  }

  const claimedAction =
    await getAiPendingActionForConfirmation({
      id,

      organizationId,

      requestedByUserId:
        Math.floor(
          requestedByUserId
        ),
    });

  if (!claimedAction) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "실행 상태로 변경된 AI 초안을 찾을 수 없습니다.",
      404
    );
  }

  return {
    claimed:
      true,

    alreadyExecuted:
      false,

    action:
      claimedAction,
  };
}

/**
 * AI 승인 작업 성공 처리
 */
export async function markAiPendingActionExecuted(
  params: {
    id: number;
    organizationId?: number | null;
    requestedByUserId: number;
    expectedVersion: number;

       studentId: number;

    planId?: number | null;

    semesterIds: number[];

    planSubjectIds?: number[];

    transferSubjectIds?: number[];

    practiceSaved?: boolean;

paymentUpdated?: boolean;

    completedSteps: string[];
    failedSteps?: string[];
    message: string;
  }
) {
  const db =
    await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId =
    requireOrganizationId(
      params.organizationId
    );

  const id =
    normalizeAiPendingActionId(
      params.id
    );

  const expectedVersion =
    normalizeAiPendingActionVersion(
      params.expectedVersion
    );

const requestedByUserId =
  Number(
    params.requestedByUserId || 0
  );

const studentId =
  Number(
    params.studentId || 0
  );

const planId =
  params.planId === null ||
  params.planId === undefined
    ? null
    : Number(
        params.planId
      );

const normalizedSemesterIds =
  Array.from(
    new Set(
      (
        params.semesterIds ||
        []
      )
        .map(Number)
        .filter(
          (value) =>
            Number.isFinite(
              value
            ) &&
            value > 0
        )
    )
  );

const normalizedPlanSubjectIds =
  Array.from(
    new Set(
      (
        params.planSubjectIds ||
        []
      )
        .map(Number)
        .filter(
          (value) =>
            Number.isFinite(
              value
            ) &&
            value > 0
        )
    )
  );

const normalizedTransferSubjectIds =
  Array.from(
    new Set(
      (
        params.transferSubjectIds ||
        []
      )
        .map(Number)
        .filter(
          (value) =>
            Number.isFinite(
              value
            ) &&
            value > 0
        )
    )
  );

if (
  !Number.isFinite(
    requestedByUserId
  ) ||
  requestedByUserId <= 0
) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "AI 초안 요청 사용자 정보가 올바르지 않습니다.",
    400
  );
}

if (
  planId !== null &&
  (
    !Number.isFinite(
      planId
    ) ||
    planId <= 0
  )
) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "생성된 학생 플랜 정보가 올바르지 않습니다.",
    400
  );
}

if (
  !Number.isFinite(
    studentId
  ) ||
  studentId <= 0
) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "생성된 학생 정보가 올바르지 않습니다.",
    400
  );
}

    const executionResult = {
    pendingActionId:
      id,

    status:
      "executed",

    studentId,

    planId,

    semesterIds:
      normalizedSemesterIds,

    planSubjectIds:
      normalizedPlanSubjectIds,

    transferSubjectIds:
      normalizedTransferSubjectIds,

    practiceSaved:
      params.practiceSaved ===
      true,

paymentUpdated:
  params.paymentUpdated ===
  true,

    completedSteps:
      params.completedSteps ||
      [],

    failedSteps:
      params.failedSteps ||
      [],

    message:
      String(
        params.message ||
        "등록예정 학생 생성 및 과목설계 저장이 완료되었습니다."
      ),
  };

  const result: any =
    await db
      .update(aiPendingActions)
      .set({
        status:
          "executed",

        studentId,

        executionResultJson:
          encryptAiPendingJson(
            executionResult
          ),

        errorMessage:
          null,

        executedAt:
          new Date(),
      })
      .where(
        and(
          eq(
            aiPendingActions.id,
            id
          ),

          eq(
            aiPendingActions.organizationId,
            organizationId
          ),

          eq(
  aiPendingActions.requestedByUserId,
  Math.floor(
    requestedByUserId
  )
),

          eq(
            aiPendingActions.version,
            expectedVersion
          ),

          eq(
            aiPendingActions.status,
            "executing"
          )
        )
      );

  const affectedRows =
    Number(
      result?.rowsAffected ??
      result?.affectedRows ??
      result?.[0]
        ?.affectedRows ??
      0
    );

  if (
    affectedRows <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 실행 완료 상태를 저장하지 못했습니다.",
      409
    );
  }

  return getAiPendingActionForConfirmation({
    id,

    organizationId,

    requestedByUserId:
  Math.floor(
    requestedByUserId
  ),
  });
}

/**
 * AI 승인 작업 실패 처리
 */
export async function markAiPendingActionFailed(
  params: {
    id: number;
    organizationId?: number | null;
    requestedByUserId: number;
    expectedVersion: number;

    errorMessage: string;

    completedSteps?: string[];
    failedSteps?: string[];
  }
) {
  const db =
    await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId =
    requireOrganizationId(
      params.organizationId
    );

  const id =
    normalizeAiPendingActionId(
      params.id
    );

  const expectedVersion =
    normalizeAiPendingActionVersion(
      params.expectedVersion
    );

const requestedByUserId =
  Number(
    params.requestedByUserId || 0
  );

if (
  !Number.isFinite(
    requestedByUserId
  ) ||
  requestedByUserId <= 0
) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "AI 초안 요청 사용자 정보가 올바르지 않습니다.",
    400
  );
}

  const safeErrorMessage =
    String(
      params.errorMessage ||
      "등록예정 학생 생성 및 과목설계 저장 중 오류가 발생했습니다."
    ).slice(
      0,
      2000
    );

    const executionResult = {
    pendingActionId:
      id,

    status:
      "failed",

    studentId:
      null,

    planId:
      null,

    semesterIds:
      [],

    planSubjectIds:
      [],

    transferSubjectIds:
      [],

    practiceSaved:
      false,

    completedSteps:
      params.completedSteps ||
      [],

    failedSteps:
      params.failedSteps ||
      [],

    message:
      safeErrorMessage,
  };

  const result: any =
    await db
      .update(aiPendingActions)
      .set({
        status:
          "failed",

        executionResultJson:
          encryptAiPendingJson(
            executionResult
          ),

        errorMessage:
          safeErrorMessage,

        failedAt:
          new Date(),
      })
      .where(
        and(
          eq(
            aiPendingActions.id,
            id
          ),

          eq(
            aiPendingActions.organizationId,
            organizationId
          ),

          eq(
            aiPendingActions.requestedByUserId,
            Math.floor(
  requestedByUserId
)
          ),

          eq(
            aiPendingActions.version,
            expectedVersion
          ),

          eq(
            aiPendingActions.status,
            "executing"
          )
        )
      );

  const affectedRows =
    Number(
      result?.rowsAffected ??
      result?.affectedRows ??
      result?.[0]
        ?.affectedRows ??
      0
    );

  if (
    affectedRows <= 0
  ) {
    const latest =
  await getAiPendingActionForConfirmation({
    id,

    organizationId,

    requestedByUserId:
      Math.floor(
        requestedByUserId
      ),
  });

    return latest;
  }

  return getAiPendingActionForConfirmation({
  id,

  organizationId,

  requestedByUserId:
    Math.floor(
      requestedByUserId
    ),
});
}


export type ExecuteStudentRegistrationTransactionInput = {
  organizationId?: number | null;

  draft: StudentRegistrationDraft;

  actorUserId: number;
  actorName?: string | null;
  actorRole?: string | null;
};

/**
 * AI 학생 통합등록 실제 실행
 *
 * 학생, 플랜, 학기, 플랜 과목, 상담 상태를
 * 하나의 DB 트랜잭션 안에서 처리한다.
 *
 * 하나라도 실패하면 전체 작업이 롤백된다.
 */
export async function executeStudentRegistrationTransaction(
  input: ExecuteStudentRegistrationTransactionInput
) {
  const db =
    await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId =
    requireOrganizationId(
      input.organizationId
    );

  const actorUserId =
    Number(
      input.actorUserId || 0
    );

  if (
    !Number.isFinite(
      actorUserId
    ) ||
    actorUserId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 등록 실행 사용자 정보가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    input.draft;

  if (
    !draft ||
    typeof draft !== "object"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 통합등록 초안이 필요합니다.",
      400
    );
  }

  if (
    draft.canConfirm !== true ||
    (
      Array.isArray(
        draft.missingFields
      ) &&
      draft.missingFields.length > 0
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "필수 정보가 누락된 학생 등록 초안입니다.",
      409
    );
  }

  const consultationId =
    Number(
      draft.consultationId || 0
    );

  const assigneeId =
    Number(
      draft.student
        ?.assigneeId || 0
    );

  const clientName =
    String(
      draft.student
        ?.clientName || ""
    ).trim();

  const phone =
    String(
      draft.student
        ?.phone || ""
    )
      .replace(/\D/g, "");

  const desiredCourse =
    String(
      draft.student
        ?.desiredCourse ||
      draft.plan
        ?.courseName ||
      ""
    ).trim();

  const finalEducation =
    String(
      draft.student
        ?.finalEducation ||
      draft.plan
        ?.finalEducation ||
      ""
    ).trim();

  if (
    !consultationId ||
    !assigneeId ||
    !clientName ||
    phone.length < 10 ||
    !desiredCourse ||
    !finalEducation
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 등록 필수 정보가 올바르지 않습니다.",
      400
    );
  }

  const semesterDrafts =
    Array.isArray(
      draft.semesters
    )
      ? [...draft.semesters]
          .sort(
            (a, b) =>
              Number(
                a.semesterNo
              ) -
              Number(
                b.semesterNo
              )
          )
      : [];

  if (
    semesterDrafts.length === 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "등록할 학기 정보가 없습니다.",
      400
    );
  }

    const planSubjectDrafts =
    Array.isArray(
      draft.planSubjects
    )
      ? draft.planSubjects
      : [];

  const transferSubjectDrafts =
    Array.isArray(
      draft.transferSubjects
    )
      ? draft.transferSubjects
      : [];

  const duplicateSubjectDrafts =
    Array.isArray(
      draft.duplicateSubjects
    )
      ? draft.duplicateSubjects
      : [];

  const practiceDraft =
    draft.practice &&
    typeof draft.practice ===
      "object"
      ? draft.practice
      : null;

  if (
    duplicateSubjectDrafts.length > 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "중복 과목이 포함된 초안은 저장할 수 없습니다. 중복 과목을 정리한 후 다시 실행해주세요.",
      409
    );
  }

  const hasUnconfirmedPlanSubject =
    planSubjectDrafts.some(
      (subject) =>
        subject.isConfirmed ===
        false
    );

  const hasUnconfirmedTransferSubject =
    transferSubjectDrafts.some(
      (subject) =>
        subject.isConfirmed ===
        false
    );

  if (
    hasUnconfirmedPlanSubject ||
    hasUnconfirmedTransferSubject
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "확인이 완료되지 않은 과목이 포함되어 있습니다.",
      409
    );
  }

  if (
    planSubjectDrafts.length === 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "저장할 우리플랜 과목이 없습니다.",
      400
    );
  }

  const semesterDraftNoSet =
    new Set(
      semesterDrafts.map(
        (semester) =>
          Number(
            semester.semesterNo
          )
      )
    );

  const invalidPlanSubject =
    planSubjectDrafts.find(
      (subject) => {
        const semesterNo =
          Number(
            subject.semesterNo ||
            0
          );

        return (
          !Number.isFinite(
            semesterNo
          ) ||
          semesterNo <= 0 ||
          !semesterDraftNoSet.has(
            semesterNo
          )
        );
      }
    );

  if (
    invalidPlanSubject
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `우리플랜 과목 '${String(
        invalidPlanSubject
          .subjectName ||
        ""
      )}'에 해당하는 예정 학기가 없습니다.`,
      409
    );
  }

  return db.transaction(
    async (tx: any) => {
      /**
       * 1. 상담 원본 잠금 및 재검증
       */
      /**
 * 1. 상담 원본 행 잠금 및 재검증
 *
 * 동일 consultationId를 대상으로 서로 다른
 * AI 승인 초안이 동시에 실행되는 경우를 방지한다.
 */
const [
  lockedConsultationRows,
] =
  await tx.execute(sql`
    SELECT id
    FROM consultations
    WHERE id = ${consultationId}
      AND organizationId = ${organizationId}
      AND deletedAt IS NULL
    LIMIT 1
    FOR UPDATE
  `);

const lockedConsultation =
  Array.isArray(
    lockedConsultationRows
  )
    ? (
        lockedConsultationRows as any[]
      )[0]
    : null;

if (!lockedConsultation) {
  throwAppError(
    ERROR_CODES.DATA_NOT_FOUND,
    "상담DB 정보를 찾을 수 없습니다.",
    404
  );
}

      /**
       * 2. 같은 상담으로 이미 생성된 학생 재검증
       */
      const existingStudents =
        await tx
          .select({
            id:
              students.id,
          })
          .from(students)
          .where(
            and(
              eq(
                students.consultationId,
                consultationId
              ),

              eq(
                students.organizationId,
                organizationId
              ),

              sql`${students.deletedAt} IS NULL`
            )
          )
          .limit(1);

      if (
        existingStudents[0]
      ) {
        throwAppError(
          ERROR_CODES.DUPLICATE_RESOURCE,
          "이미 학생으로 전환된 상담DB입니다.",
          409
        );
      }

      /**
       * 3. 학생 개인정보 암호화 후 생성
       */
      const preparedStudent =
        prepareStudentPersonalData({
          organizationId,

          consultationId,

          assigneeId,

          clientName,

          phone,

          finalEducation,

          course:
            desiredCourse,

                    status:
            "등록",

          approvalStatus:
            "대기",

          approvedAt:
            null,

          rejectedAt:
            null,
        });

      const studentInsertResult:
        any =
        await tx
          .insert(students)
          .values(
            preparedStudent as any
          );

      const studentId =
        Number(
          getInsertId(
            studentInsertResult
          ) || 0
        );

      if (!studentId) {
        throwAppError(
          ERROR_CODES.INTERNAL_SERVER_ERROR,
          "학생 정보를 생성하지 못했습니다.",
          500
        );
      }

      /**
       * 4. 플랜 생성
       */
      const planInsertResult:
        any =
        await tx
          .insert(plans)
          .values({
            organizationId,

            studentId,

            desiredCourse,

            finalEducation,

            totalTheorySubjects:
              Number(
                draft.plan
                  ?.totalTheorySubjects ||
                0
              ),

            requiredMajorCount:
              0,

            electiveMajorCount:
              0,

            liberalCount:
              0,

            generalCount:
              0,

                       hasPractice:
              practiceDraft === null
                ? null
                : Boolean(
                    practiceDraft.required
                  ),

            practiceHours:
              practiceDraft
                ?.required === true
                ? practiceDraft
                    .requiredHours ??
                  null
                : null,

            practiceDate:
              practiceDraft
                ?.required === true
                ? practiceDraft
                    .plannedMonth ||
                  null
                : null,

            practiceArranged:
              false,

            practiceStatus:
              "미섭외",

            specialNotes:
              [
                draft.plan
                  ?.summaryText ||
                null,

                practiceDraft
                  ?.required === true &&
                practiceDraft
                  .courseName
                  ? `실습과목: ${practiceDraft.courseName}`
                  : null,

                practiceDraft
                  ?.required === true &&
                practiceDraft
                  .semesterNo
                  ? `실습예정학기: ${practiceDraft.semesterNo}학기`
                  : null,
              ]
                .filter(Boolean)
                .join("\n") ||
              null,
          } as any);

      const planId =
        Number(
          getInsertId(
            planInsertResult
          ) || 0
        );

      if (!planId) {
        throwAppError(
          ERROR_CODES.INTERNAL_SERVER_ERROR,
          "학생 플랜을 생성하지 못했습니다.",
          500
        );
      }

      /**
       * 5. 학기 생성
       */
      const semesterIds:
        number[] = [];

      for (
        const semester of
        semesterDrafts
      ) {
        const semesterNo =
          Number(
            semester.semesterNo ||
            0
          );

        if (
          !Number.isFinite(
            semesterNo
          ) ||
          semesterNo <= 0
        ) {
          throwAppError(
            ERROR_CODES.INVALID_REQUEST,
            "학기 번호가 올바르지 않습니다.",
            400
          );
        }

        const semesterResult:
          any =
          await tx
            .insert(semesters)
            .values({
              organizationId,

              studentId,

              semesterOrder:
                semesterNo,

              semesterLabel:
                `${semesterNo}학기`,

              plannedMonth:
                semester
                  .plannedStartMonth ||
                null,

              plannedInstitution:
                semester
                  .plannedInstitution ||
                null,

                            plannedSubjectCount:
                semester
                  .plannedSubjectCount ??
                planSubjectDrafts.filter(
                  (subject) =>
                    Number(
                      subject.semesterNo
                    ) ===
                    semesterNo
                ).length,

              plannedAmount:
                semester
                  .plannedAmount ===
                  null
                  ? "0"
                  : String(
                      semester
                        .plannedAmount
                    ),

                          actualStartDate:
                null,

              actualInstitution:
                null,

              actualSubjectCount:
                null,

              actualAmount:
                null,

              actualPaymentDate:
                null,

                            status:
                "등록",

              approvalStatus:
                "요청전",

              isCompleted:
                false,

              practiceStatus:
                "미섭외",

              primaryCourse:
                desiredCourse,

              registeredCoursesJson:
                JSON.stringify([
                  desiredCourse,
                ]),
            } as any);

        const semesterId =
          Number(
            getInsertId(
              semesterResult
            ) || 0
          );

        if (!semesterId) {
          throwAppError(
            ERROR_CODES.INTERNAL_SERVER_ERROR,
            `${semesterNo}학기 정보를 생성하지 못했습니다.`,
            500
          );
        }

        semesterIds.push(
          semesterId
        );
      }

            /**
       * 6-1. 우리플랜 과목 생성
       */
      const planSubjectIds:
        number[] = [];

      const semesterSubjectOrderMap =
        new Map<number, number>();

      for (
        let index = 0;
        index <
        planSubjectDrafts.length;
        index += 1
      ) {
        const subject =
          planSubjectDrafts[index];

        const subjectName =
          String(
            subject.subjectName ||
            ""
          ).trim();

        const semesterNo =
          Number(
            subject.semesterNo ||
            0
          );

        if (
          !subjectName
        ) {
          continue;
        }

        if (
          !Number.isFinite(
            semesterNo
          ) ||
          semesterNo <= 0
        ) {
          throwAppError(
            ERROR_CODES.INVALID_REQUEST,
            `우리플랜 과목 '${subjectName}'의 학기 정보가 올바르지 않습니다.`,
            400
          );
        }

        const semesterSortOrder =
          semesterSubjectOrderMap.get(
            semesterNo
          ) || 0;

        semesterSubjectOrderMap.set(
          semesterNo,
          semesterSortOrder + 1
        );

        const planSubjectResult:
          any =
          await tx
            .insert(
              planSemesters
            )
            .values({
              organizationId,

              studentId,

              semesterNo,

              subjectName,

              planCategory:
                subject.category ||
                "전공",

              planRequirementType:
                subject
                  .requirementType ||
                "전공선택",

              credits:
                Number(
                  subject.credits ||
                  3
                ),

                            sortOrder:
                semesterSortOrder,

              settlementIncluded:
                !/실습|이벤트|무료/.test(
                  subjectName
                ),
            } as any);

        const planSubjectId =
          Number(
            getInsertId(
              planSubjectResult
            ) || 0
          );

        if (
          !planSubjectId
        ) {
          throwAppError(
            ERROR_CODES.INTERNAL_SERVER_ERROR,
            `우리플랜 과목 '${subjectName}'을 저장하지 못했습니다.`,
            500
          );
        }

        planSubjectIds.push(
          planSubjectId
        );
      }

      /**
       * 6-2. 전적대 및 기존 이수 과목 생성
       */
      const transferSubjectIds:
        number[] = [];

      for (
        let index = 0;
        index <
        transferSubjectDrafts.length;
        index += 1
      ) {
        const subject =
          transferSubjectDrafts[index];

        const subjectName =
          String(
            subject.subjectName ||
            ""
          ).trim();

        if (
          !subjectName
        ) {
          continue;
        }

        const transferSubjectResult:
          any =
          await tx
            .insert(
              transferSubjects
            )
            .values({
              organizationId,

              studentId,

              schoolName:
                subject.schoolName ||
                null,

              subjectName,

              transferCategory:
                subject.category ||
                "전공",

              transferRequirementType:
                subject
                  .requirementType ||
                "전공선택",

              credits:
                Number(
                  subject.credits ||
                  3
                ),

              sortOrder:
                index,

              attachmentName:
                null,

              attachmentUrl:
                null,
            } as any);

        const transferSubjectId =
          Number(
            getInsertId(
              transferSubjectResult
            ) || 0
          );

        if (
          !transferSubjectId
        ) {
          throwAppError(
            ERROR_CODES.INTERNAL_SERVER_ERROR,
            `전적대 과목 '${subjectName}'을 저장하지 못했습니다.`,
            500
          );
        }

        transferSubjectIds.push(
          transferSubjectId
        );
      }

           /**
       * 7. 상담DB 상태를 등록예정으로 변경
       *
       * 실제 등록·승인·정산 처리는 수행하지 않는다.
       * 이름과 연락처는 변경하지 않는다.
       */
      await tx
        .update(consultations)
        .set({
                  status:
            "등록예정",

          desiredCourse,

          finalEducation,

          assigneeId,
        } as any)
        .where(
          and(
            eq(
              consultations.id,
              consultationId
            ),

            eq(
              consultations.organizationId,
              organizationId
            )
          )
        );

            return {
        studentId,

        planId,

        semesterIds,

        planSubjectIds,

        transferSubjectIds,

        practiceSaved:
          practiceDraft !== null,

        consultationId,

        completedSteps: [
          "상담DB 원본 재검증",
          "등록예정 학생 생성",
          "학생 플랜 생성",
          `${semesterIds.length}개 예정 학기 생성`,
          `${planSubjectIds.length}개 우리플랜 과목 생성`,
          `${transferSubjectIds.length}개 전적대 과목 생성`,
          practiceDraft !== null
            ? "실습 설계정보 저장"
            : "실습 설계정보 미확정",
          "상담DB 상태를 등록예정으로 변경",
        ],
      };
    }
  );
}

/**
 * AI 문서 분석 결과 CRM 반영 트랜잭션
 *
 * 지원 범위
 * 1. 전적대·기존 이수 과목
 * 2. 우리플랜 과목
 * 3. 학생 결제정보
 * 4. 우리플랜 과목 + 결제정보
 *
 * Pending Action 승인 전에는 호출하지 않는다.
 */
export async function executeDocumentImportTransaction(
  input:
    ExecuteDocumentImportTransactionInput
): Promise<
  ExecuteDocumentImportTransactionResult
> {
  const db =
    await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId =
    requireOrganizationId(
      input.organizationId
    );

  const studentId =
    Number(
      input.studentId ||
      0
    );

  const actorUserId =
    Number(
      input.actorUserId ||
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "올바른 학생 정보가 필요합니다.",
      400
    );
  }

  if (
    !Number.isFinite(
      actorUserId
    ) ||
    actorUserId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서 반영 실행 사용자 정보가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    normalizeDocumentImportDraft(
      input.draft
    );

  if (
    draft.studentId !==
    Math.floor(
      studentId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "승인 초안의 학생 정보가 일치하지 않습니다.",
      409
    );
  }

  const completedSteps:
    string[] = [];

  return db.transaction(
    async (
      tx:
        any
    ) => {
      /**
       * 학생 행 잠금
       */
      const [
        lockedStudentRows,
      ] =
        await tx.execute(
          sql`
            SELECT *
            FROM students
            WHERE id = ${Math.floor(
              studentId
            )}
              AND organizationId = ${organizationId}
              AND deletedAt IS NULL
            LIMIT 1
            FOR UPDATE
          `
        );

      const lockedStudent =
        Array.isArray(
          lockedStudentRows
        )
          ? lockedStudentRows[0]
          : null;

      if (!lockedStudent) {
        throwAppError(
          ERROR_CODES.DATA_NOT_FOUND,
          "문서 반영 대상 학생을 찾을 수 없습니다.",
          404
        );
      }

      completedSteps.push(
        "반영 대상 학생 재검증"
      );

      const planSubjectIds:
        number[] = [];

      const transferSubjectIds:
        number[] = [];

      let semesterId:
        number |
        null = null;

      let paymentUpdated =
        false;

      const importsTransfer =
        draft.actionType ===
        "document_transfer_import";

      const importsPlan =
        draft.actionType ===
          "document_plan_import" ||
        draft.actionType ===
          "document_plan_payment_import";

      const importsPayment =
        draft.actionType ===
          "document_payment_import" ||
        draft.actionType ===
          "document_plan_payment_import";

      /**
       * 기존 전적대 과목 이름 잠금 조회
       */
      if (
        importsTransfer
      ) {
        const existingTransferRows =
          await tx
            .select()
            .from(
              transferSubjects
            )
            .where(
              and(
                eq(
                  transferSubjects.studentId,
                  Math.floor(
                    studentId
                  )
                ),

                eq(
                  transferSubjects.organizationId,
                  organizationId
                )
              )
            )
            .orderBy(
              transferSubjects.sortOrder,
              transferSubjects.id
            );

        const existingNameSet =
          new Set(
            existingTransferRows.map(
              (
                row:
                  any
              ) =>
                normalizeDocumentImportSubjectName(
                  row.subjectName
                ).toLowerCase()
            )
          );

        let sortOrder =
          existingTransferRows.length;

        for (
          const subject of
          draft.subjects
        ) {
          const normalizedName =
            normalizeDocumentImportSubjectName(
              subject.subjectName
            );

          const duplicateKey =
            normalizedName.toLowerCase();

          if (
            existingNameSet.has(
              duplicateKey
            )
          ) {
            throwAppError(
              ERROR_CODES.DUPLICATE_RESOURCE,
              `이미 기존 이수 과목에 등록된 과목입니다: ${normalizedName}`,
              409
            );
          }

          const result:
            any =
            await tx
              .insert(
                transferSubjects
              )
              .values({
                organizationId,

                studentId:
                  Math.floor(
                    studentId
                  ),

                schoolName:
                  draft.institutionName,

                subjectName:
                  normalizedName,

                transferCategory:
                  subject.category,

                transferRequirementType:
                  subject.requirementType,

                credits:
                  subject.credits,

                sortOrder,

                attachmentName:
                  null,

                attachmentUrl:
                  null,
              } as any);

          const insertedId =
            Number(
              getInsertId(
                result
              ) ||
              0
            );

          if (!insertedId) {
            throwAppError(
              ERROR_CODES.INTERNAL_SERVER_ERROR,
              `기존 이수 과목을 저장하지 못했습니다: ${normalizedName}`,
              500
            );
          }

          transferSubjectIds.push(
            insertedId
          );

          existingNameSet.add(
            duplicateKey
          );

          sortOrder +=
            1;
        }

        completedSteps.push(
          `기존 이수 과목 ${transferSubjectIds.length}개 등록`
        );
      }

      /**
       * 우리플랜 과목 등록
       */
      if (
        importsPlan
      ) {
        const existingPlanRows =
          await tx
            .select()
            .from(
              planSemesters
            )
            .where(
              and(
                eq(
                  planSemesters.studentId,
                  Math.floor(
                    studentId
                  )
                ),

                eq(
                  planSemesters.organizationId,
                  organizationId
                )
              )
            )
            .orderBy(
              planSemesters.semesterNo,
              planSemesters.sortOrder,
              planSemesters.id
            );

        const existingNameSet =
          new Set(
            existingPlanRows.map(
              (
                row:
                  any
              ) =>
                normalizeDocumentImportSubjectName(
                  row.subjectName
                ).toLowerCase()
            )
          );

        const semesterRows =
          await tx
            .select()
            .from(
              semesters
            )
            .where(
              and(
                eq(
                  semesters.studentId,
                  Math.floor(
                    studentId
                  )
                ),

                eq(
                  semesters.organizationId,
                  organizationId
                )
              )
            )
            .orderBy(
              semesters.semesterOrder,
              semesters.id
            );

        if (
          semesterRows.length ===
          0
        ) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "우리플랜 과목을 반영할 학생 학기정보가 없습니다.",
            409
          );
        }

        const defaultSemester =
          semesterRows[
            semesterRows.length -
            1
          ];

        semesterId =
          Number(
            defaultSemester.id
          );

        const sortOrderBySemester =
          new Map<
            number,
            number
          >();

        for (
          const row of
          existingPlanRows
        ) {
          const semesterNo =
            Number(
              row.semesterNo ||
              1
            );

          const nextSortOrder =
            Math.max(
              sortOrderBySemester.get(
                semesterNo
              ) ||
                0,

              Number(
                row.sortOrder ||
                0
              ) +
                1
            );

          sortOrderBySemester.set(
            semesterNo,
            nextSortOrder
          );
        }

        for (
          const subject of
          draft.subjects
        ) {
          const normalizedName =
            normalizeDocumentImportSubjectName(
              subject.subjectName
            );

          const duplicateKey =
            normalizedName.toLowerCase();

          if (
            existingNameSet.has(
              duplicateKey
            )
          ) {
            throwAppError(
              ERROR_CODES.DUPLICATE_RESOURCE,
              `이미 우리플랜에 등록된 과목입니다: ${normalizedName}`,
              409
            );
          }

          const semesterNo =
            subject.semesterNo &&
            subject.semesterNo > 0
              ? subject.semesterNo
              : Number(
                  defaultSemester
                    .semesterOrder ||
                  1
                );

          const sortOrder =
            sortOrderBySemester.get(
              semesterNo
            ) ||
            0;

          const result:
            any =
            await tx
              .insert(
                planSemesters
              )
              .values({
                organizationId,

                studentId:
                  Math.floor(
                    studentId
                  ),

                semesterNo,

                subjectName:
                  normalizedName,

                planCategory:
                  subject.category,

                planRequirementType:
                  subject.requirementType,

                credits:
                  subject.credits,

                sortOrder,

                settlementIncluded:
                  resolvePlanSemesterSettlementIncluded(
                    normalizedName
                  ),
              } as any);

          const insertedId =
            Number(
              getInsertId(
                result
              ) ||
              0
            );

          if (!insertedId) {
            throwAppError(
              ERROR_CODES.INTERNAL_SERVER_ERROR,
              `우리플랜 과목을 저장하지 못했습니다: ${normalizedName}`,
              500
            );
          }

          planSubjectIds.push(
            insertedId
          );

          existingNameSet.add(
            duplicateKey
          );

          sortOrderBySemester.set(
            semesterNo,
            sortOrder +
              1
          );
        }

        completedSteps.push(
          `우리플랜 과목 ${planSubjectIds.length}개 등록`
        );
      }

      /**
       * 학생 결제정보 반영
       *
       * 환불 정산은 별도 정산 Executor가 필요하므로
       * 현재 문서 반영에서는 원 결제정보만 수정한다.
       */
      if (
        importsPayment
      ) {
        const paymentUpdate:
          Record<
            string,
            unknown
          > = {};

        if (
          draft.paymentAmount !==
          null &&
          Number.isFinite(
            Number(
              draft.paymentAmount
            )
          ) &&
          Number(
            draft.paymentAmount
          ) >= 0
        ) {
          paymentUpdate.paymentAmount =
            String(
              Math.floor(
                Number(
                  draft.paymentAmount
                )
              )
            );
        }

        const normalizedPaidAt =
          normalizeDocumentImportDate(
            draft.paidAt
          );

        if (
          normalizedPaidAt
        ) {
          paymentUpdate.paymentDate =
            normalizedPaidAt;
        }

        if (
          draft.institutionName
        ) {
          paymentUpdate.institution =
            draft.institutionName;
        }

        if (
          Object.keys(
            paymentUpdate
          ).length ===
          0
        ) {
          throwAppError(
            ERROR_CODES.INVALID_REQUEST,
            "학생에게 반영할 유효한 결제정보가 없습니다.",
            400
          );
        }

        await tx
          .update(
            students
          )
          .set(
            paymentUpdate as any
          )
          .where(
            and(
              eq(
                students.id,
                Math.floor(
                  studentId
                )
              ),

              eq(
                students.organizationId,
                organizationId
              ),

              sql`${students.deletedAt} IS NULL`
            )
          );

        paymentUpdated =
          true;

        completedSteps.push(
          "학생 결제정보 반영"
        );
      }

      /**
       * 학생 변경이력
       */
      const auditAfter = {
        analysisId:
          draft.analysisId,

        actionType:
          draft.actionType,

        target:
          draft.target,

        documentType:
          draft.documentType,

        planSubjectIds,

        transferSubjectIds,

        paymentUpdated,

        paymentAmount:
          draft.paymentAmount,

        paymentStatus:
          draft.paymentStatus,

        paidAt:
          draft.paidAt,

        institutionName:
          draft.institutionName,
      };

      await tx
        .insert(
          studentAuditLogs
        )
        .values({
          organizationId,

          studentId:
            Math.floor(
              studentId
            ),

          entityType:
            "ai_document_import",

          entityId:
            null,

          action:
            "update",

          title:
            "AI 문서 분석 결과 CRM 반영",

          beforeJson:
            encryptStudentAuditJson({
              student: {
                paymentAmount:
                  lockedStudent.paymentAmount ??
                  null,

                paymentDate:
                  lockedStudent.paymentDate ??
                  null,

                institution:
                  lockedStudent.institution ??
                  null,
              },
            }),

          afterJson:
            encryptStudentAuditJson(
              auditAfter
            ),

          diffJson:
            encryptStudentAuditJson(
              auditAfter
            ),

          actorUserId:
            Math.floor(
              actorUserId
            ),

          actorName:
            input.actorName
              ? encryptPersonalData(
                  String(
                    input.actorName
                  ).trim()
                )
              : null,

          actorRole:
            input.actorRole ??
            null,
        } as any);

      completedSteps.push(
        "학생 변경이력 기록"
      );

      return {
        studentId:
          Math.floor(
            studentId
          ),

        semesterId,

        planSubjectIds,

        transferSubjectIds,

        paymentUpdated,

        completedSteps,
      };
    }
  );
}

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
  }
}

function decryptAuditLogPersonalData<
  T extends Record<string, any>
>(
  row: T
): T & Record<string, any> {
  return {
    ...row,

    beforeJson:
      row.beforeJson === null ||
      row.beforeJson === undefined
        ? row.beforeJson
        : decryptPersonalData(
            String(row.beforeJson)
          ),

    afterJson:
      row.afterJson === null ||
      row.afterJson === undefined
        ? row.afterJson
        : decryptPersonalData(
            String(row.afterJson)
          ),

    memo:
      row.memo === null ||
      row.memo === undefined
        ? row.memo
        : decryptPersonalData(
            String(row.memo)
          ),
  };
}

export async function createAuditLog(
  input: Omit<InsertAuditLog, "id" | "createdAt">
) {
  const db = await getDb();
  if (!db) return null;

  const result: any =
  await db
    .insert(auditLogs)
    .values({
      ...input,

      beforeJson:
        (input as any).beforeJson === null ||
        (input as any).beforeJson === undefined
          ? null
          : encryptPersonalData(
              typeof (input as any).beforeJson ===
                "string"
                ? (input as any).beforeJson
                : JSON.stringify(
                    (input as any).beforeJson
                  )
            ),

      afterJson:
        (input as any).afterJson === null ||
        (input as any).afterJson === undefined
          ? null
          : encryptPersonalData(
              typeof (input as any).afterJson ===
                "string"
                ? (input as any).afterJson
                : JSON.stringify(
                    (input as any).afterJson
                  )
            ),

      memo:
        (input as any).memo === null ||
        (input as any).memo === undefined
          ? null
          : encryptPersonalData(
              String((input as any).memo)
            ),
    } as any);
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

  const rows = await db
  .select()
  .from(auditLogs)
  .where(whereExpr)
  .orderBy(
    desc(auditLogs.createdAt)
  )
  .limit(limit);

return rows.map((row: any) =>
  decryptAuditLogPersonalData(row)
);
}

export async function createApiErrorLog(
  input: Omit<InsertApiErrorLog, "id" | "createdAt">
) {
  try {
    const db = await getDb();
    if (!db) return null;

    const organizationId = Number((input as any).organizationId || 0);
    if (!organizationId) return null;

    const result: any = await db.insert(apiErrorLogs).values(input as any);
    return getInsertId(result);
  } catch (err) {
    return null;
  }
}

export async function listOrganizationApiErrorLogs(params: {
  organizationId: number;
  limit?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);
  const limit = Math.min(Math.max(Number(params.limit || 100), 1), 300);

  const [rows] = await db.execute(sql`
    SELECT *
    FROM api_error_logs
    WHERE organizationId = ${organizationId}
    ORDER BY createdAt DESC
    LIMIT ${limit}
  `);

  return rows as any[];
}

export async function getOrganizationApiErrorSummary(params: {
  organizationId: number;
  days?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);
  const days = Math.min(Math.max(Number(params.days || 7), 1), 90);

  const [rows] = await db.execute(sql`
    SELECT
      path,
      statusCode,
      COUNT(*) as errorCount,
      MAX(createdAt) as latestAt
    FROM api_error_logs
    WHERE organizationId = ${organizationId}
      AND createdAt >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
    GROUP BY path, statusCode
    ORDER BY errorCount DESC, latestAt DESC
    LIMIT 50
  `);

  return rows as any[];
}

export async function createStudentAuditLog(
  input: Omit<InsertStudentAuditLog, "id" | "createdAt">
) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId((input as any).organizationId);

 const plainActorName =
  (input as any).actorName === null ||
  (input as any).actorName === undefined
    ? null
    : String((input as any).actorName).trim() || null;

const result: any =
  await db
    .insert(studentAuditLogs)
    .values({
      ...input,
      organizationId,

      actorName: plainActorName
        ? encryptPersonalData(plainActorName)
        : null,

      beforeJson:
        encryptStudentAuditJson(
          (input as any).beforeJson
        ),

      afterJson:
        encryptStudentAuditJson(
          (input as any).afterJson
        ),

      diffJson:
        encryptStudentAuditJson(
          (input as any).diffJson
        ),
    } as any);

  return getInsertId(result);
}

export async function listStudentAuditLogs(params: {
  organizationId?: number | null;
  studentId: number;
  limit?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);
  const limit = Math.min(Math.max(Number(params.limit || 100), 1), 300);

  const rows = await db
  .select()
  .from(studentAuditLogs)
  .where(
    and(
      eq(
        studentAuditLogs.organizationId,
        organizationId
      ),
      eq(
        studentAuditLogs.studentId,
        Number(params.studentId)
      )
    )
  )
  .orderBy(
    desc(studentAuditLogs.createdAt)
  )
  .limit(limit);

return rows.map((row: any) =>
  decryptStudentAuditLogPersonalData(row)
);
}

export async function createEmailVerificationCode(
  input: Omit<InsertEmailVerificationCode, "id" | "createdAt">
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const normalizedEmail = String((input as any).email || "")
  .trim()
  .toLowerCase();

const result: any = await db
  .insert(emailVerificationCodes)
  .values({
    ...input,
    email: encryptPersonalData(normalizedEmail),
    emailHash: createEmailHash(normalizedEmail),
  } as any);
  return getInsertId(result);
}

export async function getLatestEmailVerificationCode(params: {
  organizationId?: number | null;
  email: string;
  purpose: "find_id" | "reset_password";
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select()
    .from(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.organizationId, organizationId),
        eq(
  emailVerificationCodes.emailHash,
  createEmailHash(params.email)
),
        eq(emailVerificationCodes.purpose, params.purpose),
        sql`${emailVerificationCodes.usedAt} IS NULL`,
        sql`${emailVerificationCodes.expiresAt} > NOW()`
      )
    )
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);

  return rows[0] || null;
}

export async function getRecentEmailVerificationCode(params: {
  organizationId?: number | null;
  email: string;
  purpose: "find_id" | "reset_password";
  seconds?: number;
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params.organizationId);
  const seconds = Number(params.seconds || 30);

  const rows = await db
    .select()
    .from(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.organizationId, organizationId),
        eq(
  emailVerificationCodes.emailHash,
  createEmailHash(params.email)
),
        eq(emailVerificationCodes.purpose, params.purpose),
        sql`${emailVerificationCodes.createdAt} > DATE_SUB(NOW(), INTERVAL ${seconds} SECOND)`
      )
    )
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);

  return rows[0] || null;
}

export async function countRecentEmailVerificationCodes(params: {
  organizationId?: number | null;
  email: string;
  purpose: "find_id" | "reset_password";
  minutes?: number;
}) {
  const db = await getDb();
  if (!db) return 0;

  const organizationId = requireOrganizationId(params.organizationId);
  const minutes = Number(params.minutes || 5);
const emailHash = createEmailHash(params.email);

  const [rows] = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM email_verification_codes
    WHERE organizationId = ${organizationId}
      AND emailHash = ${emailHash}
      AND purpose = ${params.purpose}
      AND createdAt > DATE_SUB(NOW(), INTERVAL ${minutes} MINUTE)
  `);

  return Number((rows as any)?.[0]?.count || 0);
}

export async function increaseEmailVerificationAttempt(id: number) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  await db
    .update(emailVerificationCodes)
    .set({
      attempts: sql`${emailVerificationCodes.attempts} + 1`,
    } as any)
    .where(eq(emailVerificationCodes.id, id));
}

export async function markEmailVerificationUsed(id: number) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  await db
    .update(emailVerificationCodes)
    .set({
      usedAt: new Date(),
    } as any)
    .where(eq(emailVerificationCodes.id, id));
}

export async function findUsersByEmailForRecovery(params: {
  organizationId?: number | null;
  email: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
  .select({
    id: users.id,
    username: users.username,
    name: users.name,
    email: users.email,
    role: users.role,
    isActive: users.isActive,
  })
  .from(users)
  .where(
    and(
      eq(users.organizationId, organizationId),
      eq(
        users.emailHash,
        createEmailHash(params.email)
      ),
      eq(users.isActive, true)
    )
  );

return rows.map((row) => ({
  ...row,

  name:
    row.name === null || row.name === undefined
      ? row.name
      : decryptPersonalData(row.name),

  email:
    row.email === null || row.email === undefined
      ? row.email
      : decryptPersonalData(row.email),
}));
}

export async function findUsersForIdRecovery(params: {
  organizationId?: number | null;
  name: string;
  phone: string;
  email: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(
      and(
        eq(users.organizationId, organizationId),
        eq(
  users.nameHash,
  createNameHash(params.name)
),
eq(
  users.phoneHash,
  createPhoneHash(params.phone)
),
eq(
  users.emailHash,
  createEmailHash(params.email)
),
        eq(users.isActive, true)
      )
    );

return rows.map((row) => ({
  ...row,

  name:
    row.name === null || row.name === undefined
      ? row.name
      : decryptPersonalData(row.name),

  email:
    row.email === null || row.email === undefined
      ? row.email
      : decryptPersonalData(row.email),

  phone:
    row.phone === null || row.phone === undefined
      ? row.phone
      : decryptPersonalData(row.phone),
}));
}

export async function findUserForPasswordReset(params: {
  organizationId?: number | null;
  name: string;
  username: string;
  email: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.organizationId, organizationId),
        eq(
  users.nameHash,
  createNameHash(params.name)
),
eq(
  users.username,
  params.username.trim()
),
eq(
  users.emailHash,
  createEmailHash(params.email)
),
        eq(users.isActive, true)
      )
    )
    .limit(1);

  return rows[0]
  ? decryptUserPersonalData(rows[0])
  : null;
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

export async function listAutoBackupsToPrune(params: {
  organizationId?: number | null;
  keepCount?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);
  const keepCount = Math.max(Number(params.keepCount || 7), 1);

  const [rows] = await db.execute(sql`
    SELECT
      id,
      organizationId,
      fileKey,
      createdAt
    FROM organization_backups
    WHERE organizationId = ${organizationId}
      AND backupType = 'auto'
      AND status = 'completed'
    ORDER BY createdAt DESC, id DESC
    LIMIT 1000
  `);

  const backups = Array.isArray(rows) ? (rows as any[]) : [];

  return backups.slice(keepCount);
}

export async function deleteOrganizationBackupRecord(params: {
  id: number;
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

  await db
    .delete(organizationBackups)
    .where(
      and(
        eq(organizationBackups.id, Number(params.id)),
        eq(organizationBackups.organizationId, organizationId),
        eq(organizationBackups.backupType, "auto")
      )
    );

  return {
    ok: true,
    id: Number(params.id),
  };
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
"sms_opt_outs",

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
"organization_practice_institution_overrides",
"organization_practice_education_center_overrides",
"job_support_requests",
"credit_summary_rules",
"student_credit_summary_items",

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
"ai_pending_actions",
"ai_learning_entries",

  "settlement_grades",
  "settlement_items",
  "settlement_item_logs",
  "settlement_settings",
"settlement_subject_price_rules",
"settlement_institution_price_rules",
"settlement_month_locks",
  "audit_logs",
"student_audit_logs",
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

if (params.actorRole === "superhost") {
  throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "슈퍼호스트는 회사 백업 원문을 생성할 수 없습니다.",
  403
);
}

  const orgRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const organization = orgRows[0];

  if (!organization) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "회사를 찾을 수 없습니다.",
  404
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

if (params.actorRole === "superhost") {
  throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "슈퍼호스트는 회사 백업 원문을 복구할 수 없습니다.",
  403
);
}

  const backup = params.backup;

  if (!backup || backup.app !== "Edu-CRM") {
   throwAppError(
  ERROR_CODES.RESTORE_FAILED,
  "Edu-CRM 백업 파일이 아닙니다.",
  400
);
  }

  if (backup.backupType !== "organization_full") {
    throwAppError(
  ERROR_CODES.RESTORE_FAILED,
  "지원하지 않는 백업 유형입니다.",
  400
);
  }

  if (Number(backup.organizationId) !== Number(organizationId)) {
    throwAppError(
  ERROR_CODES.RESTORE_FAILED,
  "다른 회사의 백업 파일은 복구할 수 없습니다.",
  403
);
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
  const rows = await listMergedPracticeInstitutions({
    organizationId: requireOrganizationId(params?.organizationId),
  });

  return (rows || []).filter(
    (row: any) =>
      row.isActive !== false &&
      row.isInactive !== true &&
      row.isHidden !== true
  );
}

export async function listActivePracticeEducationCenters(params?: {
  organizationId?: number | null;
}) {
  const rows = await listMergedPracticeEducationCenters({
    organizationId: requireOrganizationId(params?.organizationId),
  });

  return (rows || []).filter(
    (row: any) =>
      row.isActive !== false &&
      row.isInactive !== true &&
      row.isHidden !== true
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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생 주소 좌표가 없습니다.",
  404
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const limit = params.limit ?? 100;

const organizationId = requireOrganizationId(params.organizationId);

  const table =
  params.type === "education"
    ? practiceEducationCenterMasters
    : practiceInstitutionMasters;

  const rows = await db
    .select()
    .from(table)
    .where(
  and(
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
       .where(eq(table.id, row.id));

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
    totalSemesters: 0,

    hasSettlementData: false,
    totalPaid: 0,
    totalRefund: 0,
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
    totalSemesters: 0,

    hasSettlementData: false,
    totalPaid: 0,
    totalRefund: 0,
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
    COUNT(*) as settlementRowCount,

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

const settlementRow =
  (settlementResult as any)?.[0] ?? {};

const settlementRowCount =
  toNumber(
    settlementRow.settlementRowCount
  );

const hasSettlementData =
  settlementRowCount > 0;

const totalPaid =
  toNumber(
    settlementRow.totalPaid
  );

const totalRefund =
  toNumber(
    settlementRow.totalRefund
  );

const rawPaymentAmount =
  totalPaid - totalRefund;

  return {
  status:
    lastSemester?.status === "등록 종료"
      ? "등록 종료"
      : student.status || "등록",

  startDate:
    firstActual?.actualStartDate ||
    student.startDate ||
    null,

  paymentAmount:
    Math.max(rawPaymentAmount, 0),

  subjectCount:
    firstActual?.actualSubjectCount ??
    student.subjectCount ??
    0,

  paymentDate:
    firstActual?.actualPaymentDate ||
    student.paymentDate ||
    null,

  institution:
    firstActual?.actualInstitution ||
    student.institution ||
    "",

totalSemesters:
  semesterRows.length > 0
    ? semesterRows.length
    : Number(student.totalSemesters || 0),

hasSettlementData,
totalPaid,
totalRefund,
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

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(String(value));
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  "같은 이름의 뼈대가 이미 존재합니다.",
  409
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

const organizationId = requireOrganizationId(input.organizationId);

  const target = await getFormBlueprintById(input.id, {
    organizationId,
  });

  if (!target) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "수정할 뼈대를 찾을 수 없습니다.",
  404
);
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
      throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  "같은 이름의 뼈대가 이미 존재합니다.",
  409
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params?.organizationId);

  const target = await getFormBlueprintById(id, {
    organizationId,
  });

  if (!target) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "삭제할 뼈대를 찾을 수 없습니다.",
  404
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

const organizationId = requireOrganizationId(input.organizationId);

  const blueprint = await getFormBlueprintById(input.blueprintId, {
    organizationId,
  });

  if (!blueprint) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "뼈대를 찾을 수 없습니다.",
  404
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    title: "학점은행제 맞춤 상담 신청",
    subtitle: "전문 담당자가 학습 상황에 맞춰 무료로 안내드립니다.",
    logoUrl: "",
    heroImageUrl: "",
    primaryColor: "#2563eb",
    submitButtonText: "무료 상담 신청하기",
    agreementText: "개인정보 수집 및 이용에 동의합니다.",
    layoutType: "card",
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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "템플릿을 찾을 수 없습니다.",
  404
);
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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "대상 폼을 찾을 수 없습니다.",
  404
);
  }

  if (target.formType !== input.formType) {
    throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "폼 타입이 맞지 않습니다.",
  400
);
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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "삭제할 템플릿을 찾을 수 없습니다.",
  404
);
  }

  if (Number(existing[0].assigneeId) !== Number(actorUserId)) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "본인 템플릿만 삭제할 수 있습니다.",
  403
);
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
    throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "이전 이름과 새 이름이 같습니다.",
  400
);
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
   throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "변경할 템플릿을 찾을 수 없습니다.",
  404
);
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
    throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  "같은 이름의 템플릿이 이미 존재합니다.",
  409
);
  }

  if (Number(existingOld[0].assigneeId) !== Number(input.actorUserId)) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "본인 템플릿만 이름 변경할 수 있습니다.",
  403
);
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
    throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "복제할 새 이름이 기존 이름과 같습니다.",
  400
);
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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "복제할 템플릿을 찾을 수 없습니다.",
  404
);
  }

  if (Number(source.assigneeId) !== Number(input.actorUserId)) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "본인 템플릿만 복제할 수 있습니다.",
  403
);
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
    throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  "같은 이름의 템플릿이 이미 존재합니다.",
  409
);
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
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "템플릿 이름이 비어 있습니다.",
  400
);
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
export async function getPublicLeadFormByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(leadForms)
    .where(eq(leadForms.token, token))
    .limit(1);

  return result[0];
}

export async function updateLeadFormUiConfig(
  id: number,
  uiConfig: any,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "수정할 폼을 찾을 수 없습니다.",
  404
);
  }

  if (Number(target.assigneeId) !== Number(input.userId)) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "본인 페이지 외에는 수정할 수 없습니다.",
  403
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!user.openId) throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "User openId is required for upsert",
  400
);

  const db = await getDb();
  if (!db) {
    throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);
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

    if (user.name !== undefined) {
  const plainName =
    user.name === null
      ? null
      : String(user.name).trim();

  const encryptedName = plainName
    ? encryptPersonalData(plainName)
    : plainName;

  const nameHash = plainName
    ? createNameHash(plainName)
    : null;

  (values as any).name = encryptedName;
  (values as any).nameHash = nameHash;

  updateSet.name = encryptedName;
  updateSet.nameHash = nameHash;
}

if (user.email !== undefined) {
  const plainEmail =
    user.email === null
      ? null
      : String(user.email).trim().toLowerCase();

  const encryptedEmail = plainEmail
    ? encryptPersonalData(plainEmail)
    : plainEmail;

  const emailHash = plainEmail
    ? createEmailHash(plainEmail)
    : null;

  (values as any).email = encryptedEmail;
  (values as any).emailHash = emailHash;

  updateSet.email = encryptedEmail;
  updateSet.emailHash = emailHash;
}

if (user.phone !== undefined) {
  const plainPhone =
    user.phone === null
      ? null
      : String(user.phone).replace(/\D/g, "");

  const encryptedPhone = plainPhone
    ? encryptPersonalData(plainPhone)
    : plainPhone;

  const phoneHash = plainPhone
    ? createPhoneHash(plainPhone)
    : null;

  const phoneLast4 = plainPhone
    ? getPhoneLast4(plainPhone)
    : null;

  (values as any).phone = encryptedPhone;
  (values as any).phoneHash = phoneHash;
  (values as any).phoneLast4 = phoneLast4;

  updateSet.phone = encryptedPhone;
  updateSet.phoneHash = phoneHash;
  updateSet.phoneLast4 = phoneLast4;
}

if (user.loginMethod !== undefined) {
  const loginMethod = user.loginMethod ?? null;

  (values as any).loginMethod = loginMethod;
  updateSet.loginMethod = loginMethod;
}

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

  return result.length > 0
  ? decryptUserPersonalData(result[0])
  : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

 const rows = await db
  .select({
    id: users.id,
    displayNo: users.displayNo,
    name: users.name,
    role: users.role,
  })
  .from(users);

return rows.map((row) => ({
  ...row,
  name:
    row.name === null || row.name === undefined
      ? row.name
      : decryptPersonalData(row.name),
}));
}

export async function getAllUsersDetailed(params?: {
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = Number(params?.organizationId || 0);

  const conditions: any[] = [];

  if (organizationId > 0) {
    conditions.push(eq(users.organizationId, organizationId));
  }

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
    profileImageUrl: users.profileImageUrl,
    isActive: users.isActive,
    loginMethod: users.loginMethod,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    lastSignedIn: users.lastSignedIn,

    teamId: userOrgMappings.teamId,
    positionId: userOrgMappings.positionId,
    orgSortOrder: userOrgMappings.sortOrder,
    teamName: teams.name,
    positionName: positions.name,
  })
  .from(users)
  .leftJoin(
    userOrgMappings,
    and(
      eq(userOrgMappings.userId, users.id),
      eq(userOrgMappings.organizationId, users.organizationId)
    )
  )
  .leftJoin(
    teams,
    and(
      eq(teams.id, userOrgMappings.teamId),
      eq(teams.organizationId, users.organizationId)
    )
  )
  .leftJoin(
    positions,
    and(
      eq(positions.id, userOrgMappings.positionId),
      eq(positions.organizationId, users.organizationId)
    )
  );

if (conditions.length > 0) {
  query = query.where(and(...conditions)) as any;
}

const rows = await query.orderBy(
  users.displayNo,
  users.id
);

return rows.map((row: any) => ({
  ...row,

  name:
    row.name === null || row.name === undefined
      ? row.name
      : decryptPersonalData(row.name),

  email:
    row.email === null || row.email === undefined
      ? row.email
      : decryptPersonalData(row.email),

  phone:
    row.phone === null || row.phone === undefined
      ? row.phone
      : decryptPersonalData(row.phone),

  bankAccount:
    row.bankAccount === null ||
    row.bankAccount === undefined
      ? row.bankAccount
      : decryptPersonalData(row.bankAccount),
}));
}



export async function getUserPersonnelDetail(params: {
  organizationId?: number | null;
  userId: number;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);
  const userId = Number(params.userId);

  const [profileRows] = await db.execute(sql`
    SELECT
      u.id,
      u.displayNo,
      u.openId,
      u.username,
      u.name,
      u.email,
      u.phone,
      u.birthday,
      u.role,
      u.bankName,
      u.bankAccount,
      u.profileImageUrl,
      u.isActive,
      u.createdAt,
      t.name AS teamName,
      p.name AS positionName
    FROM users u
    LEFT JOIN user_org_mappings m
      ON m.userId = u.id
     AND m.organizationId = u.organizationId
    LEFT JOIN teams t
      ON t.id = m.teamId
     AND t.organizationId = u.organizationId
    LEFT JOIN positions p
      ON p.id = m.positionId
     AND p.organizationId = u.organizationId
    WHERE u.organizationId = ${organizationId}
      AND u.id = ${userId}
    LIMIT 1
  `);

  const profile = (profileRows as any[])?.[0] || null;
  if (!profile) return null;

const decryptedProfile = decryptUserPersonalData(profile);

  const [monthlyRows] = await db.execute(sql`
    SELECT
      DATE_FORMAT(occurredAt, '%Y-%m') AS month,
      COUNT(*) AS itemCount,
      SUM(COALESCE(grossAmount, 0)) AS grossAmount,
      SUM(COALESCE(companyAmount, 0)) AS companyAmount,
      SUM(COALESCE(companyProfit, 0)) AS companyProfit,
      SUM(COALESCE(freelancerAmount, 0)) AS freelancerAmount,
      SUM(COALESCE(taxAmount, 0)) AS taxAmount,
      SUM(COALESCE(finalPayoutAmount, 0)) AS finalPayoutAmount,
      SUM(
        CASE
          WHEN revenueType = 'refund' THEN COALESCE(grossAmount, 0)
          ELSE 0
        END
      ) AS refundAmount
    FROM settlement_items
    WHERE organizationId = ${organizationId}
      AND assigneeId = ${userId}
      AND settlementStatus = 'confirmed'
      AND occurredAt IS NOT NULL
    GROUP BY DATE_FORMAT(occurredAt, '%Y-%m')
    ORDER BY month DESC
    LIMIT 24
  `);

  const [totalRows] = await db.execute(sql`
    SELECT
      COUNT(*) AS itemCount,
      SUM(COALESCE(grossAmount, 0)) AS grossAmount,
      SUM(COALESCE(companyAmount, 0)) AS companyAmount,
      SUM(COALESCE(companyProfit, 0)) AS companyProfit,
      SUM(COALESCE(freelancerAmount, 0)) AS freelancerAmount,
      SUM(COALESCE(taxAmount, 0)) AS taxAmount,
      SUM(COALESCE(finalPayoutAmount, 0)) AS finalPayoutAmount,
      SUM(
        CASE
          WHEN revenueType = 'refund' THEN COALESCE(grossAmount, 0)
          ELSE 0
        END
      ) AS refundAmount
    FROM settlement_items
    WHERE organizationId = ${organizationId}
      AND assigneeId = ${userId}
      AND settlementStatus = 'confirmed'
  `);

  return {
  profile: decryptedProfile,
  monthlyRevenue: monthlyRows as any[],
  totalRevenue: (totalRows as any[])?.[0] || null,
};
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

// ==============================
// SMS OPT OUTS
// ==============================

export async function createOrReactivateSmsOptOut(params: {
  organizationId?: number | null;
  phone: string;
  reason?: string | null;
  source?: "manual" | "provider" | "import";
  optedOutBy?: number | null;
}) {
  const db = await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params.organizationId);
  const normalizedPhone = normalizeSmsPhone(params.phone);

  if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "올바른 전화번호를 입력해주세요.",
      400
    );
  }

  const phoneHash = createSmsPhoneHash(normalizedPhone);
  const phoneLast4 = getSmsPhoneLast4(normalizedPhone);
  const now = new Date();

  const existingRows = await db
    .select()
    .from(smsOptOuts)
    .where(
      and(
        eq(smsOptOuts.organizationId, organizationId),
        eq(smsOptOuts.phoneHash, phoneHash)
      )
    )
    .limit(1);

  const existing = existingRows[0];

  if (existing) {
    await db
      .update(smsOptOuts)
      .set({
        phoneLast4,
        reason: params.reason?.trim() || "회원 요청",
        source: params.source || "manual",
        isActive: true,
        optedOutAt: now,
        optedOutBy: params.optedOutBy ?? null,
        releasedAt: null,
        releasedBy: null,
      } as any)
      .where(
        and(
          eq(smsOptOuts.id, existing.id),
          eq(smsOptOuts.organizationId, organizationId)
        )
      );

    const updatedRows = await db
      .select()
      .from(smsOptOuts)
      .where(
        and(
          eq(smsOptOuts.id, existing.id),
          eq(smsOptOuts.organizationId, organizationId)
        )
      )
      .limit(1);

    return updatedRows[0] || null;
  }

  const result: any = await db.insert(smsOptOuts).values({
    organizationId,
    phoneHash,
    phoneLast4,
    reason: params.reason?.trim() || "회원 요청",
    source: params.source || "manual",
    isActive: true,
    optedOutAt: now,
    optedOutBy: params.optedOutBy ?? null,
    releasedAt: null,
    releasedBy: null,
  } as InsertSmsOptOut);

  const insertedId = Number(getInsertId(result) || 0);

  if (!insertedId) {
    return null;
  }

  const createdRows = await db
    .select()
    .from(smsOptOuts)
    .where(
      and(
        eq(smsOptOuts.id, insertedId),
        eq(smsOptOuts.organizationId, organizationId)
      )
    )
    .limit(1);

  return createdRows[0] || null;
}

export async function releaseSmsOptOut(params: {
  organizationId?: number | null;
  id: number;
  releasedBy?: number | null;
}) {
  const db = await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params.organizationId);
  const id = Number(params.id || 0);

  if (!id) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수신거부 항목 ID가 필요합니다.",
      400
    );
  }

  const existingRows = await db
    .select()
    .from(smsOptOuts)
    .where(
      and(
        eq(smsOptOuts.id, id),
        eq(smsOptOuts.organizationId, organizationId)
      )
    )
    .limit(1);

  const existing = existingRows[0];

  if (!existing) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "수신거부 내역을 찾을 수 없습니다.",
      404
    );
  }

  await db
    .update(smsOptOuts)
    .set({
      isActive: false,
      releasedAt: new Date(),
      releasedBy: params.releasedBy ?? null,
    } as any)
    .where(
      and(
        eq(smsOptOuts.id, id),
        eq(smsOptOuts.organizationId, organizationId)
      )
    );

  return {
    success: true,
    id,
  };
}

export async function listSmsOptOuts(params: {
  organizationId?: number | null;
  activeOnly?: boolean;
  keyword?: string | null;
  limit?: number | null;
}) {
  const db = await getDb();

  if (!db) {
    return [];
  }

  const organizationId = requireOrganizationId(params.organizationId);
  const limit = Math.min(
    Math.max(Number(params.limit || 200), 1),
    500
  );

  const conditions: any[] = [
    eq(smsOptOuts.organizationId, organizationId),
  ];

  if (params.activeOnly !== false) {
    conditions.push(eq(smsOptOuts.isActive, true));
  }

  const keyword = String(params.keyword || "")
    .replace(/\D/g, "")
    .trim();

  if (keyword) {
    conditions.push(
      like(smsOptOuts.phoneLast4, `%${keyword.slice(-4)}%`)
    );
  }

  return db
    .select()
    .from(smsOptOuts)
    .where(and(...conditions))
    .orderBy(
      desc(smsOptOuts.isActive),
      desc(smsOptOuts.optedOutAt),
      desc(smsOptOuts.id)
    )
    .limit(limit);
}

export async function getActiveSmsOptOutHashSet(params: {
  organizationId?: number | null;
}) {
  const db = await getDb();

  if (!db) {
    return new Set<string>();
  }

  const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select({
      phoneHash: smsOptOuts.phoneHash,
    })
    .from(smsOptOuts)
    .where(
      and(
        eq(smsOptOuts.organizationId, organizationId),
        eq(smsOptOuts.isActive, true)
      )
    );

  return new Set(
    rows
      .map((row: any) => String(row.phoneHash || "").trim())
      .filter(Boolean)
  );
}

export async function isSmsPhoneOptedOut(params: {
  organizationId?: number | null;
  phone: string;
}) {
  const db = await getDb();

  if (!db) {
    return false;
  }

  const organizationId = requireOrganizationId(params.organizationId);
  const normalizedPhone = normalizeSmsPhone(params.phone);

  if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
    return false;
  }

  const phoneHash = createSmsPhoneHash(normalizedPhone);

  const rows = await db
    .select({
      id: smsOptOuts.id,
    })
    .from(smsOptOuts)
    .where(
      and(
        eq(smsOptOuts.organizationId, organizationId),
        eq(smsOptOuts.phoneHash, phoneHash),
        eq(smsOptOuts.isActive, true)
      )
    )
    .limit(1);

  return Boolean(rows[0]);
}

export async function splitSmsPhonesByOptOut(params: {
  organizationId?: number | null;
  phones: string[];
}) {
  const organizationId = requireOrganizationId(params.organizationId);

  const normalizedPhones = Array.from(
    new Set(
      (params.phones || [])
        .map((phone) => normalizeSmsPhone(phone))
        .filter(
          (phone) =>
            phone.length >= 10 &&
            phone.length <= 11
        )
    )
  );

  const optedOutHashSet = await getActiveSmsOptOutHashSet({
    organizationId,
  });

  const sendable: string[] = [];
  const optedOut: string[] = [];

  for (const phone of normalizedPhones) {
    const phoneHash = createSmsPhoneHash(phone);

    if (optedOutHashSet.has(phoneHash)) {
      optedOut.push(phone);
    } else {
      sendable.push(phone);
    }
  }

  return {
    requested: normalizedPhones,
    sendable,
    optedOut,
  };
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);
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
birthday?: string | null;
role: "staff" | "admin" | "host" | "superhost";
organizationId?: number;
  bankName?: string | null;
  bankAccount?: string | null;
  loginMethod?: string | null;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const normalizedUsername = data.username.trim();

  const existingUser = await getUserByUsername(normalizedUsername);

  if (existingUser) {
    throwAppError(
      ERROR_CODES.DUPLICATE_RESOURCE,
      "이미 사용 중인 로그인 아이디입니다.",
      409
    );
  }

  const displayNo = await getNextUserDisplayNo();
const plainName = String(data.name || "").trim();

const plainEmail =
  data.email === null || data.email === undefined
    ? null
    : String(data.email).trim().toLowerCase() || null;

const plainPhone =
  data.phone === null || data.phone === undefined
    ? null
    : String(data.phone).replace(/\D/g, "") || null;

const plainBankAccount =
  data.bankAccount === null || data.bankAccount === undefined
    ? null
    : String(data.bankAccount).replace(/\D/g, "") || null;

  const result = await db.insert(users).values({
    displayNo,
    openId: normalizedUsername,
username: normalizedUsername,
    passwordHash: data.passwordHash ?? null,
    name: plainName
  ? encryptPersonalData(plainName)
  : null,

nameHash: plainName
  ? createNameHash(plainName)
  : null,

email: plainEmail
  ? encryptPersonalData(plainEmail)
  : null,

emailHash: plainEmail
  ? createEmailHash(plainEmail)
  : null,

phone: plainPhone
  ? encryptPersonalData(plainPhone)
  : null,

phoneHash: plainPhone
  ? createPhoneHash(plainPhone)
  : null,

phoneLast4: plainPhone
  ? getPhoneLast4(plainPhone)
  : null,
birthday: data.birthday ?? null,
role: data.role,
organizationId: data.organizationId ?? 1,
    bankName: data.bankName ?? null,
    bankAccount: plainBankAccount
  ? encryptPersonalData(plainBankAccount)
  : null,

bankAccountHash: plainBankAccount
  ? createBankAccountHash(plainBankAccount)
  : null,

bankAccountLast4: plainBankAccount
  ? getBankAccountLast4(plainBankAccount)
  : null,
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

  return rows[0]
  ? decryptUserPersonalData(rows[0])
  : null;
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params?.organizationId);

  if (!data || Object.keys(data).length === 0) return;

const nextData: Record<string, any> = {
  ...data,
};

if (data.name !== undefined) {
  const plainName =
    data.name === null
      ? null
      : String(data.name).trim() || null;

  nextData.name = plainName
    ? encryptPersonalData(plainName)
    : null;

  nextData.nameHash = plainName
    ? createNameHash(plainName)
    : null;
}

if (data.email !== undefined) {
  const plainEmail =
    data.email === null
      ? null
      : String(data.email).trim().toLowerCase() || null;

  nextData.email = plainEmail
    ? encryptPersonalData(plainEmail)
    : null;

  nextData.emailHash = plainEmail
    ? createEmailHash(plainEmail)
    : null;
}

if (data.phone !== undefined) {
  const plainPhone =
    data.phone === null
      ? null
      : String(data.phone).replace(/\D/g, "") || null;

  nextData.phone = plainPhone
    ? encryptPersonalData(plainPhone)
    : null;

  nextData.phoneHash = plainPhone
    ? createPhoneHash(plainPhone)
    : null;

  nextData.phoneLast4 = plainPhone
    ? getPhoneLast4(plainPhone)
    : null;
}

if (data.bankAccount !== undefined) {
  const plainBankAccount =
    data.bankAccount === null
      ? null
      : String(data.bankAccount).replace(/\D/g, "") || null;

  nextData.bankAccount = plainBankAccount
    ? encryptPersonalData(plainBankAccount)
    : null;

  nextData.bankAccountHash = plainBankAccount
    ? createBankAccountHash(plainBankAccount)
    : null;

  nextData.bankAccountLast4 = plainBankAccount
    ? getBankAccountLast4(plainBankAccount)
    : null;
}

  await db
    .update(users)
    .set(nextData as any)
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params?.organizationId);

  // SaaS 기준: superhost도 전체 유저를 보지 않음.
  // 같은 조직 안에서만 superhost 중복 방지.
  if (role === "superhost") {
    const existing = await getAllUsersDetailed({ organizationId });
    const current = existing.find((u: any) => Number(u.id) === Number(id));

    if (!current) {
      throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "유저 없음",
  404
);
    }

    const count = existing.filter((u: any) => u.role === "superhost").length;

    if (current.role !== "superhost" && count >= 1) {
      throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  "해당 조직의 슈퍼호스트는 1명만 가능합니다.",
  409
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    assigneeIds?: number[];
  }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  const baseQuery = db
    .select()
    .from(consultations);

if (params?.assigneeIds?.length) {
  const rows = await baseQuery
    .where(
      and(
        eq(consultations.organizationId, organizationId),
        inArray(consultations.assigneeId, params.assigneeIds),
        sql`${consultations.deletedAt} IS NULL`
      )
    )
    .orderBy(desc(consultations.createdAt));

  return rows.map((row) =>
    decryptConsultationPersonalData(row)
  );
}

 if (assigneeId) {
  const rows = await baseQuery
    .where(
      and(
        eq(consultations.organizationId, organizationId),
        eq(consultations.assigneeId, assigneeId),
        sql`${consultations.deletedAt} IS NULL`
      )
    )
    .orderBy(desc(consultations.createdAt));

  return rows.map((row) =>
    decryptConsultationPersonalData(row)
  );
}

const rows = await baseQuery
  .where(
    and(
      eq(consultations.organizationId, organizationId),
      sql`${consultations.deletedAt} IS NULL`
    )
  )
  .orderBy(desc(consultations.createdAt));

return rows.map((row) =>
  decryptConsultationPersonalData(row)
);
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

  return result[0]
  ? decryptConsultationPersonalData(result[0])
  : undefined;
}

export async function createConsultation(data: InsertConsultation) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const preparedData = prepareConsultationPersonalData(data);

const result: any = await db
  .insert(consultations)
  .values(preparedData as any);
  const insertId = getInsertId(result);
  return insertId;
}

export async function bulkCreateConsultations(dataList: InsertConsultation[]) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);
  if (dataList.length === 0) return [];

  const preparedDataList = dataList.map((data) =>
  prepareConsultationPersonalData(data)
);

const result = await db
  .insert(consultations)
  .values(preparedDataList as any);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params?.organizationId);

  if (!data || Object.keys(data).length === 0) {
  return;
}

const preparedData = prepareConsultationPersonalData(data);

await db
  .update(consultations)
  .set(preparedData as any)
    .where(
      and(
        eq(consultations.id, id),
        eq(consultations.organizationId, organizationId)
      )
    );
}

export async function deleteConsultation(
  id: number,
  params?: {
    organizationId?: number | null;
    deletedBy?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

  const rows = await db
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

return rows.map((row) =>
  decryptConsultationPersonalData(row)
);
}

export async function restoreConsultation(params: {
  id: number;
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params?.organizationId);

  const consultation = await getConsultation(consultationId, {
    organizationId,
  });

  if (!consultation) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "상담 기록을 찾을 수 없습니다.",
  404
);
  }

  const linkedStudent = await getStudentByConsultationId(consultationId, {
    organizationId,
  });

  if (!linkedStudent) {
    return null;
  }

 const nextStudentData: any = {
  clientName: consultation.clientName ?? "",
  phone: consultation.phone ?? "",
  finalEducation: consultation.finalEducation ?? "",
  course: consultation.desiredCourse ?? "",
  assigneeId: consultation.assigneeId ?? linkedStudent.assigneeId,
};

const preparedStudentData =
  prepareStudentPersonalData(nextStudentData);

await db
  .update(students)
  .set(preparedStudentData as any)
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  assigneeId?: number | number[],
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

const normalizedAssigneeIds = Array.isArray(assigneeId)
  ? assigneeId
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
  : assigneeId
    ? [Number(assigneeId)]
    : [];

let assigneeFilter;

if (normalizedAssigneeIds.length > 0) {
  const assigneeIdSql = sql.join(
    normalizedAssigneeIds.map((id) => sql`${id}`),
    sql`, `
  );

  assigneeFilter = sql`
    WHERE s.organizationId = ${organizationId}
      AND s.assigneeId IN (${assigneeIdSql})
      AND s.deletedAt IS NULL
  `;
} else {
  assigneeFilter = sql`
    WHERE s.organizationId = ${organizationId}
      AND s.deletedAt IS NULL
  `;
}

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

return (rows as any[]).map((row: any) => {
  const decryptedRow =
    decryptStudentPersonalData(row) as any;

  return {
    ...decryptedRow,

    startDate:
      decryptedRow.firstActualStartDate ||
      decryptedRow.startDate ||
      null,

    institutionId:
      decryptedRow.firstActualInstitutionId ||
      decryptedRow.institutionId ||
      null,

    institution:
      decryptedRow.firstActualInstitutionName ||
      decryptedRow.institution ||
      "",

    paymentDate:
      decryptedRow.firstActualPaymentDate ||
      decryptedRow.paymentDate ||
      null,
  };
});
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

  return result[0]
  ? decryptStudentPersonalData(result[0])
  : undefined;
}

export async function createStudent(data: InsertStudent) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(
  (data as any).organizationId
);

const preparedData =
  prepareStudentPersonalData(data);

const result = await db
  .insert(students)
  .values({
    ...preparedData,
    organizationId,
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params?.organizationId);

  const preparedData =
  prepareStudentPersonalData(data);

await db
  .update(students)
  .set(preparedData as any)
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const preparedAddressData =
  prepareStudentPersonalData({
    address: params.address ?? null,
    detailAddress: params.detailAddress ?? null,
  });

await db
  .update(students)
  .set({
    ...preparedAddressData,

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

  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  assigneeId?: number | number[],
  plannedMonthFilter?: string,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  const conditions: any[] = [
    sql`sem.organizationId = ${organizationId}`,
    sql`s.organizationId = ${organizationId}`,
  ];

  const normalizedAssigneeIds = Array.isArray(assigneeId)
  ? assigneeId
      .map((id) => Number(id))
      .filter(
        (id) =>
          Number.isFinite(id) &&
          id > 0
      )
  : assigneeId
    ? [Number(assigneeId)]
    : [];

if (normalizedAssigneeIds.length > 0) {
  const assigneeIdSql = sql.join(
    normalizedAssigneeIds.map(
      (id) => sql`${id}`
    ),
    sql`, `
  );

  conditions.push(
    sql`s.assigneeId IN (${assigneeIdSql})`
  );
}

  if (plannedMonthFilter) {
    conditions.push(sql`sem.plannedMonth = ${plannedMonthFilter}`);
  }

  const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

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
         WHERE r.organizationId = ${organizationId}
           AND r.studentId = s.id
           AND r.approvalStatus = '승인'),
        0
      ) as approvedRefundAmount,

      (SELECT p.hasPractice
       FROM plans p
       WHERE p.organizationId = ${organizationId}
         AND p.studentId = s.id
       LIMIT 1) as hasPractice,

      (SELECT p.practiceHours
       FROM plans p
       WHERE p.organizationId = ${organizationId}
         AND p.studentId = s.id
       LIMIT 1) as practiceHours,

      sem.practiceStatus as practiceStatus
    FROM semesters sem
    INNER JOIN students s
      ON sem.studentId = s.id
      AND s.organizationId = ${organizationId}
    LEFT JOIN users u
      ON u.id = s.assigneeId
      AND u.organizationId = ${organizationId}
    LEFT JOIN education_institutions actualEi
      ON actualEi.id = sem.actualInstitutionId
      AND actualEi.organizationId = ${organizationId}
    LEFT JOIN education_institutions plannedEi
      ON plannedEi.id = sem.plannedInstitutionId
      AND plannedEi.organizationId = ${organizationId}
    ${whereClause}
    ORDER BY sem.plannedMonth ASC, s.id ASC
  `);

  return ((rows as unknown) as any[]).map((row: any) => {
  const decryptedRow =
    decryptStudentJoinedRow(row);

  return {
    ...decryptedRow,

    institution:
      decryptedRow.institutionDisplayName ||
      decryptedRow.actualInstitutionDisplayName ||
      decryptedRow.plannedInstitutionDisplayName ||
      decryptedRow.actualInstitution ||
      decryptedRow.plannedInstitution ||
      "-",
  };
});
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
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "플랜 과목 수는 0 이상의 숫자만 저장할 수 있습니다.",
  400
);
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
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  `총 이론 과목 수(${totalTheorySubjects})와 분류 합계(${sum})가 일치하지 않습니다.`,
  400
);
  }
}

// ─── Plans ───────────────────────────────────────────────────────────
export async function getPlan(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();

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

  return result[0] ?? null;
}

export async function upsertPlan(data: InsertPlan) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);
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
  assigneeIds?: number[];
}) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

const assigneeIds = (params?.assigneeIds || [])
  .map((id) => Number(id))
  .filter(
    (id) =>
      Number.isFinite(id) &&
      id > 0
  );

const assigneeFilter =
  assigneeIds.length > 0
    ? sql`
        AND s.assigneeId IN (
          ${sql.join(
            assigneeIds.map(
              (id) => sql`${id}`
            ),
            sql`, `
          )}
        )
      `
    : sql``;

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
  ${assigneeFilter}
    ORDER BY r.createdAt DESC
  `);

  return ((rows as unknown) as any[]).map(
  (row: any) => decryptStudentJoinedRow(row)
);
}

export async function createRefund(data: InsertRefund) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const result = await db.insert(refunds).values(data);
  return getInsertId(result);
}

export async function updateRefund(
  id: number,
  data: Partial<InsertRefund>,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(refunds)
    .set({
      approvalStatus: "승인",
      approvedAt: new Date(),
      rejectedAt: null,
      approvedBy,
rejectionReason: null,
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
  params?: {
  organizationId?: number | null;
  rejectionReason?: string | null;
}
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(refunds)
    .set({
      approvalStatus: "불승인",
      approvedAt: null,
      rejectedAt: new Date(),
      approvedBy,
rejectionReason: String(params?.rejectionReason || "").trim() || null,
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  await db.insert(settlementItemLogs).values({
    settlementItemId: params.settlementItemId,
    actionType: params.actionType,
    actorUserId: params.actorUserId ?? null,
    note: params.note ?? null,
    payload: params.payload ?? null,
  } as any);
}

export async function upsertSettlementItem(params: {
organizationId?: number | null;
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

  const db = await getDb();

const organizationId = requireOrganizationId(params.organizationId);

  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

  if (exists[0]) {
    const item = exists[0];

    await db
      .update(settlementItems)
      .set({
	organizationId,
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
     .where(
  and(
    eq(settlementItems.id, item.id),
    eq(settlementItems.organizationId, organizationId)
  )
);

    await createSettlementItemLog({
      settlementItemId: Number(item.id),
      actionType: "recalculate",
      actorUserId: params.actorUserId ?? null,
      note: params.logNote ?? "정산 항목 재계산",
      payload: params.payload ? JSON.stringify(params.payload) : null,
    });

    return { id: Number(item.id), mode: "update" as const };
  }

  const result: any = await db.insert(settlementItems).values({
organizationId,
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  organizationId?: number | null;
  revenueType: "subject" | "practice_support" | "private_certificate" | "refund";
  sourceId: number;
  refundAmount?: number | string | null;
  refundDate?: string | Date | null;
  actorUserId?: number | null;
  note?: string | null;
  payload?: any;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

  const exists = await db
    .select()
    .from(settlementItems)
    .where(
  and(
    eq(settlementItems.organizationId, organizationId),
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

const baseGrossAmount = toNumber(baseItem.grossAmount);
  const requestedRefundAmount = toNumber(params.refundAmount ?? 0);
 const refundAmount = Math.max(
  0,
  Math.min(requestedRefundAmount || baseGrossAmount, baseGrossAmount)
);


if (refundAmount <= 0) {
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

  const refundTitle =
    params.revenueType === "subject"
      ? `${baseItem.title || "일반과목"} 환불`
      : params.revenueType === "practice_support"
      ? `${baseItem.title || "실습배정"} 환불`
      : `${baseItem.title || "민간자격증"} 환불`;

 const refundSettlement = await upsertSettlementItem({
  organizationId,
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "민간자격증 요청 데이터를 찾을 수 없습니다.",
  404
);
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

const occurredAt = (request as any).paidAt ?? (request as any).updatedAt ?? new Date();

await assertSettlementMonthEditable({
  organizationId,
  date: occurredAt,
});

// 정산 원장의 우리회사 몫은 실수령 기준
const companyAmount = netCompanyShareAmount;

// 회사 순이익 = 우리회사 몫 실수령 - 프리랜서 지급액
// 예: 36,746 - 20,000 = 16,746
const companyProfit = Math.max(0, netCompanyShareAmount - freelancerAmount);

return await upsertSettlementItem({
  organizationId,
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
        occurredAt,
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

async function resolvePracticeEducationCenterPartnerPrice(params: {
  organizationId?: number | null;
  selectedEducationCenterId?: number | null;
}) {
  const db = await getDb();
  if (!db) return 0;

  const organizationId = requireOrganizationId(params.organizationId);
  const selectedEducationCenterId = Number(params.selectedEducationCenterId || 0);

  if (!selectedEducationCenterId) return 0;

  if (selectedEducationCenterId < 0) {
    const masterId = Math.abs(selectedEducationCenterId);

    const rows = await db
      .select({
        master: practiceEducationCenterMasters,
        override: organizationPracticeEducationCenterOverrides,
      })
      .from(practiceEducationCenterMasters)
      .leftJoin(
        organizationPracticeEducationCenterOverrides,
        and(
          eq(
            organizationPracticeEducationCenterOverrides.masterId,
            practiceEducationCenterMasters.id
          ),
          eq(
            organizationPracticeEducationCenterOverrides.organizationId,
            organizationId
          )
        )
      )
      .where(eq(practiceEducationCenterMasters.id, masterId))
      .limit(1);

    const row: any = rows[0];
    if (!row) return 0;

    const isPartner = row.override?.isPartner ?? row.master?.isPartner ?? false;
    if (!isPartner) return 0;

    return toNumber(row.override?.partnerPrice ?? row.master?.partnerPrice ?? 0);
  }

  const rows = await db
    .select()
    .from(practiceEducationCenters)
    .where(
      and(
        eq(practiceEducationCenters.id, selectedEducationCenterId),
        eq(practiceEducationCenters.organizationId, organizationId)
      )
    )
    .limit(1);

  const row: any = rows[0];
  if (!row?.isPartner) return 0;

  return toNumber(row.partnerPrice ?? 0);
}

export async function syncPracticeSupportSettlementItemByRequestId(
  requestId: number,
  actorUserId?: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
const partnerPrice = await resolvePracticeEducationCenterPartnerPrice({
  organizationId,
  selectedEducationCenterId: (request as any).selectedEducationCenterId,
});
const settlementGrossAmount = feeAmount + partnerPrice;
const occurredAt = (request as any).paidAt ?? (request as any).updatedAt ?? new Date();

  await assertSettlementMonthEditable({
    organizationId,
    date: occurredAt,
  });

  return await upsertSettlementItem({
  organizationId,
  revenueType: "practice_support",
    sourceId: Number(request.id),
    studentId: Number(request.studentId),
    assigneeId: Number((request as any).assigneeId ?? 0) || null,
    title: "실습배정지원 결제",
    quantity: 1,
   grossAmount: settlementGrossAmount,
companyAmount: settlementGrossAmount,
    freelancerAmount: 0,
    settlementStatus: "confirmed",
        occurredAt,
    note: "실습배정지원 결제 완료로 자동 생성",
    actorUserId: actorUserId ?? null,
    logNote: "실습배정지원 결제 완료 반영",
   payload: {
  requestId: request.id,
  paymentStatus: request.paymentStatus,
  feeAmount,
  partnerPrice,
  settlementGrossAmount,
  selectedEducationCenterId: (request as any).selectedEducationCenterId ?? null,
  selectedEducationCenterName: (request as any).selectedEducationCenterName ?? null,
},
  });
}

export async function backfillSettlementItems(
  actorUserId?: number,
  params?: {
    organizationId?: number | null;
    year?: number | null;
    month?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

const organizationId = requireOrganizationId(params?.organizationId);

const targetYear = Number(params?.year || 0);
const targetMonth = Number(params?.month || 0);

if (!targetYear || !targetMonth) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "정산 원장 재생성 대상 년월이 필요합니다.",
    400
  );
}

const monthStart = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1;
const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear;
const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const [lockedRows] = await db.execute(sql`
  SELECT settlementYear, settlementMonth
  FROM settlement_month_locks
  WHERE organizationId = ${organizationId}
    AND settlementYear = ${targetYear}
    AND settlementMonth = ${targetMonth}
    AND isLocked = 1
  LIMIT 1
`);

  if (Array.isArray(lockedRows) && lockedRows.length > 0) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
     `${targetYear}년 ${targetMonth}월 확정 정산이 있어 정산 원장을 재생성할 수 없습니다. 확정 해제 후 진행해주세요.`,
      400
    );
  }

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
  .where(
    and(
      eq(semesters.organizationId, organizationId),
      sql`COALESCE(${semesters.actualPaymentDate}, ${semesters.actualStartDate}) >= ${monthStart}`,
      sql`COALESCE(${semesters.actualPaymentDate}, ${semesters.actualStartDate}) < ${monthEnd}`
    )
  )
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
  .where(
    and(
      eq(privateCertificateRequests.organizationId, organizationId),
      sql`COALESCE(${privateCertificateRequests.paidAt}, ${privateCertificateRequests.updatedAt}) >= ${monthStart}`,
      sql`COALESCE(${privateCertificateRequests.paidAt}, ${privateCertificateRequests.updatedAt}) < ${monthEnd}`
    )
  )
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
  .where(
    and(
      eq(practiceSupportRequests.organizationId, organizationId),
      sql`COALESCE(${practiceSupportRequests.paidAt}, ${practiceSupportRequests.updatedAt}) >= ${monthStart}`,
      sql`COALESCE(${practiceSupportRequests.paidAt}, ${practiceSupportRequests.updatedAt}) < ${monthEnd}`
    )
  )
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

  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const sem = await getSemester(semesterId, { organizationId });
  if (!sem) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학기 데이터를 찾을 수 없습니다.",
  404
);
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

  throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  `[학생조회실패] semesterId=${sem.id}, studentId=${studentId}, directCount=${dbStudent.length}`,
  404
);
}

    const grossAmount = toNumber((sem as any).actualAmount ?? 0);
  const displaySubjectCount = Number((sem as any).actualSubjectCount ?? 0);
  const educationInstitutionId = Number((sem as any).actualInstitutionId ?? 0) || null;
  const occurredAt = (sem as any).actualPaymentDate ?? (sem as any).actualStartDate ?? null;

  await assertSettlementMonthEditable({
    organizationId,
    date: occurredAt,
  });

  const planRows = await listPlanSemesters(studentId, {
    organizationId,
  });

  const semesterPlanRows = (planRows || []).filter(
    (row: any) => Number(row.semesterNo) === Number((sem as any).semesterOrder)
  );

  const settlementIncludedSubjectCount = semesterPlanRows.filter(
    (row: any) => row.settlementIncluded !== false
  ).length;

  const subjectCount =
  semesterPlanRows.length > 0
    ? settlementIncludedSubjectCount
    : displaySubjectCount;

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
      note: `학기 실제 결제정보 미완성 또는 정산포함 과목 없음으로 과목 정산 취소 (grossAmount=${grossAmount}, displaySubjectCount=${displaySubjectCount}, settlementSubjectCount=${subjectCount}, educationInstitutionId=${educationInstitutionId}, occurredAt=${occurredAt})`,
    });
    return null;
  }

  const institution = await getEducationInstitutionById(educationInstitutionId, {
  organizationId,
});
  if (!institution) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "교육원 정보를 찾을 수 없습니다.",
  404
);
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

const actualCredits = subjectCount * 3;

const subjectPriceRules = await listActiveSettlementSubjectPriceRulesForCalc({
  organizationId,
  educationInstitutionId,
});

const institutionPriceRules =
  await listActiveSettlementInstitutionPriceRulesForCalc({
    organizationId,
    educationInstitutionId,
  });

const subjectPriceCombination =
  resolveSettlementSubjectPriceCombination({
    grossAmount,
    subjectCount,
    rules: subjectPriceRules,
  });

const actualUnitPrice =
  subjectCount > 0 ? Math.floor(grossAmount / subjectCount) : 0;

if (!subjectPriceCombination || subjectPriceCombination.length === 0) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    [
      "등록된 과목단가 조합으로 정산금액을 계산할 수 없습니다.",
      `총 결제금액: ${grossAmount.toLocaleString()}원`,
      `정산 과목 수: ${subjectCount}과목`,
      "정산 시스템 관리에서 과목단가 규칙을 확인해주세요.",
    ].join(" "),
    400
  );
}

const settlementCredits = subjectPriceCombination.reduce(
  (sum: number, row: any) =>
    sum + Number(row.count || 0) * Number(row.creditValue || 0),
  0
);

// 교육원 몫
// 1순위: 교육원 + 기준금액별 교육원 정산금액
// 2순위: 교육원 기본 정산금액
// 3순위: 0원
const institutionCostResult = resolveInstitutionCostFromSubjectCombination({
  subjectPriceCombination,
  subjectCount,
  fallbackUnitCost: institutionUnitCost,
  rules: institutionPriceRules,
});

const institutionCost = institutionCostResult.institutionCost;

// 교육원 차감 후 우리회사 몫
const companyAmount = Math.max(0, grossAmount - institutionCost);

// 프리랜서 기본 계산값
// 현재는 정산기준 학점(settlementCredits) × 직급 단가(positionUnitAmount)로 계산

const rawFreelancerAmount = settlementCredits * positionUnitAmount;

// ❗ 0학점이면 지급 0
const freelancerAmount =
  settlementCredits <= 0
    ? 0
    : Math.max(0, Math.min(companyAmount, rawFreelancerAmount));

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
  displaySubjectCount,
  settlementSubjectCount: subjectCount,
  settlementIncludedSubjectCount,
  excludedSettlementSubjectCount: Math.max(
    0,
    displaySubjectCount - subjectCount
  ),
  subjectCount,
  actualUnitPrice,
  normalSubjectPrice,
  actualCredits,
  settlementCredits,
subjectPriceCombination,
institutionPriceRules: institutionCostResult.appliedRules,
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
monthNewSales: 0,
monthExistingSales: 0,

monthNewRefund: 0,
monthExistingRefund: 0,

monthNewStudentCount: 0,
monthExistingStudentCount: 0,
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
      WHEN si.revenueType = 'refund'
       AND si.settlementStatus = 'confirmed'
       AND si.occurredAt >= ${monthStart}
       AND si.occurredAt < ${monthEnd}
      THEN ABS(COALESCE(si.grossAmount, 0))
      ELSE 0
    END
  ),
  0
) as monthRefund,

      COALESCE(
  SUM(
    CASE
      WHEN si.revenueType = 'refund'
       AND si.settlementStatus = 'confirmed'
      THEN ABS(COALESCE(si.grossAmount, 0))
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

const [customerTypeRows] = await db.execute(sql`
  SELECT
    COALESCE(
      SUM(
        CASE
          WHEN COALESCE(sem.semesterOrder, 0) = 1
           AND si.settlementStatus = 'confirmed'
           AND si.occurredAt >= ${monthStart}
           AND si.occurredAt < ${monthEnd}
          THEN COALESCE(si.grossAmount, 0)
          ELSE 0
        END
      ),
      0
    ) AS monthNewSales,

    COALESCE(
      SUM(
        CASE
          WHEN (
            COALESCE(sem.semesterOrder, 0) >= 2
            OR sem.semesterOrder IS NULL
          )
           AND si.settlementStatus = 'confirmed'
           AND si.occurredAt >= ${monthStart}
           AND si.occurredAt < ${monthEnd}
          THEN COALESCE(si.grossAmount, 0)
          ELSE 0
        END
      ),
      0
    ) AS monthExistingSales,

    COALESCE(
      SUM(
        CASE
          WHEN si.revenueType = 'refund'
           AND COALESCE(sem.semesterOrder, 0) = 1
           AND si.settlementStatus = 'confirmed'
           AND si.occurredAt >= ${monthStart}
           AND si.occurredAt < ${monthEnd}
          THEN ABS(COALESCE(si.grossAmount, 0))
          ELSE 0
        END
      ),
      0
    ) AS monthNewRefund,

    COALESCE(
      SUM(
        CASE
          WHEN si.revenueType = 'refund'
           AND (
             COALESCE(sem.semesterOrder, 0) >= 2
             OR sem.semesterOrder IS NULL
           )
           AND si.settlementStatus = 'confirmed'
           AND si.occurredAt >= ${monthStart}
           AND si.occurredAt < ${monthEnd}
          THEN ABS(COALESCE(si.grossAmount, 0))
          ELSE 0
        END
      ),
      0
    ) AS monthExistingRefund,

    COUNT(
      DISTINCT CASE
        WHEN COALESCE(sem.semesterOrder, 0) = 1
         AND si.revenueType != 'refund'
         AND si.settlementStatus = 'confirmed'
         AND si.occurredAt >= ${monthStart}
         AND si.occurredAt < ${monthEnd}
        THEN si.studentId
        ELSE NULL
      END
    ) AS monthNewStudentCount,

    COUNT(
      DISTINCT CASE
        WHEN (
          COALESCE(sem.semesterOrder, 0) >= 2
          OR sem.semesterOrder IS NULL
        )
         AND si.revenueType != 'refund'
         AND si.settlementStatus = 'confirmed'
         AND si.occurredAt >= ${monthStart}
         AND si.occurredAt < ${monthEnd}
        THEN si.studentId
        ELSE NULL
      END
    ) AS monthExistingStudentCount

  FROM settlement_items si

  LEFT JOIN refunds rf
    ON si.revenueType = 'refund'
   AND rf.id = si.sourceId
   AND rf.organizationId = ${organizationId}

  LEFT JOIN semesters sem
    ON sem.organizationId = ${organizationId}
   AND (
     (
       si.revenueType = 'subject'
       AND sem.id = si.sourceId
     )
     OR
     (
       si.revenueType = 'refund'
       AND sem.id = rf.semesterId
     )
   )

  WHERE si.organizationId = ${organizationId}
    ${assigneeSettlementCond}
`);

  const consult = (consultRows as any)?.[0] ?? {};
  const student = (studentRows as any)?.[0] ?? {};
  const settlement = (settlementRows as any)?.[0] ?? {};
const customerType =
  (customerTypeRows as any)?.[0] ?? {};

  return {
    monthConsultationCount: toNumber(consult.monthConsultationCount),
    monthRegistered: toNumber(student.monthRegistered),

    todaySales: toNumber(settlement.todaySales),
    monthSales: toNumber(settlement.monthSales),
    totalSales: toNumber(settlement.totalSales),

monthNewSales:
  toNumber(customerType.monthNewSales),

monthExistingSales:
  toNumber(customerType.monthExistingSales),

monthNewRefund:
  toNumber(customerType.monthNewRefund),

monthExistingRefund:
  toNumber(customerType.monthExistingRefund),

monthNewStudentCount:
  toNumber(customerType.monthNewStudentCount),

monthExistingStudentCount:
  toNumber(customerType.monthExistingStudentCount),

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
  const decryptedRow =
    decryptStudentJoinedRow(r);

  const isRefund =
    decryptedRow.revenueType === "refund";

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
    clientName: decryptedRow.clientName || "",
    phone: decryptedRow.phone || "",
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
  organizationId?: number | null;
  year: number;
  month: number;
  assigneeId?: number;
  customerType?: "new" | "existing";
}) {
  const db = await getDb();
  if (!db) {
    return {
      entries: [],
      totalCount: 0,
      totalAmount: 0,
    };
  }

  const organizationId = requireOrganizationId(params.organizationId);

  const startDate = `${params.year}-${String(params.month).padStart(2, "0")}-01`;
  const nextMonth = params.month === 12 ? 1 : params.month + 1;
  const nextYear = params.month === 12 ? params.year + 1 : params.year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const conditions: any[] = [
    eq(settlementItems.organizationId, organizationId),
    sql`${settlementItems.occurredAt} >= ${startDate}`,
    sql`${settlementItems.occurredAt} < ${endDate}`,
    sql`${settlementItems.settlementStatus} = 'confirmed'`,
  ];

  if (params.assigneeId) {
    conditions.push(eq(settlementItems.assigneeId, params.assigneeId));
  }

if (params.customerType === "new") {
  conditions.push(
    eq(semesters.semesterOrder, 1)
  );
}

if (params.customerType === "existing") {
  conditions.push(
    or(
      sql`${semesters.semesterOrder} >= 2`,
      sql`${semesters.semesterOrder} IS NULL`
    )
  );
}

  const subjectApprovedCondition = or(
    sql`${settlementItems.revenueType} <> 'subject'`,
    and(
      eq(settlementItems.revenueType, "subject"),
      eq(semesters.id, settlementItems.sourceId),
      eq(semesters.organizationId, organizationId),
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
studentLoginId: students.studentLoginId,
assigneeName: users.name,

semesterOrder: semesters.semesterOrder,
    })
   .from(settlementItems)
.leftJoin(
  refunds,
  and(
    eq(settlementItems.revenueType, "refund"),
    eq(refunds.id, settlementItems.sourceId),
    eq(refunds.organizationId, organizationId)
  )
)
.leftJoin(
  semesters,
  and(
    eq(semesters.organizationId, organizationId),
    or(
      and(
        eq(settlementItems.revenueType, "subject"),
        eq(semesters.id, settlementItems.sourceId)
      ),
      and(
        eq(settlementItems.revenueType, "refund"),
        eq(semesters.id, refunds.semesterId)
      )
    )
  )
)
.leftJoin(
  students,
      and(
        eq(settlementItems.studentId, students.id),
        eq(students.organizationId, organizationId)
      )
    )
    .leftJoin(
      users,
      and(
        eq(settlementItems.assigneeId, users.id),
        eq(users.organizationId, organizationId)
      )
    )
    .where(and(...conditions))
    .orderBy(desc(settlementItems.occurredAt), desc(settlementItems.id));

  const entries = (rows || []).map((r: any) => {
  const decryptedRow =
    decryptStudentJoinedRow(r);

  const isRefund =
    decryptedRow.revenueType === "refund";

  return {
      id: Number(r.id),
      settlementItemId: Number(r.id),
      sourceId: Number(r.sourceId),
      studentId: Number(r.studentId || 0),
      assigneeId: Number(r.assigneeId || 0),

      type: isRefund ? "refund" : String(r.revenueType || "unknown"),
      revenueType: r.revenueType,
settlementStatus: r.settlementStatus,

semesterOrder:
  r.semesterOrder
    ? Number(r.semesterOrder)
    : null,

customerType:
  Number(r.semesterOrder || 0) === 1
    ? ("new" as const)
    : ("existing" as const),

customerTypeLabel:
  Number(r.semesterOrder || 0) === 1
    ? "신규"
    : "기존",

assigneeName: decryptedRow.assigneeName || "",
occurredAt: r.occurredAt || null,

      title: r.title || "",
      institutionName: r.institutionName || "",
clientName: decryptedRow.clientName || "",
phone: decryptedRow.phone || "",
course: r.course || "",
studentLoginId: decryptedRow.studentLoginId || "",
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

export async function getSettlementCustomerTypeSummary(params: {
  organizationId?: number | null;
  year: number;
  month: number;
  assigneeId?: number;
}) {
  const db = await getDb();

  if (!db) {
    return {
      newSales: 0,
      existingSales: 0,
      totalSales: 0,

      newRefund: 0,
      existingRefund: 0,
      totalRefund: 0,

      newStudentCount: 0,
      existingStudentCount: 0,
      totalStudentCount: 0,

      newEntryCount: 0,
      existingEntryCount: 0,
      totalEntryCount: 0,
    };
  }

  const organizationId = requireOrganizationId(
    params.organizationId
  );

  const year = Number(params.year || 0);
  const month = Number(params.month || 0);

  if (!year || month < 1 || month > 12) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "정산 조회 년월이 올바르지 않습니다.",
      400
    );
  }

  const startDate =
    `${year}-${String(month).padStart(2, "0")}-01`;

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const endDate =
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const assigneeCondition = params.assigneeId
    ? sql`AND si.assigneeId = ${Number(params.assigneeId)}`
    : sql``;

  const [rows] = await db.execute(sql`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN COALESCE(sem.semesterOrder, 0) = 1
            THEN COALESCE(si.grossAmount, 0)
            ELSE 0
          END
        ),
        0
      ) AS newSales,

      COALESCE(
        SUM(
          CASE
            WHEN COALESCE(sem.semesterOrder, 0) >= 2
              OR sem.semesterOrder IS NULL
            THEN COALESCE(si.grossAmount, 0)
            ELSE 0
          END
        ),
        0
      ) AS existingSales,

      COALESCE(
        SUM(
          CASE
            WHEN si.revenueType = 'refund'
             AND COALESCE(sem.semesterOrder, 0) = 1
            THEN ABS(COALESCE(si.grossAmount, 0))
            ELSE 0
          END
        ),
        0
      ) AS newRefund,

      COALESCE(
        SUM(
          CASE
            WHEN si.revenueType = 'refund'
             AND (
               COALESCE(sem.semesterOrder, 0) >= 2
               OR sem.semesterOrder IS NULL
             )
            THEN ABS(COALESCE(si.grossAmount, 0))
            ELSE 0
          END
        ),
        0
      ) AS existingRefund,

      COUNT(
        DISTINCT CASE
          WHEN COALESCE(sem.semesterOrder, 0) = 1
           AND si.revenueType != 'refund'
          THEN si.studentId
          ELSE NULL
        END
      ) AS newStudentCount,

      COUNT(
        DISTINCT CASE
          WHEN (
            COALESCE(sem.semesterOrder, 0) >= 2
            OR sem.semesterOrder IS NULL
          )
           AND si.revenueType != 'refund'
          THEN si.studentId
          ELSE NULL
        END
      ) AS existingStudentCount,

      COALESCE(
        SUM(
          CASE
            WHEN COALESCE(sem.semesterOrder, 0) = 1
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS newEntryCount,

      COALESCE(
        SUM(
          CASE
            WHEN COALESCE(sem.semesterOrder, 0) >= 2
              OR sem.semesterOrder IS NULL
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS existingEntryCount

    FROM settlement_items si

    LEFT JOIN refunds rf
      ON si.revenueType = 'refund'
     AND rf.id = si.sourceId
     AND rf.organizationId = ${organizationId}

    LEFT JOIN semesters sem
      ON sem.organizationId = ${organizationId}
     AND (
       (
         si.revenueType = 'subject'
         AND sem.id = si.sourceId
       )
       OR
       (
         si.revenueType = 'refund'
         AND sem.id = rf.semesterId
       )
     )

    WHERE si.organizationId = ${organizationId}
      AND si.occurredAt >= ${startDate}
      AND si.occurredAt < ${endDate}
      AND si.settlementStatus = 'confirmed'

      AND (
        si.revenueType != 'subject'
        OR sem.approvalStatus = '승인'
      )

      ${assigneeCondition}
  `);

  const row = (rows as any[])?.[0] || {};

  const newSales = toNumber(row.newSales);
  const existingSales = toNumber(row.existingSales);

  const newRefund = toNumber(row.newRefund);
  const existingRefund = toNumber(row.existingRefund);

  const newStudentCount =
    toNumber(row.newStudentCount);

  const existingStudentCount =
    toNumber(row.existingStudentCount);

  const newEntryCount =
    toNumber(row.newEntryCount);

  const existingEntryCount =
    toNumber(row.existingEntryCount);

  return {
    // 환불 원장은 grossAmount가 음수이므로
    // 이미 해당 신규/기존 매출에서 차감된 순매출
    newSales,
    existingSales,
    totalSales: newSales + existingSales,

    // 화면에서 환불액을 별도로 표시하기 위한 양수 금액
    newRefund,
    existingRefund,
    totalRefund: newRefund + existingRefund,

    newStudentCount,
    existingStudentCount,
    totalStudentCount:
      newStudentCount + existingStudentCount,

    newEntryCount,
    existingEntryCount,
    totalEntryCount:
      newEntryCount + existingEntryCount,
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
export async function getSettlementMonthLock(params: {
  organizationId?: number | null;
  year: number;
  month: number;
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params.organizationId);
  const year = Number(params.year);
  const month = Number(params.month);

  const rows = await db
    .select()
    .from(settlementMonthLocks)
    .where(
      and(
        eq(settlementMonthLocks.organizationId, organizationId),
        eq(settlementMonthLocks.settlementYear, year),
        eq(settlementMonthLocks.settlementMonth, month)
      )
    )
    .limit(1);

  return rows[0] || null;
}

export async function isSettlementMonthLocked(params: {
  organizationId?: number | null;
  year: number;
  month: number;
}) {
  const lock = await getSettlementMonthLock(params);

  return Boolean(lock && (lock as any).isLocked !== false);
}

export async function lockSettlementMonth(params: {
  organizationId?: number | null;
  year: number;
  month: number;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params.organizationId);
  const year = Number(params.year);
  const month = Number(params.month);
  const actorUserId = Number(params.actorUserId || 0);

  if (!year || year < 2020 || year > 2100) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "정산 연도가 올바르지 않습니다.",
      400
    );
  }

  if (!month || month < 1 || month > 12) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "정산 월이 올바르지 않습니다.",
      400
    );
  }

  const existing = await getSettlementMonthLock({
    organizationId,
    year,
    month,
  });

  if (existing) {
    await db
      .update(settlementMonthLocks)
      .set({
        isLocked: true,
        lockedAt: new Date(),
        lockedBy: actorUserId,
        unlockedAt: null,
        unlockedBy: null,
        unlockReason: null,
      } as any)
      .where(
        and(
          eq(settlementMonthLocks.organizationId, organizationId),
          eq(settlementMonthLocks.settlementYear, year),
          eq(settlementMonthLocks.settlementMonth, month)
        )
      );

    return getSettlementMonthLock({
      organizationId,
      year,
      month,
    });
  }

  await db.insert(settlementMonthLocks).values({
    organizationId,
    settlementYear: year,
    settlementMonth: month,
    isLocked: true,
    lockedAt: new Date(),
    lockedBy: actorUserId,
    unlockedAt: null,
    unlockedBy: null,
    unlockReason: null,
  } as any);

  return getSettlementMonthLock({
    organizationId,
    year,
    month,
  });
}

export async function unlockSettlementMonth(params: {
  organizationId?: number | null;
  year: number;
  month: number;
  actorUserId: number;
  reason: string;
}) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params.organizationId);
  const year = Number(params.year);
  const month = Number(params.month);
  const actorUserId = Number(params.actorUserId || 0);
  const reason = String(params.reason || "").trim();

  if (!year || year < 2020 || year > 2100) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "정산 연도가 올바르지 않습니다.",
      400
    );
  }

  if (!month || month < 1 || month > 12) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "정산 월이 올바르지 않습니다.",
      400
    );
  }

  if (reason.length < 2) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "확정 해제 사유를 입력해주세요.",
      400
    );
  }

  const existing = await getSettlementMonthLock({
    organizationId,
    year,
    month,
  });

  if (!existing) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "확정된 정산 월을 찾을 수 없습니다.",
      404
    );
  }

  await db
    .update(settlementMonthLocks)
    .set({
      isLocked: false,
      unlockedAt: new Date(),
      unlockedBy: actorUserId,
      unlockReason: reason,
    } as any)
    .where(
      and(
        eq(settlementMonthLocks.organizationId, organizationId),
        eq(settlementMonthLocks.settlementYear, year),
        eq(settlementMonthLocks.settlementMonth, month)
      )
    );

  return getSettlementMonthLock({
    organizationId,
    year,
    month,
  });
}

async function assertSettlementMonthEditable(params: {
  organizationId?: number | null;
  date?: any;
  year?: number;
  month?: number;
}) {
  const organizationId = requireOrganizationId(params.organizationId);

  let year = Number(params.year || 0);
  let month = Number(params.month || 0);

  if ((!year || !month) && params.date) {
    const d = new Date(params.date);
    if (!Number.isNaN(d.getTime())) {
      year = d.getFullYear();
      month = d.getMonth() + 1;
    }
  }

  if (!year || !month) return;

  const locked = await isSettlementMonthLocked({
    organizationId,
    year,
    month,
  });

  if (locked) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${year}년 ${month}월 정산이 확정되어 수정할 수 없습니다.`,
      400
    );
  }
}

export async function getSettlementReport(
  year: number,
  month: number,
  filterAssigneeId?: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

const organizationId = requireOrganizationId(params?.organizationId);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const conditions = [
  eq(settlementItems.organizationId, organizationId),
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
    eq(semesters.organizationId, organizationId),
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "담당자 정보를 찾을 수 없습니다.",
  404
);
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
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  `${requirementType} 허용 개수(${limit}개)를 초과할 수 없습니다.`,
  400
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId((data as any).organizationId);

  const duplicate = await findDuplicatePlanSubject({
    studentId: Number(data.studentId),
    subjectName: String(data.subjectName || ""),
    organizationId,
  } as any);

  if (duplicate) {
    throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  `이미 ${duplicate.semesterNo}학기에 등록된 과목입니다: ${duplicate.subjectName}`,
  409
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
  settlementIncluded: resolvePlanSemesterSettlementIncluded(
    (data as any).subjectName,
    (data as any).settlementIncluded
  ),
} as any);

  return getInsertId(result);
}

export async function updatePlanSemester(
  id: number,
  data: Partial<InsertPlanSemester>,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!row) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "우리 플랜 과목을 찾을 수 없습니다",
  404
);

  if (data.subjectName !== undefined) {
    const duplicate = await findDuplicatePlanSubject({
      studentId: Number(row.studentId),
      subjectName: String(data.subjectName || ""),
      excludeId: id,
      organizationId,
    } as any);

    if (duplicate) {
      throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  `이미 ${duplicate.semesterNo}학기에 등록된 과목입니다: ${duplicate.subjectName}`,
  409
);
    }
  }

if (
  data.subjectName !== undefined &&
  (data as any).settlementIncluded === undefined
) {
  (data as any).settlementIncluded =
    resolvePlanSemesterSettlementIncluded(data.subjectName);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
settlementIncluded: true,
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);
  if (!dataList.length) return [];

  const normalized = dataList.map((row: any) => ({
    ...row,
    organizationId: requireOrganizationId(row.organizationId),
  }));

  const result = await db.insert(transferSubjects).values(normalized as any);
  return result;
}

// ==============================
// CREDIT SUMMARY
// 학생 정보 요약 / 학점 검증
// ==============================

export async function listCreditSummaryRules(params: {
  organizationId?: number | null;
  activeOnly?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);

  const conditions: any[] = [
    eq(creditSummaryRules.organizationId, organizationId),
  ];

  if (params.activeOnly) {
    conditions.push(eq(creditSummaryRules.isActive, true));
  }

  return db
    .select()
    .from(creditSummaryRules)
    .where(and(...conditions))
    .orderBy(
      creditSummaryRules.courseName,
      creditSummaryRules.finalEducation,
      creditSummaryRules.id
    );
}

export async function getCreditSummaryRuleById(params: {
  id: number;
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select()
    .from(creditSummaryRules)
    .where(
      and(
        eq(creditSummaryRules.id, Number(params.id)),
        eq(creditSummaryRules.organizationId, organizationId)
      )
    )
    .limit(1);

  return rows[0] || null;
}

export async function findCreditSummaryRule(params: {
  organizationId?: number | null;
  studentId: number;
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params.organizationId);
  const studentId = Number(params.studentId || 0);

  if (!studentId) return null;

  const rows = await db
    .select()
    .from(creditSummaryRules)
    .where(
      and(
        eq(creditSummaryRules.organizationId, organizationId),
        eq(creditSummaryRules.studentId, studentId),
        eq(creditSummaryRules.isActive, true)
      )
    )
    .orderBy(desc(creditSummaryRules.id))
    .limit(1);

  return rows[0] || null;
}

export async function createCreditSummaryRule(
  data: InsertCreditSummaryRule
) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId((data as any).organizationId);

  const result: any = await db.insert(creditSummaryRules).values({
    ...data,
    organizationId,
  } as any);

  return getInsertId(result);
}

export async function updateCreditSummaryRule(
  id: number,
  data: Partial<InsertCreditSummaryRule>,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(creditSummaryRules)
    .set(data as any)
    .where(
      and(
        eq(creditSummaryRules.id, Number(id)),
        eq(creditSummaryRules.organizationId, organizationId)
      )
    );

  return getCreditSummaryRuleById({
    id: Number(id),
    organizationId,
  });
}

export async function deleteCreditSummaryRule(params: {
  id: number;
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params.organizationId);

  await db
    .delete(creditSummaryRules)
    .where(
      and(
        eq(creditSummaryRules.id, Number(params.id)),
        eq(creditSummaryRules.organizationId, organizationId)
      )
    );

  return { ok: true };
}

export async function listStudentCreditSummaryItems(params: {
  organizationId?: number | null;
  studentId: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);

  return db
    .select()
    .from(studentCreditSummaryItems)
    .where(
      and(
        eq(studentCreditSummaryItems.organizationId, organizationId),
        eq(studentCreditSummaryItems.studentId, Number(params.studentId))
      )
    )
    .orderBy(
      studentCreditSummaryItems.sortOrder,
      studentCreditSummaryItems.id
    );
}

export async function getStudentCreditSummaryItemById(params: {
  id: number;
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select()
    .from(studentCreditSummaryItems)
    .where(
      and(
        eq(studentCreditSummaryItems.id, Number(params.id)),
        eq(studentCreditSummaryItems.organizationId, organizationId)
      )
    )
    .limit(1);

  return rows[0] || null;
}

export async function createStudentCreditSummaryItem(
  data: InsertStudentCreditSummaryItem
) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId((data as any).organizationId);

  const result: any = await db.insert(studentCreditSummaryItems).values({
    ...data,
    organizationId,
  } as any);

  return getInsertId(result);
}

export async function updateStudentCreditSummaryItem(
  id: number,
  data: Partial<InsertStudentCreditSummaryItem>,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(studentCreditSummaryItems)
    .set(data as any)
    .where(
      and(
        eq(studentCreditSummaryItems.id, Number(id)),
        eq(studentCreditSummaryItems.organizationId, organizationId)
      )
    );

  return getStudentCreditSummaryItemById({
    id: Number(id),
    organizationId,
  });
}

export async function deleteStudentCreditSummaryItem(params: {
  id: number;
  organizationId?: number | null;
}) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params.organizationId);

  await db
    .delete(studentCreditSummaryItems)
    .where(
      and(
        eq(studentCreditSummaryItems.id, Number(params.id)),
        eq(studentCreditSummaryItems.organizationId, organizationId)
      )
    );

  return { ok: true };
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB 연결 실패",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

export async function listSettlementSubjectPriceRules(params: {
  organizationId?: number | null;
  educationInstitutionId?: number | null;
  includeInactive?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);
  const educationInstitutionId =
    params.educationInstitutionId === undefined
      ? undefined
      : params.educationInstitutionId === null
      ? null
      : Number(params.educationInstitutionId || 0) || null;

  const conditions: any[] = [
    eq(settlementSubjectPriceRules.organizationId, organizationId),
  ];

  if (educationInstitutionId !== undefined) {
    if (educationInstitutionId === null) {
      conditions.push(sql`${settlementSubjectPriceRules.educationInstitutionId} IS NULL`);
    } else {
      conditions.push(
        eq(settlementSubjectPriceRules.educationInstitutionId, educationInstitutionId)
      );
    }
  }

  if (!params.includeInactive) {
    conditions.push(eq(settlementSubjectPriceRules.isActive, true));
  }

  return db
    .select()
    .from(settlementSubjectPriceRules)
    .where(and(...conditions))
    .orderBy(
      asc(settlementSubjectPriceRules.sortOrder),
      asc(settlementSubjectPriceRules.thresholdAmount),
      asc(settlementSubjectPriceRules.id)
    );
}

export async function upsertSettlementSubjectPriceRule(input: {
  organizationId?: number | null;
  id?: number | null;
  educationInstitutionId?: number | null;
  label: string;
  thresholdAmount: number | string;
  creditValue: number;
  sortOrder?: number | null;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(input.organizationId);
  const id = Number(input.id || 0);
  const label = String(input.label || "").trim();
  const thresholdAmount = toNumber(input.thresholdAmount);
  const creditValue = Number(input.creditValue ?? 0);
  const educationInstitutionId =
    input.educationInstitutionId === undefined || input.educationInstitutionId === null
      ? null
      : Number(input.educationInstitutionId || 0) || null;

  if (!label) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "단가 기준명을 입력해주세요.",
      400
    );
  }

  if (thresholdAmount < 0) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "기준 금액은 0원 이상이어야 합니다.",
      400
    );
  }

  if (!Number.isFinite(creditValue) || creditValue < 0) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학점 값은 0 이상이어야 합니다.",
      400
    );
  }

  const payload = {
    organizationId,
    educationInstitutionId,
    label,
    thresholdAmount: String(thresholdAmount),
    creditValue,
    sortOrder: Number(input.sortOrder ?? 0),
    isActive: input.isActive === undefined ? true : Boolean(input.isActive),
  };

  if (id > 0) {
    await db
      .update(settlementSubjectPriceRules)
      .set(payload as any)
      .where(
        and(
          eq(settlementSubjectPriceRules.id, id),
          eq(settlementSubjectPriceRules.organizationId, organizationId)
        )
      );

    return { success: true, id };
  }

  const result: any = await db
    .insert(settlementSubjectPriceRules)
    .values(payload as any);

  return {
    success: true,
    id: getInsertId(result),
  };
}

export async function deleteSettlementSubjectPriceRule(input: {
  organizationId?: number | null;
  id: number;
}) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(input.organizationId);

  await db
    .delete(settlementSubjectPriceRules)
    .where(
      and(
        eq(settlementSubjectPriceRules.id, Number(input.id)),
        eq(settlementSubjectPriceRules.organizationId, organizationId)
      )
    );

  return {
    success: true,
    id: Number(input.id),
  };
}

export async function listSettlementInstitutionPriceRules(params: {
  organizationId?: number | null;
  educationInstitutionId: number;
  includeInactive?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params.organizationId);
  const educationInstitutionId = Number(params.educationInstitutionId || 0);

  if (!educationInstitutionId) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "교육원을 선택해주세요.",
      400
    );
  }

  const conditions: any[] = [
    eq(settlementInstitutionPriceRules.organizationId, organizationId),
    eq(
      settlementInstitutionPriceRules.educationInstitutionId,
      educationInstitutionId
    ),
  ];

  if (!params.includeInactive) {
    conditions.push(eq(settlementInstitutionPriceRules.isActive, true));
  }

  return db
    .select()
    .from(settlementInstitutionPriceRules)
    .where(and(...conditions))
    .orderBy(
      asc(settlementInstitutionPriceRules.sortOrder),
      asc(settlementInstitutionPriceRules.thresholdAmount),
      asc(settlementInstitutionPriceRules.id)
    );
}

export async function upsertSettlementInstitutionPriceRule(input: {
  organizationId?: number | null;
  id?: number | null;
  educationInstitutionId: number;
  thresholdAmount: number | string;
  institutionUnitCost: number | string;
  sortOrder?: number | null;
  isActive?: boolean;
}) {
  const db = await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(input.organizationId);
  const id = Number(input.id || 0);
  const educationInstitutionId = Number(input.educationInstitutionId || 0);
  const thresholdAmount = toNumber(input.thresholdAmount);
  const institutionUnitCost = toNumber(input.institutionUnitCost);

  if (!educationInstitutionId) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "교육원을 선택해주세요.",
      400
    );
  }

  if (thresholdAmount <= 0) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "기준금액은 1원 이상이어야 합니다.",
      400
    );
  }

  if (institutionUnitCost < 0) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "교육원 정산금액은 0원 이상이어야 합니다.",
      400
    );
  }

  const payload = {
    organizationId,
    educationInstitutionId,
    thresholdAmount: String(thresholdAmount),
    institutionUnitCost: String(institutionUnitCost),
    sortOrder: Number(input.sortOrder ?? 0),
    isActive: input.isActive === undefined ? true : Boolean(input.isActive),
  };

  if (id > 0) {
    await db
      .update(settlementInstitutionPriceRules)
      .set(payload as any)
      .where(
        and(
          eq(settlementInstitutionPriceRules.id, id),
          eq(settlementInstitutionPriceRules.organizationId, organizationId),
          eq(
            settlementInstitutionPriceRules.educationInstitutionId,
            educationInstitutionId
          )
        )
      );

    return { success: true, id };
  }

  const result: any = await db
    .insert(settlementInstitutionPriceRules)
    .values(payload as any);

  return {
    success: true,
    id: getInsertId(result),
  };
}

export async function deleteSettlementInstitutionPriceRule(input: {
  organizationId?: number | null;
  id: number;
  educationInstitutionId: number;
}) {
  const db = await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(input.organizationId);
  const educationInstitutionId = Number(input.educationInstitutionId || 0);

  if (!educationInstitutionId) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "교육원을 선택해주세요.",
      400
    );
  }

  await db
    .delete(settlementInstitutionPriceRules)
    .where(
      and(
        eq(settlementInstitutionPriceRules.id, Number(input.id)),
        eq(settlementInstitutionPriceRules.organizationId, organizationId),
        eq(
          settlementInstitutionPriceRules.educationInstitutionId,
          educationInstitutionId
        )
      )
    );

  return {
    success: true,
    id: Number(input.id),
  };
}

export async function listActiveSettlementInstitutionPriceRulesForCalc(params: {
  organizationId?: number | null;
  educationInstitutionId: number;
}) {
  return listSettlementInstitutionPriceRules({
    organizationId: params.organizationId,
    educationInstitutionId: params.educationInstitutionId,
    includeInactive: false,
  });
}

function resolveInstitutionCostFromSubjectCombination(params: {
  subjectPriceCombination: any[] | null;
  subjectCount: number;
  fallbackUnitCost: number;
  rules: any[];
}) {
  const subjectCount = Number(params.subjectCount || 0);
  const fallbackUnitCost = toNumber(params.fallbackUnitCost);

  const ruleMap = new Map<number, number>();

  (params.rules || []).forEach((row: any) => {
    const thresholdAmount = toNumber(row.thresholdAmount);
    if (!thresholdAmount) return;

    ruleMap.set(thresholdAmount, toNumber(row.institutionUnitCost));
  });

  const combination = params.subjectPriceCombination || [];

  if (combination.length > 0) {
    let institutionCost = 0;

    const appliedRules = combination.map((row: any) => {
      const unitPrice = toNumber(row.unitPrice);
      const count = Number(row.count || 0);
      const matchedUnitCost = ruleMap.has(unitPrice)
        ? Number(ruleMap.get(unitPrice) || 0)
        : fallbackUnitCost;

      institutionCost += matchedUnitCost * count;

      return {
        unitPrice,
        count,
        institutionUnitCost: matchedUnitCost,
        source: ruleMap.has(unitPrice) ? "institution_price_rule" : "fallback",
      };
    });

    return {
      institutionCost,
      appliedRules,
    };
  }

  return {
    institutionCost: fallbackUnitCost * subjectCount,
    appliedRules: [
      {
        unitPrice: null,
        count: subjectCount,
        institutionUnitCost: fallbackUnitCost,
        source: "fallback",
      },
    ],
  };
}

export async function resolveSettlementCreditPerSubject(params: {
  organizationId?: number | null;
  educationInstitutionId?: number | null;
  actualUnitPrice: number;
}) {
  const organizationId = requireOrganizationId(params.organizationId);
  const educationInstitutionId = Number(params.educationInstitutionId || 0) || null;
  const actualUnitPrice = toNumber(params.actualUnitPrice);

  const institutionRules =
    educationInstitutionId
      ? await listSettlementSubjectPriceRules({
          organizationId,
          educationInstitutionId,
        })
      : [];

  const globalRules = await listSettlementSubjectPriceRules({
    organizationId,
    educationInstitutionId: null,
  });

  const rules = institutionRules.length > 0 ? institutionRules : globalRules;

  const matched = [...rules].find(
  (row: any) =>
    actualUnitPrice === toNumber(row.thresholdAmount)
);

  return {
    creditValue: matched ? Number((matched as any).creditValue || 0) : 0,
    rule: matched || null,
  };
}

async function listActiveSettlementSubjectPriceRulesForCalc(params: {
  organizationId?: number | null;
  educationInstitutionId?: number | null;
}) {
  const organizationId = requireOrganizationId(params.organizationId);
  const educationInstitutionId =
    params.educationInstitutionId === undefined ||
    params.educationInstitutionId === null
      ? null
      : Number(params.educationInstitutionId || 0) || null;

  const institutionRules =
  educationInstitutionId
    ? await listSettlementSubjectPriceRules({
        organizationId,
        educationInstitutionId,
        includeInactive: false,
      })
    : [];

const commonRules = await listSettlementSubjectPriceRules({
  organizationId,
  educationInstitutionId: null,
  includeInactive: false,
});

  const merged = [...institutionRules, ...commonRules]
    .map((row: any) => ({
      thresholdAmount: toNumber(row.thresholdAmount),
      creditValue: Number(row.creditValue || 0),
      label: String(row.label || ""),
    }))
    .filter((row) => row.thresholdAmount > 0)
    .sort((a, b) => b.thresholdAmount - a.thresholdAmount);

  const unique = new Map<number, any>();

  for (const row of merged) {
    if (!unique.has(row.thresholdAmount)) {
      unique.set(row.thresholdAmount, row);
    }
  }

  return Array.from(unique.values());
}

function resolveSettlementSubjectPriceCombination(params: {
  grossAmount: number;
  subjectCount: number;
  rules: Array<{
    thresholdAmount: number;
    creditValue: number;
    label?: string;
  }>;
}) {
  const grossAmount = toNumber(params.grossAmount);
  const subjectCount = Number(params.subjectCount || 0);

  const rules = (params.rules || [])
    .map((row) => ({
      thresholdAmount: toNumber(row.thresholdAmount),
      creditValue: Number(row.creditValue || 0),
      label: row.label || "",
    }))
    .filter((row) => row.thresholdAmount > 0)
    .sort((a, b) => toNumber(b.thresholdAmount) - toNumber(a.thresholdAmount));

  if (!grossAmount || !subjectCount || !rules.length) {
    return null;
  }

  // 1순위: 평균단가가 기준표에 정확히 있으면 무조건 그 단가로 처리
  // 예: 600,000 / 8 = 75,000 → 75,000 × 8
  const averageUnitPrice =
    grossAmount % subjectCount === 0
      ? Math.floor(grossAmount / subjectCount)
      : 0;

  const exactAverageRule = rules.find(
    (row) => row.thresholdAmount === averageUnitPrice
  );

  if (exactAverageRule) {
    return [
      {
        unitPrice: averageUnitPrice,
        count: subjectCount,
        creditValue: Number(exactAverageRule.creditValue || 0),
        label: exactAverageRule.label || "",
      },
    ];
  }

  // 2순위: 금액 + 과목수 둘 다 맞는 모든 조합 찾기
  const candidates: any[][] = [];

  function dfs(
    index: number,
    remainAmount: number,
    remainCount: number,
    selected: any[]
  ) {
    if (remainAmount === 0 && remainCount === 0) {
      candidates.push(selected.filter((row) => Number(row.count || 0) > 0));
      return;
    }

    if (remainAmount < 0 || remainCount < 0 || index >= rules.length) {
      return;
    }

    const rule = rules[index];
    const price = Number(rule.thresholdAmount || 0);

    const maxCount = Math.min(
      remainCount,
      price > 0 ? Math.floor(remainAmount / price) : 0
    );

    for (let count = maxCount; count >= 0; count--) {
      dfs(
        index + 1,
        remainAmount - price * count,
        remainCount - count,
        [
          ...selected,
          {
            unitPrice: price,
            count,
            creditValue: Number(rule.creditValue || 0),
            label: rule.label || "",
          },
        ]
      );
    }
  }

  dfs(0, grossAmount, subjectCount, []);

  if (!candidates.length) {
    return null;
  }

  // 3순위: 높은 단가가 많이 포함된 조합을 우선 선택
// rules 배열이 이미 높은 금액순으로 정렬되어 있으므로,
// 각 단가별 과목 수를 앞에서부터 비교한다.
candidates.sort((a, b) => {
  const countMapA = new Map<number, number>();
  const countMapB = new Map<number, number>();

  for (const row of a) {
    countMapA.set(
      Number(row.unitPrice || 0),
      Number(row.count || 0)
    );
  }

  for (const row of b) {
    countMapB.set(
      Number(row.unitPrice || 0),
      Number(row.count || 0)
    );
  }

  for (const rule of rules) {
    const price = Number(rule.thresholdAmount || 0);

    const countA = Number(countMapA.get(price) || 0);
    const countB = Number(countMapB.get(price) || 0);

    // 높은 단가에서 과목 수가 많은 조합을 먼저 선택
    if (countA !== countB) {
      return countB - countA;
    }
  }

  // 높은 단가 구성이 같다면 단가 종류가 적은 조합 우선
  if (a.length !== b.length) {
    return a.length - b.length;
  }

  // 마지막으로 총 정산학점이 높은 조합 우선
  const totalCreditsA = a.reduce(
    (sum, row) =>
      sum + Number(row.count || 0) * Number(row.creditValue || 0),
    0
  );

  const totalCreditsB = b.reduce(
    (sum, row) =>
      sum + Number(row.count || 0) * Number(row.creditValue || 0),
    0
  );

  return totalCreditsB - totalCreditsA;
});

return candidates[0];
}

export async function upsertEducationInstitutionPositionRate(data: {
  organizationId?: number | null;
  educationInstitutionId: number;
  positionId: number;
  freelancerUnitAmount: string | number;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB 연결 실패",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB 연결 실패",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB 연결 실패",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const result: any = await db.insert(transferAttachments).values(data);
  return getInsertId(result);
}

export async function updateTransferAttachment(
  id: number,
  data: Partial<InsertTransferAttachment>,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "첨부파일을 찾을 수 없습니다.",
  404
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "첨부파일을 찾을 수 없습니다.",
  404
);
  }

  await db.delete(transferAttachments).where(eq(transferAttachments.id, id));
}

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

  const student = await getStudent(params.studentId, {
    organizationId,
  });

  if (!student) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);
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
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다",
  400
);
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
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "선택한 과목 중 현재 회사에 없는 과목이 포함되어 있습니다.",
  400
);
  }

  if (templates.length > 8) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다",
  400
);
  }

  const templateNames = templates.map((t: any) =>
    normalizeSubjectName(t.subjectName)
  );

  const duplicateInsideSelection = templateNames.find(
    (name: string, idx: number) => templateNames.indexOf(name) !== idx
  );

  if (duplicateInsideSelection) {
    throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  `선택한 템플릿 안에 중복 과목이 있습니다: ${duplicateInsideSelection}`,
  409
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

    throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  `이미 ${found?.semesterNo}학기에 등록된 과목입니다: ${duplicateInOtherSemester.subjectName}`,
  409
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId((data as any).organizationId);

  const name = String(data.name || "").trim();
  if (!name) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "자격증명을 입력해주세요.",
  400
);
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
    throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  "이미 등록된 민간자격증입니다.",
  409
);
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

export async function deletePrivateCertificateMaster(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId((data as any).organizationId);

  const name = String(data.name || "").trim();
  if (!name) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "과정명을 입력해주세요.",
  400
);
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
    throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  "이미 등록된 과정입니다.",
  409
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "삭제할 과정을 찾을 수 없습니다.",
  404
);
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
      asc(
        subjectCatalogItems
          .semesterNo
      ),

      asc(
        subjectCatalogItems
          .sortOrder
      ),

      asc(
        subjectCatalogItems
          .id
      )
    );
}

export async function createSubjectCatalogItem(
  data: InsertSubjectCatalogItem & { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId((data as any).organizationId);

  const subjectName = String(data.subjectName || "").trim();
  if (!subjectName) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "과목명을 입력해주세요.",
  400
);
  }

  const semesterNo =
    Number(
      (data as any)
        .semesterNo ??
      1
    );

  if (
    !Number.isInteger(
      semesterNo
    ) ||
    semesterNo <= 0 ||
    semesterNo > 20
  ) {
    throwAppError(
      ERROR_CODES.INVALID_INPUT,
      "학기 번호가 올바르지 않습니다.",
      400
    );
  }

  const requirementType = data.requirementType;
  if (!requirementType) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "과목 구분을 선택해주세요.",
  400
);
  }

  const catalogId = Number(data.catalogId || 0);
  if (!catalogId) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "과정 정보가 없습니다.",
  404
);
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
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "현재 회사의 과정이 아닙니다.",
  403
);
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
    throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  "이미 등록된 과목입니다.",
  409
);
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
       semesterNo,
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

export async function bulkCreateSubjectCatalogItems(params: {
  organizationId?:
    number | null;

  catalogId:
    number;

  semesterNo?:
    number | null;

  requirementType:
    | "전공필수"
    | "전공선택"
    | "교양"
    | "일반";

  subjectNames:
    string[];

  actorUserId?:
    number | null;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);
  const catalogId = Number(params.catalogId || 0);
  const semesterNo =
    Number(
      params.semesterNo ||
      1
    );
  if (
    !Number.isInteger(
      semesterNo
    ) ||
    semesterNo <= 0 ||
    semesterNo > 20
  ) {
    throwAppError(
      ERROR_CODES.INVALID_INPUT,
      "학기 번호가 올바르지 않습니다.",
      400
    );
  }

  if (!catalogId) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "과정 정보가 없습니다.",
  404
);
  }

  const category =
    params.requirementType === "교양"
      ? "교양"
      : params.requirementType === "일반"
        ? "일반"
        : "전공";

  const cleanedNames = Array.from(
    new Set(
      (params.subjectNames || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  );

  if (!cleanedNames.length) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "등록할 과목명이 없습니다.",
  400
);
  }

  const existingRows = await db
    .select()
    .from(subjectCatalogItems)
    .where(
      and(
        eq(subjectCatalogItems.organizationId, organizationId),
        eq(subjectCatalogItems.catalogId, catalogId),
        eq(subjectCatalogItems.requirementType, params.requirementType)
      )
    );

  const existingNameSet = new Set(
    existingRows.map((row: any) =>
      String(row.subjectName || "").trim().replace(/\s+/g, " ")
    )
  );

  const startSortOrder =
    existingRows.reduce(
      (max: number, row: any) => Math.max(max, Number(row.sortOrder || 0)),
      -1
    ) + 1;

  const insertRows = cleanedNames
    .map((name) => name.replace(/\s+/g, " "))
    .filter((name) => !existingNameSet.has(name))
    .map((subjectName, index) => ({
  organizationId,
  catalogId,
  subjectName,

  semesterNo,

  requirementType:
    params.requirementType,

  category,

  credits:
    3,

  sortOrder:
    startSortOrder +
    index,

  isActive:
    true,

  createdBy:
    params.actorUserId ??
    null,

  updatedBy:
    params.actorUserId ??
    null,
}));

  if (insertRows.length > 0) {
    await db.insert(subjectCatalogItems).values(insertRows as any);
  }

  return {
    success: true,
    requestedCount: cleanedNames.length,
    createdCount: insertRows.length,
    skippedCount: cleanedNames.length - insertRows.length,
  };
}

export async function deleteSubjectCatalogItem(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
export async function getPrivateCertificateRequest(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return undefined;

  const organizationId = requireOrganizationId(params?.organizationId);

  const rows = await db
    .select()
    .from(privateCertificateRequests)
    .where(
      and(
        eq(privateCertificateRequests.id, Number(id)),
        eq(privateCertificateRequests.organizationId, organizationId)
      )
    )
    .limit(1);

  return rows[0]
  ? decryptPrivateCertificatePersonalData(rows[0])
  : undefined;
}

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

  return rows.map((rawRow: any) => {
  const row =
    decryptPrivateCertificatePersonalData({
      ...rawRow.request,

      studentClientName:
        rawRow.studentClientName,

      studentPhone:
        rawRow.studentPhone,

      studentAddress:
        rawRow.studentAddress,

      userName:
        rawRow.userName,
    }) as any;

  return {
    ...row,

    clientName:
      String(row.clientName || "").trim() ||
      String(row.studentClientName || "").trim() ||
      null,

    phone:
      String(row.phone || "").trim() ||
      String(row.studentPhone || "").trim() ||
      null,

    assigneeName:
      String(row.assigneeName || "").trim() ||
      String(row.userName || "").trim() ||
      null,

    inputAddress:
      String(row.inputAddress || "").trim() ||
      String(row.studentAddress || "").trim() ||
      null,
  };
});
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

  return rows.map((rawRow: any) => {
  const row =
    decryptPrivateCertificatePersonalData({
      ...rawRow.request,

      studentClientName:
        rawRow.studentClientName,

      studentPhone:
        rawRow.studentPhone,

      studentAddress:
        rawRow.studentAddress,

      userName:
        rawRow.userName,
    }) as any;

  return {
    ...row,

    clientName:
      String(row.clientName || "").trim() ||
      String(row.studentClientName || "").trim() ||
      null,

    phone:
      String(row.phone || "").trim() ||
      String(row.studentPhone || "").trim() ||
      null,

    assigneeName:
      String(row.assigneeName || "").trim() ||
      String(row.userName || "").trim() ||
      null,

    inputAddress:
      String(row.inputAddress || "").trim() ||
      String(row.studentAddress || "").trim() ||
      null,
  };
});
}

export async function updatePrivateCertificateMaster(
  id: number,
  data: Partial<InsertPrivateCertificateMaster>
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId((data as any).organizationId);

  const preparedData =
  preparePrivateCertificatePersonalData(data);

const result: any = await db
  .insert(privateCertificateRequests)
  .values({
    ...preparedData,
    organizationId,

    feeAmount:
      data.feeAmount ?? "0",

    freelancerInputAmount:
      data.freelancerInputAmount ?? "0",

    paymentStatus:
      data.paymentStatus ?? "결제대기",
  } as any);

  const insertId = getInsertId(result);

  if (insertId) {
    await syncPrivateCertificateSettlementItemByRequestId(
      Number(insertId),
      undefined,
      { organizationId }
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

const organizationId = requireOrganizationId(params?.organizationId);

  try {
  const preparedData =
    preparePrivateCertificatePersonalData(data);

  await db
    .update(privateCertificateRequests)
    .set(preparedData as any)
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
    throw err;
  }
}

export async function deletePrivateCertificateRequest(
  id: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "민간자격증 요청 데이터를 찾을 수 없습니다.",
  404
);
  }

  if (request.paymentStatus !== "결제") {
    throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "결제 완료된 건만 환불 요청할 수 있습니다.",
  400
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "민간자격증 요청 데이터를 찾을 수 없습니다.",
  404
);
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
 AND s.organizationId = psr.organizationId

LEFT JOIN plans p
  ON p.studentId = s.id
 AND p.organizationId = psr.organizationId

LEFT JOIN users u
  ON u.id = COALESCE(psr.assigneeId, s.assigneeId)
 AND u.organizationId = psr.organizationId
  ${whereClause}
  ORDER BY
    LEFT(TRIM(COALESCE(psr.practiceDate, p.practiceDate, '')), 7) ASC,
    psr.id DESC
`);

  const mappedRows = (rows as any[]).map((rawRow: any) => {
  const row =
    decryptPracticeSupportPersonalData(rawRow) as any;

  return {
    id: row.id ? Number(row.id) : null,
    practiceSupportRequestId: row.id ? Number(row.id) : null,
    hasPracticeSupportRequest: !!row.id,

    studentId: Number(row.studentId),
    semesterId: null,
    semesterOrder: 1,
    semesterUpdatedAt: row.updatedAt || null,

    clientName:
      row.clientName ||
      row.studentClientName ||
      "",

    phone:
      row.phone ||
      row.studentPhone ||
      "",

    course:
      row.course ||
      row.studentCourse ||
      row.planDesiredCourse ||
      "",

    inputAddress:
      row.inputAddress ||
      row.studentAddress ||
      null,

    detailAddress:
      row.detailAddress ||
      row.studentDetailAddress ||
      null,

    assigneeId:
      row.assigneeId ??
      row.studentAssigneeId ??
      null,

    assigneeName:
      row.assigneeName ||
      row.userName ||
      null,

    managerName:
      row.managerName ||
      row.userName ||
      "",

    practiceHours:
      row.practiceHours ??
      row.planPracticeHours ??
      null,

    practiceDate:
      row.practiceDate ||
      row.planPracticeDate ||
      null,

    coordinationStatus:
      row.coordinationStatus ||
      "미섭외",

    selectedEducationCenterId:
      row.selectedEducationCenterId || null,

    selectedEducationCenterName:
      row.selectedEducationCenterName || "",

    selectedEducationCenterAddress:
      row.selectedEducationCenterAddress || "",

    selectedEducationCenterDistanceKm:
      row.selectedEducationCenterDistanceKm || "",

    selectedPracticeInstitutionId:
      row.selectedPracticeInstitutionId || null,

    selectedPracticeInstitutionName:
      row.selectedPracticeInstitutionName || "",

    selectedPracticeInstitutionAddress:
      row.selectedPracticeInstitutionAddress || "",

    selectedPracticeInstitutionDistanceKm:
      row.selectedPracticeInstitutionDistanceKm || "",

    feeAmount:
      row.feeAmount || "0",

    paymentStatus:
      row.paymentStatus || "미결제",

    note:
      row.note || "",

    createdAt:
      row.createdAt || null,

    updatedAt:
      row.updatedAt || null,
  };
});

const searchKeyword =
  String(params?.search || "")
    .trim()
    .toLowerCase();

if (!searchKeyword) {
  return mappedRows;
}

const normalizedPhoneKeyword =
  searchKeyword.replace(/\D/g, "");

return mappedRows.filter((row: any) => {
  const textTargets = [
    row.clientName,
    row.course,
    row.assigneeName,
    row.managerName,
    row.inputAddress,
    row.detailAddress,
  ]
    .map((value) =>
      String(value || "").toLowerCase()
    );

  if (
    textTargets.some((value) =>
      value.includes(searchKeyword)
    )
  ) {
    return true;
  }

  if (normalizedPhoneKeyword) {
    const rowPhone =
      String(row.phone || "")
        .replace(/\D/g, "");

    if (rowPhone.includes(normalizedPhoneKeyword)) {
      return true;
    }
  }

  return false;
});
}

export async function listPracticeSupportRequestsByStudent(
  studentId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  const [rows] = await db.execute(sql`
    SELECT
      psr.id,
      psr.studentId,
      psr.semesterId,
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
    LEFT JOIN students s
      ON s.id = psr.studentId
     AND s.organizationId = psr.organizationId
    LEFT JOIN plans p
      ON p.studentId = s.id
     AND p.organizationId = psr.organizationId
    LEFT JOIN users u
      ON u.id = psr.assigneeId
     AND u.organizationId = psr.organizationId
    WHERE psr.organizationId = ${organizationId}
      AND psr.studentId = ${studentId}
    ORDER BY psr.createdAt ASC, psr.id ASC
  `);

  return (rows as any[]).map((rawRow: any, index: number) => {
  const row =
    decryptPracticeSupportPersonalData(rawRow) as any;

  return {
    id: row.id ? Number(row.id) : null,
    practiceSupportRequestId: row.id ? Number(row.id) : null,
    hasPracticeSupportRequest: !!row.id,

    studentId: Number(row.studentId),
    semesterId: row.semesterId ? Number(row.semesterId) : null,
    semesterOrder: index + 1,

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
    };
});
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
 AND p.organizationId = psr.organizationId

LEFT JOIN users u
  ON u.id = COALESCE(psr.assigneeId, s.assigneeId)
 AND u.organizationId = psr.organizationId
    WHERE psr.id = ${id}
  AND psr.organizationId = ${organizationId}
  AND s.organizationId = ${organizationId}
LIMIT 1
  `);

  const rawRow = (rows as any[])[0];
if (!rawRow) return undefined;

const row =
  decryptPracticeSupportPersonalData(rawRow) as any;

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const preparedData =
  preparePracticeSupportPersonalData(data);

const result: any = await db
  .insert(practiceSupportRequests)
  .values({
    ...preparedData,

    feeAmount:
      data.feeAmount ?? "0",

    paymentStatus:
      data.paymentStatus ?? "미결제",

    coordinationStatus:
      data.coordinationStatus ?? "미섭외",
  } as any);

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
  if (!db) throwAppError(
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    "DB not available",
    500
  );

  const organizationId = requireOrganizationId(params?.organizationId);

  const [existing] = await db
    .select()
    .from(practiceSupportRequests)
    .where(
      and(
        eq(practiceSupportRequests.id, id),
        eq(practiceSupportRequests.organizationId, organizationId)
      )
    )
    .limit(1);

  const preparedData =
  preparePracticeSupportPersonalData(data);

await db
  .update(practiceSupportRequests)
  .set(preparedData as any)
    .where(
      and(
        eq(practiceSupportRequests.id, id),
        eq(practiceSupportRequests.organizationId, organizationId)
      )
    );

    if (data.coordinationStatus && existing?.studentId) {
    const nextStatus = String(data.coordinationStatus || "").trim();

    await db
      .update(plans)
      .set({
  hasPractice: true,
  practiceArranged: nextStatus === "섭외완료",
  practiceStatus: nextStatus || "미섭외",
  updatedAt: new Date(),
} as any)
      .where(
        and(
          eq(plans.studentId, Number(existing.studentId)),
          eq(plans.organizationId, organizationId)
        )
      );
  }

  await syncPracticeSupportSettlementItemByRequestId(id, undefined, {
    organizationId,
  });
}

export async function deletePracticeSupportRequest(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "실습배정지원 요청 데이터를 찾을 수 없습니다.",
  404
);
  }

  if (request.paymentStatus !== "결제") {
    throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "결제 완료된 건만 환불 요청할 수 있습니다.",
  400
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
   throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "실습배정지원 요청 데이터를 찾을 수 없습니다.",
  404
);
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
practiceSemesterLabel?: string | null;
practiceHours?: number | null;
practiceDate?: string | null;
includeEducationCenter?: boolean;
  includePracticeInstitution?: boolean;
  coordinationStatus?: "미섭외" | "섭외중" | "섭외완료";
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

const organizationId = requireOrganizationId(params.organizationId);

  const normalizedCourse = String(params.course || "").trim();

if (!normalizedCourse) {
  throwAppError(
    ERROR_CODES.INVALID_INPUT,
    "실습 희망과정은 필수입니다.",
    400
  );
}

const existing = await db
  .select()
  .from(practiceSupportRequests)
  .where(
    and(
      eq(practiceSupportRequests.organizationId, organizationId),
      eq(practiceSupportRequests.studentId, params.studentId),
      eq(practiceSupportRequests.course, normalizedCourse)
    )
  )
  .limit(1);

  const nextCoordinationStatus =
  params.coordinationStatus ?? "미섭외";

const payload: any = {
organizationId,
  studentId: params.studentId,
  semesterId: params.semesterId ?? null,
  assigneeId: params.assigneeId,
  clientName: params.clientName,
  phone: params.phone,
  course: normalizedCourse,
  inputAddress: params.inputAddress ?? null,
  detailAddress: params.detailAddress ?? null,
  assigneeName: params.assigneeName ?? null,
  managerName: params.managerName ?? null,
practiceSemesterLabel:
  params.practiceSemesterLabel?.trim() || null,
practiceHours: params.practiceHours ?? null,
practiceDate: params.practiceDate ?? null,
  includeEducationCenter: params.includeEducationCenter ?? true,
  includePracticeInstitution: params.includePracticeInstitution ?? true,
  coordinationStatus: params.coordinationStatus ?? "미섭외",
  paymentStatus: "미결제",
  feeAmount: "0",
};

const preparedPayload =
  preparePracticeSupportPersonalData(payload);

  if (existing[0]) {
    await db
      .update(practiceSupportRequests)
.set(preparedPayload as any)
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

  const result: any = await db
  .insert(practiceSupportRequests)
  .values(preparedPayload as any);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!target) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "Practice support request not found",
  404
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

  if (!request) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "Practice support request not found",
  404
);
  if (!institution) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "Practice institution not found",
  404
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

export async function listMergedPracticeInstitutions(params?: {
  organizationId?: number | null;
  institutionType?: "education" | "institution";
  categoryId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

    const masterConditions: any[] = [
    eq(practiceInstitutionMasters.isActive, true),

    sql`(
      ${practiceInstitutionMasters.selectionStatus} IS NULL
      OR TRIM(${practiceInstitutionMasters.selectionStatus}) = ''
      OR ${practiceInstitutionMasters.selectionStatus} NOT LIKE '%취소%'
    )`,

    sql`(
      ${practiceInstitutionMasters.selectionValidTo} IS NULL
      OR ${practiceInstitutionMasters.selectionValidTo} >= CURDATE()
    )`,
  ];

  if (params?.institutionType) {
    masterConditions.push(
      eq(practiceInstitutionMasters.institutionType, params.institutionType)
    );
  }

  if (params?.categoryId) {
    masterConditions.push(
      eq(practiceInstitutionMasters.categoryId, params.categoryId)
    );
  }

  const rows = await db
    .select({
      master: practiceInstitutionMasters,
      override: organizationPracticeInstitutionOverrides,
    })
    .from(practiceInstitutionMasters)
    .leftJoin(
      organizationPracticeInstitutionOverrides,
      and(
        eq(
          organizationPracticeInstitutionOverrides.masterId,
          practiceInstitutionMasters.id
        ),
        eq(
          organizationPracticeInstitutionOverrides.organizationId,
          organizationId
        )
      )
    )
    .where(and(...masterConditions))
    .orderBy(
      practiceInstitutionMasters.sortOrder,
      desc(practiceInstitutionMasters.createdAt)
    );

  const masterRows = rows
    .filter((row: any) => !row.override?.isHidden)
    .map((row: any) => {
      const master = row.master;
      const override = row.override;

      return {
        ...master,

        // 공용 master id와 회사별 custom id 충돌 방지
        id: -Number(master.id),

        sourceType: "master",
        masterId: master.id,
        overrideId: override?.id ?? null,

        associationManagementNo:
          master.associationManagementNo ?? null,

        selectionValidFrom:
          master.selectionValidFrom ?? null,

        selectionValidTo:
          master.selectionValidTo ?? null,

        selectionStatus:
          master.selectionStatus ?? null,

        name: override?.customName ?? master.name,
        phone: override?.customPhone ?? master.phone,
        address: override?.customAddress ?? master.address,
        detailAddress:
          override?.customDetailAddress ?? master.detailAddress,
        price: override?.customPrice ?? master.price,
        latitude: override?.customLatitude ?? master.latitude,
        longitude: override?.customLongitude ?? master.longitude,
        availableCourse:
          override?.customAvailableCourse ?? master.availableCourse,
        memo: override?.customMemo ?? master.memo,
practiceAvailabilityType:
  override?.practiceAvailabilityType ?? master.practiceAvailabilityType ?? "unknown",

        isInactive: override?.isInactive ?? false,
        inactiveReason: override?.inactiveReason ?? null,
        inactiveStartDate: override?.inactiveStartDate ?? null,
        inactiveEndDate: override?.inactiveEndDate ?? null,
        hideOnMapWhenInactive:
          override?.hideOnMapWhenInactive ?? true,

        isCustomized: Boolean(override),
      };
    });

  const customConditions: any[] = [
    eq(practiceInstitutions.organizationId, organizationId),
    eq(practiceInstitutions.isActive, true),
  ];

  if (params?.institutionType) {
    customConditions.push(
      eq(practiceInstitutions.institutionType, params.institutionType)
    );
  }

  if (params?.categoryId) {
    customConditions.push(
      eq(practiceInstitutions.categoryId, params.categoryId)
    );
  }

  const customRows = await db
    .select()
    .from(practiceInstitutions)
    .where(and(...customConditions))
    .orderBy(
      practiceInstitutions.sortOrder,
      desc(practiceInstitutions.createdAt)
    );

  return [
    ...masterRows,
        ...customRows.map((row: any) => ({
      ...row,

      sourceType: "organization",
      masterId: null,
      overrideId: null,

      associationManagementNo: null,
      selectionValidFrom: null,
      selectionValidTo: null,
      selectionStatus: null,

      isCustomized: true,
    })),
  ];
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);
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
  organizationId?: number | null;
  institutionType?: "education" | "institution";
  inactiveReason?: string | null;
  inactiveStartDate?: string | null;
  inactiveEndDate?: string | null;
  hideOnMapWhenInactive?: boolean;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

  const conditions: any[] = [
    eq(practiceInstitutions.organizationId, organizationId),
  ];

  if (params.institutionType) {
    conditions.push(
      eq(practiceInstitutions.institutionType, params.institutionType)
    );
  }

  await db
    .update(practiceInstitutions)
    .set({
      isInactive: true,
      inactiveReason: params.inactiveReason ?? "일괄 비활성화",
      inactiveStartDate: params.inactiveStartDate ?? null,
      inactiveEndDate: params.inactiveEndDate ?? null,
      hideOnMapWhenInactive: params.hideOnMapWhenInactive ?? true,
    } as any)
    .where(and(...conditions));

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

export async function listMergedPracticeEducationCenters(params?: {
  organizationId?: number | null;
  categoryId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const organizationId = requireOrganizationId(params?.organizationId);

  const masterConditions: any[] = [
    eq(practiceEducationCenterMasters.isActive, true),
  ];

  if (params?.categoryId) {
    masterConditions.push(
      eq(practiceEducationCenterMasters.categoryId, params.categoryId)
    );
  }

  const rows = await db
    .select({
      master: practiceEducationCenterMasters,
      override: organizationPracticeEducationCenterOverrides,
    })
    .from(practiceEducationCenterMasters)
    .leftJoin(
      organizationPracticeEducationCenterOverrides,
      and(
        eq(
          organizationPracticeEducationCenterOverrides.masterId,
          practiceEducationCenterMasters.id
        ),
        eq(
          organizationPracticeEducationCenterOverrides.organizationId,
          organizationId
        )
      )
    )
    .where(and(...masterConditions))
    .orderBy(
      practiceEducationCenterMasters.sortOrder,
      desc(practiceEducationCenterMasters.createdAt)
    );

  const masterRows = rows
    .filter((row: any) => !row.override?.isHidden)
    .map((row: any) => {
      const master = row.master;
      const override = row.override;

      return {
        ...master,

        // 공용 master id와 회사별 custom id 충돌 방지
        id: -Number(master.id),

        sourceType: "master",
        masterId: master.id,
        overrideId: override?.id ?? null,

        name: override?.customName ?? master.name,
        phone: override?.customPhone ?? master.phone,
        address: override?.customAddress ?? master.address,
        detailAddress:
          override?.customDetailAddress ?? master.detailAddress,
        feeAmount: override?.customFeeAmount ?? master.feeAmount,
        latitude: override?.customLatitude ?? master.latitude,
        longitude: override?.customLongitude ?? master.longitude,
        availableCourse:
          override?.customAvailableCourse ?? master.availableCourse,
        memo: override?.customMemo ?? master.memo,

isPartner: override?.isPartner ?? master.isPartner ?? false,
partnerPrice: override?.partnerPrice ?? master.partnerPrice ?? "0",

isInactive: override?.isInactive ?? false,
        inactiveReason: override?.inactiveReason ?? null,
        inactiveStartDate: override?.inactiveStartDate ?? null,
        inactiveEndDate: override?.inactiveEndDate ?? null,
        hideOnMapWhenInactive:
          override?.hideOnMapWhenInactive ?? true,

        isCustomized: Boolean(override),
      };
    });

  const customConditions: any[] = [
    eq(practiceEducationCenters.organizationId, organizationId),
    eq(practiceEducationCenters.isActive, true),
  ];

  if (params?.categoryId) {
    customConditions.push(
      eq(practiceEducationCenters.categoryId, params.categoryId)
    );
  }

  const customRows = await db
    .select()
    .from(practiceEducationCenters)
    .where(and(...customConditions))
    .orderBy(
      practiceEducationCenters.sortOrder,
      desc(practiceEducationCenters.createdAt)
    );

  return [
    ...masterRows,
    ...customRows.map((row: any) => ({
      ...row,
      sourceType: "organization",
      masterId: null,
      overrideId: null,
      isCustomized: true,
    })),
  ];
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

const organizationId = requireOrganizationId(data.organizationId);

  const result: any = await db.insert(practiceEducationCenters).values({
  ...data,
  organizationId,
  feeAmount: (data as any).feeAmount ?? "0",
  partnerPrice: (data as any).partnerPrice ?? "0",
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  organizationId?: number | null;
  inactiveReason?: string | null;
  inactiveStartDate?: string | null;
  inactiveEndDate?: string | null;
  hideOnMapWhenInactive?: boolean;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(practiceEducationCenters)
    .set({
      isInactive: true,
      inactiveReason: params?.inactiveReason ?? "일괄 비활성화",
      inactiveStartDate: params?.inactiveStartDate ?? null,
      inactiveEndDate: params?.inactiveEndDate ?? null,
      hideOnMapWhenInactive: params?.hideOnMapWhenInactive ?? true,
    } as any)
    .where(eq(practiceEducationCenters.organizationId, organizationId));

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
export async function updatePracticeInstitutionPracticeAvailability(
  id: number,
  practiceAvailabilityType: "unknown" | "weekday" | "weekend" | "both",
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) throwAppError(
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    "DB not available",
    500
  );

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(practiceInstitutions)
    .set({ practiceAvailabilityType } as any)
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

export async function updatePracticeEducationCenterPartner(
  id: number,
  isPartner: boolean,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params?.organizationId);

  await db
    .update(practiceEducationCenters)
    .set({
      isPartner,
    } as any)
    .where(
      and(
        eq(practiceEducationCenters.id, id),
        eq(practiceEducationCenters.organizationId, organizationId)
      )
    );
}

async function getPracticeInstitutionOverride(params: {
  organizationId?: number | null;
  masterId: number;
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select()
    .from(organizationPracticeInstitutionOverrides)
    .where(
      and(
        eq(organizationPracticeInstitutionOverrides.organizationId, organizationId),
        eq(organizationPracticeInstitutionOverrides.masterId, Number(params.masterId))
      )
    )
    .limit(1);

  return rows[0] || null;
}

export async function upsertPracticeInstitutionOverride(params: {
  organizationId?: number | null;
  masterId: number;
  data: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    detailAddress?: string | null;
    price?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    availableCourse?: string | null;
    memo?: string | null;
  };
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);
  const masterId = Number(params.masterId);

  const existing = await getPracticeInstitutionOverride({
    organizationId,
    masterId,
  });

  const value: any = {
    organizationId,
    masterId,

    customName: params.data.name ?? undefined,
    customPhone: params.data.phone ?? undefined,
    customAddress: params.data.address ?? undefined,
    customDetailAddress: params.data.detailAddress ?? undefined,
    customPrice: params.data.price ?? undefined,
    customLatitude: params.data.latitude ?? undefined,
    customLongitude: params.data.longitude ?? undefined,
    customAvailableCourse: params.data.availableCourse ?? undefined,
    customMemo: params.data.memo ?? undefined,
  };

  if (existing) {
    await db
      .update(organizationPracticeInstitutionOverrides)
      .set(value)
      .where(
        and(
          eq(organizationPracticeInstitutionOverrides.id, existing.id),
          eq(organizationPracticeInstitutionOverrides.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db
    .insert(organizationPracticeInstitutionOverrides)
    .values({
      ...value,
      isHidden: false,
      isInactive: false,
    });

  return getInsertId(result);
}

export async function updatePracticeInstitutionAvailabilityOverride(params: {
  organizationId?: number | null;
  masterId: number;
  isInactive: boolean;
  inactiveReason?: string | null;
  inactiveStartDate?: string | null;
  inactiveEndDate?: string | null;
  hideOnMapWhenInactive?: boolean | null;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);
  const masterId = Number(params.masterId);

  const existing = await getPracticeInstitutionOverride({
    organizationId,
    masterId,
  });

  const value: any = {
    organizationId,
    masterId,
    isInactive: params.isInactive,
    inactiveReason: params.inactiveReason ?? null,
    inactiveStartDate: params.inactiveStartDate ?? null,
    inactiveEndDate: params.inactiveEndDate ?? null,
    hideOnMapWhenInactive: params.hideOnMapWhenInactive ?? true,
  };

  if (existing) {
    await db
      .update(organizationPracticeInstitutionOverrides)
      .set(value)
      .where(
        and(
          eq(organizationPracticeInstitutionOverrides.id, existing.id),
          eq(organizationPracticeInstitutionOverrides.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db
    .insert(organizationPracticeInstitutionOverrides)
    .values({
      ...value,
      isHidden: false,
    });

  return getInsertId(result);
}

export async function updatePracticeInstitutionPracticeAvailabilityOverride(params: {
  organizationId?: number | null;
  masterId: number;
  practiceAvailabilityType: "unknown" | "weekday" | "weekend" | "both";
}) {
  const db = await getDb();
  if (!db) throwAppError(
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    "DB not available",
    500
  );

  const organizationId = requireOrganizationId(params.organizationId);
  const masterId = Number(params.masterId);

  const existing = await getPracticeInstitutionOverride({
    organizationId,
    masterId,
  });

  if (existing) {
    await db
      .update(organizationPracticeInstitutionOverrides)
      .set({
        practiceAvailabilityType: params.practiceAvailabilityType,
      } as any)
      .where(
        and(
          eq(organizationPracticeInstitutionOverrides.id, existing.id),
          eq(organizationPracticeInstitutionOverrides.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db
    .insert(organizationPracticeInstitutionOverrides)
    .values({
      organizationId,
      masterId,
      practiceAvailabilityType: params.practiceAvailabilityType,
      isHidden: false,
      isInactive: false,
    } as any);

  return getInsertId(result);
}

export async function hidePracticeInstitutionOverride(params: {
  organizationId?: number | null;
  masterId: number;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);
  const masterId = Number(params.masterId);

  const existing = await getPracticeInstitutionOverride({
    organizationId,
    masterId,
  });

  if (existing) {
    await db
      .update(organizationPracticeInstitutionOverrides)
      .set({
        isHidden: true,
      } as any)
      .where(
        and(
          eq(organizationPracticeInstitutionOverrides.id, existing.id),
          eq(organizationPracticeInstitutionOverrides.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db
    .insert(organizationPracticeInstitutionOverrides)
    .values({
      organizationId,
      masterId,
      isHidden: true,
      isInactive: false,
    } as any);

  return getInsertId(result);
}

export async function bulkDeactivatePracticeInstitutionOverrides(params: {
  organizationId?: number | null;
  institutionType?: "education" | "institution";
  categoryId?: number | null;
  inactiveReason?: string | null;
  inactiveStartDate?: string | null;
  inactiveEndDate?: string | null;
  hideOnMapWhenInactive?: boolean;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

  const conditions: any[] = [
    eq(practiceInstitutionMasters.isActive, true),
  ];

  if (params.institutionType) {
    conditions.push(eq(practiceInstitutionMasters.institutionType, params.institutionType));
  }

  if (params.categoryId) {
    conditions.push(eq(practiceInstitutionMasters.categoryId, params.categoryId));
  }

  const masters = await db
    .select()
    .from(practiceInstitutionMasters)
    .where(and(...conditions));

  for (const master of masters as any[]) {
    await updatePracticeInstitutionAvailabilityOverride({
      organizationId,
      masterId: Number(master.id),
      isInactive: true,
      inactiveReason: params.inactiveReason ?? "일괄 비활성화",
      inactiveStartDate: params.inactiveStartDate ?? null,
      inactiveEndDate: params.inactiveEndDate ?? null,
      hideOnMapWhenInactive: params.hideOnMapWhenInactive ?? true,
    });
  }

  return {
    success: true,
    total: masters.length,
  };
}

async function getPracticeEducationCenterOverride(params: {
  organizationId?: number | null;
  masterId: number;
}) {
  const db = await getDb();
  if (!db) return null;

  const organizationId = requireOrganizationId(params.organizationId);

  const rows = await db
    .select()
    .from(organizationPracticeEducationCenterOverrides)
    .where(
      and(
        eq(organizationPracticeEducationCenterOverrides.organizationId, organizationId),
        eq(organizationPracticeEducationCenterOverrides.masterId, Number(params.masterId))
      )
    )
    .limit(1);

  return rows[0] || null;
}

export async function upsertPracticeEducationCenterOverride(params: {
  organizationId?: number | null;
  masterId: number;
  data: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    detailAddress?: string | null;
    feeAmount?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    availableCourse?: string | null;
    memo?: string | null;
  };
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);
  const masterId = Number(params.masterId);

  const existing = await getPracticeEducationCenterOverride({
    organizationId,
    masterId,
  });

  const value: any = {
    organizationId,
    masterId,

    customName: params.data.name ?? undefined,
    customPhone: params.data.phone ?? undefined,
    customAddress: params.data.address ?? undefined,
    customDetailAddress: params.data.detailAddress ?? undefined,
    customFeeAmount: params.data.feeAmount ?? undefined,
    customLatitude: params.data.latitude ?? undefined,
    customLongitude: params.data.longitude ?? undefined,
    customAvailableCourse: params.data.availableCourse ?? undefined,
    customMemo: params.data.memo ?? undefined,
  };

  if (existing) {
    await db
      .update(organizationPracticeEducationCenterOverrides)
      .set(value)
      .where(
        and(
          eq(organizationPracticeEducationCenterOverrides.id, existing.id),
          eq(organizationPracticeEducationCenterOverrides.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db
    .insert(organizationPracticeEducationCenterOverrides)
    .values({
      ...value,
      isHidden: false,
      isInactive: false,
    });

  return getInsertId(result);
}

export async function updatePracticeEducationCenterAvailabilityOverride(params: {
  organizationId?: number | null;
  masterId: number;
  isInactive: boolean;
  inactiveReason?: string | null;
  inactiveStartDate?: string | null;
  inactiveEndDate?: string | null;
  hideOnMapWhenInactive?: boolean | null;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);
  const masterId = Number(params.masterId);

  const existing = await getPracticeEducationCenterOverride({
    organizationId,
    masterId,
  });

  const value: any = {
    organizationId,
    masterId,
    isInactive: params.isInactive,
    inactiveReason: params.inactiveReason ?? null,
    inactiveStartDate: params.inactiveStartDate ?? null,
    inactiveEndDate: params.inactiveEndDate ?? null,
    hideOnMapWhenInactive: params.hideOnMapWhenInactive ?? true,
  };

  if (existing) {
    await db
      .update(organizationPracticeEducationCenterOverrides)
      .set(value)
      .where(
        and(
          eq(organizationPracticeEducationCenterOverrides.id, existing.id),
          eq(organizationPracticeEducationCenterOverrides.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db
    .insert(organizationPracticeEducationCenterOverrides)
    .values({
      ...value,
      isHidden: false,
    });

  return getInsertId(result);
}

export async function updatePracticeEducationCenterPartnerOverride(params: {
  organizationId?: number | null;
  masterId: number;
  isPartner: boolean;
}) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params.organizationId);
  const masterId = Number(params.masterId);

  const existing = await getPracticeEducationCenterOverride({
    organizationId,
    masterId,
  });

  if (existing) {
    await db
      .update(organizationPracticeEducationCenterOverrides)
      .set({
        isPartner: params.isPartner,
      } as any)
      .where(
        and(
          eq(organizationPracticeEducationCenterOverrides.id, existing.id),
          eq(organizationPracticeEducationCenterOverrides.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db
    .insert(organizationPracticeEducationCenterOverrides)
    .values({
      organizationId,
      masterId,
      isPartner: params.isPartner,
      isHidden: false,
      isInactive: false,
    } as any);

  return getInsertId(result);
}

export async function updatePracticeEducationCenterPartnerPrice(
  id: number,
  params?: {
    organizationId?: number | null;
    partnerPrice?: number | string | null;
  }
) {
  const db = await getDb();
  if (!db) {
    throwAppError(ERROR_CODES.INTERNAL_SERVER_ERROR, "DB not available", 500);
  }

  const organizationId = requireOrganizationId(params?.organizationId);
  const partnerPrice = toNumber(params?.partnerPrice ?? 0);

  await db
    .update(practiceEducationCenters)
    .set({
      partnerPrice: String(partnerPrice),
    } as any)
    .where(
      and(
        eq(practiceEducationCenters.id, id),
        eq(practiceEducationCenters.organizationId, organizationId)
      )
    );

  return { success: true };
}

export async function updatePracticeEducationCenterPartnerPriceOverride(params: {
  organizationId?: number | null;
  masterId: number;
  partnerPrice?: number | string | null;
}) {
  const db = await getDb();
  if (!db) {
    throwAppError(ERROR_CODES.INTERNAL_SERVER_ERROR, "DB not available", 500);
  }

  const organizationId = requireOrganizationId(params.organizationId);
  const masterId = Number(params.masterId);
  const partnerPrice = toNumber(params.partnerPrice ?? 0);

  const existing = await getPracticeEducationCenterOverride({
    organizationId,
    masterId,
  });

  if (existing) {
    await db
      .update(organizationPracticeEducationCenterOverrides)
      .set({
        partnerPrice: String(partnerPrice),
      } as any)
      .where(
        and(
          eq(organizationPracticeEducationCenterOverrides.id, existing.id),
          eq(organizationPracticeEducationCenterOverrides.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db
    .insert(organizationPracticeEducationCenterOverrides)
    .values({
      organizationId,
      masterId,
      partnerPrice: String(partnerPrice),
      isHidden: false,
      isInactive: false,
    } as any);

  return getInsertId(result);
}

export async function hidePracticeEducationCenterOverride(params: {
  organizationId?: number | null;
  masterId: number;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);
  const masterId = Number(params.masterId);

  const existing = await getPracticeEducationCenterOverride({
    organizationId,
    masterId,
  });

  if (existing) {
    await db
      .update(organizationPracticeEducationCenterOverrides)
      .set({
        isHidden: true,
      } as any)
      .where(
        and(
          eq(organizationPracticeEducationCenterOverrides.id, existing.id),
          eq(organizationPracticeEducationCenterOverrides.organizationId, organizationId)
        )
      );

    return existing.id;
  }

  const result: any = await db
    .insert(organizationPracticeEducationCenterOverrides)
    .values({
      organizationId,
      masterId,
      isHidden: true,
      isInactive: false,
    } as any);

  return getInsertId(result);
}

export async function bulkDeactivatePracticeEducationCenterOverrides(params: {
  organizationId?: number | null;
  categoryId?: number | null;
  inactiveReason?: string | null;
  inactiveStartDate?: string | null;
  inactiveEndDate?: string | null;
  hideOnMapWhenInactive?: boolean;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

  const conditions: any[] = [
    eq(practiceEducationCenterMasters.isActive, true),
  ];

  if (params.categoryId) {
    conditions.push(eq(practiceEducationCenterMasters.categoryId, params.categoryId));
  }

  const masters = await db
    .select()
    .from(practiceEducationCenterMasters)
    .where(and(...conditions));

  for (const master of masters as any[]) {
    await updatePracticeEducationCenterAvailabilityOverride({
      organizationId,
      masterId: Number(master.id),
      isInactive: true,
      inactiveReason: params.inactiveReason ?? "일괄 비활성화",
      inactiveStartDate: params.inactiveStartDate ?? null,
      inactiveEndDate: params.inactiveEndDate ?? null,
      hideOnMapWhenInactive: params.hideOnMapWhenInactive ?? true,
    });
  }

  return {
    success: true,
    total: masters.length,
  };
}

export async function deletePracticeEducationCenter(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "Student not found",
  404
);

  const studentLat = toNullableNumber((student as any).latitude);
  const studentLng = toNullableNumber((student as any).longitude);

  if (studentLat === null || studentLng === null) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "Student latitude/longitude not found",
  404
);

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
export async function listJobSupportRequests(
  assigneeId?: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId =
    requireOrganizationId(
      params?.organizationId
    );

  const conditions: any[] = [
    eq(
      jobSupportRequests.organizationId,
      organizationId
    ),
  ];

  if (assigneeId) {
    conditions.push(
      eq(
        jobSupportRequests.assigneeId,
        assigneeId
      )
    );
  }

  const rows = await db
    .select()
    .from(jobSupportRequests)
    .where(and(...conditions))
    .orderBy(
      desc(jobSupportRequests.createdAt)
    );

  return rows.map((row: any) =>
    decryptJobSupportPersonalData(row)
  );
}

export async function listJobSupportRequestsByStudent(
  studentId: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return [];

  const organizationId =
    requireOrganizationId(
      params?.organizationId
    );

  const rows = await db
    .select()
    .from(jobSupportRequests)
    .where(
      and(
        eq(
          jobSupportRequests.studentId,
          studentId
        ),
        eq(
          jobSupportRequests.organizationId,
          organizationId
        )
      )
    )
    .orderBy(
      desc(jobSupportRequests.createdAt)
    );

  return rows.map((row: any) =>
    decryptJobSupportPersonalData(row)
  );
}

export async function createJobSupportRequest(data: InsertJobSupportRequest) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId =
  requireOrganizationId(
    (data as any).organizationId
  );

const preparedData =
  prepareJobSupportPersonalData(data);

const result: any = await db
  .insert(jobSupportRequests)
  .values({
    ...preparedData,
    organizationId,

    feeAmount:
      data.feeAmount ?? "0",

    paymentStatus:
      data.paymentStatus ?? "결제대기",
  } as any);

  return getInsertId(result);
}

export async function updateJobSupportRequest(
  id: number,
  data: Partial<InsertJobSupportRequest>,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

 const organizationId =
  requireOrganizationId(
    params?.organizationId ??
    (data as any).organizationId
  );

const preparedData =
  prepareJobSupportPersonalData(data);

await db
  .update(jobSupportRequests)
  .set(preparedData as any)
  .where(
    and(
      eq(jobSupportRequests.id, id),
      eq(
        jobSupportRequests.organizationId,
        organizationId
      )
    )
  );
}

export async function deleteJobSupportRequest(
  id: number,
  params?: {
    organizationId?: number | null;
  }
) {
  const db = await getDb();

  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId =
    requireOrganizationId(
      params?.organizationId
    );

  await db
    .delete(jobSupportRequests)
    .where(
      and(
        eq(jobSupportRequests.id, id),
        eq(
          jobSupportRequests.organizationId,
          organizationId
        )
      )
    );
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "유저를 찾을 수 없습니다.",
  404
);
  }
  return user;
}

export async function assertTargetUserNotProtectedByActor(params: {
  actorRole: "staff" | "admin" | "host" | "superhost";
  targetUserId: number;
}) {
  const target = await getUserById(params.targetUserId);
  if (!target) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "대상 유저를 찾을 수 없습니다.",
  404
);
  }

  if (target.role === "superhost" && params.actorRole !== "superhost") {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "슈퍼호스트 계정은 수정할 수 없습니다.",
  403
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

export async function getUserTeamMemberIds(
  userId: number,
  params?: { organizationId?: number | null }
) {
  const db = await getDb();
  if (!db) return [Number(userId)];

  const organizationId = requireOrganizationId(params?.organizationId);
  const normalizedUserId = Number(userId);

  const mapping = await getUserOrgMapping(normalizedUserId, {
    organizationId,
  });

  const teamId = Number(mapping?.teamId || 0);

  // 팀이 설정되지 않은 관리자는 본인 DB만 조회
  if (!teamId) {
    return [normalizedUserId];
  }

  const rows = await db
    .select({
      userId: userOrgMappings.userId,
    })
    .from(userOrgMappings)
    .where(
      and(
        eq(userOrgMappings.organizationId, organizationId),
        eq(userOrgMappings.teamId, teamId)
      )
    );

  const userIds = rows
    .map((row) => Number(row.userId))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (!userIds.includes(normalizedUserId)) {
    userIds.push(normalizedUserId);
  }

  return Array.from(new Set(userIds));
}

export async function upsertUserOrgMapping(data: {
  organizationId?: number | null;
  userId: number;
  teamId?: number | null;
  positionId?: number | null;
  sortOrder?: number | null;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(data.organizationId);

  await assertUserExists(data.userId);

  if (data.teamId) {
    const team = await getTeam(data.teamId, { organizationId });
    if (!team) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "팀을 찾을 수 없습니다.",
  404
);
  }

  if (data.positionId) {
    const position = await getPosition(data.positionId, { organizationId });
    if (!position) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "직급을 찾을 수 없습니다.",
  404
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "슈퍼호스트 권한은 변경할 수 없습니다.",
  403
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "자기 자신과의 채팅방은 만들 수 없습니다.",
  400
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "해당 채팅방에 접근 권한이 없습니다.",
  403
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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

  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "첨부파일을 추가할 메시지를 찾을 수 없습니다.",
  404
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

const organizationId = requireOrganizationId(params?.organizationId);

  const today = getTodayDateStringKST();
  const existing = await getTodayAttendanceRecord(userId, {
  organizationId,
});

  if (existing?.clockInAt) {
    throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  "이미 오늘 출근 처리되었습니다.",
  409
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

const organizationId = requireOrganizationId(params?.organizationId);

  const todayRow = await getTodayAttendanceRecord(userId, {
  organizationId,
});

  if (!todayRow?.clockInAt) {
    throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "출근 기록이 없어 퇴근 처리할 수 없습니다.",
  400
);
  }

  if (todayRow?.clockOutAt) {
    throwAppError(
  ERROR_CODES.DUPLICATE_RESOURCE,
  "이미 오늘 퇴근 처리되었습니다.",
  409
);
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
  a.organizationId,
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
  a.organizationId,
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB 연결이 없습니다.",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB 연결이 없습니다.",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "근태 기록을 찾을 수 없습니다.",
  404
);
  }

  // admin은 자기 팀만 수정 가능
  if (params.actorRole === "admin") {
   const myTeamId = await getMyTeamId(params.actorUserId, {
  organizationId,
});
    if (!myTeamId) {
      throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "관리자 팀 정보를 찾을 수 없습니다.",
  404
);
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
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "자기 팀 직원의 근태만 수정할 수 있습니다.",
  403
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "근태 기록을 찾을 수 없습니다.",
  404
);
}

if (params.actorRole === "admin") {
  const myTeamId = await getMyTeamId(params.actorUserId, {
  organizationId,
});
  if (!myTeamId) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "관리자 팀 정보를 찾을 수 없습니다.",
  404
);
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
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "자기 팀 직원의 근태만 수정할 수 있습니다.",
  403
);
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
u.birthday,
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "일정을 찾을 수 없습니다.",
  404
);
  }

  const isOwner = Number(row.ownerUserId) === Number(userId);
  const isPrivileged = role === "host" || role === "superhost";

  if (!isOwner && !isPrivileged) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "수정 권한이 없습니다.",
  403
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "일정을 찾을 수 없습니다.",
  404
);
  }

  const isOwner = Number(row.ownerUserId) === Number(userId);
  const isPrivileged = role === "host" || role === "superhost";

  if (!isOwner && !isPrivileged) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "삭제 권한이 없습니다.",
  403
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

  const documentNumber = await getNextApprovalDocumentNumber(params.formType, {
    organizationId,
  });

  const setting = await getApprovalSetting(params.formType, {
    organizationId,
  });

  if (params.formType === "attendance" && !params.targetDate) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "근태 문서는 시행일자 필수",
  400
);
  }

  if (
    params.formType === "business_trip" &&
    !params.targetDate &&
    !(params.startDate && params.endDate)
  ) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "출장 문서는 시행일자 또는 시작일/종료일이 필요합니다.",
  400
);
  }

  const approverIds = [
    setting?.firstApproverUserId,
    setting?.secondApproverUserId,
    setting?.thirdApproverUserId,
  ].filter((x) => Number(x || 0) > 0);

  if (!approverIds.length) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "전자결재 승인자가 설정되지 않았습니다.",
  404
);
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
if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

const organizationId = requireOrganizationId(params.organizationId);

const detail = await getApprovalDocument(params.documentId, {
  organizationId,
});
  if (!detail?.document) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "전자결재 문서를 찾을 수 없습니다.",
  404
);

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

 const applyDate = String(doc.targetDate || doc.startDate || doc.endDate || "").slice(0, 10);

if (!applyDate) {
   throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "근태 반영 대상 날짜가 없습니다.",
  400
);
  }

  const [rows] = await db.execute(sql`
    SELECT *
    FROM attendance_records
    WHERE userId = ${doc.applicantUserId}
      AND workDate = ${applyDate}
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

  const detail = await getApprovalDocument(params.documentId, {
    organizationId,
  });
  if (!detail?.document) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "문서를 찾을 수 없습니다.",
  404
);

  const doc: any = detail.document;

  const currentLine = (detail.lines || []).find(
    (line: any) =>
      Number(line.approverUserId) === Number(params.approverUserId) &&
      Number(line.stepOrder) === Number(doc.currentStepOrder) &&
      line.stepStatus === "pending"
  );

  if (!currentLine) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "현재 승인 권한이 없습니다.",
  403
);
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
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

  const detail = await getApprovalDocument(params.documentId, {
    organizationId,
  });
  if (!detail?.document) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "문서를 찾을 수 없습니다.",
  404
);

  const doc: any = detail.document;

  const currentLine = (detail.lines || []).find(
    (line: any) =>
      Number(line.approverUserId) === Number(params.approverUserId) &&
      Number(line.stepOrder) === Number(doc.currentStepOrder) &&
      line.stepStatus === "pending"
  );

  if (!currentLine) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "현재 반려 권한이 없습니다.",
  403
);
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

  // 1. 기존 템플릿 가져오기
  const templates = await db
    .select()
    .from(courseTemplate); // 기존 테이블명

  if (!templates.length) {
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
}

export async function getOrganizationMonitoringSummary() {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const [rows] = await db.execute(sql`
    SELECT
      o.id,
      o.name,
      o.slug,
      o.status,
      o.planCode,
      o.maxUsers,
      o.maxStudents,
      o.maxStorageMb,
      o.createdAt,

      COALESCE(u.userCount, 0) as userCount,
      COALESCE(s.studentCount, 0) as studentCount,
      COALESCE(c.consultationCount, 0) as consultationCount,
      COALESCE(si.settlementItemCount, 0) as settlementItemCount,
      COALESCE(ps.practiceSupportCount, 0) as practiceSupportCount,
      COALESCE(pc.privateCertificateCount, 0) as privateCertificateCount,
      COALESCE(b.backupCount, 0) as backupCount,
COALESCE(b.backupStorageBytes, 0) as backupStorageBytes,
ROUND(COALESCE(b.backupStorageBytes, 0) / 1024 / 1024, 2) as backupStorageMb,
b.latestBackupAt,

      (
        COALESCE(u.userCount, 0) +
        COALESCE(s.studentCount, 0) +
        COALESCE(c.consultationCount, 0) +
        COALESCE(si.settlementItemCount, 0) +
        COALESCE(ps.practiceSupportCount, 0) +
        COALESCE(pc.privateCertificateCount, 0) +
        COALESCE(b.backupCount, 0)
      ) as totalTrackedRows

    FROM organizations o

    LEFT JOIN (
      SELECT organizationId, COUNT(*) as userCount
      FROM users
      GROUP BY organizationId
    ) u ON u.organizationId = o.id

    LEFT JOIN (
      SELECT organizationId, COUNT(*) as studentCount
      FROM students
      WHERE deletedAt IS NULL
      GROUP BY organizationId
    ) s ON s.organizationId = o.id

    LEFT JOIN (
      SELECT organizationId, COUNT(*) as consultationCount
      FROM consultations
      GROUP BY organizationId
    ) c ON c.organizationId = o.id

    LEFT JOIN (
      SELECT organizationId, COUNT(*) as settlementItemCount
      FROM settlement_items
      GROUP BY organizationId
    ) si ON si.organizationId = o.id

    LEFT JOIN (
      SELECT organizationId, COUNT(*) as practiceSupportCount
      FROM practice_support_requests
      GROUP BY organizationId
    ) ps ON ps.organizationId = o.id

    LEFT JOIN (
      SELECT organizationId, COUNT(*) as privateCertificateCount
      FROM private_certificate_requests
      GROUP BY organizationId
    ) pc ON pc.organizationId = o.id

    LEFT JOIN (
  SELECT
    organizationId,
    COUNT(*) as backupCount,
    COALESCE(SUM(fileSizeBytes), 0) as backupStorageBytes,
    MAX(createdAt) as latestBackupAt
  FROM organization_backups
  GROUP BY organizationId
) b ON b.organizationId = o.id

    ORDER BY totalTrackedRows DESC, o.id DESC
  `);

const [dbSizeRows] = await db.execute(sql`
  SELECT
    table_name as tableName,
    data_length + index_length as tableBytes
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
`);

const [totalCountRows] = await db.execute(sql`
  SELECT 'users' as tableName, COUNT(*) as totalRowCount FROM users
  UNION ALL
  SELECT 'consultations', COUNT(*) FROM consultations
  UNION ALL
  SELECT 'students', COUNT(*) FROM students WHERE deletedAt IS NULL
  UNION ALL
  SELECT 'settlement_items', COUNT(*) FROM settlement_items
  UNION ALL
  SELECT 'practice_support_requests', COUNT(*) FROM practice_support_requests
  UNION ALL
  SELECT 'private_certificate_requests', COUNT(*) FROM private_certificate_requests
  UNION ALL
  SELECT 'organization_backups', COUNT(*) FROM organization_backups
`);

const dbSizeMap = new Map<string, number>();
for (const row of dbSizeRows as any[]) {
  dbSizeMap.set(String(row.tableName), Number(row.tableBytes || 0));
}

const totalCountMap = new Map<string, number>();
for (const row of totalCountRows as any[]) {
  totalCountMap.set(String(row.tableName), Number(row.totalRowCount || 0));
}

function estimateTableBytes(tableName: string, orgRowCount: any) {
  const orgCount = Number(orgRowCount || 0);
  const totalCount = totalCountMap.get(tableName) || 0;
  const tableBytes = dbSizeMap.get(tableName) || 0;

  if (orgCount <= 0 || totalCount <= 0 || tableBytes <= 0) return 0;

  return Math.round(tableBytes * (orgCount / totalCount));
}

const summaryRows = (rows as any[]).map((row: any) => {
  const estimatedDatabaseBytes =
    estimateTableBytes("users", row.userCount) +
    estimateTableBytes("consultations", row.consultationCount) +
    estimateTableBytes("students", row.studentCount) +
    estimateTableBytes("settlement_items", row.settlementItemCount) +
    estimateTableBytes("practice_support_requests", row.practiceSupportCount) +
    estimateTableBytes("private_certificate_requests", row.privateCertificateCount) +
    estimateTableBytes("organization_backups", row.backupCount);

  const estimatedDatabaseMb = Number(
    (estimatedDatabaseBytes / 1024 / 1024).toFixed(2)
  );

  const totalEstimatedMb =
    estimatedDatabaseMb + Number(row.backupStorageMb || 0);

  return {
    ...row,
    estimatedDatabaseBytes,
    estimatedDatabaseMb,
    totalEstimatedMb,
  };
});

  return summaryRows;
}

export async function getOrganizationMonitoringDetail(params: {
  organizationId: number;
}) {
  const db = await getDb();
  if (!db) throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "DB not available",
  500
);

  const organizationId = requireOrganizationId(params.organizationId);

  const [orgRows] = await db.execute(sql`
    SELECT
      id,
      name,
      slug,
      status,
      planCode,
      maxUsers,
      maxStudents,
      maxStorageMb,
      createdAt
    FROM organizations
    WHERE id = ${organizationId}
    LIMIT 1
  `);

  const organization = (orgRows as any[])?.[0];

  if (!organization) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "회사를 찾을 수 없습니다.",
  404
);
  }

  const [countRows] = await db.execute(sql`
    SELECT 'users' as tableName, COUNT(*) as rowCount FROM users WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'consultations', COUNT(*) FROM consultations WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'students', COUNT(*) FROM students WHERE organizationId = ${organizationId} AND deletedAt IS NULL
    UNION ALL
    SELECT 'semesters', COUNT(*) FROM semesters WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'plans', COUNT(*) FROM plans WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'plan_semesters', COUNT(*) FROM plan_semesters WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'transfer_subjects', COUNT(*) FROM transfer_subjects WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'refunds', COUNT(*) FROM refunds WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'settlement_items', COUNT(*) FROM settlement_items WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'practice_support_requests', COUNT(*) FROM practice_support_requests WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'private_certificate_requests', COUNT(*) FROM private_certificate_requests WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'organization_backups', COUNT(*) FROM organization_backups WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'audit_logs', COUNT(*) FROM audit_logs WHERE organizationId = ${organizationId}
    UNION ALL
    SELECT 'student_audit_logs', COUNT(*) FROM student_audit_logs WHERE organizationId = ${organizationId}
  `);

  const [backupRows] = await db.execute(sql`
    SELECT
      id,
      backupType,
      status,
      fileSizeBytes,
      tableCount,
      rowCount,
      createdAt,
      completedAt,
      restoredAt
    FROM organization_backups
    WHERE organizationId = ${organizationId}
    ORDER BY createdAt DESC
    LIMIT 10
  `);

const [usageRows] = await db.execute(sql`
  SELECT
    COALESCE(SUM(fileSizeBytes), 0) as backupStorageBytes
  FROM organization_backups
  WHERE organizationId = ${organizationId}
`);

const [dbSizeRows] = await db.execute(sql`
  SELECT
    table_name as tableName,
    data_length + index_length as tableBytes
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
`);

const [totalCountRows] = await db.execute(sql`
  SELECT 'users' as tableName, COUNT(*) as totalRowCount FROM users
  UNION ALL
  SELECT 'consultations', COUNT(*) FROM consultations
  UNION ALL
  SELECT 'students', COUNT(*) FROM students WHERE deletedAt IS NULL
  UNION ALL
  SELECT 'semesters', COUNT(*) FROM semesters
  UNION ALL
  SELECT 'plans', COUNT(*) FROM plans
  UNION ALL
  SELECT 'plan_semesters', COUNT(*) FROM plan_semesters
  UNION ALL
  SELECT 'transfer_subjects', COUNT(*) FROM transfer_subjects
  UNION ALL
  SELECT 'refunds', COUNT(*) FROM refunds
  UNION ALL
  SELECT 'settlement_items', COUNT(*) FROM settlement_items
  UNION ALL
  SELECT 'practice_support_requests', COUNT(*) FROM practice_support_requests
  UNION ALL
  SELECT 'private_certificate_requests', COUNT(*) FROM private_certificate_requests
  UNION ALL
  SELECT 'organization_backups', COUNT(*) FROM organization_backups
  UNION ALL
  SELECT 'audit_logs', COUNT(*) FROM audit_logs
  UNION ALL
  SELECT 'student_audit_logs', COUNT(*) FROM student_audit_logs
`);

const backupStorageBytes = Number((usageRows as any)?.[0]?.backupStorageBytes || 0);

const dbSizeMap = new Map<string, number>();

for (const row of dbSizeRows as any[]) {
  dbSizeMap.set(String(row.tableName), Number(row.tableBytes || 0));
}

const totalCountMap = new Map<string, number>();

for (const row of totalCountRows as any[]) {
  totalCountMap.set(String(row.tableName), Number(row.totalRowCount || 0));
}

const tableCountsList = countRows as any[];

const estimatedDatabaseBytes = tableCountsList.reduce((sum, row) => {
  const tableName = String(row.tableName || "");
  const orgRowCount = Number(row.rowCount || 0);
  const totalRowCount = totalCountMap.get(tableName) || 0;
  const tableBytes = dbSizeMap.get(tableName) || 0;

  if (orgRowCount <= 0 || totalRowCount <= 0 || tableBytes <= 0) {
    return sum;
  }

  return sum + Math.round(tableBytes * (orgRowCount / totalRowCount));
}, 0);

 return {
  organization,
  tableCounts: countRows as any[],
  backups: backupRows as any[],
  usage: {
  backupStorageBytes,
  backupStorageMb: Number((backupStorageBytes / 1024 / 1024).toFixed(2)),

  estimatedDatabaseBytes,
  estimatedDatabaseMb: Number((estimatedDatabaseBytes / 1024 / 1024).toFixed(2)),

  totalEstimatedBytes: backupStorageBytes + estimatedDatabaseBytes,
  totalEstimatedMb: Number(
    ((backupStorageBytes + estimatedDatabaseBytes) / 1024 / 1024).toFixed(2)
  ),
},
};
}
export async function getSemesterApprovalHistoryDetail(params: {
  organizationId?: number | null;
  id: number;
}) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params.organizationId);

  const [rows] = await db.execute(sql`
    SELECT
      sem.*,
      s.clientName,
      s.phone,
      s.course,
      s.assigneeId,
      u.name AS assigneeName
    FROM semesters sem
    LEFT JOIN students s
      ON s.id = sem.studentId
      AND s.organizationId = sem.organizationId
    LEFT JOIN users u
      ON u.id = s.assigneeId
      AND u.organizationId = sem.organizationId
    WHERE sem.organizationId = ${organizationId}
      AND sem.id = ${Number(params.id)}
    LIMIT 1
  `);

  return (rows as any[])?.[0] || null;
}

export async function getRefundApprovalHistoryDetail(params: {
  organizationId?: number | null;
  id: number;
}) {
  const db = await getDb();
  if (!db) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "DB not available",
      500
    );
  }

  const organizationId = requireOrganizationId(params.organizationId);

  const [rows] = await db.execute(sql`
    SELECT
      r.*,
      s.clientName,
      s.phone,
      s.course,
      s.assigneeId,
      u.name AS assigneeName,
      sem.semesterOrder,
      sem.semesterLabel,
      sem.actualStartDate,
      sem.actualInstitution,
      sem.actualAmount
    FROM refunds r
    LEFT JOIN students s
      ON s.id = r.studentId
      AND s.organizationId = r.organizationId
    LEFT JOIN users u
      ON u.id = r.assigneeId
      AND u.organizationId = r.organizationId
    LEFT JOIN semesters sem
      ON sem.id = r.semesterId
      AND sem.organizationId = r.organizationId
    WHERE r.organizationId = ${organizationId}
      AND r.id = ${Number(params.id)}
    LIMIT 1
  `);

  return (rows as any[])?.[0] || null;
}