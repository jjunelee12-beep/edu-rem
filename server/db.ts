import { eq, and, sql, desc, like, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
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
type InsertApprovalLog,
} from "../drizzle/schema";

import { ENV } from "./_core/env";
import bcrypt from "bcryptjs";
import { emitLiveNotification } from "./_core/live-notifications";

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

export async function getStudentById(studentId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(students)
    .where(eq(students.id, studentId))
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

export async function getRefundById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(refunds)
    .where(eq(refunds.id, id))
    .limit(1);

  return result[0];
}

// ==============================
// AI HELPERS
// ==============================

// AI 액션 로그 저장
export async function createAiActionLog(params: {
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

// 학생 좌표 조회
export async function getStudentWithCoords(studentId: number) {
  const student = await getStudent(studentId);
  if (!student) return null;

  return {
    ...student,
    latitude: student.latitude ? Number(student.latitude) : null,
    longitude: student.longitude ? Number(student.longitude) : null,
  };
}

// 실습기관 목록
export async function listActivePracticeInstitutions() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(practiceInstitutions)
    .where(eq(practiceInstitutions.isActive, 1));
}

// 실습교육원 목록
export async function listActivePracticeEducationCenters() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(practiceEducationCenters)
   .where(eq(practiceEducationCenters.isActive, 1));
}

// 실습 추천 핵심 함수
export async function getPracticeRecommendationsForStudent(studentId: number) {
  const student = await getStudentWithCoords(studentId);
  if (!student || !student.latitude || !student.longitude) {
    throw new Error("학생 주소 좌표 없음");
  }

  const institutions = await listActivePracticeInstitutions();
  const centers = await listActivePracticeEducationCenters();

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
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);

  return {
    student,
    institutions: calc(institutions),
    educationCenters: calc(centers),
  };
}

export async function fixMissingCoordinates(params: {
  type: "education" | "institution";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const limit = params.limit ?? 100;

  const table =
    params.type === "education"
      ? practiceEducationCenters
      : practiceInstitutions;

  const rows = await db
    .select()
    .from(table)
    .where(
      sql`(${table.latitude} IS NULL OR ${table.longitude} IS NULL)`
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

  await db.insert(sql`
    INSERT INTO ai_learning_entries
    (userId, userName, learningType, inputText, normalizedKey, payload, targetStudentId, targetStudentName)
    VALUES (
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
      (${params.normalizedKey ?? null} IS NULL OR normalizedKey = ${params.normalizedKey ?? null})
    ORDER BY createdAt DESC
    LIMIT 5
  `);

  return rows as any[];
}
export async function getStudentRegistrationSummary(studentId: number) {
  const db = await getDb();
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

  const student = await getStudent(studentId);
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

  const semesterRows = await listSemesters(studentId);

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
            THEN grossAmount ELSE 0
          END
        ),
        0
      ) as totalPaid,
      COALESCE(
        SUM(
          CASE
            WHEN settlementStatus = 'refunded'
            THEN grossAmount ELSE 0
          END
        ),
        0
      ) as totalRefund
    FROM settlement_items
    WHERE studentId = ${studentId}
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

export async function listFormBlueprints(formType: "landing" | "ad") {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(formBlueprints)
    .where(eq(formBlueprints.formType, formType))
    .orderBy(desc(formBlueprints.isDefault), desc(formBlueprints.id));

  return rows.map((row: any) => ({
    ...row,
    uiConfig: parseUiConfigJson(row.uiConfigJson),
  }));
}

export async function getFormBlueprintById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(formBlueprints)
    .where(eq(formBlueprints.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    uiConfig: parseUiConfigJson(row.uiConfigJson),
  };
}

export async function createFormBlueprint(input: {
  formType: "landing" | "ad";
  name: string;
  description?: string | null;
  uiConfig: any;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const exists = await db
    .select()
    .from(formBlueprints)
    .where(
      and(
        eq(formBlueprints.formType, input.formType),
        eq(formBlueprints.name, input.name.trim())
      )
    )
    .limit(1);

  if (exists[0]) {
    throw new Error("같은 이름의 뼈대가 이미 존재합니다.");
  }

  const result: any = await db.insert(formBlueprints).values({
    formType: input.formType,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    uiConfigJson: safeJsonStringify(input.uiConfig),
    isActive: true,
    isDefault: false,
    createdBy: input.createdBy,
  } as any);

  const insertedId = Number(getInsertId(result));
  return getFormBlueprintById(insertedId);
}

export async function updateFormBlueprint(input: {
  id: number;
  name?: string;
  description?: string | null;
  uiConfig?: any;
  isActive?: boolean;
  isDefault?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const target = await getFormBlueprintById(input.id);
  if (!target) {
    throw new Error("수정할 뼈대를 찾을 수 없습니다.");
  }

  if (input.name && input.name.trim() !== target.name) {
    const exists = await db
      .select()
      .from(formBlueprints)
      .where(
        and(
          eq(formBlueprints.formType, target.formType),
          eq(formBlueprints.name, input.name.trim())
        )
      )
      .limit(1);

    if (exists[0] && Number(exists[0].id) !== Number(input.id)) {
      throw new Error("같은 이름의 뼈대가 이미 존재합니다.");
    }
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
    .where(eq(formBlueprints.id, input.id));

  return getFormBlueprintById(input.id);
}

export async function deleteFormBlueprint(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const target = await getFormBlueprintById(id);
  if (!target) {
    throw new Error("삭제할 뼈대를 찾을 수 없습니다.");
  }

  await db.delete(formBlueprints).where(eq(formBlueprints.id, id));

  return {
    ok: true,
    id,
  };
}

export async function createLeadFormFromBlueprint(input: {
  blueprintId: number;
  assigneeId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const blueprint = await getFormBlueprintById(input.blueprintId);
  if (!blueprint) {
    throw new Error("뼈대를 찾을 수 없습니다.");
  }

  const token =
    blueprint.formType === "ad"
      ? `ad_${Math.random().toString(36).slice(2, 12)}`
      : `lf_${Math.random().toString(36).slice(2, 12)}`;

  await db.insert(leadForms).values({
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

export async function getLeadFormTemplate(formType: "landing" | "ad") {
  const db = await getDb();
  if (!db) return undefined;

  const token = getLeadFormTemplateToken(formType);

  const result = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.formType, formType),
        eq(leadForms.token, token)
      )
    )
    .limit(1);

  return result[0];
}

export async function saveLeadFormTemplate(params: {
  formType: "landing" | "ad";
  actorUserId: number;
  uiConfig: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const token = getLeadFormTemplateToken(params.formType);
  const existing = await getLeadFormTemplate(params.formType);

  if (existing) {
    await db
      .update(leadForms)
      .set({
        assigneeId: params.actorUserId,
        isActive: false,
        uiConfigJson: JSON.stringify(params.uiConfig),
      } as any)
      .where(eq(leadForms.id, existing.id));

    return existing.id;
  }

  const result: any = await db.insert(leadForms).values({
    assigneeId: params.actorUserId,
    token,
    formType: params.formType,
    isActive: false,
    uiConfigJson: JSON.stringify(params.uiConfig),
  } as any);

  return getInsertId(result);
}

export async function saveNamedLeadFormTemplate(input: {
  formType: "landing" | "ad";
  templateName: string;
  uiConfig: any;
  actorUserId?: number | null;
}) {
  const db = await getDb();

  const token = getNamedLeadFormTemplateToken(input.formType, input.templateName);
  const uiConfigJson = JSON.stringify(input.uiConfig || {});

  const existing = await db
    .select()
    .from(leadForms)
    .where(eq(leadForms.token, token))
    .limit(1);

  if (existing[0]) {
    await db
  .update(leadForms)
  .set({
    uiConfigJson,
  } as any)
  .where(eq(leadForms.id, existing[0].id));

    return {
      ...existing[0],
      token,
      uiConfigJson,
    };
  }

 await db.insert(leadForms).values({
  formType: input.formType,
  token,
  uiConfigJson,
  assigneeId: input.actorUserId ?? 0,
  isActive: false,
} as any);

  const created = await db
    .select()
    .from(leadForms)
    .where(eq(leadForms.token, token))
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

export async function applyNamedLeadFormTemplateToToken(input: {
  formType: "landing" | "ad";
  templateName: string;
  targetToken: string;
  actorUserId: number;
}) {
  const db = await getDb();

  const template = await getNamedLeadFormTemplate(input.formType, input.templateName);
  if (!template) {
    throw new Error("템플릿을 찾을 수 없습니다.");
  }

  const targetRows = await db
    .select()
    .from(leadForms)
    .where(eq(leadForms.token, input.targetToken))
    .limit(1);

  const target = targetRows[0];
  if (!target) {
    throw new Error("대상 폼을 찾을 수 없습니다.");
  }

  if (target.formType !== input.formType) {
    throw new Error("폼 타입이 맞지 않습니다.");
  }

  await updateMyLeadFormUiConfig({
  token: input.targetToken,
  formType: input.formType,
  userId: input.actorUserId,
  uiConfig: safeJsonParse(template.uiConfigJson),
});

  const updated = await db
    .select()
    .from(leadForms)
    .where(eq(leadForms.token, input.targetToken))
    .limit(1);

  return updated[0];
}


export async function deleteNamedLeadFormTemplate(
  formType: "landing" | "ad",
  templateName: string
) {
  const db = await getDb();
  const token = getNamedLeadFormTemplateToken(formType, templateName);

  const existing = await db
    .select()
    .from(leadForms)
    .where(eq(leadForms.token, token))
    .limit(1);

  if (!existing[0]) {
    throw new Error("삭제할 템플릿을 찾을 수 없습니다.");
  }

  await db.delete(leadForms).where(eq(leadForms.id, existing[0].id));

  return {
    ok: true,
    token,
  };
}

export async function renameNamedLeadFormTemplate(input: {
  formType: "landing" | "ad";
  oldTemplateName: string;
  newTemplateName: string;
}) {
  const dbConn = await getDb();

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
    .where(eq(leadForms.token, oldToken))
    .limit(1);

  if (!existingOld[0]) {
    throw new Error("변경할 템플릿을 찾을 수 없습니다.");
  }

  const existingNew = await dbConn
    .select()
    .from(leadForms)
    .where(eq(leadForms.token, newToken))
    .limit(1);

  if (existingNew[0]) {
    throw new Error("같은 이름의 템플릿이 이미 존재합니다.");
  }

  await dbConn
  .update(leadForms)
  .set({
    token: newToken,
  } as any)
  .where(eq(leadForms.id, existingOld[0].id));

  const updated = await dbConn
    .select()
    .from(leadForms)
    .where(eq(leadForms.id, existingOld[0].id))
    .limit(1);

  return updated[0];
}

export async function duplicateNamedLeadFormTemplate(input: {
  formType: "landing" | "ad";
  sourceTemplateName: string;
  newTemplateName: string;
  actorUserId?: number | null;
}) {
  const dbConn = await getDb();

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
    .where(eq(leadForms.token, sourceToken))
    .limit(1);

  const source = sourceRows[0];
  if (!source) {
    throw new Error("복제할 템플릿을 찾을 수 없습니다.");
  }

  const existingNew = await dbConn
    .select()
    .from(leadForms)
    .where(eq(leadForms.token, newToken))
    .limit(1);

  if (existingNew[0]) {
    throw new Error("같은 이름의 템플릿이 이미 존재합니다.");
  }

  await dbConn.insert(leadForms).values({
  formType: input.formType,
  token: newToken,
  uiConfigJson: source.uiConfigJson,
  assigneeId: input.actorUserId ?? source.assigneeId ?? 0,
  isActive: false,
} as any);

  const created = await dbConn
    .select()
    .from(leadForms)
    .where(eq(leadForms.token, newToken))
    .limit(1);

  return created[0];
}

export async function getNamedLeadFormTemplate(
  formType: "landing" | "ad",
  templateName: string
) {
  const db = await getDb();
  const token = getNamedLeadFormTemplateToken(formType, templateName);

  const rows = await db
    .select()
    .from(leadForms)
    .where(eq(leadForms.token, token))
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

export async function listLeadFormTemplates(formType: "landing" | "ad") {
  const db = await getDb();

  const prefix = `__template_${formType}_`;

  const rows = await db
    .select()
    .from(leadForms)
    .where(
      and(
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

export async function getLeadFormByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(leadForms)
    .where(eq(leadForms.token, token))
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

  const userResult = await db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, form.assigneeId))
    .limit(1);

  const assignee = userResult[0];

 return {
  ok: true,
  form,
  assigneeId: form.assigneeId,
  assigneeName: assignee?.name ?? "",
  phone: assignee?.phone ?? "",
  uiConfig: form.uiConfigJson
    ? JSON.parse(form.uiConfigJson)
    : {}, 
};
}
export async function updateLeadFormUiConfig(
  id: number,
  uiConfig: any
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(leadForms)
    .set({
      uiConfigJson: JSON.stringify(uiConfig),
    } as any)
    .where(eq(leadForms.id, id));
}

export async function updateMyLeadFormUiConfig(params: {
  token: string;
  formType: "landing" | "ad";
  userId: number;
  uiConfig: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.token, params.token),
        eq(leadForms.formType, params.formType)
      )
    )
    .limit(1);

  const form = result[0];

  if (!form) {
    throw new Error("폼을 찾을 수 없습니다.");
  }

  if (Number(form.assigneeId) !== Number(params.userId)) {
    throw new Error("본인에게 배정된 페이지만 수정할 수 있습니다.");
  }

  await db
    .update(leadForms)
    .set({
      uiConfigJson: JSON.stringify(params.uiConfig),
    } as any)
    .where(eq(leadForms.id, form.id));

  return form.id;
}

export async function listLeadForms(formType: "landing" | "ad") {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.formType, formType),
        sql`${leadForms.token} NOT LIKE '__template%'`
      )
    )
    .orderBy(desc(leadForms.id));
}

export async function createLeadForm(
  assigneeId: number,
  formType: "landing" | "ad"
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const template = await getLeadFormTemplate(formType);

  const token =
    formType === "ad"
      ? `ad_${Math.random().toString(36).slice(2, 12)}`
      : `lf_${Math.random().toString(36).slice(2, 12)}`;

  const fallbackUiConfig = {
    title: "",
    subtitle: "",
    logoUrl: "",
    heroImageUrl: "",
    primaryColor: "#2563eb",
    submitButtonText: "신청하기",
    agreementText: "개인정보 수집 및 이용에 동의합니다.",
    layoutType: "card",
    fields: [],
    mapping: {},
    description: "",
    tags: "",
  };

  const uiConfigJson = template?.uiConfigJson
    ? template.uiConfigJson
    : JSON.stringify(fallbackUiConfig);

  await db.insert(leadForms).values({
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

export async function updateLeadFormActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(leadForms)
    .set({ isActive } as any)
    .where(eq(leadForms.id, id));
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

export async function getAllUsersDetailed() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: users.id,
      displayNo: users.displayNo,
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
    .from(users)
    .orderBy(users.displayNo, users.id);
}

// ─── Branding Settings ──────────────────────────────────────────────
export async function getBrandingSettings() {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(brandingSettings)
    .limit(1);

  if (!result[0]) {
    return {
      companyName: "위드원 교육",
      companyLogoUrl: null,
      messengerSubtitle: "사내 메신저",
    };
  }

  return result[0];
}

export async function saveBrandingSettings(
  data: InsertBrandingSetting
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await db
    .select()
    .from(brandingSettings)
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
      .where(eq(brandingSettings.id, existing[0].id));

    return existing[0].id;
  }

  const result: any = await db.insert(brandingSettings).values({
    companyName: data.companyName,
    companyLogoUrl: data.companyLogoUrl ?? null,
    messengerSubtitle: data.messengerSubtitle,
    createdBy: data.createdBy ?? null,
    updatedBy: data.updatedBy ?? null,
  } as any);

  return getInsertId(result);
}

export async function createUserAccount(data: {
  openId: string;
  username: string;
  passwordHash?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: "staff" | "admin" | "host" | "superhost";
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
    bankName: data.bankName ?? null,
    bankAccount: data.bankAccount ?? null,
    loginMethod: data.loginMethod ?? "manual",
    isActive: data.isActive ?? true,
  } as any);

  return getInsertId(result);
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
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  if (!data || Object.keys(data).length === 0) return;

  await db.update(users).set(data as any).where(eq(users.id, id));
}

export async function updateUserRole(
  id: number,
  role: "staff" | "admin" | "host" | "superhost"
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // superhost 중복 방지
  if (role === "superhost") {
    const existing = await getAllUsersDetailed();
    const current = existing.find((u: any) => u.id === id);
    if (!current) throw new Error("유저 없음");

    const count = existing.filter((u: any) => u.role === "superhost").length;

    if (current.role !== "superhost" && count >= 1) {
      throw new Error("슈퍼호스트는 1명만 가능합니다.");
    }
  }

  await db.update(users).set({ role } as any).where(eq(users.id, id));
}

export async function updateUserActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.update(users).set({ isActive } as any).where(eq(users.id, id));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

// ─── Consultations ───────────────────────────────────────────────────
export async function listConsultations(assigneeId?: number) {
  const db = await getDb();
  if (!db) return [];

  const baseQuery = db.select().from(consultations);

  if (assigneeId) {
    return baseQuery
      .where(eq(consultations.assigneeId, assigneeId))
      .orderBy(desc(consultations.createdAt));
  }

  return baseQuery.orderBy(desc(consultations.createdAt));
}

export async function getConsultation(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(consultations)
    .where(eq(consultations.id, id))
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
  data: Partial<InsertConsultation>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  if (!data || Object.keys(data).length === 0) {
    console.log("[DB] updateConsultation skip (empty):", id);
    return;
  }

  console.log("[DB] updateConsultation id:", id);
  console.log("[DB] updateConsultation keys:", Object.keys(data as any));
  console.log("[DB] updateConsultation data:", data);

  await db.update(consultations).set(data).where(eq(consultations.id, id));

  console.log("[DB] updateConsultation OK:", id);
}

export async function deleteConsultation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(consultations).where(eq(consultations.id, id));
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
    type: "lead",
    isRead: false,
    title: data.title ?? null,
    level: data.level ?? "normal",
    imageUrl: data.imageUrl ?? null,
    ...data,
  } as any);

  return getInsertId(result);
}

