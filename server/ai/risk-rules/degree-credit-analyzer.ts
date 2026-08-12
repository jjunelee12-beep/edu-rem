import type {
  DegreeRequirementResolution,
} from "./degree-requirement-resolver";

export type DegreeCreditRecognizedSubject = {
  subjectName:
    string;

  requirementType:
    string | null;

  category:
    string | null;

  credits:
    number;

  source:
    "plan" |
    "transfer" |
    "extra";
};

export type DegreeCreditIssue = {
  code:
    string;

  severity:
    "danger" |
    "warning" |
    "info";

  title:
    string;

  message:
    string;

  details?:
    Record<
      string,
      unknown
    >;
};

export type DegreeCreditAnalysis = {
  canAnalyze:
    boolean;

  degreeType:
    | "associate"
    | "bachelor"
    | "associate_second_major"
    | "bachelor_second_major"
    | null;

  isSecondMajor:
    boolean;

  issues:
    DegreeCreditIssue[];

  summary:
    {
      requiredTotalCredits:
        number | null;

      requiredMajorCredits:
        number | null;

      requiredLiberalCredits:
        number | null;

      currentTotalCredits:
        number;

      currentMajorCredits:
        number;

      currentLiberalCredits:
        number;

      currentGeneralCredits:
        number;

      remainingTotalCredits:
        number | null;

      remainingMajorCredits:
        number | null;

      remainingLiberalCredits:
        number | null;

      excludedTransferCredits:
        number;

      excludedTransferSubjectCount:
        number;

      requiresAccreditedCreditValidation:
        boolean;

      requiredAccreditedCredits:
        number | null;
    };
};

function toNumber(
  value:
    unknown
) {
  const normalized =
    Number(
      String(
        value ??
        "0"
      )
        .replace(
          /,/g,
          ""
        )
        .trim()
    );

  return Number.isFinite(
    normalized
  )
    ? normalized
    : 0;
}

function normalizeRequirementType(
  subject:
    DegreeCreditRecognizedSubject
) {
  const requirementType =
    String(
      subject.requirementType ??
      ""
    ).trim();

  const category =
    String(
      subject.category ??
      ""
    ).trim();

  if (
    requirementType ===
      "전공필수" ||
    requirementType ===
      "전공선택"
  ) {
    return "major";
  }

  if (
    requirementType ===
      "교양" ||
    category ===
      "교양"
  ) {
    return "liberal";
  }

  if (
    requirementType ===
      "일반" ||
    category ===
      "일반"
  ) {
    return "general";
  }

  return "unknown";
}

