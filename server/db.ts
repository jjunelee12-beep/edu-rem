import { eq, and, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  consultations, InsertConsultation,
  students, InsertStudent,
  semesters, InsertSemester,
  plans, InsertPlan,
  refunds, InsertRefund,
  leadForms, InsertLeadForm,
 planSemesters, InsertPlanSemester,
  transferSubjects, InsertTransferSubject,
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

  const semesters = await listSemesters(studentId);

  const actualSemesters = semesters
    .filter((s: any) => s.actualStartDate || s.actualInstitution || s.actualSubjectCount || s.actualAmount || s.actualPaymentDate)
    .sort((a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder));

  const firstActual = actualSemesters[0];

  const toNumber = (v: any) =>
    Number(String(v ?? "0").replace(/,/g, "").trim()) || 0;

  return {
    status: firstActual ? "등록" : (student.status || ""),
    startDate: firstActual?.actualStartDate || student.startDate || null,
    paymentAmount: firstActual?.actualAmount ? toNumber(firstActual.actualAmount) : toNumber(student.paymentAmount),
    subjectCount: firstActual?.actualSubjectCount ?? student.subjectCount ?? 0,
    paymentDate: firstActual?.actualPaymentDate || student.paymentDate || null,
    institution: firstActual?.actualInstitution || student.institution || "",
  };
}

// ─── Helper: Asia/Seoul 기준 이번달 범위 ────────────────────────────
function getKSTMonthRange() {
  // KST = UTC+9
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const year = kstNow.getUTCFullYear();
  const month = kstNow.getUTCMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const today = `${year}-${String(month).padStart(2, "0")}-${String(kstNow.getUTCDate()).padStart(2, "0")}`;
  return { year, month, monthStart, monthEnd, today };
}

// ─── Users ───────────────────────────────────────────────────────────
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

  return db
    .select()
    .from(leadForms)
    .orderBy(desc(leadForms.createdAt));
}

export async function createLeadForm(data: InsertLeadForm) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(leadForms).values(data);
  return result?.[0]?.insertId ?? result?.insertId ?? null;
}

export async function updateLeadFormActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.update(leadForms).set({ isActive } as any).where(eq(leadForms.id, id));
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
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

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return db.select({ id: users.id, name: users.name, role: users.role }).from(users);
}

