/**
 * 카카오 AI 고객 유형.
 *
 * lead:
 * - 아직 CRM 등록회원으로 인증되지 않은 신규/상담 고객
 *
 * registered:
 * - CRM 학생으로 인증된 등록회원
 */
export type KakaoAiCustomerType =
  | "lead"
  | "registered";

/**
 * 카카오 AI가 수행하거나 안내할 수 있는 기능 단위.
 *
 * 실제 사용자 자연어는 이후 Intent Router가
 * 이 capability 중 하나 이상으로 변환한다.
 */
export type KakaoAiCapability =
  /**
   * 학점은행제 / 자격증 범위의
   * 일반 자연어 상담
   */
  | "education_general_conversation"

  /**
   * 학점은행제와 무관한 질문
   */
  | "off_topic_conversation"

  /**
   * 자격증 / 과정 취득조건 설명
   */
  | "qualification_general_guide"

  /**
   * 최종학력 / 전적대 기반
   * 상담용 자격요건 분석
   */
  | "qualification_consultation_analysis"

  /**
   * 전적대 / 성적증명서 OCR
   */
  | "transfer_document_analysis"

  /**
   * 이론수업 일반 진행방식 설명
   */
  | "theory_class_general_guide"

  /**
   * 실습 일반 진행방식 설명
   */
  | "practice_general_guide"

  /**
   * 회사의 실습배정지원센터
   * 존재 / 혜택 / 운영 증빙 소개
   */
  | "practice_support_promotion"

  /**
   * 실제 실습기관 DB 내역 조회
   */
  | "practice_institution_lookup"

  /**
   * 회사 소개
   */
  | "company_introduction"

  /**
   * 회사 혜택
   */
  | "company_benefits"

  /**
   * 상담 강조포인트 활용
   */
  | "sales_points"

  /**
   * 등록 후 사용할 수 있는
   * AI / 학습관리 혜택 설명
   */
  | "registered_benefits_guide"

  /**
   * 학습자등록 / 학점인정신청 /
   * 학위신청 / 자격증신청이
   * 무엇인지에 대한 개념 설명
   */
  | "administrative_general_guide"

  /**
   * 행정절차를 실제로
   * 어떻게 진행하는지 상세 안내
   */
  | "administrative_detailed_guide"

  /**
   * 행정절차 화면 / 서류 /
   * 고객이 보낸 사진 확인
   */
  | "administrative_document_support"

  /**
   * 등록자의 실제 행정절차
   * 완료여부 조회
   */
  | "administrative_status_lookup"

  /**
   * 자격증 발급 / 신청 절차가
   * 존재한다는 일반 설명
   */
  | "certificate_application_general_guide"

  /**
   * 자격증 신청방법 /
   * 준비서류 / 화면 상세지원
   */
  | "certificate_application_detailed_guide"

  /**
   * 등록자의 실제 학생정보 조회
   */
  | "student_private_data_lookup"

  /**
   * 등록자의 실제 학점 /
   * 과목 / 학기 / 일정 조회
   */
  | "academic_private_data_lookup"

  /**
   * 등록자의 실제 위험도 분석
   */
  | "registered_risk_analysis"

  /**
   * 등록자의 취업컨설팅
   */
  | "career_consulting"

  /**
   * 등록자의 이력서 /
   * 자기소개서 / 면접 지원
   */
  | "career_document_support";

/**
 * 권한판단 결과.
 */
export type KakaoAiAccessDecision = {
  allowed: boolean;

  customerType:
    KakaoAiCustomerType;

  capability:
    KakaoAiCapability;

  /**
   * AI 내부 판단용 코드.
   */
  reasonCode:
    | "ALLOWED"
    | "OFF_TOPIC"
    | "REGISTERED_ONLY"
    | "LEAD_ONLY"
    | "UNKNOWN_CAPABILITY";

  /**
   * 고객에게 보여줄 수 있는
   * 자연어 답변의 방향.
   *
   * 최종 문장을 고정하는 값이 아니다.
   * AI가 이 의미를 유지하면서 자연스럽게 말한다.
   */
  responseGuidance:
    string | null;

  /**
   * 차단 시 회사의 등록회원 혜택을
   * 자연스럽게 연결해도 되는지 여부.
   *
   * true라고 해서 매번 영업문구를
   * 붙이라는 뜻은 아니다.
   */
  canMentionRegisteredBenefits:
    boolean;
};

