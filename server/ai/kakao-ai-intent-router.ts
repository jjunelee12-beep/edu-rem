import {
  decideKakaoAiAccess,
  type KakaoAiAccessDecision,
  type KakaoAiCapability,
  type KakaoAiCustomerType,
} from "./kakao-ai-access-policy";

/**
 * Intent Router는
 * 사용자에게 답변을 직접 생성하지 않는다.
 *
 * 역할:
 *
 * 사용자 자연어
 * + 이전 대화
 * + 첨부자료 유무
 *
 * 를 모델이 해석한 결과를
 * 안전한 내부 구조로 정규화한다.
 *
 * 이후:
 *
 * Intent
 * → Access Policy
 * → 필요한 Context / Tool / 공통엔진
 * → 최종 자연어 답변
 *
 * 순서로 처리한다.
 */

/**
 * 카카오 대화 히스토리.
 *
 * 전체 대화를 무한정 전달하는 것이 아니라
 * 이후 Runner에서 최근 대화만 정리하여 전달한다.
 */
export type KakaoAiConversationMessage = {
  role:
    | "user"
    | "assistant";

  content:
    string;
};

/**
 * 사용자가 현재 메시지와 함께
 * 전송한 첨부자료에 대한 최소 정보.
 *
 * 여기서는 OCR을 수행하지 않는다.
 */
export type KakaoAiAttachmentContext = {
  hasImage:
    boolean;

  hasDocument:
    boolean;

  attachmentCount:
    number;
};

/**
 * 모델이 판단해야 하는
 * 전체 상담 범위.
 */
export type KakaoAiIntentDomain =
  | "education"
  | "off_topic"
  | "mixed"
  | "unclear";

/**
 * 현재 요청을 처리하기 위해
 * 어떤 종류의 데이터가 필요한지.
 *
 * 실제 Tool 이름과는 분리한다.
 */
export type KakaoAiRequiredContext =
  | "company_context"
  | "common_rule_engine"
  | "conversation_memory"
  | "transfer_document"
  | "registered_student"
  | "academic_summary"
  | "risk_analysis"
  | "administrative_status"
  | "practice_center"
  | "career_context"
  | "attachment_analysis";

/**
 * Intent Router의 정규화된 결과.
 */
export type KakaoAiIntentDecision = {
  /**
   * 현재 질문이 어떤 범위인지.
   */
  domain:
    KakaoAiIntentDomain;

  /**
   * 가장 중심이 되는 기능.
   */
  primaryCapability:
    KakaoAiCapability;

  /**
   * 한 메시지에 여러 요청이 있을 수 있으므로
   * 관련 capability를 모두 보존한다.
   */
  capabilities:
    KakaoAiCapability[];

  /**
   * 사용자가 실제로 무엇을 원하는지
   * 내부적으로 짧게 요약.
   *
   * 고객에게 그대로 출력하지 않는다.
   */
  userGoal:
    string;

  /**
   * 지금 답변 전에 추가 확인이 필요한지.
   */
  needsClarification:
    boolean;

  /**
   * 추가 확인이 필요하다면
   * 무엇을 물어봐야 하는지.
   *
   * 아직 최종 고객문구는 아니다.
   */
  clarificationQuestion:
    string | null;

  /**
   * 부족한 정보의 내부 키.
   *
   * 예:
   * finalEducation
   * desiredCourse
   * transferTranscript
   * lawVersionEvidence
   */
  missingInformation:
    string[];

  /**
   * 어떤 데이터 소스가 필요한지.
   */
  requiredContexts:
    KakaoAiRequiredContext[];

  /**
   * 전적대 OCR / 첨부 이미지 분석이
   * 실제로 필요한 요청인지.
   */
  requiresAttachmentAnalysis:
    boolean;

  /**
   * 공통 학점은행제 규칙엔진을
   * 사용해야 하는지.
   */
  requiresCommonRuleEngine:
    boolean;

  /**
   * 등록자의 실제 CRM 데이터가
   * 필요한 요청인지.
   */
  requiresRegisteredStudentData:
    boolean;

  /**
   * 실습배정지원센터 실제 DB가
   * 필요한 요청인지.
   */
  requiresPracticeCenterLookup:
    boolean;

  /**
   * 회사별 Context가 필요한지.
   */
  requiresCompanyContext:
    boolean;

  /**
   * 모델의 판단 신뢰도.
   *
   * 0 ~ 1.
   *
   * 신뢰도가 낮다고 바로 답하지 않고
   * 애매한 경우 clarification을 우선한다.
   */
  confidence:
    number;
};

