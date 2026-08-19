import OpenAI from "openai";

import * as db from "../db";

import type {
  KakaoAiCapability,
  KakaoAiCustomerType,
} from "./kakao-ai-access-policy";

import type {
  KakaoAiConversationMessage,
} from "./kakao-ai-intent-router";

export type KakaoAiCallbackRequestActionResult = {
  handled: boolean;

  saved: boolean;

  consultationId: number | null;

  preferredDateText: string | null;

  preferredTimeText: string | null;

  reason:
    | "NOT_REQUESTED"
    | "NOT_LEAD"
    | "CONSULTATION_NOT_LINKED"
    | "DATE_TIME_NOT_FOUND"
    | "CONSULTATION_NOT_FOUND"
    | "SAVE_FAILED"
    | null;

  replyText: string | null;
};

type CallbackExtractionResult = {
  wantsCallback: boolean;

  /**
   * 사용자가 실제로 말한 날짜 의미.
   *
   * 예:
   * 오늘
   * 내일
   * 이번 금요일
   * 8월 21일
   *
   * 없는 경우 null.
   */
  preferredDateText: string | null;

  /**
   * 사용자가 실제로 말한 시간 의미.
   *
   * 예:
   * 오후 3시
   * 오전
   * 7시 이후
   *
   * 없는 경우 null.
   */
  preferredTimeText: string | null;

  /**
   * 담당자에게 남길 수 있는
   * 짧은 콜백 요청 요약.
   */
  summary: string | null;
};

let callbackOpenAiClient:
  OpenAI | null | undefined;

function normalizeText(
  value: unknown
): string {
  return String(
    value ??
      ""
  ).trim();
}

