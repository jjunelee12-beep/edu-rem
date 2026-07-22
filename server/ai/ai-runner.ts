import OpenAI from "openai";

import {
  executeAiTool,
  listRegisteredAiTools,
} from "./ai-tool-registry";

import type {
  AiToolExecutionResult,
  AiToolName,
  AiUserContext,
} from "./ai.types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type AiRunnerIntent =
  | "student_search"
  | "student_summary"
  | "consultation_search"
  | "missing_data"
  | "student_detail_risk"
  | "student_list_risk"
  | "student_registration_preview"
  | "general_help";

type AiRunnerPlan = {
  intent: AiRunnerIntent;

  toolName:
    | "student.search"
    | "student.summary"
    | "consultation.search"
    | "alert.missingData"
    | "risk.studentDetail"
    | "risk.studentList"
    | null;

  input:
    Record<string, unknown>;

  explanation:
    string;

  requiresRegistrationPreview:
    boolean;
};

export type RunAiAssistantInput = {
  context: AiUserContext;
  message: string;

  selectedStudentId?: number | null;
  selectedStudentName?: string | null;
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

function detectPlanWithoutOpenAi(params: {
  message: string;
  selectedStudentId?: number | null;
}): AiRunnerPlan | null {
  const message = params.message;
  const lower = message.toLowerCase();

  const studentId =
    extractStudentIdFromMessage(message) ||
    Number(
      params.selectedStudentId || 0
    ) ||
    null;

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
  context: AiUserContext;
  message: string;
  selectedStudentId?: number | null;
  selectedStudentName?: string | null;
}): Promise<AiRunnerPlan> {
  const availableTools =
    listRegisteredAiTools()
      .filter((tool) =>
        tool.allowedRoles.includes(
          params.context.role
        )
      )
      .filter(
        (tool) =>
          tool.autoExecutable &&
          tool.accessMode === "read"
      )
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
      }));

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
"조회 Tool은 자동 실행할 수 있지만 등록 요청은 절대로 자동 실행하지 않는다.",
"학생 등록 요청은 student_registration_preview intent로만 분류하고 toolName은 null로 반환한다.",
"절대로 삭제, 직접 수정, 직접 입력, DB 직접 접근을 선택하지 않는다.",
                "organizationId, teamId, assigneeId, userId는 만들거나 변경하지 않는다.",
                "",
               "허용 intent:",
"- student_search",
"- student_summary",
"- consultation_search",
"- missing_data",
"- student_detail_risk",
"- student_list_risk",
"- student_registration_preview",
"- general_help",
                "",
               "student.summary는 studentId가 확실할 때만 사용한다.",
"CRM 전체 점검, 전체 학생 점검, 위험 학생 찾기, 학점 부족 학생 찾기, 중복과목 학생 찾기처럼 여러 학생을 대상으로 하는 요청은 student_list_risk를 사용한다.",
"student_list_risk는 studentId 없이 사용할 수 있다.",
"선택 학생의 위험요소, 문제점, 학점 부족, 과목 부족, 중복과목, 실습 문제, 이수 점검, 결제 상태, 환불 상태, 실결제금액 확인 요청은 student_detail_risk를 사용한다.",
"student_detail_risk는 studentId가 확실할 때만 사용한다.",
"이름만 있으면 student.search를 사용한다.",
"일반 질문이거나 실행할 Tool이 없으면 general_help를 선택한다.",
"학생 등록, 등록예정 전환, 과목설계, 학기표 생성, 플랜 생성 요청은 student_registration_preview를 선택한다.",
"student_registration_preview는 실제 저장이 아니라 사용자 확인용 미리보기를 준비하는 intent다.",
"student_registration_preview의 toolName은 반드시 null이다.",
"등록 요청에 상담DB 번호가 있으면 consultationId에 넣는다.",
"상담DB 번호가 확실하지 않으면 consultationId는 null로 반환한다.",
"input에는 query, limit, studentId, riskLevel, consultationId만 넣을 수 있다.",
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
                message: params.message,

                selectedStudent: {
                  id:
                    params.selectedStudentId ??
                    null,

                  name:
                    params.selectedStudentName ??
                    null,
                },

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
  "student_search",
  "student_summary",
  "consultation_search",
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
  "student.search",
  "student.summary",
  "consultation.search",
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

consultationId: {
  type: [
    "number",
    "null",
  ],
},
  },

required: [
  "query",
  "limit",
  "studentId",
  "riskLevel",
  "consultationId",
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
      intent ===
        "student_registration_preview"
        ? null
        : parsed.toolName ||
          null,

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
    normalizeMessage(input.message);

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
    (await createPlanWithOpenAi({
      context: input.context,
      message,

      selectedStudentId:
        input.selectedStudentId,

      selectedStudentName:
        input.selectedStudentName,
    }));

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
    plan.toolName === "student.summary" ||
    plan.toolName === "risk.studentDetail"
  ) &&
  !Number(plan.input.studentId || 0) &&
  Number(input.selectedStudentId || 0) > 0
) {
  plan.input.studentId =
    Number(input.selectedStudentId);
}

if (
  (
    plan.toolName === "student.summary" ||
    plan.toolName === "risk.studentDetail"
  ) &&
  !Number(plan.input.studentId || 0)
) {
  return {
    success: false,

    intent: plan.intent,

    reply:
      "확인할 학생을 먼저 선택해주세요.",

    toolName:
      plan.toolName,

    toolResult: null,

registrationPreview:
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
  "현재 사용 가능한 기능을 안내드립니다.",
  "",
  "- 학생 및 상담DB 검색",
  "- 선택 학생 기본정보 조회",
  "- 선택 학생 위험요소 점검",
  "- 선택 학생 결제·환불 상태 점검",
  "- 권한 범위 내 누락정보 점검",
  "- 권한 범위 내 전체 학생 위험 점검",
  "",
  "학생을 먼저 선택하면 해당 학생을 기준으로 더 정확하게 확인할 수 있습니다.",
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