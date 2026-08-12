import type {
  UnifiedQualificationRequirements,
} from "./qualification-requirement-merger";

import type {
  QualificationSemesterPlannerResult,
} from "./qualification-semester-planner";

export type AdministrativeTimelineStatus =
  | "ready"
  | "review_required"
  | "not_applicable";

export type AdministrativeTimelineExistingSemester = {
  semesterOrder:
    number;

  semesterLabel:
    string | null;
};

export type AdministrativeQuarterWindow = {
  year:
    number;

  month:
    1 | 4 | 7 | 10;

  label:
    string;
};

export type AdministrativeDegreeApplicationWindow = {
  startDate:
    string;

  endDate:
    string;

  label:
    string;
};

export type AdministrativeTimelinePlannerResult = {
  status:
    AdministrativeTimelineStatus;

  canCalculate:
    boolean;

  courseKey:
    UnifiedQualificationRequirements["courseKey"];

  referenceDate:
    string;

  requiresNewDegreeTrack:
    boolean;

  academicCompletionSemesterLabel:
    string | null;

  /**
   * 학습자등록
   *
   * 운영기준:
   * 1월 / 4월 / 7월 / 10월
   */
  learnerRegistration: {
    applicationMonths:
      Array<
        1 | 4 | 7 | 10
      >;

    nextAvailableWindow:
      AdministrativeQuarterWindow | null;

    requiresStatusCheck:
      boolean;

    message:
      string;
  };

  /**
   * 학점인정신청
   *
   * 운영기준:
   * 1월 / 4월 / 7월 / 10월
   */
  creditRecognition: {
    applicationMonths:
      Array<
        1 | 4 | 7 | 10
      >;

    nextAvailableWindow:
      AdministrativeQuarterWindow | null;

    requiresStatusCheck:
      boolean;

    message:
      string;
  };

  degree: {
    required:
      boolean;

    applicationWindow:
      AdministrativeDegreeApplicationWindow | null;

    estimatedAwardDate:
      string | null;

    estimatedAwardLabel:
      string | null;

    message:
      string;
  };

  qualification: {
    applicable:
      boolean;

    /**
     * 새 학위가 필요한 과정이면
     * 학위수여 이후.
     *
     * 기존 학위로 자격과목만 채우는 과정이면
     * 최종 수업/실습 완료 이후.
     */
    applicationBasis:
      | "after_degree_award"
      | "after_course_completion"
      | "not_applicable"
      | "review_required";

    earliestEstimatedDate:
      string | null;

    message:
      string;
  };

  milestones:
    Array<{
      order:
        number;

      type:
        | "learner_registration"
        | "credit_recognition"
        | "degree_application"
        | "degree_award"
        | "qualification_application";

      label:
        string;

      date:
        string | null;

      startDate:
        string | null;

      endDate:
        string | null;

      estimated:
        boolean;
    }>;

  warnings:
    string[];

  unresolvedReasons:
    string[];
};

function toNumber(
  value:
    unknown
) {
  const normalized =
    Number(
      value
    );

  return Number.isFinite(
    normalized
  )
    ? normalized
    : 0;
}

function normalizeSemesterLabel(
  value:
    unknown
): string | null {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  const matched =
    normalized.match(
      /^(\d{4})년\s*([12])학기$/
    );

  if (!matched) {
    return null;
  }

  const year =
    Number(
      matched[1]
    );

  const semesterHalf =
    Number(
      matched[2]
    );

  if (
    !Number.isFinite(
      year
    ) ||
    year <
      2000 ||
    year >
      2100
  ) {
    return null;
  }

  if (
    semesterHalf !==
      1 &&
    semesterHalf !==
      2
  ) {
    return null;
  }

  return `${year}년 ${semesterHalf}학기`;
}

