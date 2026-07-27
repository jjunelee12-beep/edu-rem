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
 * function_call_output으로 전달할 수 있는
 * 최대 JSON 문자열 길이
 */
const MAX_FUNCTION_CALL_OUTPUT_LENGTH =
  50_000;

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
  | "student_search"
  | "student_summary"
  | "student_dashboard"
  | "student_update"
  | "consultation_search"
  | "consultation_update"
  | "missing_data"
  | "student_detail_risk"
  | "student_list_risk"
  | "practice_institution_search"
  | "practice_support_status"
  | "student_registration_preview"
  | "schedule_create"
  | "general_help";

type AiRunnerPlan = {
  intent:
    AiRunnerIntent;

    toolName:
    | "student.search"
    | "student.summary"
    | "student.dashboard"
    | "student.update"
    | "consultation.search"
    | "consultation.update"
    | "alert.missingData"
    | "risk.studentDetail"
    | "risk.studentList"
    | "practice.institutionSearch"
    | "practice.supportStatus"
    | "schedule.create"
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

export type AiConversationHistoryMessage = {
  role:
    | "user"
    | "assistant";

  content:
    string;
};

export type RunAiAssistantInput = {
  context:
    AiUserContext;

  message:
    string;

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
  success: boolean;

  intent: AiRunnerIntent;

  reply: string;

  toolName: AiToolName | null;

  toolResult?: AiToolExecutionResult<any> | null;

  data?: unknown;

  registrationPreview?: {
    required: boolean;

    consultationId: number | null;

    originalMessage: string;
  } | null;

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

  meta: {
    scope: AiUserContext["scope"];
    organizationId: number;
    userId: number;
  };
};

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
      STUDENT_REGISTRATION_PREVIEW_TOOL
    ) {
      throw new Error(
        `Registry Tool 이름이 등록 미리보기 Tool과 충돌합니다: ${tool.name} → ${openAiName}`
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

    case "consultation.search":
      return "consultation_search";

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
 * 학생 단위 Tool인데 OpenAI가 studentId를 생략한 경우
 * 현재 화면에서 선택된 학생 ID를 보완한다.
 *
 * 선택 학생이 없는 경우에는 임의 ID를 만들지 않는다.
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
}) {
  if (
  !isStudentTargetTool(
    params.toolName
  )
) {
  return params.toolInput;
}

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
    return params.toolInput;
  }

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


