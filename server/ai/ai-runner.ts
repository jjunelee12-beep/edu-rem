import OpenAI from "openai";

import {
  executeAiTool,
  listRegisteredAiTools,
} from "./ai-tool-registry";

import type {
  AiToolAccessMode,
  AiToolExecutionResult,
  AiToolInputSchema,
  AiToolName,
  AiUserContext,
  AiWorkflowType,
  AiWorkSession,
  AiWorkSessionPatch,
    ConsultationCreateToolOutput,
PlanCreateToolOutput,
PlanUpdateToolOutput,
PlanSubjectsCreateToolOutput,
PlanSubjectsUpdateToolOutput,
SemesterCreateToolOutput,
  SemesterUpdateToolOutput,
  SemesterCompleteToolOutput,
  StudentUpdateToolOutput,
} from "./ai.types";

let openAiClient:
  OpenAI |
  null = null;

/**
 * API Key가 존재할 때만 OpenAI Client를 생성한다.
 */
function getOpenAiClient():
  OpenAI |
  null {
  const apiKey =
    String(
      process.env.OPENAI_API_KEY ||
      ""
    ).trim();

  if (
    !apiKey
  ) {
    return null;
  }

  if (
    !openAiClient
  ) {
    openAiClient =
      new OpenAI({
        apiKey,
      });
  }

  return openAiClient;
}

/**
 * Registry에 등록된 CRM Tool을
 * OpenAI Responses API Function Tool 형식으로
 * 변환할 때 사용하는 내부 타입이다.
 */
type OpenAiFunctionTool = {
  type:
    "function";

  name:
    string;

  description:
    string;

  parameters:
    AiToolInputSchema;

  strict:
    boolean;
};

type OpenAiFunctionCallOutput = {
  type:
    "function_call";

  name:
    string;

  arguments:
    string;

  call_id?:
    string;

  id?:
    string;
};

type RegisteredAiToolForRunner = {
  name:
    string;

  description:
    string;

  inputSchema:
    AiToolInputSchema |
    null;

  accessMode:
    AiToolAccessMode;

  allowedRoles:
    AiUserContext["role"][];

  requiresOrganization:
    boolean;

  requiresConfirmation:
    boolean;

  autoExecutable:
    boolean;
};

/**
 * OpenAI에 전달하는 Function Tool 이름은
 * 영문, 숫자, 밑줄 형식으로 통일한다.
 *
 * 실제 Registry Tool 이름과 OpenAI Tool 이름은
 * 서로 분리해서 관리한다.
 */
const STUDENT_REGISTRATION_PREVIEW_TOOL =
  "student_registration_preview" as const;

/**
 * 최근 OCR 문서 분석 결과를
 * 특정 학생 CRM에 반영하기 위한
 * 승인 미리보기 가상 Tool이다.
 *
 * 실제 CRM 저장은 하지 않는다.
 */
const DOCUMENT_IMPORT_PREVIEW_TOOL =
  "document_import_preview" as const;

/**
 * function_call_output으로 전달할 수 있는
 * 최대 JSON 문자열 길이
 */
const MAX_FUNCTION_CALL_OUTPUT_LENGTH =
  50_000;

/**
 * 한 번의 사용자 요청에서 실행할 수 있는
 * 최대 CRM 조회 Tool 횟수다.
 *
 * 최초 Tool 실행을 포함한 전체 횟수이며,
 * 무한 Tool 호출을 방지한다.
 */
const MAX_AI_TOOL_CALL_STEPS =
  4;

/**
 * 학생 종합조회에서 제시한 다음 업무를
 * 사용자 후속 답변과 연결해 유지하는 시간이다.
 */
const DASHBOARD_NEXT_ACTION_EXPIRES_MS =
  30 *
  60 *
  1000;

/**
 * 서버 내부 Registry Tool 이름을
 * OpenAI Function Tool 이름으로 변환한다.
 */
function toOpenAiToolName(
  toolName:
    string
): string {
  return toolName
    .replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    )
    .slice(
      0,
      64
    );
}

/**
 * OpenAI가 선택한 Function Tool 이름을
 * 실제 서버 Registry Tool 이름으로 복원한다.
 */
function fromOpenAiToolName(
  openAiToolName:
    string
): string | null {
  const matchedTool =
    listRegisteredAiTools()
      .find(
        (
          tool
        ) =>
          toOpenAiToolName(
            tool.name
          ) ===
          openAiToolName
      );

  return matchedTool?.name ??
    null;
}

type AiRunnerIntent =
  | "pending_action_confirm"
  | "pending_action_cancel"
  | "student_search"
  | "student_summary"
  | "student_dashboard"
   | "student_update"
| "plan_create"
| "plan_update"
| "plan_subjects_create"
| "plan_subjects_update"
| "semester_create"
  | "semester_update"
  | "semester_complete"
  | "consultation_search"
  | "consultation_create"
  | "consultation_update"
  | "missing_data"
  | "student_detail_risk"
  | "student_list_risk"
  | "practice_institution_search"
  | "practice_support_status"
  | "student_registration_preview"
 | "schedule_create"
| "document_analysis"
| "document_import_preview"
| "settlement_summary"
| "general_help";

type AiRunnerPlan = {
  intent:
    AiRunnerIntent;

    toolName:
    | "student.search"
    | "student.summary"
    | "student.dashboard"
| "student.update"
| "plan.create"
| "plan.update"
| "plan.subjects.create"
| "plan.subjects.update"
| "semester.create"
| "semester.update"
    | "semester.complete"
    | "consultation.search"
    | "consultation.create"
    | "consultation.update"
    | "alert.missingData"
    | "risk.studentDetail"
    | "risk.studentList"
    | "practice.institutionSearch"
   | "practice.supportStatus"
| "schedule.create"
| "document.analysis"
| "settlement.summary"
| null;

  input:
    Record<string, unknown>;

  explanation:
    string;

  /**
   * OpenAI가 Tool을 호출하지 않고
   * 이미 생성한 일반 답변
   */
  directReply?:
    string |
    null;

  /**
   * Responses API Tool Calling의
   * 후속 function_call_output 전달에 사용한다.
   */
  openAiResponseId?:
    string |
    null;

  openAiCallId?:
    string |
    null;

  openAiToolName?:
    string |
    null;

  /**
   * Plan 생성 단계 자체가 실패했는지 여부
   */
  failed?:
    boolean;

  failureMessage?:
    string |
    null;

  requiresRegistrationPreview:
    boolean;
};

type AiPendingActionDecision = {
  decision:
    | "confirm"
    | "cancel"
    | "revise"
    | "new_request"
    | "unclear";

  confidence:
    | "high"
    | "medium"
    | "low";

  reason:
    string;
};

type ConsultationCreatePreflightResult =
  | {
      canCreate:
        true;

      studentSearchResult:
        AiToolExecutionResult<any>;

      consultationSearchResult:
        AiToolExecutionResult<any>;
    }
  | {
      canCreate:
        false;

      reason:
        "existing_student" |
        "existing_consultation" |
        "search_failed";

      reply:
        string;

      blockingToolName:
        "student.search" |
        "consultation.search";

      blockingToolInput:
        Record<
          string,
          unknown
        >;

      blockingToolResult:
        AiToolExecutionResult<any>;
    };


export type AiPendingActionCommand = {
  command:
    | "confirm"
    | "cancel";

  pendingActionId:
    number;

  actionId:
    string;

  actionType:
    string;
};

export type AiConversationHistoryMessage = {
  role:
    | "user"
    | "assistant";

  content:
    string;
};

export type AiImageAttachment = {
  fileName:
    string;

  mimeType:
    | "image/jpeg"
    | "image/png"
    | "image/webp";

  /**
   * data:image/...;base64, 접두사를 제거한
   * 순수 Base64 문자열
   */
  imageBase64:
    string;
};

export type AiRecentDocumentContext = {
  analysis:
    Record<
      string,
      unknown
    >;

  fileName?:
    string |
    null;

  mimeType?:
    string |
    null;

  createdAt?:
    string |
    Date |
    null;
};

export type RunAiAssistantInput = {
  context:
    AiUserContext;

  message:
    string;

  imageAttachment?:
    AiImageAttachment |
    null;

recentDocument?:
  AiRecentDocumentContext |
  null;

  /**
   * DB에서 서버가 직접 조회한
   * 현재 사용자 AI 업무 세션이다.
   *
   * 프론트에서 전달받지 않는다.
   */
  workSession:
    AiWorkSession;

  selectedStudentId?:
    number |
    null;

  selectedStudentName?:
    string |
    null;

  /**
   * DB에서 서버가 직접 불러온
   * 최근 AI 대화 기록이다.
   *
   * 프론트에서 전달받지 않는다.
   */
  conversationHistory?:
    AiConversationHistoryMessage[];
};

export type RunAiAssistantOutput = {
  success:
    boolean;

  intent:
    AiRunnerIntent;

  reply:
    string;

  toolName:
    AiToolName |
    null;

  toolResult?:
    AiToolExecutionResult<any> |
    null;

  data?:
    unknown;

  /**
   * Runner 처리 결과를 AI 업무 세션에
   * 반영하기 위한 부분 변경값이다.
   *
   * Runner가 DB를 직접 수정하지 않고
   * Router가 version 검사를 거쳐 저장한다.
   */
  workSessionPatch?:
    AiWorkSessionPatch |
    null;

  pendingActionCommand?:
    AiPendingActionCommand |
    null;

  /**
   * 승인 대기 상태에서 현재 사용자 메시지가
   * 기존 초안과 어떤 관계인지 AI가 판단한 결과다.
   *
   * 실제 승인·취소 실행에는 사용하지 않고,
   * Router가 기존 Pending Action을 유지하거나
   * 교체할지 결정할 때만 참고한다.
   */
  pendingActionDecision?:
    AiPendingActionDecision |
    null;

  registrationPreview?: {
    required: boolean;

    consultationId: number | null;

    originalMessage: string;
  } | null;

documentImportPreview?: {
  required:
    true;

  studentId:
    number |
    null;

  analysisId:
    string |
    null;

  fileName:
    string |
    null;

  mimeType:
    string |
    null;
} | null;

consultationCreateDraft?:
  ConsultationCreateToolOutput |
  null;

scheduleCreateDraft?: {
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
    "AM" |
    "PM";

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
} | null;

consultationUpdateDraft?: {
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
    Array<{
      field:
        "status" |
        "notes";

      label:
        string;

      before:
        string |
        null;

      after:
        string |
        null;
    }>;

  draft: {
    consultationId:
      number;

    clientName:
      string |
      null;

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
      AiUserContext["role"];

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
      Array<{
        field:
          "status" |
          "notes";

        label:
          string;

        before:
          string |
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
} | null;

studentUpdateDraft?:
  StudentUpdateToolOutput |
  null;

planCreateDraft?:
  PlanCreateToolOutput |
  null;

planUpdateDraft?:
  PlanUpdateToolOutput |
  null;

planSubjectsCreateDraft?:
  PlanSubjectsCreateToolOutput |
  null;

planSubjectsUpdateDraft?:
  PlanSubjectsUpdateToolOutput |
  null;

semesterCreateDraft?:
  SemesterCreateToolOutput |
  null;

semesterUpdateDraft?:
  SemesterUpdateToolOutput |
  null;

semesterCompleteDraft?:
  SemesterCompleteToolOutput |
  null;

  meta: {
    scope: AiUserContext["scope"];
    organizationId: number;
    userId: number;
  };
};

function getWorkflowTypeFromIntent(
  intent:
    AiRunnerIntent
): AiWorkflowType | null {
  switch (
    intent
  ) {
        case "student_update":
      return "student_update";

        case "plan_create":
  return "plan_setup";

case "plan_update":
  return "plan_update";

case "plan_subjects_create":
  return "plan_update";

case "plan_subjects_update":
  return "plan_update";

case "semester_create":
      return "semester_create";

    case "semester_update":
      return "semester_update";

    case "semester_complete":
      return "semester_complete";

    case "consultation_create":
      return "consultation_registration";

    case "consultation_update":
      return "consultation_update";

    case "student_registration_preview":
      return "consultation_registration";

    case "schedule_create":
      return "schedule_create";

    default:
      return null;
  }
}

function getWaitingForFromValidationMessage(params: {
  toolName:
    AiRunnerPlan["toolName"];

  message:
    string |
    null;
}): string[] {
  const message =
    String(
      params.message ||
      ""
    );

  if (
    params.toolName ===
    "student.update"
  ) {
    return [
      "updates",
    ];
  }

  if (
    params.toolName ===
    "plan.create"
  ) {
    if (
      message.includes(
        "학생"
      )
    ) {
      return [
        "studentId",
      ];
    }

    if (
      message.includes(
        "실습"
      )
    ) {
      return [
        "hasPractice",
      ];
    }

    if (
      message.includes(
        "전체 이론"
      )
    ) {
      return [
        "totalTheorySubjects",
      ];
    }

    if (
      message.includes(
        "전공필수"
      )
    ) {
      return [
        "requiredMajorCount",
      ];
    }

    if (
      message.includes(
        "전공선택"
      )
    ) {
      return [
        "electiveMajorCount",
      ];
    }

    if (
      message.includes(
        "교양"
      )
    ) {
      return [
        "liberalCount",
      ];
    }

    if (
      message.includes(
        "일반"
      )
    ) {
      return [
        "generalCount",
      ];
    }

    return [
      "hasPractice",
      "totalTheorySubjects",
      "requiredMajorCount",
      "electiveMajorCount",
      "liberalCount",
      "generalCount",
    ];
  }

  if (
    params.toolName ===
      "plan.update"
  ) {
    if (
      message.includes(
        "학생"
      )
    ) {
      return [
        "studentId",
      ];
    }

    return [
      "updates",
    ];
  }

  if (
    params.toolName ===
      "plan.subjects.create"
  ) {
    if (
      message.includes(
        "학생"
      )
    ) {
      return [
        "studentId",
      ];
    }

    return [
      "subjects",
    ];
  }

  if (
    params.toolName ===
      "plan.subjects.update"
  ) {
    if (
      message.includes(
        "학생"
      )
    ) {
      return [
        "studentId",
      ];
    }

    if (
      message.includes(
        "과목 ID"
      ) ||
      message.includes(
        "플랜 과목"
      )
    ) {
      return [
        "planSubjectId",
      ];
    }

    return [
      "updates",
    ];
  }

  if (
    params.toolName ===
    "semester.create"
  ) {
    if (
      message.includes(
        "학생"
      )
    ) {
      return [
        "studentId",
      ];
    }

    if (
      message.includes(
        "학기 순서"
      )
    ) {
      return [
        "semesterOrder",
      ];
    }

    if (
      message.includes(
        "학기 구분"
      )
    ) {
      return [
        "semesterLabel",
      ];
    }

    return [
      "semesterOrder",
      "semesterLabel",
    ];
  }

  if (
    params.toolName ===
    "semester.update"
  ) {
    if (
      message.includes(
        "학생"
      )
    ) {
      return [
        "studentId",
      ];
    }

    if (
      message.includes(
        "학기 순서"
      ) ||
      message.includes(
        "몇 학기"
      )
    ) {
      return [
        "semesterOrder",
      ];
    }

    return [
      "semesterOrder",
      "updates",
    ];
  }

  if (
    params.toolName ===
    "semester.complete"
  ) {
    if (
      message.includes(
        "학생"
      )
    ) {
      return [
        "studentId",
      ];
    }

    if (
      message.includes(
        "학기 순서"
      ) ||
      message.includes(
        "몇 학기"
      )
    ) {
      return [
        "semesterOrder",
      ];
    }

    return [
      "semesterOrder",
    ];
  }

  if (
    params.toolName ===
    "consultation.create"
  ) {
    if (
      message.includes(
        "이름"
      )
    ) {
      return [
        "clientName",
      ];
    }

    if (
      message.includes(
        "연락처"
      )
    ) {
      return [
        "phone",
      ];
    }

    return [
      "clientName",
      "phone",
    ];
  }

  if (
    params.toolName ===
    "consultation.update"
  ) {
    if (
      message.includes(
        "상담DB 번호"
      )
    ) {
      return [
        "consultationId",
      ];
    }

    return [
      "updates",
    ];
  }

  if (
    params.toolName ===
    "schedule.create"
  ) {
    if (
      message.includes(
        "학생"
      )
    ) {
      return [
        "studentId",
      ];
    }

    if (
      message.includes(
        "일정명"
      )
    ) {
      return [
        "title",
      ];
    }

    if (
      message.includes(
        "날짜"
      )
    ) {
      return [
        "scheduleDate",
      ];
    }

    if (
      message.includes(
        "오전 또는 오후"
      )
    ) {
      return [
        "meridiem",
      ];
    }

    if (
      message.includes(
        "시간"
      )
    ) {
      return [
        "hour12",
      ];
    }

    if (
      message.includes(
        "분"
      )
    ) {
      return [
        "minute",
      ];
    }

    return [
      "scheduleDate",
      "meridiem",
      "hour12",
      "minute",
    ];
  }

  return [];
}

function buildCollectingDataWorkSessionPatch(params: {
  plan:
    AiRunnerPlan;

  validationMessage:
    string |
    null;

  workSession:
    AiWorkSession;
}): AiWorkSessionPatch | null {
  const workflowType =
    getWorkflowTypeFromIntent(
      params.plan.intent
    );

  if (
    !workflowType
  ) {
    return null;
  }

const studentId =
  Number(
    params.plan.input
      .studentId ??
    0
  );

const consultationId =
  Number(
    params.plan.input
      .consultationId ??
    0
  );

const currentTarget =
  params.workSession
    .activeTarget;

const existingStudentName =
  currentTarget?.type ===
    "student" &&
  Number(
    currentTarget.id
  ) ===
    Math.floor(
      studentId
    )
    ? String(
        currentTarget.name ||
        ""
      ).trim() ||
      null
    : null;

const existingConsultationName =
  currentTarget?.type ===
    "consultation" &&
  Number(
    currentTarget.id
  ) ===
    Math.floor(
      consultationId
    )
    ? String(
        currentTarget.name ||
        ""
      ).trim() ||
      null
    : null;

const studentTargetPatch:
  AiWorkSessionPatch =
  Number.isFinite(
    studentId
  ) &&
  studentId > 0
    ? {
        activeTarget: {
          type:
            "student",

          id:
            Math.floor(
              studentId
            ),

          name:
  existingStudentName,
        },

        linkedContext: {
          studentId:
            Math.floor(
              studentId
            ),
        },
      }
    : {};

const consultationTargetPatch:
  AiWorkSessionPatch =
  Number.isFinite(
    consultationId
  ) &&
  consultationId > 0
    ? {
        activeTarget: {
          type:
            "consultation",

          id:
            Math.floor(
              consultationId
            ),

          name:
  existingConsultationName,
        },

        linkedContext: {
          consultationId:
            Math.floor(
              consultationId
            ),
        },
      }
    : {};

return {
  ...(
                workflowType ===
          "student_update" ||
        workflowType ===
          "plan_setup" ||
        workflowType ===
          "plan_update" ||
        workflowType ===
          "semester_create" ||
    workflowType ===
      "semester_update" ||
    workflowType ===
      "semester_complete" ||
    workflowType ===
      "schedule_create"
      ? studentTargetPatch
      : {}
  ),

  ...(
    workflowType ===
      "consultation_update" ||
    workflowType ===
      "consultation_registration"
      ? consultationTargetPatch
      : {}
  ),

    workflow: {
    type:
      workflowType,

    step:
      "collecting_data",

    /**
     * 기존 Workflow와 새 Workflow의 종류가 다르면
     * 이전 업무 Draft를 먼저 비운다.
     *
     * 같은 Workflow의 후속 답변이라면
     * 기존 Draft를 유지하면서 새 입력을 누적한다.
     */
    clearDraft:
      params.workSession
        .workflow
        .type !==
      workflowType,

    draftPatch:
      params.plan.input,

    waitingFor:
      getWaitingForFromValidationMessage({
        toolName:
          params.plan.toolName,

        message:
          params.validationMessage,
      }),
  },

  lastPresentedAction:
    null,
  };
}

function buildAwaitingConfirmationWorkSessionPatch(params: {
  plan:
    AiRunnerPlan;

  toolResultData:
    unknown;

  workSession:
    AiWorkSession;
}): AiWorkSessionPatch | null {
  const workflowType =
    getWorkflowTypeFromIntent(
      params.plan.intent
    );

  if (
    !workflowType
  ) {
    return null;
  }

  const resultData =
    params.toolResultData &&
    typeof params.toolResultData ===
      "object" &&
    !Array.isArray(
      params.toolResultData
    )
      ? params.toolResultData as
          Record<string, unknown>
      : {};

  const draft =
    resultData.draft &&
    typeof resultData.draft ===
      "object" &&
    !Array.isArray(
      resultData.draft
    )
      ? resultData.draft as
          Record<string, unknown>
      : params.plan.input;

const studentId =
  Number(
    draft.studentId ??
    resultData.studentId ??
    params.plan.input.studentId ??
    0
  );

const consultationId =
  Number(
    draft.consultationId ??
    resultData.consultationId ??
    params.plan.input.consultationId ??
    0
  );

const currentTarget =
  params.workSession
    .activeTarget;

const existingStudentName =
  currentTarget?.type ===
    "student" &&
  Number(
    currentTarget.id
  ) ===
    Math.floor(
      studentId
    )
    ? String(
        currentTarget.name ||
        ""
      ).trim() ||
      null
    : null;

const existingConsultationName =
  currentTarget?.type ===
    "consultation" &&
  Number(
    currentTarget.id
  ) ===
    Math.floor(
      consultationId
    )
    ? String(
        currentTarget.name ||
        ""
      ).trim() ||
      null
    : null;

const studentName =
  String(
    resultData.studentName ??
    resultData.clientName ??
    draft.studentName ??
    existingStudentName ??
    ""
  ).trim() ||
  null;

const consultationName =
  String(
    resultData.clientName ??
    draft.clientName ??
    existingConsultationName ??
    ""
  ).trim() ||
  null;

const studentTargetPatch:
  AiWorkSessionPatch =
  Number.isFinite(
    studentId
  ) &&
  studentId > 0
    ? {
        activeTarget: {
          type:
            "student",

          id:
            Math.floor(
              studentId
            ),

          name:
            studentName,
        },

        linkedContext: {
          studentId:
            Math.floor(
              studentId
            ),
        },
      }
    : {};

const consultationTargetPatch:
  AiWorkSessionPatch =
  Number.isFinite(
    consultationId
  ) &&
  consultationId > 0
    ? {
        activeTarget: {
          type:
            "consultation",

          id:
            Math.floor(
              consultationId
            ),

          name:
            consultationName,
        },

        linkedContext: {
          consultationId:
            Math.floor(
              consultationId
            ),
        },
      }
    : {};

        return {
    ...(
                        workflowType ===
              "student_update" ||
            workflowType ===
              "plan_setup" ||
            workflowType ===
              "plan_update" ||
            workflowType ===
              "semester_create" ||
      workflowType ===
        "semester_update" ||
      workflowType ===
        "semester_complete" ||
      workflowType ===
        "schedule_create"
        ? studentTargetPatch
        : {}
    ),

  ...(
    workflowType ===
      "consultation_update"
      ? consultationTargetPatch
      : {}
  ),

  workflow: {
    type:
      workflowType,

    step:
      "awaiting_confirmation",

    clearDraft:
      true,

    draftPatch:
      draft,

    waitingFor:
      [],
  },
};
}

/**
 * 학생 통합등록 업무에서 여러 메시지로 받은 내용을
 * 하나의 등록 지시문으로 누적한다.
 *
 * 예:
 * 1차: "상담DB 123번 학생 등록해줘"
 * 2차: "2026년 2학기, 9월 개강, 서사평, 7과목"
 * 3차: "결제금액 52만 5천원, 결제일 8월 20일"
 *
 * 위 내용을 모두 합쳐 studentRegistrationPreview에 전달한다.
 */
function buildAccumulatedRegistrationMessage(params: {
  message:
    string;

  workSession:
    AiWorkSession;
}): string {
  const currentMessage =
    String(
      params.message ||
      ""
    )
      .trim()
      .slice(
        0,
        3000
      );

  const isRegistrationWorkflow =
    params.workSession
      .workflow
      .type ===
    "consultation_registration";

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const previousMessage =
    isRegistrationWorkflow
      ? String(
          workflowDraft
            .originalMessage ||
          ""
        )
          .trim()
          .slice(
            0,
            10000
          )
      : "";

  if (
    !previousMessage
  ) {
    return currentMessage;
  }

  if (
    !currentMessage
  ) {
    return previousMessage;
  }

  /**
   * 같은 메시지가 중복으로 들어오는 경우
   * 동일 내용을 다시 붙이지 않는다.
   */
  if (
    previousMessage ===
      currentMessage ||
    previousMessage
      .endsWith(
        currentMessage
      )
  ) {
    return previousMessage;
  }

  return [
    previousMessage,
    currentMessage,
  ]
    .filter(
      Boolean
    )
    .join(
      "\n"
    )
    .slice(
      0,
      12000
    );
}

function buildRegistrationWorkSessionPatch(params: {
  consultationId:
    number;

  originalMessage:
    string;

  workSession:
    AiWorkSession;
}): AiWorkSessionPatch {
  const normalizedConsultationId =
    Number.isFinite(
      params.consultationId
    ) &&
    params.consultationId > 0
      ? Math.floor(
          params.consultationId
        )
      : 0;

  const normalizedOriginalMessage =
    String(
      params.originalMessage ||
      ""
    )
      .trim()
      .slice(
        0,
        12000
      );

  const currentTarget =
    params.workSession
      .activeTarget;

  const existingConsultationName =
    currentTarget?.type ===
      "consultation" &&
    Number(
      currentTarget.id
    ) ===
      normalizedConsultationId
      ? String(
          currentTarget.name ||
          ""
        ).trim() ||
        null
      : null;

  if (
    normalizedConsultationId >
    0
  ) {
    return {
      activeTarget: {
        type:
          "consultation",

        id:
          normalizedConsultationId,

        name:
          existingConsultationName,
      },

      linkedContext: {
        consultationId:
          normalizedConsultationId,
      },

      workflow: {
        type:
          "consultation_registration",

        /**
         * 아직 실제 Pending Action이 생성되지 않았다.
         *
         * studentRegistrationPreview Router가
         * 초안을 분석한 뒤:
         *
         * 승인 가능 → awaiting_confirmation
         * 정보 부족 → collecting_data
         *
         * 상태를 최종 결정한다.
         */
        step:
          "collecting_data",

        clearDraft:
          true,

        draftPatch: {
          consultationId:
            normalizedConsultationId,

          originalMessage:
            normalizedOriginalMessage,
        },

        waitingFor:
          [],
      },

      lastPresentedAction:
        null,
    };
  }

  return {
    workflow: {
      type:
        "consultation_registration",

      step:
        "collecting_data",

      clearDraft:
        true,

      draftPatch: {
        originalMessage:
          normalizedOriginalMessage,
      },

      waitingFor: [
        "consultationId",
      ],
    },

    lastPresentedAction:
      null,
  };
}

/**
 * 진행 중인 신규 상담DB 등록 Workflow에서
 * 이전 메시지로 받은 값과 현재 OpenAI Tool 입력값을 병합한다.
 *
 * 현재 메시지의 값이 이전 값을 덮어쓰며,
 * consultation.create에서 허용하는 입력 필드만 이어받는다.
 */
function mergeConsultationCreateWorkflowInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  message:
    string;

  workSession:
    AiWorkSession;
}): Record<
  string,
  unknown
> {
  if (
    params.toolName !==
      "consultation.create" ||
    params.workSession
      .workflow
      .type !==
      "consultation_registration"
  ) {
    return params.toolInput;
  }

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const previousInput:
    Record<
      string,
      unknown
    > = {};

  const allowedFields = [
    "clientName",
    "phone",
    "finalEducation",
    "desiredCourse",
    "notes",
    "status",
  ];

  const replacePreviousFields =
    hasExplicitUpdateScopeReplacement(
      params.message
    );

  if (
    !replacePreviousFields
  ) {
    for (
      const field of
      allowedFields
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          workflowDraft,
          field
        )
      ) {
        previousInput[field] =
          workflowDraft[field];
      }
    }
  }

  return normalizeOpenAiToolInput(
    "consultation.create",
    {
      ...previousInput,
      ...params.toolInput,
    }
  );
}

/**
 * 진행 중인 일정 등록 Workflow에서 이전 메시지로 받은 값과
 * 현재 OpenAI Tool 입력값을 안전하게 병합한다.
 *
 * 현재 메시지의 값이 이전 값을 덮어쓰며,
 * schedule.create에서 허용하는 입력 필드만 이어받는다.
 */
function mergeScheduleCreateWorkflowInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  message:
    string;

  workSession:
    AiWorkSession;
}): Record<
  string,
  unknown
> {
  if (
    params.toolName !==
      "schedule.create" ||
    params.workSession
      .workflow
      .type !==
      "schedule_create"
  ) {
    return params.toolInput;
  }

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const previousInput:
    Record<
      string,
      unknown
    > = {};

  const previousStudentId =
    Number(
      workflowDraft.studentId ??
      params.workSession
        .linkedContext
        .studentId ??
      (
        params.workSession
          .activeTarget
          ?.type ===
        "student"
          ? params.workSession
              .activeTarget
              .id
          : 0
      )
    );

  if (
    Number.isInteger(
      previousStudentId
    ) &&
    previousStudentId >
      0
  ) {
    previousInput.studentId =
      previousStudentId;
  }

    const allowedFields = [
    "title",
    "description",
    "scheduleDate",
    "meridiem",
    "hour12",
    "minute",
    "isGlobal",
  ];

  const replacePreviousFields =
    hasExplicitUpdateScopeReplacement(
      params.message
    );

  if (
    !replacePreviousFields
  ) {
    for (
      const field of
      allowedFields
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          workflowDraft,
          field
        )
      ) {
        previousInput[field] =
          workflowDraft[field];
      }
    }
  }

  return normalizeOpenAiToolInput(
    "schedule.create",
    {
      ...previousInput,
      ...params.toolInput,
    }
  );
}

/**
 * 진행 중인 상담DB 수정 Workflow에서 이전 메시지로 받은 값과
 * 현재 OpenAI Tool 입력값을 안전하게 병합한다.
 *
 * 현재 메시지의 값이 이전 값을 덮어쓰며,
 * consultation.update에서 허용하는 필드만 이어받는다.
 */
function mergeConsultationUpdateWorkflowInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  message:
    string;

  workSession:
    AiWorkSession;
}): Record<
  string,
  unknown
> {
  if (
    params.toolName !==
      "consultation.update" ||
    params.workSession
      .workflow
      .type !==
      "consultation_update"
  ) {
    return params.toolInput;
  }

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const nestedUpdates =
    workflowDraft.updates &&
    typeof workflowDraft.updates ===
      "object" &&
    !Array.isArray(
      workflowDraft.updates
    )
      ? workflowDraft.updates as
          Record<
            string,
            unknown
          >
      : {};

  const previousInput:
    Record<
      string,
      unknown
    > = {};

  const previousConsultationId =
    Number(
      workflowDraft.consultationId ??
      params.workSession
        .linkedContext
        .consultationId ??
      (
        params.workSession
          .activeTarget
          ?.type ===
        "consultation"
          ? params.workSession
              .activeTarget
              .id
          : 0
      )
    );

  if (
    Number.isInteger(
      previousConsultationId
    ) &&
    previousConsultationId >
      0
  ) {
    previousInput.consultationId =
      previousConsultationId;
  }

  const allowedUpdateFields = [
    "status",
    "notes",
  ];

    const replacePreviousUpdateFields =
    hasExplicitUpdateScopeReplacement(
      params.message
    );

  if (
    !replacePreviousUpdateFields
  ) {
    for (
      const field of
      allowedUpdateFields
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          nestedUpdates,
          field
        )
      ) {
        previousInput[field] =
          nestedUpdates[field];

        continue;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          workflowDraft,
          field
        )
      ) {
        previousInput[field] =
          workflowDraft[field];
      }
    }
  }

  return normalizeOpenAiToolInput(
    "consultation.update",
    {
      ...previousInput,
      ...params.toolInput,
    }
  );
}

/**
 * 진행 중인 학생 수정 Workflow에서 이전 메시지로 받은 값과
 * 현재 OpenAI Tool 입력값을 안전하게 병합한다.
 *
 * 현재 메시지의 값이 이전 값을 덮어쓰며,
 * student.update에서 허용하는 필드만 이어받는다.
 */
function mergeStudentUpdateWorkflowInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  message:
    string;

  workSession:
    AiWorkSession;
}): Record<
  string,
  unknown
