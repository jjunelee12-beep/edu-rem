import { sql } from "drizzle-orm";
import {
  int,
  bigint,
  mysqlEnum,
  mysqlTable,
  text,
mediumtext,
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

allowAiAssistant: boolean("allowAiAssistant")
  .notNull()
  .default(false),

allowKakaoAi: boolean("allowKakaoAi")
  .notNull()
  .default(false),

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

// ─── Kakao AI Settings (회사별 카카오 AI 기본 설정) ───────────────────
export const kakaoAiSettings = mysqlTable(
  "kakao_ai_settings",
  {
    id: int("id").autoincrement().primaryKey(),

    /**
     * 회사당 설정 1개만 존재한다.
     *
     * organizations.allowKakaoAi:
     * Superhost가 해당 회사에 카카오 AI 상품 사용권을 허용했는지 여부
     *
     * kakaoAiSettings.enabled:
     * 상품 사용권이 있는 회사의 Host가 실제 운영을 켰는지 여부
     */
    organizationId: int("organizationId").notNull(),

    /**
     * 카카오 AI 실제 운영 여부
     *
     * 최종 실행 조건:
     * organizations.allowKakaoAi === true
     * &&
     * kakao_ai_settings.enabled === true
     */
    enabled: boolean("enabled")
      .notNull()
      .default(false),

    /**
     * 신규 고객 상담 기능
     *
     * 상담DB에 아직 등록되지 않은 고객의
     * 신규 문의 대응에 사용한다.
     */
    newConsultationEnabled: boolean("newConsultationEnabled")
      .notNull()
      .default(true),

    /**
     * 기존 등록자 상담 기능
     *
     * 인증된 기존 학생의
     * 학기 / 플랜 / 일정 / 행정 안내 등에 사용한다.
     */
    registeredStudentEnabled: boolean("registeredStudentEnabled")
      .notNull()
      .default(true),

    /**
     * 고객이 카카오톡으로 보낸 이미지의
     * 문서 분석/OCR 기능 사용 여부
     */
    ocrEnabled: boolean("ocrEnabled")
      .notNull()
      .default(true),

    /**
     * 실습배정지원센터 관련
     * 조회 / 추천 / 안내 기능 사용 여부
     */
    practiceSupportEnabled: boolean("practiceSupportEnabled")
      .notNull()
      .default(true),

    /**
     * 신규 상담 시 회사 소속 담당자
     * 선택 / 추천 기능 사용 여부
     */
    assigneeRecommendationEnabled: boolean(
      "assigneeRecommendationEnabled"
    )
      .notNull()
      .default(true),

    /**
     * 카카오 고객에게 표시할 AI 이름
     *
     * 회사별로 원하는 명칭을 사용할 수 있다.
     */
    aiDisplayName: varchar("aiDisplayName", {
      length: 100,
    })
      .notNull()
      .default("EduCanvas AI"),

    /**
     * 신규 대화 시작 시 사용할 기본 인사말
     */
    welcomeMessage: text("welcomeMessage"),

    /**
     * 회사의 기본 상담 안내문
     *
     * 과정별 세부 설명과는 별도이며
     * 전체 상담에 공통으로 적용되는 설명이다.
     */
    defaultGuideMessage: text("defaultGuideMessage"),

    /**
     * 상담 가능 시간 / 담당자 운영시간 등의
     * 회사 공통 안내 문구
     */
    consultationHoursMessage: text(
      "consultationHoursMessage"
    ),

/**
 * 회사 소개
 *
 * AI가 신규 고객에게 회사/교육서비스를
 * 소개할 때 사용하는 회사 공통 설명이다.
 */
companyIntroduction: text(
  "companyIntroduction"
),

/**
 * 회사 공통 혜택
 *
 * 특정 과정이 아닌 전체 고객에게
 * 공통 적용되는 관리/서비스 혜택이다.
 */
companyBenefits: text(
  "companyBenefits"
),

/**
 * 상담 강조 포인트
 *
 * 신규 상담 중 고객의 관심사와 질문에 맞춰
 * AI가 자연스럽게 활용할 회사별 영업 포인트다.
 *
 * 고정 답변 문구가 아니며,
 * 등록을 과도하게 반복 유도하는 용도로
 * 사용하지 않는다.
 */
salesPoints: text(
  "salesPoints"
),

/**
 * 등록회원 AI / 학습관리 혜택
 *
 * 신규 고객에게 "등록하면 무엇이 달라지는지"
 * 설명할 때 사용하는 회사별 사실 정보다.
 *
 * 예:
 * - 개인 학점/과목 조회
 * - 위험도 분석
 * - 행정절차 상세지원
 * - 실습배정지원센터 조회
 * - 자격증 신청 지원
 * - 취업컨설팅
 */
registeredAiBenefits: text(
  "registeredAiBenefits"
),

/**
 * 수업 진행 공통 정책
 *
 * 온라인 수업, 모바일/PC 가능 여부,
 * 출석/시험/과제/토론 등
 * 회사가 고객에게 안내할 공통 기준이다.
 */
classManagementPolicy: text(
  "classManagementPolicy"
),

/**
 * 실습 지원 공통 정책
 *
 * 실습기관 배정/추천/지원 범위와
 * 회사의 실습 관리 방식을 설명한다.
 */
practicePolicy: text(
  "practicePolicy"
),

/**
 * 행정절차 지원 정책
 *
 * 학습자등록, 학점인정,
 * 학위신청, 자격증 신청 등
 * 회사가 지원하는 범위를 설명한다.
 */
administrativeSupportPolicy: text(
  "administrativeSupportPolicy"
),

/**
 * 상담 시 반드시 지켜야 하는
 * 회사 내부 상담 정책
 *
 * AI가 확정적으로 말하면 안 되는 내용,
 * 담당자에게 넘겨야 하는 상황 등을
 * 회사별로 지정한다.
 */
consultationPolicy: text(
  "consultationPolicy"
),

/**
 * 신규상담 Lead Flow 동적 설정.
 *
 * 상담 단계명 / 단계 순서 / 완료조건 /
 * 다음 Action / 사용자 의미분기 등을
 * 회사별 JSON으로 저장한다.
 *
 * 서버 Flow Engine은 이 설정만 해석하며
 * 특정 과정명 / 상담단계 / 회사 정책을
 * 코드에 하드코딩하지 않는다.
 *
 * null:
 * 아직 회사별 Flow가 설정되지 않은 상태.
 *
 * 실제 구조는
 * kakao-ai-lead-flow-engine.ts의
 * KakaoAiLeadFlowConfig 규격을 따른다.
 */
leadFlowConfig: json(
  "leadFlowConfig"
),

    /**
     * 카카오 AI가 비용/수강료 관련 내용을
     * 직접 안내할 수 있는지 여부
     *
     * 기본 false:
     * 회사 Host가 명시적으로 허용하기 전에는
     * AI가 비용을 확정적으로 안내하지 않는다.
     */
    priceDisclosureEnabled: boolean(
      "priceDisclosureEnabled"
    )
      .notNull()
      .default(false),

/**
 * 카카오 AI 비용/수강료 안내 기준.
 *
 * 회사 Host가 입력한 실제 가격/할인 안내정보만 저장한다.
 * AI는 이 내용을 사실 근거로 자연어 상담에 사용하며
 * 여기에 없는 금액이나 할인율은 임의로 만들지 않는다.
 */
priceGuide: text(
  "priceGuide"
),

    /**
     * 카카오 챗봇 관리자센터의 Bot ID.
     *
     * Skill Payload의 bot.id와 비교하여
     * 요청이 이 회사에 연결된 실제 봇에서
     * 들어온 것인지 서버에서 재검증한다.
     */
    kakaoBotId: varchar(
      "kakaoBotId",
      {
        length: 191,
      }
    ),

    /**
     * 회사별 카카오 Skill Webhook 인증 토큰.
     *
     * 공개 organizationId만으로
     * 외부에서 AI endpoint를 호출하지 못하도록
     * 회사별 랜덤 토큰을 사용한다.
     *
     * DB에는 원문이 아닌 SHA-256 hash를 저장한다.
     */
    webhookTokenHash: varchar(
      "webhookTokenHash",
      {
        length: 64,
      }
    ),

    /**
     * 설정 변경 작업자
     */
    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    /**
     * 회사당 카카오 AI 설정은 정확히 1개만 존재
     */
    organizationUniqueIdx: uniqueIndex(
      "uq_kakao_ai_settings_organization"
    ).on(
      table.organizationId
    ),
  })
);

export type KakaoAiSetting =
  typeof kakaoAiSettings.$inferSelect;

export type InsertKakaoAiSetting =
  typeof kakaoAiSettings.$inferInsert;

// ─── Kakao AI Conversations ──────────────────────────────────────────

/**
 * 카카오 사용자별 AI 대화 세션.
 *
 * CRM 직원용 ai_chat_messages / ai_work_sessions와
 * 완전히 분리한다.
 */
export const kakaoAiConversations = mysqlTable(
  "kakao_ai_conversations",
  {
    id: int("id")
      .autoincrement()
      .primaryKey(),

    /**
     * SaaS 회사 경계.
     */
    organizationId: int(
      "organizationId"
    ).notNull(),

    /**
     * 카카오에서 전달되는 사용자 식별키 원문은
     * 저장하지 않는다.
     *
     * SHA-256 결과만 저장하여
     * 동일 카카오 사용자를 다시 찾는다.
     */
    channelUserKeyHash: varchar(
      "channelUserKeyHash",
      {
        length: 64,
      }
    ).notNull(),

    /**
     * 현재 서버에서 확정된 고객 유형.
     *
     * lead:
     * 신규 상담 고객
     *
     * registered:
     * 이름 + 연락처 인증이 끝난 등록회원
     */
    customerType: mysqlEnum(
      "customerType",
      [
        "lead",
        "registered",
      ]
    )
      .notNull()
      .default("lead"),

/**
 * 신규 카카오 상담자가
 * CRM 상담DB에 접수된 경우 연결되는 상담 ID.
 *
 * lead 상태에서도 사용할 수 있다.
 *
 * 흐름:
 *
 * organizationId + channelUserKeyHash
 * → consultationId
 * → 이후 등록 승인/인증 완료 시 studentId 연결
 */
consultationId: int(
  "consultationId"
),

    /**
     * 등록회원 인증 완료 시에만 연결.
     *
     * 신규 고객에서는 null.
     */
    studentId: int(
      "studentId"
    ),

    /**
     * ---------------------------------------------------------
     * Developer Test Session
     * ---------------------------------------------------------
     *
     * 위드원교육 개발자 테스트 계정 전용.
     *
     * 실제 customerType / studentId / 담당자 세션과
     * 절대로 혼용하지 않는다.
     *
     * null:
     * 일반 운영 상태.
     *
     * lead:
     * 신규 상담자 테스트.
     *
     * registered:
     * 특정 등록회원 테스트.
     *
     * staff:
     * CRM 업무비서 담당자 테스트.
     */
    developerTestMode: mysqlEnum(
      "developerTestMode",
      [
        "lead",
        "registered",
        "staff",
      ]
    ),

    /**
     * developerTestMode = registered일 때만 사용.
     *
     * 실제 kakaoAiConversations.studentId와는
     * 완전히 별개의 임시 테스트 대상이다.
     */
    developerTestStudentId: int(
      "developerTestStudentId"
    ),

    /**
     * developerTestMode = staff일 때만 사용.
     *
     * 추후 실제 CRM userId를 검증한 뒤 저장한다.
     */
    developerTestStaffUserId: int(
      "developerTestStaffUserId"
    ),

    /**
     * 대화 상태.
     *
     * active:
     * 정상 상담 중
     *
     * closed:
     * 상담 종료
     *
     * blocked:
     * 운영상 차단
     */
    status: mysqlEnum(
      "status",
      [
        "active",
        "closed",
        "blocked",
      ]
    )
      .notNull()
      .default("active"),

    /**
     * 마지막 메시지가 발생한 시간.
     *
     * 최근 대화 정렬 및
     * 추후 장기간 미사용 세션 정리에 사용.
     */
    lastMessageAt: datetime(
      "lastMessageAt"
    ),

    createdAt: timestamp(
      "createdAt"
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updatedAt"
    )
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    /**
     * 동일 회사 + 동일 카카오 사용자는
     * 하나의 대화 세션만 사용한다.
     */
    orgChannelUserUniqueIdx:
      uniqueIndex(
        "uq_kakao_ai_conversation_org_user"
      ).on(
        table.organizationId,
        table.channelUserKeyHash
      ),

orgConsultationIdx:
  index(
    "idx_kakao_ai_conversation_consultation"
  ).on(
    table.organizationId,
    table.consultationId
  ),

        orgStudentUniqueIdx:
      uniqueIndex(
        "uq_kakao_ai_conversation_org_student"
      ).on(
        table.organizationId,
        table.studentId
      ),

    orgLastMessageIdx:
      index(
        "idx_kakao_ai_conversation_last_message"
      ).on(
        table.organizationId,
        table.lastMessageAt
      ),
  })
);