/**
 * 중앙 권한정책까지 적용된
 * 최종 Routing 결과.
 */
export type KakaoAiRoutedIntent = {
  intent:
    KakaoAiIntentDecision;

  customerType:
    KakaoAiCustomerType;

  /**
   * 각 capability에 대한
   * 중앙 접근정책 결과.
   */
  accessDecisions:
    KakaoAiAccessDecision[];

  /**
   * 하나라도 차단되는 요청이 있는지.
   */
  hasRestrictedCapability:
    boolean;

  /**
   * 모두 허용되는지.
   */
  allCapabilitiesAllowed:
    boolean;

  /**
   * 허용된 기능들.
   */
  allowedCapabilities:
    KakaoAiCapability[];

  /**
   * 차단된 기능들.
   */
  restrictedCapabilities:
    KakaoAiCapability[];
};

const ALL_KAKAO_AI_CAPABILITIES:
  readonly KakaoAiCapability[] = [
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
  ] as const;

const ALL_REQUIRED_CONTEXTS:
  readonly KakaoAiRequiredContext[] = [
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

    "attachment_analysis",
  ] as const;

const CAPABILITY_SET =
  new Set<string>(
    ALL_KAKAO_AI_CAPABILITIES
  );

const REQUIRED_CONTEXT_SET =
  new Set<string>(
    ALL_REQUIRED_CONTEXTS
  );

function normalizeText(
  value: unknown
): string {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeBoolean(
  value: unknown
): boolean {
  return value ===
    true;
}

function normalizeConfidence(
  value: unknown
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

  if (
    parsed <
    0
  ) {
    return 0;
  }

  if (
    parsed >
    1
  ) {
    return 1;
  }

  return parsed;
}

function normalizeCapability(
  value: unknown
): KakaoAiCapability | null {
  const normalized =
    normalizeText(
      value
    );

  if (
    !CAPABILITY_SET.has(
      normalized
    )
  ) {
    return null;
  }

  return normalized as
    KakaoAiCapability;
}

function normalizeCapabilities(
  value: unknown
): KakaoAiCapability[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  const result:
    KakaoAiCapability[] =
    [];

  const seen =
    new Set<string>();

  for (
    const item of
    value
  ) {
    const capability =
      normalizeCapability(
        item
      );

    if (
      !capability ||
      seen.has(
        capability
      )
    ) {
      continue;
    }

    seen.add(
      capability
    );

    result.push(
      capability
    );
  }

  return result;
}

function normalizeRequiredContexts(
  value: unknown
): KakaoAiRequiredContext[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  const result:
    KakaoAiRequiredContext[] =
    [];

  const seen =
    new Set<string>();

  for (
    const item of
    value
  ) {
    const normalized =
      normalizeText(
        item
      );

    if (
      !REQUIRED_CONTEXT_SET.has(
        normalized
      ) ||
      seen.has(
        normalized
      )
    ) {
      continue;
    }

    seen.add(
      normalized
    );

    result.push(
      normalized as
        KakaoAiRequiredContext
    );
  }

  return result;
}

function normalizeMissingInformation(
  value: unknown
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
        .slice(
          0,
          20
        )
    )
  );
}

