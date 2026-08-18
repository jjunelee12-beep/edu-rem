import OpenAI from "openai";

import type {
  KakaoAiStructuredMemory,
} from "./kakao-ai-memory-resolver";

import type {
  KakaoAiConversationMessage,
} from "./kakao-ai-intent-router";

export type KakaoAiLeadConsultationSummaryResult = {
  success:
    boolean;

  notes:
    string;

  summaryLines:
    string[];

  specialNotes:
    string[];

  openAiResponseId:
    string | null;

  model:
    string | null;

  fallbackUsed:
    boolean;

  errorMessage:
    string | null;
};

let kakaoAiLeadSummaryOpenAiClient:
  OpenAI | null | undefined;

function getKakaoAiLeadSummaryOpenAiClient():
  OpenAI | null {
  if (
    kakaoAiLeadSummaryOpenAiClient !==
    undefined
  ) {
    return kakaoAiLeadSummaryOpenAiClient;
  }

  const apiKey =
    String(
      process.env.OPENAI_API_KEY ||
      ""
    ).trim();

  if (
    !apiKey
  ) {
    kakaoAiLeadSummaryOpenAiClient =
      null;

    return null;
  }

  kakaoAiLeadSummaryOpenAiClient =
    new OpenAI({
      apiKey,
    });

  return kakaoAiLeadSummaryOpenAiClient;
}

function getKakaoAiLeadSummaryModel():
  string {
  return (
    String(
      process.env
        .OPENAI_KAKAO_LEAD_SUMMARY_MODEL ||
      ""
    ).trim() ||
    String(
      process.env
        .OPENAI_KAKAO_RESPONSE_MODEL ||
      ""
    ).trim() ||
    String(
      process.env
        .OPENAI_KAKAO_INTENT_MODEL ||
      ""
    ).trim() ||
    String(
      process.env
        .OPENAI_AI_MODEL ||
      ""
    ).trim() ||
    "gpt-5.4-mini"
  );
}

function normalizeText(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeStringArray(
  value:
    unknown,

  limit:
    number
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          normalizeText
        )
        .filter(
          Boolean
        )
    )
  ).slice(
    0,
    limit
  );
}

function normalizeConversationHistory(
  history:
    KakaoAiConversationMessage[]
): KakaoAiConversationMessage[] {
  if (
    !Array.isArray(
      history
    )
  ) {
    return [];
  }

  return history
    .slice(
      -20
    )
    .map(
      item => ({
        role:
          item.role,

        content:
          normalizeText(
            item.content
          ),
      })
    )
    .filter(
      item =>
        Boolean(
          item.content
        )
    );
}

const KAKAO_AI_LEAD_SUMMARY_SCHEMA = {
  type:
    "object",

  additionalProperties:
    false,

  properties: {
    summaryLines: {
      type:
        "array",

      items: {
        type:
          "string",
      },
    },

    specialNotes: {
      type:
        "array",

      items: {
        type:
          "string",
      },
    },
  },

  required: [
    "summaryLines",
    "specialNotes",
  ],
} as const;

const KAKAO_AI_LEAD_SUMMARY_INSTRUCTIONS = `
너는 EduCanvas CRM의 신규상담 기록 요약기다.

고객에게 답변하지 않는다.

카카오 상담 대화와 서버가 이미 구조화한 Memory를 보고,
CRM 담당자가 상담DB에서 바로 읽을 수 있는 핵심 상담내용만 요약한다.

중요 원칙:

1. 제공된 대화와 Memory에 실제로 있는 내용만 사용한다.

2. 학점, 과목 수, 기간, 법 적용,
실습시간, 비용, 일정 등을 임의로 계산하거나 추측하지 않는다.

3. 고객이 직접 말한 내용과
AI가 고객에게 설명한 내용을 구분한다.

4. 고객의 실제 희망이나 상황을 우선 기록한다.

예:
- 직장 근무로 평일 실습이 어려움
- 주말 실습 희망
- 빠른 개강 희망
- 비용 문의
- 취득기간 문의
- 성적증명서 확인 예정

5. 단순 인사, 감사, 확인 답변은 기록하지 않는다.

예:
안녕하세요
네
감사합니다
알겠습니다

6. 이름, 전화번호는 요약하지 않는다.
이 정보는 CRM 별도 필드에 저장된다.

7. 담당자 선택 사실은 별도 서버 데이터로 관리되므로
상담내용에 반복해서 넣을 필요가 없다.

8. summaryLines에는
담당자가 알아야 하는 실제 상담 핵심내용을 최대 8개까지 작성한다.

9. specialNotes에는
담당자가 특히 확인하거나 후속 대응해야 할 고객 조건만 최대 5개 작성한다.

10. 없는 특이사항을 만들지 않는다.
없으면 빈 배열을 반환한다.

11. 내부 시스템 용어를 사용하지 않는다.

예:
Memory
Intent
Context
capability
organizationId
conversationId
studentId

12. 문장은 짧고 업무 기록처럼 명확하게 작성한다.

반환은 지정된 JSON 구조만 사용한다.
`.trim();

function buildFallbackNotes(
  params: {
    conversationId:
      number;

    memory:
      KakaoAiStructuredMemory;
  }
): string {
  const lines:
    string[] =
    [];

  lines.push(
    "[카카오 AI 자동접수]"
  );

  lines.push(
    `카카오 대화 ID: ${params.conversationId}`
  );

  if (
    params.memory.desiredCourse
  ) {
    lines.push(
      `희망과정: ${params.memory.desiredCourse}`
    );
  }

  if (
    params.memory.finalEducation
  ) {
    lines.push(
      `최종학력: ${params.memory.finalEducation}`
    );
  }

  if (
    params.memory.currentTopic
  ) {
    lines.push(
      `최근 상담주제: ${params.memory.currentTopic}`
    );
  }

  return lines.join(
    "\n"
  );
}

