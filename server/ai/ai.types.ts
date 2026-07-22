 /**
 * EduCanvas CRM AI 공용 타입
 *
 * 원칙
 * 1. AI는 등록된 Tool만 실행할 수 있다.
 * 2. organizationId / userId / teamId / assigneeId는 서버 Context에서 결정한다.
 * 3. 프론트에서 전달된 권한 범위 값은 신뢰하지 않는다.
 * 4. 삭제, 스키마 변경, 서버 수정은 AI Tool로 허용하지 않는다.
 */

export type AiRole =
  | "staff"
  | "admin"
  | "host"
  | "superhost";

export type AiToolAccessMode =
  | "read"
  | "draft"
  | "write"
  | "system";

export type AiDataScope =
  | "self"
  | "team"
  | "organization"
  | "system";

export type AiToolName =
  | "student.search"
  | "student.summary"
  | "consultation.search"
  | "alert.missingData"
  | "risk.studentDetail"
  | "risk.studentList"
  | "practice.institutionSearch"
  | "practice.supportStatus"
  | "error.recentList"
  | "error.detail";

export type AiToolStatus =
  | "started"
  | "success"
  | "failed"
  | "denied";

export type AiUserContext = {
  /**
   * 현재 AI를 실행한 로그인 사용자
   */
  userId: number;
  userName: string | null;
  role: AiRole;

  /**
   * AI가 실제로 접근할 대상 회사
   *
   * staff/admin/host:
   * 로그인 세션의 organizationId로 고정
   *
   * superhost:
   * 명시적으로 지정된 targetOrganizationId만 허용
   */
  organizationId: number;

  /**
   * 현재 사용자의 조직도 정보
   */
  teamId: number | null;
  positionId: number | null;

  /**
   * AI 조회 범위
   *
   * staff: self
   * admin: team
   * host: organization
   * superhost: system 또는 명시적으로 선택한 organization
   */
  scope: AiDataScope;

  /**
   * Staff:
   * [현재 사용자 ID]
   *
   * Admin:
   * 같은 팀 사용자 ID 목록
   *
   * Host:
   * null = 회사 전체
   *
   * Superhost:
   * null = 선택 회사 전체
   */
  allowedAssigneeIds: number[] | null;

  /**
 * AI가 변경 기능을 실행할 수 있는지 여부
 *
 * 현재 1차:
 * Staff의 본인 담당 상담DB 학생 통합등록만 허용한다.
 *
 * Admin, Host, Superhost 쓰기 기능은
 * 역할별 기능 개발 시 별도로 확장한다.
 */
canWrite: boolean;

  /**
   * AI 삭제 기능은 항상 false
   */
  canDelete: false;

  /**
   * Superhost 여부
   */
  isSuperhost: boolean;

  /**
   * Context 생성 시각
   */
  createdAt: string;
};

export type BuildAiContextInput = {
  /**
   * tRPC ctx.user
   */
  user: any;

  /**
   * Superhost가 특정 회사 데이터를 점검해야 할 때만 사용
   */
  targetOrganizationId?: number | null;
};

export type AiToolExecutionMeta = {
  requestId: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;

  toolName: AiToolName | string;
  status: AiToolStatus;

  organizationId: number;
  userId: number;
  userRole: AiRole;

  targetStudentId?: number | null;
  targetStudentName?: string | null;

  errorMessage?: string | null;
};

export type AiToolExecutionResult<T = unknown> = {
  success: boolean;
  toolName: string;
  data?: T;
  error?: {
    code:
      | "AI_TOOL_NOT_FOUND"
      | "AI_PERMISSION_DENIED"
      | "AI_INVALID_INPUT"
      | "AI_TARGET_NOT_FOUND"
      | "AI_TOOL_EXECUTION_FAILED";
    message: string;
  };
  meta: AiToolExecutionMeta;
};

export type AiToolHandlerParams<TInput = unknown> = {
  context: AiUserContext;
  input: TInput;
  requestId: string;
};

export type AiToolDefinition<
  TInput = unknown,
  TOutput = unknown
