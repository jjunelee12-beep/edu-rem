import { sql } from "drizzle-orm";
import {
  int,
  bigint,
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
  uniqueIndex,
  json,
} from "drizzle-orm/mysql-core";

// ─── Lead Forms ──────────────────────────────────────────────────────
export const leadForms = mysqlTable("lead_forms", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
  token: varchar("token", { length: 100 }).notNull(),
  assigneeId: int("assigneeId").notNull(),
  formType: mysqlEnum("formType", ["landing", "ad"])
    .notNull()
    .default("landing"),
  isActive: boolean("isActive").notNull().default(true),

  uiConfigJson: text("ui_config_json"),
  blueprintId: int("blueprint_id"),
  sourceBlueprintName: varchar("source_blueprint_name", { length: 120 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsertLeadForm = typeof leadForms.$inferInsert;
export type SelectLeadForm = typeof leadForms.$inferSelect;

// ─── Form Blueprints ─────────────────────────────────────────────────
export const formBlueprints = mysqlTable(
  "form_blueprints",
  {
    id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

    formType: mysqlEnum("form_type", ["landing", "ad"]).notNull(),

    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),

    uiConfigJson: text("ui_config_json").notNull(),

    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),

    createdBy: int("created_by").notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    formTypeIdx: index("idx_form_blueprints_type").on(table.formType),
    creatorIdx: index("idx_form_blueprints_creator").on(table.createdBy),
    typeNameIdx: index("idx_form_blueprints_type_name").on(
      table.formType,
      table.name
    ),
  })
);

export type InsertFormBlueprint = typeof formBlueprints.$inferInsert;
export type SelectFormBlueprint = typeof formBlueprints.$inferSelect;

// ─── Organizations (SaaS 회사/테넌트) ───────────────────────────────
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),

  name: varchar("name", { length: 150 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  businessName: varchar("businessName", { length: 150 }),
  businessNumber: varchar("businessNumber", { length: 50 }),

  ownerUserId: int("ownerUserId"),

  planCode: mysqlEnum("planCode", ["free", "basic", "pro", "enterprise"])
    .notNull()
    .default("basic"),

  status: mysqlEnum("status", ["active", "inactive", "suspended"])
    .notNull()
    .default("active"),

  subscriptionStatus: mysqlEnum("subscriptionStatus", [
    "trial",
    "active",
    "overdue",
    "cancelled",
    "refund",
    "paused",
  ])
    .notNull()
    .default("trial"),

  trialStartedAt: datetime("trialStartedAt"),
  trialEndsAt: datetime("trialEndsAt"),
  nextBillingAt: datetime("nextBillingAt"),
  lastPaidAt: datetime("lastPaidAt"),

billingAmount: int("billingAmount").notNull().default(0),
nextBillingAmount: int("nextBillingAmount").notNull().default(0),

customPlanName: varchar("customPlanName", { length: 50 }),

paymentFailedAt: datetime("paymentFailedAt"),
paymentFailureCount: int("paymentFailureCount").notNull().default(0),
graceUntilAt: datetime("graceUntilAt"),

  cancelledAt: datetime("cancelledAt"),
  refundedAt: datetime("refundedAt"),

  billingKey: varchar("billingKey", { length: 255 }),
  customerKey: varchar("customerKey", { length: 255 }),

isBillingExempt: boolean("isBillingExempt").notNull().default(false),
billingExemptReason: varchar("billingExemptReason", { length: 255 }),

  maxUsers: int("maxUsers").notNull().default(10),
maxStudents: int("maxStudents").notNull().default(500),
  maxLandingForms: int("maxLandingForms").notNull().default(10),
maxAdForms: int("maxAdForms").notNull().default(10),
maxSmsMonthly: int("maxSmsMonthly").notNull().default(1000),

allowBackup: boolean("allowBackup").notNull().default(true),
allowAutoBackup: boolean("allowAutoBackup").notNull().default(false),
allowAuditLog: boolean("allowAuditLog").notNull().default(true),
allowMessenger: boolean("allowMessenger").notNull().default(true),
allowPracticeCenter: boolean("allowPracticeCenter").notNull().default(true),
allowSettlementReport: boolean("allowSettlementReport").notNull().default(true),
allowPrivateCertificate: boolean("allowPrivateCertificate")
  .notNull()
  .default(true),
  maxSmsPerMonth: int("maxSmsPerMonth").notNull().default(1000),
maxStorageMb: int("maxStorageMb").notNull().default(1024),
  memo: text("memo"),

  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─── Organization Backups (회사별 백업/복구 메타) ─────────────────────
export const organizationBackups = mysqlTable(
  "organization_backups",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),
    requestedBy: int("requestedBy").notNull(),

    backupType: varchar("backupType", { length: 50 })
      .notNull()
      .default("manual"),

    status: varchar("status", { length: 50 })
      .notNull()
      .default("pending"),

    fileUrl: varchar("fileUrl", { length: 1000 }),
    fileKey: varchar("fileKey", { length: 1000 }),
    fileSizeBytes: bigint("fileSizeBytes", { mode: "number" }),

    tableCount: int("tableCount"),
    rowCount: int("rowCount"),

    errorMessage: text("errorMessage"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    restoredAt: timestamp("restoredAt"),
    restoredBy: int("restoredBy"),
restoreReason: text("restoreReason"),
  },
  (table) => ({
    orgCreatedIdx: index("idx_org_backups_org_created").on(
      table.organizationId,
      table.createdAt
    ),
    statusIdx: index("idx_org_backups_status").on(table.status),
    requestedByIdx: index("idx_org_backups_requested_by").on(table.requestedBy),
  })
);

export type OrganizationBackup = typeof organizationBackups.$inferSelect;
export type InsertOrganizationBackup = typeof organizationBackups.$inferInsert;

// ─── Users ───────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),

  displayNo: int("displayNo").notNull().default(1),
organizationId: int("organizationId").notNull().default(1),

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

  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
saasAdminPasswordHash: varchar("saasAdminPasswordHash", { length: 255 }),
saasAdminUnlockedAt: datetime("saasAdminUnlockedAt"),
  isActive: boolean("isActive").notNull().default(true),

  bankName: varchar("bankName", { length: 100 }),
  bankAccount: varchar("bankAccount", { length: 100 }),
profileImageUrl: varchar("profileImageUrl", { length: 500 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

// ─── Branding Settings (회사 브랜딩 설정) ───────────────────────────
export const brandingSettings = mysqlTable("branding_settings", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

  companyName: varchar("companyName", { length: 150 })
    .notNull()
    .default("위드원 교육"),

  companyLogoUrl: varchar("companyLogoUrl", { length: 1000 }),

  messengerSubtitle: varchar("messengerSubtitle", { length: 150 })
    .notNull()
    .default("사내 메신저"),

  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandingSetting = typeof brandingSettings.$inferSelect;
export type InsertBrandingSetting = typeof brandingSettings.$inferInsert;

// ─── SMS Settings ───────────────────────────────────────────────────
export const smsSettings = mysqlTable("sms_settings", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

  // aligo | solapi | naverCloud | toast 등
  provider: varchar("provider", { length: 50 }).notNull().default("aligo"),

  // 공통/알리고/솔라피용
  apiKey: varchar("apiKey", { length: 255 }),
  apiSecret: varchar("apiSecret", { length: 255 }),

  // 알리고용
  userId: varchar("userId", { length: 255 }),

  // 네이버 클라우드용
  accessKey: varchar("accessKey", { length: 255 }),
  secretKey: varchar("secretKey", { length: 255 }),
  serviceId: varchar("serviceId", { length: 255 }),

  // 공통
  senderNumber: varchar("senderNumber", { length: 50 }),
  senderName: varchar("senderName", { length: 100 }),

  isActive: boolean("isActive").notNull().default(true),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SmsSetting = typeof smsSettings.$inferSelect;
export type InsertSmsSetting = typeof smsSettings.$inferInsert;

export const smsLogs = mysqlTable("sms_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().default(1),
  senderUserId: int("senderUserId"),
  phone: varchar("phone", { length: 30 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["success", "fail"]).notNull().default("success"),
  provider: varchar("provider", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SmsLog = typeof smsLogs.$inferSelect;
export type InsertSmsLog = typeof smsLogs.$inferInsert;

// ─── SMS Opt Outs (문자 수신거부) ───────────────────────────────────
export const smsOptOuts = mysqlTable(
  "sms_opt_outs",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId")
      .notNull()
      .default(1),

    // 전화번호 원문은 저장하지 않고
    // 정규화된 전화번호의 HMAC-SHA256 결과만 저장
    phoneHash: varchar("phoneHash", {
      length: 64,
    }).notNull(),

    // 관리 화면에서 대상을 구분하기 위한 전화번호 마지막 4자리
    phoneLast4: varchar("phoneLast4", {
      length: 4,
    }),

    // 수신거부 처리 사유
    reason: varchar("reason", {
      length: 255,
    }),

    // 현재는 manual 사용
    // 이후 080 연동, 엑셀 등록 등의 확장을 고려
    source: mysqlEnum("source", [
      "manual",
      "provider",
      "import",
    ])
      .notNull()
      .default("manual"),

    // true: 현재 수신거부 상태
    // false: 수신거부 해제 상태
    isActive: boolean("isActive")
      .notNull()
      .default(true),

    optedOutAt: datetime("optedOutAt")
      .notNull(),

    optedOutBy: int("optedOutBy"),

    releasedAt: datetime("releasedAt"),

    releasedBy: int("releasedBy"),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    // 같은 회사에서 같은 번호가 중복 등록되지 않도록 제한
    uniqueOrgPhoneHashIdx: uniqueIndex(
      "uq_sms_opt_out_org_phone_hash"
    ).on(
      table.organizationId,
      table.phoneHash
    ),

    // 회사별 활성 수신거부 목록 조회
    orgActiveIdx: index(
      "idx_sms_opt_out_org_active"
    ).on(
      table.organizationId,
      table.isActive
    ),

    // 수신거부 목록 최신순 조회
    orgOptedOutAtIdx: index(
      "idx_sms_opt_out_org_opted_at"
    ).on(
      table.organizationId,
      table.optedOutAt
    ),

    // 전화번호 뒷자리 검색
    orgLast4Idx: index(
      "idx_sms_opt_out_org_last4"
    ).on(
      table.organizationId,
      table.phoneLast4
    ),
  })
);

export type SmsOptOut = typeof smsOptOuts.$inferSelect;
export type InsertSmsOptOut = typeof smsOptOuts.$inferInsert;

// ─── Consultations (상담 DB) ─────────────────────────────────────────
export const consultations = mysqlTable(
  "consultations",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),

    consultDate: date("consultDate").notNull(),
    channel: varchar("channel", { length: 100 }).notNull(),

    clientName: varchar("clientName", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),

    finalEducation: varchar("finalEducation", { length: 100 })
      .notNull()
      .default(""),

    desiredCourse: varchar("desiredCourse", { length: 200 }),

    notes: text("notes"),

    status: varchar("status", { length: 50 })
      .default("상담중")
      .notNull(),

    assigneeId: int("assigneeId").notNull().default(1),

    createdAt: timestamp("createdAt").defaultNow().notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),

    deletedAt: datetime("deletedAt"),
    deletedBy: int("deletedBy"),
  },
  (table) => ({
    orgCreatedIdx: index("idx_consultations_org_created").on(
      table.organizationId,
      table.createdAt
    ),

    orgAssigneeIdx: index("idx_consultations_org_assignee").on(
      table.organizationId,
      table.assigneeId
    ),

    orgStatusIdx: index("idx_consultations_org_status").on(
      table.organizationId,
      table.status
    ),
  })
);

export type Consultation = typeof consultations.$inferSelect;
export type InsertConsultation = typeof consultations.$inferInsert;

// ─── Students (학생 등록/관리) ───────────────────────────────────────
export const students = mysqlTable(
  "students",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull().default(1),

    clientName: varchar("clientName", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),

    course: varchar("course", { length: 200 }).notNull(),

    status: mysqlEnum("status", ["등록", "종료", "등록 종료"])
      .default("등록")
      .notNull(),

    startDate: date("startDate"),

    paymentAmount: decimal("paymentAmount", {
      precision: 12,
      scale: 0,
    }),

    subjectCount: int("subjectCount"),

    paymentDate: date("paymentDate"),

    institution: varchar("institution", { length: 200 }),
    institutionId: int("institutionId"),

    totalSemesters: int("totalSemesters"),
studentLoginId: varchar("studentLoginId", { length: 100 }),

    assigneeId: int("assigneeId").notNull(),

    consultationId: int("consultationId"),

    approvalStatus: mysqlEnum("approvalStatus", [
      "대기",
      "승인",
      "불승인",
    ])
      .default("대기")
      .notNull(),

    approvedAt: datetime("approvedAt"),
    rejectedAt: datetime("rejectedAt"),

    address: varchar("address", { length: 255 }),
    detailAddress: varchar("detailAddress", { length: 255 }),

    latitude: decimal("latitude", {
      precision: 10,
      scale: 7,
    }),

    longitude: decimal("longitude", {
      precision: 10,
      scale: 7,
    }),

    geocodedAt: datetime("geocodedAt"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),

    deletedAt: datetime("deletedAt"),
    deletedBy: int("deletedBy"),
  },
  (table) => ({
    orgCreatedIdx: index("idx_students_org_created").on(
      table.organizationId,
      table.createdAt
    ),

    orgAssigneeIdx: index("idx_students_org_assignee").on(
      table.organizationId,
      table.assigneeId
    ),

    orgStatusIdx: index("idx_students_org_status").on(
      table.organizationId,
      table.status
    ),
  })
);

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

export const studentAuditLogs = mysqlTable("student_audit_logs", {
  id: int("id").primaryKey().autoincrement(),

  organizationId: int("organizationId").notNull(),
  studentId: int("studentId").notNull(),

  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: int("entityId"),

  action: varchar("action", { length: 30 }).notNull(),
  title: varchar("title", { length: 255 }),

  beforeJson: json("beforeJson"),
  afterJson: json("afterJson"),
  diffJson: json("diffJson"),

  actorUserId: int("actorUserId"),
  actorName: varchar("actorName", { length: 100 }),
  actorRole: varchar("actorRole", { length: 50 }),

  ipAddress: varchar("ipAddress", { length: 100 }),
  userAgent: text("userAgent"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orgStudentIdx: index("idx_student_audit_org_student").on(table.organizationId, table.studentId),
  actorIdx: index("idx_student_audit_actor").on(table.actorUserId),
  createdIdx: index("idx_student_audit_created").on(table.createdAt),
}));

export type StudentAuditLog = typeof studentAuditLogs.$inferSelect;
export type InsertStudentAuditLog = typeof studentAuditLogs.$inferInsert;

export const emailVerificationCodes = mysqlTable(
  "email_verification_codes",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId")
      .notNull()
      .default(1),

    email: varchar("email", { length: 255 })
      .notNull(),

    purpose: mysqlEnum("purpose", [
      "find_id",
      "reset_password",
    ]).notNull(),

    codeHash: varchar("codeHash", { length: 255 })
      .notNull(),

    attempts: int("attempts")
      .notNull()
      .default(0),

    maxAttempts: int("maxAttempts")
      .notNull()
      .default(5),

    expiresAt: datetime("expiresAt")
      .notNull(),

    usedAt: datetime("usedAt"),

    ipAddress: varchar("ipAddress", { length: 100 }),

    userAgent: text("userAgent"),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgIdx: index("idx_email_verification_org")
      .on(table.organizationId),

    emailIdx: index("idx_email_verification_email")
      .on(table.email),

    purposeIdx: index("idx_email_verification_purpose")
      .on(table.purpose),

    expiresIdx: index("idx_email_verification_expires")
      .on(table.expiresAt),
  })
);

