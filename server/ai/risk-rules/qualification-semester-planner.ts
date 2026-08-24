import type {
  QualificationSubjectPlannerResult,
  QualificationPlannedSubject,
} from "./qualification-subject-planner";

export type QualificationSemesterExistingItem = {
  semesterOrder:
    number;

  semesterLabel:
    string | null;

  /**
   * 기존 CRM 호환용 과목 수.
   *
   * 신규 법규 계산에서는 학점값을 우선하고,
   * 학점값이 없는 레거시 데이터에서만
   * 과목 수를 보조값으로 사용한다.
   */
  plannedSubjectCount:
    number | null;

  actualSubjectCount:
    number | null;

  /**
   * 해당 학기의 예정 수강학점.
   *
   * 가능하면 호출부에서 실제 과목 credits 합계를
   * 계산해서 전달해야 한다.
   */
  plannedCredits?:
    number | null;

  /**
   * 해당 학기의 실제 수강학점.
   *
   * 실제값이 있으면 plannedCredits보다 우선한다.
   */
  actualCredits?:
    number | null;

  /**
   * 상세페이지에 저장된 실제 교육원 개강일.
   *
   * 존재하면 예상 시작일보다 항상 우선한다.
   */
  actualStartDate?:
    string | null;

  /**
   * CRM에서 실제 학기 이수완료가 확정되었는지.
   *
   * 날짜가 지났다는 이유만으로
   * 이수완료 처리하지 않는다.
   */
  isCompleted?:
    boolean | null;
};

export type QualificationSemesterPlannedItem = {
  semesterOrder:
    number;

  semesterLabel:
    string;

    subjectCount:
    number;

  /**
   * 이번 학기에 실제 배치된 총 학점.
   */
  semesterCredits:
    number;

  subjects:
    QualificationPlannedSubject[];

  /**
   * 화면/기존 코드 호환용 과목 수.
   *
   * 법적 연간 제한 판정에는 사용하지 않는다.
   */
  annualSubjectCountAfterPlacement:
    number;

  /**
   * 해당 귀속연도에 이번 배치까지 포함하여
   * 수업으로 이수하게 되는 누적 학점.
   *
   * 연간 42학점 제한 판정의 실제 기준값.
   */
  annualCreditsAfterPlacement:
    number;

  /**
   * 해당 학기의 예상 학습 시작일.
   *
   * 실제 교육원 개강일이 없는 자동설계에서는
   * 공통엔진이 계산한 최단 시작일을 사용한다.
   */
  estimatedStartDate:
    string;

  /**
   * 한 학기 4개월 기준 예상 종료일.
   */
  estimatedEndDate:
    string;
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

  /**
   * 실제 계산에 사용한 기준일.
   *
   * 신규상담에서는 질문한 오늘,
   * 테스트에서는 명시적으로 전달한 날짜.
   */
  calculationBaseDate:
    string;

  firstSemesterLabel:
    string | null;

  semesterCount:
    number;

  /**
   * 고객에게 안내하는 표준 학습기간.
   *
   * 1학기 = 4개월 기준.
   */
  nominalDurationMonths:
    number;

  /**
   * 첫 추가학기 예상 시작일.
   */
  estimatedStudyStartDate:
    string | null;

  /**
   * 마지막 추가학기 예상 종료일.
   *
   * 추후 행정절차 Planner가
   * 이 날짜를 받아 학점인정/학위신청/
   * 자격증 신청 가능시점을 계산한다.
   */
  estimatedStudyEndDate:
    string | null;

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

function normalizeCredits(
  value:
    unknown
) {
  const credits =
    toNumber(
      value
    );

  if (
    !Number.isFinite(
      credits
    ) ||
    credits <=
      0
  ) {
    return 0;
  }

  return credits;
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
 * 두 귀속학기의 시간순서를 비교한다.
 *
 * 반환값:
 *
 * left < right
 * → 음수
 *
 * left === right
 * → 0
 *
 * left > right
 * → 양수
 */
function compareSemesterLabels(
  left:
    unknown,
  right:
    unknown
): number | null {
  const leftParsed =
    parseSemesterLabel(
      left
    );

  const rightParsed =
    parseSemesterLabel(
      right
    );

  if (
    !leftParsed ||
    !rightParsed
  ) {
    return null;
  }

  const leftValue =
    leftParsed.year *
      2 +
    leftParsed.semesterHalf;

  const rightValue =
    rightParsed.year *
      2 +
    rightParsed.semesterHalf;

  return (
    leftValue -
    rightValue
  );
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

function parseBaseDate(
  value:
    string | null | undefined
) {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  const matched =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!matched) {
    return getTodayKst();
  }

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

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() + 1 !==
      month ||
    date.getUTCDate() !==
      day
  ) {
    return getTodayKst();
  }

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


function addMonthsToDate(
  dateValue:
    string,
  months:
    number
): string {
  const matched =
    String(
      dateValue
    ).match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!matched) {
    return dateValue;
  }

  const date =
    new Date(
      Date.UTC(
        Number(
          matched[1]
        ),
        Number(
          matched[2]
        ) - 1,
        Number(
          matched[3]
        )
      )
    );

  /**
   * 날짜 overflow 방지를 위해
   * 월 계산은 1일 기준으로 이동한다.
   */
  const originalDay =
    date.getUTCDate();

  date.setUTCDate(
    1
  );

  date.setUTCMonth(
    date.getUTCMonth() +
      months
  );

  const lastDayOfTargetMonth =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        0
      )
    ).getUTCDate();

  date.setUTCDate(
    Math.min(
      originalDay,
      lastDayOfTargetMonth
    )
  );

  return `${String(
    date.getUTCFullYear()
  ).padStart(
    4,
    "0"
  )}-${String(
    date.getUTCMonth() + 1
  ).padStart(
    2,
    "0"
  )}-${String(
    date.getUTCDate()
  ).padStart(
    2,
    "0"
  )}`;
}