export async function getAllUsersDetailed() {
  const db = await getDb();
  if (!db) return [];

  return db.select({
    id: users.id,
    openId: users.openId,
    username: users.username,
    name: users.name,
    email: users.email,
    role: users.role,
    bankName: users.bankName,
    bankAccount: users.bankAccount,
    isActive: users.isActive,
    loginMethod: users.loginMethod,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users);
}

export async function createUserAccount(data: {
  openId: string;
  username: string;
  passwordHash?: string | null;
  name: string;
  email?: string | null;
  role: "staff" | "admin" | "host";
  bankName?: string | null;
  bankAccount?: string | null;
  loginMethod?: string | null;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.insert(users).values({
    openId: data.openId,
    username: data.username,
    passwordHash: data.passwordHash ?? null,
    name: data.name,
    email: data.email ?? null,
    role: data.role,
    bankName: data.bankName ?? null,
    bankAccount: data.bankAccount ?? null,
    loginMethod: data.loginMethod ?? "manual",
    isActive: data.isActive ?? true,
  } as any);
}

export async function updateUserAccount(
  id: number,
  data: {
    username?: string;
    passwordHash?: string | null;
    name?: string | null;
    email?: string | null;
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

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

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

  const result = await db.select().from(consultations).where(eq(consultations.id, id)).limit(1);
  return result[0];
}

export async function createConsultation(data: InsertConsultation) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(consultations).values(data);

  const insertId =
    result?.insertId ??
    result?.[0]?.insertId ??
    null;

  console.log("[DB] createConsultation insertId:", insertId);

  return insertId;
}

export async function bulkCreateConsultations(dataList: InsertConsultation[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (dataList.length === 0) return [];

  console.log("[DB] bulkCreateConsultations count:", dataList.length);
  console.log("[DB] bulkCreateConsultations first keys:", Object.keys((dataList[0] ?? {}) as any));
  console.log("[DB] bulkCreateConsultations first row:", dataList[0]);

  const result = await db.insert(consultations).values(dataList);

  console.log("[DB] bulkCreateConsultations result:", result);

  return result;
}

export async function updateConsultation(id: number, data: Partial<InsertConsultation>) {
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
      (COALESCE(s.paymentAmount, 0) + COALESCE((SELECT SUM(sem.plannedAmount) FROM semesters sem WHERE sem.studentId = s.id), 0)) as totalRequired,
      (CASE WHEN s.approvalStatus = '승인' THEN COALESCE(s.paymentAmount, 0) ELSE 0 END
       + COALESCE((SELECT SUM(sem2.actualAmount) FROM semesters sem2 WHERE sem2.studentId = s.id AND sem2.isCompleted = true), 0)) as paidAmount,
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
  return (result as any)[0].insertId;
}

export async function updateStudent(id: number, data: Partial<InsertStudent>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.update(students).set(data).where(eq(students.id, id));
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

  return db.select().from(semesters)
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

  const result = await db.insert(semesters).values(data);
  return (result as any)[0].insertId;
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

// ─── 학기별 전체 리스트 (별도 탭용) ─────────────────────────────────
export async function listAllSemesters(assigneeId?: number, plannedMonthFilter?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];
  if (assigneeId) conditions.push(sql`s.assigneeId = ${assigneeId}`);
  if (plannedMonthFilter) conditions.push(sql`sem.plannedMonth = ${plannedMonthFilter}`);

  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const [rows] = await db.execute(sql`
    SELECT sem.*,
      s.clientName, s.phone, s.course, s.assigneeId, s.studentStatus,
      s.approvalStatus,
      (SELECT p.hasPractice FROM plans p WHERE p.studentId = s.id LIMIT 1) as hasPractice,
      (SELECT p.practiceHours FROM plans p WHERE p.studentId = s.id LIMIT 1) as practiceHours,
      (SELECT p.practiceStatus FROM plans p WHERE p.studentId = s.id LIMIT 1) as practiceStatus
    FROM semesters sem
    INNER JOIN students s ON sem.studentId = s.id
    ${whereClause}
    ORDER BY sem.plannedMonth ASC, s.clientName ASC
  `);

  return (rows as unknown) as any[];
}

// ─── Plans ───────────────────────────────────────────────────────────
export async function getPlan(studentId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(plans).where(eq(plans.studentId, studentId)).limit(1);
  return result[0];
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
    return (result as any)[0].insertId;
  }
}

// ─── Refunds ─────────────────────────────────────────────────────────
export async function listRefunds(assigneeId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (assigneeId) {
    return db.select().from(refunds).where(eq(refunds.assigneeId, assigneeId)).orderBy(desc(refunds.createdAt));
  }

  return db.select().from(refunds).orderBy(desc(refunds.createdAt));
}

export async function listRefundsByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(refunds).where(eq(refunds.studentId, studentId)).orderBy(desc(refunds.createdAt));
}

export async function createRefund(data: InsertRefund) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.insert(refunds).values(data);
  return (result as any)[0].insertId;
}

export async function updateRefund(id: number, data: Partial<InsertRefund>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.update(refunds).set(data).where(eq(refunds.id, id));
}

export async function deleteRefund(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(refunds).where(eq(refunds.id, id));
}