export type EmailVerificationCode =
  typeof emailVerificationCodes.$inferSelect;

export type InsertEmailVerificationCode =
  typeof emailVerificationCodes.$inferInsert;

// ─── Semesters (학기별 예정표/결제표) ────────────────────────────────
export const semesters = mysqlTable(
  "semesters",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull().default(1),

    studentId: int("studentId").notNull(),

    semesterOrder: int("semesterOrder").notNull(),
semesterLabel: varchar("semesterLabel", { length: 50 }),

    status: mysqlEnum("status", ["등록", "종료", "등록 종료"])
      .default("등록")
      .notNull(),

    approvalStatus: mysqlEnum(
      "approvalStatus",
      ["요청전", "대기", "승인", "불승인"]
    )
      .default("요청전")
      .notNull(),

        approvedAt: datetime("approvedAt"),
    rejectedAt: datetime("rejectedAt"),
    rejectionReason: text("rejectionReason"),

    plannedMonth: varchar("plannedMonth", { length: 20 }),

    plannedInstitution: varchar("plannedInstitution", {
      length: 200,
    }),

    plannedInstitutionId: int("plannedInstitutionId"),

    plannedSubjectCount: int("plannedSubjectCount"),

    plannedAmount: decimal("plannedAmount", {
      precision: 12,
      scale: 0,
    }),

    isLocked: boolean("isLocked")
      .default(false)
      .notNull(),

    actualStartDate: date("actualStartDate"),

    actualInstitution: varchar("actualInstitution", {
      length: 200,
    }),

    actualInstitutionId: int("actualInstitutionId"),

    actualSubjectCount: int("actualSubjectCount"),

    actualAmount: decimal("actualAmount", {
      precision: 12,
      scale: 0,
    }),

    actualPaymentDate: date("actualPaymentDate"),

    isCompleted: boolean("isCompleted")
      .default(false)
      .notNull(),

    primaryCourse: varchar("primaryCourse", {
      length: 200,
    }),

    registeredCoursesJson: text("registeredCoursesJson"),

    practiceStatus: mysqlEnum(
      "practiceStatus",
      ["미섭외", "섭외중", "섭외완료"]
    )
      .notNull()
      .default("미섭외"),

    practiceSupportRequestId: int("practiceSupportRequestId"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    orgStudentIdx: index("idx_semesters_org_student").on(
      table.organizationId,
      table.studentId
    ),

    orgApprovalIdx: index("idx_semesters_org_approval").on(
      table.organizationId,
      table.approvalStatus
    ),

    orgApprovedAtIdx: index("idx_semesters_org_approved_at").on(
      table.organizationId,
      table.approvedAt
    ),
  })
);

export type Semester = typeof semesters.$inferSelect;
export type InsertSemester = typeof semesters.$inferInsert;

// ─── Plans (플랜 요약) ───────────────────────────────────────────────
export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
  studentId: int("studentId").notNull().unique(),

  desiredCourse: varchar("desiredCourse", { length: 200 }),
  finalEducation: varchar("finalEducation", { length: 100 }),
  totalTheorySubjects: int("totalTheorySubjects"),

  requiredMajorCount: int("requiredMajorCount").notNull().default(0),
  electiveMajorCount: int("electiveMajorCount").notNull().default(0),
  liberalCount: int("liberalCount").notNull().default(0),
  generalCount: int("generalCount").notNull().default(0),

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
organizationId: int("organizationId").notNull().default(1),

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
settlementIncluded: boolean("settlementIncluded").notNull().default(true),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlanSemester = typeof planSemesters.$inferSelect;
export type InsertPlanSemester = typeof planSemesters.$inferInsert;

