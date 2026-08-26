import OpenAI from "openai";

/**
 * 카카오 AI가 실제 공용엔진에 들어가기 전에
 * 현재 메시지를 어떤 방식으로 처리할지
 * 빠르게 결정하는 Pre-Router.
 *
 * 중요:
 *
 * 이 Router는
 * - 학점 계산 X
 * - 자격요건 판단 X
 * - CRM 학생 조회 X
 * - 위험도 분석 X
 * - 행정절차 판단 X
 * - 실제 상담 답변 생성 X
 *
 * 오직:
 *
 * immediate
 *   → 바로 자연어 답변해도 되는 가벼운 대화
 *
 * analysis
 *   → 기존 공용엔진의 분석 / 조회 / 계산이 필요한 요청
 *
 * 둘 중 하나만 결정한다.
 */

export type KakaoAiPreRouteMode =
  | "immediate"
  | "analysis";

export type KakaoAiImmediateKind =
  | "greeting"
  | "thanks"
  | "acknowledgement"
  | "company_general"
  | "light_conversation"
  | null;

export type KakaoAiPreRouteDecision = {
  mode:
    KakaoAiPreRouteMode;

  immediateKind:
    KakaoAiImmediateKind;

  /**
   * 내부 추적용.
   * 고객에게 그대로 출력하지 않는다.
   */
  reason:
    string;

  /**
   * immediate 응답에서
   * 회사별 Kakao AI Context가 필요한지.
   */
  requiresCompanyContext:
    boolean;

  /**
   * 분석형 요청에서 고객에게
   * 대기안내를 먼저 보여줘야 하는지.
   */
  shouldShowWaitingMessage:
    boolean;

  confidence:
    number;
};

export type KakaoAiPreRouteResult = {
  success:
    boolean;

  decision:
    KakaoAiPreRouteDecision;

  openAiResponseId:
    string | null;

  model:
    string | null;

  fallbackUsed:
    boolean;

  errorMessage:
    string | null;
};

let kakaoAiPreRouterOpenAiClient:
  OpenAI | null | undefined;

function getKakaoAiPreRouterOpenAiClient():
  OpenAI | null {
  if (
    kakaoAiPreRouterOpenAiClient !==
    undefined
  ) {
    return kakaoAiPreRouterOpenAiClient;
  }

  const apiKey =
    String(
      process.env.OPENAI_API_KEY ||
      ""
    ).trim();

  if (
    !apiKey
  ) {
    kakaoAiPreRouterOpenAiClient =
      null;

    return null;
  }

  kakaoAiPreRouterOpenAiClient =
    new OpenAI({
      apiKey,
    });

  return kakaoAiPreRouterOpenAiClient;
}

