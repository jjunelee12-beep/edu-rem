import * as db from "../db";

import {
  AiPermissionError,
  assertAiToolAllowed,
  assertCanAccessConsultation,
  assertCanAccessStudent,
  assertToolNameIsSafe,
  stripUntrustedScopeFields,
} from "./ai-permission";

import {
  createAiRequestId,
  summarizeAiToolOutput,
  writeAiAuditLog,
} from "./ai-audit";

import type {
  AiToolDefinition,
  AiToolExecutionResult,
  AiToolName,
  AiUserContext,

  ConsultationSearchToolInput,
  ConsultationSearchToolOutput,

  ConsultationCreateToolInput,
  ConsultationCreateToolOutput,

  ConsultationUpdateToolInput,
  ConsultationUpdateToolOutput,

  MissingDataAlertToolInput,
  MissingDataAlertToolOutput,

  StudentSearchToolInput,
  StudentSearchToolOutput,

    StudentSummaryToolInput,
  StudentSummaryToolOutput,

StudentUpdateToolInput,
StudentUpdateToolOutput,

    StudentDashboardToolInput,
  StudentDashboardToolOutput,

         SemesterCreateToolInput,
  SemesterCreateToolOutput,

  SemesterUpdateToolInput,
  SemesterUpdateToolOutput,

    SemesterCompleteToolInput,
  SemesterCompleteToolOutput,

    PlanCreateToolInput,
  PlanCreateToolOutput,

  PlanUpdateToolInput,
  PlanUpdateToolOutput,

    PlanSubjectsCreateToolInput,
  PlanSubjectsCreateToolOutput,

  PlanSubjectsUpdateToolInput,
  PlanSubjectsUpdateToolOutput,

  ScheduleCreateToolInput,
  ScheduleCreateToolOutput,

  PracticeInstitutionSearchToolInput,
  PracticeInstitutionSearchToolOutput,

  PracticeSupportStatusToolInput,
  PracticeSupportStatusToolOutput,

  StudentDetailRiskToolInput,
  StudentDetailRiskToolOutput,

    StudentListRiskToolInput,
  StudentListRiskToolOutput,

    AiDocumentAnalysisInput,
  AiDocumentAnalysisResult,

  SettlementSummaryToolInput,
  SettlementSummaryToolOutput,
} from "./ai.types";

import {
  analyzeStudentDetailRisk,
  analyzeStudentListRisk,
} from "./ai-risk-engine";

import {
  getStudentDashboard,
} from "./student-dashboard";

import {
  analyzeAiDocument,
} from "./document-analysis";

const toolRegistry = new Map<
  string,
  AiToolDefinition<any, any>
>();

function normalizeLimit(
  value: unknown,
  defaultValue = 20,
  maxValue = 100
) {
  const normalized = Number(value);

  if (
    !Number.isFinite(normalized) ||
    normalized <= 0
  ) {
    return defaultValue;
  }

  return Math.min(
    maxValue,
    Math.floor(normalized)
  );
}

function normalizeSearchQuery(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .slice(0, 200);
}

function normalizePositiveInteger(
  value:
    unknown
): number {
  const normalized =
    Number(
      value
    );

  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized <= 0
  ) {
    return 0;
  }

  return Math.floor(
    normalized
  );
}

function normalizeNullableText(
  value:
    unknown,

  maxLength:
    number
): string | null {
  const normalized =
    String(
      value ??
      ""
    )
      .trim()
      .slice(
        0,
        maxLength
      );

  return normalized ||
    null;
}

function normalizeNullableNonNegativeInteger(
  value:
    unknown,

  fieldLabel:
    string
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalized =
    Number(value);

  if (
    !Number.isFinite(
      normalized
    )
  ) {
    throw new Error(
      `${fieldLabel}는 숫자로 입력해야 합니다.`
    );
  }

  if (
    !Number.isInteger(
      normalized
    )
  ) {
    throw new Error(
      `${fieldLabel}는 정수로 입력해야 합니다.`
    );
  }

  if (
    normalized <
    0
  ) {
    throw new Error(
      `${fieldLabel}는 0 이상이어야 합니다.`
    );
  }

  return normalized;
}

function normalizeNullableNonNegativeAmount(
  value:
    unknown,

  fieldLabel:
    string
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalizedText =
    String(value)
      .replace(
        /,/g,
        ""
      )
      .trim();

  if (
    !normalizedText
  ) {
    return null;
  }

  const normalized =
    Number(
      normalizedText
    );

  if (
    !Number.isFinite(
      normalized
    )
  ) {
    throw new Error(
      `${fieldLabel}은 숫자로 입력해야 합니다.`
    );
  }

  if (
    normalized <
    0
  ) {
    throw new Error(
      `${fieldLabel}은 0원 이상이어야 합니다.`
    );
  }

  return normalized;
}

function normalizeSemesterDate(
  value:
    unknown
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  /**
   * MySQL/Drizzle에서 DATE 또는 DATETIME 컬럼이
   * Date 객체로 반환되는 경우를 처리한다.
   */
  if (
    value instanceof
    Date
  ) {
    if (
      Number.isNaN(
        value.getTime()
      )
    ) {
      throw new Error(
        "올바른 날짜를 입력해주세요."
      );
    }

    const year =
      value.getFullYear();

    const month =
      String(
        value.getMonth() +
        1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        value.getDate()
      ).padStart(
        2,
        "0"
      );

    return `${year}-${month}-${day}`;
  }

  const raw =
    String(
      value
    ).trim();

  /**
   * YYYY-MM-DD HH:mm:ss,
   * YYYY-MM-DDTHH:mm:ss 형식도
   * 날짜 앞부분만 사용한다.
   */
  const normalized =
    raw.slice(
      0,
      10
    );

  const matched =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (
    !matched
  ) {
    throw new Error(
      "날짜는 YYYY-MM-DD 형식이어야 합니다."
    );
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

  const parsed =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    parsed.getUTCFullYear() !==
      year ||
    parsed.getUTCMonth() !==
      month - 1 ||
    parsed.getUTCDate() !==
      day
  ) {
    throw new Error(
      "올바른 날짜를 입력해주세요."
    );
  }

  return normalized;
}

function normalizeSemesterPlannedMonth(
  value:
    unknown
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalized =
    String(value)
      .replace(
        /[^0-9]/g,
        ""
      )
      .trim();

  if (
    !/^\d{6}$/.test(
      normalized
    )
  ) {
    throw new Error(
      "예정 개강월은 YYYYMM 형식이어야 합니다."
    );
  }

  const month =
    Number(
      normalized.slice(
        4,
        6
      )
    );

  if (
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      "예정 개강월의 월 값이 올바르지 않습니다."
    );
  }

  return normalized;
}

/**
 * 마지막 학기 구분을 기준으로
 * 다음 학기 구분을 계산한다.
 *
 * 예:
 * 2026년 1학기 → 2026년 2학기
 * 2026년 2학기 → 2027년 1학기
 *
 * 기존 학기 구분이 없거나 형식이 잘못된 경우
 * 자동 계산할 수 없으므로 null을 반환한다.
 */
function getNextSemesterLabel(
  currentSemesterLabel:
    unknown
): string | null {
  const normalized =
    String(
      currentSemesterLabel ??
      ""
    ).trim();

  const matched =
    normalized.match(
      /^(\d{4})년\s*([12])학기$/
    );

  if (
    !matched
  ) {
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
    year < 2000 ||
    year > 2100
  ) {
    return null;
  }

  if (
    semesterHalf ===
    1
  ) {
    return `${year}년 2학기`;
  }

  if (
    semesterHalf ===
    2
  ) {
    return `${year + 1}년 1학기`;
  }

  return null;
}

/**
 * 학기 귀속과 예정 개강월이
 * 학점은행제 학기 구조상 호환되는지 검사한다.
 *
 * 중요:
 * 학기 귀속연도와 실제 개강연도가
 * 반드시 같지는 않다.
 *
 * 예:
 * 2026년 11~12월 개강
 * → 2027년 1학기 귀속 가능
 *
 * 월 단위 정보만 가지고 있으므로
 * 경계월인 5월 / 11월은
 * 두 학기 모두 가능하도록 처리한다.
 */
function isPlannedMonthCompatibleWithSemesterLabel(
  semesterLabel:
    unknown,

  plannedMonth:
    unknown
): boolean {
  const semesterMatched =
    String(
      semesterLabel ??
      ""
    )
      .trim()
      .match(
        /^(\d{4})년\s*([12])학기$/
      );

  const plannedMonthNormalized =
    String(
      plannedMonth ??
      ""
    )
      .replace(
        /[^0-9]/g,
        ""
      )
      .trim();

  if (
    !semesterMatched ||
    !/^\d{6}$/.test(
      plannedMonthNormalized
    )
  ) {
    return false;
  }

  const semesterYear =
    Number(
      semesterMatched[1]
    );

  const semesterHalf =
    Number(
      semesterMatched[2]
    );

  const plannedYear =
    Number(
      plannedMonthNormalized.slice(
        0,
        4
      )
    );

  const plannedMonthNumber =
    Number(
      plannedMonthNormalized.slice(
        4,
        6
      )
    );

  if (
    !Number.isFinite(
      semesterYear
    ) ||
    !Number.isFinite(
      plannedYear
    ) ||
    plannedMonthNumber <
      1 ||
    plannedMonthNumber >
      12
  ) {
    return false;
  }

  /**
   * Y년 1학기 귀속
   *
   * 전년도 11~12월 개강
   * 또는
   * 해당연도 1~5월 개강.
   *
   * 5월은 학기 경계가 될 수 있으므로 허용한다.
   */
  if (
    semesterHalf ===
    1
  ) {
    return (
      (
        plannedYear ===
          semesterYear -
            1 &&
        (
          plannedMonthNumber ===
            11 ||
          plannedMonthNumber ===
            12
        )
      ) ||
      (
        plannedYear ===
          semesterYear &&
        plannedMonthNumber >=
          1 &&
        plannedMonthNumber <=
          5
      )
    );
  }

  /**
   * Y년 2학기 귀속
   *
   * 해당연도 5~11월 개강.
   *
   * 5월 / 11월은 경계월이므로
   * 월 정보만으로 일자를 임의 판정하지 않는다.
   */
  if (
    semesterHalf ===
    2
  ) {
    return (
      plannedYear ===
        semesterYear &&
      plannedMonthNumber >=
        5 &&
      plannedMonthNumber <=
        11
    );
  }

  return false;
}

function normalizeConsultationCreateDate(
  value:
    unknown
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return new Date()
      .toISOString()
      .slice(
        0,
        10
      );
  }

  const normalized =
    String(
      value
    ).trim();

  const matched =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (
    !matched
  ) {
    throw new Error(
      "상담일은 YYYY-MM-DD 형식이어야 합니다."
    );
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

  const parsed =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    parsed.getUTCFullYear() !==
      year ||
    parsed.getUTCMonth() !==
      month - 1 ||
    parsed.getUTCDate() !==
      day
  ) {
    throw new Error(
      "올바른 상담일을 입력해주세요."
    );
  }

  return normalized;
}

function normalizeConsultationCreatePhone(
  value:
    unknown
): string {
  const normalized =
    String(
      value ??
      ""
    )
      .replace(
        /\D/g,
        ""
      )
      .slice(
        0,
        11
      );

  if (
    normalized.length <
      10 ||
    normalized.length >
      11
  ) {
    throw new Error(
      "연락처는 숫자 10자리 또는 11자리로 입력해주세요."
    );
  }

  return normalized;
}

function normalizeConsultationUpdateText(
  value:
    unknown,

  maxLength:
    number
): string | null {
  if (
    value === null
  ) {
    return null;
  }

  const normalized =
    String(
      value ??
      ""
    )
      .trim()
      .slice(
        0,
        maxLength
      );

  return normalized ||
    null;
}

function normalizeStudentUpdateText(
  value:
    unknown,

  maxLength:
    number
): string | null {
  /**
   * 명시적으로 null을 전달하면
   * 기존 값을 비우는 요청으로 처리한다.
   */
  if (
    value ===
    null
  ) {
    return null;
  }

  const normalized =
    String(
      value ??
      ""
    )
      .trim()
      .slice(
        0,
        maxLength
      );

  return normalized ||
    null;
}

function buildScheduleStartAt(params: {
  scheduleDate:
    string;

  meridiem:
    "AM" |
    "PM";

  hour12:
    number;

  minute:
    number;
}): string {
  const dateMatched =
    /^\d{4}-\d{2}-\d{2}$/.test(
      params.scheduleDate
    );

  if (!dateMatched) {
    throw new Error(
      "일정 날짜는 YYYY-MM-DD 형식이어야 합니다."
    );
  }

  const hour12 =
    normalizePositiveInteger(
      params.hour12
    );

  if (
    hour12 < 1 ||
    hour12 > 12
  ) {
    throw new Error(
      "일정 시간은 1시부터 12시 사이여야 합니다."
    );
  }

  const minute =
    Number(
      params.minute
    );

  if (
    !Number.isFinite(
      minute
    ) ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(
      "일정 분은 0분부터 59분 사이여야 합니다."
    );
  }

  let hour24 =
    hour12 %
    12;

  if (
    params.meridiem ===
    "PM"
  ) {
    hour24 +=
      12;
  }

  return `${params.scheduleDate} ${String(
    hour24
  ).padStart(
    2,
    "0"
  )}:${String(
    Math.floor(
      minute
    )
  ).padStart(
    2,
    "0"
  )}:00`;
}

function getScopedAssigneeIds(
  context: AiUserContext
): number[] | undefined {
  /**
   * db.listStudents / listConsultations에서
   * undefined는 회사 전체를 의미한다.
   */
  if (
    context.allowedAssigneeIds ===
    null
  ) {
    return undefined;
  }

  return context.allowedAssigneeIds;
}

/**
 * AI 정산 조회용 한국 날짜
 *
 * 서버가 UTC로 실행되더라도
 * CRM의 한국 업무일 기준으로 날짜를 계산한다.
 */
function getSettlementTodayKst() {
  const kst =
    new Date(
      Date.now() +
      9 *
        60 *
        60 *
        1000
    );

  return {
    year:
      kst.getUTCFullYear(),

    month:
      kst.getUTCMonth() +
      1,

    day:
      kst.getUTCDate(),

    date:
      [
        String(
          kst.getUTCFullYear()
        ).padStart(
          4,
          "0"
        ),

        String(
          kst.getUTCMonth() +
          1
        ).padStart(
          2,
          "0"
        ),

        String(
          kst.getUTCDate()
        ).padStart(
          2,
          "0"
        ),
      ].join("-"),
  };
}

/**
 * 정산 조회 날짜 검증
 *
 * YYYY-MM-DD만 허용한다.
 */
function normalizeSettlementDate(
  value:
    unknown,

  fieldLabel:
    string
): string {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  const matched =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (
    !matched
  ) {
    throw new Error(
      `${fieldLabel}는 YYYY-MM-DD 형식이어야 합니다.`
    );
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

  const parsed =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    parsed.getUTCFullYear() !==
      year ||
    parsed.getUTCMonth() !==
      month - 1 ||
    parsed.getUTCDate() !==
      day
  ) {
    throw new Error(
      `${fieldLabel}가 올바른 날짜가 아닙니다.`
    );
  }

  return normalized;
}

/**
 * YYYY-MM-DD에 날짜를 더한다.
 */
function addSettlementDays(
  date:
    string,

  days:
    number
): string {
  const normalized =
    normalizeSettlementDate(
      date,
      "정산 날짜"
    );

  const [
    year,
    month,
    day,
  ] =
    normalized
      .split("-")
      .map(Number);

  const next =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day +
          days
      )
    );

  return [
    String(
      next.getUTCFullYear()
    ).padStart(
      4,
      "0"
    ),

    String(
      next.getUTCMonth() +
      1
    ).padStart(
      2,
      "0"
    ),

    String(
      next.getUTCDate()
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
}

/**
 * AI가 전달한 기간 조건을
 * 실제 DB 조회 시작일 / 종료일로 변환한다.
 *
 * endDateExclusive는 SQL에서
 * occurredAt < endDateExclusive 로 사용한다.
 */
function resolveSettlementPeriod(
  input:
    SettlementSummaryToolInput
) {
  const today =
    getSettlementTodayKst();

  const periodType =
    input.periodType;

  /**
   * 특정 날짜
   */
  if (
    periodType ===
    "day"
  ) {
    const date =
      input.date
        ? normalizeSettlementDate(
            input.date,
            "조회 날짜"
          )
        : today.date;

    return {
      periodType:
        "day" as const,

      startDate:
        date,

      endDateExclusive:
        addSettlementDays(
          date,
          1
        ),

      displayEndDate:
        date,

      periodLabel:
        date,
    };
  }

  /**
   * 특정 월
   */
  if (
    periodType ===
    "month"
  ) {
    const year =
      Number(
        input.year ||
        today.year
      );

    const month =
      Number(
        input.month ||
        today.month
      );

    if (
      !Number.isInteger(
        year
      ) ||
      year < 2000 ||
      year > 2100
    ) {
      throw new Error(
        "정산 조회 연도가 올바르지 않습니다."
      );
    }

    if (
      !Number.isInteger(
        month
      ) ||
      month < 1 ||
      month > 12
    ) {
      throw new Error(
        "정산 조회 월은 1월부터 12월 사이여야 합니다."
      );
    }

    const startDate =
      `${year}-${String(
        month
      ).padStart(
        2,
        "0"
      )}-01`;

    const nextMonth =
      month === 12
        ? 1
        : month +
          1;

    const nextYear =
      month === 12
        ? year +
          1
        : year;

    const endDateExclusive =
      `${nextYear}-${String(
        nextMonth
      ).padStart(
        2,
        "0"
      )}-01`;

    const displayEndDate =
      addSettlementDays(
        endDateExclusive,
        -1
      );

    return {
      periodType:
        "month" as const,

      startDate,

      endDateExclusive,

      displayEndDate,

      periodLabel:
        `${year}년 ${month}월`,
    };
  }

  /**
   * 특정 연도
   */
  if (
    periodType ===
    "year"
  ) {
    const year =
      Number(
        input.year ||
        today.year
      );

    if (
      !Number.isInteger(
        year
      ) ||
      year < 2000 ||
      year > 2100
    ) {
      throw new Error(
        "정산 조회 연도가 올바르지 않습니다."
      );
    }

    return {
      periodType:
        "year" as const,

      startDate:
        `${year}-01-01`,

      endDateExclusive:
        `${year + 1}-01-01`,

      displayEndDate:
        `${year}-12-31`,

      periodLabel:
        `${year}년`,
    };
  }

  /**
   * 직접 기간 지정
   */
  if (
    periodType ===
    "range"
  ) {
    if (
      !input.startDate ||
      !input.endDate
    ) {
      throw new Error(
        "기간 조회는 시작일과 종료일이 모두 필요합니다."
      );
    }

    const startDate =
      normalizeSettlementDate(
        input.startDate,
        "조회 시작일"
      );

    const displayEndDate =
      normalizeSettlementDate(
        input.endDate,
        "조회 종료일"
      );

    const startTimestamp =
      Date.parse(
        `${startDate}T00:00:00Z`
      );

    const endTimestamp =
      Date.parse(
        `${displayEndDate}T00:00:00Z`
      );

    if (
      startTimestamp >
      endTimestamp
    ) {
      throw new Error(
        "정산 조회 시작일은 종료일보다 늦을 수 없습니다."
      );
    }

    /**
     * 실수로 지나치게 큰 원장 조회를 발생시키지 않도록
     * 최대 10년까지만 허용한다.
     */
    const rangeDays =
      Math.floor(
        (
          endTimestamp -
          startTimestamp
        ) /
          (
            24 *
            60 *
            60 *
            1000
          )
      );

    if (
      rangeDays >
      3653
    ) {
      throw new Error(
        "정산 기간 조회는 최대 10년까지 가능합니다."
      );
    }

    return {
      periodType:
        "range" as const,

      startDate,

      endDateExclusive:
        addSettlementDays(
          displayEndDate,
          1
        ),

      displayEndDate,

      periodLabel:
        `${startDate} ~ ${displayEndDate}`,
    };
  }

  throw new Error(
    "지원하지 않는 정산 조회 기간입니다."
  );
}

function isTextMatched(params: {
  queryLower: string;
  queryDigits: string;
  values: unknown[];
}) {
  const textMatched =
    params.values.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(params.queryLower)
    );

  /**
   * 전화번호는 숫자 4자리 이상일 때만 검색
   * 빈 문자열이 모든 번호와 일치하는 문제 방지
   */
  const phoneMatched =
    params.queryDigits.length >= 4 &&
    params.values.some((value) =>
      String(value ?? "")
        .replace(/\D/g, "")
        .includes(params.queryDigits)
    );

  return textMatched || phoneMatched;
}

/**
 * AI Tool 감사로그에 저장할 입력값 정제
 *
 * 이미지 Base64 같은 대용량 바이너리 문자열은
 * 감사로그 DB에 직접 저장하지 않는다.
 *
 * 실제 Tool 실행에는 원본 input을 그대로 사용하고,
 * 로그에만 정제된 값을 저장한다.
 */
function sanitizeAiToolInputForAudit(
  input:
    unknown
): unknown {
  if (
    !input ||
    typeof input !==
      "object" ||
    Array.isArray(
      input
    )
  ) {
    return input;
  }

  const source =
    input as
      Record<
        string,
        unknown
      >;

  const sanitized:
    Record<
      string,
      unknown
    > = {
      ...source,
    };

  if (
    typeof source.imageBase64 ===
      "string"
  ) {
    sanitized.imageBase64 = {
      redacted:
        true,

      originalLength:
        source.imageBase64.length,
    };
  }

  return sanitized;
}

function registerTool<
  TInput,
  TOutput
>(
  definition: AiToolDefinition<
    TInput,
    TOutput
  >
) {
  assertToolNameIsSafe(definition.name);

  if (
    toolRegistry.has(definition.name)
  ) {
    throw new Error(
      `중복된 AI Tool 이름입니다: ${definition.name}`
    );
  }

  toolRegistry.set(
    definition.name,
    definition as AiToolDefinition<
      any,
      any
    >
  );
}

/**
 * AI 교육 문서 이미지 분석
 *
 * 중요:
 * - 이미지 자체는 OpenAI Function arguments가 생성하지 않는다.
 * - Runner가 서버에서 검증된 첨부 이미지 정보를 실행 직전에 주입한다.
 * - 학생 선택 없이도 분석할 수 있다.
 * - 분석 결과만 반환하며 CRM DB를 변경하지 않는다.
 */
registerTool<
  AiDocumentAnalysisInput,
  AiDocumentAnalysisResult
>({
  name:
    "document.analysis",

  description:
    "사용자가 첨부한 성적증명서, 교육원 수강내역, 수강과목 캡처, 결제내역 등의 이미지를 분석합니다. 학생을 선택하지 않은 상태에서도 문서 자체 분석은 가능합니다. CRM에 저장하거나 수정하지 않고 분석 결과만 반환합니다.",

  /**
   * 이미지 파일 자체는 Runner가 서버에서 주입한다.
   *
   * OpenAI에게 Base64, MIME Type, 파일명을
   * Function arguments로 생성시키지 않는다.
   */
  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type: [
          "integer",
          "null",
        ],

        description:
          "현재 선택된 학생이 있으면 확정된 학생 ID입니다. 단순 문서 분석만 하는 경우 null 또는 생략할 수 있습니다.",

        minimum:
          1,
      },
    },

    required: [],

    additionalProperties:
      false,
  },

  accessMode:
    "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  requiresConfirmation:
    false,

  autoExecutable:
    true,

  handler: async ({
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as AiDocumentAnalysisInput;

    /**
     * MIME Type / 파일명 / Base64는
     * Runner가 서버에서 검증된 첨부파일로 주입한다.
     *
     * 여기에서는 document-analysis.ts의
     * 기존 입력 검증을 최종 기준으로 사용한다.
     */
    return analyzeAiDocument(
      safeInput
    );
  },
});

/**
 * AI 정산 매출 조회
 *
 * 권한 범위:
 * - Staff: 본인 매출
 * - Admin: 본인 팀 범위
 * - Host: 회사 전체
 *
 * Superhost는 사용하지 않는다.
 *
 * 조회 전용 Tool이며
 * 정산 원장 또는 다른 CRM 데이터를 수정하지 않는다.
 */
registerTool<
  SettlementSummaryToolInput,
  SettlementSummaryToolOutput
