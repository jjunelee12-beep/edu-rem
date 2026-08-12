import type {
  QualificationSubjectPlannerResult,
  QualificationPlannedSubject,
} from "./qualification-subject-planner";

export type QualificationSemesterExistingItem = {
  semesterOrder:
    number;

  semesterLabel:
    string | null;

  plannedSubjectCount:
    number | null;

  actualSubjectCount:
    number | null;
};

export type QualificationSemesterPlannedItem = {
  semesterOrder:
    number;

  semesterLabel:
    string;

  subjectCount:
    number;

  subjects:
    QualificationPlannedSubject[];

  /**
   * 해당 귀속연도에
   * 이번 배치까지 포함한 총 과목 수.
   */
  annualSubjectCountAfterPlacement:
    number;
};

export type QualificationSemesterPlannerResult = {
  canPlan:
    boolean;

  /**
   * 기존 학기가 있어서
   * 그 다음 학기부터 배치했는지,
   *
   * 아니면 현재 날짜를 기준으로
   * 첫 학기를 계산했는지 표시한다.
   */
  startBasis:
    | "after_existing_semester"
    | "current_date"
    | "unresolved";

  referenceDate:
    string;

  firstSemesterLabel:
    string | null;

  semesterCount:
    number;

  semesters:
    QualificationSemesterPlannedItem[];

  lastSemesterLabel:
    string | null;

  unresolvedReasons:
    string[];

  warnings:
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

function normalizePositiveInteger(
  value:
    unknown
) {
  const normalized =
    Math.floor(
      toNumber(
        value
      )
    );

  return normalized >
    0
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

/**
 * 다음 귀속학기를 반환한다.
 *
 * 2026년 1학기
 * → 2026년 2학기
 *
 * 2026년 2학기
 * → 2027년 1학기
 */
function getNextSemesterLabel(
  currentSemesterLabel:
    unknown
): string | null {
  const parsed =
    parseSemesterLabel(
      currentSemesterLabel
    );

  if (!parsed) {
    return null;
  }

  if (
    parsed.semesterHalf ===
    1
  ) {
    return `${parsed.year}년 2학기`;
  }

  return `${parsed.year + 1}년 1학기`;
}

/**
 * 현재 서버 시간이 UTC여도
 * 한국 날짜로 기준일을 계산한다.
 */
function getTodayKst() {
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
 * 신규 학생에게 기존 학기가 하나도 없는 경우
 * 현재 날짜를 기준으로 첫 귀속학기를 계산한다.
 *
 * 현재 운영 설계 기준:
 *
 * 1학기:
 * 전년도 11월 중순 이후
 * ~ 해당연도 5월 중순 전
 *
 * 2학기:
 * 해당연도 5월 중순 이후
 * ~ 11월 중순 전
 *
 * 주의:
 * 이 값은 자동 학습설계용 귀속학기 추정값이다.
 * 실제 교육원 개강일/귀속학기가 확인되면
 * 그 실제 값을 우선해야 한다.
 */
function resolveSemesterLabelFromDate(
  params: {
    year:
      number;

    month:
      number;

    day:
      number;
  }
): string {
  const {
    year,
    month,
    day,
  } =
    params;

  /**
   * 1월 ~ 4월
   * → 현재연도 1학기
   */
  if (
    month >=
      1 &&
    month <=
      4
  ) {
    return `${year}년 1학기`;
  }

  /**
   * 5월
   *
   * 1~14일:
   * 기존 1학기 귀속 추정
   *
   * 15일 이후:
   * 2학기 귀속 추정
   */
  if (
    month ===
    5
  ) {
    return day <
      15
      ? `${year}년 1학기`
      : `${year}년 2학기`;
  }

  /**
   * 6월 ~ 10월
   * → 현재연도 2학기
   */
  if (
    month >=
      6 &&
    month <=
      10
  ) {
    return `${year}년 2학기`;
  }

  /**
   * 11월
   *
   * 1~14일:
   * 현재연도 2학기 추정
   *
   * 15일 이후:
   * 다음연도 1학기 추정
   */
  if (
    month ===
    11
  ) {
    return day <
      15
      ? `${year}년 2학기`
      : `${year + 1}년 1학기`;
  }

  /**
   * 12월
   * → 다음연도 1학기
   */
  return `${year + 1}년 1학기`;
}

/**
 * 기존 학기의 실제/예정 과목 수를 결정한다.
 *
 * 실제 과목 수가 있으면 실제를 우선하고,
 * 없으면 예정 과목 수를 사용한다.
 */
function getExistingSemesterSubjectCount(
  semester:
    QualificationSemesterExistingItem
) {
  const actual =
    semester.actualSubjectCount;

  if (
    actual !==
      null &&
    actual !==
      undefined
  ) {
    return Math.max(
      normalizePositiveInteger(
        actual
      ),
      0
    );
  }

  return Math.max(
    normalizePositiveInteger(
      semester
        .plannedSubjectCount
    ),
    0
  );
}

/**
 * 기존 학기 중
 * 가장 마지막 순번 학기를 찾는다.
 */
function getLastExistingSemester(
  semesters:
    QualificationSemesterExistingItem[]
) {
  const normalized =
    (
      semesters ||
      []
    )
      .filter(
        (
          semester
        ) =>
          normalizePositiveInteger(
            semester
              .semesterOrder
          ) >
          0
      )
      .sort(
        (
          left,
          right
        ) =>
          normalizePositiveInteger(
            left.semesterOrder
          ) -
          normalizePositiveInteger(
            right.semesterOrder
          )
      );

  return normalized.length >
    0
    ? normalized[
        normalized.length -
        1
      ]
    : null;
}

/**
 * 연도별 기존 등록 과목 수를 만든다.
 *
 * 예:
 *
 * 2027년 1학기 8
 * 2027년 2학기 4
 *
 * →
 *
 * 2027 = 12
 */
function buildExistingAnnualCountMap(
  semesters:
    QualificationSemesterExistingItem[]
) {
  const map =
    new Map<
      number,
      number
    >();

  for (
    const semester
    of semesters ||
    []
  ) {
    const parsed =
      parseSemesterLabel(
        semester
          .semesterLabel
      );

    if (!parsed) {
      continue;
    }

    const subjectCount =
      getExistingSemesterSubjectCount(
        semester
      );

    map.set(
      parsed.year,
      (
        map.get(
          parsed.year
        ) ||
        0
      ) +
        subjectCount
    );
  }

  return map;
}

/**
 * 실습과목은 가능하면
 * 뒤 학기로 보내기 위한 정렬.
 *
 * 법적 선후수 조건을 새로 만드는 것이 아니라
 * 실습을 최종 학기에 가깝게 배치하는
 * 운영상 기본 우선순위다.
 */
function sortSubjectsForSemesterPlanning(
  subjects:
    QualificationPlannedSubject[]
) {
  return [
    ...(
      subjects ||
      []
    ),
  ].sort(
    (
      left,
      right
    ) => {
      const leftPractice =
        left.satisfies
          .practice ||
        left.reasons.includes(
          "practice"
        )
          ? 1
          : 0;

      const rightPractice =
        right.satisfies
          .practice ||
        right.reasons.includes(
          "practice"
        )
          ? 1
          : 0;

      if (
        leftPractice !==
        rightPractice
      ) {
        return (
          leftPractice -
          rightPractice
        );
      }

      /**
       * 실습이 아니라면
       * 자격 필수과목을 먼저 배치한다.
       */
      const leftRequired =
        left.reasons.includes(
          "qualification_required"
        ) ||
        left.reasons.includes(
          "qualification_area"
        )
          ? 1
          : 0;

      const rightRequired =
        right.reasons.includes(
          "qualification_required"
        ) ||
        right.reasons.includes(
          "qualification_area"
        )
          ? 1
          : 0;

      return (
        rightRequired -
        leftRequired
      );
    }
  );
}

export function planQualificationSemesters(
  params: {
    subjectPlan:
      QualificationSubjectPlannerResult;

    existingSemesters:
      QualificationSemesterExistingItem[];
  }
): QualificationSemesterPlannerResult {
  const today =
    getTodayKst();

  const warnings:
    string[] =
    [];

  const unresolvedReasons:
    string[] =
    [];

  /**
   * 과목 Planner 자체가 확정되지 않았다면
   * 학기배치를 진행하지 않는다.
   */
  if (
    !params.subjectPlan
      .canPlan
  ) {
    return {
      canPlan:
        false,

      startBasis:
        "unresolved",

      referenceDate:
        today.date,

      firstSemesterLabel:
        null,

      semesterCount:
        0,

      semesters:
        [],

      lastSemesterLabel:
        null,

      unresolvedReasons: [
        "과목계획이 확정되지 않아 학기 자동배치를 진행할 수 없습니다.",
      ],

      warnings,
    };
  }

  const subjects =
    sortSubjectsForSemesterPlanning(
      params.subjectPlan
        .selectedSubjects
    );

  /**
   * 추가로 들어야 할 과목이 없다면
   * 빈 정상계획으로 반환한다.
   */
  if (
    subjects.length ===
    0
  ) {
    return {
      canPlan:
        true,

      startBasis:
        "current_date",

      referenceDate:
        today.date,

      firstSemesterLabel:
        null,

      semesterCount:
        0,

      semesters:
        [],

      lastSemesterLabel:
        null,

      unresolvedReasons:
        [],

      warnings: [
        "추가 배치가 필요한 과목이 없습니다.",
      ],
    };
  }

  const existingSemesters =
    (
      params
        .existingSemesters ||
      []
    )
      .map(
        (
          semester
        ) => ({
          semesterOrder:
            normalizePositiveInteger(
              semester
                .semesterOrder
            ),

          semesterLabel:
            normalizeSemesterLabel(
              semester
                .semesterLabel
            ),

          plannedSubjectCount:
            semester
              .plannedSubjectCount,

          actualSubjectCount:
            semester
              .actualSubjectCount,
        })
      )
      .filter(
        (
          semester
        ) =>
          semester
            .semesterOrder >
          0
      );

  const lastExistingSemester =
    getLastExistingSemester(
      existingSemesters
    );

  let firstSemesterLabel:
    string | null =
    null;

  let nextSemesterOrder =
    1;

  let startBasis:
    QualificationSemesterPlannerResult["startBasis"] =
    "current_date";

  /**
   * 기존 학기가 있으면
   * 반드시 마지막 학기의 다음 귀속학기부터 시작.
   */
  if (
    lastExistingSemester
  ) {
    const lastLabel =
      normalizeSemesterLabel(
        lastExistingSemester
          .semesterLabel
      );

    if (!lastLabel) {
      unresolvedReasons.push(
        "기존 마지막 학기의 학기 구분을 해석할 수 없습니다."
      );

      return {
        canPlan:
          false,

        startBasis:
          "unresolved",

        referenceDate:
          today.date,

        firstSemesterLabel:
          null,

        semesterCount:
          0,

        semesters:
          [],

        lastSemesterLabel:
          null,

        unresolvedReasons,

        warnings,
      };
    }

    firstSemesterLabel =
      getNextSemesterLabel(
        lastLabel
      );

    nextSemesterOrder =
      lastExistingSemester
        .semesterOrder +
      1;

    startBasis =
      "after_existing_semester";
  } else {
    /**
     * 등록된 학기가 하나도 없으면
     * 현재 한국 날짜 기준으로
     * 첫 귀속학기를 추정한다.
     */
    firstSemesterLabel =
      resolveSemesterLabelFromDate({
        year:
          today.year,

        month:
          today.month,

        day:
          today.day,
      });

    nextSemesterOrder =
      1;

    startBasis =
      "current_date";

    warnings.push(
      `기존 등록학기가 없어 ${today.date} 기준으로 첫 귀속학기를 ${firstSemesterLabel}로 자동 추정했습니다. 실제 교육원 개강일이 확정되면 해당 귀속학기를 다시 검증해야 합니다.`
    );
  }

  if (
    !firstSemesterLabel
  ) {
    return {
      canPlan:
        false,

      startBasis:
        "unresolved",

      referenceDate:
        today.date,

      firstSemesterLabel:
        null,

      semesterCount:
        0,

      semesters:
        [],

      lastSemesterLabel:
        null,

      unresolvedReasons: [
        "첫 귀속학기를 결정하지 못했습니다.",
      ],

      warnings,
    };
  }

  /**
   * 기존 연도별 수강과목 수.
   */
  const annualCountMap =
    buildExistingAnnualCountMap(
      existingSemesters
    );

  const plannedSemesters:
    QualificationSemesterPlannedItem[] =
    [];

  let subjectIndex =
    0;

  let currentSemesterLabel =
    firstSemesterLabel;

  /**
   * 무한루프 방지.
   *
   * 현재 학위/자격 과정 규모상
   * 20학기 이상 자동배치가 필요하면
   * 데이터 자체를 검토해야 한다.
   */
  let safetyCounter =
    0;

  while (
    subjectIndex <
      subjects.length &&
    safetyCounter <
      20
  ) {
    safetyCounter +=
      1;

    const parsed =
      parseSemesterLabel(
        currentSemesterLabel
      );

    if (!parsed) {
      unresolvedReasons.push(
        `${currentSemesterLabel} 학기 구분을 해석할 수 없습니다.`
      );

      break;
    }

    const existingAnnualCount =
      annualCountMap.get(
        parsed.year
      ) ||
      0;

    /**
     * 한 학기 최대 8과목.
     */
    const semesterMaximum =
      8;

    /**
     * 한 학년도 최대 14과목.
     */
    const annualRemaining =
      Math.max(
        14 -
          existingAnnualCount,
        0
      );

    const availableCount =
      Math.min(
        semesterMaximum,
        annualRemaining
      );

    /**
     * 해당 연도에 이미 14과목을 모두 채웠으면
     * 현재 학기는 건너뛰고 다음 귀속학기로 이동한다.
     */
    if (
      availableCount <=
      0
    ) {
      const nextLabel =
        getNextSemesterLabel(
          currentSemesterLabel
        );

      if (!nextLabel) {
        unresolvedReasons.push(
          `${currentSemesterLabel} 다음 학기를 계산할 수 없습니다.`
        );

        break;
      }

      currentSemesterLabel =
        nextLabel;

      continue;
    }

    const remainingSubjectCount =
      subjects.length -
      subjectIndex;

    const placementCount =
      Math.min(
        availableCount,
        remainingSubjectCount
      );

    const semesterSubjects =
      subjects.slice(
        subjectIndex,
        subjectIndex +
          placementCount
      );

    subjectIndex +=
      placementCount;

    const nextAnnualCount =
      existingAnnualCount +
      placementCount;

    annualCountMap.set(
      parsed.year,
      nextAnnualCount
    );

    plannedSemesters.push({
      semesterOrder:
        nextSemesterOrder,

      semesterLabel:
        currentSemesterLabel,

      subjectCount:
        semesterSubjects.length,

      subjects:
        semesterSubjects,

      annualSubjectCountAfterPlacement:
        nextAnnualCount,
    });

    nextSemesterOrder +=
      1;

    const nextLabel =
      getNextSemesterLabel(
        currentSemesterLabel
      );

    if (!nextLabel) {
      unresolvedReasons.push(
        `${currentSemesterLabel} 다음 학기를 계산할 수 없습니다.`
      );

      break;
    }

    currentSemesterLabel =
      nextLabel;
  }

  if (
    subjectIndex <
    subjects.length
  ) {
    unresolvedReasons.push(
      `총 ${subjects.length}과목 중 ${subjectIndex}과목만 학기에 배치되었습니다.`
    );
  }

  const lastSemesterLabel =
    plannedSemesters.length >
      0
      ? plannedSemesters[
          plannedSemesters.length -
            1
        ]
          .semesterLabel
      : null;

  return {
    canPlan:
      unresolvedReasons.length ===
      0,

    startBasis,

    referenceDate:
      today.date,

    firstSemesterLabel,

    semesterCount:
      plannedSemesters.length,

    semesters:
      plannedSemesters,

    lastSemesterLabel,

    unresolvedReasons,

    warnings,
  };
}