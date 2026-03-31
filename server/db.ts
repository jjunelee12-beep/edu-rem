import { eq, and, sql, desc } from "drizzle-orm";
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
  planSemesters,
  InsertPlanSemester,
  transferSubjects,
  InsertTransferSubject,
  educationInstitutions,
  transferAttachments,
  InsertTransferAttachment,
  courseSubjectTemplates,
  InsertCourseSubjectTemplate,
  privateCertificateRequests,
  InsertPrivateCertificateRequest,
  practiceSupportRequests,
  InsertPracticeSupportRequest,
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
} from "../drizzle/schema";

import { ENV } from "./_core/env";
import bcrypt from "bcryptjs";

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
    .where(eq(practiceInstitutions.isActive, true));
}

// 실습교육원 목록
export async function listActivePracticeEducationCenters() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(practiceEducationCenters)
    .where(eq(practiceEducationCenters.isActive, true));
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

  const [refundResult] = await db.execute(
    sql`SELECT COALESCE(SUM(refundAmount), 0) as total
        FROM refunds
        WHERE studentId = ${studentId}
          AND approvalStatus = '승인'`
  );
  const approvedRefund = toNumber((refundResult as any)[0]?.total);

  const rawPaymentAmount = firstActual?.actualAmount
    ? toNumber(firstActual.actualAmount)
    : toNumber(student.paymentAmount);

  return {
    status:
      lastSemester?.status === "등록 종료"
        ? "등록 종료"
        : student.status || "등록",
    startDate: firstActual?.actualStartDate || student.startDate || null,
    paymentAmount: Math.max(rawPaymentAmount - approvedRefund, 0),
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

// ─── Lead Forms ──────────────────────────────────────────────────────
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
  };
}

export async function listLeadForms(formType: "landing" | "ad") {
  const db = await getDb();
  return db
    .select()
    .from(leadForms)
    .where(eq(leadForms.formType, formType))
    .orderBy(desc(leadForms.id));
}