// ─── Dashboard Stats (v4: KST 기준, 결제완료 기준) ──────────────────
export async function getDashboardStats(assigneeId?: number) {
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const students = await listStudents(assigneeId);

  const toNumber = (v: any) =>
    Number(String(v ?? "0").replace(/,/g, "").trim()) || 0;

  // 학생 첫 결제
  const todayFirstSales = students
    .filter(
      (s: any) =>
        s.paymentDate &&
        new Date(s.paymentDate) >= startOfToday &&
        new Date(s.paymentDate) < endOfToday
    )
    .reduce((sum: number, s: any) => sum + toNumber(s.paymentAmount), 0);

  const monthFirstSales = students
    .filter(
      (s: any) =>
        s.paymentDate &&
        new Date(s.paymentDate) >= startOfMonth &&
        new Date(s.paymentDate) < endOfMonth
    )
    .reduce((sum: number, s: any) => sum + toNumber(s.paymentAmount), 0);

  const monthRegistered = students.filter(
    (s: any) =>
      s.paymentDate &&
      new Date(s.paymentDate) >= startOfMonth &&
      new Date(s.paymentDate) < endOfMonth &&
      toNumber(s.paymentAmount) > 0
  ).length;

  const monthConsultations = await listConsultations(assigneeId);
  const monthConsultationCount = monthConsultations.filter((c: any) => {
    const d = new Date(c.consultDate);
    return d >= startOfMonth && d < endOfMonth;
  }).length;

  // 학기 실제 수납
  const dbConn = await getDb();
  let todaySemesterSales = 0;
  let monthSemesterSales = 0;
  let totalSales = 0;

  if (dbConn) {
    const semesterRows = await dbConn.execute(sql`
      SELECT s.assigneeId, sem.actualAmount, sem.actualPaymentDate
      FROM semesters sem
      INNER JOIN students s ON s.id = sem.studentId
      WHERE sem.isCompleted = true
    `);

    const rows = (semesterRows as any)[0] || [];

    for (const row of rows) {
      if (assigneeId && Number(row.assigneeId) !== Number(assigneeId)) continue;

      const amount = toNumber(row.actualAmount);
      const payDate = row.actualPaymentDate ? new Date(row.actualPaymentDate) : null;

      totalSales += amount;

      if (payDate && payDate >= startOfToday && payDate < endOfToday) {
        todaySemesterSales += amount;
      }

      if (payDate && payDate >= startOfMonth && payDate < endOfMonth) {
        monthSemesterSales += amount;
      }
    }
  }

  const totalFirstSales = students.reduce(
    (sum: number, s: any) => sum + toNumber(s.paymentAmount),
    0
  );

  return {
    monthConsultationCount,
    monthRegistered,
    todaySales: todayFirstSales + todaySemesterSales,
    monthSales: monthFirstSales + monthSemesterSales,
    totalSales: totalFirstSales + totalSales,
    todayFirstSales,
    monthFirstSales,
    todaySemesterSales,
    monthSemesterSales,
  };
}