> {
  if (
    params.toolName !==
      "student.update" ||
    params.workSession
      .workflow
      .type !==
      "student_update"
  ) {
    return params.toolInput;
  }

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const nestedUpdates =
    workflowDraft.updates &&
    typeof workflowDraft.updates ===
      "object" &&
    !Array.isArray(
      workflowDraft.updates
    )
      ? workflowDraft.updates as
          Record<
            string,
            unknown
          >
      : {};

  const allowedUpdateFields =
    new Set([
      "status",
      "course",
      "finalEducation",
      "address",
      "detailAddress",
    ]);

  const previousInput:
    Record<
      string,
      unknown
    > = {};

  const previousStudentId =
    Number(
      workflowDraft.studentId ??
      params.workSession
        .linkedContext
        .studentId ??
      (
        params.workSession
          .activeTarget
          ?.type ===
        "student"
          ? params.workSession
              .activeTarget
              .id
          : 0
      )
    );

  if (
    Number.isInteger(
      previousStudentId
    ) &&
    previousStudentId >
      0
  ) {
    previousInput.studentId =
      previousStudentId;
  }

    const replacePreviousUpdateFields =
    hasExplicitUpdateScopeReplacement(
      params.message
    );

  if (
    !replacePreviousUpdateFields
  ) {
    for (
      const field of
      allowedUpdateFields
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          nestedUpdates,
          field
        )
      ) {
        previousInput[field] =
          nestedUpdates[field];

        continue;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          workflowDraft,
          field
        )
      ) {
        previousInput[field] =
          workflowDraft[field];
      }
    }
  }

    return normalizeOpenAiToolInput(
    "student.update",
    {
      ...previousInput,
      ...params.toolInput,
    }
  );
}

/**
 * 진행 중인 플랜 생성 Workflow에서
 * 이전 메시지로 받은 값과 현재 OpenAI Tool 입력값을 병합한다.
 *
 * 서버가 만든 draft 전용 값이나
 * assigneeId 같은 권한 필드는 절대로 이어받지 않는다.
 */
function mergePlanCreateWorkflowInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  message:
    string;

  workSession:
    AiWorkSession;
}): Record<
  string,
  unknown
> {
  if (
    params.toolName !==
      "plan.create" ||
    params.workSession
      .workflow
      .type !==
      "plan_setup"
  ) {
    return params.toolInput;
  }

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const previousInput:
    Record<
      string,
      unknown
    > = {};

  /**
   * 현재 선택된 학생을 계속 유지한다.
   */
  const previousStudentId =
    Number(
      workflowDraft.studentId ??
      params.workSession
        .linkedContext
        .studentId ??
      (
        params.workSession
          .activeTarget
          ?.type ===
        "student"
          ? params.workSession
              .activeTarget
              .id
          : 0
      )
    );

  if (
    Number.isInteger(
      previousStudentId
    ) &&
    previousStudentId >
      0
  ) {
    previousInput.studentId =
      previousStudentId;
  }

  /**
   * 사용자가 직접 입력할 수 있는
   * plan.create 필드만 이어받는다.
   */
  const allowedFields =
    new Set([
      "desiredCourse",
      "finalEducation",
      "hasPractice",
      "totalTheorySubjects",
      "requiredMajorCount",
      "electiveMajorCount",
      "liberalCount",
      "generalCount",
    ]);

  const replacePreviousFields =
    hasExplicitUpdateScopeReplacement(
      params.message
    );

  if (
    !replacePreviousFields
  ) {
    for (
      const field of
      allowedFields
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          workflowDraft,
          field
        )
      ) {
        previousInput[field] =
          workflowDraft[field];
      }
    }
  }

  return normalizeOpenAiToolInput(
    "plan.create",
    {
      ...previousInput,
      ...params.toolInput,
    }
  );
}

/**
 * 진행 중인 플랜 수정 Workflow에서
 * 이전 메시지로 받은 변경값과
 * 현재 OpenAI Tool 입력값을 병합한다.
 *
 * planId, assigneeId, originalValues 등
 * 서버가 생성하는 값은 절대로 이어받지 않는다.
 */
function mergePlanUpdateWorkflowInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  message:
    string;

  workSession:
    AiWorkSession;
}): Record<
  string,
  unknown
> {
  if (
    params.toolName !==
      "plan.update" ||
    params.workSession
      .workflow
      .type !==
      "plan_update"
  ) {
    return params.toolInput;
  }

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const previousInput:
    Record<
      string,
      unknown
    > = {};

const nestedUpdates =
  workflowDraft.updates &&
  typeof workflowDraft.updates ===
    "object" &&
  !Array.isArray(
    workflowDraft.updates
  )
    ? workflowDraft.updates as
        Record<
          string,
          unknown
        >
    : {};

  const previousStudentId =
    Number(
      workflowDraft.studentId ??
      params.workSession
        .linkedContext
        .studentId ??
      (
        params.workSession
          .activeTarget
          ?.type ===
        "student"
          ? params.workSession
              .activeTarget
              .id
          : 0
      )
    );

  if (
    Number.isInteger(
      previousStudentId
    ) &&
    previousStudentId >
      0
  ) {
    previousInput.studentId =
      previousStudentId;
  }

  const allowedFields =
    new Set([
      "desiredCourse",
      "finalEducation",
      "hasPractice",
      "totalTheorySubjects",
      "requiredMajorCount",
      "electiveMajorCount",
      "liberalCount",
      "generalCount",
    ]);

  const replacePreviousFields =
    hasExplicitUpdateScopeReplacement(
      params.message
    );

  if (
  !replacePreviousFields
) {
  for (
    const field of
    allowedFields
  ) {
    /**
     * 승인 초안 생성 이후에는
     * 변경값이 draft.updates 안에 들어간다.
     */
    if (
      Object.prototype.hasOwnProperty.call(
        nestedUpdates,
        field
      )
    ) {
      previousInput[field] =
        nestedUpdates[field];

      continue;
    }

    /**
     * 아직 collecting_data 단계인 경우에는
     * Workflow Draft 최상위 값을 이어받는다.
     */
    if (
      Object.prototype.hasOwnProperty.call(
        workflowDraft,
        field
      )
    ) {
      previousInput[field] =
        workflowDraft[field];
    }
  }
}

  return normalizeOpenAiToolInput(
    "plan.update",
    {
      ...previousInput,
      ...params.toolInput,
    }
  );
}

/**
 * 진행 중인 플랜 과목 생성 Workflow에서
 * 이전 메시지로 받은 studentId / subjects와
 * 현재 OpenAI Tool 입력값을 병합한다.
 *
 * assigneeId, planId, sortOrder,
 * originalPlanSubjectIds 같은 서버 생성값은
 * 절대로 이전 입력에서 복원하지 않는다.
 */
function mergePlanSubjectsCreateWorkflowInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  message:
    string;

  workSession:
    AiWorkSession;
}): Record<
  string,
  unknown
> {
  if (
    params.toolName !==
      "plan.subjects.create" ||
    params.workSession
      .workflow
      .type !==
      "plan_update"
  ) {
    return params.toolInput;
  }

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const previousInput:
    Record<
      string,
      unknown
    > = {};

  const previousStudentId =
    Number(
      workflowDraft.studentId ??
      params.workSession
        .linkedContext
        .studentId ??
      (
        params.workSession
          .activeTarget
          ?.type ===
        "student"
          ? params.workSession
              .activeTarget
              .id
          : 0
      )
    );

  if (
    Number.isInteger(
      previousStudentId
    ) &&
    previousStudentId >
      0
  ) {
    previousInput.studentId =
      previousStudentId;
  }

  const replacePreviousFields =
    hasExplicitUpdateScopeReplacement(
      params.message
    );

  /**
   * 현재 메시지에서 subjects를 새로 전달하지 않은 경우에만
   * 이전 메시지의 과목 목록을 유지한다.
   *
   * 새 subjects 배열이 들어오면
   * 기존 배열과 자동 합치지 않고 새 배열을 사용한다.
   * 중복 과목이 의도치 않게 누적되는 것을 방지한다.
   */
  if (
    !replacePreviousFields &&
    !Object.prototype.hasOwnProperty.call(
      params.toolInput,
      "subjects"
    ) &&
    Array.isArray(
      workflowDraft.subjects
    )
  ) {
    previousInput.subjects =
      workflowDraft.subjects;
  }

  return normalizeOpenAiToolInput(
    "plan.subjects.create",
    {
      ...previousInput,
      ...params.toolInput,
    }
  );
}

/**
 * 진행 중인 플랜 과목 수정 Workflow에서
 * 이전 메시지의 대상 과목과 수정값을
 * 현재 OpenAI Tool 입력과 병합한다.
 *
 * planId / assigneeId / originalValues 같은
 * 서버 생성 Snapshot 값은 복원하지 않는다.
 */
function mergePlanSubjectsUpdateWorkflowInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  message:
    string;

  workSession:
    AiWorkSession;
}): Record<
  string,
  unknown
> {
  if (
    params.toolName !==
      "plan.subjects.update" ||
    params.workSession
      .workflow
      .type !==
      "plan_update"
  ) {
    return params.toolInput;
  }

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const nestedUpdates =
    workflowDraft.updates &&
    typeof workflowDraft.updates ===
      "object" &&
    !Array.isArray(
      workflowDraft.updates
    )
      ? workflowDraft.updates as
          Record<
            string,
            unknown
          >
      : {};

  const previousInput:
    Record<
      string,
      unknown
    > = {};

  const previousStudentId =
    Number(
      workflowDraft.studentId ??
      params.workSession
        .linkedContext
        .studentId ??
      (
        params.workSession
          .activeTarget
          ?.type ===
        "student"
          ? params.workSession
              .activeTarget
              .id
          : 0
      )
    );

  if (
    Number.isInteger(
      previousStudentId
    ) &&
    previousStudentId >
      0
  ) {
    previousInput.studentId =
      previousStudentId;
  }

  /**
   * 수정 대상 과목 ID는
   * 승인 초안을 수정하는 동안 유지한다.
   */
  const previousPlanSubjectId =
    Number(
      workflowDraft.planSubjectId ??
      0
    );

  if (
    Number.isInteger(
      previousPlanSubjectId
    ) &&
    previousPlanSubjectId >
      0
  ) {
    previousInput.planSubjectId =
      previousPlanSubjectId;
  }

  const allowedFields =
    new Set([
      "semesterNo",
      "subjectName",
      "planCategory",
      "planRequirementType",
      "credits",
      "sortOrder",
      "settlementIncluded",
    ]);

  const replacePreviousFields =
    hasExplicitUpdateScopeReplacement(
      params.message
    );

  if (
    !replacePreviousFields
  ) {
    for (
      const field of
      allowedFields
    ) {
      /**
       * 승인카드 생성 이후에는
       * 수정값이 draft.updates 내부에 있다.
       */
      if (
        Object.prototype.hasOwnProperty.call(
          nestedUpdates,
          field
        )
      ) {
        previousInput[field] =
          nestedUpdates[field];

        continue;
      }

      /**
       * 아직 collecting_data 단계이면
       * 최상위 Draft 입력을 이어받는다.
       */
      if (
        Object.prototype.hasOwnProperty.call(
          workflowDraft,
          field
        )
      ) {
        previousInput[field] =
          workflowDraft[field];
      }
    }
  }

  return normalizeOpenAiToolInput(
    "plan.subjects.update",
    {
      ...previousInput,
      ...params.toolInput,
    }
  );
}

/**
 * 진행 중인 학기 생성 Workflow에서 이전 메시지로 받은 값과
 * 현재 OpenAI Tool 입력값을 안전하게 병합한다.
 *
 * 현재 메시지의 값이 이전 값을 덮어쓴다.
 * 서버가 생성한 초안 전용 값과 권한 관련 값은 병합하지 않는다.
 */
function mergeSemesterCreateWorkflowInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  message:
    string;

  workSession:
    AiWorkSession;
}): Record<
  string,
  unknown
> {
  if (
    params.toolName !==
      "semester.create" ||
    params.workSession
      .workflow
      .type !==
      "semester_create"
  ) {
    return params.toolInput;
  }

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const allowedFields =
    new Set([
      "semesterOrder",
      "semesterLabel",
      "plannedMonth",
      "plannedInstitution",
      "plannedSubjectCount",
      "plannedAmount",
      "startDate",
      "institution",
      "subjectCount",
      "paymentAmount",
      "paymentDate",
    ]);

  const previousInput:
    Record<
      string,
      unknown
    > = {};

  const previousStudentId =
    Number(
      workflowDraft.studentId ??
      params.workSession
        .linkedContext
        .studentId ??
      (
        params.workSession
          .activeTarget
          ?.type ===
        "student"
          ? params.workSession
              .activeTarget
              .id
          : 0
      )
    );

  if (
    Number.isInteger(
      previousStudentId
    ) &&
    previousStudentId >
      0
  ) {
    previousInput.studentId =
      previousStudentId;
  }

    const replacePreviousFields =
    shouldReplaceSemesterCreateFields(
      params.message
    );

  if (
    !replacePreviousFields
  ) {
    for (
      const field of
      allowedFields
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          workflowDraft,
          field
        )
      ) {
        previousInput[field] =
          workflowDraft[field];
      }
    }
  }

  const mergedInput = {
    ...previousInput,
    ...params.toolInput,
  };

  return normalizeOpenAiToolInput(
    "semester.create",
    mergedInput
  );
}

/**
 * 사용자가 현재 진행 중인 미완성 Workflow를
 * 명확하게 종료하거나 처음부터 다시 시작하려는지 판단한다.
 *
 * 문장 일부에 "취소"가 포함됐다는 이유만으로
 * 전체 Workflow를 초기화하지 않는다.
 *
 * 예:
 * - "교육원 변경은 취소하고 금액만 바꿔"
 * - "주소 말고 상세주소만 수정해"
 *
 * 위 문장들은 변경 범위 재지정이므로
 * Workflow 전체 초기화로 처리하면 안 된다.
 */
function isWorkflowResetMessage(
  message:
    string
): boolean {
  const normalizedMessage =
    String(
      message ||
      ""
    )
      .trim()
      .replace(
        /\s+/g,
        " "
      );

  if (
    !normalizedMessage
  ) {
    return false;
  }

  const exactResetMessages =
    new Set([
      "취소",
      "취소할게",
      "취소할래",
      "작업 취소",
      "작업 취소할게",
      "이 작업 취소",
      "이 작업 취소할게",
      "현재 작업 취소",
      "현재 작업 취소할게",
      "그만",
      "그만할게",
      "그만할래",
      "여기까지",
      "처음부터",
      "처음부터 다시",
      "처음부터 할게",
      "다시 시작",
      "다시 시작할게",
      "새로 시작",
      "새로 시작할게",
      "새로 할게",
      "다시 할게",
      "초기화",
      "초기화해줘",
      "초기화 해줘",
      "리셋",
      "리셋해줘",
      "리셋 해줘",
    ]);

  return exactResetMessages.has(
    normalizedMessage
  );
}

/**
 * 사용자가 이전 수정 초안에서 변경할 항목의 범위를
 * 다시 지정했는지 확인한다.
 *
 * 예:
 * - "주소 말고 최종학력만"
 * - "상태는 빼고 상담내용만"
 * - "나머지는 그대로 두고 주소만 수정"
 */
function hasExplicitUpdateScopeReplacement(
  message:
    string
): boolean {
  const normalizedMessage =
    String(
      message ||
      ""
    )
      .trim()
      .replace(
        /\s+/g,
        " "
      );

  if (
    !normalizedMessage
  ) {
    return false;
  }

  const replacementExpressions = [
    "말고",
    "제외하고",
    "빼고",
    "삭제하고",
    "취소하고",
    "나머지는 그대로",
    "나머진 그대로",
    "다른 건 그대로",
    "다른건 그대로",
    "그것만",
    "이것만",
    "해당 항목만",
    "해당항목만",
  ];

  return replacementExpressions.some(
    (
      expression
    ) =>
      normalizedMessage.includes(
        expression
      )
  );
}

/**
 * 사용자가 이전 학기 생성 초안에서 입력 범위를
 * 다시 지정했는지 확인한다.
 *
 * 예:
 * - "교육원 말고 금액만"
 * - "과목 수는 빼고 개강월만"
 * - "나머지는 그대로 두고 결제일만 수정"
 *
 * "52만원"처럼 금액 단위에 포함된 '만'은
 * 범위 재지정으로 판단하지 않는다.
 */
function shouldReplaceSemesterCreateFields(
  message:
    string
): boolean {
  const normalizedMessage =
    String(
      message ||
      ""
    )
      .trim()
      .replace(
        /\s+/g,
        " "
      );

  if (
    !normalizedMessage
  ) {
    return false;
  }

  if (
    hasExplicitUpdateScopeReplacement(
      normalizedMessage
    )
  ) {
    return true;
  }

  return /(?:학기\s*순서|학기\s*구분|개강\s*월|예정\s*교육원|실제\s*교육원|교육원|예정\s*과목\s*수|실제\s*과목\s*수|과목\s*수|예정\s*금액|결제\s*금액|금액|실제\s*개강일|개강일|시작일|결제일|날짜)\s*만\s*(?:바꿔|변경|수정|적용|해줘|해\s*줘|처리|생성)/.test(
    normalizedMessage
  );
}

/**
 * 사용자가 이전 학기 수정 초안의 변경 범위를 다시 지정했는지 확인한다.
 *
 * 예:
 * - "교육원 말고 금액만 바꿔"
 * - "날짜 제외하고 금액만 수정"
 * - "기존 교육원 변경은 빼고 결제일만"
 * - "나머지는 그대로 두고 날짜만 변경"
 *
 * 금액의 "52만원"처럼 숫자 단위에 포함된 '만'은
 * 범위 재지정 표현으로 처리하지 않는다.
 */
function shouldReplaceSemesterUpdateFields(
  message:
    string
): boolean {
  const normalizedMessage =
    String(
      message ||
      ""
    )
      .trim()
      .replace(
        /\s+/g,
        " "
      );

  if (
    !normalizedMessage
  ) {
    return false;
  }

    if (
    hasExplicitUpdateScopeReplacement(
      normalizedMessage
    )
  ) {
    return true;
  }

  /**
   * "금액만 바꿔", "결제일만 수정"처럼
   * 실제 학기 수정 필드 뒤에 붙는 '만'만 감지한다.
   *
   * "52만원"의 '만'은 이 정규식에 해당하지 않는다.
   */
  return /(?:학기\s*구분|개강\s*월|예정\s*교육원|실제\s*교육원|교육원|예정\s*과목\s*수|실제\s*과목\s*수|과목\s*수|예정\s*금액|실제\s*금액|결제\s*금액|금액|실제\s*개강일|개강일|결제일|날짜)\s*만\s*(?:바꿔|변경|수정|적용|해줘|해\s*줘|처리)/.test(
    normalizedMessage
  );
}

/**
 * 진행 중인 학기 입력완료 Workflow에서
 * 이전 메시지로 받은 학생과 학기 순서를 유지한다.
 *
 * semester.complete는 변경 필드가 없고,
 * studentId와 semesterOrder만 사용하는 단순 승인 초안이다.
 */
function mergeSemesterCompleteWorkflowInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  workSession:
    AiWorkSession;
}): Record<
  string,
  unknown
> {
  if (
    params.toolName !==
      "semester.complete" ||
    params.workSession
      .workflow
      .type !==
      "semester_complete"
  ) {
    return params.toolInput;
  }

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const previousInput:
    Record<
      string,
      unknown
    > = {};

  const previousStudentId =
    Number(
      workflowDraft.studentId ??
      params.workSession
        .linkedContext
        .studentId ??
      (
        params.workSession
          .activeTarget
          ?.type ===
        "student"
          ? params.workSession
              .activeTarget
              .id
          : 0
      )
    );

  if (
    Number.isInteger(
      previousStudentId
    ) &&
    previousStudentId >
      0
  ) {
    previousInput.studentId =
      previousStudentId;
  }

  const previousSemesterOrder =
    Number(
      workflowDraft.semesterOrder ??
      0
    );

  if (
    Number.isInteger(
      previousSemesterOrder
    ) &&
    previousSemesterOrder >=
      1 &&
    previousSemesterOrder <=
      20
  ) {
    previousInput.semesterOrder =
      previousSemesterOrder;
  }

  return normalizeOpenAiToolInput(
    "semester.complete",
    {
      ...previousInput,
      ...params.toolInput,
    }
  );
}

/**
 * 진행 중인 학기 수정 Workflow에서 이전 메시지로 받은 값과
 * 현재 OpenAI Tool 입력값을 안전하게 병합한다.
 *
 * 현재 메시지의 값이 이전 값을 덮어쓰며,
 * semester_update에서 허용하지 않는 필드는 포함하지 않는다.
 */
function mergeSemesterUpdateWorkflowInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  message:
    string;

  workSession:
    AiWorkSession;
}): Record<
  string,
  unknown
> {
  if (
    params.toolName !==
      "semester.update" ||
    params.workSession
      .workflow
      .type !==
      "semester_update"
  ) {
    return params.toolInput;
  }

  const workflowDraft =
    params.workSession
      .workflow
      .draft &&
    typeof params.workSession
      .workflow
      .draft ===
      "object" &&
    !Array.isArray(
      params.workSession
        .workflow
        .draft
    )
      ? params.workSession
          .workflow
          .draft as
            Record<
              string,
              unknown
            >
      : {};

  const nestedUpdates =
    workflowDraft.updates &&
    typeof workflowDraft.updates ===
      "object" &&
    !Array.isArray(
      workflowDraft.updates
    )
      ? workflowDraft.updates as
          Record<
            string,
            unknown
          >
      : {};

  const allowedUpdateFields =
    new Set([
      "semesterLabel",
      "plannedMonth",
      "plannedInstitution",
      "plannedSubjectCount",
      "plannedAmount",
      "actualStartDate",
      "actualInstitution",
      "actualSubjectCount",
      "actualAmount",
      "actualPaymentDate",
    ]);

  const previousInput:
    Record<
      string,
      unknown
    > = {};

  const previousStudentId =
    Number(
      workflowDraft.studentId ??
      params.workSession
        .linkedContext
        .studentId ??
      (
        params.workSession
          .activeTarget
          ?.type ===
        "student"
          ? params.workSession
              .activeTarget
              .id
          : 0
      )
    );

  if (
    Number.isInteger(
      previousStudentId
    ) &&
    previousStudentId >
      0
  ) {
    previousInput.studentId =
      previousStudentId;
  }

  const previousSemesterOrder =
    Number(
      workflowDraft.semesterOrder ??
      0
    );

  if (
    Number.isInteger(
      previousSemesterOrder
    ) &&
    previousSemesterOrder >=
      1 &&
    previousSemesterOrder <=
      20
  ) {
    previousInput.semesterOrder =
      previousSemesterOrder;
  }

    const replacePreviousUpdateFields =
    shouldReplaceSemesterUpdateFields(
      params.message
    );

  /**
   * 사용자가 변경 범위를 다시 지정하지 않은 경우에만
   * 기존 학기 수정값을 이어받는다.
   *
   * studentId와 semesterOrder는 변경 대상 필드가 아니라
   * 업무 대상을 식별하는 값이므로 항상 유지한다.
   */
  if (
    !replacePreviousUpdateFields
  ) {
    for (
      const field of
      allowedUpdateFields
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          nestedUpdates,
          field
        )
      ) {
        previousInput[field] =
          nestedUpdates[field];

        continue;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          workflowDraft,
          field
        )
      ) {
        previousInput[field] =
          workflowDraft[field];
      }
    }
  }

  const mergedInput = {
    ...previousInput,
    ...params.toolInput,
  };

  return normalizeOpenAiToolInput(
    "semester.update",
    mergedInput
  );
}

/**
 * 학생 종합조회 nextActions 중
 * 사용자에게 먼저 제시할 업무 하나를 선택한다.
 *
 * 동일 우선순위에서는 Tool 결과의 기존 순서를 유지한다.
 */
function selectPrimaryDashboardNextAction(
  value:
    unknown
): Record<
  string,
  unknown
> | null {
  if (
    !Array.isArray(
      value
    )
  ) {
    return null;
  }

  const actions =
    value.filter(
      (
        item
      ): item is
        Record<
          string,
          unknown
        > =>
        Boolean(
          item
        ) &&
        typeof item ===
          "object" &&
        !Array.isArray(
          item
        )
    );

  if (
    actions.length ===
      0
  ) {
    return null;
  }

  const priorityScore:
    Record<
      string,
      number
    > = {
      high:
        3,

      medium:
        2,

      low:
        1,
    };

  return actions
    .map(
      (
        action,
        index
      ) => ({
        action,

        index,

        score:
          priorityScore[
            String(
              action.priority ||
              ""
            )
          ] ||
          0,
      })
    )
    .sort(
      (
        left,
        right
      ) =>
        right.score -
          left.score ||
        left.index -
          right.index
    )[0]
    ?.action ||
    null;
}

/**
 * student.dashboard 결과에 포함된 다음 업무를
 * AI 업무 세션의 lastPresentedAction에 저장한다.
 *
 * 실제 변경 작업이나 Pending Action을 생성하지 않고,
 * 사용자의 다음 자연어 답변이 어떤 추천을 가리키는지
 * 확인하기 위한 문맥만 저장한다.
 */
function buildDashboardNextActionWorkSessionPatch(params: {
  toolInput:
    Record<
      string,
      unknown
    >;

  toolResult:
    AiToolExecutionResult<any>;

  workSession:
    AiWorkSession;
}): AiWorkSessionPatch | null {
  if (
    params.toolResult.success !==
      true
  ) {
    return null;
  }

  const data =
    params.toolResult.data &&
    typeof params.toolResult.data ===
      "object" &&
    !Array.isArray(
      params.toolResult.data
    )
      ? params.toolResult.data as
          Record<
            string,
            any
          >
      : {};

  const student =
    data.student &&
    typeof data.student ===
      "object" &&
    !Array.isArray(
      data.student
    )
      ? data.student as
          Record<
            string,
            unknown
          >
      : {};

  const studentId =
    Number(
      student.id ??
      data.studentId ??
      params.toolInput
        .studentId ??
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    return null;
  }

const clearPreviousWorkflow =
  shouldClearWorkflowForTargetChange({
    workSession:
      params.workSession,

    targetType:
      "student",

    targetId:
      studentId,
  });

  const studentName =
    String(
      student.clientName ??
      data.studentName ??
      ""
    ).trim() ||
    null;

  const nextActions =
  Array.isArray(
    data.nextActions
  )
    ? data.nextActions
    : [];

/**
 * 사용자 답변에 표시되는 실제 배열 순서를
 * displayIndex와 함께 저장한다.
 *
 * "첫 번째", "두 번째" 같은 후속 요청은
 * 이 번호를 기준으로 해석한다.
 */
const presentedNextActions =
  nextActions
    .filter(
      (
        action
      ) =>
        Boolean(
          action
        ) &&
        typeof action ===
          "object" &&
        !Array.isArray(
          action
        )
    )
    .slice(
      0,
      10
    )
    .map(
      (
        action,
        index
      ) => ({
        ...action,

        displayIndex:
          index + 1,
      })
    );

const primaryAction =
  selectPrimaryDashboardNextAction(
    presentedNextActions
  );

  /**
   * 추천할 다음 업무가 없으면
   * 이전에 저장된 추천 업무가 남지 않도록 비운다.
   */
  if (
    !primaryAction
  ) {
    return {
      activeTarget: {
        type:
          "student",

        id:
          Math.floor(
            studentId
          ),

        name:
          studentName,
      },

      linkedContext: {
        studentId:
          Math.floor(
            studentId
          ),
      },

      lastPresentedAction:
        null,

...(
  clearPreviousWorkflow
    ? {
        workflow:
          buildClearedWorkflowPatch(),
      }
    : {}
),
    };
  }

  const actionCode =
    String(
      primaryAction.code ||
      "next_action"
    )
      .trim()
      .slice(
        0,
        100
      ) ||
    "next_action";

  const expiresAt =
    new Date(
      Date.now() +
      DASHBOARD_NEXT_ACTION_EXPIRES_MS
    ).toISOString();

  return {
    activeTarget: {
      type:
        "student",

      id:
        Math.floor(
          studentId
        ),

      name:
        studentName,
    },

    linkedContext: {
      studentId:
        Math.floor(
          studentId
        ),
    },

    lastPresentedAction: {
      actionId:
        `student-dashboard-${Math.floor(
          studentId
        )}-${actionCode}`,

      actionType:
        "student_dashboard_next_action",

      targetType:
        "student",

      targetId:
        Math.floor(
          studentId
        ),

      payload: {
        studentId:
          Math.floor(
            studentId
          ),

        studentName,

        recommendedAction: {
  ...primaryAction,

  isPrimaryRecommendation:
    true,
},

        nextActions:
  presentedNextActions,

        sourceTool:
          "student.dashboard",

        generatedAt:
          String(
            data.generatedAt ||
            new Date()
              .toISOString()
          ),
      },

      expiresAt,
    },
...(
  clearPreviousWorkflow
    ? {
        workflow:
          buildClearedWorkflowPatch(),
      }
    : {}
),
  };
}

/**
 * 조회 Tool 실행 결과에서 확정된 학생 또는 상담 대상을
 * AI 업무 세션의 현재 작업 대상으로 저장한다.
 *
 * 검색 결과가 여러 건이면 임의로 대상을 선택하지 않는다.
 * 학생 단위 조회 Tool은 확정된 studentId를 기준으로 저장한다.
 */
function buildReadTargetWorkSessionPatch(params: {
  toolName:
    AiToolName;

  toolInput:
    Record<
      string,
      unknown
    >;

  toolResult:
    AiToolExecutionResult<any>;

  workSession:
    AiWorkSession;
}): AiWorkSessionPatch | null {
  if (
    params.toolResult.success !==
      true
  ) {
    return null;
  }

  const data =
    params.toolResult.data &&
    typeof params.toolResult.data ===
      "object" &&
    !Array.isArray(
      params.toolResult.data
    )
      ? params.toolResult.data as
          Record<
            string,
            any
          >
      : {};

/**
 * 학생 종합조회는 현재 학생뿐 아니라
 * 사용자에게 제시한 다음 업무까지 함께 저장한다.
 */
if (
  params.toolName ===
    "student.dashboard"
) {
  return buildDashboardNextActionWorkSessionPatch({
  toolInput:
    params.toolInput,

  toolResult:
    params.toolResult,

  workSession:
    params.workSession,
});
}

  /**
   * 학생 검색은 결과가 정확히 한 명일 때만
   * 현재 학생으로 확정한다.
   */
  if (
    params.toolName ===
      "student.search"
  ) {
    const students =
      Array.isArray(
        data.students
      )
        ? data.students
        : [];

    const count =
      Number(
        data.count ??
        students.length
      );

    if (
      count !== 1 ||
      students.length !==
        1
    ) {
      return null;
    }

    const student =
      students[0];

    const studentId =
      Number(
        student?.id ||
        0
      );

    if (
      !Number.isFinite(
        studentId
      ) ||
      studentId <= 0
    ) {
      return null;
    }

    const studentName =
      String(
        student?.clientName ||
        ""
      ).trim() ||
      null;

const clearPreviousDashboardAction =
  shouldClearDashboardNextActionForTarget({
    workSession:
      params.workSession,

    targetType:
      "student",

    targetId:
      studentId,
  });

const clearPreviousWorkflow =
  shouldClearWorkflowForTargetChange({
    workSession:
      params.workSession,

    targetType:
      "student",

    targetId:
      studentId,
  });

   return {
  activeTarget: {
    type:
      "student",

    id:
      Math.floor(
        studentId
      ),

    name:
      studentName,
  },

  linkedContext: {
  studentId:
    Math.floor(
      studentId
    ),
},

...(
  clearPreviousDashboardAction
    ? {
        lastPresentedAction:
          null,
      }
    : {}
),

...(
  clearPreviousWorkflow
    ? {
        workflow:
          buildClearedWorkflowPatch(),
      }
    : {}
),
};
  }

  /**
   * 상담 검색 역시 결과가 정확히 한 건일 때만
   * 현재 상담 대상으로 확정한다.
   */
  if (
    params.toolName ===
      "consultation.search"
  ) {
    const consultations =
      Array.isArray(
        data.consultations
      )
        ? data.consultations
        : [];

    const count =
      Number(
        data.count ??
        consultations.length
      );

    if (
      count !== 1 ||
      consultations.length !==
        1
    ) {
      return null;
    }

    const consultation =
      consultations[0];

    const consultationId =
      Number(
        consultation?.id ||
        0
      );

    if (
      !Number.isFinite(
        consultationId
      ) ||
      consultationId <= 0
    ) {
      return null;
    }

    const consultationName =
      String(
        consultation
          ?.clientName ||
        ""
      ).trim() ||
      null;

const clearPreviousDashboardAction =
  shouldClearDashboardNextActionForTarget({
    workSession:
      params.workSession,

    targetType:
      "consultation",

    targetId:
      consultationId,
  });

const clearPreviousWorkflow =
  shouldClearWorkflowForTargetChange({
    workSession:
      params.workSession,

    targetType:
      "consultation",

    targetId:
      consultationId,
  });

    return {
  activeTarget: {
    type:
      "consultation",

    id:
      Math.floor(
        consultationId
      ),

    name:
      consultationName,
  },

  linkedContext: {
  consultationId:
    Math.floor(
      consultationId
    ),
},

...(
  clearPreviousDashboardAction
    ? {
        lastPresentedAction:
          null,
      }
    : {}
),

...(
  clearPreviousWorkflow
    ? {
        workflow:
          buildClearedWorkflowPatch(),
      }
    : {}
),
};
  }

  /**
   * 학생 단위 조회 Tool은 Tool 입력 또는 결과의
   * 실제 studentId를 사용한다.
   */
  const studentTargetTools =
    new Set([
      "student.summary",
      "student.dashboard",
      "risk.studentDetail",
      "practice.institutionSearch",
      "practice.supportStatus",
    ]);

  if (
    !studentTargetTools.has(
      params.toolName
    )
  ) {
    return null;
  }

  const resultStudent =
    data.student &&
    typeof data.student ===
      "object" &&
    !Array.isArray(
      data.student
    )
      ? data.student as
          Record<
            string,
            unknown
          >
      : {};

  const studentId =
    Number(
      resultStudent.id ??
      data.studentId ??
      params.toolInput
        .studentId ??
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    return null;
  }

  const studentName =
    String(
      resultStudent
        .clientName ??
      data.studentName ??
      ""
    ).trim() ||
    null;

const clearPreviousDashboardAction =
  shouldClearDashboardNextActionForTarget({
    workSession:
      params.workSession,

    targetType:
      "student",

    targetId:
      studentId,
  });

const clearPreviousWorkflow =
  shouldClearWorkflowForTargetChange({
    workSession:
      params.workSession,

    targetType:
      "student",

    targetId:
      studentId,
  });

  return {
  activeTarget: {
    type:
      "student",

    id:
      Math.floor(
        studentId
      ),

    name:
      studentName,
  },

  linkedContext: {
  studentId:
    Math.floor(
      studentId
    ),
},

...(
  clearPreviousDashboardAction
    ? {
        lastPresentedAction:
          null,
      }
    : {}
),

...(
  clearPreviousWorkflow
    ? {
        workflow:
          buildClearedWorkflowPatch(),
      }
    : {}
),
};
}