function addDaysToDate(
  dateValue:
    string,
  days:
    number
): string {
  const matched =
    String(
      dateValue
    ).match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!matched) {
    return dateValue;
  }

  const date =
    new Date(
      Date.UTC(
        Number(
          matched[1]
        ),
        Number(
          matched[2]
        ) - 1,
        Number(
          matched[3]
        )
      )
    );

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return `${String(
    date.getUTCFullYear()
  ).padStart(
    4,
    "0"
  )}-${String(
    date.getUTCMonth() + 1
  ).padStart(
    2,
    "0"
  )}-${String(
    date.getUTCDate()
  ).padStart(
    2,
    "0"
  )}`;
}

/**
 * 현재 학기가 종료된 뒤
 * 목표 귀속학기에 들어갈 수 있는
 * 가장 빠른 시작일을 계산한다.
 *
 * 기본적으로 이전 학기 다음날부터
 * 바로 시작할 수 있으면 그 날짜를 사용한다.
 *
 * 다만 해당 날짜가 아직 이전 귀속학기에
 * 포함되는 경우에는 다음 귀속학기 시작구간까지
 * 이동한다.
 */
function resolveEarliestStartDateForSemester(
  params: {
    candidateDate:
      string;

    semesterLabel:
      string;
  }
): string | null {
  const candidate =
    parseBaseDate(
      params.candidateDate
    );

  const targetSemester =
    parseSemesterLabel(
      params.semesterLabel
    );

  if (!targetSemester) {
    return null;
  }

  const candidateSemesterLabel =
    resolveSemesterLabelFromDate({
      year:
        candidate.year,

      month:
        candidate.month,

      day:
        candidate.day,
    });

  /**
   * 다음날부터 이미 목표 귀속학기로
   * 인정된다면 그대로 시작한다.
   */
  if (
    candidateSemesterLabel ===
    params.semesterLabel
  ) {
    return candidate.date;
  }

  /**
   * 자동 최단설계 운영기준:
   *
   * 1학기 신규 시작구간
   * → 전년도 12월 1일
   *
   * 2학기 신규 시작구간
   * → 해당연도 6월 1일
   *
   * 실제 교육원 개강일 데이터가 연결되면
   * 추후 이 값을 실제 개강일 기준으로 교체한다.
   */
  if (
    targetSemester.semesterHalf ===
    1
  ) {
    return `${targetSemester.year - 1}-12-01`;
  }

  return `${targetSemester.year}-06-01`;
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

function getExistingSemesterCredits(
  semester:
    QualificationSemesterExistingItem
): {
  credits:
    number;

  inferredFromSubjectCount:
    boolean;
} {
  const actualCredits =
    normalizeCredits(
      semester.actualCredits
    );

  if (
    actualCredits >
    0
  ) {
    return {
      credits:
        actualCredits,

      inferredFromSubjectCount:
        false,
    };
  }

  const plannedCredits =
    normalizeCredits(
      semester.plannedCredits
    );

  if (
    plannedCredits >
    0
  ) {
    return {
      credits:
        plannedCredits,

      inferredFromSubjectCount:
        false,
    };
  }

  /**
   * 레거시 데이터 호환.
   *
   * 기존 CRM에는 과목 수만 저장되어 있으므로
   * 임시로 3학점 과목 기준으로 환산한다.
   *
   * 이 값은 법적 확정값이 아니라
   * 과거 데이터 호환용 추정값이다.
   *
   * 추후 호출부에서 actualCredits /
   * plannedCredits를 반드시 전달하도록 변경한다.
   */
  const subjectCount =
    getExistingSemesterSubjectCount(
      semester
    );

  return {
    credits:
      subjectCount *
      3,

    inferredFromSubjectCount:
      subjectCount >
      0,
  };
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

function buildExistingAnnualCreditMap(
  semesters:
    QualificationSemesterExistingItem[]
): {
  creditMap:
    Map<
      number,
      number
    >;

  inferredSemesterLabels:
    string[];
} {
  const creditMap =
    new Map<
      number,
      number
    >();

  const inferredSemesterLabels:
    string[] =
    [];

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

    const creditResult =
      getExistingSemesterCredits(
        semester
      );

    creditMap.set(
      parsed.year,
      (
        creditMap.get(
          parsed.year
        ) ||
        0
      ) +
        creditResult
          .credits
    );

    if (
      creditResult
        .inferredFromSubjectCount
    ) {
      const semesterLabel =
        normalizeSemesterLabel(
          semester
            .semesterLabel
        );

      if (
        semesterLabel
      ) {
        inferredSemesterLabels.push(
          semesterLabel
        );
      }
    }
  }

  return {
    creditMap,

    inferredSemesterLabels,
  };
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

    /**
 * 최단기간 계산을 시작할 실제 기준일.
 *
 * 신규상담에서:
 *
 * - 사용자가 시작시점을 말하지 않으면
 *   호출부에서 오늘 날짜를 사용한다.
 *
 * - "10월부터 시작"
 *   → 해당 연도 10월 1일
 *
 * - "내년 3월부터 시작"
 *   → 다음 연도 3월 1일
 *
 * - 정확한 날짜를 말하면
 *   → 해당 날짜
 *
 * 즉 이 값은 단순 조회일이 아니라
 * 실제 학습설계를 시작할 기준일이다.
 */
baseDate?:
  string | null;
  }
): QualificationSemesterPlannerResult {
 const today =
  parseBaseDate(
    params.baseDate
  );

const baseDateSemesterLabel =
  resolveSemesterLabelFromDate({
    year:
      today.year,

    month:
      today.month,

    day:
      today.day,
  });

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

calculationBaseDate:
  today.date,

firstSemesterLabel:
  null,

semesterCount:
  0,

nominalDurationMonths:
  0,

estimatedStudyStartDate:
  null,

estimatedStudyEndDate:
  null,

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

calculationBaseDate:
  today.date,

firstSemesterLabel:
  null,

semesterCount:
  0,

nominalDurationMonths:
  0,

estimatedStudyStartDate:
  null,

estimatedStudyEndDate:
  null,

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

          plannedCredits:
            semester
              .plannedCredits ??
            null,

          actualCredits:
            semester
              .actualCredits ??
            null,

          actualStartDate:
            String(
              semester
                .actualStartDate ??
              ""
            ).trim() ||
            null,

          isCompleted:
            semester
              .isCompleted ===
            true,
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

calculationBaseDate:
  today.date,

firstSemesterLabel:
  null,

semesterCount:
  0,

nominalDurationMonths:
  0,

estimatedStudyStartDate:
  null,

estimatedStudyEndDate:
  null,

semesters:
  [],

        lastSemesterLabel:
          null,

        unresolvedReasons,

        warnings,
      };
    }

    const nextExistingSemesterLabel =
  getNextSemesterLabel(
    lastLabel
  );

