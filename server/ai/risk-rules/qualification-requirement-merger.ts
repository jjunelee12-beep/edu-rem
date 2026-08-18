import type {
  DegreeRequirementResolution,
} from "./degree-requirement-resolver";

import type {
  DegreeCreditAnalysis,
} from "./degree-credit-analyzer";

import type {
  QualificationRuleAnalysis,
  QualificationRiskCourseKey,
} from "./qualification-risk-analyzer";

export type UnifiedRequirementStatus =
  | "ready"
  | "review_required"
  | "unsupported";

export type UnifiedDegreeRequirement = {
  requiresDegree:
    boolean;

  requiresNewDegreeTrack:
    boolean;

  existingDegreeSatisfiesRequirement:
    boolean;

  minimumDegreeLevel:
    "none" |
    "associate" |
    "bachelor";

  degreeType:
    | "associate"
    | "bachelor"
    | "associate_second_major"
    | "bachelor_second_major"
    | null;

  isSecondMajor:
    boolean;

  requiredTotalCredits:
    number | null;

  currentTotalCredits:
    number;

  remainingTotalCredits:
    number | null;

  requiredMajorCredits:
    number | null;

  currentMajorCredits:
    number;

  remainingMajorCredits:
    number | null;

  requiredLiberalCredits:
    number | null;

  currentLiberalCredits:
    number;

  remainingLiberalCredits:
    number | null;

  currentGeneralCredits:
    number;

  requiredAccreditedCredits:
    number | null;

  requiresAccreditedCreditValidation:
    boolean;

  reason:
    string;
};

export type UnifiedQualificationRequirement = {
  canAnalyze:
    boolean;

  requiredSubjects:
    number | null;

  completedSubjects:
    number | null;

  remainingSubjects:
    number | null;

  requiredCredits:
    number | null;

  completedCredits:
    number | null;

  remainingCredits:
    number | null;

  practiceHours:
    number | null;

  lawVersion:
    string | null;

  /**
   * 과정별 상세정보를 그대로 보존한다.
   *
   * 사회복지:
   * 필수/선택/구법신법
   *
   * 보육:
   * 영역/대면/실습/전필
   *
   * 한국어:
   * 1~5영역/전필
   *
   * 아동학:
   * 전필 핵심조건
   */
  details:
    Record<
      string,
      unknown
    >;

  /**
   * 실제 부족조건 목록.
   *
   * missingCandidates,
   * missingSlots,
   * 영역별 부족 등의
   * Planner 입력 근거로 사용한다.
   */
  requirementIssues:
    QualificationRuleAnalysis["issues"];
};

export type UnifiedQualificationRequirements = {
  courseKey:
    QualificationRiskCourseKey;

  finalEducationGroup:
  "below_high_school"
  | "high_school"
  | "associate"
  | "bachelor"
  | "graduate"
  | "unknown";

  status:
    UnifiedRequirementStatus;

  canPlan:
    boolean;

  requiresReview:
    boolean;

  blockingReasons:
    string[];

  degree:
    UnifiedDegreeRequirement;

  qualification:
    UnifiedQualificationRequirement;

  combined: {
    hasRemainingDegreeRequirement:
      boolean;

    hasRemainingQualificationRequirement:
      boolean;

    /**
     * 중요:
     *
     * 자격 부족과목 + 학위 부족학점을
     * 단순 합산한 숫자가 아니다.
     *
     * 다음 Subject Planner가
     * 동일 과목으로 두 요건을 동시에
     * 충족할 수 있는지 계산해야 한다.
     */
    requiresSubjectOptimization:
      boolean;
  };
};

function toNullableNumber(
  value:
    unknown
): number | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  const normalized =
    Number(
      value
    );

  return Number.isFinite(
    normalized
  )
    ? normalized
    : null;
}

function toNullableString(
  value:
    unknown
): string | null {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  return normalized ||
    null;
}

function getRecord(
  value:
    unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return {};
  }

  return value as
    Record<
      string,
      unknown
    >;
}

function getNestedRecord(
  source:
    Record<string, unknown>,
  key:
    string
) {
  return getRecord(
    source[key]
  );
}

