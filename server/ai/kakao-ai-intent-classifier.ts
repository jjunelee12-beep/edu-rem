import OpenAI from "openai";

import {
  KAKAO_AI_INTENT_CLASSIFIER_INSTRUCTIONS,
  buildKakaoAiIntentClassifierInput,
  parseKakaoAiIntentClassifierOutput,
  routeKakaoAiIntent,

  type KakaoAiAttachmentContext,
  type KakaoAiConversationMessage,
  type KakaoAiIntentDecision,
  type KakaoAiRoutedIntent,
} from "./kakao-ai-intent-router";

import type {
  KakaoAiCustomerType,
} from "./kakao-ai-access-policy";

import type {
  KakaoAiLeadFlowConfig,
  KakaoAiLeadFlowStage,
} from "./kakao-ai-lead-flow-engine";

/**
 * 실제 OpenAI Intent 분석 결과.
 *
 * intent:
 * 모델이 분석한 자연어 의도
 *
 * routed:
 * 중앙 lead / registered 권한정책까지
 * 적용한 최종 Routing 결과
 */
export type KakaoAiIntentClassificationResult = {
  success: boolean;

  intent:
    KakaoAiIntentDecision;

  routed:
    KakaoAiRoutedIntent;

  /**
   * OpenAI 요청 ID.
   * 장애 추적 / 로그용.
   */
  openAiResponseId:
    string | null;

  /**
   * 실제 사용 모델.
   */
  model:
    string | null;

  /**
   * 모델 호출 실패 여부.
   *
   * true여도 안전한 unclear Intent를
   * 반환하므로 이후 흐름이 바로 죽지는 않는다.
   */
  fallbackUsed:
    boolean;

  errorMessage:
    string | null;
};

let kakaoAiOpenAiClient:
  OpenAI | null | undefined;

/**
 * 업무비서와 같은 OPENAI_API_KEY를 사용한다.
 *
 * undefined:
 * 아직 초기화하지 않음
 *
 * null:
 * API Key 없음
 */
function getKakaoAiOpenAiClient():
  OpenAI | null {
  if (
    kakaoAiOpenAiClient !==
    undefined
  ) {
    return kakaoAiOpenAiClient;
  }

  const apiKey =
    String(
      process.env.OPENAI_API_KEY ||
      ""
    ).trim();

  if (
    !apiKey
  ) {
    kakaoAiOpenAiClient =
      null;

    return null;
  }

  kakaoAiOpenAiClient =
    new OpenAI({
      apiKey,
    });

  return kakaoAiOpenAiClient;
}

/**
 * 카카오 Intent 분석 전용 모델.
 *
 * 별도 환경변수가 있으면 그것을 우선하고,
 * 없으면 기존 업무비서 모델 설정을 사용한다.
 */
