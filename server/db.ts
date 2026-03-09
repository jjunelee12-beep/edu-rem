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
  const db = await getDb();
  if (!db) {
    return {
      monthConsultations: 0,
      monthNewRegistrations: 0,
      monthNewRegistrationAmount: 0,
      todaySales: 0,
      monthSales: 0,
    };
  }

  const { monthStart, monthEnd, today } = getKSTMonthRange();

  const assigneeFilter = assigneeId ? sql`AND assigneeId = ${assigneeId}` : sql``;
  const studentAssigneeFilter = assigneeId ? sql`AND assigneeId = ${assigneeId}` : sql``;

  const [monthConsResult] = await db.execute(
    sql`SELECT COUNT(*) as cnt FROM consultations WHERE consultDate >= ${monthStart} AND consultDate < ${monthEnd} ${assigneeFilter}`
  );
  const monthConsultations = Number((monthConsResult as any)[0]?.cnt || 0);

  const [newRegResult] = await db.execute(
    sql`SELECT COUNT(*) as cnt, COALESCE(SUM(paymentAmount), 0) as total FROM students WHERE paymentDate >= ${monthStart} AND paymentDate < ${monthEnd} AND approvalStatus != '불승인' ${studentAssigneeFilter}`
  );
  const monthNewRegistrations = Number((newRegResult as any)[0]?.cnt || 0);
  const monthNewRegistrationAmount = Number((newRegResult as any)[0]?.total || 0);

  const [todayFirstResult] = await db.execute(
    sql`SELECT COALESCE(SUM(paymentAmount), 0) as total FROM students WHERE paymentDate = ${today} AND approvalStatus = '승인' ${studentAssigneeFilter}`
  );

  const semAssigneeFilter = assigneeId
    ? sql`AND s.studentId IN (SELECT id FROM students WHERE assigneeId = ${assigneeId})`
    : sql``;

  const [todaySemResult] = await db.execute(
    sql`SELECT COALESCE(SUM(s.actualAmount), 0) as total FROM semesters s
    INNER JOIN students st ON s.studentId = st.id AND st.approvalStatus = '승인'
    WHERE s.actualPaymentDate = ${today} AND s.isCompleted = true ${semAssigneeFilter}`
  );

  const todaySales =
    Number((todayFirstResult as any)[0]?.total || 0) +
    Number((todaySemResult as any)[0]?.total || 0);

  const [monthFirstResult] = await db.execute(
    sql`SELECT COALESCE(SUM(paymentAmount), 0) as total FROM students WHERE paymentDate >= ${monthStart} AND paymentDate < ${monthEnd} AND approvalStatus = '승인' ${studentAssigneeFilter}`
  );

  const [monthSemResult] = await db.execute(
    sql`SELECT COALESCE(SUM(s.actualAmount), 0) as total FROM semesters s
    INNER JOIN students st ON s.studentId = st.id AND st.approvalStatus = '승인'
    WHERE s.actualPaymentDate >= ${monthStart} AND s.actualPaymentDate < ${monthEnd} AND s.isCompleted = true ${semAssigneeFilter}`
  );

  const monthSales =
    Number((monthFirstResult as any)[0]?.total || 0) +
    Number((monthSemResult as any)[0]?.total || 0);

  return {
    monthConsultations,
    monthNewRegistrations,
    monthNewRegistrationAmount,
    todaySales,
    monthSales,
  };
}

// ─── 이번달 승인/불승인 내역 (v4: approvedAt/rejectedAt 기준) ────────
export async function getMonthApprovals(assigneeId?: number) {
  const db = await getDb();
  if (!db) return { approved: [], rejected: [], approvedTotal: 0, rejectedTotal: 0 };

  const { monthStart, monthEnd } = getKSTMonthRange();

  const approvedConditions = [
    sql`(${students.approvedAt} >= ${monthStart} AND ${students.approvedAt} < ${monthEnd})`,
    eq(students.approvalStatus, "승인"),
  ];
  if (assigneeId) approvedConditions.push(eq(students.assigneeId, assigneeId));

  const approved = await db.select({
    id: students.id,
    clientName: students.clientName,
    phone: students.phone,
    course: students.course,
    paymentAmount: students.paymentAmount,
    assigneeId: students.assigneeId,
    approvedAt: students.approvedAt,
  }).from(students).where(and(...approvedConditions)).orderBy(desc(students.approvedAt));

  let approvedTotal = 0;
  for (const s of approved) {
    approvedTotal += Number(s.paymentAmount || 0);

    const [semResult] = await db.execute(
      sql`SELECT COALESCE(SUM(actualAmount), 0) as total FROM semesters WHERE studentId = ${s.id} AND isCompleted = true`
    );
    approvedTotal += Number((semResult as any)[0]?.total || 0);
  }

  const rejectedConditions = [
    sql`(${students.rejectedAt} >= ${monthStart} AND ${students.rejectedAt} < ${monthEnd})`,
    eq(students.approvalStatus, "불승인"),
  ];
  if (assigneeId) rejectedConditions.push(eq(students.assigneeId, assigneeId));

  const rejected = await db.select({
    id: students.id,
    clientName: students.clientName,
    phone: students.phone,
    course: students.course,
    paymentAmount: students.paymentAmount,
    assigneeId: students.assigneeId,
    rejectedAt: students.rejectedAt,
  }).from(students).where(and(...rejectedConditions)).orderBy(desc(students.rejectedAt));

  let rejectedTotal = 0;
  for (const s of rejected) {
    rejectedTotal += Number(s.paymentAmount || 0);
  }

  return { approved, rejected, approvedTotal, rejectedTotal };
}

// ─── 학생별 총 결제해야할 금액 / 수납 금액 ──────────────────────────────
export async function getStudentPaymentSummary(studentId: number) {
  const db = await getDb();
  if (!db) return { totalRequired: 0, totalPaid: 0, totalRefund: 0 };

  const student = await getStudent(studentId);
  if (!student) return { totalRequired: 0, totalPaid: 0, totalRefund: 0 };

  const firstAmount = Number(student.paymentAmount || 0);

  const [plannedResult] = await db.execute(
    sql`SELECT COALESCE(SUM(plannedAmount), 0) as total FROM semesters WHERE studentId = ${studentId}`
  );
  const semesterPlanned = Number((plannedResult as any)[0]?.total || 0);

  const [paidResult] = await db.execute(
    sql`SELECT COALESCE(SUM(actualAmount), 0) as total FROM semesters WHERE studentId = ${studentId} AND isCompleted = true`
  );
  const semesterPaid = Number((paidResult as any)[0]?.total || 0);

  const [refundResult] = await db.execute(
    sql`SELECT COALESCE(SUM(refundAmount), 0) as total FROM refunds WHERE studentId = ${studentId}`
  );
  const totalRefund = Number((refundResult as any)[0]?.total || 0);

  const totalRequired = firstAmount + semesterPlanned;
  const firstPaid = student.approvalStatus === "승인" ? firstAmount : 0;
  const totalPaid = firstPaid + semesterPaid;

  return { totalRequired, totalPaid, totalRefund };
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