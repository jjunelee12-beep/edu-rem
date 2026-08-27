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
  | "staff_context"
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
 * 사용자의 의도가 실제로 여러 가지로
 * 해석될 수 있을 때 보여줄 자연어 선택 후보.
 *
 * 예:
 * [
 *   "학습자등록",
 *   "학점인정신청",
 *   "학위신청",
 *   "자격증 신청"
 * ]
 *
 * 내부 capability 이름은 넣지 않는다.
 */
clarificationOptions:
  string[];

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

    "staff_list",

    "staff_recommend",

    "staff_select",

        "staff_change",

    "staff_current",

    "lead_registration",

    "callback_request",
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

    "staff_context",

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

const clarificationOptions =
  normalizeMissingInformation(
    source.clarificationOptions
  )
    .slice(
      0,
      5
    );

  /**
 * clarification 여부는
 * 모델이 전체 대화 문맥을 보고 판단한다.
 *
 * 서버는 domain 자체가 unclear인 경우에만
 * 안전하게 clarification을 강제한다.
 *
 * confidence는 품질 측정용으로 보존하지만
 * 단순 점수만으로 합리적인 의도 추론을 차단하지 않는다.
 */
  const confidence =
    normalizeConfidence(
      source.confidence
    );

  const needsClarification =
  rawNeedsClarification ||
  domain ===
    "unclear";

  let normalizedClarificationQuestion =
    clarificationQuestion;

 if (
  needsClarification &&
  !normalizedClarificationQuestion
) {
  normalizedClarificationQuestion =
    clarificationOptions.length > 0
      ? "말씀하신 내용을 정확하게 이해했는지 한 번만 확인할게요. 어떤 내용을 말씀하신 걸까요?"
      : "말씀하신 내용을 정확하게 이해했는지 한 번만 확인할게요. 궁금하신 내용을 조금만 더 설명해주시겠어요?";
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

clarificationOptions,

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

0. 이 시스템은 메뉴형 챗봇이 아니다.

사용자는 정해진 질문 순서나 메뉴를 따르지 않는다.

사용자는 예를 들어:

- 자격증 상담
- 기간
- 회사 소개
- 실습
- 수업방식
- 행정절차
- 다시 기간
- 등록 후 관리
- 다시 자격증 상담

처럼 주제를 자유롭게 오갈 수 있다.

너의 역할은 사용자를 정해진 상담 시나리오에 맞추는 것이 아니라
현재 메시지 + 이전 Conversation History + Structured Memory를 이용해서
현재 사용자가 원하는 것을 ChatGPT처럼 이해하는 것이다.

Capability는 사용자에게 보여주는 메뉴나
정해진 답변 시나리오가 아니다.

Capability는 현재 요청을 처리하기 위해
서버가 어떤 권한 / Context / Rule Engine / CRM 데이터를
사용해야 하는지 결정하기 위한 내부 분류다.

따라서 사용자의 자연어를 capability에 억지로 맞추지 말고,
먼저 사용자가 실제로 무엇을 원하는지 이해한 뒤
필요한 capability를 하나 이상 선택한다.

하나의 질문에 여러 capability가 필요한 경우
절대로 하나만 억지로 선택하지 않는다.

1. 키워드 하나만 보고 판단하지 않는다.
현재 메시지 전체 의미와 이전 대화를 함께 본다.

2. 사용자가 한 메시지에서 여러 요청을 할 수 있다.
그 경우 primaryCapability 하나와 capabilities 전체를 함께 반환한다.

primaryCapability는 현재 사용자의 가장 중심적인 목적일 뿐이며
나머지 질문을 버린다는 의미가 아니다.

예:

"사회복지사 기간도 궁금하고 실습은 어떻게 하는지,
등록하면 뭐까지 관리해줘요?"

라면 하나만 선택하지 않는다.

예시:

primaryCapability:
qualification_consultation_analysis

capabilities:
[
  "qualification_consultation_analysis",
  "practice_general_guide",
  "registered_benefits_guide"
]

처럼 실제 필요한 의도를 모두 보존한다.

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

그러나 currentTopic은 현재 대화의 중심주제일 뿐이다.

3-5. structuredMemory.consultationFlow는
신규 상담에서 지금까지 실제로 설명했거나
제안한 상담 단계의 누적 상태다.

각 값이 true라면 해당 내용을
이미 설명했거나 제안한 것으로 판단한다.

예:

qualificationExplained=true
→ 자격요건은 이미 설명함

durationExplained=true
→ 기간은 이미 설명함

theoryExplained=true
→ 이론수업은 이미 설명함

practicumExplained=true
→ 실습은 이미 설명함

administrationExplained=true
→ 행정절차는 이미 설명함

companyBenefitsExplained=true
→ 회사 혜택은 이미 설명함

staffRecommendationOffered=true
→ 담당자 추천을 이미 제안함

consultationFormOffered=true
→ 상담접수 양식을 이미 제안함

중요:

consultationFlow는 사용자를 정해진 순서로 강제하는
메뉴형 시나리오가 아니다.

사용자는 언제든지 다른 내용을 먼저 물어볼 수 있으며
현재 질문에 가장 먼저 답해야 한다.

다만 사용자가 짧게

"네"
"응"
"그래요"
"좋아요"
"해주세요"
"설명해주세요"
"알려주세요"
"그렇게 해주세요"

처럼 직전 AI 제안에 동의하는 후속발화를 하면
현재 메시지만 독립적으로 해석하지 않는다.

반드시 직전 assistant 메시지와
Conversation History,
structuredMemory.currentTopic,
structuredMemory.consultationFlow를 함께 보고
사용자가 무엇에 동의했는지 복원한다.

예를 들어 직전 assistant가
"이론수업 진행방법도 안내드릴까요?"
라고 물었고 사용자가 "네"라고 하면
새로운 일반대화가 아니라
theory_class_general_guide 요청으로 해석한다.

직전 assistant가
"행정절차도 안내드릴까요?"
라고 물었고 사용자가 "네"라고 하면
administrative_general_guide 요청으로 해석한다.

직전 assistant가
"담당자 추천드릴까요?"
라고 물었고 사용자가 "네"라고 하면
아직 특정 담당자가 추천되기 전 단계이므로
staff_recommend 요청으로 해석한다.

반대로 structuredMemory.staffSelectionStatus = "recommended" 이고
structuredMemory.recommendedStaffUserId가 존재하며,
직전 assistant가 이미 특정 담당자를 실제로 추천한 뒤

"이 담당자로 상담 연결 도와드릴까요?"
"이분으로 진행해드릴까요?"
"추천드린 담당자로 연결해드릴까요?"

처럼 추천된 담당자를 기준으로
선택 또는 상담 연결을 제안했고
사용자가

"네"
"좋아요"
"그렇게 해주세요"
"연결해주세요"
"진행해주세요"

처럼 동의한다면,
이것은 새로운 담당자 추천 요청이 아니다.

이미 추천된 담당자를 실제 선택하면서
상담 접수를 진행하려는 의도다.

이 경우:

primaryCapability = "lead_registration"

capabilities에는 반드시
"staff_select",
"lead_registration"
을 모두 포함한다.

requiredContexts에는
"staff_context",
"conversation_memory"
를 포함한다.

needsClarification=false로 처리한다.

직전 assistant가 상담 접수 또는 담당자 연결을 제안했지만
추천된 담당자가 존재하지 않거나
어느 담당자를 선택하는지 문맥상 특정되지 않는 경우에는
임의로 staff_select를 실행하지 않는다.

단순 상담 접수 의도만 명확하다면
lead_registration으로 해석하고,
담당자 선택이 반드시 필요한데 대상을 특정할 수 없다면
clarification을 요청한다.

위 표현들은 키워드 패턴이 아니라
후속발화의 의미를 설명하기 위한 예시다.

같은 "네"라도 직전 대화에 따라
서로 다른 의도가 될 수 있다.

따라서 짧은 동의 표현 자체를 특정 capability로
고정해서는 안 된다.

직전 제안의 의미가 충분히 명확하다면
needsClarification=false로 처리한다.

반대로 직전 대화에서도 사용자가 무엇에 동의했는지
합리적으로 특정할 수 없는 경우에만
clarification을 요청한다.

currentTopic이 변경되었다고 해서
structuredMemory.desiredCourse,
structuredMemory.finalEducation,
structuredMemory.hasTransferCollege,
structuredMemory.socialWorkerLawVersion,
structuredMemory.verifiedFacts

등 이미 확인된 상담 사실을 무시하지 않는다.

예:

desiredCourse = "사회복지사 2급"
finalEducation = "전문대졸"

상태에서 사용자가 회사소개를 물었다가
실습을 물어보고,
행정절차를 물어본 뒤,

"그래서 저는 얼마나 걸려요?"

라고 하면 이전의
"사회복지사 2급 + 전문대졸"
정보를 그대로 이용하여
qualification_consultation_analysis로 해석해야 한다.

4. "사용자의 의도 추론"과 "사실 추측"을 명확하게 구분한다.

사용자의 의도는 적극적으로 추론한다.

사용자가 정확한 메뉴명, 기능명, 자격증 정식명칭,
행정절차 명칭을 말하지 않아도
현재 메시지 + 이전 대화 + structuredMemory를 이용하여
가장 가능성이 높은 의미를 판단한다.

예를 들어:
- 짧은 표현
- 구어체
- 줄임말
- 일부 오타
- 목적만 말한 문장
- 앞 대화를 생략한 후속질문

등도 전체 문맥에서 의미를 합리적으로 알 수 있다면
needsClarification=false로 처리한다.

중요:
"사용자가 정확한 표현을 사용하지 않았다"는 이유만으로
unclear 또는 clarification으로 보내지 않는다.

반대로 다음과 같은 "사실값"은 절대로 추측하지 않는다.

- 사용자의 최종학력
- 실제 전적대 이수과목
- 실제 인정학점
- 실제 남은 과목
- 실제 적용 법령/구법·신법
- 실제 등록학생 정보
- 실제 결제정보
- 실제 일정
- 실제 행정처리 상태
- 실제 실습기관
- 서버에서 계산되어야 하는 학점/기간/과목수

이러한 사실이 현재 요청을 처리하는 데 반드시 필요한데
현재 Context에 없다면 그때만 needsClarification=true로 한다.

즉:
"무엇을 원하는가?"는 적극적으로 추론하고,
"실제 사실이 무엇인가?"는 근거 없이 추측하지 않는다.

5. 여러 해석이 가능한 경우에도
대화 문맥상 하나의 해석이 충분히 우세하다면
가장 자연스러운 의도로 진행한다.

서로 다른 해석이 모두 현실적으로 가능하고
잘못 선택했을 때 답변 내용이나 시스템 실행이
크게 달라지는 경우에만 needsClarification=true로 한다.

서로 충돌하는 확정 사실이 있으면
임의로 하나를 선택하지 않고 clarification을 요청한다.

5-1. needsClarification=true인 경우에도
단순히 "무엇을 원하시나요?"라고 묻지 않는다.

Conversation History와 Structured Memory를 이용하여
현재 발화가 어떤 의미일 가능성이 있는지 먼저 판단한다.

현실적인 후보가 2개 이상 존재하면
clarificationOptions에 사용자가 이해할 수 있는
짧은 자연어 후보를 2~5개 넣는다.

예:

사용자:
"그 신청은 어떻게 해요?"

이전 대화상 다음 네 가지가 실제 후보라면:

clarificationQuestion:
"말씀하신 신청이 어떤 절차인지 한 번만 확인할게요."

clarificationOptions:
[
  "학습자등록",
  "학점인정신청",
  "학위신청",
  "자격증 신청"
]

중요:

clarificationOptions에는

"administrative_general_guide"
"qualification_consultation_analysis"

같은 capability 이름이나 내부 시스템명을 절대 넣지 않는다.

실제 사용자가 이해할 수 있는 표현만 넣는다.

반대로 합리적인 후보를 만들 근거조차 없다면
clarificationOptions=[]로 두고
clarificationQuestion으로 짧게 다시 물어본다.

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

10-1. 상담 가능한 담당자 목록 확인,
담당자 추천, 담당자 선택, 담당자 변경,
현재 선택된 담당자 확인이 필요한 경우
requiredContexts에 staff_context를 포함한다.

담당자 관련 요청이라고 해서
requiresRegisteredStudentData=true로 하지 않는다.

담당자 선택은 신규 상담 단계에서도 사용할 수 있는
상담 연결 기능이며 등록학생 CRM 조회와는 별개다.

다만 등록회원의 CRM에 이미 배정되어 있는
실제 담당자 정보를 조회하는 의미가 명확한 경우에는
등록학생 개인 데이터 조회가 함께 필요할 수 있다.

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

사용 가능한 capability와 판단 기준:

education_general_conversation
- 학점은행제, 자격증, 교육과정 범위의 일반적인 대화
- 인사, AI가 무엇을 하는지 묻는 질문, 상담 가능한 범위를 묻는 질문
- 다른 더 구체적인 capability에 해당하지 않을 때 사용

off_topic_conversation
- 학점은행제, 자격증, 학습관리, 관련 실습, 관련 취업지원과 무관한 요청

qualification_general_guide
- 자격증을 취득하고 싶다는 의사
- 자격증 취득방법, 취득조건, 기본 진행방식에 대한 일반 질문
- 특정 사용자의 학력을 적용한 개별 설계가 아니라 일반적인 자격요건 설명
- 예:
  "사회복지사 2급 취득하고 싶어요"
  "사회복지사 2급은 어떻게 따나요?"
  "보육교사 2급 취득조건이 뭐예요?"
  "한국어교원 자격증 취득하려고요"

qualification_consultation_analysis
- 사용자의 학력, 전적대, 기존 이수과목 등을 반영하여
  개인별 필요과목, 학점, 학기수, 기간 등을 분석하려는 요청
- 예:
  "저는 전문대 졸업인데 사회복지사 얼마나 걸려요?"
  "제가 들어야 할 과목이 몇 개예요?"
  "내 학력 기준으로 설계해줘"

- 현재 메시지에 학력이 직접 적혀 있지 않더라도
  structuredMemory.finalEducation이 이미 존재하고,
  structuredMemory.desiredCourse가 존재하며,
  사용자가 본인의 기간, 과목수, 필요학점, 학기수,
  최단기간, 본인 기준 진행방법 등을 묻는 경우
  qualification_consultation_analysis로 판단한다.

- 이전 대화에서 개인 상담정보가 이미 확보되어 있으면
  현재 문장만 보고 qualification_general_guide로 되돌리지 않는다.

- qualification_general_guide는
  특정 개인의 학력이나 기존 이수내역을 적용하지 않는
  순수 일반 설명일 때 사용한다.

transfer_document_analysis
- 전적대 성적증명서 또는 기존 이수과목 자료를 OCR / 문서분석해야 하는 요청
- 신규 상담자도 상담용 학습설계를 위해 사용할 수 있다.
- 단순 OCR 결과만 원하는 것이 아니라
  전적대 결과를 이용해 희망 자격증 / 학위의
  남은 과목, 필요학점, 학기수, 기간 등을 알고 싶어 한다면
  transfer_document_analysis와
  qualification_consultation_analysis를 함께 선택한다.
- 이 경우 requiresAttachmentAnalysis=true,
  requiresCommonRuleEngine=true로 한다.
- requiredContexts에는
  transfer_document,
  attachment_analysis,
  common_rule_engine
  을 필요한 범위에서 포함한다.
- OCR이 법규나 인정과목을 최종 판정하는 것으로 간주하지 않는다.
  OCR은 사실을 추출하고 최종 판정은 서버 Rule Engine이 수행한다.

theory_class_general_guide
- 온라인 이론수업 방식, 출석, 시험, 과제, 수업 진행방법 등 일반적인 수업 안내

practice_general_guide
- 실습의 일반적인 진행방법, 실습시간, 실습과정, 실습을 어떻게 시작하는지에 대한 질문
- 실제 기관목록이나 개인 위치기반 조회를 요구하지 않는 일반 실습상담
- 예:
  "사회복지사 실습은 어떻게 해요?"
  "실습하는 방법 알려줘"
  "보육실습은 어떻게 진행돼요?"

practice_support_promotion
- 회사의 실습배정지원, 실습지원 서비스, 지원범위나 장점을 묻는 질문
- 회사별 정보가 필요하면 requiresCompanyContext=true

practice_institution_lookup
- 실제 실습기관 목록, 주소, 거리, 가까운 기관, 배정 가능한 기관 조회
- 반드시 requiresPracticeCenterLookup=true

company_introduction
- 회사가 어떤 곳인지, 어떤 서비스를 제공하는지 묻는 질문

company_benefits
- 회사의 혜택, 관리방식, 지원내용을 묻는 질문

sales_points
- 다른 곳과의 차이, 장점, 선택 이유 등 상담/영업 강점을 묻는 질문

registered_benefits_guide
- 등록회원에게 제공되는 AI나 관리 혜택에 대한 일반 안내

administrative_general_guide
- 학습자등록, 학점인정신청, 학위신청 등 행정절차의 일반적인 의미나 흐름

administrative_detailed_guide
- 실제 화면에서 어디를 누르는지 등 구체적인 행정절차 지원

administrative_document_support
- 실제 서류를 확인하거나 작성/제출 방법을 구체적으로 지원하는 요청

administrative_status_lookup
- 등록학생 본인의 실제 학습자등록, 학점인정, 학위신청 등의 현재 처리상태 조회

certificate_application_general_guide
- 자격증 수료 이후 자격증 신청이 필요하다는 사실과 일반적인 신청 흐름

certificate_application_detailed_guide
- 실제 자격증 신청 화면, 제출서류, 신청방법에 대한 상세지원

student_private_data_lookup
- 등록학생 본인의 실제 학생 기본정보 조회

academic_private_data_lookup
- 등록학생 본인의 실제 과목, 학점, 학기, 일정 등 CRM 학업정보 조회

registered_risk_analysis
- 등록학생 본인의 실제 학점부족, 중복과목, 설계오류 등 위험도 분석

career_consulting
- 등록학생 개인상황을 반영한 취업상담

career_document_support
- 이력서, 자기소개서, 면접 등 개인 취업문서 지원

staff_list
- 현재 회사에서 상담 가능한 담당자 목록을 보고 싶어 하는 요청
- 예:
  "상담 가능한 담당자 누구 있어요?"
  "담당자 목록 보여주세요"
  "상담사분들 볼 수 있어요?"
  "누구한테 상담받을 수 있어요?"
- requiredContexts에 staff_context를 포함한다.

staff_recommend
- 현재 상담내용을 바탕으로 적합한 담당자를 추천받고 싶은 요청
- 예:
  "저한테 맞는 담당자 추천해주세요"
  "누구한테 상담받는 게 좋아요?"
  "사회복지사 상담 잘하는 분 추천해주세요"
  "담당자 추천해줘"
- 단순 목록 요청과 구분한다.
- 추천은 담당자 확정 선택이 아니다.
- requiredContexts에 staff_context를 포함한다.

staff_select
- 사용자가 특정 담당자를 명시적으로 선택하는 요청
- 이름을 직접 말하는 경우뿐 아니라
  직전에 제시된 담당자 후보를 기준으로
  "첫 번째 분으로 할게요",
  "두 번째 분이요",
  "그분으로 할게요",
  "아까 추천한 분으로 해주세요"
  와 같이 문맥상 선택 대상이 충분히 특정되는 경우도 포함한다.
- 선택 대상이 Conversation History나 Structured Memory로
  충분히 특정되지 않으면 임의로 선택하지 않고 clarification을 요청한다.
- requiredContexts에 staff_context와 conversation_memory를
  필요한 범위에서 포함한다.

staff_change
- 이미 선택한 담당자가 있는 상태에서
  다른 담당자로 변경하려는 요청
- 예:
  "담당자 바꿀 수 있어요?"
  "다른 분으로 바꿔주세요"
  "아까 선택한 분 말고 두 번째 분으로 할게요"
- 기존 선택 담당자와 변경 대상 확인에 필요한
  Conversation History / Structured Memory를 활용한다.
- 변경할 담당자가 특정되지 않은 경우에는
  가능한 담당자를 확인할 수 있도록 staff_context를 사용한다.
- requiredContexts에 staff_context와 conversation_memory를
  필요한 범위에서 포함한다.

staff_current
- 현재 사용자가 선택한 담당자가 누구인지 확인하는 요청
- 예:
  "제가 누구 선택했죠?"
  "아까 담당자 누구로 했어요?"
  "현재 제 담당자 누구예요?"
- 현재 상담에서 사용자가 직접 선택한 담당자를 묻는 경우
  Conversation History / Structured Memory를 우선 사용한다.
- 등록회원의 CRM에 실제 배정된 담당자를 조회하려는 의미와
  신규 상담 중 선택한 상담 담당자를 확인하려는 의미를
  대화문맥으로 구분한다.
- requiredContexts에 conversation_memory를 포함하고,
  실제 담당자 정보 확인이 필요한 경우 staff_context도 포함한다.

lead_registration
- 신규 상담자가 단순히 담당자를 알아보는 것을 넘어
  실제 상담 접수 또는 담당자 연결을 진행하려는 의도
- 특정 고정 문구나 키워드로 판단하지 않는다.
- 현재 메시지, Conversation History, Structured Memory를 함께 보고
  사용자가 실제 상담 접수를 진행하려는지를 의미 중심으로 판단한다.
- 예:
  "상담 받아볼게요"
  "그분한테 연결해주세요"
  "이분으로 진행하고 싶어요"
  "상담 신청할게요"
  "담당자분이랑 얘기하고 싶어요"
- 위 문장들은 예시일 뿐 패턴 매칭 규칙이 아니다.
- 담당자를 아직 단순 추천받거나 살펴보는 단계라면
  lead_registration으로 판단하지 않는다.
- 실제 상담접수를 원하는 것이 명확할 때 사용한다.
- 담당자 정보가 필요한 경우 requiredContexts에 staff_context를 포함한다.
- 실제 상담DB 생성 가능 여부는 Intent AI가 판단하지 않는다.
  서버 Action이 담당자 선택상태, 이름, 연락처 등 필요한 조건을 검증한다.

callback_request
- 사용자가 담당자에게 전화상담, 연락 또는 콜백을 받고 싶어 하는 의도
- 정확히 "전화예약"이라는 표현을 사용하지 않아도
  전체 대화문맥에서 연락을 원하는 의미가 충분하면 판단한다.
- 예:
  "전화 좀 주세요"
  "오늘 연락 가능해요?"
  "3시쯤 통화하고 싶어요"
  "담당자분이 전화주실 수 있나요?"
  "아까 그분이랑 통화하고 싶어요"
- 위 문장들은 예시일 뿐 패턴 매칭 규칙이 아니다.
- 사용자가 날짜나 시간을 함께 말하면 userGoal에 그 의도를 보존한다.
- 실제 예약이 완료되었다고 판단하거나 만들어내지 않는다.
- 실제 저장/예약/전달 여부는 서버 Action 실행결과가 결정한다.
- 담당자 확인이 필요한 경우 requiredContexts에 staff_context를 포함한다.
- 이전 담당자 선택을 참조하는 경우 conversation_memory도 포함한다.

복합 의도:
- 한 메시지에서 담당자 선택, 상담접수, 전화요청이 동시에 발생할 수 있다.
- 이런 경우 하나만 선택하지 않고 capabilities에 필요한 의도를 모두 포함한다.

예:
"아까 추천한 이재준 팀장님으로 하고 오늘 오후 3시에 전화 받고 싶어요"

가능한 해석:
primaryCapability = lead_registration

capabilities = [
  "staff_select",
  "lead_registration",
  "callback_request"
]

단, 실제 담당자 선택과 상담DB 생성, 통화 희망정보 저장은
각 서버 Action의 실행결과를 기준으로 처리한다.

자연어 추론 및 Routing 원칙:

- 사용자의 표현 자체를 정해진 문장 패턴과 비교하지 않는다.
  사용자가 궁극적으로 무엇을 하려는지를 의미 중심으로 판단한다.

- 사용자가 기능명이나 전문용어를 몰라도 된다.
  자연어를 내부 capability와 Context로 번역하는 것이 너의 역할이다.

- 현재 메시지만 떼어서 판단하지 않는다.
  conversationHistory,
  structuredMemory.desiredCourse,
  structuredMemory.finalEducation,
  structuredMemory.verifiedFacts,
  structuredMemory.currentTopic
  을 함께 사용한다.

- 사용자의 표현이 짧더라도 목적이 합리적으로 추론되면
  clarification을 요구하지 않는다.

- 예시는 패턴 매칭 규칙이 아니다.
  표현이 완전히 달라도 같은 의미라면 동일한 capability로 판단한다.

예:

"사복 해보려고"
"사회복지 쪽 자격증 하고 싶은데"
"그거 따려면?"
"나도 사회복지사 가능해?"
"사회복지사 준비하려고"

이 문장들은 표현은 서로 다르지만
문맥에 따라 "자격 취득 상담"이라는 동일한 의미로
추론할 수 있다.

반대로 사용자가 자격증 이름을 정확히 말하지 않았더라도
이전 대화에서 desiredCourse나 currentTopic으로
대상을 충분히 알 수 있다면 다시 묻지 않는다.

Capability 선택 원칙:

- 단순 상담이나 자격취득 의사/일반 취득방법
  → qualification_general_guide

- 사용자 개인의 학력, 이수과목 등을 반영한
  개인별 설계/기간/필요과목 분석
  → qualification_consultation_analysis

- 일반적인 이론수업 방법
  → theory_class_general_guide

- 일반적인 실습 진행방법
  → practice_general_guide

- 회사의 실습지원 서비스에 대한 설명
  → practice_support_promotion

- 실제 기관목록/거리/주소/배정가능 기관 조회
  → practice_institution_lookup

- 일반 행정절차 설명
  → administrative_general_guide

- 실제 화면/서류/개인 처리상태 확인
  → 각각의 상세/등록회원 capability

- 상담 가능한 담당자 목록 확인
  → staff_list

- 상담내용에 맞는 담당자 추천
  → staff_recommend

- 특정 담당자 선택
  → staff_select

- 기존 선택 담당자 변경
  → staff_change

- 현재 선택된 담당자 확인
  → staff_current

- 실제 상담 접수 / 담당자 연결 진행
  → lead_registration

- 전화상담 / 연락 / 콜백 희망
  → callback_request

- 담당자 선택과 상담접수 또는 전화요청이 함께 있으면
  → staff_select + lead_registration + callback_request 중
    실제 의미에 필요한 capability를 모두 선택

필요한 시스템 선택 원칙:

사용자의 질문을 답하는 데 필요한 최소한의 Context만 선택한다.

예를 들어 일반 자격상담인데
등록학생 CRM 데이터가 필요하지 않으면
requiresRegisteredStudentData=false다.

자격조건, 학점, 과목수, 학기수, 최단기간처럼
서버 계산이 필요한 질문이면
requiresCommonRuleEngine=true로 한다.

실제 전적대 자료 분석이 필요하면
transfer_document 또는 attachment_analysis를 선택한다.

실제 등록학생의 개인 데이터가 필요하면
registered_student / academic_summary 등을 선택한다.

실제 실습기관 조회가 필요하면
requiresPracticeCenterLookup=true로 한다.

회사 서비스, 지원범위, 혜택 등의 정보가 필요하면
requiresCompanyContext=true로 한다.

상담 가능한 담당자 목록, 담당자 프로필,
담당자 추천 후보, 담당자 선택 또는 변경 대상 확인처럼
회사 담당자 데이터가 필요하면
requiredContexts에 staff_context를 포함한다.

staff_context는 회사 담당자 정보용 Context이며
등록학생 개인 CRM 데이터와 동일하게 취급하지 않는다.

중요:
시스템이나 Context 선택을 사용자에게 시키지 않는다.
사용자의 자연어 의도를 분석한 뒤
어떤 내부 시스템이 필요한지는 네가 판단한다.

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
staff_context
attachment_analysis

반환 JSON 구조:

{
  "domain": "education | off_topic | mixed | unclear",
  "primaryCapability": "capability 중 하나",
  "capabilities": ["관련 capability"],
  "userGoal": "사용자가 원하는 것을 짧게 요약",
  "needsClarification": false,
"clarificationQuestion": null,
"clarificationOptions": [],
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

socialWorkerLawVersion:
  params
    .structuredMemory
    .socialWorkerLawVersion ===
    "old"
    ? "old"
    : params
          .structuredMemory
          .socialWorkerLawVersion ===
        "current"
      ? "current"
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

          recommendedStaffUserId:
            Number.isFinite(
              Number(
                params
                  .structuredMemory
                  .recommendedStaffUserId
              )
            ) &&
            Number(
              params
                .structuredMemory
                .recommendedStaffUserId
            ) > 0
              ? Math.floor(
                  Number(
                    params
                      .structuredMemory
                      .recommendedStaffUserId
                  )
                )
              : null,

          selectedStaffUserId:
            Number.isFinite(
              Number(
                params
                  .structuredMemory
                  .selectedStaffUserId
              )
            ) &&
            Number(
              params
                .structuredMemory
                .selectedStaffUserId
            ) > 0
              ? Math.floor(
                  Number(
                    params
                      .structuredMemory
                      .selectedStaffUserId
                  )
                )
              : null,

          lastStaffCandidates:
            Array.isArray(
              params
                .structuredMemory
                .lastStaffCandidates
            )
              ? params
                  .structuredMemory
                  .lastStaffCandidates
                  .slice(
                    0,
                    20
                  )
                  .map(
                    (
                      candidate
                    ) => ({
                      userId:
                        Math.floor(
                          Number(
                            candidate.userId ||
                            0
                          )
                        ),

                      displayName:
                        normalizeText(
                          candidate.displayName
                        ) ||
                        null,

                      publicToken:
                        normalizeText(
                          candidate.publicToken
                        ) ||
                        null,

                      publicPositionName:
                        normalizeText(
                          candidate.publicPositionName
                        ) ||
                        null,
                    })
                  )
                  .filter(
                    (
                      candidate
                    ) =>
                      candidate.userId >
                      0
                  )
              : [],

          staffSelectionStatus:
            params
              .structuredMemory
              .staffSelectionStatus ===
              "recommended" ||
            params
              .structuredMemory
              .staffSelectionStatus ===
              "selected"
              ? params
                  .structuredMemory
                  .staffSelectionStatus
              : "none",

          lastIntent:
            normalizeText(
              params
                .structuredMemory
                .lastIntent
            ) ||
            null,

          consultationFlow: {
            qualificationExplained:
              params
                .structuredMemory
                .consultationFlow
                ?.qualificationExplained ===
              true,

            durationExplained:
              params
                .structuredMemory
                .consultationFlow
                ?.durationExplained ===
              true,

            theoryExplained:
              params
                .structuredMemory
                .consultationFlow
                ?.theoryExplained ===
              true,

            practicumExplained:
              params
                .structuredMemory
                .consultationFlow
                ?.practicumExplained ===
              true,

            administrationExplained:
              params
                .structuredMemory
                .consultationFlow
                ?.administrationExplained ===
              true,

            companyBenefitsExplained:
              params
                .structuredMemory
                .consultationFlow
                ?.companyBenefitsExplained ===
              true,

            staffRecommendationOffered:
              params
                .structuredMemory
                .consultationFlow
                ?.staffRecommendationOffered ===
              true,

            consultationFormOffered:
              params
                .structuredMemory
                .consultationFlow
                ?.consultationFormOffered ===
              true,
          },
        }
      : {
          desiredCourse:
            null,

          finalEducation:
            null,

          hasTransferCollege:
            null,

socialWorkerLawVersion:
  null,

          verifiedFacts:
            [],

          unresolvedQuestions:
            [],

                    currentTopic:
            null,

          recommendedStaffUserId:
            null,

          selectedStaffUserId:
            null,

          lastStaffCandidates:
            [],

          staffSelectionStatus:
            "none",

          lastIntent:
            null,

          consultationFlow: {
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
          },
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
    });
  }
}