// ─── 이번달 승인/불승인 내역 (v4: approvedAt/rejectedAt 기준) ────────
export async function getMonthSalesEntries(assigneeId?: number) {
  const students = await listStudents(assigneeId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const toNumber = (v: any) =>
    Number(String(v ?? "0").replace(/,/g, "").trim()) || 0;

  const registered = students
    .filter(
      (s: any) =>
        s.paymentDate &&
        new Date(s.paymentDate) >= startOfMonth &&
        new Date(s.paymentDate) < endOfMonth &&
        toNumber(s.paymentAmount) > 0
    )
    .map((s: any) => ({
      id: s.id,
      type: "first",
      clientName: s.clientName,
      phone: s.phone,
      course: s.course,
      amount: toNumber(s.paymentAmount),
      paymentDate: s.paymentDate,
      assigneeId: s.assigneeId,
    }));

  const dbConn = await getDb();
  let semesters: any[] = [];

  if (dbConn) {
    const result = await dbConn.execute(sql`
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
    `);

    const rows = (result as any)[0] || [];

    semesters = rows
      .filter((r: any) => {
        if (assigneeId && Number(r.assigneeId) !== Number(assigneeId)) return false;
        const d = new Date(r.actualPaymentDate);
        return d >= startOfMonth && d < endOfMonth;
      })
      .map((r: any) => ({
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
  }

  const entries = [...registered, ...semesters].sort(
    (a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );

  const totalAmount = entries.reduce((sum: number, x: any) => sum + toNumber(x.amount), 0);

  return {
    entries,
    totalCount: entries.length,
    totalAmount,
  };
}
// ─── 학생별 총 결제해야할 금액 / 수납 금액 ──────────────────────────────
export async function getStudentPaymentSummary(studentId: number) {
  const db = await getDb();
  if (!db) {
    return { totalRequired: 0, totalPaid: 0, totalRefund: 0, remainingAmount: 0 };
  }

  const student = await getStudent(studentId);
  if (!student) {
    return { totalRequired: 0, totalPaid: 0, totalRefund: 0, remainingAmount: 0 };
  }

  const toNumber = (v: any) =>
    Number(String(v ?? "0").replace(/,/g, "").trim()) || 0;

  const firstAmount = toNumber(student.paymentAmount);

  const [plannedResult] = await db.execute(
    sql`SELECT COALESCE(SUM(plannedAmount), 0) as total FROM semesters WHERE studentId = ${studentId}`
  );
  const semesterPlanned = toNumber((plannedResult as any)[0]?.total);

  const [paidResult] = await db.execute(
    sql`SELECT COALESCE(SUM(actualAmount), 0) as total FROM semesters WHERE studentId = ${studentId} AND isCompleted = true`
  );
  const semesterPaid = toNumber((paidResult as any)[0]?.total);

  const [refundResult] = await db.execute(
    sql`SELECT COALESCE(SUM(refundAmount), 0) as total FROM refunds WHERE studentId = ${studentId}`
  );
  const totalRefund = toNumber((refundResult as any)[0]?.total);

  const totalRequired = firstAmount + semesterPlanned;

  // 승인 제거: paymentDate 있으면 첫 결제 완료로 봄
  const firstPaid = student.paymentDate && firstAmount > 0 ? firstAmount : 0;

  const totalPaid = firstPaid + semesterPaid;
  const remainingAmount = totalRequired - totalPaid - totalRefund;

  return {
    totalRequired,
    totalPaid,
    totalRefund,
    remainingAmount,
  };
}
// ─── Settlement (정산 리포트) ─────────────────────────────────────────
export async function getSettlementReport(year: number, month: number, filterAssigneeId?: number) {
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
    .where(and(
      eq(semesters.isCompleted, true),
      eq(students.approvalStatus, "승인"),
      sql`${semesters.actualPaymentDate} >= ${startDate}`,
      sql`${semesters.actualPaymentDate} < ${endDate}`,
      ...(filterAssigneeId ? [eq(students.assigneeId, filterAssigneeId)] : [])
    ))
    .groupBy(students.assigneeId);

  const firstSalesData = await db
    .select({
      assigneeId: students.assigneeId,
      totalSales: sql<string>`COALESCE(SUM(${students.paymentAmount}), 0)`,
    })
    .from(students)
    .where(and(
      eq(students.approvalStatus, "승인"),
      sql`${students.paymentDate} >= ${startDate}`,
      sql`${students.paymentDate} < ${endDate}`,
      ...(filterAssigneeId ? [eq(students.assigneeId, filterAssigneeId)] : [])
    ))
    .groupBy(students.assigneeId);

  const refundData = await db
    .select({
      assigneeId: refunds.assigneeId,
      totalRefunds: sql<string>`COALESCE(SUM(${refunds.refundAmount}), 0)`,
    })
    .from(refunds)
    .where(and(
      sql`${refunds.refundDate} >= ${startDate}`,
      sql`${refunds.refundDate} < ${endDate}`,
      ...(filterAssigneeId ? [eq(refunds.assigneeId, filterAssigneeId)] : [])
    ))
    .groupBy(refunds.assigneeId);

  const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
  const userMap = new Map(allUsers.map((u) => [u.id, u.name || "이름없음"]));

  const reportMap = new Map<number, {
    assigneeId: number;
    assigneeName: string;
    totalSales: number;
    totalRefunds: number;
  }>();

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

  for (const row of firstSalesData) {
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
// ─── Plan Semesters (학생 플랜 과목표) ───────────────────────────────
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
  return result?.[0]?.insertId ?? result?.insertId ?? null;
}

export async function updatePlanSemester(id: number, data: Partial<InsertPlanSemester>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.update(planSemesters).set(data as any).where(eq(planSemesters.id, id));
}

export async function deletePlanSemester(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(planSemesters).where(eq(planSemesters.id, id));
}

// ─── Transfer Subjects (전적대 과목표) ───────────────────────────────
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
  return result?.[0]?.insertId ?? result?.insertId ?? null;
}

export async function updateTransferSubject(id: number, data: Partial<InsertTransferSubject>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.update(transferSubjects).set(data as any).where(eq(transferSubjects.id, id));
}

export async function deleteTransferSubject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.delete(transferSubjects).where(eq(transferSubjects.id, id));
}
// ─── 학기 완료 시 자동 종료 체크 ──────────────────────────────────────
export async function checkAndAutoComplete(studentId: number) {
  const db = await getDb();
  if (!db) return;

  const student = await getStudent(studentId);
  if (!student || !student.totalSemesters || student.totalSemesters <= 0) return;

  const allSems = await listSemesters(studentId);
  const completedCount = allSems.filter((s) => s.isCompleted).length;

  if (completedCount >= student.totalSemesters) {
    await updateStudent(studentId, { studentStatus: "종료" } as any);
  }
}