/**
 * 실제 DB를 즉시 변경하지는 않지만
 * 사용자 승인용 변경 초안을 만드는 Tool인지 확인한다.
 */
function isAiDraftTool(
  toolName:
    string
): boolean {
        return [
  "student.update",
  "plan.create",
  "plan.update",
  "plan.subjects.create",
  "plan.subjects.update",
  "semester.create",
    "semester.update",
    "semester.complete",
    "consultation.create",
    "consultation.update",
    "schedule.create",
  ].includes(
    toolName
  );
}

/**
 * 현재 단계에서 OpenAI가 호출할 수 있는 Tool인지 확인한다.
 *
 * read:
 * 자동 실행 가능한 조회 Tool만 허용한다.
 *
 * draft:
 * 실제 DB를 즉시 변경하지 않고
 * 승인 초안만 생성하는 허용 Tool만 사용한다.
 *
 * write/system:
 * OpenAI 자동 Tool Calling 대상에서 제외한다.
 */
function isOpenAiCallableTool(
  tool:
    RegisteredAiToolForRunner
): boolean {
  if (
    !tool.inputSchema
  ) {
    return false;
  }

  if (
    tool.accessMode ===
    "read"
  ) {
    return (
      tool.autoExecutable ===
      true
    );
  }

        if (
    tool.accessMode ===
    "draft"
  ) {
    return (
    tool.name ===
  "schedule.create" ||
tool.name ===
  "plan.create" ||
tool.name ===
  "plan.update" ||
tool.name ===
  "plan.subjects.create" ||
tool.name ===
  "plan.subjects.update" ||
tool.name ===
  "semester.create" ||
  tool.name ===
    "semester.update" ||
  tool.name ===
    "semester.complete" ||
  tool.name ===
    "consultation.create" ||
  tool.name ===
    "consultation.update" ||
  tool.name ===
    "student.update"
);
  }

  return false;
}

/**
 * 현재 로그인 사용자의 권한으로 사용할 수 있는
 * CRM Tool만 OpenAI Function Tool 형식으로 변환한다.
 *
 * Tool 입력 스키마에 없는 서버 권한값은
 * OpenAI가 생성할 수 없다.
 */
function buildOpenAiFunctionTools(params: {
  context:
    AiUserContext;
}): OpenAiFunctionTool[] {
  const registeredTools =
    listRegisteredAiTools() as
      RegisteredAiToolForRunner[];

if (
  params.context.role ===
  "superhost"
) {
  return [];
}

  /**
   * 현재 로그인 사용자에게 실제로 노출할
   * OpenAI 호출 가능 Tool만 먼저 선별한다.
   */
  const callableTools =
  registeredTools
    .filter(
      (
        tool
      ) =>
        tool.allowedRoles.includes(
          params.context.role
        )
    )
    .filter(
      (
        tool
      ) =>
        isOpenAiCallableTool(
          tool
        )
    )
    .filter(
      (
        tool
      ) => {
        /**
         * 조회 Tool은 역할과 Registry 정책이
         * 허용하면 노출한다.
         */
        if (
          tool.accessMode ===
          "read"
        ) {
          return true;
        }

        /**
         * 변경 초안 Tool은 현재 사용자에게
         * 실제 쓰기 권한이 있을 때만 노출한다.
         */
        if (
          isAiDraftTool(
            tool.name
          )
        ) {
          return (
            params.context.canWrite ===
            true
          );
        }

        return false;
      }
    );

  /**
   * 실제 노출 Tool끼리 OpenAI 이름이
   * 중복되지 않는지 확인한다.
   */
  const openAiToolNameMap =
    new Map<
      string,
      string
    >();

  for (
    const tool of
    callableTools
  ) {
    const openAiName =
      toOpenAiToolName(
        tool.name
      );

    const existingName =
      openAiToolNameMap.get(
        openAiName
      );

    if (
      existingName &&
      existingName !==
        tool.name
    ) {
      throw new Error(
        `OpenAI Tool 이름 충돌: ${existingName}, ${tool.name} → ${openAiName}`
      );
    }

    /**
     * 가상 등록 미리보기 Tool 이름과도
     * 충돌하지 않도록 막는다.
     */
    if (
  openAiName ===
    STUDENT_REGISTRATION_PREVIEW_TOOL ||
  openAiName ===
    DOCUMENT_IMPORT_PREVIEW_TOOL
) {
  throw new Error(
    `Registry Tool 이름이 가상 미리보기 Tool과 충돌합니다: ${tool.name} → ${openAiName}`
  );
}

    openAiToolNameMap.set(
      openAiName,
      tool.name
    );
  }

  return callableTools.map(
    (
      tool
    ) => ({
      type:
        "function" as const,

      name:
        toOpenAiToolName(
          tool.name
        ),

      description:
        tool.description,

      parameters:
        tool.inputSchema as
          AiToolInputSchema,

      strict:
        false,
    })
  );
}

/**
 * 등록예정 학생 생성 및 과목설계 미리보기를
 * 사용할 수 있는 사용자인지 확인한다.
 *
 * Superhost에는 학생·상담 관련 Tool을 제공하지 않는다.
 */
function canUseStudentRegistrationPreview(
  context:
    AiUserContext
): boolean {
  if (
    context.role ===
    "superhost"
  ) {
    return false;
  }

  if (
    context.canWrite !==
    true
  ) {
    return false;
  }

  return [
    "staff",
    "admin",
    "host",
  ].includes(
    context.role
  );
}

/**
 * 학생 등록, 등록예정 전환, 학기 및 과목설계 요청은
 * 실제 DB에 바로 저장하지 않는다.
 *
 * OpenAI가 해당 요청을 구분하면
 * 기존 registrationPreview 흐름으로 전달한다.
 */
function buildStudentRegistrationPreviewTool():
  OpenAiFunctionTool {
  return {
    type:
      "function",

    name:
      STUDENT_REGISTRATION_PREVIEW_TOOL,

    description:
      "상담DB의 등록예정 회원을 학생으로 생성하거나 학기, 과목설계, 플랜 생성을 준비하는 사용자 확인용 미리보기입니다. 실제 저장이나 DB 변경을 실행하지 않습니다.",

    parameters: {
      type:
        "object",

      properties: {
        consultationId: {
          type: [
            "integer",
            "null",
          ],

          description:
            "사용자가 명확하게 말한 상담DB ID. 확인할 수 없으면 null",
        },
      },

      required: [],

      additionalProperties:
        false,
    },

    strict:
      false,
  };
}

/**
 * 최근 OCR 분석 결과를
 * 선택된 학생 CRM에 반영하기 위한
 * 사용자 승인 미리보기 가상 Tool
 *
 * 중요:
 * - OCR 분석 결과 자체를 arguments로 받지 않는다.
 * - 최근 분석 결과는 서버 recentDocument를 최종 기준으로 사용한다.
 * - 실제 DB 변경은 하지 않는다.
 */
function buildDocumentImportPreviewTool():
  OpenAiFunctionTool {
  return {
    type:
      "function",

    name:
      DOCUMENT_IMPORT_PREVIEW_TOOL,

    description:
      "직전에 분석한 OCR 문서 결과를 확정된 학생 CRM에 반영하기 위한 승인 미리보기를 준비합니다. 실제 CRM 데이터는 즉시 변경하지 않습니다. recentDocument가 존재하고 사용자가 반영, 등록, 넣어달라는 실행 의도를 명확하게 표현한 경우에만 사용합니다.",

    parameters: {
      type:
        "object",

      properties: {
        studentId: {
          type: [
            "integer",
            "null",
          ],

          description:
            "문서 분석 결과를 반영할 확정된 학생 ID입니다. 현재 선택 학생이 확정되어 있으면 그 학생 ID를 사용합니다. 학생이 확정되지 않았으면 추측하지 말고 null로 둡니다.",
        },
      },

      required: [],

      additionalProperties:
        false,
    },

    strict:
      false,
  };
}

/**
 * 실제 Registry Tool 이름을
 * 기존 프론트 및 Router가 사용하는 intent로 변환한다.
 */
function getIntentFromToolName(
  toolName:
    string
): AiRunnerIntent {
  switch (
    toolName
  ) {
    case "student.search":
      return "student_search";

    case "student.summary":
      return "student_summary";

    case "student.dashboard":
      return "student_dashboard";

       case "student.update":
  return "student_update";

case "plan.create":
  return "plan_create";

case "plan.update":
  return "plan_update";

case "plan.subjects.create":
  return "plan_subjects_create";

case "plan.subjects.update":
  return "plan_subjects_update";

case "semester.create":
  return "semester_create";

    case "semester.update":
      return "semester_update";

    case "semester.complete":
      return "semester_complete";

    case "consultation.search":
      return "consultation_search";

    case "consultation.create":
      return "consultation_create";

    case "consultation.update":
      return "consultation_update";

    case "alert.missingData":
      return "missing_data";

    case "risk.studentDetail":
      return "student_detail_risk";

           case "risk.studentList":
      return "student_list_risk";

    case "practice.institutionSearch":
      return "practice_institution_search";

    case "practice.supportStatus":
      return "practice_support_status";

    case "schedule.create":
  return "schedule_create";

case "document.analysis":
  return "document_analysis";

case "settlement.summary":
  return "settlement_summary";

default:
  return "general_help";
  }
}

/**
 * OpenAI가 반환한 Tool 이름이
 * 이번 요청에서 실제 제공된 Tool인지 확인한다.
 *
 * 최종 실행 단계에서도 executeAiTool()이 다시 검사하지만,
 * Runner에서도 먼저 차단한다.
 */
function assertOpenAiToolWasProvided(params: {
  toolName:
    string;

  tools:
    OpenAiFunctionTool[];
}) {
  const provided =
    params.tools.some(
      (
        tool
      ) =>
        tool.name ===
        params.toolName
    );

  if (!provided) {
    throw new Error(
      `OpenAI에 제공되지 않은 Tool 요청입니다: ${params.toolName}`
    );
  }
}

/**
 * OpenAI Function Call arguments를
 * 안전한 일반 객체로 변환한다.
 */
function parseOpenAiToolArguments(
  value:
    unknown
): Record<
  string,
  unknown
> {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  if (
    typeof value !==
      "string"
  ) {
    return {};
  }

  try {
    const parsed =
      JSON.parse(
        value
      );

    if (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(
        parsed
      )
    ) {
      return parsed as Record<
        string,
        unknown
      >;
    }

    return {};
  } catch {
    throw new Error(
      "OpenAI Tool 입력값을 해석할 수 없습니다."
    );
  }
}

/**
 * OpenAI가 Tool arguments에 생성하면 안 되는
 * 서버 권한 및 테넌트 관련 필드를 제거한다.
 *
 * 실제 권한값은 항상 서버 context에서만 가져온다.
 */
function removeForbiddenOpenAiToolFields(
  input:
    Record<
      string,
      unknown
    >
): Record<
  string,
  unknown
> {
  const forbiddenFields =
    new Set([
      "organizationId",
      "organization_id",
      "userId",
      "user_id",
      "teamId",
      "team_id",
      "assigneeId",
      "assignee_id",
      "role",
      "scope",
      "canWrite",
      "allowedRoles",
      "requestedByUserId",
      "requestedByRole",
    ]);

  return Object.fromEntries(
    Object.entries(
      input
    ).filter(
      (
        [key]
      ) =>
        !forbiddenFields.has(
          key
        )
    )
  );
}

/**
 * OpenAI Tool 입력의 공통 숫자값을
 * 안전한 범위로 정규화한다.
 */
function normalizeOpenAiToolInput(
  toolName:
    string,

  input:
    Record<
      string,
      unknown
    >
): Record<
  string,
  unknown
> {
  const normalized = {
    ...input,
  };

  if (
    "studentId" in
      normalized
  ) {
    const studentId =
      Number(
        normalized.studentId
      );

    if (
      Number.isFinite(
        studentId
      ) &&
      studentId > 0
    ) {
      normalized.studentId =
        Math.floor(
          studentId
        );
    } else {
      delete normalized.studentId;
    }
  }

  if (
    "consultationId" in
      normalized
  ) {
    const consultationId =
      Number(
        normalized.consultationId
      );

    if (
      Number.isFinite(
        consultationId
      ) &&
      consultationId > 0
    ) {
      normalized.consultationId =
        Math.floor(
          consultationId
        );
    } else {
      normalized.consultationId =
        null;
    }
  }

  if (
    "limit" in
      normalized
  ) {
    const limit =
      Number(
        normalized.limit
      );

    normalized.limit =
      Number.isFinite(
        limit
      )
        ? Math.min(
            Math.max(
              Math.floor(
                limit
              ),
              1
            ),
            100
          )
        : 20;
  }

  if (
    toolName ===
      "schedule.create"
  ) {
    const hour12 =
      Number(
        normalized.hour12
      );

    const minute =
      Number(
        normalized.minute
      );

    if (
      !Number.isFinite(
        hour12
      ) ||
      hour12 < 1 ||
      hour12 > 12
    ) {
      delete normalized.hour12;
    } else {
      normalized.hour12 =
        Math.floor(
          hour12
        );
    }

    if (
      !Number.isFinite(
        minute
      ) ||
      minute < 0 ||
      minute > 59
    ) {
      delete normalized.minute;
    } else {
      normalized.minute =
        Math.floor(
          minute
        );
    }

        normalized.isGlobal =
      normalized.isGlobal ===
        true;
  }

  if (
    toolName ===
      "plan.create"
  ) {
    const textFields = [
      "desiredCourse",
      "finalEducation",
    ];

    for (
      const field of
      textFields
    ) {
      if (
        !Object.prototype.hasOwnProperty.call(
          normalized,
          field
        )
      ) {
        continue;
      }

      if (
        normalized[field] ===
        null
      ) {
        continue;
      }

      const value =
        String(
          normalized[field] ||
          ""
        ).trim();

      if (
        value
      ) {
        normalized[field] =
          value;
      } else {
        delete normalized[field];
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        normalized,
        "hasPractice"
      )
    ) {
      if (
        normalized.hasPractice !==
          true &&
        normalized.hasPractice !==
          false &&
        normalized.hasPractice !==
          null
      ) {
        delete normalized.hasPractice;
      }
    }

    const countFields = [
      "totalTheorySubjects",
      "requiredMajorCount",
      "electiveMajorCount",
      "liberalCount",
      "generalCount",
    ];

    for (
      const field of
      countFields
    ) {
      if (
        !Object.prototype.hasOwnProperty.call(
          normalized,
          field
        )
      ) {
        continue;
      }

      if (
        normalized[field] ===
        null
      ) {
        continue;
      }

      const value =
        Number(
          normalized[field]
        );

      if (
        Number.isInteger(
          value
        ) &&
        value >=
          0
      ) {
        normalized[field] =
          value;
      } else {
        delete normalized[field];
      }
    }
  }

  if (
    toolName ===
      "plan.update"
  ) {
    const textFields = [
      "desiredCourse",
      "finalEducation",
    ];

    for (
      const field of
      textFields
    ) {
      if (
        !Object.prototype.hasOwnProperty.call(
          normalized,
          field
        )
      ) {
        continue;
      }

      if (
        normalized[field] ===
        null
      ) {
        continue;
      }

      const value =
        String(
          normalized[field] ||
          ""
        ).trim();

      normalized[field] =
        value ||
        null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        normalized,
        "hasPractice"
      )
    ) {
      if (
        typeof normalized.hasPractice !==
        "boolean"
      ) {
        delete normalized.hasPractice;
      }
    }

    const numericFields = [
      "totalTheorySubjects",
      "requiredMajorCount",
      "electiveMajorCount",
      "liberalCount",
      "generalCount",
    ];

    for (
      const field of
      numericFields
    ) {
      if (
        !Object.prototype.hasOwnProperty.call(
          normalized,
          field
        )
      ) {
        continue;
      }

      const value =
        Number(
          normalized[field]
        );

      if (
        Number.isInteger(
          value
        ) &&
        value >=
          0
      ) {
        normalized[field] =
          value;
      } else {
        delete normalized[field];
      }
    }
  }


  if (
    toolName ===
      "plan.subjects.create"
  ) {
    if (
      Array.isArray(
        normalized.subjects
      )
    ) {
      normalized.subjects =
        normalized.subjects
          .map(
            (
              rawSubject
            ) => {
              if (
                !rawSubject ||
                typeof rawSubject !==
                  "object" ||
                Array.isArray(
                  rawSubject
                )
              ) {
                return null;
              }

              const source =
                rawSubject as
                  Record<
                    string,
                    unknown
                  >;

              const subject:
                Record<
                  string,
                  unknown
                > =
                {};

              const semesterNo =
                Number(
                  source.semesterNo
                );

              if (
                Number.isInteger(
                  semesterNo
                ) &&
                semesterNo >=
                  1 &&
                semesterNo <=
                  20
              ) {
                subject.semesterNo =
                  semesterNo;
              }

              const subjectName =
                String(
                  source.subjectName ||
                  ""
                )
                  .trim()
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .slice(
                    0,
                    255
                  );

              if (
                subjectName
              ) {
                subject.subjectName =
                  subjectName;
              }

              const planCategory =
                String(
                  source.planCategory ||
                  ""
                ).trim();

              if (
                planCategory ===
                  "전공" ||
                planCategory ===
                  "교양" ||
                planCategory ===
                  "일반"
              ) {
                subject.planCategory =
                  planCategory;
              }

              const planRequirementType =
                String(
                  source.planRequirementType ||
                  ""
                ).trim();

              if (
                planRequirementType ===
                  "전공필수" ||
                planRequirementType ===
                  "전공선택" ||
                planRequirementType ===
                  "교양" ||
                planRequirementType ===
                  "일반"
              ) {
                subject.planRequirementType =
                  planRequirementType;
              }

              const credits =
                Number(
                  source.credits
                );

              if (
                Number.isInteger(
                  credits
                ) &&
                credits >=
                  1 &&
                credits <=
                  10
              ) {
                subject.credits =
                  credits;
              }

              if (
                source.settlementIncluded ===
                  true ||
                source.settlementIncluded ===
                  false ||
                source.settlementIncluded ===
                  null
              ) {
                subject.settlementIncluded =
                  source.settlementIncluded;
              }

              return subject;
            }
          )
          .filter(
            (
              subject
            ) =>
              subject !==
              null
          );
    } else {
      delete normalized.subjects;
    }
  }

  if (
    toolName ===
      "plan.subjects.update"
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        normalized,
        "planSubjectId"
      )
    ) {
      const planSubjectId =
        Number(
          normalized.planSubjectId
        );

      if (
        Number.isInteger(
          planSubjectId
        ) &&
        planSubjectId >
          0
      ) {
        normalized.planSubjectId =
          planSubjectId;
      } else {
        delete normalized.planSubjectId;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        normalized,
        "semesterNo"
      )
    ) {
      const semesterNo =
        Number(
          normalized.semesterNo
        );

      if (
        Number.isInteger(
          semesterNo
        ) &&
        semesterNo >=
          1 &&
        semesterNo <=
          20
      ) {
        normalized.semesterNo =
          semesterNo;
      } else {
        delete normalized.semesterNo;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        normalized,
        "subjectName"
      )
    ) {
      const subjectName =
        String(
          normalized.subjectName ||
          ""
        )
          .trim()
          .replace(
            /\s+/g,
            " "
          )
          .slice(
            0,
            255
          );

      if (
        subjectName
      ) {
        normalized.subjectName =
          subjectName;
      } else {
        delete normalized.subjectName;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        normalized,
        "planCategory"
      )
    ) {
      const planCategory =
        String(
          normalized.planCategory ||
          ""
        ).trim();

      if (
        planCategory ===
          "전공" ||
        planCategory ===
          "교양" ||
        planCategory ===
          "일반"
      ) {
        normalized.planCategory =
          planCategory;
      } else {
        delete normalized.planCategory;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        normalized,
        "planRequirementType"
      )
    ) {
      const requirementType =
        String(
          normalized
            .planRequirementType ||
          ""
        ).trim();

      if (
        requirementType ===
          "전공필수" ||
        requirementType ===
          "전공선택" ||
        requirementType ===
          "교양" ||
        requirementType ===
          "일반"
      ) {
        normalized.planRequirementType =
          requirementType;
      } else {
        delete normalized.planRequirementType;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        normalized,
        "credits"
      )
    ) {
      const credits =
        Number(
          normalized.credits
        );

      if (
        Number.isInteger(
          credits
        ) &&
        credits >=
          1 &&
        credits <=
          10
      ) {
        normalized.credits =
          credits;
      } else {
        delete normalized.credits;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        normalized,
        "sortOrder"
      )
    ) {
      const sortOrder =
        Number(
          normalized.sortOrder
        );

      if (
        Number.isInteger(
          sortOrder
        ) &&
        sortOrder >=
          0
      ) {
        normalized.sortOrder =
          sortOrder;
      } else {
        delete normalized.sortOrder;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        normalized,
        "settlementIncluded"
      ) &&
      typeof normalized
        .settlementIncluded !==
        "boolean"
    ) {
      delete normalized
        .settlementIncluded;
    }
  }


  if (
    toolName ===
      "semester.create"
  ) {
    if (
      "semesterOrder" in
        normalized
    ) {
      const semesterOrder =
        Number(
          normalized.semesterOrder
        );

      if (
        Number.isInteger(
          semesterOrder
        ) &&
        semesterOrder >=
          1 &&
        semesterOrder <=
          20
      ) {
        normalized.semesterOrder =
          semesterOrder;
      } else {
        delete normalized.semesterOrder;
      }
    }

    if (
      "semesterLabel" in
        normalized
    ) {
      const semesterLabel =
        String(
          normalized.semesterLabel ||
          ""
        ).trim();

      if (
        semesterLabel
      ) {
        normalized.semesterLabel =
          semesterLabel;
      } else {
        delete normalized.semesterLabel;
      }
    }
  }

  if (
    toolName ===
      "semester.update"
  ) {
    if (
      "semesterOrder" in
        normalized
    ) {
      const semesterOrder =
        Number(
          normalized.semesterOrder
        );

      if (
        Number.isInteger(
          semesterOrder
        ) &&
        semesterOrder >=
          1 &&
        semesterOrder <=
          20
      ) {
        normalized.semesterOrder =
          semesterOrder;
      } else {
        delete normalized.semesterOrder;
      }
    }

    const nullableTextFields = [
      "semesterLabel",
      "plannedMonth",
      "plannedInstitution",
      "actualStartDate",
      "actualInstitution",
      "actualPaymentDate",
    ];

    for (
      const field of
      nullableTextFields
    ) {
      if (
        !Object.prototype.hasOwnProperty.call(
          normalized,
          field
        )
      ) {
        continue;
      }

      if (
        normalized[field] ===
        null
      ) {
        continue;
      }

      const value =
        String(
          normalized[field] ||
          ""
        ).trim();

      if (
        value
      ) {
        normalized[field] =
          value;
      } else {
        delete normalized[field];
      }
    }

    const nullableIntegerFields = [
      "plannedSubjectCount",
      "actualSubjectCount",
    ];

    for (
      const field of
      nullableIntegerFields
    ) {
      if (
        !Object.prototype.hasOwnProperty.call(
          normalized,
          field
        )
      ) {
        continue;
      }

      if (
        normalized[field] ===
        null
      ) {
        continue;
      }

      const value =
        Number(
          normalized[field]
        );

      if (
        Number.isInteger(
          value
        ) &&
        value >=
          0 &&
        value <=
          8
      ) {
        normalized[field] =
          value;
      } else {
        delete normalized[field];
      }
    }

    const nullableAmountFields = [
      "plannedAmount",
      "actualAmount",
    ];

    for (
      const field of
      nullableAmountFields
    ) {
      if (
        !Object.prototype.hasOwnProperty.call(
          normalized,
          field
        )
      ) {
        continue;
      }

      if (
        normalized[field] ===
        null
      ) {
        continue;
      }

      const value =
        Number(
          String(
            normalized[field]
          ).replace(
            /,/g,
            ""
          )
        );

      if (
        Number.isFinite(
          value
        ) &&
        value >=
          0
      ) {
        normalized[field] =
          value;
      } else {
        delete normalized[field];
      }
    }
  }

  if (
    toolName ===
      "semester.complete"
  ) {
    if (
      "semesterOrder" in
        normalized
    ) {
      const semesterOrder =
        Number(
          normalized.semesterOrder
        );

      if (
        Number.isInteger(
          semesterOrder
        ) &&
        semesterOrder >=
          1 &&
        semesterOrder <=
          20
      ) {
        normalized.semesterOrder =
          semesterOrder;
      } else {
        delete normalized.semesterOrder;
      }
    }
  }

  return normalized;
}

type AiRunnerToolInputValidation = {
  valid:
    boolean;

  message:
    string |
    null;
};

/**
 * 조회 Tool을 연속 실행한 뒤
 * 사용자 답변과 마지막 Tool 결과를 함께 반환한다.
 *
 * 마지막 Tool 결과를 반환해야 프론트에서도
 * 실제 최종 조회 화면을 표시할 수 있다.
 */
type AiNaturalToolReplyResult = {
  reply:
    string;

  toolName:
    AiToolName;

  toolInput:
    Record<
      string,
      unknown
    >;

  toolResult:
    AiToolExecutionResult<any>;

  toolCallCount:
    number;

  documentImportPreview?:
    RunAiAssistantOutput[
      "documentImportPreview"
    ];
};

/**
 * OpenAI가 선택한 Tool을 실행하기 전에
 * Tool별 핵심 필수 입력값을 확인한다.
 *
 * 최종 Schema 검증과 권한 검증은
 * executeAiTool()에서 다시 수행한다.
 */