> = {
  name: AiToolName | string;
  description: string;

  accessMode: AiToolAccessMode;

  allowedRoles: AiRole[];

  /**
   * true이면 조직 범위가 반드시 있어야 한다.
   * 대부분의 CRM Tool은 true.
   */
  requiresOrganization: boolean;

  /**
   * 변경 작업 여부
   *
   * 1차 등록 Tool은 모두 false.
   */
  requiresConfirmation: boolean;

  /**
   * AI가 자동 실행할 수 있는지 여부
   */
  autoExecutable: boolean;

  handler: (
    params: AiToolHandlerParams<TInput>
  ) => Promise<TOutput>;
};

export type StudentSearchToolInput = {
  query: string;
  limit?: number;
};

export type StudentSearchResultItem = {
  id: number;
  clientName: string | null;
  phone: string | null;
  course: string | null;
  status: string | null;
  institution: string | null;
  assigneeId: number | null;
};

export type StudentSearchToolOutput = {
  query: string;
  count: number;
  students: StudentSearchResultItem[];
};

export type ConsultationSearchToolInput = {
  query: string;
  limit?: number;
};

export type ConsultationSearchResultItem = {
  id: number;
  clientName: string | null;
  phone: string | null;
  desiredCourse: string | null;
  status: string | null;
  assigneeId: number | null;
};

export type ConsultationSearchToolOutput = {
  query: string;
  count: number;
  consultations: ConsultationSearchResultItem[];
};

export type StudentSummaryToolInput = {
  studentId: number;
};

export type StudentSummaryResult = {
  id: number;
  organizationId: number;

  clientName: string | null;
  phone: string | null;

  course: string | null;
  status: string | null;

  finalEducation: string | null;

  startDate: string | Date | null;

  paymentAmount:
    | string
    | number
    | null;

  paymentDate:
    | string
    | Date
    | null;

  subjectCount: number | null;

  institution: string | null;

  totalSemesters: number | null;

  approvalStatus: string | null;

  assigneeId: number | null;

  address: string | null;
  detailAddress: string | null;
};

export type StudentSummaryToolOutput = {
  student: StudentSummaryResult;
};

export type MissingDataAlertToolInput = {
  limit?: number;
};

export type MissingDataAlertItem = {
  type:
    | "student_payment_date_missing"
    | "student_payment_amount_missing"
    | "consultation_assignee_missing"
    | "practice_unassigned";

  studentId?: number;
  consultationId?: number;

  clientName?: string | null;
  assigneeId?: number | null;

  message: string;
};

export type MissingDataAlertToolOutput = {
  summary: {
    paymentDateMissingCount: number;
    paymentAmountMissingCount: number;
    consultationAssigneeMissingCount: number;
    practiceUnassignedCount: number;
    totalIssueCount: number;
  };

  items: MissingDataAlertItem[];
};

export type AiAuditPayload = {
  requestId: string;
  toolName: string;
  status: AiToolStatus;

  input?: unknown;
  outputSummary?: unknown;

  role: AiRole;
  scope: AiDataScope;
  teamId?: number | null;
  allowedAssigneeIds?: number[] | null;

  startedAt: string;
  finishedAt?: string;
  durationMs?: number;

  errorMessage?: string | null;
};

/**
 * 학생 상세 위험 분석
 */
export type StudentDetailRiskToolInput = {
  studentId: number;
};

export type StudentRiskSeverity =
  | "info"
  | "warning"
  | "danger";

export type StudentRiskCategory =
  | "student"
  | "payment"
  | "plan"
  | "credit"
  | "subject"
  | "practice";

export type StudentRiskItem = {
  code: string;

  severity: StudentRiskSeverity;
  category: StudentRiskCategory;

  title: string;
  message: string;

  /**
   * 위험을 판단할 때 참고한 값.
   * 개인정보 원문은 넣지 않는다.
   */
  details?: Record<
    string,
    string | number | boolean | null
  >;
};

export type StudentRiskSubjectItem = {
  source:
    | "plan"
    | "transfer"
    | "extra";

  sourceLabel: string;

  id: number | null;
  subjectName: string;

  requirementType: string | null;
  category: string | null;

  credits: number;

  semesterNo?: number | null;
};

