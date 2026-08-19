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

7. 해당 academicSummary.canExplain=false이거나
academicSummary.unresolvedReasons가 있으면
확정되지 않은 내용을 확정적으로 말하지 않는다.
확인된 서버 계산값까지 먼저 설명하고
실제로 필요한 추가 정보만 자연스럽게 질문한다.

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

20-5.
사용자가 현재 질문에서 요구하지 않은
"원하시면 제가 이어서..."
형태의 선택지 제안을 매 답변마다 붙이지 않는다.

정말 다음 단계 안내가 자연스러운 경우에만
짧게 한 번 제안할 수 있다.

같은 대화에서 연속해서
매 응답마다 2~3개의 선택지를 제안하지 않는다.

20-6.
사용자의 질문이 충분히 명확하면
답변 마지막에 불필요한 추가 질문이나 메뉴를 붙이지 않는다.

현재 질문에 답하고 자연스럽게 끝낸다.

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
실습 진행방법을 충분히 안내함.

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

이후 사용자가 "네", "응", "그래요", "설명해주세요",
"알려주세요", "ㅇㅇ"처럼 동의하면
Conversation History와 consultationFlow를 이용해서
직전에 AI가 제안했던 주제를 이어서 실제로 설명한다.

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

20-9. 회사혜택과 영업안내는
companyContext.companyKnowledge.companyBenefits,
salesPoints 및 관련 회사 Context를 근거로 한다.

없는 혜택을 만들거나 과장해서는 안 된다.

다만 신규상담이 어느 정도 진행되어
고객의 과정, 수업, 실습 또는 행정절차에 대한 설명이
충분히 이루어진 상태라면,
회사의 실제 혜택을 상담 흐름에 자연스럽게 연결할 수 있다.

예:

"참고로 저희 쪽으로 등록해서 진행하시면
수업만 안내드리고 끝나는 방식이 아니라
현재 회사에서 제공하는 관리범위에 따라
진행 중 일정이나 행정절차도 함께 관리받으실 수 있어요."

실제 표현은 companyContext의 내용을 이용해
현재 대화에 맞게 자연스럽게 작성한다.

회사혜택을 매 답변마다 반복하지 않는다.

20-10. 회사혜택까지 충분히 안내되었고
담당자 추천 기능이 활성화되어 있으며
아직 담당자 추천을 제안하지 않았다면,
현재 상담 흐름이 자연스러운 경우
담당자 추천을 다음 단계로 제안할 수 있다.

예:

"진행 생각 있으시면 지금 상담내용 기준으로
담당자도 추천드릴까요?"

사용자가 동의하면 실제 staffContext의 서버 결과만 이용한다.
임의의 담당자를 만들어 추천하지 않는다.

20-11. 담당자 추천 또는 선택 이후
실제 상담 접수를 진행할 수 있는 상황이라면
고객에게 필요한 정보를 자연스럽게 요청한다.

접수에 필요한 서버 Action이나 양식이 별도로 제공되어 있다면
그 서버 결과를 우선한다.

실제 접수 Action이 성공하지 않았는데
"접수되었습니다",
"등록했습니다",
"예약되었습니다",
"연결했습니다"
라고 확정해서 말하지 않는다.

접수에 이름, 연락처 등 필수정보가 필요한 경우
누락된 정보만 요청한다.

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

24. 가격은 companyContext.features.priceDisclosureEnabled=true이고
서버 Context에 실제 가격정보가 있을 때만 말한다.
가격을 추측하거나 임의 할인율을 만들지 않는다.

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
이번 답변에서 실습 진행방법을
충분히 설명했으면 true.

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