// ─── Transfer Subjects (전적대 과목표) ───────────────────────────────
export const transferSubjects = mysqlTable("transfer_subjects", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

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

// ─── Credit Summary Rules (학생 정보 요약 기준 설정) ───────────────
export const creditSummaryRules = mysqlTable(
  "credit_summary_rules",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull().default(1),
studentId: int("studentId").notNull(),

courseName: varchar("courseName", { length: 200 }),
finalEducation: varchar("finalEducation", { length: 100 }),

    requiredTotalCredits: int("requiredTotalCredits").notNull().default(0),

    requiredMajorRequiredSubjects: int("requiredMajorRequiredSubjects")
      .notNull()
      .default(0),
    requiredMajorElectiveSubjects: int("requiredMajorElectiveSubjects")
      .notNull()
      .default(0),
    requiredLiberalSubjects: int("requiredLiberalSubjects")
      .notNull()
      .default(0),
    requiredGeneralSubjects: int("requiredGeneralSubjects")
      .notNull()
      .default(0),

    requiredMajorRequiredCredits: int("requiredMajorRequiredCredits")
      .notNull()
      .default(0),
    requiredMajorElectiveCredits: int("requiredMajorElectiveCredits")
      .notNull()
      .default(0),
    requiredLiberalCredits: int("requiredLiberalCredits")
      .notNull()
      .default(0),
    requiredGeneralCredits: int("requiredGeneralCredits")
      .notNull()
      .default(0),

    allowMajorElectiveOver: boolean("allowMajorElectiveOver")
      .notNull()
      .default(false),
    allowLiberalOver: boolean("allowLiberalOver").notNull().default(true),
    allowGeneralOver: boolean("allowGeneralOver").notNull().default(true),

    duplicateCheckEnabled: boolean("duplicateCheckEnabled")
      .notNull()
      .default(true),

    isActive: boolean("isActive").notNull().default(true),

    memo: text("memo"),

    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgStudentIdx: index("idx_credit_summary_rules_org_student").on(
  table.organizationId,
  table.studentId
),
orgActiveIdx: index("idx_credit_summary_rules_org_active").on(
  table.organizationId,
  table.isActive
),
  })
);

export type CreditSummaryRule = typeof creditSummaryRules.$inferSelect;
export type InsertCreditSummaryRule = typeof creditSummaryRules.$inferInsert;

// ─── Student Credit Summary Items (학생별 요약 추가 학점/과목) ───────
export const studentCreditSummaryItems = mysqlTable(
  "student_credit_summary_items",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull().default(1),
    studentId: int("studentId").notNull(),

    sourceType: mysqlEnum("sourceType", [
      "manual",
      "transfer",
      "certificate",
      "exam",
      "recognized",
      "etc",
    ])
      .notNull()
      .default("manual"),

    subjectName: varchar("subjectName", { length: 255 }),
    institutionName: varchar("institutionName", { length: 255 }),
    semesterLabel: varchar("semesterLabel", { length: 100 }),

    category: mysqlEnum("category", ["전공", "교양", "일반"])
      .notNull()
      .default("전공"),

    requirementType: mysqlEnum("requirementType", [
      "전공필수",
      "전공선택",
      "교양",
      "일반",
    ]).notNull(),

    credits: int("credits").notNull().default(0),

    isCompleted: boolean("isCompleted").notNull().default(true),
    isExcluded: boolean("isExcluded").notNull().default(false),

    memo: text("memo"),

    sortOrder: int("sortOrder").notNull().default(0),

    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgStudentIdx: index("idx_student_credit_summary_org_student").on(
      table.organizationId,
      table.studentId
    ),
    orgStudentTypeIdx: index("idx_student_credit_summary_org_student_type").on(
      table.organizationId,
      table.studentId,
      table.sourceType
    ),
    orgStudentRequirementIdx: index(
      "idx_student_credit_summary_org_student_req"
    ).on(table.organizationId, table.studentId, table.requirementType),
  })
);

export type StudentCreditSummaryItem =
  typeof studentCreditSummaryItems.$inferSelect;
export type InsertStudentCreditSummaryItem =
  typeof studentCreditSummaryItems.$inferInsert;

// ─── Refunds (환불 기록) ─────────────────────────────────────────────
export const refunds = mysqlTable("refunds", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

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
  rejectionReason: text("rejectionReason"),

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
organizationId: int("organizationId").notNull().default(1),
  name: varchar("name", { length: 100 }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  settlementType: mysqlEnum("settlementType", ["credit", "subject", "fixed"])
    .notNull()
    .default("credit"),

  unitCostAmount: decimal("unitCostAmount", { precision: 12, scale: 0 })
    .notNull()
    .default("0"),

  normalSubjectPrice: decimal("normalSubjectPrice", { precision: 12, scale: 0 })
    .notNull()
    .default("75000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().onUpdateNow(),
});

export type EducationInstitution = typeof educationInstitutions.$inferSelect;
export type InsertEducationInstitution = typeof educationInstitutions.$inferInsert;

export const settlementInstitutionPriceRules = mysqlTable(
  "settlement_institution_price_rules",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull().default(1),

    educationInstitutionId: int("educationInstitutionId").notNull(),

    thresholdAmount: decimal("thresholdAmount", {
      precision: 12,
      scale: 0,
    })
      .notNull()
      .default("0"),

    institutionUnitCost: decimal("institutionUnitCost", {
      precision: 12,
      scale: 0,
    })
      .notNull()
      .default("0"),

    sortOrder: int("sortOrder").notNull().default(0),

    isActive: boolean("isActive").notNull().default(true),

    createdAt: timestamp("createdAt").defaultNow().notNull(),

    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgInstIdx: index("idx_sipr_org_inst").on(
      table.organizationId,
      table.educationInstitutionId
    ),
    thresholdIdx: index("idx_sipr_threshold").on(table.thresholdAmount),
    activeIdx: index("idx_sipr_active").on(table.isActive),
  })
);

export type SettlementInstitutionPriceRule =
  typeof settlementInstitutionPriceRules.$inferSelect;

export type InsertSettlementInstitutionPriceRule =
  typeof settlementInstitutionPriceRules.$inferInsert;

export const settlementSubjectPriceRules = mysqlTable(
  "settlement_subject_price_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    educationInstitutionId: int("educationInstitutionId"),

    label: varchar("label", { length: 100 }).notNull(),
    thresholdAmount: decimal("thresholdAmount", { precision: 12, scale: 0 })
      .notNull()
      .default("0"),
    creditValue: int("creditValue").notNull().default(0),

    sortOrder: int("sortOrder").notNull().default(0),
    isActive: boolean("isActive").notNull().default(true),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgInstIdx: index("idx_sspr_org_inst").on(
      table.organizationId,
      table.educationInstitutionId
    ),
    activeIdx: index("idx_sspr_active").on(table.isActive),
    thresholdIdx: index("idx_sspr_threshold").on(table.thresholdAmount),
  })
);

export type SettlementSubjectPriceRule =
  typeof settlementSubjectPriceRules.$inferSelect;
export type InsertSettlementSubjectPriceRule =
  typeof settlementSubjectPriceRules.$inferInsert;

export const settlementMonthLocks = mysqlTable(
  "settlement_month_locks",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),

    settlementYear: int("settlementYear").notNull(),
    settlementMonth: int("settlementMonth").notNull(),

    isLocked: boolean("isLocked").notNull().default(true),

    lockedAt: timestamp("lockedAt"),
    lockedBy: int("lockedBy"),

    unlockedAt: timestamp("unlockedAt"),
    unlockedBy: int("unlockedBy"),
    unlockReason: text("unlockReason"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqueOrgMonthIdx: index("uq_settlement_month_lock_org_month").on(
      table.organizationId,
      table.settlementYear,
      table.settlementMonth
    ),
    orgMonthIdx: index("idx_sml_org_month").on(
      table.organizationId,
      table.settlementYear,
      table.settlementMonth
    ),
    lockedIdx: index("idx_sml_locked").on(
      table.organizationId,
      table.isLocked
    ),
  })
);

export type SettlementMonthLock =
  typeof settlementMonthLocks.$inferSelect;
export type InsertSettlementMonthLock =
  typeof settlementMonthLocks.$inferInsert;

export const educationInstitutionPositionRates = mysqlTable(
  "education_institution_position_rates",
  {
    id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

    educationInstitutionId: int("educationInstitutionId").notNull(),
    positionId: int("positionId").notNull(),

    freelancerUnitAmount: decimal("freelancerUnitAmount", {
      precision: 12,
      scale: 0,
    })
      .notNull()
      .default("0"),

    isActive: boolean("isActive").notNull().default(true),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    institutionPositionIdx: index("idx_inst_pos_rate_unique").on(
  table.organizationId,
  table.educationInstitutionId,
  table.positionId
),
  })
);

export type EducationInstitutionPositionRate =
  typeof educationInstitutionPositionRates.$inferSelect;
export type InsertEducationInstitutionPositionRate =
  typeof educationInstitutionPositionRates.$inferInsert;

