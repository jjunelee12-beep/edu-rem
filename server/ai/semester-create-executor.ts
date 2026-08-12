import * as db from "../db";

import {
  assertCanAccessStudent,
  assertCanWriteStudent,
} from "./ai-permission";

import type {
  AiUserContext,
  SemesterCreateDraft,
} from "./ai.types";

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

function normalizeNonNegativeInteger(
  value:
    unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalized =
    Number(
      value
    );

  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized < 0
  ) {
    return null;
  }

  return Math.floor(
    normalized
  );
}

function normalizeNonNegativeAmount(
  value:
    unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalized =
    Number(
      String(
        value
      )
        .replace(
          /,/g,
          ""
        )
        .trim()
    );

  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized < 0
  ) {
    return null;
  }

  return normalized;
}

function normalizeNullableText(
  value:
    unknown,

  maxLength:
    number
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalized =
    String(
      value
    )
      .trim()
      .slice(
        0,
        maxLength
      );

  return normalized ||
    null;
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

  const normalized =
    String(
      value
    ).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalized
    )
  ) {
    throw new Error(
      "학기 날짜는 YYYY-MM-DD 형식이어야 합니다."
    );
  }

  const matched =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!matched) {
    throw new Error(
      "학기 날짜 형식이 올바르지 않습니다."
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
      "학기 날짜가 올바르지 않습니다."
    );
  }

  return normalized;
}

function normalizePlannedMonth(
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
    String(
      value
    )
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

function parseJsonRecord(
  value:
    unknown
): Record<
  string,
  any
> {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  ) {
    return value as Record<
      string,
      any
    >;
  }

  if (
    typeof value !==
      "string"
  ) {
    return {};
  }

  try {
    const parsed =
      JSON.parse(
        value
      );

    if (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(
        parsed
      )
    ) {
      return parsed as Record<
        string,
        any
      >;
    }
  } catch {
    return {};
  }

  return {};
}

function normalizeSemesterLabel(
  value:
    unknown
): string {
  const normalized =
    String(
      value ||
      ""
    )
      .trim()
      .slice(
        0,
        100
      );

  if (!normalized) {
    throw new Error(
      "생성할 학기 구분이 없습니다."
    );
  }

  return normalized;
}

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

  const month =
    Number(
      plannedMonthNormalized.slice(
        4,
        6
      )
    );

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
          month ===
            11 ||
          month ===
            12
        )
      ) ||
      (
        plannedYear ===
          semesterYear &&
        month >=
          1 &&
        month <=
          5
      )
    );
  }

  if (
    semesterHalf ===
    2
  ) {
    return (
      plannedYear ===
        semesterYear &&
      month >=
        5 &&
      month <=
        11
    );
  }

  return false;
}