export type KakaoAiConversation =
  typeof kakaoAiConversations.$inferSelect;

export type InsertKakaoAiConversation =
  typeof kakaoAiConversations.$inferInsert;


// ─── Kakao AI Staff Auth Sessions ───────────────────────────

/**
 * 카카오 AI 담당자 웹 인증 세션.
 *
 * 흐름:
 *
 * /staff
 * → 1회용 token 발급
 * → 웹 로그인
 * → CRM 계정 검증
 * → authenticated
 * → 24시간 동안 Kakao AI 업무비서 사용
 *
 * token 원문은 저장하지 않고 SHA-256 hash만 저장한다.
 */
export const kakaoAiStaffAuthSessions =
  mysqlTable(
    "kakao_ai_staff_auth_sessions",
    {
      id:
        int("id")
          .autoincrement()
          .primaryKey(),

      organizationId:
        int("organizationId")
          .notNull(),

      conversationId:
        int("conversationId")
          .notNull(),

      /**
       * 웹 URL에 전달되는 원본 token의 SHA-256.
       */
      tokenHash:
        varchar(
          "tokenHash",
          {
            length:
              64,
          }
        )
          .notNull(),

      /**
       * 인증 성공 전에는 null.
       */
      userId:
        int("userId"),

      /**
       * pending:
       * 아직 웹 로그인 전.
       *
       * authenticated:
       * 로그인 성공.
       *
       * expired:
       * 만료.
       *
       * revoked:
       * 강제 로그아웃.
       */
      status:
        mysqlEnum(
          "status",
          [
            "pending",
            "authenticated",
            "expired",
            "revoked",
          ]
        )
          .notNull()
          .default(
            "pending"
          ),

      /**
       * 1회용 로그인 링크 만료.
       * 권장: 생성 후 10분.
       */
      tokenExpiresAt:
        datetime(
          "tokenExpiresAt"
        )
          .notNull(),

      /**
       * 인증 성공 시각.
       */
      authenticatedAt:
        datetime(
          "authenticatedAt"
        ),

      /**
       * 실제 Staff AI 사용 만료.
       * 인증 완료 후 24시간.
       */
      sessionExpiresAt:
        datetime(
          "sessionExpiresAt"
        ),

      revokedAt:
        datetime(
          "revokedAt"
        ),

      createdAt:
        timestamp(
          "createdAt"
        )
          .defaultNow()
          .notNull(),

      updatedAt:
        timestamp(
          "updatedAt"
        )
          .defaultNow()
          .onUpdateNow()
          .notNull(),
    },
    (
      table
    ) => ({
      tokenUniqueIdx:
        uniqueIndex(
          "uq_kakao_ai_staff_auth_token"
        ).on(
          table.tokenHash
        ),

      conversationIdx:
        index(
          "idx_kakao_ai_staff_auth_conversation"
        ).on(
          table.organizationId,
          table.conversationId,
          table.status
        ),

      userIdx:
        index(
          "idx_kakao_ai_staff_auth_user"
        ).on(
          table.organizationId,
          table.userId,
          table.status
        ),

      expiryIdx:
        index(
          "idx_kakao_ai_staff_auth_expiry"
        ).on(
          table.sessionExpiresAt
        ),
    })
  );

export type KakaoAiStaffAuthSession =
  typeof kakaoAiStaffAuthSessions.$inferSelect;

export type InsertKakaoAiStaffAuthSession =
  typeof kakaoAiStaffAuthSessions.$inferInsert;

// ─── Kakao AI Messages ───────────────────────────────────────────────

/**
 * 카카오 고객과 AI의 실제 원본 대화.
 *
 * content에는 개인정보가 포함될 수 있으므로
 * DB 저장 시 암호화한다.
 */
export const kakaoAiMessages = mysqlTable(
  "kakao_ai_messages",
  {
    id: int("id")
      .autoincrement()
      .primaryKey(),

    organizationId: int(
      "organizationId"
    ).notNull(),

    conversationId: int(
      "conversationId"
    ).notNull(),

    role: mysqlEnum(
      "role",
      [
        "user",
        "assistant",
      ]
    ).notNull(),

    /**
     * text:
     * 일반 카카오 텍스트
     *
     * image:
     * 이미지 메시지
     *
     * document:
     * 문서 / 파일
     *
     * system:
     * AI 내부에서 필요한 대화 이벤트
     */
    messageType: mysqlEnum(
      "messageType",
      [
        "text",
        "image",
        "document",
        "system",
      ]
    )
      .notNull()
      .default("text"),

    /**
     * 실제 메시지 내용.
     *
     * 서버에서 encryptPersonalData() 처리 후 저장.
     */
    content: text(
      "content"
    ).notNull(),

    /**
     * 카카오에서 제공되는 외부 메시지 ID.
     *
     * 동일 webhook 재수신 시
     * 중복처리를 막는 용도.
     */
    kakaoMessageId: varchar(
      "kakaoMessageId",
      {
        length: 191,
      }
    ),

/**
 * 카카오 Callback 전달 상태.
 *
 * null:
 * assistant 메시지 또는 callback 추적 대상이 아닌 기존 데이터
 *
 * processing:
 * 사용자 요청을 정상 수신했고 AI 처리 중
 *
 * response_ready:
 * AI 답변 생성까지 완료됐지만 callback 전송 전
 *
 * sent:
 * 카카오 callback 전송 성공
 *
 * failed:
 * callback 전송 실패
 */
callbackStatus: mysqlEnum(
  "callbackStatus",
  [
    "processing",
    "response_ready",
    "sending",
    "sent",
    "failed",
  ]
),

/**
 * 해당 사용자 요청에 대응해 생성된
 * assistant 메시지 ID.
 *
 * 중복 webhook이 다시 들어왔을 때
 * 기존 답변을 찾아 재전송하는 데 사용한다.
 */
responseMessageId: int(
  "responseMessageId"
),

/**
 * 마지막 callback 전송 시각.
 */
callbackSentAt: datetime(
  "callbackSentAt"
),

/**
 * 마지막 callback 실패 시각.
 */
callbackFailedAt: datetime(
  "callbackFailedAt"
),

    /**
     * 이미지/문서 등 첨부자료 관련 내부정보.
     *
     * 개인정보가 포함될 가능성이 있으므로
     * JSON 문자열 자체를 암호화하여 저장한다.
     */
    attachmentData: text(
      "attachmentData"
    ),

    createdAt: timestamp(
      "createdAt"
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    conversationCreatedIdx:
      index(
        "idx_kakao_ai_message_conversation_created"
      ).on(
        table.organizationId,
        table.conversationId,
        table.createdAt
      ),

    /**
     * 카카오가 동일 이벤트를
     * 재전송했을 때 중복 저장 방지.
     *
     * null은 여러 건 허용된다.
     */
    orgKakaoMessageUniqueIdx:
      uniqueIndex(
        "uq_kakao_ai_message_external"
      ).on(
        table.organizationId,
        table.kakaoMessageId
      ),
  })
);

export type KakaoAiMessage =
  typeof kakaoAiMessages.$inferSelect;

export type InsertKakaoAiMessage =
  typeof kakaoAiMessages.$inferInsert;


// ─── Kakao AI Memory ─────────────────────────────────────────────────

/**
 * 자연어 대화에서 확인된 핵심 사실을
 * 구조화해서 보관하는 장기 Memory.
 *
 * 원본 채팅 전체를 매번 모델에 전달하지 않기 위해
 * 최근 메시지 + 구조화 Memory를 함께 사용한다.
 */
export const kakaoAiMemories = mysqlTable(
  "kakao_ai_memories",
  {
    id: int("id")
      .autoincrement()
      .primaryKey(),

    organizationId: int(
      "organizationId"
    ).notNull(),

    /**
     * 대화당 Memory 하나.
     */
    conversationId: int(
      "conversationId"
    ).notNull(),

    /**
     * 사용자가 명확히 밝힌 희망과정.
     *
     * 예:
     * 사회복지사2급
     * 보육교사2급
     * 한국어교원2급
     * 아동학사
     *
     * 암호화해서 저장한다.
     */
    desiredCourse: text(
      "desiredCourse"
    ),

    /**
     * 확인된 최종학력.
     *
     * 개인정보 Context이므로 암호화.
     */
    finalEducation: text(
      "finalEducation"
    ),

    /**
     * 전적대 존재여부.
     *
     * null:
     * 아직 확인되지 않음
     */
    hasTransferCollege: boolean(
      "hasTransferCollege"
    ),

socialWorkerLawVersion: mysqlEnum(
  "socialWorkerLawVersion",
  [
    "old",
    "current",
  ]
),

    /**
     * 대화에서 확정된 사실.
     *
     * 예:
     * - 2020년 이전 사회복지 과목 이수
     * - 성적증명서 OCR 완료
     * - 전문대 졸업 확인
     * - 특정 과목 이수 확인
     *
     * 전체 JSON을 암호화하여 저장한다.
     */
    verifiedFactsData: text(
      "verifiedFactsData"
    ),

    /**
     * 아직 확인되지 않은 내용.
     *
     * AI가 같은 내용을 반복 질문하지 않고
     * 정말 필요한 시점에만 질문하기 위한 값.
     *
     * 전체 JSON 암호화.
     */
    unresolvedQuestionsData: text(
      "unresolvedQuestionsData"
    ),

    /**
     * 최근 대화 주제 / 사용자의 현재 관심사항.
     *
     * "그럼 실습은?"
     * 같은 짧은 후속질문 해석에 사용한다.
     *
     * 암호화.
     */
    currentTopic: text(
      "currentTopic"
    ),

/**
 * AI가 현재 추천한 담당자.
 *
 * 추천만 된 상태이며
 * 고객의 최종 선택과는 별개다.
 */
recommendedStaffUserId: int(
  "recommendedStaffUserId"
),

/**
 * 고객이 실제로 선택한 담당자.
 *
 * "이 담당자로 할게요"
 * "OOO 담당자로 바꿔주세요"
 * 등의 자연어 선택 결과를 저장한다.
 *
 * 이후 상담DB 생성 시
 * 최종 assigneeId 후보로 사용한다.
 */
selectedStaffUserId: int(
  "selectedStaffUserId"
),

/**
 * 고객에게 마지막으로 보여준
 * 담당자 후보 목록.
 *
 * 예:
 * [
 *   {
 *     "userId": 7,
 *     "displayName": "이재준",
 *     "publicToken": "pf_xxx"
 *   }
 * ]
 *
 * "두 번째 분으로 할게요"
 * "아까 보여준 분 중 마지막 분"
 * 같은 후속 자연어를 해석하기 위해 사용한다.
 *
 * 개인정보/내부정보가 포함될 수 있으므로
 * JSON 전체를 암호화해서 저장한다.
 */
lastStaffCandidatesData: text(
  "lastStaffCandidatesData"
),

/**
 * 담당자 선택 진행 상태.
 *
 * none:
 * 추천/선택 없음
 *
 * recommended:
 * AI 추천은 했지만 고객 선택 전
 *
 * selected:
 * 고객이 담당자를 명확히 선택함
 */
staffSelectionStatus: mysqlEnum(
  "staffSelectionStatus",
  [
    "none",
    "recommended",
    "selected",
  ]
)
  .notNull()
  .default("none"),

/**
 * AI가 마지막으로 판정한 주요 Intent.
 *
 * 예:
 * staff_recommend
 * staff_list
 * staff_select
 * staff_change
 * course_question
 *
 * 자연어 AI가 다음 메시지의 문맥을
 * 이어서 판단할 때 보조 Context로 사용한다.
 */
lastIntent: varchar(
  "lastIntent",
  {
    length: 100,
  }
),

/**
 * 신규 상담 진행 상태.
 *
 * AI가 이미 설명하거나 제안한 상담 단계를 기억하여
 * 같은 내용을 반복하지 않고 다음 단계로 자연스럽게
 * 상담을 이어가기 위해 사용한다.
 *
 * 저장 예:
 * {
 *   "qualificationExplained": true,
 *   "durationExplained": true,
 *   "theoryExplained": false,
 *   "practicumExplained": false,
 *   "administrationExplained": false,
 *   "companyBenefitsExplained": false,
 *   "staffRecommendationOffered": false,
 *   "consultationFormOffered": false
 * }
 *
 * JSON 전체를 암호화해서 저장한다.
 */
consultationFlowData: text(
  "consultationFlowData"
),

    createdAt: timestamp(
      "createdAt"
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updatedAt"
    )
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    conversationUniqueIdx:
      uniqueIndex(
        "uq_kakao_ai_memory_conversation"
      ).on(
        table.organizationId,
        table.conversationId
      ),
  })
);