async function createPlanWithOpenAi(params: {
  context:
    AiUserContext;

  message:
    string;

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
params.context.role ===
  "superhost"
    ? "현재 사용자는 Superhost다. 학생, 상담, 실습, 일정, 위험도 등 회사 운영 데이터의 조회·수정·등록 업무를 수행하거나 가능하다고 안내하지 않는다."
    : "현재 사용자는 Staff, Admin 또는 Host 권한 범위에서 제공된 CRM Tool만 사용할 수 있다.",
                  "",
                  "사용자의 요청에 CRM 데이터 조회 또는 승인 초안 생성이 필요하면 제공된 Function Tool 중 정확히 하나를 선택한다.",
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
"- 상담DB ID가 확실하지 않으면 consultation_update를 호출하지 않는다.",
                  "",
                  "Tool 선택 기준:",
"- 학생 이름 또는 연락처로 학생을 찾는 요청: student_search",
"- 학생 기본정보만 조회: student_summary",
"- 학생의 학기, 과목, 학점, 결제, 환불, 실습, 일정, 위험요소와 다음 업무 종합조회: student_dashboard",
"- 학생 상태, 과정, 최종학력, 주소, 상세주소 변경 초안: student_update",
"- 상담DB 검색: consultation_search",
"- 상담 상태 또는 상담내용 수정 초안: consultation_update",
"- 결제일, 결제금액, 담당자, 실습 배정 누락 점검: alert_missingData",
"- 특정 학생의 학점, 중복과목, 결제, 환불, 실습 위험 분석: risk_studentDetail",
"- 권한 범위 내 여러 학생의 위험 분석: risk_studentList",
"- 특정 학생 주소를 기준으로 가까운 실습기관과 실습교육원을 거리순으로 추천: practice_institutionSearch",
"- 특정 학생의 실습 신청 여부, 섭외상태, 실습비 결제상태, 선택 교육원, 선택 실습기관, 실습시간과 실습일정 조회: practice_supportStatus",
"- 선택 학생의 일정 등록 초안: schedule_create",
"- 상담DB 회원의 학생 등록, 등록예정 전환, 학기 생성, 과목설계, 플랜 생성 미리보기: student_registration_preview",
                  "",
                  "student_update, consultation_update, schedule_create는 실제 DB를 즉시 변경하지 않고 사용자 승인용 초안만 생성한다.",
                  "사용자가 말하지 않은 수정 필드는 arguments에 넣지 않는다.",
                  "회사 전체 일정이라고 명확히 말하지 않으면 isGlobal은 false로 처리한다.",
                  "",
                  `상대 날짜인 오늘, 내일, 모레를 처리할 때 기준 날짜는 ${getCurrentKoreanDate()}이다.`,
                  "날짜가 확실하면 scheduleDate를 YYYY-MM-DD 형식으로 전달한다.",
                  "시간이 불명확하면 schedule_create를 호출하지 않는다.",
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

                    selectedStudent: {
                      id:
                        params.selectedStudentId ??
                        null,

                      name:
                        params.selectedStudentName ??
                        null,
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
      parsedInput,

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

    const toolInput =
      applySelectedStudentToToolInput({
        toolName:
          registryToolName,

        toolInput:
          parsedInput,

        selectedStudentId:
          params.selectedStudentId,
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

/**
 * Responses API가 반환한 function_call에
 * 실제 CRM Tool 실행 결과를 연결하여
 * 모델의 최종 답변을 생성한다.
 */
async function createFunctionCallOutputReply(params: {
  plan:
    AiRunnerPlan;

  toolResult:
    AiToolExecutionResult<any>;

  fallbackReply:
    string;
}): Promise<string> {
 const openai =
  getOpenAiClient();

if (
  !openai ||
  !params.plan.openAiResponseId ||
  !params.plan.openAiCallId
) {
  return params.fallbackReply;
}

  try {
    const outputPayload =
  JSON.stringify({
    success:
      params.toolResult.success,

    data:
      params.toolResult.data ??
      null,

    error:
      params.toolResult.error ??
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
        params.plan.toolName,

      outputLength:
        outputPayload.length,

      maxLength:
        MAX_FUNCTION_CALL_OUTPUT_LENGTH,
    }
  );

  return params.fallbackReply;
}

    const response =
      await openai.responses.create({
        model:
          process.env.OPENAI_AI_MODEL ||
          "gpt-5.4-mini",

        previous_response_id:
          params.plan.openAiResponseId,

        input: [
          {
            type:
              "function_call_output",

            call_id:
              params.plan.openAiCallId,

            output:
              outputPayload,
          },
        ],
      });

    const reply =
      String(
        response.output_text ||
        ""
      ).trim();

    return reply ||
      params.fallbackReply;
  } catch (
    error
  ) {
    console.error(
  "[AI RUNNER] function_call_output 답변 생성 실패",
  normalizeErrorForLog(
    error
  )
);

    return params.fallbackReply;
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

  conversationHistory?:
    AiConversationHistoryMessage[];
}): Promise<string> {
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
    plan:
      params.plan,

    toolResult:
      params.toolResult,

    fallbackReply,
  });
}

const openai =
  getOpenAiClient();

if (
  !params.toolResult.success ||
  !openai
) {
  return fallbackReply;
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
                  "위험 분석은 위험 항목과 우선 처리할 내용을 중심으로 설명한다.",
                  "학생 검색이나 상담 검색은 검색 건수와 확인 가능한 대상을 간단히 설명한다.",
                 "학생 종합조회는 현재 상태, 중요한 문제, 다음 업무 순서로 정리한다.",
"실습기관 추천 결과는 학생 기준 주소, 가까운 실습기관, 가까운 실습교육원, 거리, 주소, 연락처를 중심으로 정리한다.",
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

    return reply ||
      fallbackReply;
  } catch (
    error
  ) {
    console.error(
  "[AI RUNNER] Tool 결과 답변 생성 실패",
  normalizeErrorForLog(
    error
  )
);

    return fallbackReply;
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
    `**${student.clientName || "학생"} 실습기관 추천 결과**`,
    "",
    `- 기준 주소: ${student.address || "주소 미입력"}${
      student.detailAddress
        ? ` ${student.detailAddress}`
        : ""
    }`,
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
    data?.student || {};

  const summary =
    data?.summary || {};

  const issues =
    Array.isArray(data?.issues)
      ? data.issues
      : [];

  const issueLines =
    issues
      .slice(0, 10)
      .map(
        (issue: any, index: number) =>
          `${index + 1}. ${issue.title || "확인 필요"}: ${issue.message || ""}`
      );

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
    issues.length > 0
      ? "**확인된 문제**"
      : "**확인된 문제 없음**",
    ...issueLines,
  ].join("\n");
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
  const message =
    normalizeMessage(
      input.message
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

  const plan =
  await createPlanWithOpenAi({
    context:
      input.context,

    message,

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

  if (
    plan.intent ===
      "student_registration_preview" ||
    plan.requiresRegistrationPreview ===
      true
  ) {
    const consultationId =
      Number(
        plan.input
          .consultationId ||
        0
      );

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
          message,
      },

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
        plan.input,
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

    registrationPreview:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      null,

    studentUpdateDraft:
      draft,

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

    registrationPreview:
      null,

    scheduleCreateDraft:
      null,

    consultationUpdateDraft:
      draft,

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

const toolReply =
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

        conversationHistory,
      })
    : buildToolReply({
        plan,

        result:
          toolResult,
      });

return {
    success:
      toolResult.success,

    intent: plan.intent,

        reply:
      toolReply,

    toolName:
      plan.toolName,

    toolResult,

        data:
      toolResult.data,

    registrationPreview:
      null,

scheduleCreateDraft:
  plan.toolName ===
    "schedule.create" &&
  toolResult.success ===
    true &&
  toolResult.data
    ? toolResult.data
    : null,

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