export type StudentDetailRiskToolOutput = {
  student: {
    id: number;
    clientName: string | null;
    course: string | null;
    status: string | null;
    assigneeId: number | null;
  };

  summary: {
    riskLevel:
      | "normal"
      | "warning"
      | "danger";

    riskScore: number;

    totalIssueCount: number;
    dangerCount: number;
    warningCount: number;
    infoCount: number;

    /**
 * 중복 제외 후 실제 인정되는 과목 수
 */
totalSubjectCount: number;

/**
 * 중복 포함 DB에 등록된 전체 과목 건수
 */
registeredSubjectCount: number;

currentCredits: number;
    requiredCredits: number | null;
    remainingCredits: number | null;

    duplicateSubjectCount: number;
    practiceRequestCount: number;
  };

payment: {
  /**
   * missing:
   * 정산 데이터와 학생 기본 결제금액이 모두 없음
   *
   * not_confirmed:
   * 정산 항목은 있지만 확정 결제금액이 없음
   *
   * paid:
   * 정상 결제
   *
   * partial_refund:
   * 일부 금액 환불
   *
   * full_refund:
   * 결제금액 전액 환불
   *
   * refund_without_payment:
   * 원 결제 없이 환불만 존재
   */
  status:
    | "missing"
    | "not_confirmed"
    | "paid"
    | "partial_refund"
    | "full_refund"
    | "refund_without_payment";

  hasSettlementData: boolean;

  totalPaid: number;
  totalRefund: number;
  netPaymentAmount: number;

  paymentDate:
    | string
    | Date
    | null;
};

  categories: {
    majorRequired: {
      currentSubjects: number;
      currentCredits: number;
      requiredSubjects: number | null;
      requiredCredits: number | null;
      remainingSubjects: number | null;
      remainingCredits: number | null;
    };

    majorElective: {
      currentSubjects: number;
      currentCredits: number;
      requiredSubjects: number | null;
      requiredCredits: number | null;
      remainingSubjects: number | null;
      remainingCredits: number | null;
    };

    liberal: {
      currentSubjects: number;
      currentCredits: number;
      requiredSubjects: number | null;
      requiredCredits: number | null;
      remainingSubjects: number | null;
      remainingCredits: number | null;
    };

    general: {
      currentSubjects: number;
      currentCredits: number;
      requiredSubjects: number | null;
      requiredCredits: number | null;
      remainingSubjects: number | null;
      remainingCredits: number | null;
    };
  };

  issues: StudentRiskItem[];

  subjects: StudentRiskSubjectItem[];

  sourceStatus: {
    hasPlan: boolean;
    hasCreditRule: boolean;
    hasTransferSubjects: boolean;
    hasExtraCreditItems: boolean;
    hasPracticeRequest: boolean;
  };
};

/**
 * 권한 범위 내 학생 전체 위험 점검
 */
export type StudentListRiskToolInput = {
  /**
   * 한 번에 점검할 최대 학생 수
   *
   * 기본값: 30
   * 최대값: 100
   */
  limit?: number;

  /**
   * 결과에 포함할 위험등급
   *
   * all:
   * 정상, 주의, 위험 모두 반환
   *
   * danger:
   * 위험 학생만 반환
   *
   * warning:
   * 위험 또는 주의 학생 반환
   */
  riskLevel?:
    | "all"
    | "danger"
    | "warning";
};

export type StudentListRiskResultItem = {
  studentId: number;
  clientName: string | null;

  course: string | null;
  status: string | null;

  assigneeId: number | null;
  assigneeName: string | null;

  riskLevel:
    | "normal"
    | "warning"
    | "danger";

  riskScore: number;

  totalIssueCount: number;
  dangerCount: number;
  warningCount: number;
  infoCount: number;

  currentCredits: number;
  requiredCredits: number | null;
  remainingCredits: number | null;

  duplicateSubjectCount: number;
  practiceRequestCount: number;

paymentStatus:
  StudentDetailRiskToolOutput["payment"]["status"];

netPaymentAmount: number;

  issues: StudentRiskItem[];
};