export type KakaoAiMemory =
  typeof kakaoAiMemories.$inferSelect;

export type InsertKakaoAiMemory =
  typeof kakaoAiMemories.$inferInsert;

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
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),

    displayNo: int("displayNo").notNull().default(1),
    organizationId: int("organizationId").notNull().default(1),

    openId: varchar("openId", { length: 64 }).notNull(),

    // 개인정보 암호화
name: text("name"),
nameHash: varchar("nameHash", {
  length: 64,
}),

email: text("email"),
emailHash: varchar("emailHash", {
  length: 64,
}),

    phone: text("phone"),
    phoneHash: varchar("phoneHash", { length: 64 }),
    phoneLast4: varchar("phoneLast4", { length: 4 }),

    loginMethod: varchar("loginMethod", { length: 64 }),

    role: mysqlEnum("role", [
      "host",
      "admin",
      "staff",
      "superhost",
    ])
      .notNull()
      .default("staff"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),

    // 로그인 아이디는 우선 평문 유지
    username: varchar("username", { length: 64 }).unique(),

    // 비밀번호는 암호화가 아니라 단방향 해시 유지
    passwordHash: varchar("passwordHash", { length: 255 }),
    saasAdminPasswordHash: varchar("saasAdminPasswordHash", {
      length: 255,
    }),

    saasAdminUnlockedAt: datetime("saasAdminUnlockedAt"),
    isActive: boolean("isActive").notNull().default(true),

    bankName: varchar("bankName", { length: 100 }),

    // 계좌번호 암호문
bankAccount: text("bankAccount"),

// 계좌번호 정확한 확인용 HMAC
bankAccountHash: varchar("bankAccountHash", {
  length: 64,
}),

// 관리화면 마스킹 표시용
bankAccountLast4: varchar("bankAccountLast4", {
  length: 4,
}),

    profileImageUrl: varchar("profileImageUrl", { length: 500 }),
  },
  (table) => ({

orgNameHashIdx: index(
  "idx_users_org_name_hash"
).on(
  table.organizationId,
  table.nameHash
),

orgEmailHashIdx: index(
  "idx_users_org_email_hash"
).on(
  table.organizationId,
  table.emailHash
),

    orgPhoneHashIdx: index("idx_users_org_phone_hash").on(
      table.organizationId,
      table.phoneHash
    ),

    orgPhoneLast4Idx: index("idx_users_org_phone_last4").on(
      table.organizationId,
      table.phoneLast4
    ),

orgBankAccountHashIdx: index(
  "idx_users_org_bank_account_hash"
).on(
  table.organizationId,
  table.bankAccountHash
),
  })
);

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

// ─── Staff Public Profiles (담당자 공개 프로필) ──────────────────────
export const staffPublicProfiles = mysqlTable(
  "staff_public_profiles",
  {
    id: int("id")
      .autoincrement()
      .primaryKey(),

    /**
     * SaaS 회사 경계.
     */
    organizationId: int("organizationId")
      .notNull(),

    /**
     * 실제 CRM 사용자.
     *
     * 외부 공개 URL에는 이 값을 절대 사용하지 않는다.
     */
    userId: int("userId")
      .notNull(),

    /**
     * 외부 공개 프로필용 랜덤 Token.
     *
     * 예:
     * /with-one/team/pf_xxxxxxxxx
     *
     * 공개 식별자이므로 users.id를 외부에 노출하지 않는다.
     */
    publicToken: varchar("publicToken", {
      length: 100,
    })
      .notNull(),

    /**
     * 프로필 자체 활성화 여부.
     *
     * false이면 개별 Token URL 접근도 차단한다.
     */
    isActive: boolean("isActive")
      .notNull()
      .default(false),

    /**
     * 회사 전체 담당자 소개 페이지에
     * 이 담당자를 표시할지 여부.
     *
     * false여도 isActive=true라면
     * 개별 Token URL은 사용할 수 있다.
     */
    showOnTeamPage: boolean("showOnTeamPage")
      .notNull()
      .default(false),

    /**
     * 카카오 AI 담당자 추천 후보에
     * 포함할지 여부.
     */
    recommendationEnabled: boolean(
      "recommendationEnabled"
    )
      .notNull()
      .default(false),

    /**
     * 현재 신규상담을 받을 수 있는 상태인지.
     *
     * 추천엔진에서 별도 점수/필터로 사용한다.
     */
    acceptingNewConsultations: boolean(
      "acceptingNewConsultations"
    )
      .notNull()
      .default(true),

    /**
     * 공개 프로필 사진.
     *
     * null이면 이후 화면에서
     * users.profileImageUrl을 fallback으로 사용할 수 있다.
     */
    profileImageUrl: varchar(
      "profileImageUrl",
      {
        length: 1000,
      }
    ),

    /**
     * 고객에게 공개할 담당자명.
     *
     * users.name은 암호화 개인정보이므로
     * 외부 공개페이지에서 직접 사용하지 않는다.
     */
    displayName: varchar("displayName", {
      length: 100,
    }),

    /**
     * 공개 직함.
     *
     * 기본값이 없으면 positions.name을
     * 화면에서 fallback으로 사용할 수 있다.
     */
    publicPositionName: varchar(
      "publicPositionName",
      {
        length: 100,
      }
    ),

    /**
     * 카드에 표시할 짧은 한 줄 소개.
     *
     * 예:
     * "사회복지사 전문 학습담당자"
     */
    headline: varchar("headline", {
      length: 255,
    }),

    /**
     * 상세 페이지 자기소개.
     */
    introduction: text("introduction"),

    /**
     * 주요 경력.
     */
    careerText: text("careerText"),

    /**
     * 수상 / 표창 이력.
     */
    awardText: text("awardText"),

    /**
     * 자격 / 교육 / 전문 이력.
     */
    qualificationText: text(
      "qualificationText"
    ),

    /**
     * 담당자의 상담 스타일 / 강점.
     */
    consultationStyle: text(
      "consultationStyle"
    ),

    /**
     * 담당 가능 과정.
     *
     * JSON 문자열 배열로 저장한다.
     *
     * 예:
     * ["사회복지사 2급", "보육교사 2급"]
     */
    specialtiesJson: text(
      "specialtiesJson"
    ),

    /**
     * 공개용 연락처.
     *
     * users.phone을 직접 공개하지 않고
     * 담당자가 직접 공개할 번호만 별도 입력한다.
     */
    publicPhone: varchar("publicPhone", {
      length: 50,
    }),

    showPhone: boolean("showPhone")
      .notNull()
      .default(false),

    /**
     * 향후 카카오 채널 / 상담링크 등을
     * 연결할 수 있는 공개 상담 URL.
     */
    consultationUrl: varchar(
      "consultationUrl",
      {
        length: 1000,
      }
    ),

    showConsultationButton: boolean(
      "showConsultationButton"
    )
      .notNull()
      .default(true),

    /**
     * 회사가 직접 정하는 추천 우선순위.
     *
     * 숫자가 높을수록 추천엔진 가산점에 사용.
     */
    recommendationPriority: int(
  "recommendationPriority"
)
  .notNull()
  .default(0),

/**
 * AI 추천 누적 횟수.
 *
 * 전문분야 / 상담스타일 / 회사 우선도가
 * 비슷한 담당자끼리 순차적으로 추천하기 위한
 * 공정 분배 보조값이다.
 */
recommendationCount: int(
  "recommendationCount"
)
  .notNull()
  .default(0),

/**
 * 마지막으로 AI 추천이 확정된 시각.
 *
 * 동일하거나 비슷한 적합도의 담당자가
 * 여러 명이면 오래 추천되지 않은 담당자를
 * 우선할 수 있도록 사용한다.
 */
lastRecommendedAt: timestamp(
  "lastRecommendedAt"
),

/**
 * 전체 담당자 소개 페이지 정렬순서.
 */
sortOrder: int("sortOrder")
  .notNull()
  .default(0),

    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    /**
     * 한 회사에서 한 CRM 사용자는
     * 공개 프로필 1개만 가질 수 있다.
     */
    organizationUserUniqueIdx:
      uniqueIndex(
        "uq_staff_public_profiles_org_user"
      ).on(
        table.organizationId,
        table.userId
      ),

    /**
     * 외부 공개 Token은 전체 시스템에서
     * 중복될 수 없다.
     */
    publicTokenUniqueIdx:
      uniqueIndex(
        "uq_staff_public_profiles_token"
      ).on(
        table.publicToken
      ),

    organizationActiveIdx:
      index(
        "idx_staff_public_profiles_org_active"
      ).on(
        table.organizationId,
        table.isActive
      ),

    organizationTeamPageIdx:
      index(
        "idx_staff_public_profiles_org_team_page"
      ).on(
        table.organizationId,
        table.showOnTeamPage
      ),

    organizationRecommendationIdx:
      index(
        "idx_staff_public_profiles_org_recommendation"
      ).on(
        table.organizationId,
        table.recommendationEnabled
      ),
  })
);

export type StaffPublicProfile =
  typeof staffPublicProfiles.$inferSelect;

export type InsertStaffPublicProfile =
  typeof staffPublicProfiles.$inferInsert;


// ─── Staff Team Page Settings (회사 담당자 소개 페이지) ──────────────
export const staffTeamPageSettings =
  mysqlTable(
    "staff_team_page_settings",
    {
      id: int("id")
        .autoincrement()
        .primaryKey(),

      /**
       * 회사별 전체 담당자 소개 페이지는
       * 하나만 존재한다.
       */
      organizationId: int(
        "organizationId"
      )
        .notNull(),

      /**
       * 회사 전체 담당자 소개 페이지 공개 여부.
       */
      enabled: boolean("enabled")
        .notNull()
        .default(false),

      /**
       * 기본값이 없으면
       * brandingSettings.companyName을 이용하여
       * "{회사명}과 함께하세요"로 표시한다.
       */
      title: varchar("title", {
        length: 200,
      }),

      /**
       * 메인 타이틀 아래 설명.
       */
      description: text("description"),

      /**
       * 담당자 목록 위에 표시할 안내문.
       */
      staffSectionTitle: varchar(
        "staffSectionTitle",
        {
          length: 150,
        }
      ),

      staffSectionDescription: text(
        "staffSectionDescription"
      ),

      /**
       * 회사 소개/상담 철학 등
       * 하단 브랜딩 영역.
       */
      footerIntroduction: text(
        "footerIntroduction"
      ),

      createdBy: int("createdBy"),
      updatedBy: int("updatedBy"),

      createdAt: timestamp("createdAt")
        .defaultNow()
        .notNull(),

      updatedAt: timestamp("updatedAt")
        .defaultNow()
        .onUpdateNow()
        .notNull(),
    },
    (table) => ({
      organizationUniqueIdx:
        uniqueIndex(
          "uq_staff_team_page_settings_org"
        ).on(
          table.organizationId
        ),
    })
  );

export type StaffTeamPageSetting =
  typeof staffTeamPageSettings.$inferSelect;

export type InsertStaffTeamPageSetting =
  typeof staffTeamPageSettings.$inferInsert;

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

