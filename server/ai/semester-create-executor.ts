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

    /**
     * 초안 생성 이후 다른 사용자가 학기를 추가했다면
     * 오래된 초안을 실행하지 않는다.
     */
    if (
      currentLastSemesterOrder !==
      normalizedOriginalLastSemesterOrder
    ) {
      throw new Error(
        "학기 생성 초안 이후 학생의 학기 정보가 변경되었습니다. 최신 학기 정보를 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "기존 학기 변경 충돌 검사"
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
     * 기존 학기 Router의 컬럼 이름을 그대로 사용한다.
     *
     * 실제 개강·결제 관련 컬럼은
     * actualStartDate, actualInstitution,
     * actualSubjectCount, actualAmount,
     * actualPaymentDate다.
     */
    const semesterIdRaw =
      await db.createSemester({
        organizationId,

        studentId,

        semesterOrder,

        semesterLabel,

        plannedMonth:
          plannedMonth ??
          undefined,

        plannedInstitution:
          plannedInstitution ??
          undefined,

        plannedSubjectCount:
          plannedSubjectCount ??
          undefined,

        plannedAmount:
          plannedAmount ===
          null
            ? undefined
            : String(
                plannedAmount
              ),

        actualStartDate:
          startDate
            ? new Date(
                `${startDate}T00:00:00`
              )
            : undefined,

        actualInstitution:
          institution ??
          undefined,

        actualSubjectCount:
          subjectCount ??
          undefined,

        actualAmount:
          paymentAmount ===
          null
            ? undefined
            : String(
                paymentAmount
              ),

        actualPaymentDate:
          paymentDate
            ? new Date(
                `${paymentDate}T00:00:00`
              )
            : undefined,

        status:
          "등록",

        practiceStatus:
          "미섭외",

        primaryCourse:
          String(
            (student as any)
              .course ||
            ""
          ).trim() ||
          undefined,
      } as any);

    const semesterId =
      normalizePositiveInteger(
        semesterIdRaw
      );

    if (!semesterId) {
      throw new Error(
        "학기 생성 후 학기 ID를 확인하지 못했습니다."
      );
    }

    completedSteps.push(
      "학생 학기 생성"
    );

    /**
     * 예정 과목 수가 입력됐다면
     * 기존 일반 학기 생성 Router와 동일하게
     * 플랜 학기 과목 자리 수를 동기화한다.
     */
    if (
      plannedSubjectCount !==
        null &&
      plannedSubjectCount > 0
    ) {
      await db.syncPlanSemestersByCount(
        studentId,
        semesterOrder,
        plannedSubjectCount,
        {
          organizationId,
        }
      );

      completedSteps.push(
        "예정 과목 수 플랜 동기화"
      );
    }

    const createdSemester =
      await db.getSemester(
        semesterId,
        {
          organizationId,
        }
      );

    if (!createdSemester) {
      throw new Error(
        "생성된 학기 정보를 다시 확인할 수 없습니다."
      );
    }

    completedSteps.push(
      "생성 결과 재조회"
    );

    /**
     * 학기 생성 감사로그를 저장한다.
     *
     * 실제 학기 생성이 성공한 뒤 감사로그만 실패해도
     * 학기를 되돌리지 않고 작업은 성공 처리한다.
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

          practiceStatus:
            "미섭외",
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
          requestedByUserId,

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
    } catch {
      completedSteps.push(
        "학기 생성 완료 - 감사로그 기록 실패"
      );
    }

    const successMessage =
      `${semesterLabel} 학기가 생성되었습니다.`;

    /**
     * claim 함수는 version을 증가시키지 않으므로
     * 기존 expectedVersion을 그대로 사용한다.
     */
    const completed =
      await db.markAiPendingActionExecuted({
        id:
          pendingActionId,

        organizationId,

        requestedByUserId,

        expectedVersion,

        studentId,

        scheduleId:
          null,

        planId:
          null,

        semesterIds: [
          semesterId,
        ],

        planSubjectIds:
          [],

        transferSubjectIds:
          [],

        practiceSaved:
          false,

        paymentUpdated:
          false,

        completedSteps,

        failedSteps:
          [],

        message:
          successMessage,
      });

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

      pendingAction:
        completed,

      message:
        successMessage,
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
    } catch {
      /**
       * 실패 상태 저장 오류가 발생해도
       * 실제 학기 생성 오류를 유지한다.
       */
    }

    throw error;
  }
}