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
} from "../drizzle/schema";

import { ENV } from "./_core/env";

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

export async function listLeadForms() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(leadForms).orderBy(desc(leadForms.createdAt));
}

export async function createLeadForm(data: InsertLeadForm) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(leadForms).values(data);
  return getInsertId(result);
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
  role: "staff" | "admin" | "host";
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
  role: "staff" | "admin" | "host"
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

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

  const result: any = await db.insert(planSemesters).values(data);
  return getInsertId(result);
}

export async function updatePlanSemester(
  id: number,
  data: Partial<InsertPlanSemester>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

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