export const smsLogs = mysqlTable(
  "sms_logs",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId")
      .notNull()
      .default(1),

    senderUserId: int("senderUserId"),

    // 수신 전화번호 암호문 저장
    phone: text("phone").notNull(),

    // 정확한 전화번호 검색 및 발송이력 조회용
    phoneHash: varchar("phoneHash", {
      length: 64,
    }),

    // 관리화면 표시 및 뒷자리 검색용
    phoneLast4: varchar("phoneLast4", {
      length: 4,
    }),

    // 문자 내용은 이번 암호화 대상에서 제외
    message: text("message").notNull(),

    status: mysqlEnum("status", [
      "success",
      "fail",
    ])
      .notNull()
      .default("success"),

    provider: varchar("provider", {
      length: 50,
    }),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgPhoneHashIdx: index(
      "idx_sms_logs_org_phone_hash"
    ).on(
      table.organizationId,
      table.phoneHash
    ),

    orgPhoneLast4Idx: index(
      "idx_sms_logs_org_phone_last4"
    ).on(
      table.organizationId,
      table.phoneLast4
    ),

    orgCreatedIdx: index(
      "idx_sms_logs_org_created"
    ).on(
      table.organizationId,
      table.createdAt
    ),
  })
);

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

    clientName: text("clientName").notNull(),
    clientNameHash: varchar("clientNameHash", { length: 64 }),

    phone: text("phone").notNull(),
    phoneHash: varchar("phoneHash", { length: 64 }),
    phoneLast4: varchar("phoneLast4", { length: 4 }),

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

    orgPhoneHashIdx: index("idx_consultations_org_phone_hash").on(
      table.organizationId,
      table.phoneHash
    ),

    orgPhoneLast4Idx: index("idx_consultations_org_phone_last4").on(
      table.organizationId,
      table.phoneLast4
    ),

    orgClientNameHashIdx: index(
      "idx_consultations_org_client_name_hash"
    ).on(table.organizationId, table.clientNameHash),
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

    clientName: text("clientName").notNull(),
    clientNameHash: varchar("clientNameHash", { length: 64 }),

    phone: text("phone").notNull(),
    phoneHash: varchar("phoneHash", { length: 64 }),
    phoneLast4: varchar("phoneLast4", { length: 4 }),

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

    // 학생이 사용하는 교육원 계정 아이디라면 암호화
    studentLoginId: text("studentLoginId"),

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

    address: text("address"),
    detailAddress: text("detailAddress"),

    // 거리 검색용 좌표는 평문 유지
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

    orgPhoneHashIdx: index("idx_students_org_phone_hash").on(
      table.organizationId,
      table.phoneHash
    ),

    orgPhoneLast4Idx: index("idx_students_org_phone_last4").on(
      table.organizationId,
      table.phoneLast4
    ),

    orgClientNameHashIdx: index("idx_students_org_client_name_hash").on(
      table.organizationId,
      table.clientNameHash
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

// 작업자 이름 암호문 저장
actorName: text("actorName"),

actorRole: varchar("actorRole", {
  length: 50,
}),

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

    // 인증 대상 이메일 암호문
email: text("email")
  .notNull(),

// 정규화된 이메일 HMAC-SHA256
emailHash: varchar("emailHash", {
  length: 64,
}),

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

    orgEmailHashIdx: index(
  "idx_email_verification_org_email_hash"
).on(
  table.organizationId,
  table.emailHash
),

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

settlementIncluded:
  boolean("settlementIncluded")
    .notNull()
    .default(true),

/**
 * 재수강이 필요한 과목 여부.
 *
 * 중요:
 * - 기존 정산 데이터에는 영향 없음
 * - 학점요약/자격요건/동일교과목 계산에서만
 *   기존 이수 인정 대상에서 제외
 * - 과목 이력은 상세페이지에 그대로 유지
 */
retakeRequired:
  boolean("retakeRequired")
    .notNull()
    .default(false),

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

  /**
   * 전적대 과목 실제 이수연도
   *
   * 예:
   * 2018
   * 2019
   * 2020
   *
   * 성적증명서/OCR에서
   * 확인할 수 없는 경우 null.
   */
  completionYear: int("completionYear"),

  /**
   * 전적대 과목 실제 이수학기
   *
   * 예:
   * 1학기
   * 2학기
   * 여름계절학기
   * 겨울계절학기
   *
   * 확인할 수 없는 경우 null.
   */
  completionSemester: varchar(
    "completionSemester",
    {
      length: 50,
    }
  ),

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

// ─── Student Administrative Procedures ───────────────────────────────
// AI 학점요약에서 사용하는 학생별 실제 행정절차 상태.
//
// 공통엔진의 administrativeTimeline은 "예상 일정"을 계산하고,
// 이 테이블은 실제 진행 여부를 저장한다.
//
// 예:
// - 학습자등록
// - 학점인정신청
// - 학위신청
// - 자격증신청
//
// 상세페이지 원본/공통엔진 계산값과 분리하여
// STAFF / KAKAO_AI / SYSTEM_AI 등이 실제 상태를 갱신할 수 있다.
export const studentAdministrativeProcedures = mysqlTable(
  "student_administrative_procedures",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),
    studentId: int("studentId").notNull(),

    procedureType: mysqlEnum("procedureType", [
      "learner_registration",
      "credit_recognition",
      "degree_application",
      "qualification_application",
    ]).notNull(),

    status: mysqlEnum("status", [
      "not_started",
      "in_progress",
      "completed",
      "review_required",
    ])
      .notNull()
      .default("not_started"),

    sourceType: mysqlEnum("sourceType", [
      "STAFF",
      "KAKAO_AI",
      "SYSTEM_AI",
      "SYSTEM",
    ])
      .notNull()
      .default("STAFF"),

    completedAt: datetime("completedAt"),

    /**
     * 사용자가 직접 말한 날짜 등
     * 서버가 확정할 수 없는 외부 기준일.
     */
    reportedDate: date("reportedDate"),

    /**
     * 카카오 이미지/OCR, 담당자 확인 등
     * 상태를 판단한 근거를 짧게 저장한다.
     */
    evidenceSummary: text("evidenceSummary"),

    /**
     * 추후 이미지/문서/메시지와 연결하기 위한
     * 원본 참조 종류 및 ID.
     */
    referenceType: varchar("referenceType", {
      length: 100,
    }),

    referenceId: varchar("referenceId", {
      length: 191,
    }),

    memo: text("memo"),

    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    orgStudentIdx: index(
      "idx_student_admin_procedure_org_student"
    ).on(
      table.organizationId,
      table.studentId
    ),

    orgStudentProcedureUniqueIdx: uniqueIndex(
      "uq_student_admin_procedure_org_student_type"
    ).on(
      table.organizationId,
      table.studentId,
      table.procedureType
    ),

    orgStatusIdx: index(
      "idx_student_admin_procedure_org_status"
    ).on(
      table.organizationId,
      table.status
    ),
  })
);

export type StudentAdministrativeProcedure =
  typeof studentAdministrativeProcedures.$inferSelect;

export type InsertStudentAdministrativeProcedure =
  typeof studentAdministrativeProcedures.$inferInsert;

// ─── Student AI Notes ────────────────────────────────────────────────
// 카카오 AI / SYSTEM_AI가 학생 관리상 의미 있는 문의만 요약하여 저장.
//
// 전체 채팅 로그를 저장하는 테이블이 아니다.
// 학습관리상 중요한 이벤트만 요약해서 남긴다.
//
// 예:
// 유형: 실습
// 문의: 주말 실습 가능한 기관 문의
// AI 요약: 직장 근무로 평일 실습이 어려워 주말 실습 희망
// 상태: 확인필요
export const studentAiNotes = mysqlTable(
  "student_ai_notes",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),
    studentId: int("studentId").notNull(),

    noteType: mysqlEnum("noteType", [
      "administrative",
      "practice",
      "schedule",
      "subject",
      "degree",
      "qualification",
      "document",
      "risk",
      "learning_plan",
      "general",
    ]).notNull(),

    status: mysqlEnum("status", [
      "info",
      "action_required",
      "in_progress",
      "resolved",
      "dismissed",
    ])
      .notNull()
      .default("info"),

    sourceType: mysqlEnum("sourceType", [
      "KAKAO_AI",
      "SYSTEM_AI",
      "STAFF",
      "SYSTEM",
    ]).notNull(),

    /**
     * 사용자의 핵심 문의를 짧게 정리.
     *
     * 전체 원문 대화를 저장하지 않는다.
     */
    inquirySummary: text("inquirySummary"),

    /**
     * 학습관리 관점의 AI 요약.
     */
    aiSummary: text("aiSummary").notNull(),

    /**
     * 담당자가 확인해야 할 내용.
     *
     * 예:
     * "주말 실습기관 확인 필요"
     */
    actionSummary: text("actionSummary"),

    /**
     * 원본 카카오 메시지 / 이미지 / OCR / 시스템 이벤트 연결용.
     */
    referenceType: varchar("referenceType", {
      length: 100,
    }),

    referenceId: varchar("referenceId", {
      length: 191,
    }),

    /**
     * 사람이 직접 생성하거나 수정한 경우 사용자 ID.
     * AI/System 생성이면 null 가능.
     */
    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    orgStudentIdx: index(
      "idx_student_ai_notes_org_student"
    ).on(
      table.organizationId,
      table.studentId
    ),

    orgStudentStatusIdx: index(
      "idx_student_ai_notes_org_student_status"
    ).on(
      table.organizationId,
      table.studentId,
      table.status
    ),

    orgCreatedAtIdx: index(
      "idx_student_ai_notes_org_created"
    ).on(
      table.organizationId,
      table.createdAt
    ),
  })
);

export type StudentAiNote =
  typeof studentAiNotes.$inferSelect;

export type InsertStudentAiNote =
  typeof studentAiNotes.$inferInsert;


// ─── Student AI Events ───────────────────────────────────────────────
// 담당자가 확인해야 하는 "AI 업데이트" 이벤트.
//
// 메시지마다 생성하지 않는다.
// 실제 CRM 관리상 의미 있는 변화에 대해서만 생성.
//
// 예:
// - 행정절차 상태 변경
// - 증빙자료 제출
// - 실습 희망조건 변경
// - 예정일 변경
// - 위험도 변경
// - 중요 AI 메모 생성
// - 학습설계 변경
export const studentAiEvents = mysqlTable(
  "student_ai_events",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),
    studentId: int("studentId").notNull(),

    eventType: mysqlEnum("eventType", [
      "administrative_status_changed",
      "document_submitted",
      "practice_condition_changed",
      "schedule_changed",
      "risk_changed",
      "important_note_created",
      "learning_plan_changed",
      "other",
    ]).notNull(),

    sourceType: mysqlEnum("sourceType", [
      "KAKAO_AI",
      "SYSTEM_AI",
      "STAFF",
      "SYSTEM",
    ]).notNull(),

    severity: mysqlEnum("severity", [
      "info",
      "warning",
      "important",
    ])
      .notNull()
      .default("info"),

    title: varchar("title", {
      length: 255,
    }).notNull(),

    message: text("message"),

    /**
     * 이벤트와 연결된 실제 데이터.
     *
     * 예:
     * administrative_procedure
     * ai_note
     * practice_request
     */
    entityType: varchar("entityType", {
      length: 100,
    }),

    entityId: int("entityId"),

    referenceType: varchar("referenceType", {
      length: 100,
    }),

    referenceId: varchar("referenceId", {
      length: 191,
    }),

    /**
     * 담당자 확인 여부.
     *
     * false = AI 업데이트 숫자에 포함
     * true  = 확인 완료
     */
    isRead: boolean("isRead")
      .notNull()
      .default(false),

    readAt: datetime("readAt"),
    readBy: int("readBy"),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgStudentIdx: index(
      "idx_student_ai_events_org_student"
    ).on(
      table.organizationId,
      table.studentId
    ),

    orgStudentUnreadIdx: index(
      "idx_student_ai_events_org_student_unread"
    ).on(
      table.organizationId,
      table.studentId,
      table.isRead
    ),

    orgUnreadIdx: index(
      "idx_student_ai_events_org_unread"
    ).on(
      table.organizationId,
      table.isRead
    ),

    orgCreatedAtIdx: index(
      "idx_student_ai_events_org_created"
    ).on(
      table.organizationId,
      table.createdAt
    ),
  })
);

export type StudentAiEvent =
  typeof studentAiEvents.$inferSelect;

export type InsertStudentAiEvent =
  typeof studentAiEvents.$inferInsert;

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

  /**
   * 학점은행제 과정마스터(subject_catalogs) 연결 ID.
   *
   * AI 공통엔진에서는 문자열 courseKey보다
   * 이 값을 우선하여 과정별 추가과목 템플릿을 조회한다.
   *
   * 기존 courseKey는 레거시/관리화면 호환을 위해 유지한다.
   */
  catalogId: int("catalogId"),
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

