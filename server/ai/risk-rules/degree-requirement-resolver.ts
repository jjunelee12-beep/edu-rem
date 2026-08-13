import {
  DEGREE_RULES,
  type FinalEducationGroup,
  type RiskCourseKey,
} from "./risk-rule-master";

export type DegreeRequirementLevel =
  | "none"
  | "associate"
  | "bachelor";

export type DegreeRequirementResolution = {
  finalEducationGroup:
    FinalEducationGroup;

  courseKey:
    RiskCourseKey | "unknown";

  requiresDegree:
    boolean;

  minimumDegreeLevel:
    DegreeRequirementLevel;

  /**
   * 현재 학력만으로
   * 자격증 학위조건을 충족하는지 여부.
   *
   * 보육교사/아동학/한국어교원처럼
   * 별도 학위취득이 필요한 과정은
   * 기존 학력이 높아도 false가 될 수 있다.
   */
  existingDegreeSatisfiesRequirement:
    boolean;

  /**
   * 해당 과정에서 새 학위설계가 필요한가.
   */
  requiresNewDegreeTrack:
    boolean;

  /**
   * 바로 확정 가능한 기본 학위 Rule.
   *
   * 보육교사처럼 기존 학력에 따라
   * 타전공 학위경로를 추가로 정해야 하는 경우
   * null로 둔다.
   */
  defaultDegreeRule:
    typeof DEGREE_RULES[
      keyof typeof DEGREE_RULES
    ] |
    null;

  reason:
    string;
};

export function resolveFinalEducationGroup(
  finalEducation:
    unknown
): FinalEducationGroup {
  const normalized =
    String(
      finalEducation ??
      ""
    )
      .trim()
      .replace(
        /\s+/g,
        ""
      )
      .toLowerCase();

  if (!normalized) {
    return "unknown";
  }

/**
 * 초졸 / 중졸
 *
 * 학점은행제 학위과정 진행을 위해서는
 * 먼저 고등학교 졸업 이상의 학력이 필요하다.
 *
 * 절대 high_school 그룹으로 올리지 않는다.
 */
if (
  normalized === "초졸" ||
  normalized.includes(
    "초등학교졸업"
  ) ||
  normalized === "중졸" ||
  normalized.includes(
    "중학교졸업"
  )
) {
  return "below_high_school";
}

/**
 * 대학원 중퇴
 *
 * 대학원 진학 전 학사학위가 존재하므로
 * 학사 보유자로 처리한다.
 */
if (
  normalized.includes(
    "대학원"
  ) &&
  normalized.includes(
    "중퇴"
  )
) {
  return "bachelor";
}

/**
 * 전문대 / 대학교 중퇴
 */
if (
  normalized.includes(
    "중퇴"
  ) &&
  (
    normalized.includes(
      "전문대"
    ) ||
    normalized.includes(
      "전문대학교"
    ) ||
    normalized.includes(
      "대학교"
    ) ||
    normalized.includes(
      "4년제"
    ) ||
    normalized.includes(
      "대학중퇴"
    )
  )
) {
  return "high_school";
}

if (
  normalized ===
    "고졸" ||
  normalized.includes(
    "고등학교졸업"
  ) ||
  normalized.includes(
    "고등학교"
  )
) {
  return "high_school";
}

  if (
    normalized ===
      "전문대졸" ||
    normalized ===
      "전문학사" ||
    normalized.includes(
      "전문대학교"
    ) ||
    normalized.includes(
      "전문대"
    )
  ) {
    return "associate";
  }

  if (
    normalized ===
      "대졸" ||
    normalized ===
      "학사" ||
    normalized.includes(
      "4년제"
    ) ||
    normalized.includes(
      "대학교졸업"
    )
  ) {
    return "bachelor";
  }

  if (
    normalized.includes(
      "석사"
    ) ||
    normalized.includes(
      "박사"
    ) ||
    normalized.includes(
      "대학원"
    )
  ) {
    return "graduate";
  }

  return "unknown";
}

