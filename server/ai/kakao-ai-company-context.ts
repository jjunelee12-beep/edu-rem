import * as db from "../db";

/**
 * 카카오 AI가 회사마다 다른 정보를
 * 자연어 상담에 사용할 수 있도록 만든
 * 회사 전용 Context.
 *
 * 주의:
 * 이 값은 "정답 문구"가 아니다.
 *
 * AI는 이 정보를 사실 근거로 사용하면서
 * 고객의 질문, 이전 대화, 현재 상황에 맞춰
 * 자연스러운 답변을 새로 생성해야 한다.
 */
export type KakaoAiCompanyContext = {
  organizationId: number;

  enabled: boolean;

  features: {
    newConsultationEnabled: boolean;
    registeredStudentEnabled: boolean;
    ocrEnabled: boolean;
    practiceSupportEnabled: boolean;
    assigneeRecommendationEnabled: boolean;
    priceDisclosureEnabled: boolean;
  };

  identity: {
    aiDisplayName: string;
  };

  conversation: {
    welcomeMessage: string | null;
    defaultGuideMessage: string | null;
    consultationHoursMessage: string | null;
  };

  /**
   * 고객에게 설명 가능한 회사 사실.
   *
   * AI는 이 내용을 그대로 복사해서
   * 출력하지 않는다.
   */
  companyKnowledge: {
    companyIntroduction: string | null;
    companyBenefits: string | null;

salesPoints: string | null;

registeredAiBenefits: string | null;

priceGuide: string | null;

    /**
     * DB 컬럼명은 classManagementPolicy지만
     * 실제 의미는 "이론수업 안내"다.
     */
    theoryClassGuide: string | null;

    /**
     * 실습 진행방법 +
     * 회사가 제공하는 실습지원 설명.
     *
     * 실제 실습기관 DB 목록은 포함하지 않는다.
     */
    practiceGuide: string | null;

    /**
     * 회사가 등록회원에게 제공하는
     * 행정절차 지원 범위.
     */
    administrativeSupportGuide:
      string | null;
  };

  /**
   * 고객에게 그대로 공개하는 문구가 아니라
   * AI가 상담할 때 지켜야 하는 회사별 내부정책.
   */
    internalPolicy: {
    consultationPolicy: string | null;
  };

  /**
   * 신규상담 Lead Flow 회사별 설정.
   *
   * 실제 단계명 / 순서 / 완료조건 /
   * Action / 분기 규칙은 DB 설정에서 관리한다.
   *
   * Company Context는 내용을 해석하지 않고
   * Flow Engine에 전달할 원본 설정만 보관한다.
   */
  leadFlowConfig:
    unknown | null;
};

function normalizeOptionalText(
  value: unknown
): string | null {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  return normalized ||
    null;
}

function normalizeRequiredText(
  value: unknown,
  fallback: string
): string {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  return normalized ||
    fallback;
}

/**
 * organizationId 기준으로
 * 회사별 Kakao AI 설정을 조회하고,
 * 고객 상담에 사용할 안전한 Context로 변환한다.
 *
 * 이 함수에서는:
 * - 학생 조회
 * - 상담DB 조회
 * - 실습기관 조회
 * - 학점 계산
 * - 자격요건 계산
 *
 * 을 하지 않는다.
 *
 * 순수하게 "회사 설정"만 담당한다.
 */
export async function buildKakaoAiCompanyContext(
  params: {
    organizationId: number;
  }
): Promise<KakaoAiCompanyContext> {
  const organizationId =
    Math.floor(
      Number(
        params.organizationId ||
        0
      )
    );

  if (
    !Number.isFinite(
      organizationId
    ) ||
    organizationId <= 0
  ) {
    throw new Error(
      "카카오 AI 회사 정보가 올바르지 않습니다."
    );
  }

  const settings =
    await db.getKakaoAiSettings({
      organizationId,
    });

  return {
    organizationId,

    enabled:
      settings?.enabled ===
      true,

    features: {
      newConsultationEnabled:
        settings
          ?.newConsultationEnabled ===
        true,

      registeredStudentEnabled:
        settings
          ?.registeredStudentEnabled ===
        true,

      ocrEnabled:
        settings?.ocrEnabled ===
        true,

      practiceSupportEnabled:
        settings
          ?.practiceSupportEnabled ===
        true,

      assigneeRecommendationEnabled:
        settings
          ?.assigneeRecommendationEnabled ===
        true,

      priceDisclosureEnabled:
        settings
          ?.priceDisclosureEnabled ===
        true,
    },

    identity: {
      aiDisplayName:
        normalizeRequiredText(
          settings?.aiDisplayName,
          "EduCanvas AI"
        ),
    },

    conversation: {
      welcomeMessage:
        normalizeOptionalText(
          settings?.welcomeMessage
        ),

      defaultGuideMessage:
        normalizeOptionalText(
          settings
            ?.defaultGuideMessage
        ),

      consultationHoursMessage:
        normalizeOptionalText(
          settings
            ?.consultationHoursMessage
        ),
    },

    companyKnowledge: {
      companyIntroduction:
        normalizeOptionalText(
          settings
            ?.companyIntroduction
        ),

      companyBenefits:
        normalizeOptionalText(
          settings
            ?.companyBenefits
        ),

salesPoints:
  normalizeOptionalText(
    settings
      ?.salesPoints
  ),

registeredAiBenefits:
  normalizeOptionalText(
    settings
      ?.registeredAiBenefits
  ),

priceGuide:
  normalizeOptionalText(
    settings
      ?.priceGuide
  ),

      theoryClassGuide:
        normalizeOptionalText(
          settings
            ?.classManagementPolicy
        ),

      practiceGuide:
        normalizeOptionalText(
          settings
            ?.practicePolicy
        ),

      administrativeSupportGuide:
        normalizeOptionalText(
          settings
            ?.administrativeSupportPolicy
        ),
    },

        internalPolicy: {
      consultationPolicy:
        normalizeOptionalText(
          settings
            ?.consultationPolicy
        ),
    },

    leadFlowConfig:
      settings
        ?.leadFlowConfig ??
      null,
  };
}