function validateRunnerToolInput(params: {
  context:
    AiUserContext;

  toolName:
    AiRunnerPlan["toolName"];

  input:
    Record<
      string,
      unknown
    >;
}): AiRunnerToolInputValidation {
  const {
    toolName,
    input,
  } = params;

  if (
    !toolName
  ) {
    return {
      valid:
        false,

      message:
        "실행할 CRM Tool이 선택되지 않았습니다.",
    };
  }

if (
  isAiDraftTool(
    toolName
  ) &&
  params.context.canWrite !==
    true
) {
  return {
    valid:
      false,

    message:
      "현재 권한으로는 수정 또는 등록 초안을 만들 수 없습니다.",
  };
}

  if (
    isStudentTargetTool(
      toolName
    )
  ) {
    const studentId =
      Number(
        input.studentId ||
        0
      );

    if (
      !Number.isFinite(
        studentId
      ) ||
      studentId <= 0
    ) {
      return {
        valid:
          false,

        message:
          "확인할 학생을 먼저 선택해주세요.",
      };
    }
  }

  if (
    toolName ===
      "plan.create"
  ) {
    if (
      typeof input.hasPractice !==
      "boolean"
    ) {
      return {
        valid:
          false,

        message:
          "실습 필요 여부를 알려주세요.",
      };
    }

    const totalTheorySubjects =
      Number(
        input.totalTheorySubjects
      );

    const requiredMajorCount =
      Number(
        input.requiredMajorCount
      );

    const electiveMajorCount =
      Number(
        input.electiveMajorCount
      );

    const liberalCount =
      Number(
        input.liberalCount
      );

    const generalCount =
      Number(
        input.generalCount
      );

    const counts = [
      totalTheorySubjects,
      requiredMajorCount,
      electiveMajorCount,
      liberalCount,
      generalCount,
    ];

    if (
      counts.some(
        (
          value
        ) =>
          !Number.isInteger(
            value
          ) ||
          value <
            0
      )
    ) {
      return {
        valid:
          false,

        message:
          "전체 이론 과목 수와 전공필수, 전공선택, 교양, 일반 과목 수를 모두 알려주세요.",
      };
    }

    const categoryTotal =
      requiredMajorCount +
      electiveMajorCount +
      liberalCount +
      generalCount;

    if (
      categoryTotal !==
      totalTheorySubjects
    ) {
      return {
        valid:
          false,

        message:
          `전체 이론 과목 수(${totalTheorySubjects})와 전공필수·전공선택·교양·일반 합계(${categoryTotal})가 일치하지 않습니다.`,
      };
    }
  }

  if (
    toolName ===
      "plan.update"
  ) {
    const allowedFields = [
      "desiredCourse",
      "finalEducation",
      "hasPractice",
      "totalTheorySubjects",
      "requiredMajorCount",
      "electiveMajorCount",
      "liberalCount",
      "generalCount",
    ];

    const requestedFields =
      allowedFields.filter(
        (
          field
        ) =>
          Object.prototype.hasOwnProperty.call(
            input,
            field
          )
      );

    if (
      requestedFields.length ===
      0
    ) {
      return {
        valid:
          false,

        message:
          "변경할 플랜 정보를 알려주세요.",
      };
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "hasPractice"
      ) &&
      typeof input.hasPractice !==
        "boolean"
    ) {
      return {
        valid:
          false,

        message:
          "실습 필요 여부가 올바르지 않습니다.",
      };
    }

    const numericFields = [
      "totalTheorySubjects",
      "requiredMajorCount",
      "electiveMajorCount",
      "liberalCount",
      "generalCount",
    ];

    for (
      const field of
      numericFields
    ) {
      if (
        !Object.prototype.hasOwnProperty.call(
          input,
          field
        )
      ) {
        continue;
      }

      const value =
        Number(
          input[field]
        );

      if (
        !Number.isInteger(
          value
        ) ||
        value <
          0
      ) {
        return {
          valid:
            false,

          message:
            "플랜 과목 수 변경정보가 올바르지 않습니다.",
        };
      }
    }
  }

  if (
    toolName ===
      "plan.subjects.create"
  ) {
    const subjects =
      Array.isArray(
        input.subjects
      )
        ? input.subjects
        : [];

    if (
      subjects.length ===
      0
    ) {
      return {
        valid:
          false,

        message:
          "등록할 플랜 과목 정보를 알려주세요.",
      };
    }

    if (
      subjects.length >
      100
    ) {
      return {
        valid:
          false,

        message:
          "한 번에 등록할 수 있는 플랜 과목은 최대 100개입니다.",
      };
    }

    for (
      let index =
        0;
      index <
        subjects.length;
      index +=
        1
    ) {
      const subject =
        subjects[index];

      if (
        !subject ||
        typeof subject !==
          "object" ||
        Array.isArray(
          subject
        )
      ) {
        return {
          valid:
            false,

          message:
            `${index + 1}번째 플랜 과목 정보가 올바르지 않습니다.`,
        };
      }

      const source =
        subject as
          Record<
            string,
            unknown
          >;

      const semesterNo =
        Number(
          source.semesterNo
        );

      if (
        !Number.isInteger(
          semesterNo
        ) ||
        semesterNo <
          1 ||
        semesterNo >
          20
      ) {
        return {
          valid:
            false,

          message:
            `${index + 1}번째 플랜 과목의 학기 번호를 알려주세요.`,
        };
      }

      const subjectName =
        String(
          source.subjectName ||
          ""
        ).trim();

      if (
        !subjectName
      ) {
        return {
          valid:
            false,

          message:
            `${index + 1}번째 플랜 과목명을 알려주세요.`,
        };
      }

      const planCategory =
        String(
          source.planCategory ||
          ""
        ).trim();

      if (
        planCategory !==
          "전공" &&
        planCategory !==
          "교양" &&
        planCategory !==
          "일반"
      ) {
        return {
          valid:
            false,

          message:
            `${subjectName} 과목의 플랜 분류를 전공, 교양, 일반 중 하나로 알려주세요.`,
        };
      }

      const planRequirementType =
        String(
          source.planRequirementType ||
          ""
        ).trim();

      if (
        planRequirementType !==
          "전공필수" &&
        planRequirementType !==
          "전공선택" &&
        planRequirementType !==
          "교양" &&
        planRequirementType !==
          "일반"
      ) {
        return {
          valid:
            false,

          message:
            `${subjectName} 과목의 요구구분을 알려주세요.`,
        };
      }

      if (
        (
          planRequirementType ===
            "전공필수" ||
          planRequirementType ===
            "전공선택"
        ) &&
        planCategory !==
          "전공"
      ) {
        return {
          valid:
            false,

          message:
            `${subjectName} 과목은 ${planRequirementType}이므로 플랜 분류가 전공이어야 합니다.`,
        };
      }

      if (
        planRequirementType ===
          "교양" &&
        planCategory !==
          "교양"
      ) {
        return {
          valid:
            false,

          message:
            `${subjectName} 과목은 교양이므로 플랜 분류도 교양이어야 합니다.`,
        };
      }

      if (
        planRequirementType ===
          "일반" &&
        planCategory !==
          "일반"
      ) {
        return {
          valid:
            false,

          message:
            `${subjectName} 과목은 일반이므로 플랜 분류도 일반이어야 합니다.`,
        };
      }

      const credits =
        Number(
          source.credits
        );

      if (
        !Number.isInteger(
          credits
        ) ||
        credits <
          1 ||
        credits >
          10
      ) {
        return {
          valid:
            false,

          message:
            `${subjectName} 과목의 학점을 알려주세요.`,
        };
      }

      if (
        Object.prototype.hasOwnProperty.call(
          source,
          "settlementIncluded"
        ) &&
        source.settlementIncluded !==
          null &&
        typeof source.settlementIncluded !==
          "boolean"
      ) {
        return {
          valid:
            false,

          message:
            `${subjectName} 과목의 정산 포함 여부가 올바르지 않습니다.`,
        };
      }
    }
  }

  if (
    toolName ===
      "plan.subjects.update"
  ) {
    const planSubjectId =
      Number(
        input.planSubjectId ||
        0
      );

    if (
      !Number.isInteger(
        planSubjectId
      ) ||
      planSubjectId <=
        0
    ) {
      return {
        valid:
          false,

        message:
          "수정할 플랜 과목 ID를 알려주세요.",
      };
    }

    const allowedFields = [
      "semesterNo",
      "subjectName",
      "planCategory",
      "planRequirementType",
      "credits",
      "sortOrder",
      "settlementIncluded",
    ];

    const requestedFields =
      allowedFields.filter(
        (
          field
        ) =>
          Object.prototype.hasOwnProperty.call(
            input,
            field
          )
      );

    if (
      requestedFields.length ===
      0
    ) {
      return {
        valid:
          false,

        message:
          "변경할 플랜 과목 정보를 알려주세요.",
      };
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "semesterNo"
      )
    ) {
      const semesterNo =
        Number(
          input.semesterNo
        );

      if (
        !Number.isInteger(
          semesterNo
        ) ||
        semesterNo <
          1 ||
        semesterNo >
          20
      ) {
        return {
          valid:
            false,

          message:
            "변경할 학기 번호가 올바르지 않습니다.",
        };
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "subjectName"
      ) &&
      !String(
        input.subjectName ||
        ""
      ).trim()
    ) {
      return {
        valid:
          false,

        message:
          "변경할 플랜 과목명을 알려주세요.",
      };
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "planCategory"
      )
    ) {
      const value =
        String(
          input.planCategory ||
          ""
        ).trim();

      if (
        value !==
          "전공" &&
        value !==
          "교양" &&
        value !==
          "일반"
      ) {
        return {
          valid:
            false,

          message:
            "플랜 과목 분류가 올바르지 않습니다.",
        };
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "planRequirementType"
      )
    ) {
      const value =
        String(
          input.planRequirementType ||
          ""
        ).trim();

      if (
        value !==
          "전공필수" &&
        value !==
          "전공선택" &&
        value !==
          "교양" &&
        value !==
          "일반"
      ) {
        return {
          valid:
            false,

          message:
            "플랜 과목 요구구분이 올바르지 않습니다.",
        };
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "credits"
      )
    ) {
      const credits =
        Number(
          input.credits
        );

      if (
        !Number.isInteger(
          credits
        ) ||
        credits <
          1 ||
        credits >
          10
      ) {
        return {
          valid:
            false,

          message:
            "플랜 과목 학점 정보가 올바르지 않습니다.",
        };
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "sortOrder"
      )
    ) {
      const sortOrder =
        Number(
          input.sortOrder
        );

      if (
        !Number.isInteger(
          sortOrder
        ) ||
        sortOrder <
          0
      ) {
        return {
          valid:
            false,

          message:
            "플랜 과목 정렬 순서가 올바르지 않습니다.",
        };
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "settlementIncluded"
      ) &&
      typeof input
        .settlementIncluded !==
        "boolean"
    ) {
      return {
        valid:
          false,

        message:
          "플랜 과목 정산 포함 여부가 올바르지 않습니다.",
      };
    }
  }

    if (
    toolName ===
      "semester.create"
  ) {
    const semesterOrder =
      Number(
        input.semesterOrder
      );

    if (
      !Number.isInteger(
        semesterOrder
      ) ||
      semesterOrder <
        1 ||
      semesterOrder >
        20
    ) {
      return {
        valid:
          false,

        message:
          "생성할 학기 순서를 1부터 20 사이의 정수로 말씀해주세요.",
      };
    }

    const semesterLabel =
      String(
        input.semesterLabel ||
        ""
      ).trim();

    if (
      !semesterLabel
    ) {
      return {
        valid:
          false,

        message:
          "생성할 학기 구분이 필요합니다.",
      };
    }

    if (
      !/^(\d{4})년\s*([12])학기$/.test(
        semesterLabel
      )
    ) {
      return {
        valid:
          false,

        message:
          "학기 구분을 연도와 1학기 또는 2학기 형식으로 말씀해주세요.",
      };
    }
  }

  if (
    toolName ===
      "semester.update"
  ) {
    const semesterOrder =
      Number(
        input.semesterOrder
      );

    if (
      !Number.isInteger(
        semesterOrder
      ) ||
      semesterOrder <
        1 ||
      semesterOrder >
        20
    ) {
      return {
        valid:
          false,

        message:
          "수정할 학기 순서를 1부터 20 사이의 정수로 말씀해주세요.",
      };
    }

    const updateFields = [
      "semesterLabel",
      "plannedMonth",
      "plannedInstitution",
      "plannedSubjectCount",
      "plannedAmount",
      "actualStartDate",
      "actualInstitution",
      "actualSubjectCount",
      "actualAmount",
      "actualPaymentDate",
    ];

    const hasUpdate =
      updateFields.some(
        (
          field
        ) =>
          Object.prototype.hasOwnProperty.call(
            input,
            field
          )
      );

    if (
      !hasUpdate
    ) {
      return {
        valid:
          false,

        message:
          "수정할 학기 정보가 필요합니다.",
      };
    }
  }

  if (
    toolName ===
      "semester.complete"
  ) {
    const semesterOrder =
      Number(
        input.semesterOrder
      );

    if (
      !Number.isInteger(
        semesterOrder
      ) ||
      semesterOrder <
        1 ||
      semesterOrder >
        20
    ) {
      return {
        valid:
          false,

        message:
          "입력완료 처리할 학기 순서를 1부터 20 사이의 정수로 말씀해주세요.",
      };
    }
  }

  if (
    toolName ===
      "consultation.create"
  ) {
    const clientName =
      String(
        input.clientName ||
        ""
      ).trim();

    if (
      !clientName
    ) {
      return {
        valid:
          false,

        message:
          "신규 상담자의 이름이 필요합니다.",
      };
    }

    const phone =
      String(
        input.phone ||
        ""
      )
        .replace(
          /\D/g,
          ""
        );

    if (
      phone.length <
        10 ||
      phone.length >
        11
    ) {
      return {
        valid:
          false,

        message:
          "신규 상담자의 연락처는 숫자 10자리 또는 11자리로 말씀해주세요.",
      };
    }
  }

  if (
    toolName ===
      "consultation.update"
  ) {
    const consultationId =
      Number(
        input.consultationId ||
        0
      );

    if (
      !Number.isFinite(
        consultationId
      ) ||
      consultationId <= 0
    ) {
      return {
        valid:
          false,

        message:
          "수정할 상담DB 번호가 필요합니다.",
      };
    }

    const hasStatus =
      typeof input.status ===
        "string" &&
      input.status.trim()
        .length > 0;

    const hasNotes =
      typeof input.notes ===
        "string";

    if (
      !hasStatus &&
      !hasNotes
    ) {
      return {
        valid:
          false,

        message:
          "변경할 상담 상태 또는 상담내용을 입력해주세요.",
      };
    }
  }

  if (
    toolName ===
      "student.update"
  ) {
    const updateFields = [
      "status",
      "course",
      "finalEducation",
      "address",
      "detailAddress",
    ];

    const hasUpdate =
      updateFields.some(
        (
          field
        ) =>
          Object.prototype.hasOwnProperty.call(
            input,
            field
          )
      );

    if (
      !hasUpdate
    ) {
      return {
        valid:
          false,

        message:
          "변경할 학생 정보를 말씀해주세요.",
      };
    }
  }

  if (
    toolName ===
      "schedule.create"
  ) {
    const scheduleDate =
      String(
        input.scheduleDate ||
        ""
      ).trim();

    const title =
      String(
        input.title ||
        ""
      ).trim();

    const meridiem =
      input.meridiem;

    const hour12 =
      Number(
        input.hour12
      );

    const minute =
      Number(
        input.minute
      );

    if (
      !title
    ) {
      return {
        valid:
          false,

        message:
          "등록할 일정명을 입력해주세요.",
      };
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        scheduleDate
      )
    ) {
      return {
        valid:
          false,

        message:
          "일정 날짜를 정확하게 말씀해주세요.",
      };
    }

    if (
      meridiem !==
        "AM" &&
      meridiem !==
        "PM"
    ) {
      return {
        valid:
          false,

        message:
          "일정 시간을 오전 또는 오후로 말씀해주세요.",
      };
    }

    if (
      !Number.isInteger(
        hour12
      ) ||
      hour12 < 1 ||
      hour12 > 12
    ) {
      return {
        valid:
          false,

        message:
          "일정 시간을 1시부터 12시 사이로 말씀해주세요.",
      };
    }

    if (
      !Number.isInteger(
        minute
      ) ||
      minute < 0 ||
      minute > 59
    ) {
      return {
        valid:
          false,

        message:
          "일정 분을 0분부터 59분 사이로 말씀해주세요.",
      };
    }
  }

  if (
    toolName ===
      "student.search" ||
    toolName ===
      "consultation.search"
  ) {
    const query =
      String(
        input.query ||
        ""
      ).trim();

    if (
      !query
    ) {
      return {
        valid:
          false,

        message:
          toolName ===
            "student.search"
            ? "검색할 학생 이름이나 연락처를 입력해주세요."
            : "검색할 상담DB 이름이나 연락처를 입력해주세요.",
      };
    }
  }

  return {
    valid:
      true,

    message:
      null,
  };
}

/**
 * studentId가 반드시 필요한 학생 단위 Tool인지 확인한다.
 */
function isStudentTargetTool(
  toolName:
    string |
    null
): boolean {
   return [
  "student.summary",
  "student.dashboard",
    "student.update",
"plan.create",
"plan.update",
"plan.subjects.create",
"plan.subjects.update",
"semester.create",
  "semester.update",
  "semester.complete",
  "risk.studentDetail",
  "practice.institutionSearch",
  "practice.supportStatus",
  "schedule.create",
].includes(
    String(
      toolName ||
      ""
    )
  );
}

/**
 * consultationId가 필요한 상담 단위 Tool인지 확인한다.
 */
function isConsultationTargetTool(
  toolName:
    string |
    null
): boolean {
  return [
    "consultation.update",
  ].includes(
    String(
      toolName ||
      ""
    )
  );
}

function formatConsultationCreatePhone(
  value:
    unknown
): string {
  const digits =
    String(
      value ??
      ""
    )
      .replace(
        /\D/g,
        ""
      )
      .slice(
        0,
        11
      );

  if (
    digits.length ===
    11
  ) {
    return [
      digits.slice(
        0,
        3
      ),

      digits.slice(
        3,
        7
      ),

      digits.slice(
        7,
        11
      ),
    ].join(
      "-"
    );
  }

  if (
    digits.length ===
    10
  ) {
    return [
      digits.slice(
        0,
        3
      ),

      digits.slice(
        3,
        6
      ),

      digits.slice(
        6,
        10
      ),
    ].join(
      "-"
    );
  }

  return digits;
}

function getStudentSearchItems(
  result:
    AiToolExecutionResult<any>
): any[] {
  if (
    result.success !==
      true
  ) {
    return [];
  }

  const data =
    result.data &&
    typeof result.data ===
      "object" &&
    !Array.isArray(
      result.data
    )
      ? result.data as
          Record<
            string,
            unknown
          >
      : {};

  return Array.isArray(
    data.students
  )
    ? data.students
    : [];
}

function getConsultationSearchItems(
  result:
    AiToolExecutionResult<any>
): any[] {
  if (
    result.success !==
      true
  ) {
    return [];
  }

  const data =
    result.data &&
    typeof result.data ===
      "object" &&
    !Array.isArray(
      result.data
    )
      ? result.data as
          Record<
            string,
            unknown
          >
      : {};

  return Array.isArray(
    data.consultations
  )
    ? data.consultations
    : [];
}

function isExactPhoneMatched(
  left:
    unknown,

  right:
    unknown
): boolean {
  const leftDigits =
    String(
      left ??
      ""
    )
      .replace(
        /\D/g,
        ""
      );

  const rightDigits =
    String(
      right ??
      ""
    )
      .replace(
        /\D/g,
        ""
      );

  return (
    leftDigits.length >=
      10 &&
    rightDigits.length >=
      10 &&
    leftDigits ===
      rightDigits
  );
}

async function runConsultationCreatePreflight(params: {
  context:
    AiUserContext;

  input:
    Record<
      string,
      unknown
    >;
}): Promise<ConsultationCreatePreflightResult> {
  const clientName =
    String(
      params.input
        .clientName ??
      ""
    )
      .trim()
      .slice(
        0,
        100
      );

  const phone =
    String(
      params.input
        .phone ??
      ""
    )
      .replace(
        /\D/g,
        ""
      )
      .slice(
        0,
        11
      );

  const searchInput = {
    query:
      phone,

    limit:
      20,
  };

  const studentSearchResult =
    await executeAiTool({
      toolName:
        "student.search",

      context:
        params.context,

      input:
        searchInput,
    });

  if (
    studentSearchResult
      .success !==
    true
  ) {
    return {
      canCreate:
        false,

      reason:
        "search_failed",

      reply:
        "기존 학생 중복 여부를 확인하지 못해 상담DB 신규등록 초안을 만들지 않았습니다. 잠시 후 다시 시도해주세요.",

      blockingToolName:
        "student.search",

      blockingToolInput:
        searchInput,

      blockingToolResult:
        studentSearchResult,
    };
  }

  const exactStudents =
    getStudentSearchItems(
      studentSearchResult
    ).filter(
      (
        student
      ) =>
        isExactPhoneMatched(
          student?.phone,
          phone
        )
    );

  if (
    exactStudents.length >
    0
  ) {
    const lines =
      exactStudents
        .slice(
          0,
          5
        )
        .map(
          (
            student
          ) => {
            const studentId =
              Number(
                student?.id ||
                0
              );

            const studentName =
              String(
                student?.clientName ||
                clientName ||
                "이름 미확인"
              ).trim();

            const studentPhone =
              formatConsultationCreatePhone(
                student?.phone ||
                phone
              );

            const course =
              String(
                student?.course ||
                ""
              ).trim();

            const status =
              String(
                student?.status ||
                ""
              ).trim();

            return [
              `- 학생번호 · ${studentId}`,
              `  이름 · ${studentName}`,
              `  연락처 · ${studentPhone}`,
              `  과정 · ${course || "미입력"}`,
              `  상태 · ${status || "미입력"}`,
            ].join(
              "\n"
            );
          }
        );

    return {
      canCreate:
        false,

      reason:
        "existing_student",

      reply: [
        "동일한 연락처로 등록된 기존 학생을 확인했습니다.",
        "",
        ...lines,
        "",
        "신규 상담DB를 생성하지 않았습니다. 기존 학생을 조회하거나 수정하는 방식으로 진행해주세요.",
      ].join(
        "\n"
      ),

      blockingToolName:
        "student.search",

      blockingToolInput:
        searchInput,

      blockingToolResult:
        studentSearchResult,
    };
  }

  const consultationSearchResult =
    await executeAiTool({
      toolName:
        "consultation.search",

      context:
        params.context,

      input:
        searchInput,
    });

  if (
    consultationSearchResult
      .success !==
    true
  ) {
    return {
      canCreate:
        false,

      reason:
        "search_failed",

      reply:
        "기존 상담DB 중복 여부를 확인하지 못해 신규등록 초안을 만들지 않았습니다. 잠시 후 다시 시도해주세요.",

      blockingToolName:
        "consultation.search",

      blockingToolInput:
        searchInput,

      blockingToolResult:
        consultationSearchResult,
    };
  }

  const exactConsultations =
    getConsultationSearchItems(
      consultationSearchResult
    ).filter(
      (
        consultation
      ) =>
        isExactPhoneMatched(
          consultation?.phone,
          phone
        )
    );

  if (
    exactConsultations.length >
    0
  ) {
    const lines =
      exactConsultations
        .slice(
          0,
          5
        )
        .map(
          (
            consultation
          ) => {
            const consultationId =
              Number(
                consultation?.id ||
                0
              );

            const consultationName =
              String(
                consultation?.clientName ||
                clientName ||
                "이름 미확인"
              ).trim();

            const consultationPhone =
              formatConsultationCreatePhone(
                consultation?.phone ||
                phone
              );

            const desiredCourse =
              String(
                consultation?.desiredCourse ||
                ""
              ).trim();

            const status =
              String(
                consultation?.status ||
                ""
              ).trim();

            return [
              `- 상담번호 · ${consultationId}`,
              `  이름 · ${consultationName}`,
              `  연락처 · ${consultationPhone}`,
              `  희망과정 · ${desiredCourse || "미입력"}`,
              `  상태 · ${status || "미입력"}`,
            ].join(
              "\n"
            );
          }
        );

    return {
      canCreate:
        false,

      reason:
        "existing_consultation",

      reply: [
        "동일한 연락처로 등록된 기존 상담DB를 확인했습니다.",
        "",
        ...lines,
        "",
        "신규 상담DB를 생성하지 않았습니다. 기존 상담정보를 수정하거나 등록예정 학생 전환을 진행해주세요.",
      ].join(
        "\n"
      ),

      blockingToolName:
        "consultation.search",

      blockingToolInput:
        searchInput,

      blockingToolResult:
        consultationSearchResult,
    };
  }

  return {
    canCreate:
      true,

    studentSearchResult,

    consultationSearchResult,
  };
}

/**
 * 최초 Tool 실행 결과를 확인한 AI가
 * 후속으로 자동 실행할 수 있는 조회 Tool인지 확인한다.
 *
 * 수정·등록 초안 Tool은 Pending Action UI와
 * 전용 반환 구조가 필요하므로 연속 자동 실행에서 제외한다.
 */
function isFollowUpReadTool(
  toolName:
    string
): toolName is AiToolName {
  return [
    "student.search",
    "student.summary",
    "student.dashboard",
    "consultation.search",
    "alert.missingData",
    "risk.studentDetail",
    "risk.studentList",
    "practice.institutionSearch",
    "practice.supportStatus",
"settlement.summary",
  ].includes(
    toolName
  );
}

/**
 * 학생 단위 Tool인데 OpenAI가 studentId를 생략한 경우
 * 현재 화면 선택 학생 또는 AI 업무 세션의 학생 ID를 보완한다.
 *
 * 우선순위
 * 1. OpenAI Tool 입력에 이미 포함된 studentId
 * 2. 현재 화면에서 명시적으로 선택된 학생 ID
 * 3. AI 업무 세션의 activeTarget 학생 ID
 * 4. AI 업무 세션의 linkedContext.studentId
 *
 * 어떤 값도 확정되지 않으면 임의 ID를 생성하지 않는다.
 */
function applySelectedStudentToToolInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  selectedStudentId?:
    number |
    null;

  workSession:
    AiWorkSession;
}) {
  if (
    !isStudentTargetTool(
      params.toolName
    )
  ) {
    return params.toolInput;
  }

if (
  params.toolName ===
    "practice.institutionSearch"
) {
  const address =
    String(
      params.toolInput
        .address ??
      ""
    ).trim();

  if (
    address
  ) {
    return {
      ...params.toolInput,

      studentId:
        null,
    };
  }
}

  /**
   * OpenAI가 실제 studentId를 명시했다면
   * 해당 값을 그대로 우선 사용한다.
   */
  const currentStudentId =
    Number(
      params.toolInput
        .studentId ||
      0
    );

  if (
    Number.isFinite(
      currentStudentId
    ) &&
    currentStudentId >
      0
  ) {
    return {
      ...params.toolInput,

      studentId:
        Math.floor(
          currentStudentId
        ),
    };
  }

  /**
   * 사용자가 현재 화면에서 학생을 직접 선택했다면
   * 기존 세션보다 화면 선택값을 우선한다.
   */
  const selectedStudentId =
    Number(
      params.selectedStudentId ||
      0
    );

  if (
    Number.isFinite(
      selectedStudentId
    ) &&
    selectedStudentId >
      0
  ) {
    return {
      ...params.toolInput,

      studentId:
        Math.floor(
          selectedStudentId
        ),
    };
  }

  /**
   * 현재 AI 업무 대상이 학생이면
   * activeTarget의 확정된 학생 ID를 사용한다.
   */
  const activeTargetStudentId =
    params.workSession
      .activeTarget
      ?.type ===
      "student"
      ? Number(
          params.workSession
            .activeTarget
            .id ||
          0
        )
      : 0;

  if (
    Number.isFinite(
      activeTargetStudentId
    ) &&
    activeTargetStudentId >
      0
  ) {
    return {
      ...params.toolInput,

      studentId:
        Math.floor(
          activeTargetStudentId
        ),
    };
  }

  /**
   * activeTarget이 학생이 아니더라도
   * 상담DB에서 학생으로 연결된 이력이 있으면
   * linkedContext.studentId를 사용할 수 있다.
   */
  const linkedStudentId =
    Number(
      params.workSession
        .linkedContext
        .studentId ||
      0
    );

  if (
    Number.isFinite(
      linkedStudentId
    ) &&
    linkedStudentId >
      0
  ) {
    return {
      ...params.toolInput,

      studentId:
        Math.floor(
          linkedStudentId
        ),
    };
  }

  return params.toolInput;
}

/**
 * 상담 단위 Tool인데 OpenAI가 consultationId를 생략한 경우
 * AI 업무 세션에 저장된 상담DB ID를 보완한다.
 *
 * 우선순위
 * 1. OpenAI Tool 입력에 이미 포함된 consultationId
 * 2. AI 업무 세션의 activeTarget 상담DB ID
 * 3. AI 업무 세션의 linkedContext.consultationId
 *
 * 어떤 값도 확정되지 않으면 임의 ID를 생성하지 않는다.
 */
function applySelectedConsultationToToolInput(params: {
  toolName:
    string;

  toolInput:
    Record<
      string,
      unknown
    >;

  workSession:
    AiWorkSession;
}) {
  if (
    !isConsultationTargetTool(
      params.toolName
    )
  ) {
    return params.toolInput;
  }

  /**
   * OpenAI가 consultationId를 직접 전달했다면
   * 해당 값을 가장 먼저 사용한다.
   */
  const currentConsultationId =
    Number(
      params.toolInput
        .consultationId ||
      0
    );

  if (
    Number.isFinite(
      currentConsultationId
    ) &&
    currentConsultationId >
      0
  ) {
    return {
      ...params.toolInput,

      consultationId:
        Math.floor(
          currentConsultationId
        ),
    };
  }

  /**
   * 현재 업무 대상이 상담DB이면
   * activeTarget의 확정된 상담DB ID를 사용한다.
   */
  const activeTargetConsultationId =
    params.workSession
      .activeTarget
      ?.type ===
      "consultation"
      ? Number(
          params.workSession
            .activeTarget
            .id ||
          0
        )
      : 0;

  if (
    Number.isFinite(
      activeTargetConsultationId
    ) &&
    activeTargetConsultationId >
      0
  ) {
    return {
      ...params.toolInput,

      consultationId:
        Math.floor(
          activeTargetConsultationId
        ),
    };
  }

  /**
   * activeTarget이 상담DB가 아니더라도
   * linkedContext에 상담DB 연결값이 있으면 사용한다.
   */
  const linkedConsultationId =
    Number(
      params.workSession
        .linkedContext
        .consultationId ||
      0
    );

  if (
    Number.isFinite(
      linkedConsultationId
    ) &&
    linkedConsultationId >
      0
  ) {
    return {
      ...params.toolInput,

      consultationId:
        Math.floor(
          linkedConsultationId
        ),
    };
  }

  return params.toolInput;
}

/**
 * AI 일정 해석에 전달할 한국 기준 현재 날짜
 *
 * Railway/Vercel 서버가 UTC여도
 * Asia/Seoul 기준 날짜를 사용한다.
 */
function getCurrentKoreanDate() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Seoul",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  ).format(
    new Date()
  );
}

function normalizeMessage(value: unknown) {
  return String(value ?? "")
    .trim()
    .slice(0, 3000);
}

/**
 * 서버 로그에 기록할 오류 정보를
 * 제한된 문자열로 정규화한다.
 *
 * 긴 SQL, 요청 본문, 개인정보가
 * 로그에 그대로 남는 것을 방지한다.
 */
function normalizeErrorForLog(
  error:
    unknown
): {
  name:
    string;

  message:
    string;
} {
  if (
    error instanceof
    Error
  ) {
    return {
      name:
        String(
          error.name ||
          "Error"
        )
          .trim()
          .slice(
            0,
            100
          ),

      message:
        String(
          error.message ||
          "알 수 없는 오류"
        )
          .replace(
            /\s+/g,
            " "
          )
          .trim()
          .slice(
            0,
            300
          ),
    };
  }

  return {
    name:
      "UnknownError",

    message:
      "알 수 없는 오류",
  };
}

function normalizeConversationHistory(
  value:
    unknown
): AiConversationHistoryMessage[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .filter(
      (
        row
      ): row is {
        role:
          unknown;

        content:
          unknown;
      } =>
        Boolean(
          row
        ) &&
        typeof row ===
          "object"
    )
    .map(
      (
        row
      ) => {
        const role =
          row.role ===
            "assistant"
            ? "assistant"
            : row.role ===
                "user"
              ? "user"
              : null;

        const content =
          String(
            row.content ??
            ""
          )
            .trim()
            .slice(
              0,
              1000
            );

        if (
          !role ||
          !content
        ) {
          return null;
        }

        return {
          role,
          content,
        };
      }
    )
    .filter(
      (
        row
      ): row is
        AiConversationHistoryMessage =>
        row !== null
    )
    .slice(-30);
}