function parseSemesterLabel(
  value:
    unknown
): {
  year:
    number;

  semesterHalf:
    1 | 2;
} | null {
  const normalized =
    normalizeSemesterLabel(
      value
    );

  if (!normalized) {
    return null;
  }

  const matched =
    normalized.match(
      /^(\d{4})년\s*([12])학기$/
    );

  if (!matched) {
    return null;
  }

  return {
    year:
      Number(
        matched[1]
      ),

    semesterHalf:
      Number(
        matched[2]
      ) as
        1 | 2,
  };
}

function normalizeReferenceDate(
  value?:
    unknown
): {
  year:
    number;

  month:
    number;

  day:
    number;

  date:
    string;
} {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  const matched =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (matched) {
    const year =
      Number(
        matched[1]
      );

    const month =
      Number(
        matched[2]
      );

    const day =
      Number(
        matched[3]
      );

    if (
      Number.isFinite(
        year
      ) &&
      month >=
        1 &&
      month <=
        12 &&
      day >=
        1 &&
      day <=
        31
    ) {
      return {
        year,
        month,
        day,

        date:
          `${String(
            year
          ).padStart(
            4,
            "0"
          )}-${String(
            month
          ).padStart(
            2,
            "0"
          )}-${String(
            day
          ).padStart(
            2,
            "0"
          )}`,
      };
    }
  }

  /**
   * 별도 기준일이 없으면
   * 한국시간 오늘 날짜 사용.
   */
  const kstDate =
    new Date(
      Date.now() +
      9 *
        60 *
        60 *
        1000
    );

  const year =
    kstDate
      .getUTCFullYear();

  const month =
    kstDate
      .getUTCMonth() +
    1;

  const day =
    kstDate
      .getUTCDate();

  return {
    year,
    month,
    day,

    date:
      `${String(
        year
      ).padStart(
        4,
        "0"
      )}-${String(
        month
      ).padStart(
        2,
        "0"
      )}-${String(
        day
      ).padStart(
        2,
        "0"
      )}`,
  };
}

/**
 * 학습자등록 / 학점인정신청
 *
 * 운영기준:
 * 1월 / 4월 / 7월 / 10월
 *
 * 현재 날짜 기준으로
 * 가장 가까운 신청월을 반환한다.
 */
function resolveNextQuarterWindow(
  params: {
    year:
      number;

    month:
      number;
  }
): AdministrativeQuarterWindow {
  const months:
    Array<
      1 | 4 | 7 | 10
    > =
    [
      1,
      4,
      7,
      10,
    ];

  const found =
    months.find(
      (
        month
      ) =>
        month >=
        params.month
    );

  if (found) {
    return {
      year:
        params.year,

      month:
        found,

      label:
        `${params.year}년 ${found}월`,
    };
  }

  return {
    year:
      params.year +
      1,

    month:
      1,

    label:
      `${params.year + 1}년 1월`,
  };
}

/**
 * 기존 실제 학기 중
 * 가장 마지막 학기를 찾는다.
 */
function resolveLastExistingSemesterLabel(
  semesters:
    AdministrativeTimelineExistingSemester[]
) {
  const normalized =
    (
      semesters ||
      []
    )
      .map(
        (
          semester
        ) => ({
          semesterOrder:
            Math.floor(
              toNumber(
                semester
                  .semesterOrder
              )
            ),

          semesterLabel:
            normalizeSemesterLabel(
              semester
                .semesterLabel
            ),
        })
      )
      .filter(
        (
          semester
        ) =>
          semester
            .semesterOrder >
            0 &&
          Boolean(
            semester
              .semesterLabel
          )
      )
      .sort(
        (
          left,
          right
        ) =>
          left.semesterOrder -
          right.semesterOrder
      );

  return normalized.length >
    0
    ? normalized[
        normalized.length -
        1
      ]
        .semesterLabel
    : null;
}

/**
 * 최종 수업학기 기준
 * 학위신청 가능기간과 학위수여시점을 계산한다.
 *
 * 운영기준:
 *
 * Y년 1학기 최종
 * → Y년 6/15 ~ 7/15 학위신청
 * → Y년 8월 중순 학위수여
 *
 * Y년 2학기 최종
 * → Y년 12/15 ~ Y+1년 1/15 학위신청
 * → Y+1년 2월 중순 학위수여
 */
