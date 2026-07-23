import OpenAI from "openai";

import {
  executeAiTool,
  listRegisteredAiTools,
} from "./ai-tool-registry";

import type {
  AiToolExecutionResult,
  AiToolName,
  AiUserContext,
  StudentUpdateToolOutput,
} from "./ai.types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type AiRunnerIntent =
  | "greeting"
  | "small_talk"
  | "student_search"
  | "student_summary"
  | "student_dashboard"
  | "student_update"
  | "consultation_search"
  | "consultation_update"
  | "missing_data"
  | "student_detail_risk"
  | "student_list_risk"
  | "student_registration_preview"
  | "schedule_create"
  | "general_help";

type AiRunnerPlan = {
  intent: AiRunnerIntent;

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
    | "schedule.create"
    | null;

  input:
    Record<string, unknown>;

  explanation:
    string;

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

function normalizeMessage(value: unknown) {
  return String(value ?? "")
    .trim()
    .slice(0, 3000);
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

function extractStudentIdFromMessage(
  message: string
): number | null {
  const patterns = [
    /학생\s*(?:id|번호)?\s*[:#]?\s*(\d+)/i,
    /student\s*(?:id)?\s*[:#]?\s*(\d+)/i,
    /^#(\d+)$/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match?.[1]) {
      const id = Number(match[1]);

      if (
        Number.isFinite(id) &&
        id > 0
      ) {
        return Math.floor(id);
      }
    }
  }

  return null;
}

function extractConsultationIdFromMessage(
  message: string
): number | null {
  const patterns = [
    /상담\s*db\s*(?:id|번호)?\s*[:#]?\s*(\d+)/i,
    /상담\s*(?:id|번호)\s*[:#]?\s*(\d+)/i,
    /상담\s*(\d+)\s*번/i,
    /consultation\s*(?:id)?\s*[:#]?\s*(\d+)/i,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      message.match(pattern);

    if (match?.[1]) {
      const id =
        Number(match[1]);

      if (
        Number.isFinite(id) &&
        id > 0
      ) {
        return Math.floor(id);
      }
    }
  }

  return null;
}

function extractScheduleDateFromMessage(
  message:
    string
): string | null {
  const normalized =
    String(
      message ||
      ""
    ).trim();

  /**
   * 2026-07-30 / 2026.07.30 / 2026년 7월 30일
   */
  const fullDateMatch =
    normalized.match(
      /(\d{4})\s*(?:년|[-./])\s*(\d{1,2})\s*(?:월|[-./])\s*(\d{1,2})\s*일?/
    );

  if (
    fullDateMatch
  ) {
    const year =
      Number(
        fullDateMatch[1]
      );

    const month =
      Number(
        fullDateMatch[2]
      );

    const day =
      Number(
        fullDateMatch[3]
      );

    const candidate =
      new Date(
        year,
        month - 1,
        day
      );

    if (
      candidate.getFullYear() ===
        year &&
      candidate.getMonth() ===
        month - 1 &&
      candidate.getDate() ===
        day
    ) {
      return `${year}-${String(
        month
      ).padStart(
        2,
        "0"
      )}-${String(
        day
      ).padStart(
        2,
        "0"
      )}`;
    }
  }

  /**
   * 7월 30일
   *
   * 현재 연도를 기본으로 사용하고,
   * 이미 지난 날짜면 다음 연도로 넘긴다.
   */
  const monthDayMatch =
    normalized.match(
      /(\d{1,2})\s*월\s*(\d{1,2})\s*일/
    );

  if (
    monthDayMatch
  ) {
    const now =
      new Date();

    let year =
      now.getFullYear();

    const month =
      Number(
        monthDayMatch[1]
      );

    const day =
      Number(
        monthDayMatch[2]
      );

    let candidate =
      new Date(
        year,
        month - 1,
        day
      );

    if (
      candidate.getFullYear() !==
        year ||
      candidate.getMonth() !==
        month - 1 ||
      candidate.getDate() !==
        day
    ) {
      return null;
    }

    const today =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

    if (
      candidate <
      today
    ) {
      year += 1;

      candidate =
        new Date(
          year,
          month - 1,
          day
        );
    }

    return `${year}-${String(
      month
    ).padStart(
      2,
      "0"
    )}-${String(
      day
    ).padStart(
      2,
      "0"
    )}`;
  }

  return null;
}

function extractScheduleTimeFromMessage(
  message:
    string
): {
  meridiem:
    "AM" |
    "PM";

  hour12:
    number;

  minute:
    number;
} | null {
  const normalized =
    String(
      message ||
      ""
    ).trim();

  /**
   * 오후 2시 30분
   * 오전 10시
   */
  const koreanMatch =
    normalized.match(
      /(오전|오후)\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/
    );

  if (
    koreanMatch
  ) {
    const hour12 =
      Number(
        koreanMatch[2]
      );

    const minute =
      Number(
        koreanMatch[3] ||
        0
      );

    if (
      hour12 >= 1 &&
      hour12 <= 12 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return {
        meridiem:
          koreanMatch[1] ===
            "오후"
            ? "PM"
            : "AM",

        hour12,

        minute,
      };
    }
  }

  /**
   * 14:30 / 09:00
   */
  const hour24Match =
    normalized.match(
      /(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?:\s|$)/
    );

  if (
    hour24Match
  ) {
    const hour24 =
      Number(
        hour24Match[1]
      );

    const minute =
      Number(
        hour24Match[2]
      );

    return {
      meridiem:
        hour24 >= 12
          ? "PM"
          : "AM",

      hour12:
        hour24 %
          12 ||
        12,

      minute,
    };
  }

  return null;
}

function extractScheduleTitleFromMessage(
  message:
    string
): string {
  const normalized =
    String(
      message ||
      ""
    )
.replace(
  /학생\s*(?:id|번호)?\s*[:#]?\s*\d+\s*번?/gi,
  " "
)
      .replace(
        /\d{4}\s*(?:년|[-./])\s*\d{1,2}\s*(?:월|[-./])\s*\d{1,2}\s*일?/g,
        " "
      )
      .replace(
        /\d{1,2}\s*월\s*\d{1,2}\s*일/g,
        " "
      )
      .replace(
        /(오전|오후)\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/g,
        " "
      )
      .replace(
        /(?:^|\s)([01]?\d|2[0-3]):[0-5]\d(?:\s|$)/g,
        " "
      )
      .replace(
        /(일정|스케줄)\s*(등록|추가|생성|잡아|만들어)?\s*(해줘|해주세요|해|줘)?/g,
        " "
      )
      .replace(
        /(등록|추가|생성)\s*(해줘|해주세요|해|줘)?/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return normalized
    .slice(
      0,
      255
    ) ||
    "학생 일정";
}

function extractStudentStatusUpdate(
  message:
    string
): string | null {
  const patterns = [
    /학생\s*상태를?\s*(.+?)(?:으로|로)\s*(?:변경|수정)/,
    /상태를?\s*(.+?)(?:으로|로)\s*(?:변경|수정)/,
    /학생\s*상태\s*[:：]\s*(.+)$/,
  ];

  for (
    const pattern of
    patterns
  ) {
    const matched =
      message.match(
        pattern
      );

    const value =
      String(
        matched?.[1] ||
        ""
      )
        .trim()
        .slice(
          0,
          100
        );

    if (value) {
      return value;
    }
  }

  return null;
}

function extractStudentCourseUpdate(
  message:
    string
): string | null {
  const patterns = [
    /(?:진행\s*)?과정을?\s*(.+?)(?:으로|로)\s*(?:변경|수정)/,
    /(?:진행\s*)?과정\s*[:：]\s*(.+)$/,
  ];

  for (
    const pattern of
    patterns
  ) {
    const matched =
      message.match(
        pattern
      );

    const value =
      String(
        matched?.[1] ||
        ""
      )
        .trim()
        .slice(
          0,
          255
        );

    if (value) {
      return value;
    }
  }

  return null;
}

function extractStudentFinalEducationUpdate(
  message:
    string
): string | null {
  const patterns = [
    /최종\s*학력을?\s*(.+?)(?:으로|로)\s*(?:변경|수정)/,
    /최종\s*학력\s*[:：]\s*(.+)$/,
  ];

  for (
    const pattern of
    patterns
  ) {
    const matched =
      message.match(
        pattern
      );

    const value =
      String(
        matched?.[1] ||
        ""
      )
        .trim()
        .slice(
          0,
          100
        );

    if (value) {
      return value;
    }
  }

  return null;
}

function extractStudentAddressUpdate(
  message:
    string
): {
  address:
    string |
    null;

  detailAddress:
    string |
    null;
} {
  const addressMatch =
    message.match(
      /학생\s*주소를?\s*(.+?)(?:으로|로)\s*(?:변경|수정)/
    ) ||
    message.match(
      /(?:^|\s)주소\s*[:：]\s*(.+)$/
    );

  const detailAddressMatch =
    message.match(
      /상세\s*주소를?\s*(.+?)(?:으로|로)\s*(?:변경|수정)/
    ) ||
    message.match(
      /상세\s*주소\s*[:：]\s*(.+)$/
    );

  return {
    address:
      String(
        addressMatch?.[1] ||
        ""
      )
        .trim()
        .slice(
          0,
          500
        ) ||
      null,

    detailAddress:
      String(
        detailAddressMatch?.[1] ||
        ""
      )
        .trim()
        .slice(
          0,
          500
        ) ||
      null,
  };
}

function isGreetingMessage(message: string) {
  const normalized =
    String(message || "")
      .trim()
      .toLowerCase()
      .replace(/[!?.~ㅋㅎ\s]+/g, "");

  const greetingMessages = new Set([
    "안녕",
    "안녕하세요",
    "안녕하십니까",
    "하이",
    "헬로",
    "반가워",
    "반갑습니다",
    "좋은아침",
    "좋은아침입니다",
    "좋은오후",
    "좋은저녁",
    "오랜만",
    "오랜만이야",
    "오랜만입니다",
  ]);

  return greetingMessages.has(normalized);
}

function isSmallTalkMessage(message: string) {
  const normalized =
    String(message || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const exactMessages = new Set([
    "오늘도 잘 부탁해",
    "잘 부탁해",
    "잘 부탁합니다",
    "잘 부탁드립니다",
    "오늘도 시작하자",
    "시작하자",
    "시작해보자",
    "오늘 어때",
    "잘 있었어",
    "뭐해",
    "고마워",
    "감사해",
    "감사합니다",
    "수고했어",
    "수고했어요",
    "좋아",
    "좋습니다",
    "오케이",
    "알겠어",
  ]);

  if (exactMessages.has(normalized)) {
    return true;
  }

  const smallTalkPatterns = [
    /오늘.*잘.*부탁/,
    /뭐부터.*(하지|할까|하면)/,
    /오늘.*뭐.*(하지|할까|해야)/,
    /어떻게.*시작/,
    /도와줄.*수.*있/,
    /너.*뭐.*할.*수.*있/,
    /기분.*어때/,
    /잘.*있었/,
  ];

  return smallTalkPatterns.some(
    (pattern) => pattern.test(normalized)
  );
}

function detectPlanWithoutOpenAi(params: {
  message: string;
  selectedStudentId?: number | null;
}): AiRunnerPlan | null {
    const message = params.message;
  const lower = message.toLowerCase();

  /**
   * 단순 인사는 OpenAI 분류나 CRM Tool로 넘기지 않는다.
   */
    if (isGreetingMessage(message)) {
    return {
      intent: "greeting",

      toolName: null,

      input: {},

      explanation:
        "사용자의 인사말입니다.",

      requiresRegistrationPreview:
        false,
    };
  }

  if (isSmallTalkMessage(message)) {
    return {
      intent: "small_talk",

      toolName: null,

      input: {
        originalMessage: message,
      },

      explanation:
        "CRM Tool이 필요하지 않은 자연스러운 대화입니다.",

      requiresRegistrationPreview:
        false,
    };
  }

  const studentId =
    extractStudentIdFromMessage(message) ||
    Number(
      params.selectedStudentId || 0
    ) ||
    null;

const scheduleDate =
  extractScheduleDateFromMessage(
    message
  );

const scheduleTime =
  extractScheduleTimeFromMessage(
    message
  );

  const consultationId =
    extractConsultationIdFromMessage(
      message
    );

  const studentRegistrationKeywords = [
    "학생 등록",
    "학생등록",
    "등록예정 학생",
    "등록예정으로",
    "등록 예정으로",
    "학생으로 전환",
    "학생 전환",
    "과목설계",
    "과목 설계",
    "플랜 만들어",
    "학기표 만들어",
    "등록 초안",
    "등록 미리보기",
  ];

const scheduleCreateKeywords = [
  "일정 등록",
  "일정등록",
  "일정 추가",
  "일정추가",
  "일정 생성",
  "일정생성",
  "스케줄 등록",
  "스케줄 추가",
  "스케줄 잡아",
  "일정 잡아",
  "알림 일정",
  "상담 일정",
  "결제 안내 일정",
  "연락 일정",
];

  const missingKeywords = [
    "누락",
    "빠진",
    "결제일",
    "결제금액",
    "미입력",
    "점검",
    "확인해줘",
  ];

  const consultationKeywords = [
    "상담",
    "상담db",
    "상담 db",
    "문의자",
    "리드",
  ];

  const studentSummaryKeywords = [
    "학생 정보",
    "학생정보",
    "상세",
    "요약",
    "현황",
    "정보 보여",
  ];

const studentDashboardKeywords = [
  "전체 정리",
  "종합 정리",
  "전체 현황",
  "종합 현황",
  "진행 상황",
  "진행상황",
  "현재 상황",
  "현재상황",
  "어디까지 진행",
  "어디까지 했",
  "앞으로 뭐",
  "다음에 뭐",
  "다음 업무",
  "해야 할 일",
  "해야할 일",
  "할 일 정리",
  "문제까지 정리",
  "전체적으로 확인",
  "종합적으로 확인",
  "학생 전체 확인",
  "학생 종합 확인",
  "이 학생 정리",
  "이 회원 정리",
  "현재 상태 정리",
  "실습까지 확인",
  "결제까지 확인",
  "과목까지 확인",
];

const studentUpdateKeywords = [
  "학생 상태 변경",
  "학생상태 변경",
  "학생 상태 수정",
  "학생상태 수정",

  "과정 변경",
  "과정 수정",
  "진행 과정 변경",
  "진행과정 변경",
  "진행 과정 수정",
  "진행과정 수정",

  "최종학력 변경",
  "최종 학력 변경",
  "최종학력 수정",
  "최종 학력 수정",

  "학생 주소 변경",
  "학생주소 변경",
  "학생 주소 수정",
  "학생주소 수정",

  "상세주소 변경",
  "상세 주소 변경",
  "상세주소 수정",
  "상세 주소 수정",
];

  const studentSearchKeywords = [
    "학생 찾아",
    "학생 검색",
    "회원 찾아",
    "회원 검색",
    "찾아줘",
    "검색해줘",
  ];

const studentListRiskKeywords = [
  "crm 전체 점검",
  "전체 crm 점검",
  "전체 학생 점검",
  "학생 전체 점검",
  "전체 위험 분석",
  "전체 학생 분석",
  "내 학생 점검",
  "내 학생 전체 점검",
  "우리 팀 점검",
  "팀 학생 점검",
  "위험 학생",
  "문제 있는 학생",
  "학점 부족 학생",
  "과목 부족 학생",
  "중복과목 있는 학생",
  "중복 과목 있는 학생",
  "실습 문제 있는 학생",
];

const studentPaymentKeywords = [
  "결제 상태",
  "결제상태",
  "결제 확인",
  "결제확인",
  "결제금액 확인",
  "결제 금액 확인",
  "결제일 확인",
  "결제 일자",
  "실결제",
  "실 결제",
  "환불 상태",
  "환불상태",
  "환불 확인",
  "환불확인",
  "부분 환불",
  "부분환불",
  "전액 환불",
  "전액환불",
  "정산 확인",
  "정산 상태",
];

const studentRiskKeywords = [
  "위험",
  "위험요소",
  "문제점",
  "학점부족",
  "학점 부족",
  "과목부족",
  "과목 부족",
  "중복과목",
  "중복 과목",
  "실습 문제",
  "학생 분석",
  "학생 점검",
  "이수 점검",
];

if (
  scheduleCreateKeywords.some(
    (
      keyword
    ) =>
      lower.includes(
        keyword
      )
  )
) {
  if (
    !studentId
  ) {
    return {
      intent:
        "schedule_create",

      toolName:
        null,

      input: {
        originalMessage:
          message,
      },

      explanation:
        "일정을 연결할 학생을 먼저 선택해주세요.",

      requiresRegistrationPreview:
        false,
    };
  }

  if (
    !scheduleDate ||
    !scheduleTime
  ) {
    /**
     * 날짜 또는 시간이 불완전하면
     * OpenAI Plan으로 넘겨 자연어를 다시 분석한다.
     */
    return null;
  }

  return {
    intent:
      "schedule_create",

    toolName:
      "schedule.create",

    input: {
      studentId,

      title:
        extractScheduleTitleFromMessage(
          message
        ),

      description:
        null,

      scheduleDate,

      meridiem:
        scheduleTime.meridiem,

      hour12:
        scheduleTime.hour12,

      minute:
        scheduleTime.minute,

      isGlobal:
        false,
    },

    explanation:
      "선택한 학생의 일정 등록 초안을 생성합니다.",

    requiresRegistrationPreview:
      false,
  };
}

  if (
    studentRegistrationKeywords.some(
      (keyword) =>
        lower.includes(
          keyword
        )
    )
  ) {
    return {
      intent:
        "student_registration_preview",

      toolName:
        null,

      input: {
        consultationId,

        originalMessage:
          message,
      },

      explanation:
        consultationId
          ? `상담DB ${consultationId}번의 등록예정 학생 생성 및 과목설계 미리보기를 준비합니다.`
          : "등록예정 학생 생성 및 과목설계 요청이지만 상담DB ID 확인이 필요합니다.",

      requiresRegistrationPreview:
        true,
    };
  }

if (
  studentListRiskKeywords.some(
    (keyword) =>
      lower.includes(keyword)
  )
) {
  const riskLevel =
    lower.includes("위험 학생") ||
    lower.includes("위험만")
      ? "danger"
      : lower.includes("주의 이상") ||
        lower.includes("문제 있는 학생")
        ? "warning"
        : "all";

  return {
    intent:
      "student_list_risk",

    toolName:
      "risk.studentList",

    input: {
      limit: 30,
      riskLevel,
    },

        explanation:
      "권한 범위 내 학생 전체의 위험요소를 점검합니다.",

    requiresRegistrationPreview:
      false,
  };
}

if (
  studentId &&
  studentPaymentKeywords.some(
    (keyword) =>
      lower.includes(keyword)
  )
) {
  return {
    intent:
      "student_detail_risk",

    toolName:
      "risk.studentDetail",

    input: {
      studentId,
    },

    explanation:
      "선택한 학생의 결제 및 환불 상태를 점검합니다.",

    requiresRegistrationPreview:
      false,
  };
}

if (
  studentId &&
  studentRiskKeywords.some(
    (keyword) =>
      lower.includes(keyword)
  )
) {
  return {
    intent: "student_detail_risk",

    toolName: "risk.studentDetail",

    input: {
      studentId,
    },

        explanation:
      "학생 위험요소를 분석합니다.",

    requiresRegistrationPreview:
      false,
  };
}

if (
  studentUpdateKeywords.some(
    (
      keyword
    ) =>
      lower.includes(
        keyword
      )
  )
) {
  if (
    !studentId
  ) {
    return {
      intent:
        "student_update",

      toolName:
        null,

      input: {
        originalMessage:
          message,
      },

      explanation:
        "수정할 학생을 먼저 선택해주세요.",

      requiresRegistrationPreview:
        false,
    };
  }

  const status =
    extractStudentStatusUpdate(
      message
    );

  const course =
    extractStudentCourseUpdate(
      message
    );

  const finalEducation =
    extractStudentFinalEducationUpdate(
      message
    );

  const {
    address,
    detailAddress,
  } =
    extractStudentAddressUpdate(
      message
    );

  const hasUpdate =
    status !==
      null ||
    course !==
      null ||
    finalEducation !==
      null ||
    address !==
      null ||
    detailAddress !==
      null;

  if (!hasUpdate) {
    /**
     * 학생은 확정됐지만 변경값을
     * 정규식으로 정확히 추출하지 못한 경우
     * OpenAI Plan으로 넘긴다.
     */
    return null;
  }

  return {
    intent:
      "student_update",

    toolName:
      "student.update",

    input: {
      studentId,

      ...(status !== null
        ? {
            status,
          }
        : {}),

      ...(course !== null
        ? {
            course,
          }
        : {}),

      ...(finalEducation !== null
        ? {
            finalEducation,
          }
        : {}),

      ...(address !== null
        ? {
            address,
          }
        : {}),

      ...(detailAddress !== null
        ? {
            detailAddress,
          }
        : {}),
    },

    explanation:
      "선택한 학생의 기본정보 수정 초안을 생성합니다.",

    requiresRegistrationPreview:
      false,
  };
}

if (
  studentId &&
  studentDashboardKeywords.some(
    (keyword) =>
      lower.includes(
        keyword
      )
  )
) {
  return {
    intent:
      "student_dashboard",

    toolName:
      "student.dashboard",

    input: {
      studentId,
    },

    explanation:
      "선택한 학생의 기본정보, 학기, 과목, 학점, 결제, 실습, 위험요소와 다음 업무를 종합 조회합니다.",

    requiresRegistrationPreview:
      false,
  };
}

  if (
    missingKeywords.some((keyword) =>
      lower.includes(keyword)
    ) &&
    (
      lower.includes("누락") ||
      lower.includes("결제") ||
      lower.includes("점검")
    )
  ) {
    return {
      intent: "missing_data",
      toolName: "alert.missingData",
      input: {
        limit: 100,
      },
            explanation:
        "권한 범위 내 누락 정보를 점검합니다.",

      requiresRegistrationPreview:
        false,
    };
  }

  if (
    studentId &&
    studentSummaryKeywords.some(
      (keyword) =>
        lower.includes(keyword)
    )
  ) {
    return {
      intent: "student_summary",
      toolName: "student.summary",
      input: {
        studentId,
      },
           explanation:
        "선택한 학생의 기본 정보를 조회합니다.",

      requiresRegistrationPreview:
        false,
    };
  }

  if (
    consultationKeywords.some(
      (keyword) =>
        lower.includes(keyword)
    )
  ) {
    const query = message
      .replace(/상담\s*db/gi, "")
      .replace(/상담/gi, "")
      .replace(/찾아줘|검색해줘|보여줘/gi, "")
      .trim();

    return {
      intent: "consultation_search",
      toolName: "consultation.search",
      input: {
        query: query || message,
        limit: 20,
      },
           explanation:
        "상담DB를 검색합니다.",

      requiresRegistrationPreview:
        false,
    };
  }

  if (
    studentSearchKeywords.some(
      (keyword) =>
        lower.includes(keyword)
    )
  ) {
    const query = message
      .replace(/학생|회원/gi, "")
      .replace(/찾아줘|검색해줘|보여줘/gi, "")
      .trim();

    return {
      intent: "student_search",
      toolName: "student.search",
      input: {
        query: query || message,
        limit: 20,
      },
           explanation:
        "학생 정보를 검색합니다.",

      requiresRegistrationPreview:
        false,
    };
  }

  return null;
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
  const availableTools =
  listRegisteredAiTools()
    .filter(
      (tool) =>
        tool.allowedRoles.includes(
          params.context.role
        )
    )
    .filter(
      (tool) =>
        (
          tool.autoExecutable ===
            true &&
          tool.accessMode ===
            "read"
        ) ||
        (
          (
            tool.name ===
              "schedule.create" ||
            tool.name ===
              "consultation.update" ||
            tool.name ===
              "student.update"
          ) &&
          tool.accessMode ===
            "draft"
        )
    )
    .map(
      (tool) => ({
        name:
          tool.name,

        description:
          tool.description,
      })
    );

  if (!process.env.OPENAI_API_KEY) {
    return {
      intent: "general_help",
      toolName: null,
      input: {},
      explanation:
        "OPENAI_API_KEY가 설정되지 않았습니다.",
requiresRegistrationPreview:
  false,
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
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "너는 EduCanvas CRM의 안전한 AI 요청 분류기다.",
               "사용자 요청을 분석하여 허용된 조회 Tool 또는 등록 미리보기 intent를 선택한다.",
"conversationHistory는 현재 사용자와 AI가 이전에 나눈 최근 대화이다.",
"현재 요청이 짧거나 대상을 생략했다면 conversationHistory를 참고해 문맥을 이어간다.",
"다만 이전 대화만으로 학생 ID나 상담DB ID를 추측하거나 새로 만들어서는 안 된다.",
"이전 대화에 명확한 학생 ID가 없고 현재 선택 학생도 없으면 학생 이름 검색 또는 학생 선택 안내가 필요하다.",
"현재 요청과 이전 대화가 충돌하면 현재 요청을 우선한다.",
"조회 Tool은 자동 실행할 수 있지만 등록 요청은 절대로 자동 실행하지 않는다.",
"학생 등록 요청은 student_registration_preview intent로만 분류하고 toolName은 null로 반환한다.",
"학생 일정 등록 요청은 schedule_create intent와 schedule.create Tool을 사용한다.",
"schedule.create는 실제 일정을 즉시 저장하지 않고 사용자 승인용 초안만 생성한다.",
"일정 등록, 일정 추가, 일정 생성, 일정 잡아줘, 스케줄 등록처럼 학생 일정 생성을 요청하면 schedule_create를 선택한다.",
"schedule_create는 studentId, title, scheduleDate, meridiem, hour12, minute가 모두 확실할 때만 사용한다.",
"선택된 학생이 있으면 selectedStudent.id를 studentId로 사용한다.",
"날짜나 시간이 명확하지 않으면 schedule.create를 호출하지 않고 general_help로 부족한 정보를 안내한다.",
"'내일', '모레', '다음 주'처럼 상대 날짜만 말한 경우 서버 기준일을 추측하지 말고 정확한 날짜를 다시 요청한다.",
"회사 전체 일정이라고 명확히 말하지 않으면 isGlobal은 false다.",
"scheduleDate는 YYYY-MM-DD 형식이어야 한다.",
"meridiem은 AM 또는 PM만 가능하다.",
"hour12는 1부터 12 사이 정수다.",
"minute은 0부터 59 사이 정수다.",
"절대로 삭제, 직접 수정, 직접 입력, DB 직접 접근을 선택하지 않는다.",
                "organizationId, teamId, assigneeId, userId는 만들거나 변경하지 않는다.",
                "",
           "허용 intent:",
"- greeting",
"- small_talk",
"- schedule_create",
"- student_search",
"- student_summary",
"- student_dashboard",
"- student_update",
"- consultation_search",
"- consultation_update",
"- missing_data",
"- student_detail_risk",
"- student_list_risk",
"- student_registration_preview",
"- general_help",
                "",
               "student.summary는 studentId가 확실할 때만 사용한다.",
"student.dashboard는 선택 학생의 현재 진행상황을 종합적으로 확인할 때 사용한다.",
"학생 기본정보뿐 아니라 학기, 과목, 학점, 결제, 실습, 위험요소, 다음 업무를 함께 요청하면 student.dashboard를 사용한다.",
"'이 학생 전체 정리해줘', '현재 어디까지 진행됐어', '앞으로 뭐 해야 돼', '전체 현황 확인해줘' 같은 요청은 student.dashboard를 사용한다.",
"student.dashboard는 studentId가 확실할 때만 사용한다.",
"단순 기본정보만 요청하면 student.summary를 사용한다.",
"위험요소나 결제·환불만 집중적으로 요청하면 risk.studentDetail을 사용한다.",
"CRM 전체 점검, 전체 학생 점검, 위험 학생 찾기, 학점 부족 학생 찾기, 중복과목 학생 찾기처럼 여러 학생을 대상으로 하는 요청은 student_list_risk를 사용한다.",
"student_list_risk는 studentId 없이 사용할 수 있다.",
"선택 학생의 위험요소, 문제점, 학점 부족, 과목 부족, 중복과목, 실습 문제, 이수 점검, 결제 상태, 환불 상태, 실결제금액 확인 요청은 student_detail_risk를 사용한다.",
"student_detail_risk는 studentId가 확실할 때만 사용한다.",
"이름만 있으면 student.search를 사용한다.",
"일반 질문이거나 실행할 Tool이 없으면 general_help를 선택한다.",
"단순 인사, 반가움 표현, 대화 시작 표현은 greeting을 선택한다.",
"감사, 격려, 가벼운 질문, 업무 시작 대화처럼 CRM 조회가 필요하지 않은 일반 대화는 small_talk을 선택한다.",
"small_talk의 toolName은 반드시 null이다.",
"학생 등록, 등록예정 전환, 과목설계, 학기표 생성, 플랜 생성 요청은 student_registration_preview를 선택한다.",
"student_registration_preview는 실제 저장이 아니라 사용자 확인용 미리보기를 준비하는 intent다.",
"student_registration_preview의 toolName은 반드시 null이다.",
"등록 요청에 상담DB 번호가 있으면 consultationId에 넣는다.",
"상담DB 번호가 확실하지 않으면 consultationId는 null로 반환한다.",
"input에는 query, limit, studentId, status, course, finalEducation, address, detailAddress, notes, riskLevel, consultationId, title, description, scheduleDate, meridiem, hour12, minute, isGlobal만 넣을 수 있다.",
"상담DB의 상태 또는 상담내용을 변경해달라는 요청은 consultation_update intent와 consultation.update Tool을 사용한다.",
"consultation.update는 실제 상담DB를 즉시 수정하지 않고 사용자 승인용 초안만 생성한다.",
"consultation.update는 consultationId가 확실할 때만 사용한다.",
"현재 1차 상담 수정 허용 필드는 status와 notes뿐이다.",
"사용자가 상담 상태를 변경하면 input.status에 새 상태를 넣는다.",
"사용자가 상담내용을 추가하거나 변경하면 input.notes에 변경 후 전체 상담내용을 넣는다.",
"담당자, 조직, 이름, 전화번호, 희망과정 변경은 consultation.update로 처리하지 않는다.",
"상담DB 번호가 없거나 수정값이 불명확하면 general_help로 필요한 정보를 요청한다.",
"학생 상태, 진행 과정, 최종학력, 주소, 상세주소 변경 요청은 student_update intent와 student.update Tool을 사용한다.",
"student.update는 실제 학생정보를 즉시 수정하지 않고 사용자 승인용 초안만 생성한다.",
"student.update는 studentId가 확실할 때만 사용한다.",
"선택된 학생이 있으면 selectedStudent.id를 studentId로 사용한다.",
"현재 학생 수정 허용 필드는 status, course, finalEducation, address, detailAddress뿐이다.",
"학생 이름, 전화번호, 담당자, 조직, 승인상태, 결제금액, 결제일, 과목수, 학기수는 student.update로 수정하지 않는다.",
"사용자가 변경을 요청한 필드만 input에 넣는다.",
"변경하지 않는 학생 수정 필드는 null이 아니라 사용하지 않는 값으로 처리한다.",
"학생 ID가 없거나 변경할 값이 불명확하면 general_help로 필요한 정보를 요청한다.",
"사용하지 않는 input 필드는 null로 반환한다.",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
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

  conversationHistory:
    normalizeConversationHistory(
      params.conversationHistory
    ),

  availableTools,
}),
            },
          ],
        },
      ],

      text: {
        format: {
          type: "json_schema",
          name: "educanvas_ai_plan",

          schema: {
            type: "object",
            additionalProperties: false,

            properties: {
              intent: {
                type: "string",
          enum: [
  "greeting",
  "small_talk",
  "schedule_create",
  "student_search",
  "student_summary",
  "student_dashboard",
  "student_update",
  "consultation_search",
  "consultation_update",
  "missing_data",
  "student_detail_risk",
  "student_list_risk",
  "student_registration_preview",
  "general_help",
],
              },

              toolName: {
                type: [
                  "string",
                  "null",
                ],
                enum: [
  "schedule.create",
  "student.search",
  "student.summary",
  "student.dashboard",
  "student.update",
  "consultation.search",
  "consultation.update",
  "alert.missingData",
  "risk.studentDetail",
  "risk.studentList",
  null,
],
              },

              input: {
  type: "object",
  additionalProperties: false,

  properties: {
    query: {
      type: ["string", "null"],
    },

    limit: {
      type: ["number", "null"],
    },

riskLevel: {
  type: [
    "string",
    "null",
  ],

  enum: [
    "all",
    "danger",
    "warning",
    null,
  ],
},

    studentId: {
      type: ["number", "null"],
    },

status: {
  type: [
    "string",
    "null",
  ],
},

course: {
  type: [
    "string",
    "null",
  ],
},

finalEducation: {
  type: [
    "string",
    "null",
  ],
},

address: {
  type: [
    "string",
    "null",
  ],
},

detailAddress: {
  type: [
    "string",
    "null",
  ],
},

notes: {
  type: [
    "string",
    "null",
  ],
},

consultationId: {
  type: [
    "number",
    "null",
  ],
},

title: {
  type: [
    "string",
    "null",
  ],
},

description: {
  type: [
    "string",
    "null",
  ],
},

scheduleDate: {
  type: [
    "string",
    "null",
  ],
},

meridiem: {
  type: [
    "string",
    "null",
  ],

  enum: [
    "AM",
    "PM",
    null,
  ],
},

hour12: {
  type: [
    "number",
    "null",
  ],
},

minute: {
  type: [
    "number",
    "null",
  ],
},

isGlobal: {
  type: [
    "boolean",
    "null",
  ],
},
  },

required: [
  "query",
  "limit",
  "studentId",
"status",
"course",
"finalEducation",
"address",
"detailAddress",
"notes",
  "riskLevel",
  "consultationId",
  "title",
  "description",
  "scheduleDate",
  "meridiem",
  "hour12",
  "minute",
  "isGlobal",
],
},

              explanation: {
                type: "string",
              },
            },

            required: [
              "intent",
              "toolName",
              "input",
              "explanation",
            ],
          },

          strict: true,
        },
      },
    });

  const outputText =
    response.output_text?.trim();

  if (!outputText) {
    return {
      intent: "general_help",
      toolName: null,
      input: {},
      explanation:
        "요청을 실행 가능한 CRM 작업으로 분류하지 못했습니다.",
requiresRegistrationPreview:
  false,
    };
  }

    const parsed =
    JSON.parse(outputText);

  const rawInput =
    parsed.input &&
    typeof parsed.input === "object"
      ? parsed.input
      : {};

  /**
   * Structured Output에서 사용하지 않는 필드는 null로 오므로
   * 실제 Tool 실행 전 null 값을 제거한다.
   */
  const cleanInput =
    Object.fromEntries(
      Object.entries(rawInput).filter(
        ([, value]) =>
          value !== null &&
          value !== undefined
      )
    );

   const intent =
    parsed.intent ||
    "general_help";

  return {
    intent,

    toolName:
  intent === "greeting" ||
  intent === "small_talk" ||
  intent === "student_registration_preview"
    ? null
    : parsed.toolName || null,

    input:
      cleanInput,

    explanation:
      String(
        parsed.explanation ||
        ""
      ),

    requiresRegistrationPreview:
      intent ===
      "student_registration_preview",
  };
} catch (error) {
  console.error(
    "[AI RUNNER] 요청 분류 실패",
    error
  );

  return {
    intent: "general_help",
    toolName: null,
    input: {},
    explanation:
      "AI 요청 분류 중 오류가 발생했습니다.",
requiresRegistrationPreview:
  false,
  };
}
}

function buildSmallTalkReply(params: {
  message: string;
  context: AiUserContext;
  selectedStudentName?: string | null;
}) {
  const message =
    String(params.message || "")
      .trim()
      .toLowerCase();

  const userHonorific =
    params.context.userHonorific ||
    (
      params.context.userName
        ? `${params.context.userName}님`
        : "사용자님"
    );

  const selectedStudentName =
    String(
      params.selectedStudentName || ""
    ).trim();

  if (
    message.includes("고마워") ||
    message.includes("감사")
  ) {
    return "도움이 되었다니 다행입니다. 계속 말씀해주세요.";
  }

  if (
    message.includes("잘 부탁") ||
    message.includes("시작하자") ||
    message.includes("시작해보자")
  ) {
    return [
      `네, ${userHonorific}.`,
      selectedStudentName
        ? `${selectedStudentName} 학생 업무부터 이어서 확인하겠습니다.`
        : "오늘도 필요한 CRM 업무를 차근차근 도와드리겠습니다.",
    ].join("\n");
  }

  if (
    message.includes("뭐부터") ||
    (
      message.includes("오늘") &&
      (
        message.includes("뭐 하지") ||
        message.includes("뭐하지") ||
        message.includes("뭐 해야") ||
        message.includes("뭐해야")
      )
    )
  ) {
    return selectedStudentName
      ? `${selectedStudentName} 학생의 누락정보와 위험요소부터 점검하는 것이 좋습니다.`
      : "먼저 누락정보를 점검한 뒤 위험 학생과 결제 예정 업무를 확인하는 순서가 좋습니다.";
  }

  if (
    message.includes("뭐 할 수") ||
    message.includes("도와줄 수")
  ) {
    return [
      "학생 및 상담DB 검색, 학생 정보 확인, 결제·환불 점검, 위험요소 분석, 전체 누락 점검을 도와드릴 수 있습니다.",
      "학생을 선택하면 해당 학생을 기준으로 더 정확하게 확인합니다.",
    ].join("\n");
  }

  if (
    message.includes("수고") ||
    message === "좋아" ||
    message === "좋습니다" ||
    message === "오케이" ||
    message === "알겠어"
  ) {
    return "네, 확인했습니다. 다음 업무를 말씀해주세요.";
  }

  return [
    `네, ${userHonorific}.`,
    selectedStudentName
      ? `현재 ${selectedStudentName} 학생이 선택되어 있습니다. 필요한 업무를 말씀해주세요.`
      : "필요한 업무를 편하게 말씀해주세요.",
  ].join("\n");
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

  const localPlan =
    detectPlanWithoutOpenAi({
      message,

      selectedStudentId:
        input.selectedStudentId,
    });

 const plan =
  localPlan ||
  (
    await createPlanWithOpenAi({
      context:
        input.context,

      message,

      selectedStudentId:
        input.selectedStudentId,

      selectedStudentName:
        input.selectedStudentName,

      conversationHistory,
    })
  );

  if (plan.intent === "greeting") {
    const userHonorific =
      input.context.userHonorific ||
      (
        input.context.userName
          ? `${input.context.userName}님`
          : "사용자님"
      );

    const selectedStudentName =
      String(
        input.selectedStudentName || ""
      ).trim();

    const reply =
      selectedStudentName
        ? [
            `안녕하세요, ${userHonorific}.`,
            `${selectedStudentName} 학생을 기준으로 어떤 업무를 확인할까요?`,
          ].join("\n")
        : [
            `안녕하세요, ${userHonorific}.`,
            "오늘 어떤 업무를 도와드릴까요?",
          ].join("\n");

    return {
      success: true,

      intent: "greeting",

      reply,

      toolName: null,

      toolResult: null,

      registrationPreview: null,

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

  if (plan.intent === "small_talk") {
    return {
      success: true,

      intent: "small_talk",

      reply: buildSmallTalkReply({
        message,
        context: input.context,
        selectedStudentName:
          input.selectedStudentName,
      }),

      toolName: null,

      toolResult: null,

      registrationPreview: null,

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
  (
   plan.toolName ===
  "student.summary" ||
plan.toolName ===
  "student.dashboard" ||
plan.toolName ===
  "student.update" ||
plan.toolName ===
  "risk.studentDetail" ||
plan.toolName ===
  "schedule.create"
  ) &&
  !Number(
    plan.input.studentId ||
    0
  ) &&
  Number(
    input.selectedStudentId ||
    0
  ) > 0
) {
  plan.input.studentId =
    Number(
      input.selectedStudentId
    );
}

if (
  (
   plan.toolName ===
  "student.summary" ||
plan.toolName ===
  "student.dashboard" ||
plan.toolName ===
  "student.update" ||
plan.toolName ===
  "risk.studentDetail" ||
plan.toolName ===
  "schedule.create"
  ) &&
  !Number(
    plan.input.studentId ||
    0
  )
) {
  return {
    success:
      false,

    intent:
      plan.intent,

    reply:
      "확인할 학생을 먼저 선택해주세요.",

    toolName:
      plan.toolName,

    toolResult:
      null,

    registrationPreview:
      null,

    scheduleCreateDraft:
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

  if (!plan.toolName) {
    return {
      success: true,

      intent: plan.intent,

            reply: [
        `${input.context.userHonorific}, 요청하신 내용을 아직 CRM 업무로 정확히 판단하지 못했습니다.`,
        "",
        "학생 검색, 상담DB 검색, 학생 정보 확인, 결제·환불 점검, 위험요소 분석 또는 전체 누락 점검처럼 말씀해주세요.",
        "",
        input.selectedStudentName
          ? `현재 ${input.selectedStudentName} 학생이 선택되어 있습니다.`
          : "특정 학생 업무라면 학생을 먼저 선택하거나 학생 이름을 말씀해주세요.",
      ].join("\n"),

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

  const toolResult =
  await executeAiTool({
    toolName: plan.toolName,

    context: input.context,

    input: plan.input,
  });

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

return {
    success:
      toolResult.success,

    intent: plan.intent,

    reply: buildToolReply({
      plan,
      result: toolResult,
    }),

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