export async function createLeadForm(
  assigneeId: number,
  formType: "landing" | "ad"
) {
  const db = await getDb();
  const token =
    formType === "ad"
      ? `ad_${Math.random().toString(36).slice(2, 12)}`
      : `lf_${Math.random().toString(36).slice(2, 12)}`;

  await db.insert(leadForms).values({
    assigneeId,
    token,
    formType,
    isActive: true,
  });

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
export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(notifications).values({
    type: "lead",
    isRead: false,
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
        ? `[전체 일정] ${title} 일정이 곧 시작됩니다.`
        : `[일정 알림] ${title} 일정이 곧 시작됩니다.`;

    if (item.scope === "global") {
      const targets = (allUsers || []).filter((u: any) => !!u.isActive);

      for (const user of targets) {
        await createNotification({
          userId: Number(user.id),
          type: "schedule",
          message,
          relatedId: Number(item.id),
          isRead: false,
        } as any);

        createdCount += 1;
      }
    } else {
      if (item.ownerUserId) {
        await createNotification({
          userId: Number(item.ownerUserId),
          type: "schedule",
          message,
          relatedId: Number(item.id),
          isRead: false,
        } as any);

        createdCount += 1;
      }
    }

    await markScheduleNotified(Number(item.id));
  }

  return { count: createdCount };
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
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(
    tomorrow.getDate()
  ).padStart(2, "0")} 00:00:00`;

  const assigneeStudentCond = assigneeId
    ? sql`AND s.assigneeId = ${assigneeId}`
    : sql``;

  const assigneeConsultCond = assigneeId
    ? sql`AND c.assigneeId = ${assigneeId}`
    : sql``;

  const assigneeRefundCond = assigneeId
    ? sql`AND r.assigneeId = ${assigneeId}`
    : sql``;

  const [consultRows] = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN c.consultDate >= ${monthStart} AND c.consultDate < ${monthEnd} THEN 1 ELSE 0 END), 0) as monthConsultationCount,
      COUNT(*) as totalConsultationCount
    FROM consultations c
    WHERE 1=1
    ${assigneeConsultCond}
  `);

  const [studentRows] = await db.execute(sql`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN s.approvalStatus = '승인'
           AND s.paymentDate >= ${monthStart}
           AND s.paymentDate < ${monthEnd}
          THEN 1 ELSE 0
        END
      ), 0) as monthRegistered,

      COALESCE(SUM(CASE WHEN s.approvalStatus = '승인' THEN 1 ELSE 0 END), 0) as totalRegisteredCount,

      COALESCE(SUM(
        CASE
          WHEN s.approvalStatus = '승인'
           AND s.approvedAt >= ${monthStart}
           AND s.approvedAt < ${monthEnd}
          THEN 1 ELSE 0
        END
      ), 0) as monthApprovedCount,

      COALESCE(SUM(
        CASE
          WHEN s.approvalStatus = '불승인'
           AND s.rejectedAt >= ${monthStart}
           AND s.rejectedAt < ${monthEnd}
          THEN 1 ELSE 0
        END
      ), 0) as monthRejectedCount,

      COALESCE(SUM(CASE WHEN s.approvalStatus = '대기' THEN 1 ELSE 0 END), 0) as monthPendingCount,

      COALESCE(SUM(CASE WHEN s.approvalStatus = '승인' THEN 1 ELSE 0 END), 0) as totalApprovedCount,
      COALESCE(SUM(CASE WHEN s.approvalStatus = '불승인' THEN 1 ELSE 0 END), 0) as totalRejectedCount,
      COALESCE(SUM(CASE WHEN s.approvalStatus = '대기' THEN 1 ELSE 0 END), 0) as totalPendingCount
    FROM students s
    WHERE 1=1
    ${assigneeStudentCond}
  `);

  const [salesRows] = await db.execute(sql`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN sem.isCompleted = true
           AND sem.actualPaymentDate >= ${monthStart}
           AND sem.actualPaymentDate < ${monthEnd}
          THEN sem.actualAmount ELSE 0
        END
      ), 0) as monthSemesterSales,

      COALESCE(SUM(
        CASE
          WHEN sem.isCompleted = true
           AND sem.actualPaymentDate >= ${todayStart}
           AND sem.actualPaymentDate < ${tomorrowStr}
          THEN sem.actualAmount ELSE 0
        END
      ), 0) as todaySemesterSales,

      COALESCE(SUM(
        CASE
          WHEN sem.isCompleted = true
          THEN sem.actualAmount ELSE 0
        END
      ), 0) as totalSemesterSales
    FROM semesters sem
    INNER JOIN students s ON s.id = sem.studentId
    WHERE 1=1
    ${assigneeStudentCond}
  `);

  const [refundRows] = await db.execute(sql`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN r.approvalStatus = '승인'
           AND r.refundDate >= ${monthStart}
           AND r.refundDate < ${monthEnd}
          THEN r.refundAmount ELSE 0
        END
      ), 0) as monthRefund,

      COALESCE(SUM(
        CASE
          WHEN r.approvalStatus = '승인'
          THEN r.refundAmount ELSE 0
        END
      ), 0) as totalRefund
    FROM refunds r
    WHERE 1=1
    ${assigneeRefundCond}
  `);

  const consult = (consultRows as any)[0] || {};
  const student = (studentRows as any)[0] || {};
  const sales = (salesRows as any)[0] || {};
  const refund = (refundRows as any)[0] || {};

  const monthConsultationCount = toNumber(consult.monthConsultationCount);
  const totalConsultationCount = toNumber(consult.totalConsultationCount);

  const monthRegistered = toNumber(student.monthRegistered);
  const totalRegisteredCount = toNumber(student.totalRegisteredCount);
  const monthApprovedCount = toNumber(student.monthApprovedCount);
  const monthRejectedCount = toNumber(student.monthRejectedCount);
  const monthPendingCount = toNumber(student.monthPendingCount);
  const totalApprovedCount = toNumber(student.totalApprovedCount);
  const totalRejectedCount = toNumber(student.totalRejectedCount);
  const totalPendingCount = toNumber(student.totalPendingCount);

  const todaySemesterSales = toNumber(sales.todaySemesterSales);
  const monthSemesterSales = toNumber(sales.monthSemesterSales);
  const totalSemesterSales = toNumber(sales.totalSemesterSales);

  const monthRefund = toNumber(refund.monthRefund);
  const totalRefund = toNumber(refund.totalRefund);

  const todaySales = todaySemesterSales;
  const monthSales = monthSemesterSales - monthRefund;
  const totalSales = totalSemesterSales - totalRefund;

  return {
    monthConsultationCount,
    monthRegistered,
    todaySales,
    monthSales,
    totalSales,

    // 기존 UI 호환용
    todayFirstSales: 0,
    monthFirstSales: 0,
    todaySemesterSales,
    monthSemesterSales,

    monthRefund,
    totalRefund,
    monthApprovedCount,
    monthRejectedCount,
    monthPendingCount,
    totalConsultationCount,
    totalRegisteredCount,
    totalApprovedCount,
    totalRejectedCount,
    totalPendingCount,
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
  const assigneeCond = assigneeId ? sql`AND s.assigneeId = ${assigneeId}` : sql``;
  const refundAssigneeCond = assigneeId ? sql`AND r.assigneeId = ${assigneeId}` : sql``;

  const [salesResult] = await db.execute(sql`
    SELECT
      sem.id,
      sem.studentId,
      sem.actualAmount,
      sem.actualPaymentDate,
      s.clientName,
      s.phone,
      s.course,
      s.assigneeId
    FROM semesters sem
    INNER JOIN students s ON s.id = sem.studentId
    WHERE sem.isCompleted = true
      AND sem.actualPaymentDate IS NOT NULL
      AND sem.actualPaymentDate >= ${monthStart}
      AND sem.actualPaymentDate < ${monthEnd}
      ${assigneeCond}
  `);

  const [refundResult] = await db.execute(sql`
    SELECT
      r.id,
      r.studentId,
      r.refundAmount,
      r.refundDate,
      r.reason,
      r.assigneeId,
      s.clientName,
      s.phone,
      s.course
    FROM refunds r
    INNER JOIN students s ON s.id = r.studentId
    WHERE r.approvalStatus = '승인'
      AND r.refundDate >= ${monthStart}
      AND r.refundDate < ${monthEnd}
      ${refundAssigneeCond}
  `);

  const salesRows = (salesResult as any)[0] || [];
  const refundRows = (refundResult as any)[0] || [];

  const salesEntries = salesRows.map((r: any) => ({
    id: r.id,
    studentId: r.studentId,
    type: "semester",
    clientName: r.clientName,
    phone: r.phone,
    course: r.course,
    amount: toNumber(r.actualAmount),
    paymentDate: r.actualPaymentDate,
    assigneeId: r.assigneeId,
  }));

  const refundEntries = refundRows.map((r: any) => ({
    id: r.id,
    studentId: r.studentId,
    type: "refund",
    clientName: r.clientName,
    phone: r.phone,
    course: r.course,
    amount: -toNumber(r.refundAmount),
    paymentDate: r.refundDate,
    assigneeId: r.assigneeId,
    reason: r.reason || "",
  }));

  const entries = [...salesEntries, ...refundEntries].sort(
    (a: any, b: any) =>
      new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );

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
    sql`SELECT COALESCE(SUM(plannedAmount), 0) as total FROM semesters WHERE studentId = ${studentId}`
  );
  const totalRequired = toNumber((plannedResult as any)[0]?.total);

  const [paidResult] = await db.execute(
    sql`SELECT COALESCE(SUM(actualAmount), 0) as total
        FROM semesters
        WHERE studentId = ${studentId}
          AND isCompleted = true`
  );
  const totalPaid = toNumber((paidResult as any)[0]?.total);

  const [refundResult] = await db.execute(
    sql`SELECT COALESCE(SUM(refundAmount), 0) as total
        FROM refunds
        WHERE studentId = ${studentId}
          AND approvalStatus = '승인'`
  );
  const totalRefund = toNumber((refundResult as any)[0]?.total);

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

  const salesData = await db
    .select({
      assigneeId: students.assigneeId,
      totalSales: sql<string>`COALESCE(SUM(${semesters.actualAmount}), 0)`,
    })
    .from(semesters)
    .innerJoin(students, eq(semesters.studentId, students.id))
    .where(
      and(
        eq(semesters.isCompleted, true),
        eq(students.approvalStatus, "승인"),
        sql`${semesters.actualPaymentDate} >= ${startDate}`,
        sql`${semesters.actualPaymentDate} < ${endDate}`,
        ...(filterAssigneeId ? [eq(students.assigneeId, filterAssigneeId)] : [])
      )
    )
    .groupBy(students.assigneeId);

  const refundData = await db
    .select({
      assigneeId: refunds.assigneeId,
      totalRefunds: sql<string>`COALESCE(SUM(${refunds.refundAmount}), 0)`,
    })
    .from(refunds)
    .where(
      and(
        eq(refunds.approvalStatus, "승인"),
        sql`${refunds.refundDate} >= ${startDate}`,
        sql`${refunds.refundDate} < ${endDate}`,
        ...(filterAssigneeId ? [eq(refunds.assigneeId, filterAssigneeId)] : [])
      )
    )
    .groupBy(refunds.assigneeId);

  const allUserRows = await db.select({ id: users.id, name: users.name }).from(users);
  const userMap = new Map(allUserRows.map((u) => [u.id, u.name || "이름없음"]));

  const reportMap = new Map<
    number,
    {
      assigneeId: number;
      assigneeName: string;
      totalSales: number;
      totalRefunds: number;
    }
  >();

  for (const row of salesData) {
    const aid = row.assigneeId;
    if (!reportMap.has(aid)) {
      reportMap.set(aid, {
        assigneeId: aid,
        assigneeName: userMap.get(aid) || "이름없음",
        totalSales: 0,
        totalRefunds: 0,
      });
    }
    reportMap.get(aid)!.totalSales += Number(row.totalSales);
  }

  for (const row of refundData) {
    const aid = row.assigneeId;
    if (!reportMap.has(aid)) {
      reportMap.set(aid, {
        assigneeId: aid,
        assigneeName: userMap.get(aid) || "이름없음",
        totalSales: 0,
        totalRefunds: 0,
      });
    }
    reportMap.get(aid)!.totalRefunds += Number(row.totalRefunds);
  }

  return Array.from(reportMap.values()).map((r) => {
    const netSales = r.totalSales - r.totalRefunds;
    const commission = Math.floor(netSales * 0.5);
    const tax = Math.floor(commission * 0.033);
    const finalPayout = commission - tax;
    return { ...r, netSales, commission, tax, finalPayout };
  });
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
}) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

  const result = await db.insert(educationInstitutions).values({
    name: data.name,
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder ?? 0,
  });

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
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

  await db
    .update(educationInstitutions)
    .set(data)
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

