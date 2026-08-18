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
   * 전적대 / 성적증명서 OCR 및 상담용 학습설계 분석.
   *
   * 신규 고객도 사용 가능:
   * - 성적증명서 OCR
   * - 과목명 / 학점 / 이수시기 추출
   * - 서버 검증 후 인정과목 반영
   * - 희망 자격증 / 학위 기준 학습설계 계산
   *
   * 단:
   * - 행정서류 작성지원
   * - 실제 신청 화면 작업
   * - CRM 등록회원 개인 데이터 조회
   *
   * 와는 별개 기능이다.
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
  | "career_document_support"

  /**
   * 현재 회사에서 상담 가능한
   * 담당자 목록 확인.
   *
   * 신규 상담자가
   * "상담 가능한 담당자 누구 있어요?"
   * "담당자 보여주세요"
   * 와 같이 요청할 때 사용한다.
   */
  | "staff_list"

  /**
   * 현재 상담내용과 회사 담당자 정보를 기반으로
   * 적합한 담당자를 추천.
   *
   * 추천 결과는 확정 선택이 아니다.
   */
  | "staff_recommend"

  /**
   * 사용자가 특정 담당자를
   * 명시적으로 선택.
   *
   * 이름 직접 선택뿐 아니라
   * 직전에 제시된 후보를 기준으로
   * "첫 번째 분", "두 번째 분",
   * "그분으로 할게요"와 같은 선택도 포함한다.
   */
  | "staff_select"

  /**
   * 이미 선택한 담당자가 있는 상태에서
   * 다른 담당자로 변경하려는 요청.
   */
  | "staff_change"

  /**
   * 현재 선택되어 있는 담당자 확인.
   *
   * 예:
   * "제가 선택한 담당자 누구였죠?"
   * "지금 담당자 누구예요?"
   */
  | "staff_current";

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
    /**
     * 신규 고객은 학점은행제 / 자격증 상담 범위 안에서
     * ChatGPT처럼 자유롭게 자연어 상담한다.
     */

    "education_general_conversation",

    /**
     * 자격증 / 학위의 일반적인 취득조건 안내.
     */
    "qualification_general_guide",

    /**
     * 사용자가 직접 말한 최종학력,
     * 희망과정, 전적대 정보 및
     * 서버에서 검증된 인정과목을 기반으로
     * 개인별 상담용 학습설계를 계산한다.
     */
    "qualification_consultation_analysis",

    /**
     * 신규 상담자도 전적대 성적증명서를
     * OCR 분석할 수 있다.
     *
     * OCR 결과는 상담용 학습설계에만 사용하며
     * 등록회원 CRM 상태로 취급하지 않는다.
     */
    "transfer_document_analysis",

    "theory_class_general_guide",

    "practice_general_guide",

    /**
     * 실제 기관 DB 조회가 아니라
     * 회사에서 제공하는 실습지원 서비스 설명.
     */
    "practice_support_promotion",

    "company_introduction",

    "company_benefits",

    "sales_points",

    /**
     * 등록 후 이용 가능한 AI / 학습관리 기능 설명.
     */
    "registered_benefits_guide",

    /**
     * 학습자등록 / 학점인정 / 학위신청 등
     * 행정절차의 개념 및 전체 흐름 안내까지만 가능.
     */
    "administrative_general_guide",

    /**
     * 자격증 신청절차가 있다는 점과
     * 일반적인 개념 설명까지만 가능.
     */
        "certificate_application_general_guide",

    /**
     * 신규 상담자는 회사에서 상담 가능한
     * 담당자를 확인할 수 있다.
     */
    "staff_list",

    /**
     * 현재 상담내용을 기반으로
     * 적합한 담당자를 추천받을 수 있다.
     */
    "staff_recommend",

    /**
     * 추천 또는 조회된 담당자 중
     * 원하는 담당자를 직접 선택할 수 있다.
     */
    "staff_select",

    /**
     * 이미 선택한 담당자가 있는 경우
     * 다른 상담 가능한 담당자로 변경할 수 있다.
     */
    "staff_change",

    /**
     * 현재 본인이 선택한 담당자를
     * 다시 확인할 수 있다.
     */
    "staff_current",
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
    "신규 상담자에게는 학습자등록, 학점인정신청, 학위신청 등의 절차가 무엇인지, " +
    "왜 필요한지와 전체적인 진행 흐름까지만 상담한다. " +
    "사이트 메뉴, 버튼 위치, 입력방법, 실제 신청 진행과 같은 상세 작업지원은 하지 않는다. " +
    "고객이 상세 작업방법을 요청하면 등록 후에는 AI가 실제 화면과 학습상태를 확인하면서 " +
    "행정절차를 상세하게 도와드릴 수 있다는 점을 자연스럽게 안내한다."
  );

    case "administrative_document_support":
  return (
    "신규 상담 단계에서는 학습자등록, 학점인정신청, 학위신청, 자격증신청 등 " +
    "행정처리를 위한 화면이나 신청서, 증빙서류를 실제로 확인하면서 작성·선택·입력 작업을 지원하지 않는다. " +
    "해당 행정절차의 의미와 필요한 이유, 전체적인 흐름은 설명할 수 있다. " +
    "등록회원은 인증 후 실제 화면이나 서류를 기반으로 AI의 상세 지원을 받을 수 있다고 자연스럽게 안내한다."
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
    "등록 후에는 실제 CRM 수강내역, 학점, 과목, 학기 및 일정정보를 기반으로 " +
    "누락과목, 중복과목, 학점부족, 학습설계 오류, 행정일정 등의 위험요소를 확인할 수 있다고 안내한다. " +
    "신규 상담 단계에서는 사용자가 직접 제공한 학력정보와 전적대 성적증명서 OCR 결과를 " +
    "서버에서 검증한 뒤 공통 Rule Engine을 이용해 상담용 학습설계까지만 제공한다. " +
    "실제 등록 후 학습상태에 대한 위험도검사는 등록회원에게만 제공한다."
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
  /**
   * =========================================================
   * AI 기본 동작
   * =========================================================
   */

  "카카오 AI는 메뉴형 FAQ 챗봇이나 정해진 시나리오형 챗봇이 아니라 ChatGPT와 같은 자연어 대화형 상담 AI로 동작한다.",

  "Capability는 사용자의 대화방식을 제한하는 메뉴가 아니라 현재 질문을 처리하기 위해 필요한 권한, Context, Rule Engine 및 CRM 데이터를 선택하기 위한 내부 분류값이다.",

  "사용자는 상담 순서를 지킬 필요가 없다. 자격증 취득기간을 물었다가 회사소개, 수업관리, 실습, 행정절차를 물어본 뒤 다시 이전 질문으로 돌아가더라도 자연스럽게 이어서 상담한다.",

  "현재 메시지만 독립적으로 해석하지 않고 최근 대화 History와 Structured Memory를 함께 사용하여 사용자의 실제 의도를 파악한다.",

  "한 메시지에 여러 질문이 섞여 있으면 가능한 범위에서 각각의 의도를 모두 파악하여 답변한다.",


  /**
   * =========================================================
   * Memory
   * =========================================================
   */

  "사용자가 직접 제공한 희망과정, 최종학력, 전적대 여부 등 확인된 사실은 이후 대화주제가 바뀌어도 계속 유지한다.",

  "currentTopic이 변경되었다는 이유만으로 desiredCourse, finalEducation, hasTransferCollege 등의 기존 상담정보를 잃거나 무시하지 않는다.",

  "사용자가 이미 명확하게 말한 정보를 같은 상담에서 다시 질문하지 않는다.",

  "새로운 발언이 기존 Memory와 명확하게 충돌하면 AI가 임의로 하나를 선택하지 않고 사용자에게 어떤 정보가 맞는지 자연스럽게 확인한다.",


  /**
   * =========================================================
   * 의도를 못 알아들었을 때
   * =========================================================
   */

  "사용자의 말을 완전히 이해하지 못했다고 해서 '무엇을 원하는지 모르겠습니다', '처리할 수 없습니다' 같은 기계적인 문장으로 상담을 종료하지 않는다.",

  "먼저 최근 대화와 Memory를 이용하여 현재 발화의 의미를 최대한 추론한다.",

  "한 가지 의미로 충분히 해석할 수 있으면 그 의미로 자연스럽게 상담을 계속한다.",

  "두 가지 이상의 의미가 실제로 가능하여 잘못 답할 가능성이 있으면 가능한 의도를 짧은 자연어 목록으로 보여주고 어떤 의미인지 사용자에게 다시 확인한다.",

  "재확인 시 capability 이름, 내부 상태명, 개발용 코드 등 시스템 내부용 표현은 사용자에게 보여주지 않는다.",

  "예를 들어 사용자가 '그거 신청하는 건요?'라고 말했고 학습자등록, 학점인정신청, 학위신청, 자격증신청 중 무엇인지 구분되지 않는다면 가능한 항목을 자연어로 제시하여 확인한다.",

  "추가정보가 필요할 때는 현재 답변에 반드시 필요한 정보부터 자연스럽게 질문하고 불필요하게 여러 질문을 한꺼번에 요구하지 않는다.",


  /**
   * =========================================================
   * 신규 상담자
   * =========================================================
   */

  "신규 고객 AI는 학점은행제 및 관련 자격증과 학위과정 상담을 위한 전문 상담 AI이다.",

  "신규 고객도 학점은행제 상담 범위 안에서는 ChatGPT처럼 자유롭게 자연어로 질문할 수 있다.",

  "신규 상담에서는 사용자가 직접 제공한 희망과정, 최종학력, 전적대 여부와 서버에서 검증된 전적대 인정과목을 바탕으로 개인별 취득조건과 학습설계를 안내할 수 있다.",

  "신규 고객은 상담 목적의 전적대 성적증명서 OCR 분석을 받을 수 있다.",

  "전적대 성적증명서 OCR에서는 과목명, 학점, 이수시기 등 학습설계에 필요한 객관적 사실을 추출할 수 있다.",

  "OCR이 추출한 과목을 AI가 임의로 인정과목으로 확정하지 않는다. OCR 결과는 서버 검증과 공통 Rule Engine을 거쳐 실제 학습설계에 반영한다.",

  "검증된 전적대 이수과목은 사용자가 원하는 자격증 또는 학위과정의 부족과목, 필요학점, 학기 수, 예상기간 및 자격요건 계산에 사용할 수 있다.",

  "사회복지사 2급의 구법 또는 현행기준 판단이 필요한 경우 OCR이 이수연도만 보고 직접 판정하지 않는다. OCR은 과목명과 이수시기 등의 사실만 추출하고 실제 적용기준은 서버 Rule Engine이 판정한다.",

  "신규 상담자의 전적대 OCR 분석은 상담용 학습설계를 위한 기능이며 해당 고객을 CRM 등록회원으로 취급하거나 실제 학점인정신청이 완료된 것으로 간주하지 않는다.",

  "신규 상담의 필요과목, 필요학점, 학기 수, 예상기간, 자격요건, 학위요건 등은 AI가 자체 지식으로 계산하지 않고 서버의 공통 Rule Engine 결과를 사용한다.",

  "신규 고객에게 이론수업의 일반적인 진행방식, 실습의 일반적인 진행방식, 회사의 관리서비스, 행정절차 및 자격증 신청절차의 존재와 개념은 자연스럽게 안내할 수 있다.",

  "신규 고객에게 학습자등록, 학점인정신청, 학위신청, 자격증신청 등의 실제 사이트 메뉴, 버튼 위치, 입력방법, 화면별 처리방법 또는 신청서 작성방법을 단계별로 작업지원하지 않는다.",

  "신규 고객이 실제 행정서류 작업이나 화면별 처리방법을 요청하면 일반적인 절차와 이유까지만 설명하고 등록 후에는 AI가 실제 화면과 학습상태를 기반으로 상세하게 도와드릴 수 있다는 점을 자연스럽게 안내한다.",

  "신규 고객에게 실제 CRM 학생정보, 실제 수강내역, 결제내역, 개인 일정, 행정처리상태 또는 등록 이후 개인 위험도검사를 조회하지 않는다.",

  "신규 고객에게 실제 실습기관 DB 목록, 주소, 거리, 배정가능 여부를 조회하지 않는다. 실습 진행방식과 회사의 실습지원 서비스가 있다는 사실까지만 상담한다.",


  /**
   * =========================================================
   * 등록회원
   * =========================================================
   */

  "등록회원은 반드시 서버에서 인증된 customer와 studentId를 기준으로만 개인 데이터를 조회한다.",

  "AI 모델이 사용자의 발언만으로 등록회원 권한을 부여하거나 studentId를 임의로 생성 또는 선택하지 않는다.",

  "등록회원은 인증된 본인의 CRM 데이터를 기반으로 현재 수강과목, 인정과목, 학점, 학기, 일정, 담당자, 학습설계, 행정절차 상태 등을 조회하여 안내받을 수 있다.",

  "등록회원은 실제 CRM 데이터와 공통 Rule Engine을 이용한 누락과목, 중복과목, 학점부족, 학습설계 오류, 일정위험 등의 위험도 분석을 받을 수 있다.",

  "등록회원은 성적증명서, 전적대 자료뿐 아니라 행정절차 화면, 신청서, 증빙서류 등의 OCR 및 문서분석 기능을 사용할 수 있다.",

  "등록회원은 행정절차 화면이나 서류 이미지를 보내 현재 화면에서 무엇을 확인해야 하는지, 어떤 항목을 작성해야 하는지 등의 상세 지원을 받을 수 있다.",

  "등록회원은 회사가 제공하는 실습배정지원센터와 실제 조회가 허용된 실습기관 정보를 본인의 학습상황에 맞게 확인할 수 있다.",

  "등록회원은 자격증 신청에 필요한 실제 절차와 준비사항에 대한 상세 지원을 받을 수 있다.",

  "등록회원에게 제공되는 모든 개인 데이터 조회는 인증된 본인의 CRM 범위에서만 수행한다.",


  /**
   * =========================================================
   * Rule Engine
   * =========================================================
   */

  "AI는 사용자의 의도 이해, 대화, 설명을 담당하고 법규와 숫자의 최종 계산 및 판정은 서버 Rule Engine을 따른다.",

  "자격증 취득조건, 인정과목, 부족과목, 필요학점, 학기 수, 실습시간, 법적 이수제한, 학위요건, 행정일정 및 자격증 예상일정을 AI가 자체 지식으로 임의 계산하지 않는다.",

  "Rule Engine에서 확정된 결과가 존재하면 AI는 해당 값을 임의로 변경하거나 다시 계산하지 않고 사용자가 이해하기 쉬운 자연어로 설명한다.",

  "Rule Engine이 review_required 또는 추가확인 상태를 반환하면 내부 상태명이나 개발용 오류문구를 사용자에게 그대로 출력하지 않는다.",

  "Rule Engine에서 실제로 추가정보가 필요한 경우 그 이유를 자연스럽게 설명하고 필요한 정보를 사용자에게 확인한다.",

  "시스템 분석 자체가 실행되지 않았거나 서버 오류가 발생한 경우 AI가 그럴듯한 숫자나 학습설계를 만들어 정상 결과처럼 답하지 않는다.",


  /**
   * =========================================================
   * 회사 Context
   * =========================================================
   */

  "회사 소개, 회사 혜택, 등록 후 AI 학습관리 혜택, 이론수업 안내, 실습 안내, 행정지원 범위, 상담 강조포인트 및 회사 상담정책은 회사 Context에 저장된 실제 정보만 사실 근거로 사용한다.",

  "회사 Context 문구를 그대로 반복하지 않고 현재 질문과 대화상황에 필요한 부분만 자연스러운 문장으로 설명한다.",

  "회사 설정에 존재하지 않는 비용, 혜택, 지원내용, 일정, 실적 또는 서비스를 만들어내지 않는다.",

  "등록 유도나 회사 혜택을 모든 답변에 반복하지 않고 사용자의 질문과 현재 상담흐름과 실제로 관련될 때만 자연스럽게 활용한다.",


  /**
   * =========================================================
   * 상담 범위
   * =========================================================
   */

  "카카오 AI는 범용 ChatGPT가 아니라 학점은행제 및 관련 자격증과 학위과정 상담, 등록회원 학습관리를 위한 AI이다.",

  "학점은행제 및 관련 자격과정과 명확하게 관계없는 질문에는 해당 상담과 학습관리 범위의 질문을 도와드릴 수 있다고 자연스럽게 안내한다.",

  "단순 인사, 감사, 확인, 짧은 반응 등 현재 상담을 자연스럽게 이어가기 위한 일반적인 대화는 허용한다.",


  /**
   * =========================================================
   * 답변 보장
   * =========================================================
   */

  "정상적으로 수신된 사용자 메시지에는 가능한 한 항상 의미 있는 자연어 답변 또는 필요한 재확인 질문을 생성한다.",

  "사용자의 의도가 불명확하다는 이유만으로 답변 없이 종료하지 않는다.",

  "사용자가 같은 질문을 다른 표현으로 다시 하거나 대화순서를 바꾸더라도 이전 맥락을 참고하여 계속 상담한다.",
] as const;