// ─── Transfer Attachments (전적대 공통 첨부파일) ───────────────────
export const transferAttachments = mysqlTable("transfer_attachments", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
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
organizationId: int("organizationId").notNull().default(1),
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

// ─── Private Certificate Masters (민간자격증 마스터) ────────────────
export const privateCertificateMasters = mysqlTable(
  "private_certificate_masters",
  {
    id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
    name: varchar("name", { length: 255 }).notNull(),

    sortOrder: int("sortOrder").notNull().default(0),
    isActive: boolean("isActive").notNull().default(true),

    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),

defaultFeeAmount: decimal("defaultFeeAmount", {
  precision: 12,
  scale: 0,
})
  .notNull()
  .default("0"),

defaultCompanyShareAmount: decimal("defaultCompanyShareAmount", {
  precision: 12,
  scale: 0,
})
  .notNull()
  .default("0"),

defaultFreelancerAmount: decimal("defaultFreelancerAmount", {
  precision: 12,
  scale: 0,
})
  .notNull()
  .default("0"),

isSettlementEnabled: boolean("isSettlementEnabled")
  .notNull()
  .default(true),
  }
);

export type PrivateCertificateMaster =
  typeof privateCertificateMasters.$inferSelect;
export type InsertPrivateCertificateMaster =
  typeof privateCertificateMasters.$inferInsert;

