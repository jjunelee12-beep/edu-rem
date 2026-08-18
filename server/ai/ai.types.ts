import type {
  UnifiedQualificationRequirements,
} from "./risk-rules/qualification-requirement-merger"; 

import type {
  QualificationSubjectPlannerResult,
} from "./risk-rules/qualification-subject-planner";

import type {
  QualificationSemesterPlannerResult,
} from "./risk-rules/qualification-semester-planner";

import type {
  AdministrativeTimelinePlannerResult,
} from "./risk-rules/administrative-timeline-planner";

import type {
  StudentAcademicSummaryResult,
} from "./risk-rules/student-academic-summary-resolver";

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

/**
 * AI가 현재 어떤 종류의 CRM 데이터를
 * 작업 대상으로 잡고 있는지 나타낸다.
 *
 * 예:
 * 김민수 학생을 조회한 뒤 실습 수정,
 * 민간자격증 요청, 일정 등록 등을 이어갈 때
 * 동일한 학생을 계속 유지하기 위해 사용한다.
 */
export type AiActiveTargetType =
  | "consultation"
  | "student"
  | "practice_request"
  | "private_certificate_request";

/**
 * 현재 AI가 진행 중인 업무 종류
 *
 * Staff / Admin / Host 모두 동일한 업무 종류를 사용한다.
 * 실제 접근 범위와 실행 권한만 서버 Context와
 * Executor에서 별도로 검사한다.
 */
export type AiWorkflowType =
  | "consultation_registration"
  | "consultation_update"
  | "student_detail_setup"
  | "student_update"
  | "semester_create"
  | "semester_update"
  | "semester_complete"
  | "plan_setup"
  | "plan_update"
  | "practice_create"
  | "practice_update"
  | "private_certificate_create"
  | "schedule_create"
  | "document_import";

/**
 * 현재 업무가 어느 단계까지 진행됐는지 나타낸다.
 */
export type AiWorkflowStep =
  | "idle"
  | "collecting_data"
  | "awaiting_target_selection"
  | "awaiting_document"
  | "awaiting_confirmation"
  | "executing"
  | "completed"
  | "failed";

/**
 * AI가 현재 작업 대상으로 선택한 CRM 데이터
 *
 * 학생을 한 번 선택하면 다른 학생이 명확하게
 * 지정되기 전까지 이 값이 유지된다.
 */
export type AiActiveTarget = {
  type:
    AiActiveTargetType;

  id:
    number;

  name:
    string |
    null;
};

/**
 * 현재 작업 대상과 연결된 CRM 데이터 ID
 *
 * 상담DB에서 등록예정 학생이 생성되면
 * consultationId와 studentId를 함께 유지할 수 있다.
 */
export type AiLinkedContext = {
  consultationId:
    number |
    null;

  studentId:
    number |
    null;

  practiceRequestId:
    number |
    null;

  privateCertificateRequestIds:
    number[];
};

/**
 * AI가 사용자에게 마지막으로 보여준
 * 실행 예정 작업
 *
 * 사용자가 "ㅇㅇ", "그렇게 해줘", "진행해줘"라고
 * 답했을 때 새로 내용을 추측하지 않고
 * 이 작업을 기준으로 승인 처리한다.
 */
export type AiLastPresentedAction = {
  actionId:
    string;

  actionType:
    string;

  targetType:
    AiActiveTargetType;

  targetId:
    number;

  payload:
    Record<
      string,
      unknown
    >;

  expiresAt:
    string;
};

/**
 * AI가 진행 중인 업무 상태
 */
export type AiWorkflowState = {
  type:
    AiWorkflowType |
    null;

  step:
    AiWorkflowStep;

  /**
   * 여러 대화에서 받은 값을 누적한다.
   *
   * 예:
   * 첫 메시지에서 학기정보,
   * 다음 메시지에서 결제정보,
   * 다음 메시지에서 실습정보를 받는 경우
   * 모두 이 draft에 누적한다.
   */
  draft:
    Record<
      string,
      unknown
    >;

  /**
   * 아직 사용자에게 받아야 하는 필드명
   *
   * 예:
   * ["address", "practiceDate"]
   */
  waitingFor:
    string[];
};

/**
 * 사용자별 AI 업무 세션
 *
 * 대화 메시지와 별도로 서버 DB에 저장한다.
 * 메시지 기록을 삭제해도 현재 작업 대상을
 * 유지할 수 있도록 별도 구조로 관리한다.
 */
export type AiWorkSession = {
  id:
    number |
    null;

  organizationId:
    number;

  userId:
    number;

  activeTarget:
    AiActiveTarget |
    null;

  linkedContext:
    AiLinkedContext;

  workflow:
    AiWorkflowState;

  lastPresentedAction:
    AiLastPresentedAction |
    null;

  /**
   * 동시에 여러 요청이 세션을 덮어쓰는 것을
   * 방지하기 위한 버전 번호
   */
  version:
    number;

  createdAt:
    string |
    null;

  updatedAt:
    string |
    null;
};

/**
 * AI Runner가 처리 결과와 함께 반환할
 * 업무 세션 일부 변경값
 *
 * 전체 세션을 매번 덮어쓰지 않고
 * 변경된 값만 서버에서 합치기 위해 사용한다.
 */
export type AiWorkSessionPatch = {
  activeTarget?:
    AiActiveTarget |
    null;

  linkedContext?:
    Partial<
      AiLinkedContext
    >;

  workflow?: {
    type?:
      AiWorkflowType |
      null;

    step?:
      AiWorkflowStep;

    /**
     * 기존 draft와 병합할 값
     */
    draftPatch?:
      Record<
        string,
        unknown
      >;

    /**
     * true이면 기존 draft를 전부 비운다.
     */
    clearDraft?:
      boolean;

    waitingFor?:
      string[];
  };

  lastPresentedAction?:
    AiLastPresentedAction |
    null;
};

/**
 * 사용자 메시지에서 새로운 작업 대상을
 * 찾은 결과
 */
export type AiTargetResolution =
  | {
      type:
        "keep_current";

      target:
        AiActiveTarget |
        null;
    }
  | {
      type:
        "switch_target";

      target:
        AiActiveTarget;
    }
  | {
      type:
        "selection_required";

      query:
        string;

      candidates:
        Array<{
          type:
            AiActiveTargetType;

          id:
            number;

          name:
            string |
            null;

          phoneLast4?:
            string |
            null;

          course?:
            string |
            null;

          assigneeName?:
            string |
            null;
        }>;
    }
  | {
      type:
        "target_not_found";

      query:
        string;
    };

export type AiToolName =
  | "student.search"
  | "student.summary"
  | "student.dashboard"
  | "consultation.search"
  | "consultation.create"
  | "consultation.update"
  | "alert.missingData"
  | "risk.studentDetail"
  | "risk.studentList"
  | "practice.institutionSearch"
  | "practice.supportStatus"
  | "error.recentList"
  | "error.detail"
    | "schedule.create"
  | "student.update"
    | "semester.create"
  | "semester.update"
    | "semester.complete"
  | "plan.create"
| "plan.update"
| "plan.subjects.create"
| "plan.subjects.update"
| "document.analysis"
| "settlement.summary"
| "staff.list"
| "staff.recommend"
| "staff.select_candidate";


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
positionName: string | null;
userHonorific: string;

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
 * AI 쓰기 Tool 진입 가능 여부
 *
 * Staff / Admin / Host:
 * true
 *
 * 단, true라고 해서 모든 데이터를 수정할 수 있는 것은 아니다.
 * 실제 수정 대상의 담당자 여부는 각 Executor에서 다시 검사한다.
 *
 * Superhost:
 * false
 *
 * Superhost는 선택 회사 데이터를 조회하고 점검할 수 있지만
 * CRM 데이터를 직접 변경할 수 없다.
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

/**
 * OpenAI Function Tool에서 사용하는
 * 개별 JSON Schema Property
 *
 * 기존 string / number / integer / boolean뿐 아니라
 * plan.subjects.create처럼 배열 안에 객체가 필요한
 * Tool도 안전하게 표현할 수 있도록 재귀 구조로 정의한다.
 */