// ─── NILE Standard Curriculums (국평원 공식 표준교육과정) ─────────────
//
// 국가평생교육진흥원 학점은행제 공식 기준 데이터.
// 회사별 운영 데이터가 아니므로 organizationId를 사용하지 않는다.
//
// 예:
// - 사회복지 전문학사
// - 사회복지학 학사
// - 외국어로서의한국어학 학사
// - 아동학 학사
// - 아동·가족 전문학사
//
export const nileStandardCurriculums = mysqlTable(
  "nile_standard_curriculums",
  {
    id: int("id").autoincrement().primaryKey(),

    /**
     * EduCanvas 내부에서 사용하는 고정 식별키.
     *
     * 예:
     * associate_social_welfare
     * bachelor_social_welfare
     * bachelor_korean_language
     * bachelor_child_studies
     * associate_child_family
     */
    curriculumKey: varchar("curriculumKey", {
      length: 100,
    }).notNull(),

    /**
     * 학위 수준.
     */
    degreeLevel: mysqlEnum("degreeLevel", [
      "associate",
      "bachelor",
    ]).notNull(),

/**
 * 전문학사 수업연한.
 *
 * bachelor = null
 * associate 2년제 = 2
 * associate 3년제 = 3
 */
associateDurationYears: int(
  "associateDurationYears"
),

    /**
     * 공식 학위명.
     */
    degreeName: varchar("degreeName", {
      length: 150,
    }).notNull(),

    /**
     * 공식 전공명.
     */
    majorName: varchar("majorName", {
      length: 200,
    }).notNull(),

/**
 * 국가평생교육진흥원 공식 전공 ID.
 *
 * 예:
 * AGAE
 * AACG
 *
 * 전체 표준교육과정 자동 동기화 시
 * 공식 상세페이지를 다시 찾는 기준으로 사용한다.
 */
officialMajorId: varchar(
  "officialMajorId",
  {
    length: 50,
  }
),

    /**
     * 학위 취득에 필요한 총 학점.
     *
     * 전문학사 2년제: 일반적으로 80
     * 학사: 일반적으로 140
     *
     * 실제 계산은 이 DB 값을 기준으로 한다.
     */
    requiredTotalCredits: int("requiredTotalCredits").notNull(),

    /**
     * 최소 전공학점.
     */
    requiredMajorCredits: int("requiredMajorCredits").notNull(),

    /**
     * 최소 교양학점.
     */
    requiredLiberalCredits: int("requiredLiberalCredits").notNull(),

    /**
     * 전공필수 핵심제 등 특수 기준 존재 여부.
     */
    hasCoreRequirement: boolean("hasCoreRequirement")
      .notNull()
      .default(false),

/**
 * 전공필수 핵심제 최소 이수 과목 수.
 *
 * null:
 * 핵심제 미적용
 *
 * 예:
 * 아동학 전공 = 5
 * 아동·가족 전공 = 5
 */
requiredCoreSubjectCount: int(
  "requiredCoreSubjectCount"
),

    /**
     * 공식 기준 버전.
     *
     * 특정 연도/개정 기준을 보존하기 위해 사용한다.
     */
    standardVersion: varchar("standardVersion", {
      length: 100,
    }).notNull(),

    /**
     * 해당 기준 적용 시작일.
     */
    effectiveFrom: date("effectiveFrom"),

    /**
     * null이면 현재 적용 중.
     */
    effectiveTo: date("effectiveTo"),

    /**
     * 공식 출처.
     */
    sourceAuthority: varchar("sourceAuthority", {
      length: 100,
    })
      .notNull()
      .default("NILE"),

    /**
     * 공식 원본 페이지.
     */
    sourceUrl: varchar("sourceUrl", {
      length: 1000,
    }),

    /**
     * 마지막 공식자료 확인일.
     */
    sourceCheckedAt: datetime("sourceCheckedAt"),

/**
 * 자동 수집기가 마지막으로
 * 해당 전공 데이터를 DB와 동기화한 시간.
 */
lastSyncedAt: datetime(
  "lastSyncedAt"
),

    isActive: boolean("isActive")
      .notNull()
      .default(true),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    curriculumVersionUniqueIdx: uniqueIndex(
      "uq_nile_curriculum_key_version"
    ).on(
      table.curriculumKey,
      table.standardVersion
    ),

    activeIdx: index(
      "idx_nile_curriculum_active"
    ).on(
      table.curriculumKey,
      table.isActive
    ),

officialMajorIdx: index(
  "idx_nile_curriculum_official_major"
).on(
  table.degreeLevel,
  table.officialMajorId
),
  })
);

export type NileStandardCurriculum =
  typeof nileStandardCurriculums.$inferSelect;

export type InsertNileStandardCurriculum =
  typeof nileStandardCurriculums.$inferInsert;


// ─── NILE Standard Subjects (국평원 공식 표준교육과정 과목) ───────────
//
// 특정 전공에서 각 과목이
// 전공필수 / 전공선택인지 저장한다.
//
export const nileStandardSubjects = mysqlTable(
  "nile_standard_subjects",
  {
    id: int("id").autoincrement().primaryKey(),

    curriculumId: int("curriculumId").notNull(),

    /**
     * 국평원 공식 과목명.
     */
    subjectName: varchar("subjectName", {
      length: 255,
    }).notNull(),

/**
 * 국가평생교육진흥원 공식 과목 ID.
 *
 * 예:
 * 사회복지학개론 = 19981300
 * 사회복지실천론 = 19990445
 */
officialSubjectId: varchar(
  "officialSubjectId",
  {
    length: 50,
  }
),

    /**
     * 검색/매칭용 정규화 이름.
     *
     * 예:
     * "사회복지학개론"
     * → "사회복지학개론"
     *
     * 공백/특수문자 등의 표기 차이를 제거한 값.
     */
    normalizedSubjectName: varchar(
      "normalizedSubjectName",
      {
        length: 255,
      }
    ).notNull(),

    /**
     * 해당 전공에서의 공식 학습구분.
     */
    requirementType: mysqlEnum(
      "requirementType",
      [
        "전공필수",
        "전공선택",
      ]
    ).notNull(),

    credits: int("credits")
      .notNull()
      .default(3),

/**
 * 국평원 공식 세부교육과정표의 강의시간.
 *
 * 예:
 * 사회복지학개론 = 3
 * 사회복지현장실습 = 1
 */
lectureHours: int(
  "lectureHours"
)
  .notNull()
  .default(0),

/**
 * 국평원 공식 세부교육과정표의 실습시간.
 *
 * 예:
 * 일반 이론과목 = 0
 * 사회복지현장실습 = 4
 * 케어실습 = 6
 */
practiceHours: int(
  "practiceHours"
)
  .notNull()
  .default(0),

    /**
     * 전공필수 핵심제 적용 대상 여부.
     */
    isCoreRequired: boolean("isCoreRequired")
      .notNull()
      .default(false),

/**
 * 해당 과목의 국평원 공식 상세/교수요목 출처.
 */
sourceUrl: varchar(
  "sourceUrl",
  {
    length: 1000,
  }
),

/**
 * 해당 과목 데이터를 마지막으로
 * 공식 원본에서 확인한 시간.
 */
sourceCheckedAt: datetime(
  "sourceCheckedAt"
),

    /**
     * 공식표 출력 순서.
     */
    sortOrder: int("sortOrder")
      .notNull()
      .default(0),

    isActive: boolean("isActive")
      .notNull()
      .default(true),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    curriculumSubjectUniqueIdx: uniqueIndex(
      "uq_nile_curriculum_subject"
    ).on(
      table.curriculumId,
      table.normalizedSubjectName
    ),

    subjectLookupIdx: index(
      "idx_nile_subject_lookup"
    ).on(
      table.normalizedSubjectName
    ),

officialSubjectIdx: index(
  "idx_nile_subject_official_id"
).on(
  table.officialSubjectId
),

    curriculumRequirementIdx: index(
      "idx_nile_subject_curriculum_requirement"
    ).on(
      table.curriculumId,
      table.requirementType
    ),
  })
);

export type NileStandardSubject =
  typeof nileStandardSubjects.$inferSelect;

export type InsertNileStandardSubject =
  typeof nileStandardSubjects.$inferInsert;


// ─── NILE Liberal Arts Subjects (국평원 공식 교양 과목) ───────────────
//
// 특정 회사/전공에 종속되지 않는 공통 교양 기준.
//
export const nileLiberalSubjects = mysqlTable(
  "nile_liberal_subjects",
  {
    id: int("id").autoincrement().primaryKey(),

    subjectName: varchar("subjectName", {
      length: 255,
    }).notNull(),

/**
 * 국가평생교육진흥원 공식 과목 ID.
 */
officialSubjectId: varchar(
  "officialSubjectId",
  {
    length: 50,
  }
),

    normalizedSubjectName: varchar(
      "normalizedSubjectName",
      {
        length: 255,
      }
    ).notNull(),

    credits: int("credits")
      .notNull()
      .default(3),

lectureHours: int(
  "lectureHours"
)
  .notNull()
  .default(0),

practiceHours: int(
  "practiceHours"
)
  .notNull()
  .default(0),

    standardVersion: varchar("standardVersion", {
      length: 100,
    }).notNull(),

    sourceUrl: varchar("sourceUrl", {
      length: 1000,
    }),

    sourceCheckedAt: datetime("sourceCheckedAt"),

    isActive: boolean("isActive")
      .notNull()
      .default(true),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    subjectVersionUniqueIdx: uniqueIndex(
      "uq_nile_liberal_subject_version"
    ).on(
      table.normalizedSubjectName,
      table.standardVersion
    ),

    lookupIdx: index(
      "idx_nile_liberal_subject_lookup"
    ).on(
      table.normalizedSubjectName,
      table.isActive
    ),

officialSubjectIdx: index(
  "idx_nile_liberal_official_id"
).on(
  table.officialSubjectId
),
  })
);

export type NileLiberalSubject =
  typeof nileLiberalSubjects.$inferSelect;

export type InsertNileLiberalSubject =
  typeof nileLiberalSubjects.$inferInsert;


// ─── NILE Major/Liberal Compatible Subjects ──────────────────────────
//
// 국평원 전공교양호환과목.
// 해당되는 경우 전공 또는 교양으로 인정 가능한 공식 기준을 저장한다.
//
export const nileMajorLiberalCompatibleSubjects =
  mysqlTable(
    "nile_major_liberal_compatible_subjects",
    {
      id: int("id")
        .autoincrement()
        .primaryKey(),

      curriculumId: int("curriculumId").notNull(),

      subjectName: varchar("subjectName", {
        length: 255,
      }).notNull(),

/**
 * 국가평생교육진흥원 공식 과목 ID.
 */
officialSubjectId: varchar(
  "officialSubjectId",
  {
    length: 50,
  }
),

      normalizedSubjectName: varchar(
        "normalizedSubjectName",
        {
          length: 255,
        }
      ).notNull(),

      /**
       * 전공으로 사용할 경우의 학습구분.
       */
      majorRequirementType: mysqlEnum(
        "majorRequirementType",
        [
          "전공필수",
          "전공선택",
        ]
      ).notNull(),

      credits: int("credits")
        .notNull()
        .default(3),

lectureHours: int(
  "lectureHours"
)
  .notNull()
  .default(0),

practiceHours: int(
  "practiceHours"
)
  .notNull()
  .default(0),

      standardVersion: varchar(
        "standardVersion",
        {
          length: 100,
        }
      ).notNull(),

      sourceUrl: varchar("sourceUrl", {
        length: 1000,
      }),

      sourceCheckedAt: datetime(
        "sourceCheckedAt"
      ),

      isActive: boolean("isActive")
        .notNull()
        .default(true),

      createdAt: timestamp("createdAt")
        .defaultNow()
        .notNull(),

      updatedAt: timestamp("updatedAt")
        .defaultNow()
        .onUpdateNow()
        .notNull(),
    },
    (table) => ({
      curriculumSubjectVersionUniqueIdx:
        uniqueIndex(
          "uq_nile_major_liberal_subject"
        ).on(
          table.curriculumId,
          table.normalizedSubjectName,
          table.standardVersion
        ),

      lookupIdx: index(
        "idx_nile_major_liberal_lookup"
      ).on(
        table.curriculumId,
        table.normalizedSubjectName,
        table.isActive
      ),

officialSubjectIdx: index(
  "idx_nile_major_liberal_official_id"
).on(
  table.officialSubjectId
),
    })
  );

export type NileMajorLiberalCompatibleSubject =
  typeof nileMajorLiberalCompatibleSubjects.$inferSelect;

export type InsertNileMajorLiberalCompatibleSubject =
  typeof nileMajorLiberalCompatibleSubjects.$inferInsert;


// ─── NILE Subject Aliases / Equivalence ──────────────────────────────
//
// OCR 표기차이, 구 과목명, 공식 동등과목 등을
// 공식 과목명과 연결하기 위한 별도 테이블.
//
// AI가 임의로 동일과목을 확정하지 않도록
// alias의 근거도 함께 저장한다.
//
export const nileSubjectAliases = mysqlTable(
  "nile_subject_aliases",
  {
    id: int("id").autoincrement().primaryKey(),

    /**
     * 특정 전공에만 적용되는 alias면 curriculumId 사용.
     * 전 전공 공통이면 null.
     */
    curriculumId: int("curriculumId"),

    canonicalSubjectName: varchar(
      "canonicalSubjectName",
      {
        length: 255,
      }
    ).notNull(),

/**
 * canonicalSubjectName이 연결되는
 * 국가평생교육진흥원 공식 과목 ID.
 *
 * 구과목명/명칭변경 추적 시
 * 이름보다 우선적인 연결 기준으로 사용한다.
 */
canonicalOfficialSubjectId: varchar(
  "canonicalOfficialSubjectId",
  {
    length: 50,
  }
),

    aliasSubjectName: varchar(
      "aliasSubjectName",
      {
        length: 255,
      }
    ).notNull(),

    normalizedAliasSubjectName: varchar(
      "normalizedAliasSubjectName",
      {
        length: 255,
      }
    ).notNull(),

    /**
     * official_equivalent:
     * 공식적으로 확인된 동일/대체 과목
     *
     * legacy_name:
     * 구 과목명
     *
     * normalization:
     * 공백/기호 등 단순 표기차이
     *
     * manual_verified:
     * 관리자 검증 후 등록
     */
    aliasType: mysqlEnum(
      "aliasType",
      [
        "official_equivalent",
        "legacy_name",
        "normalization",
        "manual_verified",
      ]
    ).notNull(),

    standardVersion: varchar("standardVersion", {
      length: 100,
    }),

    sourceUrl: varchar("sourceUrl", {
      length: 1000,
    }),

    verifiedAt: datetime("verifiedAt"),

    isActive: boolean("isActive")
      .notNull()
      .default(true),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    aliasLookupIdx: index(
      "idx_nile_subject_alias_lookup"
    ).on(
      table.normalizedAliasSubjectName,
      table.isActive
    ),

    curriculumAliasIdx: index(
      "idx_nile_subject_alias_curriculum"
    ).on(
      table.curriculumId,
      table.normalizedAliasSubjectName
    ),
  })
);