function resolveDegreeTimeline(
  semesterLabel:
    string
): {
  applicationWindow:
    AdministrativeDegreeApplicationWindow;

  estimatedAwardDate:
    string;

  estimatedAwardLabel:
    string;
} | null {
  const parsed =
    parseSemesterLabel(
      semesterLabel
    );

  if (!parsed) {
    return null;
  }

  if (
    parsed.semesterHalf ===
    1
  ) {
    return {
      applicationWindow: {
        startDate:
          `${parsed.year}-06-15`,

        endDate:
          `${parsed.year}-07-15`,

        label:
          `${parsed.year}년 6월 15일 ~ 7월 15일`,
      },

      estimatedAwardDate:
        `${parsed.year}-08-15`,

      estimatedAwardLabel:
        `${parsed.year}년 8월 중순`,
    };
  }

  return {
    applicationWindow: {
      startDate:
        `${parsed.year}-12-15`,

      endDate:
        `${parsed.year + 1}-01-15`,

      label:
        `${parsed.year}년 12월 15일 ~ ${parsed.year + 1}년 1월 15일`,
    },

    estimatedAwardDate:
      `${parsed.year + 1}-02-15`,

    estimatedAwardLabel:
      `${parsed.year + 1}년 2월 중순`,
  };
}

/**
 * 새 학위가 없는 학생의 경우
 * 정확한 수업 종료일 데이터가 아직 없으므로
 * 마지막 귀속학기 기준의 "예상 완료시점"만 만든다.
 *
 * 정확한 교육원 종강일이 연결되면
 * 이 값을 실제 날짜로 교체하면 된다.
 */
function resolveEstimatedCourseCompletionDate(
  semesterLabel:
    string
): string | null {
  const parsed =
    parseSemesterLabel(
      semesterLabel
    );

  if (!parsed) {
    return null;
  }

  /**
   * 1학기 귀속:
   * 상반기 종료 추정
   *
   * 2학기 귀속:
   * 하반기 종료 추정
   *
   * 자격증 실제 신청일 확정값이 아니라
   * UI/AI 예상 일정 표시용이다.
   */
  if (
    parsed.semesterHalf ===
    1
  ) {
    return `${parsed.year}-06-30`;
  }

  return `${parsed.year}-12-31`;
}

