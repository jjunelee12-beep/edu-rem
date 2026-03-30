import { sql } from "drizzle-orm";
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
index,
} from "drizzle-orm/mysql-core";

// ─── Lead Forms ──────────────────────────────────────────────────────
export const leadForms = mysqlTable("lead_forms", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 100 }).notNull(),
  assigneeId: int("assigneeId").notNull(),
formType: mysqlEnum("formType", ["landing", "ad"]).notNull().default("landing"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsertLeadForm = typeof leadForms.$inferInsert;
export type SelectLeadForm = typeof leadForms.$inferSelect;

// ─── Users ───────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),

  displayNo: int("displayNo").notNull().default(1),

  openId: varchar("openId", { length: 64 }).notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),

  role: mysqlEnum("role", ["host", "admin", "staff", "superhost"])
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
profileImageUrl: varchar("profileImageUrl", { length: 500 }),
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

  status: mysqlEnum("status", ["등록", "종료", "등록 종료"])
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

  approvedAt: datetime("approvedAt"),
  rejectedAt: datetime("rejectedAt"),
  // 지도/거리 계산용 학생 주소
  address: varchar("address", { length: 255 }),
  detailAddress: varchar("detailAddress", { length: 255 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  geocodedAt: datetime("geocodedAt"),

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

  status: mysqlEnum("status", ["등록", "종료", "등록 종료"])
    .default("등록")
    .notNull(),

  plannedMonth: varchar("plannedMonth", { length: 20 }),
  plannedInstitution: varchar("plannedInstitution", { length: 200 }),
  plannedInstitutionId: int("plannedInstitutionId"),
  plannedSubjectCount: int("plannedSubjectCount"),
  plannedAmount: decimal("plannedAmount", { precision: 12, scale: 0 }),
  isLocked: boolean("isLocked").default(false).notNull(),

  actualStartDate: date("actualStartDate"),
  actualInstitution: varchar("actualInstitution", { length: 200 }),
  actualInstitutionId: int("actualInstitutionId"),
  actualSubjectCount: int("actualSubjectCount"),
  actualAmount: decimal("actualAmount", { precision: 12, scale: 0 }),
  actualPaymentDate: date("actualPaymentDate"),
  isCompleted: boolean("isCompleted").default(false).notNull(),

  // 실습 상태 연동용
  practiceStatus: mysqlEnum("practiceStatus", ["미섭외", "섭외중", "섭외완료"])
    .notNull()
    .default("미섭외"),

  practiceSupportRequestId: int("practiceSupportRequestId"),

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

  // 표시용으로 일단 유지
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

  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentUrl: varchar("attachmentUrl", { length: 1000 }),

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

  refundType: mysqlEnum("refundType", [
    "부분환불",
    "전액환불",
    "환불후재등록",
    "교육원이동",
  ]).default("부분환불"),

  approvalStatus: mysqlEnum("approvalStatus", ["대기", "승인", "불승인"])
    .notNull()
    .default("대기"),

  approvedAt: datetime("approvedAt"),
  rejectedAt: datetime("rejectedAt"),
  approvedBy: int("approvedBy"),

  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentUrl: varchar("attachmentUrl", { length: 1000 }),

  assigneeId: int("assigneeId").notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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

// ─── Transfer Attachments (전적대 공통 첨부파일) ───────────────────
export const transferAttachments = mysqlTable("transfer_attachments", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TransferAttachment = typeof transferAttachments.$inferSelect;
export type InsertTransferAttachment = typeof transferAttachments.$inferInsert;

// ─── Course Subject Templates (과정별 과목 템플릿) ──────────────────
export const courseSubjectTemplates = mysqlTable("course_subject_templates", {
  id: int("id").autoincrement().primaryKey(),
  courseKey: varchar("courseKey", { length: 100 }).notNull(),
  subjectName: varchar("subjectName", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["전공", "교양", "일반"]).notNull(),
  requirementType: mysqlEnum("requirementType", [
    "전공필수",
    "전공선택",
    "교양",
    "일반",
  ]),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CourseSubjectTemplate = typeof courseSubjectTemplates.$inferSelect;
export type InsertCourseSubjectTemplate = typeof courseSubjectTemplates.$inferInsert;

// ─── Private Certificate Requests (민간자격증 요청) ─────────────────
export const privateCertificateRequests = mysqlTable("private_certificate_requests", {
  id: int("id").autoincrement().primaryKey(),

  studentId: int("studentId").notNull(),
  assigneeId: int("assigneeId").notNull(),

  clientName: varchar("clientName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  assigneeName: varchar("assigneeName", { length: 100 }),

  certificateName: varchar("certificateName", { length: 255 }).notNull(),
  inputAddress: varchar("inputAddress", { length: 255 }),
  note: text("note"),

  requestStatus: mysqlEnum("requestStatus", [
    "요청",
    "안내완료",
    "입금대기",
    "입금확인",
    "진행중",
    "완료",
    "취소",
  ])
    .notNull()
    .default("요청"),

  feeAmount: decimal("feeAmount", { precision: 12, scale: 0 })
    .notNull()
    .default("0"),

  paymentStatus: mysqlEnum("paymentStatus", [
    "결제대기",
    "입금확인",
    "완료",
    "취소",
  ])
    .notNull()
    .default("결제대기"),

  paidAt: datetime("paidAt"),

  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentUrl: varchar("attachmentUrl", { length: 1000 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PrivateCertificateRequest =
  typeof privateCertificateRequests.$inferSelect;
export type InsertPrivateCertificateRequest =
  typeof privateCertificateRequests.$inferInsert;

// ─── Practice Support Requests (실습배정지원센터) ────────────────────
export const practiceSupportRequests = mysqlTable("practice_support_requests", {
  id: int("id").autoincrement().primaryKey(),

  studentId: int("studentId").notNull(),
  semesterId: int("semesterId"),
  assigneeId: int("assigneeId").notNull(),

  clientName: varchar("clientName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  assigneeName: varchar("assigneeName", { length: 100 }),
  managerName: varchar("managerName", { length: 100 }),

  course: varchar("course", { length: 200 }).notNull(),

  inputAddress: varchar("inputAddress", { length: 255 }),
  detailAddress: varchar("detailAddress", { length: 255 }),

  practiceHours: int("practiceHours"),

  includeEducationCenter: boolean("includeEducationCenter")
    .notNull()
    .default(true),

  includePracticeInstitution: boolean("includePracticeInstitution")
    .notNull()
    .default(true),

  coordinationStatus: mysqlEnum("coordinationStatus", [
    "미섭외",
    "섭외중",
    "섭외완료",
  ])
    .notNull()
    .default("미섭외"),

  selectedEducationCenterId: int("selectedEducationCenterId"),
  selectedEducationCenterName: varchar("selectedEducationCenterName", {
    length: 255,
  }),
  selectedEducationCenterAddress: varchar("selectedEducationCenterAddress", {
    length: 255,
  }),
  selectedEducationCenterDistanceKm: decimal("selectedEducationCenterDistanceKm", {
    precision: 8,
    scale: 2,
  }),

  selectedPracticeInstitutionId: int("selectedPracticeInstitutionId"),
  selectedPracticeInstitutionName: varchar("selectedPracticeInstitutionName", {
    length: 255,
  }),
  selectedPracticeInstitutionAddress: varchar("selectedPracticeInstitutionAddress", {
    length: 255,
  }),
  selectedPracticeInstitutionDistanceKm: decimal(
    "selectedPracticeInstitutionDistanceKm",
    {
      precision: 8,
      scale: 2,
    }
  ),

  feeAmount: decimal("feeAmount", { precision: 12, scale: 0 })
    .notNull()
    .default("0"),

  paymentStatus: mysqlEnum("paymentStatus", ["미결제", "결제"])
    .notNull()
    .default("미결제"),

  paidAt: datetime("paidAt"),
  note: text("note"),

  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentUrl: varchar("attachmentUrl", { length: 1000 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PracticeSupportRequest =
  typeof practiceSupportRequests.$inferSelect;
export type InsertPracticeSupportRequest =
  typeof practiceSupportRequests.$inferInsert;

// ─── Practice Institutions (실습기관/실습교육원 마스터) ──────────────
export const practiceInstitutions = mysqlTable("practice_institutions", {
  id: int("id").autoincrement().primaryKey(),

  institutionType: mysqlEnum("institutionType", ["education", "institution"])
    .notNull(),

  name: varchar("name", { length: 255 }).notNull(),
  representativeName: varchar("representativeName", { length: 100 }),
  phone: varchar("phone", { length: 30 }),

  address: varchar("address", { length: 255 }).notNull(),
  detailAddress: varchar("detailAddress", { length: 255 }),

  price: decimal("price", { precision: 12, scale: 0 }).notNull().default("0"),

  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),

  availableCourse: varchar("availableCourse", { length: 255 }),
  memo: text("memo"),

  isActive: boolean("isActive").notNull().default(true),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PracticeInstitution = typeof practiceInstitutions.$inferSelect;
export type InsertPracticeInstitution = typeof practiceInstitutions.$inferInsert;

export const practiceEducationCenters = mysqlTable("practice_education_centers", {
  id: int("id").autoincrement().primaryKey(),

  name: varchar("name", { length: 255 }).notNull(),
  representativeName: varchar("representativeName", { length: 100 }),
  phone: varchar("phone", { length: 30 }),

  address: varchar("address", { length: 255 }),
  detailAddress: varchar("detailAddress", { length: 255 }),

  feeAmount: decimal("feeAmount", { precision: 12, scale: 0 })
    .notNull()
    .default("0"),

  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  geocodedAt: datetime("geocodedAt"),

  availableCourse: varchar("availableCourse", { length: 255 }),
  memo: text("memo"),

  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PracticeEducationCenter =
  typeof practiceEducationCenters.$inferSelect;
export type InsertPracticeEducationCenter =
  typeof practiceEducationCenters.$inferInsert;

// ─── Job Support Requests (취업지원센터) ────────────────────────────
export const jobSupportRequests = mysqlTable("job_support_requests", {
  id: int("id").autoincrement().primaryKey(),

  studentId: int("studentId").notNull(),
  assigneeId: int("assigneeId").notNull(),

  clientName: varchar("clientName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  assigneeName: varchar("assigneeName", { length: 100 }),

  inputAddress: varchar("inputAddress", { length: 255 }),
  desiredArea: varchar("desiredArea", { length: 255 }),

  includeWelfareCenter: boolean("includeWelfareCenter")
    .notNull()
    .default(true),

  includeCareCenter: boolean("includeCareCenter")
    .notNull()
    .default(true),

  includeEtcInstitution: boolean("includeEtcInstitution")
    .notNull()
    .default(false),

  supportStatus: mysqlEnum("supportStatus", [
    "요청",
    "진행중",
    "면접안내",
    "완료",
    "보류",
    "취소",
  ])
    .notNull()
    .default("요청"),

  selectedInstitutionName: varchar("selectedInstitutionName", { length: 255 }),
  selectedInstitutionAddress: varchar("selectedInstitutionAddress", {
    length: 255,
  }),
  selectedInstitutionDistanceKm: decimal("selectedInstitutionDistanceKm", {
    precision: 8,
    scale: 2,
  }),

  feeAmount: decimal("feeAmount", { precision: 12, scale: 0 })
    .notNull()
    .default("0"),

  paymentStatus: mysqlEnum("paymentStatus", [
    "결제대기",
    "입금확인",
    "완료",
    "취소",
  ])
    .notNull()
    .default("결제대기"),

  paidAt: datetime("paidAt"),
  note: text("note"),

  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentUrl: varchar("attachmentUrl", { length: 1000 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JobSupportRequest = typeof jobSupportRequests.$inferSelect;
export type InsertJobSupportRequest = typeof jobSupportRequests.$inferInsert;


// ─── Chat Rooms ─────────────────────────────
export const chatRooms = mysqlTable("chat_rooms", {
  id: int("id").autoincrement().primaryKey(),
  roomType: mysqlEnum("roomType", ["direct", "group"]).notNull().default("direct"),
  title: varchar("title", { length: 255 }),
  createdBy: int("createdBy").notNull(),
  isActive: boolean("isActive").notNull().default(true),
createdAt: timestamp("createdAt").notNull().defaultNow(),
updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export type ChatRoom = typeof chatRooms.$inferSelect;
export type InsertChatRoom = typeof chatRooms.$inferInsert;

export const chatRoomMembers = mysqlTable("chat_room_members", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  joinedAt: datetime("joinedAt").notNull().defaultNow(),
  leftAt: datetime("leftAt"),
  isActive: boolean("isActive").notNull().default(true),
  lastReadMessageId: int("lastReadMessageId"),
});

export type ChatRoomMember = typeof chatRoomMembers.$inferSelect;
export type InsertChatRoomMember = typeof chatRoomMembers.$inferInsert;

export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  senderId: int("senderId").notNull(),
  messageType: mysqlEnum("messageType", ["text", "image", "file", "system"]).notNull().default("text"),
  content: text("content"),
  createdAt: datetime("createdAt").notNull().defaultNow(),
  updatedAt: datetime("updatedAt").notNull().defaultNow().onUpdateNow(),
  isDeleted: boolean("isDeleted").notNull().default(false),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

export const chatAttachments = mysqlTable("chat_attachments", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileType: varchar("fileType", { length: 100 }),
  fileSize: int("fileSize"),
  createdAt: datetime("createdAt").notNull().defaultNow(),
});

export type ChatAttachment = typeof chatAttachments.$inferSelect;
export type InsertChatAttachment = typeof chatAttachments.$inferInsert;

export const chatRoomSettings = mysqlTable("chat_room_settings", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  isMuted: boolean("isMuted").notNull().default(false),
  pinnedAt: datetime("pinnedAt"),
  createdAt: datetime("createdAt").notNull().defaultNow(),
  updatedAt: datetime("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export type ChatRoomSetting = typeof chatRoomSettings.$inferSelect;
export type InsertChatRoomSetting = typeof chatRoomSettings.$inferInsert;

// ─── 조직도 테이블 ─────────────────────────────
export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

export const positions = mysqlTable("positions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;

export const userOrgMappings = mysqlTable("user_org_mappings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  teamId: int("teamId"),
  positionId: int("positionId"),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserOrgMapping = typeof userOrgMappings.$inferSelect;
export type InsertUserOrgMapping = typeof userOrgMappings.$inferInsert;


export const attendanceRecords = mysqlTable("attendance_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workDate: date("workDate").notNull(),
  clockInAt: datetime("clockInAt"),
  clockOutAt: datetime("clockOutAt"),
  workMinutes: int("workMinutes").notNull().default(0),
  status: mysqlEnum("status", ["출근전", "근무중", "퇴근완료"])
    .notNull()
    .default("출근전"),
  note: varchar("note", { length: 255 }),
  createdAt: datetime("createdAt").notNull().defaultNow(),
  updatedAt: datetime("updatedAt").notNull().defaultNow().onUpdateNow(),
isLate: int("isLate").notNull().default(0),
isEarlyLeave: int("isEarlyLeave").notNull().default(0),
lateMinutes: int("lateMinutes").notNull().default(0),
earlyLeaveMinutes: int("earlyLeaveMinutes").notNull().default(0),
});

export type InsertAttendanceRecord = typeof attendanceRecords.$inferInsert;
export type SelectAttendanceRecord = typeof attendanceRecords.$inferSelect;

export const attendanceAdjustmentLogs = mysqlTable("attendance_adjustment_logs", {
  id: int("id").autoincrement().primaryKey(),
  attendanceId: int("attendanceId").notNull(),
  targetUserId: int("targetUserId").notNull(),
  actorUserId: int("actorUserId").notNull(),
  beforeClockInAt: datetime("beforeClockInAt"),
  beforeClockOutAt: datetime("beforeClockOutAt"),
  afterClockInAt: datetime("afterClockInAt"),
  afterClockOutAt: datetime("afterClockOutAt"),
  reason: varchar("reason", { length: 255 }),
  createdAt: datetime("createdAt").notNull().defaultNow(),
});

export type InsertAttendanceAdjustmentLog =
  typeof attendanceAdjustmentLogs.$inferInsert;

// ─── Device Tokens (모바일 푸시 토큰) ───────────────────────────────
export const deviceTokens = mysqlTable("device_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  platform: varchar("platform", { length: 20 }).notNull(),
  expoPushToken: varchar("expoPushToken", { length: 255 }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeviceToken = typeof deviceTokens.$inferSelect;
export type InsertDeviceToken = typeof deviceTokens.$inferInsert;

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 50 }).notNull().default("lead"),
  message: text("message").notNull(),
  relatedId: int("relatedId"),
  isRead: boolean("isRead").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ==============================
// AI ACTION LOGS (Audit)
// ==============================

export const aiActionLogs = mysqlTable(
  "ai_action_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    userName: varchar("userName", { length: 100 }),
    action: varchar("action", { length: 100 }).notNull(),
    targetStudentId: int("targetStudentId"),
    targetStudentName: varchar("targetStudentName", { length: 100 }),
    payload: text("payload"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_ai_logs_user_id").on(table.userId),
    studentIdIdx: index("idx_ai_logs_student_id").on(table.targetStudentId),
    createdAtIdx: index("idx_ai_logs_created_at").on(table.createdAt),
  })
);