function buildNotes(
  params: {
    conversationId:
      number;

    memory:
      KakaoAiStructuredMemory;

    summaryLines:
      string[];

    specialNotes:
      string[];
  }
): string {
  const lines:
    string[] =
    [];

  lines.push(
    "[카카오 AI 상담요약]"
  );

  lines.push(
    `카카오 대화 ID: ${params.conversationId}`
  );

  if (
    params.memory.desiredCourse
  ) {
    lines.push(
      ""
    );

    lines.push(
      `희망과정: ${params.memory.desiredCourse}`
    );
  }

  if (
    params.memory.finalEducation
  ) {
    lines.push(
      `최종학력: ${params.memory.finalEducation}`
    );
  }

  if (
    params.summaryLines.length >
    0
  ) {
    lines.push(
      ""
    );

    lines.push(
      "상담내용"
    );

    for (
      const item of
      params.summaryLines
    ) {
      lines.push(
        `- ${item}`
      );
    }
  }

  if (
    params.specialNotes.length >
    0
  ) {
    lines.push(
      ""
    );

    lines.push(
      "특이사항"
    );

    for (
      const item of
      params.specialNotes
    ) {
      lines.push(
        `- ${item}`
      );
    }
  }

  return lines
    .join(
      "\n"
    )
    .trim();
}

export async function summarizeKakaoAiLeadConsultation(
  params: {
    conversationId:
      number;

    memory:
      KakaoAiStructuredMemory;

    conversationHistory:
      KakaoAiConversationMessage[];

    currentMessage:
      string;
  }
): Promise<KakaoAiLeadConsultationSummaryResult> {
  const fallbackNotes =
    buildFallbackNotes({
      conversationId:
        params.conversationId,

      memory:
        params.memory,
    });

  const openai =
    getKakaoAiLeadSummaryOpenAiClient();

  if (
    !openai
  ) {
    return {
      success:
        false,

      notes:
        fallbackNotes,

      summaryLines:
        [],

      specialNotes:
        [],

      openAiResponseId:
        null,

      model:
        null,

      fallbackUsed:
        true,

      errorMessage:
        "OPENAI_API_KEY가 설정되지 않았습니다.",
    };
  }

  const model =
    getKakaoAiLeadSummaryModel();

  const input =
    JSON.stringify({
      currentMessage:
        normalizeText(
          params.currentMessage
        ),

      conversationHistory:
        normalizeConversationHistory(
          params.conversationHistory
        ),

      structuredMemory: {
        desiredCourse:
          params.memory
            .desiredCourse,

        finalEducation:
          params.memory
            .finalEducation,

        hasTransferCollege:
          params.memory
            .hasTransferCollege,

        socialWorkerLawVersion:
          params.memory
            .socialWorkerLawVersion,

        verifiedFacts:
          params.memory
            .verifiedFacts,

        unresolvedQuestions:
          params.memory
            .unresolvedQuestions,

        currentTopic:
          params.memory
            .currentTopic,
      },
    });

  try {
    const response =
      await openai.responses.create({
        model,

        store:
          false,

        instructions:
          KAKAO_AI_LEAD_SUMMARY_INSTRUCTIONS,

        input,

        text: {
          format: {
            type:
              "json_schema",

            name:
              "kakao_ai_lead_consultation_summary",

            strict:
              true,

            schema:
              KAKAO_AI_LEAD_SUMMARY_SCHEMA,
          },
        },
      });

    const outputText =
      normalizeText(
        response.output_text
      );

    if (
      !outputText
    ) {
      return {
        success:
          false,

        notes:
          fallbackNotes,

        summaryLines:
          [],

        specialNotes:
          [],

        openAiResponseId:
          typeof response.id ===
          "string"
            ? response.id
            : null,

        model,

        fallbackUsed:
          true,

        errorMessage:
          "상담요약 응답이 비어 있습니다.",
      };
    }

    const parsed =
      JSON.parse(
        outputText
      ) as
        Record<
          string,
          any
        >;

    const summaryLines =
      normalizeStringArray(
        parsed.summaryLines,
        8
      );

    const specialNotes =
      normalizeStringArray(
        parsed.specialNotes,
        5
      );

    const notes =
      buildNotes({
        conversationId:
          params.conversationId,

        memory:
          params.memory,

        summaryLines,

        specialNotes,
      });

    return {
      success:
        true,

      notes:

        notes ||
        fallbackNotes,

      summaryLines,

      specialNotes,

      openAiResponseId:
        typeof response.id ===
        "string"
          ? response.id
          : null,

      model,

      fallbackUsed:
        false,

      errorMessage:
        null,
    };
  } catch (
    error:
      unknown
  ) {
    console.error(
      "[KAKAO AI] 신규상담 요약 생성 실패",
      error instanceof
        Error
        ? {
            name:
              error.name,

            message:
              error.message,
          }
        : {
            message:
              String(
                error
              ),
          }
    );

    return {
      success:
        false,

      notes:
        fallbackNotes,

      summaryLines:
        [],

      specialNotes:
        [],

      openAiResponseId:
        null,

      model,

      fallbackUsed:
        true,

      errorMessage:
        error instanceof
          Error
          ? error.message
          : String(
              error
            ),
    };
  }
}