export function planAdministrativeTimeline(
  params: {
    requirements:
      UnifiedQualificationRequirements;

    semesterPlan:
      QualificationSemesterPlannerResult;

    existingSemesters?:
      AdministrativeTimelineExistingSemester[];

    /**
     * 테스트 또는 특정 상담기준일이 있으면 전달.
     *
     * 생략 시 한국시간 오늘 날짜.
     */
    referenceDate?:
      string | null;
  }
): AdministrativeTimelinePlannerResult {
  const referenceDate =
    normalizeReferenceDate(
      params.referenceDate
    );

  const warnings:
    string[] =
    [];

  const unresolvedReasons:
    string[] =
    [];

  const nextQuarterWindow =
    resolveNextQuarterWindow({
      year:
        referenceDate.year,

      month:
        referenceDate.month,
    });

  /**
   * 새로 자동 배치한 학기가 있으면
   * 그 마지막 학기를 최종 학기로 사용.
   *
   * 추가과목이 없다면
   * 기존 실제 등록학기의 마지막 학기를 사용한다.
   */
  const academicCompletionSemesterLabel =
    normalizeSemesterLabel(
      params.semesterPlan
        .lastSemesterLabel
    ) ||
    resolveLastExistingSemesterLabel(
      params
        .existingSemesters ||
      []
    );

  if (
    !params.requirements
      .canPlan
  ) {
    unresolvedReasons.push(
      "학위/자격 요건이 확정되지 않아 행정절차 최종일정을 계산할 수 없습니다."
    );
  }

  if (
    !params.semesterPlan
      .canPlan
  ) {
    unresolvedReasons.push(
      "학기 자동배치가 확정되지 않아 행정절차 최종일정을 계산할 수 없습니다."
    );
  }

  if (
    !academicCompletionSemesterLabel
  ) {
    unresolvedReasons.push(
      "최종 수업학기를 확인할 수 없어 학위 및 자격증 예상일을 계산할 수 없습니다."
    );
  }

  const requiresNewDegreeTrack =
    Boolean(
      params.requirements
        .degree
        .requiresNewDegreeTrack
    );

  let degreeTimeline:
    ReturnType<
      typeof resolveDegreeTimeline
    > =
    null;

  if (
    requiresNewDegreeTrack &&
    academicCompletionSemesterLabel
  ) {
    degreeTimeline =
      resolveDegreeTimeline(
        academicCompletionSemesterLabel
      );

    if (!degreeTimeline) {
      unresolvedReasons.push(
        "최종 수업학기의 학위신청 일정을 계산하지 못했습니다."
      );
    }
  }

  const qualificationApplicable =
    params.requirements
      .courseKey !==
    "child_study_degree";

  let qualificationApplicationBasis:
    AdministrativeTimelinePlannerResult["qualification"]["applicationBasis"] =
    "review_required";

  let earliestQualificationDate:
    string | null =
    null;

  let qualificationMessage =
    "";

  if (
    !qualificationApplicable
  ) {
    qualificationApplicationBasis =
      "not_applicable";

    qualificationMessage =
      "아동학사 과정은 학위과정이므로 별도 자격증 신청일을 계산하지 않습니다.";
  } else if (
    requiresNewDegreeTrack
  ) {
    if (
      degreeTimeline
    ) {
      qualificationApplicationBasis =
        "after_degree_award";

      earliestQualificationDate =
        degreeTimeline
          .estimatedAwardDate;

      qualificationMessage =
        `새 학위 취득이 필요한 과정이므로 ${degreeTimeline.estimatedAwardLabel} 학위수여 확인 후 자격증 신청 단계로 진행합니다.`;
    } else {
      qualificationApplicationBasis =
        "review_required";

      qualificationMessage =
        "새 학위가 필요한 과정이지만 학위수여 예상시점을 확정하지 못했습니다.";
    }
  } else if (
    academicCompletionSemesterLabel
  ) {
    qualificationApplicationBasis =
      "after_course_completion";

    earliestQualificationDate =
      resolveEstimatedCourseCompletionDate(
        academicCompletionSemesterLabel
      );

    qualificationMessage =
      `${academicCompletionSemesterLabel} 필수 수업 및 실습 완료 후 자격증 신청 단계로 진행합니다. 정확한 신청일은 실제 종강일과 실습 완료일을 확인해야 합니다.`;

    warnings.push(
      "새 학위가 필요 없는 과정의 자격증 신청일은 실제 교육원 종강일·실습 완료일 데이터가 없어 귀속학기 기준 예상값으로 표시합니다."
    );
  }

  const milestones:
    AdministrativeTimelinePlannerResult["milestones"] =
    [];

  /**
   * 시스템에서 현재 실제 학습자등록/학점인정
   * 완료여부는 아직 직접 받지 않으므로
   * 다음 신청가능 월을 안내값으로 넣는다.
   */
  milestones.push({
    order:
      1,

    type:
      "learner_registration",

    label:
      `학습자등록 확인 / 다음 신청 가능 ${nextQuarterWindow.label}`,

    date:
      null,

    startDate:
      null,

    endDate:
      null,

    estimated:
      true,
  });

  milestones.push({
    order:
      2,

    type:
      "credit_recognition",

    label:
      `학점인정신청 확인 / 다음 신청 가능 ${nextQuarterWindow.label}`,

    date:
      null,

    startDate:
      null,

    endDate:
      null,

    estimated:
      true,
  });

  if (
    requiresNewDegreeTrack &&
    degreeTimeline
  ) {
    milestones.push({
      order:
        3,

      type:
        "degree_application",

      label:
        `학위신청 ${degreeTimeline.applicationWindow.label}`,

      date:
        null,

      startDate:
        degreeTimeline
          .applicationWindow
          .startDate,

      endDate:
        degreeTimeline
          .applicationWindow
          .endDate,

      estimated:
        false,
    });

    milestones.push({
      order:
        4,

      type:
        "degree_award",

      label:
        `학위수여 예상 ${degreeTimeline.estimatedAwardLabel}`,

      date:
        degreeTimeline
          .estimatedAwardDate,

      startDate:
        null,

      endDate:
        null,

      estimated:
        true,
    });
  }

  if (
    qualificationApplicable &&
    earliestQualificationDate
  ) {
    milestones.push({
      order:
        requiresNewDegreeTrack
          ? 5
          : 3,

      type:
        "qualification_application",

      label:
        requiresNewDegreeTrack
          ? "학위수여 확인 후 자격증 신청"
          : "필수 수업 및 실습 완료 후 자격증 신청",

      date:
        earliestQualificationDate,

      startDate:
        null,

      endDate:
        null,

      estimated:
        true,
    });
  }

  const canCalculate =
    unresolvedReasons.length ===
      0;

  return {
    status:
      canCalculate
        ? qualificationApplicable ||
          requiresNewDegreeTrack
          ? "ready"
          : "not_applicable"
        : "review_required",

    canCalculate,

    courseKey:
      params.requirements
        .courseKey,

    referenceDate:
      referenceDate.date,

    requiresNewDegreeTrack,

    academicCompletionSemesterLabel,

    learnerRegistration: {
      applicationMonths: [
        1,
        4,
        7,
        10,
      ],

      nextAvailableWindow:
        nextQuarterWindow,

      /**
       * 현재 Risk Engine에는
       * 실제 NILE 학습자등록 완료 상태가
       * 직접 연결되지 않았으므로 확인 필요.
       */
      requiresStatusCheck:
        true,

      message:
        `학습자등록은 1월·4월·7월·10월 신청 가능 기준으로 관리합니다. 현재 완료여부는 별도 확인이 필요하며 다음 신청 가능월은 ${nextQuarterWindow.label}입니다.`,
    },

    creditRecognition: {
      applicationMonths: [
        1,
        4,
        7,
        10,
      ],

      requiresStatusCheck:
        true,

      nextAvailableWindow:
        nextQuarterWindow,

      message:
        `학점인정신청은 1월·4월·7월·10월 신청 가능 기준으로 관리합니다. 현재 완료여부는 별도 확인이 필요하며 다음 신청 가능월은 ${nextQuarterWindow.label}입니다.`,
    },

    degree: {
      required:
        requiresNewDegreeTrack,

      applicationWindow:
        degreeTimeline
          ?.applicationWindow ??
        null,

      estimatedAwardDate:
        degreeTimeline
          ?.estimatedAwardDate ??
        null,

      estimatedAwardLabel:
        degreeTimeline
          ?.estimatedAwardLabel ??
        null,

      message:
        !requiresNewDegreeTrack
          ? "현재 학력 기준으로 새 학위 취득과정이 필요하지 않습니다."
          : degreeTimeline
            ? `최종 수업학기 ${academicCompletionSemesterLabel} 기준 학위신청은 ${degreeTimeline.applicationWindow.label}, 학위수여는 ${degreeTimeline.estimatedAwardLabel}로 계산됩니다.`
            : "새 학위 취득이 필요하지만 학위신청 일정을 계산하지 못했습니다.",
    },

    qualification: {
      applicable:
        qualificationApplicable,

      applicationBasis:
        qualificationApplicationBasis,

      earliestEstimatedDate:
        earliestQualificationDate,

      message:
        qualificationMessage,
    },

    milestones,

    warnings,

    unresolvedReasons,
  };
}