export function analyzeDegreeCredits(
  params: {
    degreeRequirement:
      DegreeRequirementResolution;

    recognizedSubjects:
      DegreeCreditRecognizedSubject[];
  }
): DegreeCreditAnalysis {
  const degreeRule =
    params.degreeRequirement
      .defaultDegreeRule;

  if (
    !params.degreeRequirement
      .requiresNewDegreeTrack
  ) {
    return {
      canAnalyze:
        false,

      degreeType:
        null,

      isSecondMajor:
        false,

      issues: [],

      summary: {
        requiredTotalCredits:
          null,

        requiredMajorCredits:
          null,

        requiredLiberalCredits:
          null,

        currentTotalCredits:
          0,

        currentMajorCredits:
          0,

        currentLiberalCredits:
          0,

        currentGeneralCredits:
          0,

        remainingTotalCredits:
          null,

        remainingMajorCredits:
          null,

        remainingLiberalCredits:
          null,

        excludedTransferCredits:
          0,

        excludedTransferSubjectCount:
          0,

        requiresAccreditedCreditValidation:
          false,

        requiredAccreditedCredits:
          null,
      },
    };
  }

  if (!degreeRule) {
    return {
      canAnalyze:
        false,

      degreeType:
        null,

      isSecondMajor:
        false,

      issues: [
        {
          code:
            "DEGREE_RULE_UNRESOLVED",

          severity:
            "warning",

          title:
            "학위설계 기준 확인 필요",

          message:
            "학위과정은 필요하지만 적용할 학위 기준이 확정되지 않았습니다.",
        },
      ],

      summary: {
        requiredTotalCredits:
          null,

        requiredMajorCredits:
          null,

        requiredLiberalCredits:
          null,

        currentTotalCredits:
          0,

        currentMajorCredits:
          0,

        currentLiberalCredits:
          0,

        currentGeneralCredits:
          0,

        remainingTotalCredits:
          null,

        remainingMajorCredits:
          null,

        remainingLiberalCredits:
          null,

        excludedTransferCredits:
          0,

        excludedTransferSubjectCount:
          0,

        requiresAccreditedCreditValidation:
          false,

        requiredAccreditedCredits:
          null,
      },
    };
  }

  const degreeType =
    degreeRule.degreeType;

  const isSecondMajor =
    degreeType ===
      "associate_second_major" ||
    degreeType ===
      "bachelor_second_major";

  /**
   * 일반 학위:
   * 전적대 + 추가입력 + 우리플랜을
   * 현재 학위설계 학점으로 계산한다.
   *
   * 타전공:
   * 기존 전적대 학점을 새 타전공
   * 취득학점으로 자동 합산하지 않는다.
   */
  const eligibleSubjects =
    (
      params.recognizedSubjects ||
      []
    ).filter(
      (
        subject
      ) =>
        !(
          isSecondMajor &&
          subject.source ===
            "transfer"
        )
    );

  const excludedTransferSubjects =
    isSecondMajor
      ? (
          params.recognizedSubjects ||
          []
        ).filter(
          (
            subject
          ) =>
            subject.source ===
            "transfer"
        )
      : [];

  const excludedTransferCredits =
    excludedTransferSubjects.reduce(
      (
        total,
        subject
      ) =>
        total +
        toNumber(
          subject.credits
        ),
      0
    );

  let currentTotalCredits =
    0;

  let currentMajorCredits =
    0;

  let currentLiberalCredits =
    0;

  let currentGeneralCredits =
    0;

  for (
    const subject
    of eligibleSubjects
  ) {
    const credits =
      Math.max(
        0,
        toNumber(
          subject.credits
        )
      );

    if (
      credits <=
      0
    ) {
      continue;
    }

    const requirementType =
      normalizeRequirementType(
        subject
      );

    /**
     * 학위 총학점은 유효하게 분류된
     * 전공/교양/일반만 계산한다.
     */
    if (
      requirementType ===
        "unknown"
    ) {
      continue;
    }

    currentTotalCredits +=
      credits;

    if (
      requirementType ===
        "major"
    ) {
      currentMajorCredits +=
        credits;

      continue;
    }

    if (
      requirementType ===
        "liberal"
    ) {
      currentLiberalCredits +=
        credits;

      continue;
    }

    if (
      requirementType ===
        "general"
    ) {
      currentGeneralCredits +=
        credits;
    }
  }

  const requiredTotalCredits =
    degreeRule.totalCredits;

  const requiredMajorCredits =
    degreeRule.majorCredits;

  const requiredLiberalCredits =
    degreeRule.liberalCredits;

  const remainingTotalCredits =
    requiredTotalCredits ===
      null
      ? null
      : Math.max(
          requiredTotalCredits -
            currentTotalCredits,
          0
        );

  const remainingMajorCredits =
    Math.max(
      requiredMajorCredits -
        currentMajorCredits,
      0
    );

  const remainingLiberalCredits =
    requiredLiberalCredits ===
      null
      ? null
      : Math.max(
          requiredLiberalCredits -
            currentLiberalCredits,
          0
        );

  const issues:
    DegreeCreditIssue[] =
    [];

  if (
    remainingTotalCredits !==
      null &&
    remainingTotalCredits >
      0
  ) {
    issues.push({
      code:
        "DEGREE_TOTAL_CREDIT_SHORTAGE",

      severity:
        "danger",

      title:
        "학위 총학점 부족",

      message:
        `${degreeType === "associate" ? "전문학사" : "학사"} 학위 기준 ${requiredTotalCredits}학점 중 현재 ${currentTotalCredits}학점이 확인되어 ${remainingTotalCredits}학점 부족합니다.`,

      details: {
        degreeType,

        requiredCredits:
          requiredTotalCredits,

        completedCredits:
          currentTotalCredits,

        remainingCredits:
          remainingTotalCredits,
      },
    });
  }

  if (
    remainingMajorCredits >
    0
  ) {
    issues.push({
      code:
        "DEGREE_MAJOR_CREDIT_SHORTAGE",

      severity:
        "danger",

      title:
        "학위 전공학점 부족",

      message:
        `학위 전공 ${requiredMajorCredits}학점 중 현재 ${currentMajorCredits}학점이 확인되어 ${remainingMajorCredits}학점 부족합니다.`,

      details: {
        degreeType,

        requiredCredits:
          requiredMajorCredits,

        completedCredits:
          currentMajorCredits,

        remainingCredits:
          remainingMajorCredits,
      },
    });
  }

  if (
    remainingLiberalCredits !==
      null &&
    remainingLiberalCredits >
      0
  ) {
    issues.push({
      code:
        "DEGREE_LIBERAL_CREDIT_SHORTAGE",

      severity:
        "danger",

      title:
        "학위 교양학점 부족",

      message:
        `학위 교양 ${requiredLiberalCredits}학점 중 현재 ${currentLiberalCredits}학점이 확인되어 ${remainingLiberalCredits}학점 부족합니다.`,

      details: {
        degreeType,

        requiredCredits:
          requiredLiberalCredits,

        completedCredits:
          currentLiberalCredits,

        remainingCredits:
          remainingLiberalCredits,
      },
    });
  }

  /**
   * 타전공 학위에서 전적대가 들어와 있더라도
   * 자동 합산하지 않았음을 사용자에게 알려준다.
   */
  if (
    isSecondMajor &&
    excludedTransferSubjects.length >
      0
  ) {
    issues.push({
      code:
        "DEGREE_SECOND_MAJOR_TRANSFER_EXCLUDED",

      severity:
        "info",

      title:
        "타전공 전적대 학점 분리",

      message:
        `타전공 학위 계산에서는 전적대 ${excludedTransferSubjects.length}과목/${excludedTransferCredits}학점을 새 타전공 취득학점으로 자동 합산하지 않았습니다.`,

      details: {
        degreeType,

        excludedSubjectCount:
          excludedTransferSubjects.length,

        excludedCredits:
          excludedTransferCredits,

        excludedSubjects:
          excludedTransferSubjects.map(
            (
              subject
            ) => ({
              subjectName:
                subject.subjectName,

              credits:
                subject.credits,
            })
          ),
      },
    });
  }

  return {
    canAnalyze:
      true,

    degreeType,

    isSecondMajor,

    issues,

    summary: {
      requiredTotalCredits,

      requiredMajorCredits,

      requiredLiberalCredits,

      currentTotalCredits,

      currentMajorCredits,

      currentLiberalCredits,

      currentGeneralCredits,

      remainingTotalCredits,

      remainingMajorCredits,

      remainingLiberalCredits,

      excludedTransferCredits,

      excludedTransferSubjectCount:
        excludedTransferSubjects.length,

      /**
       * DEGREE_RULES에 이미 18학점 기준이 있으나
       * 현재 과목 데이터만으로
       * 평가인정/시간제 여부를 구별할 수 없으므로
       * 여기서는 충족 여부를 추측하지 않는다.
       */
      requiresAccreditedCreditValidation:
        degreeRule
          .requiredAccreditedCredits >
        0,

      requiredAccreditedCredits:
        degreeRule
          .requiredAccreditedCredits,
    },
  };
}