export async function executeSemesterCreatePendingAction(
  params: {
    pendingActionId:
      number;

    expectedVersion:
      number;

    /**
     * Router에서 buildAiContext()로 생성한
     * 실제 서버 권한 Context다.
     *
     * 조직, 사용자, 권한값을
     * 프론트 입력으로 받지 않는다.
     */
    context:
      AiUserContext;
  }
) {
  const pendingActionId =
    normalizePositiveInteger(
      params.pendingActionId
    );

  const expectedVersion =
    normalizePositiveInteger(
      params.expectedVersion
    );

  const context =
    params.context;

  const organizationId =
    normalizePositiveInteger(
      context.organizationId
    );

  const requestedByUserId =
    normalizePositiveInteger(
      context.userId
    );

  const confirmedByUserId =
    normalizePositiveInteger(
      context.userId
    );

  if (
    !pendingActionId ||
    !expectedVersion ||
    !organizationId ||
    !requestedByUserId ||
    !confirmedByUserId
  ) {
    throw new Error(
      "학기 생성 승인 실행 정보가 올바르지 않습니다."
    );
  }

  /**
   * Pending Action을 원자적으로 executing 상태로 전환한다.
   *
   * 중복 클릭과 동시에 들어온 승인 요청을 차단한다.
   */
  const claimed =
    await db.claimAiPendingActionForExecution({
      id:
        pendingActionId,

      organizationId,

      requestedByUserId,

      confirmedByUserId,

      expectedVersion,
    });

  if (!claimed) {
    throw new Error(
      "학기 생성 승인 초안을 실행할 수 없습니다."
    );
  }

  const pendingAction =
    claimed.action;

  if (!pendingAction) {
    throw new Error(
      "학기 생성 승인 초안을 찾을 수 없습니다."
    );
  }

  /**
   * 이미 실행된 작업이면 학기를 다시 만들지 않는다.
   */
  if (
    claimed.alreadyExecuted ===
    true
  ) {
    const executionResult =
      parseJsonRecord(
        pendingAction
          .executionResultJson
      );

    const semesterIds =
      Array.isArray(
        executionResult
          .semesterIds
      )
        ? executionResult
            .semesterIds
            .map(
              normalizePositiveInteger
            )
            .filter(
              Boolean
            )
        : [];

    const semesterId =
      normalizePositiveInteger(
        executionResult
          .semesterId
      ) ||
      semesterIds[0] ||
      normalizePositiveInteger(
        pendingAction
          .semesterId
      ) ||
      null;

    return {
      success:
        true,

      alreadyExecuted:
        true,

      executing:
        false,

      studentId:
        normalizePositiveInteger(
          executionResult
            .studentId ??
          pendingAction
            .studentId
        ) ||
        null,

      semesterId,

planSubjectIds:
  Array.isArray(
    executionResult
      .planSubjectIds
  )
    ? executionResult
        .planSubjectIds
        .map(
          normalizePositiveInteger
        )
        .filter(
          Boolean
        )
    : [],

      pendingAction,

      message:
        String(
          executionResult
            .message ||
          "이미 생성된 학기입니다."
        ),
    };
  }

  /**
   * 다른 요청이 실행 중이면 중복 실행하지 않는다.
   */
  if (
    claimed.claimed !==
      true
  ) {
    return {
      success:
        true,

      alreadyExecuted:
        false,

      executing:
        true,

      studentId:
        normalizePositiveInteger(
          pendingAction
            .studentId
        ) ||
        null,

      semesterId:
        normalizePositiveInteger(
          pendingAction
            .semesterId
        ) ||
        null,

planSubjectIds:
  [],

      pendingAction,

      message:
        "학생 학기를 생성하고 있습니다.",
    };
  }

  const completedSteps:
    string[] = [];

  try {
    if (
      String(
        pendingAction
          .actionType ||
        ""
      ) !==
      "semester_create"
    ) {
      throw new Error(
        "학기 생성 승인 초안이 아닙니다."
      );
    }

    completedSteps.push(
      "승인 작업 종류 확인"
    );

    const payload =
      parseJsonRecord(
        pendingAction
          .payloadJson
      );

    const draftSource =
      parseJsonRecord(
        payload.draft ??
        payload
      );

    const draft =
      draftSource as
        Partial<
          SemesterCreateDraft
        >;

    const studentId =
      normalizePositiveInteger(
        draft.studentId ??
        pendingAction
          .studentId
      );

    if (!studentId) {
      throw new Error(
        "학기를 생성할 학생 정보가 없습니다."
      );
    }

    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId,
        }
      );

    if (!student) {
      throw new Error(
        "학기를 생성할 학생을 찾을 수 없습니다."
      );
    }

    /**
     * 현재 로그인 사용자가 해당 학생을
     * 조회할 수 있는지 다시 검사한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    completedSteps.push(
      "학생 조회권한 확인"
    );

    /**
     * 초안 생성 이후 담당자가 변경됐을 수 있으므로
     * 현재 담당자 기준으로 쓰기 권한을 다시 검사한다.
     */
    assertCanWriteStudent({
      context,
      student,
    });

    completedSteps.push(
      "학생 담당자 학기생성 권한 확인"
    );

    /**
     * 초안에 저장한 담당자와 현재 담당자를 비교한다.
     *
     * 권한검사만으로도 쓰기는 제한되지만,
     * 초안 생성 이후 담당자 변경 여부를
     * 사용자에게 명확히 알려주기 위한 추가 검사다.
     */
    const draftAssigneeId =
      normalizePositiveInteger(
        draft.assigneeId
      );

    const currentAssigneeId =
      normalizePositiveInteger(
        (student as any)
          .assigneeId
      );

    if (
      !draftAssigneeId ||
      !currentAssigneeId ||
      draftAssigneeId !==
        currentAssigneeId
    ) {
      throw new Error(
        "학기 생성 초안 이후 학생 담당자가 변경되었습니다. 최신 학생 정보를 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "학생 담당자 변경 여부 확인"
    );

    const semesterOrder =
      normalizePositiveInteger(
        draft.semesterOrder
      );

    if (
      !semesterOrder ||
      semesterOrder > 20
    ) {
      throw new Error(
        "생성할 학기 순서가 올바르지 않습니다."
      );
    }

    const semesterLabel =
      normalizeSemesterLabel(
        draft.semesterLabel
      );

    const originalLastSemesterOrder =
      Number(
        draft.originalLastSemesterOrder ??
        0
      );

    if (
      !Number.isFinite(
        originalLastSemesterOrder
      ) ||
      originalLastSemesterOrder < 0
    ) {
      throw new Error(
        "초안의 기존 마지막 학기 정보가 올바르지 않습니다."
      );
    }

    const normalizedOriginalLastSemesterOrder =
      Math.floor(
        originalLastSemesterOrder
      );

    const originalLastSemesterLabel =
      normalizeNullableText(
        draft.originalLastSemesterLabel,
        100
      );

    /**
     * 승인 실행 시점에 학생의 전체 학기를 다시 조회한다.
     */
    const currentSemesters =
      await db.listSemesters(
        studentId,
        {
          organizationId,
        }
      );

    const sortedCurrentSemesters =
      [
        ...(
          Array.isArray(
            currentSemesters
          )
            ? currentSemesters
            : []
        ),
      ].sort(
        (
          left:
            any,
          right:
            any
        ) =>
          Number(
            left?.semesterOrder ||
            0
          ) -
          Number(
            right?.semesterOrder ||
            0
          )
      );

    const currentLastSemester =
      sortedCurrentSemesters.length >
        0
        ? sortedCurrentSemesters[
            sortedCurrentSemesters.length -
            1
          ]
        : null;

    const currentLastSemesterOrder =
      normalizePositiveInteger(
        currentLastSemester
          ?.semesterOrder
      ) ||
      0;

    const currentLastSemesterLabel =
      normalizeNullableText(
        currentLastSemester
          ?.semesterLabel,
        100
      );

    /**
     * 초안 생성 이후 다른 사용자가 학기를 추가했다면
     * 오래된 초안을 실행하지 않는다.
     */
        if (
      currentLastSemesterOrder !==
      normalizedOriginalLastSemesterOrder
    ) {
      throw new Error(
        "학기 생성 초안 이후 학생의 학기 순서가 변경되었습니다. 최신 학기 정보를 다시 확인해주세요."
      );
    }

    if (
      currentLastSemesterLabel !==
      originalLastSemesterLabel
    ) {
      throw new Error(
        "학기 생성 초안 이후 학생의 마지막 학기 구분이 변경되었습니다. 최신 학기 정보를 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "기존 학기 순서 및 학기 구분 변경 충돌 검사"
    );

    const expectedNextSemesterOrder =
      currentLastSemesterOrder +
      1;

    if (
      semesterOrder !==
      expectedNextSemesterOrder
    ) {
      throw new Error(
        `다음 학기 순서는 ${expectedNextSemesterOrder}이어야 합니다.`
      );
    }

    let expectedNextSemesterLabel:
      string |
      null =
      null;

    if (
      currentLastSemesterLabel
    ) {
      const currentLastSemesterLabelMatched =
        currentLastSemesterLabel.match(
          /^(\d{4})년\s*([12])학기$/
        );

      if (
        !currentLastSemesterLabelMatched
      ) {
        throw new Error(
          "현재 마지막 학기 구분을 해석할 수 없습니다. 기존 학기 정보를 먼저 확인해주세요."
        );
      }

      const currentLastSemesterYear =
        Number(
          currentLastSemesterLabelMatched[1]
        );

      const currentLastSemesterHalf =
        Number(
          currentLastSemesterLabelMatched[2]
        );

      expectedNextSemesterLabel =
        currentLastSemesterHalf ===
          1
          ? `${currentLastSemesterYear}년 2학기`
          : `${currentLastSemesterYear + 1}년 1학기`;
    }

    if (
      expectedNextSemesterLabel &&
      semesterLabel !==
        expectedNextSemesterLabel
    ) {
      throw new Error(
        `현재 마지막 학기 기준 다음 학기 구분은 ${expectedNextSemesterLabel}이어야 합니다.`
      );
    }

    if (
      !currentLastSemester &&
      originalLastSemesterLabel !==
        null
    ) {
      throw new Error(
        "첫 학기 생성 초안의 기존 마지막 학기 정보가 올바르지 않습니다."
      );
    }

    /**
     * 동일 학기 순서 및 학기 구분 중복을 다시 검사한다.
     */
    const duplicatedOrder =
      sortedCurrentSemesters.some(
        (
          semester:
            any
        ) =>
          Number(
            semester?.semesterOrder ||
            0
          ) ===
          semesterOrder
      );

    if (
      duplicatedOrder
    ) {
      throw new Error(
        `${semesterOrder}학기가 이미 등록되어 있습니다.`
      );
    }

    const normalizedSemesterLabel =
      semesterLabel
        .replace(
          /\s+/g,
          ""
        )
        .toLowerCase();

    const duplicatedLabel =
      sortedCurrentSemesters.some(
        (
          semester:
            any
        ) =>
          String(
            semester?.semesterLabel ||
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
      duplicatedLabel
    ) {
      throw new Error(
        `${semesterLabel} 학기가 이미 등록되어 있습니다.`
      );
    }

    completedSteps.push(
      "학기 순서 및 중복 검사"
    );

    const plannedMonth =
      normalizePlannedMonth(
        draft.plannedMonth
      );

if (
  !plannedMonth
) {
  throw new Error(
    "예정 개강월이 없어 학기 생성을 실행할 수 없습니다."
  );
}

if (
  !isPlannedMonthCompatibleWithSemesterLabel(
    semesterLabel,
    plannedMonth
  )
) {
  throw new Error(
    `${semesterLabel} 귀속과 예정 개강월 ${plannedMonth}의 학기 구성이 맞지 않습니다. 최신 개강일정을 다시 확인해주세요.`
  );
}

completedSteps.push(
  "학기 귀속 및 예정 개강월 재검증"
);

    const plannedInstitution =
      normalizeNullableText(
        draft.plannedInstitution,
        255
      );

    const plannedSubjectCount =
      normalizeNonNegativeInteger(
        draft.plannedSubjectCount
      );

    if (
      plannedSubjectCount !==
        null &&
      plannedSubjectCount > 50
    ) {
      throw new Error(
        "예정 과목 수는 50개를 초과할 수 없습니다."
      );
    }

if (
  plannedSubjectCount ===
  null
) {
  throw new Error(
    "예정 과목 수가 없어 학기 생성을 실행할 수 없습니다."
  );
}

if (
  plannedSubjectCount >
  8
) {
  throw new Error(
    `한 학기에는 최대 8과목까지만 등록할 수 있습니다. 현재 ${plannedSubjectCount}과목입니다.`
  );
}

    /**
     * ─────────────────────────────
     * 연간 최대 14과목 재검증
     * ─────────────────────────────
     *
     * 초안 생성 시점이 아니라
     * 실제 승인 실행 시점의 현재 학기 데이터를
     * 다시 조회하여 계산한다.
     *
     * 동일 연도의 1학기 + 2학기를 합쳐
     * 최대 14과목까지만 허용한다.
     *
     * 예:
     *
     * 2027년 1학기 8과목
     * +
     * 2027년 2학기 6과목
     * =
     * 14과목 가능
     *
     * 2027년 1학기 8과목
     * +
     * 2027년 2학기 7과목
     * =
     * 15과목 → 차단
     */
    const semesterLabelMatched =
      semesterLabel.match(
        /^(\d{4})년\s*([12])학기$/
      );

    if (
      !semesterLabelMatched
    ) {
      throw new Error(
        "학기 구분을 해석할 수 없어 연간 과목 수를 검증할 수 없습니다."
      );
    }

    const semesterYear =
      Number(
        semesterLabelMatched[1]
      );

    if (
      !Number.isFinite(
        semesterYear
      ) ||
      semesterYear <
        2000 ||
      semesterYear >
        2100
    ) {
      throw new Error(
        "학기 구분의 연도 정보가 올바르지 않습니다."
      );
    }

    /**
     * 현재 학생에게 이미 등록되어 있는
     * 동일 귀속연도 학기의 과목 수를 합산한다.
     *
     * 실제 과목 수가 있으면 실제 과목 수를 우선하고,
     * 없으면 예정 과목 수를 사용한다.
     */
    const sameYearExistingSubjectCount =
      sortedCurrentSemesters
        .filter(
          (
            semester:
              any
          ) => {
            const currentSemesterLabel =
              String(
                semester
                  ?.semesterLabel ||
                ""
              ).trim();

            const currentSemesterMatched =
              currentSemesterLabel.match(
                /^(\d{4})년\s*([12])학기$/
              );

            return (
              currentSemesterMatched !==
                null &&
              Number(
                currentSemesterMatched[1]
              ) ===
                semesterYear
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
            const actualSubjectCount =
              semester
                ?.actualSubjectCount;

            const existingPlannedSubjectCount =
              semester
                ?.plannedSubjectCount;

            const resolvedSubjectCount =
              actualSubjectCount !==
                null &&
              actualSubjectCount !==
                undefined
                ? Number(
                    actualSubjectCount
                  )
                : existingPlannedSubjectCount !==
                    null &&
                  existingPlannedSubjectCount !==
                    undefined
                  ? Number(
                      existingPlannedSubjectCount
                    )
                  : 0;

            if (
              !Number.isFinite(
                resolvedSubjectCount
              ) ||
              resolvedSubjectCount <=
                0
            ) {
              return total;
            }

            return (
              total +
              Math.floor(
                resolvedSubjectCount
              )
            );
          },
          0
        );

    const nextAnnualSubjectCount =
      sameYearExistingSubjectCount +
      plannedSubjectCount;

    if (
      nextAnnualSubjectCount >
      14
    ) {
      throw new Error(
        `${semesterYear}년 기존 ${sameYearExistingSubjectCount}과목에 이번 ${plannedSubjectCount}과목을 추가하면 연간 총 ${nextAnnualSubjectCount}과목으로 14과목 제한을 초과합니다.`
      );
    }

    completedSteps.push(
      "한 학기 8과목 및 연간 14과목 제한 재검증"
    );

    const plannedAmount =
      normalizeNonNegativeAmount(
        draft.plannedAmount
      );

    const startDate =
      normalizeSemesterDate(
        draft.startDate
      );

    const institution =
      normalizeNullableText(
        draft.institution,
        255
      );

    const subjectCount =
      normalizeNonNegativeInteger(
        draft.subjectCount
      );

    if (
      subjectCount !== null &&
      subjectCount > 50
    ) {
      throw new Error(
        "실제 과목 수는 50개를 초과할 수 없습니다."
      );
    }

    const paymentAmount =
      normalizeNonNegativeAmount(
        draft.paymentAmount
      );

    const paymentDate =
      normalizeSemesterDate(
        draft.paymentDate
      );

        /**
     * 학기 생성, 예정 과목 자리 생성,
     * Pending Action executed 처리를
     * 하나의 DB 트랜잭션으로 실행한다.
     */
    const transactionResult =
      await db.executeSemesterCreateTransaction({
        organizationId,

        pendingActionId,

        requestedByUserId,

        confirmedByUserId,

        expectedVersion,

        studentId,

        expectedAssigneeId:
          draftAssigneeId,

                originalLastSemesterOrder:
          normalizedOriginalLastSemesterOrder,

        originalLastSemesterLabel,

        semesterOrder,

        semesterLabel,

        plannedMonth,

        plannedInstitution,

        plannedSubjectCount,

        plannedAmount,

        actualStartDate:
          startDate
            ? new Date(
                `${startDate}T00:00:00`
              )
            : null,

        actualInstitution:
          institution,

        actualSubjectCount:
          subjectCount,

        actualAmount:
          paymentAmount,

        actualPaymentDate:
          paymentDate
            ? new Date(
                `${paymentDate}T00:00:00`
              )
            : null,

        actorUserId:
          confirmedByUserId,

        actorName:
          context.userName ??
          null,

        actorRole:
          context.role,
      });

    completedSteps.push(
      ...transactionResult
        .completedSteps
    );

    const semesterId =
      normalizePositiveInteger(
        transactionResult
          .semesterId
      );

    if (
      !semesterId
    ) {
      throw new Error(
        "학기 생성 트랜잭션 결과에서 학기 ID를 확인하지 못했습니다."
      );
    }

    const executedPendingAction =
      transactionResult
        .pendingAction;

    if (
      !executedPendingAction
    ) {
      throw new Error(
        "실행 완료된 학기 생성 승인 요청을 확인하지 못했습니다."
      );
    }

    /**
     * 실제 생성된 학기를 다시 조회한다.
     *
     * 이 조회는 화면 반환용이며,
     * 실패해도 학기와 Pending Action 저장은
     * 이미 트랜잭션으로 완료된 상태다.
     */
    let createdSemester:
      any =
      null;

    try {
      createdSemester =
        await db.getSemester(
          semesterId,
          {
            organizationId,
          }
        );
    } catch (
      semesterReadError
    ) {
      console.error(
        "[AI SEMESTER CREATE] 생성 학기 재조회 실패",
        {
          pendingActionId,

          organizationId,

          studentId,

          semesterId,

          message:
            semesterReadError instanceof
              Error
              ? String(
                  semesterReadError.message ||
                  "알 수 없는 오류"
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim()
                  .slice(
                    0,
                    300
                  )
              : "알 수 없는 오류",
        }
      );
    }

    /**
     * 학기 생성 감사로그
     *
     * 학기 생성과 Pending Action 완료는
     * 이미 트랜잭션에서 성공했다.
     *
     * 감사로그 실패가 실제 학기 생성 결과를
     * 실패로 변경하지 않도록 별도 처리한다.
     */
    try {
      await db.createStudentAuditLog({
        organizationId,

        studentId,

        entityType:
          "semester",

        entityId:
          semesterId,

        action:
          "create",

        title:
          "AI 학생 학기 생성",

        beforeJson:
          null,

        afterJson: {
          id:
            semesterId,

          semesterOrder,

          semesterLabel,

          plannedMonth,

          plannedInstitution,

          plannedSubjectCount,

          plannedAmount,

          actualStartDate:
            startDate,

          actualInstitution:
            institution,

          actualSubjectCount:
            subjectCount,

          actualAmount:
            paymentAmount,

          actualPaymentDate:
            paymentDate,

          status:
            "등록",

          approvalStatus:
            "요청전",

          practiceStatus:
            "미섭외",

          planSubjectIds:
            transactionResult
              .planSubjectIds,
        },

        diffJson: {
          semester: {
            before:
              null,

            after: {
              id:
                semesterId,

              semesterOrder,

              semesterLabel,
            },
          },
        },

        actorUserId:
          confirmedByUserId,

        actorName:
          context.userName ??
          null,

        actorRole:
          context.role,

        ipAddress:
          null,

        userAgent:
          null,
      } as any);

      completedSteps.push(
        "학기 생성 감사로그 기록"
      );
    } catch (
      auditLogError
    ) {
      completedSteps.push(
        "학기 생성 완료 - 감사로그 기록 실패"
      );

      console.error(
        "[AI SEMESTER CREATE] 감사로그 저장 실패",
        {
          pendingActionId,

          organizationId,

          studentId,

          semesterId,

          message:
            auditLogError instanceof
              Error
              ? String(
                  auditLogError.message ||
                  "알 수 없는 오류"
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim()
                  .slice(
                    0,
                    300
                  )
              : "알 수 없는 오류",
        }
      );
    }

    return {
      success:
        true,

      alreadyExecuted:
        false,

      executing:
        false,

      studentId,

      semesterId,

      semester:
        createdSemester,

      planSubjectIds:
        transactionResult
          .planSubjectIds,

      pendingAction:
        executedPendingAction,

      message:
        transactionResult
          .message,
    };
    
  } catch (
    error
  ) {
    const message =
      error instanceof
        Error
        ? error.message
        : "학생 학기 생성에 실패했습니다.";

        try {
      const latestPendingAction =
        await db.getAiPendingActionForConfirmation({
          id:
            pendingActionId,

          organizationId,

          requestedByUserId,
        });

      /**
       * 트랜잭션에서 이미 executed 처리가 끝났다면
       * 후속 조회나 감사로그 오류로 인해
       * failed 상태로 되돌리지 않는다.
       */
      if (
        latestPendingAction?.status !==
          "executed"
      ) {
        await db.markAiPendingActionFailed({
          id:
            pendingActionId,

          organizationId,

          requestedByUserId,

          expectedVersion,

          errorMessage:
            message,

          completedSteps,

          failedSteps: [
            message,
          ],
        });
      }
    } catch {
      /**
       * 실패 상태 저장 오류가 발생해도
       * 최초 학기 생성 오류를 유지한다.
       */
    }

    throw error;
  }
}