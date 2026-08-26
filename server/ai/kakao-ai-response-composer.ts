import OpenAI from "openai";

import type {
  KakaoAiCustomerContext,
} from "./kakao-ai-customer-resolver";

import type {
  KakaoAiStructuredMemory,
} from "./kakao-ai-memory-resolver";

import type {
  KakaoAiIntentClassificationResult,
} from "./kakao-ai-intent-classifier";

import type {
  KakaoAiResolvedContext,
} from "./kakao-ai-context-resolver";

import type {
  KakaoAiConversationMessage,
} from "./kakao-ai-intent-router";

import type {
  KakaoAiLeadFlowEvaluationResult,
} from "./kakao-ai-lead-flow-engine";

export type KakaoAiConsultationFlowPatch = {
  qualificationExplained: boolean;
  durationExplained: boolean;
  theoryExplained: boolean;
  practicumExplained: boolean;
  administrationExplained: boolean;
  companyBenefitsExplained: boolean;
  staffRecommendationOffered: boolean;
  consultationFormOffered: boolean;
};
/**
 * 카카오 AI 최종 자연어 답변 Composer.
 *
 * 역할:
 *
 * 사용자 질문
 * + 이전 대화
 * + 구조화 Memory
 * + Intent
 * + Access Policy
 * + 회사 Context
 * + 신규 공통엔진
 * + 등록학생 분석
 * + 실습센터
 *
 * 를 종합하여
 *
 * "사람이 직접 상담하는 것 같은"
 * 하나의 자연어 답변으로 만든다.
 *
 * 중요:
 *
 * 이 파일은:
 *
 * - 학점 계산 X
 * - 법 적용판단 X
 * - 학생 검색 X
 * - 실습기관 검색 X
 * - DB 수정 X
 *
 * 서버에서 이미 확정된 Context를
 * 자연스럽게 설명하는 역할만 한다.
 */

export type KakaoAiResponseCompositionResult = {
  success:
    boolean;

  /**
   * 실제 카카오 고객에게 전송할 문장.
   */
  replyText:
    string;

  /**
   * 모델이 답변에 실제로 활용했다고 판단한
   * 답변 근거 종류.
   *
   * 로그 / 디버깅용.
   */
  usedContextTypes:
    string[];

  /**
   * 등록자 전용 제한 안내가
   * 답변에 포함됐는지.
   */
  mentionedRestriction:
    boolean;

  /**
   * 추가 확인 질문으로 끝났는지.
   */
  askedClarification:
    boolean;

  consultationFlowPatch:
    KakaoAiConsultationFlowPatch;

  openAiResponseId:
    string | null;

  model:
    string | null;

  fallbackUsed:
    boolean;

  errorMessage:
    string | null;
};

let kakaoAiResponseOpenAiClient:
  OpenAI | null | undefined;

function getKakaoAiResponseOpenAiClient():
  OpenAI | null {
  if (
    kakaoAiResponseOpenAiClient !==
    undefined
  ) {
    return kakaoAiResponseOpenAiClient;
  }

  const apiKey =
    String(
      process.env.OPENAI_API_KEY ||
      ""
    ).trim();

  if (
    !apiKey
  ) {
    kakaoAiResponseOpenAiClient =
      null;

    return null;
  }

  kakaoAiResponseOpenAiClient =
    new OpenAI({
      apiKey,
    });

  return kakaoAiResponseOpenAiClient;
}

/**
 * 카카오 최종 답변 전용 모델.
 *
 * 별도 설정이 없다면
 * 기존 카카오 Intent 모델 →
 * 기존 CRM AI 모델 순으로 fallback.
 */
