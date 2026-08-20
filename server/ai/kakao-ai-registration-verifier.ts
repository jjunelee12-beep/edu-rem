import OpenAI from "openai";

import * as db from "../db";

import {
  AppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

import {
  verifyKakaoAiRegisteredCustomer,
  type KakaoAiCustomerContext,
} from "./kakao-ai-customer-resolver";

import type {
  KakaoAiConversationMessage,
} from "./kakao-ai-intent-router";

/**
 * 카카오 AI 등록회원 최초 1회 인증.
 *
 * 역할:
 *
 * 현재 사용자 메시지
 * + 직전 대화
 * ↓
 * 등록회원 인증 의도 확인
 * ↓
 * 이름 + 연락처가 모두 명확히 있는지 확인
 * ↓
 * 서버 CRM 인증
 * ↓
 * 성공 시 Conversation ↔ studentId 연결
 *
 * 중요:
 *
 * - 학생 ID를 사용자에게 받지 않는다.
 * - 이름/연락처를 AI Memory에 저장하지 않는다.
 * - 모델이 registered 권한을 직접 부여하지 않는다.
 * - 최종 권한은 verifyKakaoAiRegisteredCustomer()
 *   결과로만 확정한다.
 */

export type KakaoAiRegistrationVerificationStatus =
  | "not_requested"
  | "credentials_required"
  | "verified"
  | "not_found"
  | "duplicate";

export type KakaoAiRegistrationVerificationResult = {
  status:
    KakaoAiRegistrationVerificationStatus;

  /**
   * 인증 흐름을 이번 메시지에서
   * 별도로 처리해야 하는지.
   */
  handled:
    boolean;

  /**
   * 성공한 경우의 서버 확정 고객 Context.
   */
  customer:
    KakaoAiCustomerContext | null;

  /**
   * 인증단계에서 고객에게 바로 전송할 답변.
   *
   * null이면 일반 Orchestrator를 계속 진행한다.
   */
  replyText:
    string | null;

  /**
   * 모델 추출 결과 추적용.
   */
  openAiResponseId:
    string | null;

  model:
    string | null;

  fallbackUsed:
    boolean;

  errorMessage:
    string | null;
};

type KakaoAiRegistrationCredentialExtraction = {
  wantsRegisteredVerification:
    boolean;

  /**
   * 직전 AI가 등록회원 인증을 위해
   * 이름/연락처를 요청한 상태인지.
   */
  respondingToVerificationRequest:
    boolean;

  clientName:
    string | null;

  phone:
    string | null;

  hasCompleteCredentials:
    boolean;
};

let kakaoRegistrationOpenAiClient:
  OpenAI | null | undefined;

function getKakaoRegistrationOpenAiClient():
  OpenAI | null {
  if (
    kakaoRegistrationOpenAiClient !==
    undefined
  ) {
    return kakaoRegistrationOpenAiClient;
  }

  const apiKey =
    String(
      process.env.OPENAI_API_KEY ||
      ""
    ).trim();

  if (
    !apiKey
  ) {
    kakaoRegistrationOpenAiClient =
      null;

    return null;
  }

  kakaoRegistrationOpenAiClient =
    new OpenAI({
      apiKey,
    });

  return kakaoRegistrationOpenAiClient;
}

function getKakaoRegistrationModel():
  string {
  return (
    String(
      process.env
        .OPENAI_KAKAO_VERIFICATION_MODEL ||
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

function normalizePhone(
  value:
    unknown
): string | null {
  const normalized =
    String(
      value ??
      ""
    )
      .replace(
        /\D/g,
        ""
      )
      .trim();

  if (
    normalized.length <
      10 ||
    normalized.length >
      11
  ) {
    return null;
  }

  return normalized;
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
      -6
    )
    .map(
      (
        item
      ) => ({
        role:
          item.role,

        content:
          normalizeText(
            item.content
          ),
      })
    )
    .filter(
      (
        item
      ) =>
        Boolean(
          item.content
        )
    );
}

/**
 * 등록회원 인증 OpenAI를 호출하기 전
 * 서버에서 수행하는 빠른 Gate.
 *
 * 목적:
 *
 * 일반 신규상담 메시지마다
 * 등록회원 인증용 OpenAI를 추가 호출하지 않는다.
 *
 * 아래 두 경우만 인증 추출 AI를 실행한다.
 *
 * 1. 현재 메시지가 등록회원/기존회원 인증을
 *    명시적으로 이야기하는 경우
 *
 * 2. 직전 AI가 성함 + 연락처를 요청했고
 *    사용자가 그 요청에 답하는 흐름인 경우
 */
function shouldRunRegistrationVerification(
  params: {
    message:
      string;

    conversationHistory:
      KakaoAiConversationMessage[];
  }
): boolean {
  const message =
    normalizeText(
      params.message
    );

  if (
    !message
  ) {
    return false;
  }

  /**
   * 현재 사용자가 직접
   * 등록회원임을 밝히는 대표적인 표현.
   *
   * 여기서는 최종 Intent를 판정하는 게 아니다.
   * 단지 인증 Extractor를 호출할 필요가 있는지
   * 넓게 거르는 Gate다.
   */
  const registrationKeywords = [
    "등록회원",
    "등록 회원",
    "기존회원",
    "기존 회원",
    "수강생",
    "등록했",
    "등록한 사람",
    "등록한사람",
    "수강 중",
    "수강중",
    "회원인데",
    "회원 인데",
    "등록자인데",
    "등록자 인데",
  ];

  if (
    registrationKeywords.some(
      (
        keyword
      ) =>
        message.includes(
          keyword
        )
    )
  ) {
    return true;
  }

  /**
   * 직전 AI가 이미 인증정보를 요청한 경우.
   *
   * 사용자의 다음 메시지가:
   *
   * "홍길동 010-1234-5678"
   *
   * 처럼 등록회원이라는 단어를
   * 다시 포함하지 않아도 인증 흐름을 이어간다.
   */
  const history =
    normalizeConversationHistory(
      params.conversationHistory
    );

  const lastAssistantMessage =
    [
      ...history,
    ]
      .reverse()
      .find(
        (
          item
        ) =>
          item.role ===
          "assistant"
      );

  if (
    !lastAssistantMessage
  ) {
    return false;
  }

  const assistantText =
    normalizeText(
      lastAssistantMessage.content
    );

  const verificationRequestSignals = [
  "등록회원 확인",
  "성함과 등록하신 연락처",
  "등록하신 연락처",
  "회원 확인을 위해",
];

  return verificationRequestSignals.some(
    (
      signal
    ) =>
      assistantText.includes(
        signal
      )
  );
}

const KAKAO_AI_REGISTRATION_VERIFICATION_SCHEMA = {
  type:
    "object",

  additionalProperties:
    false,

  properties: {
    wantsRegisteredVerification: {
      type:
        "boolean",
    },

    respondingToVerificationRequest: {
      type:
        "boolean",
    },

    clientName: {
      anyOf: [
        {
          type:
            "string",
        },
        {
          type:
            "null",
        },
      ],
    },

    phone: {
      anyOf: [
        {
          type:
            "string",
        },
        {
          type:
            "null",
        },
      ],
    },

    hasCompleteCredentials: {
      type:
        "boolean",
    },
  },

  required: [
    "wantsRegisteredVerification",
    "respondingToVerificationRequest",
    "clientName",
    "phone",
    "hasCompleteCredentials",
  ],
} as const;

const KAKAO_AI_REGISTRATION_VERIFICATION_INSTRUCTIONS = `
너는 EduCanvas 카카오 AI의 등록회원 최초 인증 정보 추출기다.

사용자에게 답변하지 않는다.

현재 사용자 메시지와 최근 대화를 보고
"등록회원 인증을 진행하려는 상황인지"와
현재 메시지에서 명확히 제공된 이름/연락처만 추출한다.

규칙:

1. 사용자가 자신을 기존회원, 등록회원, 수강생,
등록한 사람 등으로 명확하게 표현하면
wantsRegisteredVerification=true로 판단할 수 있다.

2. 직전 AI가 등록회원 확인을 위해
성함과 연락처를 요청했고,
현재 사용자가 그 정보에 답하는 상황이면
respondingToVerificationRequest=true로 한다.

3. 단순히 상담문의용으로 이름이나 연락처를 말한 것만으로
등록회원 인증 의도로 판단하지 않는다.

4. clientName은 현재 사용자 메시지에서
본인의 이름으로 명확하게 제공된 경우만 추출한다.

5. phone은 현재 사용자 메시지에서
본인의 연락처로 명확하게 제공된 경우만 추출한다.

6. 이전 대화에 있던 이름이나 전화번호를
현재 메시지의 인증정보인 것처럼 가져오지 않는다.

7. clientName과 phone이 현재 메시지에 모두 명확히 있으면
hasCompleteCredentials=true다.

8. 둘 중 하나라도 없거나 불확실하면
hasCompleteCredentials=false다.

9. 학생번호, 주민등록번호, 생년월일 등
추가 개인정보를 요구하거나 추출하지 않는다.

10. 모델은 인증 성공/실패를 판단하지 않는다.
실제 등록회원 여부는 서버 CRM이 판정한다.

반환은 지정된 JSON만 사용한다.
`.trim();

async function extractRegistrationCredentials(
  params: {
    message:
      string;

    conversationHistory:
      KakaoAiConversationMessage[];
  }
): Promise<{
  extraction:
    KakaoAiRegistrationCredentialExtraction;

  openAiResponseId:
    string | null;

  model:
    string | null;

  fallbackUsed:
    boolean;

  errorMessage:
    string | null;
}> {
  const message =
    normalizeText(
      params.message
    );

  const empty:
    KakaoAiRegistrationCredentialExtraction = {
      wantsRegisteredVerification:
        false,

      respondingToVerificationRequest:
        false,

      clientName:
        null,

      phone:
        null,

      hasCompleteCredentials:
        false,
    };

  if (
    !message
  ) {
    return {
      extraction:
        empty,

      openAiResponseId:
        null,

      model:
        null,

      fallbackUsed:
        false,

      errorMessage:
        null,
    };
  }

  const openai =
    getKakaoRegistrationOpenAiClient();

  if (
    !openai
  ) {
    return {
      extraction:
        empty,

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
    getKakaoRegistrationModel();

  try {
    const response =
      await openai.responses.create({
        model,

        store:
          false,

        instructions:
          KAKAO_AI_REGISTRATION_VERIFICATION_INSTRUCTIONS,

        input:
          JSON.stringify({
            currentMessage:
              message,

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
              "kakao_ai_registration_verification",

            strict:
              true,

            schema:
              KAKAO_AI_REGISTRATION_VERIFICATION_SCHEMA,
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
        extraction:
          empty,

        openAiResponseId:
          typeof response.id ===
            "string"
            ? response.id
            : null,

        model,

        fallbackUsed:
          true,

        errorMessage:
          "등록회원 인증정보 추출 응답이 비어 있습니다.",
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

    const clientName =
      normalizeText(
        parsed.clientName
      ) ||
      null;

    const phone =
      normalizePhone(
        parsed.phone
      );

    /**
     * 모델의 hasCompleteCredentials를
     * 그대로 믿지 않고 서버에서 재계산한다.
     */
    const hasCompleteCredentials =
      Boolean(
        clientName &&
        phone
      );

    return {
      extraction: {
        wantsRegisteredVerification:
          parsed
            .wantsRegisteredVerification ===
          true,

        respondingToVerificationRequest:
          parsed
            .respondingToVerificationRequest ===
          true,

        clientName,

        phone,

        hasCompleteCredentials,
      },

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
      "[KAKAO AI] 등록회원 인증정보 추출 실패",
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
      extraction:
        empty,

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

/**
 * 등록회원 최초 1회 인증을 시도한다.
 *
 * 이미 registered인 고객에게는 실행하지 않는다.
 */
export async function handleKakaoAiRegistrationVerification(
  params: {
    organizationId:
      number;

    conversationId:
      number;

    currentCustomer:
      KakaoAiCustomerContext;

    message:
      string;

    conversationHistory:
      KakaoAiConversationMessage[];
  }
): Promise<KakaoAiRegistrationVerificationResult> {
  /**
   * 이미 인증 완료된 등록회원.
   */
  if (
    params.currentCustomer.customerType ===
      "registered" &&
    params.currentCustomer.verified ===
      true
  ) {
    return {
      status:
        "not_requested",

      handled:
        false,

      customer:
        params.currentCustomer,

      replyText:
        null,

      openAiResponseId:
        null,

      model:
        null,

      fallbackUsed:
        false,

      errorMessage:
        null,
    };
  }

  /**
   * 일반 신규상담 메시지에서는
   * 등록회원 인증용 OpenAI를 호출하지 않는다.
   */
  const shouldRunVerification =
    shouldRunRegistrationVerification({
      message:
        params.message,

      conversationHistory:
        params.conversationHistory,
    });

  if (
    !shouldRunVerification
  ) {
    return {
      status:
        "not_requested",

      handled:
        false,

      customer:
        params.currentCustomer,

      replyText:
        null,

      openAiResponseId:
        null,

      model:
        null,

      fallbackUsed:
        false,

      errorMessage:
        null,
    };
  }

  const extracted =
    await extractRegistrationCredentials({
      message:
        params.message,

      conversationHistory:
        params.conversationHistory,
    });

  const extraction =
    extracted.extraction;

  const verificationFlowRequested =
    extraction
      .wantsRegisteredVerification ||
    extraction
      .respondingToVerificationRequest;

  /**
   * 일반 신규상담 메시지.
   *
   * 인증 흐름과 관계없으면
   * 기존 Intent / Composer가 그대로 처리한다.
   */
  if (
    !verificationFlowRequested
  ) {
    return {
      status:
        "not_requested",

      handled:
        false,

      customer:
        params.currentCustomer,

      replyText:
        null,

      openAiResponseId:
        extracted.openAiResponseId,

      model:
        extracted.model,

      fallbackUsed:
        extracted.fallbackUsed,

      errorMessage:
        extracted.errorMessage,
    };
  }

  /**
   * 등록회원이라고 했지만
   * 이름 + 연락처가 둘 다 없는 경우.
   *
   * 부분 개인정보를 별도 Memory에 저장하지 않고
   * 한 메시지에 함께 받는다.
   */
  if (
    !extraction
      .hasCompleteCredentials ||
    !extraction.clientName ||
    !extraction.phone
  ) {
    return {
      status:
        "credentials_required",

      handled:
        true,

      customer:
        params.currentCustomer,

      replyText:
        "등록회원 확인을 위해 성함과 등록하신 연락처를 함께 보내주세요. 확인 후 등록회원 전용 기능을 바로 이용하실 수 있어요.",

      openAiResponseId:
        extracted.openAiResponseId,

      model:
        extracted.model,

      fallbackUsed:
        extracted.fallbackUsed,

      errorMessage:
        extracted.errorMessage,
    };
  }

  /**
   * 실제 CRM 인증.
   *
   * 여기서만 registered 여부가 확정된다.
   */
  const verifiedCustomer =
    await verifyKakaoAiRegisteredCustomer({
      organizationId:
        params.organizationId,

      clientName:
        extraction.clientName,

      phone:
        extraction.phone,
    });

  if (
    verifiedCustomer.customerType !==
      "registered" ||
    verifiedCustomer.verified !==
      true ||
    verifiedCustomer.verificationStatus !==
      "registered" ||
    !verifiedCustomer.studentId
  ) {
    if (
      verifiedCustomer
        .verificationStatus ===
      "duplicate"
    ) {
      return {
        status:
          "duplicate",

        handled:
          true,

        customer:
          params.currentCustomer,

        replyText:
          "동일한 회원정보가 여러 건 확인되어 자동 인증이 어렵습니다. 담당자 확인이 필요한 상태예요.",

        openAiResponseId:
          extracted.openAiResponseId,

        model:
          extracted.model,

        fallbackUsed:
          extracted.fallbackUsed,

        errorMessage:
          null,
      };
    }

    return {
      status:
        "not_found",

      handled:
        true,

      customer:
        params.currentCustomer,

      replyText:
        "보내주신 정보로 등록회원 확인이 되지 않았어요. 등록하실 때 사용한 성함과 연락처가 맞는지 확인해서 다시 보내주세요.",

      openAiResponseId:
        extracted.openAiResponseId,

      model:
        extracted.model,

      fallbackUsed:
        extracted.fallbackUsed,

      errorMessage:
        null,
    };
  }

    /**
   * 인증 성공.
   *
   * 카카오 대화방에
   * 서버가 확정한 studentId만 연결한다.
   *
   * 중요:
   * 같은 학생이 이미 다른 카카오 계정에
   * 연결되어 있으면 서버 오류로 끝내지 않고
   * 사용자에게 정상 안내 메시지를 반환한다.
   */
  try {
    await db.bindKakaoAiConversationStudent({
      organizationId:
        params.organizationId,

      conversationId:
        params.conversationId,

      studentId:
        verifiedCustomer.studentId,
    });
  } catch (
    error:
      unknown
  ) {
    if (
      error instanceof
        AppError &&
      (
        error.code ===
          ERROR_CODES.CONFLICT ||
        error.status ===
          409
      )
    ) {
      return {
        status:
          "duplicate",

        handled:
          true,

        customer:
          params.currentCustomer,

        replyText:
          "해당 회원정보는 이미 다른 카카오 계정에 연결되어 있습니다. 계정 변경이 필요한 경우 담당자에게 문의해주세요.",

        openAiResponseId:
          extracted.openAiResponseId,

        model:
          extracted.model,

        fallbackUsed:
          extracted.fallbackUsed,

        errorMessage:
          null,
      };
    }

    throw error;
  }

  return {
    status:
      "verified",

    handled:
      true,

    customer:
      verifiedCustomer,

    replyText:
      verifiedCustomer.studentName
        ? `${verifiedCustomer.studentName}님, 등록회원 확인이 완료됐어요. 이제 학점·과목·학기 일정, 위험도, 실습 등 등록회원 전용 기능을 이용하실 수 있어요.`
        : "등록회원 확인이 완료됐어요. 이제 학점·과목·학기 일정, 위험도, 실습 등 등록회원 전용 기능을 이용하실 수 있어요.",

    openAiResponseId:
      extracted.openAiResponseId,

    model:
      extracted.model,

    fallbackUsed:
      extracted.fallbackUsed,

    errorMessage:
      null,
  };
}