function normalizeDomain(
  value: unknown
): KakaoAiIntentDomain {
  const normalized =
    normalizeText(
      value
    );

  if (
    normalized ===
      "education" ||
    normalized ===
      "off_topic" ||
    normalized ===
      "mixed" ||
    normalized ===
      "unclear"
  ) {
    return normalized;
  }

  return "unclear";
}

/**
 * OpenAI가 반환한 구조를
 * 서버가 신뢰하기 전에 한 번 더 정규화한다.
 *
 * AI가 잘못된 capability 문자열을 만들더라도
 * 그대로 Tool 실행으로 넘어가지 않는다.
 */
export function normalizeKakaoAiIntentDecision(
  raw:
    unknown
): KakaoAiIntentDecision {
  const source =
    raw &&
    typeof raw ===
      "object"
      ? (
          raw as
            Record<
              string,
              unknown
            >
        )
      : {};

  const domain =
    normalizeDomain(
      source.domain
    );

  let capabilities =
    normalizeCapabilities(
      source.capabilities
    );

  let primaryCapability =
    normalizeCapability(
      source.primaryCapability
    );

  /**
   * off_topic으로 판단했는데
   * capability가 비어 있으면
   * 명시적으로 off_topic을 넣는다.
   */
  if (
    domain ===
      "off_topic" &&
    capabilities.length ===
      0
  ) {
    capabilities = [
      "off_topic_conversation",
    ];
  }

  /**
   * primary만 있고 배열에 없다면
   * capabilities에도 포함한다.
   */
  if (
    primaryCapability &&
    !capabilities.includes(
      primaryCapability
    )
  ) {
    capabilities.unshift(
      primaryCapability
    );
  }

  /**
   * capabilities만 있고 primary가 없다면
   * 첫 번째를 primary로 사용한다.
   */
  if (
    !primaryCapability &&
    capabilities.length >
      0
  ) {
    primaryCapability =
      capabilities[0];
  }

  /**
   * 아무 판단도 못 했다면
   * 임의로 특정 기능을 선택하지 않는다.
   *
   * 일반 교육상담으로 바로 확정하는 것도
   * 오판 가능성이 있으므로
   * unclear 상태로 두고 clarification을 요구한다.
   */
  if (
    !primaryCapability
  ) {
    primaryCapability =
      "education_general_conversation";
  }

  const missingInformation =
    normalizeMissingInformation(
      source.missingInformation
    );

  const rawNeedsClarification =
    normalizeBoolean(
      source.needsClarification
    );

  const clarificationQuestion =
    normalizeText(
      source.clarificationQuestion
    ) ||
    null;

  /**
   * domain 자체가 unclear거나
   * 모델 신뢰도가 매우 낮으면
   * clarification을 강제한다.
   */
  const confidence =
    normalizeConfidence(
      source.confidence
    );

  const needsClarification =
    rawNeedsClarification ||
    domain ===
      "unclear" ||
    confidence <
      0.45;

  let normalizedClarificationQuestion =
    clarificationQuestion;

  if (
    needsClarification &&
    !normalizedClarificationQuestion
  ) {
    normalizedClarificationQuestion =
      "정확하게 안내하려면 어떤 내용을 확인하고 싶으신지 조금만 더 말씀해주세요.";
  }

  const requiredContexts =
    normalizeRequiredContexts(
      source.requiredContexts
    );

  return {
    domain,

    primaryCapability,

    capabilities:
      capabilities.length >
      0
        ? capabilities
        : [
            primaryCapability,
          ],

    userGoal:
      normalizeText(
        source.userGoal
      ),

    needsClarification,

    clarificationQuestion:
      normalizedClarificationQuestion,

    missingInformation,

    requiredContexts,

    requiresAttachmentAnalysis:
      normalizeBoolean(
        source.requiresAttachmentAnalysis
      ),

    requiresCommonRuleEngine:
      normalizeBoolean(
        source.requiresCommonRuleEngine
      ),

    requiresRegisteredStudentData:
      normalizeBoolean(
        source.requiresRegisteredStudentData
      ),

    requiresPracticeCenterLookup:
      normalizeBoolean(
        source.requiresPracticeCenterLookup
      ),

    requiresCompanyContext:
      normalizeBoolean(
        source.requiresCompanyContext
      ),

    confidence,
  };
}