if (
  !nextExistingSemesterLabel
) {
  unresolvedReasons.push(
    `${lastLabel} 다음 학기를 계산할 수 없습니다.`
  );

  return {
    canPlan:
      false,

    startBasis:
      "unresolved",

    referenceDate:
      today.date,

    calculationBaseDate:
      today.date,

    firstSemesterLabel:
      null,

    semesterCount:
      0,

    nominalDurationMonths:
      0,

    estimatedStudyStartDate:
      null,

    estimatedStudyEndDate:
      null,

    semesters:
      [],

    lastSemesterLabel:
      null,

    unresolvedReasons,

    warnings,
  };
}

const semesterComparison =
  compareSemesterLabels(
    baseDateSemesterLabel,
    nextExistingSemesterLabel
  );

if (
  semesterComparison ===
  null
) {
  unresolvedReasons.push(
    "기존 학기 이후 귀속학기와 시작 희망일의 귀속학기를 비교할 수 없습니다."
  );

  return {
    canPlan:
      false,

    startBasis:
      "unresolved",

    referenceDate:
      today.date,

    calculationBaseDate:
      today.date,

    firstSemesterLabel:
      null,

    semesterCount:
      0,

    nominalDurationMonths:
      0,

    estimatedStudyStartDate:
      null,

    estimatedStudyEndDate:
      null,

    semesters:
      [],

    lastSemesterLabel:
      null,

    unresolvedReasons,

    warnings,
  };
}