export type NileSubjectAlias =
  typeof nileSubjectAliases.$inferSelect;

export type InsertNileSubjectAlias =
  typeof nileSubjectAliases.$inferInsert;

// ─── NILE Standard Sync Runs ─────────────────────────────────────────
//
// 국가평생교육진흥원 전체 표준교육과정
// 자동 수집/동기화 실행 이력.
//
// 회사별 데이터가 아니므로 organizationId를 사용하지 않는다.
//
export const nileStandardSyncRuns = mysqlTable(
  "nile_standard_sync_runs",
  {
    id: int("id")
      .autoincrement()
      .primaryKey(),

    /**
     * 실행 종류.
     *
     * full:
     * 전체 학사 + 전문학사 + 교양 + 호환과목
     *
     * curriculum:
     * 특정 전공만 갱신
     */
    syncType: mysqlEnum(
      "syncType",
      [
        "full",
        "curriculum",
      ]
    )
      .notNull()
      .default("full"),

    /**
     * 실행 상태.
     */
    status: mysqlEnum(
      "status",
      [
        "running",
        "success",
        "failed",
      ]
    )
      .notNull()
      .default("running"),

    /**
     * 특정 curriculum 동기화인 경우 사용.
     * 전체 동기화면 null.
     */
    curriculumKey: varchar(
      "curriculumKey",
      {
        length: 100,
      }
    ),

    /**
     * 실행 당시 공식 기준 버전.
     */
    standardVersion: varchar(
      "standardVersion",
      {
        length: 100,
      }
    ),

    /**
     * 수집된 학사/전문학사 전공 수.
     */
    curriculumCount: int(
      "curriculumCount"
    )
      .notNull()
      .default(0),

    /**
     * 전공과목 수.
     */
    subjectCount: int(
      "subjectCount"
    )
      .notNull()
      .default(0),

    /**
     * 교양과목 수.
     */
    liberalSubjectCount: int(
      "liberalSubjectCount"
    )
      .notNull()
      .default(0),

    /**
     * 전공교양 호환과목 수.
     */
    compatibleSubjectCount: int(
      "compatibleSubjectCount"
    )
      .notNull()
      .default(0),

    /**
     * 신규 추가된 행 수.
     */
    insertedCount: int(
      "insertedCount"
    )
      .notNull()
      .default(0),

    /**
     * 기존 데이터 중 업데이트된 행 수.
     */
    updatedCount: int(
      "updatedCount"
    )
      .notNull()
      .default(0),

    /**
     * 비활성화된 과거 데이터 수.
     */
    deactivatedCount: int(
      "deactivatedCount"
    )
      .notNull()
      .default(0),

    /**
     * 실패 원인.
     */
    errorMessage: text(
      "errorMessage"
    ),

    /**
     * 실제 동기화 시작.
     */
    startedAt: datetime(
      "startedAt"
    )
      .notNull(),

    /**
     * 종료 시점.
     */
    finishedAt: datetime(
      "finishedAt"
    ),

    createdAt: timestamp(
      "createdAt"
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    statusStartedIdx: index(
      "idx_nile_sync_status_started"
    ).on(
      table.status,
      table.startedAt
    ),

    curriculumStartedIdx: index(
      "idx_nile_sync_curriculum_started"
    ).on(
      table.curriculumKey,
      table.startedAt
    ),
  })
);

export type NileStandardSyncRun =
  typeof nileStandardSyncRuns.$inferSelect;

export type InsertNileStandardSyncRun =
  typeof nileStandardSyncRuns.$inferInsert;

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

  /**
   * AI 공통엔진 과정 식별키.
   *
   * 과정마스터의 화면 표시명과
   * NILE/자격 공통엔진의 canonical key를 연결한다.
   *
   * null이면 아직 공통엔진 미연결 과정.
   */
  canonicalKey:
    varchar("canonicalKey", {
      length: 100,
    }),

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

  semesterNo:
    int("semesterNo")
      .notNull()
      .default(1),

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

  // 학생 이름 암호문
clientName: text("clientName")
  .notNull(),

// 학생 이름 정확한 검색용 HMAC
clientNameHash: varchar("clientNameHash", {
  length: 64,
}),

// 학생 전화번호 암호문
phone: text("phone")
  .notNull(),

// 전화번호 정확한 검색용 HMAC
phoneHash: varchar("phoneHash", {
  length: 64,
}),

// 관리화면 및 뒷자리 검색용
phoneLast4: varchar("phoneLast4", {
  length: 4,
}),

// 담당자 이름도 개인정보이므로 암호문
assigneeName: text("assigneeName"),

privateCertificateMasterId: int(
  "privateCertificateMasterId"
),

certificateName: varchar("certificateName", {
  length: 255,
}).notNull(),

// 신청자 주소 암호문
inputAddress: text("inputAddress"),
detailAddress: text("detailAddress"),
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

orgPhoneHashIdx: index(
  "idx_private_cert_org_phone_hash"
).on(
  table.organizationId,
  table.phoneHash
),

orgPhoneLast4Idx: index(
  "idx_private_cert_org_phone_last4"
).on(
  table.organizationId,
  table.phoneLast4
),

orgClientNameHashIdx: index(
  "idx_private_cert_org_client_name_hash"
).on(
  table.organizationId,
  table.clientNameHash
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

// ─── Private Certificate External Requests (민간자격증 단독 신청) ────
export const privateCertificateExternalRequests = mysqlTable(
  "private_certificate_external_requests",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId")
      .notNull()
      .default(1),

    /**
     * 별도 신청자는 students 테이블과 연결하지 않는다.
     * 생성 시 관리자가 지정한 CRM 담당자 ID
     */
    assigneeId: int("assigneeId").notNull(),

    /**
     * 실제 등록 작업을 수행한 Admin 또는 Host
     */
    createdBy: int("createdBy").notNull(),
    updatedBy: int("updatedBy"),

    // 신청자 이름 암호문
    clientName: text("clientName").notNull(),

    // 이름 정확 검색용 HMAC
    clientNameHash: varchar("clientNameHash", {
      length: 64,
    }),

    // 신청자 연락처 암호문
    phone: text("phone").notNull(),

    // 연락처 정확 검색용 HMAC
    phoneHash: varchar("phoneHash", {
      length: 64,
    }),

    // 연락처 뒷자리 검색용
    phoneLast4: varchar("phoneLast4", {
      length: 4,
    }),

    /**
     * 담당자 이름 스냅샷
     * 개인정보 암호화 후 저장
     */
    assigneeName: text("assigneeName"),

    /**
     * 처음에는 이름·연락처·담당자만으로 생성할 수 있도록
     * 자격증 관련 값은 nullable
     */
    privateCertificateMasterId: int(
      "privateCertificateMasterId"
    ),

    certificateName: varchar("certificateName", {
      length: 255,
    }),

    // 신청자 주소 암호문
    inputAddress: text("inputAddress"),
    detailAddress: text("detailAddress"),

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

    feeAmount: decimal("feeAmount", {
      precision: 12,
      scale: 0,
    })
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

    refundAmount: decimal("refundAmount", {
      precision: 12,
      scale: 0,
    })
      .notNull()
      .default("0"),

    refundReason: text("refundReason"),
    refundRequestedAt: datetime("refundRequestedAt"),
    refundApprovedAt: datetime("refundApprovedAt"),
    refundApprovedBy: int("refundApprovedBy"),

    attachmentName: varchar("attachmentName", {
      length: 255,
    }),

    attachmentUrl: varchar("attachmentUrl", {
      length: 1000,
    }),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    orgCreatedIdx: index(
      "idx_private_cert_external_org_created"
    ).on(
      table.organizationId,
      table.createdAt
    ),

    orgAssigneeIdx: index(
      "idx_private_cert_external_org_assignee"
    ).on(
      table.organizationId,
      table.assigneeId
    ),

    orgStatusIdx: index(
      "idx_private_cert_external_org_status"
    ).on(
      table.organizationId,
      table.requestStatus,
      table.paymentStatus
    ),

    orgPhoneHashIdx: index(
      "idx_private_cert_external_org_phone_hash"
    ).on(
      table.organizationId,
      table.phoneHash
    ),

    orgPhoneLast4Idx: index(
      "idx_private_cert_external_org_phone_last4"
    ).on(
      table.organizationId,
      table.phoneLast4
    ),

    orgClientNameHashIdx: index(
      "idx_private_cert_external_org_name_hash"
    ).on(
      table.organizationId,
      table.clientNameHash
    ),
  })
);

export type PrivateCertificateExternalRequest =
  typeof privateCertificateExternalRequests.$inferSelect;

export type InsertPrivateCertificateExternalRequest =
  typeof privateCertificateExternalRequests.$inferInsert;

// ─── Practice Support Requests (실습배정지원센터) ────────────────────
export const practiceSupportRequests = mysqlTable(
  "practice_support_requests",
{
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

  studentId: int("studentId").notNull(),
  semesterId: int("semesterId"),
  assigneeId: int("assigneeId").notNull(),

  // 학생 이름 암호문
clientName: text("clientName")
  .notNull(),

// 학생 이름 정확한 검색용 HMAC
clientNameHash: varchar("clientNameHash", {
  length: 64,
}),

// 학생 전화번호 암호문
phone: text("phone")
  .notNull(),

// 전화번호 정확한 검색용 HMAC
phoneHash: varchar("phoneHash", {
  length: 64,
}),

// 전화번호 마지막 네 자리
phoneLast4: varchar("phoneLast4", {
  length: 4,
}),

// 담당자 이름 암호문
assigneeName: text("assigneeName"),

// 실습센터 처리 담당자 이름 암호문
managerName: text("managerName"),

course: varchar("course", {
  length: 200,
}).notNull(),

// 학생이 입력한 주소 암호문
inputAddress: text("inputAddress"),

// 학생 상세주소 암호문
detailAddress: text("detailAddress"),

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

orgPhoneHashIdx: index(
  "idx_practice_support_org_phone_hash"
).on(
  table.organizationId,
  table.phoneHash
),

orgPhoneLast4Idx: index(
  "idx_practice_support_org_phone_last4"
).on(
  table.organizationId,
  table.phoneLast4
),

orgClientNameHashIdx: index(
  "idx_practice_support_org_client_name_hash"
).on(
  table.organizationId,
  table.clientNameHash
),
  })
);

export type PracticeSupportRequest =
  typeof practiceSupportRequests.$inferSelect;
export type InsertPracticeSupportRequest =
  typeof practiceSupportRequests.$inferInsert;