// ─── Subject Catalogs (학점은행제 과정 마스터) ───────────────────────
export const subjectCatalogs = mysqlTable("subject_catalogs", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
  name: varchar("name", { length: 255 }).notNull(),

  sortOrder: int("sortOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),

  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubjectCatalog = typeof subjectCatalogs.$inferSelect;
export type InsertSubjectCatalog = typeof subjectCatalogs.$inferInsert;

// ─── Subject Catalog Items (학점은행제 과목 마스터) ──────────────────
export const subjectCatalogItems = mysqlTable("subject_catalog_items", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().default(1),
  catalogId: int("catalogId").notNull(),

  subjectName: varchar("subjectName", { length: 255 }).notNull(),

  category: mysqlEnum("category", ["전공", "교양", "일반"])
    .notNull()
    .default("전공"),

  requirementType: mysqlEnum("requirementType", [
    "전공필수",
    "전공선택",
    "교양",
    "일반",
  ]).notNull(),

  credits: int("credits").notNull().default(3),

  sortOrder: int("sortOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),

  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubjectCatalogItem = typeof subjectCatalogItems.$inferSelect;
export type InsertSubjectCatalogItem = typeof subjectCatalogItems.$inferInsert;

// ─── Private Certificate Requests (민간자격증 요청) ─────────────────
export const privateCertificateRequests = mysqlTable(
  "private_certificate_requests",
{
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

  studentId: int("studentId").notNull(),
  assigneeId: int("assigneeId").notNull(),

  clientName: varchar("clientName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  assigneeName: varchar("assigneeName", { length: 100 }),

  privateCertificateMasterId: int("privateCertificateMasterId"),
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

  freelancerInputAmount: decimal("freelancerInputAmount", {
    precision: 12,
    scale: 0,
  })
    .notNull()
    .default("0"),

  paymentStatus: mysqlEnum("paymentStatus", [
    "결제대기",
    "결제",
    "환불",
    "취소",
  ])
    .notNull()
    .default("결제대기"),

  paidAt: datetime("paidAt"),

  refundStatus: mysqlEnum("refundStatus", [
    "없음",
    "환불요청",
    "환불승인",
    "환불거절",
  ])
    .notNull()
    .default("없음"),

  refundAmount: decimal("refundAmount", { precision: 12, scale: 0 })
    .notNull()
    .default("0"),

  refundReason: text("refundReason"),
  refundRequestedAt: datetime("refundRequestedAt"),
  refundApprovedAt: datetime("refundApprovedAt"),
  refundApprovedBy: int("refundApprovedBy"),

  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentUrl: varchar("attachmentUrl", { length: 1000 }),

     createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgStudentIdx: index("idx_private_cert_org_student").on(
      table.organizationId,
      table.studentId
    ),

    orgAssigneeIdx: index("idx_private_cert_org_assignee").on(
      table.organizationId,
      table.assigneeId
    ),

    orgStatusIdx: index("idx_private_cert_org_status").on(
      table.organizationId,
      table.requestStatus,
      table.paymentStatus
    ),
  })
);

export type PrivateCertificateRequest =
  typeof privateCertificateRequests.$inferSelect;
export type InsertPrivateCertificateRequest =
  typeof privateCertificateRequests.$inferInsert;

// ─── Practice Support Requests (실습배정지원센터) ────────────────────
export const practiceSupportRequests = mysqlTable(
  "practice_support_requests",
{
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

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

  practiceSemesterLabel: varchar("practiceSemesterLabel", {
    length: 50,
  }),

  practiceHours: int("practiceHours"),
  practiceDate: varchar("practiceDate", { length: 50 }),

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

  paymentStatus: mysqlEnum("paymentStatus", ["미결제", "결제", "환불"])
    .notNull()
    .default("미결제"),

  paidAt: datetime("paidAt"),

  refundStatus: mysqlEnum("refundStatus", [
    "없음",
    "환불요청",
    "환불승인",
    "환불거절",
  ])
    .notNull()
    .default("없음"),

  refundAmount: decimal("refundAmount", { precision: 12, scale: 0 })
    .notNull()
    .default("0"),

  refundReason: text("refundReason"),
  refundRequestedAt: datetime("refundRequestedAt"),
  refundApprovedAt: datetime("refundApprovedAt"),
  refundApprovedBy: int("refundApprovedBy"),

  note: text("note"),

  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentUrl: varchar("attachmentUrl", { length: 1000 }),

      createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgStudentIdx: index("idx_practice_support_org_student").on(
      table.organizationId,
      table.studentId
    ),

    orgAssigneeIdx: index("idx_practice_support_org_assignee").on(
      table.organizationId,
      table.assigneeId
    ),

    orgCoordinationIdx: index("idx_practice_support_org_coord").on(
      table.organizationId,
      table.coordinationStatus
    ),

    orgPaymentIdx: index("idx_practice_support_org_payment").on(
      table.organizationId,
      table.paymentStatus
    ),
  })
);

export type PracticeSupportRequest =
  typeof practiceSupportRequests.$inferSelect;
export type InsertPracticeSupportRequest =
  typeof practiceSupportRequests.$inferInsert;

// ─── Practice Institutions (실습기관/실습교육원 마스터) ──────────────
export const practiceListCategories = mysqlTable("practice_list_categories", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

  name: varchar("name", { length: 100 }).notNull(),

  listType: mysqlEnum("listType", ["education", "institution"])
    .notNull()
    .default("institution"),

  description: varchar("description", { length: 255 }),

  sortOrder: int("sortOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PracticeListCategory =
  typeof practiceListCategories.$inferSelect;
export type InsertPracticeListCategory =
  typeof practiceListCategories.$inferInsert;


export const practiceInstitutions = mysqlTable("practice_institutions", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

  institutionType: mysqlEnum("institutionType", ["education", "institution"])
    .notNull(),

  categoryId: int("categoryId"),

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

practiceAvailabilityType: mysqlEnum("practiceAvailabilityType", [
  "unknown",
  "weekday",
  "weekend",
  "both",
])
  .notNull()
  .default("unknown"),

  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),

  isInactive: boolean("isInactive").notNull().default(false),
  inactiveReason: varchar("inactiveReason", { length: 255 }),
  inactiveStartDate: date("inactiveStartDate"),
  inactiveEndDate: date("inactiveEndDate"),
  hideOnMapWhenInactive: boolean("hideOnMapWhenInactive")
    .notNull()
    .default(true),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PracticeInstitution = typeof practiceInstitutions.$inferSelect;
export type InsertPracticeInstitution = typeof practiceInstitutions.$inferInsert;

export const practiceEducationCenters = mysqlTable("practice_education_centers", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

categoryId: int("categoryId"),

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
isPartner: boolean("isPartner").notNull().default(false),
partnerPrice: decimal("partnerPrice", { precision: 12, scale: 0 })
  .notNull()
  .default("0"),

isInactive: boolean("isInactive").notNull().default(false),
  inactiveReason: varchar("inactiveReason", { length: 255 }),
  inactiveStartDate: date("inactiveStartDate"),
  inactiveEndDate: date("inactiveEndDate"),
  hideOnMapWhenInactive: boolean("hideOnMapWhenInactive")
    .notNull()
    .default(true),

  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PracticeEducationCenter =
  typeof practiceEducationCenters.$inferSelect;
export type InsertPracticeEducationCenter =
  typeof practiceEducationCenters.$inferInsert;


// ─── Practice Shared Master / Organization Overrides ────────────────

export const practiceInstitutionMasters = mysqlTable("practice_institution_masters", {
  id: int("id").autoincrement().primaryKey(),

  institutionType: mysqlEnum("institutionType", ["education", "institution"])
    .notNull(),

categoryId: int("categoryId"),

  categoryName: varchar("categoryName", { length: 100 }),

  name: varchar("name", { length: 255 }).notNull(),
  representativeName: varchar("representativeName", { length: 100 }),
  phone: varchar("phone", { length: 30 }),

  address: varchar("address", { length: 255 }).notNull(),
  detailAddress: varchar("detailAddress", { length: 255 }),

  price: decimal("price", { precision: 12, scale: 0 }).notNull().default("0"),

  associationManagementNo: varchar("associationManagementNo", {
    length: 100,
  }),

  selectionValidFrom: date("selectionValidFrom"),
  selectionValidTo: date("selectionValidTo"),

  selectionStatus: varchar("selectionStatus", {
    length: 50,
  }),

  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),

  availableCourse: varchar("availableCourse", { length: 255 }),
  memo: text("memo"),

practiceAvailabilityType: mysqlEnum("practiceAvailabilityType", [
  "unknown",
  "weekday",
  "weekend",
  "both",
])
  .notNull()
  .default("unknown"),

  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PracticeInstitutionMaster =
  typeof practiceInstitutionMasters.$inferSelect;
export type InsertPracticeInstitutionMaster =
  typeof practiceInstitutionMasters.$inferInsert;

export const organizationPracticeInstitutionOverrides = mysqlTable(
  "organization_practice_institution_overrides",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),
    masterId: int("masterId").notNull(),

    customName: varchar("customName", { length: 255 }),
    customPhone: varchar("customPhone", { length: 30 }),
    customAddress: varchar("customAddress", { length: 255 }),
    customDetailAddress: varchar("customDetailAddress", { length: 255 }),
    customPrice: decimal("customPrice", { precision: 12, scale: 0 }),

    customLatitude: decimal("customLatitude", { precision: 10, scale: 7 }),
    customLongitude: decimal("customLongitude", { precision: 10, scale: 7 }),

    customAvailableCourse: varchar("customAvailableCourse", { length: 255 }),
    customMemo: text("customMemo"),

practiceAvailabilityType: mysqlEnum("practiceAvailabilityType", [
  "unknown",
  "weekday",
  "weekend",
  "both",
])
  .notNull()
  .default("unknown"),

    isHidden: boolean("isHidden").notNull().default(false),

    isInactive: boolean("isInactive").notNull().default(false),
    inactiveReason: varchar("inactiveReason", { length: 255 }),
    inactiveStartDate: date("inactiveStartDate"),
    inactiveEndDate: date("inactiveEndDate"),
    hideOnMapWhenInactive: boolean("hideOnMapWhenInactive")
      .notNull()
      .default(true),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgMasterIdx: index("idx_org_practice_inst_override_org_master").on(
      table.organizationId,
      table.masterId
    ),
  })
);

export type OrganizationPracticeInstitutionOverride =
  typeof organizationPracticeInstitutionOverrides.$inferSelect;
export type InsertOrganizationPracticeInstitutionOverride =
  typeof organizationPracticeInstitutionOverrides.$inferInsert;

export const practiceEducationCenterMasters = mysqlTable("practice_education_center_masters", {
  id: int("id").autoincrement().primaryKey(),

categoryId: int("categoryId"),

  categoryName: varchar("categoryName", { length: 100 }),

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

isPartner: boolean("isPartner").notNull().default(false),

  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PracticeEducationCenterMaster =
  typeof practiceEducationCenterMasters.$inferSelect;
export type InsertPracticeEducationCenterMaster =
  typeof practiceEducationCenterMasters.$inferInsert;

export const organizationPracticeEducationCenterOverrides = mysqlTable(
  "organization_practice_education_center_overrides",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),
    masterId: int("masterId").notNull(),

    customName: varchar("customName", { length: 255 }),
    customPhone: varchar("customPhone", { length: 30 }),
    customAddress: varchar("customAddress", { length: 255 }),
    customDetailAddress: varchar("customDetailAddress", { length: 255 }),
    customFeeAmount: decimal("customFeeAmount", { precision: 12, scale: 0 }),

    customLatitude: decimal("customLatitude", { precision: 10, scale: 7 }),
    customLongitude: decimal("customLongitude", { precision: 10, scale: 7 }),

    customAvailableCourse: varchar("customAvailableCourse", { length: 255 }),
    customMemo: text("customMemo"),

isPartner: boolean("isPartner").notNull().default(false),
partnerPrice: decimal("partnerPrice", { precision: 12, scale: 0 })
  .notNull()
  .default("0"),

    isHidden: boolean("isHidden").notNull().default(false),

    isInactive: boolean("isInactive").notNull().default(false),
    inactiveReason: varchar("inactiveReason", { length: 255 }),
    inactiveStartDate: date("inactiveStartDate"),
    inactiveEndDate: date("inactiveEndDate"),
    hideOnMapWhenInactive: boolean("hideOnMapWhenInactive")
      .notNull()
      .default(true),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgMasterIdx: index("idx_org_practice_center_override_org_master").on(
      table.organizationId,
      table.masterId
    ),
  })
);

export type OrganizationPracticeEducationCenterOverride =
  typeof organizationPracticeEducationCenterOverrides.$inferSelect;
export type InsertOrganizationPracticeEducationCenterOverride =
  typeof organizationPracticeEducationCenterOverrides.$inferInsert;

// ─── Practice Master Sync History (공용 실습 데이터 동기화 이력) ───
export const practiceMasterSyncHistory = mysqlTable(
  "practice_master_sync_history",
  {
    id: int("id").autoincrement().primaryKey(),

    dataType: mysqlEnum("dataType", [
      "institution",
      "education_center",
    ]).notNull(),

    sourceType: mysqlEnum("sourceType", [
      "social_worker_association",
      "educanvas",
    ])
      .notNull()
      .default("social_worker_association"),

    sourceFileName: varchar("sourceFileName", {
      length: 255,
    }).notNull(),

    sourceFileKey: varchar("sourceFileKey", {
      length: 1000,
    }),

    sourceFileUrl: varchar("sourceFileUrl", {
      length: 1000,
    }),

    sourceFileHash: varchar("sourceFileHash", {
      length: 64,
    }),

    sourceVersion: varchar("sourceVersion", {
      length: 100,
    }),

    status: mysqlEnum("status", [
      "analyzing",
      "preview_ready",
      "running",
      "completed",
      "failed",
      "cancelled",
    ])
      .notNull()
      .default("analyzing"),

    totalRows: int("totalRows")
      .notNull()
      .default(0),

    validRows: int("validRows")
      .notNull()
      .default(0),

    invalidRows: int("invalidRows")
      .notNull()
      .default(0),

    unchangedCount: int("unchangedCount")
      .notNull()
      .default(0),

    insertCount: int("insertCount")
      .notNull()
      .default(0),

    updateCount: int("updateCount")
      .notNull()
      .default(0),

    deactivateCount: int("deactivateCount")
      .notNull()
      .default(0),

    reactivateCount: int("reactivateCount")
      .notNull()
      .default(0),

    reviewCount: int("reviewCount")
      .notNull()
      .default(0),

    previewJson: json("previewJson"),

    errorJson: json("errorJson"),

    memo: text("memo"),

    createdBy: int("createdBy").notNull(),

executedBy: int("executedBy"),

    startedAt: datetime("startedAt"),

    completedAt: datetime("completedAt"),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    dataTypeCreatedIdx: index(
      "idx_practice_master_sync_type_created"
    ).on(
      table.dataType,
      table.createdAt
    ),

    statusCreatedIdx: index(
      "idx_practice_master_sync_status_created"
    ).on(
      table.status,
      table.createdAt
    ),

    createdByIdx: index(
      "idx_practice_master_sync_created_by"
    ).on(table.createdBy),

    executedByIdx: index(
      "idx_practice_master_sync_history_executed_by"
    ).on(table.executedBy),
  })
);

export type PracticeMasterSyncHistory =
  typeof practiceMasterSyncHistory.$inferSelect;

export type InsertPracticeMasterSyncHistory =
  typeof practiceMasterSyncHistory.$inferInsert;

// ─── Job Support Requests (취업지원센터) ────────────────────────────
export const jobSupportRequests = mysqlTable("job_support_requests", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

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
export const chatRooms = mysqlTable(
  "chat_rooms",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),

    roomType: mysqlEnum("roomType", ["direct", "group"])
      .notNull()
      .default("direct"),

    title: varchar("title", { length: 255 }),

    createdBy: int("createdBy").notNull(),

    isActive: boolean("isActive").notNull().default(true),

    createdAt: timestamp("createdAt").notNull().defaultNow(),

    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (table) => ({
    orgTypeIdx: index("idx_chat_rooms_org_type").on(
      table.organizationId,
      table.roomType
    ),

    orgActiveIdx: index("idx_chat_rooms_org_active").on(
      table.organizationId,
      table.isActive
    ),
  })
);

export type ChatRoom = typeof chatRooms.$inferSelect;
export type InsertChatRoom = typeof chatRooms.$inferInsert;

export const chatRoomMembers = mysqlTable(
  "chat_room_members",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull().default(1),

    roomId: int("roomId").notNull(),

    userId: int("userId").notNull(),

    joinedAt: timestamp("joinedAt").notNull().defaultNow(),

    leftAt: datetime("leftAt"),

    isActive: boolean("isActive").notNull().default(true),

    lastReadMessageId: int("lastReadMessageId"),
  },
  (table) => ({
    orgRoomUserIdx: index("idx_chat_members_org_room_user").on(
      table.organizationId,
      table.roomId,
      table.userId
    ),

    orgUserActiveIdx: index("idx_chat_members_org_user_active").on(
      table.organizationId,
      table.userId,
      table.isActive
    ),
  })
);

export type ChatRoomMember = typeof chatRoomMembers.$inferSelect;
export type InsertChatRoomMember = typeof chatRoomMembers.$inferInsert;

export const chatMessages = mysqlTable(
  "chat_messages",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull().default(1),

    roomId: int("roomId").notNull(),

    senderId: int("senderId").notNull(),

    messageType: mysqlEnum("messageType", [
      "text",
      "image",
      "file",
      "system",
    ])
      .notNull()
      .default("text"),

    content: text("content"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),

    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .onUpdateNow(),

    isDeleted: boolean("isDeleted").notNull().default(false),
  },
  (table) => ({
    orgRoomCreatedIdx: index("idx_chat_messages_org_room_created").on(
      table.organizationId,
      table.roomId,
      table.createdAt
    ),

    orgSenderIdx: index("idx_chat_messages_org_sender").on(
      table.organizationId,
      table.senderId
    ),
  })
);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