/**
 * 신규 고객에게 허용되는 기능.
 *
 * 중요:
 * 신규도 ChatGPT처럼 자연어로 자유롭게 대화하지만
 * "학점은행제 / 자격증 상담"이라는 범위 안에서만
 * 자유롭다.
 */
const LEAD_ALLOWED_CAPABILITIES =
  new Set<KakaoAiCapability>([
    "education_general_conversation",

    "qualification_general_guide",

    "qualification_consultation_analysis",

    "transfer_document_analysis",

    "theory_class_general_guide",

    "practice_general_guide",

    "practice_support_promotion",

    "company_introduction",

    "company_benefits",

    "sales_points",

    "registered_benefits_guide",

    "administrative_general_guide",

    "certificate_application_general_guide",
  ]);

/**
 * 등록회원에게만 허용되는 기능.
 */
const REGISTERED_ONLY_CAPABILITIES =
  new Set<KakaoAiCapability>([
    "practice_institution_lookup",

    "administrative_detailed_guide",

    "administrative_document_support",

    "administrative_status_lookup",

    "certificate_application_detailed_guide",

    "student_private_data_lookup",

    "academic_private_data_lookup",

    "registered_risk_analysis",

    "career_consulting",

    "career_document_support",
  ]);

/**
 * 등록회원은 학점은행제 / 자격증 관련 범위 안에서
 * 신규 상담 기능 + 등록회원 전용 기능을
 * 모두 사용할 수 있다.
 */
const REGISTERED_ALLOWED_CAPABILITIES =
  new Set<KakaoAiCapability>([
    ...LEAD_ALLOWED_CAPABILITIES,
    ...REGISTERED_ONLY_CAPABILITIES,
  ]);

/**
 * 신규 고객에게 등록회원 전용 기능이 요청되었을 때
 * AI가 유지해야 할 응답 방향.
 */
function buildRegisteredOnlyGuidance(
  capability:
    KakaoAiCapability
): string {
  switch (capability) {
    case "practice_institution_lookup":
      return (
        "실습 진행방식과 실습배정지원센터의 존재 및 지원혜택은 설명할 수 있지만, " +
        "실제 실습기관 목록·주소·거리·배정가능 내역 조회는 등록회원에게만 제공된다고 자연스럽게 안내한다."
      );

    case "administrative_detailed_guide":
      return (
        "학습자등록, 학점인정신청, 학위신청 등의 개념과 필요한 이유는 설명할 수 있지만, " +
        "실제 신청 순서·사이트 메뉴·클릭방법·작성방법은 등록회원에게 제공되는 학습관리 서비스라고 안내한다."
      );

    case "administrative_document_support":
      return (
        "행정절차 관련 화면이나 서류를 어떻게 작성·선택해야 하는지에 대한 상세 확인은 " +
        "등록회원에게 제공되는 서비스라고 안내한다. 신규 고객의 사진이나 서류를 이용해 실제 행정절차를 단계별로 진행시키지 않는다."
      );

    case "administrative_status_lookup":
      return (
        "학습자등록·학점인정신청·학위신청 등의 실제 완료상태 조회는 " +
        "등록회원의 개인 학습관리 정보이므로 등록회원에게만 제공된다고 안내한다."
      );

    case "certificate_application_detailed_guide":
      return (
        "자격증 과정 종료 후 별도의 자격증 신청 절차가 있다는 점은 설명할 수 있지만, " +
        "실제 신청방법·준비서류·화면별 상세 안내는 등록회원에게 제공된다고 안내한다."
      );

    case "student_private_data_lookup":
    case "academic_private_data_lookup":
      return (
        "실제 학생의 수강내역, 학점, 과목, 학기, 결제, 예정일 등 개인 CRM 데이터 조회는 " +
        "등록회원 인증 후 사용할 수 있는 기능이라고 안내한다."
      );

    case "registered_risk_analysis":
      return (
        "등록 후에는 실제 수강내역과 학점정보를 기반으로 누락·중복·학점부족 등의 위험요소를 지속적으로 확인할 수 있다고 안내한다. " +
        "신규 상담 단계에서는 전적대 자료를 통한 상담용 분석까지만 제공한다."
      );

    case "career_consulting":
    case "career_document_support":
      return (
        "개인 조건을 기반으로 한 취업컨설팅, 이력서·자기소개서·면접지원은 " +
        "등록회원에게 제공되는 추가 AI 학습관리 서비스라고 안내한다."
      );

    default:
      return (
        "해당 기능은 등록회원에게 제공되는 학습관리 서비스라고 안내한다."
      );
  }
}