export type StudentListRiskToolOutput = {
  summary: {
    /**
     * 현재 권한 범위에 존재하는 전체 학생 수
     */
    totalStudentCount: number;

    /**
     * 이번 요청에서 실제 점검한 학생 수
     */
    checkedStudentCount: number;

    /**
     * 점검 도중 오류가 발생한 학생 수
     */
    failedStudentCount: number;

    dangerStudentCount: number;
    warningStudentCount: number;
    normalStudentCount: number;

    totalIssueCount: number;

    /**
     * 위험항목 종류별 학생 수
     *
     * 동일 학생에게 같은 종류의 문제가 여러 개 있어도
     * 학생 수는 한 명으로 집계한다.
     */
    creditShortageStudentCount: number;
    duplicateSubjectStudentCount: number;
    practiceIssueStudentCount: number;
    missingCreditRuleStudentCount: number;
    missingPlanStudentCount: number;
    paymentIssueStudentCount: number;

/**
 * 결제·환불 상태별 학생 수
 */
paidStudentCount: number;
paymentMissingStudentCount: number;
paymentNotConfirmedStudentCount: number;
partialRefundStudentCount: number;
fullRefundStudentCount: number;
refundWithoutPaymentStudentCount: number;

/**
 * 이번 점검 대상 학생들의 실결제금액 합계
 *
 * 정산 데이터가 있는 경우:
 * 결제액 - 환불액
 *
 * 정산 데이터가 없는 경우:
 * 학생 기본 결제금액
 */
totalNetPaymentAmount: number;
  };

  /**
   * 실제 적용된 요청 조건
   */
  filter: {
    limit: number;
    riskLevel:
      | "all"
      | "danger"
      | "warning";
  };

  students: StudentListRiskResultItem[];

  /**
   * 특정 학생 분석 실패 내역
   *
   * 한 학생 분석 실패 때문에 전체 점검이 중단되지 않게 한다.
   */
  failures: Array<{
    studentId: number;
    clientName: string | null;
    message: string;
  }>;
};

/**
 * AI 문서 분석
 *
 * 성적증명서뿐 아니라 교육원 수강내역,
 * 결제내역, 홈페이지 캡처 등을 공통으로 분석한다.
 *
 * 1차에서는 분석 결과만 반환하며
 * DB에는 아무것도 저장하지 않는다.
 */

/**
 * 업로드된 문서의 종류
 */
export type AiDocumentType =
  | "university_transcript"
  | "education_enrollment"
  | "education_payment"
  | "education_enrollment_and_payment"
  | "unknown";

/**
 * AI가 추천하는 저장 위치
 *
 * 실제 저장 위치는 담당자가 최종 선택한다.
 */
export type AiDocumentTarget =
  | "plan"
  | "transfer"
  | "payment"
  | "plan_and_payment"
  | "analysis_only";

/**
 * 문서 분석 항목의 확인 상태
 *
 * extracted:
 * AI가 추출했지만 담당자가 확인하지 않은 상태
 *
 * confirmed:
 * 담당자가 원본과 비교하여 확인한 상태
 *
 * edited:
 * 담당자가 AI 추출값을 직접 수정한 상태
 */
export type AiDocumentFieldStatus =
  | "extracted"
  | "confirmed"
  | "edited";

/**
 * AI 문서 분석 신뢰도
 */
export type AiDocumentConfidenceLevel =
  | "high"
  | "medium"
  | "low";

/**
 * 문서에서 추출한 공통 값
 */
export type AiDocumentExtractedField<T> = {
  /**
   * AI가 추출한 값
   */
  value: T | null;

  /**
   * 0~1 사이 신뢰도
   */
  confidence: number;

  /**
   * 화면에 표시할 신뢰도 등급
   */
  confidenceLevel:
    AiDocumentConfidenceLevel;

  /**
   * 담당자 확인 상태
   *
   * 최초 분석 결과는 항상 extracted다.
   */
  status:
    AiDocumentFieldStatus;

  /**
   * 확인이 필요한 이유
   */
  warning: string | null;
};

/**
 * 문서에서 추출한 과목 한 건
 */
