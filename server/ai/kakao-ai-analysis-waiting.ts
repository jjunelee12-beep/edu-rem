/**
 * 카카오 AI 분석형 요청 대기안내 전용 모듈.
 *
 * 목적:
 *
 * Pre-Router에서 analysis로 확정된 요청에 대해
 * 실제 Memory / Intent / Context / CRM / 공통엔진 /
 * OCR / 위험도 / Composer가 실행되기 전에
 *
 * 카카오 사용자에게 즉시
 * "확인 중" 상태를 알려준다.
 *
 * 중요:
 *
 * 이 파일은 절대:
 *
 * - OpenAI 호출 X
 * - CRM 조회 X
 * - 학생 조회 X
 * - 학점 계산 X
 * - 공통엔진 실행 X
 * - OCR X
 * - 위험도 분석 X
 *
 * 을 하지 않는다.
 *
 * 최대한 즉시 문구를 반환하는 것이 역할이다.
 */

export type KakaoAiAnalysisWaitingKind =
  | "general_analysis"
  | "consultation_analysis"
  | "registered_lookup"
  | "document_analysis"
  | "practice_lookup";

export type KakaoAiAnalysisWaitingResult = {
  replyText:
    string;

  waitingKind:
    KakaoAiAnalysisWaitingKind;
};

function normalizeText(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  ).trim();
}

/**
 * 현재 메시지만 보고
 * 대기문구의 종류를 가볍게 정한다.
 *
 * 주의:
 *
 * 이것은 Intent 분석이 아니다.
 *
 * 실제 capability / 권한 /
 * 학습설계 / 자격조건 판단은
 * 기존 공용엔진이 담당한다.
 *
 * 여기서는 오직
 * "어떤 대기 문장을 보여줄까"
 * 만 결정한다.
 */
function resolveWaitingKind(
  message:
    string
): KakaoAiAnalysisWaitingKind {
  const normalized =
    normalizeText(
      message
    )
      .replace(
        /\s+/g,
        " "
      )
      .toLowerCase();

  /**
   * 성적증명서 / 첨부자료 / OCR 계열.
   */
  if (
    normalized.includes(
      "성적증명서"
    ) ||
    normalized.includes(
      "전적대"
    ) ||
    normalized.includes(
      "ocr"
    ) ||
    normalized.includes(
      "서류"
    ) ||
    normalized.includes(
      "사진"
    ) ||
    normalized.includes(
      "이미지"
    ) ||
    normalized.includes(
      "문서"
    )
  ) {
    return "document_analysis";
  }

  /**
   * 실습기관 / 실습센터 실제 조회 계열.
   */
  if (
    normalized.includes(
      "실습기관"
    ) ||
    normalized.includes(
      "실습 기관"
    ) ||
    normalized.includes(
      "실습센터"
    ) ||
    normalized.includes(
      "실습 센터"
    ) ||
    normalized.includes(
      "배정"
    )
  ) {
    return "practice_lookup";
  }

  /**
   * 등록회원 개인 CRM 조회 가능성이 높은 표현.
   *
   * 이것만으로 등록회원 권한을 부여하는 것은 아니다.
   * 실제 인증 / 권한은 기존 공용엔진이 판단한다.
   */
  if (
    normalized.includes(
      "내 담당자"
    ) ||
    normalized.includes(
      "제 담당자"
    ) ||
    normalized.includes(
      "내 과목"
    ) ||
    normalized.includes(
      "제 과목"
    ) ||
    normalized.includes(
      "내 학기"
    ) ||
    normalized.includes(
      "제 학기"
    ) ||
    normalized.includes(
      "내 일정"
    ) ||
    normalized.includes(
      "제 일정"
    ) ||
    normalized.includes(
      "위험도"
    ) ||
    normalized.includes(
      "등록회원"
    ) ||
    normalized.includes(
      "기존회원"
    )
  ) {
    return "registered_lookup";
  }

  /**
   * 신규/일반 학점은행제 상담 분석.
   */
  if (
    normalized.includes(
      "사회복지"
    ) ||
    normalized.includes(
      "보육교사"
    ) ||
    normalized.includes(
      "한국어교원"
    ) ||
    normalized.includes(
      "자격증"
    ) ||
    normalized.includes(
      "학위"
    ) ||
    normalized.includes(
      "학점"
    ) ||
    normalized.includes(
      "몇 과목"
    ) ||
    normalized.includes(
      "몇학기"
    ) ||
    normalized.includes(
      "몇 학기"
    ) ||
    normalized.includes(
      "기간"
    ) ||
    normalized.includes(
      "학습설계"
    ) ||
    normalized.includes(
      "최종학력"
    )
  ) {
    return "consultation_analysis";
  }

  return "general_analysis";
}

function buildWaitingReply(
  waitingKind:
    KakaoAiAnalysisWaitingKind
): string {
  if (
    waitingKind ===
      "document_analysis"
  ) {
    return (
      "보내주신 내용과 서류를 확인하고 있어요. " +
      "정확하게 분석해서 안내드릴게요. 잠시만 기다려주세요 😊"
    );
  }

  if (
    waitingKind ===
      "practice_lookup"
  ) {
    return (
      "실습 관련 내용을 확인하고 있어요. " +
      "조회 후 정확하게 안내드릴게요. 잠시만 기다려주세요 😊"
    );
  }

  if (
    waitingKind ===
      "registered_lookup"
  ) {
    return (
      "등록정보를 확인하고 있어요. " +
      "확인되는 대로 정확하게 안내드릴게요. 잠시만 기다려주세요 😊"
    );
  }

  if (
    waitingKind ===
      "consultation_analysis"
  ) {
    return (
      "말씀해주신 조건을 확인하고 있어요. " +
      "정확한 과정으로 안내드릴 수 있도록 잠시만 기다려주세요 😊"
    );
  }

  return (
    "문의해주신 내용을 확인하고 있어요. " +
    "정확하게 확인 후 안내드릴게요. 잠시만 기다려주세요 😊"
  );
}

/**
 * 분석형 요청의 즉시 대기안내 생성.
 *
 * 이 함수는 동기 함수다.
 *
 * await / DB / OpenAI가 없으므로
 * 카카오 응답 직전에 바로 사용할 수 있다.
 */
export function buildKakaoAiAnalysisWaitingResponse(
  params: {
    message:
      string;
  }
): KakaoAiAnalysisWaitingResult {
  const waitingKind =
    resolveWaitingKind(
      params.message
    );

  return {
    waitingKind,

    replyText:
      buildWaitingReply(
        waitingKind
      ),
  };
}