import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  date,
  boolean,
  datetime,
  serial,
} from "drizzle-orm/mysql-core";

// ─── Lead Forms ──────────────────────────────────────────────────────
export const leadForms = mysqlTable("lead_forms", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 100 }).notNull(),
  assigneeId: int("assigneeId").notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsertLeadForm = typeof leadForms.$inferInsert;
export type SelectLeadForm = typeof leadForms.$inferSelect;

// ─── Users ───────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),

  // 화면 표시용 번호
  displayNo: int("displayNo").notNull().default(1),

  openId: varchar("openId", { length: 64 }).notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),

  role: mysqlEnum("role", ["host", "admin", "staff"])
    .notNull()
    .default("staff"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),

  username: varchar("username", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  isActive: boolean("isActive").notNull().default(true),

  bankName: varchar("bankName", { length: 100 }),
  bankAccount: varchar("bankAccount", { length: 100 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

// ─── Consultations (상담 DB) ─────────────────────────────────────────
export const consultations = mysqlTable("consultations", {
  id: int("id").autoincrement().primaryKey(),
  consultDate: date("consultDate").notNull(),
  channel: varchar("channel", { length: 100 }).notNull(),
  clientName: varchar("clientName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),

  finalEducation: varchar("finalEducation", { length: 100 })
    .notNull()
    .default(""),

  desiredCourse: varchar("desiredCourse", { length: 200 }),
  notes: text("notes"),
  status: varchar("status", { length: 50 }).default("상담중").notNull(),
  assigneeId: int("assigneeId").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Consultation = typeof consultations.$inferSelect;
export type InsertConsultation = typeof consultations.$inferInsert;

// ─── Students (학생 등록/관리) ───────────────────────────────────────
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  clientName: varchar("clientName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  course: varchar("course", { length: 200 }).notNull(),

  status: mysqlEnum("studentStatus", ["등록", "종료"])
    .default("등록")
    .notNull(),

  startDate: date("startDate"),
  paymentAmount: decimal("paymentAmount", { precision: 12, scale: 0 }),
  subjectCount: int("subjectCount"),
  paymentDate: date("paymentDate"),

  institution: varchar("institution", { length: 200 }),
  institutionId: int("institutionId"),

  totalSemesters: int("totalSemesters"),
  assigneeId: int("assigneeId").notNull(),
  consultationId: int("consultationId"),

  approvalStatus: mysqlEnum("approvalStatus", ["대기", "승인", "불승인"])
    .default("대기")
    .notNull(),

  approvedAt: datetime("approvedAt").default(null),
  rejectedAt: datetime("rejectedAt").default(null),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

// ─── Semesters (학기별 예정표/결제표) ────────────────────────────────
export const semesters = mysqlTable("semesters", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  semesterOrder: int("semesterOrder").notNull(),

  // 예정 정보
  plannedMonth: varchar("plannedMonth", { length: 20 }),
  plannedInstitution: varchar("plannedInstitution", { length: 200 }),
  plannedInstitutionId: int("plannedInstitutionId"),
  plannedSubjectCount: int("plannedSubjectCount"),
  plannedAmount: decimal("plannedAmount", { precision: 12, scale: 0 }),
  isLocked: boolean("isLocked").default(false).notNull(),

  // 실제 결제 정보
  actualStartDate: date("actualStartDate"),
  actualInstitution: varchar("actualInstitution", { length: 200 }),
  actualInstitutionId: int("actualInstitutionId"),
  actualSubjectCount: int("actualSubjectCount"),
  actualAmount: decimal("actualAmount", { precision: 12, scale: 0 }),
  actualPaymentDate: date("actualPaymentDate"),
  isCompleted: boolean("isCompleted").default(false).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Semester = typeof semesters.$inferSelect;
export type InsertSemester = typeof semesters.$inferInsert;

// ─── Plans (플랜 요약) ───────────────────────────────────────────────
export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull().unique(),

  desiredCourse: varchar("desiredCourse", { length: 200 }),
  finalEducation: varchar("finalEducation", { length: 100 }),
  totalTheorySubjects: int("totalTheorySubjects"),

  hasPractice: boolean("hasPractice").default(false),
  practiceHours: int("practiceHours"),
  practiceDate: varchar("practiceDate", { length: 50 }),
  practiceArranged: boolean("practiceArranged").default(false),

  practiceStatus: mysqlEnum("practiceStatus", ["미섭외", "섭외중", "섭외완료"])
    .default("미섭외"),

  specialNotes: text("specialNotes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

// ─── Plan Semesters (우리 플랜 학기별 과목표) ────────────────────────
export const planSemesters = mysqlTable("plan_semesters", {
  id: int("id").autoincrement().primaryKey(),

  studentId: int("studentId").notNull(),
  semesterNo: int("semesterNo").notNull(),

  subjectName: varchar("subjectName", { length: 255 }).notNull(),

  planCategory: mysqlEnum("planCategory", ["전공", "교양", "일반"]).notNull(),

  planRequirementType: mysqlEnum("planRequirementType", [
    "전공필수",
    "전공선택",
    "교양",
    "일반",
  ]),

  credits: int("credits").notNull().default(3),
  sortOrder: int("sortOrder").notNull().default(0),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlanSemester = typeof planSemesters.$inferSelect;
export type InsertPlanSemester = typeof planSemesters.$inferInsert;

// ─── Transfer Subjects (전적대 과목표) ───────────────────────────────
export const transferSubjects = mysqlTable("transfer_subjects", {
  id: int("id").autoincrement().primaryKey(),

  studentId: int("studentId").notNull(),
  schoolName: varchar("schoolName", { length: 255 }),
  subjectName: varchar("subjectName", { length: 255 }).notNull(),

  transferCategory: mysqlEnum("transferCategory", ["전공", "교양", "일반"])
    .notNull(),

  transferRequirementType: mysqlEnum("transferRequirementType", [
    "전공필수",
    "전공선택",
    "교양",
    "일반",
  ]),

  credits: int("credits").notNull(),
  sortOrder: int("sortOrder").notNull().default(0),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TransferSubject = typeof transferSubjects.$inferSelect;
export type InsertTransferSubject = typeof transferSubjects.$inferInsert;

// ─── Refunds (환불 기록) ─────────────────────────────────────────────
export const refunds = mysqlTable("refunds", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  semesterId: int("semesterId"),
  refundAmount: decimal("refundAmount", { precision: 12, scale: 0 }).notNull(),
  refundDate: date("refundDate").notNull(),
  reason: text("reason"),
  assigneeId: int("assigneeId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Refund = typeof refunds.$inferSelect;
export type InsertRefund = typeof refunds.$inferInsert;

// ─── Education Institutions (교육원) ─────────────────────────────────
export const educationInstitutions = mysqlTable("education_institutions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().onUpdateNow(),
});

export type EducationInstitution = typeof educationInstitutions.$inferSelect;
export type InsertEducationInstitution = typeof educationInstitutions.$inferInsert;