export async function createPrivateCertificateRequest(data: InsertPrivateCertificateRequest) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(privateCertificateRequests).values({
    ...data,
    feeAmount: data.feeAmount ?? "0",
    paymentStatus: data.paymentStatus ?? "결제대기",
  });

  return getInsertId(result);
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
}

export async function deletePrivateCertificateRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(privateCertificateRequests).where(eq(privateCertificateRequests.id, id));
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

  return getInsertId(result);
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
}

export async function deletePracticeSupportRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(practiceSupportRequests).where(eq(practiceSupportRequests.id, id));
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
export async function listPracticeInstitutions(
  institutionType?: "education" | "institution"
) {
  const db = await getDb();
  if (!db) return [];

  if (institutionType) {
    return db
      .select()
      .from(practiceInstitutions)
      .where(
        and(
          eq(practiceInstitutions.institutionType, institutionType),
          eq(practiceInstitutions.isActive, true)
        )
      )
      .orderBy(desc(practiceInstitutions.createdAt));
  }

  return db
    .select()
    .from(practiceInstitutions)
    .where(eq(practiceInstitutions.isActive, true))
    .orderBy(desc(practiceInstitutions.createdAt));
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
  dataList: InsertPracticeInstitution[]
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (!dataList.length) return [];

  const rows = dataList.map((item) => ({
    ...item,
    price: item.price ?? "0",
    isActive: item.isActive ?? true,
  }));

  return db.insert(practiceInstitutions).values(rows as any);
}