export type AiDocumentExtractedSubject = {
  /**
   * 화면에서 과목을 구분할 임시 ID
   *
   * DB ID가 아니다.
   */
  rowId: string;

  /**
   * 과목 포함 여부
   *
   * 담당자가 제외할 수 있다.
   */
  selected: boolean;

  subjectName:
    AiDocumentExtractedField<string>;

  credits:
    AiDocumentExtractedField<number>;

  grade:
    AiDocumentExtractedField<string>;

  category:
    AiDocumentExtractedField<
      | "전공"
      | "교양"
      | "일반"
    >;

  requirementType:
    AiDocumentExtractedField<
      | "전공필수"
      | "전공선택"
      | "교양"
      | "일반"
    >;

  /**
   * 전적대 또는 우리플랜의 학기 순번
   *
   * 문서에서 확인하지 못하면 null
   */
  semesterNo:
    AiDocumentExtractedField<number>;

  /**
   * 문서 원문에서 추출된 행
   *
   * 담당자가 AI 결과와 원본을 비교할 때 사용한다.
   */
  rawText: string | null;

  /**
   * 과목 단위 경고
   */
  warnings: string[];
};

/**
 * AI 문서 분석 요청
 *
 * 파일 자체는 라우터에서 별도 검증한다.
 */
export type AiDocumentAnalysisInput = {
  /**
   * 선택 학생
   *
   * 문서만 먼저 분석하는 경우 null 가능
   */
  studentId?: number | null;

  /**
   * 이미지 MIME 타입
   */
  mimeType:
    | "image/jpeg"
    | "image/png"
    | "image/webp";

  /**
   * 파일명
   */
  fileName: string;

  /**
   * data URL 접두사를 제거한 순수 Base64
   */
  imageBase64: string;
};

/**
 * AI 문서 분석 결과
 *
 * 이 결과 자체로 DB 저장을 실행하지 않는다.
 */
export type AiDocumentAnalysisResult = {
  /**
   * 분석 단위 고유 ID
   *
   * DB ID가 아니라 화면 추적용 ID다.
   */
  analysisId: string;

  documentType:
    AiDocumentType;

  documentTypeLabel: string;

  recommendedTarget:
    AiDocumentTarget;

  recommendedTargetLabel: string;

  /**
   * 문서 전체 분류 신뢰도
   */
  confidence: number;

  confidenceLevel:
    AiDocumentConfidenceLevel;

  /**
   * 문서 공통정보
   */
  institutionName:
    AiDocumentExtractedField<string>;

  studentName:
    AiDocumentExtractedField<string>;

  courseName:
    AiDocumentExtractedField<string>;

  semesterLabel:
    AiDocumentExtractedField<string>;

  startDate:
    AiDocumentExtractedField<string>;

  endDate:
    AiDocumentExtractedField<string>;

  paymentAmount:
    AiDocumentExtractedField<number>;

  paymentStatus:
    AiDocumentExtractedField<
      | "결제완료"
      | "결제예정"
      | "미결제"
      | "부분환불"
      | "전액환불"
      | "취소"
    >;

  paidAt:
    AiDocumentExtractedField<string>;

  /**
   * 추출된 과목 목록
   */
  subjects:
    AiDocumentExtractedSubject[];

  /**
   * AI가 읽은 원문
   *
   * 디버깅과 담당자 확인용이며
   * 1차에서는 DB에 저장하지 않는다.
   */
  rawText: string;

  /**
   * 문서 전체 경고
   */
  warnings: string[];

  /**
   * 담당자가 결정해야 하는 항목
   */
  requiredConfirmations: string[];

  /**
   * 분석 실행 시각
   */
  analyzedAt: string;
};

/**
 * 문서 분석 결과를 CRM에 반영하기 위한
 * Pending Action 초안
 *
 * 분석 결과 자체와 사용자가 선택한 반영 대상을
 * 함께 보관한다.
 *
 * 이 타입을 생성하는 단계에서는
 * 실제 CRM 데이터가 변경되지 않는다.
 */