/**
 * Intent 결과에 중앙 권한정책을 적용한다.
 *
 * 중요:
 * 모델은 고객이 lead인지 registered인지
 * 결정하지 않는다.
 *
 * 고객유형은 서버 인증 결과로만 전달한다.
 */
export function routeKakaoAiIntent(
  params: {
    customerType:
      KakaoAiCustomerType;

    intent:
      KakaoAiIntentDecision;
  }
): KakaoAiRoutedIntent {
  const accessDecisions =
    params.intent.capabilities.map(
      (
        capability
      ) =>
        decideKakaoAiAccess({
          customerType:
            params.customerType,

          capability,
        })
    );

  const allowedCapabilities =
    accessDecisions
      .filter(
        (
          decision
        ) =>
          decision.allowed
      )
      .map(
        (
          decision
        ) =>
          decision.capability
      );

  const restrictedCapabilities =
    accessDecisions
      .filter(
        (
          decision
        ) =>
          !decision.allowed
      )
      .map(
        (
          decision
        ) =>
          decision.capability
      );

  return {
    intent:
      params.intent,

    customerType:
      params.customerType,

    accessDecisions,

    hasRestrictedCapability:
      restrictedCapabilities.length >
      0,

    allCapabilitiesAllowed:
      restrictedCapabilities.length ===
      0,

    allowedCapabilities,

    restrictedCapabilities,
  };
}

/**
 * 모델에게 전달할 Intent 분류 지침.
 *
 * 이것은 최종 고객 답변용 프롬프트가 아니다.
 *
 * 고객에게 무엇을 답할지는
 * 이후 Response Composer에서 처리한다.
 */