>({
  name:
    "settlement.summary",

  description:
    "현재 사용자의 권한 범위 안에서 일별, 월별, 연별 또는 지정 기간의 정산 매출을 조회합니다. Staff는 본인 매출만, Admin은 자기 팀 매출과 팀원별 매출만, Host는 회사 전체·팀별·직원별 매출을 조회할 수 있습니다. 신규/기존 매출, 환불, 순매출, 학생 수, 건수 및 직원별 순위를 조회할 수 있습니다. 정산 데이터는 수정하지 않습니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      periodType: {
        type:
          "string",

        enum: [
          "day",
          "month",
          "year",
          "range",
        ],

        description:
          "정산 조회 기간 단위. 특정 날짜는 day, 특정 월은 month, 특정 연도는 year, 시작일~종료일 직접 지정은 range를 사용합니다.",
      },

      year: {
        type: [
          "integer",
          "null",
        ],

        minimum:
          2000,

        maximum:
          2100,

        description:
          "조회 연도. 예: 2026. month/year 조회에서 사용하며 생략하면 현재 연도를 사용합니다.",
      },

      month: {
        type: [
          "integer",
          "null",
        ],

        minimum:
          1,

        maximum:
          12,

        description:
          "조회 월. month 조회에서 사용합니다. 예: 5월은 5. 생략하면 현재 월을 사용합니다.",
      },

      date: {
        type: [
          "string",
          "null",
        ],

        description:
          "day 조회 날짜. YYYY-MM-DD 형식입니다. '오늘 매출'처럼 현재 날짜 요청이면 생략할 수 있습니다.",
      },

      startDate: {
        type: [
          "string",
          "null",
        ],

        description:
          "range 조회 시작일. YYYY-MM-DD 형식입니다.",
      },

      endDate: {
        type: [
          "string",
          "null",
        ],

        description:
          "range 조회 종료일. YYYY-MM-DD 형식이며 해당 날짜까지 포함합니다.",
      },

      assigneeName: {
        type: [
          "string",
          "null",
        ],

        description:
          "특정 담당자 매출을 요청한 경우 담당자 이름만 입력합니다. 담당자 ID를 추측하거나 생성하지 않습니다. 예: '이재준 5월 매출'이면 '이재준'.",
      },

      teamName: {
        type: [
          "string",
          "null",
        ],

        description:
          "특정 팀 매출을 요청한 경우 팀 이름만 입력합니다. 팀 ID를 추측하거나 생성하지 않습니다. 예: '1팀 이번달 매출'이면 '1팀'.",
      },

      customerType: {
        type:
          "string",

        enum: [
          "all",
          "new",
          "existing",
        ],

        description:
          "전체 매출은 all, 1학기 신규 매출만 조회하면 new, 2학기 이상 기존 매출만 조회하면 existing입니다. 사용자가 구분하지 않으면 all을 사용합니다.",
      },

      includeRanking: {
        type:
          "boolean",

        description:
          "담당자별 매출 순위가 필요하면 true. '순위', '누가 제일 높아', '팀원 매출 순서' 같은 요청일 때 true로 사용합니다.",
      },
    },

    required: [
      "periodType",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  requiresConfirmation:
    false,

  autoExecutable:
    true,

  handler: async ({
    context,
    input,
  }) => {
    /**
     * organizationId / userId / role / teamId /
     * assigneeId 등의 서버 권한값을
     * OpenAI 입력에서 제거한다.
     */
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as SettlementSummaryToolInput;

    /**
     * Superhost는 Registry allowedRoles에서도 차단되지만
     * handler에서도 방어적으로 한 번 더 검사한다.
     */
    if (
      context.role !==
        "staff" &&
      context.role !==
        "admin" &&
      context.role !==
        "host"
    ) {
      throw new Error(
        "현재 계정은 AI 정산 조회를 사용할 수 없습니다."
      );
    }

    /**
     * AI Context에 이미 확정된 권한 범위만 사용한다.
     *
     * 절대로 input에서 organizationId,
     * assigneeId, teamId를 받아 사용하지 않는다.
     */
    const allowedAssigneeIds =
      context.allowedAssigneeIds ===
        null
        ? null
        : Array.from(
            new Set(
              (
                context.allowedAssigneeIds ||
                []
              )
                .map(Number)
                .filter(
                  (
                    id
                  ) =>
                    Number.isFinite(
                      id
                    ) &&
                    id >
                      0
                )
            )
          );

    /**
     * 역할에 따른 데이터 범위도
     * 사용자 입력이 아니라 서버가 결정한다.
     */
    const scope =
      context.role ===
        "staff"
        ? "self"
        : context.role ===
            "admin"
          ? "team"
          : "organization";

    /**
     * 기간을 서버에서 최종 검증·확정한다.
     */
    const period =
      resolveSettlementPeriod(
        safeInput
      );

    const assigneeName =
      normalizeNullableText(
        safeInput.assigneeName,
        100
      );

    const teamName =
      normalizeNullableText(
        safeInput.teamName,
        100
      );

    const customerType:
      "all" |
      "new" |
      "existing" =
      safeInput.customerType ===
        "new" ||
      safeInput.customerType ===
        "existing"
        ? safeInput.customerType
        : "all";

    const includeRanking =
      safeInput.includeRanking ===
        true;

    /**
     * 실제 매출 계산은
     * db.ts의 기존 settlementItems 원장 기준
     * AI 조회 전용 함수를 사용한다.
     */
    return db.getAiSettlementSummary({
      organizationId:
        context.organizationId,

      role:
        context.role,

      scope,

      /**
       * 현재 AiUserContext 타입에 팀 ID가 있는 경우
       * 출력 메타데이터에만 사용한다.
       *
       * 실제 권한 범위는 allowedAssigneeIds가 기준이다.
       */
      contextTeamId:
        Number(
          (
            context as any
          ).teamId ||
          0
        ) ||
        null,

      allowedAssigneeIds,

      periodType:
        period.periodType,

      startDate:
        period.startDate,

      endDateExclusive:
        period.endDateExclusive,

      displayEndDate:
        period.displayEndDate,

      periodLabel:
        period.periodLabel,

      assigneeName,

      teamName,

      customerType,

      includeRanking,
    });
  },
});

/**
 * 학생 검색
 */
registerTool<
  StudentSearchToolInput,
  StudentSearchToolOutput
>({
  name:
  "student.search",

description:
  "현재 사용자의 권한 범위 안에서 학생을 이름, 연락처, 과정, 상태, 교육원으로 검색합니다. 학생 이름만 알고 있거나 학생 ID를 찾기 전에 사용합니다.",

inputSchema: {
  type:
    "object",

  properties: {
    query: {
      type:
        "string",

      description:
        "검색할 학생의 이름, 연락처 일부, 과정, 상태 또는 교육원",
    },

    limit: {
      type:
        "integer",

      description:
        "최대 검색 결과 수",

      minimum:
        1,

      maximum:
        50,
    },
  },

  required: [
    "query",
  ],

  additionalProperties:
    false,
},

accessMode:
  "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as StudentSearchToolInput;

    const query =
      normalizeSearchQuery(
        safeInput.query
      );

    if (!query) {
      throw new Error(
        "학생 검색어를 입력해주세요."
      );
    }

    const limit = normalizeLimit(
      safeInput.limit,
      20,
      50
    );

    const assigneeIds =
      getScopedAssigneeIds(context);

    const students =
      await db.listStudents(
        assigneeIds,
        {
          organizationId:
            context.organizationId,
        }
      );

    const queryLower =
      query.toLowerCase();

    const queryDigits =
      query.replace(/\D/g, "");

    const matched = (
      students || []
    )
      .filter((student: any) =>
        isTextMatched({
          queryLower,
          queryDigits,
          values: [
            student.clientName,
            student.phone,
            student.course,
            student.status,
            student.institution,
          ],
        })
      )
      .slice(0, limit)
      .map((student: any) => ({
        id: Number(student.id),

        clientName:
          student.clientName ?? null,

        phone:
          student.phone ?? null,

        course:
          student.course ?? null,

        status:
          student.status ?? null,

        institution:
          student.institution ?? null,

        assigneeId:
          student.assigneeId
            ? Number(
                student.assigneeId
              )
            : null,
      }));

    return {
      query,
      count: matched.length,
      students: matched,
    };
  },
});

/**
 * 학생 상세 요약
 */
registerTool<
  StudentSummaryToolInput,
  StudentSummaryToolOutput
>({
  name:
    "student.summary",

  description:
    "현재 사용자가 접근 가능한 학생 한 명의 기본 정보만 조회합니다. 학기, 과목, 결제, 실습, 위험요소까지 필요하면 student.dashboard를 사용합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "기본정보를 조회할 확정된 학생 ID",

        minimum:
          1,
      },
    },

    required: [
      "studentId",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as StudentSummaryToolInput;

    const studentId =
      Number(safeInput.studentId);

    if (
      !Number.isFinite(studentId) ||
      studentId <= 0
    ) {
      throw new Error(
        "올바른 학생 ID가 필요합니다."
      );
    }

    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (!student) {
      throw new Error(
        "학생 정보를 찾을 수 없습니다."
      );
    }

    assertCanAccessStudent({
  context,
  student,
});

const registrationSummary =
  await db.getStudentRegistrationSummary(
    studentId,
    {
      organizationId:
        context.organizationId,
    }
  );

const safeStudent:
  StudentSummaryToolOutput["student"] = {
      id: Number(
        (student as any).id
      ),

      organizationId:
        Number(
          (student as any)
            .organizationId
        ),

      clientName:
        (student as any)
          .clientName ?? null,

      phone:
        (student as any).phone ??
        null,

      course:
  (student as any).course ??
  null,

status:
  registrationSummary.status ||
  (student as any).status ||
  null,

finalEducation:
  registrationSummary
    .finalEducation ??
  null,

startDate:
  registrationSummary.startDate ??
  (student as any).startDate ??
  null,

     paymentAmount:
  Number(registrationSummary.paymentAmount || 0) > 0
    ? registrationSummary.paymentAmount
    : (student as any).paymentAmount ?? null,

      paymentDate:
  registrationSummary.paymentDate ??
  (student as any).paymentDate ??
  null,

      subjectCount:
  Number(registrationSummary.subjectCount || 0) > 0
    ? Number(registrationSummary.subjectCount)
    : Number((student as any).subjectCount || 0) > 0
      ? Number((student as any).subjectCount)
      : null,

      institution:
  registrationSummary.institution ||
  (student as any).institution ||
  null,

     totalSemesters:
  Number(
    registrationSummary.totalSemesters || 0
  ) > 0
    ? Number(
        registrationSummary.totalSemesters
      )
    : Number(
        (student as any).totalSemesters || 0
      ) > 0
      ? Number(
          (student as any).totalSemesters
        )
      : null,

      approvalStatus:
        (student as any)
          .approvalStatus ?? null,

      assigneeId:
        Number(
          (student as any)
            .assigneeId || 0
        ) || null,

      address:
        (student as any).address ??
        null,

      detailAddress:
        (student as any)
          .detailAddress ?? null,
    };

    return {
      student: safeStudent,
    };
  },
});


/**
 * 학생 기본정보 수정 승인 초안
 *
 * 이 Tool은 students 테이블을 직접 수정하지 않는다.
 * 현재 학생 값과 변경할 값을 비교하고
 * Pending Action 생성에 사용할 초안만 반환한다.
 */
registerTool<
  StudentUpdateToolInput,
  StudentUpdateToolOutput
>({
  name:
    "student.update",

  description:
  "현재 사용자가 담당하는 학생의 상태, 과정, 주소 또는 상세주소를 수정하기 위한 승인 초안을 생성합니다. 실제 DB 수정은 사용자 승인 후 실행됩니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "수정할 확정된 학생 ID",

        minimum:
          1,
      },

    status: {
  type:
    "string",

  enum: [
    "등록",
    "종료",
    "등록 종료",
  ],

  description:
    "변경할 학생 상태입니다. 등록, 종료, 등록 종료 중 하나만 사용할 수 있습니다. 사용자가 상태 변경을 요청하지 않았다면 이 필드를 전달하지 않습니다.",
},

      course: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 진행 과정. 사용자가 과정 변경을 요청하지 않았다면 전달하지 않습니다.",
      },

      address: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 기본 주소. 사용자가 주소 변경을 요청하지 않았다면 전달하지 않습니다.",
      },

      detailAddress: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 상세주소. 사용자가 상세주소 변경을 요청하지 않았다면 전달하지 않습니다.",
      },
    },

    required: [
      "studentId",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  /**
   * 실제 수정은 Pending Action 승인 후
   * student-update-executor에서 실행한다.
   */
  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as StudentUpdateToolInput;

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (
      studentId <=
      0
    ) {
      throw new Error(
        "수정할 학생 ID가 필요합니다."
      );
    }

    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (!student) {
      throw new Error(
        "수정할 학생 정보를 찾을 수 없습니다."
      );
    }

    /**
     * 초안 단계에서는 조회 가능 범위를 확인한다.
     *
     * 실제 실행 단계에서는
     * assertCanWriteStudent()로
     * 본인 담당 학생인지 다시 검사한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    const hasStatusUpdate =
      safeInput.status !==
      undefined;

    const hasCourseUpdate =
      safeInput.course !==
      undefined;

    const hasAddressUpdate =
      safeInput.address !==
      undefined;

    const hasDetailAddressUpdate =
      safeInput.detailAddress !==
      undefined;

   if (
  !hasStatusUpdate &&
  !hasCourseUpdate &&
  !hasAddressUpdate &&
  !hasDetailAddressUpdate
) {
      throw new Error(
        "변경할 학생 정보가 필요합니다."
      );
    }

    const currentStatus =
      normalizeStudentUpdateText(
        (student as any)
          .status,
        100
      );

    const currentCourse =
      normalizeStudentUpdateText(
        (student as any)
          .course,
        255
      );


    const currentAddress =
      normalizeStudentUpdateText(
        (student as any)
          .address,
        500
      );

    const currentDetailAddress =
      normalizeStudentUpdateText(
        (student as any)
          .detailAddress,
        500
      );

    const nextStatus =
      hasStatusUpdate
        ? normalizeStudentUpdateText(
            safeInput.status,
            100
          )
        : currentStatus;

    const nextCourse =
      hasCourseUpdate
        ? normalizeStudentUpdateText(
            safeInput.course,
            255
          )
        : currentCourse;

    const nextAddress =
      hasAddressUpdate
        ? normalizeStudentUpdateText(
            safeInput.address,
            500
          )
        : currentAddress;

    const nextDetailAddress =
      hasDetailAddressUpdate
        ? normalizeStudentUpdateText(
            safeInput.detailAddress,
            500
          )
        : currentDetailAddress;

    const changes:
      StudentUpdateToolOutput["changes"] =
      [];

    if (
      hasStatusUpdate &&
      currentStatus !==
        nextStatus
    ) {
      changes.push({
        field:
          "status",

        label:
          "학생 상태",

        before:
          currentStatus,

        after:
          nextStatus,
      });
    }

    if (
      hasCourseUpdate &&
      currentCourse !==
        nextCourse
    ) {
      changes.push({
        field:
          "course",

        label:
          "진행 과정",

        before:
          currentCourse,

        after:
          nextCourse,
      });
    }

    if (
      hasAddressUpdate &&
      currentAddress !==
        nextAddress
    ) {
      changes.push({
        field:
          "address",

        label:
          "주소",

        before:
          currentAddress,

        after:
          nextAddress,
      });
    }

    if (
      hasDetailAddressUpdate &&
      currentDetailAddress !==
        nextDetailAddress
    ) {
      changes.push({
        field:
          "detailAddress",

        label:
          "상세주소",

        before:
          currentDetailAddress,

        after:
          nextDetailAddress,
      });
    }

    if (
      changes.length ===
      0
    ) {
      throw new Error(
        "현재 학생 정보와 변경할 값이 동일합니다."
      );
    }

    const updates:
      StudentUpdateToolOutput["draft"]["updates"] =
      {};

    if (
      hasStatusUpdate &&
      currentStatus !==
        nextStatus
    ) {
      updates.status =
        nextStatus;
    }

    if (
      hasCourseUpdate &&
      currentCourse !==
        nextCourse
    ) {
      updates.course =
        nextCourse;
    }

    if (
      hasAddressUpdate &&
      currentAddress !==
        nextAddress
    ) {
      updates.address =
        nextAddress;
    }

    if (
      hasDetailAddressUpdate &&
      currentDetailAddress !==
        nextDetailAddress
    ) {
      updates.detailAddress =
        nextDetailAddress;
    }

    const studentName =
      normalizeStudentUpdateText(
        (student as any)
          .clientName,
        100
      );

    const warnings:
      string[] =
      [];

    if (
      updates.status ===
      null
    ) {
      warnings.push(
        "학생 상태가 비어 있는 값으로 변경됩니다."
      );
    }

    if (
      updates.course ===
      null
    ) {
      warnings.push(
        "학생 진행 과정이 비어 있는 값으로 변경됩니다."
      );
    }

    const createdAt =
      new Date()
        .toISOString();

    return {
      pendingActionRequired:
        true,

      studentId,

      studentName,

      changes,

      draft: {
        studentId,

        studentName,

        originalValues: {
          status:
            currentStatus,

          course:
            currentCourse,

          address:
            currentAddress,

          detailAddress:
            currentDetailAddress,
        },

        updates,

        requestedByUserId:
          context.userId,

        requestedByRole:
          context.role,

        createdAt,
      },

      preview: {
        title:
          "학생 기본정보 수정",

        summary:
          `${
            studentName ||
            `학생 #${studentId}`
          }의 기본정보 ${changes.length}개 항목을 수정합니다.`,

        sections: [
          {
            title:
              "수정 대상 학생",

            items: [
              `학생 번호 · ${studentId}`,
              `학생명 · ${studentName || "확인 필요"}`,
            ],
          },
        ],

        changes,

        executionSteps: [
          "현재 학생정보와 초안 생성 당시 값을 다시 비교합니다.",
          "로그인 사용자의 조직과 학생 접근 범위를 다시 확인합니다.",
          "현재 로그인 사용자가 실제 담당자인지 다시 확인합니다.",
          "승인된 변경 항목만 학생 기본정보에 반영합니다.",
          "AI 실행 결과와 변경 내역을 기록합니다.",
        ],

        missingFields:
          [],

        warnings,

        canConfirm:
          changes.length >
          0,
      },
    };
  },
});

/**
 * 학생 종합 업무 현황
 *
 * 학생 기본정보, 학기, 과목, 학점,
 * 결제, 실습, 위험요소 및 다음 업무를
 * 한 번에 조회한다.
 */
registerTool<
  StudentDashboardToolInput,
  StudentDashboardToolOutput
>({
  name:
    "student.dashboard",

  description:
    "현재 사용자가 접근 가능한 학생 한 명의 기본정보, 학기, 과목, 학점, 결제, 환불, 실습, 일정, 위험요소와 다음 처리 업무를 종합 조회합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "종합 현황을 조회할 확정된 학생 ID",

        minimum:
          1,
      },
    },

    required: [
      "studentId",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  requiresConfirmation:
    false,

  autoExecutable:
    true,

  handler: async ({
    context,
    input,
  }) => {
    /**
     * 프론트에서 전달한 organizationId,
     * assigneeId, role 등의 권한값을 제거한다.
     */
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as StudentDashboardToolInput;

    const studentId =
      Number(
        safeInput.studentId
      );

    if (
      !Number.isFinite(
        studentId
      ) ||
      studentId <= 0
    ) {
      throw new Error(
        "올바른 학생 ID가 필요합니다."
      );
    }

    /**
     * 실제 조직 범위와 학생 접근 권한 검사는
     * getStudentDashboard 내부에서 다시 확인한다.
     */
    return getStudentDashboard({
      context,
      studentId:
        Math.floor(
          studentId
        ),
    });
  },
});

/**
 * 학생 주소 또는 직접 입력 주소 기준
 * 실습기관 및 실습교육원 추천
 *
 * 조회 전용 Tool이다.
 * 실제 실습기관 선택이나 배정은 실행하지 않는다.
 *
 * 검색 방식:
 * 1) studentId가 있으면 학생 주소 기준
 * 2) studentId가 없고 address가 있으면 직접 입력 주소 기준
 */
registerTool<
  PracticeInstitutionSearchToolInput,
  PracticeInstitutionSearchToolOutput
>({
  name:
    "practice.institutionSearch",

  description:
  "실습기관과 실습교육원을 거리순으로 추천합니다. 학생 ID가 있으면 해당 학생의 등록된 주소를 기준으로 검색하고, 학생을 선택하지 않은 상태에서는 사용자가 말한 주소를 기준으로 검색할 수 있습니다. 선정 취소, 선정기간 만료, 비활성, 숨김 기관은 제외합니다. 실제 기관 선택이나 배정은 실행하지 않습니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type: [
          "integer",
          "null",
        ],

        description:
          "현재 선택된 학생이 있으면 확정된 학생 ID입니다. 학생 없이 주소만으로 검색하는 경우 null 또는 생략합니다.",

        minimum:
          1,
      },

      address: {
  type: [
    "string",
    "null",
  ],

  description:
    "학생을 선택하지 않고 직접 검색할 위치 주소입니다.",
},

      limit: {
        type: [
          "integer",
          "null",
        ],

        description:
          "각 종류별 반환할 최대 추천 개수입니다. 기본값은 5개이며 최대 30개입니다.",

        minimum:
          1,

        maximum:
          30,
      },
    },

    required: [],

    additionalProperties:
      false,
  },

  accessMode:
    "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  requiresConfirmation:
    false,

  autoExecutable:
    true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as PracticeInstitutionSearchToolInput;

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    const address =
      String(
        safeInput.address ??
        ""
      )
        .trim()
        .slice(
          0,
          300
        );

    const limit =
      normalizeLimit(
        safeInput.limit,
        5,
        30
      );

    /**
     * 학생 ID와 직접 입력 주소가
     * 모두 없는 경우에는 검색 기준이 없다.
     */
    if (
      studentId <= 0 &&
      !address
    ) {
      throw new Error(
        "실습기관을 추천할 학생 ID 또는 검색할 주소가 필요합니다."
      );
    }

    let recommendation:
      any;

    let student:
      any =
        null;

    /**
     * 1순위:
     * studentId가 있으면 기존 학생 기준 검색을 사용한다.
     *
     * 주소가 같이 들어오더라도
     * 확정된 학생이 있으면 학생 DB 주소를 우선한다.
     */
    if (
      studentId >
      0
    ) {
      student =
        await db.getStudentById(
          studentId,
          {
            organizationId:
              context.organizationId,
          }
        );

      if (!student) {
        throw new Error(
          "학생 정보를 찾을 수 없습니다."
        );
      }

      assertCanAccessStudent({
        context,
        student,
      });

      recommendation =
        await db
          .getPracticeRecommendationsForStudent(
            studentId,
            {
              organizationId:
                context.organizationId,
            }
          );
    } else {
      /**
       * 학생이 선택되지 않은 경우:
       * 사용자가 직접 말한 주소를 좌표로 변환한 뒤
       * 해당 위치 기준으로 검색한다.
       */
      recommendation =
        await db
          .getPracticeRecommendationsForAddress(
            address,
            {
              organizationId:
                context.organizationId,

              limit,
            }
          );
    }

    const rawInstitutions =
      Array.isArray(
        recommendation
          ?.institutions
      )
        ? recommendation
            .institutions
        : [];

    const rawEducationCenters =
      Array.isArray(
        recommendation
          ?.educationCenters
      )
        ? recommendation
            .educationCenters
        : [];

    const normalizeResultItem =
      (
        item:
          any
      ) => ({
        id:
          Number(
            item?.id ||
            0
          ),

        sourceType:
          item?.sourceType ??
          null,

        masterId:
          Number(
            item?.masterId ||
            0
          ) ||
          null,

        name:
          item?.name ??
          null,

        phone:
          item?.phone ??
          null,

        address:
          item?.address ??
          null,

        detailAddress:
          item?.detailAddress ??
          null,

        latitude:
          item?.latitude ??
          null,

        longitude:
          item?.longitude ??
          null,

        distanceKm:
          Number(
            item?.distanceKm ||
            0
          ),

        price:
          item?.price ??
          null,

        availableCourse:
          item?.availableCourse ??
          null,

        selectionStatus:
          item?.selectionStatus ??
          null,

        selectionValidFrom:
          item?.selectionValidFrom ??
          null,

        selectionValidTo:
          item?.selectionValidTo ??
          null,

        practiceAvailabilityType:
          item?.practiceAvailabilityType ??
          null,

        isInactive:
          item?.isInactive ===
          true,

        inactiveReason:
          item?.inactiveReason ??
          null,

        memo:
          item?.memo ??
          null,
      });

    const institutions =
      rawInstitutions
        .map(
          normalizeResultItem
        )
        .filter(
          (
            item
          ) =>
            item.id !==
              0 &&
            item.distanceKm >=
              0
        )
        .slice(
          0,
          limit
        );

    const educationCenters =
      rawEducationCenters
        .map(
          normalizeResultItem
        )
        .filter(
          (
            item
          ) =>
            item.id !==
              0 &&
            item.distanceKm >=
              0
        )
        .slice(
          0,
          limit
        );

    const recommendationStudent =
      recommendation?.student ||
      student;

    const searchLocation =
      recommendation
        ?.searchLocation ??
      null;

    return {
      student:
        recommendationStudent
          ? {
              id:
                Number(
                  recommendationStudent
                    ?.id ||
                  studentId
                ),

              clientName:
                recommendationStudent
                  ?.clientName ??
                null,

              course:
                recommendationStudent
                  ?.course ??
                null,

              address:
                recommendationStudent
                  ?.address ??
                null,

              detailAddress:
                recommendationStudent
                  ?.detailAddress ??
                null,

              latitude:
                Number.isFinite(
                  Number(
                    recommendationStudent
                      ?.latitude
                  )
                )
                  ? Number(
                      recommendationStudent
                        ?.latitude
                    )
                  : null,

              longitude:
                Number.isFinite(
                  Number(
                    recommendationStudent
                      ?.longitude
                  )
                )
                  ? Number(
                      recommendationStudent
                        ?.longitude
                    )
                  : null,

              assigneeId:
                Number(
                  recommendationStudent
                    ?.assigneeId ||
                  0
                ) ||
                null,
            }
          : null,

      searchLocation:
        searchLocation
          ? {
              address:
                searchLocation
                  ?.address ??
                address,

              latitude:
                Number.isFinite(
                  Number(
                    searchLocation
                      ?.latitude
                  )
                )
                  ? Number(
                      searchLocation
                        ?.latitude
                    )
                  : null,

              longitude:
                Number.isFinite(
                  Number(
                    searchLocation
                      ?.longitude
                  )
                )
                  ? Number(
                      searchLocation
                        ?.longitude
                    )
                  : null,
            }
          : null,

      searchMode:
        studentId > 0
          ? "student"
          : "address",

      institutions,

      educationCenters,

      summary: {
        institutionCount:
          institutions.length,

        educationCenterCount:
          educationCenters.length,

        nearestInstitutionDistanceKm:
          institutions[0]
            ?.distanceKm ??
          null,

        nearestEducationCenterDistanceKm:
          educationCenters[0]
            ?.distanceKm ??
          null,
      },

      generatedAt:
        new Date()
          .toISOString(),
    };
  },
});

/**
 * 실습배정지원센터 학생 상태 조회
 *
 * 학생에게 등록된 실습배정지원 요청,
 * 섭외상태, 결제상태, 교육원 및 실습기관
 * 선택 현황을 조회한다.
 */
registerTool<
  PracticeSupportStatusToolInput,
  PracticeSupportStatusToolOutput