function normalizePositiveInteger(
  value: unknown
): number | null {
  const parsed =
    Math.floor(
      Number(
        value ||
          0
      )
    );

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function getCallbackOpenAiClient():
  OpenAI | null {
  if (
    callbackOpenAiClient !==
    undefined
  ) {
    return callbackOpenAiClient;
  }

  const apiKey =
    normalizeText(
      process.env.OPENAI_API_KEY
    );

  if (
    !apiKey
  ) {
    callbackOpenAiClient =
      null;

    return null;
  }

  callbackOpenAiClient =
    new OpenAI({
      apiKey,
    });

  return callbackOpenAiClient;
}

function getCallbackModel():
  string {
  return (
    normalizeText(
      process.env
        .OPENAI_KAKAO_CALLBACK_MODEL
    ) ||
    normalizeText(
      process.env
        .OPENAI_KAKAO_INTENT_MODEL
    ) ||
    normalizeText(
      process.env
        .OPENAI_AI_MODEL
    ) ||
    "gpt-5.4-mini"
  );
}

/**
 * 서버 현재시간을
 * 한국시간 기준 문자열로 만든다.
 *
 * AI가 "오늘"의 날짜를 임의로 만들지 않고,
 * 해석 참고용 기준시각을 서버가 제공한다.
 */
function getKoreaCurrentDateTimeText():
  string {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      weekday:
        "long",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false,
    }
  ).format(
    new Date()
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
      -12
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

const CALLBACK_SCHEMA = {
  type:
    "object",

  additionalProperties:
    false,

  properties: {
    wantsCallback: {
      type:
        "boolean",
    },

    preferredDateText: {
      type: [
        "string",
        "null",
      ],
    },

    preferredTimeText: {
      type: [
        "string",
        "null",
      ],
    },

    summary: {
      type: [
        "string",
        "null",
      ],
    },
  },

  required: [
    "wantsCallback",
    "preferredDateText",
    "preferredTimeText",
    "summary",
  ],
} as const;

const CALLBACK_EXTRACTION_INSTRUCTIONS = `
너는 EduCanvas 카카오 AI의 전화상담 희망정보 추출기다.

고객에게 직접 답변하지 않는다.

현재 메시지와 최근 Conversation History를 보고
고객이 담당자의 전화상담/콜백을 실제로 원하는지,
그리고 고객이 직접 말한 희망 날짜와 시간 표현을 구조화한다.

중요 원칙:

1. 사용자의 자연어 의미를 이해한다.
정확히 "예약", "콜백", "전화상담"이라는 단어가 없어도 된다.

예:
- 오늘 세시쯤 연락주세요
- 담당자분이 내일 전화 가능할까요
- 퇴근하고 7시 이후에 통화하고 싶어요
- 금요일 오전이면 괜찮아요

2. 단순히 전화라는 단어가 등장했다고 callback으로 판단하지 않는다.

예:
- 담당자 전화번호가 뭐예요?
- 전화번호 적어야 하나요?

이런 문장은 callback 요청이 아니다.

3. preferredDateText와 preferredTimeText에는
사용자가 실제로 말한 의미를 보존한다.

4. 현재 서버 한국시간은 참고정보로 제공되지만,
사용자가 말하지 않은 날짜나 시간을 새로 만들어내지 않는다.

5. "오늘", "내일", "금요일" 같은 상대 표현을
억지로 절대날짜 문자열로 변환하지 않는다.
원문 의미 그대로 구조화한다.

6. 날짜만 있고 시간이 없으면
preferredTimeText=null.

7. 시간만 있고 날짜가 없으면
preferredDateText=null.

8. summary는 담당자가 CRM에서 바로 이해할 수 있도록
한 문장으로 짧게 작성한다.

예:
"오늘 오후 3시경 전화상담 희망"

9. 실제 예약이 확정되었다고 판단하지 않는다.
이 기능은 고객의 통화 희망내용을 기록하기 위한 것이다.

10. JSON 구조 이외의 텍스트는 반환하지 않는다.
`.trim();

async function extractCallbackRequest(
  params: {
    message: string;

    conversationHistory:
      KakaoAiConversationMessage[];
  }
): Promise<CallbackExtractionResult> {
  const openai =
    getCallbackOpenAiClient();

  if (
    !openai
  ) {
    return {
      wantsCallback:
        false,

      preferredDateText:
        null,

      preferredTimeText:
        null,

      summary:
        null,
    };
  }

  const model =
    getCallbackModel();

  const response =
    await openai.responses.create({
      model,

      store:
        false,

      instructions:
        CALLBACK_EXTRACTION_INSTRUCTIONS,

      input:
        JSON.stringify({
          serverKoreaDateTime:
            getKoreaCurrentDateTimeText(),

          currentMessage:
            normalizeText(
              params.message
            ),

          conversationHistory:
            normalizeConversationHistory(
              params.conversationHistory
            ),
        }),

      text: {
        format: {
          type:
            "json_schema",

          name:
            "kakao_ai_callback_request",

          strict:
            true,

          schema:
            CALLBACK_SCHEMA,
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
      wantsCallback:
        false,

      preferredDateText:
        null,

      preferredTimeText:
        null,

      summary:
        null,
    };
  }

  const parsed =
    JSON.parse(
      outputText
    ) as
      Record<
        string,
        unknown
      >;

  return {
    wantsCallback:
      parsed.wantsCallback ===
      true,

    preferredDateText:
      normalizeText(
        parsed.preferredDateText
      ) ||
      null,

    preferredTimeText:
      normalizeText(
        parsed.preferredTimeText
      ) ||
      null,

    summary:
      normalizeText(
        parsed.summary
      ) ||
      null,
  };
}

function buildCallbackNote(
  params: {
    preferredDateText:
      string | null;

    preferredTimeText:
      string | null;

    summary:
      string | null;
  }
): string {
  const lines:
    string[] =
    [];

  lines.push(
    "[카카오 AI 전화상담 요청]"
  );

  if (
    params.preferredDateText
  ) {
    lines.push(
      `통화 희망일: ${params.preferredDateText}`
    );
  }

  if (
    params.preferredTimeText
  ) {
    lines.push(
      `통화 희망시간: ${params.preferredTimeText}`
    );
  }

  if (
    params.summary
  ) {
    lines.push(
      `요청내용: ${params.summary}`
    );
  }

  lines.push(
    `접수시간: ${getKoreaCurrentDateTimeText()}`
  );

  return lines.join(
    "\n"
  );
}

export async function executeKakaoAiCallbackRequestAction(
  params: {
    organizationId:
      number;

    conversationId:
      number;

    customerType:
      KakaoAiCustomerType;

    message:
      string;

    allowedCapabilities:
      KakaoAiCapability[];

    conversationHistory:
      KakaoAiConversationMessage[];

    /**
     * 같은 메시지에서 상담DB가 새로 생성된 경우
     * Lead Registration 결과의 consultationId를 우선 사용한다.
     */
    consultationId?:
      number |
      null;
  }
): Promise<KakaoAiCallbackRequestActionResult> {
  const organizationId =
    normalizePositiveInteger(
      params.organizationId
    );

  const conversationId =
    normalizePositiveInteger(
      params.conversationId
    );

  if (
    !organizationId ||
    !conversationId
  ) {
    return {
      handled:
        true,

      saved:
        false,

      consultationId:
        null,

      preferredDateText:
        null,

      preferredTimeText:
        null,

      reason:
        "SAVE_FAILED",

      replyText:
        "전화상담 요청을 저장하는 중 문제가 발생했습니다. 잠시 후 다시 말씀해주세요.",
    };
  }

  /**
   * 신규상담 Callback Action.
   *
   * 등록회원의 담당자 연락기능은
   * 추후 등록자 전용 Action에서 별도로 처리한다.
   */
  if (
    params.customerType !==
    "lead"
  ) {
    return {
      handled:
        false,

      saved:
        false,

      consultationId:
        null,

      preferredDateText:
        null,

      preferredTimeText:
        null,

      reason:
        "NOT_LEAD",

      replyText:
        null,
    };
  }

  const allowedCapabilities =
    Array.isArray(
      params.allowedCapabilities
    )
      ? params.allowedCapabilities
      : [];

  if (
    !allowedCapabilities.includes(
      "callback_request"
    )
  ) {
    return {
      handled:
        false,

      saved:
        false,

      consultationId:
        null,

      preferredDateText:
        null,

      preferredTimeText:
        null,

      reason:
        "NOT_REQUESTED",

      replyText:
        null,
    };
  }

  let callbackExtraction:
    CallbackExtractionResult;

  try {
    callbackExtraction =
      await extractCallbackRequest({
        message:
          params.message,

        conversationHistory:
          params.conversationHistory,
      });
  } catch (
    error:
      unknown
  ) {
    console.error(
      "[KAKAO AI] Callback extraction failed",
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
      handled:
        true,

      saved:
        false,

      consultationId:
        null,

      preferredDateText:
        null,

      preferredTimeText:
        null,

      reason:
        "SAVE_FAILED",

      replyText:
        "통화 희망내용을 확인하는 중 문제가 발생했습니다. 잠시 후 다시 말씀해주세요.",
    };
  }

  if (
    !callbackExtraction
      .wantsCallback
  ) {
    return {
      handled:
        false,

      saved:
        false,

      consultationId:
        null,

      preferredDateText:
        null,

      preferredTimeText:
        null,

      reason:
        "NOT_REQUESTED",

      replyText:
        null,
    };
  }

  /**
   * 날짜와 시간이 모두 없어도
   * callback 의도 자체는 확인된 상태다.
   *
   * 고객에게 다시 희망시간을 물어본다.
   */
  if (
    !callbackExtraction
      .preferredDateText &&
    !callbackExtraction
      .preferredTimeText
  ) {
    return {
      handled:
        true,

      saved:
        false,

      consultationId:
        null,

      preferredDateText:
        null,

      preferredTimeText:
        null,

      reason:
        "DATE_TIME_NOT_FOUND",

      replyText:
        "네, 전화상담 요청 도와드릴게요 :) 통화하시기 편한 날짜와 시간을 말씀해주세요.",
    };
  }

  /**
   * 같은 메시지에서 Lead Registration이
   * 방금 상담DB를 생성했다면 그 ID를 우선 사용한다.
   */
  let consultationId =
    normalizePositiveInteger(
      params.consultationId
    );

  /**
   * 이미 이전 메시지에서 상담DB가 생성되어 있다면
   * Conversation에 연결된 consultationId를 사용한다.
   */
  if (
    !consultationId
  ) {
    const conversation =
      await db.getKakaoAiConversationById({
        organizationId,

        conversationId,
      });

    consultationId =
      normalizePositiveInteger(
        (conversation as any)
          ?.consultationId
      );
  }

  if (
    !consultationId
  ) {
    return {
      handled:
        true,

      saved:
        false,

      consultationId:
        null,

      preferredDateText:
        callbackExtraction
          .preferredDateText,

      preferredTimeText:
        callbackExtraction
          .preferredTimeText,

      reason:
        "CONSULTATION_NOT_LINKED",

      replyText:
        [
          "전화상담 희망내용은 확인했어요.",
          "담당자 상담 접수를 먼저 완료하려면 성함과 연락처를 보내주세요 :)",
        ].join(
          "\n"
        ),
    };
  }

  const consultation =
    await db.getConsultation(
      consultationId,
      {
        organizationId,
      } as any
    );

  if (
    !consultation
  ) {
    return {
      handled:
        true,

      saved:
        false,

      consultationId,

      preferredDateText:
        callbackExtraction
          .preferredDateText,

      preferredTimeText:
        callbackExtraction
          .preferredTimeText,

      reason:
        "CONSULTATION_NOT_FOUND",

      replyText:
        "상담 접수정보를 다시 확인해야 합니다. 잠시 후 다시 말씀해주세요.",
    };
  }

  const previousNotes =
    normalizeText(
      (consultation as any)
        .notes
    );

  const callbackNote =
    buildCallbackNote({
      preferredDateText:
        callbackExtraction
          .preferredDateText,

      preferredTimeText:
        callbackExtraction
          .preferredTimeText,

      summary:
        callbackExtraction
          .summary,
    });

  /**
   * 기존 AI 상담요약을 지우지 않고
   * 아래에 Callback 기록을 추가한다.
   */
  const nextNotes =
    [
      previousNotes,
      callbackNote,
    ]
      .filter(
        Boolean
      )
      .join(
        "\n\n"
      )
      .slice(
        0,
        5000
      );

  try {
    await db.updateConsultation(
      consultationId,
      {
        notes:
          nextNotes,
      } as any,
      {
        organizationId,
      } as any
    );
  } catch (
    error:
      unknown
  ) {
    console.error(
      "[KAKAO AI] Callback save failed",
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
      handled:
        true,

      saved:
        false,

      consultationId,

      preferredDateText:
        callbackExtraction
          .preferredDateText,

      preferredTimeText:
        callbackExtraction
          .preferredTimeText,

      reason:
        "SAVE_FAILED",

      replyText:
        "통화 희망내용을 저장하는 중 문제가 발생했습니다. 잠시 후 다시 말씀해주세요.",
    };
  }

  console.log(
    "[KAKAO AI TRACE] CallbackRequestSaved",
    {
      organizationId,

      conversationId,

      consultationId,

      preferredDateText:
        callbackExtraction
          .preferredDateText,

      preferredTimeText:
        callbackExtraction
          .preferredTimeText,
    }
  );

  const preferenceText =
    [
      callbackExtraction
        .preferredDateText,

      callbackExtraction
        .preferredTimeText,
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      );

  return {
    handled:
      true,

    saved:
      true,

    consultationId,

    preferredDateText:
      callbackExtraction
        .preferredDateText,

    preferredTimeText:
      callbackExtraction
        .preferredTimeText,

    reason:
      null,

    replyText:
      preferenceText
        ? `${preferenceText} 통화를 희망하신 내용까지 담당자에게 전달해드렸어요 :)`
        : "전화상담 희망내용을 담당자에게 전달해드렸어요 :)",
  };
}