async function classifyPendingActionDecisionWithOpenAi(
  params: {
    message:
      string;

    workSession:
      AiWorkSession;

    context:
      AiUserContext;

    conversationHistory?:
      AiConversationHistoryMessage[];
  }
): Promise<AiPendingActionDecision | null> {
  const action =
    params.workSession
      .lastPresentedAction;

  const pendingActionId =
    Number(
      action
        ?.payload
        ?.pendingActionId ||
      0
    );

  if (
    params.workSession
      .workflow
      .step !==
      "awaiting_confirmation" ||
    !action ||
    !Number.isFinite(
      pendingActionId
    ) ||
    pendingActionId <=
      0
  ) {
    return null;
  }

  const openai =
    getOpenAiClient();

  if (
    !openai
  ) {
    return {
      decision:
        "unclear",

      confidence:
        "low",

      reason:
        "OpenAI Client를 사용할 수 없습니다.",
    };
  }

  try {
    const response =
      await openai.responses.create({
        model:
          process.env.OPENAI_AI_MODEL ||
          "gpt-5.4-mini",

        input: [
          {
            role:
              "system",

            content: [
              {
                type:
                  "input_text",

                text: [
                  "너는 EduCanvas CRM의 승인 대기 작업에 대한 사용자 의도 분류기다.",
                  "사용자의 자연어, 오타, 줄임말, 비표준 표현과 최근 대화 문맥을 이해해서 의미를 판단한다.",
                  "",
                  "반드시 아래 decision 중 하나만 선택한다.",
                  "",
                  "confirm:",
                  "- 현재 제시된 초안을 변경하지 않고 그대로 실행하려는 의미",
                  "- 승인, 진행, 등록, 적용, 반영에 동의하는 의미",
                  "",
                  "cancel:",
                  "- 현재 초안을 실행하지 않거나 폐기하려는 의미",
                  "- 취소, 중단, 없던 일로 하기, 진행하지 않기의 의미",
                  "",
                  "revise:",
                  "- 현재 초안의 날짜, 시간, 상태, 주소, 내용 등 일부를 변경하려는 의미",
                  "- 수정 후 진행하라는 요청도 confirm이 아니라 revise",
                  "",
                  "new_request:",
                  "- 현재 승인 초안과 별개의 새로운 조회, 검색, 수정 또는 다른 업무 요청",
                  "",
                  "unclear:",
                  "- 사용자의 의도가 승인, 취소, 수정, 새 요청 중 무엇인지 확실하지 않은 경우",
                  "",
                  "중요 규칙:",
                  "- 단어를 정확히 일치시키지 말고 문장 전체의 의미와 문맥으로 판단한다.",
                  "- 타이핑 오류가 있어도 의미가 명확하면 올바른 decision을 선택한다.",
                  "- '시간을 4시로 바꾸고 진행해줘'는 revise다.",
                  "- '그 전에 다른 학생을 확인해줘'는 new_request다.",
                  "- 단순히 '음', '잠깐', '모르겠어'는 unclear다.",
                  "- 확신이 부족하면 반드시 unclear로 판단한다.",
                  "- pendingActionId나 사용자 ID를 생성하거나 반환하지 않는다.",
                  "",
                  "반드시 JSON 객체만 반환한다.",
                  "다른 문장이나 마크다운은 반환하지 않는다.",
                  "",
                  "반환 형식:",
                  '{"decision":"confirm|cancel|revise|new_request|unclear","confidence":"high|medium|low","reason":"짧은 판단 이유"}',
                ].join(
                  "\n"
                ),
              },
            ],
          },

          ...normalizeConversationHistory(
            params.conversationHistory
          )
            .slice(
              -10
            )
            .map(
              (
                history
              ) => ({
                role:
                  history.role,

                content: [
                  {
                    type:
                      history.role ===
                        "assistant"
                        ? "output_text" as const
                        : "input_text" as const,

                    text:
                      history.content,
                  },
                ],
              })
            ),

          {
            role:
              "user",

            content: [
              {
                type:
                  "input_text",

                text:
                  JSON.stringify({
                    currentMessage:
                      params.message,

                    pendingWorkflow: {
                      type:
                        params.workSession
                          .workflow
                          .type,

                      step:
                        params.workSession
                          .workflow
                          .step,

                      waitingFor:
                        params.workSession
                          .workflow
                          .waitingFor,

                      actionType:
                        action.actionType ||
                        null,

                      actionId:
                        action.actionId ||
                        null,
                    },
                  }),
              },
            ],
          },
        ],
      });

    const outputText =
      String(
        response.output_text ||
        ""
      ).trim();

    let parsed:
      Record<
        string,
        unknown
      > =
      {};

    try {
      parsed =
        JSON.parse(
          outputText
        );
    } catch {
      return {
        decision:
          "unclear",

        confidence:
          "low",

        reason:
          "AI 판단 결과를 JSON으로 해석하지 못했습니다.",
      };
    }

    const allowedDecisions =
      new Set([
        "confirm",
        "cancel",
        "revise",
        "new_request",
        "unclear",
      ]);

    const allowedConfidences =
      new Set([
        "high",
        "medium",
        "low",
      ]);

    const decision =
      allowedDecisions.has(
        String(
          parsed.decision ||
          ""
        )
      )
        ? String(
            parsed.decision
          ) as
            AiPendingActionDecision["decision"]
        : "unclear";

    const confidence =
      allowedConfidences.has(
        String(
          parsed.confidence ||
          ""
        )
      )
        ? String(
            parsed.confidence
          ) as
            AiPendingActionDecision["confidence"]
        : "low";

    const reason =
      String(
        parsed.reason ||
        ""
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim()
        .slice(
          0,
          300
        );

    return {
      decision,
      confidence,
      reason:
        reason ||
        "판단 이유가 제공되지 않았습니다.",
    };
  } catch (
    error
  ) {
    console.error(
      "[AI RUNNER] Pending Action 자연어 판단 실패",
      normalizeErrorForLog(
        error
      )
    );

    return {
      decision:
        "unclear",

      confidence:
        "low",

      reason:
        "AI 자연어 판단 중 오류가 발생했습니다.",
    };
  }
}

function buildPendingActionCommandFromDecision(
  params: {
    decision:
      AiPendingActionDecision;

    workSession:
      AiWorkSession;
  }
): AiPendingActionCommand | null {
  if (
    params.decision
      .confidence !==
      "high"
  ) {
    return null;
  }

  if (
    params.decision
      .decision !==
      "confirm" &&
    params.decision
      .decision !==
      "cancel"
  ) {
    return null;
  }

  if (
    params.workSession
      .workflow
      .step !==
      "awaiting_confirmation"
  ) {
    return null;
  }

  const action =
    params.workSession
      .lastPresentedAction;

  if (
    !action
  ) {
    return null;
  }

  const pendingActionId =
    Number(
      action.payload
        ?.pendingActionId ||
      0
    );

  if (
    !Number.isFinite(
      pendingActionId
    ) ||
    pendingActionId <=
      0
  ) {
    return null;
  }

  return {
    command:
      params.decision
        .decision,

    pendingActionId:
      Math.floor(
        pendingActionId
      ),

    actionId:
      String(
        action.actionId ||
        `pending-action-${Math.floor(
          pendingActionId
        )}`
      ),

    actionType:
      String(
        action.actionType ||
        ""
      ),
  };
}

/**
 * 학생 종합조회 추천 업무가 아직 사용할 수 있는
 * 유효한 문맥인지 확인한다.
 *
 * Pending Action은 기존 승인 흐름에서 별도로 관리하므로
 * student_dashboard_next_action만 여기에서 검사한다.
 */
function isDashboardNextActionAvailable(
  action:
    AiWorkSession["lastPresentedAction"]
): boolean {
  if (
    !action ||
    action.actionType !==
      "student_dashboard_next_action"
  ) {
    return false;
  }

  const expiresAt =
    String(
      action.expiresAt ||
      ""
    ).trim();

  if (
    !expiresAt
  ) {
    return false;
  }

  const expiresAtTime =
    new Date(
      expiresAt
    ).getTime();

  if (
    !Number.isFinite(
      expiresAtTime
    )
  ) {
    return false;
  }

  return (
    expiresAtTime >
    Date.now()
  );
}

function isStudentRegistrationFollowUpAvailable(
  action:
    AiWorkSession["lastPresentedAction"]
): boolean {
  if (
    !action ||
    action.actionType !==
      "student_registration_followup"
  ) {
    return false;
  }

  const consultationId =
    Number(
      action.payload
        ?.consultationId ||
      action.targetId ||
      0
    );

  if (
    !Number.isFinite(
      consultationId
    ) ||
    consultationId <=
      0
  ) {
    return false;
  }

  const expiresAt =
    String(
      action.expiresAt ||
      ""
    ).trim();

  if (
    !expiresAt
  ) {
    return false;
  }

  const expiresAtTime =
    new Date(
      expiresAt
    ).getTime();

  if (
    !Number.isFinite(
      expiresAtTime
    )
  ) {
    return false;
  }

  return (
    expiresAtTime >
    Date.now()
  );
}

/**
 * OpenAI 계획 생성에 전달할 최근 제시 업무를 정규화한다.
 *
 * 학생 종합조회 추천이 만료됐다면 OpenAI에는 전달하지 않는다.
 * Pending Action 등 다른 actionType은 기존 흐름을 유지한다.
 */
function getAvailableLastPresentedAction(
  workSession:
    AiWorkSession
): AiWorkSession["lastPresentedAction"] {
  const action =
    workSession
      .lastPresentedAction;

  if (
    !action
  ) {
    return null;
  }

  if (
    action.actionType ===
      "student_dashboard_next_action"
  ) {
    return isDashboardNextActionAvailable(
      action
    )
      ? action
      : null;
  }

  if (
    action.actionType ===
      "student_registration_followup"
  ) {
    return isStudentRegistrationFollowUpAvailable(
      action
    )
      ? action
      : null;
  }

  return action;
}

/**
 * 현재 확정된 조회 대상이 변경됐을 때
 * 이전 학생 종합조회 추천을 제거해야 하는지 확인한다.
 *
 * Pending Action 등 다른 lastPresentedAction은
 * 이 함수에서 제거하지 않는다.
 */
function shouldClearDashboardNextActionForTarget(params: {
  workSession:
    AiWorkSession;

  targetType:
    "student" |
    "consultation";

  targetId:
    number;
}): boolean {
  const action =
    params.workSession
      .lastPresentedAction;

  if (
    !action ||
    action.actionType !==
      "student_dashboard_next_action"
  ) {
    return false;
  }

  const actionTargetType =
    String(
      action.targetType ||
      ""
    );

  const actionTargetId =
    Number(
      action.targetId ||
      action.payload
        ?.studentId ||
      0
    );

  if (
    actionTargetType !==
      params.targetType
  ) {
    return true;
  }

  if (
    !Number.isFinite(
      actionTargetId
    ) ||
    actionTargetId <= 0
  ) {
    return true;
  }

  return (
    Math.floor(
      actionTargetId
    ) !==
    Math.floor(
      params.targetId
    )
  );
}


/**
 * 현재 AI 업무 대상과 새로 확정된 조회 대상이
 * 서로 다른지 확인한다.
 *
 * 현재 대상이 없으면 최초 대상 확정이므로
 * 대상 변경으로 보지 않는다.
 */
function isAiWorkTargetChanged(params: {
  workSession:
    AiWorkSession;

  targetType:
    "student" |
    "consultation";

  targetId:
    number;
}): boolean {
  const currentTarget =
    params.workSession
      .activeTarget;

  if (
    !currentTarget
  ) {
    return false;
  }

  const currentTargetId =
    Number(
      currentTarget.id ||
      0
    );

  if (
    currentTarget.type !==
      params.targetType
  ) {
    return true;
  }

  if (
    !Number.isFinite(
      currentTargetId
    ) ||
    currentTargetId <= 0
  ) {
    return true;
  }

  return (
    Math.floor(
      currentTargetId
    ) !==
    Math.floor(
      params.targetId
    )
  );
}

/**
 * 새 대상이 확정됐을 때 기존 Workflow 초안을
 * 초기화해야 하는지 확인한다.
 *
 * 승인 대기 또는 실행 중인 업무는
 * 별도 Pending Action 흐름이 있으므로 여기서 제거하지 않는다.
 */
function shouldClearWorkflowForTargetChange(params: {
  workSession:
    AiWorkSession;

  targetType:
    "student" |
    "consultation";

  targetId:
    number;
}): boolean {
  if (
    !isAiWorkTargetChanged({
      workSession:
        params.workSession,

      targetType:
        params.targetType,

      targetId:
        params.targetId,
    })
  ) {
    return false;
  }

  const workflowStep =
    params.workSession
      .workflow
      .step;

  if (
    workflowStep ===
      "awaiting_confirmation" ||
    workflowStep ===
      "executing"
  ) {
    return false;
  }

  const workflowType =
    params.workSession
      .workflow
      .type;

  const hasDraft =
    Object.keys(
      params.workSession
        .workflow
        .draft ||
      {}
    ).length >
    0;

  const hasWaitingFor =
    Array.isArray(
      params.workSession
        .workflow
        .waitingFor
    ) &&
    params.workSession
      .workflow
      .waitingFor
      .length >
      0;

  return (
    workflowType !==
      null ||
    workflowStep !==
      "idle" ||
    hasDraft ||
    hasWaitingFor
  );
}

/**
 * 이전 대상에 묶여 있던 미완성 Workflow를
 * 기본 idle 상태로 초기화한다.
 */
function buildClearedWorkflowPatch():
  NonNullable<
    AiWorkSessionPatch[
      "workflow"
    ]
  > {
  return {
    type:
      null,

    step:
      "idle",

    clearDraft:
      true,

    draftPatch:
      {},

    waitingFor:
      [],
  };
}

async function createPlanWithOpenAi(params: {
  context:
    AiUserContext;

  message:
    string;

  imageAttachment?:
    AiImageAttachment |
    null;

recentDocument?:
  AiRecentDocumentContext |
  null;

  workSession:
    AiWorkSession;

  selectedStudentId?:
    number |
    null;

  selectedStudentName?:
    string |
    null;

  conversationHistory?:
    AiConversationHistoryMessage[];
}): Promise<AiRunnerPlan> {
  const openai =
    getOpenAiClient();

  const availableLastPresentedAction =
    getAvailableLastPresentedAction(
      params.workSession
    );

if (
  !openai
) {
  return {
    intent:
      "general_help",

    toolName:
      null,

    input: {},

    explanation:
      "OPENAI_API_KEY가 설정되지 않았습니다.",

    directReply:
      null,

    failed:
      true,

    failureMessage:
      "AI 연결 설정을 확인해주세요.",

    requiresRegistrationPreview:
      false,
  };
}
  try {
const registryTools =
  buildOpenAiFunctionTools({
    context:
      params.context,
  });

const openAiTools:
  OpenAiFunctionTool[] = [
    ...registryTools,

    ...(
      canUseStudentRegistrationPreview(
        params.context
      )
        ? [
            buildStudentRegistrationPreviewTool(),
          ]
        : []
    ),

    ...(
      params.recentDocument &&
      params.context.canWrite ===
        true &&
      (
        params.context.role ===
          "staff" ||
        params.context.role ===
          "admin" ||
        params.context.role ===
          "host"
      )
        ? [
            buildDocumentImportPreviewTool(),
          ]
        : []
    ),
  ];
   const hasOpenAiTools =
  openAiTools.length >
  0;

const response =
  await openai.responses.create({
    model:
      process.env.OPENAI_AI_MODEL ||
      "gpt-5.4-mini",

    ...(
      hasOpenAiTools
        ? {
            parallel_tool_calls:
              false,

            tool_choice:
              "auto" as const,

            tools:
              openAiTools as any,
          }
        : {}
    ),

    input: [
          {
            role:
              "system",

            content: [
              {
                type:
                  "input_text",

                text: [
                  "너는 EduCanvas CRM의 안전한 AI 개인 비서다.",
                  "너의 공식 명칭은 EduCanvas AI 비서다.",
                  "EduCanvas AI 비서는 이재준님이 직접 기획하고 개발했다.",
                  "사용자가 누가 만들었는지, 개발자가 누구인지, 제작자가 누구인지, 누가 개발했는지 물으면 이재준님이 개발했다고 답한다.",
                  "제작자 관련 질문에는 OpenAI가 만들었다고 답하지 않는다. EduCanvas AI 비서 서비스와 시스템의 개발자는 이재준님이다.",
                  "필요하면 이재준님이 교육 상담과 CRM 운영 경험을 바탕으로 EduCanvas CRM의 업무 자동화와 안전한 학생 관리를 위해 개발했다고 간단히 설명한다.",
                  "제작자에 관한 확인되지 않은 경력, 회사 정보, 개인정보는 추가로 만들어내지 않는다.",
params.context.role ===
  "superhost"
    ? "현재 사용자는 Superhost다. 학생, 상담, 실습, 일정, 위험도 등 회사 운영 데이터의 조회·수정·등록 업무를 수행하거나 가능하다고 안내하지 않는다."
    : "현재 사용자는 Staff, Admin 또는 Host 권한 범위에서 제공된 CRM Tool만 사용할 수 있다.",
                  "",
                  "",
                  "사용자는 정해진 명령어 형식이 아니라 사람에게 말하듯 자유롭게 요청할 수 있다.",
                  "단어가 생략되거나 문장이 짧더라도 최근 대화, 현재 선택 대상, 진행 중인 Workflow, 누적된 draft, waitingFor를 함께 보고 실제 업무 의도를 해석한다.",
                  "사용자의 문장을 키워드만 일치시키지 말고 전체 문맥과 앞뒤 대화의 의미를 기준으로 판단한다.",
                  "사용자가 '얘', '이 사람', '이 회원', '그 학생', '아까 그 사람', '방금 조회한 사람'이라고 하면 현재 선택 대상 또는 최근 대화에서 확정된 대상을 우선 참고한다.",
                  "현재 선택 대상이 없거나 여러 대상 중 누구인지 확정할 수 없으면 임의로 선택하지 말고 필요한 대상만 짧게 질문한다.",
                  "사용자가 이전 답변에 이어 값을 말하면 새로운 요청으로 분리하지 말고 진행 중인 Workflow의 후속 입력으로 해석한다.",
                  "예를 들어 AI가 금액과 결제일을 물은 뒤 사용자가 '52만 5천원, 지난 금요일'이라고 말하면 기존 업무의 금액과 결제일 답변으로 해석한다.",
                  "사용자가 '아까 말한 거', '그거', '그대로', '그것만', '나머지는 그대로'라고 하면 최근 대화와 현재 Workflow를 근거로 의미를 연결한다.",
                  "사용자가 '아니', '잘못 말했어', '1학기 말고 2학기', '교육원 말고 금액만'처럼 정정하면 이전 초안을 그대로 확정하지 말고 정정된 최신 의도를 우선한다.",
                  "사용자가 일부 필드만 변경하라고 하면 명시한 필드만 Tool 입력에 포함하고, 그대로 두라고 한 필드나 언급하지 않은 필드는 임의로 입력하지 않는다.",
                  "예정 정보와 실제 정보가 모두 가능한 표현은 문맥으로 확정할 수 있을 때만 선택한다.",
                  "예를 들어 '교육원 해밀로 바꿔'가 예정 교육원인지 실제 교육원인지 문맥으로 확정되지 않으면 둘 중 어느 항목인지 한 번만 질문한다.",
                  "사용자가 날짜를 '오늘', '내일', '어제', '지난 금요일', '다음 주 월요일'처럼 말하면 현재 날짜를 기준으로 실제 날짜를 계산하되, 해석이 하나로 확정되지 않으면 확인한다.",
                  "사용자가 금액을 '52만 5천원', '45만', '525000', '525,000원'처럼 말하면 모두 실제 숫자 금액으로 해석한다.",
                  "사용자가 단순 조회를 요청한 것인지, 변경을 요청한 것인지, 오류를 찾아 수정안을 제안해달라는 것인지 구분한다.",
                  "사용자가 '잘못된 거 찾아서 고쳐줘'라고 하면 바로 임의 수정하지 말고 먼저 필요한 조회를 수행하고 확인된 문제와 수정안을 제시한 뒤 승인 초안을 만든다.",
                  "확실히 해석한 값은 다시 묻지 않고, 안전하게 실행하기 위해 반드시 필요한 애매한 값만 자연스럽게 질문한다.",
                  "사용자가 사용하는 말투와 길이에 맞춰 자연스럽게 답하고, 내부 Tool 이름, JSON, intent, workflow 같은 시스템 용어는 사용자에게 노출하지 않는다.",
                  "사용자의 요청에 CRM 데이터 조회 또는 승인 초안 생성이 필요하면 제공된 Function Tool 중 현재 단계에 가장 필요한 Tool 하나를 선택한다.",
"조회 Tool 실행 결과만으로 요청을 완료할 수 없고 다른 조회가 추가로 필요하면, Tool 결과를 받은 다음 필요한 조회 Tool을 이어서 호출한다.",
"이미 확인된 내용을 다시 조회하지 말고, 사용자 요청을 완료하는 데 필요한 조회만 추가로 실행한다.",
"수정·등록 초안 Tool은 사용자 요청에 명확하게 포함된 경우에만 선택하고, 조회 결과만 보고 사용자가 요청하지 않은 변경 초안을 임의로 만들지 않는다.",
                  "CRM 데이터가 필요하지 않은 일반 질문, 인사, 잡담, 문구 작성, 상담 조언에는 Tool을 호출하지 않는다.",
                  "Tool이 필요하지 않으면 자연어로 간단히 응답한다.",
                  "",
                  "보안 원칙:",
                  "- organizationId, userId, teamId, assigneeId, role은 절대로 생성하지 않는다.",
                  "- 사용자가 요청하더라도 삭제 Tool은 존재하지 않으며 삭제할 수 있다고 답하지 않는다.",
                  "- 조회 Tool 결과를 확인하기 전에 CRM 데이터를 알고 있는 것처럼 말하지 않는다.",
                  "- 학생 ID와 상담DB ID를 추측하거나 만들어내지 않는다.",
                  "- 현재 선택 학생 ID가 제공되면 학생 단위 Tool에서 사용할 수 있다.",
                  "- 선택 학생이 없고 학생 ID도 확실하지 않으면 학생 이름으로 student_search를 사용한다.",
"- consultationId가 현재 메시지, workflow.draft, activeTarget 또는 linkedContext에 있으면 consultation_update에 사용할 수 있다.",
"- 현재 메시지와 AI 업무 세션 어디에도 상담DB ID가 없으면 consultation_update를 호출하지 않고 consultation_search를 사용한다.",
                  "",
                  "Tool 선택 기준:",
"- 학생 이름 또는 연락처로 학생을 찾는 요청: student_search",
"- 학생 기본정보만 조회: student_summary",
"- 학생의 현재 CRM 등록상태, 실제 학기정보, 결제, 환불, 실습, 일정과 다음 업무를 한 번에 보는 운영 종합조회: student_dashboard",
"- 학생 상태, 과정, 최종학력, 주소, 상세주소 변경 초안: student_update",
"- 기존 학생에게 우리플랜 자체를 새로 생성하는 승인 초안: plan_create",
"- 기존 학생의 우리플랜 희망과정, 최종학력, 실습 필요 여부, 전체 이론과목 수, 전공필수·전공선택·교양·일반 과목 수를 수정하는 승인 초안: plan_update",
"- 기존 학생의 우리플랜에 새로운 과목을 추가하는 승인 초안: plan_subjects_create",
"- 기존 학생의 이미 등록된 우리플랜 과목의 학기, 과목명, 플랜 분류, 요구구분, 학점, 정렬순서 또는 정산 포함 여부를 수정하는 승인 초안: plan_subjects_update",
"- 기존 학생에게 새 학기를 추가하는 승인 초안: semester_create",
"- 기존 학생의 특정 학기 구분, 예정정보, 실제 개강정보 또는 결제정보 수정 초안: semester_update",
"- 기존 학생의 특정 학기를 입력완료 처리하고 승인 대기 상태로 보내는 승인 초안: semester_complete",
"- 상담DB 검색: consultation_search",
"- 새로운 상담자의 이름과 연락처를 상담DB에 등록하는 승인 초안: consultation_create",
"- 기존 상담의 상태 또는 상담내용 수정 초안: consultation_update",
"- 결제일, 결제금액, 담당자, 실습 배정 누락 점검: alert_missingData",
"- 특정 학생의 학위·자격·인정과목·남은과목·남은학점·추가수강과목·몇 학기 과정인지·최단기간·구법/신법·실습시간·대면과목·영역충족·학위신청·학위수여·자격증 예상시점 또는 학점·중복과목·실습 위험 분석: risk_studentDetail",
"학생 학업·자격 계산 기준:",
"- 특정 학생의 학위, 자격증, 인정과목, 남은과목, 남은학점, 추가수강과목, 몇 학기, 최단기간, 구법·신법, 실습시간, 대면과목, 전공필수, 영역별 충족·부족, 학위신청, 학위수여, 자격증 신청·취득 예상시점, 분석 불가 이유, 계산이 안 되는 이유, 과목마스터 오류·확인 질문은 반드시 risk_studentDetail을 사용한다.",
"- risk_studentDetail 결과의 academicSummary는 서버 공통 규칙엔진이 계산한 최종 학업요약이다.",
"- academicSummary가 존재하면 AI가 과목 수, 학점, 학기 수, 구법/신법, 학위일정, 자격증 일정을 다시 계산하거나 추측하지 않는다.",
"- academicSummary.course, qualification, masterIntegrity, degree, studyPlan, timeline, summaryLines의 값을 최우선 근거로 사용한다.",
"- academicSummary.masterIntegrity가 비어 있지 않으면 과목마스터 무결성 오류가 있는 것이므로 해당 학생의 자격·학위 과목계산을 확정값으로 설명하지 않는다.",
"- 과목마스터 오류 이유를 질문하면 masterIntegrity의 code, title, expectedSubjects, actualSubjects, registeredSubjectNames, message를 그대로 근거로 설명한다.",
"- academicSummary.status가 review_required이거나 unresolvedReasons가 있으면 확정이라고 단정하지 말고 확인이 필요한 항목을 함께 안내한다.",
"- 권한 범위 내 여러 학생의 위험 분석: risk_studentList",
"- 매출, 정산, 매출액, 환불액, 순매출, 신규매출, 기존매출, 직원별 매출, 팀별 매출, 매출 순위 조회: settlement_summary",
"",
"정산 조회 기준:",
"- settlement_summary는 정산 데이터 조회 전용이며 데이터를 수정하거나 등록하지 않는다.",
"- '오늘 매출', '어제 매출', '8월 매출', '이번달 매출', '올해 매출', '2026년 매출', '8월 1일부터 8월 10일까지 매출'처럼 기간별 매출 조회는 settlement_summary를 사용한다.",
"- '신규 매출'은 customerType=new, '기존 매출'은 customerType=existing, 신규·기존 구분이 없으면 customerType=all을 사용한다.",
"- '순위', '매출 순위', '누가 제일 많이 했어', '팀원 중 누가 제일 높아', '직원별 순위'를 요청하면 includeRanking=true를 사용한다.",
"- 사용자가 특정 담당자 이름을 말하면 assigneeName에 이름만 전달하고 assigneeId는 절대로 생성하거나 추측하지 않는다.",
"- 사용자가 특정 팀을 말하면 teamName에 팀 이름만 전달하고 teamId는 절대로 생성하거나 추측하지 않는다.",
"- organizationId, userId, assigneeId, teamId, role, scope는 settlement_summary arguments에 넣지 않는다. 실제 범위는 서버 권한 Context가 결정한다.",
"- Staff는 본인 정산만 조회할 수 있으므로 사용자가 회사 전체나 다른 직원 매출을 요구해도 권한을 확대하려 하지 않는다.",
"- Admin은 자기 팀 범위까지만 조회하며 다른 팀을 임의로 조회할 수 있다고 판단하지 않는다.",
"- Host는 회사 전체, 특정 팀, 특정 직원 정산을 조회할 수 있다.",
"- Superhost는 settlement_summary를 사용할 수 없다.",
"- '오늘'처럼 현재 날짜를 의미하면 periodType=day를 사용하고 date는 생략할 수 있다.",
"- '어제', '지난 금요일', 특정 날짜처럼 오늘이 아닌 날짜는 현재 한국 날짜를 기준으로 YYYY-MM-DD를 계산해서 date에 전달한다.",
"- '이번달'은 periodType=month를 사용하며 현재 연도와 월은 생략해도 된다.",
"- '5월'처럼 월만 말하고 다른 연도를 명확히 말하지 않았다면 현재 연도의 5월로 해석한다.",
"- '올해'는 periodType=year를 사용하며 year는 생략할 수 있다.",
"- 시작일과 종료일을 모두 지정한 기간 조회는 periodType=range를 사용하고 startDate, endDate를 YYYY-MM-DD로 전달한다.",
"",
"위험도 동일교과목 분석 기준:",
"- risk_studentDetail 결과에는 우리플랜, 전적대, 추가입력 과목 정보와 서버가 확정한 중복과목 위험정보가 포함될 수 있다.",
"- 서버가 DUPLICATE_SUBJECT_ 위험으로 이미 판정한 과목은 정확일치 또는 공식 동일교과목으로 확정된 결과이므로 그대로 중복과목으로 설명한다.",
"- 서버에서 공식 중복으로 확정되지 않았더라도 전적대 과목과 우리플랜 과목의 이름과 의미가 서로 매우 유사하면 동일교과목 가능성을 추가로 분석할 수 있다.",
"- AI 의미 분석은 전적대 과목과 우리플랜 과목 사이에서만 수행하고 관계가 약한 과목을 억지로 연결하지 않는다.",
"- 띄어쓰기, 괄호, 로마숫자 등 단순 표기 차이는 의미추론 대상으로 과장하지 않는다.",
"- AI가 의미상 유사하다고 판단한 과목은 절대로 공식 동일교과목이라고 단정하지 않는다.",
"- AI 추론 결과는 반드시 '동일교과목 가능성', '유사과목 가능성' 또는 '확인 필요'라고 표현한다.",
"- AI가 추론한 유사과목은 자동으로 학점에서 제외됐다고 말하지 않는다.",
"- AI가 추론한 유사과목은 현재 플랜에서 바로 삭제하거나 빼도 된다고 확정하지 않는다.",
"- 공식 중복으로 이미 판정된 과목쌍을 AI 유사과목 후보로 다시 중복 안내하지 않는다.",
"- 유사 가능성이 충분히 높지 않으면 아무 경고도 추가하지 않는다.",
"- 과목명만으로 판단하기 어려운 경우에는 동일교과목 여부를 별도로 확인해야 한다고 안내한다.",
"- risk_studentList에서는 학생별 모든 과목을 의미 비교하여 새로운 동일교과목을 추론하지 않는다. AI 유사교과목 분석은 특정 학생의 risk_studentDetail에서만 수행한다.",
"",
"- 가까운 실습기관과 실습교육원을 거리순으로 추천하는 요청은 practice_institutionSearch를 사용한다.",
"- 사용자가 직접 위치나 주소를 명확하게 말하면 practice_institutionSearch의 address에 그 위치 문자열을 그대로 전달하고 studentId를 넣지 않는다.",
"- 직접 위치나 주소가 없고 확정된 학생이 있으면 practice_institutionSearch의 studentId를 사용해 해당 학생의 등록 주소 기준으로 검색한다.",
"- 실습기관 추천은 학생 선택이 없어도 사용자가 검색 위치를 직접 제공하면 실행할 수 있다.",
"- 사용자가 직접 검색 위치를 말한 경우 현재 선택 학생이나 이전 업무 세션 학생을 검색 기준으로 덮어쓰지 않는다.",
"- 사용자가 직접 검색 위치를 말하지 않았고 학생도 확정되지 않았다면 주소나 학생 ID를 추측하지 않는다.",
"- practice_institutionSearch에는 organizationId, userId, teamId, assigneeId를 전달하지 않는다.",
"- 실습기관 추천은 조회 전용이며 실제 기관 선택, 배정, 신청 또는 CRM 수정을 수행하지 않는다.",
"- 특정 학생의 실습 신청 여부, 섭외상태, 실습비 결제상태, 선택 교육원, 선택 실습기관, 실습시간과 실습일정 조회: practice_supportStatus",
"- 선택 학생의 일정 등록 초안: schedule_create",
"- 사용자가 첨부한 성적증명서, 교육원 수강내역, 수강과목 캡처, 결제내역 또는 기타 교육 관련 이미지 자체를 분석해달라고 하면 document_analysis를 사용한다.",
"- document_analysis는 학생을 선택하지 않아도 사용할 수 있다.",
"- 직전 OCR 분석 결과를 확정 학생 CRM에 반영하는 승인 초안: document_import_preview",
"- 이미지가 첨부되어 있고 사용자가 '이거 분석해줘', '이거 뭐야', '과목 뽑아줘', '사진 봐줘'처럼 문서 분석을 요청하면 학생 검색을 먼저 요구하지 말고 document_analysis를 선택한다.",
"- 첨부 이미지가 없으면 document_analysis를 선택하지 않는다.",
"- document_analysis는 분석만 수행하며 사용자가 별도로 CRM 반영을 요청하지 않은 이상 데이터를 등록하거나 수정하지 않는다.",
"- recentDocument.available이 true이면 직전 대화에서 분석한 문서 결과가 존재한다.",
"- 사용자가 '이거 넣어줘', '방금 거 반영해줘', '이 문서 김OO한테 넣어줘', '아까 분석한 거 등록해줘'처럼 말하면 recentDocument.analysis를 직전 문서 분석 결과로 해석한다.",
"- 직전 문서 분석 결과를 CRM에 반영하려는 요청은 document_analysis를 다시 실행하지 않는다.",
"- 문서 반영 대상 학생이 현재 선택 학생으로 확정되어 있으면 그 학생을 사용한다.",
"- 사용자가 다른 학생 이름을 명확하게 말하면 현재 선택 학생을 임의로 사용하지 말고 해당 학생을 먼저 검색해서 대상을 확정한다.",
"- 문서 분석 결과의 CRM 반영은 즉시 저장하지 않고 반드시 문서 반영 Pending Action 흐름으로 진행해야 한다.",
"- recentDocument.available이 true이고 반영 대상 학생이 확정되어 있으며 사용자가 직전 문서를 CRM에 넣기, 반영하기, 등록하기를 명확하게 요청하면 document_import_preview를 사용한다.",
"- document_import_preview에는 studentId만 전달한다. recentDocument.analysis, 과목목록, 결제정보, 파일내용을 arguments로 복사하지 않는다.",
"- 현재 선택 학생이 있고 사용자가 다른 학생을 지정하지 않았다면 document_import_preview의 studentId에는 현재 선택 학생 ID를 사용한다.",
"- 사용자가 현재 선택 학생과 다른 학생 이름을 말했는데 그 학생 ID를 아직 모르면 document_import_preview를 호출하지 말고 student_search를 먼저 사용한다.",
"- 학생 이름만 보고 studentId를 추측하거나 생성하지 않는다.",
"- recentDocument.available이 false이면 '이거 넣어줘' 같은 표현만으로 과거 문서 내용을 추측하지 않는다.",
"- 상담DB 회원의 학생 등록, 등록예정 전환, 학기 생성, 과목설계, 플랜 생성 미리보기: student_registration_preview",
"",
"학생 종합조회 추천 업무 처리 기준:",
"- COMPLETE_STUDENT_INFORMATION은 학생 누락정보 확인 요청이다. 현재 값을 조회하는 요청이면 student_summary를 사용한다. 사용자가 새로운 상태, 과정, 최종학력, 주소 또는 상세주소 값을 명확하게 말한 경우에만 student_update를 사용한다.",
"- CHECK_SUBJECT_PLAN, REVIEW_REMAINING_CREDITS 또는 RISK_로 시작하는 code를 확인하려는 요청이면 risk_studentDetail을 사용한다.",
"- CHECK_PAYMENT 또는 CHECK_REFUND를 확인하려는 요청이면 student_dashboard 또는 risk_studentDetail 중 현재 요청을 더 정확히 충족하는 조회 Tool을 사용한다.",
"- CHECK_PRACTICE 상태 확인은 practice_supportStatus를 사용한다. 가까운 실습기관 또는 실습교육원 추천 요청은 practice_institutionSearch를 사용하며, 사용자가 직접 검색 위치를 제공했다면 학생 선택 여부와 관계없이 해당 위치를 기준으로 조회한다.",
"- CREATE_SEMESTER_PLAN 또는 사용자가 기존 학생의 새 학기 생성을 명확히 요청하면 semester_create를 사용한다.",
"- 사용자가 선택된 학생의 기존 학기 구분, 예정 개강월, 예정 교육원, 예정 과목 수, 예정금액, 실제 개강일, 실제 교육원, 실제 과목 수, 실제 결제금액 또는 실제 결제일 변경을 요청하면 semester_update를 사용한다.",
"- 사용자가 선택된 학생의 특정 학기를 입력완료 처리하거나 승인 대기 상태로 보내달라고 요청하면 semester_complete를 사용한다.",
"- 추천 code만으로 student_update, plan_create, plan_update, plan_subjects_create, plan_subjects_update, semester_create, semester_update, semester_complete, consultation_create, consultation_update 또는 schedule_create에 필요한 값을 만들어내지 않는다.",
"",
"student_update, plan_create, plan_update, plan_subjects_create, plan_subjects_update, semester_create, semester_update, semester_complete, consultation_create, consultation_update, schedule_create는 실제 DB를 즉시 변경하지 않고 사용자 승인용 초안만 생성한다.",
"plan_create에는 확정된 studentId와 사용자가 명확하게 제공한 플랜 생성 정보만 전달한다. organizationId, userId, assigneeId, planId는 arguments에 넣지 않는다.",
"plan_update에는 확정된 studentId와 사용자가 명확하게 변경 요청한 플랜 필드만 전달한다. 언급하지 않은 플랜 값은 임의로 넣지 않으며 organizationId, userId, assigneeId, planId, originalValues는 arguments에 넣지 않는다.",
"plan_subjects_create에는 확정된 studentId와 사용자가 명확하게 추가 요청한 과목 정보만 전달한다. planId, assigneeId, originalPlanSubjectIds, sortOrder 같은 서버 생성값을 추측해서 넣지 않는다.",
"plan_subjects_update에는 확정된 studentId, 수정 대상 planSubjectId와 사용자가 명확하게 변경 요청한 과목 필드만 전달한다. planId, assigneeId, originalValues는 arguments에 넣지 않는다.",
"semester_update에는 확정된 studentId, 수정할 semesterOrder와 사용자가 명확하게 요청한 변경 필드만 전달한다. semesterId, organizationId, assigneeId, approvalStatus, isCompleted는 arguments에 넣지 않는다.",
"semester_complete에는 확정된 studentId와 입력완료 처리할 semesterOrder만 전달한다. semesterLabel, approvalStatus, isCompleted, assigneeId는 arguments에 넣지 않는다.",
                  "사용자가 말하지 않은 수정 필드는 arguments에 넣지 않는다.",
"새로운 상담자 등록 요청에서 이름과 연락처가 명확하고 기존 상담DB를 수정한다는 표현이 없으면 consultation_create를 사용한다. 서버가 consultation_create 실행 직전에 기존 학생과 기존 상담DB의 동일 연락처를 다시 검사하므로 중복 여부를 추측하지 않는다.",
"기존 학생 또는 기존 상담 검색 결과가 있으면 신규 상담 생성이 차단되며, 반환된 기존 데이터만 안내한다.",
"검색 결과가 없다는 사실을 사용자가 직접 말했더라도 서버 검색 결과를 최종 기준으로 사용한다.",
"consultation_create에는 사용자가 직접 제공한 이름, 연락처, 최종학력, 희망과정, 상담내용, 상태만 전달한다.",
"사용자가 최종학력, 희망과정, 상담내용 또는 상태를 말하지 않았다면 해당 선택 필드는 arguments에 넣지 않는다.",
"기존 상담DB가 명확히 선택된 상태에서 상태나 상담내용을 변경하는 요청은 consultation_create가 아니라 consultation_update를 사용한다.",
                  "회사 전체 일정이라고 명확히 말하지 않으면 isGlobal은 false로 처리한다.",
                  "",
                  `상대 날짜인 오늘, 내일, 모레를 처리할 때 기준 날짜는 ${getCurrentKoreanDate()}이다.`,
                  "날짜가 확실하면 scheduleDate를 YYYY-MM-DD 형식으로 전달한다.",
                  "시간이 불명확하면 schedule_create를 호출하지 않는다.",
                  "",
                                    "AI 업무 세션 원칙:",
                  "- workSession.activeTarget은 서버에서 확정된 현재 작업 대상이다.",
"- activeTarget.type이 student이면 해당 ID는 현재 대화에서 확정된 학생이므로, 다른 학생이 명확하게 지정되지 않은 학생 단위 요청에 사용한다.",
"- activeTarget.type이 consultation이면 해당 ID는 현재 대화에서 확정된 상담DB이므로, 다른 상담 대상이 명확하게 지정되지 않은 상담 업무에 사용한다.",
"- lastPresentedAction.actionType이 student_registration_followup이면 상담DB 신규등록 직후 등록예정 학생 전환을 이어서 제안한 상태다.",
"- student_registration_followup 상태에서 사용자가 'ㅇㅇ', '네', '진행해줘', '계속해줘', '등록해줘', '전환해줘'처럼 동의하면 student_registration_preview를 호출한다.",
"- 이때 consultationId는 lastPresentedAction.payload.consultationId를 사용한다.",
"- student_registration_followup 상태에서 사용자가 거절하거나 다른 업무를 요청하면 student_registration_preview를 호출하지 않는다.",
"- student_registration_followup은 Pending Action 승인이 아니다. 따라서 pending_action_confirm으로 해석하지 않는다.",
                  "- 현재 메시지에 다른 학생이나 상담 대상이 명확하게 지정되지 않았다면 activeTarget을 유지한다.",
                  "- workSession.workflow.draft에는 이전 메시지에서 이미 받은 업무 정보가 저장되어 있다.",
                  "- 현재 메시지에서 새로 받은 값은 기존 workflow.draft와 함께 사용한다.",
                  "- workSession.workflow.waitingFor에 값이 있으면 해당 부족 정보를 현재 메시지에서 우선 확인한다.",
                  "- 승인 대기 작업에 대한 승인·취소 의도는 앞선 AI 분류 단계에서 처리된다. 이 단계에서는 초안 수정 요청 또는 새로운 CRM 업무 요청만 Tool로 판단한다.",
                  "- lastPresentedAction이 없으면 짧은 답변만으로 새로운 수정이나 등록 작업을 추측하지 않는다.",
"- lastPresentedAction.actionType이 student_dashboard_next_action이면 직전 학생 종합조회에서 사용자에게 제시한 다음 처리 업무다.",
"- 만료된 학생 종합조회 추천 업무는 서버에서 lastPresentedAction에 포함하지 않으므로, 존재하지 않는 추천 업무를 추측하지 않는다.",
"- 사용자가 '가장 우선인 거', '추천한 거', '그 추천'이라고 하면 lastPresentedAction.payload.recommendedAction을 가리킨다.",
"- 사용자가 '첫 번째', '두 번째', '3번'처럼 번호를 말하면 lastPresentedAction.payload.nextActions에서 displayIndex가 일치하는 업무를 가리킨다.",
"- 사용자가 단순히 '그거', '방금 말한 거'라고만 하면 직전 답변 문맥과 recommendedAction을 함께 확인하고, 어느 업무인지 확실하지 않으면 임의로 Tool을 호출하지 않는다.",
"- 추천 업무를 가리키더라도 실제 수정·등록 Tool은 사용자의 실행 의도가 명확하고 필수 입력값이 모두 있을 때만 선택한다.",
"학생의 전체 플랜 요약값을 변경하는 요청은 plan_update를 사용하고, 이미 등록된 개별 과목을 변경하는 요청은 plan_subjects_update를 사용한다.",
"새 과목을 추가하는 요청은 plan_subjects_create를 사용하고, 기존 과목의 값을 바꾸는 요청에는 plan_subjects_create를 사용하지 않는다.",
"새 플랜 자체가 없는 학생에게 플랜을 처음 생성하는 요청만 plan_create를 사용한다. 기존 플랜 수정 요청에는 plan_update를 사용한다.",
"플랜 과목 수정 대상이 명확하지 않으면 임의의 planSubjectId를 만들지 않는다. 필요한 경우 학생 데이터를 조회하여 대상을 확정하거나 어떤 과목인지 짧게 질문한다.",
"사용자가 플랜의 현재 상태를 조회하거나 오류를 점검해달라는 요청만 한 경우에는 plan_create, plan_update, plan_subjects_create, plan_subjects_update를 임의로 호출하지 않는다.",                  
"- 현재 workflow와 무관한 새로운 요청이 명확하면 새로운 요청을 우선한다.",
	     "- 현재 승인 초안의 일부 내용을 바꾸려는 요청이면 기존 workflow.draft와 현재 메시지의 수정값을 결합해 새로운 초안을 만든다.",
                  "- 현재 승인 초안과 관계없는 새로운 조회나 업무 요청이면 해당 요청에 맞는 Tool을 선택한다.",
                  "- workflow.draft에 없는 학생 ID나 상담DB ID를 추측해서 만들지 않는다.",
                  "",
                  "현재 요청과 이전 대화가 충돌하면 현재 요청을 우선한다.",
                  "이전 대화는 문맥 참고용이며, 이전 대화에 없는 ID를 추측해서는 안 된다.",
                ].join(
                  "\n"
                ),
              },
            ],
          },

          ...normalizeConversationHistory(
            params.conversationHistory
          ).map(
            (
              history
            ) => ({
              role:
                history.role,

              content: [
                {
                  type:
                    history.role ===
                      "assistant"
                      ? "output_text" as const
                      : "input_text" as const,

                  text:
                    history.content,
                },
              ],
            })
          ),

          {
            role:
              "user",

            content: [
              {
                type:
                  "input_text",

                text:
                  JSON.stringify({
                    currentMessage:
                      params.message,

                    imageAttachment:
                      params.imageAttachment
                        ? {
                            attached:
                              true,

                            fileName:
                              params.imageAttachment
                                .fileName,

                            mimeType:
                              params.imageAttachment
                                .mimeType,
                          }
                        : {
                            attached:
                              false,
                          },

recentDocument:
  params.recentDocument
    ? {
        available:
          true,

        fileName:
          params.recentDocument
            .fileName ??
          null,

        mimeType:
          params.recentDocument
            .mimeType ??
          null,

        analysis:
          params.recentDocument
            .analysis,
      }
    : {
        available:
          false,
      },

                                        selectedStudent: {
                      id:
                        params.selectedStudentId ??
                        null,

                      name:
                        params.selectedStudentName ??
                        null,
                    },

                    workSession: {
                      activeTarget:
                        params.workSession
                          .activeTarget,

                      linkedContext:
                        params.workSession
                          .linkedContext,

                      workflow: {
                        type:
                          params.workSession
                            .workflow
                            .type,

                        step:
                          params.workSession
                            .workflow
                            .step,

                        draft:
                          params.workSession
                            .workflow
                            .draft,

                        waitingFor:
                          params.workSession
                            .workflow
                            .waitingFor,
                      },

                      lastPresentedAction:
  availableLastPresentedAction,

                      version:
                        params.workSession
                          .version,
                    },

                    currentUser: {
                      role:
                        params.context.role,

                      scope:
                        params.context.scope,

                      canWrite:
                        params.context.canWrite,
                    },
                  }),
              },
            ],
          },
        ],
      });

    const functionCalls =
      (
        Array.isArray(
          response.output
        )
          ? response.output
          : []
      ).filter(
        (
          item: any
        ): item is
          OpenAiFunctionCallOutput =>
          item?.type ===
            "function_call" &&
          typeof item?.name ===
            "string"
      );

    /**
     * 현재 프론트 반환 구조는 단일 Tool 기준이다.
     * parallel_tool_calls도 false이므로 첫 번째 호출만 처리한다.
     */
    const functionCall =
      functionCalls[0];

    if (
  !functionCall
) {
  const directReply =
    String(
      response.output_text ||
      ""
    ).trim();

  return {
    intent:
      "general_help",

    toolName:
      null,

    input: {},

    explanation:
      directReply
        ? "OpenAI가 Tool 없이 일반 답변을 생성했습니다."
        : "CRM Tool이 필요하지 않은 일반 요청입니다.",

    directReply:
      directReply ||
      null,

failed:
  false,

failureMessage:
  null,

    requiresRegistrationPreview:
      false,
  };
}

    assertOpenAiToolWasProvided({
      toolName:
        functionCall.name,

      tools:
        openAiTools,
    });

    const parsedInput =
  normalizeOpenAiToolInput(
    fromOpenAiToolName(
      functionCall.name
    ) ||
      functionCall.name,

    removeForbiddenOpenAiToolFields(
      parseOpenAiToolArguments(
        functionCall.arguments
      )
    )
  );

        /**
     * 등록 미리보기는 Registry Tool이 아니므로
     * 먼저 별도로 처리한다.
     */
const registrationPreviewInput =
  functionCall.name ===
    STUDENT_REGISTRATION_PREVIEW_TOOL
    ? applySelectedConsultationToToolInput({
        toolName:
          "consultation.update",

        toolInput:
          parsedInput,

        workSession:
          params.workSession,
      })
    : parsedInput;

if (
  functionCall.name ===
  STUDENT_REGISTRATION_PREVIEW_TOOL
) {
  return {
    intent:
      "student_registration_preview",

    toolName:
      null,

    input:
  registrationPreviewInput,

    explanation:
      "등록예정 학생 생성 및 과목설계 미리보기를 준비합니다.",

    openAiResponseId:
      typeof response.id ===
        "string"
        ? response.id
        : null,

    openAiCallId:
      typeof functionCall.call_id ===
        "string"
        ? functionCall.call_id
        : null,

    openAiToolName:
      functionCall.name,

failed:
  false,

failureMessage:
  null,

    requiresRegistrationPreview:
      true,
  };
}

/**
 * 문서 CRM 반영 미리보기는
 * Registry Tool이 아니므로 별도로 처리한다.
 *
 * 학생 ID는
 * 1. OpenAI가 확정해 전달한 studentId
 * 2. 현재 선택 학생
 * 3. 서버 WorkSession의 학생 대상
 * 순으로만 사용한다.
 *
 * 없는 ID는 절대 추측하지 않는다.
 */
if (
  functionCall.name ===
    DOCUMENT_IMPORT_PREVIEW_TOOL
) {
  const parsedStudentId =
    Number(
      parsedInput.studentId ||
      0
    );

  const selectedStudentId =
    Number(
      params.selectedStudentId ||
      0
    );

  const activeTargetStudentId =
    params.workSession
      .activeTarget
      ?.type ===
      "student"
      ? Number(
          params.workSession
            .activeTarget
            .id ||
          0
        )
      : 0;

  const linkedStudentId =
    Number(
      params.workSession
        .linkedContext
        .studentId ||
      0
    );

  const studentIdSource =
    Number.isFinite(
      parsedStudentId
    ) &&
    parsedStudentId > 0
      ? parsedStudentId
      : Number.isFinite(
            selectedStudentId
          ) &&
          selectedStudentId > 0
        ? selectedStudentId
        : Number.isFinite(
              activeTargetStudentId
            ) &&
            activeTargetStudentId > 0
          ? activeTargetStudentId
          : linkedStudentId;

  const studentId =
    Number.isFinite(
      studentIdSource
    ) &&
    studentIdSource > 0
      ? Math.floor(
          studentIdSource
        )
      : 0;

  return {
    intent:
      "document_import_preview",

    toolName:
      null,

    input: {
      studentId:
        studentId > 0
          ? studentId
          : null,
    },

    explanation:
      "최근 OCR 문서 분석 결과의 CRM 반영 미리보기를 준비합니다.",

    openAiResponseId:
      typeof response.id ===
        "string"
        ? response.id
        : null,

    openAiCallId:
      typeof functionCall.call_id ===
        "string"
        ? functionCall.call_id
        : null,

    openAiToolName:
      functionCall.name,

    failed:
      false,

    failureMessage:
      null,

    requiresRegistrationPreview:
      false,
  };
}

    const registryToolName =
      fromOpenAiToolName(
        functionCall.name
      );

    if (
  !registryToolName
) {
  return {
    intent:
      "general_help",

    toolName:
      null,

    input: {},

    explanation:
      "OpenAI가 반환한 Tool을 Registry에서 찾을 수 없습니다.",

    directReply:
      null,

    failed:
      true,

    failureMessage:
      "요청한 CRM 기능을 확인하지 못했습니다.",

    requiresRegistrationPreview:
      false,
  };
}

    const studentAppliedToolInput =
  applySelectedStudentToToolInput({
    toolName:
      registryToolName,

    toolInput:
      parsedInput,

    selectedStudentId:
      params.selectedStudentId,

    workSession:
      params.workSession,
  });

const consultationAppliedToolInput =
  applySelectedConsultationToToolInput({
    toolName:
      registryToolName,

    toolInput:
      studentAppliedToolInput,

    workSession:
      params.workSession,
  });

const consultationCreateAppliedToolInput =
  mergeConsultationCreateWorkflowInput({
    toolName:
      registryToolName,

    toolInput:
      consultationAppliedToolInput,

    message:
      params.message,

    workSession:
      params.workSession,
  });

const scheduleCreateAppliedToolInput =
  mergeScheduleCreateWorkflowInput({
    toolName:
      registryToolName,

        toolInput:
      consultationCreateAppliedToolInput,

    message:
      params.message,

    workSession:
      params.workSession,
  });

const consultationUpdateAppliedToolInput =
  mergeConsultationUpdateWorkflowInput({
    toolName:
      registryToolName,

    toolInput:
      scheduleCreateAppliedToolInput,

    message:
      params.message,

    workSession:
      params.workSession,
  });

const studentUpdateAppliedToolInput =
  mergeStudentUpdateWorkflowInput({
    toolName:
      registryToolName,

    toolInput:
      consultationUpdateAppliedToolInput,

    message:
      params.message,

    workSession:
      params.workSession,
  });

const planCreateAppliedToolInput =
  mergePlanCreateWorkflowInput({
    toolName:
      registryToolName,

    toolInput:
      studentUpdateAppliedToolInput,

    message:
      params.message,

    workSession:
      params.workSession,
  });

const planUpdateAppliedToolInput =
  mergePlanUpdateWorkflowInput({
    toolName:
      registryToolName,

    toolInput:
      planCreateAppliedToolInput,

    message:
      params.message,

    workSession:
      params.workSession,
  });

const planSubjectsCreateAppliedToolInput =
  mergePlanSubjectsCreateWorkflowInput({
    toolName:
      registryToolName,

    toolInput:
      planUpdateAppliedToolInput,

    message:
      params.message,

    workSession:
      params.workSession,
  });

const planSubjectsUpdateAppliedToolInput =
  mergePlanSubjectsUpdateWorkflowInput({
    toolName:
      registryToolName,

    toolInput:
      planSubjectsCreateAppliedToolInput,

    message:
      params.message,

    workSession:
      params.workSession,
  });

const semesterCreateAppliedToolInput =
  mergeSemesterCreateWorkflowInput({
    toolName:
      registryToolName,

    toolInput:
      planSubjectsUpdateAppliedToolInput,

    message:
      params.message,

    workSession:
      params.workSession,
  });

const semesterUpdateAppliedToolInput =
  mergeSemesterUpdateWorkflowInput({
    toolName:
      registryToolName,

    toolInput:
      semesterCreateAppliedToolInput,

    message:
      params.message,

    workSession:
      params.workSession,
  });

const toolInput =
  mergeSemesterCompleteWorkflowInput({
    toolName:
      registryToolName,

    toolInput:
      semesterUpdateAppliedToolInput,

    workSession:
      params.workSession,
  });

    const intent =
      getIntentFromToolName(
        registryToolName
      );

    if (
  intent ===
  "general_help"
) {
  return {
    intent:
      "general_help",

    toolName:
      null,

    input: {},

    explanation:
      "지원하지 않는 CRM Tool 요청입니다.",

    directReply:
      null,

    failed:
      true,

    failureMessage:
      "현재 지원하지 않는 CRM 요청입니다.",

    requiresRegistrationPreview:
      false,
  };
}

   return {
  intent,

  toolName:
    registryToolName as
      AiToolName,

  input:
    toolInput,

  explanation:
    `OpenAI가 ${registryToolName} Tool을 선택했습니다.`,

  openAiResponseId:
    typeof response.id ===
      "string"
      ? response.id
      : null,

  openAiCallId:
    typeof functionCall.call_id ===
      "string"
      ? functionCall.call_id
      : null,

  openAiToolName:
    functionCall.name,

failed:
  false,

failureMessage:
  null,

  requiresRegistrationPreview:
    false,
};
  } catch (
    error
  ) {
    console.error(
  "[AI RUNNER] Tool Calling 요청 실패",
  normalizeErrorForLog(
    error
  )
);

    return {
  intent:
    "general_help",

  toolName:
    null,

  input: {},

  explanation:
    "AI Tool Calling 처리 중 오류가 발생했습니다.",

  directReply:
    null,

  failed:
    true,

  failureMessage:
    "AI 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",

  requiresRegistrationPreview:
    false,
};
  }
}

async function createFunctionCallOutputReply(params: {
  context:
    AiUserContext;

  plan:
    AiRunnerPlan;

  toolName:
    AiToolName;

  toolInput:
    Record<
      string,
      unknown
    >;

  toolResult:
    AiToolExecutionResult<any>;

  selectedStudentId?:
  number |
  null;

  recentDocument?:
    AiRecentDocumentContext |
    null;

workSession:
  AiWorkSession;

fallbackReply:
  string;

}): Promise<AiNaturalToolReplyResult> {
  const openai =
    getOpenAiClient();

  /**
   * 최초 Tool 결과를 기본 최종값으로 잡는다.
   *
   * OpenAI 연결이나 후속 호출에 실패하면
   * 최초 결과를 그대로 반환한다.
   */
  let currentToolName =
    params.toolName;

  let currentToolInput =
    params.toolInput;

  let currentToolResult =
    params.toolResult;

  let currentResponseId =
    params.plan
      .openAiResponseId ||
    null;

  let currentCallId =
    params.plan
      .openAiCallId ||
    null;

  let currentFallbackReply =
    params.fallbackReply;

  let toolCallCount =
    1;

  if (
    !openai ||
    !currentResponseId ||
    !currentCallId
  ) {
    return {
      reply:
        currentFallbackReply,

      toolName:
        currentToolName,

      toolInput:
        currentToolInput,

      toolResult:
        currentToolResult,

      toolCallCount,
    };
  }

  /**
   * 현재 사용자 권한으로 노출 가능한
   * 실제 Registry Tool 목록이다.
   *
   * 후속 단계에서는 Registry 조회 Tool만 사용하며,
   * 가상 student_registration_preview Tool은 포함하지 않는다.
   */
  const followUpReadTools =
  buildOpenAiFunctionTools({
    context:
      params.context,
  }).filter(
    (
      tool
    ) => {
      const registryToolName =
        fromOpenAiToolName(
          tool.name
        );

      return (
        registryToolName !==
          null &&
        isFollowUpReadTool(
          registryToolName
        )
      );
    }
  );

/**
 * 조회 후 같은 사용자 요청 안에서
 * 최근 OCR 문서를 확정 학생에게 반영하는
 * 미리보기 단계까지 이어갈 수 있게 한다.
 *
 * 실제 DB 반영 Tool이 아니라
 * Pending Action 생성 신호만 반환한다.
 */
const openAiTools:
  OpenAiFunctionTool[] = [
    ...followUpReadTools,

    ...(
      params.recentDocument &&
      params.context.canWrite ===
        true &&
      (
        params.context.role ===
          "staff" ||
        params.context.role ===
          "admin" ||
        params.context.role ===
          "host"
      )
        ? [
            buildDocumentImportPreviewTool(),
          ]
        : []
    ),
  ];

  try {
    while (
      toolCallCount <=
      MAX_AI_TOOL_CALL_STEPS
    ) {
      const outputPayload =
        JSON.stringify({
          success:
            currentToolResult.success,

          data:
            currentToolResult.data ??
            null,

          error:
            currentToolResult.error ??
            null,
        });

      if (
        outputPayload.length >
        MAX_FUNCTION_CALL_OUTPUT_LENGTH
      ) {
        console.warn(
          "[AI RUNNER] function_call_output 크기 초과",
          {
            toolName:
              currentToolName,

            outputLength:
              outputPayload.length,

            maxLength:
              MAX_FUNCTION_CALL_OUTPUT_LENGTH,
          }
        );

        return {
          reply:
            currentFallbackReply,

          toolName:
            currentToolName,

          toolInput:
            currentToolInput,

          toolResult:
            currentToolResult,

          toolCallCount,
        };
      }

      const response =
        await openai.responses.create({
          model:
            process.env.OPENAI_AI_MODEL ||
            "gpt-5.4-mini",

          previous_response_id:
            currentResponseId,

          parallel_tool_calls:
            false,

          tool_choice:
            "auto",

          tools:
            openAiTools as any,

          input: [
            {
              type:
                "function_call_output",

              call_id:
                currentCallId,

              output:
                outputPayload,
            },
          ],
        });

      const functionCalls =
        (
          Array.isArray(
            response.output
          )
            ? response.output
            : []
        ).filter(
          (
            item: any
          ): item is
            OpenAiFunctionCallOutput =>
            item?.type ===
              "function_call" &&
            typeof item?.name ===
              "string"
        );

      const nextFunctionCall =
        functionCalls[0];

      /**
       * 추가 Tool 호출이 없으면
       * 현재 응답을 최종 사용자 답변으로 사용한다.
       */
      if (
        !nextFunctionCall
      ) {
        const reply =
          String(
            response.output_text ||
            ""
          ).trim();

        return {
          reply:
            reply ||
            currentFallbackReply,

          toolName:
            currentToolName,

          toolInput:
            currentToolInput,

          toolResult:
            currentToolResult,

          toolCallCount,
        };
      }

      /**
       * 최대 호출 횟수에 도달했으면
       * 추가 Tool을 실행하지 않는다.
       */
      if (
        toolCallCount >=
        MAX_AI_TOOL_CALL_STEPS
      ) {
        console.warn(
          "[AI RUNNER] 최대 연속 Tool 호출 횟수 도달",
          {
            toolName:
              currentToolName,

            toolCallCount,

            maxToolCallSteps:
              MAX_AI_TOOL_CALL_STEPS,
          }
        );

        return {
          reply:
            currentFallbackReply,

          toolName:
            currentToolName,

          toolInput:
            currentToolInput,

          toolResult:
            currentToolResult,

          toolCallCount,
        };
      }

      assertOpenAiToolWasProvided({
        toolName:
          nextFunctionCall.name,

        tools:
          openAiTools,
      });

/**
 * 학생 검색 후
 * 동일 요청 안에서 직전 OCR 문서를
 * 검색된 학생에게 반영하려는 경우
 *
 * OpenAI가 studentId를 만들어내게 하지 않는다.
 * 바로 직전에 서버 student.search가 반환한
 * 정확히 1명의 학생 ID만 사용한다.
 */
if (
  nextFunctionCall.name ===
    DOCUMENT_IMPORT_PREVIEW_TOOL
) {
  if (
    !params.recentDocument ||
    !params.recentDocument
      .analysis
  ) {
    return {
      reply:
        "최근에 분석한 문서 결과를 찾을 수 없습니다. 문서를 다시 분석해주세요.",

      toolName:
        currentToolName,

      toolInput:
        currentToolInput,

      toolResult:
        currentToolResult,

      toolCallCount,
    };
  }

  /**
   * 다른 학생을 지정한 자연어 요청은
   * 반드시 직전 student.search 결과로
   * 대상을 확정한다.
   */
  if (
    currentToolName !==
      "student.search" ||
    currentToolResult.success !==
      true
  ) {
    return {
      reply:
        currentFallbackReply,

      toolName:
        currentToolName,

      toolInput:
        currentToolInput,

      toolResult:
        currentToolResult,

      toolCallCount,
    };
  }

  const searchData =
    currentToolResult.data &&
    typeof currentToolResult
      .data ===
      "object" &&
    !Array.isArray(
      currentToolResult.data
    )
      ? currentToolResult.data as
          Record<
            string,
            any
          >
      : {};

  const students =
    Array.isArray(
      searchData.students
    )
      ? searchData.students
      : [];

  const count =
    Number(
      searchData.count ??
      students.length
    );

  /**
   * 검색 결과가 정확히 한 명일 때만
   * 자동으로 반영 대상으로 확정한다.
   *
   * 동명이인 또는 여러 검색결과가 있으면
   * 임의 선택하지 않는다.
   */
  if (
    count !== 1 ||
    students.length !== 1
  ) {
    return {
      reply:
        count > 1
          ? "같은 조건으로 여러 학생이 검색됐습니다. 반영할 학생을 한 명만 정확하게 지정해주세요."
          : "반영할 학생을 찾지 못했습니다.",

      toolName:
        currentToolName,

      toolInput:
        currentToolInput,

      toolResult:
        currentToolResult,

      toolCallCount,
    };
  }

  const matchedStudent =
    students[0];

  const matchedStudentId =
    Number(
      matchedStudent?.id ||
      0
    );

  if (
    !Number.isFinite(
      matchedStudentId
    ) ||
    matchedStudentId <= 0
  ) {
    return {
      reply:
        "검색된 학생 정보가 올바르지 않습니다.",

      toolName:
        currentToolName,

      toolInput:
        currentToolInput,

      toolResult:
        currentToolResult,

      toolCallCount,
    };
  }

  const analysisId =
    String(
      params.recentDocument
        .analysis
        ?.analysisId ||
      ""
    ).trim() ||
    null;

  return {
    reply:
      "검색된 학생에게 최근 문서 분석 결과를 반영하기 위한 승인 미리보기를 준비합니다.",

    toolName:
      currentToolName,

    toolInput:
      currentToolInput,

    toolResult:
      currentToolResult,

    toolCallCount,

    documentImportPreview: {
      required:
        true,

      studentId:
        Math.floor(
          matchedStudentId
        ),

      analysisId,

      fileName:
        params.recentDocument
          .fileName ??
        null,

      mimeType:
        params.recentDocument
          .mimeType ??
        null,
    },
  };
}

      const nextRegistryToolName =
        fromOpenAiToolName(
          nextFunctionCall.name
        );

      if (
        !nextRegistryToolName
      ) {
        console.warn(
          "[AI RUNNER] 후속 Tool을 Registry에서 찾지 못함",
          {
            openAiToolName:
              nextFunctionCall.name,
          }
        );

        return {
          reply:
            currentFallbackReply,

          toolName:
            currentToolName,

          toolInput:
            currentToolInput,

          toolResult:
            currentToolResult,

          toolCallCount,
        };
      }

      /**
       * 후속 단계에서는 조회 Tool만 자동 실행한다.
       *
       * 수정·등록 초안 Tool은 기존 Pending Action
       * 흐름에서 별도로 처리해야 한다.
       */
      if (
        !isFollowUpReadTool(
          nextRegistryToolName
        )
      ) {
        console.warn(
          "[AI RUNNER] 후속 자동 실행이 허용되지 않은 Tool",
          {
            toolName:
              nextRegistryToolName,
          }
        );

        return {
          reply:
            currentFallbackReply,

          toolName:
            currentToolName,

          toolInput:
            currentToolInput,

          toolResult:
            currentToolResult,

          toolCallCount,
        };
      }

      const parsedNextInput =
        normalizeOpenAiToolInput(
          nextRegistryToolName,

          removeForbiddenOpenAiToolFields(
            parseOpenAiToolArguments(
              nextFunctionCall.arguments
            )
          )
        );

      const nextToolInput =
  applySelectedStudentToToolInput({
    toolName:
      nextRegistryToolName,

    toolInput:
      parsedNextInput,

    selectedStudentId:
      params.selectedStudentId,

    workSession:
      params.workSession,
  });

      const nextInputValidation =
        validateRunnerToolInput({
          context:
            params.context,

          toolName:
            nextRegistryToolName as
              AiRunnerPlan["toolName"],

          input:
            nextToolInput,
        });

      if (
        !nextInputValidation.valid
      ) {
        console.warn(
          "[AI RUNNER] 후속 Tool 입력값 검증 실패",
          {
            toolName:
              nextRegistryToolName,

            validationMessage:
              nextInputValidation.message,
          }
        );

        return {
          reply:
            nextInputValidation.message ||
            currentFallbackReply,

          toolName:
            currentToolName,

          toolInput:
            currentToolInput,

          toolResult:
            currentToolResult,

          toolCallCount,
        };
      }

      const nextToolResult =
        await executeAiTool({
          toolName:
            nextRegistryToolName,

          context:
            params.context,

          input:
            nextToolInput,
        });

      toolCallCount +=
        1;

      currentToolName =
        nextRegistryToolName;

      currentToolInput =
        nextToolInput;

      currentToolResult =
        nextToolResult;

      currentResponseId =
        typeof response.id ===
          "string"
          ? response.id
          : null;

      currentCallId =
        typeof nextFunctionCall.call_id ===
          "string"
          ? nextFunctionCall.call_id
          : null;

      /**
       * 후속 Tool 결과에 맞는 안전 답변을
       * 다음 단계 fallback으로 다시 만든다.
       */
      currentFallbackReply =
        buildToolReply({
          plan: {
            intent:
              getIntentFromToolName(
                currentToolName
              ),

            toolName:
              currentToolName as
                AiRunnerPlan["toolName"],

            input:
              currentToolInput,

            explanation:
              "후속 Tool 실행 결과",

            requiresRegistrationPreview:
              false,
          },

          result:
            currentToolResult,
        });

      if (
        !currentResponseId ||
        !currentCallId
      ) {
        return {
          reply:
            currentFallbackReply,

          toolName:
            currentToolName,

          toolInput:
            currentToolInput,

          toolResult:
            currentToolResult,

          toolCallCount,
        };
      }
    }

    return {
      reply:
        currentFallbackReply,

      toolName:
        currentToolName,

      toolInput:
        currentToolInput,

      toolResult:
        currentToolResult,

      toolCallCount,
    };
  } catch (
    error
  ) {
    console.error(
      "[AI RUNNER] function_call_output 연속 처리 실패",
      normalizeErrorForLog(
        error
      )
    );

    return {
      reply:
        currentFallbackReply,

      toolName:
        currentToolName,

      toolInput:
        currentToolInput,

      toolResult:
        currentToolResult,

      toolCallCount,
    };
  }
}

/**
 * CRM Tool 실행 결과를 사용자가 이해하기 쉬운
 * 자연스러운 한국어 답변으로 변환한다.
 *
 * Tool 결과를 새로 만들거나 추측하지 않고
 * 전달된 결과만 설명한다.
 */
async function createToolResultReplyWithOpenAi(params: {
  context:
    AiUserContext;

  message:
    string;

  plan:
    AiRunnerPlan;

  toolName:
    AiToolName;

  toolInput:
    Record<
      string,
      unknown
    >;

  toolResult:
    AiToolExecutionResult<any>;

  selectedStudentId?:
    number |
    null;

 selectedStudentName?:
  string |
  null;

recentDocument?:
  AiRecentDocumentContext |
  null;

workSession:
  AiWorkSession;

conversationHistory?:
  AiConversationHistoryMessage[];
}): Promise<AiNaturalToolReplyResult> {
  /**
   * OpenAI 오류 또는 Tool 실패 시 사용할
   * 기존 안전 답변을 먼저 생성한다.
   */
  const fallbackReply =
    buildToolReply({
      plan: {
        intent:
          getIntentFromToolName(
            params.toolName
          ),

        toolName:
          params.toolName as
            AiRunnerPlan["toolName"],

        input:
          params.toolInput,

        explanation:
          "Tool 실행 결과",

        requiresRegistrationPreview:
          false,
      },

      result:
        params.toolResult,
    });

  if (
  params.toolResult.success &&
  params.plan.openAiResponseId &&
  params.plan.openAiCallId
) {
 return createFunctionCallOutputReply({
  context:
    params.context,

  plan:
    params.plan,

  toolName:
    params.toolName,

  toolInput:
    params.toolInput,

  toolResult:
    params.toolResult,

  selectedStudentId:
    params.selectedStudentId,

recentDocument:
  params.recentDocument ??
  null,

  workSession:
    params.workSession,

  fallbackReply,
});
}

const openai =
  getOpenAiClient();

if (
  !params.toolResult.success ||
  !openai
) {
  return {
    reply:
      fallbackReply,

    toolName:
      params.toolName,

    toolInput:
      params.toolInput,

    toolResult:
      params.toolResult,

    toolCallCount:
      1,
  };
}

  try {
    const response =
      await openai.responses.create({
        model:
          process.env.OPENAI_AI_MODEL ||
          "gpt-5.4-mini",

        input: [
          {
            role:
              "system",

            content: [
              {
                type:
                  "input_text",

                text: [
                  "너는 EduCanvas CRM의 AI 개인 비서다.",
                  "CRM Tool 실행 결과를 사용자에게 자연스럽고 정확하게 설명한다.",
                  "반드시 제공된 Tool 결과 안의 정보만 사용한다.",
                  "없는 학생정보, 금액, 날짜, 상태를 추측하거나 만들어내지 않는다.",
                  "조회에 실패했으면 실패 이유를 솔직하게 안내한다.",
                  "개인정보는 Tool 결과에 포함된 범위를 넘어 확대하거나 추론하지 않는다.",
                  "결제금액은 원 단위로 읽기 쉽게 표시한다.",
params.toolName ===
  "settlement.summary"
  ? [
      "정산 조회 결과는 조회 기간과 적용 범위를 먼저 확인한 뒤 사용자가 물어본 핵심 숫자부터 답한다.",
      "금액은 반드시 천 단위 쉼표를 사용하고 원 단위로 표시한다.",
      "grossSales는 총매출, refundAmount는 환불액, netSales는 순매출로 설명한다.",
      "newSales는 신규 순매출, existingSales는 기존 순매출로 설명한다.",
      "사용자가 신규 또는 기존만 요청했다면 해당 구분을 중심으로 답하고 불필요한 전체 숫자를 장황하게 나열하지 않는다.",
      "사용자가 직원별 또는 팀별 매출을 요청하면 assignees 또는 teams 결과만 사용해서 설명한다.",
      "사용자가 순위를 요청하면 ranking 배열의 rank 순서를 그대로 사용하며 임의로 순위를 다시 만들지 않는다.",
      "Staff에게는 본인 결과만, Admin에게는 서버가 반환한 팀 범위만, Host에게는 서버가 반환한 조직 범위만 설명한다.",
      "권한 때문에 포함되지 않은 사람이나 팀의 매출을 추측하지 않는다.",
      "매출 데이터가 0이면 실제 조회 결과가 0원이라고 설명하고 매출 데이터가 누락됐다고 임의로 추측하지 않는다.",
    ].join(
      "\\n"
    )
  : "",
                  "위험 분석은 위험 항목과 우선 처리할 내용을 중심으로 설명한다.",
params.toolName ===
  "risk.studentDetail"
  ? [
      "risk.studentDetail 결과에는 위험도뿐 아니라 서버에서 계산한 academicSummary가 포함될 수 있다.",

      "academicSummary가 존재하면 사용자가 학위, 자격증, 인정과목, 남은과목, 남은학점, 추가수강과목, 몇 학기인지, 최단기간, 구법·신법, 실습시간, 학위신청, 학위수여, 자격증 취득 예상시점을 질문할 때 academicSummary를 최우선 근거로 사용한다.",

      "academicSummary의 숫자와 일정은 서버 공통 규칙엔진 계산결과이므로 AI가 법규, 학점, 과목 수, 학기 수 또는 날짜를 다시 계산해서 다른 값을 만들지 않는다.",

      "사용자의 현재 질문에 필요한 항목만 academicSummary에서 골라 자연스럽게 답한다.",

      "남은 과목을 질문하면 academicSummary.qualification의 자격요건 부족과 academicSummary.studyPlan.additionalSubjectCount의 실제 추가수강계획을 구분해서 설명한다.",

      "자격 필수과목 부족 수와 학위까지 포함한 실제 추가수강 과목 수가 서로 다를 수 있으므로 두 숫자를 같은 의미로 설명하지 않는다.",

      "남은 학점을 질문하면 academicSummary.degree의 currentTotalCredits, remainingTotalCredits, remainingMajorCredits, remainingLiberalCredits와 studyPlan.additionalCredits를 구분해서 사용한다.",

      "몇 학기 또는 최단기간을 질문하면 academicSummary.studyPlan.semesterCount와 semesters를 그대로 사용한다.",

      "실제 학기별 과목 수를 설명할 때 academicSummary.studyPlan.semesters의 semesterLabel, subjectCount를 그대로 사용한다.",

      "실제 추가로 수강할 과목을 질문하면 academicSummary.studyPlan.selectedSubjectNames 또는 각 semesters.subjectNames에 존재하는 과목만 안내한다.",
      "대면과목, 영역별 충족·부족, 전공필수 부족, 자격별 세부 법적조건처럼 academicSummary에 요약되지 않은 세부사항을 질문하면 같은 risk.studentDetail 결과의 requirements와 issues를 확인한다.",

      "requirements.qualification.requirementIssues에 해당 세부조건이 있으면 그 서버 판정값을 우선 사용하고, AI가 별도로 법적 부족조건을 다시 계산하지 않는다.",

      "requirementIssues의 missingCandidates, missingSlots, remaining, remainingSubjects, remainingCredits 등 실제 반환값이 있으면 사용자가 물어본 범위에서만 설명한다.",

      "academicSummary와 requirements 또는 issues의 값이 서로 다르게 보이면 AI가 임의로 하나를 고르거나 재계산하지 말고 서버 결과에 불일치가 있어 확인이 필요하다고 안내한다.",

      "academicSummary, requirements, issues 어디에도 근거가 없는 대면과목·영역·전공필수 부족값은 추측해서 만들지 않는다.",

      "구법 또는 신법을 질문하면 academicSummary.course.lawLabel을 사용하며 값이 없거나 확인 필요 상태이면 임의로 적용법을 정하지 않는다.",

      "학위신청과 학위수여를 질문하면 academicSummary.timeline.degreeApplicationLabel, degreeAwardLabel을 사용한다.",

      "자격증 신청 또는 취득 예상시점을 질문하면 academicSummary.timeline.qualificationMessage와 qualificationEstimatedDate를 사용한다.",

      "academicSummary.masterIntegrity가 존재하고 배열 길이가 1 이상이면 과목마스터 자체가 정상 기준과 맞지 않는 상태로 판단한다.",

      "마스터 무결성 오류가 있으면 해당 오류가 해결되기 전까지 자격 부족과목 수, 추가수강과목 수, 학기 수, 최종 취득일정을 확정값처럼 안내하지 않는다.",

      "사용자가 왜 분석이 안 되는지, 왜 계산이 안 되는지, 마스터에 무슨 문제가 있는지 질문하면 academicSummary.masterIntegrity를 가장 먼저 확인한다.",

      "masterIntegrity의 expectedSubjects는 정상 마스터 과목 수, actualSubjects는 현재 등록된 마스터 과목 수이며 AI가 이 값을 다시 계산하지 않는다.",

      "masterIntegrity.registeredSubjectNames가 있으면 현재 서버에 실제 등록된 전공필수 과목 목록으로만 안내하며 없는 과목명을 추가로 만들어내지 않는다.",

      "academicSummary.status가 review_required이거나 unresolvedReasons가 존재하면 확인된 내용까지만 설명하고 unresolvedReasons를 추가 확인사항으로 안내한다.",

      "academicSummary.summaryLines는 전체 학업상태를 종합적으로 묻는 경우 서버가 만든 순서대로 요약 근거로 사용할 수 있다.",

      "특정 학생 위험 분석에서는 서버가 확정한 중복과목은 확정 결과로 설명한다.",

      "서버에서 확정되지 않은 전적대 과목과 우리플랜 과목 중 의미가 매우 유사한 과목이 있으면 '동일교과목 가능성 - 확인 필요'로만 추가 안내할 수 있다.",

      "AI 추론만으로 공식 동일교과목, 자동 제외, 플랜 삭제 가능이라고 단정하지 않는다.",
    ].join(
      "\n"
    )
  : "",
                  "학생 검색이나 상담 검색은 검색 건수와 확인 가능한 대상을 간단히 설명한다.",
                 "학생 종합조회는 현재 상태, 중요한 문제, 다음 업무 순서로 정리한다.",
"실습기관 추천 결과는 Tool 결과의 searchMode를 확인해서 검색 기준 위치, 가까운 실습기관, 가까운 실습교육원, 거리, 주소, 연락처를 중심으로 정리한다.",
"searchMode가 student이면 student의 주소를 검색 기준으로 설명하고, searchMode가 address이면 searchLocation.address를 검색 기준으로 설명한다.",
"searchMode가 address인 경우 학생 정보를 임의로 연결하거나 특정 학생의 추천 결과라고 표현하지 않는다.",
"실습기관 추천은 거리순 조회 결과이며 실제 배정이나 기관 선택이 완료된 것이 아니라고 명확하게 안내한다.",
"추천 결과가 없으면 좌표가 없다고 임의로 단정하지 말고 Tool 결과에 포함된 오류 또는 빈 결과만 설명한다.",
"선정기간이 표시되면 유효기간을 함께 안내하고 취소 또는 비활성 기관을 추천하지 않는다.",
"실습배정지원 상태 조회는 신청 여부, 섭외 상태, 결제 상태, 선택 교육원, 선택 실습기관, 실습시간과 실습일정을 중심으로 정리한다.",
"실습배정지원 신청 내역이 없으면 신청하지 않았다고 명확하게 안내한다.",
"교육원이나 실습기관이 선택되지 않았다면 배정 완료라고 표현하지 않는다.",
"너무 장황하지 않게 한국어로 답한다.",
                  "사용자에게 실제로 수정이나 등록이 완료됐다고 거짓말하지 않는다.",
                ].join(
                  "\n"
                ),
              },
            ],
          },

          ...normalizeConversationHistory(
            params.conversationHistory
          )
            .slice(
              -10
            )
            .map(
              (
                history
              ) => ({
                role:
                  history.role,

                content: [
                  {
                    type:
                      history.role ===
                        "assistant"
                        ? "output_text" as const
                        : "input_text" as const,

                    text:
                      history.content,
                  },
                ],
              })
            ),

          {
            role:
              "user",

            content: [
              {
                type:
                  "input_text",

                text:
                  JSON.stringify({
                    currentMessage:
                      params.message,

                    selectedStudent: {
                      id:
                        params.selectedStudentId ??
                        null,

                      name:
                        params.selectedStudentName ??
                        null,
                    },

                    executedTool: {
                      name:
                        params.toolName,

                      input:
                        params.toolInput,

                      success:
                        params.toolResult.success,

                      data:
                        params.toolResult.data ??
                        null,

                      error:
                        params.toolResult.error ??
                        null,
                    },
                  }),
              },
            ],
          },
        ],
      });

    const reply =
      String(
        response.output_text ||
        ""
      ).trim();

    return {
  reply:
    reply ||
    fallbackReply,

  toolName:
    params.toolName,

  toolInput:
    params.toolInput,

  toolResult:
    params.toolResult,

  toolCallCount:
    1,
};
  } catch (
    error
  ) {
    console.error(
  "[AI RUNNER] Tool 결과 답변 생성 실패",
  normalizeErrorForLog(
    error
  )
);

    return {
  reply:
    fallbackReply,

  toolName:
    params.toolName,

  toolInput:
    params.toolInput,

  toolResult:
    params.toolResult,

  toolCallCount:
    1,
};
  }
}

/**
 * Tool 결과를 GPT가 자연스럽게 설명해도 되는
 * 조회 전용 Tool인지 확인한다.
 *
 * 수정 및 일정 초안은 정확한 승인 UI가 필요하므로
 * 기존 buildToolReply()를 유지한다.
 */
function shouldCreateNaturalToolReply(
  toolName:
    AiToolName
): boolean {
   return [
    "student.search",
    "student.summary",
    "student.dashboard",
    "consultation.search",
    "alert.missingData",
    "risk.studentDetail",
    "risk.studentList",
    "practice.institutionSearch",
    "practice.supportStatus",
"document.analysis",
"settlement.summary",
  ].includes(
    toolName
  );
}

function buildToolReply(params: {
  plan: AiRunnerPlan;
  result: AiToolExecutionResult<any>;
}) {
  if (!params.result.success) {
    return (
      params.result.error?.message ||
      "요청을 처리하지 못했습니다."
    );
  }

  const data = params.result.data;

if (
  params.plan.toolName ===
    "schedule.create"
) {
  const studentLabel =
    String(
      data?.studentName ||
      ""
    ).trim() ||
    (
      data?.studentId
        ? `학생 #${data.studentId}`
        : "선택 학생"
    );

  const meridiemLabel =
    data?.meridiem ===
      "PM"
      ? "오후"
      : "오전";

  return [
    `**${studentLabel} 일정 등록 초안**`,
    "",
    `- 일정명: ${data?.title || "미입력"}`,
    `- 날짜: ${data?.scheduleDate || "미입력"}`,
    `- 시간: ${meridiemLabel} ${data?.hour12 ?? "-"}시 ${String(
      data?.minute ??
      0
    ).padStart(
      2,
      "0"
    )}분`,
    `- 범위: ${
      data?.isGlobal ===
        true
        ? "회사 전체 일정"
        : "개인 일정"
    }`,
    "",
    "내용을 확인한 후 등록 버튼을 눌러주세요.",
  ].join(
    "\n"
  );
}
if (
  params.plan.toolName ===
    "student.update"
) {
  const changes =
    Array.isArray(
      data?.changes
    )
      ? data.changes
      : [];

  const changeLines =
    changes.map(
      (
        change: any,
        index: number
      ) =>
        `${index + 1}. ${change.label || change.field}: ${
          change.before ??
          "미입력"
        } → ${
          change.after ??
          "비움"
        }`
    );

  return [
    `**${data?.studentName || `학생 #${data?.studentId || ""}`} 기본정보 수정 초안**`,
    "",
    ...changeLines,
    "",
    "변경 전·후 내용을 확인한 뒤 승인해주세요.",
  ].join(
    "\n"
  );
}

if (
  params.plan.toolName ===
    "consultation.create"
) {
  const sections =
    Array.isArray(
      data?.preview
        ?.sections
    )
      ? data.preview.sections
      : [];

  const lines =
    sections.flatMap(
      (
        section: any
      ) => {
        const title =
          String(
            section?.title ||
            ""
          ).trim();

        const items =
          Array.isArray(
            section?.items
          )
            ? section.items
                .map(
                  (
                    item: unknown
                  ) =>
                    String(
                      item ||
                      ""
                    ).trim()
                )
                .filter(
                  Boolean
                )
            : [];

        return [
          ...(title
            ? [
                `**${title}**`,
              ]
            : []),

          ...items.map(
            (
              item: string
            ) =>
              `- ${item}`
          ),
        ];
      }
    );

  return [
    `**${data?.clientName || "신규 상담자"} 상담DB 등록 초안**`,
    "",
    ...lines,
    "",
    "내용을 확인한 뒤 승인해주세요.",
  ].join(
    "\n"
  );
}

if (
  params.plan.toolName ===
    "consultation.update"
) {
  const changes =
    Array.isArray(
      data?.changes
    )
      ? data.changes
      : [];

  const changeLines =
    changes.map(
      (
        change: any,
        index: number
      ) =>
        `${index + 1}. ${change.label || change.field}: ${
          change.before ??
          "미입력"
        } → ${
          change.after ??
          "비움"
        }`
    );

  return [
    `**${data?.clientName || `상담DB #${data?.consultationId || ""}`} 수정 초안**`,
    "",
    ...changeLines,
    "",
    "변경 전·후 내용을 확인한 뒤 승인해주세요.",
  ].join(
    "\n"
  );
}
  if (
    params.plan.toolName ===
    "student.search"
  ) {
    const count =
      Number(data?.count || 0);

    return count > 0
      ? `권한 범위 안에서 학생 ${count}명을 찾았습니다.`
      : "조건에 맞는 학생을 찾지 못했습니다.";
  }

  if (
    params.plan.toolName ===
    "consultation.search"
  ) {
    const count =
      Number(data?.count || 0);

    return count > 0
      ? `권한 범위 안에서 상담 ${count}건을 찾았습니다.`
      : "조건에 맞는 상담을 찾지 못했습니다.";
  }

  if (
    params.plan.toolName ===
    "student.summary"
  ) {
    const student =
      data?.student;

    if (!student) {
      return "학생 정보를 찾지 못했습니다.";
    }

    return [
      `**${student.clientName || "학생"} 정보**`,
      "",
      `- 과정: ${student.course || "미입력"}`,
      `- 상태: ${student.status || "미입력"}`,
      `- 교육원: ${student.institution || "미입력"}`,
      `- 결제일: ${student.paymentDate || "미입력"}`,
      `- 결제금액: ${student.paymentAmount || "미입력"}`,
    ].join("\n");
  }

if (
  params.plan.toolName ===
  "student.dashboard"
) {
  const student =
    data?.student ||
    {};

  const semesters =
    Array.isArray(
      data?.semesters
    )
      ? data.semesters
      : [];

  const subjects =
    data?.subjects ||
    {};

  const creditSummary =
    data?.creditSummary ||
    {};

  const paymentSummary =
    data?.paymentSummary ||
    {};

  const practice =
    data?.practice ||
    {};

  const risk =
    data?.risk ||
    {};

  const missingFields =
    Array.isArray(
      data?.missingFields
    )
      ? data.missingFields
      : [];

  const nextActions =
    Array.isArray(
      data?.nextActions
    )
      ? data.nextActions
      : [];

  const semesterLines =
    semesters
      .slice(0, 10)
      .map(
        (
          semester: any,
          index: number
        ) => {
          const semesterLabel =
            semester.semesterNo
              ? `${semester.semesterNo}학기`
              : `${index + 1}번째 학기`;

          const institution =
            semester.actualInstitution ||
            semester.plannedInstitution ||
            "교육원 미입력";

          const startDate =
            semester.actualStartDate ||
            semester.plannedStartMonth ||
            "일정 미입력";

          return [
            `${index + 1}. **${semesterLabel}**`,
            `   - 교육원: ${institution}`,
            `   - 시작일정: ${startDate}`,
            `   - 예정 과목: ${semester.plannedSubjectCount ?? "미입력"}`,
            `   - 결제일: ${semester.paymentDate || "미입력"}`,
          ].join("\n");
        }
      );

  const actionLines =
    nextActions
      .slice(0, 10)
      .map(
        (
          action: any,
          index: number
        ) =>
          `${index + 1}. **${action.title || "확인 필요"}**: ${action.message || ""}`
      );

  const riskItems =
    Array.isArray(
      risk.items
    )
      ? risk.items
      : [];

  const riskLines =
    riskItems
      .slice(0, 8)
      .map(
        (
          issue: any,
          index: number
        ) =>
          `${index + 1}. ${issue.title || "확인 필요"}: ${issue.message || ""}`
      );

  return [
    `**${student.clientName || "학생"} 종합 현황**`,
    "",
    "**기본정보**",
    `- 과정: ${student.course || "미입력"}`,
    `- 상태: ${student.status || "미입력"}`,
    `- 최종학력: ${student.finalEducation || "미입력"}`,
    `- 교육원: ${student.institution || "미입력"}`,
    `- 전체 학기: ${student.totalSemesters ?? semesters.length}개`,
    "",
    "**학점 및 과목**",
    `- 등록 과목: ${creditSummary.registeredSubjectCount ?? 0}과목`,
    `- 인정 과목: ${creditSummary.recognizedSubjectCount ?? 0}과목`,
    `- 현재 인정학점: ${creditSummary.currentCredits ?? 0}학점`,
    `- 필요학점: ${creditSummary.requiredCredits ?? "기준 미설정"}`,
    `- 남은 학점: ${creditSummary.remainingCredits ?? "기준 미설정"}`,
    `- 중복과목: ${creditSummary.duplicateSubjectCount ?? 0}건`,
    `- 우리플랜: ${Array.isArray(subjects.plan) ? subjects.plan.length : 0}과목`,
    `- 전적대: ${Array.isArray(subjects.transfer) ? subjects.transfer.length : 0}과목`,
    "",
    "**결제 현황**",
    `- 예정금액: ${paymentSummary.plannedAmount ?? 0}원`,
    `- 결제금액: ${paymentSummary.paidAmount ?? 0}원`,
    `- 환불금액: ${paymentSummary.refundedAmount ?? 0}원`,
    `- 실결제금액: ${paymentSummary.actualPaidAmount ?? 0}원`,
    `- 결제상태: ${paymentSummary.paymentStatus || "미확인"}`,
    `- 결제일: ${paymentSummary.paymentDate || "미입력"}`,
    "",
    "**실습 현황**",
    `- 실습 필요 여부: ${
      practice.required === true
        ? "필요"
        : practice.required === false
          ? "불필요"
          : "확인 필요"
    }`,
    `- 실습 요청: ${practice.requestCount ?? 0}건`,
    `- 최근 요청 상태: ${practice.latestRequest?.status || "요청 없음"}`,
    `- 섭외 상태: ${practice.latestRequest?.coordinationStatus || "미확인"}`,
    "",
    "**위험도**",
    `- 위험등급: ${risk.riskLevel || "normal"}`,
    `- 위험점수: ${risk.riskScore ?? 0}점`,
    `- 확인 항목: ${risk.totalIssueCount ?? riskItems.length}건`,
    "",
    riskLines.length > 0
      ? "**확인된 문제**"
      : "**확인된 문제 없음**",
    ...riskLines,
    "",
    missingFields.length > 0
      ? `**누락정보:** ${missingFields.join(", ")}`
      : "**누락정보 없음**",
    "",
    semesterLines.length > 0
      ? "**학기 진행 현황**"
      : "**등록된 학기 없음**",
    ...semesterLines,
    "",
    actionLines.length > 0
      ? "**다음 처리 업무**"
      : "**현재 생성된 다음 업무 없음**",
    ...actionLines,
  ]
    .filter(
      (
        line
      ) =>
        line !== ""
    )
    .join("\n");
}

if (
  params.plan.toolName ===
    "practice.institutionSearch"
) {
  const student =
    data?.student ||
    {};

const searchMode =
  String(
    data?.searchMode ||
    ""
  );

const searchLocation =
  data?.searchLocation &&
  typeof data.searchLocation ===
    "object"
    ? data.searchLocation
    : null;

const searchAddress =
  searchMode ===
    "address"
    ? String(
        searchLocation
          ?.address ||
        ""
      ).trim()
    : [
        String(
          student?.address ||
          ""
        ).trim(),

        String(
          student
            ?.detailAddress ||
          ""
        ).trim(),
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        );

const resultTitle =
  searchMode ===
    "address"
    ? "실습기관 추천 결과"
    : `${student?.clientName || "학생"} 실습기관 추천 결과`;

  const institutions =
    Array.isArray(
      data?.institutions
    )
      ? data.institutions
      : [];

  const educationCenters =
    Array.isArray(
      data?.educationCenters
    )
      ? data.educationCenters
      : [];

  const institutionLines =
    institutions
      .slice(
        0,
        5
      )
      .map(
        (
          institution:
            any,

          index:
            number
        ) => {
          const distanceKm =
            Number(
              institution
                .distanceKm
            );

          return [
            `${index + 1}. **${institution.name || "기관명 미입력"}**`,
            `   - 거리: ${
              Number.isFinite(
                distanceKm
              )
                ? `${distanceKm.toLocaleString(
                    "ko-KR",
                    {
                      maximumFractionDigits:
                        2,
                    }
                  )}km`
                : "미확인"
            }`,
            `   - 주소: ${institution.address || "미입력"}${
              institution.detailAddress
                ? ` ${institution.detailAddress}`
                : ""
            }`,
            `   - 연락처: ${institution.phone || "미입력"}`,
            `   - 선정상태: ${institution.selectionStatus || "확인 필요"}`,
            `   - 선정유효기간: ${institution.selectionValidTo || "기한 미입력"}`,
          ].join(
            "\n"
          );
        }
      );

  const educationCenterLines =
    educationCenters
      .slice(
        0,
        5
      )
      .map(
        (
          center:
            any,

          index:
            number
        ) => {
          const distanceKm =
            Number(
              center
                .distanceKm
            );

          return [
            `${index + 1}. **${center.name || "교육원명 미입력"}**`,
            `   - 거리: ${
              Number.isFinite(
                distanceKm
              )
                ? `${distanceKm.toLocaleString(
                    "ko-KR",
                    {
                      maximumFractionDigits:
                        2,
                    }
                  )}km`
                : "미확인"
            }`,
            `   - 주소: ${center.address || "미입력"}${
              center.detailAddress
                ? ` ${center.detailAddress}`
                : ""
            }`,
            `   - 연락처: ${center.phone || "미입력"}`,
          ].join(
            "\n"
          );
        }
      );

  return [
    `**${resultTitle}**`,
    "",
    `- 기준 주소: ${searchAddress || "주소 미입력"}`,
    `- 추천 실습기관: ${institutions.length}곳`,
    `- 추천 실습교육원: ${educationCenters.length}곳`,
    "",
    institutionLines.length >
      0
      ? "**가까운 실습기관**"
      : "**추천 가능한 실습기관 없음**",
    ...institutionLines,
    "",
    educationCenterLines.length >
      0
      ? "**가까운 실습교육원**"
      : "**추천 가능한 실습교육원 없음**",
    ...educationCenterLines,
    "",
    "위 결과는 거리순 추천이며 실제 기관 선택이나 배정이 완료된 상태는 아닙니다.",
  ]
    .filter(
      (
        line
      ) =>
        line !==
        ""
    )
    .join(
      "\n"
    );
}

if (
  params.plan.toolName ===
    "practice.supportStatus"
) {
  const student =
    data?.student ||
    {};

  const summary =
    data?.summary ||
    {};

  const requests =
    Array.isArray(
      data?.requests
    )
      ? data.requests
      : [];

  const latestRequest =
    data?.latestRequest ||
    null;

  if (
    data?.hasRequest !==
      true ||
    !latestRequest
  ) {
    return [
      `**${student.clientName || "학생"} 실습배정지원 현황**`,
      "",
      "- 실습배정지원 신청: 신청 내역 없음",
      "- 섭외 상태: 신청 없음",
      "- 결제 상태: 신청 없음",
      "",
      "현재 등록된 실습배정지원 요청이 없습니다.",
    ].join(
      "\n"
    );
  }

  const educationCenter =
    latestRequest
      .selectedEducationCenter ||
    {};

  const practiceInstitution =
    latestRequest
      .selectedPracticeInstitution ||
    {};

  const requestLines =
    requests
      .slice(
        0,
        10
      )
      .map(
        (
          request:
            any,

          index:
            number
        ) => {
          const semesterLabel =
            Number(
              request
                .semesterOrder ||
              0
            ) >
            0
              ? `${request.semesterOrder}학기`
              : "학기 확인 필요";

          return [
            `${index + 1}. **${semesterLabel} 실습 요청**`,
            `   - 섭외 상태: ${request.coordinationStatus || "미확인"}`,
            `   - 결제 상태: ${request.paymentStatus || "미확인"}`,
            `   - 실습시간: ${
              request.practiceHours !==
                null &&
              request.practiceHours !==
                undefined
                ? `${request.practiceHours}시간`
                : "미입력"
            }`,
            `   - 실습일정: ${request.practiceDate || "미입력"}`,
          ].join(
            "\n"
          );
        }
      );

  return [
    `**${student.clientName || "학생"} 실습배정지원 현황**`,
    "",
    "**현재 상태**",
    `- 실습배정지원 신청: ${data?.requestCount ?? requests.length}건`,
    `- 섭외 상태: ${summary.coordinationStatus || "미확인"}`,
    `- 결제 상태: ${summary.paymentStatus || "미확인"}`,
    `- 실습시간: ${
      summary.practiceHours !==
        null &&
      summary.practiceHours !==
        undefined
        ? `${summary.practiceHours}시간`
        : "미입력"
    }`,
    `- 실습일정: ${summary.practiceDate || "미입력"}`,
    "",
    "**선택 교육원**",
    `- 교육원명: ${educationCenter.name || "미선택"}`,
    `- 주소: ${educationCenter.address || "미입력"}`,
    `- 거리: ${
      educationCenter.distanceKm !==
        null &&
      educationCenter.distanceKm !==
        undefined
        ? `${educationCenter.distanceKm}km`
        : "미확인"
    }`,
    "",
    "**선택 실습기관**",
    `- 기관명: ${practiceInstitution.name || "미선택"}`,
    `- 주소: ${practiceInstitution.address || "미입력"}`,
    `- 거리: ${
      practiceInstitution.distanceKm !==
        null &&
      practiceInstitution.distanceKm !==
        undefined
        ? `${practiceInstitution.distanceKm}km`
        : "미확인"
    }`,
    "",
    requestLines.length >
      0
      ? "**실습 요청 내역**"
      : "**등록된 실습 요청 내역 없음**",
    ...requestLines,
  ]
    .filter(
      (
        line
      ) =>
        line !==
        ""
    )
    .join(
      "\n"
    );
}

  if (
    params.plan.toolName ===
    "alert.missingData"
  ) {
    const summary =
      data?.summary || {};

    return [
      "**누락 점검 결과**",
      "",
      `- 결제일 누락: ${summary.paymentDateMissingCount || 0}건`,
      `- 결제금액 누락: ${summary.paymentAmountMissingCount || 0}건`,
      `- 담당자 미지정 상담: ${summary.consultationAssigneeMissingCount || 0}건`,
      `- 실습 미섭외: ${summary.practiceUnassignedCount || 0}건`,
    ].join("\n");
  }

if (
  params.plan.toolName ===
  "risk.studentDetail"
) {
  const student =
    data?.student ||
    {};

  const summary =
    data?.summary ||
    {};

  const academicSummary =
    data?.academicSummary ||
    null;

  const issues =
    Array.isArray(
      data?.issues
    )
      ? data.issues
      : [];

  const issueLines =
    issues
      .slice(
        0,
        10
      )
      .map(
        (
          issue:
            any,
          index:
            number
        ) =>
          `${index + 1}. ${issue.title || "확인 필요"}: ${issue.message || ""}`
      );

  /**
   * 신규 공통 학업요약이 정상적으로 존재하면
   * 기존 Risk 숫자보다 학업계산 결과를 먼저 보여준다.
   */
  if (
    academicSummary
  ) {
    const academicLines =
      Array.isArray(
        academicSummary
          ?.summaryLines
      )
        ? academicSummary
            .summaryLines
            .filter(
              Boolean
            )
        : [];

    const unresolvedReasons =
      Array.isArray(
        academicSummary
          ?.unresolvedReasons
      )
        ? academicSummary
            .unresolvedReasons
            .filter(
              Boolean
            )
        : [];

    const masterIntegrity =
      Array.isArray(
        academicSummary
          ?.masterIntegrity
      )
        ? academicSummary
            .masterIntegrity
        : [];

    const masterIntegrityLines =
      masterIntegrity.flatMap(
        (
          item:
            any,
          index:
            number
        ) => {
          const registeredSubjectNames =
            Array.isArray(
              item
                ?.registeredSubjectNames
            )
              ? item
                  .registeredSubjectNames
                  .filter(
                    Boolean
                  )
              : [];

          return [
            `${index + 1}. ${item?.title || "과목마스터 확인 필요"}`,
            item?.message
              ? `   - ${item.message}`
              : "",
            item?.expectedSubjects !==
              null &&
            item?.expectedSubjects !==
              undefined
              ? `   - 정상 기준: ${item.expectedSubjects}과목`
              : "",
            item?.actualSubjects !==
              null &&
            item?.actualSubjects !==
              undefined
              ? `   - 현재 등록: ${item.actualSubjects}과목`
              : "",
            registeredSubjectNames.length >
              0
              ? `   - 현재 등록 과목: ${registeredSubjectNames.join(", ")}`
              : "",
          ].filter(
            Boolean
          );
        }
      );

        return [
      `**${student.clientName || "학생"} 학업 분석 결과**`,
      "",

      ...academicLines.map(
        (
          line:
            string
        ) =>
          `- ${line}`
      ),

      masterIntegrityLines.length >
        0
        ? "**과목마스터 점검 필요**"
        : "",

      ...masterIntegrityLines,

      unresolvedReasons.length >
        0
        ? "**추가 확인 필요**"
        : "",

      ...unresolvedReasons.map(
        (
          reason:
            string,
          index:
            number
        ) =>
          `${index + 1}. ${reason}`
      ),

      issues.length >
        0
        ? "**위험도 점검**"
        : "",

      issues.length >
        0
        ? `- 위험등급: ${summary.riskLevel || "normal"}`
        : "",

      issues.length >
        0
        ? `- 위험점수: ${summary.riskScore ?? 0}점`
        : "",

      ...issueLines,
    ]
      .filter(
        (
          line
        ) =>
          line !==
          ""
      )
      .join(
        "\n"
      );
  }

  /**
   * academicSummary가 없는 구버전 또는
   * 계산 실패 상황에서는 기존 Risk 결과로 fallback.
   */
  return [
    `**${student.clientName || "학생"} 위험 분석 결과**`,
    "",
    `- 위험등급: ${summary.riskLevel || "normal"}`,
    `- 위험점수: ${summary.riskScore ?? 0}점`,
    `- 전체 위험요소: ${summary.totalIssueCount ?? issues.length}건`,
    `- 위험: ${summary.dangerCount ?? 0}건`,
    `- 주의: ${summary.warningCount ?? 0}건`,
    `- 등록 과목: ${summary.registeredSubjectCount ?? 0}건`,
    `- 인정 과목: ${summary.totalSubjectCount ?? 0}건`,
    `- 현재 인정학점: ${summary.currentCredits ?? 0}학점`,
    `- 남은 학점: ${summary.remainingCredits ?? "기준 미설정"}`,
    `- 중복과목: ${summary.duplicateSubjectCount ?? 0}건`,
    `- 실습 요청: ${summary.practiceRequestCount ?? 0}건`,
    "",
    issues.length >
      0
      ? "**확인된 문제**"
      : "**확인된 문제 없음**",
    ...issueLines,
  ].join(
    "\n"
  );
}

if (
  params.plan.toolName ===
  "risk.studentList"
) {
  const summary =
    data?.summary || {};

  const students =
    Array.isArray(data?.students)
      ? data.students
      : [];

  const failures =
    Array.isArray(data?.failures)
      ? data.failures
      : [];

  const studentLines =
    students
      .slice(0, 10)
      .map(
        (
          student: any,
          index: number
        ) => {
          const issueTitles =
            Array.isArray(
              student.issues
            )
              ? student.issues
                  .slice(0, 3)
                  .map(
                    (issue: any) =>
                      issue.title
                  )
                  .filter(Boolean)
                  .join(", ")
              : "";

          return [
            `${index + 1}. **${student.clientName || "학생"}**`,
            `   - 등급: ${student.riskLevel || "normal"} / 점수: ${student.riskScore ?? 0}점`,
            `   - 문제: ${student.totalIssueCount ?? 0}건`,
            issueTitles
              ? `   - 주요 항목: ${issueTitles}`
              : "",
          ]
            .filter(Boolean)
            .join("\n");
        }
      );

  return [
    "**CRM 전체 학생 위험 점검 결과**",
    "",
    `- 권한 범위 전체 학생: ${summary.totalStudentCount ?? 0}명`,
    `- 실제 점검 학생: ${summary.checkedStudentCount ?? 0}명`,
    `- 점검 실패: ${summary.failedStudentCount ?? failures.length}명`,
    "",
    `- 위험 학생: ${summary.dangerStudentCount ?? 0}명`,
    `- 주의 학생: ${summary.warningStudentCount ?? 0}명`,
    `- 정상 학생: ${summary.normalStudentCount ?? 0}명`,
    `- 전체 위험요소: ${summary.totalIssueCount ?? 0}건`,
    "",
    "**항목별 현황**",
    `- 학점 부족: ${summary.creditShortageStudentCount ?? 0}명`,
    `- 중복과목: ${summary.duplicateSubjectStudentCount ?? 0}명`,
    `- 실습 문제: ${summary.practiceIssueStudentCount ?? 0}명`,
    `- 학점 기준 미설정: ${summary.missingCreditRuleStudentCount ?? 0}명`,
    `- 플랜 누락: ${summary.missingPlanStudentCount ?? 0}명`,
    `- 결제정보 문제: ${summary.paymentIssueStudentCount ?? 0}명`,
    "",
    students.length > 0
      ? "**우선 확인할 학생**"
      : "**조건에 맞는 학생 없음**",
    ...studentLines,
    students.length > 10
      ? `외 ${students.length - 10}명이 더 있습니다.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

  return "요청 처리가 완료되었습니다.";
}

export async function runAiAssistant(
  input: RunAiAssistantInput
): Promise<RunAiAssistantOutput> {
  const hasImageAttachment =
  Boolean(
    input.imageAttachment &&
    String(
      input.imageAttachment
        .imageBase64 ||
      ""
    ).trim()
  );

const message =
  normalizeMessage(
    input.message
  ) ||
  (
    hasImageAttachment
      ? "첨부된 이미지를 분석해줘"
      : ""
  );

  const conversationHistory =
    normalizeConversationHistory(
      input.conversationHistory
    );

const requestStartedAt =
  Date.now();

const requestTraceId =
  `ai_${input.context.organizationId}_${input.context.userId}_${requestStartedAt}`;

  if (!message) {
    return {
      success: false,

      intent: "general_help",

      reply:
        "요청 내용을 입력해주세요.",

      toolName: null,

            toolResult:
        null,

      registrationPreview:
        null,

      meta: {
        scope: input.context.scope,

        organizationId:
          input.context.organizationId,

        userId:
          input.context.userId,
      },
    };
  }

  let pendingActionDecision:
    AiPendingActionDecision |
    null =
    null;

  const presentedAction =
    input.workSession
      .lastPresentedAction;

  const presentedPendingActionId =
    Number(
      presentedAction
        ?.payload
        ?.pendingActionId ||
      0
    );

  const hasAwaitingPendingAction =
    input.workSession
      .workflow
      .step ===
      "awaiting_confirmation" &&
    Boolean(
      presentedAction
    ) &&
    Number.isFinite(
      presentedPendingActionId
    ) &&
    presentedPendingActionId >
      0;

  if (
    hasAwaitingPendingAction
  ) {
        pendingActionDecision =
      await classifyPendingActionDecisionWithOpenAi({
        message,

        workSession:
          input.workSession,

        context:
          input.context,

        conversationHistory,
      });

    if (
      pendingActionDecision
    ) {
      const pendingActionCommand =
        buildPendingActionCommandFromDecision({
          decision:
            pendingActionDecision,

          workSession:
            input.workSession,
        });

      if (
        pendingActionCommand
      ) {
        const isConfirm =
          pendingActionCommand
            .command ===
          "confirm";

        return {
          success:
            true,

          intent:
            isConfirm
              ? "pending_action_confirm"
              : "pending_action_cancel",

          reply:
            isConfirm
              ? "현재 승인 초안을 그대로 진행하는 요청으로 확인했습니다."
              : "현재 승인 초안을 취소하는 요청으로 확인했습니다.",

          toolName:
            null,

          toolResult:
            null,

          data:
            null,

          workSessionPatch:
            null,

                    pendingActionCommand,

          pendingActionDecision,

          registrationPreview:
            null,

          scheduleCreateDraft:
            null,

          consultationUpdateDraft:
            null,

          studentUpdateDraft:
            null,

          meta: {
            scope:
              input.context.scope,

            organizationId:
              input.context
                .organizationId,

            userId:
              input.context.userId,
          },
        };
      }

      if (
        pendingActionDecision
          .decision ===
          "unclear" ||
        pendingActionDecision
          .confidence !==
          "high"
      ) {
        return {
          success:
            true,

          intent:
            "general_help",

          reply:
            "현재 초안을 그대로 진행할까요, 내용을 수정할까요, 아니면 취소할까요?",

          toolName:
            null,

          toolResult:
            null,

          data: {
            pendingActionDecision,
          },

          workSessionPatch:
            null,

          pendingActionCommand:
            null,

          pendingActionDecision,

          registrationPreview:
            null,

          scheduleCreateDraft:
            null,

          consultationUpdateDraft:
            null,

          studentUpdateDraft:
            null,

          meta: {
            scope:
              input.context.scope,

            organizationId:
              input.context
                .organizationId,

            userId:
              input.context.userId,
          },
        };
      }

            /**
       * revise 또는 new_request는
       * 아래의 기존 createPlanWithOpenAi 흐름으로 진행한다.
       */
    }
  }

  /**
   * 실제 Pending Action 승인 대기 상태가 아닌
   * 미완성 Workflow에서만 자연어 초기화를 처리한다.
   *
   * 승인 대기 상태의 "취소"는 위쪽에서
   * pending_action_cancel로 처리되어야 하므로
   * 이 위치는 Pending Action 판단 블록 아래에 둔다.
   */
  if (
    isWorkflowResetMessage(
      message
    )
  ) {
    const hasActiveWorkflow =
      input.workSession
        .workflow
        .type !==
        null ||
      input.workSession
        .workflow
        .step !==
        "idle" ||
      Boolean(
        input.workSession
          .workflow
          .draft &&
        Object.keys(
          input.workSession
            .workflow
            .draft
        ).length >
          0
      ) ||
      (
        Array.isArray(
          input.workSession
            .workflow
            .waitingFor
        ) &&
        input.workSession
          .workflow
          .waitingFor
          .length >
          0
      );

    if (
      hasActiveWorkflow
    ) {
      return {
        success:
          true,

        intent:
          "general_help",

        reply:
          "현재 진행 중이던 작업을 취소했습니다.",

        toolName:
          null,

        toolResult:
          null,

        data:
          null,

        workSessionPatch: {
          workflow:
            buildClearedWorkflowPatch(),

          lastPresentedAction:
            null,
        },

        pendingActionCommand:
          null,

        pendingActionDecision:
          null,

        registrationPreview:
          null,

        consultationCreateDraft:
          null,

        scheduleCreateDraft:
          null,

        consultationUpdateDraft:
          null,

        studentUpdateDraft:
          null,

        semesterCreateDraft:
          null,

        semesterUpdateDraft:
          null,

        semesterCompleteDraft:
          null,

        meta: {
          scope:
            input.context.scope,

          organizationId:
            input.context
              .organizationId,

          userId:
            input.context.userId,
        },
      };
    }
  }

  const plan =
    await createPlanWithOpenAi({
      context:
        input.context,

      message,

    imageAttachment:
      input.imageAttachment ??
      null,

recentDocument:
  input.recentDocument ??
  null,


      workSession:
        input.workSession,

      selectedStudentId:
        input.selectedStudentId,

      selectedStudentName:
        input.selectedStudentName,

      conversationHistory,
    });

console.info(
  "[AI RUNNER] Plan 생성 완료",
  {
    traceId:
      requestTraceId,

    organizationId:
      input.context.organizationId,

    userId:
      input.context.userId,

    role:
      input.context.role,

canWrite:
  input.context.canWrite,

    intent:
      plan.intent,

    toolName:
      plan.toolName,

    failed:
      plan.failed ===
      true,

    selectedStudentId:
      input.selectedStudentId ??
      null,

    durationMs:
      Date.now() -
      requestStartedAt,
  }
);

if (
  plan.failed ===
  true
) {
  return {
    success:
      false,

    intent:
      plan.intent,

    reply:
      plan.failureMessage ||
      "AI 요청을 처리하지 못했습니다.",

    toolName:
      null,

        toolResult:
      null,

    pendingActionDecision,

    registrationPreview:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context.organizationId,

      userId:
        input.context.userId,
    },
  };
}

/**
 * 최근 OCR 문서의 CRM 반영 요청
 *
 * 여기서는 실제 Pending Action을 생성하지 않는다.
 * Router에게 안전하게 반영 미리보기 생성 요청만 전달한다.
 */
if (
  plan.intent ===
    "document_import_preview"
) {
  const planStudentId =
    Number(
      plan.input.studentId ||
      0
    );

  const selectedStudentId =
    Number(
      input.selectedStudentId ||
      0
    );

  const activeTargetStudentId =
    input.workSession
      .activeTarget
      ?.type ===
      "student"
      ? Number(
          input.workSession
            .activeTarget
            .id ||
          0
        )
      : 0;

  const linkedStudentId =
    Number(
      input.workSession
        .linkedContext
        .studentId ||
      0
    );

  const studentIdSource =
    Number.isFinite(
      planStudentId
    ) &&
    planStudentId > 0
      ? planStudentId
      : Number.isFinite(
            selectedStudentId
          ) &&
          selectedStudentId > 0
        ? selectedStudentId
        : Number.isFinite(
              activeTargetStudentId
            ) &&
            activeTargetStudentId > 0
          ? activeTargetStudentId
          : linkedStudentId;

  const studentId =
    Number.isFinite(
      studentIdSource
    ) &&
    studentIdSource > 0
      ? Math.floor(
          studentIdSource
        )
      : 0;

  const recentAnalysisId =
    String(
      input.recentDocument
        ?.analysis
        ?.analysisId ||
      ""
    ).trim() ||
    null;

  const hasRecentDocument =
    Boolean(
      input.recentDocument &&
      input.recentDocument
        .analysis &&
      typeof input
        .recentDocument
        .analysis ===
        "object"
    );

  const canPrepare =
    studentId > 0 &&
    hasRecentDocument;

  return {
    success:
      canPrepare,

    intent:
      "document_import_preview",

    reply:
      !hasRecentDocument
        ? "최근에 분석한 문서 결과를 찾을 수 없습니다. 문서를 다시 첨부해 분석해주세요."
        : studentId <= 0
          ? "문서 분석 결과를 CRM에 반영할 학생을 먼저 선택하거나 찾아주세요."
          : "최근 문서 분석 결과를 선택한 학생 CRM에 반영하기 위한 승인 미리보기를 준비합니다.",

    toolName:
      null,

    toolResult:
      null,

    documentImportPreview:
      canPrepare
        ? {
            required:
              true,

            studentId:
              studentId,

            analysisId:
              recentAnalysisId,

            fileName:
              input.recentDocument
                ?.fileName ??
              null,

            mimeType:
              input.recentDocument
                ?.mimeType ??
              null,
          }
        : null,

    pendingActionDecision,

    registrationPreview:
      null,

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

  if (
    plan.intent ===
      "student_registration_preview" ||
    plan.requiresRegistrationPreview ===
      true
  ) {
const accumulatedRegistrationMessage =
  buildAccumulatedRegistrationMessage({
    message,

    workSession:
      input.workSession,
  });


const planConsultationId =
  Number(
    plan.input
      .consultationId ||
    0
  );

const activeTargetConsultationId =
  input.workSession
    .activeTarget
    ?.type ===
    "consultation"
    ? Number(
        input.workSession
          .activeTarget
          .id ||
        0
      )
    : 0;

const linkedConsultationId =
  Number(
    input.workSession
      .linkedContext
      .consultationId ||
    0
  );

const consultationIdSource =
  Number.isFinite(
    planConsultationId
  ) &&
  planConsultationId > 0
    ? planConsultationId
    : Number.isFinite(
          activeTargetConsultationId
        ) &&
        activeTargetConsultationId > 0
      ? activeTargetConsultationId
      : linkedConsultationId;

const consultationId =
  Number.isFinite(
    consultationIdSource
  ) &&
  consultationIdSource > 0
    ? Math.floor(
        consultationIdSource
      )
    : 0;
    

    return {
      success:
        consultationId > 0,

      intent:
        "student_registration_preview",

      reply:
        consultationId > 0
          ? `상담DB ${consultationId}번의 등록예정 학생 생성 및 과목설계 미리보기를 준비합니다. 실제 저장 전 내용을 반드시 확인해주세요.`
          : "등록예정 학생 생성 및 과목설계를 진행하려면 상담DB 번호가 필요합니다.",

      toolName:
        null,

            toolResult:
        null,

      pendingActionDecision,

      registrationPreview: {
        required:
          true,

        consultationId:
          consultationId > 0
            ? Math.floor(
                consultationId
              )
            : null,

        originalMessage:
  accumulatedRegistrationMessage,
      },

      workSessionPatch:
  buildRegistrationWorkSessionPatch({
    consultationId,

    originalMessage:
      accumulatedRegistrationMessage,

    workSession:
      input.workSession,
  }),

      meta: {
        scope:
          input.context.scope,

        organizationId:
          input.context.organizationId,

        userId:
          input.context.userId,
      },
    };
  }

 if (
  !plan.toolName
) {
  const reply =
    plan.directReply ||
    "요청하신 내용을 처리하지 못했습니다.";

  return {
    success:
      true,

    intent:
      plan.intent,

    reply,

    toolName:
      null,

        toolResult:
      null,

    pendingActionDecision,

    registrationPreview:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context.organizationId,

      userId:
        input.context.userId,
    },
  };
}

const toolInputValidation =
  validateRunnerToolInput({
    context:
      input.context,

    toolName:
      plan.toolName,

    input:
      plan.input,
  });

if (
  !toolInputValidation.valid
) {
  return {
    success:
      false,

    intent:
      plan.intent,

    reply:
      toolInputValidation.message ||
      "Tool 실행에 필요한 정보가 부족합니다.",

    toolName:
      plan.toolName,

        toolResult:
      null,

    pendingActionDecision,

    registrationPreview:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

    workSessionPatch:
  buildCollectingDataWorkSessionPatch({
    plan,

    validationMessage:
      toolInputValidation.message,

    workSession:
      input.workSession,
  }),

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context.organizationId,

      userId:
        input.context.userId,
    },
  };
}

const toolStartedAt =
  Date.now();

console.info(
  "[AI RUNNER] Tool 실행 시작",
  {
    traceId:
      requestTraceId,

    toolName:
      plan.toolName,

    organizationId:
      input.context.organizationId,

    userId:
      input.context.userId,

    role:
      input.context.role,

scope:
  input.context.scope,

    studentId:
      Number(
        plan.input.studentId ||
        0
      ) ||
      null,

    consultationId:
      Number(
        plan.input.consultationId ||
        0
      ) ||
      null,
  }
);

if (
  plan.toolName ===
    "consultation.create"
) {
  let preflight:
    ConsultationCreatePreflightResult;

  try {
    preflight =
      await runConsultationCreatePreflight({
        context:
          input.context,

        input:
          plan.input,
      });
  } catch (
    error
  ) {
    console.error(
      "[AI RUNNER] 상담DB 신규등록 중복 사전검사 예외",
      {
        traceId:
          requestTraceId,

        organizationId:
          input.context
            .organizationId,

        userId:
          input.context.userId,

        role:
          input.context.role,

        error:
          normalizeErrorForLog(
            error
          ),
      }
    );

    return {
      success:
        false,

      intent:
        "consultation_create",

      reply:
        "기존 학생과 상담DB의 중복 여부를 확인하지 못해 신규등록 초안을 만들지 않았습니다. 잠시 후 다시 시도해주세요.",

      toolName:
        "consultation.create",

      toolResult:
        null,

      data:
        null,

      pendingActionDecision,

      registrationPreview:
        null,

      consultationCreateDraft:
        null,

      scheduleCreateDraft:
        null,

      consultationUpdateDraft:
        null,

      studentUpdateDraft:
        null,

      semesterCreateDraft:
        null,

      workSessionPatch: {
        workflow: {
          type:
            "consultation_registration",

          step:
            "failed",

          draftPatch:
            plan.input,

          waitingFor:
            [],
        },

        lastPresentedAction:
          null,
      },

      meta: {
        scope:
          input.context.scope,

        organizationId:
          input.context
            .organizationId,

        userId:
          input.context.userId,
      },
    };
  }

  if (
    preflight.canCreate !==
      true
  ) {
    const blockingData =
      preflight
        .blockingToolResult
        .data;

    const targetPatch =
      buildReadTargetWorkSessionPatch({
        toolName:
          preflight
            .blockingToolName,

        toolInput:
          preflight
            .blockingToolInput,

        toolResult:
          preflight
            .blockingToolResult,

        workSession:
          input.workSession,
      });

    return {
      success:
        true,

      intent:
        getIntentFromToolName(
          preflight
            .blockingToolName
        ),

      reply:
        preflight.reply,

      toolName:
        preflight
          .blockingToolName,

      toolResult:
        preflight
          .blockingToolResult,

      data:
        blockingData,

      pendingActionDecision,

      registrationPreview:
        null,

      consultationCreateDraft:
        null,

      scheduleCreateDraft:
        null,

      consultationUpdateDraft:
        null,

      studentUpdateDraft:
        null,

      semesterCreateDraft:
        null,

      workSessionPatch:
        targetPatch ?? {
          workflow: {
            type:
              null,

            step:
              "idle",

            clearDraft:
              true,

            waitingFor:
              [],
          },

          lastPresentedAction:
            null,
        },

      meta: {
        scope:
          input.context.scope,

        organizationId:
          input.context
            .organizationId,

        userId:
          input.context.userId,
      },
    };
  }
}

if (
  plan.toolName ===
    "document.analysis" &&
  !hasImageAttachment
) {
  return {
    success:
      false,

    intent:
      "document_analysis",

    reply:
      "분석할 이미지를 첨부해주세요.",

    toolName:
      null,

    toolResult:
      null,

    pendingActionDecision,

    registrationPreview:
      null,

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

const executableToolInput:
  Record<
    string,
    unknown
  > =
  plan.toolName ===
    "document.analysis"
    ? {
        ...plan.input,

        /**
         * OpenAI가 생성하지 못하게 한
         * 서버 첨부 이미지 값만 여기서 주입한다.
         */
        fileName:
          input.imageAttachment
            ?.fileName,

        mimeType:
          input.imageAttachment
            ?.mimeType,

        imageBase64:
          input.imageAttachment
            ?.imageBase64,
      }
    : plan.input;

let toolResult:
  AiToolExecutionResult<any>;

try {
  toolResult =
    await executeAiTool({
      toolName:
        plan.toolName,

      context:
        input.context,

      input:
  executableToolInput,
    });
} catch (
  error
) {
  console.error(
    "[AI RUNNER] Tool 실행 예외",
    {
      traceId:
        requestTraceId,

      toolName:
        plan.toolName,

      organizationId:
        input.context.organizationId,

      userId:
        input.context.userId,

      role:
        input.context.role,

      durationMs:
        Date.now() -
        toolStartedAt,

      error:
  normalizeErrorForLog(
    error
  ),
    }
  );

  return {
    success:
      false,

    intent:
      plan.intent,

    reply:
      "CRM 업무 처리 중 오류가 발생했습니다.",

    toolName:
      plan.toolName,

        toolResult:
      null,

    pendingActionDecision,

        registrationPreview:
      null,

    consultationCreateDraft:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

    semesterCreateDraft:
      null,

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context.organizationId,

      userId:
        input.context.userId,
    },
  };
}

console.info(
  "[AI RUNNER] Tool 실행 완료",
  {
    traceId:
      requestTraceId,

    toolName:
      plan.toolName,

    success:
      toolResult.success,

    errorCode:
      toolResult.error?.code ??
      null,

    durationMs:
      Date.now() -
      toolStartedAt,

    totalDurationMs:
      Date.now() -
      requestStartedAt,
  }
);

if (
  plan.toolName ===
    "student.update" &&
  toolResult.success ===
    true
) {
  const draft =
    toolResult.data as
      StudentUpdateToolOutput;

  return {
    success:
      true,

    intent:
      "student_update",

    reply:
      buildToolReply({
        plan,
        result:
          toolResult,
      }),

    toolName:
      "student.update",

    toolResult,

        data:
      toolResult.data,

    pendingActionDecision,

    registrationPreview:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

        studentUpdateDraft:
      draft,

    workSessionPatch:
      buildAwaitingConfirmationWorkSessionPatch({
  plan,

  toolResultData:
    toolResult.data,

  workSession:
    input.workSession,
}),

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

if (
  plan.toolName ===
    "plan.create" &&
  toolResult.success ===
    true
) {
  const draft =
    toolResult.data as
      PlanCreateToolOutput;

  return {
    success:
      true,

    intent:
      "plan_create",

    reply:
      buildToolReply({
        plan,
        result:
          toolResult,
      }),

    toolName:
      "plan.create",

    toolResult,

    data:
      toolResult.data,

    pendingActionDecision,

    registrationPreview:
      null,

    consultationCreateDraft:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

    planCreateDraft:
      draft,

    semesterCreateDraft:
      null,

    semesterUpdateDraft:
      null,

    semesterCompleteDraft:
      null,

    workSessionPatch:
      buildAwaitingConfirmationWorkSessionPatch({
        plan,

        toolResultData:
          toolResult.data,

        workSession:
          input.workSession,
      }),

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

if (
  plan.toolName ===
    "plan.update" &&
  toolResult.success ===
    true
) {
  const draft =
    toolResult.data as
      PlanUpdateToolOutput;

  return {
    success:
      true,

    intent:
      "plan_update",

    reply:
      buildToolReply({
        plan,
        result:
          toolResult,
      }),

    toolName:
      "plan.update",

    toolResult,

    data:
      toolResult.data,

    pendingActionDecision,

    registrationPreview:
      null,

    consultationCreateDraft:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

    planCreateDraft:
      null,

    planUpdateDraft:
      draft,

    planSubjectsCreateDraft:
      null,

    semesterCreateDraft:
      null,

    semesterUpdateDraft:
      null,

    semesterCompleteDraft:
      null,

    workSessionPatch:
      buildAwaitingConfirmationWorkSessionPatch({
        plan,

        toolResultData:
          toolResult.data,

        workSession:
          input.workSession,
      }),

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

if (
  plan.toolName ===
    "plan.subjects.create" &&
  toolResult.success ===
    true
) {
  const draft =
    toolResult.data as
      PlanSubjectsCreateToolOutput;

  return {
    success:
      true,

    intent:
      "plan_subjects_create",

    reply:
      buildToolReply({
        plan,
        result:
          toolResult,
      }),

    toolName:
      "plan.subjects.create",

    toolResult,

    data:
      toolResult.data,

    pendingActionDecision,

    registrationPreview:
      null,

    consultationCreateDraft:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

    planCreateDraft:
      null,

    planSubjectsCreateDraft:
      draft,

    semesterCreateDraft:
      null,

    semesterUpdateDraft:
      null,

    semesterCompleteDraft:
      null,

    workSessionPatch:
      buildAwaitingConfirmationWorkSessionPatch({
        plan,

        toolResultData:
          toolResult.data,

        workSession:
          input.workSession,
      }),

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

if (
  plan.toolName ===
    "plan.subjects.update" &&
  toolResult.success ===
    true
) {
  const draft =
    toolResult.data as
      PlanSubjectsUpdateToolOutput;

  return {
    success:
      true,

    intent:
      "plan_subjects_update",

    reply:
      buildToolReply({
        plan,
        result:
          toolResult,
      }),

    toolName:
      "plan.subjects.update",

    toolResult,

    data:
      toolResult.data,

    pendingActionDecision,

    registrationPreview:
      null,

    consultationCreateDraft:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

    planCreateDraft:
      null,

    planUpdateDraft:
      null,

    planSubjectsCreateDraft:
      null,

    planSubjectsUpdateDraft:
      draft,

    semesterCreateDraft:
      null,

    semesterUpdateDraft:
      null,

    semesterCompleteDraft:
      null,

    workSessionPatch:
      buildAwaitingConfirmationWorkSessionPatch({
        plan,

        toolResultData:
          toolResult.data,

        workSession:
          input.workSession,
      }),

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

if (
  plan.toolName ===
    "semester.create" &&
  toolResult.success ===
    true
) {
  const draft =
    toolResult.data as
      SemesterCreateToolOutput;

  return {
    success:
      true,

    intent:
      "semester_create",

    reply:
      buildToolReply({
        plan,
        result:
          toolResult,
      }),

    toolName:
      "semester.create",

    toolResult,

    data:
      toolResult.data,

    pendingActionDecision,

    registrationPreview:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

        semesterCreateDraft:
      draft,

    semesterUpdateDraft:
      null,

    semesterCompleteDraft:
      null,

    workSessionPatch:
      buildAwaitingConfirmationWorkSessionPatch({
        plan,

        toolResultData:
          toolResult.data,

        workSession:
          input.workSession,
      }),

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

if (
  plan.toolName ===
    "semester.update" &&
  toolResult.success ===
    true
) {
  const draft =
    toolResult.data as
      SemesterUpdateToolOutput;

  return {
    success:
      true,

    intent:
      "semester_update",

    reply:
      buildToolReply({
        plan,
        result:
          toolResult,
      }),

    toolName:
      "semester.update",

    toolResult,

    data:
      toolResult.data,

    pendingActionDecision,

    registrationPreview:
      null,

    consultationCreateDraft:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

    semesterCreateDraft:
      null,

    semesterUpdateDraft:
      draft,

    semesterCompleteDraft:
      null,

    workSessionPatch:
      buildAwaitingConfirmationWorkSessionPatch({
        plan,

        toolResultData:
          toolResult.data,

        workSession:
          input.workSession,
      }),

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

if (
  plan.toolName ===
    "semester.complete" &&
  toolResult.success ===
    true
) {
  const draft =
    toolResult.data as
      SemesterCompleteToolOutput;

  return {
    success:
      true,

    intent:
      "semester_complete",

    reply:
      buildToolReply({
        plan,
        result:
          toolResult,
      }),

    toolName:
      "semester.complete",

    toolResult,

    data:
      toolResult.data,

    pendingActionDecision,

    registrationPreview:
      null,

    consultationCreateDraft:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

        semesterCreateDraft:
      null,

    semesterUpdateDraft:
      null,

    semesterCompleteDraft:
      draft,

    workSessionPatch:
      buildAwaitingConfirmationWorkSessionPatch({
        plan,

        toolResultData:
          toolResult.data,

        workSession:
          input.workSession,
      }),

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

if (
  plan.toolName ===
    "consultation.create" &&
  toolResult.success ===
    true
) {
  const draft =
    toolResult.data as
      ConsultationCreateToolOutput;

  return {
    success:
      true,

    intent:
      "consultation_create",

    reply:
      buildToolReply({
        plan,
        result:
          toolResult,
      }),

    toolName:
      "consultation.create",

    toolResult,

    data:
      toolResult.data,

    pendingActionDecision,

    registrationPreview:
      null,

    consultationCreateDraft:
      draft,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      null,

    semesterCreateDraft:
      null,

    workSessionPatch:
      buildAwaitingConfirmationWorkSessionPatch({
        plan,

        toolResultData:
          toolResult.data,

        workSession:
          input.workSession,
      }),

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

if (
  plan.toolName ===
    "consultation.update" &&
  toolResult.success ===
    true
) {
  const draft =
    toolResult.data as
      RunAiAssistantOutput[
        "consultationUpdateDraft"
      ];

  return {
    success:
      true,

    intent:
      "consultation_update",

    reply:
      buildToolReply({
        plan,
        result:
          toolResult,
      }),

    toolName:
      "consultation.update",

    toolResult,

        data:
      toolResult.data,

    pendingActionDecision,

    registrationPreview:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      draft,

       studentUpdateDraft:
      null,

    workSessionPatch:
      buildAwaitingConfirmationWorkSessionPatch({
  plan,

  toolResultData:
    toolResult.data,

  workSession:
    input.workSession,
}),

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context
          .organizationId,

      userId:
        input.context.userId,
    },
  };
}

const naturalToolReplyResult =
  shouldCreateNaturalToolReply(
    plan.toolName
  )
    ? await createToolResultReplyWithOpenAi({
        context:
          input.context,

        message,

        plan,

        toolName:
          plan.toolName,

        toolInput:
          plan.input,

        toolResult,

        selectedStudentId:
          input.selectedStudentId,

selectedStudentName:
  input.selectedStudentName,

recentDocument:
  input.recentDocument ??
  null,

workSession:
  input.workSession,

conversationHistory,
      })
    : null;

const finalToolName =
  naturalToolReplyResult
    ?.toolName ||
  plan.toolName;

const finalToolInput =
  naturalToolReplyResult
    ?.toolInput ||
  plan.input;

const finalToolResult =
  naturalToolReplyResult
    ?.toolResult ||
  toolResult;

const toolReply =
  naturalToolReplyResult
    ?.reply ||
  buildToolReply({
    plan,

    result:
      toolResult,
  });

const readTargetWorkSessionPatch =
  buildReadTargetWorkSessionPatch({
    toolName:
      finalToolName,

    toolInput:
      finalToolInput,

    toolResult:
      finalToolResult,

    workSession:
      input.workSession,
  });

return {
  success:
    finalToolResult.success,

  intent:
    getIntentFromToolName(
      finalToolName
    ),

  reply:
    toolReply,

  toolName:
    finalToolName,

  toolResult:
    finalToolResult,

  data:
    finalToolResult.data,

    pendingActionDecision,

    registrationPreview:
      null,

documentImportPreview:
  naturalToolReplyResult
    ?.documentImportPreview ??
  null,

scheduleCreateDraft:
  plan.toolName ===
    "schedule.create" &&
  toolResult.success ===
    true &&
  toolResult.data
    ? toolResult.data
    : null,

workSessionPatch:
  plan.toolName ===
    "schedule.create" &&
  toolResult.success ===
    true
    ? buildAwaitingConfirmationWorkSessionPatch({
  plan,

  toolResultData:
    toolResult.data,

  workSession:
    input.workSession,
})
    : readTargetWorkSessionPatch,

    meta: {
      scope:
        input.context.scope,

      organizationId:
        input.context.organizationId,

      userId:
        input.context.userId,
    },
  };
}