>({
  name:
    "practice.supportStatus",

  description:
    "현재 사용자가 접근 가능한 학생의 실습배정지원 신청 여부, 섭외상태, 결제상태, 실습시간, 실습일정, 선택된 교육원과 실습기관을 조회합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "실습배정지원 상태를 조회할 확정된 학생 ID",

        minimum:
          1,
      },
    },

    required: [
      "studentId",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  requiresConfirmation:
    false,

  autoExecutable:
    true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as PracticeSupportStatusToolInput;

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (
      studentId <=
      0
    ) {
      throw new Error(
        "실습 상태를 조회할 올바른 학생 ID가 필요합니다."
      );
    }

    /**
     * 먼저 학생의 조직 및 조회 권한을 확인한다.
     */
    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (!student) {
      throw new Error(
        "실습 상태를 조회할 학생을 찾을 수 없습니다."
      );
    }

    assertCanAccessStudent({
      context,
      student,
    });

    /**
     * 기존 실습배정지원센터 조회 함수를 그대로 사용한다.
     */
    const requestRows =
      await db.listPracticeSupportRequestsByStudent(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    const requests:
      PracticeSupportStatusToolOutput["requests"] =
      (
        Array.isArray(
          requestRows
        )
          ? requestRows
          : []
      ).map(
        (
          row:
            any
        ) => ({
          id:
            Number(
              row.id ||
              row.practiceSupportRequestId ||
              0
            ),

          studentId:
            Number(
              row.studentId ||
              studentId
            ),

          semesterId:
            Number(
              row.semesterId ||
              0
            ) ||
            null,

          semesterOrder:
            Number(
              row.semesterOrder ||
              1
            ),

          clientName:
            String(
              row.clientName ||
              (student as any)
                .clientName ||
              ""
            ).trim() ||
            null,

          course:
            String(
              row.course ||
              (student as any)
                .course ||
              ""
            ).trim() ||
            null,

          assigneeId:
            Number(
              row.assigneeId ||
              (student as any)
                .assigneeId ||
              0
            ) ||
            null,

          assigneeName:
            String(
              row.assigneeName ||
              ""
            ).trim() ||
            null,

          managerName:
            String(
              row.managerName ||
              ""
            ).trim() ||
            null,

          practiceHours:
            Number.isFinite(
              Number(
                row.practiceHours
              )
            )
              ? Number(
                  row.practiceHours
                )
              : null,

          practiceDate:
            String(
              row.practiceDate ||
              ""
            ).trim() ||
            null,

          coordinationStatus:
            String(
              row.coordinationStatus ||
              "미섭외"
            ).trim() ||
            "미섭외",

          paymentStatus:
            String(
              row.paymentStatus ||
              "미결제"
            ).trim() ||
            "미결제",

          feeAmount:
            row.feeAmount ??
            "0",

          selectedEducationCenter: {
            id:
              Number(
                row.selectedEducationCenterId ||
                0
              ) ||
              null,

            name:
              String(
                row.selectedEducationCenterName ||
                ""
              ).trim() ||
              null,

            address:
              String(
                row.selectedEducationCenterAddress ||
                ""
              ).trim() ||
              null,

            distanceKm:
              row.selectedEducationCenterDistanceKm ??
              null,
          },

          selectedPracticeInstitution: {
            id:
              Number(
                row.selectedPracticeInstitutionId ||
                0
              ) ||
              null,

            name:
              String(
                row.selectedPracticeInstitutionName ||
                ""
              ).trim() ||
              null,

            address:
              String(
                row.selectedPracticeInstitutionAddress ||
                ""
              ).trim() ||
              null,

            distanceKm:
              row.selectedPracticeInstitutionDistanceKm ??
              null,
          },

          note:
            String(
              row.note ||
              ""
            ).trim() ||
            null,

          createdAt:
            row.createdAt ??
            null,

          updatedAt:
            row.updatedAt ??
            null,
        })
      )
      .filter(
        (
          row
        ) =>
          row.id >
          0
      );

    /**
     * DB 함수가 오래된 순서로 반환하므로
     * 마지막 항목을 최신 요청으로 사용한다.
     */
    const latestRequest =
      requests.length >
      0
        ? requests[
            requests.length -
            1
          ]
        : null;

    return {
      student: {
        id:
          Number(
            (student as any)
              .id
          ),

        clientName:
          (student as any)
            .clientName ??
          null,

        course:
          (student as any)
            .course ??
          null,

        assigneeId:
          Number(
            (student as any)
              .assigneeId ||
            0
          ) ||
          null,
      },

      hasRequest:
        requests.length >
        0,

      requestCount:
        requests.length,

      latestRequest,

      requests,

      summary: {
        coordinationStatus:
          latestRequest
            ?.coordinationStatus ||
          "신청없음",

        paymentStatus:
          latestRequest
            ?.paymentStatus ||
          "신청없음",

        educationCenterSelected:
          Boolean(
            latestRequest
              ?.selectedEducationCenter
              .id ||
            latestRequest
              ?.selectedEducationCenter
              .name
          ),

        practiceInstitutionSelected:
          Boolean(
            latestRequest
              ?.selectedPracticeInstitution
              .id ||
            latestRequest
              ?.selectedPracticeInstitution
              .name
          ),

        practiceHours:
          latestRequest
            ?.practiceHours ??
          null,

        practiceDate:
          latestRequest
            ?.practiceDate ??
          null,
      },

      generatedAt:
        new Date()
          .toISOString(),
    };
  },
});

/**
 * 기존 학생 학기 수정 승인 초안
 *
 * 이 Tool은 semesters 테이블을 직접 수정하지 않는다.
 * 학생과 대상 학기를 조회하고 현재값과 변경값을 비교하여
 * Pending Action 생성에 사용할 초안만 반환한다.
 */
registerTool<
  SemesterUpdateToolInput,
  SemesterUpdateToolOutput