export async function listPracticeEducationCenters() {
  const db = await getDb();
  if (!db) return [];

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

export async function createPosition(data: {
  name: string;
  sortOrder?: number | null;
  isActive?: boolean | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(positions).values({
    name: data.name.trim(),
    sortOrder: data.sortOrder ?? 0,
    isActive: data.isActive ?? true,
  } as InsertPosition);

  return getInsertId(result);
}

export async function updatePosition(
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

  return getInsertId(result);
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

  await db
    .update(chatRoomMembers)
    .set({
      lastReadMessageId: params.lastReadMessageId ?? null,
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
  const late = calcLateInfo(now);

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
  const early = calcEarlyLeaveInfo(clockOutAt);

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

  return (rows as any[]) ?? [];
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

function calcLateInfo(clockInAt?: Date | string | null) {
  if (!clockInAt) {
    return { isLate: 0, lateMinutes: 0 };
  }

  const d = new Date(clockInAt);

  const base = new Date(d);
  base.setHours(9, 10, 0, 0); // 09:10 기준

  if (d <= base) {
    return { isLate: 0, lateMinutes: 0 };
  }

  const diff = Math.floor((d.getTime() - base.getTime()) / 60000);

  return { isLate: 1, lateMinutes: diff };
}

function calcEarlyLeaveInfo(clockOutAt?: Date | string | null) {
  if (!clockOutAt) {
    return { isEarlyLeave: 0, earlyLeaveMinutes: 0 };
  }

  const d = new Date(clockOutAt);

  const base = new Date(d);
  base.setHours(18, 0, 0, 0); // 18:00 기준

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
  const late = calcLateInfo(nextClockInAt);
  const early = calcEarlyLeaveInfo(nextClockOutAt);

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