export async function listNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id));
}

export async function createNoticeNotifications(params: {
  noticeId: number;
  actorUserId: number;
  title: string;
  importance?: "normal" | "important" | "urgent";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const allUsers = await getAllUsersDetailed();

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

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(notifications)
    .set({ isRead: true } as any)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(notifications)
    .set({ isRead: true } as any)
    .where(eq(notifications.userId, userId));
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
    ORDER BY startAt ASC
  `);

  return (rows as any[]) ?? [];
}

export async function markScheduleNotified(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    UPDATE schedules
    SET isNotified = 1
    WHERE id = ${id}
  `);
}

export async function createScheduleNotifications() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const schedules = await listPendingScheduleNotifications();
  if (!schedules.length) {
    return { count: 0 };
  }

  const allUsers = await getAllUsersDetailed();
  let createdCount = 0;

  for (const item of schedules) {
    const title = String(item.title ?? "일정");
    const message =
  item.scope === "global"
    ? `[전체 일정] ${title} 할 시간입니다.`
    : `[일정 알림] ${title} 할 시간입니다.`;

    if (item.scope === "global") {
      const targets = (allUsers || []).filter((u: any) => !!u.isActive);

      for (const user of targets) {
        const notificationId = await createNotification({
  userId: Number(user.id),
  type: "schedule",
  title: item.scope === "global" ? "전체 일정 알림" : "일정 알림",
  level: item.scope === "global" ? "important" : "normal",
  message,
  relatedId: Number(item.id),
  isRead: false,
} as any);

emitLiveNotification({
  id: Number(notificationId),
  userId: Number(user.id),
  type: "schedule",
  title: item.scope === "global" ? "전체 일정 알림" : "일정 알림",
  level: item.scope === "global" ? "important" : "normal",
  message,
  relatedId: Number(item.id),
  isRead: false,
});

createdCount += 1;
      }
    } else {
      if (item.ownerUserId) {
        const notificationId = await createNotification({
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
  userId: Number(item.ownerUserId),
  type: "schedule",
  title: "일정 알림",
  level: "normal",
  message,
  relatedId: Number(item.id),
  isRead: false,
});

createdCount += 1;
      }
    }

    await markScheduleNotified(Number(item.id));
  }

  return { count: createdCount };
}

// ─── Approval Print Settings ─────────────────────────────────────────

export async function getApprovalPrintSettings() {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(approvalPrintSettings)
    .limit(1);

  // 없으면 기본값 반환
  if (!result[0]) {
    return {
      companyName: "(주)위드원 교육",
      documentTitle: "전자결재 문서",
      applicantSignLabel: "신청자 서명",
      finalApproverSignLabel: "최종 승인자 서명",
    };
  }

  return result[0];
}

export async function saveApprovalPrintSettings(
  data: InsertApprovalPrintSetting
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await db
    .select()
    .from(approvalPrintSettings)
    .limit(1);

  // 있으면 update
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
      .where(eq(approvalPrintSettings.id, existing[0].id));

    return existing[0].id;
  }

  // 없으면 insert
  const result: any = await db.insert(approvalPrintSettings).values({
    companyName: data.companyName,
    documentTitle: data.documentTitle,
    applicantSignLabel: data.applicantSignLabel,
    finalApproverSignLabel: data.finalApproverSignLabel,
    createdBy: data.createdBy ?? null,
  } as any);

  return getInsertId(result);
}

// ─── Approval Form Field Settings ─────────────────────────

export async function listApprovalFormFieldSettings(formType: string) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(sql`approval_form_field_settings`)
    .where(sql`formType = ${formType}`)
    .orderBy(sql`sortOrder ASC, id ASC`);
}

export async function saveApprovalFormFieldSettings(params: {
  formType: string;
  items: any[];
  actorUserId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // 기존 삭제
  await db.execute(sql`
    DELETE FROM approval_form_field_settings
    WHERE formType = ${params.formType}
  `);

  // 새로 insert
  for (const item of params.items) {
    await db.execute(sql`
      INSERT INTO approval_form_field_settings
      (formType, fieldKey, label, isVisible, isRequired, sortOrder, createdBy)
      VALUES (
        ${params.formType},
        ${item.fieldKey},
        ${item.label},
        ${item.isVisible ? 1 : 0},
        ${item.isRequired ? 1 : 0},
        ${item.sortOrder || 0},
        ${params.actorUserId ?? null}
      )
    `);
  }

  return true;
}

// ─── Device Tokens ───────────────────────────────────────────────────
export async function upsertDeviceToken(data: {
  userId: number;
  platform: string;
  expoPushToken: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await db
    .select()
    .from(deviceTokens)
    .where(
      and(
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
      .where(eq(deviceTokens.id, existing[0].id));

    return existing[0].id;
  }

  const result: any = await db.insert(deviceTokens).values({
    userId: data.userId,
    platform: data.platform,
    expoPushToken: data.expoPushToken,
    isActive: true,
  } as any);

  return getInsertId(result);
}

export async function listActiveDeviceTokensByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(deviceTokens)
    .where(
      and(
        eq(deviceTokens.userId, userId),
        eq(deviceTokens.isActive, true)
      )
    )
    .orderBy(desc(deviceTokens.id));
}

export async function listActiveExpoPushTokensByUserId(userId: number) {
  const rows = await listActiveDeviceTokensByUserId(userId);

  return (rows || [])
    .map((row: any) => row.expoPushToken)
    .filter((token: any) => typeof token === "string" && token.trim() !== "");
}

// ─── Students ────────────────────────────────────────────────────────
export async function listStudents(assigneeId?: number) {
  const db = await getDb();
  if (!db) return [];

  const assigneeFilter = assigneeId ? sql`WHERE s.assigneeId = ${assigneeId}` : sql``;

  const [rows] = await db.execute(sql`
    SELECT s.*,
      COALESCE(
        (SELECT SUM(sem.plannedAmount) FROM semesters sem WHERE sem.studentId = s.id),
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

      (SELECT p.practiceStatus FROM plans p WHERE p.studentId = s.id LIMIT 1) as practiceStatus,
      (SELECT p.hasPractice FROM plans p WHERE p.studentId = s.id LIMIT 1) as hasPractice
    FROM students s
    ${assigneeFilter}
    ORDER BY s.createdAt DESC
  `);

  return (rows as unknown) as any[];
}

export async function getStudent(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(students).where(eq(students.id, id)).limit(1);
  return result[0];
}

export async function createStudent(data: InsertStudent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.insert(students).values(data);
  return getInsertId(result);
}

export async function updateStudent(id: number, data: Partial<InsertStudent>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.update(students).set(data).where(eq(students.id, id));
}

export async function updateStudentAddressAndCoords(params: {
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
    .where(eq(students.id, params.studentId));
}

export async function deleteStudent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(students).where(eq(students.id, id));
}

// ─── Semesters ───────────────────────────────────────────────────────
export async function listSemesters(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(semesters)
    .where(eq(semesters.studentId, studentId))
    .orderBy(semesters.semesterOrder);
}

export async function getSemester(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(semesters).where(eq(semesters.id, id)).limit(1);
  return result[0];
}

export async function createSemester(data: InsertSemester) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.insert(semesters).values({
    ...data,
    status: (data as any).status ?? "등록",
    practiceStatus: (data as any).practiceStatus ?? "미섭외",
  } as any);

  return getInsertId(result);
}

export async function updateSemester(id: number, data: Partial<InsertSemester>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.update(semesters).set(data).where(eq(semesters.id, id));
}

export async function deleteSemester(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await cancelSettlementItemBySource({
    revenueType: "subject",
    sourceId: id,
    note: "학기 삭제로 일반과목 정산 취소",
  });

  await db.delete(semesters).where(eq(semesters.id, id));
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
conditions.push(sql`s.approvalStatus = '승인'`);

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

  const [rows] = await db.execute(sql`
    SELECT sem.*,
      s.clientName,
      s.phone,
      s.course,
      s.assigneeId,
      s.status as studentStatus,
      s.approvalStatus,
      u.name as assigneeName,

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
    ${whereClause}
    ORDER BY sem.plannedMonth ASC, s.clientName ASC
  `);

  return (rows as unknown) as any[];
}

// ─── Plans ───────────────────────────────────────────────────────────
export async function getPlan(studentId: number) {
  const db = await getDb();
  console.log("[db.getPlan] db exists =", !!db);

  if (!db) return null;

  const result = await db
    .select()
    .from(plans)
    .where(eq(plans.studentId, studentId))
    .limit(1);

  console.log("[db.getPlan] result =", result);

  return result[0] ?? null;
}

export async function upsertPlan(data: InsertPlan) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await getPlan(data.studentId);

  if (existing) {
    await db.update(plans).set(data).where(eq(plans.studentId, data.studentId));
    return existing.id;
  } else {
    const result = await db.insert(plans).values(data);
    return getInsertId(result);
  }
}