>({
  name:
    "semester.update",

  description:
    "현재 사용자가 접근 가능한 기존 학생의 학기 구분, 예정정보, 실제 개강정보 및 결제정보를 수정하기 위한 승인 초안을 생성합니다. 학기 순서, 입력완료 여부와 승인상태는 수정하지 않습니다. 실제 변경은 사용자의 최종 승인 후 실행합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "학기를 수정할 확정된 학생 ID",

        minimum:
          1,
      },

      semesterOrder: {
        type:
          "integer",

        description:
          "수정할 대상 학기 순서",

        minimum:
          1,

        maximum:
          20,
      },

      semesterLabel: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 학기 구분. 2026년 1학기 형식입니다. 사용자가 변경을 요청하지 않았다면 전달하지 않습니다.",
      },

      plannedMonth: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 예정 개강월. YYYYMM 형식입니다. 사용자가 변경을 요청하지 않았다면 전달하지 않습니다.",
      },

      plannedInstitution: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 예정 교육원 이름. 사용자가 변경을 요청하지 않았다면 전달하지 않습니다.",
      },

      plannedSubjectCount: {
        type: [
          "integer",
          "null",
        ],

        description:
          "변경할 예정 과목 수. 사용자가 변경을 요청하지 않았다면 전달하지 않습니다.",

        minimum:
          0,

        maximum:
          8,
      },

      plannedAmount: {
        type: [
          "number",
          "null",
        ],

        description:
          "변경할 예정 결제금액. 사용자가 변경을 요청하지 않았다면 전달하지 않습니다.",

        minimum:
          0,
      },

      actualStartDate: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 실제 개강일. YYYY-MM-DD 형식입니다. 사용자가 변경을 요청하지 않았다면 전달하지 않습니다.",
      },

      actualInstitution: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 실제 교육원 이름. 사용자가 변경을 요청하지 않았다면 전달하지 않습니다.",
      },

      actualSubjectCount: {
        type: [
          "integer",
          "null",
        ],

        description:
          "변경할 실제 과목 수. 사용자가 변경을 요청하지 않았다면 전달하지 않습니다.",

        minimum:
          0,

        maximum:
          8,
      },

      actualAmount: {
        type: [
          "number",
          "null",
        ],

        description:
          "변경할 실제 결제금액. 사용자가 변경을 요청하지 않았다면 전달하지 않습니다.",

        minimum:
          0,
      },

      actualPaymentDate: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 실제 결제일. YYYY-MM-DD 형식입니다. 사용자가 변경을 요청하지 않았다면 전달하지 않습니다.",
      },
    },

    required: [
      "studentId",
      "semesterOrder",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as SemesterUpdateToolInput;

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (
      studentId <=
      0
    ) {
      throw new Error(
        "학기를 수정할 학생 ID가 필요합니다."
      );
    }

    const semesterOrder =
      normalizePositiveInteger(
        safeInput.semesterOrder
      );

    if (
      semesterOrder <=
        0 ||
      semesterOrder >
        20
    ) {
      throw new Error(
        "수정할 학기 순서는 1부터 20 사이여야 합니다."
      );
    }

    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (
      !student
    ) {
      throw new Error(
        "학기를 수정할 학생 정보를 찾을 수 없습니다."
      );
    }

    assertCanAccessStudent({
      context,
      student,
    });

    const semesters =
      await db.listSemesters(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    const semesterList =
      Array.isArray(
        semesters
      )
        ? semesters
        : [];

    const semester =
      semesterList.find(
        (
          item:
            any
        ) =>
          normalizePositiveInteger(
            item?.semesterOrder
          ) ===
          semesterOrder
      );

    if (
      !semester
    ) {
      throw new Error(
        `${semesterOrder}학기 정보를 찾을 수 없습니다.`
      );
    }

    const semesterId =
      normalizePositiveInteger(
        (
          semester as
            any
        ).id
      );

    if (
      semesterId <=
      0
    ) {
      throw new Error(
        "수정할 학기 ID를 확인할 수 없습니다."
      );
    }

    if (
      normalizePositiveInteger(
        (
          semester as
            any
        ).studentId
      ) !==
      studentId
    ) {
      throw new Error(
        "선택한 학기가 현재 학생에게 속하지 않습니다."
      );
    }

    const approvalStatus =
      normalizeNullableText(
        (
          semester as
            any
        ).approvalStatus,
        100
      );

    if (
      approvalStatus ===
        "대기"
    ) {
      throw new Error(
        "승인 대기 중인 학기는 수정할 수 없습니다."
      );
    }

    if (
      approvalStatus ===
        "승인"
    ) {
      throw new Error(
        "이미 승인된 학기는 수정할 수 없습니다."
      );
    }

    const hasSemesterLabelUpdate =
      Object.prototype.hasOwnProperty.call(
        safeInput,
        "semesterLabel"
      );

    const hasPlannedMonthUpdate =
      Object.prototype.hasOwnProperty.call(
        safeInput,
        "plannedMonth"
      );

    const hasPlannedInstitutionUpdate =
      Object.prototype.hasOwnProperty.call(
        safeInput,
        "plannedInstitution"
      );

    const hasPlannedSubjectCountUpdate =
      Object.prototype.hasOwnProperty.call(
        safeInput,
        "plannedSubjectCount"
      );

    const hasPlannedAmountUpdate =
      Object.prototype.hasOwnProperty.call(
        safeInput,
        "plannedAmount"
      );

    const hasActualStartDateUpdate =
      Object.prototype.hasOwnProperty.call(
        safeInput,
        "actualStartDate"
      );

    const hasActualInstitutionUpdate =
      Object.prototype.hasOwnProperty.call(
        safeInput,
        "actualInstitution"
      );

    const hasActualSubjectCountUpdate =
      Object.prototype.hasOwnProperty.call(
        safeInput,
        "actualSubjectCount"
      );

    const hasActualAmountUpdate =
      Object.prototype.hasOwnProperty.call(
        safeInput,
        "actualAmount"
      );

    const hasActualPaymentDateUpdate =
      Object.prototype.hasOwnProperty.call(
        safeInput,
        "actualPaymentDate"
      );

    if (
      !hasSemesterLabelUpdate &&
      !hasPlannedMonthUpdate &&
      !hasPlannedInstitutionUpdate &&
      !hasPlannedSubjectCountUpdate &&
      !hasPlannedAmountUpdate &&
      !hasActualStartDateUpdate &&
      !hasActualInstitutionUpdate &&
      !hasActualSubjectCountUpdate &&
      !hasActualAmountUpdate &&
      !hasActualPaymentDateUpdate
    ) {
      throw new Error(
        "변경할 학기 정보가 필요합니다."
      );
    }

    const currentSemesterLabel =
      normalizeNullableText(
        (
          semester as
            any
        ).semesterLabel,
        100
      );

    const currentPlannedMonth =
      normalizeSemesterPlannedMonth(
        (
          semester as
            any
        ).plannedMonth
      );

    const currentPlannedInstitution =
      normalizeNullableText(
        (
          semester as
            any
        ).plannedInstitution,
        255
      );

    const currentPlannedSubjectCount =
      normalizeNullableNonNegativeInteger(
        (
          semester as
            any
        ).plannedSubjectCount,
        "현재 예정 과목 수"
      );

    const currentPlannedAmount =
      normalizeNullableNonNegativeAmount(
        (
          semester as
            any
        ).plannedAmount,
        "현재 예정 결제금액"
      );

    const currentActualStartDate =
      normalizeSemesterDate(
        (
          semester as
            any
        ).actualStartDate
      );

    const currentActualInstitution =
      normalizeNullableText(
        (
          semester as
            any
        ).actualInstitution,
        255
      );

    const currentActualSubjectCount =
      normalizeNullableNonNegativeInteger(
        (
          semester as
            any
        ).actualSubjectCount,
        "현재 실제 과목 수"
      );

    const currentActualAmount =
      normalizeNullableNonNegativeAmount(
        (
          semester as
            any
        ).actualAmount,
        "현재 실제 결제금액"
      );

    const currentActualPaymentDate =
      normalizeSemesterDate(
        (
          semester as
            any
        ).actualPaymentDate
      );

    let nextSemesterLabel =
      currentSemesterLabel;

    if (
      hasSemesterLabelUpdate
    ) {
      const requestedSemesterLabel =
        normalizeNullableText(
          safeInput.semesterLabel,
          100
        );

      if (
        requestedSemesterLabel ===
        null
      ) {
        nextSemesterLabel =
          null;
      } else {
        const matched =
          requestedSemesterLabel.match(
            /^(\d{4})년\s*([12])학기$/
          );

        if (
          !matched
        ) {
          throw new Error(
            "학기 구분은 2026년 1학기 형식이어야 합니다."
          );
        }

        const year =
          Number(
            matched[1]
          );

        if (
          year < 2000 ||
          year > 2100
        ) {
          throw new Error(
            "학기 구분의 연도 정보가 올바르지 않습니다."
          );
        }

        nextSemesterLabel =
          `${matched[1]}년 ${matched[2]}학기`;
      }
    }

    const nextPlannedMonth =
      hasPlannedMonthUpdate
        ? normalizeSemesterPlannedMonth(
            safeInput.plannedMonth
          )
        : currentPlannedMonth;

    const nextPlannedInstitution =
      hasPlannedInstitutionUpdate
        ? normalizeNullableText(
            safeInput.plannedInstitution,
            255
          )
        : currentPlannedInstitution;

    const nextPlannedSubjectCount =
      hasPlannedSubjectCountUpdate
        ? normalizeNullableNonNegativeInteger(
            safeInput.plannedSubjectCount,
            "예정 과목 수"
          )
        : currentPlannedSubjectCount;

    if (
      nextPlannedSubjectCount !==
        null &&
      nextPlannedSubjectCount >
        8
    ) {
      throw new Error(
        "한 학기 예정 과목 수는 8개를 초과할 수 없습니다."
      );
    }

    const nextPlannedAmount =
      hasPlannedAmountUpdate
        ? normalizeNullableNonNegativeAmount(
            safeInput.plannedAmount,
            "예정 결제금액"
          )
        : currentPlannedAmount;

    const nextActualStartDate =
      hasActualStartDateUpdate
        ? normalizeSemesterDate(
            safeInput.actualStartDate
          )
        : currentActualStartDate;

    const nextActualInstitution =
      hasActualInstitutionUpdate
        ? normalizeNullableText(
            safeInput.actualInstitution,
            255
          )
        : currentActualInstitution;

    const nextActualSubjectCount =
      hasActualSubjectCountUpdate
        ? normalizeNullableNonNegativeInteger(
            safeInput.actualSubjectCount,
            "실제 과목 수"
          )
        : currentActualSubjectCount;

    if (
      nextActualSubjectCount !==
        null &&
      nextActualSubjectCount >
        8
    ) {
      throw new Error(
        "한 학기 실제 과목 수는 8개를 초과할 수 없습니다."
      );
    }

    const nextActualAmount =
      hasActualAmountUpdate
        ? normalizeNullableNonNegativeAmount(
            safeInput.actualAmount,
            "실제 결제금액"
          )
        : currentActualAmount;

    const nextActualPaymentDate =
      hasActualPaymentDateUpdate
        ? normalizeSemesterDate(
            safeInput.actualPaymentDate
          )
        : currentActualPaymentDate;

    if (
      nextSemesterLabel
    ) {
      const normalizedNextLabel =
        nextSemesterLabel
          .replace(
            /\s+/g,
            ""
          )
          .toLowerCase();

      const duplicateSemesterLabel =
        semesterList.some(
          (
            item:
              any
          ) => {
            const itemId =
              normalizePositiveInteger(
                item?.id
              );

            if (
              itemId ===
              semesterId
            ) {
              return false;
            }

            return (
              String(
                item?.semesterLabel ||
                ""
              )
                .replace(
                  /\s+/g,
                  ""
                )
                .toLowerCase() ===
              normalizedNextLabel
            );
          }
        );

      if (
        duplicateSemesterLabel
      ) {
        throw new Error(
          `${nextSemesterLabel}는 이미 등록된 학기 구분입니다.`
        );
      }
    }

    if (
      nextSemesterLabel &&
      nextPlannedMonth
    ) {
      const labelMatched =
        nextSemesterLabel.match(
          /^(\d{4})년\s*([12])학기$/
        );

      const semesterYear =
        Number(
          labelMatched?.[1] ||
          0
        );

      const plannedYear =
        Number(
          nextPlannedMonth.slice(
            0,
            4
          )
        );

      if (
        semesterYear !==
        plannedYear
      ) {
        throw new Error(
          `학기 구분은 ${semesterYear}년이지만 예정 개강월은 ${plannedYear}년입니다.`
        );
      }
    }

    if (
      (
        nextPlannedSubjectCount !==
          null ||
        nextActualSubjectCount !==
          null
      ) &&
      !nextSemesterLabel
    ) {
      throw new Error(
        "연간 과목 수를 확인하려면 학기 구분이 필요합니다."
      );
    }

    if (
      nextSemesterLabel
    ) {
      const semesterYear =
        Number(
          nextSemesterLabel.match(
            /^(\d{4})년\s*([12])학기$/
          )?.[1] ||
          0
        );

      const otherSemesterSubjectCount =
        semesterList
          .filter(
            (
              item:
                any
            ) => {
              if (
                normalizePositiveInteger(
                  item?.id
                ) ===
                semesterId
              ) {
                return false;
              }

              const matched =
                String(
                  item?.semesterLabel ||
                  ""
                ).match(
                  /^(\d{4})년\s*([12])학기$/
                );

              return (
                matched !==
                  null &&
                Number(
                  matched[1]
                ) ===
                semesterYear
              );
            }
          )
          .reduce(
            (
              total:
                number,
              item:
                any
            ) => {
              const actualCount =
                normalizeNullableNonNegativeInteger(
                  item?.actualSubjectCount,
                  "기존 학기 실제 과목 수"
                );

              const plannedCount =
                normalizeNullableNonNegativeInteger(
                  item?.plannedSubjectCount,
                  "기존 학기 예정 과목 수"
                );

              return total +
                (
                  actualCount ??
                  plannedCount ??
                  0
                );
            },
            0
          );

      const targetSemesterSubjectCount =
        nextActualSubjectCount ??
        nextPlannedSubjectCount ??
        0;

      const annualSubjectCount =
        otherSemesterSubjectCount +
        targetSemesterSubjectCount;

      if (
        annualSubjectCount >
        14
      ) {
        throw new Error(
          `${semesterYear}년 전체 과목 수가 ${annualSubjectCount}과목으로 연간 14과목 제한을 초과합니다.`
        );
      }
    }

    const changes:
      SemesterUpdateToolOutput["changes"] =
      [];

    if (
      hasSemesterLabelUpdate &&
      currentSemesterLabel !==
        nextSemesterLabel
    ) {
      changes.push({
        field:
          "semesterLabel",

        label:
          "학기 구분",

        before:
          currentSemesterLabel,

        after:
          nextSemesterLabel,
      });
    }

    if (
      hasPlannedMonthUpdate &&
      currentPlannedMonth !==
        nextPlannedMonth
    ) {
      changes.push({
        field:
          "plannedMonth",

        label:
          "예정 개강월",

        before:
          currentPlannedMonth,

        after:
          nextPlannedMonth,
      });
    }

    if (
      hasPlannedInstitutionUpdate &&
      currentPlannedInstitution !==
        nextPlannedInstitution
    ) {
      changes.push({
        field:
          "plannedInstitution",

        label:
          "예정 교육원",

        before:
          currentPlannedInstitution,

        after:
          nextPlannedInstitution,
      });
    }

    if (
      hasPlannedSubjectCountUpdate &&
      currentPlannedSubjectCount !==
        nextPlannedSubjectCount
    ) {
      changes.push({
        field:
          "plannedSubjectCount",

        label:
          "예정 과목 수",

        before:
          currentPlannedSubjectCount,

        after:
          nextPlannedSubjectCount,
      });
    }

    if (
      hasPlannedAmountUpdate &&
      currentPlannedAmount !==
        nextPlannedAmount
    ) {
      changes.push({
        field:
          "plannedAmount",

        label:
          "예정 결제금액",

        before:
          currentPlannedAmount,

        after:
          nextPlannedAmount,
      });
    }

    if (
      hasActualStartDateUpdate &&
      currentActualStartDate !==
        nextActualStartDate
    ) {
      changes.push({
        field:
          "actualStartDate",

        label:
          "실제 개강일",

        before:
          currentActualStartDate,

        after:
          nextActualStartDate,
      });
    }

    if (
      hasActualInstitutionUpdate &&
      currentActualInstitution !==
        nextActualInstitution
    ) {
      changes.push({
        field:
          "actualInstitution",

        label:
          "실제 교육원",

        before:
          currentActualInstitution,

        after:
          nextActualInstitution,
      });
    }

    if (
      hasActualSubjectCountUpdate &&
      currentActualSubjectCount !==
        nextActualSubjectCount
    ) {
      changes.push({
        field:
          "actualSubjectCount",

        label:
          "실제 과목 수",

        before:
          currentActualSubjectCount,

        after:
          nextActualSubjectCount,
      });
    }

    if (
      hasActualAmountUpdate &&
      currentActualAmount !==
        nextActualAmount
    ) {
      changes.push({
        field:
          "actualAmount",

        label:
          "실제 결제금액",

        before:
          currentActualAmount,

        after:
          nextActualAmount,
      });
    }

    if (
      hasActualPaymentDateUpdate &&
      currentActualPaymentDate !==
        nextActualPaymentDate
    ) {
      changes.push({
        field:
          "actualPaymentDate",

        label:
          "실제 결제일",

        before:
          currentActualPaymentDate,

        after:
          nextActualPaymentDate,
      });
    }

    if (
      changes.length ===
      0
    ) {
      throw new Error(
        "현재 학기 정보와 변경할 값이 동일합니다."
      );
    }

    const updates:
      SemesterUpdateToolOutput["draft"]["updates"] =
      {};

    for (
      const change of
      changes
    ) {
      switch (
        change.field
      ) {
        case "semesterLabel":
          updates.semesterLabel =
            nextSemesterLabel;
          break;

        case "plannedMonth":
          updates.plannedMonth =
            nextPlannedMonth;
          break;

        case "plannedInstitution":
          updates.plannedInstitution =
            nextPlannedInstitution;
          break;

        case "plannedSubjectCount":
          updates.plannedSubjectCount =
            nextPlannedSubjectCount;
          break;

        case "plannedAmount":
          updates.plannedAmount =
            nextPlannedAmount;
          break;

        case "actualStartDate":
          updates.actualStartDate =
            nextActualStartDate;
          break;

        case "actualInstitution":
          updates.actualInstitution =
            nextActualInstitution;
          break;

        case "actualSubjectCount":
          updates.actualSubjectCount =
            nextActualSubjectCount;
          break;

        case "actualAmount":
          updates.actualAmount =
            nextActualAmount;
          break;

        case "actualPaymentDate":
          updates.actualPaymentDate =
            nextActualPaymentDate;
          break;
      }
    }

    const studentName =
      normalizeNullableText(
        (
          student as
            any
        ).clientName,
        100
      );

    const assigneeId =
      normalizePositiveInteger(
        (
          student as
            any
        ).assigneeId
      );

    if (
      assigneeId <=
      0
    ) {
      throw new Error(
        "학생 담당자 정보가 없어 학기 수정 초안을 만들 수 없습니다."
      );
    }

    const warnings:
      string[] =
      [];

    if (
      nextSemesterLabel ===
      null
    ) {
      warnings.push(
        "학기 구분이 비어 있는 값으로 변경됩니다."
      );
    }

    if (
      nextPlannedMonth ===
      null
    ) {
      warnings.push(
        "예정 개강월이 비어 있는 값으로 변경됩니다."
      );
    }

    if (
      nextPlannedInstitution ===
      null
    ) {
      warnings.push(
        "예정 교육원이 비어 있는 값으로 변경됩니다."
      );
    }

    const createdAt =
      new Date()
        .toISOString();

    return {
      pendingActionRequired:
        true,

      studentId,

      studentName,

      semesterId,

      semesterOrder,

      semesterLabel:
        nextSemesterLabel,

      changes,

      draft: {
        studentId,

        studentName,

        assigneeId,

        semesterId,

        semesterOrder,

        originalValues: {
          updatedAt:
            (
              semester as
                any
            ).updatedAt ??
            null,

          semesterLabel:
            currentSemesterLabel,

          plannedMonth:
            currentPlannedMonth,

          plannedInstitution:
            currentPlannedInstitution,

          plannedSubjectCount:
            currentPlannedSubjectCount,

          plannedAmount:
            currentPlannedAmount,

          actualStartDate:
            currentActualStartDate,

          actualInstitution:
            currentActualInstitution,

          actualInstitutionId:
            normalizePositiveInteger(
              (
                semester as
                  any
              ).actualInstitutionId
            ) ||
            null,

          actualSubjectCount:
            currentActualSubjectCount,

          actualAmount:
            currentActualAmount,

          actualPaymentDate:
            currentActualPaymentDate,

          isCompleted:
            (
              semester as
                any
            ).isCompleted ===
              true ||
            Number(
              (
                semester as
                  any
              ).isCompleted ||
              0
            ) ===
              1,

          approvalStatus,
        },

        updates,

        requestedByUserId:
          context.userId,

        requestedByRole:
          context.role,

        createdAt,
      },

      preview: {
        title:
          "학생 학기 수정",

        summary:
          `${
            studentName ||
            `학생 #${studentId}`
          }의 ${semesterOrder}학기 정보 ${changes.length}개 항목을 수정합니다.`,

        sections: [
          {
            label:
              "수정 대상 학기",

            items: [
              `학생 번호 · ${studentId}`,
              `학생명 · ${studentName || "확인 필요"}`,
              `학기 순서 · ${semesterOrder}학기`,
              `현재 승인상태 · ${approvalStatus || "요청전"}`,
            ],
          },
        ],

        changes:
          changes.map(
            (
              change
            ) => ({
              label:
                change.label,

              before:
                change.before,

              after:
                change.after,
            })
          ),

        executionSteps: [
          "현재 학생 정보와 조직 범위를 다시 확인합니다.",
          "현재 로그인 사용자가 학생을 수정할 수 있는 담당자인지 다시 확인합니다.",
          "초안 생성 이후 학생 담당자가 변경되지 않았는지 확인합니다.",
          "초안 생성 당시 학기값과 현재 학기값을 다시 비교합니다.",
          "승인 대기 또는 승인 완료 상태인지 다시 확인합니다.",
          "학기 중복, 한 학기 8과목 및 연간 14과목 제한을 다시 확인합니다.",
          "승인된 변경 항목만 해당 학기에 반영합니다.",
          "학기 수정 결과와 변경 내역을 기록합니다.",
        ],

        missingFields:
          [],

        warnings,

        canConfirm:
          changes.length >
          0,
      },
    };
  },
});

/**
 * 기존 학생 학기 생성 승인 초안
 *
 * 이 Tool은 semesters 테이블을 직접 수정하지 않는다.
 * 학생, 기존 학기 순서, 중복 여부를 확인한 뒤
 * Pending Action 생성에 사용할 초안만 반환한다.
 */
registerTool<
  SemesterCreateToolInput,
  SemesterCreateToolOutput
>({
  name:
    "semester.create",

  description:
  "현재 사용자가 접근 가능한 기존 학생에게 새 학기를 추가하기 위한 승인 초안을 생성합니다. 학기 순서와 학기 구분은 기존 마지막 학기를 기준으로 서버에서 자동 계산할 수 있습니다. 첫 학기 생성 시에는 학기 구분을 입력해야 합니다. 실제 등록은 사용자의 최종 승인 후 실행합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "학기를 생성할 확정된 학생 ID",

        minimum:
          1,
      },

      semesterOrder: {
  type:
    "integer",

  description:
    "생성할 학기 순서입니다. 생략하면 서버에서 기존 마지막 학기 다음 번호로 자동 계산합니다. 값을 전달한 경우 서버 계산 결과와 일치해야 합니다.",

  minimum:
    1,

  maximum:
    20,
},

      semesterLabel: {
  type: [
    "string",
    "null",
  ],

  description:
    "학기 구분입니다. 기존 학기가 있으면 마지막 학기 구분을 기준으로 서버에서 자동 계산합니다. 기존 학기가 없는 첫 학기 생성 시에는 반드시 입력합니다. 예: 2026년 1학기",
},

      plannedMonth: {
        type: [
          "string",
          "null",
        ],

        description:
          "예정 개강월. YYYYMM 형식입니다. 예: 202608",
      },

      plannedInstitution: {
        type: [
          "string",
          "null",
        ],

        description:
          "예정 교육원 이름",
      },

      plannedSubjectCount: {
        type: [
          "integer",
          "null",
        ],

        description:
          "예정 과목 수",

        minimum:
          0,

        maximum:
          50,
      },

      plannedAmount: {
        type: [
          "number",
          "null",
        ],

        description:
          "예정 결제금액",

        minimum:
          0,
      },

      startDate: {
        type: [
          "string",
          "null",
        ],

        description:
          "실제 개강일. YYYY-MM-DD 형식",
      },

      institution: {
        type: [
          "string",
          "null",
        ],

        description:
          "실제 수강 교육원 이름",
      },

      subjectCount: {
        type: [
          "integer",
          "null",
        ],

        description:
          "실제 수강 과목 수",

        minimum:
          0,

        maximum:
          50,
      },

      paymentAmount: {
        type: [
          "number",
          "null",
        ],

        description:
          "실제 결제금액",

        minimum:
          0,
      },

      paymentDate: {
        type: [
          "string",
          "null",
        ],

        description:
          "실제 결제일. YYYY-MM-DD 형식",
      },
    },

    required: [
  "studentId",
],

    additionalProperties:
      false,
  },

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as SemesterCreateToolInput;

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (
      studentId <=
      0
    ) {
      throw new Error(
        "학기를 생성할 학생 ID가 필요합니다."
      );
    }

const student =
  await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (
      !student
    ) {
      throw new Error(
        "학기를 생성할 학생 정보를 찾을 수 없습니다."
      );
    }

    /**
     * 초안 단계에서는 조회 범위를 확인한다.
     *
     * 실제 승인 실행 단계에서는
     * 담당자 쓰기 권한을 다시 확인해야 한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    const existingSemesters =
      await db.listSemesters(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    const normalizedSemesters =
      (
        Array.isArray(
          existingSemesters
        )
          ? existingSemesters
          : []
      )
        .map(
          (
            semester:
              any
          ) => ({
            ...semester,

            semesterOrder:
              normalizePositiveInteger(
                semester
                  ?.semesterOrder
              ),

            semesterLabel:
  normalizeNullableText(
    semester
      ?.semesterLabel,
    100
  ),

plannedSubjectCount:
  normalizeNullableNonNegativeInteger(
    semester
      ?.plannedSubjectCount,
    "기존 학기 예정 과목 수"
  ),

actualSubjectCount:
  normalizeNullableNonNegativeInteger(
    semester
      ?.actualSubjectCount,
    "기존 학기 실제 과목 수"
  ),
          })
        )
        .filter(
          (
            semester:
              any
          ) =>
            semester
              .semesterOrder >
            0
        );

/**
 * 마지막 학기 구분을 안정적으로 찾기 위해
 * 학기 순서 기준으로 정렬한다.
 */
normalizedSemesters.sort(
  (
    left:
      any,
    right:
      any
  ) =>
    Number(
      left
        ?.semesterOrder ||
      0
    ) -
    Number(
      right
        ?.semesterOrder ||
      0
    )
);

    const originalLastSemesterOrder =
  normalizedSemesters.reduce(
    (
      maxValue:
        number,
      semester:
        any
    ) =>
      Math.max(
        maxValue,
        Number(
          semester
            .semesterOrder ||
          0
        )
      ),
    0
  );

const expectedNextSemesterOrder =
  originalLastSemesterOrder +
  1;

/**
 * 사용자가 학기 순서를 명시했는지 확인한다.
 *
 * 생략한 경우 서버에서 자동 계산하고,
 * 명시한 경우 서버 계산값과 일치하는지 검증한다.
 */
const requestedSemesterOrder =
  safeInput.semesterOrder ===
    undefined ||
  safeInput.semesterOrder ===
    null
    ? null
    : normalizePositiveInteger(
        safeInput.semesterOrder
      );

if (
  requestedSemesterOrder !==
    null &&
  requestedSemesterOrder <=
    0
) {
  throw new Error(
    "학기 순서는 1 이상이어야 합니다."
  );
}

if (
  requestedSemesterOrder !==
    null &&
  requestedSemesterOrder >
    20
) {
  throw new Error(
    "학기 순서는 20을 초과할 수 없습니다."
  );
}

if (
  expectedNextSemesterOrder >
  20
) {
  throw new Error(
    "더 이상 학기를 추가할 수 없습니다. 최대 학기 순서는 20입니다."
  );
}

if (
  requestedSemesterOrder !==
    null &&
  requestedSemesterOrder !==
    expectedNextSemesterOrder
) {
  throw new Error(
    `현재 학생의 다음 학기 순서는 ${expectedNextSemesterOrder}입니다. 입력된 ${requestedSemesterOrder}학기는 생성할 수 없습니다.`
  );
}

const semesterOrder =
  expectedNextSemesterOrder;

const duplicateOrder =
  normalizedSemesters.some(
    (
      semester:
        any
    ) =>
      Number(
        semester
          .semesterOrder
      ) ===
      semesterOrder
  );

if (
  duplicateOrder
) {
  throw new Error(
    `${semesterOrder}학기는 이미 등록되어 있습니다.`
  );
}

/**
 * 가장 마지막 학기를 찾는다.
 */
const lastSemester =
  normalizedSemesters.length >
  0
    ? normalizedSemesters[
        normalizedSemesters.length -
        1
      ]
    : null;

const lastSemesterLabel =
  normalizeNullableText(
    lastSemester
      ?.semesterLabel,
    100
  );

/**
 * 기존 학기가 있으면 마지막 학기 구분을 기준으로
 * 다음 학기 구분을 자동 계산한다.
 *
 * 기존 학기가 없는 첫 학기라면 자동 계산할 기준이 없으므로
 * 사용자가 학기 구분을 입력해야 한다.
 */
const automaticallyCalculatedSemesterLabel =
  lastSemester
    ? getNextSemesterLabel(
        lastSemesterLabel
      )
    : null;

const requestedSemesterLabel =
  normalizeNullableText(
    safeInput.semesterLabel,
    100
  );

if (
  lastSemester &&
  !automaticallyCalculatedSemesterLabel
) {
  throw new Error(
    `기존 마지막 학기의 학기 구분(${lastSemesterLabel || "미입력"})을 해석할 수 없어 다음 학기를 자동 계산할 수 없습니다. 기존 학기 정보를 먼저 확인해주세요.`
  );
}

if (
  !lastSemester &&
  !requestedSemesterLabel
) {
  throw new Error(
    "첫 학기 생성 시에는 학기 구분을 입력해주세요. 예: 2026년 1학기"
  );
}

const rawResolvedSemesterLabel =
  automaticallyCalculatedSemesterLabel ||
  requestedSemesterLabel;

if (
  !rawResolvedSemesterLabel
) {
  throw new Error(
    "생성할 학기 구분을 결정하지 못했습니다."
  );
}

const semesterLabelMatched =
  rawResolvedSemesterLabel.match(
    /^(\d{4})년\s*([12])학기$/
  );

if (
  !semesterLabelMatched
) {
  throw new Error(
    "학기 구분은 2026년 1학기 형식이어야 합니다."
  );
}

const normalizedInputSemesterLabel =
  `${semesterLabelMatched[1]}년 ${semesterLabelMatched[2]}학기`;

const semesterLabelYear =
  Number(
    semesterLabelMatched[1]
  );

const semesterLabelHalf =
  Number(
    semesterLabelMatched[2]
  );

if (
  !Number.isFinite(
    semesterLabelYear
  ) ||
  semesterLabelYear < 2000 ||
  semesterLabelYear > 2100
) {
  throw new Error(
    "학기 구분의 연도 정보가 올바르지 않습니다."
  );
}

if (
  semesterLabelHalf !==
    1 &&
  semesterLabelHalf !==
    2
) {
  throw new Error(
    "학기 구분은 1학기 또는 2학기만 사용할 수 있습니다."
  );
}

/**
 * 사용자가 학기 구분을 명시한 경우에는
 * 서버 자동 계산값과 같은지 검증한다.
 */
if (
  automaticallyCalculatedSemesterLabel &&
  requestedSemesterLabel
) {
  const requestedMatched =
    requestedSemesterLabel.match(
      /^(\d{4})년\s*([12])학기$/
    );

  if (
    !requestedMatched
  ) {
    throw new Error(
      "입력한 학기 구분은 2026년 1학기 형식이어야 합니다."
    );
  }

  const normalizedRequestedSemesterLabel =
    `${requestedMatched[1]}년 ${requestedMatched[2]}학기`;

  if (
    normalizedRequestedSemesterLabel !==
    automaticallyCalculatedSemesterLabel
  ) {
    throw new Error(
      `현재 마지막 학기(${lastSemesterLabel}) 다음 학기 구분은 ${automaticallyCalculatedSemesterLabel}입니다. 입력된 ${normalizedRequestedSemesterLabel}는 생성할 수 없습니다.`
    );
  }
}

    const normalizedSemesterLabel =
  normalizedInputSemesterLabel
    .replace(
      /\s+/g,
      ""
    )
    .toLowerCase();

const duplicateLabel =
  normalizedSemesters.some(
    (
      semester:
        any
    ) =>
      String(
        semester
          .semesterLabel ||
        ""
      )
        .replace(
          /\s+/g,
          ""
        )
        .toLowerCase() ===
      normalizedSemesterLabel
  );

    if (
  duplicateLabel
) {
  throw new Error(
    `${normalizedInputSemesterLabel}는 이미 등록되어 있습니다.`
  );
}

    const plannedMonth =
      normalizeSemesterPlannedMonth(
        safeInput.plannedMonth
      );

    const plannedInstitution =
      normalizeNullableText(
        safeInput.plannedInstitution,
        255
      );

    const plannedSubjectCount =
  normalizeNullableNonNegativeInteger(
    safeInput.plannedSubjectCount,
    "예정 과목 수"
  );

if (
  plannedSubjectCount !==
    null &&
  plannedSubjectCount >
    50
) {
  throw new Error(
    "예정 과목 수는 50개를 초과할 수 없습니다."
  );
}

    const plannedAmount =
  normalizeNullableNonNegativeAmount(
    safeInput.plannedAmount,
    "예정 결제금액"
  );

    const startDate =
      normalizeSemesterDate(
        safeInput.startDate
      );

    const institution =
      normalizeNullableText(
        safeInput.institution,
        255
      );

    const subjectCount =
  normalizeNullableNonNegativeInteger(
    safeInput.subjectCount,
    "실제 과목 수"
  );

if (
  subjectCount !==
    null &&
  subjectCount >
    50
) {
  throw new Error(
    "실제 과목 수는 50개를 초과할 수 없습니다."
  );
}

    const paymentAmount =
  normalizeNullableNonNegativeAmount(
    safeInput.paymentAmount,
    "실제 결제금액"
  );

    const paymentDate =
      normalizeSemesterDate(
        safeInput.paymentDate
      );

    const studentName =
      normalizeNullableText(
        (
          student as
            any
        ).clientName,
        100
      );

    const assigneeId =
      normalizePositiveInteger(
        (
          student as
            any
        ).assigneeId
      );

    if (
      assigneeId <=
      0
    ) {
      throw new Error(
        "학생 담당자 정보가 없어 학기 생성 초안을 만들 수 없습니다."
      );
    }

    const createdAt =
      new Date()
        .toISOString();

    const warnings:
  string[] =
  [];

const missingFields:
  string[] =
  [];

const blockingReasons:
  string[] =
  [];

/**
 * 학기 생성에 필요한 예정정보는
 * 승인 전에 반드시 입력하도록 한다.
 */
if (
  !plannedMonth
) {
  missingFields.push(
    "예정 개강월"
  );

  warnings.push(
    "예정 개강월이 입력되지 않았습니다."
  );
}

if (
  !plannedInstitution
) {
  missingFields.push(
    "예정 교육원"
  );

  warnings.push(
    "예정 교육원이 입력되지 않았습니다."
  );
}

if (
  plannedSubjectCount ===
  null
) {
  missingFields.push(
    "예정 과목 수"
  );

  warnings.push(
    "예정 과목 수가 입력되지 않았습니다."
  );
}

/**
 * 학기 귀속과 예정 개강월의 호환성을 검사한다.
 *
 * 학기 귀속연도와 실제 개강연도가
 * 다를 수 있으므로 단순 연도 일치 검사는 하지 않는다.
 *
 * 예:
 * 2027년 1학기
 * + 2026년 12월 개강
 * → 정상
 */
if (
  plannedMonth &&
  !isPlannedMonthCompatibleWithSemesterLabel(
    normalizedInputSemesterLabel,
    plannedMonth
  )
) {
  const mismatchMessage =
    `${normalizedInputSemesterLabel} 귀속과 예정 개강월 ${plannedMonth}의 학기 구성이 맞지 않습니다. 실제 교육원 개강일과 귀속학기를 확인해주세요.`;

  warnings.push(
    mismatchMessage
  );

  blockingReasons.push(
    mismatchMessage
  );
}

/**
 * 학점은행제 한 학기 최대 수강 과목을
 * 8과목으로 제한한다.
 */
if (
  plannedSubjectCount !==
    null &&
  plannedSubjectCount >
    8
) {
  const semesterLimitMessage =
    `한 학기에는 최대 8과목까지만 등록할 수 있습니다. 현재 ${plannedSubjectCount}과목입니다.`;

  warnings.push(
    semesterLimitMessage
  );

  blockingReasons.push(
    semesterLimitMessage
  );
}

/**
 * 기존 동일 연도 학기의 과목 수를 합산한다.
 *
 * 실제 과목 수가 있으면 실제 과목 수를 사용하고,
 * 없으면 예정 과목 수를 사용한다.
 */
const sameYearExistingSubjectCount =
  normalizedSemesters
    .filter(
      (
        semester:
          any
      ) => {
        const label =
          String(
            semester
              ?.semesterLabel ||
            ""
          ).trim();

        const matched =
          label.match(
            /^(\d{4})년\s*([12])학기$/
          );

        return (
          matched !==
            null &&
          Number(
            matched[1]
          ) ===
            semesterLabelYear
        );
      }
    )
    .reduce(
      (
        total:
          number,
        semester:
          any
      ) => {
        const actualCount =
          semester
            ?.actualSubjectCount;

        const plannedCount =
          semester
            ?.plannedSubjectCount;

        const resolvedCount =
          actualCount !==
            null &&
          actualCount !==
            undefined
            ? Number(
                actualCount
              )
            : plannedCount !==
                null &&
              plannedCount !==
                undefined
              ? Number(
                  plannedCount
                )
              : 0;

        return total +
          (
            Number.isFinite(
              resolvedCount
            ) &&
            resolvedCount >
              0
              ? Math.floor(
                  resolvedCount
                )
              : 0
          );
      },
      0
    );

const nextAnnualSubjectCount =
  sameYearExistingSubjectCount +
  (
    plannedSubjectCount ??
    0
  );

/**
 * 연간 최대 수강 과목 수는 14과목이다.
 */
if (
  plannedSubjectCount !==
    null &&
  nextAnnualSubjectCount >
    14
) {
  const annualLimitMessage =
    `${semesterLabelYear}년 기존 ${sameYearExistingSubjectCount}과목에 이번 ${plannedSubjectCount}과목을 추가하면 연간 총 ${nextAnnualSubjectCount}과목으로 14과목 제한을 초과합니다.`;

  warnings.push(
    annualLimitMessage
  );

  blockingReasons.push(
    annualLimitMessage
  );
}

    const previewItems:
  string[] = [
    `학생 번호 · ${studentId}`,
    `학생명 · ${studentName || "확인 필요"}`,
    `학기 순서 · ${semesterOrder}학기${
      requestedSemesterOrder === null
        ? " (자동 계산)"
        : ""
    }`,
    `학기 구분 · ${normalizedInputSemesterLabel}${
      automaticallyCalculatedSemesterLabel &&
      !requestedSemesterLabel
        ? " (자동 계산)"
        : ""
    }`,
        `예정 개강월 · ${plannedMonth || "미입력"}`,
        `예정 교육원 · ${plannedInstitution || "미입력"}`,
        `예정 과목 수 · ${
  plannedSubjectCount === null
    ? "미입력"
    : `${plannedSubjectCount}과목`
}`,

`연간 예정 과목 수 · ${
  plannedSubjectCount === null
    ? "계산 불가"
    : `${nextAnnualSubjectCount}과목`
}`,

`예정 결제금액 · ${
          plannedAmount === null
            ? "미입력"
            : `${plannedAmount.toLocaleString("ko-KR")}원`
        }`,
      ];

    if (
      startDate
    ) {
      previewItems.push(
        `실제 개강일 · ${startDate}`
      );
    }

    if (
      institution
    ) {
      previewItems.push(
        `실제 교육원 · ${institution}`
      );
    }

    if (
      subjectCount !==
      null
    ) {
      previewItems.push(
        `실제 과목 수 · ${subjectCount}과목`
      );
    }

    if (
      paymentAmount !==
      null
    ) {
      previewItems.push(
        `실제 결제금액 · ${paymentAmount.toLocaleString("ko-KR")}원`
      );
    }

    if (
      paymentDate
    ) {
      previewItems.push(
        `결제일 · ${paymentDate}`
      );
    }

    return {
      pendingActionRequired:
        true,

      studentId,

            studentName,

      semesterOrder,

      semesterLabel:
        normalizedInputSemesterLabel,

      draft: {
        studentId,

        studentName,

                assigneeId,

        semesterOrder,

        semesterLabel:
          normalizedInputSemesterLabel,

        plannedMonth,

        plannedInstitution,

        plannedSubjectCount,

        plannedAmount,

        startDate,

        institution,

        subjectCount,

        paymentAmount,

                paymentDate,

        originalLastSemesterOrder,

        originalLastSemesterLabel:
          lastSemesterLabel,

        requestedByUserId:
          context.userId,

        requestedByRole:
          context.role,

        createdAt,
      },

      preview: {
        title:
          "학생 학기 생성",

        summary:
  `${
    studentName ||
    `학생 #${studentId}`
  }에게 ${semesterOrder}학기 (${normalizedInputSemesterLabel})를 추가합니다.`,

        sections: [
          {
            title:
  "학기 생성 내용",

            items:
              previewItems,
          },
        ],

        changes:
          [],

        executionSteps: [
  "현재 학생 정보와 조직 범위를 다시 확인합니다.",
  "현재 로그인 사용자가 학생을 수정할 수 있는 담당자인지 다시 확인합니다.",
  "기존 마지막 학기 기준으로 다음 학기 순서와 학기 구분을 다시 계산합니다.",
  "초안 생성 이후 다른 학기가 추가되지 않았는지 다시 확인합니다.",
  "동일한 학기 순서와 학기 구분이 존재하지 않는지 다시 확인합니다.",
  "한 학기 8과목 및 연간 14과목 제한을 다시 확인합니다.",
  "학기 귀속과 예정 개강월이 학점은행제 학기 구조상 호환되는지 확인합니다.",
  "승인된 내용으로 학생 학기를 생성합니다.",
  "예정 과목 수만큼 우리플랜 과목 자리를 생성합니다.",
  "학기 생성 결과와 변경 내역을 기록합니다.",
],

        missingFields,

warnings,

canConfirm:
  missingFields.length ===
    0 &&
  blockingReasons.length ===
    0,
      },
    };
  },
});

/**
 * 기존 학생 학기 입력완료 승인 초안
 *
 * 이 Tool은 semesters 테이블을 직접 수정하지 않는다.
 * 학생, 학기, 플랜요약, 실제 등록정보와
 * 우리플랜 과목 수를 확인한 뒤
 * Pending Action 생성에 사용할 초안만 반환한다.
 */
registerTool<
  SemesterCompleteToolInput,
  SemesterCompleteToolOutput
>({
  name:
    "semester.complete",

  description:
    "현재 사용자가 접근 가능한 학생의 특정 학기를 입력완료 처리하여 승인관리로 넘기기 위한 승인 초안을 생성합니다. 실제 학기 변경은 사용자의 최종 승인 후 실행합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "입력완료 처리할 확정된 학생 ID",

        minimum:
          1,
      },

      semesterOrder: {
        type:
          "integer",

        description:
          "입력완료 처리할 학기 순서. 예: 1학기는 1, 2학기는 2",

        minimum:
          1,

        maximum:
          20,
      },
    },

    required: [
      "studentId",
      "semesterOrder",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as SemesterCompleteToolInput;

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (
      studentId <=
      0
    ) {
      throw new Error(
        "입력완료 처리할 학생 ID가 필요합니다."
      );
    }

    const semesterOrder =
      normalizePositiveInteger(
        safeInput.semesterOrder
      );

    if (
      semesterOrder <=
      0
    ) {
      throw new Error(
        "입력완료 처리할 학기 순서가 필요합니다."
      );
    }

    if (
      semesterOrder >
      20
    ) {
      throw new Error(
        "학기 순서는 20을 초과할 수 없습니다."
      );
    }

    /**
     * 학생 조회 및 조직 범위 검사
     */
    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (
      !student
    ) {
      throw new Error(
        "입력완료 처리할 학생 정보를 찾을 수 없습니다."
      );
    }

    /**
     * 초안 단계에서는 현재 사용자가
     * 학생을 조회할 수 있는 범위인지 검사한다.
     *
     * 실제 실행 단계에서는 담당자 쓰기 권한을
     * Executor에서 다시 검사한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    const studentName =
      normalizeNullableText(
        (
          student as
            any
        ).clientName,
        100
      );

    const assigneeId =
      normalizePositiveInteger(
        (
          student as
            any
        ).assigneeId
      );

    if (
      assigneeId <=
      0
    ) {
      throw new Error(
        "학생 담당자 정보가 없어 입력완료 초안을 만들 수 없습니다."
      );
    }

    /**
     * 대상 학생의 학기 조회
     */
    const semesterRows =
      await db.listSemesters(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    const semester =
      (
        Array.isArray(
          semesterRows
        )
          ? semesterRows
          : []
      ).find(
        (
          row:
            any
        ) =>
          Number(
            row
              ?.semesterOrder ||
            0
          ) ===
          semesterOrder
      );

    if (
      !semester
    ) {
      throw new Error(
        `${semesterOrder}학기 정보를 찾을 수 없습니다.`
      );
    }

    const semesterId =
      normalizePositiveInteger(
        (
          semester as
            any
        ).id
      );

    if (
      semesterId <=
      0
    ) {
      throw new Error(
        "대상 학기 ID가 올바르지 않습니다."
      );
    }

    if (
      Number(
        (
          semester as
            any
        ).studentId ||
        0
      ) !==
      studentId
    ) {
      throw new Error(
        "대상 학기가 선택한 학생에게 속하지 않습니다."
      );
    }

    const semesterLabel =
      normalizeNullableText(
        (
          semester as
            any
        ).semesterLabel,
        100
      );

    const isCompleted =
      (
        semester as
          any
      ).isCompleted ===
        true ||
      Number(
        (
          semester as
            any
        ).isCompleted ||
        0
      ) ===
        1;

    const approvalStatus =
      normalizeNullableText(
        (
          semester as
            any
        ).approvalStatus,
        100
      ) ||
      "요청전";

    if (
      approvalStatus ===
      "대기"
    ) {
      throw new Error(
        "해당 학기는 이미 입력완료 처리되어 승인 대기 중입니다."
      );
    }

    if (
      approvalStatus ===
      "승인"
    ) {
      throw new Error(
        "해당 학기는 이미 승인 완료되었습니다."
      );
    }

    /**
     * 불승인 상태는 학기정보를 수정한 뒤
     * 다시 승인 요청할 수 있도록 허용한다.
     *
     * isCompleted가 true여도 불승인인 경우에는
     * 다시 대기 상태로 요청할 수 있다.
     */
    if (
      isCompleted &&
      approvalStatus !==
        "불승인"
    ) {
      throw new Error(
        "해당 학기는 이미 입력완료 처리되었습니다."
      );
    }

    /**
     * 학생 플랜요약 조회
     */
    const plan =
      await db.getPlan(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    /**
     * 해당 학생의 전체 우리플랜 과목 조회 후
     * 대상 학기의 과목만 추출한다.
     */
    const allPlanSubjects =
      await db.listPlanSemesters(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    const semesterPlanSubjects =
      (
        Array.isArray(
          allPlanSubjects
        )
          ? allPlanSubjects
          : []
      ).filter(
        (
          row:
            any
        ) =>
          Number(
            row
              ?.semesterNo ||
            0
          ) ===
          semesterOrder
      );

    const missingFields:
      string[] =
      [];

    const warnings:
      string[] =
      [];

    const blockingReasons:
      string[] =
      [];

    /**
     * 플랜요약 필수정보 검사
     */
    const desiredCourse =
      normalizeNullableText(
        (
          plan as
            any
        )?.desiredCourse,
        255
      );

    const finalEducation =
      normalizeNullableText(
        (
          plan as
            any
        )?.finalEducation,
        255
      );

    const totalTheorySubjects =
      normalizePositiveInteger(
        (
          plan as
            any
        )?.totalTheorySubjects
      );

    const rawHasPractice =
      (
        plan as
          any
      )?.hasPractice;

    const hasPracticeSelection =
      rawHasPractice ===
        true ||
      rawHasPractice ===
        false ||
      rawHasPractice ===
        1 ||
      rawHasPractice ===
        0 ||
      rawHasPractice ===
        "1" ||
      rawHasPractice ===
        "0" ||
      rawHasPractice ===
        "true" ||
      rawHasPractice ===
        "false";

    if (
      !plan
    ) {
      missingFields.push(
        "플랜요약"
      );

      blockingReasons.push(
        "학생 플랜요약이 등록되지 않았습니다."
      );
    }

    if (
      !desiredCourse
    ) {
      missingFields.push(
        "희망과정"
      );
    }

    if (
      !finalEducation
    ) {
      missingFields.push(
        "최종학력"
      );
    }

    if (
      totalTheorySubjects <=
      0
    ) {
      missingFields.push(
        "총 이론 과목 수"
      );
    }

    if (
      !hasPracticeSelection
    ) {
      missingFields.push(
        "실습 필요 여부"
      );
    }

    /**
     * 실제 학기정보 정규화
     */
    const actualStartDate =
      normalizeSemesterDate(
        (
          semester as
            any
        ).actualStartDate
      );

    const actualInstitution =
  normalizeNullableText(
    (
      semester as
        any
    ).actualInstitution,
    255
  );

    const actualInstitutionId =
      normalizePositiveInteger(
        (
          semester as
            any
        ).actualInstitutionId
      ) ||
      null;

    const actualSubjectCount =
      normalizeNullableNonNegativeInteger(
        (
          semester as
            any
        ).actualSubjectCount,
        "실제 과목 수"
      );

    const actualAmount =
      normalizeNullableNonNegativeAmount(
        (
          semester as
            any
        ).actualAmount,
        "실제 결제금액"
      );

    const actualPaymentDate =
      normalizeSemesterDate(
        (
          semester as
            any
        ).actualPaymentDate
      );

    if (
      !semesterLabel
    ) {
      missingFields.push(
        "학기구분"
      );
    }

    if (
      !actualStartDate
    ) {
      missingFields.push(
        "실제 개강일"
      );
    }

    if (
      !actualInstitution &&
      !actualInstitutionId
    ) {
      missingFields.push(
        "실제 교육원"
      );
    }

    if (
      actualSubjectCount ===
        null ||
      actualSubjectCount <=
        0
    ) {
      missingFields.push(
        "실제 과목 수"
      );
    }

    if (
      actualAmount ===
        null ||
      actualAmount <=
        0
    ) {
      missingFields.push(
        "실제 결제금액"
      );
    }

    if (
      !actualPaymentDate
    ) {
      missingFields.push(
        "실제 결제일"
      );
    }

    const planSubjectCount =
      semesterPlanSubjects.length;

    if (
      planSubjectCount <=
      0
    ) {
      missingFields.push(
        `${semesterOrder}학기 우리플랜 과목`
      );
    }

    if (
      actualSubjectCount !==
        null &&
      actualSubjectCount >
        0 &&
      planSubjectCount >
        0 &&
      actualSubjectCount !==
        planSubjectCount
    ) {
      const countMismatchMessage =
        `실제 과목 수는 ${actualSubjectCount}개이지만 ${semesterOrder}학기 우리플랜 과목은 ${planSubjectCount}개입니다.`;

      warnings.push(
        countMismatchMessage
      );

      blockingReasons.push(
        countMismatchMessage
      );
    }

    /**
     * 과목명 누락 검사
     */
    const invalidPlanSubjects =
      semesterPlanSubjects.filter(
        (
          row:
            any
        ) =>
          !String(
            row
              ?.subjectName ||
            ""
          ).trim()
      );

    if (
      invalidPlanSubjects.length >
      0
    ) {
      const invalidSubjectMessage =
        `${semesterOrder}학기 우리플랜에 과목명이 없는 항목 ${invalidPlanSubjects.length}개가 있습니다.`;

      warnings.push(
        invalidSubjectMessage
      );

      blockingReasons.push(
        invalidSubjectMessage
      );
    }

    /**
     * 승인 가능한 상태는 요청전 또는 불승인이다.
     */
    if (
      approvalStatus !==
        "요청전" &&
      approvalStatus !==
        "불승인"
    ) {
      const invalidApprovalStatusMessage =
        `현재 승인상태(${approvalStatus})에서는 입력완료 요청을 만들 수 없습니다.`;

      warnings.push(
        invalidApprovalStatusMessage
      );

      blockingReasons.push(
        invalidApprovalStatusMessage
      );
    }

    /**
     * missingFields 중복 제거
     */
    const uniqueMissingFields =
      Array.from(
        new Set(
          missingFields
        )
      );

    if (
      uniqueMissingFields.length >
      0
    ) {
      warnings.push(
        `입력완료 처리 전에 필수정보 ${uniqueMissingFields.length}개를 보완해야 합니다.`
      );
    }

    const canConfirm =
      uniqueMissingFields.length ===
        0 &&
      blockingReasons.length ===
        0;

    const createdAt =
      new Date()
        .toISOString();

    const resolvedActualInstitution =
      actualInstitution ||
      (
        actualInstitutionId
          ? `교육원 ID ${actualInstitutionId}`
          : ""
      );

    return {
      pendingActionRequired:
        true,

      studentId,

      studentName,

      semesterId,

      semesterOrder,

      semesterLabel,

      draft: {
        studentId,

        studentName,

        assigneeId,

        semesterId,

        semesterOrder,

        semesterLabel,

        actualSubjectCount:
          actualSubjectCount ||
          0,

        planSubjectCount,

        actualStartDate:
          actualStartDate ||
          "",

        actualInstitution:
          resolvedActualInstitution,

        actualAmount:
          actualAmount ||
          0,

        actualPaymentDate:
          actualPaymentDate ||
          "",

        updates: {
          isCompleted:
            true,

          approvalStatus:
            "대기",
        },

        originalValues: {
          updatedAt:
            (
              semester as
                any
            ).updatedAt ||
            null,

          isCompleted,

          approvalStatus,

          semesterLabel,

          actualStartDate:
            (
              semester as
                any
            ).actualStartDate ||
            null,

          actualInstitution:
            (
              semester as
                any
            ).actualInstitution ||
            null,

          actualInstitutionId,

          actualSubjectCount:
            (
              semester as
                any
            ).actualSubjectCount ??
            null,

          actualAmount:
            (
              semester as
                any
            ).actualAmount ??
            null,

          actualPaymentDate:
            (
              semester as
                any
            ).actualPaymentDate ||
            null,
        },

        requestedByUserId:
          context.userId,

        requestedByRole:
          context.role,

        createdAt,
      },

      preview: {
        title:
          `${semesterOrder}학기 입력완료 요청`,

        summary:
          `${
            studentName ||
            `학생 #${studentId}`
          }의 ${semesterOrder}학기 등록정보를 입력완료 처리하고 승인관리로 이동합니다.`,

        sections: [
          {
            label:
              "대상 학생",

            items: [
              `학생 번호 · ${studentId}`,
              `학생명 · ${studentName || "확인 필요"}`,
              `담당자 번호 · ${assigneeId}`,
            ],
          },

          {
            label:
              "대상 학기",

            items: [
              `학기 순서 · ${semesterOrder}학기`,
              `학기구분 · ${semesterLabel || "확인 필요"}`,
              `현재 승인상태 · ${approvalStatus}`,
              `현재 입력완료 · ${isCompleted ? "완료" : "미완료"}`,
            ],
          },

          {
            label:
              "실제 등록정보",

            items: [
              `실제 개강일 · ${actualStartDate || "확인 필요"}`,
              `실제 교육원 · ${resolvedActualInstitution || "확인 필요"}`,
              `실제 과목 수 · ${
                actualSubjectCount !==
                  null
                  ? `${actualSubjectCount}개`
                  : "확인 필요"
              }`,
              `실제 결제금액 · ${
                actualAmount !==
                  null
                  ? `${actualAmount.toLocaleString()}원`
                  : "확인 필요"
              }`,
              `실제 결제일 · ${actualPaymentDate || "확인 필요"}`,
            ],
          },

          {
            label:
              "플랜 확인",

            items: [
              `희망과정 · ${desiredCourse || "확인 필요"}`,
              `최종학력 · ${finalEducation || "확인 필요"}`,
              `총 이론 과목 수 · ${
                totalTheorySubjects >
                  0
                  ? `${totalTheorySubjects}개`
                  : "확인 필요"
              }`,
              `실습 필요 여부 · ${
                hasPracticeSelection
                  ? (
                      rawHasPractice ===
                        true ||
                      rawHasPractice ===
                        1 ||
                      rawHasPractice ===
                        "1" ||
                      rawHasPractice ===
                        "true"
                        ? "필요"
                        : "불필요"
                    )
                  : "확인 필요"
              }`,
              `${semesterOrder}학기 우리플랜 과목 · ${planSubjectCount}개`,
            ],
          },

          {
            label:
              "처리 결과",

            items: [
              "입력완료 · 미완료 → 완료",
              `승인상태 · ${approvalStatus} → 대기`,
              "승인관리 목록에 노출됩니다.",
            ],
          },
        ],

        changes: [
          {
            label:
              "입력완료",

            before:
              isCompleted,

            after:
              true,
          },

          {
            label:
              "승인상태",

            before:
              approvalStatus,

            after:
              "대기",
          },
        ],

        executionSteps: [
          "학생과 학기의 조직 소속을 다시 확인합니다.",
          "현재 로그인 사용자가 학생 담당자 또는 허용된 쓰기 권한자인지 다시 확인합니다.",
          "학기 원본값이 초안 생성 이후 변경되지 않았는지 확인합니다.",
          "플랜요약과 실제 등록정보의 필수값을 다시 확인합니다.",
          "실제 과목 수와 우리플랜 과목 수를 다시 비교합니다.",
          "학기의 입력완료를 완료로 변경합니다.",
          "학기 승인상태를 대기로 변경하여 승인관리로 이동합니다.",
          "AI 실행 결과와 변경 내역을 기록합니다.",
        ],

        missingFields:
          uniqueMissingFields,

        warnings: [
          ...warnings,
          ...blockingReasons.filter(
            (
              message
            ) =>
              !warnings.includes(
                message
              )
          ),
        ],

        canConfirm,
      },
    };
  },
});

/**
 * 학생 플랜 요약 생성 승인 초안
 *
 * 이 Tool은 plans 테이블을 직접 생성하지 않는다.
 * 학생과 기존 플랜 존재 여부를 확인한 뒤
 * Pending Action 생성에 사용할 초안만 반환한다.
 */
registerTool<
  PlanCreateToolInput,
  PlanCreateToolOutput
>({
  name:
    "plan.create",

  description:
    "현재 사용자가 접근 가능한 기존 학생에게 새 플랜 요약을 생성하기 위한 승인 초안을 만듭니다. 기존 플랜이 이미 존재하는 경우 새 플랜 생성은 차단합니다. 실제 등록은 사용자의 최종 승인 후 실행합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "플랜을 생성할 확정된 학생 ID",

        minimum:
          1,
      },

      desiredCourse: {
        type: [
          "string",
          "null",
        ],

        description:
          "희망 과정. 사용자가 명확하게 말하지 않았다면 전달하지 않습니다.",
      },

            finalEducation: {
        type: [
          "string",
          "null",
        ],

        description:
          "최종학력. 사용자가 명확하게 말하지 않았다면 전달하지 않습니다.",
      },

      hasPractice: {
        type: [
          "boolean",
          "null",
        ],

        description:
          "실습 필요 여부입니다. 실습이 필요한 과정이면 true, 필요하지 않으면 false입니다. 명확하게 확인되지 않았다면 전달하지 않습니다.",
      },

      totalTheorySubjects: {
        type: [
          "integer",
          "null",
        ],

        description:
          "전체 이론 과목 수",

        minimum:
          0,
      },

      requiredMajorCount: {
        type: [
          "integer",
          "null",
        ],

        description:
          "전공필수 과목 수",

        minimum:
          0,
      },

      electiveMajorCount: {
        type: [
          "integer",
          "null",
        ],

        description:
          "전공선택 과목 수",

        minimum:
          0,
      },

      liberalCount: {
        type: [
          "integer",
          "null",
        ],

        description:
          "교양 과목 수",

        minimum:
          0,
      },

      generalCount: {
        type: [
          "integer",
          "null",
        ],

        description:
          "일반 과목 수",

        minimum:
          0,
      },
    },

    required: [
      "studentId",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  /**
   * 실제 plans 테이블 생성은
   * Pending Action 승인 후 Executor에서 실행한다.
   */
  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as PlanCreateToolInput;

    if (
      context.canWrite !==
      true
    ) {
      throw new Error(
        "현재 계정은 플랜 생성 초안을 만들 수 없습니다."
      );
    }

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (
      studentId <=
      0
    ) {
      throw new Error(
        "플랜을 생성할 학생 ID가 필요합니다."
      );
    }

    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (
      !student
    ) {
      throw new Error(
        "플랜을 생성할 학생 정보를 찾을 수 없습니다."
      );
    }

    /**
     * 초안에서는 현재 사용자 조회 범위를 확인한다.
     *
     * 실제 승인 단계에서는 Executor에서
     * 담당자 쓰기 권한을 다시 검사한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    const assigneeId =
      normalizePositiveInteger(
        (student as any)
          .assigneeId
      );

    if (
      assigneeId <=
      0
    ) {
      throw new Error(
        "학생 담당자 정보가 없어 플랜 생성 초안을 만들 수 없습니다."
      );
    }

    /**
     * 신규 생성 Tool이므로 기존 플랜이 있으면 차단한다.
     *
     * 기존 플랜 수정은 추후 plan.update Tool에서 처리한다.
     */
    const existingPlan =
      await db.getPlan(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (
      existingPlan
    ) {
      throw new Error(
        "이미 등록된 플랜이 있습니다. 기존 플랜은 신규 생성이 아니라 수정 기능을 사용해주세요."
      );
    }

    const studentName =
      normalizeNullableText(
        (student as any)
          .clientName,
        100
      );

    /**
     * 사용자가 입력하지 않은 경우
     * 학생 원본에 저장된 과정/최종학력을 우선 사용한다.
     *
     * 학생 원본에도 없다면 null로 유지한다.
     */
    const desiredCourse =
      safeInput.desiredCourse !==
      undefined
        ? normalizeNullableText(
            safeInput.desiredCourse,
            255
          )
        : normalizeNullableText(
            (student as any)
              .course,
            255
          );

const registrationSummary =
  await db.getStudentRegistrationSummary(
    studentId,
    {
      organizationId:
        context.organizationId,
    }
  );

   const finalEducation =
  safeInput.finalEducation !==
  undefined
    ? normalizeNullableText(
        safeInput.finalEducation,
        255
      )
    : normalizeNullableText(
        registrationSummary
          ?.finalEducation,
        255
      );

    const hasPractice =
      safeInput.hasPractice ===
        true
        ? true
        : safeInput.hasPractice ===
          false
          ? false
          : null;

    const totalTheorySubjects =
      normalizeNullableNonNegativeInteger(
        safeInput.totalTheorySubjects,
        "전체 이론 과목 수"
      );

    const requiredMajorCount =
      normalizeNullableNonNegativeInteger(
        safeInput.requiredMajorCount,
        "전공필수 과목 수"
      );

    const electiveMajorCount =
      normalizeNullableNonNegativeInteger(
        safeInput.electiveMajorCount,
        "전공선택 과목 수"
      );

    const liberalCount =
      normalizeNullableNonNegativeInteger(
        safeInput.liberalCount,
        "교양 과목 수"
      );

    const generalCount =
      normalizeNullableNonNegativeInteger(
        safeInput.generalCount,
        "일반 과목 수"
      );

    const missingFields:
      string[] =
      [];

        const warnings:
      string[] =
      [];

    if (
      hasPractice ===
      null
    ) {
      missingFields.push(
        "hasPractice"
      );
    }

    if (
      totalTheorySubjects ===
      null
    ) {
      missingFields.push(
        "totalTheorySubjects"
      );
    }

    if (
      requiredMajorCount ===
      null
    ) {
      missingFields.push(
        "requiredMajorCount"
      );
    }

    if (
      electiveMajorCount ===
      null
    ) {
      missingFields.push(
        "electiveMajorCount"
      );
    }

    if (
      liberalCount ===
      null
    ) {
      missingFields.push(
        "liberalCount"
      );
    }

    if (
      generalCount ===
      null
    ) {
      missingFields.push(
        "generalCount"
      );
    }

    /**
     * 숫자가 전부 입력된 경우 분류 합계를 검증한다.
     *
     * DB에서도 다시 검사하지만
     * 승인 초안 단계에서 먼저 사용자에게 알려준다.
     */
    if (
      totalTheorySubjects !==
        null &&
      requiredMajorCount !==
        null &&
      electiveMajorCount !==
        null &&
      liberalCount !==
        null &&
      generalCount !==
        null
    ) {
      const categoryTotal =
        requiredMajorCount +
        electiveMajorCount +
        liberalCount +
        generalCount;

      if (
        categoryTotal !==
        totalTheorySubjects
      ) {
        throw new Error(
          `전체 이론 과목 수(${totalTheorySubjects})와 전공필수·전공선택·교양·일반 합계(${categoryTotal})가 일치하지 않습니다.`
        );
      }
    }

    if (
      !desiredCourse
    ) {
      warnings.push(
        "희망 과정이 입력되어 있지 않습니다."
      );
    }

    if (
      !finalEducation
    ) {
      warnings.push(
        "최종학력이 입력되어 있지 않습니다."
      );
    }

    const normalizedTotalTheorySubjects =
      totalTheorySubjects ??
      0;

    const normalizedRequiredMajorCount =
      requiredMajorCount ??
      0;

    const normalizedElectiveMajorCount =
      electiveMajorCount ??
      0;

    const normalizedLiberalCount =
      liberalCount ??
      0;

    const normalizedGeneralCount =
      generalCount ??
      0;

    const canConfirm =
      missingFields.length ===
      0;

    const draft = {
      studentId,

      studentName,

      assigneeId,

      desiredCourse,

           finalEducation,

      hasPractice:
        hasPractice ===
        true,

      totalTheorySubjects:
        normalizedTotalTheorySubjects,

      requiredMajorCount:
        normalizedRequiredMajorCount,

      electiveMajorCount:
        normalizedElectiveMajorCount,

      liberalCount:
        normalizedLiberalCount,

      generalCount:
        normalizedGeneralCount,

      originalPlanExists:
        false as const,

      requestedByUserId:
        context.userId,

      requestedByRole:
        context.role,

      createdAt:
        new Date()
          .toISOString(),
    };

    return {
      pendingActionRequired:
        true as const,

      studentId,

      studentName,

      draft,

      preview: {
        title:
          "학생 플랜 생성",

        summary:
          `${studentName || `학생 ${studentId}`}님의 플랜 요약을 생성합니다.`,

        sections: [
          {
            label:
              "대상 학생",

            items: [
              `학생명: ${studentName || "-"}`,
              `학생 ID: ${studentId}`,
                            `희망 과정: ${desiredCourse || "-"}`,
              `최종학력: ${finalEducation || "-"}`,
              `실습 필요 여부: ${
                hasPractice === null
                  ? "확인 필요"
                  : hasPractice
                    ? "필요"
                    : "불필요"
              }`,
            ],
          },

          {
            label:
              "플랜 과목 구성",

            items: [
              `전체 이론 과목: ${normalizedTotalTheorySubjects}개`,
              `전공필수: ${normalizedRequiredMajorCount}개`,
              `전공선택: ${normalizedElectiveMajorCount}개`,
              `교양: ${normalizedLiberalCount}개`,
              `일반: ${normalizedGeneralCount}개`,
            ],
          },
        ],

        changes: [
          {
            label:
              "전체 이론 과목 수",

            before:
              null,

            after:
              normalizedTotalTheorySubjects,
          },

          {
            label:
              "전공필수",

            before:
              null,

            after:
              normalizedRequiredMajorCount,
          },

          {
            label:
              "전공선택",

            before:
              null,

            after:
              normalizedElectiveMajorCount,
          },

          {
            label:
              "교양",

            before:
              null,

            after:
              normalizedLiberalCount,
          },

          {
            label:
              "일반",

            before:
              null,

            after:
              normalizedGeneralCount,
          },
        ],

        executionSteps: [
          "승인 요청의 회사와 요청자를 다시 확인합니다.",
          "학생과 현재 담당자를 다시 확인합니다.",
          "기존 플랜이 새로 생성되지 않았는지 다시 확인합니다.",
          "플랜 과목 수와 분류 합계를 다시 검증합니다.",
          "plans 테이블에 학생 플랜을 생성합니다.",
          "AI 실행 이력을 기록합니다.",
        ],

        missingFields,

        warnings,

        canConfirm,
      },
    };
  },
});

/**
 * 학생 플랜 요약 수정 승인 초안
 *
 * 이 Tool은 plans 테이블을 직접 수정하지 않는다.
 *
 * 현재 학생과 기존 플랜을 조회한 뒤
 * 사용자가 명확하게 요청한 플랜 요약 변경값만 비교하여
 * Pending Action 생성에 사용할 수정 초안을 반환한다.
 */
registerTool<
  PlanUpdateToolInput,
  PlanUpdateToolOutput
>({
  name:
    "plan.update",

  description:
    "현재 사용자가 접근 가능한 기존 학생 플랜의 희망과정, 최종학력, 실습 필요 여부, 전체 이론 과목 수, 전공필수·전공선택·교양·일반 과목 수를 수정하기 위한 승인 초안을 생성합니다. 실제 수정은 사용자의 최종 승인 후 실행합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "플랜을 수정할 확정된 학생 ID",

        minimum:
          1,
      },

      desiredCourse: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 희망 과정. 사용자가 희망 과정 변경을 요청하지 않았다면 전달하지 않습니다.",
      },

      finalEducation: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 최종학력. 사용자가 최종학력 변경을 요청하지 않았다면 전달하지 않습니다.",
      },

      hasPractice: {
        type:
          "boolean",

        description:
          "변경할 실습 필요 여부. 사용자가 실습 필요 여부 변경을 요청하지 않았다면 전달하지 않습니다.",
      },

      totalTheorySubjects: {
        type:
          "integer",

        description:
          "변경할 전체 이론 과목 수",

        minimum:
          0,
      },

      requiredMajorCount: {
        type:
          "integer",

        description:
          "변경할 전공필수 과목 수",

        minimum:
          0,
      },

      electiveMajorCount: {
        type:
          "integer",

        description:
          "변경할 전공선택 과목 수",

        minimum:
          0,
      },

      liberalCount: {
        type:
          "integer",

        description:
          "변경할 교양 과목 수",

        minimum:
          0,
      },

      generalCount: {
        type:
          "integer",

        description:
          "변경할 일반 과목 수",

        minimum:
          0,
      },
    },

    required: [
      "studentId",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  /**
   * 실제 plans 수정은
   * Pending Action 승인 후 Executor에서 실행한다.
   */
  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as PlanUpdateToolInput;

    if (
      context.canWrite !==
      true
    ) {
      throw new Error(
        "현재 계정은 플랜 수정 초안을 만들 수 없습니다."
      );
    }

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (
      studentId <=
      0
    ) {
      throw new Error(
        "플랜을 수정할 학생 ID가 필요합니다."
      );
    }

    /**
     * 학생 현재 상태 조회
     */
    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (
      !student
    ) {
      throw new Error(
        "플랜을 수정할 학생 정보를 찾을 수 없습니다."
      );
    }

    /**
     * 초안 단계에서는 조회 가능 범위만 검사한다.
     *
     * 실제 수정 직전에는 Executor에서
     * 담당자 쓰기 권한을 다시 검사한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    const assigneeId =
      normalizePositiveInteger(
        (student as any)
          .assigneeId
      );

    if (
      assigneeId <=
      0
    ) {
      throw new Error(
        "학생 담당자 정보가 없어 플랜 수정 초안을 만들 수 없습니다."
      );
    }

    const studentName =
      normalizeNullableText(
        (student as any)
          .clientName,
        100
      );

    /**
     * plan.update는 기존 플랜 수정 전용이므로
     * 플랜이 반드시 존재해야 한다.
     */
    const existingPlan =
      await db.getPlan(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (
      !existingPlan
    ) {
      throw new Error(
        "수정할 학생 플랜이 없습니다. 먼저 플랜을 생성해주세요."
      );
    }

    const planId =
      normalizePositiveInteger(
        (existingPlan as any)
          .id
      );

    if (
      planId <=
      0
    ) {
      throw new Error(
        "수정할 학생 플랜 ID를 확인할 수 없습니다."
      );
    }

    /**
     * 최소 한 개 이상의 수정 필드가
     * 명확하게 전달되어야 한다.
     */
    const hasDesiredCourseUpdate =
      safeInput.desiredCourse !==
      undefined;

    const hasFinalEducationUpdate =
      safeInput.finalEducation !==
      undefined;

    const hasPracticeUpdate =
      safeInput.hasPractice !==
      undefined;

    const hasTotalTheoryUpdate =
      safeInput.totalTheorySubjects !==
      undefined;

    const hasRequiredMajorUpdate =
      safeInput.requiredMajorCount !==
      undefined;

    const hasElectiveMajorUpdate =
      safeInput.electiveMajorCount !==
      undefined;

    const hasLiberalUpdate =
      safeInput.liberalCount !==
      undefined;

    const hasGeneralUpdate =
      safeInput.generalCount !==
      undefined;

    if (
      !hasDesiredCourseUpdate &&
      !hasFinalEducationUpdate &&
      !hasPracticeUpdate &&
      !hasTotalTheoryUpdate &&
      !hasRequiredMajorUpdate &&
      !hasElectiveMajorUpdate &&
      !hasLiberalUpdate &&
      !hasGeneralUpdate
    ) {
      throw new Error(
        "변경할 플랜 정보가 필요합니다."
      );
    }

    /**
     * 현재 DB 원본값 정규화
     */
    const currentDesiredCourse =
      normalizeNullableText(
        (existingPlan as any)
          .desiredCourse,
        255
      );

    const currentFinalEducation =
      normalizeNullableText(
        (existingPlan as any)
          .finalEducation,
        255
      );

    const currentHasPractice =
      (existingPlan as any)
        .hasPractice ===
      true;

    const currentTotalTheorySubjects =
      Number(
        (existingPlan as any)
          .totalTheorySubjects ??
        0
      );

    const currentRequiredMajorCount =
      Number(
        (existingPlan as any)
          .requiredMajorCount ??
        0
      );

    const currentElectiveMajorCount =
      Number(
        (existingPlan as any)
          .electiveMajorCount ??
        0
      );

    const currentLiberalCount =
      Number(
        (existingPlan as any)
          .liberalCount ??
        0
      );

    const currentGeneralCount =
      Number(
        (existingPlan as any)
          .generalCount ??
        0
      );

    /**
     * 사용자가 명확하게 전달한 변경값만 정규화한다.
     */
    const nextDesiredCourse =
      hasDesiredCourseUpdate
        ? normalizeNullableText(
            safeInput.desiredCourse,
            255
          )
        : currentDesiredCourse;

    const nextFinalEducation =
      hasFinalEducationUpdate
        ? normalizeNullableText(
            safeInput.finalEducation,
            255
          )
        : currentFinalEducation;

    const nextHasPractice =
      hasPracticeUpdate
        ? safeInput.hasPractice ===
          true
        : currentHasPractice;

    const nextTotalTheorySubjects =
      hasTotalTheoryUpdate
        ? normalizeNullableNonNegativeInteger(
            safeInput.totalTheorySubjects,
            "전체 이론 과목 수"
          )
        : currentTotalTheorySubjects;

    const nextRequiredMajorCount =
      hasRequiredMajorUpdate
        ? normalizeNullableNonNegativeInteger(
            safeInput.requiredMajorCount,
            "전공필수 과목 수"
          )
        : currentRequiredMajorCount;

    const nextElectiveMajorCount =
      hasElectiveMajorUpdate
        ? normalizeNullableNonNegativeInteger(
            safeInput.electiveMajorCount,
            "전공선택 과목 수"
          )
        : currentElectiveMajorCount;

    const nextLiberalCount =
      hasLiberalUpdate
        ? normalizeNullableNonNegativeInteger(
            safeInput.liberalCount,
            "교양 과목 수"
          )
        : currentLiberalCount;

    const nextGeneralCount =
      hasGeneralUpdate
        ? normalizeNullableNonNegativeInteger(
            safeInput.generalCount,
            "일반 과목 수"
          )
        : currentGeneralCount;

    if (
      nextTotalTheorySubjects ===
        null ||
      nextRequiredMajorCount ===
        null ||
      nextElectiveMajorCount ===
        null ||
      nextLiberalCount ===
        null ||
      nextGeneralCount ===
        null
    ) {
      throw new Error(
        "플랜 과목 수 정보가 올바르지 않습니다."
      );
    }

    const updates:
      PlanUpdateToolOutput[
        "draft"
      ][
        "updates"
      ] =
      {};

    const changes:
      PlanUpdateToolOutput[
        "changes"
      ] =
      [];

    if (
      hasDesiredCourseUpdate &&
      nextDesiredCourse !==
        currentDesiredCourse
    ) {
      updates.desiredCourse =
        nextDesiredCourse;

      changes.push({
        field:
          "desiredCourse",

        label:
          "희망 과정",

        before:
          currentDesiredCourse,

        after:
          nextDesiredCourse,
      });
    }

    if (
      hasFinalEducationUpdate &&
      nextFinalEducation !==
        currentFinalEducation
    ) {
      updates.finalEducation =
        nextFinalEducation;

      changes.push({
        field:
          "finalEducation",

        label:
          "최종학력",

        before:
          currentFinalEducation,

        after:
          nextFinalEducation,
      });
    }

    if (
      hasPracticeUpdate &&
      nextHasPractice !==
        currentHasPractice
    ) {
      updates.hasPractice =
        nextHasPractice;

      changes.push({
        field:
          "hasPractice",

        label:
          "실습 필요 여부",

        before:
          currentHasPractice,

        after:
          nextHasPractice,
      });
    }

    if (
      hasTotalTheoryUpdate &&
      nextTotalTheorySubjects !==
        currentTotalTheorySubjects
    ) {
      updates.totalTheorySubjects =
        nextTotalTheorySubjects;

      changes.push({
        field:
          "totalTheorySubjects",

        label:
          "전체 이론 과목 수",

        before:
          currentTotalTheorySubjects,

        after:
          nextTotalTheorySubjects,
      });
    }

    if (
      hasRequiredMajorUpdate &&
      nextRequiredMajorCount !==
        currentRequiredMajorCount
    ) {
      updates.requiredMajorCount =
        nextRequiredMajorCount;

      changes.push({
        field:
          "requiredMajorCount",

        label:
          "전공필수",

        before:
          currentRequiredMajorCount,

        after:
          nextRequiredMajorCount,
      });
    }

    if (
      hasElectiveMajorUpdate &&
      nextElectiveMajorCount !==
        currentElectiveMajorCount
    ) {
      updates.electiveMajorCount =
        nextElectiveMajorCount;

      changes.push({
        field:
          "electiveMajorCount",

        label:
          "전공선택",

        before:
          currentElectiveMajorCount,

        after:
          nextElectiveMajorCount,
      });
    }

    if (
      hasLiberalUpdate &&
      nextLiberalCount !==
        currentLiberalCount
    ) {
      updates.liberalCount =
        nextLiberalCount;

      changes.push({
        field:
          "liberalCount",

        label:
          "교양",

        before:
          currentLiberalCount,

        after:
          nextLiberalCount,
      });
    }

    if (
      hasGeneralUpdate &&
      nextGeneralCount !==
        currentGeneralCount
    ) {
      updates.generalCount =
        nextGeneralCount;

      changes.push({
        field:
          "generalCount",

        label:
          "일반",

        before:
          currentGeneralCount,

        after:
          nextGeneralCount,
      });
    }

    /**
     * 요청값과 현재값이 동일하면
     * 의미 없는 Pending Action을 생성하지 않는다.
     */
    if (
      changes.length ===
      0
    ) {
      throw new Error(
        "요청한 플랜 정보가 현재 값과 동일합니다."
      );
    }

    const originalValues = {
      planId,

      desiredCourse:
        currentDesiredCourse,

      finalEducation:
        currentFinalEducation,

      hasPractice:
        currentHasPractice,

      totalTheorySubjects:
        currentTotalTheorySubjects,

      requiredMajorCount:
        currentRequiredMajorCount,

      electiveMajorCount:
        currentElectiveMajorCount,

      liberalCount:
        currentLiberalCount,

      generalCount:
        currentGeneralCount,
    };

    const warnings:
      string[] =
      [];

    if (
      !nextDesiredCourse
    ) {
      warnings.push(
        "수정 후 희망 과정이 비어 있습니다."
      );
    }

    if (
      !nextFinalEducation
    ) {
      warnings.push(
        "수정 후 최종학력이 비어 있습니다."
      );
    }

    const draft = {
      studentId,

      studentName,

      planId,

      assigneeId,

      originalValues,

      updates,

      requestedByUserId:
        context.userId,

      requestedByRole:
        context.role,

      createdAt:
        new Date()
          .toISOString(),
    };

    return {
      pendingActionRequired:
        true as const,

      studentId,

      studentName,

      planId,

      changes,

      draft,

      preview: {
        title:
          "학생 플랜 수정",

        summary:
          `${
            studentName ||
            `학생 ${studentId}`
          }님의 플랜 요약 ${changes.length}개 항목을 수정합니다.`,

        sections: [
          {
            label:
              "대상 학생",

            items: [
              `학생명: ${studentName || "-"}`,
              `학생 ID: ${studentId}`,
              `플랜 ID: ${planId}`,
            ],
          },

          {
            label:
              "수정 후 플랜",

            items: [
              `희망 과정: ${nextDesiredCourse || "-"}`,
              `최종학력: ${nextFinalEducation || "-"}`,
              `실습 필요 여부: ${
                nextHasPractice
                  ? "필요"
                  : "불필요"
              }`,
              `전체 이론 과목: ${nextTotalTheorySubjects}개`,
              `전공필수: ${nextRequiredMajorCount}개`,
              `전공선택: ${nextElectiveMajorCount}개`,
              `교양: ${nextLiberalCount}개`,
              `일반: ${nextGeneralCount}개`,
            ],
          },
        ],

        changes,

        executionSteps: [
          "승인 요청의 회사와 요청자를 다시 확인합니다.",
          "학생과 현재 담당자를 다시 확인합니다.",
          "현재 플랜 ID와 초안 생성 당시 플랜 ID를 비교합니다.",
          "플랜 원본값이 초안 생성 이후 변경되지 않았는지 확인합니다.",
          "수정 후 플랜 과목 수 합계를 다시 검증합니다.",
          "승인된 필드만 plans 테이블에 수정합니다.",
          "수정된 플랜을 다시 조회합니다.",
          "AI 실행 이력을 기록합니다.",
        ],

        missingFields:
          [],

        warnings,

        canConfirm:
          true,
      },
    };
  },
});

/**
 * 학생 우리플랜 과목 생성 승인 초안
 *
 * 이 Tool은 planSemesters 테이블을 직접 수정하지 않는다.
 *
 * 현재 학생, 플랜, 기존 플랜 과목을 확인한 뒤
 * 여러 학기의 여러 과목을 하나의 Pending Action으로
 * 생성하기 위한 승인 초안만 반환한다.
 */
registerTool<
  PlanSubjectsCreateToolInput,
  PlanSubjectsCreateToolOutput
>({
  name:
    "plan.subjects.create",

  description:
    "현재 사용자가 접근 가능한 학생의 기존 플랜에 여러 학기/여러 우리플랜 과목을 추가하기 위한 승인 초안을 생성합니다. 과목 중복, 전공필수·전공선택·교양·일반 허용 개수와 기존 플랜 상태를 사전 검증하며 실제 등록은 사용자 최종 승인 후 실행합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "우리플랜 과목을 등록할 확정된 학생 ID",

        minimum:
          1,
      },

      subjects: {
        type:
          "array",

        description:
          "등록할 우리플랜 과목 목록. 각 과목은 학기, 과목명, 분류, 요구구분, 학점을 포함해야 합니다.",

        items: {
          type:
            "object",

          properties: {
            semesterNo: {
              type:
                "integer",

              description:
                "과목을 배치할 학기 번호. 1학기는 1, 2학기는 2 형태로 입력합니다.",

              minimum:
                1,

              maximum:
                20,
            },

            subjectName: {
              type:
                "string",

              description:
                "실제 과목명",
            },

            planCategory: {
              type:
                "string",

              enum: [
                "전공",
                "교양",
                "일반",
              ],

              description:
                "플랜 과목 대분류. 전공필수와 전공선택은 전공을 사용합니다.",
            },

            planRequirementType: {
              type:
                "string",

              enum: [
                "전공필수",
                "전공선택",
                "교양",
                "일반",
              ],

              description:
                "플랜 요구구분",
            },

            credits: {
              type:
                "integer",

              description:
                "해당 과목 학점",

              minimum:
                1,

              maximum:
                10,
            },

            settlementIncluded: {
              type: [
                "boolean",
                "null",
              ],

              description:
                "정산 포함 여부. 명확하게 지정된 경우에만 전달합니다. 생략하면 실습/이벤트/무료 과목명 정책에 따라 서버가 결정합니다.",
            },
          },

          required: [
            "semesterNo",
            "subjectName",
            "planCategory",
            "planRequirementType",
            "credits",
          ],

          additionalProperties:
            false,
        },
      },
    },

    required: [
      "studentId",
      "subjects",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  /**
   * 실제 planSemesters 등록은
   * Pending Action 승인 후 Executor에서 실행한다.
   */
  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as PlanSubjectsCreateToolInput;

    if (
      context.canWrite !==
      true
    ) {
      throw new Error(
        "현재 계정은 플랜 과목 생성 초안을 만들 수 없습니다."
      );
    }

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (
      studentId <=
      0
    ) {
      throw new Error(
        "플랜 과목을 등록할 학생 ID가 필요합니다."
      );
    }

    /**
     * 학생 현재 상태 재조회
     */
    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (
      !student
    ) {
      throw new Error(
        "플랜 과목을 등록할 학생 정보를 찾을 수 없습니다."
      );
    }

    /**
     * 초안 단계에서는 조회 범위를 확인한다.
     *
     * 실제 승인 단계에서는 Executor가
     * assertCanWriteStudent()를 다시 실행한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    const assigneeId =
      normalizePositiveInteger(
        (student as any)
          .assigneeId
      );

    if (
      assigneeId <=
      0
    ) {
      throw new Error(
        "학생 담당자 정보가 없어 플랜 과목 생성 초안을 만들 수 없습니다."
      );
    }

    const studentName =
      normalizeNullableText(
        (student as any)
          .clientName,
        100
      );

    /**
     * 과목을 추가하려면
     * 먼저 plans 요약 플랜이 존재해야 한다.
     */
    const existingPlan =
      await db.getPlan(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (
      !existingPlan
    ) {
      throw new Error(
        "학생 플랜 요약이 아직 등록되어 있지 않습니다. 먼저 플랜을 생성해주세요."
      );
    }

    const planId =
      normalizePositiveInteger(
        (existingPlan as any)
          .id
      );

    if (
      planId <=
      0
    ) {
      throw new Error(
        "학생 플랜 ID를 확인할 수 없습니다."
      );
    }

    /**
     * 현재 등록되어 있는 전체 우리플랜 과목
     *
     * 승인 단계에서 Snapshot 충돌 검사에 사용한다.
     */
    const existingPlanSubjects =
      await db.listPlanSemesters(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    const originalPlanSubjectIds =
      (
        existingPlanSubjects ||
        []
      )
        .map(
          (
            row:
              any
          ) =>
            normalizePositiveInteger(
              row.id
            )
        )
        .filter(
          (
            id
          ) =>
            id >
            0
        )
        .sort(
          (
            a,
            b
          ) =>
            a -
            b
        );

    const rawSubjects =
      Array.isArray(
        safeInput.subjects
      )
        ? safeInput.subjects
        : [];

    if (
      rawSubjects.length ===
      0
    ) {
      throw new Error(
        "등록할 플랜 과목을 한 과목 이상 입력해주세요."
      );
    }

    /**
     * 한 승인 요청에 너무 많은 과목이 들어오는 것을 방지한다.
     */
    if (
      rawSubjects.length >
      100
    ) {
      throw new Error(
        "한 번에 등록할 수 있는 플랜 과목은 최대 100개입니다."
      );
    }

    /**
     * 현재 학기별 다음 sortOrder 계산
     */
    const nextSortOrderBySemester =
      new Map<
        number,
        number
      >();

    for (
      const row of
      existingPlanSubjects ||
      []
    ) {
      const semesterNo =
        normalizePositiveInteger(
          (row as any)
            .semesterNo
        );

      if (
        semesterNo <=
        0
      ) {
        continue;
      }

      const currentSortOrder =
        Number(
          (row as any)
            .sortOrder ??
          0
        );

      const normalizedSortOrder =
        Number.isFinite(
          currentSortOrder
        )
          ? Math.max(
              0,
              Math.floor(
                currentSortOrder
              )
            )
          : 0;

      const currentNext =
        nextSortOrderBySemester.get(
          semesterNo
        ) ??
        0;

      nextSortOrderBySemester.set(
        semesterNo,
        Math.max(
          currentNext,
          normalizedSortOrder +
          1
        )
      );
    }

    /**
     * 기존 과목명 Set
     *
     * 학생 전체 플랜에서 같은 과목명을 중복 등록하지 않는다.
     */
    const existingSubjectNameSet =
      new Set<
        string
      >();

    for (
      const row of
      existingPlanSubjects ||
      []
    ) {
      const normalizedName =
        String(
          (row as any)
            .subjectName ||
          ""
        )
          .trim()
          .replace(
            /\s+/g,
            " "
          )
          .toLowerCase();

      if (
        normalizedName
      ) {
        existingSubjectNameSet.add(
          normalizedName
        );
      }
    }

    /**
     * 현재 플랜에 이미 등록된
     * 요구구분별 과목 수
     */
    const currentRequirementCounts = {
      전공필수:
        0,

      전공선택:
        0,

      교양:
        0,

      일반:
        0,
    };

    for (
      const row of
      existingPlanSubjects ||
      []
    ) {
      const requirementType =
        String(
          (row as any)
            .planRequirementType ||
          ""
        ).trim();

      if (
        requirementType ===
        "전공필수"
      ) {
        currentRequirementCounts
          .전공필수 +=
          1;
      } else if (
        requirementType ===
        "전공선택"
      ) {
        currentRequirementCounts
          .전공선택 +=
          1;
      } else if (
        requirementType ===
        "교양"
      ) {
        currentRequirementCounts
          .교양 +=
          1;
      } else if (
        requirementType ===
        "일반"
      ) {
        currentRequirementCounts
          .일반 +=
          1;
      }
    }

    /**
     * 이번 승인 초안 안에서
     * 같은 과목이 두 번 들어오는 것도 차단한다.
     */
    const requestedSubjectNameSet =
      new Set<
        string
      >();

    const requestedRequirementCounts = {
      전공필수:
        0,

      전공선택:
        0,

      교양:
        0,

      일반:
        0,
    };

    const draftSubjects:
      PlanSubjectsCreateToolOutput[
        "draft"
      ][
        "subjects"
      ] =
      [];

    for (
      let index =
        0;
      index <
        rawSubjects.length;
      index +=
        1
    ) {
      const rawSubject =
        rawSubjects[index];

      if (
        !rawSubject ||
        typeof rawSubject !==
          "object" ||
        Array.isArray(
          rawSubject
        )
      ) {
        throw new Error(
          `${index + 1}번째 플랜 과목 정보가 올바르지 않습니다.`
        );
      }

      const semesterNo =
        normalizePositiveInteger(
          rawSubject
            .semesterNo
        );

      if (
        semesterNo <
          1 ||
        semesterNo >
          20
      ) {
        throw new Error(
          `${index + 1}번째 과목의 학기 번호는 1부터 20 사이여야 합니다.`
        );
      }

      const subjectName =
        String(
          rawSubject
            .subjectName ||
          ""
        )
          .trim()
          .replace(
            /\s+/g,
            " "
          )
          .slice(
            0,
            255
          );

      if (
        !subjectName
      ) {
        throw new Error(
          `${index + 1}번째 과목명이 필요합니다.`
        );
      }

      const subjectNameKey =
        subjectName
          .toLowerCase();

      if (
        requestedSubjectNameSet.has(
          subjectNameKey
        )
      ) {
        throw new Error(
          `등록 요청 안에 같은 과목이 중복되어 있습니다: ${subjectName}`
        );
      }

      if (
        existingSubjectNameSet.has(
          subjectNameKey
        )
      ) {
        throw new Error(
          `이미 학생 플랜에 등록된 과목입니다: ${subjectName}`
        );
      }

      const planCategory =
        String(
          rawSubject
            .planCategory ||
          ""
        ).trim();

      if (
        planCategory !==
          "전공" &&
        planCategory !==
          "교양" &&
        planCategory !==
          "일반"
      ) {
        throw new Error(
          `${subjectName} 과목의 플랜 분류가 올바르지 않습니다.`
        );
      }

      const planRequirementType =
        String(
          rawSubject
            .planRequirementType ||
          ""
        ).trim();

      if (
        planRequirementType !==
          "전공필수" &&
        planRequirementType !==
          "전공선택" &&
        planRequirementType !==
          "교양" &&
        planRequirementType !==
          "일반"
      ) {
        throw new Error(
          `${subjectName} 과목의 요구구분이 올바르지 않습니다.`
        );
      }

      /**
       * 대분류와 요구구분 조합 검사
       */
      if (
        (
          planRequirementType ===
            "전공필수" ||
          planRequirementType ===
            "전공선택"
        ) &&
        planCategory !==
          "전공"
      ) {
        throw new Error(
          `${subjectName} 과목은 ${planRequirementType}이므로 플랜 분류가 전공이어야 합니다.`
        );
      }

      if (
        planRequirementType ===
          "교양" &&
        planCategory !==
          "교양"
      ) {
        throw new Error(
          `${subjectName} 과목은 교양이므로 플랜 분류도 교양이어야 합니다.`
        );
      }

      if (
        planRequirementType ===
          "일반" &&
        planCategory !==
          "일반"
      ) {
        throw new Error(
          `${subjectName} 과목은 일반이므로 플랜 분류도 일반이어야 합니다.`
        );
      }

      const credits =
        Number(
          rawSubject
            .credits
        );

      if (
        !Number.isInteger(
          credits
        ) ||
        credits <
          1 ||
        credits >
          10
      ) {
        throw new Error(
          `${subjectName} 과목의 학점은 1부터 10 사이의 정수여야 합니다.`
        );
      }

      /**
       * 정산 포함 여부
       *
       * 명확하게 true/false가 전달되면 그대로 사용하고,
       * 아니면 기존 DB 정책과 동일하게
       * 실습/이벤트/무료 과목을 정산에서 제외한다.
       */
      const settlementIncluded =
        rawSubject
          .settlementIncluded ===
          true
          ? true
          : rawSubject
              .settlementIncluded ===
              false
            ? false
            : !/실습|이벤트|무료/.test(
                subjectName
              );

      const sortOrder =
        nextSortOrderBySemester.get(
          semesterNo
        ) ??
        0;

      nextSortOrderBySemester.set(
        semesterNo,
        sortOrder +
        1
      );

      requestedSubjectNameSet.add(
        subjectNameKey
      );

      if (
        planRequirementType ===
        "전공필수"
      ) {
        requestedRequirementCounts
          .전공필수 +=
          1;
      } else if (
        planRequirementType ===
        "전공선택"
      ) {
        requestedRequirementCounts
          .전공선택 +=
          1;
      } else if (
        planRequirementType ===
        "교양"
      ) {
        requestedRequirementCounts
          .교양 +=
          1;
      } else {
        requestedRequirementCounts
          .일반 +=
          1;
      }

      draftSubjects.push({
        semesterNo,

        subjectName,

        planCategory:
          planCategory as
            "전공" |
            "교양" |
            "일반",

        planRequirementType:
          planRequirementType as
            "전공필수" |
            "전공선택" |
            "교양" |
            "일반",

        credits,

        sortOrder,

        settlementIncluded,
      });
    }

    /**
     * 플랜 요약에 설정된
     * 요구구분별 허용 개수
     */
    const requiredMajorLimit =
      Number(
        (existingPlan as any)
          .requiredMajorCount ??
        0
      );

    const electiveMajorLimit =
      Number(
        (existingPlan as any)
          .electiveMajorCount ??
        0
      );

    const liberalLimit =
      Number(
        (existingPlan as any)
          .liberalCount ??
        0
      );

    const generalLimit =
      Number(
        (existingPlan as any)
          .generalCount ??
        0
      );

    if (
      currentRequirementCounts
        .전공필수 +
        requestedRequirementCounts
          .전공필수 >
      requiredMajorLimit
    ) {
      throw new Error(
        `전공필수 허용 개수(${requiredMajorLimit}개)를 초과할 수 없습니다. 현재 ${currentRequirementCounts.전공필수}개, 추가 요청 ${requestedRequirementCounts.전공필수}개입니다.`
      );
    }

    if (
      currentRequirementCounts
        .전공선택 +
        requestedRequirementCounts
          .전공선택 >
      electiveMajorLimit
    ) {
      throw new Error(
        `전공선택 허용 개수(${electiveMajorLimit}개)를 초과할 수 없습니다. 현재 ${currentRequirementCounts.전공선택}개, 추가 요청 ${requestedRequirementCounts.전공선택}개입니다.`
      );
    }

    if (
      currentRequirementCounts
        .교양 +
        requestedRequirementCounts
          .교양 >
      liberalLimit
    ) {
      throw new Error(
        `교양 허용 개수(${liberalLimit}개)를 초과할 수 없습니다. 현재 ${currentRequirementCounts.교양}개, 추가 요청 ${requestedRequirementCounts.교양}개입니다.`
      );
    }

    if (
      currentRequirementCounts
        .일반 +
        requestedRequirementCounts
          .일반 >
      generalLimit
    ) {
      throw new Error(
        `일반 허용 개수(${generalLimit}개)를 초과할 수 없습니다. 현재 ${currentRequirementCounts.일반}개, 추가 요청 ${requestedRequirementCounts.일반}개입니다.`
      );
    }

    /**
     * 전체 이론 과목 수 역시
     * 플랜 요약 수량을 초과하지 못하게 한다.
     */
    const totalTheorySubjects =
      Number(
        (existingPlan as any)
          .totalTheorySubjects ??
        0
      );

    const currentTheoryCount =
      currentRequirementCounts
        .전공필수 +
      currentRequirementCounts
        .전공선택 +
      currentRequirementCounts
        .교양 +
      currentRequirementCounts
        .일반;

    const requestedTheoryCount =
      requestedRequirementCounts
        .전공필수 +
      requestedRequirementCounts
        .전공선택 +
      requestedRequirementCounts
        .교양 +
      requestedRequirementCounts
        .일반;

    if (
      currentTheoryCount +
        requestedTheoryCount >
      totalTheorySubjects
    ) {
      throw new Error(
        `전체 이론 과목 허용 개수(${totalTheorySubjects}개)를 초과할 수 없습니다. 현재 ${currentTheoryCount}개, 추가 요청 ${requestedTheoryCount}개입니다.`
      );
    }

    /**
     * 학기별 Preview
     */
    const semesterNumbers =
      Array.from(
        new Set(
          draftSubjects.map(
            (
              subject
            ) =>
              subject.semesterNo
          )
        )
      ).sort(
        (
          a,
          b
        ) =>
          a -
          b
      );

    const sections:
      PlanSubjectsCreateToolOutput[
        "preview"
      ][
        "sections"
      ] =
      [
        {
          label:
            "대상 학생",

          items: [
            `학생명: ${studentName || "-"}`,
            `학생 ID: ${studentId}`,
            `플랜 ID: ${planId}`,
            `기존 플랜 과목: ${existingPlanSubjects.length}개`,
            `추가 예정 과목: ${draftSubjects.length}개`,
          ],
        },
      ];

    for (
      const semesterNo of
      semesterNumbers
    ) {
      const semesterSubjects =
        draftSubjects.filter(
          (
            subject
          ) =>
            subject.semesterNo ===
            semesterNo
        );

      sections.push({
        label:
          `${semesterNo}학기 등록 과목`,

        items:
          semesterSubjects.map(
            (
              subject
            ) =>
              `${subject.subjectName} / ${subject.planRequirementType} / ${subject.credits}학점 / 정산 ${
                subject.settlementIncluded
                  ? "포함"
                  : "제외"
              }`
          ),
      });
    }

    sections.push({
      label:
        "등록 후 과목 구성",

      items: [
        `전공필수: ${
          currentRequirementCounts
            .전공필수 +
          requestedRequirementCounts
            .전공필수
        } / ${requiredMajorLimit}개`,

        `전공선택: ${
          currentRequirementCounts
            .전공선택 +
          requestedRequirementCounts
            .전공선택
        } / ${electiveMajorLimit}개`,

        `교양: ${
          currentRequirementCounts
            .교양 +
          requestedRequirementCounts
            .교양
        } / ${liberalLimit}개`,

        `일반: ${
          currentRequirementCounts
            .일반 +
          requestedRequirementCounts
            .일반
        } / ${generalLimit}개`,

        `전체 이론: ${
          currentTheoryCount +
          requestedTheoryCount
        } / ${totalTheorySubjects}개`,
      ],
    });

    const warnings:
      string[] =
      [];

    if (
      currentTheoryCount +
        requestedTheoryCount <
      totalTheorySubjects
    ) {
      warnings.push(
        `이번 등록 후에도 이론 과목 ${
          totalTheorySubjects -
          (
            currentTheoryCount +
            requestedTheoryCount
          )
        }개가 남습니다.`
      );
    }

    const draft = {
      studentId,

      studentName,

      assigneeId,

      planId,

      originalPlanSubjectIds,

      subjects:
        draftSubjects,

      requestedByUserId:
        context.userId,

      requestedByRole:
        context.role,

      createdAt:
        new Date()
          .toISOString(),
    };

    return {
      pendingActionRequired:
        true as const,

      studentId,

      studentName,

      planId,

      draft,

      preview: {
        title:
          "학생 플랜 과목 생성",

        summary:
          `${
            studentName ||
            `학생 ${studentId}`
          }님의 우리플랜 과목 ${draftSubjects.length}개를 등록합니다.`,

        sections,

        /**
         * 신규 등록이므로
         * 변경 전/후 필드는 사용하지 않는다.
         */
        changes:
          [],

        executionSteps: [
          "승인 요청의 회사와 요청자를 다시 확인합니다.",
          "학생과 현재 담당자를 다시 확인합니다.",
          "플랜 ID가 초안 생성 당시와 동일한지 확인합니다.",
          "기존 플랜 과목 Snapshot이 변경되지 않았는지 확인합니다.",
          "입력 과목과 기존 과목의 중복을 다시 검사합니다.",
          "전공필수·전공선택·교양·일반 허용 개수를 다시 검사합니다.",
          "승인된 과목을 학기별 순서대로 planSemesters에 등록합니다.",
          "생성된 과목을 다시 조회합니다.",
          "AI 실행 이력을 기록합니다.",
        ],

        missingFields:
          [],

        warnings,

        canConfirm:
          true,
      },
    };
  },
});

/**
 * 학생 우리플랜 기존 과목 수정 승인 초안
 *
 * 이 Tool은 planSemesters 테이블을 직접 수정하지 않는다.
 *
 * 현재 학생과 기존 플랜 과목을 조회한 뒤
 * 사용자가 명확하게 요청한 변경값만 비교하여
 * Pending Action 생성에 사용할 수정 초안을 반환한다.
 *
 * 과목 삭제는 지원하지 않는다.
 */
registerTool<
  PlanSubjectsUpdateToolInput,
  PlanSubjectsUpdateToolOutput
>({
  name:
    "plan.subjects.update",

  description:
    "현재 사용자가 접근 가능한 학생의 기존 우리플랜 과목을 수정하기 위한 승인 초안을 생성합니다. 학기, 과목명, 플랜 분류, 요구구분, 학점, 정렬순서, 정산 포함 여부를 변경할 수 있으며 실제 수정은 사용자 최종 승인 후 실행합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "플랜 과목을 수정할 확정된 학생 ID",

        minimum:
          1,
      },

      planSubjectId: {
        type:
          "integer",

        description:
          "수정할 기존 planSemesters 과목 ID",

        minimum:
          1,
      },

      semesterNo: {
        type:
          "integer",

        description:
          "변경할 학기 번호",

        minimum:
          1,

        maximum:
          20,
      },

      subjectName: {
        type:
          "string",

        description:
          "변경할 과목명",
      },

      planCategory: {
        type:
          "string",

        enum: [
          "전공",
          "교양",
          "일반",
        ],

        description:
          "변경할 플랜 대분류",
      },

      planRequirementType: {
        type:
          "string",

        enum: [
          "전공필수",
          "전공선택",
          "교양",
          "일반",
        ],

        description:
          "변경할 플랜 요구구분",
      },

      credits: {
        type:
          "integer",

        description:
          "변경할 학점",

        minimum:
          1,

        maximum:
          10,
      },

      sortOrder: {
        type:
          "integer",

        description:
          "변경할 학기 내 정렬 순서",

        minimum:
          0,
      },

      settlementIncluded: {
        type:
          "boolean",

        description:
          "변경할 정산 포함 여부",
      },
    },

    required: [
      "studentId",
      "planSubjectId",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  /**
   * 실제 수정은 Pending Action 승인 후
   * Executor에서 실행한다.
   */
  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as PlanSubjectsUpdateToolInput;

    if (
      context.canWrite !==
      true
    ) {
      throw new Error(
        "현재 계정은 플랜 과목 수정 초안을 만들 수 없습니다."
      );
    }

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (
      studentId <=
      0
    ) {
      throw new Error(
        "플랜 과목을 수정할 학생 ID가 필요합니다."
      );
    }

    const planSubjectId =
      normalizePositiveInteger(
        safeInput.planSubjectId
      );

    if (
      planSubjectId <=
      0
    ) {
      throw new Error(
        "수정할 플랜 과목 ID가 필요합니다."
      );
    }

    /**
     * 학생 현재 상태 재조회
     */
    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (
      !student
    ) {
      throw new Error(
        "플랜 과목을 수정할 학생 정보를 찾을 수 없습니다."
      );
    }

    /**
     * 초안 단계에서는 조회 범위를 검사한다.
     *
     * 실제 승인 단계에서는 Executor에서
     * 담당자 쓰기 권한을 다시 검사한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    const assigneeId =
      normalizePositiveInteger(
        (student as any)
          .assigneeId
      );

    if (
      assigneeId <=
      0
    ) {
      throw new Error(
        "학생 담당자 정보가 없어 플랜 과목 수정 초안을 만들 수 없습니다."
      );
    }

    const studentName =
      normalizeNullableText(
        (student as any)
          .clientName,
        100
      );

    /**
     * 현재 플랜 확인
     */
    const existingPlan =
      await db.getPlan(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (
      !existingPlan
    ) {
      throw new Error(
        "학생 플랜이 없어 플랜 과목을 수정할 수 없습니다."
      );
    }

    const planId =
      normalizePositiveInteger(
        (existingPlan as any)
          .id
      );

    if (
      planId <=
      0
    ) {
      throw new Error(
        "학생 플랜 ID를 확인할 수 없습니다."
      );
    }

    /**
     * 현재 DB에는 planSemester 단건 조회 함수가 없으므로
     * 학생 전체 플랜 과목을 조직 범위로 조회한 뒤
     * planSubjectId가 동일한 행을 찾는다.
     */
    const existingPlanSubjects =
      await db.listPlanSemesters(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    const existingSubject =
      (
        existingPlanSubjects ||
        []
      ).find(
        (
          row:
            any
        ) =>
          normalizePositiveInteger(
            row.id
          ) ===
          planSubjectId
      );

    if (
      !existingSubject
    ) {
      throw new Error(
        "수정할 우리플랜 과목을 찾을 수 없습니다."
      );
    }

    /**
     * 최소 하나 이상의 변경 필드가
     * 명확하게 전달되어야 한다.
     */
    const hasSemesterNoUpdate =
      safeInput.semesterNo !==
      undefined;

    const hasSubjectNameUpdate =
      safeInput.subjectName !==
      undefined;

    const hasPlanCategoryUpdate =
      safeInput.planCategory !==
      undefined;

    const hasRequirementUpdate =
      safeInput.planRequirementType !==
      undefined;

    const hasCreditsUpdate =
      safeInput.credits !==
      undefined;

    const hasSortOrderUpdate =
      safeInput.sortOrder !==
      undefined;

    const hasSettlementUpdate =
      safeInput.settlementIncluded !==
      undefined;

    if (
      !hasSemesterNoUpdate &&
      !hasSubjectNameUpdate &&
      !hasPlanCategoryUpdate &&
      !hasRequirementUpdate &&
      !hasCreditsUpdate &&
      !hasSortOrderUpdate &&
      !hasSettlementUpdate
    ) {
      throw new Error(
        "변경할 플랜 과목 정보가 필요합니다."
      );
    }

    /**
     * 현재 과목 원본값 정규화
     */
    const currentSemesterNo =
      normalizePositiveInteger(
        (existingSubject as any)
          .semesterNo
      );

    if (
      currentSemesterNo <=
      0
    ) {
      throw new Error(
        "현재 플랜 과목의 학기 정보가 올바르지 않습니다."
      );
    }

    const currentSubjectName =
      String(
        (existingSubject as any)
          .subjectName ||
        ""
      )
        .trim()
        .replace(
          /\s+/g,
          " "
        )
        .slice(
          0,
          255
        );

    if (
      !currentSubjectName
    ) {
      throw new Error(
        "현재 플랜 과목명이 올바르지 않습니다."
      );
    }

    const currentPlanCategory =
      String(
        (existingSubject as any)
          .planCategory ||
        ""
      ).trim();

    if (
      currentPlanCategory !==
        "전공" &&
      currentPlanCategory !==
        "교양" &&
      currentPlanCategory !==
        "일반"
    ) {
      throw new Error(
        "현재 플랜 과목 분류가 올바르지 않습니다."
      );
    }

    const currentRequirementType =
      String(
        (existingSubject as any)
          .planRequirementType ||
        ""
      ).trim();

    if (
      currentRequirementType !==
        "전공필수" &&
      currentRequirementType !==
        "전공선택" &&
      currentRequirementType !==
        "교양" &&
      currentRequirementType !==
        "일반"
    ) {
      throw new Error(
        "현재 플랜 과목 요구구분이 올바르지 않습니다."
      );
    }

    const currentCredits =
      Number(
        (existingSubject as any)
          .credits
      );

    if (
      !Number.isInteger(
        currentCredits
      ) ||
      currentCredits <
        1
    ) {
      throw new Error(
        "현재 플랜 과목 학점이 올바르지 않습니다."
      );
    }

    const rawCurrentSortOrder =
      Number(
        (existingSubject as any)
          .sortOrder ??
        0
      );

    const currentSortOrder =
      Number.isInteger(
        rawCurrentSortOrder
      ) &&
      rawCurrentSortOrder >=
        0
        ? rawCurrentSortOrder
        : 0;

    const currentSettlementIncluded =
      (existingSubject as any)
        .settlementIncluded ===
      true;

    /**
     * 사용자가 전달한 값을 반영한
     * 최종 상태 계산
     */
    const nextSemesterNo =
      hasSemesterNoUpdate
        ? Number(
            safeInput.semesterNo
          )
        : currentSemesterNo;

    if (
      !Number.isInteger(
        nextSemesterNo
      ) ||
      nextSemesterNo <
        1 ||
      nextSemesterNo >
        20
    ) {
      throw new Error(
        "변경할 학기 번호는 1부터 20 사이여야 합니다."
      );
    }

    const nextSubjectName =
      hasSubjectNameUpdate
        ? String(
            safeInput.subjectName ||
            ""
          )
            .trim()
            .replace(
              /\s+/g,
              " "
            )
            .slice(
              0,
              255
            )
        : currentSubjectName;

    if (
      !nextSubjectName
    ) {
      throw new Error(
        "변경할 과목명이 올바르지 않습니다."
      );
    }

    const nextPlanCategory =
      hasPlanCategoryUpdate
        ? String(
            safeInput.planCategory ||
            ""
          ).trim()
        : currentPlanCategory;

    if (
      nextPlanCategory !==
        "전공" &&
      nextPlanCategory !==
        "교양" &&
      nextPlanCategory !==
        "일반"
    ) {
      throw new Error(
        "플랜 분류는 전공, 교양, 일반 중 하나여야 합니다."
      );
    }

    const nextRequirementType =
      hasRequirementUpdate
        ? String(
            safeInput
              .planRequirementType ||
            ""
          ).trim()
        : currentRequirementType;

    if (
      nextRequirementType !==
        "전공필수" &&
      nextRequirementType !==
        "전공선택" &&
      nextRequirementType !==
        "교양" &&
      nextRequirementType !==
        "일반"
    ) {
      throw new Error(
        "플랜 요구구분이 올바르지 않습니다."
      );
    }

    /**
     * 최종 분류/요구구분 조합 검사
     */
    if (
      (
        nextRequirementType ===
          "전공필수" ||
        nextRequirementType ===
          "전공선택"
      ) &&
      nextPlanCategory !==
        "전공"
    ) {
      throw new Error(
        `${nextSubjectName} 과목은 ${nextRequirementType}이므로 플랜 분류가 전공이어야 합니다.`
      );
    }

    if (
      nextRequirementType ===
        "교양" &&
      nextPlanCategory !==
        "교양"
    ) {
      throw new Error(
        `${nextSubjectName} 과목은 교양이므로 플랜 분류도 교양이어야 합니다.`
      );
    }

    if (
      nextRequirementType ===
        "일반" &&
      nextPlanCategory !==
        "일반"
    ) {
      throw new Error(
        `${nextSubjectName} 과목은 일반이므로 플랜 분류도 일반이어야 합니다.`
      );
    }

    const nextCredits =
      hasCreditsUpdate
        ? Number(
            safeInput.credits
          )
        : currentCredits;

    if (
      !Number.isInteger(
        nextCredits
      ) ||
      nextCredits <
        1 ||
      nextCredits >
        10
    ) {
      throw new Error(
        "플랜 과목 학점은 1부터 10 사이의 정수여야 합니다."
      );
    }

    const nextSortOrder =
      hasSortOrderUpdate
        ? Number(
            safeInput.sortOrder
          )
        : currentSortOrder;

    if (
      !Number.isInteger(
        nextSortOrder
      ) ||
      nextSortOrder <
        0
    ) {
      throw new Error(
        "플랜 과목 정렬 순서는 0 이상의 정수여야 합니다."
      );
    }

    if (
      hasSettlementUpdate &&
      typeof safeInput
        .settlementIncluded !==
        "boolean"
    ) {
      throw new Error(
        "정산 포함 여부가 올바르지 않습니다."
      );
    }

    const nextSettlementIncluded =
      hasSettlementUpdate
        ? safeInput
            .settlementIncluded ===
          true
        : currentSettlementIncluded;

    /**
     * 과목명이 바뀌는 경우
     * 학생 전체 플랜에서 동일 과목명이 있는지
     * 기존 DB 중복검사 함수를 그대로 사용한다.
     */
    if (
      nextSubjectName
        .toLowerCase() !==
      currentSubjectName
        .toLowerCase()
    ) {
      const duplicate =
        await db.findDuplicatePlanSubject({
          organizationId:
            context.organizationId,

          studentId,

          subjectName:
            nextSubjectName,

          excludeId:
            planSubjectId,
        });

      if (
        duplicate
      ) {
        throw new Error(
          `이미 ${
            Number(
              (duplicate as any)
                .semesterNo
            ) ||
            "-"
          }학기에 등록된 과목입니다: ${
            String(
              (duplicate as any)
                .subjectName ||
              nextSubjectName
            )
          }`
        );
      }
    }

    const updates:
      PlanSubjectsUpdateToolOutput[
        "draft"
      ][
        "updates"
      ] =
      {};

    const changes:
      PlanSubjectsUpdateToolOutput[
        "changes"
      ] =
      [];

    if (
      hasSemesterNoUpdate &&
      nextSemesterNo !==
        currentSemesterNo
    ) {
      updates.semesterNo =
        nextSemesterNo;

      changes.push({
        field:
          "semesterNo",

        label:
          "학기",

        before:
          currentSemesterNo,

        after:
          nextSemesterNo,
      });
    }

    if (
      hasSubjectNameUpdate &&
      nextSubjectName !==
        currentSubjectName
    ) {
      updates.subjectName =
        nextSubjectName;

      changes.push({
        field:
          "subjectName",

        label:
          "과목명",

        before:
          currentSubjectName,

        after:
          nextSubjectName,
      });
    }

    if (
      hasPlanCategoryUpdate &&
      nextPlanCategory !==
        currentPlanCategory
    ) {
      updates.planCategory =
        nextPlanCategory as
          "전공" |
          "교양" |
          "일반";

      changes.push({
        field:
          "planCategory",

        label:
          "플랜 분류",

        before:
          currentPlanCategory,

        after:
          nextPlanCategory,
      });
    }

    if (
      hasRequirementUpdate &&
      nextRequirementType !==
        currentRequirementType
    ) {
      updates.planRequirementType =
        nextRequirementType as
          "전공필수" |
          "전공선택" |
          "교양" |
          "일반";

      changes.push({
        field:
          "planRequirementType",

        label:
          "요구구분",

        before:
          currentRequirementType,

        after:
          nextRequirementType,
      });
    }

    if (
      hasCreditsUpdate &&
      nextCredits !==
        currentCredits
    ) {
      updates.credits =
        nextCredits;

      changes.push({
        field:
          "credits",

        label:
          "학점",

        before:
          currentCredits,

        after:
          nextCredits,
      });
    }

    if (
      hasSortOrderUpdate &&
      nextSortOrder !==
        currentSortOrder
    ) {
      updates.sortOrder =
        nextSortOrder;

      changes.push({
        field:
          "sortOrder",

        label:
          "정렬 순서",

        before:
          currentSortOrder,

        after:
          nextSortOrder,
      });
    }

    if (
      hasSettlementUpdate &&
      nextSettlementIncluded !==
        currentSettlementIncluded
    ) {
      updates.settlementIncluded =
        nextSettlementIncluded;

      changes.push({
        field:
          "settlementIncluded",

        label:
          "정산 포함 여부",

        before:
          currentSettlementIncluded,

        after:
          nextSettlementIncluded,
      });
    }

    /**
     * 현재 값과 동일한 요청이면
     * 의미 없는 Pending Action을 만들지 않는다.
     */
    if (
      changes.length ===
      0
    ) {
      throw new Error(
        "요청한 플랜 과목 정보가 현재 값과 동일합니다."
      );
    }

    const originalValues = {
      id:
        planSubjectId,

      studentId,

      semesterNo:
        currentSemesterNo,

      subjectName:
        currentSubjectName,

      planCategory:
        currentPlanCategory as
          "전공" |
          "교양" |
          "일반",

      planRequirementType:
        currentRequirementType as
          "전공필수" |
          "전공선택" |
          "교양" |
          "일반",

      credits:
        currentCredits,

      sortOrder:
        currentSortOrder,

      settlementIncluded:
        currentSettlementIncluded,
    };

    const warnings:
      string[] =
      [];

    /**
     * 현재 updatePlanSemester()는
     * 과목명이 변경되고 settlementIncluded가 전달되지 않으면
     * 서버 정산정책으로 정산 여부를 다시 계산한다.
     */
    if (
      hasSubjectNameUpdate &&
      !hasSettlementUpdate
    ) {
      warnings.push(
        "과목명이 변경되므로 정산 포함 여부는 현재 서버 정책에 따라 다시 계산될 수 있습니다."
      );
    }

    const draft = {
      studentId,

      studentName,

      planId,

      planSubjectId,

      assigneeId,

      originalValues,

      updates,

      requestedByUserId:
        context.userId,

      requestedByRole:
        context.role,

      createdAt:
        new Date()
          .toISOString(),
    };

    return {
      pendingActionRequired:
        true as const,

      studentId,

      studentName,

      planId,

      planSubjectId,

      changes,

      draft,

      preview: {
        title:
          "학생 플랜 과목 수정",

        summary:
          `${
            studentName ||
            `학생 ${studentId}`
          }님의 ${currentSubjectName} 과목 ${changes.length}개 항목을 수정합니다.`,

        sections: [
          {
            label:
              "대상 학생",

            items: [
              `학생명: ${studentName || "-"}`,
              `학생 ID: ${studentId}`,
              `플랜 ID: ${planId}`,
              `플랜 과목 ID: ${planSubjectId}`,
            ],
          },

          {
            label:
              "현재 과목",

            items: [
              `학기: ${currentSemesterNo}학기`,
              `과목명: ${currentSubjectName}`,
              `플랜 분류: ${currentPlanCategory}`,
              `요구구분: ${currentRequirementType}`,
              `학점: ${currentCredits}`,
              `정렬 순서: ${currentSortOrder}`,
              `정산: ${
                currentSettlementIncluded
                  ? "포함"
                  : "제외"
              }`,
            ],
          },

          {
            label:
              "수정 후 과목",

            items: [
              `학기: ${nextSemesterNo}학기`,
              `과목명: ${nextSubjectName}`,
              `플랜 분류: ${nextPlanCategory}`,
              `요구구분: ${nextRequirementType}`,
              `학점: ${nextCredits}`,
              `정렬 순서: ${nextSortOrder}`,
              `정산: ${
                hasSettlementUpdate
                  ? (
                      nextSettlementIncluded
                        ? "포함"
                        : "제외"
                    )
                  : (
                      hasSubjectNameUpdate
                        ? "서버 정책 재계산"
                        : (
                            currentSettlementIncluded
                              ? "포함"
                              : "제외"
                          )
                    )
              }`,
            ],
          },
        ],

        changes,

        executionSteps: [
          "승인 요청의 회사와 요청자를 다시 확인합니다.",
          "학생과 현재 담당자를 다시 확인합니다.",
          "현재 플랜 ID를 다시 확인합니다.",
          "수정 대상 플랜 과목이 현재 학생에게 그대로 존재하는지 확인합니다.",
          "초안 생성 당시 과목 원본값과 현재 DB값을 비교합니다.",
          "과목명 중복과 플랜 분류·요구구분 조합을 다시 검사합니다.",
          "요구구분 제한을 현재 서버 정책으로 다시 검사합니다.",
          "승인된 필드만 planSemesters에 수정합니다.",
          "수정된 플랜 과목을 다시 조회합니다.",
          "AI 실행 이력을 기록합니다.",
        ],

        missingFields:
          [],

        warnings,

        canConfirm:
          true,
      },
    };
  },
});

/**
 * 학생 일정 등록 초안
 *
 * 이 Tool은 schedules 테이블을 직접 수정하지 않는다.
 * 학생 및 권한을 검증한 뒤
 * Pending Action 생성에 사용할 일정 초안을 반환한다.
 */
registerTool<
  ScheduleCreateToolInput,
  ScheduleCreateToolOutput
>({
  name:
    "schedule.create",

  description:
    "현재 사용자가 접근 가능한 학생에게 연결할 일정 등록 초안을 생성합니다. 실제 일정 등록은 사용자의 최종 승인 후 실행합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
          "일정을 연결할 확정된 학생 ID",

        minimum:
          1,
      },

      studentName: {
        type: [
          "string",
          "null",
        ],

        description:
          "사용자 확인 화면에 표시할 학생명. 권한검사에는 사용하지 않습니다.",
      },

      title: {
        type:
          "string",

        description:
          "등록할 일정 제목",
      },

      description: {
        type: [
          "string",
          "null",
        ],

        description:
          "일정 상세내용. 별도 내용이 없으면 생략합니다.",
      },

      scheduleDate: {
        type:
          "string",

        description:
          "일정 날짜. YYYY-MM-DD 형식으로 전달합니다.",
      },

      meridiem: {
        type:
          "string",

        description:
          "오전 또는 오후 구분",

        enum: [
          "AM",
          "PM",
        ],
      },

      hour12: {
        type:
          "integer",

        description:
          "12시간제를 기준으로 한 시간",

        minimum:
          1,

        maximum:
          12,
      },

      minute: {
        type:
          "integer",

        description:
          "일정의 분",

        minimum:
          0,

        maximum:
          59,
      },

      isGlobal: {
        type:
          "boolean",

        description:
          "회사 전체 일정 여부. 일반적인 학생 개인 일정은 false입니다.",
      },
    },

    required: [
      "studentId",
      "title",
      "scheduleDate",
      "meridiem",
      "hour12",
      "minute",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  /**
   * 이 Tool 자체는 DB를 수정하지 않고
   * 승인용 초안만 반환하므로 false다.
   *
   * 실제 일정 Executor가 승인 이후 실행된다.
   */
  requiresConfirmation:
    false,

  autoExecutable:
    true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as ScheduleCreateToolInput;

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (!studentId) {
      throw new Error(
        "일정을 연결할 올바른 학생 ID가 필요합니다."
      );
    }

    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (!student) {
      throw new Error(
        "일정을 연결할 학생을 찾을 수 없습니다."
      );
    }

    /**
     * Staff/Admin/Host/Superhost별
     * 학생 접근 가능 범위를 검사한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    const title =
      normalizeNullableText(
        safeInput.title,
        255
      );

    if (!title) {
      throw new Error(
        "일정 제목을 입력해주세요."
      );
    }

    const description =
      normalizeNullableText(
        safeInput.description,
        2000
      );

    const scheduleDate =
      String(
        safeInput.scheduleDate ||
        ""
      ).trim();

    const meridiem =
      safeInput.meridiem ===
        "PM"
        ? "PM"
        : safeInput.meridiem ===
            "AM"
          ? "AM"
          : null;

    if (!meridiem) {
      throw new Error(
        "일정 오전·오후 구분이 필요합니다."
      );
    }

    const hour12 =
      normalizePositiveInteger(
        safeInput.hour12
      );

    const minute =
      Number(
        safeInput.minute
      );

    const startAt =
      buildScheduleStartAt({
        scheduleDate,
        meridiem,
        hour12,
        minute,
      });

    /**
 * 회사 공용 일정은 Host만 요청할 수 있다.
 *
 * Superhost는 조회 및 점검만 가능하고
 * CRM 쓰기 초안도 생성하지 않는다.
 */
const globalRequested =
  safeInput.isGlobal ===
  true;

const globalAllowed =
  context.role ===
  "host";

if (
  globalRequested &&
  !globalAllowed
) {
  throw new Error(
    "회사 전체 일정은 Host만 등록할 수 있습니다."
  );
}

    const isGlobal =
      globalRequested &&
      globalAllowed;

    const studentName =
      String(
        (student as any)
          .clientName ||
        safeInput.studentName ||
        ""
      ).trim() ||
      null;

    const meridiemLabel =
      meridiem ===
        "PM"
        ? "오후"
        : "오전";

    return {
      pendingActionRequired:
        true,

      studentId,

      studentName,

      title,

      description,

      scheduleDate,

      meridiem,

      hour12,

      minute:
        Math.floor(
          minute
        ),

      startAt,

      isGlobal,

      preview: {
        title:
          "학생 일정 등록",

        summary:
          `${studentName || `학생 #${studentId}`} 학생의 일정을 등록합니다.`,

        items: [
          `학생: ${studentName || `학생 #${studentId}`}`,
          `일정명: ${title}`,
          `날짜: ${scheduleDate}`,
          `시간: ${meridiemLabel} ${hour12}시 ${String(
            Math.floor(
              minute
            )
          ).padStart(
            2,
            "0"
          )}분`,
          `공개범위: ${isGlobal ? "회사 전체" : "개인 일정"}`,
          description
            ? `내용: ${description}`
            : "내용: 없음",
        ],

        warnings:
          [],

        canConfirm:
          true,
      },
    };
  },
});

/**
 * 상담 검색
 */
registerTool<
  ConsultationSearchToolInput,
  ConsultationSearchToolOutput
>({
  name:
    "consultation.search",

  description:
    "현재 사용자의 권한 범위 안에서 상담DB를 이름, 연락처, 희망과정, 상태 또는 상담내용으로 검색합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      query: {
        type:
          "string",

        description:
          "검색할 상담자의 이름, 연락처 일부, 희망과정, 상태 또는 상담내용",
      },

      limit: {
        type:
          "integer",

        description:
          "최대 검색 결과 수",

        minimum:
          1,

        maximum:
          50,
      },
    },

    required: [
      "query",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as ConsultationSearchToolInput;

    const query =
      normalizeSearchQuery(
        safeInput.query
      );

    if (!query) {
      throw new Error(
        "상담 검색어를 입력해주세요."
      );
    }

    const limit = normalizeLimit(
      safeInput.limit,
      20,
      50
    );

    const assigneeIds =
      getScopedAssigneeIds(context);

    const consultations =
  await db.listConsultations(
    context.allowedAssigneeIds === null
      ? undefined
      : context.allowedAssigneeIds.length === 1
        ? context.allowedAssigneeIds[0]
        : undefined,
    {
      organizationId:
        context.organizationId,

      assigneeIds:
        context.allowedAssigneeIds !== null &&
        context.allowedAssigneeIds.length > 1
          ? context.allowedAssigneeIds
          : undefined,
    }
  );

    const queryLower =
      query.toLowerCase();

    const queryDigits =
      query.replace(/\D/g, "");

    const matched = (
      consultations || []
    )
      .filter((consultation: any) =>
        isTextMatched({
          queryLower,
          queryDigits,
          values: [
            consultation.clientName,
            consultation.phone,
            consultation.desiredCourse,
            consultation.status,
            consultation.notes,
            consultation.channel,
          ],
        })
      )
      .slice(0, limit)
      .map(
        (consultation: any) => ({
          id: Number(
            consultation.id
          ),

          clientName:
            consultation.clientName ??
            null,

          phone:
            consultation.phone ??
            null,

          desiredCourse:
            consultation.desiredCourse ??
            null,

          status:
            consultation.status ??
            null,

          assigneeId:
            consultation.assigneeId
              ? Number(
                  consultation.assigneeId
                )
              : null,
        })
      );

    return {
      query,
      count: matched.length,
      consultations: matched,
    };
  },
});

/**
 * 상담DB 신규등록 승인 초안
 *
 * 이 Tool은 consultations 테이블을 직접 생성하지 않는다.
 * 신규 상담정보를 검증하고 사용자 승인용 초안만 반환한다.
 *
 * 기존 학생 또는 기존 상담 검색은
 * AI Runner와 Workflow에서 먼저 처리해야 한다.
 */
registerTool<
  ConsultationCreateToolInput,
  ConsultationCreateToolOutput
>({
  name:
    "consultation.create",

  description:
    "새로운 상담자의 이름, 연락처, 최종학력, 희망과정, 상담내용과 상태를 상담DB에 등록하기 위한 승인 초안을 생성합니다. 기존 학생이나 기존 상담DB를 수정할 때는 사용하지 않습니다. 실제 상담DB 생성은 사용자 승인 후 실행됩니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      consultDate: {
        type: [
          "string",
          "null",
        ],

        description:
          "상담일입니다. YYYY-MM-DD 형식이며, 사용자가 날짜를 말하지 않았다면 전달하지 않습니다.",
      },

      channel: {
        type: [
          "string",
          "null",
        ],

        description:
          "상담 유입 경로입니다. 사용자가 경로를 말하지 않았다면 전달하지 않습니다.",
      },

      clientName: {
        type:
          "string",

        description:
          "신규 상담자의 이름입니다.",
      },

      phone: {
        type:
          "string",

        description:
          "신규 상담자의 연락처입니다. 하이픈 포함 여부와 관계없이 입력할 수 있습니다.",
      },

      finalEducation: {
        type: [
          "string",
          "null",
        ],

        description:
          "신규 상담자의 최종학력입니다. 사용자가 말하지 않았다면 전달하지 않습니다.",
      },

      desiredCourse: {
        type: [
          "string",
          "null",
        ],

        description:
          "신규 상담자의 희망과정입니다. 사용자가 말하지 않았다면 전달하지 않습니다.",
      },

      notes: {
        type: [
          "string",
          "null",
        ],

        description:
          "상담내용 또는 상담 메모입니다. 사용자가 말하지 않았다면 전달하지 않습니다.",
      },

      status: {
        type: [
          "string",
          "null",
        ],

        description:
          "상담 상태입니다. 사용자가 상태를 말하지 않았다면 전달하지 않습니다.",
      },
    },

    required: [
      "clientName",
      "phone",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  /**
   * 실제 상담DB 생성은
   * Pending Action 승인 후 실행한다.
   */
  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as ConsultationCreateToolInput;

    if (
      context.canWrite !==
      true
    ) {
      throw new Error(
        "현재 계정은 상담DB 신규등록 초안을 생성할 수 없습니다."
      );
    }

    const clientName =
      String(
        safeInput.clientName ??
        ""
      )
        .trim()
        .slice(
          0,
          100
        );

    if (
      !clientName
    ) {
      throw new Error(
        "신규 상담자의 이름이 필요합니다."
      );
    }

    const phone =
      normalizeConsultationCreatePhone(
        safeInput.phone
      );

    const consultDate =
      normalizeConsultationCreateDate(
        safeInput.consultDate
      );

    const channel =
      normalizeNullableText(
        safeInput.channel,
        100
      ) ||
      "AI 상담 등록";

    const finalEducation =
      normalizeNullableText(
        safeInput.finalEducation,
        100
      );

    const desiredCourse =
      normalizeNullableText(
        safeInput.desiredCourse,
        100
      );

    const notes =
      normalizeNullableText(
        safeInput.notes,
        5000
      );

    const status =
      normalizeNullableText(
        safeInput.status,
        100
      ) ||
      "상담중";

    const missingFields:
      string[] =
      [];

    const warnings:
      string[] =
      [];

    /**
     * 이름과 연락처만 실제 필수값이다.
     *
     * 최종학력, 희망과정, 상담내용은
     * 사용자가 제공한 경우에만 저장하며,
     * 누락돼도 상담DB 생성 자체는 허용한다.
     */
    if (
      !finalEducation
    ) {
      warnings.push(
        "최종학력이 입력되지 않았습니다."
      );
    }

    if (
      !desiredCourse
    ) {
      warnings.push(
        "희망과정이 입력되지 않았습니다."
      );
    }

    if (
      !notes
    ) {
      warnings.push(
        "상담내용이 입력되지 않았습니다."
      );
    }

    const createdAt =
      new Date()
        .toISOString();

    const draft:
      ConsultationCreateToolOutput["draft"] = {
      consultDate,

      channel,

      clientName,

      phone,

      finalEducation,

      desiredCourse,

      notes,

      status,

      requestedByUserId:
        context.userId,

      requestedByRole:
        context.role,

      createdAt,

      canConfirm:
        missingFields.length ===
        0,

      missingFields,

      warnings,
    };

    const changes:
      ConsultationCreateToolOutput["preview"]["changes"] =
      [
        {
          field:
            "consultDate",

          label:
            "상담일",

          before:
            null,

          after:
            consultDate,
        },

        {
          field:
            "channel",

          label:
            "상담 경로",

          before:
            null,

          after:
            channel,
        },

        {
          field:
            "clientName",

          label:
            "이름",

          before:
            null,

          after:
            clientName,
        },

        {
          field:
            "phone",

          label:
            "연락처",

          before:
            null,

          after:
            phone,
        },

        {
          field:
            "finalEducation",

          label:
            "최종학력",

          before:
            null,

          after:
            finalEducation,
        },

        {
          field:
            "desiredCourse",

          label:
            "희망과정",

          before:
            null,

          after:
            desiredCourse,
        },

        {
          field:
            "notes",

          label:
            "상담내용",

          before:
            null,

          after:
            notes,
        },

        {
          field:
            "status",

          label:
            "상담 상태",

          before:
            null,

          after:
            status,
        },
      ];

    return {
      pendingActionRequired:
        true,

      clientName,

      phone,

      draft,

      preview: {
        title:
          "상담DB 신규등록",

        summary:
          `${clientName}님의 신규 상담정보를 상담DB에 등록합니다.`,

        sections: [
          {
            title:
              "신규 상담자",

            items: [
              `이름 · ${clientName}`,
              `연락처 · ${phone}`,
              `최종학력 · ${finalEducation || "미입력"}`,
              `희망과정 · ${desiredCourse || "미입력"}`,
            ],
          },

          {
            title:
              "상담정보",

            items: [
              `상담일 · ${consultDate}`,
              `상담 경로 · ${channel}`,
              `상담 상태 · ${status}`,
              `상담내용 · ${notes || "미입력"}`,
            ],
          },
        ],

        changes,

        executionSteps: [
          "승인 요청의 회사와 최초 요청자를 다시 확인합니다.",
          "동일한 연락처의 기존 상담DB가 있는지 다시 확인합니다.",
          "현재 로그인 사용자를 상담 담당자로 지정합니다.",
          "이름과 연락처를 개인정보 정책에 따라 저장합니다.",
          "상담DB 신규등록 결과와 AI 실행 이력을 기록합니다.",
        ],

        missingFields,

        warnings,

        canConfirm:
          missingFields.length ===
          0,
      },
    };
  },
});

/**
 * 상담DB 수정 승인 초안
 *
 * 이 Tool은 consultations 테이블을 직접 수정하지 않는다.
 * 현재 값과 변경값을 비교하여 승인용 초안만 반환한다.
 */
registerTool<
  ConsultationUpdateToolInput,
  ConsultationUpdateToolOutput
>({
  name:
    "consultation.update",

  description:
    "현재 사용자가 접근 가능한 상담DB의 상담 상태 또는 상담내용을 수정하기 위한 승인 초안을 생성합니다. 실제 DB 수정은 사용자 승인 후 실행됩니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      consultationId: {
        type:
          "integer",

        description:
          "수정할 확정된 상담DB ID",

        minimum:
          1,
      },

      status: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경할 상담 상태. 상태 변경 요청이 없으면 전달하지 않습니다.",
      },

      notes: {
        type: [
          "string",
          "null",
        ],

        description:
          "변경 후 저장할 전체 상담내용. 상담내용 변경 요청이 없으면 전달하지 않습니다.",
      },
    },

    required: [
      "consultationId",
    ],

    additionalProperties:
      false,
  },

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as ConsultationUpdateToolInput;

    const consultationId =
      normalizePositiveInteger(
        safeInput.consultationId
      );

    if (
      consultationId <= 0
    ) {
      throw new Error(
        "상담DB 번호가 필요합니다."
      );
    }

    const consultation =
      await db.getConsultation(
        consultationId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (!consultation) {
      throw new Error(
        "상담 정보를 찾을 수 없습니다."
      );
    }

    /**
     * Staff는 본인 상담,
     * Admin은 팀 상담,
     * Host는 회사 상담만 접근 가능하다.
     */
    assertCanAccessConsultation({
      context,
      consultation,
    });

    const hasStatusUpdate =
      safeInput.status !==
      undefined;

    const hasNotesUpdate =
      safeInput.notes !==
      undefined;

    if (
      !hasStatusUpdate &&
      !hasNotesUpdate
    ) {
      throw new Error(
        "변경할 상담 상태 또는 상담내용이 필요합니다."
      );
    }

    const currentStatus =
      normalizeConsultationUpdateText(
        (consultation as any)
          .status,
        100
      );

    const currentNotes =
      normalizeConsultationUpdateText(
        (consultation as any)
          .notes,
        5000
      );

    const nextStatus =
      hasStatusUpdate
        ? normalizeConsultationUpdateText(
            safeInput.status,
            100
          )
        : currentStatus;

    const nextNotes =
      hasNotesUpdate
        ? normalizeConsultationUpdateText(
            safeInput.notes,
            5000
          )
        : currentNotes;

    const changes:
      ConsultationUpdateToolOutput["changes"] =
      [];

    if (
      hasStatusUpdate &&
      currentStatus !==
        nextStatus
    ) {
      changes.push({
        field:
          "status",

        label:
          "상담 상태",

        before:
          currentStatus,

        after:
          nextStatus,
      });
    }

    if (
      hasNotesUpdate &&
      currentNotes !==
        nextNotes
    ) {
      changes.push({
        field:
          "notes",

        label:
          "상담 내용",

        before:
          currentNotes,

        after:
          nextNotes,
      });
    }

    if (
      changes.length ===
      0
    ) {
      throw new Error(
        "현재 값과 변경할 값이 동일합니다."
      );
    }

    const updates:
      ConsultationUpdateToolOutput["draft"]["updates"] =
      {};

    if (
      hasStatusUpdate &&
      currentStatus !==
        nextStatus
    ) {
      updates.status =
        nextStatus;
    }

    if (
      hasNotesUpdate &&
      currentNotes !==
        nextNotes
    ) {
      updates.notes =
        nextNotes;
    }

    const clientName =
      normalizeConsultationUpdateText(
        (consultation as any)
          .clientName,
        100
      );

    const phone =
      normalizeConsultationUpdateText(
        (consultation as any)
          .phone,
        30
      );

    const warnings:
      string[] = [];

    if (
      updates.status ===
      null
    ) {
      warnings.push(
        "상담 상태가 비어 있는 값으로 변경됩니다."
      );
    }

    if (
      updates.notes ===
      null
    ) {
      warnings.push(
        "기존 상담내용이 삭제됩니다."
      );
    }

    const createdAt =
      new Date()
        .toISOString();

    return {
      pendingActionRequired:
        true,

      consultationId,

      clientName,

      phone,

      changes,

      draft: {
        consultationId,

        clientName,

        originalValues: {
          status:
            currentStatus,

          notes:
            currentNotes,
        },

        updates,

        requestedByUserId:
          context.userId,

        requestedByRole:
          context.role,

        createdAt,
      },

      preview: {
        title:
          "상담DB 정보 수정",

        summary:
          `${
            clientName ||
            `상담DB ${consultationId}번`
          }의 상담정보 ${changes.length}개 항목을 수정합니다.`,

        sections: [
          {
            title:
              "수정 대상",

            items: [
              `상담DB 번호 · ${consultationId}`,
              `이름 · ${clientName || "확인 필요"}`,
              `연락처 · ${phone || "확인 필요"}`,
            ],
          },
        ],

        changes,

        executionSteps: [
          "현재 상담정보와 초안 생성 당시 값을 다시 비교합니다.",
          "로그인 사용자의 조직 및 담당 범위를 다시 확인합니다.",
          "승인된 변경 항목만 상담DB에 반영합니다.",
          "AI 실행 결과와 변경 내역을 기록합니다.",
        ],

        missingFields:
          [],

        warnings,

        canConfirm:
          changes.length >
          0,
      },
    };
  },
});

/**
 * 기본 누락 점검
 *
 * 이후 risk.studentDetail 규칙 엔진과 분리할 예정.
 */
registerTool<
  MissingDataAlertToolInput,
  MissingDataAlertToolOutput
>({
  name:
    "alert.missingData",

  description:
    "현재 사용자의 권한 범위 안에서 결제일, 결제금액, 담당자 또는 실습 배정 누락을 점검합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      limit: {
        type:
          "integer",

        description:
          "조회할 최대 누락 항목 수",

        minimum:
          1,

        maximum:
          300,
      },
    },

    required: [],

    additionalProperties:
      false,
  },

  accessMode:
    "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as MissingDataAlertToolInput;

    const limit = normalizeLimit(
      safeInput.limit,
      100,
      300
    );

    const assigneeIds =
      getScopedAssigneeIds(context);

    const [
      students,
      consultations,
    ] = await Promise.all([
      db.listStudents(
        assigneeIds,
        {
          organizationId:
            context.organizationId,
        }
      ),

      db.listConsultations(
  context.allowedAssigneeIds === null
    ? undefined
    : context.allowedAssigneeIds.length === 1
      ? context.allowedAssigneeIds[0]
      : undefined,
  {
    organizationId:
      context.organizationId,

    assigneeIds:
      context.allowedAssigneeIds !== null &&
      context.allowedAssigneeIds.length > 1
        ? context.allowedAssigneeIds
        : undefined,
  }
),
    ]);

    const items: MissingDataAlertToolOutput["items"] =
      [];

    for (const student of (
      students || []
    ) as any[]) {
      if (!student.paymentDate) {
        items.push({
          type: "student_payment_date_missing",
          studentId: Number(
            student.id
          ),
          clientName:
            student.clientName ??
            null,
          assigneeId:
            student.assigneeId
              ? Number(
                  student.assigneeId
                )
              : null,
          message:
            "학생 결제일이 입력되지 않았습니다.",
        });
      }

      const paymentAmount =
        Number(
          student.paymentAmount ||
            0
        );

      if (
        !Number.isFinite(
          paymentAmount
        ) ||
        paymentAmount <= 0
      ) {
        items.push({
          type: "student_payment_amount_missing",
          studentId: Number(
            student.id
          ),
          clientName:
            student.clientName ??
            null,
          assigneeId:
            student.assigneeId
              ? Number(
                  student.assigneeId
                )
              : null,
          message:
            "학생 결제금액이 입력되지 않았습니다.",
        });
      }
    }

    for (const consultation of (
      consultations || []
    ) as any[]) {
      if (
        !consultation.assigneeId ||
        Number(
          consultation.assigneeId
        ) <= 0
      ) {
        items.push({
          type: "consultation_assignee_missing",
          consultationId: Number(
            consultation.id
          ),
          clientName:
            consultation.clientName ??
            null,
          assigneeId: null,
          message:
            "상담DB 담당자가 지정되지 않았습니다.",
        });
      }
    }

    /**
     * 실습 미섭외 항목은 현재 실습 요청 조회 함수 구조가
     * routers.ts에 섞여 있어 2차에서 Tool로 별도 연결한다.
     *
     * 현재는 0건으로 두고 인터페이스만 유지한다.
     */
    const practiceUnassignedCount = 0;

    const paymentDateMissingCount =
      items.filter(
        (item) =>
          item.type ===
          "student_payment_date_missing"
      ).length;

    const paymentAmountMissingCount =
      items.filter(
        (item) =>
          item.type ===
          "student_payment_amount_missing"
      ).length;

    const consultationAssigneeMissingCount =
      items.filter(
        (item) =>
          item.type ===
          "consultation_assignee_missing"
      ).length;

    const totalIssueCount =
      paymentDateMissingCount +
      paymentAmountMissingCount +
      consultationAssigneeMissingCount +
      practiceUnassignedCount;

    return {
      summary: {
        paymentDateMissingCount,
        paymentAmountMissingCount,
        consultationAssigneeMissingCount,
        practiceUnassignedCount,
        totalIssueCount,
      },

      items: items.slice(0, limit),
    };
  },
});

/**
 * 학생 한 명 상세 위험 분석
 */
registerTool<
  StudentDetailRiskToolInput,
  StudentDetailRiskToolOutput
>({
  name: "risk.studentDetail",

  description:
  "현재 사용자가 접근 가능한 학생 한 명의 학위·자격요건·인정과목·남은과목·남은학점·추가수강과목·학기배치·최단기간·구법/신법·실습시간·대면과목·영역별 충족여부·학위신청·학위수여·자격증 예상일정과 플랜·결제·중복과목·실습 위험요소를 공통 규칙엔진으로 종합 분석합니다. 학업·자격 계산 질문은 이 Tool의 academicSummary와 requirements 결과를 사용합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      studentId: {
        type:
          "integer",

        description:
  "학위·자격·과목·학점·학기·행정일정 또는 위험요소를 종합 분석할 확정된 학생 ID",

        minimum:
          1,
      },
    },

    required: [
      "studentId",
    ],

    additionalProperties:
      false,
  },

  accessMode: "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as StudentDetailRiskToolInput;

    const studentId =
      Number(
        safeInput.studentId
      );

    if (
      !Number.isFinite(
        studentId
      ) ||
      studentId <= 0
    ) {
      throw new Error(
        "올바른 학생 ID가 필요합니다."
      );
    }

    return analyzeStudentDetailRisk({
      context,
      studentId,
    });
  },
});

/**
 * 권한 범위 내 학생 전체 위험 점검
 */
registerTool<
  StudentListRiskToolInput,
  StudentListRiskToolOutput
>({
  name: "risk.studentList",

  description:
    "현재 사용자의 권한 범위 안에서 학생 전체의 플랜, 학점, 과목 중복, 결제, 실습 상태를 종합 점검합니다.",

  inputSchema: {
    type:
      "object",

    properties: {
      limit: {
        type:
          "integer",

        description:
          "한 번에 점검할 최대 학생 수",

        minimum:
          1,

        maximum:
          100,
      },

      riskLevel: {
        type:
          "string",

        description:
          "결과에 포함할 위험등급",

        enum: [
          "all",
          "danger",
          "warning",
        ],
      },
    },

    required: [],

    additionalProperties:
      false,
  },

  accessMode: "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as StudentListRiskToolInput;

    const rawLimit =
      Number(
        safeInput.limit
      );

    const limit =
      Number.isFinite(rawLimit) &&
      rawLimit > 0
        ? Math.min(
            Math.floor(rawLimit),
            100
          )
        : 30;

    const riskLevel =
      safeInput.riskLevel ===
        "danger" ||
      safeInput.riskLevel ===
        "warning"
        ? safeInput.riskLevel
        : "all";

    return analyzeStudentListRisk({
      context,
      limit,
      riskLevel,
    });
  },
});

export function listRegisteredAiTools() {
  return Array.from(
    toolRegistry.values()
  ).map(
    (
      tool
    ) => ({
      name:
        tool.name,

      description:
        tool.description,

      inputSchema:
        tool.inputSchema ??
        null,

      accessMode:
        tool.accessMode,

      allowedRoles:
        tool.allowedRoles,

      requiresOrganization:
        tool.requiresOrganization,

      requiresConfirmation:
        tool.requiresConfirmation,

      autoExecutable:
        tool.autoExecutable,
    })
  );
}

export function getAiTool(
  toolName: string
) {
  return toolRegistry.get(toolName);
}

export async function executeAiTool<
  TInput = unknown,
  TOutput = unknown
>(params: {
  toolName: AiToolName | string;
  context: AiUserContext;
  input: TInput;
}): Promise<
  AiToolExecutionResult<TOutput>
> {
  const requestId =
    createAiRequestId();

  const startedAt =
    new Date().toISOString();

  const startedTimestamp =
    Date.now();

  const tool =
    getAiTool(params.toolName);

  if (!tool) {
    const finishedAt =
      new Date().toISOString();

    const durationMs =
      Date.now() -
      startedTimestamp;

    await writeAiAuditLog({
      context: params.context,

      requestId,
      toolName: params.toolName,
      status: "failed",

      input:
  sanitizeAiToolInputForAudit(
    params.input
  ),

      startedAt,
      finishedAt,
      durationMs,

      errorMessage:
        "등록되지 않은 AI Tool입니다.",
    });

    return {
      success: false,
      toolName: params.toolName,

      error: {
        code: "AI_TOOL_NOT_FOUND",
        message:
          "등록되지 않은 AI Tool입니다.",
      },

      meta: {
        requestId,
        startedAt,
        finishedAt,
        durationMs,

        toolName:
          params.toolName,
        status: "failed",

        organizationId:
          params.context
            .organizationId,

        userId:
          params.context.userId,

        userRole:
          params.context.role,

        errorMessage:
          "등록되지 않은 AI Tool입니다.",
      },
    };
  }

  try {
    assertAiToolAllowed({
      context: params.context,
      tool,
    });

    const output =
      await tool.handler({
        context: params.context,
        input: params.input,
        requestId,
      });

    const finishedAt =
      new Date().toISOString();

    const durationMs =
      Date.now() -
      startedTimestamp;

    const outputSummary =
      summarizeAiToolOutput(output);

    await writeAiAuditLog({
      context: params.context,

      requestId,
      toolName: tool.name,
      status: "success",

      input:
  sanitizeAiToolInputForAudit(
    params.input
  ),
      outputSummary,

      targetStudentId:
        Number(
          (params.input as any)
            ?.studentId || 0
        ) || null,

      startedAt,
      finishedAt,
      durationMs,
    });

    return {
      success: true,
      toolName: tool.name,

      data: output as TOutput,

      meta: {
        requestId,
        startedAt,
        finishedAt,
        durationMs,

        toolName: tool.name,
        status: "success",

        organizationId:
          params.context
            .organizationId,

        userId:
          params.context.userId,

        userRole:
          params.context.role,

        targetStudentId:
          Number(
            (params.input as any)
              ?.studentId || 0
          ) || null,
      },
    };
  } catch (error) {
    const finishedAt =
      new Date().toISOString();

    const durationMs =
      Date.now() -
      startedTimestamp;

    const isPermissionError =
      error instanceof
      AiPermissionError;

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    await writeAiAuditLog({
      context: params.context,

      requestId,
      toolName: tool.name,

      status: isPermissionError
        ? "denied"
        : "failed",

      input:
  sanitizeAiToolInputForAudit(
    params.input
  ),

      targetStudentId:
        Number(
          (params.input as any)
            ?.studentId || 0
        ) || null,

      startedAt,
      finishedAt,
      durationMs,

      errorMessage,
    });

    return {
      success: false,
      toolName: tool.name,

      error: {
        code: isPermissionError
          ? "AI_PERMISSION_DENIED"
          : "AI_TOOL_EXECUTION_FAILED",

        message: errorMessage,
      },

      meta: {
        requestId,
        startedAt,
        finishedAt,
        durationMs,

        toolName: tool.name,

        status: isPermissionError
          ? "denied"
          : "failed",

        organizationId:
          params.context
            .organizationId,

        userId:
          params.context.userId,

        userRole:
          params.context.role,

        targetStudentId:
          Number(
            (params.input as any)
              ?.studentId || 0
          ) || null,

        errorMessage,
      },
    };
  }
}