function buildQualificationCommonValues(
  analysis:
    QualificationRuleAnalysis
): {
  requiredSubjects:
    number | null;

  completedSubjects:
    number | null;

  remainingSubjects:
    number | null;

  requiredCredits:
    number | null;

  completedCredits:
    number | null;

  remainingCredits:
    number | null;

  practiceHours:
    number | null;

  lawVersion:
    string | null;
} {
  const summary =
    analysis.summary ||
    {};

  /**
   * ─────────────────────────────
   * 사회복지사 2급
   * ─────────────────────────────
   */
  if (
    analysis.courseKey ===
    "social_worker_2"
  ) {
    const requiredSubjects =
      toNullableNumber(
        summary.totalSubjects
      );

    const completedRequired =
      toNullableNumber(
        summary
          .completedRequiredSubjects
      ) ?? 0;

    const completedElective =
      toNullableNumber(
        summary
          .completedElectiveSubjects
      ) ?? 0;

    const remainingRequired =
      toNullableNumber(
        summary
          .remainingRequiredSubjects
      ) ?? 0;

    const remainingElective =
      toNullableNumber(
        summary
          .remainingElectiveSubjects
      ) ?? 0;

    return {
      requiredSubjects,

      completedSubjects:
        analysis.canAnalyze
          ? completedRequired +
            completedElective
          : null,

      remainingSubjects:
        analysis.canAnalyze
          ? remainingRequired +
            remainingElective
          : null,

      requiredCredits:
        requiredSubjects ===
          null
          ? null
          : requiredSubjects *
            3,

      completedCredits:
        analysis.canAnalyze
          ? (
              completedRequired +
              completedElective
            ) *
            3
          : null,

      remainingCredits:
        analysis.canAnalyze
          ? (
              remainingRequired +
              remainingElective
            ) *
            3
          : null,

      practiceHours:
        toNullableNumber(
          summary.practiceHours
        ),

      lawVersion:
        toNullableString(
          summary.lawVersion
        ),
    };
  }

  /**
   * ─────────────────────────────
   * 보육교사 2급
   * ─────────────────────────────
   */
  if (
    analysis.courseKey ===
    "childcare_teacher_2"
  ) {
    const areas =
      getNestedRecord(
        summary,
        "areas"
      );

    const practice =
      getNestedRecord(
        areas,
        "practice"
      );

    return {
      requiredSubjects:
        toNullableNumber(
          summary.requiredSubjects
        ),

      completedSubjects:
        toNullableNumber(
          summary.completedSubjects
        ),

      remainingSubjects:
        toNullableNumber(
          summary.remainingSubjects
        ),

      requiredCredits:
        toNullableNumber(
          summary.requiredCredits
        ),

      completedCredits:
        toNullableNumber(
          summary.completedCredits
        ),

      remainingCredits:
        toNullableNumber(
          summary.remainingCredits
        ),

      practiceHours:
        toNullableNumber(
          practice.practiceHours
        ),

      lawVersion:
        null,
    };
  }

  /**
   * ─────────────────────────────
   * 한국어교원 2급
   * ─────────────────────────────
   */
  if (
    analysis.courseKey ===
    "korean_teacher_2"
  ) {
    return {
      requiredSubjects:
        null,

      completedSubjects:
        null,

      remainingSubjects:
        null,

      requiredCredits:
        toNullableNumber(
          summary
            .qualificationTotalCredits
        ),

      completedCredits:
        toNullableNumber(
          summary
            .completedQualificationCredits
        ),

      remainingCredits:
        toNullableNumber(
          summary
            .remainingQualificationCredits
        ),

      practiceHours:
        null,

      lawVersion:
        null,
    };
  }

  /**
   * ─────────────────────────────
   * 아동학사
   * ─────────────────────────────
   */
  if (
    analysis.courseKey ===
    "child_study_degree"
  ) {
    return {
      requiredSubjects:
        toNullableNumber(
          summary
            .minimumRequiredSubjects
        ),

      completedSubjects:
        toNullableNumber(
          summary
            .completedRequiredSubjects
        ),

      remainingSubjects:
        toNullableNumber(
          summary
            .remainingRequiredSubjects
        ),

      requiredCredits:
        null,

      completedCredits:
        null,

      remainingCredits:
        null,

      practiceHours:
        null,

      lawVersion:
        null,
    };
  }

  /**
   * 평생교육사 및 향후 추가과정은
   * 공통 필드명이 존재하면 우선 사용한다.
   */
  return {
    requiredSubjects:
      toNullableNumber(
        summary.requiredSubjects
      ),

    completedSubjects:
      toNullableNumber(
        summary.completedSubjects
      ),

    remainingSubjects:
      toNullableNumber(
        summary.remainingSubjects
      ),

    requiredCredits:
      toNullableNumber(
        summary.requiredCredits
      ),

    completedCredits:
      toNullableNumber(
        summary.completedCredits
      ),

    remainingCredits:
      toNullableNumber(
        summary.remainingCredits
      ),

    practiceHours:
      toNullableNumber(
        summary.practiceHours
      ),

    lawVersion:
      toNullableString(
        summary.lawVersion
      ),
  };
}