// ─── Practice Support External Requests (실습배정 단독 신청) ────────
export const practiceSupportExternalRequests = mysqlTable(
  "practice_support_external_requests",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId")
      .notNull()
      .default(1),

    /**
     * students, semesters 테이블과 연결하지 않는
     * 실습배정 단독 신청자
     */
    assigneeId: int("assigneeId").notNull(),

    /**
     * 신규 등록을 수행한 Admin 또는 Host
     */
    createdBy: int("createdBy").notNull(),
    updatedBy: int("updatedBy"),

    // 신청자 이름 암호문
    clientName: text("clientName").notNull(),

    // 이름 정확 검색용 HMAC
    clientNameHash: varchar("clientNameHash", {
      length: 64,
    }),

    // 신청자 연락처 암호문
    phone: text("phone").notNull(),

    // 연락처 정확 검색용 HMAC
    phoneHash: varchar("phoneHash", {
      length: 64,
    }),

    // 연락처 뒷자리 검색용
    phoneLast4: varchar("phoneLast4", {
      length: 4,
    }),

    // 지정된 담당자 이름 암호문
    assigneeName: text("assigneeName"),

    // 실습센터 내부 처리 담당자 이름 암호문
    managerName: text("managerName"),

    /**
     * 처음에는 이름·연락처·담당자만으로 생성할 수 있도록
     * 과정과 주소는 nullable
     */
    course: varchar("course", {
      length: 200,
    }),

    inputAddress: text("inputAddress"),
    detailAddress: text("detailAddress"),

    practiceSemesterLabel: varchar("practiceSemesterLabel", {
      length: 50,
    }),

    practiceHours: int("practiceHours"),

    practiceDate: varchar("practiceDate", {
      length: 50,
    }),

    includeEducationCenter: boolean("includeEducationCenter")
      .notNull()
      .default(true),

    includePracticeInstitution: boolean(
      "includePracticeInstitution"
    )
      .notNull()
      .default(true),

    coordinationStatus: mysqlEnum("coordinationStatus", [
      "미섭외",
      "섭외중",
      "섭외완료",
    ])
      .notNull()
      .default("미섭외"),

    selectedEducationCenterId: int(
      "selectedEducationCenterId"
    ),

    selectedEducationCenterName: varchar(
      "selectedEducationCenterName",
      {
        length: 255,
      }
    ),

    selectedEducationCenterAddress: varchar(
      "selectedEducationCenterAddress",
      {
        length: 255,
      }
    ),

    selectedEducationCenterDistanceKm: decimal(
      "selectedEducationCenterDistanceKm",
      {
        precision: 8,
        scale: 2,
      }
    ),

    selectedPracticeInstitutionId: int(
      "selectedPracticeInstitutionId"
    ),

    selectedPracticeInstitutionName: varchar(
      "selectedPracticeInstitutionName",
      {
        length: 255,
      }
    ),

    selectedPracticeInstitutionAddress: varchar(
      "selectedPracticeInstitutionAddress",
      {
        length: 255,
      }
    ),

    selectedPracticeInstitutionDistanceKm: decimal(
      "selectedPracticeInstitutionDistanceKm",
      {
        precision: 8,
        scale: 2,
      }
    ),

    feeAmount: decimal("feeAmount", {
      precision: 12,
      scale: 0,
    })
      .notNull()
      .default("0"),

    paymentStatus: mysqlEnum("paymentStatus", [
      "미결제",
      "결제",
      "환불",
    ])
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

    refundAmount: decimal("refundAmount", {
      precision: 12,
      scale: 0,
    })
      .notNull()
      .default("0"),

    refundReason: text("refundReason"),
    refundRequestedAt: datetime("refundRequestedAt"),
    refundApprovedAt: datetime("refundApprovedAt"),
    refundApprovedBy: int("refundApprovedBy"),

    note: text("note"),

    attachmentName: varchar("attachmentName", {
      length: 255,
    }),

    attachmentUrl: varchar("attachmentUrl", {
      length: 1000,
    }),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    orgCreatedIdx: index(
      "idx_practice_external_org_created"
    ).on(
      table.organizationId,
      table.createdAt
    ),

    orgAssigneeIdx: index(
      "idx_practice_external_org_assignee"
    ).on(
      table.organizationId,
      table.assigneeId
    ),

    orgCoordinationIdx: index(
      "idx_practice_external_org_coord"
    ).on(
      table.organizationId,
      table.coordinationStatus
    ),

    orgPaymentIdx: index(
      "idx_practice_external_org_payment"
    ).on(
      table.organizationId,
      table.paymentStatus
    ),

    orgPhoneHashIdx: index(
      "idx_practice_external_org_phone_hash"
    ).on(
      table.organizationId,
      table.phoneHash
    ),

    orgPhoneLast4Idx: index(
      "idx_practice_external_org_phone_last4"
    ).on(
      table.organizationId,
      table.phoneLast4
    ),

    orgClientNameHashIdx: index(
      "idx_practice_external_org_name_hash"
    ).on(
      table.organizationId,
      table.clientNameHash
    ),
  })
);

export type PracticeSupportExternalRequest =
  typeof practiceSupportExternalRequests.$inferSelect;

export type InsertPracticeSupportExternalRequest =
  typeof practiceSupportExternalRequests.$inferInsert;

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
export const jobSupportRequests = mysqlTable(
  "job_support_requests",
  {
  id: int("id").autoincrement().primaryKey(),
organizationId: int("organizationId").notNull().default(1),

  studentId: int("studentId").notNull(),
  assigneeId: int("assigneeId").notNull(),

  // 학생 이름 암호문
clientName: text("clientName")
  .notNull(),

// 학생 이름 정확한 검색용 HMAC
clientNameHash: varchar("clientNameHash", {
  length: 64,
}),

// 학생 전화번호 암호문
phone: text("phone")
  .notNull(),

// 전화번호 정확한 검색용 HMAC
phoneHash: varchar("phoneHash", {
  length: 64,
}),

// 관리화면 및 뒷자리 검색용
phoneLast4: varchar("phoneLast4", {
  length: 4,
}),

// 담당 직원 이름 암호문
assigneeName: text("assigneeName"),

// 학생 주소 암호문
inputAddress: text("inputAddress"),

// 희망지역은 지역 단위 정보이므로 평문 유지
desiredArea: varchar("desiredArea", {
  length: 255,
}),

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

  createdAt: timestamp("createdAt")
  .defaultNow()
  .notNull(),

updatedAt: timestamp("updatedAt")
  .defaultNow()
  .onUpdateNow()
  .notNull(),
  },
  (table) => ({
    orgStudentIdx: index(
      "idx_job_support_org_student"
    ).on(
      table.organizationId,
      table.studentId
    ),

    orgAssigneeIdx: index(
      "idx_job_support_org_assignee"
    ).on(
      table.organizationId,
      table.assigneeId
    ),

    orgStatusIdx: index(
      "idx_job_support_org_status"
    ).on(
      table.organizationId,
      table.supportStatus,
      table.paymentStatus
    ),

    orgPhoneHashIdx: index(
      "idx_job_support_org_phone_hash"
    ).on(
      table.organizationId,
      table.phoneHash
    ),

    orgPhoneLast4Idx: index(
      "idx_job_support_org_phone_last4"
    ).on(
      table.organizationId,
      table.phoneLast4
    ),

    orgClientNameHashIdx: index(
      "idx_job_support_org_client_name_hash"
    ).on(
      table.organizationId,
      table.clientNameHash
    ),
  })
);

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

// ─── Work Community (업무 커뮤니티) ────────────────────────────────
// categoryId는 업무 분류용이며 열람 권한과 분리한다.
// visibility이 targeted인 게시글의 열람 대상은
// work_post_targets 테이블에서 관리한다.

export const workCategories = mysqlTable(
  "work_categories",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),

    name: varchar("name", { length: 80 }).notNull(),

    color: varchar("color", { length: 20 })
      .notNull()
      .default("slate"),

    sortOrder: int("sortOrder")
      .notNull()
      .default(0),

    isActive: boolean("isActive")
      .notNull()
      .default(true),

    createdBy: int("createdBy").notNull(),

    createdAt: timestamp("createdAt")
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (table) => ({
    organizationNameUnique: uniqueIndex(
      "uq_work_categories_organization_name"
    ).on(
      table.organizationId,
      table.name
    ),

    organizationActiveOrderIdx: index(
      "idx_work_categories_organization_active_order"
    ).on(
      table.organizationId,
      table.isActive,
      table.sortOrder
    ),
  })
);

export const workPosts = mysqlTable(
  "work_posts",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),

    categoryId: int("categoryId").notNull(),

    authorId: int("authorId").notNull(),

    authorName: varchar("authorName", {
      length: 100,
    }),

    title: varchar("title", {
      length: 255,
    }).notNull(),

    content: mediumtext("content").notNull(),

    visibility: mysqlEnum("visibility", [
      "all",
      "targeted",
    ])
      .notNull()
      .default("all"),

    requiresAcknowledgement: boolean(
      "requiresAcknowledgement"
    )
      .notNull()
      .default(false),

    isPinned: boolean("isPinned")
      .notNull()
      .default(false),

    isActive: boolean("isActive")
      .notNull()
      .default(true),

    viewCount: int("viewCount")
      .notNull()
      .default(0),

    commentCount: int("commentCount")
      .notNull()
      .default(0),

    createdAt: timestamp("createdAt")
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (table) => ({
    organizationCreatedIdx: index(
      "idx_work_posts_organization_created"
    ).on(
      table.organizationId,
      table.createdAt
    ),

    organizationCategoryIdx: index(
      "idx_work_posts_organization_category"
    ).on(
      table.organizationId,
      table.categoryId
    ),

    organizationAuthorIdx: index(
      "idx_work_posts_organization_author"
    ).on(
      table.organizationId,
      table.authorId
    ),
  })
);

export const workPostTargets = mysqlTable(
  "work_post_targets",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),

    postId: int("postId").notNull(),

    userId: int("userId").notNull(),

    createdAt: timestamp("createdAt")
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    postUserUnique: uniqueIndex(
      "uq_work_post_targets_post_user"
    ).on(
      table.postId,
      table.userId
    ),

    organizationUserIdx: index(
      "idx_work_post_targets_organization_user"
    ).on(
      table.organizationId,
      table.userId
    ),
  })
);

export const workPostAttachments = mysqlTable(
  "work_post_attachments",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),

    postId: int("postId").notNull(),

    originalName: varchar("originalName", {
      length: 255,
    }).notNull(),

    storedName: varchar("storedName", {
      length: 255,
    }).notNull(),

    url: varchar("url", {
      length: 1000,
    }).notNull(),

    mimeType: varchar("mimeType", {
      length: 150,
    }),

    sizeBytes: int("sizeBytes")
      .notNull()
      .default(0),

    uploadedBy: int("uploadedBy").notNull(),

    createdAt: timestamp("createdAt")
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    organizationPostIdx: index(
      "idx_work_post_attachments_organization_post"
    ).on(
      table.organizationId,
      table.postId
    ),
  })
);

export const workPostReads = mysqlTable(
  "work_post_reads",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),

    postId: int("postId").notNull(),

    userId: int("userId").notNull(),

    firstReadAt: timestamp("firstReadAt")
      .notNull()
      .defaultNow(),

    lastReadAt: timestamp("lastReadAt")
      .notNull()
      .defaultNow(),

    acknowledgedAt: timestamp("acknowledgedAt"),
  },
  (table) => ({
    postUserUnique: uniqueIndex(
      "uq_work_post_reads_post_user"
    ).on(
      table.postId,
      table.userId
    ),

    organizationUserIdx: index(
      "idx_work_post_reads_organization_user"
    ).on(
      table.organizationId,
      table.userId
    ),
  })
);

export const workPostComments = mysqlTable(
  "work_post_comments",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),

    postId: int("postId").notNull(),

    parentCommentId: int("parentCommentId"),

    authorId: int("authorId").notNull(),

    authorName: varchar("authorName", {
      length: 100,
    }),

    content: text("content").notNull(),

    isActive: boolean("isActive")
      .notNull()
      .default(true),

    createdAt: timestamp("createdAt")
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (table) => ({
    organizationPostCreatedIdx: index(
      "idx_work_post_comments_organization_post_created"
    ).on(
      table.organizationId,
      table.postId,
      table.createdAt
    ),

    parentCommentIdx: index(
      "idx_work_post_comments_parent"
    ).on(table.parentCommentId),
  })
);

export type InsertWorkCategory =
  typeof workCategories.$inferInsert;

export type SelectWorkCategory =
  typeof workCategories.$inferSelect;

export type InsertWorkPost =
  typeof workPosts.$inferInsert;

export type SelectWorkPost =
  typeof workPosts.$inferSelect;

export type InsertWorkPostTarget =
  typeof workPostTargets.$inferInsert;

export type SelectWorkPostTarget =
  typeof workPostTargets.$inferSelect;

export type InsertWorkPostAttachment =
  typeof workPostAttachments.$inferInsert;

export type SelectWorkPostAttachment =
  typeof workPostAttachments.$inferSelect;

export type InsertWorkPostRead =
  typeof workPostReads.$inferInsert;

export type SelectWorkPostRead =
  typeof workPostReads.$inferSelect;

export type InsertWorkPostComment =
  typeof workPostComments.$inferInsert;

export type SelectWorkPostComment =
  typeof workPostComments.$inferSelect;