export type AiDocumentImportDraft = {
  analysisId:
    string;

  studentId:
    number;

  documentType:
    AiDocumentType;

  target:
    AiDocumentTarget;

  actionType:
    | "document_transfer_import"
    | "document_plan_import"
    | "document_payment_import"
    | "document_plan_payment_import";

  institutionName:
    string | null;

  studentName:
    string | null;

  courseName:
    string | null;

  semesterLabel:
    string | null;

  startDate:
    string | null;

  endDate:
    string | null;

  paymentAmount:
    number | null;

  paymentStatus:
    string | null;

  paidAt:
    string | null;

  subjects:
    Array<{
      rowId:
        string;

      selected:
        boolean;

      subjectName:
        string;

      credits:
        number;

      grade:
        string | null;

      category:
        | "전공"
        | "교양"
        | "일반";

      requirementType:
        | "전공필수"
        | "전공선택"
        | "교양"
        | "일반";

      semesterNo:
        number | null;

      isConfirmed:
        boolean;

      rawText:
        string | null;

      warnings:
        string[];
    }>;

  warnings:
    string[];

  requiredConfirmations:
    string[];

  missingFields:
    string[];

  canConfirm:
    boolean;

  analyzedAt:
    string;

  createdAt:
    string;
};

/**
 * AI 등록·수정 승인 초안
 *
 * 삭제 작업은 지원하지 않는다.
 */
export type AiPendingActionType =
  | "student_registration_create"
  | "student_update"
  | "semester_create"
  | "semester_update"
  | "plan_create"
  | "plan_update"
  | "plan_subjects_create"
  | "plan_subjects_update"
  | "payment_update"
  | "practice_request_create"
  | "consultation_update"
  | "document_transfer_import"
  | "document_plan_import"
  | "document_payment_import"
  | "document_plan_payment_import";

export type AiPendingActionStatus =
  | "draft"
  | "awaiting_confirmation"
  | "executing"
  | "executed"
  | "cancelled"
  | "expired"
  | "failed";

export type AiPendingActionPreviewSection = {
  /**
   * 예:
   * 학생 기본정보
   * 1학기 예정표
   * 1학기 과목
   * 플랜요약
   */
  label: string;

  /**
   * 사용자에게 보여줄 항목
   */
  items: string[];
};

export type AiPendingActionPreviewChange = {
  /**
   * 수정 대상 필드명
   */
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
};

export type AiPendingActionPreview = {
  title: string;

  /**
   * 사용자에게 먼저 보여줄 작업 설명
   */
  summary: string;

  /**
   * 등록 예정 내용을 영역별로 모두 나열
   */
  sections: AiPendingActionPreviewSection[];

  /**
   * 수정 작업의 변경 전·후
   *
   * 신규 등록에서는 빈 배열을 사용한다.
   */
  changes: AiPendingActionPreviewChange[];

  /**
   * AI가 실제 실행할 순서
   */
  executionSteps: string[];

  /**
   * 값이 없어 실행할 수 없는 항목
   */
  missingFields: string[];

  /**
   * 중복, 과목 불확실, 일정 충돌 등의 경고
   */
  warnings: string[];

  /**
   * 모든 필수값이 확정돼 승인 가능한지 여부
   */
  canConfirm: boolean;
};

export type AiPendingActionResult = {
  id: number;

  actionType: AiPendingActionType;
  status: AiPendingActionStatus;

  consultationId: number | null;
  studentId: number | null;
  semesterId: number | null;

  preview: AiPendingActionPreview;

  version: number;

  expiresAt:
    | string
    | Date;

  confirmedAt:
    | string
    | Date
    | null;

  executedAt:
    | string
    | Date
    | null;
};

export type AiPendingActionConfirmInput = {
  pendingActionId: number;

  /**
   * 화면에 표시된 초안 버전
   */
  expectedVersion: number;
};

export type AiPendingActionCancelInput = {
  pendingActionId: number;

  expectedVersion: number;
};