export function mergeQualificationRequirements(
  params: {
    degreeRequirement:
      DegreeRequirementResolution;

    degreeCreditAnalysis:
      DegreeCreditAnalysis;

    qualificationAnalysis:
      QualificationRuleAnalysis;
  }
): UnifiedQualificationRequirements {
  const {
    degreeRequirement,
    degreeCreditAnalysis,
    qualificationAnalysis,
  } =
    params;

  const blockingReasons:
    string[] =
    [];

  /**
   * ─────────────────────────────
   * 1. 과정 확인
   * ─────────────────────────────
   */
  if (
    qualificationAnalysis.courseKey ===
    "unknown"
  ) {
    blockingReasons.push(
      "지원하지 않는 과정이거나 과정명을 확인할 수 없습니다."
    );
  }

  /**
   * ─────────────────────────────
   * 2. 최종학력 확인
   * ─────────────────────────────
   */

/**
 * 초졸 / 중졸
 *
 * 학점은행제 대학과정 진행 전
 * 고졸 이상의 선행학력이 필요하므로
 * 이후 Subject / Semester Planner를 실행하지 않는다.
 */
if (
  degreeRequirement
    .finalEducationGroup ===
  "below_high_school"
) {
  blockingReasons.push(
    degreeRequirement.reason ||
    "현재 최종학력이 초졸 또는 중졸인 경우 바로 학점은행제 과정을 진행할 수 없습니다. 먼저 고졸 이상의 학력을 충족해야 합니다."
  );
}
  if (
    degreeRequirement
      .finalEducationGroup ===
    "unknown"
  ) {
    blockingReasons.push(
      "최종학력이 확인되지 않아 학위경로를 확정할 수 없습니다."
    );
  }

  /**
   * ─────────────────────────────
   * 3. 자격요건 분석 가능 여부
   * ─────────────────────────────
   */
    if (
    !qualificationAnalysis
      .canAnalyze
  ) {
    const qualificationBlockingMessages =
      qualificationAnalysis
        .issues
        .filter(
          (
            issue
          ) =>
            issue.severity ===
              "danger" ||
            issue.severity ===
              "warning"
        )
        .map(
          (
            issue
          ) =>
            String(
              issue.message ||
              ""
            ).trim()
        )
        .filter(
          Boolean
        );

    if (
      qualificationBlockingMessages.length >
      0
    ) {
      blockingReasons.push(
        ...qualificationBlockingMessages
      );
    } else {
      blockingReasons.push(
        "자격요건 적용기준을 확정할 수 없어 추가 확인이 필요합니다."
      );
    }
  }

  /**
   * ─────────────────────────────
   * 4. 새 학위가 필요한데
   * 학위 Rule 분석이 불가능한 경우
   * ─────────────────────────────
   */
  if (
    degreeRequirement
      .requiresNewDegreeTrack &&
    !degreeCreditAnalysis
      .canAnalyze
  ) {
    blockingReasons.push(
      "새 학위과정이 필요하지만 적용할 학위 학점기준을 확정할 수 없습니다."
    );
  }

  const qualificationCommon =
    buildQualificationCommonValues(
      qualificationAnalysis
    );

  const degreeSummary =
    degreeCreditAnalysis
      .summary;

  const remainingTotalCredits =
    degreeSummary
      .remainingTotalCredits;

  const remainingMajorCredits =
    degreeSummary
      .remainingMajorCredits;

  const remainingLiberalCredits =
    degreeSummary
      .remainingLiberalCredits;

  const hasRemainingDegreeRequirement =
    degreeRequirement
      .requiresNewDegreeTrack &&
    (
      (
        remainingTotalCredits !==
          null &&
        remainingTotalCredits >
          0
      ) ||
      (
        remainingMajorCredits !==
          null &&
        remainingMajorCredits >
          0
      ) ||
      (
        remainingLiberalCredits !==
          null &&
        remainingLiberalCredits >
          0
      )
    );

  const hasRemainingQualificationRequirement =
    (
      qualificationCommon
        .remainingSubjects !==
        null &&
      qualificationCommon
        .remainingSubjects >
        0
    ) ||
    (
      qualificationCommon
        .remainingCredits !==
        null &&
      qualificationCommon
        .remainingCredits >
        0
    ) ||
    qualificationAnalysis
      .issues
      .some(
        (
          issue
        ) =>
          issue.severity ===
          "danger"
      );

  /**
   * Social Worker lawResolution처럼
   * summary 안에서 명시적으로 review가
   * 필요한 경우도 잡는다.
   */
  const lawResolution =
    getNestedRecord(
      qualificationAnalysis
        .summary,
      "lawResolution"
    );

  const explicitRequiresReview =
    lawResolution
      .requiresReview ===
      true;

  const requiresReview =
    explicitRequiresReview ||
    blockingReasons.length >
      0;

  const status:
    UnifiedRequirementStatus =
    qualificationAnalysis
      .courseKey ===
      "unknown"
      ? "unsupported"
      : requiresReview
        ? "review_required"
        : "ready";

  const canPlan =
    status ===
    "ready";

  return {
    courseKey:
      qualificationAnalysis
        .courseKey,

    finalEducationGroup:
      degreeRequirement
        .finalEducationGroup,

    status,

    canPlan,

    requiresReview,

    blockingReasons,

    degree: {
      requiresDegree:
        degreeRequirement
          .requiresDegree,

      requiresNewDegreeTrack:
        degreeRequirement
          .requiresNewDegreeTrack,

      existingDegreeSatisfiesRequirement:
        degreeRequirement
          .existingDegreeSatisfiesRequirement,

      minimumDegreeLevel:
        degreeRequirement
          .minimumDegreeLevel,

      degreeType:
        degreeCreditAnalysis
          .degreeType,

      isSecondMajor:
        degreeCreditAnalysis
          .isSecondMajor,

      requiredTotalCredits:
        degreeSummary
          .requiredTotalCredits,

      currentTotalCredits:
        degreeSummary
          .currentTotalCredits,

      remainingTotalCredits:
        degreeSummary
          .remainingTotalCredits,

      requiredMajorCredits:
        degreeSummary
          .requiredMajorCredits,

      currentMajorCredits:
        degreeSummary
          .currentMajorCredits,

      remainingMajorCredits:
        degreeSummary
          .remainingMajorCredits,

      requiredLiberalCredits:
        degreeSummary
          .requiredLiberalCredits,

      currentLiberalCredits:
        degreeSummary
          .currentLiberalCredits,

      remainingLiberalCredits:
        degreeSummary
          .remainingLiberalCredits,

      currentGeneralCredits:
        degreeSummary
          .currentGeneralCredits,

      requiredAccreditedCredits:
        degreeSummary
          .requiredAccreditedCredits,

      requiresAccreditedCreditValidation:
        degreeSummary
          .requiresAccreditedCreditValidation,

      reason:
        degreeRequirement
          .reason,
    },

        qualification: {
      canAnalyze:
        qualificationAnalysis
          .canAnalyze,

      ...qualificationCommon,

      details: {
        ...qualificationAnalysis
          .summary,
      },

      requirementIssues:
        qualificationAnalysis
          .issues,
    },

    combined: {
      hasRemainingDegreeRequirement,

      hasRemainingQualificationRequirement,

      /**
       * 하나라도 남아 있다면
       * 다음 단계에서 실제 과목 조합을 계산해야 한다.
       */
      requiresSubjectOptimization:
        hasRemainingDegreeRequirement ||
        hasRemainingQualificationRequirement,
    },
  };
}