export type AiToolJsonSchemaProperty = {
  type:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "array"
    | "object"
    | Array<
        | "string"
        | "number"
        | "integer"
        | "boolean"
        | "array"
        | "object"
        | "null"
      >;

  description?:
    string;

  enum?:
    Array<
      string |
      number |
      boolean |
      null
    >;

  minimum?:
    number;

  maximum?:
    number;

  /**
   * 배열 타입일 때 배열 안 요소 구조
   */
  items?:
    AiToolJsonSchemaProperty;

  /**
   * 객체 타입일 때 내부 Property 구조
   */
  properties?:
    Record<
      string,
      AiToolJsonSchemaProperty
    >;

  /**
   * 객체 내부 필수값
   */
  required?:
    string[];

  /**
   * 객체 내부에서도 정의되지 않은
   * 임의 필드를 허용하지 않는다.
   */
  additionalProperties?:
    false;
};

/**
 * OpenAI Function Tool에 전달할
 * 최상위 JSON Schema
 *
 * organizationId, userId, teamId, assigneeId 등
 * 서버 권한값은 Tool Schema에 절대로 넣지 않는다.
 */
export type AiToolInputSchema = {
  type:
    "object";

  properties:
    Record<
      string,
      AiToolJsonSchemaProperty
    >;

  required:
    string[];

  additionalProperties:
    false;
};

export type AiToolDefinition<
  TInput = unknown,
  TOutput = unknown