/**
 * 기존학기의 다음학기와
 * 사용자가 희망한 시작일의 귀속학기 중
 * 더 늦은 학기를 실제 첫 추가학기로 사용한다.
 */
firstSemesterLabel =
  semesterComparison >
    0
    ? baseDateSemesterLabel
    : nextExistingSemesterLabel;

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

    calculationBaseDate:
      today.date,

    firstSemesterLabel:
      null,

    semesterCount:
      0,

    nominalDurationMonths:
      0,

    estimatedStudyStartDate:
      null,

    estimatedStudyEndDate:
      null,

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
   *
   * 화면/호환용으로 유지한다.
   */
  const annualCountMap =
    buildExistingAnnualCountMap(
      existingSemesters
    );

  /**
   * 실제 법적 연간 제한 계산은
   * 과목 수가 아니라 학점으로 한다.
   *
   * 수업을 통한 학점:
   * - 1학기 최대 24학점
   * - 연간 최대 42학점
   */
  const {
    creditMap:
      annualCreditMap,

    inferredSemesterLabels,
  } =
    buildExistingAnnualCreditMap(
      existingSemesters
    );

  if (
    inferredSemesterLabels
      .length >
    0
  ) {
    warnings.push(
      `기존 학기 ${inferredSemesterLabels.join(", ")}의 실제 수강학점이 없어 과목당 3학점 기준으로 임시 환산했습니다. 실제 학점 데이터가 연결되면 다시 검증해야 합니다.`
    );
  }

  const plannedSemesters:
    QualificationSemesterPlannedItem[] =
    [];

  let subjectIndex =
    0;

  let currentSemesterLabel =
    firstSemesterLabel;

/**
 * 신규상담에서는 실제 계산 기준일을
 * 첫 학기 시작일로 사용한다.
 *
 * 예:
 *
 * 오늘 시작
 * → 오늘
 *
 * "10월부터 시작"
 * → 호출부에서 baseDate=2026-10-01
 * → 2026-10-01
 */
const resolvedFirstSemesterStartDate =
  resolveEarliestStartDateForSemester({
    candidateDate:
      today.date,

    semesterLabel:
      firstSemesterLabel,
  });

if (
  !resolvedFirstSemesterStartDate
) {
  return {
    canPlan:
      false,

    startBasis:
      "unresolved",

    referenceDate:
      today.date,

    calculationBaseDate:
      today.date,

    firstSemesterLabel:
      null,

    semesterCount:
      0,

    nominalDurationMonths:
      0,

    estimatedStudyStartDate:
      null,

    estimatedStudyEndDate:
      null,

    semesters:
      [],

    lastSemesterLabel:
      null,

    unresolvedReasons: [
      ...unresolvedReasons,
      `${firstSemesterLabel} 첫 학기 시작일을 계산할 수 없습니다.`,
    ],

    warnings,
  };
}

