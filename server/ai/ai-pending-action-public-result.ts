/**
 * AI Pending Action JSON 컬럼을
 * 안전하게 객체/배열로 변환한다.
 *
 * DB Driver에 따라 JSON 컬럼이
 * 이미 object 상태일 수도 있고
 * 문자열 상태일 수도 있으므로
 * 두 경우를 모두 처리한다.
 */
function parseAiPendingJson<T>(
  value: unknown,
  fallback: T
): T {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  if (
    typeof value === "object"
  ) {
    return value as T;
  }

  try {
    return JSON.parse(
      String(value)
    ) as T;
  } catch {
    return fallback;
  }
}

/**
 * DB의 AI Pending Action Row를
 * 클라이언트에 반환할 공개 형태로 변환한다.
 *
 * preview / missingFields / warnings /
 * executionResult JSON을 정규화하고,
 * 숫자 ID와 배열 값도 안전하게 변환한다.
 */
export function toAiPendingActionPublicResult(
  row: any
) {
  if (!row) {
    return null;
  }

  const preview =
    parseAiPendingJson(
      row.previewJson,
      {
        title: "",
        summary: "",
        sections: [],
        changes: [],
        executionSteps: [],
        missingFields: [],
        warnings: [],
        canConfirm: false,
      }
    );

  const missingFields =
    parseAiPendingJson<string[]>(
      row.missingFieldsJson,
      []
    );

  const warnings =
    parseAiPendingJson<string[]>(
      row.warningsJson,
      []
    );

  const executionResult =
    parseAiPendingJson<{
      pendingActionId?: number;

      status?: string;

      consultationId?:
        number |
        null;

      studentId?:
        number |
        null;

      studentDetailPath?:
        string |
        null;

      scheduleId?:
        number |
        null;

      planId?:
        number |
        null;

      semesterId?:
        number |
        null;

      semesterIds?:
        number[];

      semesterOrder?:
        number |
        null;

      isCompleted?:
        boolean;

      approvalStatus?:
        string |
        null;

      planSubjectIds?:
        number[];

      transferSubjectIds?:
        number[];

      practiceSaved?:
        boolean;

      paymentUpdated?:
        boolean;

      completedSteps?:
        string[];

      failedSteps?:
        string[];

      message?:
        string;
    } | null>(
      row.executionResultJson,
      null
    );

  return {
    id:
      Number(
        row.id
      ),

    actionType:
      row.actionType,

    status:
      row.status,

    consultationId:
      row.consultationId === null ||
      row.consultationId === undefined
        ? null
        : Number(
            row.consultationId
          ),

    studentId:
      row.studentId === null ||
      row.studentId === undefined
        ? null
        : Number(
            row.studentId
          ),

    semesterId:
      row.semesterId === null ||
      row.semesterId === undefined
        ? null
        : Number(
            row.semesterId
          ),

    preview: {
      ...preview,

      /**
       * 별도 컬럼을 최종 기준으로 사용한다.
       */
      missingFields,

      warnings,

      canConfirm:
        row.status ===
          "awaiting_confirmation" &&
        missingFields.length ===
          0 &&
        preview?.canConfirm ===
          true,
    },

    version:
      Number(
        row.version ||
        1
      ),

    expiresAt:
      row.expiresAt ??
      null,

    confirmedAt:
      row.confirmedAt ??
      null,

    executedAt:
      row.executedAt ??
      null,

    cancelledAt:
      row.cancelledAt ??
      null,

    failedAt:
      row.failedAt ??
      null,

    errorMessage:
      row.status ===
        "failed"
        ? row.errorMessage ??
          null
        : null,

    executionResult:
      row.status ===
        "executed" ||
      row.status ===
        "failed"
        ? executionResult
          ? {
              ...executionResult,

              consultationId:
                executionResult
                  .consultationId ===
                  null ||
                executionResult
                  .consultationId ===
                  undefined
                  ? null
                  : Number(
                      executionResult
                        .consultationId
                    ),

              studentId:
                executionResult
                  .studentId ===
                  null ||
                executionResult
                  .studentId ===
                  undefined
                  ? null
                  : Number(
                      executionResult
                        .studentId
                    ),

              studentDetailPath:
                typeof executionResult
                  .studentDetailPath ===
                  "string" &&
                executionResult
                  .studentDetailPath
                  .trim()
                  ? executionResult
                      .studentDetailPath
                      .trim()
                  : executionResult
                      .studentId !==
                      null &&
                    executionResult
                      .studentId !==
                      undefined &&
                    Number(
                      executionResult
                        .studentId
                    ) > 0
                    ? `/students/${Number(
                        executionResult
                          .studentId
                      )}`
                    : null,

              scheduleId:
                executionResult
                  .scheduleId ===
                  null ||
                executionResult
                  .scheduleId ===
                  undefined
                  ? null
                  : Number(
                      executionResult
                        .scheduleId
                    ),

              planId:
                executionResult
                  .planId ===
                  null ||
                executionResult
                  .planId ===
                  undefined
                  ? null
                  : Number(
                      executionResult
                        .planId
                    ),

              semesterId:
                executionResult
                  .semesterId ===
                  null ||
                executionResult
                  .semesterId ===
                  undefined
                  ? Array.isArray(
                      executionResult
                        .semesterIds
                    ) &&
                    executionResult
                      .semesterIds
                      .length > 0
                    ? Number(
                        executionResult
                          .semesterIds[0]
                      ) ||
                      null
                    : null
                  : Number(
                      executionResult
                        .semesterId
                    ),

              semesterIds:
                Array.isArray(
                  executionResult
                    .semesterIds
                )
                  ? Array.from(
                      new Set(
                        executionResult
                          .semesterIds
                          .map(
                            Number
                          )
                          .filter(
                            (
                              id
                            ) =>
                              Number.isFinite(
                                id
                              ) &&
                              id > 0
                          )
                      )
                    )
                  : [],

              semesterOrder:
                executionResult
                  .semesterOrder ===
                  null ||
                executionResult
                  .semesterOrder ===
                  undefined
                  ? null
                  : Number.isFinite(
                      Number(
                        executionResult
                          .semesterOrder
                      )
                    ) &&
                    Number(
                      executionResult
                        .semesterOrder
                    ) > 0
                    ? Math.floor(
                        Number(
                          executionResult
                            .semesterOrder
                        )
                      )
                    : null,

              isCompleted:
                executionResult
                  .isCompleted ===
                true,

              approvalStatus:
                typeof executionResult
                  .approvalStatus ===
                  "string" &&
                executionResult
                  .approvalStatus
                  .trim()
                  ? executionResult
                      .approvalStatus
                      .trim()
                  : null,

              planSubjectIds:
                Array.isArray(
                  executionResult
                    .planSubjectIds
                )
                  ? Array.from(
                      new Set(
                        executionResult
                          .planSubjectIds
                          .map(
                            Number
                          )
                          .filter(
                            (
                              id
                            ) =>
                              Number.isFinite(
                                id
                              ) &&
                              id > 0
                          )
                      )
                    )
                  : [],

              transferSubjectIds:
                Array.isArray(
                  executionResult
                    .transferSubjectIds
                )
                  ? Array.from(
                      new Set(
                        executionResult
                          .transferSubjectIds
                          .map(
                            Number
                          )
                          .filter(
                            (
                              id
                            ) =>
                              Number.isFinite(
                                id
                              ) &&
                              id > 0
                          )
                      )
                    )
                  : [],

              practiceSaved:
                executionResult
                  .practiceSaved ===
                true,

              paymentUpdated:
                executionResult
                  .paymentUpdated ===
                true,
            }
          : null
        : null,

    createdAt:
      row.createdAt ??
      null,

    updatedAt:
      row.updatedAt ??
      null,
  };
}