/**
 * 카카오 AI 중앙 접근정책.
 *
 * 회사별 consultationPolicy보다 우선한다.
 *
 * 즉 회사 설정에 신규 고객에게
 * 실습기관 목록을 보여주라고 적혀 있더라도
 * 중앙 정책에서 금지하면 허용하지 않는다.
 */
export function decideKakaoAiAccess(
  params: {
    customerType:
      KakaoAiCustomerType;

    capability:
      KakaoAiCapability;
  }
): KakaoAiAccessDecision {
  const {
    customerType,
    capability,
  } = params;

  /**
   * 학점은행제 / 자격증 범위 밖 질문은
   * 신규 / 등록회원 모두 차단한다.
   *
   * 카카오 AI는 범용 ChatGPT가 아니라
   * 교육상담 / 학습관리 AI이기 때문이다.
   */
  if (
    capability ===
    "off_topic_conversation"
  ) {
    return {
      allowed: false,

      customerType,

      capability,

      reasonCode:
        "OFF_TOPIC",

      responseGuidance:
        "학점은행제 및 자격증 과정 상담과 관련된 내용만 안내할 수 있다고 자연스럽게 답변한다.",

      canMentionRegisteredBenefits:
        false,
    };
  }

  /**
   * 신규 고객
   */
  if (
    customerType ===
    "lead"
  ) {
    if (
      LEAD_ALLOWED_CAPABILITIES.has(
        capability
      )
    ) {
      return {
        allowed: true,

        customerType,

        capability,

        reasonCode:
          "ALLOWED",

        responseGuidance:
          null,

        canMentionRegisteredBenefits:
          false,
      };
    }

    if (
      REGISTERED_ONLY_CAPABILITIES.has(
        capability
      )
    ) {
      return {
        allowed: false,

        customerType,

        capability,

        reasonCode:
          "REGISTERED_ONLY",

        responseGuidance:
          buildRegisteredOnlyGuidance(
            capability
          ),

        canMentionRegisteredBenefits:
          true,
      };
    }

    return {
      allowed: false,

      customerType,

      capability,

      reasonCode:
        "UNKNOWN_CAPABILITY",

      responseGuidance:
        "현재 상담 범위에서 제공할 수 있는 내용인지 확인이 필요하므로 임의로 답하지 말고 필요한 내용을 고객에게 다시 확인한다.",

      canMentionRegisteredBenefits:
        false,
    };
  }

  /**
   * 등록회원
   */
  if (
    customerType ===
    "registered"
  ) {
    if (
      REGISTERED_ALLOWED_CAPABILITIES.has(
        capability
      )
    ) {
      return {
        allowed: true,

        customerType,

        capability,

        reasonCode:
          "ALLOWED",

        responseGuidance:
          null,

        canMentionRegisteredBenefits:
          false,
      };
    }

    return {
      allowed: false,

      customerType,

      capability,

      reasonCode:
        "UNKNOWN_CAPABILITY",

      responseGuidance:
        "현재 학점은행제 및 자격증 학습관리 범위에서 처리할 수 있는 요청인지 확인이 필요하므로 필요한 내용을 다시 질문한다.",

      canMentionRegisteredBenefits:
        false,
    };
  }

  return {
    allowed: false,

    customerType,

    capability,

    reasonCode:
      "UNKNOWN_CAPABILITY",

    responseGuidance:
      "고객 유형을 확인할 수 없어 요청을 처리하지 않는다.",

    canMentionRegisteredBenefits:
      false,
  };
}