function getKakaoAiPreRouterModel():
  string {
  return (
    String(
      process.env
        .OPENAI_KAKAO_PRE_ROUTER_MODEL ||
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

function normalizeConfidence(
  value:
    unknown
): number {
  const parsed =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      1,
      parsed
    )
  );
}

/**
 * AI 호출조차 필요 없는
 * 명백한 빈 메시지 처리.
 */
function buildSafeAnalysisDecision(
  reason:
    string
): KakaoAiPreRouteDecision {
  return {
    mode:
      "analysis",

    immediateKind:
      null,

    reason,

    requiresCompanyContext:
      false,

    shouldShowWaitingMessage:
      true,

    confidence:
      1,
  };
}

const KAKAO_AI_PRE_ROUTER_INSTRUCTIONS = `
너는 카카오톡 상담 AI의 초고속 Pre-Router다.

너의 역할은 사용자의 질문에 답변하는 것이 아니다.

현재 메시지를 아래 두 가지 처리방식 중
정확히 하나로 분류해야 한다.

1. immediate

공용 학점은행제 분석엔진,
CRM 학생조회,
위험도 분석,
학점 계산,
자격요건 계산,
전적대 분석,
OCR,
실습기관 조회,
행정상태 조회 등이
전혀 필요하지 않은 가벼운 대화.

대표적인 예:

- 인사
- 감사
- 단순 확인
- 가벼운 일상적인 대화
- 회사가 어디인지
- 회사가 어떤 곳인지
- 회사의 기본적인 소개

immediate에서도
실제 최종 문장은 다른 AI가 생성한다.

너는 답변 문장을 생성하지 않는다.


2. analysis

조금이라도 실제 상담 판단,
조회, 계산, 확인, 권한검사,
학습설계 또는 공용엔진이 필요한 요청.

다음은 반드시 analysis다.

- 사회복지사 / 보육교사 / 한국어교원 등
  자격증 취득 상담
- 취득기간
- 필요한 과목
- 학점
- 학기
- 실습시간
- 학습설계
- 최종학력 기반 계산
- 전적대
- 성적증명서
- OCR
- 인정과목
- 학위
- 학점은행제 제도판단
- 행정절차
- 수업관리
- 실습진행
- 실습기관
- 비용 계산 또는 개인별 비용
- 개인별 일정
- 등록회원 정보
- 등록회원 인증
- 학생 CRM 조회
- 내 담당자
- 내 수강과목
- 내 학기
- 내 학습설계
- 내 위험도
- 행정상태
- 자격요건
- 중복과목
- 부족학점
- 부족과목
- 첨부자료 분석
- 이미지 또는 문서 확인
- 여러 질문이 섞여 있는 메시지
- 사용자의 의도가 애매하여
  추가 분석이 필요한 메시지

매우 중요한 후속발화 문맥 규칙:

현재 메시지가 짧은 동의 또는 후속 표현이라고 해서
무조건 immediate / acknowledgement로 처리하지 않는다.

예:

- "네"
- "응"
- "ㅇㅇ"
- "그래"
- "그래요"
- "좋아요"
- "해주세요"
- "해줘"
- "알려주세요"
- "설명해주세요"
- "그렇게 해주세요"
- "이어가"
- "이어서"
- "ㄱㄱ"

이런 표현은 반드시 previousAssistantMessage를 함께 확인한다.

previousAssistantMessage에서 직전 AI가
아래와 같은 상담 행동을 제안한 상태라면
현재 짧은 후속발화는 반드시 analysis다.

예:

- 과정 설명을 더 해주겠다는 제안
- 필요한 과목을 알려주겠다는 제안
- 인정과목 / 남은과목을 알려주겠다는 제안
- 취득기간 / 예상일을 계산하겠다는 제안
- 이론수업을 설명하겠다는 제안
- 실습을 설명하겠다는 제안
- 행정절차를 설명하겠다는 제안
- 성적증명서 / 서류를 분석하겠다는 제안
- 부족한 정보를 확인하겠다는 제안
- 등록 혜택을 설명하겠다는 제안
- 담당자를 추천 / 선택 / 연결하겠다는 제안
- 상담접수를 진행하겠다는 제안
- 콜백 / 전화상담을 연결하겠다는 제안

예시:

previousAssistantMessage:
"실습 진행방법도 안내드릴까요?"

currentMessage:
"네"

→ analysis


previousAssistantMessage:
"남은 과목도 이어서 정리해드릴까요?"

currentMessage:
"ㅇㅇ"

→ analysis


previousAssistantMessage:
"담당자 추천도 도와드릴까요?"

currentMessage:
"좋아요"

→ analysis


previousAssistantMessage:
"상담 접수까지 진행해드릴까요?"

currentMessage:
"ㄱㄱ"

→ analysis


반대로 previousAssistantMessage에
이어갈 상담 행동이나 제안이 전혀 없고,
현재 메시지도 정말 단순한 확인/감사/인사로만
해석 가능한 경우에만 acknowledgement immediate를 허용한다.

previousAssistantMessage가 존재하는데
현재 짧은 후속발화가 직전 문맥과 이어질 가능성이 있다면
애매하게 immediate로 보내지 말고 analysis로 보낸다.

중요한 안전 원칙:

애매하면 반드시 analysis로 분류한다.

immediate는
"분석이나 조회가 절대로 필요하지 않다"
고 확신할 수 있을 때만 사용한다.

사용자가 등록회원인지 신규회원인지
추측하지 않는다.

사용자의 학점, 자격조건,
학습설계 결과를 판단하지 않는다.

회사별 실제 정보도 추측하지 않는다.

company_general은
회사 소개처럼 회사 Context만 읽어서
답할 수 있는 질문에만 사용한다.

출력은 반드시 JSON Schema를 따른다.
`;

const KAKAO_AI_PRE_ROUTER_SCHEMA = {
  type:
    "object",

  additionalProperties:
    false,

  properties: {
    mode: {
      type:
        "string",

      enum: [
        "immediate",
        "analysis",
      ],
    },

    immediateKind: {
      anyOf: [
        {
          type:
            "string",

          enum: [
            "greeting",
            "thanks",
            "acknowledgement",
            "company_general",
            "light_conversation",
          ],
        },

        {
          type:
            "null",
        },
      ],
    },

    reason: {
      type:
        "string",
    },

    requiresCompanyContext: {
      type:
        "boolean",
    },

    shouldShowWaitingMessage: {
      type:
        "boolean",
    },

    confidence: {
      type:
        "number",

      minimum:
        0,

      maximum:
        1,
    },
  },

  required: [
    "mode",
    "immediateKind",
    "reason",
    "requiresCompanyContext",
    "shouldShowWaitingMessage",
    "confidence",
  ],
} as const;

export async function routeKakaoAiPreMessage(
  params: {
    message: string;

    hasImage?: boolean;

    hasDocument?: boolean;

    previousAssistantMessage?: string | null;
  }
): Promise<KakaoAiPreRouteResult> {
  const message =
    normalizeText(
      params.message
    );

  /**
   * 첨부자료가 있으면
   * 무조건 분석형.
   */
  if (
    params.hasImage ===
      true ||
    params.hasDocument ===
      true
  ) {
    return {
      success:
        true,

      decision:
        buildSafeAnalysisDecision(
          "첨부자료 분석이 필요한 요청입니다."
        ),

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
   * 빈 메시지도 immediate로
   * 잘못 보내지 않는다.
   */
  if (
    !message
  ) {
    return {
      success:
        true,

      decision:
        buildSafeAnalysisDecision(
          "사용자 메시지가 비어 있어 안전하게 분석형으로 처리합니다."
        ),

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
 * ---------------------------------------------------------
 * 시스템 명령어는 Pre-Router AI가 해석하지 않는다.
 * ---------------------------------------------------------
 *
 * /lead, /reset, /staff 등의 명령을
 * OpenAI에게 보내면 greeting / acknowledgement 등으로
 * 잘못 분류될 수 있다.
 *
 * 명령어는 반드시 기존 Kakao AI Command Router까지
 * 그대로 내려보낸다.
 *
 * waiting 메시지도 보내지 않는다.
 */
const isSystemCommand =
  /^\/(?:lead|reset|logout|member|staff|member-test|staff-test|test-reset)(?:\s|$)/i.test(
    message
  );

if (
  isSystemCommand
) {
  return {
    success:
      true,

    decision: {
      mode:
        "analysis",

      immediateKind:
        null,

      reason:
        "카카오 AI 시스템 명령어이므로 Pre-Router 자연어 분류를 건너뜁니다.",

      requiresCompanyContext:
        false,

      shouldShowWaitingMessage:
        false,

      confidence:
        1,
    },

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
    getKakaoAiPreRouterOpenAiClient();

  if (
    !openai
  ) {
    /**
     * Pre-Router 장애가 생겼다고 해서
     * 상담 요청을 immediate로 보내면 안 된다.
     *
     * 안전하게 기존 분석엔진으로 넘긴다.
     */
    return {
      success:
        false,

      decision:
        buildSafeAnalysisDecision(
          "Pre-Router AI를 사용할 수 없어 안전하게 분석형으로 처리합니다."
        ),

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
    getKakaoAiPreRouterModel();

  try {
    const response =
      await openai.responses.create({
        model,

        store:
          false,

        instructions:
          KAKAO_AI_PRE_ROUTER_INSTRUCTIONS,

        input:
  JSON.stringify({
    currentMessage:
      message,

    previousAssistantMessage:
      normalizeText(
        params.previousAssistantMessage
      ) || null,

    attachment: {
      hasImage:
        params.hasImage === true,

      hasDocument:
        params.hasDocument === true,
    },
  }),

        text: {
          format: {
            type:
              "json_schema",

            name:
              "kakao_ai_pre_router",

            strict:
              true,

            schema:
              KAKAO_AI_PRE_ROUTER_SCHEMA,
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

        decision:
          buildSafeAnalysisDecision(
            "Pre-Router 응답이 비어 있어 안전하게 분석형으로 처리합니다."
          ),

        openAiResponseId:
          typeof response.id ===
            "string"
            ? response.id
            : null,

        model,

        fallbackUsed:
          true,

        errorMessage:
          "Pre-Router 응답이 비어 있습니다.",
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

    const mode:
      KakaoAiPreRouteMode =
      parsed.mode ===
        "immediate"
        ? "immediate"
        : "analysis";

    const allowedImmediateKinds =
      new Set([
        "greeting",
        "thanks",
        "acknowledgement",
        "company_general",
        "light_conversation",
      ]);

    const immediateKind:
      KakaoAiImmediateKind =
      mode ===
        "immediate" &&
      allowedImmediateKinds.has(
        String(
          parsed.immediateKind ||
          ""
        )
      )
        ? (
            String(
              parsed.immediateKind
            ) as
              Exclude<
                KakaoAiImmediateKind,
                null
              >
          )
        : null;

    /**
     * 모델이 mode=immediate라고 했더라도
     * immediateKind가 올바르지 않으면
     * 분석형으로 강등한다.
     */
    if (
      mode ===
        "immediate" &&
      !immediateKind
    ) {
      return {
        success:
          true,

        decision:
          buildSafeAnalysisDecision(
            "즉시응답 유형이 명확하지 않아 분석형으로 강등했습니다."
          ),

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
    }

    const finalMode:
      KakaoAiPreRouteMode =
      mode;

    const requiresCompanyContext =
      finalMode ===
        "immediate";

    const shouldShowWaitingMessage =
      finalMode ===
        "analysis";

    return {
      success:
        true,

      decision: {
        mode:
          finalMode,

        immediateKind,

        reason:
          normalizeText(
            parsed.reason
          ) ||
          (
            finalMode ===
              "immediate"
              ? "즉시 자연어 응답이 가능한 가벼운 대화입니다."
              : "공용엔진 분석이 필요한 요청입니다."
          ),

        requiresCompanyContext,

        shouldShowWaitingMessage,

        confidence:
          normalizeConfidence(
            parsed.confidence
          ),
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
      "[KAKAO AI PRE ROUTER] 분류 실패",
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

      decision:
        buildSafeAnalysisDecision(
          "Pre-Router 처리 중 오류가 발생하여 안전하게 분석형으로 처리합니다."
        ),

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