function getKakaoAiResponseModel():
  string {
  return (
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

function createEmptyConsultationFlowPatch():
  KakaoAiConsultationFlowPatch {
  return {
    qualificationExplained:
      false,

    durationExplained:
      false,

    theoryExplained:
      false,

    practicumExplained:
      false,

    administrationExplained:
      false,

    companyBenefitsExplained:
      false,

    staffRecommendationOffered:
      false,

    consultationFormOffered:
      false,
  };
}

function normalizeConsultationFlowPatch(
  value:
    unknown
): KakaoAiConsultationFlowPatch {
  const patch =
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
      ? value as Record<
          string,
          unknown
        >
      : {};

  return {
    qualificationExplained:
      patch
        .qualificationExplained ===
      true,

    durationExplained:
      patch
        .durationExplained ===
      true,

    theoryExplained:
      patch
        .theoryExplained ===
      true,

    practicumExplained:
      patch
        .practicumExplained ===
      true,

    administrationExplained:
      patch
        .administrationExplained ===
      true,

    companyBenefitsExplained:
      patch
        .companyBenefitsExplained ===
      true,

    staffRecommendationOffered:
      patch
        .staffRecommendationOffered ===
      true,

    consultationFormOffered:
      patch
        .consultationFormOffered ===
      true,
  };
}

/**
 * 회사 Context 중
 * 최종 답변 AI에게 전달해도 되는 값만 선별한다.
 *
 * consultationPolicy는 내부 정책이므로
 * 모델은 지침으로 사용할 수 있지만
 * 고객에게 그대로 공개해서는 안 된다.
 */
function buildSafeCompanyContext(
  context:
    KakaoAiResolvedContext["companyContext"]
) {
  if (
    !context
  ) {
    return null;
  }

  return {
    enabled:
      context.enabled,

    features: {
      newConsultationEnabled:
        context
          .features
          .newConsultationEnabled,

      registeredStudentEnabled:
        context
          .features
          .registeredStudentEnabled,

      ocrEnabled:
        context
          .features
          .ocrEnabled,

      practiceSupportEnabled:
        context
          .features
          .practiceSupportEnabled,

      assigneeRecommendationEnabled:
        context
          .features
          .assigneeRecommendationEnabled,

      priceDisclosureEnabled:
        context
          .features
          .priceDisclosureEnabled,
    },

    identity: {
      aiDisplayName:
        context
          .identity
          .aiDisplayName,
    },

    conversation: {
  welcomeMessage:
    context
      .conversation
      .welcomeMessage,

  defaultGuideMessage:
    context
      .conversation
      .defaultGuideMessage,

  consultationHoursMessage:
    context
      .conversation
      .consultationHoursMessage,
},

    companyKnowledge: {
      companyIntroduction:
        context
          .companyKnowledge
          .companyIntroduction,

      companyBenefits:
        context
          .companyKnowledge
          .companyBenefits,

      salesPoints:
        context
          .companyKnowledge
          .salesPoints,

      registeredAiBenefits:
        context
          .companyKnowledge
          .registeredAiBenefits,

priceGuide:
  context
    .companyKnowledge
    .priceGuide,

      theoryClassGuide:
        context
          .companyKnowledge
          .theoryClassGuide,

      practiceGuide:
        context
          .companyKnowledge
          .practiceGuide,

      administrativeSupportGuide:
        context
          .companyKnowledge
          .administrativeSupportGuide,
    },

    /**
     * 고객에게 그대로 공개 금지.
     *
     * AI의 행동방침으로만 사용.
     */
    internalPolicy: {
      consultationPolicy:
        context
          .internalPolicy
          .consultationPolicy,
    },
  };
}

/**
 * 신규 공통엔진 전체 객체를
 * 모델에 통째로 던지지 않는다.
 *
 * 최종 Academic Summary와
 * 공통엔진 확인 필요 이유만 제공한다.
 */
function buildSafeLeadAcademicContext(
  context:
    KakaoAiResolvedContext["leadAcademicAnalysis"]
) {
  if (
    !context
  ) {
    return null;
  }

  return {
    status:
      context.status,

    canExplain:
      context.canExplain,

    requestedCourse:
      context.requestedCourse,

    courseKey:
      context.courseKey,

    catalog:
      context.catalog,

recognizedSubjects:
  Array.isArray(
    context.recognizedSubjects
  )
    ? context.recognizedSubjects
        .slice(
          0,
          30
        )
        .map(
          subject => ({
            subjectName:
              normalizeText(
                subject.subjectName
              ),

            requirementType:
              normalizeText(
                subject.requirementType
              ) ||
              null,

            category:
              normalizeText(
                subject.category
              ) ||
              null,

            credits:
              Number(
                subject.credits ||
                0
              ),

            source:
              subject.source,
          })
        )
        .filter(
          subject =>
            Boolean(
              subject.subjectName
            )
        )
    : [],

    academicSummary:
  context.academicSummary
    ? {
        status:
          context
            .academicSummary
            .status,

        canExplain:
          context
            .academicSummary
            .canExplain,

        course:
          context
            .academicSummary
            .course,

        qualification:
          context
            .academicSummary
            .qualification,

        masterIntegrity:
          context
            .academicSummary
            .masterIntegrity,

        degree:
          context
            .academicSummary
            .degree,

        studyPlan:
          context
            .academicSummary
            .studyPlan,

        timeline:
          context
            .academicSummary
            .timeline,

        summaryLines:
          normalizeStringArray(
            context
              .academicSummary
              .summaryLines,
            30
          ),

        unresolvedReasons:
          normalizeStringArray(
            context
              .academicSummary
              .unresolvedReasons,
            20
          ),

        warnings:
          normalizeStringArray(
            context
              .academicSummary
              .warnings,
            20
          ),
      }
    : null,

    unresolvedReasons:
      normalizeStringArray(
        context.unresolvedReasons,
        20
      ),

    warnings:
      normalizeStringArray(
        context.warnings,
        20
      ),
  };
}

/**
 * Document Intelligence 결과 중
 * 최종 상담 답변에 필요한 정보만 전달한다.
 *
 * 중요:
 * - Composer는 OCR/Vision을 다시 실행하지 않는다.
 * - 문서에서 확인된 사실만 설명한다.
 * - 학점/과목/기간 계산은 여기서 하지 않는다.
 * - 실제 학습설계 숫자는 Academic Context를 우선한다.
 */
function buildSafeDocumentIntelligenceContext(
  context:
    KakaoAiResolvedContext["documentIntelligence"]
) {
  if (
    !context
  ) {
    return null;
  }

  return {
    documentType:
      context.documentType,

    confidence:
      context.confidence,

    decision:
      context.decision,

    summary:
      context.summary,

    academicSubjects:
      Array.isArray(
        context.academic
          ?.subjects
      )
        ? context.academic.subjects
            .slice(
              0,
              300
            )
            .map(
              subject => ({
                name:
                  normalizeText(
                    subject.name
                  ),

                credits:
                  Number.isFinite(
                    Number(
                      subject.credits
                    )
                  )
                    ? Number(
                        subject.credits
                      )
                    : null,

                year:
                  normalizeText(
                    subject.year
                  ) ||
                  null,

                semester:
                  normalizeText(
                    subject.semester
                  ) ||
                  null,

                rawName:
                  normalizeText(
                    subject.rawName
                  ) ||
                  null,
              })
            )
            .filter(
              subject =>
                Boolean(
                  subject.name
                )
            )
        : [],

    warnings:
      normalizeStringArray(
        context.warnings,
        20
      ),

    missingEvidence:
      normalizeStringArray(
        context.missingEvidence,
        20
      ),

    canUseAcademicEngine:
      context.canUseAcademicEngine,

    canUseAdministrativeEngine:
      context.canUseAdministrativeEngine,
  };
}

/**
 * Document Assistance 결과 중
 * 최종 고객 답변에 사용할 수 있는
 * 문서 기반 안내정보만 전달한다.
 *
 * 중요:
 * - Document Intelligence = 문서에서 확인된 사실
 * - Document Assistance = 그 사실을 바탕으로 한 안내/다음 행동
 * - Composer가 문서를 다시 해석하거나 절차를 새로 만들지 않는다.
 * - 실제 서버 Assistance 결과만 자연어 답변 근거로 사용한다.
 */
function buildSafeDocumentAssistanceContext(
  context:
    KakaoAiResolvedContext["documentAssistance"]
) {
  if (
    !context
  ) {
    return null;
  }

  return context;
}

/**
 * 등록학생 분석도 개인정보/내부데이터 전체를
 * 그대로 모델에 전달하지 않는다.
 *
 * 이미 인증된 본인의 답변에 필요한
 * 학업요약 + 위험요소만 전달한다.
 */
function buildSafeRegisteredStudentContext(
  context:
    KakaoAiResolvedContext["registeredStudentAnalysis"]
) {
  if (
    !context
  ) {
    return null;
  }

  const detail =
    context.detail as any;

  const academicSummary =
    detail?.academicSummary ||
    null;

  const issues =
    Array.isArray(
      detail?.issues
    )
      ? detail.issues
      : [];

  return {
    studentId:
      context.studentId,

    student: {
      clientName:
        detail?.student
          ?.clientName ??
        null,

      course:
        detail?.student
          ?.course ??
        null,

      status:
        detail?.student
          ?.status ??
        null,
    },

    riskSummary: {
      riskLevel:
        detail?.summary
          ?.riskLevel ??
        null,

      riskScore:
        detail?.summary
          ?.riskScore ??
        null,

      totalIssueCount:
        detail?.summary
          ?.totalIssueCount ??
        issues.length,

      dangerCount:
        detail?.summary
          ?.dangerCount ??
        null,

      warningCount:
        detail?.summary
          ?.warningCount ??
        null,

      currentCredits:
        detail?.summary
          ?.currentCredits ??
        null,

      requiredCredits:
        detail?.summary
          ?.requiredCredits ??
        null,

      remainingCredits:
        detail?.summary
          ?.remainingCredits ??
        null,
    },

    academicSummary:
  academicSummary
    ? {
        status:
          academicSummary.status,

        canExplain:
          academicSummary.canExplain,

        course:
          academicSummary.course,

        qualification:
          academicSummary
            .qualification,

        masterIntegrity:
          academicSummary
            .masterIntegrity ??
          [],

        degree:
          academicSummary.degree ??
          null,

        studyPlan:
          academicSummary.studyPlan ??
          null,

        timeline:
          academicSummary.timeline ??
          null,

        summaryLines:
          normalizeStringArray(
            academicSummary
              .summaryLines,
            30
          ),

        unresolvedReasons:
          normalizeStringArray(
            academicSummary
              .unresolvedReasons,
            20
          ),

        warnings:
          normalizeStringArray(
            academicSummary
              .warnings,
            20
          ),
      }
    : null,

    issues:
      issues
        .slice(
          0,
          15
        )
        .map(
          (
            issue:
              any
          ) => ({
            severity:
              normalizeText(
                issue?.severity
              ),

            category:
              normalizeText(
                issue?.category
              ),

            title:
              normalizeText(
                issue?.title
              ),

            message:
              normalizeText(
                issue?.message
              ),
          })
        )
        .filter(
          (
            issue:
              any
          ) =>
            Boolean(
              issue.title ||
              issue.message
            )
        ),
  };
}

/**
 * 실습기관도 Adapter가 이미 최소 공개형태로
 * 정리했지만 한 번 더 개수를 제한한다.
 */
function buildSafePracticeContext(
  context:
    KakaoAiResolvedContext["practiceCenter"]
) {
  if (
    !context
  ) {
    return null;
  }

  return {
    educationCenters:
      context
        .educationCenters
        .slice(
          0,
          10
        ),

    practiceInstitutions:
      context
        .practiceInstitutions
        .slice(
          0,
          10
        ),
  };
}

/**
 * 담당자 Context도 모델에 필요한
 * 공개 정보만 전달한다.
 *
 * 내부 추천횟수 / DB 상태값 등은
 * 최종 답변 AI에 그대로 노출하지 않는다.
 */
function buildSafeStaffContext(
  context:
    KakaoAiResolvedContext["staffContext"]
) {
  if (
    !context
  ) {
    return null;
  }

  const mapCandidate =
    (
      staff:
        any
    ) => {
      const userId =
        Math.floor(
          Number(
            staff?.userId ||
            0
          )
        );

      if (
        !Number.isFinite(
          userId
        ) ||
        userId <=
          0
      ) {
        return null;
      }

      return {
        /**
         * userId는 모델 내부에서
         * 동일 담당자 비교용으로만 사용한다.
         *
         * 고객에게 숫자 ID를 말하면 안 된다.
         */
        userId,

        displayName:
          normalizeText(
            staff?.displayName
          ) ||
          null,

        publicPositionName:
          normalizeText(
            staff?.publicPositionName
          ) ||
          null,

        /**
         * 담당자 소개페이지 연결용 토큰.
         *
         * 모델이 임의 URL을 조합하지 않도록
         * 토큰값만 제공한다.
         *
         * 실제 URL 생성은 이후 카카오 응답
         * 템플릿 단계에서 처리할 수 있다.
         */
        publicToken:
          normalizeText(
            staff?.publicToken
          ) ||
          null,
      };
    };

  const candidates =
    Array.isArray(
      context.candidates
    )
      ? context.candidates
          .map(
            mapCandidate
          )
          .filter(
            Boolean
          )
          .slice(
            0,
            20
          )
      : [];

  return {
    status:
      context.status,

    recommendedStaff:
      mapCandidate(
        context.recommendedStaff
      ),

    selectedStaff:
      mapCandidate(
        context.selectedStaff
      ),

    candidates,

    lastIntent:
      normalizeText(
        context.lastIntent
      ) ||
      null,
  };
}

/**
 * Access Policy 결과를
 * Composer가 이해할 수 있는 최소구조로 만든다.
 */
function buildAccessContext(
  intent:
    KakaoAiIntentClassificationResult
) {
  return intent
    .routed
    .accessDecisions
    .map(
      (
        decision
      ) => ({
        capability:
          decision.capability,

        allowed:
          decision.allowed,

        reasonCode:
          decision.reasonCode,

        responseGuidance:
          decision.responseGuidance,

        canMentionRegisteredBenefits:
          decision
            .canMentionRegisteredBenefits,
      })
    );
}

/**
 * =========================================================
 * Lead Flow Composer Context
 * =========================================================
 *
 * Flow Engine이 이미 결정한 현재 상담상태와
 * 다음 행동을 Composer가 자연어로 표현하기 위한 Context.
 *
 * 중요:
 * - Composer는 Stage를 결정하지 않는다.
 * - Composer는 Action을 결정하지 않는다.
 * - Composer는 transition 조건을 평가하지 않는다.
 * - DB Flow Config / Flow Engine 결과를 설명만 한다.
 */
function buildLeadFlowComposerContext(
  evaluation:
    KakaoAiLeadFlowEvaluationResult |
    null |
    undefined
) {
  if (
    !evaluation
  ) {
    return null;
  }

  const currentStage =
    evaluation.currentStage ??
    null;

  const nextStage =
    evaluation.nextStage ??
    null;

  return {
    reason:
      normalizeText(
        evaluation.reason
      ) ||
      null,

    currentStageId:
      normalizeText(
        evaluation.currentStageId
      ) ||
      null,

    nextStageId:
      normalizeText(
        evaluation.nextStageId
      ) ||
      null,

    actionId:
      normalizeText(
        evaluation.actionId
      ) ||
      null,

    currentStage:
      currentStage
        ? {
            id:
              normalizeText(
                currentStage.id
              ) ||
              null,

            contentKeys:
              normalizeStringArray(
                currentStage.contentKeys,
                30
              ),

metadata:
  currentStage.metadata ??
  null,
          }
        : null,

    nextStage:
      nextStage
        ? {
            id:
              normalizeText(
                nextStage.id
              ) ||
              null,

            contentKeys:
              normalizeStringArray(
                nextStage.contentKeys,
                30
              ),

metadata:
  nextStage.metadata ??
  null,

            availableActions:
              Array.from(
                new Set(
                  (
                    nextStage.transitions ??
                    []
                  )
                    .map(
                      transition =>
                        normalizeText(
                          transition.actionId
                        )
                    )
                    .filter(
                      Boolean
                    )
                )
              ).slice(
                0,
                30
              ),
          }
        : null,
  };
}

const KAKAO_AI_RESPONSE_SCHEMA = {
  type:
    "object",

  additionalProperties:
    false,

  properties: {
    replyText: {
      type:
        "string",
    },

    usedContextTypes: {
      type:
        "array",

      items: {
        type:
          "string",
      },
    },

    mentionedRestriction: {
      type:
        "boolean",
    },

    askedClarification: {
      type:
        "boolean",
    },

    consultationFlowPatch: {
      type:
        "object",

      additionalProperties:
        false,

      properties: {
        qualificationExplained: {
          type:
            "boolean",
        },

        durationExplained: {
          type:
            "boolean",
        },

        theoryExplained: {
          type:
            "boolean",
        },

        practicumExplained: {
          type:
            "boolean",
        },

        administrationExplained: {
          type:
            "boolean",
        },

        companyBenefitsExplained: {
          type:
            "boolean",
        },

        staffRecommendationOffered: {
          type:
            "boolean",
        },

        consultationFormOffered: {
          type:
            "boolean",
        },
      },

      required: [
        "qualificationExplained",
        "durationExplained",
        "theoryExplained",
        "practicumExplained",
        "administrationExplained",
        "companyBenefitsExplained",
        "staffRecommendationOffered",
        "consultationFormOffered",
      ],
    },
  },

    required: [
    "replyText",
    "usedContextTypes",
    "mentionedRestriction",
    "askedClarification",
    "consultationFlowPatch",
  ],
} as const;

/**
 * 최종 자연어 상담 원칙.
 *
 * 회사별 문구/정책이 아니라
 * 모든 EduCanvas 카카오 AI에 적용되는
 * 공통 행동규칙이다.
 */
const KAKAO_AI_RESPONSE_COMPOSER_INSTRUCTIONS = `
너는 EduCanvas 기반 카카오 상담 AI의 최종 응답 작성기다.

너의 목적은 "챗봇처럼 항목을 읽는 것"이 아니라
실제 상담사가 고객의 말을 이해하고 자연스럽게 답하는 것이다.

반드시 제공된 서버 Context만 사실 근거로 사용한다.

[상담 Flow Engine 최우선 원칙]

신규 고객이고 leadFlowContext가 존재하는 경우,
현재 상담의 단계와 다음 행동은 서버 Flow Engine이 이미 결정했다.

leadFlowContext는 현재 회사의 DB Lead Flow Config를
Flow Engine이 평가한 결과다.

Composer는 이 결과를 변경하거나
독자적으로 새로운 상담순서를 만들지 않는다.

반드시 다음 원칙을 따른다.

1. 사용자의 현재 질문에는 먼저 정확하게 답한다.

Flow Engine이 특정 Stage를 지정했다는 이유로
사용자가 직접 물어본 질문을 무시하거나
다른 상담주제로 강제로 이동하지 않는다.

2. 현재 질문에 답한 이후 상담을 이어갈 필요가 있다면
leadFlowContext의 현재/다음 Stage와 actionId를 우선한다.

3. leadFlowContext.currentStage 또는
leadFlowContext.nextStage의 contentKeys는
해당 상담단계에서 어떤 종류의 서버 Context를
우선 활용해야 하는지를 나타낸다.

contentKeys에 없는 사실을 임의로 만들지 않는다.

4. Stage ID 자체의 문자열 의미를 추측하지 않는다.

예를 들어 Stage ID가 특정 이름처럼 보인다는 이유만으로
Composer가 그 이름에 해당하는 고정 상담내용을 만들어서는 안 된다.

Stage의 실제 설명 근거는
contentKeys와 제공된 서버 Context다.

5. actionId는 Flow Engine이 결정한
현재 상담의 다음 행동이다.

Composer는 actionId를 다른 Action으로 변경하거나
새로운 Action ID를 만들지 않는다.

6. transitions 또는 availableActions는
가능한 Flow 이동 정보를 나타낼 뿐이다.

Composer가 transition 조건을 평가하거나
어느 transition으로 이동할지 결정하지 않는다.

7. leadFlowContext가 존재하는 경우
structuredMemory.consultationFlow의 기존 boolean 필드를 이용하여
독자적인 상담순서를 결정하지 않는다.

기존 consultationFlow 값은 과거 호환 및 대화 참고정보일 뿐이며,
현재 상담진행 결정권은 leadFlowContext에 있다.

8. 다음 상담주제를 정하기 위해
자격조건 → 기간 → 이론 → 실습 → 행정절차 → 회사혜택
같은 고정 순서를 적용하지 않는다.

상담순서는 회사별 DB Flow Config에 따라 달라질 수 있다.

9. leadFlowContext가 null인 경우에만
기존 Conversation History, structuredMemory,
Intent 및 서버 Context를 이용한 일반 상담방식을 fallback으로 사용할 수 있다.

10. Flow Engine 결과와 현재 사용자의 직접 질문이 충돌하는 것처럼 보이면
현재 질문에는 정상적으로 답하되,
상담의 다음 Stage 자체를 Composer가 변경하지 않는다.

가장 중요한 원칙:

1. 사람처럼 자연스럽게 대화한다.
사용자의 말투와 질문의 깊이에 맞춰 답한다.
매번 똑같은 인사말이나 메뉴판 형식으로 답하지 않는다.

1-1. 사용자가 첫 인사나 단순 인사를 보냈고
companyContext.conversation.welcomeMessage가 존재하면
해당 내용을 사실과 상담방향의 근거로 사용할 수 있다.

단, welcomeMessage를 항상 그대로 복사하지 않는다.

대화가 이미 진행 중인데 사용자가 다시 "안녕하세요"라고 했다는 이유로
매번 전체 첫 인사말을 반복하지 않는다.

이전 Conversation History가 거의 없는 초기 인사일 때만
자연스럽게 첫 상담 인사로 활용한다.

2. 회사소개, 회사혜택, 수업방식, 실습지원 등은
companyContext의 내용을 사실 근거로 사용하되
저장된 문구를 기계적으로 복사하지 않는다.
질문에 맞게 자연스럽게 재구성한다.

3. internalPolicy는 AI가 행동할 때 참고하는 내부정책이다.
"내부정책에 따르면", "상담정책에는" 같은 식으로
고객에게 내부문구 자체를 공개하지 않는다.

4. 자격조건, 필요학점, 필요과목, 실습시간,
학기수, 학위일정, 자격신청 예상일정은
절대로 네 지식이나 상식으로 다시 계산하지 않는다.

leadAcademicContext 또는
registeredStudentContext.academicSummary에 존재하는
서버 계산값만 사용한다.

5. 서버 계산결과에 없는 숫자를 만들지 않는다.

6. 신규 고객이면 leadAcademicContext.academicSummary,
등록회원이면 registeredStudentContext.academicSummary를
학업·자격·기간 답변의 최우선 서버 근거로 사용한다.

해당 academicSummary.summaryLines가 존재하면
서버가 계산한 순서와 내용을 우선하여 자연스럽게 설명한다.

academicSummary.studyPlan에는
실제 추가과목 수, 학기 수, 예상 개월 수,
예상 시작일·종료일 및 학기별 배치가 들어 있다.

academicSummary.timeline에는
최종 학습 종료일, 학점인정 예상시점,
학위신청·학위수여 및 자격증 신청 예상시점이 들어 있다.

이 값이 존재하면 절대로 별도로 기간이나 날짜를 다시 계산하지 않는다.

6-1. 사용자가 과목 수, 남은 과목, 학점, 실습시간,
학기 수, 전체 기간, 예상 종료일,
학위신청 또는 자격증 신청 시점을 물었고
academicSummary에 해당 계산값이 존재한다면
답변 첫 부분에서 그 계산결과를 먼저 직접적으로 말한다.

경고, 확인 필요사항, unresolvedReasons,
서류 확인 필요 문구를 계산결과보다 먼저 길게 설명하지 않는다.

답변 우선순위는 다음과 같다.

1) 사용자가 물어본 계산결과
2) 그 결과를 이해하는 데 필요한 짧은 설명
3) 실제로 결과에 영향을 주는 확인 필요사항
4) 필요한 경우 다음 상담단계

예를 들어 사용자가
"몇 과목 남았어요?"
라고 물었고 서버에 남은 과목 수가 존재하면

먼저
"현재 기준으로는 2과목 남아 있어요."
처럼 질문에 대한 직접 답을 먼저 한다.

그 뒤 필요한 경우에만
"다만 현재 문서에서 판독된 과목 중 일부는
최종 인정 전 확인이 필요합니다."
처럼 확인 필요사항을 짧게 덧붙인다.

나쁜 답변:
"현재 과목계획이 완전히 확정되지 않아
정확하게 말씀드리기 어렵습니다."

서버가 이미 남은 과목 수를 계산해 제공하고 있다면
이런 식으로 계산 자체를 회피하지 않는다.

academicSummary에 존재하는 계산값과
그 계산값의 확정수준은 서로 구분한다.

계산값이 상담용 예상이라면
숫자를 숨기지 말고 먼저 안내한 뒤
"현재 확인된 조건 기준 예상값"이라는 의미를 짧게 붙인다.

즉,
예상값이라는 이유로 계산결과를 말하지 않는 것이 아니라
계산결과를 안내하면서 확정수준을 함께 설명한다.

6-2. 학습 종료일, 학점인정신청일, 학위신청일,
학위수여일, 자격증 신청 가능일은 서로 다른 날짜다.

사용자가 "언제 취득할 수 있는지",
"언제 자격증을 받을 수 있는지",
"지금 시작하면 언제 끝나는지"처럼
최종 취득시점을 묻는 경우에는
중간 행정절차 날짜를 최종 취득일처럼 답하지 않는다.

신규 고객의 최종 자격 취득 관련 날짜는
leadAcademicContext.academicSummary.timeline의
자격증 신청 가능시점 또는 자격 취득에 직접 연결되는
최종 서버 계산값을 가장 먼저 사용한다.

새 학위과정이 필요한 고객이라면
학점인정신청 가능월보다
학위신청 / 학위수여 / 자격증 신청 가능시점이
최종 취득 판단에서 우선한다.

academicSummary.timeline에
자격증 신청 예상시점이 존재하면
학점인정신청 날짜를
"가장 빠른 자격증 취득시점"이라고 표현하지 않는다.

학점인정신청 날짜는 사용자가
학점인정신청 자체의 시점을 질문했거나,
전체 행정절차를 설명하는 경우에만
해당 절차의 날짜로 설명한다.

각 날짜의 의미를 절대 서로 바꾸지 않는다.

서버에 최종 취득 관련 날짜가 없으면
학점인정신청 날짜로 대신 답하지 않는다.
확인 가능한 마지막 단계와
아직 계산되지 않은 최종 단계를 구분해서 설명한다.

7. 해당 academicSummary.canExplain=false이거나
academicSummary.unresolvedReasons가 있더라도
academicSummary에 이미 계산된 값이 존재하면
그 값을 숨기거나 답변 자체를 회피하지 않는다.

확정되지 않은 부분만 확정형으로 말하지 않는다.

먼저 현재 서버가 계산한 범위까지 직접적으로 설명하고,
그 다음 실제로 계산결과에 영향을 주는
확인 필요사항만 짧게 구분해서 안내한다.

확인 필요사항이 있다는 이유만으로
"정확히 말씀드리기 어렵습니다",
"학습계획이 확정되어야 합니다",
"추가 확인이 필요합니다"
같은 문장만으로 답변을 끝내지 않는다.

사용자가 추가로 제공해야 하는 정보가 명확한 경우에만
그 정보만 자연스럽게 질문한다.

7-1. unresolvedReasons는 서버 내부의 확인 필요 사유다.

unresolvedReasons의 원문을 고객에게 그대로 복사해서 답하지 않는다.

예를 들어:
"과목계획이 확정되지 않아 학기 자동배치를 진행할 수 없습니다."
"과정마스터를 찾을 수 없습니다."
"적용기준을 판정할 수 없습니다."

같은 서버/개발 표현이 들어 있어도
그 문장을 그대로 출력하지 않는다.

현재 대화와 Memory를 이용해서
사용자가 이해할 수 있는 자연어로 의미만 바꿔 설명한다.

실제로 사용자에게 추가로 물어봐야 하는 정보가 명확하면
그 정보만 질문한다.

사용자가 제공할 수 없는 서버 내부 문제라면
사용자에게 없는 정보를 억지로 요구하지 않고
현재 정확한 계산을 확인하기 어렵다는 정도로 자연스럽게 설명한다.

7-2. 신규 상담의 계산결과가
"공식 확정 계산"인지
"사용자 진술을 포함한 상담용 예상 계산"인지
반드시 구분한다.

leadAcademicContext.warnings에 다음과 같은 의미가 있으면:

- 사용자가 직접 이수했다고 밝힌 과목
- 상담용 예상 계산에 반영
- 최종 인정 여부는 성적증명서 확인 필요
- 상담용 구법 예상 계산
- 최종 구법 적용 여부 확인 필요

해당 academicSummary 숫자는
공통엔진이 계산한 값이더라도
입력 사실 자체가 아직 미확정이므로
고객에게 "확정값"처럼 말하지 않는다.

이 경우 반드시 다음 의미를 포함해서 답한다.

"말씀해주신 내용이 성적증명서에서 정상 확인된다는 기준으로"
"현재 말씀해주신 조건 기준으로는"
"예상됩니다"
"최종 인정 여부는 성적증명서 확인이 필요합니다"

모든 문구를 그대로 반복할 필요는 없지만
'예상값'이라는 의미와
'최종 서류 확인 필요'라는 의미는 반드시 유지한다.

예:

사용자:
"대학교 중퇴했고
2019년에 사회복지학개론 들었어요."

서버 계산:
구법 기준
사회복지학개론 반영
남은 13과목
실습 120시간

좋은 답변:

"말씀해주신 2019년 사회복지학개론이
성적증명서에서 정상 인정된다는 기준으로 보면,
사회복지사 2급은 구법 적용이 예상되고
이미 이수한 1과목을 제외해
남은 과정은 13과목으로 예상돼요.
실습은 구법 기준 120시간입니다.

다만 최종 구법 적용 여부와
사회복지학개론 인정 여부는
성적증명서 확인 후 확정할 수 있어요."

나쁜 답변:

"구법 대상입니다.
13과목만 들으면 됩니다."

서버가 상담용 예상이라고 표시한 결과를
절대 이런 식으로 확정형으로 바꾸지 않는다.

7-3. priorSubjectCandidates의
verificationStatus 의미를 구분한다.

"user_reported":
사용자가 직접 말한 사실이다.
상담용 예상 계산에는 사용될 수 있지만
공식 인정 완료를 의미하지 않는다.

"ocr_observed":
첨부된 성적증명서에서 Vision이 실제로 판독한 과목이지만
문서 전체 판독상태가 review_required라
아직 공식 검증 완료 상태는 아니다.

상담용 예상 계산의 근거로 사용될 수 있지만
"확정 인정과목"이라고 말하지 않는다.

사용자가 이후 부족한 과목명, 이수연도, 학점 등을
자연어로 보완하면 structuredMemory와 최신 서버 계산결과를 함께 보고
보완된 상담용 예상값을 설명한다.

"verified":
서버/OCR 등으로 확인된 사실이다.
서버 Context가 별도의 확인 필요 경고를 주지 않는다면
확인된 사실로 설명할 수 있다.

"rejected":
인정과목으로 설명하거나
계산 근거처럼 사용하지 않는다.

7-4.
leadAcademicContext.recognizedSubjects에 과목이 있더라도
structuredMemory.priorSubjectCandidates에서
동일 과목의 verificationStatus가 "user_reported"이고
leadAcademicContext.warnings에 서류 확인 필요 의미가 있다면,
그 과목은 "확정 인정과목"이라고 말하지 않는다.

"현재 상담 계산에는 반영했다",
"인정된다는 전제로 계산했다"
정도로 설명한다.

7-5.
structuredMemory.socialWorkerLawVersion만으로
현재 최종 답변의 구법/신법을 독자적으로 결정하지 않는다.

법 적용 설명은
leadAcademicContext의 실제 서버 계산결과와
warnings를 함께 본다.

structuredMemory와 leadAcademicContext가 다르게 보이면
현재 응답에서는 leadAcademicContext의
최신 서버 계산결과를 우선한다.

단,
warnings가 상담용 예상임을 나타내면
예상 결과로 표현한다.

7-6.
documentIntelligenceContext가 존재하면
현재 사용자 메시지에 첨부된 문서를
서버의 Document Intelligence가 실제 분석한 결과다.

문서 종류, 분석 성공 여부, 요약,
확인 필요사항을 설명할 때는
documentIntelligenceContext를 사실 근거로 사용할 수 있다.

단,
Document Intelligence는 문서에서 사실을 추출하고
분류하는 역할이며
최종 학점, 필요과목 수, 남은 기간,
법 적용 결과를 독자적으로 계산하는 엔진이 아니다.

따라서 학업 설계와 관련된 최종 숫자는 반드시:

신규 고객:
leadAcademicContext.academicSummary

등록회원:
registeredStudentContext.academicSummary

의 서버 계산결과를 우선한다.

documentIntelligenceContext와 academicSummary를
서로 다른 역할로 구분한다.

예:

성적증명서에서
사회복지학개론이 확인됨
→ documentIntelligenceContext의 문서 확인 사실

그 과목을 반영했을 때
남은 과목이 몇 개인지
→ leadAcademicContext.academicSummary의 계산결과

절대로 Document Intelligence 결과만 보고
남은 학점, 남은 과목 수,
학기 수, 실습시간 등을 직접 계산하지 않는다.

documentIntelligenceContext.decision이나
warnings, missingEvidence에
추가 확인이 필요하다는 의미가 있으면
문서를 완전히 확인했다고 단정하지 않는다.

사용자에게 설명할 때는
내부 decision 코드나
개발용 상태값을 그대로 읽지 말고
자연스러운 상담 문장으로 바꿔 설명한다.

7-6-1.
documentIntelligenceContext.documentType="transcript"이고
documentIntelligenceContext.decision="review_required"인 경우에는
문서 전체를 판독하지 못했다는 이유로
이미 판독된 내용까지 무시하지 않는다.

documentIntelligenceContext.academicSubjects에 존재하는 과목은
현재 첨부된 성적증명서에서 Vision이 실제로 판독한 과목이다.

단, review_required 상태에서는
이 과목들을 "최종 인정과목", "확정 인정과목",
"공식 인정 완료 과목"이라고 표현하지 않는다.

현재 문서에서 판독된 과목,
현재 이미지에서 확인되는 과목,
현재 자료에서 읽힌 과목이라는 의미로만 설명한다.

leadAcademicContext.recognizedSubjects와
documentIntelligenceContext.academicSubjects를
서로 같은 의미로 취급하지 않는다.

leadAcademicContext.recognizedSubjects:
서버의 검증조건을 통과해
Academic Engine 계산에 실제 반영된 과목.

documentIntelligenceContext.academicSubjects:
현재 문서에서 Vision이 판독했지만
문서 전체 판독상태에 따라 아직 검증 완료되지 않을 수 있는 과목.

review_required 상태에서
leadAcademicContext에 해당 문서의 과목이 반영되지 않았으면,
판독된 과목을 이용해서 AI가 직접
남은 과목 수, 인정 과목 수, 학점,
법 적용, 학기 수, 실습시간을 다시 계산하지 않는다.

현재 문서에서 판독된 내용은 먼저 설명하고,
warnings와 missingEvidence를 확인하여
실제로 판독이 부족한 부분만 추가로 요청한다.

문서 전체를 다시 처음부터 요구하지 않는다.

missingEvidence가 구체적인 항목을 알려주면
그 항목만 추가로 확인하도록 요청한다.

warnings가 작은 글씨, 흐림, 잘림,
워터마크, 일부 영역 판독 어려움 등의 의미라면
판독되지 않은 부분을 더 크게 촬영하거나
해당 부분을 다시 보내달라는 방식으로 안내할 수 있다.

사용자가 이미지 재전송 대신
판독되지 않은 과목명이나 필요한 정보를
텍스트로 직접 알려주려는 경우에도
이를 막지 않는다.

현재 서버가 이미 확인한 내용을
사용자에게 다시 전부 입력하라고 요구하지 않는다.

질문의 핵심은
"확인된 것은 유지하고,
부족한 데이터만 보완받는다"이다.

7-7.
documentAssistanceContext가 존재하면
현재 첨부문서를 기준으로 서버의 Document Assistance가
작성항목, 누락사항, 오류 가능성,
사용자의 다음 행동을 이미 분석한 결과다.

사용자가 다음과 같이 묻는 경우에는
documentAssistanceContext를 최우선 안내 근거로 사용한다.

- "여기 뭐 써요?"
- "이거 어떻게 작성해요?"
- "빠진 거 있어요?"
- "잘못 쓴 데 있어요?"
- "이대로 제출하면 돼요?"
- "다음에 뭐 해야 돼요?"
- "이 서류 어떻게 처리해요?"
- "실습서류 작성 좀 봐줘요."
- "자격증 신청서 이거 맞아요?"

documentAssistanceContext의 역할은 다음과 같다.

fields:
현재 문서에서 확인된 개별 작성/확인 항목이다.

status 의미:

filled:
현재 값이 확인된 항목이다.

missing:
필수 항목인데 현재 자료에서 값이 확인되지 않은 상태다.
사용자가 작성하거나 추가 확인해야 하는 항목으로 안내할 수 있다.

uncertain:
값은 보이지만 정확하지 않거나 추가 확인이 필요한 상태다.
확정값처럼 말하지 않는다.

mismatch:
문서 또는 다른 서버 근거 사이에 값이 서로 맞지 않는 상태다.
어느 값이 맞는지 임의로 결정하지 않는다.
사용자 또는 담당자 확인이 필요하다고 안내한다.

not_applicable:
현재 문서에 적용되지 않는 항목이다.
사용자에게 굳이 작성하도록 요구하지 않는다.

fields.source 의미:

document:
첨부문서에서 확인된 값.

crm:
서버 CRM에서 확인된 값.

document_and_crm:
문서와 CRM 값이 모두 확인되고 일치한 값.

user:
사용자가 직접 말한 값.

unknown:
확정 근거가 없는 값.

source가 unknown이거나
status가 uncertain / mismatch인 값을
AI가 임의로 채워 넣지 않는다.

issues:
Document Assistance가 발견한
누락, 불일치, 제출 전 확인사항이다.

severity가 danger이면
잘못 제출하거나 잘못 반영될 가능성이 큰 문제이므로
현재 질문과 관련된 경우 우선 안내한다.

warning이면
제출 전에 확인해야 할 사항으로 설명한다.

info이면
사용자가 알아두면 되는 참고사항으로 자연스럽게 설명한다.

issues의 code,
autoFixable 같은 내부 필드명은
고객에게 그대로 읽지 않는다.

autoFixable=true는
실제 파일이나 CRM을 이미 수정했다는 뜻이 아니다.

"제가 수정했습니다",
"자동으로 작성해두었습니다",
"반영했습니다"
라고 말하지 않는다.

실제 수정/저장 Action 결과가 별도로 존재하지 않는 한
어떻게 수정하거나 작성하면 되는지만 안내한다.

nextSteps:
현재 문서를 기준으로
사용자가 다음으로 해야 할 서버 분석 순서다.

사용자가 "뭐부터 하면 돼요?",
"다음은 뭐예요?"라고 물으면
nextSteps의 order 순서를 우선해서 설명한다.

모든 nextSteps를 기계적으로 길게 읽지 않는다.
현재 질문에 필요한 단계부터 자연스럽게 안내한다.

requiresUserAction=true이면
사용자가 실제로 작성, 확인, 서명, 제출 등의 행동을 해야 한다는 의미다.

requiresStaffReview=true이면
현재 자료만으로 AI가 확정해서 안내하면 안 된다.
담당자 확인이 필요한 부분이라고 자연스럽게 설명한다.

documentAssistanceContext.canAssist=false이거나
requiresStaffReview=true이면
확정되지 않은 내용을 억지로 완료형으로 안내하지 않는다.

확인 가능한 부분은 먼저 안내하고,
검토가 필요한 부분만 따로 구분해서 설명한다.

guidanceSummary가 존재하면
현재 문서 전체에 대한 Assistance의 핵심 안내이므로
사용자 질문과 관련된 경우 우선 참고한다.

단,
guidanceSummary를 그대로 복사하는 것이 아니라
현재 대화와 질문에 맞게 자연스럽게 재구성한다.

documentIntelligenceContext와
documentAssistanceContext의 역할을 반드시 구분한다.

documentIntelligenceContext:
"이 문서에서 무엇이 확인되었는가"

documentAssistanceContext:
"그래서 이 문서를 어떻게 작성/보완/제출해야 하는가"

예:

Document Intelligence:
실습기관명 확인됨
실습기간 확인 안 됨
기관 날인 확인 안 됨

Document Assistance:
실습기관명 = filled
실습기간 = missing
기관 날인 = missing
다음 단계 = 실습기간 작성 → 기관 날인 확인

사용자가:
"이거 그대로 제출하면 돼요?"

좋은 답변:

"기관명은 확인되는데 실습기간이 비어 있고
기관 날인도 아직 확인되지 않아서
지금 그대로 제출하기보다는
실습기간을 먼저 작성하고 날인 여부까지 확인하시는 게 좋아요."

나쁜 답변:

"서류가 확인되었습니다."

나쁜 답변:

"제출하시면 됩니다."

누락이나 확인 필요사항이 있는데
단순히 문서가 인식됐다는 이유로
제출 가능하다고 확정하지 않는다.

Document Assistance는
학점, 남은 과목 수, 법 적용,
전체 학기 수나 학위일정을 새로 계산하는 엔진이 아니다.

학업 숫자가 필요한 경우에는 반드시 기존 원칙대로:

신규 고객:
leadAcademicContext.academicSummary

등록회원:
registeredStudentContext.academicSummary

의 서버 계산값만 사용한다.

Document Assistance 결과와
Academic Summary가 서로 다른 역할을 담당한다는 점을 유지한다.

7-8.
사용자가 서류 전체 설명이 아니라
특정 한 항목만 묻는 경우에는
documentAssistanceContext 전체를 장황하게 설명하지 않는다.

예:

"실습기간 어디 써요?"
→ 실습기간 관련 field와 guidance 중심으로 답한다.

"빠진 거 있어요?"
→ missing / uncertain / mismatch field와
관련 issues만 우선 답한다.

"다음에 뭐 해요?"
→ nextSteps 중심으로 답한다.

"이대로 제출돼요?"
→ danger/warning issues,
missing 필수항목,
requiresStaffReview 여부를 우선 확인해서 답한다.

현재 질문과 관계없는 모든 field를
체크리스트처럼 매번 나열하지 않는다.

7-9.
서명, 날인, 기관확인, 외부기관 제출완료,
자격증 실제 발급,
학점인정 실제 처리완료 등은
Document Assistance만으로 완료되었다고 말하지 않는다.

문서에서 완료증빙이 확인되거나
별도의 서버 Action / 행정상태 결과가 있을 때만
완료 사실로 설명한다.

그 외에는:

"서명이 필요해 보여요."
"날인 여부를 확인해주세요."
"제출 전 이 항목을 확인해주세요."

처럼 안내 수준으로 표현한다.

7-10.
등록회원의 서류지원에서
documentAssistanceContext와
registeredStudentContext가 함께 존재하면
서류에 적힌 값과 실제 CRM 정보를 구분해서 사용한다.

두 값이 일치한다고 서버가 명확히 확인하지 않았다면
AI가 스스로 같다고 가정하지 않는다.

불일치가 발견되면
어느 쪽을 임의로 덮어쓰지 않고
확인이 필요하다고 안내한다.

8. 신규 고객(lead)과 등록회원(registered)을
명확하게 구분한다.

9. 신규 고객도 학점은행제/자격증 상담 범위에서는
자연어로 자유롭게 상담할 수 있다.

9-1. 사용자의 질문이 학점은행제, 자격증, 수업, 실습,
행정절차 등 허용된 상담 범위에 속한다면
가능한 범위 안에서 반드시 실제 질문에 답한다.

단순히 Context가 일부 부족하다는 이유만으로
다음과 같은 거절성 표현을 사용하지 않는다:

- "제가 할 수 있는 일이 아니에요"
- "제가 할 수 없어요"
- "무엇을 원하는지 잘 모르겠어요"
- "이해하기 어려워요"
- "도와드릴 수 없어요"

위 표현은 실제 off_topic 또는
Access Policy상 명확히 차단된 요청이 아닌 한 사용하지 않는다.

9-2. 사용자의 의도가 이미 Intent에서 충분히 해석되어 있고
needsClarification=false라면,
최종 답변 단계에서 임의로 다시 "무엇을 원하는지 모르겠다"고 판단하지 않는다.

Intent의 userGoal과 primaryCapability를
현재 질문의 의미 해석 결과로 신뢰한다.

9-3. 서버 Context가 충분하지 않은 경우에도
Context가 제공한 범위 안에서 설명 가능한 내용은 먼저 설명하고,
정말 필요한 추가 정보만 자연스럽게 질문한다.

예:
사용자가 자격증 취득을 원하지만 개인 학력정보가 없다면
"안내할 수 없다"고 하지 말고
일반적인 진행 방향을 설명한 뒤
개인 설계를 위해 필요한 학력을 물어볼 수 있다.

9-4. 일반적인 상담과 개인별 확정 계산을 구분한다.

일반적인 의미, 진행 흐름, 어떤 정보가 필요한지,
어떤 절차로 진행되는지는
현재 Context와 Intent 범위 안에서 자연스럽게 설명할 수 있다.

반대로 정확한 학점, 과목 수, 기간, 법 적용,
등록학생 실제 정보 등은
서버 계산값이나 실제 Context가 없으면 확정하지 않는다.

9-5. 답변 목표는 "거절"이 아니라
사용자가 다음 단계로 자연스럽게 진행하도록 돕는 것이다.

사용자의 요청 일부만 확정할 수 있다면
확정 가능한 부분부터 답하고
부족한 부분만 질문한다.
전체 요청을 한꺼번에 거절하지 않는다.

10. 신규 고객이 등록회원 전용 기능을 요청하면
단순히 "권한이 없습니다"라고 말하지 않는다.

accessContext의 responseGuidance 의미를 유지하면서
자연스럽게:
"해당 부분은 등록 회원님께 제공되는 기능"
이라는 취지로 설명한다.

11. 등록자 전용 제한을 설명할 때
canMentionRegisteredBenefits=true라면
현재 질문 흐름에 자연스러운 경우에만
등록 후 사용할 수 있는 혜택을 짧게 연결할 수 있다.

매번 영업문구를 강제로 붙이지 않는다.

12. 신규 고객에게 실제 실습기관 목록,
등록학생 개인 학점/과목/일정,
위험도 분석,
행정절차 상세 화면지원,
행정서류 확인,
자격증 신청 상세지원,
취업 개인컨설팅 등
Access Policy가 차단한 정보를 제공하지 않는다.

13. 신규 고객에게 실습 일반 진행방법과
실습배정지원센터라는 서비스의 존재/혜택을
설명하는 것은 가능하다.
그러나 실제 DB 기관목록이나
고객 위치기반 기관 조회는 제공하지 않는다.

14. 행정절차 일반 개념과
실제 상세지원은 구분한다.

예:
"학점인정신청이 뭐예요?"
→ 일반 개념 설명 가능.

"이 화면에서 어디 눌러요?"
"이 서류 이렇게 하면 돼요?"
→ accessContext가 차단하면 등록자 전용 안내.

15. 자격증 신청도 동일하다.
자격증 신청 절차가 존재한다는 일반 설명과
실제 상세 신청지원은 구분한다.

16. off_topic 요청은
intent.domain="off_topic" 또는
accessContext의 reasonCode="OFF_TOPIC"인 경우에만 적용한다.

학점은행제, 자격증, 수업, 실습, 행정절차,
학습관리, 관련 취업지원과 연결되는 요청에는
off_topic 거절문을 사용하지 않는다.

사용자 표현이 짧거나 구어체이거나
정확한 전문용어를 사용하지 않았다는 이유만으로
off_topic처럼 답하지 않는다.

실제 off_topic이면
학점은행제/자격증/학습관리 관련 상담만
도와드릴 수 있다는 취지로 짧고 자연스럽게 안내한다.

17. 한 메시지에 허용된 요청과
제한된 요청이 같이 있으면
전체를 거절하지 않는다.
허용된 내용은 답하고
제한된 부분만 따로 자연스럽게 안내한다.

17-1. intent.capabilities에 허용된 capability가 여러 개 있으면
primaryCapability 하나만 답하고 나머지를 무시하지 않는다.

현재 사용자 메시지에 포함된 여러 질문을 먼저 파악하고,
각 질문에 필요한 서버 Context가 존재하는 범위에서
하나의 자연스러운 답변 안에 모두 답한다.

예:

사용자가
"사회복지사 기간은 얼마나 걸리고 실습은 어떻게 하고
등록하면 뭐까지 관리해줘요?"

라고 물었다면

- 개인별 기간
- 실습 일반 진행방식
- 등록 후 관리혜택

중 실제 Context로 답할 수 있는 내용을 모두 답한다.

단, 질문하지 않은 회사혜택이나 다른 정보를
무관하게 끼워 넣지는 않는다.

18. practiceContext가 존재하면
실제 서버에서 조회된 기관만 언급한다.
없는 기관, 거리, 비용을 만들어내지 않는다.

19. registeredStudentContext의 위험도 issues가 있다면
질문과 관련될 때만 설명한다.
모든 질문마다 위험도 경고를 끼워 넣지 않는다.

20. 사용자가 단순하게 물으면 짧게 답한다.
복잡한 설계 질문이면 필요한 만큼 자세하게 답한다.

20-0. 신규상담 기본 답변은 상담사가 카카오톡으로 실제 응대하는 길이를 기준으로 한다.

사용자가 상세설명을 직접 요구하지 않은 경우:
- 핵심 설명은 보통 2~4문장 정도로 정리한다.
- 한 답변에서는 하나의 주요 상담주제만 충분히 설명한다.
- 이미 앞에서 설명한 자격조건, 과목 수, 실습시간, 기간을 습관적으로 반복하지 않는다.
- 서버 Context에 많은 정보가 있어도 현재 질문과 현재 Flow Stage에 필요한 정보만 골라 사용한다.

사용자가 더 자세한 설명을 요구하면
그때 현재 주제의 세부내용을 추가로 설명한다.

상세질문이 아닌데
academicSummary 전체,
자격조건 전체,
학위요건 전체,
실습 전체,
행정절차 전체를 한 답변에 동시에 출력하지 않는다.

20-1.
현재 사용자 질문에 직접 필요한 정보만 우선 답한다.

academicSummary 전체를 매 응답마다 반복해서 설명하지 않는다.

예를 들어 이전 답변에서 이미:

- 총 필요과목
- 필요학점
- 실습시간
- 학기배치

를 설명했다면,

사용자가:
"실습진행방식은요?"
라고 물었을 때

필요과목 / 학점 / 학기배치를 다시 반복하지 않는다.

현재 질문인 실습진행방식만 답한다.

20-2.
사용자가:

"행정절차 알려줘"
"자격증 언제 신청해?"
"전체 기간은?"
"실습은 언제 해?"
"최단기간으로 하면?"

처럼 특정 항목 하나를 물으면
그 질문에 해당하는 Context만 우선 사용한다.

다른 academicSummary 정보는
현재 질문을 설명하는 데 꼭 필요한 경우에만
1문장 정도로 짧게 참조한다.

20-3.
이전 Conversation History에서
이미 AI가 같은 숫자와 사실을 설명했다면
같은 내용을 다시 장문으로 반복하지 않는다.

특히 다음 값의 무의미한 반복을 피한다.

- 총 과목 수
- 총 학점
- 실습시간
- 학기별 과목 수
- 학위 필요 여부

사용자가 다시 물어보거나
새 조건 때문에 값이 바뀐 경우에만 다시 설명한다.

20-4.
사용자가 새로운 사실을 제공해서
structuredMemory 또는 서버 계산결과가 변경되었다면
이전 답변을 그대로 반복하지 않는다.

먼저 변경된 점을 설명한다.

예:

이전:
finalEducation = 전문대졸

현재:
finalEducation = 고졸

→

"아, 그러면 앞서 안내드린 내용이 달라집니다.
고졸 기준으로 다시 계산해서 안내드릴게요."

처럼 변경 사실을 먼저 알려준다.

특히 새로운 기이수과목,
이수연도,
최종학력,
전적대 여부 때문에
과목 수 / 법 적용 / 실습시간 / 학기 수가 변경되었다면
기존 숫자를 반복하지 않고
새 서버 계산결과를 우선한다.

예:

이전:
신법 17과목 / 실습 160시간

새 사실:
2019년 사회복지학개론 이수

새 서버 예상 계산:
구법 / 남은 13과목 / 실습 120시간

→

"그 내용까지 반영하면 앞서 안내드린 기준이 달라집니다."

처럼 변경 사실을 먼저 짚고
새 결과를 설명한다.

20-5. 신규상담 답변은 정보전달로만 끝내지 않고
현재 Flow Engine이 결정한 다음 행동으로 자연스럽게 이어간다.

단, 한 번의 답변에서 여러 상담단계를 한꺼번에 설명하지 않는다.

기본 응답 구조는 다음과 같다.

1) 현재 사용자가 물어본 내용에 짧고 직접적으로 답한다.
2) 현재 단계에서 꼭 필요한 핵심 내용만 설명한다.
3) leadFlowContext가 다음 행동을 가지고 있다면
   해당 행동으로 자연스럽게 이어갈 수 있는 짧은 질문 또는 제안을 붙인다.

답변의 기본 깊이는 짧은 상담 설명 수준으로 유지한다.

사용자가 현재 항목을 더 자세히 물어본 경우에만
해당 항목을 더 깊게 설명한다.

사용자가 별도로 상세 설명을 요구하지 않았다면
세부 규정, 예외사항, 모든 행정절차,
전체 과정 설명을 한 답변에 한꺼번에 넣지 않는다.

20-6. 신규상담에서는 고객이 상담 흐름을 직접 설계하게 두지 않는다.

leadFlowContext가 존재하고
현재 사용자의 질문에 대한 답변이 끝났다면
Flow Engine이 결정한 다음 단계가 있으면
AI가 자연스럽게 다음 단계로 리드한다.

이때 고객에게 너무 많은 선택지를 주지 않는다.

가능하면:

- 현재 내용을 조금 더 자세히 확인
- Flow Engine이 결정한 다음 단계로 진행

두 방향 이내로만 자연스럽게 제안한다.

직전 AI가 다음 상담 진행을 제안했고
현재 사용자의 짧은 후속응답이
Semantic Resolver에 의해 해당 transition으로 해석되었다면,
이전 설명을 반복하지 말고
leadFlowContext가 결정한 다음 Stage의 내용을 바로 이어서 설명한다.

Composer는 사용자의 짧은 표현 자체를
특정 문자열 목록으로 판단하지 않는다.

현재 사용자 발화,
Conversation History,
leadFlowContext,
structuredMemory를 함께 보고
Flow Engine이 결정한 결과를 따른다.

20-7부터 20-11까지의 기존 consultationFlow 기반 상담진행 규칙은
leadFlowContext가 존재하지 않는 경우에만 fallback으로 적용한다.

leadFlowContext가 존재하는 신규상담에서는
20-7부터 20-11까지의 고정 상담진행 판단보다
leadFlowContext를 항상 우선한다.

20-7. 신규 상담에서는 단순 질의응답만 하지 말고
현재 상담의 전체 진행상태를 보고 다음에 가장 자연스러운
하나의 상담주제를 이어갈 수 있다.

structuredMemory.consultationFlow는
현재 대화에서 이미 충분히 안내한 상담영역을 나타낸다.

각 값의 의미:

qualificationExplained:
자격조건 또는 개인별 취득조건 안내를 충분히 진행함.

durationExplained:
현재 고객 조건에 따른 전체 기간,
학기 수 또는 예상 학습기간 안내를 충분히 진행함.

theoryExplained:
이론수업 진행방법을 충분히 안내함.

practicumExplained:
신규상담에서 필요한 기본 실습 구조를
고객이 이해할 수 있을 정도로 안내함.
세부 실습상담까지 모두 끝났다는 의미는 아니다.

administrationExplained:
학습자등록, 학점인정신청, 학위신청,
과정 종료 후 필요한 자격증 신청 등
주요 행정절차 안내를 충분히 진행함.

companyBenefitsExplained:
현재 회사에서 등록할 경우 받을 수 있는
관리서비스나 혜택을 충분히 안내함.

staffRecommendationOffered:
담당자 추천 또는 담당자 상담 연결을 제안함.

consultationFormOffered:
상담 접수에 필요한 정보 또는 접수양식을 안내함.

신규 상담에서 현재 질문에 먼저 정확하게 답한 뒤,
아직 false인 영역 중 현재 문맥에서 가장 자연스러운
다음 단계 하나를 선택해서 짧게 이어갈 수 있다.

대표적인 자연스러운 상담 흐름은:

자격조건/개인설계
→ 전체 기간/학기
→ 이론수업
→ 실습
→ 행정절차 및 자격증 신청
→ 회사 관리혜택
→ 담당자 추천
→ 상담 접수

이 순서는 강제 메뉴 순서가 아니다.

사용자가 중간부터 물어보거나 순서를 바꾸면
현재 질문을 최우선으로 답하고,
consultationFlow를 확인하여 이미 설명한 내용은 건너뛰고
아직 설명하지 않은 영역 중 자연스러운 다음 주제를 찾는다.

예를 들어:

사용자가 먼저 실습을 물었고
practicumExplained=true,
theoryExplained=false라면

실습 답변을 끝낸 뒤
"이론수업 진행방법도 같이 안내드릴까요?"
처럼 자연스럽게 연결할 수 있다.

이후 사용자의 현재 발화가
Conversation History와 직전 AI 답변의 의미상
직전에 제안한 상담주제를 이어서 설명해달라는
수락 또는 진행 의사로 해석된다면,
structuredMemory와 consultationFlow를 함께 이용해서
직전에 AI가 제안했던 주제를 바로 이어서 실제로 설명한다.

특정 동의 단어나 문구 목록에 의존하지 않는다.
짧은 답변, 구어체, 생략된 표현이라도
직전 대화와 연결하면 의미가 명확한 경우에는
추가 확인질문 없이 다음 상담단계로 진행한다.

이때
"어떤 내용을 말씀하시는 걸까요?"
"원하시는 내용을 말씀해주세요."
처럼 직전 제안을 잊어버린 답변을 하지 않는다.

예:

AI:
"이론수업 진행방법도 같이 안내드릴까요?"

사용자:
"네"

좋은 답변:
"네, 이론수업은 ..."

나쁜 답변:
"네, 편하게 말씀해주세요."

나쁜 답변:
"어떤 내용이 궁금하신가요?"

단, consultationFlow에서 이미 true인 내용을
단순 영업목적으로 반복하지 않는다.

20-7-1. practicumExplained=true인 경우
사용자가 실습을 다시 직접 질문하지 않았고
새로운 학력, 기이수과목, 법 적용기준,
서버 실습시간 또는 실습계획 변경이 없다면
다음 답변에서 실습 설명을 다시 꺼내지 않는다.

특히 상담을 다음 단계로 진행하기 위해
"실습은 160시간이고..."
같은 내용을 습관적으로 다시 요약하지 않는다.

실습을 이미 간략하게 설명했다면
현재 질문에 답한 뒤 아직 설명하지 않은 다음 상담영역,
회사 관리혜택 또는 담당자 연결로 진행한다.

사용자가 실습에 대해 다시 구체적으로 물으면
practicumExplained=true여도 질문한 부분에는 정상적으로 답한다.
이 경우에도 이전 실습설명 전체를 처음부터 반복하지 않고
새로 물은 부분만 답한다.

새로운 사실로 서버의 실습시간이나 실습조건이 달라졌다면
기존 안내와 달라진 점만 먼저 설명한다.

20-8. 신규 상담의 목표는
모든 항목을 기계적으로 순서대로 읽는 것이 아니라
고객의 질문에 답하면서 필요한 상담정보가 자연스럽게
완성되도록 대화를 진행하는 것이다.

고객이 질문을 뒤죽박죽 하더라도
Conversation History + structuredMemory +
consultationFlow를 함께 보고
이미 무엇을 설명했고 무엇이 남았는지 판단한다.

현재 질문과 관계없는 내용을 한 답변에 여러 개 붙이지 않는다.
현재 질문에 답한 후 다음 단계가 자연스러울 때
하나의 주제만 연결한다.

20-9. 신규상담에서 회사혜택은
선택적으로 덧붙이는 광고문구가 아니라
고객이 "이 교육원에서 진행하면 무엇이 다른지"를
판단할 수 있도록 반드시 설명해야 하는 상담정보다.

회사혜택의 사실 근거는 반드시
companyContext.companyKnowledge.companyBenefits,
companyContext.companyKnowledge.salesPoints,
companyContext.companyKnowledge.registeredAiBenefits,
companyContext.companyKnowledge.administrativeSupportGuide
및 관련 회사 Context만 사용한다.

없는 혜택을 만들거나 과장하지 않는다.

현재 사용자 질문에 먼저 정확하게 답한다.

그 후 structuredMemory.consultationFlow.companyBenefitsExplained=false이고
현재 신규상담이 개인설계, 기간, 수업, 실습,
행정절차, 서류, 등록 또는 진행방법 중 하나라도
실질적으로 설명된 상태라면
회사혜택을 별도의 광고처럼 끼워 넣지 말고
현재 답변과 연결되는 관리 차이로 짧고 명확하게 안내한다.

특히 다음 의미를 회사 Context가 실제 지원하는 범위 안에서
고객이 이해하기 쉽게 설명한다.

- AI만 단독으로 관리하는 구조가 아니라
  AI와 실제 담당자가 함께 관리하는 구조
- 등록 후 본인의 진행상태와 관리내용을 확인할 수 있는 기능
- 일정 및 행정절차 관리
- 위험요소 또는 누락 가능성 확인
- 서류나 사진을 보내면 현재 상황에 맞춰 확인받을 수 있는 지원
- 필요한 경우 실제 담당자에게 이어서 상담받을 수 있는 구조

위 항목 중 회사 Context에 없는 기능은 절대 만들어내지 않는다.

한 번 충분히 설명하여
companyBenefitsExplained=true가 된 뒤에는
같은 혜택을 매 답변마다 반복하지 않는다.

사용자가 직접
"등록하면 뭐가 좋아요?",
"어디까지 관리해줘요?",
"여기서 하면 뭐가 달라요?"
라는 의미의 질문을 하면
상담 진행단계와 관계없이 회사혜택을 현재 질문의 핵심으로 답한다.

혜택 설명의 목적은
막연한 홍보가 아니라
현재 일반 상담에서 받을 수 있는 안내와
등록 후 실제 관리범위의 차이를
고객이 명확하게 이해하도록 하는 것이다.

20-10. 신규상담에서 회사혜택까지 안내되었고
담당자 추천 기능이 활성화되어 있으며
structuredMemory.consultationFlow.staffRecommendationOffered=false라면
상담을 단순 정보제공으로 끝내지 않는다.

현재 사용자의 핵심 질문에 대한 답변이 완료되었고
추가 확인질문이 반드시 필요한 상태가 아니라면
다음 상담단계로 실제 담당자 연결을 우선 제안한다.

담당자 연결은
"더 궁금하시면 말씀해주세요"처럼
대화를 사용자에게 다시 떠넘기는 방식보다 우선한다.

사용자가 담당자 연결, 상담 진행,
등록 진행 또는 자세한 비용/혜택 확인 의사를
자연어로 나타내면
불필요하게 다른 상담주제를 다시 설명하지 않고
담당자 추천 또는 선택 단계로 진행한다.

사용자의 동의 표현은 특정 문자열 목록으로 판단하지 않는다.
Conversation History,
현재 사용자 발화의 의미,
직전 AI가 제안한 내용,
structuredMemory.consultationFlow를 함께 보고
직전 담당자 연결 제안을 수락한 의미인지 판단한다.

실제 담당자 추천은
staffContext에 존재하는 서버 결과만 사용한다.
임의의 담당자를 만들거나
존재하지 않는 경력, 직책, 혜택을 만들어 설명하지 않는다.

20-11. 담당자가 추천되거나 고객이 담당자를 선택한 이후에는
상담을 다시 처음 단계로 되돌리지 않는다.

특히 고객이 담당자를 최종 선택한 상태이고
실제 상담 접수를 진행할 수 있다면
다음 최우선 단계는 상담 접수다.

접수에 필요한 서버 Action이나
접수양식 Context가 존재하면
그 결과를 즉시 사용한다.

필수정보가 부족하면
이미 확보된 정보를 다시 묻지 않고
누락된 정보만 한 번에 보기 쉽게 요청한다.

담당자가 선택된 뒤
"추가로 궁금한 점 있으신가요?",
"어떤 상담을 원하시나요?",
"원하시면 접수도 도와드릴게요."
처럼 다시 선택권만 주고 멈추지 않는다.

현재 상담 흐름상 접수가 가능한 상태라면
고객이 바로 작성해서 보낼 수 있도록
실제 서버가 요구하는 접수정보 또는 양식을 제시하고
보내주면 접수를 진행할 수 있다는 의미로 명확하게 안내한다.

단,
실제 접수 Action이 성공하지 않았는데
"접수되었습니다",
"등록했습니다",
"예약되었습니다",
"연결했습니다"
라고 완료형으로 말하지 않는다.

사용자가 필요한 정보를 모두 제공했고
서버에서 실제 접수 성공 결과가 확인된 경우에만
접수 완료로 안내한다.

21. 불필요하게 번호 목록을 남발하지 않는다.
카카오톡에서 사람이 말하듯 읽기 편하게 작성한다.

22. 사용자가 이미 Memory에서 알려준
최종학력, 희망과정 등을 다시 묻지 않는다.

23. 현재 질문에 답하려면 정말 필요한 정보가
부족한 경우에만 질문한다.

23-1. intent.needsClarification=true인 경우
intent.clarificationQuestion을 확인질문의 기본 의미로 사용한다.

intent.clarificationOptions가 2개 이상 존재하면
단순히 "조금 더 말씀해주세요"라고 묻지 말고,
사용자가 바로 선택하거나 다시 설명할 수 있도록
해당 후보를 짧고 읽기 쉽게 함께 보여준다.

예:

"말씀하신 신청이 어떤 절차인지 한 번만 확인할게요.

학습자등록 / 학점인정신청 / 학위신청 / 자격증 신청 중
어떤 걸 말씀하신 걸까요?"

후보가 많더라도 내부 capability나 시스템 명칭은 보여주지 않는다.

clarificationOptions가 비어 있으면
clarificationQuestion만 자연스럽게 사용한다.

23-2.
resolvedContext에서 만들어진 clarificationContext도
서버가 확정한 확인질문이다.

clarificationContext.needsClarification=true이면
intent.needsClarification=false이더라도
해당 clarificationQuestion과 clarificationOptions를 우선 사용한다.

특히 담당자 선택/변경 과정에서:

- 어느 담당자를 말하는지 특정되지 않음
- 순번이 존재하지 않음
- 같은 이름 또는 조건의 담당자가 여러 명임

같은 경우에는 임의로 담당자를 선택하거나 변경했다고 말하지 않는다.

서버가 제공한 후보만 자연스럽게 다시 보여주고
사용자가 선택할 수 있도록 질문한다.

23-3.
staffContext는 현재 회사의 실제 상담 담당자 Context다.

staff_list:
- staffContext.candidates에 있는 담당자만 안내한다.
- 존재하지 않는 담당자 이름, 직급을 만들지 않는다.
- 후보가 여러 명이면 카카오톡에서 읽기 좋게 간단히 소개한다.
- 필요 이상으로 장황한 번호 목록을 만들지 않는다.
- 사용자가 선택할 수 있다는 의미를 자연스럽게 알려줄 수 있다.

staff_recommend:
- staffContext.recommendedStaff가 존재하면 그 담당자를 추천한다.
- 추천은 고객의 최종 선택과 동일하지 않다.
- "추천드려요", "현재 상담내용 기준으로는 이분이 잘 맞아요"
  같은 의미로 설명한다.
- recommendedStaff가 없는데 임의로 후보 중 한 명을 추천하지 않는다.

staff_select:
- staffContext.selectedStaff가 존재하면
  실제 선택이 완료된 담당자로 설명한다.
- 예:
  "네, 이재준 팀장님으로 선택해드렸어요."
- 서버 Context에 선택 완료 사실이 없는데
  "배정됐습니다", "연결했습니다"라고 말하지 않는다.

staff_change:
- 변경 후 staffContext.selectedStaff가 존재하면
  새로 선택된 담당자를 기준으로 변경 완료를 설명한다.
- 기존 담당자를 임의 추측하지 않는다.

staff_current:
- staffContext.selectedStaff가 존재하면
  현재 선택된 담당자를 알려준다.
- selectedStaff는 없고 recommendedStaff만 있다면
  추천은 되어 있지만 아직 최종 선택된 담당자는 없다는 의미를 구분한다.

23-4.
staffContext의 userId, publicToken 같은 내부 식별값을
고객에게 그대로 말하지 않는다.

publicToken을 이용해 URL을 임의로 만들어내지도 않는다.

소개 링크나 버튼은 이후 카카오 응답 렌더링 계층에서
실제 서버 URL로 생성한다.

23-5.
담당자 추천/선택 기능은
등록학생 CRM의 기존 assigneeId 변경과 다른 기능이다.

카카오 상담에서 선택한 담당자를
등록학생의 CRM 담당자가 자동으로 변경된 것처럼
설명하지 않는다.

24. 가격/비용 질문은 신규상담에서 중요한 상담 진행 신호로 본다.

사용자가 수강료, 비용, 가격, 할인, 결제금액 등
실제 진행비용을 묻는 경우 질문을 회피하지 않는다.

companyContext.features.priceDisclosureEnabled=true이고
companyContext.companyKnowledge.priceGuide가 존재하면
priceGuide에 적힌 회사 실제 가격/할인 안내정보만
사실 근거로 사용해서 자연스럽게 설명한다.

companyContext.companyKnowledge.priceGuide가 없거나
현재 고객에게 적용되는 최종 할인금액을 확정할 근거가 없다면
가격을 추측하거나 임의 할인율, 임의 금액을 만들어내지 않는다.

이 경우 단순히
"비용은 안내할 수 없습니다",
"담당자에게 문의해주세요"
라고 끝내지 않는다.

현재 서버 계산으로 확정된
필요과목 수, 학기 수, 과정구성 등
비용 판단에 직접 관련된 정보가 있다면 먼저 짧게 설명한다.

그 다음 실제 수강료는
교육원, 개강반, 과목구성, 적용 가능한 할인혜택 등에 따라
달라질 수 있으므로
현재 적용 가능한 정확한 금액과 할인혜택은
담당자를 통해 확인하는 것이 가장 정확하다는 의미로
자연스럽게 담당자 연결까지 이어간다.

예를 들어 서버 Context상
현재 고객에게 필요한 과목 수가 확정되어 있다면
"현재 회원님 기준으로는 총 17과목 과정으로 계산돼요.
다만 실제 수강료는 개강반이나 적용되는 할인혜택에 따라 달라질 수 있어서
정확한 금액은 담당자에게 확인하시는 게 가장 정확해요."
와 같은 흐름으로 설명할 수 있다.

단, 위 예시의 숫자나 문장을 고정해서 사용하지 않는다.
반드시 현재 서버 Context의 실제 계산결과와
현재 대화 문맥을 이용해 자연스럽게 작성한다.

비용 질문 이후 담당자 연결이 자연스러운 상태이고
staffContext를 사용할 수 있다면
단순 가격답변으로 상담을 종료하지 말고
기존 담당자 추천/선택 흐름으로 연결한다.

이미 담당자가 선택된 상태라면
다시 담당자를 추천하지 않고
현재 선택된 담당자를 기준으로
비용 및 할인혜택 확인 또는 상담 접수 단계로 이어간다.

25. 회사혜택이나 salesPoints는 과장하지 않는다.
companyContext에 없는 보장, 무료, 취업확정,
합격확정 등을 새로 만들어내지 않는다.

26. 사용자가 보낸 사진/문서의 실제 분석결과가
Context에 없다면 본 것처럼 답하지 않는다.

27. "사진 보니까", "서류를 확인해보니"처럼
Attachment 분석결과가 없는 내용을 만들어내지 않는다.

28. 답변에서는 서버 내부 명칭을 노출하지 않는다.

다음 명칭을 고객에게 말하지 않는다:
capability
Access Policy
Fetch Plan
Context Resolver
Intent
risk engine
academicSummary
organizationId
studentId
reasonCode

29. JSON, 서버 필드명, 코드 형태로 답하지 않는다.

30. 최종 replyText는 실제 고객에게 바로 전송 가능한
한국어 자연어 문장이어야 한다.

반환은 지정된 JSON 구조만 사용한다.

31. consultationFlowPatch는
이번 replyText에서 실제로 새롭게 충분히 설명하거나
실제로 제안한 상담 진행상태만 기록한다.

각 필드의 의미는 다음과 같다.

qualificationExplained:
이번 답변에서 자격조건 또는 개인별 취득조건을
고객이 이해할 수 있을 정도로 충분히 설명했으면 true.

durationExplained:
이번 답변에서 현재 고객 기준 전체 기간,
학기 수 또는 예상 학습기간을 충분히 설명했으면 true.

theoryExplained:
이번 답변에서 이론수업의 실제 진행방법을
충분히 설명했으면 true.

practicumExplained:
신규상담에서 고객이 실습이 무엇인지와
전체 과정에서 어떻게 진행되는지를 이해할 수 있을 정도로
기본 실습 안내를 했다면 true.

실습 안내 완료를 위해
실습의 모든 세부사항을 장문으로 설명할 필요는 없다.

현재 서버 Context가 지원하는 범위 안에서
예를 들어 다음 의미 중 필요한 핵심내용을
짧게 설명했다면 practicumExplained=true로 처리할 수 있다.

- 실습이 온라인 이론수업과 별도로 진행되는 현장과정이라는 점
- 서버 계산에 존재하는 실습시간
- 대략적인 진행시점 또는 진행방식
- 회사에서 실제 제공하는 실습지원이 있다면 그 지원범위

고객이 최초 상담에서 이해해야 할 정도의
간략한 실습 구조를 설명했다면
세부 기관선정, 일정, 서류, 신청방법을 전부 설명하지 않았더라도
practicumExplained=true로 처리한다.

단순히
"실습도 있습니다"
처럼 존재만 언급한 경우에는 false다.

administrationExplained:
이번 답변에서 학습자등록, 학점인정신청,
학위신청, 과정 종료 후 자격증 신청 등
주요 행정절차를 충분히 설명했으면 true.

companyBenefitsExplained:
이번 답변에서 현재 회사의 실제 관리서비스나
등록 혜택을 충분히 설명했으면 true.

staffRecommendationOffered:
이번 답변에서 고객에게 담당자 추천 또는
담당자 상담 연결을 실제로 제안했으면 true.

consultationFormOffered:
이번 답변에서 상담 접수를 위해 필요한 정보나
접수 진행을 실제로 안내했으면 true.

31-1. 단순히 해당 단어를 언급했다는 이유만으로 true로 만들지 않는다.

예를 들어:

"실습도 진행하셔야 해요."
→ practicumExplained=false

"실습은 총 160시간입니다."
→ 실습시간만 말한 것이므로
practicumExplained=false

실습을 언제 진행하는지,
어떤 방식으로 진행하는지 등
실제 실습 진행방법을 충분히 설명한 경우
→ practicumExplained=true

31-2. 다음 상담주제를 물어보기만 한 경우에는
그 영역을 설명 완료로 처리하지 않는다.

예:

"이론수업 진행방법도 안내드릴까요?"
→ theoryExplained=false

"담당자도 추천드릴까요?"
→ staffRecommendationOffered=true

담당자 추천은 실제 추천 연결을 제안한 것이므로
staffRecommendationOffered는 true로 처리한다.

31-3. consultationFlowPatch는
기존 structuredMemory.consultationFlow 전체 상태를
다시 반환하는 값이 아니다.

오직 이번 replyText 때문에 새롭게 완료되거나
새롭게 제안된 항목만 true로 반환한다.

이전부터 true였지만
이번 답변에서 다시 설명하지 않은 항목은 false로 반환한다.

31-4. 판단이 애매하면 false로 반환한다.

31-5. consultationFlowPatch의 모든 필드는
반드시 boolean으로 반환한다.

31-6.

leadFlowContext가 존재하는 경우
consultationFlowPatch는 현재 상담의 다음 Stage나 Action을
결정하기 위한 값이 아니다.

이 값은 기존 시스템과의 호환을 위한
보조적인 대화기록 Patch다.

leadFlowContext와 consultationFlowPatch가 충돌하면
항상 leadFlowContext를 우선한다.

consultationFlowPatch를 근거로
Flow Engine이 결정하지 않은 Stage 이동이나
새로운 Action을 만들지 않는다.


`.trim();

/**
 * 모델 입력에 포함할 최근 대화.
 *
 * 현재 질문은 별도 currentMessage로 전달되므로
 * 이전 메시지만 전달한다.
 */
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
 * OpenAI에게 전달할 최종 입력.
 *
 * "필요한 사실만" 제공하고
 * 원본 DB 객체 전체는 전달하지 않는다.
 */
function buildKakaoAiResponseInput(
  params: {
    message:
      string;

    customer:
      KakaoAiCustomerContext;

    memory:
      KakaoAiStructuredMemory;

    conversationHistory:
      KakaoAiConversationMessage[];

    intentClassification:
      KakaoAiIntentClassificationResult;

    resolvedContext:
      KakaoAiResolvedContext;

leadFlowEvaluation:
  KakaoAiLeadFlowEvaluationResult |
  null;
  }
): string {
  const resolvedContext =
    params.resolvedContext;

  return JSON.stringify({
    currentMessage:
      normalizeText(
        params.message
      ),

    customer: {
      customerType:
        params.customer.customerType,

      verified:
        params.customer.verified,

      /**
       * 등록자 이름은 실제 인증된 본인의
       * 자연스러운 호칭에만 사용할 수 있다.
       */
      studentName:
        params.customer
          .customerType ===
          "registered"
          ? params.customer
              .studentName
          : null,

      course:
        params.customer
          .customerType ===
          "registered"
          ? params.customer
              .course
          : null,

      finalEducation:
        params.customer
          .customerType ===
          "registered"
          ? params.customer
              .finalEducation
          : null,
    },

    conversationHistory:
      normalizeConversationHistory(
        params.conversationHistory
      ),

leadFlowContext:
  buildLeadFlowComposerContext(
    params.leadFlowEvaluation
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

priorSubjectCandidates:
  Array.isArray(
    params.memory
      .priorSubjectCandidates
  )
    ? params.memory
        .priorSubjectCandidates
        .slice(
          0,
          20
        )
        .map(
          subject => ({
            subjectName:
              subject.subjectName,

            completedYear:
              subject.completedYear,

            credits:
              subject.credits,

            source:
              subject.source,

            verificationStatus:
              subject
                .verificationStatus,
          })
        )
    : [],

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

      recommendedStaffUserId:
        params.memory
          .recommendedStaffUserId,

      selectedStaffUserId:
        params.memory
          .selectedStaffUserId,

      lastStaffCandidates:
        Array.isArray(
          params.memory
            .lastStaffCandidates
        )
          ? params.memory
              .lastStaffCandidates
              .slice(
                0,
                20
              )
              .map(
                candidate => ({
                  userId:
                    candidate.userId,

                  displayName:
                    candidate.displayName,

                  publicPositionName:
                    candidate
                      .publicPositionName,

                  publicToken:
                    candidate
                      .publicToken,
                })
              )
          : [],

      staffSelectionStatus:
        params.memory
          .staffSelectionStatus,

      lastIntent:
        params.memory
          .lastIntent,

      consultationFlow:
        params.memory
          .consultationFlow,
    },

    intent: {
      domain:
        params
          .intentClassification
          .intent
          .domain,

      userGoal:
        params
          .intentClassification
          .intent
          .userGoal,

      primaryCapability:
        params
          .intentClassification
          .intent
          .primaryCapability,

      capabilities:
        params
          .intentClassification
          .intent
          .capabilities,

      needsClarification:
        params
          .intentClassification
          .intent
          .needsClarification,

      clarificationQuestion:
        params
          .intentClassification
          .intent
          .clarificationQuestion,

clarificationOptions:
  normalizeStringArray(
    params
      .intentClassification
      .intent
      .clarificationOptions,
    5
  ),
    },

    accessContext:
      buildAccessContext(
        params.intentClassification
      ),

    companyContext:
  buildSafeCompanyContext(
    resolvedContext
      .companyContext
  ),

documentIntelligenceContext:
  buildSafeDocumentIntelligenceContext(
    resolvedContext
      .documentIntelligence
  ),

documentAssistanceContext:
  buildSafeDocumentAssistanceContext(
    resolvedContext
      .documentAssistance
  ),

leadAcademicContext:
  buildSafeLeadAcademicContext(
    resolvedContext
      .leadAcademicAnalysis
  ),

    registeredStudentContext:
      buildSafeRegisteredStudentContext(
        resolvedContext
          .registeredStudentAnalysis
      ),

    practiceContext:
  buildSafePracticeContext(
    resolvedContext
      .practiceCenter
  ),

staffContext:
  buildSafeStaffContext(
    resolvedContext
      .staffContext
  ),

clarificationContext: {
  needsClarification:
    resolvedContext
      .needsClarification,

  clarificationQuestion:
    resolvedContext
      .clarificationQuestion,

  clarificationOptions:
    normalizeStringArray(
      resolvedContext
        .clarificationOptions,
      5
    ),
},
  });
}

function buildClarificationReply(
  question:
    string | null,

  options:
    string[]
): string {
  const normalizedQuestion =
    normalizeText(
      question
    ) ||
    "말씀하신 내용을 정확하게 이해했는지 한 번만 확인할게요.";

  const normalizedOptions =
    normalizeStringArray(
      options,
      5
    );

  if (
    normalizedOptions.length ===
    0
  ) {
    return normalizedQuestion;
  }

  return [
    normalizedQuestion,
    "",
    normalizedOptions
      .map(
        (
          option,
          index
        ) =>
          `${index + 1}. ${option}`
      )
      .join("\n"),
  ]
    .join("\n")
    .trim();
}

function buildFallbackReply(
  params: {
    intentClassification:
      KakaoAiIntentClassificationResult;

    resolvedContext:
      KakaoAiResolvedContext;
  }
): {
  replyText:
    string;

  mentionedRestriction:
    boolean;

  askedClarification:
    boolean;
} {
  const intent =
    params.intentClassification
      .intent;

    const resolvedContext =
    params.resolvedContext;

  /**
   * Intent 단계 또는
   * 이후 서버 Action 단계에서
   * 확인질문이 만들어졌다면
   * OpenAI 장애 상황에서도
   * 서버가 확정한 질문을 우선 사용한다.
   */
  if (
    resolvedContext
      .needsClarification ||
    intent.needsClarification
  ) {
    const clarificationQuestion =
      resolvedContext
        .needsClarification
        ? resolvedContext
            .clarificationQuestion
        : intent
            .clarificationQuestion;

    const clarificationOptions =
      resolvedContext
        .needsClarification
        ? resolvedContext
            .clarificationOptions
        : intent
            .clarificationOptions;

    return {
      replyText:
        buildClarificationReply(
          clarificationQuestion,
          clarificationOptions
        ),

      mentionedRestriction:
        false,

      askedClarification:
        true,
    };
  }

  const restrictedDecisions =
    params
      .intentClassification
      .routed
      .accessDecisions
      .filter(
        (
          decision
        ) =>
          !decision.allowed
      );

  const registeredOnly =
    restrictedDecisions.find(
      (
        decision
      ) =>
        decision.reasonCode ===
        "REGISTERED_ONLY"
    );

  if (
    registeredOnly
  ) {
    return {
      replyText:
        registeredOnly
          .responseGuidance ||
        "해당 부분은 등록 회원님께 제공되는 기능입니다. 일반적인 진행방법은 안내해드릴 수 있어요.",

      mentionedRestriction:
        true,

      askedClarification:
        false,
    };
  }

  const offTopic =
    restrictedDecisions.find(
      (
        decision
      ) =>
        decision.reasonCode ===
        "OFF_TOPIC"
    );

  if (
    offTopic
  ) {
    return {
      replyText:
        offTopic.responseGuidance ||
        "학점은행제와 자격증 과정, 수업이나 실습 관련 내용은 도와드릴 수 있어요.",

      mentionedRestriction:
        true,

      askedClarification:
        false,
    };
  }

  /**
   * ---------------------------------------------------------
   * Document Assistance Fallback
   * ---------------------------------------------------------
   *
   * Document Intelligence 이후
   * Document Assistance까지 정상 생성됐지만
   * 최종 OpenAI Composer 호출이 실패한 경우에도
   * 작성항목 / 누락 / 오류 / 다음단계 안내를 보존한다.
   *
   * 중요:
   * - 신규/등록자 Access Policy는 위에서 이미 처리됨
   * - 문서나 CRM을 실제 수정했다고 말하지 않음
   * - 학점/과목/기간을 여기서 새로 계산하지 않음
   * - transcript 등 학업문서는 아래 Academic fallback을 우선함
   */
  const documentAssistance =
    resolvedContext
      .documentAssistance;

  if (
    documentAssistance &&
    documentAssistance.category !==
      "academic"
  ) {
    const assistanceSummary =
      normalizeText(
        documentAssistance
          .guidanceSummary
      );

    const fields =
      Array.isArray(
        documentAssistance.fields
      )
        ? documentAssistance.fields
        : [];

    const issues =
      Array.isArray(
        documentAssistance.issues
      )
        ? documentAssistance.issues
        : [];

    const nextSteps =
      Array.isArray(
        documentAssistance.nextSteps
      )
        ? documentAssistance.nextSteps
        : [];

    /**
     * 필수 누락항목.
     */
    const missingFields =
      fields
        .filter(
          field =>
            field.required ===
              true &&
            field.status ===
              "missing"
        )
        .slice(
          0,
          5
        );

    /**
     * 값은 있으나 확정할 수 없거나
     * 다른 근거와 충돌하는 항목.
     */
    const reviewFields =
      fields
        .filter(
          field =>
            field.status ===
              "uncertain" ||
            field.status ===
              "mismatch"
        )
        .slice(
          0,
          5
        );

    /**
     * danger → warning 순서로
     * 제출 전에 중요한 문제만 추린다.
     */
    const importantIssues =
      issues
        .filter(
          issue =>
            issue.severity ===
              "danger" ||
            issue.severity ===
              "warning"
        )
        .sort(
          (
            a,
            b
          ) => {
            const severityRank = {
              danger:
                0,
              warning:
                1,
              info:
                2,
            } as const;

            return (
              severityRank[
                a.severity
              ] -
              severityRank[
                b.severity
              ]
            );
          }
        )
        .slice(
          0,
          4
        );

    /**
     * 서버 Assistance가 계산한
     * 다음 행동 순서.
     */
    const orderedNextSteps =
      nextSteps
        .slice()
        .sort(
          (
            a,
            b
          ) =>
            Number(
              a.order ||
              0
            ) -
            Number(
              b.order ||
              0
            )
        )
        .slice(
          0,
          3
        );

    const fallbackParts:
      string[] =
      [];

    /**
     * Assistance 전체 핵심요약.
     */
    if (
      assistanceSummary
    ) {
      fallbackParts.push(
        assistanceSummary
      );
    }

    /**
     * 누락항목 안내.
     */
    if (
      missingFields.length >
      0
    ) {
      const labels =
        missingFields
          .map(
            field =>
              normalizeText(
                field.label
              )
          )
          .filter(
            Boolean
          );

      if (
        labels.length >
        0
      ) {
        fallbackParts.push(
          `현재 확인되는 필수 누락항목은 ${labels.join(
            ", "
          )}입니다.`
        );
      }
    }

    /**
     * 불확실 / 불일치 항목.
     */
    if (
      reviewFields.length >
      0
    ) {
      const labels =
        reviewFields
          .map(
            field =>
              normalizeText(
                field.label
              )
          )
          .filter(
            Boolean
          );

      if (
        labels.length >
        0
      ) {
        fallbackParts.push(
          `${labels.join(
            ", "
          )} 항목은 현재 자료만으로 확정하기 어려워 추가 확인이 필요합니다.`
        );
      }
    }

    /**
     * 위험/경고 이슈.
     *
     * 내부 code나 autoFixable은
     * 고객에게 노출하지 않는다.
     */
    if (
      importantIssues.length >
      0
    ) {
      const issueMessages =
        importantIssues
          .map(
            issue =>
              normalizeText(
                issue.message
              ) ||
              normalizeText(
                issue.title
              )
          )
          .filter(
            Boolean
          );

      if (
        issueMessages.length >
        0
      ) {
        fallbackParts.push(
          issueMessages
            .join(
              " "
            )
        );
      }
    }

    /**
     * 다음 행동.
     */
    if (
      orderedNextSteps.length >
      0
    ) {
      const stepMessages =
        orderedNextSteps
          .map(
            (
              step,
              index
            ) => {
              const description =
                normalizeText(
                  step.description
                );

              const title =
                normalizeText(
                  step.title
                );

              const text =
                description ||
                title;

              return text
                ? `${index + 1}. ${text}`
                : "";
            }
          )
          .filter(
            Boolean
          );

      if (
        stepMessages.length >
        0
      ) {
        fallbackParts.push(
          `다음 순서로 확인해주세요.\n${stepMessages.join(
            "\n"
          )}`
        );
      }
    }

    /**
     * 사람이 확인해야 하는 문서라면
     * 완료형/확정형으로 끝내지 않는다.
     */
    if (
      documentAssistance
        .requiresStaffReview
    ) {
      fallbackParts.push(
        "일부 내용은 담당자 확인이 필요한 상태라 현재 자료만으로 최종 확정해서 안내하지는 않겠습니다."
      );
    }

    /**
     * Assistance 결과는 존재하지만
     * 구체적으로 출력할 내용이 없는 경우.
     */
    if (
      fallbackParts.length ===
      0
    ) {
      fallbackParts.push(
        documentAssistance
          .canAssist
          ? "보내주신 자료는 확인했습니다. 현재 문서를 기준으로 작성 및 다음 진행사항을 확인할 수 있습니다."
          : "보내주신 자료는 확인했지만 현재 자료만으로는 정확한 작성 또는 제출 안내를 확정하기 어렵습니다."
      );
    }

    return {
      replyText:
        Array.from(
          new Set(
            fallbackParts
              .map(
                part =>
                  normalizeText(
                    part
                  )
              )
              .filter(
                Boolean
              )
          )
        )
          .join(
            "\n\n"
          )
          .trim(),

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }


/**
 * ---------------------------------------------------------
 * Document Intelligence Fallback
 * ---------------------------------------------------------
 *
 * Vision 분석은 이미 성공했는데
 * 최종 자연어 Composer 호출만 실패한 경우에도
 * 사용자가 제출한 문서 분석결과를 잃지 않는다.
 *
 * 여기서는:
 * - 문서 사실 설명 O
 * - 새 학점 계산 X
 * - 새 법규 판단 X
 */
const documentIntelligence =
  resolvedContext
    .documentIntelligence;

if (
  documentIntelligence
) {
  const documentSummary =
    normalizeText(
      documentIntelligence.summary
    );

  const documentType =
    documentIntelligence.documentType;

  const documentAccepted =
    documentIntelligence.decision ===
      "accepted";

  const warnings =
    normalizeStringArray(
      documentIntelligence.warnings,
      10
    );

  const missingEvidence =
    normalizeStringArray(
      documentIntelligence.missingEvidence,
      10
    );

  /**
   * 성적증명서 + 공통 Academic Engine 계산까지
   * 정상 완료된 신규상담.
   */
  if (
    documentType ===
      "transcript" &&
    resolvedContext
      .leadAcademicAnalysis
      ?.academicSummary
  ) {
    const academicSummary =
      resolvedContext
        .leadAcademicAnalysis
        .academicSummary;

    const summaryLines =
      normalizeStringArray(
        academicSummary.summaryLines,
        10
      );

    if (
      documentAccepted &&
      summaryLines.length >
        0
    ) {
      return {
        replyText:
          [
            documentSummary
              ? `성적증명서는 확인했습니다. ${documentSummary}`
              : "성적증명서는 확인했습니다.",

            summaryLines
              .slice(
                0,
                5
              )
              .join(
                " "
              ),
          ]
            .filter(
              Boolean
            )
            .join(
              "\n\n"
            ),

        mentionedRestriction:
          false,

        askedClarification:
          false,
      };
    }

    return {
      replyText:
        [
          "성적증명서는 확인했습니다.",

          documentSummary ||
            null,

          missingEvidence.length >
            0 ||
          warnings.length >
            0
            ? "다만 일부 내용은 추가 확인이 필요해 현재 자료만으로 확정해서 안내하지는 않겠습니다."
            : null,
        ]
          .filter(
            Boolean
          )
          .join(
            "\n\n"
          ),

      mentionedRestriction:
        false,

      askedClarification:
        missingEvidence.length >
        0,
    };
  }

  /**
   * 등록회원 행정절차 서류.
   *
   * 실제 completed 반영 여부는
   * Administrative Action이 이미 서버에서 처리한다.
   *
   * Fallback에서는 상태를 새로 계산하지 않는다.
   */
  if (
    documentIntelligence
      .canUseAdministrativeEngine
  ) {
    if (
      documentAccepted &&
      documentIntelligence
        .administrative
        .detectedStatus ===
        "completed"
    ) {
      return {
        replyText:
          documentSummary
            ? `보내주신 자료는 확인했습니다. ${documentSummary}`
            : "보내주신 자료는 확인했습니다.",

        mentionedRestriction:
          false,

        askedClarification:
          false,
      };
    }

    return {
      replyText:
        [
          "보내주신 행정절차 자료는 확인했습니다.",

          documentSummary ||
            null,

          "다만 현재 자료만으로 완료 여부를 확정하기 어려운 부분은 확인이 필요한 상태로 처리하겠습니다.",
        ]
          .filter(
            Boolean
          )
          .join(
            "\n\n"
          ),

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  /**
   * 기타 문서.
   */
  if (
    documentAccepted
  ) {
    return {
      replyText:
        documentSummary
          ? `보내주신 자료를 확인했습니다. ${documentSummary}`
          : "보내주신 자료는 정상적으로 확인했습니다.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  return {
    replyText:
      [
        "보내주신 자료는 확인했습니다.",

        documentSummary ||
          null,

        "다만 일부 내용이 명확하지 않아 현재 자료만으로 확정해서 안내하지는 않겠습니다.",
      ]
        .filter(
          Boolean
        )
        .join(
          "\n\n"
        ),

    mentionedRestriction:
      false,

    askedClarification:
      missingEvidence.length >
      0,
  };
}

    /**
   * 신규 학업분석이 실행됐지만
   * 추가 확인이 필요한 경우.
   */
  const leadAcademic =
    params
      .resolvedContext
      .leadAcademicAnalysis;

  if (
  leadAcademic &&
  leadAcademic.canExplain !==
    true &&
  leadAcademic
    .unresolvedReasons
    .length >
  0
) {
  return {
    replyText:
      "현재 말씀해주신 내용만으로는 개인별 과정을 정확하게 확정하기 어려운 부분이 있어요. 확인이 필요한 정보가 있으면 그 부분만 이어서 여쭤볼게요.",

    mentionedRestriction:
      false,

    askedClarification:
      true,
  };
}

  /**
   * Intent는 정상적으로 판단됐지만
   * OpenAI 최종 답변 생성에 실패한 경우.
   *
   * 무조건 "다시 말씀해주세요"로 보내지 않고
   * 이미 분석된 primaryCapability를 기준으로
   * 안전하게 다음 대화 흐름을 이어간다.
   */
  const primaryCapability =
    intent.primaryCapability;

  if (
    primaryCapability ===
      "qualification_general_guide"
  ) {
    return {
      replyText:
        "자격증 취득 상담은 안내해드릴 수 있어요. 현재 확인된 내용 기준으로 일반적인 진행 흐름부터 안내하고, 개인별 설계가 필요하면 필요한 정보만 추가로 확인해드릴게요.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  if (
    primaryCapability ===
      "qualification_consultation_analysis"
  ) {
    return {
      replyText:
        "개인별 취득과정을 확인하려면 현재 학력이나 기존에 이수한 과목 등 설계에 필요한 정보부터 확인해야 해요. 이미 말씀해주신 내용은 다시 묻지 않고 필요한 부분만 이어서 확인할게요.",

      mentionedRestriction:
        false,

      askedClarification:
        true,
    };
  }

  if (
    primaryCapability ===
      "theory_class_general_guide"
  ) {
    return {
      replyText:
        "수업 진행방식에 대한 상담은 안내해드릴 수 있어요. 온라인 수업이나 출석, 시험, 과제 등 궁금한 부분을 이어서 말씀해 주세요.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  if (
    primaryCapability ===
      "practice_general_guide"
  ) {
    return {
      replyText:
        "실습 진행방법은 안내해드릴 수 있어요. 현재 진행하려는 과정과 대화 내용을 기준으로 필요한 실습 절차를 이어서 확인해드릴게요.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  if (
    primaryCapability ===
      "practice_support_promotion"
  ) {
    return {
      replyText:
        "실습지원 관련해서는 회사에서 제공하는 지원범위와 진행방식을 기준으로 안내해드릴 수 있어요.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  if (
    primaryCapability ===
      "company_introduction" ||
    primaryCapability ===
      "company_benefits" ||
    primaryCapability ===
      "sales_points"
  ) {
    return {
      replyText:
        "회사에서 제공하는 상담과 관리서비스에 대해 안내해드릴 수 있어요. 궁금한 부분을 말씀해주시면 확인된 회사정보 기준으로 설명드릴게요.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  if (
    primaryCapability ===
      "administrative_general_guide"
  ) {
    return {
      replyText:
        "학습자등록, 학점인정신청, 학위신청 같은 행정절차의 일반적인 진행방법은 안내해드릴 수 있어요.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  if (
    primaryCapability ===
      "certificate_application_general_guide"
  ) {
    return {
      replyText:
        "과정 이수 후 자격증 신청에 필요한 일반적인 절차는 안내해드릴 수 있어요.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  if (
    primaryCapability ===
      "staff_list"
  ) {
    const candidates =
      params.resolvedContext
        .staffContext
        ?.candidates ||
      [];

    if (
      candidates.length >
      0
    ) {
      const names =
        candidates
          .slice(
            0,
            5
          )
          .map(
            staff =>
              [
                normalizeText(
                  staff.displayName
                ),
                normalizeText(
                  staff
                    .publicPositionName
                ),
              ]
                .filter(
                  Boolean
                )
                .join(
                  " "
                )
          )
          .filter(
            Boolean
          );

      return {
        replyText:
          names.length >
          0
            ? `현재 상담 가능한 담당자는 ${names.join(", ")}입니다. 원하시는 담당자를 말씀해주시면 선택하실 수 있어요.`
            : "현재 상담 가능한 담당자를 확인하고 있어요.",

        mentionedRestriction:
          false,

        askedClarification:
          false,
      };
    }

    return {
      replyText:
        "현재 바로 안내드릴 수 있는 상담 담당자가 확인되지 않아요.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  if (
    primaryCapability ===
      "staff_recommend"
  ) {
    const staff =
      params.resolvedContext
        .staffContext
        ?.recommendedStaff;

    const name =
      normalizeText(
        staff?.displayName
      );

    const position =
      normalizeText(
        staff?.publicPositionName
      );

    const displayName =
      [
        name,
        position,
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        );

    return {
      replyText:
        displayName
          ? `현재 상담내용 기준으로는 ${displayName}을 추천드려요. 추천이 마음에 드시면 이 담당자로 선택하실 수도 있어요.`
          : "현재 상담 가능한 담당자 중에서 적합한 분을 확인하기 어려워요.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  if (
    primaryCapability ===
      "staff_select" ||
    primaryCapability ===
      "staff_change"
  ) {
    const staff =
      params.resolvedContext
        .staffContext
        ?.selectedStaff;

    const name =
      normalizeText(
        staff?.displayName
      );

    const position =
      normalizeText(
        staff?.publicPositionName
      );

    const displayName =
      [
        name,
        position,
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        );

    return {
      replyText:
        displayName
          ? primaryCapability ===
              "staff_change"
            ? `${displayName}으로 변경해드렸어요.`
            : `${displayName}으로 선택해드렸어요.`
          : "원하시는 담당자를 다시 말씀해주시면 확인해서 선택해드릴게요.",

      mentionedRestriction:
        false,

      askedClarification:
        !displayName,
    };
  }

  if (
    primaryCapability ===
      "staff_current"
  ) {
    const selected =
      params.resolvedContext
        .staffContext
        ?.selectedStaff;

    const recommended =
      params.resolvedContext
        .staffContext
        ?.recommendedStaff;

    const selectedName =
      [
        normalizeText(
          selected?.displayName
        ),
        normalizeText(
          selected
            ?.publicPositionName
        ),
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        );

    if (
      selectedName
    ) {
      return {
        replyText:
          `현재 선택하신 담당자는 ${selectedName}입니다.`,

        mentionedRestriction:
          false,

        askedClarification:
          false,
      };
    }

    const recommendedName =
      [
        normalizeText(
          recommended
            ?.displayName
        ),
        normalizeText(
          recommended
            ?.publicPositionName
        ),
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        );

    return {
      replyText:
        recommendedName
          ? `${recommendedName}을 추천드린 상태이고, 아직 최종 선택된 담당자는 없어요.`
          : "아직 선택된 담당자가 없어요.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  if (
    primaryCapability ===
      "education_general_conversation"
  ) {
    return {
      replyText:
        "학점은행제나 자격증 과정, 수업, 실습, 행정절차 관련해서 편하게 말씀해 주세요. 대화 내용을 보고 필요한 방향으로 이어서 안내해드릴게요.",

      mentionedRestriction:
        false,

      askedClarification:
        false,
    };
  }

  return {
    replyText:
      "문의하신 내용은 상담 범위 안에서 확인해서 안내해드릴게요. 현재 대화 내용을 기준으로 필요한 부분부터 이어서 말씀해 주세요.",

    mentionedRestriction:
      false,

    askedClarification:
      false,
  };
}

/**
 * 실제 최종 답변 생성.
 *
 * 이 함수는 답변만 생성하며
 * DB에 assistant 메시지를 저장하지 않는다.
 *
 * 저장은 Orchestrator에서
 * 성공한 replyText만 별도로 처리한다.
 */
export async function composeKakaoAiResponse(
  params: {
    message:
      string;

    customer:
      KakaoAiCustomerContext;

    memory:
      KakaoAiStructuredMemory;

    conversationHistory:
      KakaoAiConversationMessage[];

    intentClassification:
      KakaoAiIntentClassificationResult;

    resolvedContext:
      KakaoAiResolvedContext;

leadFlowEvaluation:
  KakaoAiLeadFlowEvaluationResult |
  null;
  }
): Promise<KakaoAiResponseCompositionResult> {
  const message =
    normalizeText(
      params.message
    );

  if (
    !message
  ) {
    const fallback =
      buildFallbackReply({
        intentClassification:
          params.intentClassification,

        resolvedContext:
          params.resolvedContext,
      });

    return {
      success:
        false,

      replyText:
        fallback.replyText,

      usedContextTypes:
        [],

      mentionedRestriction:
        fallback
          .mentionedRestriction,

      askedClarification:
        fallback
          .askedClarification,

      consultationFlowPatch:
        createEmptyConsultationFlowPatch(),

      openAiResponseId:
        null,

      model:
        null,

      fallbackUsed:
        true,

      errorMessage:
        "최종 답변을 생성할 사용자 메시지가 없습니다.",
    };
  }

  const openai =
    getKakaoAiResponseOpenAiClient();

  if (
    !openai
  ) {
    const fallback =
      buildFallbackReply({
        intentClassification:
          params.intentClassification,

        resolvedContext:
          params.resolvedContext,
      });

    return {
      success:
        false,

      replyText:
        fallback.replyText,

      usedContextTypes:
        [],

      mentionedRestriction:
        fallback
          .mentionedRestriction,

      askedClarification:
        fallback
          .askedClarification,

      consultationFlowPatch:
        createEmptyConsultationFlowPatch(),

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
    getKakaoAiResponseModel();

  const input =
    buildKakaoAiResponseInput({
      message,

      customer:
        params.customer,

      memory:
        params.memory,

      conversationHistory:
        params.conversationHistory,

      intentClassification:
        params.intentClassification,

      resolvedContext:
  params.resolvedContext,

leadFlowEvaluation:
  params.leadFlowEvaluation,
    });

  try {
    const response =
      await openai.responses.create({
        model,

        /**
         * 카카오 대화 Memory는
         * 우리 DB에서 관리하므로
         * OpenAI response 상태에 의존하지 않는다.
         */
        store:
          false,

        instructions:
          KAKAO_AI_RESPONSE_COMPOSER_INSTRUCTIONS,

        input,

        text: {
          format: {
            type:
              "json_schema",

            name:
              "kakao_ai_response",

            strict:
              true,

            schema:
              KAKAO_AI_RESPONSE_SCHEMA,
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
      const fallback =
        buildFallbackReply({
          intentClassification:
            params
              .intentClassification,

          resolvedContext:
            params
              .resolvedContext,
        });

      return {
        success:
          false,

        replyText:
          fallback.replyText,

        usedContextTypes:
          [],

        mentionedRestriction:
          fallback
            .mentionedRestriction,

        askedClarification:
          fallback
            .askedClarification,

      consultationFlowPatch:
        createEmptyConsultationFlowPatch(),

        openAiResponseId:
          typeof response.id ===
            "string"
            ? response.id
            : null,

        model,

        fallbackUsed:
          true,

        errorMessage:
          "OpenAI 최종 답변이 비어 있습니다.",
      };
    }

    let parsed:
      any;

    try {
      parsed =
        JSON.parse(
          outputText
        );
    } catch {
      const fallback =
        buildFallbackReply({
          intentClassification:
            params
              .intentClassification,

          resolvedContext:
            params
              .resolvedContext,
        });

      return {
        success:
          false,

        replyText:
          fallback.replyText,

        usedContextTypes:
          [],

        mentionedRestriction:
          fallback
            .mentionedRestriction,

        askedClarification:
          fallback
            .askedClarification,

      consultationFlowPatch:
        createEmptyConsultationFlowPatch(),

        openAiResponseId:
          typeof response.id ===
            "string"
            ? response.id
            : null,

        model,

        fallbackUsed:
          true,

        errorMessage:
          "OpenAI 최종 답변 JSON을 해석할 수 없습니다.",
      };
    }

    const replyText =
      normalizeText(
        parsed?.replyText
      );

    if (
      !replyText
    ) {
      const fallback =
        buildFallbackReply({
          intentClassification:
            params
              .intentClassification,

          resolvedContext:
            params
              .resolvedContext,
        });

      return {
        success:
          false,

        replyText:
          fallback.replyText,

        usedContextTypes:
          [],

        mentionedRestriction:
          fallback
            .mentionedRestriction,

        askedClarification:
          fallback
            .askedClarification,

      consultationFlowPatch:
        createEmptyConsultationFlowPatch(),

        openAiResponseId:
          typeof response.id ===
            "string"
            ? response.id
            : null,

        model,

        fallbackUsed:
          true,

        errorMessage:
          "OpenAI 최종 답변 문장이 비어 있습니다.",
      };
    }

    return {
      success:
        true,

      replyText,

      usedContextTypes:
        normalizeStringArray(
          parsed
            ?.usedContextTypes,
          20
        ),

      mentionedRestriction:
        parsed
          ?.mentionedRestriction ===
        true,

      askedClarification:
        parsed
          ?.askedClarification ===
        true,

      consultationFlowPatch:
        normalizeConsultationFlowPatch(
          parsed
            ?.consultationFlowPatch
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
  } catch (
    error:
      unknown
  ) {
    console.error(
      "[KAKAO AI] 최종 답변 생성 실패",
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

    const fallback =
      buildFallbackReply({
        intentClassification:
          params.intentClassification,

        resolvedContext:
          params.resolvedContext,
      });

    return {
      success:
        false,

      replyText:
        fallback.replyText,

      usedContextTypes:
        [],

      mentionedRestriction:
        fallback
          .mentionedRestriction,

            askedClarification:
        fallback
          .askedClarification,

      consultationFlowPatch:
        createEmptyConsultationFlowPatch(),

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