/**
 * AI가 자연어 답변을 생성할 때 항상 지켜야 하는
 * EduCanvas 중앙 대화 원칙.
 *
 * 회사별 상담정책보다 우선한다.
 */
export const KAKAO_AI_CORE_CONVERSATION_RULES = [
  "카카오 AI는 메뉴형 FAQ 챗봇처럼 답변하지 않고 사람과 대화하듯 자연스러운 한국어로 응답한다.",

  "사용자의 질문 순서가 뒤섞여 있어도 현재 질문의 의도와 이전 대화 맥락을 함께 해석한다.",

  "이전에 사용자가 이미 제공한 최종학력, 희망과정, 전적대 여부 등 확인된 정보는 다시 묻지 않는다.",

  "질문을 이해하는 데 필요한 정보가 부족하면 임의로 추측하지 않고 꼭 필요한 정보만 자연스럽게 질문한다.",

  "사용자의 말이 여러 의미로 해석되거나 기존 정보와 충돌하면 임의로 선택하지 않고 사용자에게 확인한다.",

  "회사 소개, 회사 혜택, 이론수업 안내, 실습 안내, 상담 강조포인트 등의 저장 문구를 그대로 복사하지 않고 사실 근거로만 사용하여 질문에 맞는 새로운 자연어 답변을 만든다.",

  "회사 설정에 없는 혜택, 지원, 비용, 일정, 실적을 만들어내지 않는다.",

  "자격증 취득조건, 학점, 인정과목, 부족과목, 학기 수, 법적 최대 이수제한, 학위 및 자격증 예상일정은 AI가 임의 계산하지 않고 공통 규칙엔진 결과를 우선한다.",

  "법규나 공통엔진 결과가 불확실하거나 분석 불가 상태이면 확정적으로 답하지 않고 부족한 정보 또는 확인이 필요한 이유를 설명한다.",

  "신규 고객은 학점은행제와 자격증 과정에 관한 자연어 상담은 자유롭게 할 수 있지만 등록회원 전용 개인 데이터와 관리기능에는 접근할 수 없다.",

  "신규 고객에게 학습자등록, 학점인정신청, 학위신청, 자격증 신청의 존재와 개념은 설명할 수 있지만 실제 진행방법, 화면별 안내, 서류작성 지원은 제공하지 않는다.",

  "신규 고객에게 실습 진행방법과 회사의 실습지원 서비스는 설명할 수 있지만 실제 실습기관 DB 목록, 주소, 거리, 배정가능 내역은 조회하거나 제공하지 않는다.",

  "신규 상담 중 전적대 성적증명서가 제공되면 상담 목적의 OCR과 자격요건 분석은 가능하지만 이를 등록회원의 실제 CRM 학습상태로 취급하지 않는다.",

  "등록회원은 인증된 본인 CRM 데이터를 기반으로 학점, 과목, 학기, 일정, 행정절차 상태, 위험도 등을 조회하여 안내할 수 있다.",

  "등록회원은 행정절차 화면이나 서류 사진을 보내 상세한 진행 도움을 받을 수 있지만 AI가 외부기관에 신청이나 제출을 대신 수행하지 않는다.",

  "등록회원의 취업컨설팅은 학습 및 자격과정과 연관된 범위에서 개인 상황을 고려하여 자연스럽게 지원할 수 있다.",

  "학점은행제 및 자격증 상담 범위를 벗어난 일반 잡담이나 다른 주제의 질문에는 해당 범위의 상담만 가능하다고 자연스럽게 안내한다.",

  "등록을 유도하는 문구나 회사 혜택은 모든 답변에 반복하지 않고 사용자의 질문과 현재 상담 흐름에 실제로 관련될 때만 자연스럽게 활용한다.",

  "답변을 위해 반드시 확인해야 하는 내용이 애매하면 좋은 답변을 억지로 만들어내는 것보다 사용자에게 물어보는 것을 우선한다.",
] as const;