export const KAKAO_AI_INTENT_CLASSIFIER_INSTRUCTIONS = `
너는 EduCanvas 카카오 AI의 "의도 분석기"다.

사용자에게 직접 답변하지 않는다.
사용자의 현재 메시지와 이전 대화 맥락을 분석하여
정해진 JSON 구조만 반환한다.

중요 원칙:

1. 키워드 하나만 보고 판단하지 않는다.
현재 메시지 전체 의미와 이전 대화를 함께 본다.

2. 사용자가 한 메시지에서 여러 요청을 할 수 있다.
그 경우 primaryCapability 하나와 capabilities 전체를 함께 반환한다.

3. 이전 대화에서 이미 확인된 정보는
missingInformation으로 다시 요구하지 않는다.

3-1. structuredMemory에 저장된 정보는
이전 대화에서 이미 확인된 사실로 취급한다.

예:
structuredMemory.finalEducation = "전문대 졸업"
이면 사용자가 현재 메시지에서 다시 말하지 않아도
최종학력을 이미 알고 있는 것으로 판단한다.

3-2. structuredMemory.verifiedFacts는
사용자 발언, OCR, CRM, 공통엔진 등으로
이미 확정된 사실이다.
임의로 무시하거나 반대로 추측하지 않는다.

3-3. structuredMemory.unresolvedQuestions는
아직 확인되지 않은 정보다.
현재 질문을 처리하는 데 꼭 필요할 때만 질문하며,
관련 없는 미확인 정보를 한꺼번에 묻지 않는다.

3-4. structuredMemory.currentTopic은
"그럼 실습은?", "그건 얼마나 걸려?"
같은 짧은 후속질문의 문맥 판단에 참고한다.

4. 필요한 정보가 없으면 사실을 추측하지 않는다.
needsClarification=true로 하고
정말 필요한 질문만 clarificationQuestion에 작성한다.

5. 서로 충돌하는 정보가 있으면
임의로 하나를 선택하지 않는다.
needsClarification=true로 한다.

6. 자격증 취득조건, 학점, 부족과목,
학기 수, 최단기간 계산을 요청하면
requiresCommonRuleEngine=true로 한다.

7. 전적대 성적증명서나 기존 이수과목을
확인해야 하는 경우
requiresAttachmentAnalysis=true 또는
requiredContexts에 transfer_document를 포함한다.

8. 실제 등록학생의 과목, 학점, 학기,
결제, 일정, 행정상태 등의 데이터가 필요하면
requiresRegisteredStudentData=true로 한다.

9. 실제 실습기관 목록, 주소, 거리,
가까운 기관, 배정가능 기관이 필요하면
requiresPracticeCenterLookup=true로 한다.

10. 회사 소개, 혜택, 수업방식,
실습지원, 상담 강조포인트,
등록혜택 등을 답변하는 데 회사별 정보가 필요하면
requiresCompanyContext=true로 한다.

11. 고객이 신규인지 등록회원인지는
절대로 네가 추측하거나 판단하지 않는다.
그 판단은 별도의 서버 권한정책이 수행한다.

12. 요청이 학점은행제,
자격증 과정, 학습관리,
관련 실습, 관련 취업지원 범위를 완전히 벗어나면
domain="off_topic",
primaryCapability="off_topic_conversation"으로 한다.

13. 한 문장에 학점은행제 질문과
관계없는 질문이 함께 있다면
domain="mixed"로 판단할 수 있다.

14. "실습은?", "그럼 기간은?",
"근데 등록하면?", "이건 어떻게 해?"
같은 짧은 질문은 반드시 이전 대화를 먼저 사용하여
무엇을 지칭하는지 판단한다.

15. 지칭 대상을 충분히 알 수 없으면
억지로 해석하지 말고 clarification을 요청한다.

사용 가능한 capability:

education_general_conversation
off_topic_conversation
qualification_general_guide
qualification_consultation_analysis
transfer_document_analysis
theory_class_general_guide
practice_general_guide
practice_support_promotion
practice_institution_lookup
company_introduction
company_benefits
sales_points
registered_benefits_guide
administrative_general_guide
administrative_detailed_guide
administrative_document_support
administrative_status_lookup
certificate_application_general_guide
certificate_application_detailed_guide
student_private_data_lookup
academic_private_data_lookup
registered_risk_analysis
career_consulting
career_document_support

requiredContexts에서 사용할 수 있는 값:

company_context
common_rule_engine
conversation_memory
transfer_document
registered_student
academic_summary
risk_analysis
administrative_status
practice_center
career_context
attachment_analysis

반환 JSON 구조:

{
  "domain": "education | off_topic | mixed | unclear",
  "primaryCapability": "capability 중 하나",
  "capabilities": ["관련 capability"],
  "userGoal": "사용자가 원하는 것을 짧게 요약",
  "needsClarification": false,
  "clarificationQuestion": null,
  "missingInformation": [],
  "requiredContexts": [],
  "requiresAttachmentAnalysis": false,
  "requiresCommonRuleEngine": false,
  "requiresRegisteredStudentData": false,
  "requiresPracticeCenterLookup": false,
  "requiresCompanyContext": false,
  "confidence": 0.0
}

JSON 이외의 설명은 출력하지 않는다.
`.trim();

/**
 * 모델 입력용 Context를 만든다.
 *
 * 이 함수 역시 OpenAI를 직접 호출하지 않는다.
 * 다음 단계에서 실제 Responses API 호출부와 연결한다.
 */