export type AiPendingActionExecutionOutput = {
  pendingActionId: number;

  status:
    | "executed"
    | "failed";

  /**
   * 학생 통합등록 완료 후 생성된 학생 ID
   */
  studentId: number | null;

  /**
   * 생성된 학기 ID 목록
   */
  semesterIds: number[];

  /**
   * 실행 결과를 사용자에게 나열
   */
  completedSteps: string[];

  /**
   * 실패 또는 건너뛴 작업
   */
  failedSteps: string[];

  message: string;
};

/**
 * AI 학생 통합등록 초안
 *
 * 사용자가 입력한 문장, 상담DB 정보,
 * OCR 과목 정보를 하나의 등록 초안으로 정리한다.
 *
 * 이 타입 자체는 DB 저장을 실행하지 않는다.
 */
export type StudentRegistrationDraftStudent = {
  /**
   * 상담DB 원본 ID
   *
   * 상담DB에서 학생으로 전환하는 경우 사용한다.
   */
  consultationId: number | null;

  /**
   * 회원명
   */
  clientName: string;

  /**
   * 연락처
   */
  phone: string;

  /**
   * 담당자 ID
   *
   * 프론트 입력값을 신뢰하지 않고
   * 상담DB 또는 서버 Context에서 결정한다.
   */
  assigneeId: number;

  /**
   * 희망 과정
   *
   * 예:
   * 사회복지사 2급
   * 보육교사 2급
   */
  desiredCourse: string | null;

  /**
   * 최종학력
   *
   * 예:
   * 고졸
   * 전문대졸
   * 대졸
   */
  finalEducation: string | null;

 /**
 * students 테이블의 학생 상태
 *
 * students.status에는 등록예정을 사용하지 않는다.
 * AI 통합등록 생성 시 학생 상태는 "등록"으로 저장하고,
 * 승인 대기 여부는 approvalStatus = "대기"로 구분한다.
 *
 * 상담DB의 상태만 "등록예정"으로 변경한다.
 */
status: "등록";
};

/**
 * AI 학생 통합등록 학기 초안
 *
 * semesters 테이블에 들어갈 학기별 예정·실제 진행 정보다.
 */
export type StudentRegistrationDraftSemester = {
  /**
   * 학기 순번
   *
   * 예:
   * 1학기 = 1
   * 2학기 = 2
   */
  semesterNo: number;

  /**
   * 예정 시작 월
   *
   * 예:
   * 2026-09
   */
  plannedStartMonth: string | null;

  /**
   * 예정 교육원
   */
  plannedInstitution: string | null;

  /**
   * 예정 과목 수
   */
  plannedSubjectCount: number | null;

  /**
   * 예정 결제금액
   */
  plannedAmount: number | null;

  /**
   * 실제 개강일
   *
   * 예:
   * 2026-09-10
   */
  actualStartDate: string | null;

  /**
   * 실제 교육원
   */
  actualInstitution: string | null;

/**
 * 실제 등록 과목 수
 */
actualSubjectCount: number | null;

  /**
   * 실제 결제금액
   */
  actualPaymentAmount: number | null;

  /**
   * 실제 결제일
   *
   * 예:
   * 2026-08-25
   */
  paymentDate: string | null;

/**
 * 상세페이지의 학기 입력완료 여부
 *
 * 과정이 종료됐다는 의미가 아니다.
 * true가 되면 승인관리 대상에 노출된다.
 *
 * AI 등록 초안에서는 false로 생성하고,
 * 모든 필수 데이터 검증 및 저장이 끝난 마지막 단계에서
 * 서버 트랜잭션이 true로 변경한다.
 */
isCompleted: boolean;
};

/**
 * AI 학생 통합등록 플랜 초안
 *
 * plans 테이블에 들어갈 과정 전체 설계 정보다.
 */
export type StudentRegistrationDraftPlan = {
  /**
   * 과정명
   */
  courseName: string | null;

  /**
   * 최종학력
   */
  finalEducation: string | null;

  /**
   * 전체 이론 과목 수
   */
  totalTheorySubjects: number | null;

  /**
   * 실습 필요 여부
   */
  hasPractice: boolean | null;

  /**
   * 플랜 요약 문구
   *
   * 예:
   * 대졸 기준 이론 16과목과 실습 1과목을
   * 2학기로 진행합니다.
   */
  summaryText: string | null;
};