// ─── Refunds ─────────────────────────────────────────────────────────
export async function listRefunds(assigneeId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (assigneeId) {
    return db
      .select()
      .from(refunds)
      .where(eq(refunds.assigneeId, assigneeId))
      .orderBy(desc(refunds.createdAt));
  }

  return db.select().from(refunds).orderBy(desc(refunds.createdAt));
}

export async function listRefundsByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(refunds)
    .where(eq(refunds.studentId, studentId))
    .orderBy(desc(refunds.createdAt));
}

export async function listApprovedRefundsByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(refunds)
    .where(
      and(
        eq(refunds.studentId, studentId),
        eq(refunds.approvalStatus, "승인")
      )
    )
    .orderBy(desc(refunds.createdAt));
}

export async function listPendingRefunds() {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT
      r.*,
      s.clientName,
      s.phone,
      s.course,
      s.assigneeId,
      u.name as assigneeName
    FROM refunds r
    INNER JOIN students s ON s.id = r.studentId
    LEFT JOIN users u ON u.id = s.assigneeId
    WHERE r.approvalStatus = '대기'
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

export async function updateRefund(id: number, data: Partial<InsertRefund>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.update(refunds).set(data).where(eq(refunds.id, id));
}

export async function approveRefund(id: number, approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(refunds)
    .set({
      approvalStatus: "승인",
      approvedAt: new Date(),
      rejectedAt: null,
      approvedBy,
    } as any)
    .where(eq(refunds.id, id));

  const refundRow = await db
    .select()
    .from(refunds)
    .where(eq(refunds.id, id))
    .limit(1);

  const refund = refundRow[0];
  if (!refund) return;

   if (refund.semesterId) {
    await refundSettlementItemBySource({
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
    });
  }
}

export async function rejectRefund(id: number, approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(refunds)
    .set({
      approvalStatus: "불승인",
      approvedAt: null,
      rejectedAt: new Date(),
      approvedBy,
    } as any)
    .where(eq(refunds.id, id));
}

export async function deleteRefund(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(refunds).where(eq(refunds.id, id));
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
  revenueType: "subject" | "practice_support" | "private_certificate";
  sourceId: number;
  studentId: number;
  assigneeId?: number | null;
  freelancerUserId?: number | null;
  freelancerPositionId?: number | null;
  settlementGradeId?: number | null;
  educationInstitutionId?: number | null;
  privateCertificateMasterId?: number | null;
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
  revenueType: "subject" | "practice_support" | "private_certificate";
  sourceId: number;
  actorUserId?: number | null;
  note?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

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

  if (!exists[0]) {
    return null;
  }

  const item = exists[0];

  await db
    .update(settlementItems)
    .set({
      settlementStatus: "cancelled",
    } as any)
    .where(eq(settlementItems.id, item.id));

  await createSettlementItemLog({
    settlementItemId: Number(item.id),
    actionType: "cancel",
    actorUserId: params.actorUserId ?? null,
    note: params.note ?? "결제 취소 또는 요청 삭제로 정산 취소",
  });

  return Number(item.id);
}

export async function refundSettlementItemBySource(params: {
  revenueType: "subject" | "practice_support" | "private_certificate";
  sourceId: number;
  refundAmount?: number | string | null;
  refundDate?: string | Date | null;
  actorUserId?: number | null;
  note?: string | null;
  payload?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

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

  if (!exists[0]) {
    return null;
  }

  const item = exists[0];
  const refundAmount = toNumber(params.refundAmount ?? item.grossAmount ?? 0);

  await db
    .update(settlementItems)
    .set({
      settlementStatus: "refunded",
      note: params.note ?? "환불 처리됨",
    } as any)
    .where(eq(settlementItems.id, item.id));

  await createSettlementItemLog({
    settlementItemId: Number(item.id),
    actionType: "refund",
    actorUserId: params.actorUserId ?? null,
    note: params.note ?? "환불 승인으로 정산 환불 처리",
    payload: JSON.stringify({
      refundAmount,
      refundDate: params.refundDate ?? null,
      revenueType: params.revenueType,
      sourceId: params.sourceId,
      ...(params.payload ?? {}),
    }),
  });

  return Number(item.id);
}

export async function syncPrivateCertificateSettlementItemByRequestId(
  requestId: number,
  actorUserId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

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
    .where(eq(privateCertificateRequests.id, requestId))
    .limit(1);

  const row = rows[0];
  if (!row?.request) {
    throw new Error("민간자격증 요청 데이터를 찾을 수 없습니다.");
  }

  const request = row.request;
  const master = row.master;

  if (request.paymentStatus !== "결제") {
    await cancelSettlementItemBySource({
      revenueType: "private_certificate",
      sourceId: Number(request.id),
      actorUserId,
      note: "민간자격증 결제 상태가 결제가 아니어서 정산 취소",
    });
    return null;
  }

   const requestFeeAmount = toNumber((request as any).feeAmount ?? 0);
const requestFreelancerInputAmount = toNumber(
  (request as any).freelancerInputAmount ?? 0
);

const masterDefaultFeeAmount = toNumber(
  (master as any)?.defaultFeeAmount ?? 0
);

const masterDefaultFreelancerAmount = toNumber(
  (master as any)?.defaultFreelancerAmount ?? 0
);

const isSettlementEnabled =
  (master as any)?.isSettlementEnabled === undefined
    ? true
    : Boolean((master as any)?.isSettlementEnabled);

// 요청값 우선, 없으면 마스터 기본값
const feeAmount =
  requestFeeAmount > 0 ? requestFeeAmount : masterDefaultFeeAmount;

const resolvedFreelancerAmount =
  requestFreelancerInputAmount > 0
    ? requestFreelancerInputAmount
    : masterDefaultFreelancerAmount;

const freelancerAmount = isSettlementEnabled
  ? Math.max(0, Math.min(feeAmount, resolvedFreelancerAmount))
  : 0;

const taxAmount = Math.floor(freelancerAmount * 0.033);
const finalPayoutAmount = freelancerAmount - taxAmount;
const companyAmount = Math.max(0, feeAmount);

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
    freelancerAmount,
    taxAmount,
    finalPayoutAmount,
    settlementStatus: "confirmed",
    occurredAt: (request as any).paidAt ?? (request as any).updatedAt ?? new Date(),
        note: "민간자격증 요청값 및 마스터 기본값 기준으로 자동 생성",
    actorUserId: actorUserId ?? null,
    logNote: "민간자격증 결제 완료 반영",
        payload: {
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
  actorUserId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select()
    .from(practiceSupportRequests)
    .where(eq(practiceSupportRequests.id, requestId))
    .limit(1);

  const request = rows[0];
  if (!request) {
    throw new Error("실습배정지원 요청 데이터를 찾을 수 없습니다.");
  }

  if (request.paymentStatus !== "결제") {
    await cancelSettlementItemBySource({
      revenueType: "practice_support",
      sourceId: Number(request.id),
      actorUserId,
      note: "실습배정지원 결제 상태가 결제가 아니어서 정산 취소",
    });
    return null;
  }

  const feeAmount = toNumber((request as any).feeAmount ?? 0);

  return await upsertSettlementItem({
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

export async function backfillSettlementItems(actorUserId?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

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
    .orderBy(asc(semesters.id));

  for (const row of semesterRows) {
    subjectProcessed += 1;
    try {
      await syncSubjectSettlementItemBySemesterId(
        Number(row.id),
        actorUserId
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
    .orderBy(asc(privateCertificateRequests.id));

  for (const row of privateRows) {
    privateProcessed += 1;
    try {
      await syncPrivateCertificateSettlementItemByRequestId(
        Number(row.id),
        actorUserId
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
    .orderBy(asc(practiceSupportRequests.id));

  for (const row of practiceRows) {
    practiceProcessed += 1;
    try {
      await syncPracticeSupportSettlementItemByRequestId(
        Number(row.id),
        actorUserId
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
  actorUserId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const sem = await getSemester(semesterId);
  if (!sem) {
    throw new Error("학기 데이터를 찾을 수 없습니다.");
  }

const studentId = Number(sem.studentId);
const student = await getStudent(studentId);

if (!student) {
  const dbStudent = await db
    .select({
      id: students.id,
      clientName: students.clientName,
      assigneeId: students.assigneeId,
    })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);

  throw new Error(
    `[학생조회실패] semesterId=${sem.id}, studentId=${studentId}, directCount=${dbStudent.length}`
  );
}

  const grossAmount = toNumber((sem as any).actualAmount ?? 0);
  const subjectCount = Number((sem as any).actualSubjectCount ?? 0);
  const educationInstitutionId = Number((sem as any).actualInstitutionId ?? 0) || null;
  const occurredAt = (sem as any).actualPaymentDate ?? (sem as any).actualStartDate ?? null;

  // 실제 결제 완료 전이면 정산 원장 취소
  if (!grossAmount || !subjectCount || !educationInstitutionId || !occurredAt) {
  await cancelSettlementItemBySource({
    revenueType: "subject",
    sourceId: Number(sem.id),
    actorUserId: actorUserId ?? null,
    note: `학기 실제 결제정보 미완성으로 과목 정산 취소 (grossAmount=${grossAmount}, subjectCount=${subjectCount}, educationInstitutionId=${educationInstitutionId}, occurredAt=${occurredAt})`,
  });
  return null;
}

  const institution = await getEducationInstitutionById(educationInstitutionId);
  if (!institution) {
    throw new Error("교육원 정보를 찾을 수 없습니다.");
  }

  const userOrg = await getUserOrgMapping(Number(student.assigneeId));
  const positionId = Number(userOrg?.positionId ?? 0) || null;

    let positionUnitAmount = 0;
  if (positionId && educationInstitutionId) {
    const institutionPositionRate = await getEducationInstitutionPositionRate(
      educationInstitutionId,
      positionId
    );

    if (institutionPositionRate) {
      positionUnitAmount = toNumber(
        (institutionPositionRate as any).freelancerUnitAmount ?? 0
      );
    } else {
      const position = await getPosition(positionId);
      positionUnitAmount = toNumber(
        (position as any)?.settlementUnitAmount ?? 0
      );
    }
  } else if (positionId) {
    const position = await getPosition(positionId);
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
    revenueType: "subject",
    sourceId: Number(sem.id),
    studentId: Number(student.id),
    assigneeId: Number(student.assigneeId),
    freelancerUserId: Number(student.assigneeId),
    freelancerPositionId: positionId,
    educationInstitutionId,
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
export async function getDashboardStats(assigneeId?: number) {
  const db = await getDb();
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
    ${assigneeConsultCond}
  `);

  const [studentRows] = await db.execute(sql`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN s.approvalStatus = '승인'
             AND s.paymentDate >= ${monthStart}
             AND s.paymentDate < ${monthEnd}
            THEN 1 ELSE 0
          END
        ),
        0
      ) as monthRegistered,

      COALESCE(
        SUM(CASE WHEN s.approvalStatus = '승인' THEN 1 ELSE 0 END),
        0
      ) as totalRegisteredCount,

      COALESCE(
        SUM(
          CASE
            WHEN s.approvalStatus = '승인'
             AND s.approvedAt >= ${monthStart}
             AND s.approvedAt < ${monthEnd}
            THEN 1 ELSE 0
          END
        ),
        0
      ) as monthApprovedCount,

      COALESCE(
        SUM(
          CASE
            WHEN s.approvalStatus = '불승인'
             AND s.rejectedAt >= ${monthStart}
             AND s.rejectedAt < ${monthEnd}
            THEN 1 ELSE 0
          END
        ),
        0
      ) as monthRejectedCount,

      COALESCE(
        SUM(CASE WHEN s.approvalStatus = '대기' THEN 1 ELSE 0 END),
        0
      ) as monthPendingCount,

      COALESCE(
        SUM(CASE WHEN s.approvalStatus = '승인' THEN 1 ELSE 0 END),
        0
      ) as totalApprovedCount,

      COALESCE(
        SUM(CASE WHEN s.approvalStatus = '불승인' THEN 1 ELSE 0 END),
        0
      ) as totalRejectedCount,

      COALESCE(
        SUM(CASE WHEN s.approvalStatus = '대기' THEN 1 ELSE 0 END),
        0
      ) as totalPendingCount
    FROM students s
    WHERE 1=1
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
export async function getMonthSalesEntries(assigneeId?: number) {
  const db = await getDb();
  if (!db) {
    return {
      entries: [],
      totalCount: 0,
      totalAmount: 0,
    };
  }

  const { monthStart, monthEnd } = getKSTMonthRange();

  const conditions = [
    sql`${settlementItems.occurredAt} >= ${monthStart}`,
    sql`${settlementItems.occurredAt} < ${monthEnd}`,
    sql`${settlementItems.settlementStatus} IN ('confirmed', 'refunded')`,
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
      clientName: students.clientName,
      phone: students.phone,
      course: students.course,
    })
    .from(settlementItems)
    .leftJoin(students, eq(settlementItems.studentId, students.id))
    .where(and(...conditions))
    .orderBy(desc(settlementItems.occurredAt), desc(settlementItems.id));

  const entries = (rows || []).map((r: any) => {
    const isRefunded = r.settlementStatus === "refunded";
    const signedAmount = isRefunded
      ? -toNumber(r.grossAmount)
      : toNumber(r.grossAmount);

    return {
      id: Number(r.id),
      settlementItemId: Number(r.id),
      sourceId: Number(r.sourceId),
      studentId: Number(r.studentId || 0),
      assigneeId: Number(r.assigneeId || 0),
      type: isRefunded ? "refund" : String(r.revenueType || "unknown"),
      revenueType: r.revenueType,
      settlementStatus: r.settlementStatus,
      title: r.title || "",
      clientName: r.clientName || "",
      phone: r.phone || "",
      course: r.course || "",
      subjectType: r.subjectType || null,
      subjectCount: Number(r.subjectCount || 0),
      quantity: Number(r.quantity || 0),
      amount: signedAmount,
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

  const conditions = [
    sql`${settlementItems.occurredAt} >= ${startDate}`,
    sql`${settlementItems.occurredAt} < ${endDate}`,
    sql`${settlementItems.settlementStatus} IN ('confirmed', 'refunded')`,
  ];

  if (params.assigneeId) {
    conditions.push(eq(settlementItems.assigneeId, params.assigneeId));
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
    .leftJoin(students, eq(settlementItems.studentId, students.id))
    .leftJoin(users, eq(settlementItems.assigneeId, users.id))
    .where(and(...conditions))
    .orderBy(desc(settlementItems.occurredAt), desc(settlementItems.id));

  const entries = (rows || []).map((r: any) => {
    const isRefunded = r.settlementStatus === "refunded";
    const signedGrossAmount = isRefunded
      ? -toNumber(r.grossAmount)
      : toNumber(r.grossAmount);

    return {
      id: Number(r.id),
      settlementItemId: Number(r.id),
      revenueType: r.revenueType,
      settlementStatus: r.settlementStatus,
      sourceId: Number(r.sourceId || 0),
      studentId: Number(r.studentId || 0),
      assigneeId: Number(r.assigneeId || 0),
      assigneeName: r.assigneeName || "",
      clientName: r.clientName || "",
      phone: r.phone || "",
      course: r.course || "",
      title: r.title || "",
      subjectType: r.subjectType || null,
      subjectCount: Number(r.subjectCount || 0),
      quantity: Number(r.quantity || 0),
      grossAmount: signedGrossAmount,
      originalGrossAmount: toNumber(r.grossAmount),
      companyAmount: toNumber(r.companyAmount),
      freelancerAmount: toNumber(r.freelancerAmount),
      taxAmount: toNumber(r.taxAmount),
      finalPayoutAmount: toNumber(r.finalPayoutAmount),
      companyProfit: toNumber(r.companyProfit),
      occurredAt: r.occurredAt,
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

// ─── 학생별 결제 요약 ────────────────────────────────────────────────
export async function getStudentPaymentSummary(studentId: number) {
  const db = await getDb();
  if (!db) {
    return {
      totalRequired: 0,
      totalPaid: 0,
      totalRefund: 0,
      netPaid: 0,
      remainingAmount: 0,
    };
  }

  const student = await getStudent(studentId);
  if (!student) {
    return {
      totalRequired: 0,
      totalPaid: 0,
      totalRefund: 0,
      netPaid: 0,
      remainingAmount: 0,
    };
  }

  const [plannedResult] = await db.execute(
    sql`SELECT COALESCE(SUM(plannedAmount), 0) as total
        FROM semesters
        WHERE studentId = ${studentId}`
  );
  const totalRequired = toNumber((plannedResult as any)[0]?.total);

  const [settlementResult] = await db.execute(sql`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN settlementStatus = 'confirmed'
            THEN grossAmount ELSE 0
          END
        ),
        0
      ) as totalPaid,

      COALESCE(
        SUM(
          CASE
            WHEN settlementStatus = 'refunded'
            THEN grossAmount ELSE 0
          END
        ),
        0
      ) as totalRefund
    FROM settlement_items
    WHERE studentId = ${studentId}
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
     
  const rows = await db
    .select({
      assigneeId: settlementItems.assigneeId,

      totalGrossSales: sql<string>`
        COALESCE(SUM(
          CASE
            WHEN ${settlementItems.settlementStatus} = 'confirmed'
            THEN ${settlementItems.grossAmount}
            ELSE 0
          END
        ), 0)
      `,

      totalRefundGross: sql<string>`
        COALESCE(SUM(
          CASE
            WHEN ${settlementItems.settlementStatus} = 'refunded'
            THEN ${settlementItems.grossAmount}
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
            WHEN ${settlementItems.settlementStatus} = 'refunded'
            THEN ${settlementItems.companyAmount}
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
            WHEN ${settlementItems.settlementStatus} = 'refunded'
            THEN ${settlementItems.institutionCost}
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
            WHEN ${settlementItems.settlementStatus} = 'refunded'
            THEN ${settlementItems.freelancerAmount}
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
            WHEN ${settlementItems.settlementStatus} = 'refunded'
            THEN ${settlementItems.taxAmount}
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
            WHEN ${settlementItems.settlementStatus} = 'refunded'
            THEN ${settlementItems.finalPayoutAmount}
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
      WHEN ${settlementItems.settlementStatus} = 'refunded'
      THEN ${sql.raw("`companyProfit`")}
      ELSE 0
    END
  ), 0)
`,
    })
    .from(settlementItems)
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

export async function getSettlementSettings() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [rows] = await db.execute(sql`
    SELECT * FROM settlement_settings ORDER BY id DESC LIMIT 1
  `);

  return (rows as any[])[0] || { payoutDay: 25 };
}

export async function saveSettlementSettings(data: { payoutDay: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [rows] = await db.execute(sql`
    SELECT id FROM settlement_settings ORDER BY id DESC LIMIT 1
  `);

  const existing = (rows as any[])[0];

  if (existing?.id) {
    await db.execute(sql`
      UPDATE settlement_settings
      SET payoutDay = ${data.payoutDay}
      WHERE id = ${existing.id}
    `);

    return Number(existing.id);
  }

  const [result]: any = await db.execute(sql`
    INSERT INTO settlement_settings (payoutDay)
    VALUES (${data.payoutDay})
  `);

  return Number(result?.insertId || 0);
}

export async function getSettlementPayslip(params: {
  year: number;
  month: number;
  assigneeId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const start = new Date(params.year, params.month - 1, 1);
  const end = new Date(params.year, params.month, 1);
const settings = await getSettlementSettings();

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
    LEFT JOIN teams t
      ON t.id = map.teamId
    LEFT JOIN positions p
      ON p.id = map.positionId
    WHERE u.id = ${params.assigneeId}
    LIMIT 1
  `);

  const profile = (profileRows as any[])?.[0];
  if (!profile) {
    throw new Error("담당자 정보를 찾을 수 없습니다.");
  }

  const branding = await getBrandingSettings();

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
    WHERE s.assigneeId = ${params.assigneeId}
      AND s.occurredAt >= ${start}
      AND s.occurredAt < ${end}
      AND s.settlementStatus IN ('confirmed', 'refunded')
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
    const sign = row.settlementStatus === "refunded" ? -1 : 1;

    if (row.revenueType === "subject") {
      subjectAllowanceAmount += row.freelancerAmount * sign;
    }

    if (row.revenueType === "private_certificate") {
      privateCertificateAllowanceAmount += row.freelancerAmount * sign;
    }

    if (row.revenueType === "practice_support") {
      practiceSupportAllowanceAmount += row.freelancerAmount * sign;
    }

    if (row.settlementStatus === "refunded") {
      refundDeductionAmount += row.grossAmount;
    }

    taxDeductionAmount += row.taxAmount * sign;
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
    const sign = row.settlementStatus === "refunded" ? -1 : 1;
    return sum + row.finalPayoutAmount * sign;
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
  studentId: number;
  subjectName: string;
  excludeId?: number;
  excludeSemesterNo?: number;
}) {
  const rows = await listPlanSemesters(params.studentId);
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

export async function listPlanSemesters(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(planSemesters)
    .where(eq(planSemesters.studentId, studentId))
    .orderBy(planSemesters.semesterNo, planSemesters.sortOrder, planSemesters.id);
}

export async function createPlanSemester(data: InsertPlanSemester) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const duplicate = await findDuplicatePlanSubject({
    studentId: Number(data.studentId),
    subjectName: String(data.subjectName || ""),
  });

  if (duplicate) {
    throw new Error(
      `이미 ${duplicate.semesterNo}학기에 등록된 과목입니다: ${duplicate.subjectName}`
    );
  }

  const result: any = await db.insert(planSemesters).values(data);
  return getInsertId(result);
}

export async function updatePlanSemester(
  id: number,
  data: Partial<InsertPlanSemester>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  if (data.subjectName !== undefined) {
    const current = await db
      .select()
      .from(planSemesters)
      .where(eq(planSemesters.id, id))
      .limit(1);

    const row = current[0];
    if (!row) throw new Error("우리 플랜 과목을 찾을 수 없습니다");

    const duplicate = await findDuplicatePlanSubject({
      studentId: Number(row.studentId),
      subjectName: String(data.subjectName || ""),
      excludeId: id,
    });

    if (duplicate) {
      throw new Error(
        `이미 ${duplicate.semesterNo}학기에 등록된 과목입니다: ${duplicate.subjectName}`
      );
    }
  }

  await db.update(planSemesters).set(data as any).where(eq(planSemesters.id, id));
}

export async function deletePlanSemester(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(planSemesters).where(eq(planSemesters.id, id));
}

export async function syncPlanSemestersByCount(
  studentId: number,
  semesterNo: number,
  targetCount: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select()
    .from(planSemesters)
    .where(
      and(
        eq(planSemesters.studentId, studentId),
        eq(planSemesters.semesterNo, semesterNo)
      )
    )
    .orderBy(planSemesters.sortOrder, planSemesters.id);

  const currentCount = rows.length;

  if (currentCount < targetCount) {
    for (let i = currentCount; i < targetCount; i++) {
      await db.insert(planSemesters).values({
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
      await db.delete(planSemesters).where(eq(planSemesters.id, row.id));
    }
  }

  return true;
}

// ─── Transfer Subjects ───────────────────────────────────────────────
export async function listTransferSubjects(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(transferSubjects)
    .where(eq(transferSubjects.studentId, studentId))
    .orderBy(transferSubjects.sortOrder, transferSubjects.id);
}

export async function createTransferSubject(data: InsertTransferSubject) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(transferSubjects).values(data);
  return getInsertId(result);
}

export async function updateTransferSubject(
  id: number,
  data: Partial<InsertTransferSubject>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.update(transferSubjects).set(data as any).where(eq(transferSubjects.id, id));
}

export async function deleteTransferSubject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(transferSubjects).where(eq(transferSubjects.id, id));
}

export async function bulkCreateTransferSubjects(dataList: InsertTransferSubject[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (!dataList.length) return [];

  const result = await db.insert(transferSubjects).values(dataList as any);
  return result;
}

// ─── 학기 완료 시 자동 종료 체크 ─────────────────────────────────────
export async function checkAndAutoComplete(studentId: number) {
  const db = await getDb();
  if (!db) return;

  const student = await getStudent(studentId);
  if (!student) return;

  const allSems = await listSemesters(studentId);
  if (!allSems.length) return;

  const sorted = [...allSems].sort(
    (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
  );
  const lastSem = sorted[sorted.length - 1];

  await updateStudent(studentId, {
    status: lastSem?.status === "등록 종료" ? "등록 종료" : "등록",
  } as any);
}

// ─── 교육원 ──────────────────────────────────────────────────────────
export async function listEducationInstitutions() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(educationInstitutions)
    .where(eq(educationInstitutions.isActive, true))
    .orderBy(educationInstitutions.sortOrder, educationInstitutions.id);
}

export async function createEducationInstitution(data: {
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
  assigneeId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(consultations)
    .set({ assigneeId } as any)
    .where(eq(consultations.id, consultationId));

  await db
    .update(students)
    .set({ assigneeId } as any)
    .where(eq(students.consultationId, consultationId));
}

export async function listEducationInstitutionPositionRates(
  educationInstitutionId?: number
) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: educationInstitutionPositionRates.id,
      educationInstitutionId: educationInstitutionPositionRates.educationInstitutionId,
      positionId: educationInstitutionPositionRates.positionId,
      freelancerUnitAmount: educationInstitutionPositionRates.freelancerUnitAmount,
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
      eq(educationInstitutionPositionRates.educationInstitutionId, educationInstitutions.id)
    )
    .leftJoin(
      positions,
      eq(educationInstitutionPositionRates.positionId, positions.id)
    )
    .where(
      educationInstitutionId
        ? and(
            eq(
              educationInstitutionPositionRates.educationInstitutionId,
              educationInstitutionId
            ),
            eq(educationInstitutionPositionRates.isActive, true)
          )
        : eq(educationInstitutionPositionRates.isActive, true)
    )
    .orderBy(
      asc(educationInstitutionPositionRates.educationInstitutionId),
      asc(positions.sortOrder),
      asc(educationInstitutionPositionRates.positionId)
    );

  return rows;
}

export async function getEducationInstitutionPositionRate(
  educationInstitutionId: number,
  positionId: number
) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(educationInstitutionPositionRates)
    .where(
      and(
        eq(educationInstitutionPositionRates.educationInstitutionId, educationInstitutionId),
        eq(educationInstitutionPositionRates.positionId, positionId),
        eq(educationInstitutionPositionRates.isActive, true)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertEducationInstitutionPositionRate(data: {
  educationInstitutionId: number;
  positionId: number;
  freelancerUnitAmount: string | number;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

  const exists = await db
    .select()
    .from(educationInstitutionPositionRates)
    .where(
      and(
        eq(educationInstitutionPositionRates.educationInstitutionId, data.educationInstitutionId),
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
      .where(eq(educationInstitutionPositionRates.id, exists[0].id));

    return Number(exists[0].id);
  }

  const result: any = await db.insert(educationInstitutionPositionRates).values({
    educationInstitutionId: data.educationInstitutionId,
    positionId: data.positionId,
    freelancerUnitAmount: String(data.freelancerUnitAmount ?? 0),
    isActive: data.isActive ?? true,
  } as any);

  return Number(getInsertId(result));
}

export async function deleteEducationInstitutionPositionRate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

  await db
    .update(educationInstitutionPositionRates)
    .set({ isActive: false } as any)
    .where(eq(educationInstitutionPositionRates.id, id));
}

export async function getEducationInstitutionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(educationInstitutions)
    .where(eq(educationInstitutions.id, id))
    .limit(1);

  return rows[0];
}

export async function bulkReassignConsultationsAndLinkedStudents(
  fromAssigneeId: number,
  toAssigneeId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(consultations)
    .set({ assigneeId: toAssigneeId } as any)
    .where(eq(consultations.assigneeId, fromAssigneeId));

  await db
    .update(students)
    .set({ assigneeId: toAssigneeId } as any)
    .where(eq(students.assigneeId, fromAssigneeId));
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

  await db
    .update(educationInstitutions)
    .set(payload as any)
    .where(eq(educationInstitutions.id, id));
}

// ─── Transfer Attachments ────────────────────────────────────────────
export async function listTransferAttachments(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(transferAttachments)
    .where(eq(transferAttachments.studentId, studentId))
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
  data: Partial<InsertTransferAttachment>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.update(transferAttachments).set(data as any).where(eq(transferAttachments.id, id));
}

export async function deleteTransferAttachment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(transferAttachments).where(eq(transferAttachments.id, id));
}

// ─── Course Templates ────────────────────────────────────────────────
export async function listCourseSubjectTemplates(courseKey?: string) {
  const db = await getDb();
  if (!db) return [];

  if (courseKey) {
    return db
      .select()
      .from(courseSubjectTemplates)
      .where(
        and(
          eq(courseSubjectTemplates.courseKey, courseKey),
          eq(courseSubjectTemplates.isActive, true)
        )
      )
      .orderBy(courseSubjectTemplates.sortOrder, courseSubjectTemplates.id);
  }

  return db
    .select()
    .from(courseSubjectTemplates)
    .where(eq(courseSubjectTemplates.isActive, true))
    .orderBy(
      courseSubjectTemplates.courseKey,
      courseSubjectTemplates.sortOrder,
      courseSubjectTemplates.id
    );
}

export async function createCourseSubjectTemplate(data: InsertCourseSubjectTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(courseSubjectTemplates).values(data);
  return getInsertId(result);
}

export async function bulkCreatePlanSemestersFromTemplate(params: {
  studentId: number;
  semesterNo: number;
  subjectIds: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

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

  if (templates.length > 8) {
    throw new Error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다");
  }

  const templateNames = templates.map((t: any) => normalizeSubjectName(t.subjectName));

  const duplicateInsideSelection = templateNames.find(
    (name: string, idx: number) => templateNames.indexOf(name) !== idx
  );

  if (duplicateInsideSelection) {
    throw new Error(`선택한 템플릿 안에 중복 과목이 있습니다: ${duplicateInsideSelection}`);
  }

  const existingRows = await listPlanSemesters(params.studentId);

  const duplicateInOtherSemester = templates.find((t: any) =>
    existingRows.some(
      (row: any) =>
        Number(row.semesterNo) !== Number(params.semesterNo) &&
        normalizeSubjectName(row.subjectName) === normalizeSubjectName(t.subjectName)
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
        eq(planSemesters.studentId, params.studentId),
        eq(planSemesters.semesterNo, params.semesterNo)
      )
    );

  const rows = templates.map((t: any, idx: number) => ({
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

// ─── Master: Private Certificates / Subject Catalogs ────────────────
function resolveCategoryFromRequirementType(
  requirementType: "전공필수" | "전공선택" | "교양" | "일반"
): "전공" | "교양" | "일반" {
  if (requirementType === "교양") return "교양";
  if (requirementType === "일반") return "일반";
  return "전공";
}

// 민간자격증 마스터
export async function listPrivateCertificateMasters(options?: {
  activeOnly?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  if (options?.activeOnly) {
    return db
      .select()
      .from(privateCertificateMasters)
      .where(eq(privateCertificateMasters.isActive, true))
      .orderBy(
        asc(privateCertificateMasters.sortOrder),
        asc(privateCertificateMasters.id)
      );
  }

  return db
    .select()
    .from(privateCertificateMasters)
    .orderBy(
      asc(privateCertificateMasters.sortOrder),
      asc(privateCertificateMasters.id)
    );
}

export async function createPrivateCertificateMaster(
  data: InsertPrivateCertificateMaster
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const name = String(data.name || "").trim();
  if (!name) {
    throw new Error("자격증명을 입력해주세요.");
  }

  const existing = await db
    .select()
    .from(privateCertificateMasters)
    .where(eq(privateCertificateMasters.name, name))
    .limit(1);

  if (existing[0]) {
    throw new Error("이미 등록된 민간자격증입니다.");
  }

  const [maxRows] = await db.execute(sql`
    SELECT COALESCE(MAX(sortOrder), 0) as maxSortOrder
    FROM private_certificate_masters
  `);

  const nextSortOrder = Number((maxRows as any)?.[0]?.maxSortOrder || 0) + 1;

  const result: any = await db.insert(privateCertificateMasters).values({
    name,
    sortOrder: (data as any).sortOrder ?? nextSortOrder,
    isActive: (data as any).isActive ?? true,
    createdBy: (data as any).createdBy ?? null,
    updatedBy: (data as any).updatedBy ?? null,
  });

  return getInsertId(result);
}

export async function deletePrivateCertificateMaster(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .delete(privateCertificateMasters)
    .where(eq(privateCertificateMasters.id, id));
}

// 과정 마스터
export async function listSubjectCatalogs(options?: {
  activeOnly?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  if (options?.activeOnly) {
    return db
      .select()
      .from(subjectCatalogs)
      .where(eq(subjectCatalogs.isActive, true))
      .orderBy(asc(subjectCatalogs.sortOrder), asc(subjectCatalogs.id));
  }

  return db
    .select()
    .from(subjectCatalogs)
    .orderBy(asc(subjectCatalogs.sortOrder), asc(subjectCatalogs.id));
}

export async function createSubjectCatalog(data: InsertSubjectCatalog) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const name = String(data.name || "").trim();
  if (!name) {
    throw new Error("과정명을 입력해주세요.");
  }

  const existing = await db
    .select()
    .from(subjectCatalogs)
    .where(eq(subjectCatalogs.name, name))
    .limit(1);

  if (existing[0]) {
    throw new Error("이미 등록된 과정입니다.");
  }

  const [maxRows] = await db.execute(sql`
    SELECT COALESCE(MAX(sortOrder), 0) as maxSortOrder
    FROM subject_catalogs
  `);

  const nextSortOrder = Number((maxRows as any)?.[0]?.maxSortOrder || 0) + 1;

  const result: any = await db.insert(subjectCatalogs).values({
    name,
    sortOrder: (data as any).sortOrder ?? nextSortOrder,
    isActive: (data as any).isActive ?? true,
    createdBy: (data as any).createdBy ?? null,
    updatedBy: (data as any).updatedBy ?? null,
  });

  return getInsertId(result);
}

export async function deleteSubjectCatalog(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .delete(subjectCatalogItems)
    .where(eq(subjectCatalogItems.catalogId, id));

  await db.delete(subjectCatalogs).where(eq(subjectCatalogs.id, id));
}

// 과목 마스터
export async function listSubjectCatalogItems(params: {
  catalogId: number;
  activeOnly?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(subjectCatalogItems.catalogId, params.catalogId)];

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
  data: InsertSubjectCatalogItem
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const subjectName = String(data.subjectName || "").trim();
  if (!subjectName) {
    throw new Error("과목명을 입력해주세요.");
  }

  const requirementType = data.requirementType;
  if (!requirementType) {
    throw new Error("과목 구분을 선택해주세요.");
  }

  const existing = await db
    .select()
    .from(subjectCatalogItems)
    .where(
      and(
        eq(subjectCatalogItems.catalogId, Number(data.catalogId)),
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
    WHERE catalogId = ${Number(data.catalogId)}
  `);

  const nextSortOrder = Number((maxRows as any)?.[0]?.maxSortOrder || 0) + 1;

  const result: any = await db.insert(subjectCatalogItems).values({
    catalogId: Number(data.catalogId),
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
  });

  return getInsertId(result);
}

export async function deleteSubjectCatalogItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .delete(subjectCatalogItems)
    .where(eq(subjectCatalogItems.id, id));
}

// ─── Private Certificate Requests (민간자격증 요청) ─────────────────
export async function listPrivateCertificateRequests(assigneeId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (assigneeId) {
    return db
      .select()
      .from(privateCertificateRequests)
      .where(eq(privateCertificateRequests.assigneeId, assigneeId))
      .orderBy(desc(privateCertificateRequests.createdAt));
  }

  return db
    .select()
    .from(privateCertificateRequests)
    .orderBy(desc(privateCertificateRequests.createdAt));
}

export async function listPrivateCertificateRequestsByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(privateCertificateRequests)
    .where(eq(privateCertificateRequests.studentId, studentId))
    .orderBy(desc(privateCertificateRequests.createdAt));
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
    await syncPrivateCertificateSettlementItemByRequestId(Number(insertId));
  }

  return insertId;
}

export async function updatePrivateCertificateRequest(
  id: number,
  data: Partial<InsertPrivateCertificateRequest>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(privateCertificateRequests)
    .set(data as any)
    .where(eq(privateCertificateRequests.id, id));

  await syncPrivateCertificateSettlementItemByRequestId(id);
}

export async function deletePrivateCertificateRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await cancelSettlementItemBySource({
    revenueType: "private_certificate",
    sourceId: id,
    note: "민간자격증 요청 삭제로 정산 취소",
  });

  await db.delete(privateCertificateRequests).where(eq(privateCertificateRequests.id, id));
}

export async function requestPrivateCertificateRefund(params: {
  requestId: number;
  refundAmount: string | number;
  refundReason?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select()
    .from(privateCertificateRequests)
    .where(eq(privateCertificateRequests.id, params.requestId))
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
    .where(eq(privateCertificateRequests.id, params.requestId));

  return true;
}

export async function approvePrivateCertificateRefund(params: {
  requestId: number;
  approvedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

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
    .where(eq(privateCertificateRequests.id, params.requestId))
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
    .where(eq(privateCertificateRequests.id, params.requestId));

  await refundSettlementItemBySource({
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
  });

  return true;
}



// ─── Practice Support Requests (실습배정지원센터) ───────────────────
export async function listPracticeSupportRequests(assigneeId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (assigneeId) {
    return db
      .select()
      .from(practiceSupportRequests)
      .where(eq(practiceSupportRequests.assigneeId, assigneeId))
      .orderBy(desc(practiceSupportRequests.createdAt));
  }

  return db
    .select()
    .from(practiceSupportRequests)
    .orderBy(desc(practiceSupportRequests.createdAt));
}

export async function listPracticeSupportRequestsByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(practiceSupportRequests)
    .where(eq(practiceSupportRequests.studentId, studentId))
    .orderBy(desc(practiceSupportRequests.createdAt));
}

export async function getPracticeSupportRequest(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(practiceSupportRequests)
    .where(eq(practiceSupportRequests.id, id))
    .limit(1);

  return rows[0];
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
  data: Partial<InsertPracticeSupportRequest>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(practiceSupportRequests)
    .set(data as any)
    .where(eq(practiceSupportRequests.id, id));

  await syncPracticeSupportSettlementItemByRequestId(id);
}

export async function deletePracticeSupportRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await cancelSettlementItemBySource({
    revenueType: "practice_support",
    sourceId: id,
    note: "실습배정지원 요청 삭제로 정산 취소",
  });

  await db.delete(practiceSupportRequests).where(eq(practiceSupportRequests.id, id));
}

export async function requestPracticeSupportRefund(params: {
  requestId: number;
  refundAmount: string | number;
  refundReason?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select()
    .from(practiceSupportRequests)
    .where(eq(practiceSupportRequests.id, params.requestId))
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
    .where(eq(practiceSupportRequests.id, params.requestId));

  return true;
}

export async function approvePracticeSupportRefund(params: {
  requestId: number;
  approvedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select()
    .from(practiceSupportRequests)
    .where(eq(practiceSupportRequests.id, params.requestId))
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
    .where(eq(practiceSupportRequests.id, params.requestId));

  await refundSettlementItemBySource({
    revenueType: "practice_support",
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
  includeEducationCenter?: boolean;
  includePracticeInstitution?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await db
    .select()
    .from(practiceSupportRequests)
    .where(eq(practiceSupportRequests.studentId, params.studentId))
    .limit(1);

  const payload: any = {
    studentId: params.studentId,
    semesterId: params.semesterId ?? null,
    assigneeId: params.assigneeId,
    clientName: params.clientName,
    phone: params.phone,
    course: params.course,
    inputAddress: params.inputAddress ?? null,
    detailAddress: params.detailAddress ?? null,
    assigneeName: params.assigneeName ?? null,
    managerName: params.managerName ?? null,
    practiceHours: params.practiceHours ?? null,
    includeEducationCenter: params.includeEducationCenter ?? true,
    includePracticeInstitution: params.includePracticeInstitution ?? true,
    coordinationStatus: "미섭외",
    paymentStatus: "미결제",
    feeAmount: "0",
  };

  if (existing[0]) {
    await db
      .update(practiceSupportRequests)
      .set(payload)
      .where(eq(practiceSupportRequests.id, existing[0].id));

    if (params.semesterId) {
      await db
        .update(semesters)
        .set({
          practiceStatus: "미섭외",
          practiceSupportRequestId: existing[0].id,
        } as any)
        .where(eq(semesters.id, params.semesterId));
    }

    await db
      .update(plans)
      .set({
        hasPractice: true,
        practiceHours: params.practiceHours ?? null,
        practiceStatus: "미섭외",
      } as any)
      .where(eq(plans.studentId, params.studentId));

    return existing[0].id;
  }

  const result: any = await db.insert(practiceSupportRequests).values(payload);
  const insertId = getInsertId(result);

  if (params.semesterId && insertId) {
    await db
      .update(semesters)
      .set({
        practiceStatus: "미섭외",
        practiceSupportRequestId: insertId,
      } as any)
      .where(eq(semesters.id, params.semesterId));
  }

  await db
    .update(plans)
    .set({
      hasPractice: true,
      practiceHours: params.practiceHours ?? null,
      practiceStatus: "미섭외",
    } as any)
    .where(eq(plans.studentId, params.studentId));

  return insertId;
}

export async function updatePracticeSupportStatusAndSyncSemester(params: {
  practiceSupportRequestId: number;
  coordinationStatus: "미섭외" | "섭외중" | "섭외완료";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const row = await db
    .select()
    .from(practiceSupportRequests)
    .where(eq(practiceSupportRequests.id, params.practiceSupportRequestId))
    .limit(1);

  const target = row[0];
  if (!target) throw new Error("Practice support request not found");

  await db
    .update(practiceSupportRequests)
    .set({
      coordinationStatus: params.coordinationStatus,
    } as any)
    .where(eq(practiceSupportRequests.id, params.practiceSupportRequestId));

  if (target.semesterId) {
    await db
      .update(semesters)
      .set({
        practiceStatus: params.coordinationStatus,
        practiceSupportRequestId: target.id,
      } as any)
      .where(eq(semesters.id, target.semesterId));
  }

  await db
    .update(plans)
    .set({
      practiceStatus: params.coordinationStatus,
    } as any)
    .where(eq(plans.studentId, target.studentId));

  return true;
}

export async function selectPracticeInstitutionForRequest(params: {
  practiceSupportRequestId: number;
  institutionId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const requestRows = await db
    .select()
    .from(practiceSupportRequests)
    .where(eq(practiceSupportRequests.id, params.practiceSupportRequestId))
    .limit(1);

  const institutionRows = await db
    .select()
    .from(practiceInstitutions)
    .where(eq(practiceInstitutions.id, params.institutionId))
    .limit(1);

  const request = requestRows[0];
  const institution = institutionRows[0];

  if (!request) throw new Error("Practice support request not found");
  if (!institution) throw new Error("Practice institution not found");

  const updateData: any = {};

  const student = await getStudent(request.studentId);
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
    .where(eq(practiceSupportRequests.id, params.practiceSupportRequestId));

  return true;
}

// ─── Practice Institutions (실습기관/실습교육원 마스터) ──────────────
export async function listPracticeListCategories(listType?: "education" | "institution") {
  const db = await getDb();
  if (!db) return [];

  if (listType) {
    return db
      .select()
      .from(practiceListCategories)
      .where(
        and(
          eq(practiceListCategories.listType, listType),
          eq(practiceListCategories.isActive, true)
        )
      )
      .orderBy(practiceListCategories.sortOrder, desc(practiceListCategories.createdAt));
  }

  return db
    .select()
    .from(practiceListCategories)
    .where(eq(practiceListCategories.isActive, true))
    .orderBy(practiceListCategories.sortOrder, desc(practiceListCategories.createdAt));
}

export async function createPracticeListCategory(data: InsertPracticeListCategory) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(practiceListCategories).values({
    ...data,
    sortOrder: (data as any).sortOrder ?? 0,
    isActive: (data as any).isActive ?? true,
  });

  return getInsertId(result);
}

export async function updatePracticeListCategory(
  id: number,
  data: Partial<InsertPracticeListCategory>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(practiceListCategories)
    .set(data as any)
    .where(eq(practiceListCategories.id, id));
}

export async function deletePracticeListCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .delete(practiceListCategories)
    .where(eq(practiceListCategories.id, id));
}

export async function listPracticeInstitutions(params?: {
  institutionType?: "education" | "institution";
  categoryId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(practiceInstitutions.isActive, true)];

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

export async function getPracticeInstitution(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(practiceInstitutions)
    .where(eq(practiceInstitutions.id, id))
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
  data: Partial<InsertPracticeInstitution>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(practiceInstitutions)
    .set(data as any)
    .where(eq(practiceInstitutions.id, id));
}

export async function deletePracticeInstitution(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .delete(practiceInstitutions)
    .where(eq(practiceInstitutions.id, id));
}

export async function bulkCreatePracticeInstitutions(
  dataList: InsertPracticeInstitution[],
  options?: {
    mode?: "append" | "replace";
    categoryId?: number | null;
  }
) {
    const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (!dataList.length) return { success: true, count: 0 };

  if (options?.mode === "replace" && options?.categoryId) {
    await db
      .delete(practiceInstitutions)
      .where(eq(practiceInstitutions.categoryId, options.categoryId));
  }

let createdCount = 0;
let updatedCount = 0;
const failedRows: Array<{ rowIndex: number; name?: string; address?: string; reason: string }> = [];

  for (let idx = 0; idx < dataList.length; idx++) {
  const row = dataList[idx];

  try {
    const value = {
  institutionType: row.institutionType ?? "institution",
  categoryId: row.categoryId ?? null,
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
        .where(eq(practiceInstitutions.id, existing[0].id));
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


export async function listPracticeEducationCenters(categoryId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (categoryId) {
    return db
      .select()
      .from(practiceEducationCenters)
      .where(
        and(
          eq(practiceEducationCenters.isActive, true),
          eq(practiceEducationCenters.categoryId, categoryId)
        )
      )
      .orderBy(practiceEducationCenters.sortOrder, desc(practiceEducationCenters.createdAt));
  }

  return db
    .select()
    .from(practiceEducationCenters)
    .where(eq(practiceEducationCenters.isActive, true))
    .orderBy(practiceEducationCenters.sortOrder, desc(practiceEducationCenters.createdAt));
}

export async function getPracticeEducationCenter(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(practiceEducationCenters)
    .where(eq(practiceEducationCenters.id, id))
    .limit(1);

  return rows[0];
}

export async function createPracticeEducationCenter(
  data: InsertPracticeEducationCenter
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(practiceEducationCenters).values({
    ...data,
    feeAmount: (data as any).feeAmount ?? "0",
    isActive: (data as any).isActive ?? true,
    sortOrder: (data as any).sortOrder ?? 0,
  });

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
    mode?: "append" | "replace";
    categoryId?: number | null;
  }
) {
    const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (!rows.length) return { success: true, count: 0 };

  if (options?.mode === "replace" && options?.categoryId) {
    await db
      .delete(practiceEducationCenters)
      .where(eq(practiceEducationCenters.categoryId, options.categoryId));
  }

  let createdCount = 0;
let updatedCount = 0;
const failedRows: Array<{ rowIndex: number; name?: string; address?: string; reason: string }> = [];

  for (let idx = 0; idx < rows.length; idx++) {
  const row = rows[idx];

  try {
    const value = {
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
        .where(eq(practiceEducationCenters.id, existing[0].id));
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
  data: Partial<InsertPracticeEducationCenter>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(practiceEducationCenters)
    .set(data as any)
    .where(eq(practiceEducationCenters.id, id));
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
  data: PracticeAvailabilityUpdateInput
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(practiceInstitutions)
    .set({
      isInactive: data.isInactive,
      inactiveReason: data.inactiveReason ?? null,
      inactiveStartDate: data.inactiveStartDate ?? null,
      inactiveEndDate: data.inactiveEndDate ?? null,
      hideOnMapWhenInactive: data.hideOnMapWhenInactive ?? true,
    } as any)
    .where(eq(practiceInstitutions.id, id));
}

export async function updatePracticeEducationCenterAvailability(
  id: number,
  data: PracticeAvailabilityUpdateInput
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(practiceEducationCenters)
    .set({
      isInactive: data.isInactive,
      inactiveReason: data.inactiveReason ?? null,
      inactiveStartDate: data.inactiveStartDate ?? null,
      inactiveEndDate: data.inactiveEndDate ?? null,
      hideOnMapWhenInactive: data.hideOnMapWhenInactive ?? true,
    } as any)
    .where(eq(practiceEducationCenters.id, id));
}

export async function deletePracticeEducationCenter(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .delete(practiceEducationCenters)
    .where(eq(practiceEducationCenters.id, id));
}

export async function listNearbyPracticeInstitutions(params: {
  studentId: number;
  institutionType: "education" | "institution";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const student = await getStudent(params.studentId);
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

export async function listTeams() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(teams)
    .orderBy(teams.sortOrder, teams.id);
}

export async function getTeam(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  return result[0];
}

export async function createTeam(data: {
  name: string;
  sortOrder?: number | null;
  isActive?: boolean | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(teams).values({
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
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const payload: Record<string, any> = {};
  if (data.name !== undefined) payload.name = normalizeNullableString(data.name);
  if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder ?? 0;
  if (data.isActive !== undefined) payload.isActive = !!data.isActive;

  if (Object.keys(payload).length === 0) return;

  await db.update(teams).set(payload).where(eq(teams.id, id));
}

export async function deleteTeam(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(teams).where(eq(teams.id, id));
}

// -----------------------------------------------------
// ORG: Positions
// -----------------------------------------------------

export async function listPositions() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(positions)
    .orderBy(positions.sortOrder, positions.id);
}

export async function getPosition(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(positions)
    .where(eq(positions.id, id))
    .limit(1);

  return result[0];
}

export async function getPositionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(positions)
    .where(eq(positions.id, id))
    .limit(1);

  return rows[0];
}

export async function createPosition(data: {
  name: string;
  sortOrder?: number | null;
  isActive?: boolean | null;
  settlementUnitAmount?: string | number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(positions).values({
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
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const payload: Record<string, any> = {};
  if (data.name !== undefined) payload.name = data.name?.trim() || null;
  if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder ?? 0;
  if (data.isActive !== undefined) payload.isActive = !!data.isActive;
  if (data.settlementUnitAmount !== undefined) {
    payload.settlementUnitAmount = String(data.settlementUnitAmount ?? "0");
  }

  if (Object.keys(payload).length === 0) return;

  await db.update(positions).set(payload).where(eq(positions.id, id));
}

export async function deletePosition(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(positions).where(eq(positions.id, id));
}

// -----------------------------------------------------
// ORG: User Mapping
// -----------------------------------------------------

export async function getUserOrgMapping(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(userOrgMappings)
    .where(eq(userOrgMappings.userId, userId))
    .limit(1);

  return result[0];
}

export async function upsertUserOrgMapping(data: {
  userId: number;
  teamId?: number | null;
  positionId?: number | null;
  sortOrder?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await assertUserExists(data.userId);

  if (data.teamId) {
    const team = await getTeam(data.teamId);
    if (!team) throw new Error("팀을 찾을 수 없습니다.");
  }

  if (data.positionId) {
    const position = await getPosition(data.positionId);
    if (!position) throw new Error("직급을 찾을 수 없습니다.");
  }

  const existing = await getUserOrgMapping(data.userId);

  const payload = {
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
      .where(eq(userOrgMappings.userId, data.userId));

    return existing.id;
  }

  const result: any = await db.insert(userOrgMappings).values(payload);
  return getInsertId(result);
}

export async function deleteUserOrgMapping(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(userOrgMappings).where(eq(userOrgMappings.userId, userId));
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
    userId: params.targetUserId,
    teamId: params.teamId ?? null,
    positionId: params.positionId ?? null,
    sortOrder: params.sortOrder ?? 0,
  });
}

// -----------------------------------------------------
// Messenger helpers
// -----------------------------------------------------

export async function getDirectChatRoomBetweenUsers(userAId: number, userBId: number) {
  const db = await getDb();
  if (!db) return null;

  const [rows] = await db.execute(sql`
    SELECT r.*
    FROM chat_rooms r
    INNER JOIN chat_room_members m1 ON m1.roomId = r.id
    INNER JOIN chat_room_members m2 ON m2.roomId = r.id
    WHERE r.roomType = 'direct'
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
  roomType: "direct" | "group";
  title?: string | null;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(chatRooms).values({
    roomType: data.roomType,
    title: normalizeNullableString(data.title),
    createdBy: data.createdBy,
    isActive: true,
  } as InsertChatRoom);

  return getInsertId(result);
}

export async function addChatRoomMember(data: {
  roomId: number;
  userId: number;
  lastReadMessageId?: number | null;
  isActive?: boolean | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await db
    .select()
    .from(chatRoomMembers)
    .where(
      and(
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
      .where(eq(chatRoomMembers.id, existing[0].id));

    return existing[0].id;
  }

  const result: any = await db.insert(chatRoomMembers).values({
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
  actorUserId: number;
  otherUserId: number;
}) {
  if (params.actorUserId === params.otherUserId) {
    throw new Error("자기 자신과의 채팅방은 만들 수 없습니다.");
  }

  await assertUserExists(params.actorUserId);
  await assertUserExists(params.otherUserId);

  const existing = await getDirectChatRoomBetweenUsers(
    params.actorUserId,
    params.otherUserId
  );

  if (existing?.id) {
    return existing;
  }

  const roomId = await createChatRoom({
    roomType: "direct",
    title: null,
    createdBy: params.actorUserId,
  });

  await addChatRoomMember({
    roomId: Number(roomId),
    userId: params.actorUserId,
  });

  await addChatRoomMember({
    roomId: Number(roomId),
    userId: params.otherUserId,
  });

  return await getChatRoomById(Number(roomId));
}

export async function getChatRoomById(roomId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(chatRooms)
    .where(eq(chatRooms.id, roomId))
    .limit(1);

  return result[0] ?? null;
}

export async function ensureChatRoomMember(roomId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db
    .select()
    .from(chatRoomMembers)
    .where(
      and(
        eq(chatRoomMembers.roomId, roomId),
        eq(chatRoomMembers.userId, userId),
        eq(chatRoomMembers.isActive, true)
      )
    )
    .limit(1);

  if (!result[0]) {
    throw new Error("해당 채팅방에 접근 권한이 없습니다.");
  }

  return result[0];
}

export async function createChatMessage(data: {
  roomId: number;
  senderId: number;
  messageType?: "text" | "image" | "file" | "system";
  content?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await ensureChatRoomMember(data.roomId, data.senderId);

  const result: any = await db.insert(chatMessages).values({
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
  .where(eq(chatRooms.id, data.roomId));

return messageId;
}

export async function updateChatRoomTitle({
  roomId,
  title,
}: {
  roomId: number;
  title: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(chatRooms)
    .set({
      title,
      updatedAt: new Date(),
    } as any)
    .where(eq(chatRooms.id, roomId));
}

export async function updateChatRoomType({
  roomId,
  roomType,
}: {
  roomId: number;
  roomType: "direct" | "group";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(chatRooms)
    .set({
      roomType,
      updatedAt: new Date(),
    } as any)
    .where(eq(chatRooms.id, roomId));
}

export async function createChatAttachment(data: {
  messageId: number;
  fileName: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(chatAttachments).values({
    messageId: data.messageId,
    fileName: data.fileName.trim(),
    fileUrl: data.fileUrl.trim(),
    fileType: normalizeNullableString(data.fileType),
    fileSize: data.fileSize ?? null,
  } as InsertChatAttachment);

  return getInsertId(result);
}

export async function listChatMessages(roomId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  await ensureChatRoomMember(roomId, userId);

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
    INNER JOIN users u ON u.id = m.senderId
    LEFT JOIN chat_attachments a ON a.messageId = m.id
    WHERE m.roomId = ${roomId}
    ORDER BY m.id ASC
  `);

  return (rows as any[]) ?? [];
}

export async function markChatRoomRead(params: {
  roomId: number;
  userId: number;
  lastReadMessageId: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await ensureChatRoomMember(params.roomId, params.userId);

let resolvedLastReadMessageId = params.lastReadMessageId ?? null;

if (resolvedLastReadMessageId === null) {
  const [rows] = await db.execute(sql`
    SELECT MAX(id) as lastMessageId
    FROM chat_messages
    WHERE roomId = ${params.roomId}
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

export async function listMyChatRooms(userId: number) {
  const db = await getDb();
  if (!db) return [];

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

    ORDER BY
      COALESCE(lm.createdAt, r.createdAt) DESC,
      r.id DESC
  `);

  return (rows as any[]) ?? [];
}

export async function listChatRoomMembers(roomId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  await ensureChatRoomMember(roomId, userId);

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
    INNER JOIN users u ON u.id = m.userId
    LEFT JOIN user_org_mappings map ON map.userId = u.id
    LEFT JOIN teams t ON t.id = map.teamId
    LEFT JOIN positions p ON p.id = map.positionId

    WHERE m.roomId = ${roomId}
      AND m.isActive = true

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
  roomId: number;
  userId: number;
  isMuted: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await ensureChatRoomMember(params.roomId, params.userId);

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
      .where(eq(chatRoomSettings.id, existing[0].id));

    return existing[0].id;
  }

  const result: any = await db.insert(chatRoomSettings).values({
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
  roomId: number;
  userId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await ensureChatRoomMember(params.roomId, params.userId);

  await db
    .update(chatRoomMembers)
    .set({
      isActive: false,
      leftAt: new Date(),
    } as any)
    .where(
      and(
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

export async function getTodayAttendanceRecord(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const today = getTodayDateStringKST();

  const result = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.userId, userId),
        eq(attendanceRecords.workDate, today)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

export async function clockInAttendance(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const today = getTodayDateStringKST();
  const existing = await getTodayAttendanceRecord(userId);

  if (existing?.clockInAt) {
    throw new Error("이미 오늘 출근 처리되었습니다.");
  }

  const now = new Date();
const late = await calcLateInfo(now);

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
      .where(eq(attendanceRecords.id, existing.id));

    return await getTodayAttendanceRecord(userId);
  }

  const result: any = await db.insert(attendanceRecords).values({
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

export async function clockOutAttendance(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const todayRow = await getTodayAttendanceRecord(userId);

  if (!todayRow?.clockInAt) {
    throw new Error("출근 기록이 없어 퇴근 처리할 수 없습니다.");
  }

  if (todayRow?.clockOutAt) {
    throw new Error("이미 오늘 퇴근 처리되었습니다.");
  }

  const clockOutAt = new Date();
  const workMinutes = calcWorkMinutes(todayRow.clockInAt, clockOutAt);
const early = await calcEarlyLeaveInfo(clockOutAt);

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
    .where(eq(attendanceRecords.id, todayRow.id));

  return await getTodayAttendanceRecord(userId);
}


export async function listMyAttendanceRecords(userId: number) {
  const db = await getDb();
  if (!db) return [];

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
    WHERE a.userId = ${userId}
    ORDER BY a.workDate DESC, a.id DESC
  `);

  return (rows as any[]) ?? [];
}

export async function listAllAttendanceRecords() {
  const db = await getDb();
  if (!db) return [];

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
  ORDER BY a.workDate DESC, a.id DESC
`);

return (freshRows as any[]) ?? [];
}

export async function listTeamAttendanceRecords(adminUserId: number) {
  const db = await getDb();
  if (!db) return [];

  const myTeamId = await getMyTeamId(adminUserId);
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
    WHERE map.teamId = ${myTeamId}
    ORDER BY a.workDate DESC, a.id DESC
  `);

  return (rows as any[]) ?? [];
}


async function calcLateInfo(clockInAt?: Date | string | null) {
  if (!clockInAt) {
    return { isLate: 0, lateMinutes: 0 };
  }

  const d = new Date(clockInAt);
  const policy = await getAttendancePolicy();

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


async function calcEarlyLeaveInfo(clockOutAt?: Date | string | null) {
  if (!clockOutAt) {
    return { isEarlyLeave: 0, earlyLeaveMinutes: 0 };
  }

  const d = new Date(clockOutAt);
  const policy = await getAttendancePolicy();

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

async function getMyTeamId(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const row = await db
    .select()
    .from(userOrgMappings)
    .where(eq(userOrgMappings.userId, userId))
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

export async function getAttendancePolicy() {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(attendancePolicies)
    .where(eq(attendancePolicies.scopeType, "global"))
    .limit(1);

  return rows[0] ?? null;
}

export async function autoClockOutIfNeeded(record: any) {
  if (!record || !record.clockInAt || record.clockOutAt) return;

  const db = await getDb();
  if (!db) return;

  const policy = await getAttendancePolicy();

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
  const early = await calcEarlyLeaveInfo(clockOutAt);
  const late = await calcLateInfo(clockInAt);

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
    .where(eq(attendanceRecords.id, Number(record.id)));

  await db.insert(attendanceAdjustmentLogs).values({
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

  const current = await getAttendancePolicy();

  if (!current) {
    await db.insert(attendancePolicies).values({
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
    .where(eq(attendancePolicies.id, current.id));

  return await getAttendancePolicy();
}

export async function updateAttendanceStatusByManager(params: {
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

  const row = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, params.attendanceId))
    .limit(1);

  const current = row[0];
  if (!current) {
    throw new Error("근태 기록을 찾을 수 없습니다.");
  }

  // admin은 자기 팀만 수정 가능
  if (params.actorRole === "admin") {
    const myTeamId = await getMyTeamId(params.actorUserId);
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
    const policy = await getAttendancePolicy();

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

    const late = await calcLateInfo(nextClockInAt);
const early = await calcEarlyLeaveInfo(nextClockOutAt);

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
    .where(eq(attendanceRecords.id, current.id));

  await db.insert(attendanceAdjustmentLogs).values({
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
    afterStatus: params.status,
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
  attendanceId: number;
  actorUserId: number;
actorRole: string;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  reason?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const row = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, params.attendanceId))
    .limit(1);

  const current = row[0];
if (!current) {
  throw new Error("근태 기록을 찾을 수 없습니다.");
}

if (params.actorRole === "admin") {
  const myTeamId = await getMyTeamId(params.actorUserId);
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
const late = await calcLateInfo(nextClockInAt);
const early = await calcEarlyLeaveInfo(nextClockOutAt);

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
    .where(eq(attendanceRecords.id, params.attendanceId));

  await db.insert(attendanceAdjustmentLogs).values({
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

export async function listAttendanceAdjustmentLogs(attendanceId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (attendanceId) {
    const [rows] = await db.execute(sql`
      SELECT
        l.*,
        targetUser.name as targetUserName,
        actorUser.name as actorUserName,
targetUser.username as targetUserUsername,
targetUser.phone as targetUserPhone
      FROM attendance_adjustment_logs l
      INNER JOIN users targetUser ON targetUser.id = l.targetUserId
      INNER JOIN users actorUser ON actorUser.id = l.actorUserId
      WHERE l.attendanceId = ${attendanceId}
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
  INNER JOIN users targetUser ON targetUser.id = l.targetUserId
  INNER JOIN users actorUser ON actorUser.id = l.actorUserId
  ORDER BY l.createdAt DESC, l.id DESC
`);

  return (rows as any[]) ?? [];
}

export async function listTeamAttendanceAdjustmentLogs(
  adminUserId: number,
  attendanceId?: number
) {
  const db = await getDb();
  if (!db) return [];

  const myTeamId = await getMyTeamId(adminUserId);
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
      INNER JOIN users targetUser ON targetUser.id = l.targetUserId
      INNER JOIN users actorUser ON actorUser.id = l.actorUserId
      LEFT JOIN user_org_mappings map ON map.userId = targetUser.id
      LEFT JOIN teams t ON t.id = map.teamId
      WHERE l.attendanceId = ${attendanceId}
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
    INNER JOIN users targetUser ON targetUser.id = l.targetUserId
    INNER JOIN users actorUser ON actorUser.id = l.actorUserId
    LEFT JOIN user_org_mappings map ON map.userId = targetUser.id
    LEFT JOIN teams t ON t.id = map.teamId
    WHERE map.teamId = ${myTeamId}
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

export async function listNotices() {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT *
    FROM notices
    WHERE isActive = 1
    ORDER BY isPinned DESC, id DESC
  `);

  return (rows as any[]) ?? [];
}

export async function getNotice(id: number) {
  const db = await getDb();
  if (!db) return null;

  const [rows] = await db.execute(sql`
    SELECT *
    FROM notices
    WHERE id = ${id}
      AND isActive = 1
    LIMIT 1
  `);

  return ((rows as any[]) ?? [])[0] ?? null;
}

export async function createNotice(data: {
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
    title?: string;
    content?: string;
    isPinned?: boolean;
    importance?: "normal" | "important" | "urgent";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

 await db.execute(sql`
  UPDATE notices
  SET
    title = COALESCE(${data.title ?? null}, title),
    content = COALESCE(${data.content ?? null}, content),
    isPinned = COALESCE(${data.isPinned !== undefined ? (data.isPinned ? 1 : 0) : null}, isPinned),
    importance = COALESCE(${data.importance ?? null}, importance)
  WHERE id = ${id}
    AND isActive = 1
`);
}

export async function deleteNotice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    UPDATE notices
    SET isActive = 0
    WHERE id = ${id}
  `);
}

export async function bulkDeleteNotices(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const cleanIds = Array.from(
    new Set((ids || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))
  );

  if (!cleanIds.length) return;

  await db.execute(sql`
    UPDATE notices
    SET isActive = 0
    WHERE id IN (${sql.join(cleanIds.map((id) => sql`${id}`), sql`, `)})
  `);
}

export async function increaseNoticeView(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE notices
    SET viewCount = viewCount + 1
    WHERE id = ${id}
      AND isActive = 1
  `);
}

// ─── Schedules (일정/캘린더) ─────────────────────────────

export async function listMonthSchedules(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const [rows] = await db.execute(sql`
    SELECT *
    FROM schedules
    WHERE scheduleDate >= ${start}
      AND scheduleDate < ${end}
      AND isActive = 1
    ORDER BY scheduleDate ASC, startAt ASC, id ASC
  `);

  return (rows as any[]) ?? [];
}

export async function listTodaySchedules(
  userId: number,
  role?: "staff" | "admin" | "host" | "superhost" | string
) {
  const db = await getDb();
  if (!db) return [];

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
      WHERE scheduleDate = ${today}
        AND isActive = 1
      ORDER BY startAt ASC, id ASC
    `);

    return (rows as any[]) ?? [];
  }

  const [rows] = await db.execute(sql`
    SELECT *
    FROM schedules
    WHERE scheduleDate = ${today}
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
  createdByRole: "staff" | "admin" | "host" | "superhost";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.execute(sql`
    INSERT INTO schedules (
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

  const existingRows = await db.execute(sql`
    SELECT *
    FROM schedules
    WHERE id = ${id}
      AND isActive = 1
    LIMIT 1
  `);

  const existing = (((existingRows as any)?.[0]) ?? [])[0] ?? ((existingRows as any)?.[0] ?? null);
  const row = Array.isArray(existingRows?.[0]) ? (existingRows as any)[0][0] : existing;

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
      startAt = COALESCE(${data.startAt ?? null}, startAt)
    WHERE id = ${id}
      AND isActive = 1
  `);
}

export async function deleteSchedule(
  id: number,
  userId: number,
  role: "staff" | "admin" | "host" | "superhost" | string
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [rows] = await db.execute(sql`
    SELECT *
    FROM schedules
    WHERE id = ${id}
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
  `);
}


function pad2(n: number) {
  return String(n).padStart(2, "0");
}

async function getNextApprovalDocumentNumber(formType: "attendance" | "business_trip" | "general") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

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
    WHERE documentNumber LIKE ${likePrefix}
  `);

  const count = Number((rows as any)?.[0]?.cnt ?? 0) + 1;
  return `${prefix}-${yyyy}${mm}-${String(count).padStart(4, "0")}`;
}


export async function getApprovalSetting(
  formType: "attendance" | "business_trip" | "general"
) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(approvalSettings)
    .where(eq(approvalSettings.formType, formType))
    .limit(1);

  return rows[0] ?? null;
}

export async function saveApprovalSetting(params: {
  formType: "attendance" | "business_trip" | "general";
  firstApproverUserId?: number | null;
  secondApproverUserId?: number | null;
  thirdApproverUserId?: number | null;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await getApprovalSetting(params.formType);

  const payload: InsertApprovalSetting = {
    formType: params.formType,
    firstApproverUserId: params.firstApproverUserId ?? null,
    secondApproverUserId: params.secondApproverUserId ?? null,
    thirdApproverUserId: params.thirdApproverUserId ?? null,
    isActive: true,
    createdBy: params.actorUserId,
    updatedBy: params.actorUserId,
  };

  if (existing) {
    await db
      .update(approvalSettings)
      .set({
        firstApproverUserId: params.firstApproverUserId ?? null,
        secondApproverUserId: params.secondApproverUserId ?? null,
        thirdApproverUserId: params.thirdApproverUserId ?? null,
        updatedBy: params.actorUserId,
      } as any)
      .where(eq(approvalSettings.id, existing.id));

    return existing.id;
  }

  const result: any = await db.insert(approvalSettings).values(payload as any);
  return getInsertId(result);
}

export async function createApprovalLog(data: InsertApprovalLog) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(approvalLogs).values(data as any);
  return getInsertId(result);
}

export async function createApprovalDocument(params: {
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

  const documentNumber = await getNextApprovalDocumentNumber(params.formType);
  const setting = await getApprovalSetting(params.formType);

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

  const approverUsers = await getAllUsersDetailed();
  let step = 1;

  for (const approverUserId of approverIds) {
    const found = approverUsers.find((u: any) => Number(u.id) === Number(approverUserId));
    lines.push({
      documentId,
      stepOrder: step,
      approverUserId: Number(approverUserId),
      approverName: found?.name ?? null,
      approverRole: found?.role ?? null,
      stepStatus: "pending",
    });
    step += 1;
  }

  if (lines.length) {
    await db.insert(approvalDocumentLines).values(lines as any);
  }

  await createApprovalLog({
    documentId,
    actorUserId: params.applicantUserId,
    actorUserName: params.applicantUserName ?? null,
    actionType: "create",
    note: `${params.formType} 문서 생성`,
  } as any);

  return documentId;
}

export async function listMyApprovalDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT *
    FROM approval_documents
    WHERE applicantUserId = ${userId}
    ORDER BY createdAt DESC, id DESC
  `);

  return (rows as any[]) ?? [];
}

export async function getApprovalDocument(id: number) {
  const db = await getDb();
  if (!db) return null;

  const [docRows] = await db.execute(sql`
    SELECT *
    FROM approval_documents
    WHERE id = ${id}
    LIMIT 1
  `);

  const doc = ((docRows as any[]) ?? [])[0] ?? null;
  if (!doc) return null;

  const [lineRows] = await db.execute(sql`
    SELECT *
    FROM approval_document_lines
    WHERE documentId = ${id}
    ORDER BY stepOrder ASC, id ASC
  `);

  const [logRows] = await db.execute(sql`
    SELECT *
    FROM approval_logs
    WHERE documentId = ${id}
    ORDER BY createdAt DESC, id DESC
  `);

  return {
    document: doc,
    lines: (lineRows as any[]) ?? [],
    logs: (logRows as any[]) ?? [],
  };
}

export async function listPendingApprovalDocumentsForApprover(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const [rows] = await db.execute(sql`
    SELECT d.*, l.id as lineId, l.stepOrder, l.stepStatus
    FROM approval_documents d
    INNER JOIN approval_document_lines l
      ON l.documentId = d.id
    WHERE l.approverUserId = ${userId}
      AND l.stepStatus = 'pending'
      AND d.status = 'pending'
      AND d.currentStepOrder = l.stepOrder
    ORDER BY d.createdAt DESC, d.id DESC
  `);

  return (rows as any[]) ?? [];
}

export async function applyApprovedDocumentToAttendance(params: {
  documentId: number;
  actorUserId: number;
  actorUserName?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const detail = await getApprovalDocument(params.documentId);
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
      .where(eq(approvalDocuments.id, params.documentId));

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
    .where(eq(approvalDocuments.id, params.documentId));

  await createApprovalLog({
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
  documentId: number;
  approverUserId: number;
  approverUserName?: string | null;
  comment?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const detail = await getApprovalDocument(params.documentId);
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
    .where(eq(approvalDocumentLines.id, Number(currentLine.id)));

  const nextLine = (detail.lines || []).find(
    (line: any) => Number(line.stepOrder) === Number(doc.currentStepOrder) + 1
  );

  if (nextLine) {
    await db
      .update(approvalDocuments)
      .set({
        currentStepOrder: Number(doc.currentStepOrder) + 1,
      } as any)
      .where(eq(approvalDocuments.id, params.documentId));
  } else {
    await db
      .update(approvalDocuments)
      .set({
        status: "approved",
        finalApprovedAt: new Date(),
      } as any)
      .where(eq(approvalDocuments.id, params.documentId));

    await applyApprovedDocumentToAttendance({
      documentId: params.documentId,
      actorUserId: params.approverUserId,
      actorUserName: params.approverUserName ?? null,
    });
  }

  await createApprovalLog({
    documentId: params.documentId,
    actorUserId: params.approverUserId,
    actorUserName: params.approverUserName ?? null,
    actionType: "approve",
    note: params.comment ?? "승인 처리",
  } as any);

  return true;
}

export async function rejectApprovalDocument(params: {
  documentId: number;
  approverUserId: number;
  approverUserName?: string | null;
  comment?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const detail = await getApprovalDocument(params.documentId);
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
    .where(eq(approvalDocumentLines.id, Number(currentLine.id)));

  await db
    .update(approvalDocuments)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      rejectedReason: params.comment ?? null,
    } as any)
    .where(eq(approvalDocuments.id, params.documentId));

  await createApprovalLog({
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