export const schedules = mysqlTable(
  "schedules",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId:
      int("organizationId")
        .notNull()
        .default(1),

    /**
     * 학생과 직접 연결된 일정일 때만 저장한다.
     *
     * null:
     * 일반 개인 일정 또는 회사 전체 일정
     *
     * number:
     * 특정 학생과 연결된 일정
     */
    studentId:
      int("studentId"),

    title:
      varchar(
        "title",
        {
          length:
            255,
        }
      ).notNull(),
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
    (
    table
  ) => ({
    orgDateIdx:
      index(
        "idx_schedules_org_date"
      ).on(
        table.organizationId,
        table.scheduleDate
      ),

    orgNotifyIdx:
      index(
        "idx_schedules_org_notify"
      ).on(
        table.organizationId,
        table.isActive,
        table.isNotified,
        table.startAt
      ),

    orgOwnerDateIdx:
      index(
        "idx_schedules_org_owner_date"
      ).on(
        table.organizationId,
        table.ownerUserId,
        table.scheduleDate
      ),

    /**
     * AI 학생 Dashboard와
     * 학생별 일정 조회용 인덱스
     */
    orgStudentDateIdx:
      index(
        "idx_schedules_org_student_date"
      ).on(
        table.organizationId,
        table.studentId,
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

// ==============================
// AI PENDING ACTIONS
// AI 등록·수정 승인 대기 초안
// ==============================

export const aiPendingActions = mysqlTable(
  "ai_pending_actions",
  {
    id: int("id")
      .autoincrement()
      .primaryKey(),

    /**
     * 테넌트 경계
     *
     * 승인 조회와 실행 시 반드시
     * 로그인 사용자의 organizationId와 일치해야 한다.
     */
    organizationId: int("organizationId")
      .notNull(),

    /**
     * 최초 초안을 요청한 사용자
     */
    requestedByUserId: int("requestedByUserId")
      .notNull(),

    requestedByRole: varchar("requestedByRole", {
      length: 50,
    }).notNull(),

    /**
     * 실제 승인한 사용자
     *
     * 기본 정책은 요청자 본인만 승인 가능하게 하고,
     * 추후 Admin/Host 승인 정책이 필요하면 서버에서 확장한다.
     */
    confirmedByUserId: int("confirmedByUserId"),

    /**
     * 작업 종류
     *
     * 삭제 작업은 절대로 추가하지 않는다.
     */
    actionType: mysqlEnum("actionType", [
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
  "schedule_create",

  "document_transfer_import",
  "document_plan_import",
  "document_payment_import",
  "document_plan_payment_import",
]).notNull(),

    /**
     * 초안의 현재 상태
     */
    status: mysqlEnum("status", [
      "draft",
      "awaiting_confirmation",
      "executing",
      "executed",
      "cancelled",
      "expired",
      "failed",
    ])
      .notNull()
      .default("draft"),

    /**
     * 원본 상담DB 대상
     *
     * 학생 통합등록은 상담DB에서 시작하므로
     * consultationId가 주 대상이 된다.
     */
    consultationId: int("consultationId"),

    /**
     * 기존 학생 수정 또는
     * 학생 생성 완료 후 연결되는 학생 ID
     */
    studentId: int("studentId"),

    /**
     * 특정 학기 수정 작업용
     */
    semesterId: int("semesterId"),

    /**
     * 사용자에게 보여줄 전체 확인 내용
     *
     * 학생 기본정보, 학기, 교육원, 금액,
     * 과목 분류, 경고 등을 저장한다.
     */
    previewJson: json("previewJson")
      .notNull(),

    /**
     * 승인 후 실제 DB 함수에 전달할 값
     *
     * 프론트가 승인 시 payload를 다시 보내면 안 된다.
     * 서버는 반드시 이 컬럼에 저장된 payload를 실행해야 한다.
     */
    payloadJson: json("payloadJson")
      .notNull(),

    /**
     * 초안을 만들 당시의 기존 DB 상태
     *
     * 수정 작업에서 변경 전·후 비교와
     * 승인 직전 충돌 검사용으로 사용한다.
     */
    sourceSnapshotJson: json(
      "sourceSnapshotJson"
    ),

    /**
     * 누락값과 경고를 별도로 저장
     */
    missingFieldsJson: json(
      "missingFieldsJson"
    ),

    warningsJson: json("warningsJson"),

    /**
     * 초안 버전
     *
     * 사용자가 확인 화면에서 내용을 수정하면
     * version을 증가시켜 이전 승인을 막는다.
     */
    version: int("version")
      .notNull()
      .default(1),

    /**
     * 동일 승인 요청 중복 실행 방지
     */
    idempotencyKey: varchar(
      "idempotencyKey",
      {
        length: 100,
      }
    ).notNull(),

    /**
     * 실행 결과
     */
    executionResultJson: json(
      "executionResultJson"
    ),

    errorMessage: text("errorMessage"),

    /**
     * 초안 만료 시각
     *
     * 오래된 초안이 현재 DB에 실행되는 것을 방지한다.
     */
    expiresAt: datetime("expiresAt")
      .notNull(),

    confirmedAt: datetime("confirmedAt"),
    executedAt: datetime("executedAt"),
    cancelledAt: datetime("cancelledAt"),
    failedAt: datetime("failedAt"),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    /**
     * 회사별 승인 대기 목록
     */
    orgStatusIdx: index(
      "idx_ai_pending_org_status"
    ).on(
      table.organizationId,
      table.status
    ),

    /**
     * 사용자가 생성한 초안 목록
     */
    orgRequesterIdx: index(
      "idx_ai_pending_org_requester"
    ).on(
      table.organizationId,
      table.requestedByUserId
    ),

    /**
     * 상담DB에서 진행 중인 초안 조회
     */
    orgConsultationIdx: index(
      "idx_ai_pending_org_consultation"
    ).on(
      table.organizationId,
      table.consultationId
    ),

    /**
     * 학생별 진행 중인 초안 조회
     */
    orgStudentIdx: index(
      "idx_ai_pending_org_student"
    ).on(
      table.organizationId,
      table.studentId
    ),

    /**
     * 만료 초안 정리
     */
    statusExpiresIdx: index(
      "idx_ai_pending_status_expires"
    ).on(
      table.status,
      table.expiresAt
    ),

    /**
     * 같은 실행 요청이 두 번 처리되는 것을 방지
     */
    idempotencyIdx: uniqueIndex(
      "uq_ai_pending_idempotency"
    ).on(
      table.idempotencyKey
    ),
  })
);

export const aiChatMessages = mysqlTable(
  "ai_chat_messages",
  {
    id: int("id").autoincrement().primaryKey(),

    organizationId: int("organizationId").notNull(),

    userId: int("userId").notNull(),

    role: mysqlEnum("role", [
      "user",
      "assistant",
    ]).notNull(),

    kind: varchar("kind", {
      length: 50,
    })
      .notNull()
      .default("text"),

    content: text("content").notNull(),

    messageDataJson: json("messageDataJson"),

    selectedStudentId: int(
      "selectedStudentId"
    ),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgUserCreatedIdx: index(
      "idx_ai_chat_org_user_created"
    ).on(
      table.organizationId,
      table.userId,
      table.createdAt
    ),

    orgStudentIdx: index(
      "idx_ai_chat_student"
    ).on(
      table.organizationId,
      table.selectedStudentId
    ),
  })
);

export type InsertAiChatMessage =
  typeof aiChatMessages.$inferInsert;

export type SelectAiChatMessage =
  typeof aiChatMessages.$inferSelect;

export type AiPendingAction =
  typeof aiPendingActions.$inferSelect;

export type InsertAiPendingAction =
  typeof aiPendingActions.$inferInsert;

// ==============================
// AI WORK SESSIONS
// 사용자별 현재 작업 대상·업무 진행 상태
// ==============================

export const aiWorkSessions = mysqlTable(
  "ai_work_sessions",
  {
    id: int("id")
      .autoincrement()
      .primaryKey(),

    /**
     * 회사별 데이터 경계
     *
     * Staff / Admin / Host 모두
     * 현재 로그인한 회사의 세션만 사용한다.
     */
    organizationId: int("organizationId")
      .notNull(),

    /**
     * AI 업무 세션 소유 사용자
     *
     * 같은 회사라도 사용자별로
     * 현재 작업 대상과 진행 업무를 따로 유지한다.
     */
    userId: int("userId")
      .notNull(),

    /**
     * 현재 작업 대상 종류
     *
     * consultation
     * student
     * practice_request
     * private_certificate_request
     */
    activeTargetType: varchar(
      "activeTargetType",
      {
        length: 50,
      }
    ),

    /**
     * 현재 작업 대상의 실제 DB ID
     */
    activeTargetId: int(
      "activeTargetId"
    ),

    /**
     * 현재 대상 표시용 이름
     *
     * 이 값은 검색 기준으로 사용하지 않고
     * AI 화면과 응답 표시용으로만 사용한다.
     *
     * 학생 이름 암호화 정책 때문에
     * 추후 저장 전 암호화 여부를 검토해야 한다.
     */
    activeTargetName: text(
      "activeTargetName"
    ),

    /**
     * 현재 업무와 연결된 상담DB
     */
    consultationId: int(
      "consultationId"
    ),

    /**
     * 현재 업무와 연결된 학생
     *
     * 학생을 한 번 선택하면
     * 다른 학생이 명확히 지정되기 전까지 유지한다.
     */
    studentId: int(
      "studentId"
    ),

    /**
     * 현재 업무와 연결된 실습 요청
     */
    practiceRequestId: int(
      "practiceRequestId"
    ),

    /**
     * 현재 연결된 민간자격증 요청 ID 목록
     *
     * 한 학생에게 여러 자격증 요청이
     * 연결될 수 있으므로 JSON 배열로 저장한다.
     */
    privateCertificateRequestIdsJson: json(
      "privateCertificateRequestIdsJson"
    ),

    /**
     * 현재 진행 중인 업무 종류
     *
     * 예:
     * student_update
     * practice_update
     * schedule_create
     */
    workflowType: varchar(
      "workflowType",
      {
        length: 100,
      }
    ),

    /**
     * 현재 업무 진행 단계
     *
     * idle
     * collecting_data
     * awaiting_target_selection
     * awaiting_document
     * awaiting_confirmation
     * executing
     * completed
     * failed
     */
    workflowStep: varchar(
      "workflowStep",
      {
        length: 50,
      }
    )
      .notNull()
      .default("idle"),

    /**
     * 여러 메시지에서 받은 업무 입력값 누적
     *
     * 예:
     * 주소, 학기, 실습 예정일, 결제정보 등
     */
    workflowDraftJson: json(
      "workflowDraftJson"
    ),

    /**
     * 아직 사용자에게 받아야 하는 필드 목록
     *
     * 예:
     * ["address", "practiceDate"]
     */
    waitingForJson: json(
      "waitingForJson"
    ),

    /**
     * 마지막으로 사용자에게 확인시킨 작업
     *
     * 사용자가
     * "ㅇㅇ", "그대로 해줘", "진행해줘"
     * 라고 했을 때 이 작업을 기준으로 처리한다.
     */
    lastPresentedActionJson: json(
      "lastPresentedActionJson"
    ),

    /**
     * 동시에 들어온 요청이
     * 이전 세션 상태를 덮어쓰는 것을 방지한다.
     */
    version: int("version")
      .notNull()
      .default(1),

    createdAt: timestamp("createdAt")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    /**
     * 한 회사에서 사용자 한 명당
     * 하나의 활성 업무 세션만 유지한다.
     */
    orgUserUniqueIdx: uniqueIndex(
      "uq_ai_work_session_org_user"
    ).on(
      table.organizationId,
      table.userId
    ),

    /**
     * 현재 선택된 학생 기준 세션 조회
     */
    orgStudentIdx: index(
      "idx_ai_work_session_org_student"
    ).on(
      table.organizationId,
      table.studentId
    ),

    /**
     * 현재 작업 대상 기준 조회
     */
    orgTargetIdx: index(
      "idx_ai_work_session_org_target"
    ).on(
      table.organizationId,
      table.activeTargetType,
      table.activeTargetId
    ),

    /**
     * 진행 중인 업무 상태 확인
     */
    orgWorkflowIdx: index(
      "idx_ai_work_session_org_workflow"
    ).on(
      table.organizationId,
      table.workflowStep
    ),
  })
);

export type AiWorkSession =
  typeof aiWorkSessions.$inferSelect;

export type InsertAiWorkSession =
  typeof aiWorkSessions.$inferInsert;

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

  sourceType: mysqlEnum("sourceType", [
    "student",
    "external",
  ])
    .notNull()
    .default("student"),

  sourceId: int("sourceId").notNull(),

  studentId: int("studentId"),
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
    orgSourceUniqueIdx: uniqueIndex(
  "uq_settlement_items_org_source"
).on(
  table.organizationId,
  table.revenueType,
  table.sourceType,
  table.sourceId
),

    orgOccurredIdx: index(
      "idx_settlement_items_org_occurred"
    ).on(
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