> = {
  name:
    AiToolName |
    string;

  description:
    string;

  /**
   * OpenAI Tool Calling 입력 구조
   *
   * AI가 생성해도 되는 값만 정의한다.
   * 권한 및 조직 범위 필드는 포함하지 않는다.
   */
  inputSchema?:
    AiToolInputSchema;

  accessMode:
    AiToolAccessMode;

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

/**
 * AI 상담 담당자 조회 / 추천 공용 타입
 *
 * 신규 상담에서 사용자가 상담 가능한 담당자를
 * 확인하거나 과정에 맞는 담당자를 추천받을 때 사용한다.
 *
 * organizationId, userId 등의 서버 권한값은
 * Tool 입력으로 받지 않는다.
 */

export type StaffConsultationStatus =
  | "available"
  | "busy"
  | "unavailable";

/**
 * AI에서 사용자에게 노출할 담당자 기본정보
 *
 * 내부 권한정보나 민감정보는 포함하지 않는다.
 */
export type StaffConsultationItem = {
  userId:
    number;

  name:
    string;

  positionName:
    string |
    null;

  teamName:
    string |
    null;

  profileImageUrl:
    string |
    null;

  introduction:
    string |
    null;

  specialties:
    string[];

  consultationStatus:
    StaffConsultationStatus;
};

/**
 * 상담 가능한 담당자 목록 조회
 */
export type StaffListToolInput = {
  /**
   * 한 번에 반환할 최대 담당자 수
   */
  limit?:
    number;
};

export type StaffListToolOutput = {
  count:
    number;

  staff:
    StaffConsultationItem[];

  generatedAt:
    string;
};

/**
 * 과정 또는 상담 조건에 따른 담당자 추천
 */
export type StaffRecommendToolInput = {
  /**
   * 상담 희망 과정
   *
   * 예:
   * 사회복지사 2급
   * 보육교사 2급
   * 한국어교원 2급
   */
  desiredCourse?:
    string |
    null;

  /**
   * 사용자가 담당자를 추천받으면서
   * 추가로 말한 상담 조건
   *
   * 예:
   * 실습 상담 잘하는 분
   * 보육교사 전문 담당자
   */
  query?:
    string |
    null;

  /**
   * 최대 추천 인원
   */
  limit?:
    number;
};

export type StaffRecommendationItem = {
  staff:
    StaffConsultationItem;

  /**
   * 추천 순위.
   * 1부터 시작한다.
   */
  rank:
    number;

  /**
   * 추천 근거.
   *
   * 서버에서 확인 가능한 담당자 정보만 사용한다.
   */
  reasons:
    string[];
};

export type StaffRecommendToolOutput = {
  desiredCourse:
    string |
    null;

  query:
    string |
    null;

  count:
    number;

  recommendations:
    StaffRecommendationItem[];

  generatedAt:
    string;
};

/**
 * 사용자가 이름 등으로 특정 담당자를 지목했을 때
 * 실제 담당자 후보를 찾기 위한 입력
 *
 * userId를 AI가 임의 생성하지 않고
 * 이름 또는 사용자 발화 기준으로 서버에서 후보를 찾는다.
 */
export type StaffSelectCandidateToolInput = {
  query:
    string;

  limit?:
    number;
};

export type StaffSelectCandidateToolOutput = {
  query:
    string;

  count:
    number;

  /**
   * 정확히 한 명으로 확정할 수 있는 경우 true
   */
  resolved:
    boolean;

  /**
   * resolved=true인 경우 확정된 후보.
   *
   * 동명이인 등으로 여러 명이면 null이다.
   */
  selectedCandidate:
    StaffConsultationItem |
    null;

  candidates:
    StaffConsultationItem[];
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

/**
 * AI 상담DB 신규등록 초안 입력
 *
 * 실제 consultations 테이블을 바로 생성하지 않는다.
 * 사용자에게 받은 신규 상담 정보를 검증하고
 * Pending Action에 저장할 초안만 생성한다.
 *
 * organizationId, assigneeId, requestedByUserId는
 * 서버 AI Context에서 결정한다.
 */
export type ConsultationCreateToolInput = {
  /**
   * 상담일
   *
   * YYYY-MM-DD 형식이다.
   * 생략하면 Tool 실행 시점의 날짜를 사용한다.
   */
  consultDate?:
    string |
    null;

  /**
   * 상담 유입 경로
   *
   * 생략하면 "AI 상담 등록"을 사용한다.
   */
  channel?:
    string |
    null;

  /**
   * 상담자 이름
   */
  clientName:
    string;

  /**
   * 상담자 연락처
   *
   * 하이픈 포함 여부와 관계없이
   * 숫자 10~11자리로 정규화한다.
   */
  phone:
    string;

  /**
   * 최종학력
   */
  finalEducation?:
    string |
    null;

  /**
   * 희망과정
   */
  desiredCourse?:
    string |
    null;

  /**
   * 상담내용
   */
  notes?:
    string |
    null;

  /**
   * 상담 상태
   *
   * 생략하면 상담중으로 생성한다.
   */
  status?:
    string |
    null;
};

/**
 * 상담DB 신규등록 Pending Action에 저장할 초안
 *
 * 담당자와 회사 정보는 포함하지 않는다.
 * 실제 실행 단계에서 로그인 사용자와
 * 서버 조직 정보를 기준으로 결정한다.
 */
export type ConsultationCreateDraft = {
  consultDate:
    string;

  channel:
    string;

  clientName:
    string;

  phone:
    string;

  finalEducation:
    string |
    null;

  desiredCourse:
    string |
    null;

  notes:
    string |
    null;

  status:
    string;

  requestedByUserId:
    number;

  requestedByRole:
    AiRole;

  createdAt:
    string;

  canConfirm:
    boolean;

  missingFields:
    string[];

  warnings:
    string[];
};

/**
 * consultation.create Tool 결과
 *
 * 이 결과가 반환돼도 상담DB는 아직 생성되지 않는다.
 * Pending Action 승인 후
 * consultation-create-executor에서 실제 생성한다.
 */
export type ConsultationCreateToolOutput = {
  pendingActionRequired:
    true;

  clientName:
    string;

  phone:
    string;

  draft:
    ConsultationCreateDraft;

  preview: {
    title:
      string;

    summary:
      string;

    sections:
      Array<{
        title:
          string;

        items:
          string[];
      }>;

    changes:
      Array<{
        field:
          string;

        label:
          string;

        before:
          null;

        after:
          string |
          null;
      }>;

    executionSteps:
      string[];

    missingFields:
      string[];

    warnings:
      string[];

    canConfirm:
      boolean;
  };
};

/**
 * AI 상담DB 수정 초안 입력
 *
 * 실제 consultations 테이블을 바로 수정하지 않는다.
 * 확정된 상담 ID와 변경할 값만 Tool에 전달한다.
 */
export type ConsultationUpdateToolInput = {
  consultationId:
    number;

  /**
   * 1차 허용 필드
   *
   * 담당자, 조직, 이름, 전화번호 등은
   * 이번 단계에서 수정하지 않는다.
   */
  status?:
    string |
    null;

  notes?:
    string |
    null;
};

export type ConsultationUpdateChange = {
  field:
    | "status"
    | "notes";

  label:
    string;

  before:
    string |
    null;

  after:
    string |
    null;
};

/**
 * consultation.update Tool 결과
 *
 * pendingActionRequired가 true여도
 * 아직 DB 변경은 실행되지 않은 상태다.
 */
export type ConsultationUpdateToolOutput = {
  pendingActionRequired:
    true;

  consultationId:
    number;

  clientName:
    string |
    null;

  phone:
    string |
    null;

  changes:
    ConsultationUpdateChange[];

  draft: {
    consultationId:
      number;

    clientName:
      string |
      null;

    /**
     * 초안 생성 당시 값이다.
     *
     * 실행 단계에서 현재 DB값과 다시 비교해
     * 다른 사용자가 먼저 수정했는지 검사한다.
     */
    originalValues: {
      status:
        string |
        null;

      notes:
        string |
        null;
    };

    updates: {
      status?:
        string |
        null;

      notes?:
        string |
        null;
    };

    requestedByUserId:
      number;

    requestedByRole:
      AiRole;

    createdAt:
      string;
  };

  preview: {
    title:
      string;

    summary:
      string;

    sections:
      Array<{
        title:
          string;

        items:
          string[];
      }>;

    changes:
      ConsultationUpdateChange[];

    executionSteps:
      string[];

    missingFields:
      string[];

    warnings:
      string[];

    canConfirm:
      boolean;
  };
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

/**
 * AI 학생 기본정보 수정 초안 입력
 *
 * 실제 students 테이블을 바로 수정하지 않는다.
 * 변경할 값만 전달하고 Tool에서 현재 값과 비교한다.
 *
 * 담당자, 회사, 승인상태 등 권한 관련 필드는
 * 이번 단계에서 수정하지 않는다.
 */
export type StudentUpdateToolInput = {
  studentId:
    number;

  status?:
    string |
    null;

  course?:
    string |
    null;

  address?:
    string |
    null;

  detailAddress?:
    string |
    null;
};

/**
 * AI 학생 수정이 허용하는 필드
 */
export type StudentUpdateField =
  | "status"
  | "course"
  | "address"
  | "detailAddress";

/**
 * 사용자 승인 화면에 표시할 변경 전·후
 */
export type StudentUpdateChange = {
  field:
    StudentUpdateField;

  label:
    string;

  before:
    string |
    null;

  after:
    string |
    null;
};

/**
 * Pending Action에 저장할 학생 수정 초안
 *
 * originalValues:
 * 초안 생성 당시 학생 값
 *
 * updates:
 * 실제 승인 후 변경할 값
 */
export type StudentUpdateDraft = {
  studentId:
    number;

  studentName:
    string |
    null;

  originalValues: {
    status:
      string |
      null;

    course:
      string |
      null;

    address:
      string |
      null;

    detailAddress:
      string |
      null;
  };

  updates: {
    status?:
      string |
      null;

    course?:
      string |
      null;

    address?:
      string |
      null;

    detailAddress?:
      string |
      null;
  };

  requestedByUserId:
    number;

  requestedByRole:
    AiRole;

  createdAt:
    string;
};

/**
 * student.update Tool 결과
 *
 * 이 결과가 생성돼도 아직 students 테이블은
 * 변경되지 않은 상태다.
 */
export type StudentUpdateToolOutput = {
  pendingActionRequired:
    true;

  studentId:
    number;

  studentName:
    string |
    null;

  changes:
    StudentUpdateChange[];

  draft:
    StudentUpdateDraft;

  preview: {
    title:
      string;

    summary:
      string;

    sections:
      Array<{
        title:
          string;

        items:
          string[];
      }>;

    changes:
      StudentUpdateChange[];

    executionSteps:
      string[];

    missingFields:
      string[];

    warnings:
      string[];

    canConfirm:
      boolean;
  };
};

/**
 * AI 실습배정지원 상태 조회 입력
 *
 * 학생 ID는 선택된 학생 또는
 * student.search를 통해 확정된 값만 사용한다.
 */
export type PracticeSupportStatusToolInput = {
  studentId:
    number;
};

/**
 * AI 실습기관 및 실습교육원 추천 입력
 *
 * 학생 주소에 저장된 위도·경도를 기준으로
 * 가까운 기관을 추천한다.
 *
 * organizationId와 권한 범위는 서버 Context에서 결정한다.
 */
export type PracticeInstitutionSearchToolInput = {
  /**
   * 선택된 학생 기준으로 검색할 경우 사용한다.
   *
   * 학생을 선택하지 않고 주소 기준으로
   * 검색하는 경우 null 또는 생략할 수 있다.
   */
  studentId?:
    number |
    null;

  /**
   * 학생을 선택하지 않은 상태에서
   * 직접 검색할 위치 주소다.
   */
  address?:
    string |
    null;

  /**
   * 실습기관 / 실습교육원 각각의
   * 최대 추천 개수다.
   */
  limit?:
    number |
    null;
};

/**
 * 실습기관 또는 실습교육원 추천 항목
 */
export type PracticeInstitutionSearchResultItem = {
  id:
    number;

  sourceType:
    string |
    null;

  masterId:
    number |
    null;

  name:
    string |
    null;

  phone:
    string |
    null;

  address:
    string |
    null;

  detailAddress:
    string |
    null;

  latitude:
    string |
    number |
    null;

  longitude:
    string |
    number |
    null;

  distanceKm:
    number;

  price:
    string |
    number |
    null;

  availableCourse:
    string |
    null;

  selectionStatus:
    string |
    null;

  selectionValidFrom:
    string |
    Date |
    null;

  selectionValidTo:
    string |
    Date |
    null;

  practiceAvailabilityType:
    string |
    null;

  isInactive:
    boolean;

  inactiveReason:
    string |
    null;

  memo:
    string |
    null;
};

/**
 * AI 실습기관 및 실습교육원 추천 결과
 */
export type PracticeInstitutionSearchToolOutput = {
  /**
   * 학생 기준 검색이면 학생 정보가 들어가고,
   * 직접 주소 검색이면 null이다.
   */
  student:
    | {
        id:
          number;

        clientName:
          string |
          null;

        course:
          string |
          null;

        address:
          string |
          null;

        detailAddress:
          string |
          null;

        latitude:
          number |
          null;

        longitude:
          number |
          null;

        assigneeId:
          number |
          null;
      }
    | null;

  /**
   * 직접 입력 주소 기준 검색일 때
   * 실제 좌표 변환된 검색 위치다.
   *
   * 학생 기준 검색에서는 null이다.
   */
  searchLocation:
    | {
        address:
          string;

        latitude:
          number |
          null;

        longitude:
          number |
          null;
      }
    | null;

  /**
   * 어떤 기준으로 추천했는지 표시한다.
   */
  searchMode:
    | "student"
    | "address";

  institutions:
    PracticeInstitutionSearchResultItem[];

  educationCenters:
    PracticeInstitutionSearchResultItem[];

  summary: {
    institutionCount:
      number;

    educationCenterCount:
      number;

    nearestInstitutionDistanceKm:
      number |
      null;

    nearestEducationCenterDistanceKm:
      number |
      null;
  };

  generatedAt:
    string;
};

/**
 * 학생에게 등록된 개별 실습배정지원 요청
 */
export type PracticeSupportStatusRequestItem = {
  id:
    number;

  studentId:
    number;

  semesterId:
    number |
    null;

  semesterOrder:
    number;

  clientName:
    string |
    null;

  course:
    string |
    null;

  assigneeId:
    number |
    null;

  assigneeName:
    string |
    null;

  managerName:
    string |
    null;

  practiceHours:
    number |
    null;

  practiceDate:
    string |
    null;

  coordinationStatus:
    string;

  paymentStatus:
    string;

  feeAmount:
    string |
    number;

  selectedEducationCenter: {
    id:
      number |
      null;

    name:
      string |
      null;

    address:
      string |
      null;

    distanceKm:
      string |
      number |
      null;
  };

  selectedPracticeInstitution: {
    id:
      number |
      null;

    name:
      string |
      null;

    address:
      string |
      null;

    distanceKm:
      string |
      number |
      null;
  };

  note:
    string |
    null;

  createdAt:
    string |
    Date |
    null;

  updatedAt:
    string |
    Date |
    null;
};

/**
 * AI 실습배정지원 상태 조회 결과
 */
export type PracticeSupportStatusToolOutput = {
  student: {
    id:
      number;

    clientName:
      string |
      null;

    course:
      string |
      null;

    assigneeId:
      number |
      null;
  };

  hasRequest:
    boolean;

  requestCount:
    number;

  latestRequest:
    PracticeSupportStatusRequestItem |
    null;

  requests:
    PracticeSupportStatusRequestItem[];

  summary: {
    coordinationStatus:
      string;

    paymentStatus:
      string;

    educationCenterSelected:
      boolean;

    practiceInstitutionSelected:
      boolean;

    practiceHours:
      number |
      null;

    practiceDate:
      string |
      null;
  };

  generatedAt:
    string;
};

/**
 * 학생 종합 업무 현황 조회
 *
 * 학생 기본정보뿐만 아니라
 * 학기, 과목, 학점, 결제, 실습,
 * 누락정보, 위험요소 및 다음 업무를
 * 한 번에 조회하기 위한 AI Tool 타입이다.
 */
export type StudentDashboardToolInput = {
  studentId: number;
};

export type StudentDashboardSemesterItem = {
  id: number;

  semesterNo: number | null;

  plannedStartMonth: string | null;
  plannedInstitution: string | null;

  actualStartDate:
    | string
    | Date
    | null;

  actualInstitution: string | null;

  plannedSubjectCount: number | null;

  plannedAmount:
    | number
    | string
    | null;

  actualPaymentAmount:
    | number
    | string
    | null;

  paymentDate:
    | string
    | Date
    | null;
};

export type StudentDashboardSubjectItem = {
  id: number | null;

  source:
    | "plan"
    | "transfer"
    | "extra";

  sourceLabel: string;

  subjectName: string;

  requirementType: string | null;
  category: string | null;

  credits: number;

  semesterNo: number | null;

  isConfirmed: boolean | null;
};

export type StudentDashboardPracticeItem = {
  id: number;

  status: string | null;

  coordinationStatus: string | null;
  paymentStatus: string | null;

  institutionName: string | null;
  institutionAddress: string | null;
  institutionPhone: string | null;

  plannedStartDate:
    | string
    | Date
    | null;

  plannedEndDate:
    | string
    | Date
    | null;

  feeAmount:
    | number
    | string
    | null;

  createdAt:
    | string
    | Date
    | null;
};

export type StudentDashboardScheduleItem = {
  id:
    number;

  studentId:
    number |
    null;

  title:
    string;

  description:
    string |
    null;

  scheduleDate:
    | string
    | Date
    | null;

  startAt:
    | string
    | Date
    | null;

  meridiem:
    string |
    null;

  hour12:
    number |
    null;

  minute:
    number |
    null;

  scope:
    string |
    null;

  ownerUserId:
    number |
    null;

  ownerUserName:
    string |
    null;

  isNotified:
    boolean;
};

export type StudentDashboardNextAction = {
  code: string;

  priority:
    | "low"
    | "medium"
    | "high";

  title: string;
  message: string;

  source:
    | "student"
    | "semester"
    | "subject"
    | "credit"
    | "payment"
    | "practice"
    | "schedule"
    | "risk";
};

export type StudentDashboardToolOutput = {
  student: StudentSummaryResult;

  semesters: StudentDashboardSemesterItem[];

  subjects: {
    plan: StudentDashboardSubjectItem[];
    transfer: StudentDashboardSubjectItem[];
    extra: StudentDashboardSubjectItem[];

    recognized: StudentDashboardSubjectItem[];
    duplicates: StudentDashboardSubjectItem[];
  };

  creditSummary: {
    registeredSubjectCount: number;
    recognizedSubjectCount: number;

    currentCredits: number;

    requiredCredits: number | null;
    remainingCredits: number | null;

    duplicateSubjectCount: number;
  };

  paymentSummary: {
    plannedAmount: number;
    paidAmount: number;
    refundedAmount: number;
    actualPaidAmount: number;

    paymentStatus: string | null;
    paymentDate:
      | string
      | Date
      | null;
  };

  practice: {
    required: boolean | null;

    requestCount: number;

    latestRequest:
      | StudentDashboardPracticeItem
      | null;

    requests:
      StudentDashboardPracticeItem[];
  };

  schedules: StudentDashboardScheduleItem[];

  missingFields: string[];

  risk: {
    riskLevel:
      | "normal"
      | "warning"
      | "danger";

    riskScore: number;

    totalIssueCount: number;

    items: StudentRiskItem[];
  };

  nextActions: StudentDashboardNextAction[];

  generatedAt: string;
};

/**
 * 기존 학생의 학기 생성 승인 초안 입력
 *
 * 실제 semesters 테이블을 바로 수정하지 않는다.
 * AI Tool에서는 사용자 요청을 검증하고
 * Pending Action에 저장할 초안만 생성한다.
 *
 * organizationId, userId, assigneeId는
 * 서버 AI Context와 학생 원본에서 결정한다.
 */
export type SemesterCreateToolInput = {
  /**
   * 학기를 생성할 확정된 학생 ID
   */
  studentId:
    number;

   /**
   * 학생 상세페이지에서 표시되는 학기 순서
   *
   * 생략하면 서버에서 기존 마지막 학기 다음 순서로
   * 자동 계산한다.
   *
   * 사용자가 명시한 경우에도 서버 계산 결과와
   * 일치하는지 다시 검증한다.
   *
   * 예:
   * 기존 마지막 학기 = 2
   * 신규 학기 순서 = 3
   */
  semesterOrder?:
    number;

      /**
   * 학기 구분
   *
   * 기존 학기가 있으면 마지막 학기 구분을 기준으로
   * 다음 학기를 서버에서 자동 계산한다.
   *
   * 기존 학기가 하나도 없는 첫 학기 생성 시에는
   * 자동 계산 기준이 없으므로 반드시 입력해야 한다.
   *
   * 예:
   * 2026년 1학기
   * 2026년 2학기
   */
  semesterLabel?:
    string |
    null;

  /**
   * 예정 개강월
   *
   * YYYYMM 형식
   *
   * 예:
   * 202608
   */
  plannedMonth?:
    string |
    null;

  /**
   * 예정 교육원
   */
  plannedInstitution?:
    string |
    null;

  /**
   * 예정 과목 수
   */
  plannedSubjectCount?:
    number |
    null;

  /**
   * 예정 결제금액
   */
  plannedAmount?:
    number |
    null;

  /**
   * 실제 개강일
   *
   * YYYY-MM-DD
   */
  startDate?:
    string |
    null;

  /**
   * 실제 교육원
   */
  institution?:
    string |
    null;

  /**
   * 실제 과목 수
   */
  subjectCount?:
    number |
    null;

  /**
   * 실제 결제금액
   */
  paymentAmount?:
    number |
    null;

  /**
   * 결제일
   *
   * YYYY-MM-DD
   */
  paymentDate?:
    string |
    null;
};

/**
 * AI 학기 생성 승인 초안
 *
 * 초안 생성 당시 학생과 기존 학기 상태를 저장한다.
 * 승인 실행 시 현재 DB 상태와 다시 비교하여
 * 중복 학기 또는 동시 수정 여부를 검사한다.
 */
export type SemesterCreateDraft = {
  studentId:
    number;

  studentName:
    string |
    null;

  /**
   * 초안 생성 당시 학생 담당자
   *
   * 프론트 입력값이 아니라
   * 서버에서 조회한 학생 원본 기준이다.
   */
  assigneeId:
    number;

  semesterOrder:
    number;

  semesterLabel:
    string;

  plannedMonth:
    string |
    null;

  plannedInstitution:
    string |
    null;

  plannedSubjectCount:
    number |
    null;

  plannedAmount:
    number |
    null;

  startDate:
    string |
    null;

  institution:
    string |
    null;

  subjectCount:
    number |
    null;

  paymentAmount:
    number |
    null;

  paymentDate:
    string |
    null;

    /**
   * 초안 생성 당시 해당 학생의 마지막 학기 순서
   *
   * 승인 실행 전에 다시 조회하여
   * 다른 사용자가 먼저 학기를 추가했는지 확인한다.
   */
  originalLastSemesterOrder:
    number;

  /**
   * 초안 생성 당시 해당 학생의 마지막 학기 구분
   *
   * 기존 학기가 없는 첫 학기 생성 초안은 null이다.
   *
   * 승인 실행 시 현재 마지막 학기 구분과 다시 비교하여
   * 학기 구분이 변경된 오래된 초안의 실행을 차단한다.
   */
  originalLastSemesterLabel:
    string |
    null;

  requestedByUserId:
    number;

  requestedByRole:
    AiRole;

  createdAt:
    string;
};

/**
 * semester.create Tool 결과
 *
 * pendingActionRequired가 true여도
 * 실제 학기는 아직 생성되지 않은 상태다.
 */
export type SemesterCreateToolOutput = {
  pendingActionRequired:
    true;

  studentId:
    number;

  studentName:
    string |
    null;

  semesterOrder:
    number;

  semesterLabel:
    string;

  draft:
    SemesterCreateDraft;

  preview:
    AiPendingActionPreview;
};

/**
 * 기존 학생 학기 수정 요청
 *
 * 실제 semesters 테이블을 바로 수정하지 않는다.
 * Pending Action 승인 후 Executor가 수정한다.
 */
export type SemesterUpdateToolInput = {
  studentId:
    number;

  semesterOrder:
    number;

  semesterLabel?:
    string |
    null;

  plannedMonth?:
    string |
    null;

  plannedInstitution?:
    string |
    null;

  plannedSubjectCount?:
    number |
    null;

  plannedAmount?:
    number |
    null;

  actualStartDate?:
    string |
    null;

  actualInstitution?:
    string |
    null;

  actualSubjectCount?:
    number |
    null;

  actualAmount?:
    number |
    null;

  actualPaymentDate?:
    string |
    null;
};

export type SemesterUpdateOriginalValues = {
  updatedAt:
    string |
    Date |
    null;

  semesterLabel:
    string |
    null;

  plannedMonth:
    string |
    null;

  plannedInstitution:
    string |
    null;

  plannedSubjectCount:
    number |
    null;

  plannedAmount:
    string |
    number |
    null;

  actualStartDate:
    string |
    Date |
    null;

  actualInstitution:
    string |
    null;

  actualInstitutionId:
    number |
    null;

  actualSubjectCount:
    number |
    null;

  actualAmount:
    string |
    number |
    null;

  actualPaymentDate:
    string |
    Date |
    null;

  isCompleted:
    boolean;

  approvalStatus:
    string |
    null;
};

export type SemesterUpdateValues = {
  semesterLabel?:
    string |
    null;

  plannedMonth?:
    string |
    null;

  plannedInstitution?:
    string |
    null;

  plannedSubjectCount?:
    number |
    null;

  plannedAmount?:
    number |
    null;

  actualStartDate?:
    string |
    null;

  actualInstitution?:
    string |
    null;

  actualSubjectCount?:
    number |
    null;

  actualAmount?:
    number |
    null;

  actualPaymentDate?:
    string |
    null;
};

export type SemesterUpdateChange = {
  field:
    keyof SemesterUpdateValues;

  label:
    string;

  before:
    string |
    number |
    null;

  after:
    string |
    number |
    null;
};

export type SemesterUpdateDraft = {
  studentId:
    number;

  studentName:
    string |
    null;

  assigneeId:
    number;

  semesterId:
    number;

  semesterOrder:
    number;

  originalValues:
    SemesterUpdateOriginalValues;

  updates:
    SemesterUpdateValues;

  requestedByUserId:
    number;

  requestedByRole:
    AiRole;

  createdAt:
    string;
};

export type SemesterUpdateToolOutput = {
  pendingActionRequired:
    true;

  studentId:
    number;

  studentName:
    string |
    null;

  semesterId:
    number;

  semesterOrder:
    number;

  semesterLabel:
    string |
    null;

  changes:
    SemesterUpdateChange[];

  draft:
    SemesterUpdateDraft;

  preview:
    AiPendingActionPreview;
};

/**
 * 기존 학생 학기의 입력완료 요청
 *
 * 실제 semesters 테이블을 바로 수정하지 않는다.
 * 서버에서 대상 학생과 학기를 조회한 뒤
 * 승인 가능한 초안만 생성한다.
 *
 * organizationId, userId, assigneeId는
 * 서버 AI Context와 DB 원본에서 결정한다.
 */
export type SemesterCompleteToolInput = {
  /**
   * 입력완료 처리할 학생 ID
   */
  studentId:
    number;

  /**
   * 입력완료 처리할 학기 순서
   *
   * 예:
   * 1학기 = 1
   * 2학기 = 2
   */
  semesterOrder:
    number;
};

/**
 * 학기 입력완료 초안 생성 당시의 원본값
 *
 * 승인 실행 시 현재 DB값과 다시 비교하여
 * 다른 사용자가 먼저 수정하거나 승인 요청을
 * 처리한 오래된 초안의 실행을 차단한다.
 */
export type SemesterCompleteOriginalValues = {
  /**
   * 초안 생성 당시 학기 수정 시각
   *
   * DB에서 updatedAt을 제공하지 않는 경우
   * null로 저장하고 개별 필드를 비교한다.
   */
  updatedAt:
    string |
    Date |
    null;

  isCompleted:
    boolean;

  approvalStatus:
    string |
    null;

  semesterLabel:
    string |
    null;

  actualStartDate:
    string |
    Date |
    null;

  actualInstitution:
    string |
    null;

  actualInstitutionId:
    number |
    null;

  actualSubjectCount:
    number |
    null;

  actualAmount:
    string |
    number |
    null;

  actualPaymentDate:
    string |
    Date |
    null;
};

/**
 * 학기 입력완료 Pending Action에 저장할 초안
 *
 * 실제 승인 시 Executor가 학생, 학기, 플랜,
 * 과목 및 담당자 권한을 모두 다시 검사한다.
 */
export type SemesterCompleteDraft = {
  studentId:
    number;

  studentName:
    string |
    null;

  /**
   * 초안 생성 당시 학생 담당자
   */
  assigneeId:
    number;

  semesterId:
    number;

  semesterOrder:
    number;

  semesterLabel:
    string |
    null;

  /**
   * 해당 학기의 실제 과목 수
   */
  actualSubjectCount:
    number;

  /**
   * 해당 학기에 등록된 우리플랜 과목 수
   */
  planSubjectCount:
    number;

  actualStartDate:
    string;

  actualInstitution:
    string;

  actualAmount:
    number;

  actualPaymentDate:
    string;

  /**
   * 입력완료 처리 후 적용할 값
   */
  updates: {
    isCompleted:
      true;

    approvalStatus:
      "대기";
  };

  /**
   * 승인 시 동시 수정 여부 확인에 사용한다.
   */
  originalValues:
    SemesterCompleteOriginalValues;

  requestedByUserId:
    number;

  requestedByRole:
    AiRole;

  createdAt:
    string;
};

/**
 * semester.complete Tool 결과
 *
 * 이 결과가 반환돼도 아직 입력완료 처리는
 * 실행되지 않은 상태다.
 */
export type SemesterCompleteToolOutput = {
  pendingActionRequired:
    true;

  studentId:
    number;

  studentName:
    string |
    null;

  semesterId:
    number;

  semesterOrder:
    number;

  semesterLabel:
    string |
    null;

  draft:
    SemesterCompleteDraft;

  preview:
    AiPendingActionPreview;
};

export type ScheduleCreateToolInput = {
  /**
   * 선택된 학생이 있거나
   * student.search로 학생 ID가 확정된 경우 사용한다.
   */
  studentId:
    number;

  /**
   * 사용자 확인 화면에 표시할 학생명이다.
   *
   * 권한검사에는 사용하지 않는다.
   * 실제 학생 정보는 서버에서 다시 조회한다.
   */
  studentName?:
    string |
    null;

  title:
    string;

  description?:
    string |
    null;

  /**
   * YYYY-MM-DD
   */
  scheduleDate:
    string;

  meridiem:
    | "AM"
    | "PM";

  hour12:
    number;

  minute:
    number;

  /**
 * 회사 공용 일정 여부
 *
 * Staff/Admin:
 * false만 허용한다.
 *
 * Host:
 * true를 사용할 수 있다.
 *
 * Superhost:
 * 일정 초안과 실제 일정 등록을 모두 사용할 수 없다.
 */
isGlobal?:
  boolean;
};

/**
 * AI 학생 플랜 요약 생성 초안 입력
 *
 * 실제 plans 테이블을 바로 생성하지 않는다.
 * 확정된 학생 ID와 사용자가 명확하게 제공한
 * 플랜 요약값만 전달한다.
 *
 * organizationId, userId, assigneeId는
 * 서버 Context와 학생 원본에서 결정한다.
 */
export type PlanCreateToolInput = {
  /**
   * 플랜을 생성할 확정된 학생 ID
   */
  studentId:
    number;

  /**
   * 희망 과정
   *
   * 사용자가 명확하게 말하지 않았다면
   * AI가 임의로 생성하지 않는다.
   */
  desiredCourse?:
    string |
    null;

  /**
   * 최종학력
   */
    finalEducation?:
    string |
    null;

  /**
   * 실습 필요 여부
   *
   * true:
   * 실습이 필요한 과정
   *
   * false:
   * 실습이 필요하지 않은 과정
   *
   * 사용자 또는 기존 확정 데이터에서
   * 명확하게 확인된 경우에만 전달한다.
   */
  hasPractice?:
    boolean |
    null;

  /**
   * 플랜 전체 이론 과목 수
   */
  totalTheorySubjects?:
    number |
    null;

  /**
   * 전공필수 과목 수
   */
  requiredMajorCount?:
    number |
    null;

  /**
   * 전공선택 과목 수
   */
  electiveMajorCount?:
    number |
    null;

  /**
   * 교양 과목 수
   */
  liberalCount?:
    number |
    null;

  /**
   * 일반 과목 수
   */
  generalCount?:
    number |
    null;
};

/**
 * plan.create Pending Action에 저장할
 * 플랜 생성 초안
 *
 * 실제 plans 테이블에는 아직 반영되지 않는다.
 */
export type PlanCreateDraft = {
  studentId:
    number;

  studentName:
    string |
    null;

  /**
   * 초안 생성 당시 학생 담당자
   *
   * 승인 실행 시 담당자가 바뀌었는지
   * 다시 확인하기 위해 저장한다.
   */
  assigneeId:
    number;

  desiredCourse:
    string |
    null;

    finalEducation:
    string |
    null;

  hasPractice:
    boolean;

  totalTheorySubjects:
    number;

  requiredMajorCount:
    number;

  electiveMajorCount:
    number;

  liberalCount:
    number;

  generalCount:
    number;

  /**
   * 플랜 생성 초안 당시
   * 기존 플랜이 없었다는 사실을
   * 승인 실행 단계에서 다시 검증한다.
   */
  originalPlanExists:
    false;

  requestedByUserId:
    number;

  requestedByRole:
    AiRole;

  createdAt:
    string;
};

/**
 * plan.create Tool 결과
 *
 * pendingActionRequired가 true여도
 * 실제 plans 테이블은 아직 생성되지 않는다.
 */
export type PlanCreateToolOutput = {
  pendingActionRequired:
    true;

  studentId:
    number;

  studentName:
    string |
    null;

  draft:
    PlanCreateDraft;

  preview:
    AiPendingActionPreview;
};

/**
 * AI 기존 학생 플랜 요약 수정 입력
 *
 * 실제 plans 테이블을 바로 수정하지 않는다.
 * 사용자가 변경하려고 명확하게 지정한 값만 전달한다.
 *
 * organizationId / userId / assigneeId / planId는
 * 서버 Context와 현재 DB에서 결정한다.
 */
export type PlanUpdateToolInput = {
  /**
   * 수정할 플랜의 확정된 학생 ID
   */
  studentId:
    number;

  /**
   * 희망 과정 수정
   */
  desiredCourse?:
    string |
    null;

  /**
   * 최종학력 수정
   */
  finalEducation?:
    string |
    null;

  /**
   * 실습 필요 여부 수정
   *
   * 실습 세부정보 자체는
   * 별도 실습 Workflow에서 관리한다.
   */
  hasPractice?:
    boolean;

  /**
   * 전체 이론 과목 수 수정
   */
  totalTheorySubjects?:
    number;

  /**
   * 전공필수 과목 수 수정
   */
  requiredMajorCount?:
    number;

  /**
   * 전공선택 과목 수 수정
   */
  electiveMajorCount?:
    number;

  /**
   * 교양 과목 수 수정
   */
  liberalCount?:
    number;

  /**
   * 일반 과목 수 수정
   */
  generalCount?:
    number;
};

/**
 * AI가 수정할 수 있는
 * 플랜 요약 필드
 */
export type PlanUpdateField =
  | "desiredCourse"
  | "finalEducation"
  | "hasPractice"
  | "totalTheorySubjects"
  | "requiredMajorCount"
  | "electiveMajorCount"
  | "liberalCount"
  | "generalCount";

/**
 * 사용자 승인 화면에 표시할
 * 플랜 변경 전 / 후 값
 */
export type PlanUpdateChange = {
  field:
    PlanUpdateField;

  label:
    string;

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

/**
 * 플랜 수정 초안 생성 당시
 * DB 원본값
 *
 * 승인 실행 시 현재 DB와 다시 비교하여
 * 다른 사용자가 먼저 플랜을 수정했는지 검사한다.
 */
export type PlanUpdateOriginalValues = {
  planId:
    number;

  desiredCourse:
    string |
    null;

  finalEducation:
    string |
    null;

  hasPractice:
    boolean;

  totalTheorySubjects:
    number;

  requiredMajorCount:
    number;

  electiveMajorCount:
    number;

  liberalCount:
    number;

  generalCount:
    number;
};

/**
 * 실제 승인 후 적용할 플랜 수정값
 *
 * 사용자가 요청한 필드만 존재한다.
 */
export type PlanUpdateValues = {
  desiredCourse?:
    string |
    null;

  finalEducation?:
    string |
    null;

  hasPractice?:
    boolean;

  totalTheorySubjects?:
    number;

  requiredMajorCount?:
    number;

  electiveMajorCount?:
    number;

  liberalCount?:
    number;

  generalCount?:
    number;
};

/**
 * plan_update Pending Action에 저장할
 * 플랜 수정 승인 초안
 */
export type PlanUpdateDraft = {
  studentId:
    number;

  studentName:
    string |
    null;

  /**
   * 현재 plans 테이블의 플랜 ID
   */
  planId:
    number;

  /**
   * 초안 생성 당시 학생 담당자
   *
   * 승인 실행 시 현재 담당자와
   * 다시 비교한다.
   */
  assigneeId:
    number;

  /**
   * 초안 생성 당시 플랜 원본
   */
  originalValues:
    PlanUpdateOriginalValues;

  /**
   * 승인 시 실제 적용할 변경값
   */
  updates:
    PlanUpdateValues;

  requestedByUserId:
    number;

  requestedByRole:
    AiRole;

  createdAt:
    string;
};

/**
 * plan.update Tool 결과
 *
 * pendingActionRequired = true여도
 * plans 테이블은 아직 변경되지 않는다.
 */
export type PlanUpdateToolOutput = {
  pendingActionRequired:
    true;

  studentId:
    number;

  studentName:
    string |
    null;

  planId:
    number;

  changes:
    PlanUpdateChange[];

  draft:
    PlanUpdateDraft;

  preview:
    AiPendingActionPreview;
};

/**
 * AI 우리플랜 과목 생성 입력
 *
 * 한 번의 승인 초안에서
 * 여러 학기 / 여러 과목을 함께 등록할 수 있다.
 *
 * 실제 planSemesters 테이블에는
 * Tool 실행 시점에 바로 저장하지 않는다.
 */
export type PlanSubjectsCreateToolInput = {
  /**
   * 과목을 등록할 확정된 학생 ID
   */
  studentId:
    number;

  /**
   * 등록할 우리플랜 과목 목록
   */
  subjects:
    Array<{
      /**
       * 몇 번째 학기에 배치할지
       *
       * 예:
       * 1학기 -> 1
       * 2학기 -> 2
       */
      semesterNo:
        number;

      /**
       * 실제 과목명
       */
      subjectName:
        string;

      /**
       * 플랜 화면의 큰 분류
       *
       * 전공필수/전공선택은
       * planCategory = "전공"
       */
      planCategory:
        "전공" |
        "교양" |
        "일반";

      /**
       * 플랜 요구구분
       */
      planRequirementType:
        "전공필수" |
        "전공선택" |
        "교양" |
        "일반";

      /**
       * 과목 학점
       *
       * 일반적인 이론 과목은 3학점이지만
       * AI가 임의 고정하지 않는다.
       */
      credits:
        number;

      /**
       * 정산 포함 여부
       *
       * 생략하면 DB 정책에서
       * 실습/이벤트/무료 과목을 기준으로 결정한다.
       */
      settlementIncluded?:
        boolean |
        null;
    }>;
};

/**
 * 승인 초안에 저장하는
 * 개별 우리플랜 과목
 */
export type PlanSubjectCreateDraftItem = {
  semesterNo:
    number;

  subjectName:
    string;

  planCategory:
    "전공" |
    "교양" |
    "일반";

  planRequirementType:
    "전공필수" |
    "전공선택" |
    "교양" |
    "일반";

  credits:
    number;

  /**
   * 해당 학기 내 표시 순서
   *
   * 서버가 현재 DB 상태를 기준으로 계산한다.
   */
  sortOrder:
    number;

  settlementIncluded:
    boolean;
};

/**
 * plan_subjects_create Pending Action에 저장할
 * 전체 과목 생성 초안
 */
export type PlanSubjectsCreateDraft = {
  studentId:
    number;

  studentName:
    string |
    null;

  /**
   * 초안 생성 당시 담당자
   *
   * 승인 시 현재 담당자와 다시 비교한다.
   */
  assigneeId:
    number;

  /**
   * 초안 생성 당시 플랜 ID
   *
   * 승인 시 동일한 플랜인지 다시 확인한다.
   */
  planId:
    number;

  /**
   * 초안 생성 당시 이미 존재하던
   * 우리플랜 과목 ID 목록
   *
   * 승인 사이에 과목이 추가/변경됐는지
   * 충돌 검사를 하기 위한 Snapshot이다.
   */
  originalPlanSubjectIds:
    number[];

  subjects:
    PlanSubjectCreateDraftItem[];

  requestedByUserId:
    number;

  requestedByRole:
    AiRole;

  createdAt:
    string;
};

/**
 * plan.subjects.create Tool 결과
 *
 * 이 결과가 반환되어도
 * planSemesters 테이블은 아직 변경되지 않는다.
 */
export type PlanSubjectsCreateToolOutput = {
  pendingActionRequired:
    true;

  studentId:
    number;

  studentName:
    string |
    null;

  planId:
    number;

  draft:
    PlanSubjectsCreateDraft;

  preview:
    AiPendingActionPreview;
};

/**
 * AI 기존 우리플랜 과목 수정 입력
 *
 * 과목 삭제는 지원하지 않는다.
 * 수정할 과목 ID와 사용자가 명확하게 변경 요청한 값만 전달한다.
 */
export type PlanSubjectsUpdateToolInput = {
  /**
   * 수정 대상 학생 ID
   */
  studentId:
    number;

  /**
   * 수정 대상 planSemesters ID
   */
  planSubjectId:
    number;

  /**
   * 변경할 학기
   */
  semesterNo?:
    number;

  /**
   * 변경할 과목명
   */
  subjectName?:
    string;

  /**
   * 변경할 플랜 대분류
   */
  planCategory?:
    "전공" |
    "교양" |
    "일반";

  /**
   * 변경할 요구구분
   */
  planRequirementType?:
    "전공필수" |
    "전공선택" |
    "교양" |
    "일반";

  /**
   * 변경할 학점
   */
  credits?:
    number;

  /**
   * 변경할 정렬 순서
   */
  sortOrder?:
    number;

  /**
   * 변경할 정산 포함 여부
   */
  settlementIncluded?:
    boolean;
};

/**
 * AI가 수정할 수 있는
 * 플랜 과목 필드
 */
export type PlanSubjectUpdateField =
  | "semesterNo"
  | "subjectName"
  | "planCategory"
  | "planRequirementType"
  | "credits"
  | "sortOrder"
  | "settlementIncluded";

/**
 * 승인 화면에 표시할
 * 플랜 과목 변경 전 / 후
 */
export type PlanSubjectUpdateChange = {
  field:
    PlanSubjectUpdateField;

  label:
    string;

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

/**
 * 수정 초안 생성 당시
 * planSemesters 원본 Snapshot
 */
export type PlanSubjectUpdateOriginalValues = {
  id:
    number;

  studentId:
    number;

  semesterNo:
    number;

  subjectName:
    string;

  planCategory:
    "전공" |
    "교양" |
    "일반";

  planRequirementType:
    "전공필수" |
    "전공선택" |
    "교양" |
    "일반";

  credits:
    number;

  sortOrder:
    number;

  settlementIncluded:
    boolean;
};

/**
 * 승인 후 실제 적용할
 * 플랜 과목 부분 수정값
 */
export type PlanSubjectUpdateValues = {
  semesterNo?:
    number;

  subjectName?:
    string;

  planCategory?:
    "전공" |
    "교양" |
    "일반";

  planRequirementType?:
    "전공필수" |
    "전공선택" |
    "교양" |
    "일반";

  credits?:
    number;

  sortOrder?:
    number;

  settlementIncluded?:
    boolean;
};

/**
 * plan_subjects_update Pending Action 승인 초안
 */
export type PlanSubjectsUpdateDraft = {
  studentId:
    number;

  studentName:
    string |
    null;

  /**
   * 학생 현재 플랜 ID
   */
  planId:
    number;

  /**
   * 수정할 planSemesters ID
   */
  planSubjectId:
    number;

  /**
   * 초안 생성 당시 학생 담당자
   */
  assigneeId:
    number;

  /**
   * 수정 대상 과목 원본 Snapshot
   */
  originalValues:
    PlanSubjectUpdateOriginalValues;

  /**
   * 승인 시 적용할 수정값
   */
  updates:
    PlanSubjectUpdateValues;

  requestedByUserId:
    number;

  requestedByRole:
    AiRole;

  createdAt:
    string;
};

/**
 * plan.subjects.update Tool 결과
 *
 * 실제 planSemesters 수정은 아직 수행되지 않는다.
 */
export type PlanSubjectsUpdateToolOutput = {
  pendingActionRequired:
    true;

  studentId:
    number;

  studentName:
    string |
    null;

  planId:
    number;

  planSubjectId:
    number;

  changes:
    PlanSubjectUpdateChange[];

  draft:
    PlanSubjectsUpdateDraft;

  preview:
    AiPendingActionPreview;
};

export type ScheduleCreateToolOutput = {
  /**
   * 일정이 바로 생성된 것이 아니라
   * 승인 대기 초안이 생성됐음을 의미한다.
   */
  pendingActionRequired:
    true;

  studentId:
    number;

  studentName:
    string |
    null;

  title:
    string;

  description:
    string |
    null;

  scheduleDate:
    string;

  meridiem:
    | "AM"
    | "PM";

  hour12:
    number;

  minute:
    number;

  startAt:
    string;

  isGlobal:
    boolean;

  preview: {
    title:
      string;

    summary:
      string;

    items:
      string[];

    warnings:
      string[];

    canConfirm:
      boolean;
  };
};

/**
 * AI 일정 등록 승인 초안
 *
 * 이 데이터 자체로 schedules 테이블을 수정하지 않는다.
 * Pending Action 승인 후 Executor에서 실제 등록한다.
 */
export type ScheduleCreateDraft = {
  studentId:
    number;

  studentName:
    string |
    null;

  title:
    string;

  description:
    string |
    null;

  scheduleDate:
    string;

  meridiem:
    | "AM"
    | "PM";

  hour12:
    number;

  minute:
    number;

  startAt:
    string;

  scope:
    | "personal"
    | "global";

  ownerUserId:
    number;

  ownerUserName:
    string |
    null;

  createdByRole:
    AiRole;

  createdAt:
    string;
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
  | "practice"
  | "qualification";

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

  /**
   * 학위조건 + 자격조건 통합 결과.
   *
   * 향후
   * - AI 업무비서
   * - 학생 상세
   * - 카카오 AI
   * - 최단기간 Planner
   *
   * 가 동일한 기준을 사용한다.
   */
  requirements:
    UnifiedQualificationRequirements;

  /**
   * 법적 자격/학위 Requirements를 기준으로
   * 실제 선택된 추가과목 계획.
   *
   * 아직 학기배치는 하지 않는다.
   */
  subjectPlan:
    QualificationSubjectPlannerResult;

  /**
   * 실제 추가과목을
   * 학기당 8과목 / 연간 14과목 기준으로
   * 자동 배치한 결과.
   *
   * 아직 교육원 실제 개강일은 확정하지 않는다.
   */
  semesterPlan:
    QualificationSemesterPlannerResult;

  /**
   * 최종 수업학기 이후
   * 학습자등록 / 학점인정 /
   * 학위신청 / 학위수여 /
   * 자격증 신청 예상 일정.
   */
  administrativeTimeline:
    AdministrativeTimelinePlannerResult;

/**
 * AI가 학생 학업상태를 자연어로 설명할 때
 * 우선 사용해야 하는 공통 학업요약.
 *
 * 법규/학점/학기/행정일정을
 * AI가 다시 계산하지 않고
 * 서버 계산결과를 그대로 설명한다.
 */
academicSummary:
  StudentAcademicSummaryResult;

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
   * 전적대 과목 실제 이수연도
   *
   * 예:
   * 2018
   * 2019
   * 2020
   *
   * 성적증명서에 연도가 확인되지 않으면 null.
   *
   * semesterNo와는 다른 값이다.
   * semesterNo는 CRM 학기 순번이고,
   * completionYear는 실제 성적증명서 이수연도다.
   */
  completionYear:
    AiDocumentExtractedField<number>;

  /**
   * 전적대 과목 실제 이수학기
   *
   * 예:
   * 1학기
   * 2학기
   * 여름계절학기
   * 겨울계절학기
   *
   * 확인되지 않으면 null.
   */
  completionSemester:
    AiDocumentExtractedField<string>;

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
 * AI 정산 조회
 *
 * 권한 범위:
 * - staff: 본인
 * - admin: 본인 팀
 * - host: 회사 전체
 * - superhost: 사용하지 않음
 *
 * organizationId / teamId / assigneeId 권한값은
 * 프론트나 OpenAI 입력값을 신뢰하지 않고
 * 서버 AiUserContext에서 최종 결정한다.
 */
export type SettlementSummaryToolInput = {
  /**
   * 조회 단위
   *
   * day:
   * 특정 날짜
   *
   * month:
   * 특정 월
   *
   * year:
   * 특정 연도
   *
   * range:
   * 시작일 ~ 종료일
   */
  periodType:
    | "day"
    | "month"
    | "year"
    | "range";

  /**
   * 조회 연도
   *
   * month / year 조회 시 사용
   */
  year?:
    number |
    null;

  /**
   * 조회 월
   *
   * month 조회 시 사용
   */
  month?:
    number |
    null;

  /**
   * YYYY-MM-DD
   *
   * day 조회 시 사용
   */
  date?:
    string |
    null;

  /**
   * YYYY-MM-DD
   *
   * range 조회 시작일
   */
  startDate?:
    string |
    null;

  /**
   * YYYY-MM-DD
   *
   * range 조회 종료일
   */
  endDate?:
    string |
    null;

  /**
   * 특정 담당자를 이름으로 요청한 경우에만 사용한다.
   *
   * 예:
   * "이재준 5월 매출"
   *
   * AI가 assigneeId를 직접 만들지 않도록
   * 이름만 전달하고 서버가 권한 범위 안에서 찾는다.
   */
  assigneeName?:
    string |
    null;

  /**
   * Host가 특정 팀을 요청한 경우
   *
   * 예:
   * "1팀 5월 매출"
   *
   * teamId를 OpenAI가 직접 만들지 않고
   * 팀 이름만 전달한다.
   */
  teamName?:
    string |
    null;

  /**
   * 신규 / 기존 구분
   *
   * all:
   * 전체
   *
   * new:
   * 1학기 신규
   *
   * existing:
   * 2학기 이상 기존
   */
  customerType?:
    | "all"
    | "new"
    | "existing";

  /**
   * 직원별 순위까지 필요한지
   *
   * 예:
   * "이번달 팀원 매출 순위 보여줘"
   */
  includeRanking?:
    boolean;
};

export type SettlementSummaryAssigneeItem = {
  assigneeId:
    number;

  assigneeName:
    string;

  teamId:
    number |
    null;

  teamName:
    string |
    null;

  grossSales:
    number;

  refundAmount:
    number;

  netSales:
    number;

  newSales:
    number;

  existingSales:
    number;

  entryCount:
    number;

  studentCount:
    number;
};

export type SettlementSummaryTeamItem = {
  teamId:
    number;

  teamName:
    string;

  grossSales:
    number;

  refundAmount:
    number;

  netSales:
    number;

  newSales:
    number;

  existingSales:
    number;

  assigneeCount:
    number;
};

export type SettlementSummaryToolOutput = {
  /**
   * 서버에서 실제 적용한 조회 범위
   */
  period: {
    periodType:
      | "day"
      | "month"
      | "year"
      | "range";

    startDate:
      string;

    endDate:
      string;

    label:
      string;
  };

  /**
   * 서버 AI Context에서 확정한 권한 범위
   */
  scope: {
    role:
      AiRole;

    scope:
      AiDataScope;

    organizationId:
      number;

    teamId:
      number |
      null;

    assigneeIds:
      number[] |
      null;
  };

  filter: {
    assigneeName:
      string |
      null;

    teamName:
      string |
      null;

    customerType:
      | "all"
      | "new"
      | "existing";
  };

  summary: {
    grossSales:
      number;

    refundAmount:
      number;

    netSales:
      number;

    newSales:
      number;

    existingSales:
      number;

    entryCount:
      number;

    studentCount:
      number;
  };

  assignees:
    SettlementSummaryAssigneeItem[];

  teams:
    SettlementSummaryTeamItem[];

  /**
   * 매출 순위
   *
   * includeRanking=false인 경우 빈 배열
   */
  ranking:
    Array<{
      rank:
        number;

      assigneeId:
        number;

      assigneeName:
        string;

      teamName:
        string |
        null;

      netSales:
        number;
    }>;

  generatedAt:
    string;
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
  number |
  null;

grade:
  string |
  null;

/**
 * 목표 학점은행제 학위 기준 학습구분.
 *
 * 대학 성적증명서 OCR 단계에서는
 * 원래 대학의 학습구분을 그대로 사용하지 않는다.
 *
 * NILE 공식 표준교육과정 판정 전에는
 * null일 수 있다.
 */
category:
  | "전공"
  | "교양"
  | "일반"
  | null;

/**
 * 목표 학점은행제 전공 기준 세부 학습구분.
 *
 * 대학 성적증명서 OCR 결과를 직접 신뢰하지 않고
 * NILE 공식 표준교육과정 판정 결과로 확정한다.
 *
 * 판정 전에는 null일 수 있다.
 */
requirementType:
  | "전공필수"
  | "전공선택"
  | "교양"
  | "일반"
  | null;

            semesterNo:
        number | null;

      /**
       * 전적대 성적증명서 기준 실제 이수연도.
       *
       * 전적대 반영 시 transfer_subjects.completionYear로 저장한다.
       */
      completionYear:
        number | null;

      /**
       * 전적대 성적증명서 기준 실제 이수학기.
       *
       * 전적대 반영 시 transfer_subjects.completionSemester로 저장한다.
       */
      completionSemester:
        string | null;

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
  | "semester_complete"
  | "plan_create"
  | "plan_update"
  | "plan_subjects_create"
  | "plan_subjects_update"
  | "payment_update"
  | "practice_request_create"
  | "consultation_create"
  | "consultation_update"
  | "schedule_create"
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
  pendingActionId:
    number;

  status:
    | "executed"
    | "failed";

  /**
   * 대상 또는 생성된 학생 ID
   */
  studentId:
    number |
    null;

  /**
   * 단일 학기 작업에서 변경된 학기 ID
   */
  semesterId?:
    number |
    null;

  /**
   * 단일 학기 작업에서 변경된 학기 순서
   */
  semesterOrder?:
    number |
    null;

  /**
   * 입력완료 처리 결과
   */
  isCompleted?:
    boolean;

  /**
   * 승인관리 상태
   */
  approvalStatus?:
    string |
    null;

  /**
   * 생성된 학기 ID 목록
   */
  semesterIds:
    number[];

  /**
   * 실행 결과를 사용자에게 나열
   */
  completedSteps:
    string[];

  /**
   * 실패 또는 건너뛴 작업
   */
  failedSteps:
    string[];

  message:
    string;
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
 * 실제 연도별 학기 구분
 *
 * 예:
 * 2026년 2학기
 * 2027년 1학기
 */
semesterLabel:
  string |
  null;

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
 * 학생 통합등록 생성 단계에서는 항상 false로 저장한다.
 * 이후 담당자가 실제 개강일, 교육원, 과목 수,
 * 결제금액 및 결제일을 확인한 뒤
 * 별도의 semester_complete Pending Action을 승인하면
 * true로 변경한다.
 */
isCompleted:
  boolean;
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