export function resolveDegreeRequirement(
  params: {
    courseKey:
      RiskCourseKey |
      "unknown";

    finalEducation:
      unknown;
  }
): DegreeRequirementResolution {
  const finalEducationGroup =
    resolveFinalEducationGroup(
      params.finalEducation
    );

  const courseKey =
    params.courseKey;

/**
 * 초졸 / 중졸 공통 선행학력 차단
 *
 * 과정 종류와 관계없이
 * 학점은행제 학위과정을 진행하기 전에
 * 먼저 고등학교 졸업 이상의 학력이 필요하다.
 */
if (
  finalEducationGroup ===
  "below_high_school"
) {
  return {
    finalEducationGroup,

    courseKey,

    requiresDegree:
      true,

    minimumDegreeLevel:
      "none",

    existingDegreeSatisfiesRequirement:
      false,

    requiresNewDegreeTrack:
      false,

    defaultDegreeRule:
      null,

   reason:
  "현재 최종학력이 초졸 또는 중졸인 경우 바로 학점은행제 과정을 진행할 수 없습니다. 먼저 고등학교 졸업 또는 고졸 검정고시 등을 통해 고졸 이상의 학력을 충족해야 하며, 이후 희망 과정에 맞춰 학습설계를 진행할 수 있습니다.",
  };
}

  /**
   * 최종학력 자체를 모르면
   * 학위 필요 여부를 자동 확정하지 않는다.
   */
  if (
  finalEducationGroup ===
  "unknown"
) {
  return {
    finalEducationGroup,

    courseKey,

    requiresDegree:
      true,

    minimumDegreeLevel:
      "none",

    existingDegreeSatisfiesRequirement:
      false,

    requiresNewDegreeTrack:
      false,

    defaultDegreeRule:
      null,

    reason:
      "최종학력이 확인되지 않아 학위 필요 여부를 판정할 수 없습니다.",
  };
}

  /**
   * 사회복지사 2급
   *
   * 고졸:
   * 전문학사 학위 필요
   *
   * 전문학사 이상:
   * 별도의 새 학위 불필요
   */
  if (
    courseKey ===
    "social_worker_2"
  ) {
    if (
      finalEducationGroup ===
      "high_school"
    ) {
      return {
        finalEducationGroup,

        courseKey,

        requiresDegree:
          true,

        minimumDegreeLevel:
          "associate",

        existingDegreeSatisfiesRequirement:
          false,

        requiresNewDegreeTrack:
          true,

        defaultDegreeRule:
          DEGREE_RULES.associate,

        reason:
          "고졸 사회복지사 2급 과정은 전문학사 학위와 자격과목을 함께 충족해야 합니다.",
      };
    }

    return {
      finalEducationGroup,

      courseKey,

      requiresDegree:
        false,

      minimumDegreeLevel:
        "associate",

      existingDegreeSatisfiesRequirement:
        true,

      requiresNewDegreeTrack:
        false,

      defaultDegreeRule:
        null,

      reason:
        "전문학사 이상 학력이 확인되어 사회복지사 2급 취득을 위한 별도 학위과정은 필요하지 않습니다.",
    };
  }

  /**
   * 평생교육사 2급
   *
   * 고졸:
   * 전문학사 필요
   *
   * 전문학사 이상:
   * 별도 새 학위 불필요
   */
  if (
    courseKey ===
    "lifelong_educator_2"
  ) {
    if (
      finalEducationGroup ===
      "high_school"
    ) {
      return {
        finalEducationGroup,

        courseKey,

        requiresDegree:
          true,

        minimumDegreeLevel:
          "associate",

        existingDegreeSatisfiesRequirement:
          false,

        requiresNewDegreeTrack:
          true,

        defaultDegreeRule:
          DEGREE_RULES.associate,

        reason:
          "고졸 평생교육사 2급 과정은 전문학사 학위와 자격과목을 함께 충족해야 합니다.",
      };
    }

    return {
      finalEducationGroup,

      courseKey,

      requiresDegree:
        false,

      minimumDegreeLevel:
        "associate",

      existingDegreeSatisfiesRequirement:
        true,

      requiresNewDegreeTrack:
        false,

      defaultDegreeRule:
        null,

      reason:
        "전문학사 이상 학력이 확인되어 평생교육사 2급 취득을 위한 별도 학위과정은 필요하지 않습니다.",
    };
  }

  /**
   * 보육교사 2급
   *
   * 기존 학력이 있더라도
   * 보육교사 자격과 연결되는
   * 새 학위취득 과정이 필요하다.
   *
   * 최소 학위수준은 전문학사.
   */
  if (
    courseKey ===
    "childcare_teacher_2"
  ) {
    if (
  finalEducationGroup ===
  "high_school"
) {
  return {
    finalEducationGroup,

    courseKey,

    requiresDegree:
      true,

    minimumDegreeLevel:
      "associate",

    existingDegreeSatisfiesRequirement:
      false,

    requiresNewDegreeTrack:
      true,

    defaultDegreeRule:
      DEGREE_RULES.associate,

    reason:
      "고졸 보육교사 2급 과정은 보육 관련 전문학사 학위와 자격과목을 함께 충족해야 합니다.",
  };
}

    return {
  finalEducationGroup,

  courseKey,

  requiresDegree:
    true,

  minimumDegreeLevel:
    "associate",

  existingDegreeSatisfiesRequirement:
    false,

  requiresNewDegreeTrack:
    true,

  defaultDegreeRule:
    DEGREE_RULES
      .associate_second_major,

  reason:
    "전문학사 이상 학력이 있으므로 보육교사 2급 과정은 아동·보육 관련 전문학사 타전공 36학점 학위요건과 자격과목을 함께 충족해야 합니다.",
};
  }

  /**
   * 아동학사
   *
   * 학사학위 취득 자체가 목적이므로
   * 기존 학력과 관계없이 학위설계가 필요하다.
   */
  if (
    courseKey ===
    "child_study_degree"
  ) {
    if (
      finalEducationGroup ===
      "high_school"
    ) {
      return {
        finalEducationGroup,

        courseKey,

        requiresDegree:
          true,

        minimumDegreeLevel:
          "bachelor",

        existingDegreeSatisfiesRequirement:
          false,

        requiresNewDegreeTrack:
          true,

        defaultDegreeRule:
          DEGREE_RULES.bachelor,

        reason:
          "고졸 아동학사 과정은 학사 140학점 기준의 학위설계가 필요합니다.",
      };
    }

if (
  finalEducationGroup ===
  "associate"
) {
  return {
    finalEducationGroup,

    courseKey,

    requiresDegree:
      true,

    minimumDegreeLevel:
      "bachelor",

    existingDegreeSatisfiesRequirement:
      false,

    requiresNewDegreeTrack:
      true,

    defaultDegreeRule:
      DEGREE_RULES.bachelor,

    reason:
      "전문학사 보유 아동학사 과정은 기존 전적대 학점을 활용하면서 학사 140학점 요건을 충족하는 일반 학사과정으로 설계해야 합니다.",
  };
}

    return {
      finalEducationGroup,

      courseKey,

      requiresDegree:
        true,

      minimumDegreeLevel:
        "bachelor",

      existingDegreeSatisfiesRequirement:
        false,

      requiresNewDegreeTrack:
        true,

      defaultDegreeRule:
        DEGREE_RULES
          .bachelor_second_major,

      reason:
        "아동학사는 기존 학력과 별도로 아동학 학사학위 취득요건을 충족해야 합니다.",
    };
  }

  /**
   * 한국어교원 2급
   *
   * 학사학위와 한국어교육 전공요건을
   * 함께 충족해야 하는 과정으로 처리한다.
   */
  if (
    courseKey ===
    "korean_teacher_2"
  ) {
    if (
      finalEducationGroup ===
      "high_school"
    ) {
      return {
        finalEducationGroup,

        courseKey,

        requiresDegree:
          true,

        minimumDegreeLevel:
          "bachelor",

        existingDegreeSatisfiesRequirement:
          false,

        requiresNewDegreeTrack:
          true,

        defaultDegreeRule:
          DEGREE_RULES.bachelor,

        reason:
          "고졸 한국어교원 2급 과정은 한국어교육 전공 학사학위 취득요건까지 함께 충족해야 합니다.",
      };
    }

if (
  finalEducationGroup ===
  "associate"
) {
  return {
    finalEducationGroup,

    courseKey,

    requiresDegree:
      true,

    minimumDegreeLevel:
      "bachelor",

    existingDegreeSatisfiesRequirement:
      false,

    requiresNewDegreeTrack:
      true,

    defaultDegreeRule:
      DEGREE_RULES.bachelor,

    reason:
      "전문학사 보유 한국어교원 2급 과정은 기존 전적대 학점을 활용하면서 한국어교육 전공 학사학위 요건을 함께 충족해야 합니다.",
  };
}

    return {
      finalEducationGroup,

      courseKey,

      requiresDegree:
        true,

      minimumDegreeLevel:
        "bachelor",

      existingDegreeSatisfiesRequirement:
        false,

      requiresNewDegreeTrack:
        true,

      defaultDegreeRule:
        DEGREE_RULES
          .bachelor_second_major,

      reason:
        "한국어교원 2급은 기존 학력과 별도로 한국어교육 분야 학위요건을 함께 검사해야 합니다.",
    };
  }

  return {
    finalEducationGroup,

    courseKey,

    requiresDegree:
      false,

    minimumDegreeLevel:
      "none",

    existingDegreeSatisfiesRequirement:
      false,

    requiresNewDegreeTrack:
      false,

    defaultDegreeRule:
      null,

    reason:
      "현재 과정에 연결된 학위 Rule이 없습니다.",
  };
}