export const chatAttachments = mysqlTable(
  "chat_attachments",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull().default(1),

    messageId: int("messageId").notNull(),

    fileName: varchar("fileName", { length: 255 }).notNull(),

    fileUrl: text("fileUrl").notNull(),

    fileType: varchar("fileType", { length: 100 }),

    fileSize: int("fileSize"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    orgMessageIdx: index("idx_chat_attachments_org_message").on(
      table.organizationId,
      table.messageId
    ),
  })
);

export type ChatAttachment = typeof chatAttachments.$inferSelect;
export type InsertChatAttachment = typeof chatAttachments.$inferInsert;

export const chatRoomSettings = mysqlTable("chat_room_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().default(1),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  isMuted: boolean("isMuted").notNull().default(false),
  pinnedAt: datetime("pinnedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export type ChatRoomSetting = typeof chatRoomSettings.$inferSelect;
export type InsertChatRoomSetting = typeof chatRoomSettings.$inferInsert;

// ─── 조직도 테이블 ─────────────────────────────
export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
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
organizationId: int("organizationId").notNull().default(1),
  name: varchar("name", { length: 100 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  settlementUnitAmount: decimal("settlementUnitAmount", {
    precision: 12,
    scale: 0,
  })
    .notNull()
    .default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;

export const userOrgMappings = mysqlTable("user_org_mappings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().default(1),
  userId: int("userId").notNull().unique(),
  teamId: int("teamId"),
  positionId: int("positionId"),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserOrgMapping = typeof userOrgMappings.$inferSelect;
export type InsertUserOrgMapping = typeof userOrgMappings.$inferInsert;


export const attendanceRecords = mysqlTable(
  "attendance_records",
  {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
  userId: int("userId").notNull(),
  workDate: date("workDate").notNull(),
  clockInAt: datetime("clockInAt"),
  clockOutAt: datetime("clockOutAt"),
  workMinutes: int("workMinutes").notNull().default(0),

  status: mysqlEnum("status", [
    "출근전",
    "근무중",
    "퇴근완료",
    "지각",
    "조퇴",
    "병가",
    "연차",
    "출장",
    "반차",
    "결근",
  ])
    .notNull()
    .default("출근전"),

  note: varchar("note", { length: 255 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),

  isLate: int("isLate").notNull().default(0),
  isEarlyLeave: int("isEarlyLeave").notNull().default(0),
  lateMinutes: int("lateMinutes").notNull().default(0),
  earlyLeaveMinutes: int("earlyLeaveMinutes").notNull().default(0),

  leaveType: mysqlEnum("leaveType", [
    "annual",
    "sick",
    "business_trip",
    "half_day_am",
    "half_day_pm",
  ]),

  isAbsent: int("isAbsent").notNull().default(0),
  isAutoClockOut: int("isAutoClockOut").notNull().default(0),

  attendanceScope: mysqlEnum("attendanceScope", ["normal", "night"])
    .notNull()
    .default("normal"),

  scheduledStartAt: datetime("scheduledStartAt"),
  scheduledEndAt: datetime("scheduledEndAt"),
  autoClockOutAt: datetime("autoClockOutAt"),

     teamIdSnapshot: int("teamIdSnapshot"),
    positionIdSnapshot: int("positionIdSnapshot"),
  },
  (table) => ({
    orgUserDateIdx: index("idx_attendance_org_user_date").on(
      table.organizationId,
      table.userId,
      table.workDate
    ),

    orgDateIdx: index("idx_attendance_org_date").on(
      table.organizationId,
      table.workDate
    ),

    orgStatusDateIdx: index("idx_attendance_org_status_date").on(
      table.organizationId,
      table.status,
      table.workDate
    ),
  })
);


export type InsertAttendanceRecord = typeof attendanceRecords.$inferInsert;
export type SelectAttendanceRecord = typeof attendanceRecords.$inferSelect;

export const attendanceAdjustmentLogs = mysqlTable("attendance_adjustment_logs", {
  id: int("id").autoincrement().primaryKey(),
 organizationId: int("organizationId").notNull().default(1),
  attendanceId: int("attendanceId").notNull(),
  targetUserId: int("targetUserId").notNull(),
  actorUserId: int("actorUserId").notNull(),
  beforeClockInAt: datetime("beforeClockInAt"),
  beforeClockOutAt: datetime("beforeClockOutAt"),
  afterClockInAt: datetime("afterClockInAt"),
  afterClockOutAt: datetime("afterClockOutAt"),
  reason: varchar("reason", { length: 255 }),
actionType: mysqlEnum("actionType", [
  "manual_edit",
  "auto_clock_out",
  "mark_absent",
  "apply_sick_leave",
  "apply_annual_leave",
  "apply_business_trip",
  "apply_half_day",
  "night_shift_override",
])
  .notNull()
  .default("manual_edit"),

beforeStatus: varchar("beforeStatus", { length: 50 }),
afterStatus: varchar("afterStatus", { length: 50 }),
note: varchar("note", { length: 255 }),
createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type InsertAttendanceAdjustmentLog =
  typeof attendanceAdjustmentLogs.$inferInsert;

export const attendancePolicies = mysqlTable("attendance_policies", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
  scopeType: mysqlEnum("scopeType", ["global", "team", "user"])
    .notNull()
    .default("global"),

  scopeId: int("scopeId"),

  workStartHour: int("workStartHour").notNull().default(9),
  workStartMinute: int("workStartMinute").notNull().default(0),

  workEndHour: int("workEndHour").notNull().default(18),
  workEndMinute: int("workEndMinute").notNull().default(0),

  lateGraceMinutes: int("lateGraceMinutes").notNull().default(0),

  autoClockOutEnabled: int("autoClockOutEnabled").notNull().default(1),
  autoClockOutHour: int("autoClockOutHour").notNull().default(18),
  autoClockOutMinute: int("autoClockOutMinute").notNull().default(0),

  absentMarkNextDayEnabled: int("absentMarkNextDayEnabled").notNull().default(1),

  timezone: varchar("timezone", { length: 50 })
    .notNull()
    .default("Asia/Seoul"),

  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export type SelectAttendancePolicy = typeof attendancePolicies.$inferSelect;
export type InsertAttendancePolicy = typeof attendancePolicies.$inferInsert;

export const notices = mysqlTable("notices", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  authorId: int("authorId").notNull(),
  authorName: varchar("authorName", { length: 100 }),
  isPinned: boolean("isPinned").notNull().default(false),
importance: mysqlEnum("importance", ["normal", "important", "urgent"])
  .notNull()
  .default("normal"),
  isActive: boolean("isActive").notNull().default(true),
  viewCount: int("viewCount").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export const schedules = mysqlTable(
  "schedules",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    scheduleDate: date("scheduleDate").notNull(),
    meridiem: mysqlEnum("meridiem", ["AM", "PM"]).notNull(),
    hour12: int("hour12").notNull(),
    minute: int("minute").notNull(),
    startAt: datetime("startAt").notNull(),
    scope: mysqlEnum("scope", ["personal", "global"])
      .notNull()
      .default("personal"),
    ownerUserId: int("ownerUserId").notNull(),
    ownerUserName: varchar("ownerUserName", { length: 100 }),
    createdByRole: mysqlEnum("createdByRole", [
      "staff",
      "admin",
      "host",
      "superhost",
    ]).notNull(),
    isActive: boolean("isActive").notNull().default(true),
    isNotified: boolean("isNotified").notNull().default(false),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    orgDateIdx: index("idx_schedules_org_date").on(
      table.organizationId,
      table.scheduleDate
    ),
    orgNotifyIdx: index("idx_schedules_org_notify").on(
      table.organizationId,
      table.isActive,
      table.isNotified,
      table.startAt
    ),
    orgOwnerDateIdx: index("idx_schedules_org_owner_date").on(
      table.organizationId,
      table.ownerUserId,
      table.scheduleDate
    ),
  })
);

// ─── Electronic Approvals (전자결재) ───────────────────────────────

export const approvalDocuments = mysqlTable(
  "approval_documents",
  {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

  documentNumber: varchar("documentNumber", { length: 50 }).notNull(),

  formType: mysqlEnum("formType", ["attendance", "business_trip", "general"])
    .notNull(),

  subType: varchar("subType", { length: 50 }).notNull(),

  title: varchar("title", { length: 255 }).notNull(),
  reason: text("reason"),

  applicantUserId: int("applicantUserId").notNull(),
  applicantUserName: varchar("applicantUserName", { length: 100 }),
  applicantTeamId: int("applicantTeamId"),
  applicantTeamName: varchar("applicantTeamName", { length: 100 }),
  applicantPositionId: int("applicantPositionId"),
  applicantPositionName: varchar("applicantPositionName", { length: 100 }),

  targetDate: date("targetDate"),
  startDate: date("startDate"),
  endDate: date("endDate"),

// ─── 문서별 확장 필드 ─────────────────────

// 근태 상세
attendanceDetailType: varchar("attendanceDetailType", { length: 50 }),
attendanceStartTime: varchar("attendanceStartTime", { length: 10 }),
attendanceEndTime: varchar("attendanceEndTime", { length: 10 }),

// 출장 상세
destination: varchar("destination", { length: 255 }),
visitPlace: varchar("visitPlace", { length: 255 }),
companion: varchar("companion", { length: 255 }),

// 공통 확장
requestDepartment: varchar("requestDepartment", { length: 100 }),
extraNote: text("extraNote"),

  status: mysqlEnum("status", [
    "draft",
    "pending",
    "approved",
    "rejected",
    "cancelled",
  ])
    .notNull()
    .default("pending"),

  currentStepOrder: int("currentStepOrder").notNull().default(1),

  finalApprovedAt: datetime("finalApprovedAt"),
  rejectedAt: datetime("rejectedAt"),
  rejectedReason: text("rejectedReason"),

  attendanceApplied: boolean("attendanceApplied").notNull().default(false),
  attendanceAppliedAt: datetime("attendanceAppliedAt"),

  attendanceTargetStatus: mysqlEnum("attendanceTargetStatus", [
    "지각",
    "조퇴",
    "병가",
    "연차",
    "출장",
    "반차",
    "결근",
  ]),

  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentUrl: varchar("attachmentUrl", { length: 1000 }),

      createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    orgApplicantIdx: index("idx_approval_docs_org_applicant").on(
      table.organizationId,
      table.applicantUserId
    ),

    orgStatusIdx: index("idx_approval_docs_org_status").on(
      table.organizationId,
      table.status
    ),

    orgCreatedIdx: index("idx_approval_docs_org_created").on(
      table.organizationId,
      table.createdAt
    ),
  })
);

export type ApprovalDocument = typeof approvalDocuments.$inferSelect;
export type InsertApprovalDocument = typeof approvalDocuments.$inferInsert;

export const approvalDocumentLines = mysqlTable("approval_document_lines", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
  documentId: int("documentId").notNull(),
  stepOrder: int("stepOrder").notNull(),

  approverUserId: int("approverUserId").notNull(),
  approverName: varchar("approverName", { length: 100 }),
  approverRole: varchar("approverRole", { length: 50 }),

  stepStatus: mysqlEnum("stepStatus", [
    "pending",
    "approved",
    "rejected",
    "skipped",
  ])
    .notNull()
    .default("pending"),

  actedAt: datetime("actedAt"),
  comment: text("comment"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export type ApprovalDocumentLine = typeof approvalDocumentLines.$inferSelect;
export type InsertApprovalDocumentLine = typeof approvalDocumentLines.$inferInsert;

export const approvalSettings = mysqlTable("approval_settings", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

 formType: mysqlEnum("formType", ["attendance", "business_trip", "general"])
  .notNull(),

  firstApproverUserId: int("firstApproverUserId"),
  secondApproverUserId: int("secondApproverUserId"),
  thirdApproverUserId: int("thirdApproverUserId"),

  isActive: boolean("isActive").notNull().default(true),

  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export type ApprovalSetting = typeof approvalSettings.$inferSelect;
export type InsertApprovalSetting = typeof approvalSettings.$inferInsert;

export const approvalPrintSettings = mysqlTable("approval_print_settings", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
  companyName: varchar("companyName", { length: 255 })
    .notNull()
    .default("(주)위드원 교육"),

  documentTitle: varchar("documentTitle", { length: 255 })
    .notNull()
    .default("전자결재 문서"),

  applicantSignLabel: varchar("applicantSignLabel", { length: 100 })
    .notNull()
    .default("신청자 서명"),

  finalApproverSignLabel: varchar("finalApproverSignLabel", { length: 100 })
    .notNull()
    .default("최종 승인자 서명"),

  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export type ApprovalPrintSetting = typeof approvalPrintSettings.$inferSelect;
export type InsertApprovalPrintSetting = typeof approvalPrintSettings.$inferInsert;

export const approvalLogs = mysqlTable("approval_logs", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
  documentId: int("documentId").notNull(),
  actorUserId: int("actorUserId").notNull(),
  actorUserName: varchar("actorUserName", { length: 100 }),

  actionType: mysqlEnum("actionType", [
    "create",
    "approve",
    "reject",
    "cancel",
    "apply_attendance",
  ])
    .notNull(),

  note: text("note"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type ApprovalLog = typeof approvalLogs.$inferSelect;
export type InsertApprovalLog = typeof approvalLogs.$inferInsert;

export const approvalFormFieldSettings = mysqlTable("approval_form_field_settings", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
  formType: mysqlEnum("formType", ["attendance", "business_trip", "general"])
    .notNull(),

  fieldKey: varchar("fieldKey", { length: 100 }).notNull(),

  label: varchar("label", { length: 100 }).notNull(),

  isVisible: boolean("isVisible").notNull().default(true),
  isRequired: boolean("isRequired").notNull().default(false),

  sortOrder: int("sortOrder").notNull().default(0),

  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export type ApprovalFormFieldSetting =
  typeof approvalFormFieldSettings.$inferSelect;
export type InsertApprovalFormFieldSetting =
  typeof approvalFormFieldSettings.$inferInsert;

// ─── Device Tokens (모바일 푸시 토큰) ───────────────────────────────
export const deviceTokens = mysqlTable("device_tokens", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().default(1),
  userId: int("userId").notNull(),
  platform: varchar("platform", { length: 20 }).notNull(),
  expoPushToken: varchar("expoPushToken", { length: 255 }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeviceToken = typeof deviceTokens.$inferSelect;
export type InsertDeviceToken = typeof deviceTokens.$inferInsert;

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    userId: int("userId").notNull(),
    type: varchar("type", { length: 50 }).notNull().default("lead"),
    title: varchar("title", { length: 255 }),
    level: varchar("level", { length: 20 }).notNull().default("normal"),
    message: text("message").notNull(),
    imageUrl: varchar("imageUrl", { length: 500 }),
    relatedId: int("relatedId"),
    targetType: varchar("targetType", { length: 80 }),
    targetId: int("targetId"),
    linkUrl: varchar("linkUrl", { length: 500 }),
    metadataJson: text("metadataJson"),
    isRead: boolean("isRead").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    orgUserReadIdx: index("idx_notifications_org_user_read").on(
      table.organizationId,
      table.userId,
      table.isRead
    ),
    orgUserCreatedIdx: index("idx_notifications_org_user_created").on(
      table.organizationId,
      table.userId,
      table.createdAt
    ),
  })
);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ==============================
// AI ACTION LOGS (Audit)
// ==============================

export const aiActionLogs = mysqlTable(
  "ai_action_logs",
  {
    id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
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

export const aiLearningEntries = mysqlTable(
  "ai_learning_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),

    userId: int("userId").notNull(),
    userName: varchar("userName", { length: 100 }),

    learningType: varchar("learningType", { length: 100 }).notNull(),
    inputText: text("inputText").notNull(),
    normalizedKey: varchar("normalizedKey", { length: 255 }),

    payload: text("payload"),

    targetStudentId: int("targetStudentId"),
    targetStudentName: varchar("targetStudentName", { length: 100 }),

    feedback: text("feedback"),
    isApproved: boolean("isApproved").notNull().default(true),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("idx_ai_learning_org").on(table.organizationId),
    typeKeyIdx: index("idx_ai_learning_type_key").on(
      table.organizationId,
      table.learningType,
      table.normalizedKey
    ),
    createdAtIdx: index("idx_ai_learning_created_at").on(table.createdAt),
  })
);

export type AiLearningEntry = typeof aiLearningEntries.$inferSelect;
export type InsertAiLearningEntry = typeof aiLearningEntries.$inferInsert;

export const settlementGrades = mysqlTable("settlement_grades", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().default(1),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  sortOrder: int("sortOrder").default(0),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export const settlementItems = mysqlTable("settlement_items", {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),
  revenueType: mysqlEnum("revenueType", [
  "subject",
  "practice_support",
  "private_certificate",
  "refund",
]).notNull(),
  sourceId: int("sourceId").notNull(),
  studentId: int("studentId").notNull(),
  assigneeId: int("assigneeId"),
  freelancerUserId: int("freelancerUserId"),
  freelancerPositionId: int("freelancerPositionId"),
  settlementGradeId: int("settlementGradeId"),
  educationInstitutionId: int("educationInstitutionId"),
  privateCertificateMasterId: int("privateCertificateMasterId"),
institutionName: varchar("institutionName", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  quantity: int("quantity").notNull().default(1),
  actualCredits: int("actualCredits"),
  settlementCredits: int("settlementCredits"),
  grossAmount: decimal("grossAmount", { precision: 12, scale: 0 }).default("0"),
  companyAmount: decimal("companyAmount", { precision: 12, scale: 0 }).default("0"),
  freelancerAmount: decimal("freelancerAmount", { precision: 12, scale: 0 }).default("0"),

  companyProfit: decimal("companyProfit", { precision: 12, scale: 0 })
    .notNull()
    .default("0"),

  settlementStatus: mysqlEnum("settlementStatus", [
    "pending",
    "confirmed",
    "cancelled",
    "refunded",
  ]).default("pending"),
  occurredAt: date("occurredAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),

  subjectType: mysqlEnum("subjectType", [
    "general",
    "face_to_face",
    "practice",
    "certificate",
    "practice_support",
  ]),
  subjectCount: int("subjectCount").notNull().default(0),
  actualUnitPrice: decimal("actualUnitPrice", { precision: 12, scale: 0 }).notNull().default("0"),
  normalUnitPrice: decimal("normalUnitPrice", { precision: 12, scale: 0 }).notNull().default("0"),
  institutionUnitCost: decimal("institutionUnitCost", { precision: 12, scale: 0 }).notNull().default("0"),
  institutionCost: decimal("institutionCost", { precision: 12, scale: 0 }).notNull().default("0"),
  freelancerUnitAmount: decimal("freelancerUnitAmount", { precision: 12, scale: 0 }).notNull().default("0"),
  taxAmount: decimal("taxAmount", { precision: 12, scale: 0 }).notNull().default("0"),
  finalPayoutAmount: decimal("finalPayoutAmount", { precision: 12, scale: 0 }).notNull().default("0"),
},
  (table) => ({
    orgOccurredIdx: index("idx_settlement_items_org_occurred").on(
      table.organizationId,
      table.occurredAt
    ),

    orgAssigneeIdx: index("idx_settlement_items_org_assignee").on(
      table.organizationId,
      table.assigneeId
    ),

    orgStudentIdx: index("idx_settlement_items_org_student").on(
      table.organizationId,
      table.studentId
    ),

    orgRevenueStatusIdx: index("idx_settlement_items_org_revenue_status").on(
      table.organizationId,
      table.revenueType,
      table.settlementStatus
    ),
  })
);

export const settlementItemLogs = mysqlTable("settlement_item_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().default(1),
  settlementItemId: int("settlementItemId").notNull(),

  actionType: mysqlEnum("actionType", [
    "create",
    "recalculate",
    "confirm",
    "cancel",
    "refund",
    "manual_edit",
  ])
    .notNull()
    .default("create"),

  actorUserId: int("actorUserId"),
  note: text("note"),
  payload: text("payload"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SettlementItemLog = typeof settlementItemLogs.$inferSelect;
export type InsertSettlementItemLog = typeof settlementItemLogs.$inferInsert;

export const settlementSettings = mysqlTable("settlement_settings", {
  id: int("id").primaryKey().autoincrement(),
organizationId: int("organizationId").notNull().default(1),
  payoutDay: int("payoutDay").notNull().default(25),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),

  organizationId: int("organizationId").notNull().default(1),
  actorUserId: int("actorUserId"),
  actorRole: varchar("actorRole", { length: 50 }),

  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("targetType", { length: 100 }),
  targetId: int("targetId"),

  beforeJson: text("beforeJson"),
  afterJson: text("afterJson"),
  memo: text("memo"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;

export const saasInquiries = mysqlTable(
  "saas_inquiries",
  {
    id: int("id").autoincrement().primaryKey(),

    inquiryType: mysqlEnum("inquiryType", [
      "beta",
      "demo",
      "pricing",
      "contact",
    ])
      .notNull()
      .default("beta"),

    status: mysqlEnum("status", [
      "new",
      "contacted",
      "qualified",
      "closed",
      "spam",
    ])
      .notNull()
      .default("new"),

    clientName: varchar("clientName", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),

    companyName: varchar("companyName", { length: 150 }),
    businessType: varchar("businessType", { length: 100 }),
    email: varchar("email", { length: 255 }),

    message: text("message"),
    memo: text("memo"),

    source: varchar("source", { length: 100 }).notNull().default("homepage"),
    pagePath: varchar("pagePath", { length: 255 }),
    utmSource: varchar("utmSource", { length: 100 }),
    utmMedium: varchar("utmMedium", { length: 100 }),
    utmCampaign: varchar("utmCampaign", { length: 150 }),

    ipAddress: varchar("ipAddress", { length: 100 }),
    userAgent: text("userAgent"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    statusCreatedIdx: index("idx_saas_inquiries_status_created").on(
      table.status,
      table.createdAt
    ),
    phoneIdx: index("idx_saas_inquiries_phone").on(table.phone),
    typeCreatedIdx: index("idx_saas_inquiries_type_created").on(
      table.inquiryType,
      table.createdAt
    ),
  })
);

export type SaasInquiry = typeof saasInquiries.$inferSelect;
export type InsertSaasInquiry = typeof saasInquiries.$inferInsert;

export const saasSignupRequests = mysqlTable(
  "saas_signup_requests",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId"),

    planCode: mysqlEnum("planCode", ["free", "basic", "pro", "enterprise"])
      .notNull()
      .default("basic"),

    companyName: varchar("companyName", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),

    businessName: varchar("businessName", { length: 150 }),
    businessNumber: varchar("businessNumber", { length: 50 }),

    managerName: varchar("managerName", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    birthDate: varchar("birthDate", { length: 20 }),

    username: varchar("username", { length: 64 }).notNull(),

    status: mysqlEnum("status", [
      "created",
      "trial",
      "active",
      "cancelled",
      "failed",
    ])
      .notNull()
      .default("created"),

    trialStartedAt: datetime("trialStartedAt"),
    trialEndsAt: datetime("trialEndsAt"),

    memo: text("memo"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: index("idx_saas_signup_slug").on(table.slug),
    usernameIdx: index("idx_saas_signup_username").on(table.username),
    statusCreatedIdx: index("idx_saas_signup_status_created").on(
      table.status,
      table.createdAt
    ),
  })
);

export type SaasSignupRequest = typeof saasSignupRequests.$inferSelect;
export type InsertSaasSignupRequest = typeof saasSignupRequests.$inferInsert;

export const billingRegistrationTokens = mysqlTable(
  "billing_registration_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    token: varchar("token", { length: 100 }).notNull().unique(),
    expiresAt: datetime("expiresAt").notNull(),
    usedAt: datetime("usedAt"),
    createdBy: int("createdBy"),
    createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    orgIdx: index("idx_billing_tokens_org").on(table.organizationId),
    tokenIdx: index("idx_billing_tokens_token").on(table.token),
    expiresIdx: index("idx_billing_tokens_expires").on(table.expiresAt),
  })
);

export type BillingRegistrationToken =
  typeof billingRegistrationTokens.$inferSelect;
export type InsertBillingRegistrationToken =
  typeof billingRegistrationTokens.$inferInsert;

export const subscriptionPayments = mysqlTable(
  "subscription_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    planCode: varchar("planCode", { length: 50 }).notNull(),
    customPlanName: varchar("customPlanName", { length: 50 }),
    billingAmount: int("billingAmount").notNull().default(0),
    paymentStatus: varchar("paymentStatus", { length: 30 })
      .notNull()
      .default("pending"),
    billingCycleStart: datetime("billingCycleStart"),
    billingCycleEnd: datetime("billingCycleEnd"),
    paidAt: datetime("paidAt"),
    failedAt: datetime("failedAt"),
    failureReason: text("failureReason"),
    tossPaymentKey: varchar("tossPaymentKey", { length: 255 }),
    tossOrderId: varchar("tossOrderId", { length: 255 }),
    createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    orgIdx: index("idx_subscription_payments_org").on(table.organizationId),
    statusIdx: index("idx_subscription_payments_status").on(table.paymentStatus),
    createdIdx: index("idx_subscription_payments_created").on(table.createdAt),
  })
);

export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type InsertSubscriptionPayment = typeof subscriptionPayments.$inferInsert;

export const subscriptionPaymentEvents = mysqlTable(
  "subscription_payment_events",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    paymentId: int("paymentId"),
    eventType: varchar("eventType", { length: 50 }).notNull(),
    message: text("message"),
    rawJson: text("rawJson"),
    createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    orgIdx: index("idx_subscription_payment_events_org").on(table.organizationId),
    paymentIdx: index("idx_subscription_payment_events_payment").on(table.paymentId),
    eventTypeIdx: index("idx_subscription_payment_events_type").on(table.eventType),
  })
);

export type SubscriptionPaymentEvent =
  typeof subscriptionPaymentEvents.$inferSelect;
export type InsertSubscriptionPaymentEvent =
  typeof subscriptionPaymentEvents.$inferInsert;

export const saasAnnouncements = mysqlTable(
  "saas_announcements",
  {
    id: int("id").autoincrement().primaryKey(),

    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),

    type: mysqlEnum("type", [
      "notice",
      "update",
      "maintenance",
      "billing",
    ])
      .notNull()
      .default("notice"),

    versionLabel: varchar("versionLabel", { length: 100 }),
    ctaText: varchar("ctaText", { length: 100 }),
    ctaUrl: varchar("ctaUrl", { length: 500 }),

    isActive: boolean("isActive").notNull().default(true),

    startsAt: datetime("startsAt"),
    endsAt: datetime("endsAt"),

    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    activePeriodIdx: index("idx_saas_announcements_active_period").on(
      table.isActive,
      table.startsAt,
      table.endsAt
    ),
    createdIdx: index("idx_saas_announcements_created").on(table.createdAt),
  })
);

export type SaasAnnouncement = typeof saasAnnouncements.$inferSelect;
export type InsertSaasAnnouncement = typeof saasAnnouncements.$inferInsert;

export const apiErrorLogs = mysqlTable(
  "api_error_logs",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull().default(1),

    userId: int("userId"),
    userRole: varchar("userRole", { length: 50 }),

    path: varchar("path", { length: 255 }).notNull(),
    method: varchar("method", { length: 20 }),
    statusCode: int("statusCode").notNull().default(500),

    errorName: varchar("errorName", { length: 120 }),
    errorMessage: text("errorMessage"),
    errorStack: text("errorStack"),

    inputJson: text("inputJson"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    orgCreatedIdx: index("idx_api_error_logs_org_created").on(
      table.organizationId,
      table.createdAt
    ),
    orgPathCreatedIdx: index("idx_api_error_logs_org_path_created").on(
      table.organizationId,
      table.path,
      table.createdAt
    ),
  })
);

export type ApiErrorLog = typeof apiErrorLogs.$inferSelect;
export type InsertApiErrorLog = typeof apiErrorLogs.$inferInsert;