function getKakaoAiIntentModel():
  string {
  return (
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

export type KakaoAiLeadSemanticResolutionResult = {
  success:
    boolean;

  semanticDecision:
    string | null;

  openAiResponseId:
    string | null;

  model:
    string | null;

  fallbackUsed:
    boolean;

  errorMessage:
    string | null;
};

function normalizeLeadSemanticText(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  ).trim();
}

function findLeadFlowStage(
  config:
    KakaoAiLeadFlowConfig,

  stageId:
    string | null | undefined
): KakaoAiLeadFlowStage |
  null {
  const normalizedStageId =
    normalizeLeadSemanticText(
      stageId
    );

  if (
    normalizedStageId
  ) {
    const matchedStage =
      config.stages.find(
        stage =>
          normalizeLeadSemanticText(
            stage.id
          ) ===
          normalizedStageId
      );

    if (
      matchedStage
    ) {
      return matchedStage;
    }
  }

  const startStageId =
    normalizeLeadSemanticText(
      config.startStageId
    );

  if (
    startStageId
  ) {
    const startStage =
      config.stages.find(
        stage =>
          normalizeLeadSemanticText(
            stage.id
          ) ===
          startStageId
      );

    if (
      startStage
    ) {
      return startStage;
    }
  }

  return (
    [...config.stages]
      .filter(
        stage =>
          stage.enabled !==
            false
      )
      .sort(
        (
          left,
          right
        ) =>
          Number(
            left.order ||
            0
          ) -
          Number(
            right.order ||
            0
          )
      )[0] ??
    null
  );
}

function buildLeadSemanticCandidates(
  config:
    KakaoAiLeadFlowConfig,

  stage:
    KakaoAiLeadFlowStage
) {
  const stageById =
    new Map(
      config.stages.map(
        item => [
          normalizeLeadSemanticText(
            item.id
          ),
          item,
        ]
      )
    );

  const candidates =
    (
      stage.transitions ||
      []
    )
      .flatMap(
        transition => {
          const rawSemantics =
            Array.isArray(
              transition.whenSemantic
            )
              ? transition.whenSemantic
              : transition.whenSemantic
                ? [
                    transition.whenSemantic,
                  ]
                : [];

          const targetStage =
            stageById.get(
              normalizeLeadSemanticText(
                transition.toStageId
              )
            ) ??
            null;

          return rawSemantics
            .map(
              semanticId =>
                normalizeLeadSemanticText(
                  semanticId
                )
            )
            .filter(
              Boolean
            )
            .map(
              semanticId => ({
                semanticId,

                description:
                  normalizeLeadSemanticText(
                    transition
                      .semanticDescription
                  ) ||
                  null,

                actionId:
                  normalizeLeadSemanticText(
                    transition.actionId
                  ) ||
                  null,

                targetStageId:
                  normalizeLeadSemanticText(
                    transition.toStageId
                  ) ||
                  null,

                targetContentKeys:
                  Array.isArray(
                    targetStage
                      ?.contentKeys
                  )
                    ? targetStage!
                        .contentKeys!
                        .map(
                          value =>
                            normalizeLeadSemanticText(
                              value
                            )
                        )
                        .filter(
                          Boolean
                        )
                    : [],

                targetMetadata:
                  targetStage
                    ?.metadata ??
                  null,

                transitionMetadata:
                  null,
              }))
        }
      );

  const uniqueCandidates =
    new Map<
      string,
      (
        typeof candidates
      )[number]
    >();

  for (
    const candidate of
    candidates
  ) {
    if (
      !uniqueCandidates.has(
        candidate.semanticId
      )
    ) {
      uniqueCandidates.set(
        candidate.semanticId,
        candidate
      );
    }
  }

  return Array.from(
    uniqueCandidates.values()
  );
}

export async function resolveKakaoAiLeadSemanticDecision(
  params: {
    message:
      string;

    conversationHistory?:
      KakaoAiConversationMessage[];

    structuredMemory?:
      unknown;

    flowConfig:
      KakaoAiLeadFlowConfig;

    currentStageId?:
      string |
      null;
  }
): Promise<
  KakaoAiLeadSemanticResolutionResult
> {
  const message =
    normalizeLeadSemanticText(
      params.message
    );

  const currentStage =
    findLeadFlowStage(
      params.flowConfig,
      params.currentStageId
    );

  if (
    !message ||
    !currentStage
  ) {
    return {
      success:
        true,

      semanticDecision:
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

  const candidates =
    buildLeadSemanticCandidates(
      params.flowConfig,
      currentStage
    );

  if (
    candidates.length ===
      0
  ) {
    return {
      success:
        true,

      semanticDecision:
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

  const openai =
    getKakaoAiOpenAiClient();

  if (
    !openai
  ) {
    return {
      success:
        false,

      semanticDecision:
        null,

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
    getKakaoAiIntentModel();

  const recentConversation =
    (
      params
        .conversationHistory ||
      []
    )
      .slice(
        -12
      )
      .map(
        item => ({
          role:
            item.role,

          content:
            normalizeLeadSemanticText(
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

  const allowedSemanticIds =
    candidates.map(
      candidate =>
        candidate.semanticId
    );

  const input =
    JSON.stringify({
      currentMessage:
        message,

      recentConversation,

      currentStage: {
        id:
          currentStage.id,

        contentKeys:
          currentStage
            .contentKeys ??
          [],

        metadata:
          currentStage
            .metadata ??
          null,

        defaultActionId:
          currentStage
            .defaultActionId ??
          null,
      },

      conversationState:
        params
          .structuredMemory ??
        null,

      allowedTransitions:
        candidates,
    });

  try {
    const response =
      await openai.responses.create({
        model,

        store:
          false,

        instructions: `
너는 카카오 신규상담 Flow의 의미 전이 판단기다.

현재 사용자의 발화를 보고
현재 Flow Stage에서 허용된 transition 중
어느 semantic ID가 가장 적절한지만 판단한다.

중요 규칙:

- 업무 단계, 과정명, 회사명, 사용자 표현을 코드 고정 규칙처럼 가정하지 않는다.
- allowedTransitions에 제공된 현재 회사 Flow Config만 판단 기준으로 사용한다.
- semantic ID 문자열 자체의 이름만 보고 의미를 추측하지 않는다.
- transition의 description, targetContentKeys, targetMetadata, actionId,
  현재 Stage 정보, 최근 대화, conversationState를 함께 본다.
- 직전 AI 발화에 대한 짧은 후속 응답도 최근 대화 문맥과
  현재 Flow 상태를 기준으로 해석한다.
- 현재 발화가 어떤 transition에도 충분히 해당하지 않으면 null을 반환한다.
- 반드시 allowedTransitions에 실제 존재하는 semantic ID만 반환한다.
- 새로운 semantic ID를 생성하지 않는다.
`,

        input,

        text: {
          format: {
            type:
              "json_schema",

            name:
              "kakao_ai_lead_semantic",

            strict:
              true,

            schema: {
              type:
                "object",

              additionalProperties:
                false,

              properties: {
                semanticDecision: {
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
              },

              required: [
                "semanticDecision",
              ],
            },
          },
        },
      });

    const outputText =
      normalizeLeadSemanticText(
        response.output_text
      );

    if (
      !outputText
    ) {
      return {
        success:
          false,

        semanticDecision:
          null,

        openAiResponseId:
          typeof response.id ===
            "string"
            ? response.id
            : null,

        model,

        fallbackUsed:
          true,

        errorMessage:
          "Lead Semantic 응답이 비어 있습니다.",
      };
    }

    const parsed =
      JSON.parse(
        outputText
      ) as {
        semanticDecision?:
          unknown;
      };

    const semanticDecision =
      parsed
        .semanticDecision ===
        null
        ? null
        : normalizeLeadSemanticText(
            parsed
              .semanticDecision
          ) ||
          null;

    /**
     * 모델이 잘못된 ID를 생성하더라도
     * 실제 Flow Config에 없는 값은 절대 통과시키지 않는다.
     */
    const safeSemanticDecision =
      semanticDecision &&
      allowedSemanticIds.includes(
        semanticDecision
      )
        ? semanticDecision
        : null;

    return {
      success:
        true,

      semanticDecision:
        safeSemanticDecision,

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
    return {
      success:
        false,

      semanticDecision:
        null,

      openAiResponseId:
        null,

      model,

      fallbackUsed:
        true,

      errorMessage:
        error instanceof Error
          ? error.message
          : String(
              error
            ),
    };
  }
}

/**
 * Structured Output용 enum.
 *
 * kakao-ai-access-policy.ts의 capability와
 * 반드시 동일하게 유지한다.
 */
const KAKAO_AI_CAPABILITY_ENUM = [
  "education_general_conversation",

  "off_topic_conversation",

  "qualification_general_guide",

  "qualification_consultation_analysis",

  "transfer_document_analysis",

  "theory_class_general_guide",

  "practice_general_guide",

  "practice_support_promotion",

  "practice_institution_lookup",

  "company_introduction",

  "company_benefits",

  "sales_points",

  "registered_benefits_guide",

  "administrative_general_guide",

  "administrative_detailed_guide",

  "administrative_document_support",

  "administrative_status_lookup",

  "certificate_application_general_guide",

  "certificate_application_detailed_guide",

  "student_private_data_lookup",

  "academic_private_data_lookup",

  "registered_risk_analysis",

    "career_consulting",

  "career_document_support",

  "staff_list",

  "staff_recommend",

  "staff_select",

  "staff_change",

    "staff_current",

  "lead_registration",

  "callback_request",
] as const;

const KAKAO_AI_REQUIRED_CONTEXT_ENUM = [
  "company_context",

  "common_rule_engine",

  "conversation_memory",

  "transfer_document",

  "registered_student",

  "academic_summary",

  "risk_analysis",

  "administrative_status",

    "practice_center",

  "career_context",

  "staff_context",

  "attachment_analysis"
] as const;

/**
 * 모델 응답 JSON Schema.
 *
 * Intent Router에서 다시 한번 정규화하지만
 * 모델 단계에서도 구조를 최대한 강제한다.
 */
const KAKAO_AI_INTENT_JSON_SCHEMA = {
  type:
    "object",

  additionalProperties:
    false,

  properties: {
    domain: {
      type:
        "string",

      enum: [
        "education",
        "off_topic",
        "mixed",
        "unclear",
      ],
    },

    primaryCapability: {
      type:
        "string",

      enum:
        KAKAO_AI_CAPABILITY_ENUM,
    },

    capabilities: {
      type:
        "array",

      items: {
        type:
          "string",

        enum:
          KAKAO_AI_CAPABILITY_ENUM,
      },
    },

    userGoal: {
      type:
        "string",
    },

    needsClarification: {
      type:
        "boolean",
    },

    clarificationQuestion: {
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

clarificationOptions: {
  type:
    "array",

  items: {
    type:
      "string",
  },

  maxItems:
    5,
},

    missingInformation: {
      type:
        "array",

      items: {
        type:
          "string",
      },
    },

    requiredContexts: {
      type:
        "array",

      items: {
        type:
          "string",

        enum:
          KAKAO_AI_REQUIRED_CONTEXT_ENUM,
      },
    },

    requiresAttachmentAnalysis: {
      type:
        "boolean",
    },

    requiresCommonRuleEngine: {
      type:
        "boolean",
    },

    requiresRegisteredStudentData: {
      type:
        "boolean",
    },

    requiresPracticeCenterLookup: {
      type:
        "boolean",
    },

    requiresCompanyContext: {
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
    "domain",
    "primaryCapability",
    "capabilities",
    "userGoal",
    "needsClarification",
    "clarificationQuestion",
"clarificationOptions",
    "missingInformation",
    "requiredContexts",
    "requiresAttachmentAnalysis",
    "requiresCommonRuleEngine",
    "requiresRegisteredStudentData",
    "requiresPracticeCenterLookup",
    "requiresCompanyContext",
    "confidence",
  ],
} as const;

/**
 * OpenAI 장애나 API Key 누락 시
 * 절대로 임의 Intent를 실행하지 않고
 * 확인 질문 상태로 떨어뜨린다.
 */
function buildFallbackIntent():
  KakaoAiIntentDecision {
  return parseKakaoAiIntentClassifierOutput(
    JSON.stringify({
      domain:
        "unclear",

      primaryCapability:
        "education_general_conversation",

      capabilities: [
        "education_general_conversation",
      ],

      userGoal:
        "",

      needsClarification:
  true,

clarificationQuestion:
  "말씀하신 내용을 정확하게 이해했는지 한 번만 확인할게요. 궁금하신 내용을 조금만 더 설명해주시겠어요?",

clarificationOptions:
  [],

missingInformation:
  [],

      requiredContexts: [
        "conversation_memory",
      ],

      requiresAttachmentAnalysis:
        false,

      requiresCommonRuleEngine:
        false,

      requiresRegisteredStudentData:
        false,

      requiresPracticeCenterLookup:
        false,

      requiresCompanyContext:
        false,

      confidence:
        0,
    })
  );
}

/**
 * 카카오 사용자의 자연어 메시지를
 * OpenAI로 실제 Intent 분석한다.
 *
 * 중요:
 *
 * 이 함수는
 * - CRM Tool 실행 X
 * - 공통엔진 실행 X
 * - 실습센터 조회 X
 * - 학생 데이터 조회 X
 * - 최종 사용자 답변 생성 X
 *
 * 오직:
 *
 * 자연어 → Intent → Access Policy
 *
 * 까지만 담당한다.
 */
export async function classifyKakaoAiIntent(
  params: {
    customerType:
      KakaoAiCustomerType;

    message:
      string;

    conversationHistory?:
      KakaoAiConversationMessage[];

    structuredMemory?:
      {
        desiredCourse?:
          string | null;

        finalEducation?:
          string | null;

        hasTransferCollege?:
          boolean | null;

socialWorkerLawVersion?:
  "old" |
  "current" |
  null;

        verifiedFacts?:
          string[];

                unresolvedQuestions?:
          string[];

        currentTopic?:
          string | null;

        recommendedStaffUserId?:
          number | null;

        selectedStaffUserId?:
          number | null;

        lastStaffCandidates?:
          Array<{
            userId:
              number;

            displayName:
              string | null;

            publicToken:
              string | null;

            publicPositionName:
              string | null;
          }>;

        staffSelectionStatus?:
          | "none"
          | "recommended"
          | "selected";

        lastIntent?:
          string | null;

        consultationFlow?: {
          qualificationExplained?:
            boolean;

          durationExplained?:
            boolean;

          theoryExplained?:
            boolean;

          practicumExplained?:
            boolean;

          administrationExplained?:
            boolean;

          companyBenefitsExplained?:
            boolean;

          staffRecommendationOffered?:
            boolean;

          consultationFormOffered?:
            boolean;
        };
      } | null;

    attachmentContext?:
      KakaoAiAttachmentContext | null;
  }
): Promise<KakaoAiIntentClassificationResult> {
  const customerType =
    params.customerType;

  const message =
    String(
      params.message ||
      ""
    ).trim();

  /**
   * 빈 메시지는 모델까지 보내지 않는다.
   *
   * 이미지 단독 메시지는 이후 이미지 처리 단계에서
   * 별도로 context를 붙여 호출하게 된다.
   */
  if (
    !message &&
    !params
      .attachmentContext
      ?.hasImage &&
    !params
      .attachmentContext
      ?.hasDocument
  ) {
    const intent =
      buildFallbackIntent();

    return {
      success:
        false,

      intent,

      routed:
        routeKakaoAiIntent({
          customerType,

          intent,
        }),

      openAiResponseId:
        null,

      model:
        null,

      fallbackUsed:
        true,

      errorMessage:
        "분석할 메시지 또는 첨부자료가 없습니다.",
    };
  }

  const openai =
    getKakaoAiOpenAiClient();

  if (
    !openai
  ) {
    const intent =
      buildFallbackIntent();

    return {
      success:
        false,

      intent,

      routed:
        routeKakaoAiIntent({
          customerType,

          intent,
        }),

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
    getKakaoAiIntentModel();

    const classifierInput =
    buildKakaoAiIntentClassifierInput({
      message,

      conversationHistory:
        params.conversationHistory,

      structuredMemory:
        params.structuredMemory,

      attachmentContext:
        params.attachmentContext,
    });

  try {
    const response =
      await openai.responses.create({
        model,

        /**
         * Intent 분석은 이전 OpenAI response_id를
         * 이어가지 않는다.
         *
         * 필요한 대화내용은 classifierInput에
         * 서버가 명시적으로 넣는다.
         */
        store:
          false,

        instructions:
          KAKAO_AI_INTENT_CLASSIFIER_INSTRUCTIONS,

        input:
          classifierInput,

        text: {
          format: {
            type:
              "json_schema",

            name:
              "kakao_ai_intent",

            strict:
              true,

            schema:
              KAKAO_AI_INTENT_JSON_SCHEMA,
          },
        },
      });

    const outputText =
      String(
        response.output_text ||
        ""
      ).trim();

    if (
      !outputText
    ) {
      const intent =
        buildFallbackIntent();

      return {
        success:
          false,

        intent,

        routed:
          routeKakaoAiIntent({
            customerType,

            intent,
          }),

        openAiResponseId:
          typeof response.id ===
            "string"
            ? response.id
            : null,

        model,

        fallbackUsed:
          true,

        errorMessage:
          "OpenAI Intent 응답이 비어 있습니다.",
      };
    }

    const intent =
      parseKakaoAiIntentClassifierOutput(
        outputText
      );

    const routed =
      routeKakaoAiIntent({
        customerType,

        intent,
      });

    return {
      success:
        true,

      intent,

      routed,

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
      "[KAKAO AI] Intent 분석 실패",
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

    const intent =
      buildFallbackIntent();

    return {
      success:
        false,

      intent,

      routed:
        routeKakaoAiIntent({
          customerType,

          intent,
        }),

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