/**
 * AI가 생성할 우리플랜 과목
 *
 * 앞으로 학생이 이수해야 하는 과목이며
 * planSemesters 테이블에 저장한다.
 */
export type StudentRegistrationDraftPlanSubject = {
  semesterNo: number;

  subjectName: string;

  category:
    | "전공"
    | "교양"
    | "일반";

  requirementType:
    | "전공필수"
    | "전공선택"
    | "교양"
    | "일반";

  credits: number;

  /**
   * 과목 생성 근거
   *
   * message:
   * 사용자가 직접 지시문에 작성
   *
   * server:
   * 학점은행제 과정별 과목 기준에서 자동 생성
   */
  source:
    | "message"
    | "server";

  isConfirmed: boolean;
};

/**
 * 전적대 또는 기존 이수 과목
 *
 * 성적증명서 OCR에서 추출되며
 * transferSubjects 테이블에 저장한다.
 */
export type StudentRegistrationDraftTransferSubject = {
  /**
   * 전적대 학기 순번
   *
   * 성적증명서에서 학기를 확인하지 못하면 null
   */
  semesterNo: number | null;

  /**
   * 학교명
   */
  schoolName: string | null;

  subjectName: string;

  category:
    | "전공"
    | "교양"
    | "일반";

  requirementType:
    | "전공필수"
    | "전공선택"
    | "교양"
    | "일반";

  credits: number;

  source: "ocr";

  isConfirmed: boolean;
};

/**
 * 과목 중복검사 결과
 */
export type StudentRegistrationDuplicateSubject = {
  normalizedName: string;
  subjectName: string;

  sources: Array<
    | "plan"
    | "transfer"
  >;

  count: number;
};

/**
 * 학생 플랜의 실습 요청 초안
 */
export type StudentRegistrationDraftPractice = {
  /**
   * 실습 필요 여부
   */
  required: boolean;

  /**
   * 실습 요청 과정
   *
   * 예: 사회복지현장실습
   */
  courseName: string | null;

  /**
   * 실습 예정 학기
   */
  semesterNo: number | null;

  /**
   * 실습 예정 월
   *
   * 예: 2026-09
   */
  plannedMonth: string | null;

  /**
   * 실습 시간
   *
   * 예: 160
   */
  requiredHours: number | null;
};


/**
 * 학생 통합등록 전체 초안
 *
 * 실제 등록 전 사용자에게 보여줄
 * 서버 검증 완료 전 단계 데이터다.
 */
export type StudentRegistrationDraft = {
  /**
   * 상담DB 원본
   */
  consultationId: number | null;

  /**
   * 학생 기본정보
   */
  student: StudentRegistrationDraftStudent;

  /**
   * 과정 전체 플랜
   */
  plan: StudentRegistrationDraftPlan;

  /**
   * 학기별 예정 및 결제 정보
   */
  semesters: StudentRegistrationDraftSemester[];

  /**
 * 앞으로 수강할 우리플랜 과목
 */
planSubjects:
  StudentRegistrationDraftPlanSubject[];

/**
 * 성적증명서 OCR 또는 기존 이수 과목
 */
transferSubjects:
  StudentRegistrationDraftTransferSubject[];

/**
 * 우리플랜과 전적대 전체 중복과목 검사 결과
 */
duplicateSubjects:
  StudentRegistrationDuplicateSubject[];

/**
 * 실습 요청 초안
 */
practice:
  StudentRegistrationDraftPractice | null;

  /**
   * 사용자가 추가 입력해야 하는 필수값
   *
   * 예:
   * ["1학기 교육원", "결제일"]
   */
  missingFields: string[];

  /**
   * 실행은 가능하지만 사용자가 확인해야 하는 경고
   *
   * 예:
   * ["입력한 1학기 과목 수는 7개인데 OCR 과목은 6개입니다."]
   */
  warnings: string[];

  /**
   * 사용자 확인을 받을 수 있는 상태인지 여부
   */
  canConfirm: boolean;

  /**
   * 초안 생성 시각
   */
  createdAt: string;
};