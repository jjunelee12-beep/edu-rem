export type SubjectEquivalenceMatchType =
  | "exact"
  | "official_equivalent"
  | "ai_predicted"
  | "none";

export type SubjectEquivalenceResult = {
  leftSubjectName:
    string;

  rightSubjectName:
    string;

  matchType:
    SubjectEquivalenceMatchType;

  isConfirmedDuplicate:
    boolean;

  requiresReview:
    boolean;

  confidence:
    number | null;

  reason:
    string;
};

export function normalizeRiskSubjectName(
  value:
    unknown
) {
  return String(
    value ??
    ""
  )
    .trim()
    .replace(/\s+/g, "")
    .replace(/[ⅠⅡⅢⅣⅤ]/g, "")
    .replace(/[()（）]/g, "")
    .toLowerCase();
}

/**
 * 공식 동일교과목 그룹.
 *
 * 여기에는 국가 기준 또는
 * 공식적으로 확인된 동일교과목만 넣는다.
 *
 * AI 추측 결과는 절대로 여기에 저장하지 않는다.
 */
export const OFFICIAL_SUBJECT_EQUIVALENCE_GROUPS:
  readonly (readonly string[])[] = [
    [
      "사회복지학개론",
      "사회복지개론",
      "사회사업개론",
      "사회사업론",
      "사회복지론",
      "사회복지학",
      "사회복지(학)총론",
    ],

    [
      "사회복지법제와실천",
      "사회복지법제",
      "사회복지법규",
      "사회복지법",
      "사회복지법과실천",
    ],

    [
      "사회복지실천기술론",
      "사회사업실천기술",
      "집단사회사업",
    ],

    [
      "사회복지실천론",
      "사회사업실천",
      "개별사회사업",
    ],

    [
      "사회복지정책론",
      "사회사업정책",
    ],

    [
      "사회복지조사론",
      "사회사업조사",
      "사회복지조사개론",
      "사회복지조사방법",
      "사회복지조사및연구방법",
      "사회복지조사통계",
    ],

    [
      "사회복지행정론",
      "사회사업행정",
    ],

    [
      "사회복지현장실습",
      "사회복지현장실습및세미나",
      "사회복지실습",
      "사회사업실습",
      "사회사업현장실습",
    ],

    [
      "인간행동과사회환경",
      "인간행동사회환경",
    ],

    [
      "지역사회복지론",
      "지역사회사업",
    ],

    [
      "가족상담및가족치료",
      "가족상담및치료",
      "상담및가족치료",
      "가족상담과가족치료",
    ],

    [
      "사회복지역사",
      "사회복지발달사",
      "사회복지역사와사상",
      "사회복지발달역사",
      "사회복지와역사",
    ],

    [
      "사회복지와문화다양성",
      "다문화사회복지론",
      "사회복지문화다양성",
    ],

    [
      "사회복지와인권",
      "사회복지인권",
    ],

    [
      "사회복지윤리와철학",
      "사회복지윤리철학",
    ],

    [
      "의료사회복지론",
      "의료사회사업",
    ],

    [
      "자원봉사론",
      "자원봉사자론",
      "자원봉사실천",
    ],

    [
      "장애인복지론",
      "장애자복지",
    ],

    [
      "정신건강론",
      "정신위생",
    ],

    [
      "정신건강사회복지론",
      "정신보건사회복지",
    ],

    [
      "프로그램개발과평가",
      "사회복지프로그램개발과평가",
      "프로그램개발및평가",
    ],

    [
      "학교사회복지론",
      "학교사회사업",
    ],
  ] as const;

function findOfficialEquivalentGroup(
  subjectName:
    unknown
) {
  const normalized =
    normalizeRiskSubjectName(
      subjectName
    );

  if (!normalized) {
    return null;
  }

  for (
    const group
    of OFFICIAL_SUBJECT_EQUIVALENCE_GROUPS
  ) {
    const normalizedGroup =
      group.map(
        normalizeRiskSubjectName
      );

    if (
      normalizedGroup.includes(
        normalized
      )
    ) {
      return group;
    }
  }

  return null;
}

export function resolveConfirmedSubjectEquivalence(
  leftSubjectName:
    unknown,
  rightSubjectName:
    unknown
): SubjectEquivalenceResult {
  const left =
    String(
      leftSubjectName ??
      ""
    ).trim();

  const right =
    String(
      rightSubjectName ??
      ""
    ).trim();

  const normalizedLeft =
    normalizeRiskSubjectName(
      left
    );

  const normalizedRight =
    normalizeRiskSubjectName(
      right
    );

  if (
    normalizedLeft &&
    normalizedRight &&
    normalizedLeft ===
      normalizedRight
  ) {
    return {
      leftSubjectName:
        left,

      rightSubjectName:
        right,

      matchType:
        "exact",

      isConfirmedDuplicate:
        true,

      requiresReview:
        false,

      confidence:
        1,

      reason:
        "과목명이 정규화 기준으로 동일합니다.",
    };
  }

  const leftGroup =
    findOfficialEquivalentGroup(
      left
    );

  const rightGroup =
    findOfficialEquivalentGroup(
      right
    );

  if (
    leftGroup &&
    rightGroup &&
    leftGroup ===
      rightGroup
  ) {
    return {
      leftSubjectName:
        left,

      rightSubjectName:
        right,

      matchType:
        "official_equivalent",

      isConfirmedDuplicate:
        true,

      requiresReview:
        false,

      confidence:
        1,

      reason:
        "공식 동일교과목 그룹에 포함되어 있습니다.",
    };
  }

  return {
    leftSubjectName:
      left,

    rightSubjectName:
      right,

    matchType:
      "none",

    isConfirmedDuplicate:
      false,

    requiresReview:
      false,

    confidence:
      null,

    reason:
      "정확 일치 또는 공식 동일교과목으로 확인되지 않았습니다.",
  };
}

export function createAiPredictedEquivalenceResult(
  params: {
    leftSubjectName:
      string;

    rightSubjectName:
      string;

    confidence:
      number;

    reason:
      string;
  }
): SubjectEquivalenceResult {
  const confidence =
    Math.max(
      0,
      Math.min(
        1,
        Number(
          params.confidence
        ) || 0
      )
    );

  return {
    leftSubjectName:
      params.leftSubjectName,

    rightSubjectName:
      params.rightSubjectName,

    matchType:
      "ai_predicted",

    isConfirmedDuplicate:
      false,

    requiresReview:
      true,

    confidence,

    reason:
      params.reason,
  };
}

export function getConfirmedSubjectEquivalenceKey(
  subjectName:
    unknown
) {
  const normalized =
    normalizeRiskSubjectName(
      subjectName
    );

  if (!normalized) {
    return "";
  }

  const officialGroup =
    findOfficialEquivalentGroup(
      subjectName
    );

  if (!officialGroup) {
    return normalized;
  }

  const canonicalSubjectName =
    officialGroup[0];

  return normalizeRiskSubjectName(
    canonicalSubjectName
  );
}