export function buildKakaoAiIntentClassifierInput(
  params: {
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

        verifiedFacts?:
          string[];

        unresolvedQuestions?:
          string[];

        currentTopic?:
          string | null;
      } | null;

    attachmentContext?:
      KakaoAiAttachmentContext | null;
  }
): string {
  const message =
    normalizeText(
      params.message
    );

  const conversationHistory =
    Array.isArray(
      params.conversationHistory
    )
      ? params.conversationHistory
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
          )
      : [];

  const attachmentContext =
    params.attachmentContext
      ? {
          hasImage:
            params
              .attachmentContext
              .hasImage ===
            true,

          hasDocument:
            params
              .attachmentContext
              .hasDocument ===
            true,

          attachmentCount:
            Math.max(
              0,
              Math.floor(
                Number(
                  params
                    .attachmentContext
                    .attachmentCount ||
                  0
                )
              )
            ),
        }
      : {
          hasImage:
            false,

          hasDocument:
            false,

          attachmentCount:
            0,
        };

    const structuredMemory =
    params.structuredMemory &&
    typeof params.structuredMemory ===
      "object"
      ? {
          desiredCourse:
            normalizeText(
              params
                .structuredMemory
                .desiredCourse
            ) ||
            null,

          finalEducation:
            normalizeText(
              params
                .structuredMemory
                .finalEducation
            ) ||
            null,

          hasTransferCollege:
            params
              .structuredMemory
              .hasTransferCollege ===
              true
              ? true
              : params
                    .structuredMemory
                    .hasTransferCollege ===
                  false
                ? false
                : null,

          verifiedFacts:
            Array.isArray(
              params
                .structuredMemory
                .verifiedFacts
            )
              ? params
                  .structuredMemory
                  .verifiedFacts
                  .map(
                    normalizeText
                  )
                  .filter(
                    Boolean
                  )
                  .slice(
                    0,
                    100
                  )
              : [],

          unresolvedQuestions:
            Array.isArray(
              params
                .structuredMemory
                .unresolvedQuestions
            )
              ? params
                  .structuredMemory
                  .unresolvedQuestions
                  .map(
                    normalizeText
                  )
                  .filter(
                    Boolean
                  )
                  .slice(
                    0,
                    50
                  )
              : [],

          currentTopic:
            normalizeText(
              params
                .structuredMemory
                .currentTopic
            ) ||
            null,
        }
      : {
          desiredCourse:
            null,

          finalEducation:
            null,

          hasTransferCollege:
            null,

          verifiedFacts:
            [],

          unresolvedQuestions:
            [],

          currentTopic:
            null,
        };

  return JSON.stringify(
    {
      currentMessage:
        message,

      conversationHistory,

      structuredMemory,

      attachmentContext,
    }
  );
}

/**
 * 모델이 JSON을 Markdown 코드블록으로
 * 감싸서 반환한 경우에도
 * 안전하게 JSON 본문만 꺼낸다.
 */
function extractJsonText(
  value:
    string
): string {
  const normalized =
    normalizeText(
      value
    );

  if (
    normalized.startsWith(
      "```"
    )
  ) {
    return normalized
      .replace(
        /^```(?:json)?\s*/i,
        ""
      )
      .replace(
        /\s*```$/,
        ""
      )
      .trim();
  }

  return normalized;
}

/**
 * 모델의 Intent JSON 응답을 파싱한다.
 *
 * 파싱이 실패하면 예외를 던지지 않고
 * "확인 질문이 필요한 상태"로 안전하게 반환한다.
 */
export function parseKakaoAiIntentClassifierOutput(
  value:
    string
): KakaoAiIntentDecision {
  try {
    const jsonText =
      extractJsonText(
        value
      );

    const parsed =
      JSON.parse(
        jsonText
      );

    return normalizeKakaoAiIntentDecision(
      parsed
    );
  } catch {
    return normalizeKakaoAiIntentDecision({
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
        "문의하신 내용을 정확하게 확인하려면 어떤 부분을 알고 싶으신지 조금만 더 말씀해주세요.",

      missingInformation: [],

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
    });
  }
}