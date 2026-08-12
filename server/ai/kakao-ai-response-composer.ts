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

            degree:
              (
                context
                  .academicSummary as any
              ).degree ??
              null,

            semester:
              (
                context
                  .academicSummary as any
              ).semester ??
              null,

            administrativeTimeline:
              (
                context
                  .academicSummary as any
              )
                .administrativeTimeline ??
              null,

            summaryLines:
              normalizeStringArray(
                (
                  context
                    .academicSummary as any
                ).summaryLines,
                30
              ),

            unresolvedReasons:
              normalizeStringArray(
                (
                  context
                    .academicSummary as any
                ).unresolvedReasons,
                20
              ),

            warnings:
              normalizeStringArray(
                (
                  context
                    .academicSummary as any
                ).warnings,
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

            degree:
              academicSummary.degree ??
              null,

            semester:
              academicSummary.semester ??
              null,

            administrativeTimeline:
              academicSummary
                .administrativeTimeline ??
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
  },

  required: [
    "replyText",
    "usedContextTypes",
    "mentionedRestriction",
    "askedClarification",
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

6. academicSummary.summaryLines가 존재하면
학업 관련 답변의 가장 중요한 사실근거로 사용한다.

7. academicSummary.canExplain=false이거나
unresolvedReasons가 있으면
확정되지 않은 내용을 확정적으로 말하지 않는다.
필요한 정보만 자연스럽게 추가로 물어본다.

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

18. practiceContext가 존재하면
실제 서버에서 조회된 기관만 언급한다.
없는 기관, 거리, 비용을 만들어내지 않는다.

19. registeredStudentContext의 위험도 issues가 있다면
질문과 관련될 때만 설명한다.
모든 질문마다 위험도 경고를 끼워 넣지 않는다.

20. 사용자가 단순하게 물으면 짧게 답한다.
복잡한 설계 질문이면 필요한 만큼 자세하게 답한다.

21. 불필요하게 번호 목록을 남발하지 않는다.
카카오톡에서 사람이 말하듯 읽기 편하게 작성한다.

22. 사용자가 이미 Memory에서 알려준
최종학력, 희망과정 등을 다시 묻지 않는다.

23. 현재 질문에 답하려면 정말 필요한 정보가
부족한 경우에만 질문한다.

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
  });
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

  /**
   * 명확한 확인질문이 이미 있으면
   * OpenAI 장애 상황에서도 그 질문을 사용한다.
   */
  if (
    intent.needsClarification &&
    intent.clarificationQuestion
  ) {
    return {
      replyText:
        intent.clarificationQuestion,

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
        leadAcademic
          .unresolvedReasons[0],

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