let currentSemesterStartDate =
  resolvedFirstSemesterStartDate;

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

    const existingAnnualCredits =
      annualCreditMap.get(
        parsed.year
      ) ||
      0;

    /**
     * 학점은행제 수업 학점 법정 제한.
     *
     * 과목 수가 아닌 학점 기준이다.
     */
    const semesterMaximumCredits =
      24;

    const annualMaximumCredits =
      42;

    const annualRemainingCredits =
      Math.max(
        annualMaximumCredits -
          existingAnnualCredits,
        0
      );

    /**
     * 해당 연도에 이미 42학점을 모두 사용했다면
     * 현재 귀속학기는 건너뛰고 다음 학기로 이동한다.
     */
    if (
      annualRemainingCredits <=
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

      const skippedSemesterStartDate =
        resolveEarliestStartDateForSemester({
          candidateDate:
            currentSemesterStartDate,

          semesterLabel:
            nextLabel,
        });

      if (
        !skippedSemesterStartDate
      ) {
        unresolvedReasons.push(
          `${nextLabel} 예상 시작일을 계산할 수 없습니다.`
        );

        break;
      }

      currentSemesterStartDate =
        skippedSemesterStartDate;

      currentSemesterLabel =
        nextLabel;

      continue;
    }

    /**
     * 이번 학기에 실제로 들어갈 과목을
     * 각 과목의 credits를 기준으로 순차 배치한다.
     */
    const semesterSubjects:
      QualificationPlannedSubject[] =
      [];

    let semesterCredits =
      0;

    while (
      subjectIndex <
        subjects.length
    ) {
      const subject =
        subjects[
          subjectIndex
        ];

      const subjectCredits =
        normalizeCredits(
          subject.credits
        );

      if (
        subjectCredits <=
        0
      ) {
        unresolvedReasons.push(
          `${subject.subjectName} 과목의 학점을 확인할 수 없습니다.`
        );

        break;
      }

      const nextSemesterCredits =
        semesterCredits +
        subjectCredits;

      const nextAnnualCredits =
        existingAnnualCredits +
        nextSemesterCredits;

      /**
       * 이번 과목을 넣으면
       * 학기 24학점 또는 연간 42학점을 초과하는 경우
       * 다음 학기로 넘긴다.
       */
      if (
        nextSemesterCredits >
          semesterMaximumCredits ||
        nextAnnualCredits >
          annualMaximumCredits
      ) {
        break;
      }

      semesterSubjects.push(
        subject
      );

      semesterCredits =
        nextSemesterCredits;

      subjectIndex +=
        1;
    }

    /**
     * 남은 과목은 있는데 현재 학기에
     * 단 한 과목도 넣을 수 없다면
     * 다음 귀속학기로 이동한다.
     */
    if (
      semesterSubjects.length ===
        0 &&
      subjectIndex <
        subjects.length
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

      const nextSemesterStartDate =
        resolveEarliestStartDateForSemester({
          candidateDate:
            currentSemesterStartDate,

          semesterLabel:
            nextLabel,
        });

      if (
        !nextSemesterStartDate
      ) {
        unresolvedReasons.push(
          `${nextLabel} 예상 시작일을 계산할 수 없습니다.`
        );

        break;
      }

      currentSemesterStartDate =
        nextSemesterStartDate;

      currentSemesterLabel =
        nextLabel;

      continue;
    }

    const placementCount =
      semesterSubjects.length;

    const nextAnnualCount =
      existingAnnualCount +
      placementCount;

    const nextAnnualCredits =
      existingAnnualCredits +
      semesterCredits;

    annualCountMap.set(
      parsed.year,
      nextAnnualCount
    );

    annualCreditMap.set(
      parsed.year,
      nextAnnualCredits
    );

/**
 * 한 학기 = 4개월.
 *
 * 예:
 * 2026-10-01 시작
 * → 다음 학기 기준일 2027-02-01
 * → 현재 학기 종료일 2027-01-31
 */
const nextSemesterCandidateDate =
  addMonthsToDate(
    currentSemesterStartDate,
    4
  );

const currentSemesterEndDate =
  nextSemesterCandidateDate;

        plannedSemesters.push({
      semesterOrder:
        nextSemesterOrder,

      semesterLabel:
        currentSemesterLabel,

      subjectCount:
        semesterSubjects.length,

      semesterCredits,

      subjects:
        semesterSubjects,

      annualSubjectCountAfterPlacement:
        nextAnnualCount,

      annualCreditsAfterPlacement:
        nextAnnualCredits,

estimatedStartDate:
  currentSemesterStartDate,

estimatedEndDate:
  currentSemesterEndDate,
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

const nextSemesterStartDate =
  resolveEarliestStartDateForSemester({
    candidateDate:
      nextSemesterCandidateDate,

    semesterLabel:
      nextLabel,
  });

if (
  !nextSemesterStartDate
) {
  unresolvedReasons.push(
    `${nextLabel} 예상 시작일을 계산할 수 없습니다.`
  );

  break;
}

currentSemesterStartDate =
  nextSemesterStartDate;

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

const semesterCount =
  plannedSemesters.length;

const nominalDurationMonths =
  semesterCount *
  4;

const estimatedStudyStartDate =
  plannedSemesters.length >
    0
    ? plannedSemesters[0]
        .estimatedStartDate
    : null;

const estimatedStudyEndDate =
  plannedSemesters.length >
    0
    ? plannedSemesters[
        plannedSemesters.length -
          1
      ].estimatedEndDate
    : null;

  return {
    canPlan:
      unresolvedReasons.length ===
      0,

    startBasis,

    referenceDate:
  today.date,

calculationBaseDate:
  today.date,

firstSemesterLabel,

semesterCount,

nominalDurationMonths,

estimatedStudyStartDate,

estimatedStudyEndDate,

semesters:
  plannedSemesters,

lastSemesterLabel,

    unresolvedReasons,

    warnings,
  };
}