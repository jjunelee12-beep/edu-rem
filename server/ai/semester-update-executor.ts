import * as db from "../db";

import {
  assertCanAccessStudent,
  assertCanWriteStudent,
} from "./ai-permission";

import type {
  AiUserContext,
  SemesterUpdateDraft,
  SemesterUpdateOriginalValues,
  SemesterUpdateValues,
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
    normalized <=
      0
  ) {
    return 0;
  }

  return Math.floor(
    normalized
  );
}

function normalizeNullablePositiveInteger(
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
    Math.floor(
      Number(
        value
      )
    );

  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized <=
      0
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

function normalizeNullableInteger(
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

  if (
    !Number.isFinite(
      normalized
    ) ||
    !Number.isInteger(
      normalized
    )
  ) {
    return null;
  }

  return normalized;
}

function normalizeNullableAmount(
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
    )
  ) {
    return null;
  }

  return normalized;
}

function normalizeBoolean(
  value:
    unknown
): boolean {
  return (
    value ===
      true ||
    value ===
      1 ||
    value ===
      "1" ||
    value ===
      "true"
  );
}

function normalizeSemesterDate(
  value:
    unknown
): string | null {
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

  if (
    value instanceof
    Date
  ) {
    if (
      Number.isNaN(
        value.getTime()
      )
    ) {
      return null;
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

  const normalized =
    String(
      value
    )
      .trim()
      .slice(
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
    return null;
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
        month -
          1,
        day
      )
    );

  if (
    parsed.getUTCFullYear() !==
      year ||
    parsed.getUTCMonth() !==
      month -
        1 ||
    parsed.getUTCDate() !==
      day
  ) {
    return null;
  }

  return normalized;
}

function normalizeSemesterLabel(
  value:
    unknown
): string | null {
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
    String(
      value
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

  if (
    year <
      2000 ||
    year >
      2100
  ) {
    return null;
  }

  return `${matched[1]}년 ${matched[2]}학기`;
}

function normalizePlannedMonth(
  value:
    unknown
): string | null {
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
    return null;
  }

  const month =
    Number(
      normalized.slice(
        4,
        6
      )
    );

  if (
    month <
      1 ||
    month >
      12
  ) {
    return null;
  }

  return normalized;
}

function normalizeOriginalValues(
  value:
    unknown
): SemesterUpdateOriginalValues {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw new Error(
      "학기 수정 초안의 원본값이 올바르지 않습니다."
    );
  }

  const source =
    value as Record<
      string,
      unknown
    >;

  return {
    updatedAt:
      source.updatedAt ===
        null ||
      source.updatedAt ===
        undefined
        ? null
        : source.updatedAt as
            string |
            Date,

    semesterLabel:
      normalizeSemesterLabel(
        source.semesterLabel
      ),

    plannedMonth:
      normalizePlannedMonth(
        source.plannedMonth
      ),

    plannedInstitution:
      normalizeNullableText(
        source.plannedInstitution,
        255
      ),

    plannedSubjectCount:
      normalizeNullableInteger(
        source.plannedSubjectCount
      ),

    plannedAmount:
      normalizeNullableAmount(
        source.plannedAmount
      ),

    actualStartDate:
      source.actualStartDate ===
        null ||
      source.actualStartDate ===
        undefined
        ? null
        : source.actualStartDate as
            string |
            Date,

    actualInstitution:
      normalizeNullableText(
        source.actualInstitution,
        255
      ),

    actualInstitutionId:
      normalizeNullablePositiveInteger(
        source.actualInstitutionId
      ),

    actualSubjectCount:
      normalizeNullableInteger(
        source.actualSubjectCount
      ),

    actualAmount:
      normalizeNullableAmount(
        source.actualAmount
      ),

    actualPaymentDate:
      source.actualPaymentDate ===
        null ||
      source.actualPaymentDate ===
        undefined
        ? null
        : source.actualPaymentDate as
            string |
            Date,

    isCompleted:
      normalizeBoolean(
        source.isCompleted
      ),

    approvalStatus:
      normalizeNullableText(
        source.approvalStatus,
        100
      ),
  };
}

function normalizeUpdates(
  value:
    unknown
): SemesterUpdateValues {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw new Error(
      "학기 수정 초안의 변경값이 올바르지 않습니다."
    );
  }

  const source =
    value as Record<
      string,
      unknown
    >;

  const updates:
    SemesterUpdateValues =
    {};

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "semesterLabel"
    )
  ) {
    if (
      source.semesterLabel ===
      null
    ) {
      updates.semesterLabel =
        null;
    } else {
      const semesterLabel =
        normalizeSemesterLabel(
          source.semesterLabel
        );

      if (
        !semesterLabel
      ) {
        throw new Error(
          "학기 구분은 2026년 1학기 형식이어야 합니다."
        );
      }

      updates.semesterLabel =
        semesterLabel;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "plannedMonth"
    )
  ) {
    if (
      source.plannedMonth ===
      null
    ) {
      updates.plannedMonth =
        null;
    } else {
      const plannedMonth =
        normalizePlannedMonth(
          source.plannedMonth
        );

      if (
        !plannedMonth
      ) {
        throw new Error(
          "예정 개강월은 YYYYMM 형식이어야 합니다."
        );
      }

      updates.plannedMonth =
        plannedMonth;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "plannedInstitution"
    )
  ) {
    updates.plannedInstitution =
      normalizeNullableText(
        source.plannedInstitution,
        255
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "plannedSubjectCount"
    )
  ) {
    const value =
      normalizeNullableInteger(
        source.plannedSubjectCount
      );

    if (
      source.plannedSubjectCount !==
        null &&
      (
        value ===
          null ||
        value <
          0 ||
        value >
          8
      )
    ) {
      throw new Error(
        "예정 과목 수는 0개부터 8개까지 입력할 수 있습니다."
      );
    }

    updates.plannedSubjectCount =
      value;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "plannedAmount"
    )
  ) {
    const value =
      normalizeNullableAmount(
        source.plannedAmount
      );

    if (
      source.plannedAmount !==
        null &&
      (
        value ===
          null ||
        value <
          0
      )
    ) {
      throw new Error(
        "예정 결제금액은 0원 이상이어야 합니다."
      );
    }

    updates.plannedAmount =
      value;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "actualStartDate"
    )
  ) {
    if (
      source.actualStartDate ===
      null
    ) {
      updates.actualStartDate =
        null;
    } else {
      const actualStartDate =
        normalizeSemesterDate(
          source.actualStartDate
        );

      if (
        !actualStartDate
      ) {
        throw new Error(
          "실제 개강일은 YYYY-MM-DD 형식이어야 합니다."
        );
      }

      updates.actualStartDate =
        actualStartDate;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "actualInstitution"
    )
  ) {
    updates.actualInstitution =
      normalizeNullableText(
        source.actualInstitution,
        255
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "actualSubjectCount"
    )
  ) {
    const value =
      normalizeNullableInteger(
        source.actualSubjectCount
      );

    if (
      source.actualSubjectCount !==
        null &&
      (
        value ===
          null ||
        value <
          0 ||
        value >
          8
      )
    ) {
      throw new Error(
        "실제 과목 수는 0개부터 8개까지 입력할 수 있습니다."
      );
    }

    updates.actualSubjectCount =
      value;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "actualAmount"
    )
  ) {
    const value =
      normalizeNullableAmount(
        source.actualAmount
      );

    if (
      source.actualAmount !==
        null &&
      (
        value ===
          null ||
        value <
          0
      )
    ) {
      throw new Error(
        "실제 결제금액은 0원 이상이어야 합니다."
      );
    }

    updates.actualAmount =
      value;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      source,
      "actualPaymentDate"
    )
  ) {
    if (
      source.actualPaymentDate ===
      null
    ) {
      updates.actualPaymentDate =
        null;
    } else {
      const actualPaymentDate =
        normalizeSemesterDate(
          source.actualPaymentDate
        );

      if (
        !actualPaymentDate
      ) {
        throw new Error(
          "실제 결제일은 YYYY-MM-DD 형식이어야 합니다."
        );
      }

      updates.actualPaymentDate =
        actualPaymentDate;
    }
  }

  if (
    Object.keys(
      updates
    ).length ===
    0
  ) {
    throw new Error(
      "변경할 학기 정보가 없습니다."
    );
  }

  return updates;
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

function buildAuditAfterValues(
  params: {
    originalValues:
      SemesterUpdateOriginalValues;

    updates:
      SemesterUpdateValues;
  }
) {
  return {
    semesterLabel:
      Object.prototype.hasOwnProperty.call(
        params.updates,
        "semesterLabel"
      )
        ? params.updates
            .semesterLabel ??
          null
        : params.originalValues
            .semesterLabel,

    plannedMonth:
      Object.prototype.hasOwnProperty.call(
        params.updates,
        "plannedMonth"
      )
        ? params.updates
            .plannedMonth ??
          null
        : params.originalValues
            .plannedMonth,

    plannedInstitution:
      Object.prototype.hasOwnProperty.call(
        params.updates,
        "plannedInstitution"
      )
        ? params.updates
            .plannedInstitution ??
          null
        : params.originalValues
            .plannedInstitution,

    plannedSubjectCount:
      Object.prototype.hasOwnProperty.call(
        params.updates,
        "plannedSubjectCount"
      )
        ? params.updates
            .plannedSubjectCount ??
          null
        : params.originalValues
            .plannedSubjectCount,

    plannedAmount:
      Object.prototype.hasOwnProperty.call(
        params.updates,
        "plannedAmount"
      )
        ? params.updates
            .plannedAmount ??
          null
        : params.originalValues
            .plannedAmount,

    actualStartDate:
      Object.prototype.hasOwnProperty.call(
        params.updates,
        "actualStartDate"
      )
        ? params.updates
            .actualStartDate ??
          null
        : normalizeSemesterDate(
            params.originalValues
              .actualStartDate
          ),

    actualInstitution:
      Object.prototype.hasOwnProperty.call(
        params.updates,
        "actualInstitution"
      )
        ? params.updates
            .actualInstitution ??
          null
        : params.originalValues
            .actualInstitution,

    actualInstitutionId:
      Object.prototype.hasOwnProperty.call(
        params.updates,
        "actualInstitution"
      )
        ? null
        : params.originalValues
            .actualInstitutionId,

    actualSubjectCount:
      Object.prototype.hasOwnProperty.call(
        params.updates,
        "actualSubjectCount"
      )
        ? params.updates
            .actualSubjectCount ??
          null
        : params.originalValues
            .actualSubjectCount,

    actualAmount:
      Object.prototype.hasOwnProperty.call(
        params.updates,
        "actualAmount"
      )
        ? params.updates
            .actualAmount ??
          null
        : params.originalValues
            .actualAmount,

    actualPaymentDate:
      Object.prototype.hasOwnProperty.call(
        params.updates,
        "actualPaymentDate"
      )
        ? params.updates
            .actualPaymentDate ??
          null
        : normalizeSemesterDate(
            params.originalValues
              .actualPaymentDate
          ),

    isCompleted:
      params.originalValues
        .isCompleted,

    approvalStatus:
      params.originalValues
        .approvalStatus ||
      "요청전",
  };
}

export async function executeSemesterUpdatePendingAction(
  params: {
    pendingActionId:
      number;

    expectedVersion:
      number;

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
      "학기 수정 승인 실행 정보가 올바르지 않습니다."
    );
  }

  const claimed =
    await db.claimAiPendingActionForExecution({
      id:
        pendingActionId,

      organizationId,

      requestedByUserId,

      confirmedByUserId,

      expectedVersion,
    });

  if (
    !claimed
  ) {
    throw new Error(
      "학기 수정 승인 초안을 실행할 수 없습니다."
    );
  }

  const pendingAction =
    claimed.action;

  if (
    !pendingAction
  ) {
    throw new Error(
      "학기 수정 승인 초안을 찾을 수 없습니다."
    );
  }

  if (
    claimed.alreadyExecuted ===
      true
  ) {
    const executionResult =
      parseJsonRecord(
        pendingAction
          .executionResultJson
      );

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

      semesterId:
        normalizePositiveInteger(
          executionResult
            .semesterId ??
          pendingAction
            .semesterId
        ) ||
        null,

      semesterOrder:
        normalizePositiveInteger(
          executionResult
            .semesterOrder
        ) ||
        null,

      semester:
        null,

      pendingAction,

      message:
        String(
          executionResult
            .message ||
          "이미 실행된 학기 수정 요청입니다."
        ),
    };
  }

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

      semesterOrder:
        null,

      semester:
        null,

      pendingAction,

      message:
        "학생 학기 수정을 진행하고 있습니다.",
    };
  }

  const completedSteps:
    string[] =
    [];

  try {
    if (
      String(
        pendingAction
          .actionType ||
        ""
      ) !==
      "semester_update"
    ) {
      throw new Error(
        "학기 수정 승인 초안이 아닙니다."
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
          SemesterUpdateDraft
        >;

    const studentId =
      normalizePositiveInteger(
        draft.studentId ??
        pendingAction
          .studentId
      );

    if (
      !studentId
    ) {
      throw new Error(
        "학기를 수정할 학생 정보가 없습니다."
      );
    }

    const semesterId =
      normalizePositiveInteger(
        draft.semesterId ??
        pendingAction
          .semesterId
      );

    if (
      !semesterId
    ) {
      throw new Error(
        "수정할 학기 정보가 없습니다."
      );
    }

    const semesterOrder =
      normalizePositiveInteger(
        draft.semesterOrder
      );

    if (
      !semesterOrder ||
      semesterOrder >
        20
    ) {
      throw new Error(
        "수정할 학기 순서가 올바르지 않습니다."
      );
    }

    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId,
        }
      );

    if (
      !student
    ) {
      throw new Error(
        "학기를 수정할 학생을 찾을 수 없습니다."
      );
    }

    assertCanAccessStudent({
      context,
      student,
    });

    completedSteps.push(
      "학생 조회권한 확인"
    );

    assertCanWriteStudent({
      context,
      student,
    });

    completedSteps.push(
      "학생 담당자 수정권한 확인"
    );

    const draftAssigneeId =
      normalizePositiveInteger(
        draft.assigneeId
      );

    const currentAssigneeId =
      normalizePositiveInteger(
        (
          student as
            any
        ).assigneeId
      );

    if (
      !draftAssigneeId ||
      !currentAssigneeId ||
      draftAssigneeId !==
        currentAssigneeId
    ) {
      throw new Error(
        "학기 수정 초안 이후 학생 담당자가 변경되었습니다. 최신 학생 정보를 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "학생 담당자 변경 여부 확인"
    );

    const pendingStudentId =
      normalizePositiveInteger(
        pendingAction
          .studentId
      );

    if (
      pendingStudentId &&
      pendingStudentId !==
        studentId
    ) {
      throw new Error(
        "승인 요청의 학생 정보와 학기 수정 초안의 학생 정보가 일치하지 않습니다."
      );
    }

    const pendingSemesterId =
      normalizePositiveInteger(
        pendingAction
          .semesterId
      );

    if (
      pendingSemesterId &&
      pendingSemesterId !==
        semesterId
    ) {
      throw new Error(
        "승인 요청의 학기 정보와 학기 수정 초안의 학기 정보가 일치하지 않습니다."
      );
    }

    completedSteps.push(
      "승인 요청 대상 학생 및 학기 확인"
    );

    const originalValues =
      normalizeOriginalValues(
        draft.originalValues
      );

    const updates =
      normalizeUpdates(
        draft.updates
      );

    const currentSemester =
      await db.getSemester(
        semesterId,
        {
          organizationId,
        }
      );

    if (
      !currentSemester
    ) {
      throw new Error(
        "수정할 학기를 찾을 수 없습니다."
      );
    }

    if (
      normalizePositiveInteger(
        (
          currentSemester as
            any
        ).studentId
      ) !==
      studentId
    ) {
      throw new Error(
        "수정할 학기가 선택한 학생에게 속하지 않습니다."
      );
    }

    if (
      normalizePositiveInteger(
        (
          currentSemester as
            any
        ).semesterOrder
      ) !==
      semesterOrder
    ) {
      throw new Error(
        "학기 수정 초안 이후 대상 학기 순서가 변경되었습니다."
      );
    }

    completedSteps.push(
      "대상 학기 재조회 및 소속 확인"
    );

    const transactionResult =
      await db.executeSemesterUpdateTransaction({
        organizationId,

        pendingActionId,

        requestedByUserId,

        confirmedByUserId,

        expectedVersion,

        studentId,

        expectedAssigneeId:
          draftAssigneeId,

        semesterId,

        semesterOrder,

        originalValues,

        updates,

        actorUserId:
          confirmedByUserId,

        actorName:
          context.userName ??
          null,

        actorRole:
          context.role,
      });

    completedSteps.push(
      ...(
        Array.isArray(
          transactionResult
            .completedSteps
        )
          ? transactionResult
              .completedSteps
          : []
      )
    );

    const executedPendingAction =
      transactionResult
        .pendingAction;

    if (
      !executedPendingAction
    ) {
      throw new Error(
        "실행 완료된 학기 수정 승인 요청을 확인하지 못했습니다."
      );
    }

    let updatedSemester:
      any =
      null;

    try {
      updatedSemester =
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
        "[AI SEMESTER UPDATE] 수정 학기 재조회 실패",
        {
          pendingActionId,

          organizationId,

          studentId,

          semesterId,

          message:
            semesterReadError instanceof
              Error
              ? String(
                  semesterReadError
                    .message ||
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

    const afterValues =
      buildAuditAfterValues({
        originalValues,
        updates,
      });

    const diffJson:
      Record<
        string,
        {
          before:
            unknown;

          after:
            unknown;
        }
      > =
      {};

    for (
      const key of
      Object.keys(
        updates
      ) as Array<
        keyof SemesterUpdateValues
      >
    ) {
      diffJson[key] = {
        before:
          (
            originalValues as
              any
          )[key] ??
          null,

        after:
          (
            afterValues as
              any
          )[key] ??
          null,
      };
    }

    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        "actualInstitution"
      )
    ) {
      diffJson.actualInstitutionId = {
        before:
          originalValues
            .actualInstitutionId,

        after:
          null,
      };
    }

    try {
      await db.createStudentAuditLog({
        organizationId,

        studentId,

        entityType:
          "semester",

        entityId:
          semesterId,

        action:
          "update",

        title:
          "AI 학생 학기 수정",

        beforeJson: {
          id:
            semesterId,

          semesterOrder,

          semesterLabel:
            originalValues
              .semesterLabel,

          plannedMonth:
            originalValues
              .plannedMonth,

          plannedInstitution:
            originalValues
              .plannedInstitution,

          plannedSubjectCount:
            originalValues
              .plannedSubjectCount,

          plannedAmount:
            originalValues
              .plannedAmount,

          actualStartDate:
            normalizeSemesterDate(
              originalValues
                .actualStartDate
            ),

          actualInstitution:
            originalValues
              .actualInstitution,

          actualInstitutionId:
            originalValues
              .actualInstitutionId,

          actualSubjectCount:
            originalValues
              .actualSubjectCount,

          actualAmount:
            originalValues
              .actualAmount,

          actualPaymentDate:
            normalizeSemesterDate(
              originalValues
                .actualPaymentDate
            ),

          isCompleted:
            originalValues
              .isCompleted,

          approvalStatus:
            originalValues
              .approvalStatus ||
            "요청전",
        },

        afterJson: {
          id:
            semesterId,

          semesterOrder,

          ...afterValues,
        },

        diffJson,

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
        "학기 수정 감사로그 기록"
      );
    } catch (
      auditLogError
    ) {
      completedSteps.push(
        "학기 수정 성공 - 감사로그 기록 실패"
      );

      console.error(
        "[AI SEMESTER UPDATE] 감사로그 저장 실패",
        {
          pendingActionId,

          organizationId,

          studentId,

          semesterId,

          message:
            auditLogError instanceof
              Error
              ? String(
                  auditLogError
                    .message ||
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

      semesterOrder,

      semester:
        updatedSemester,

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
        : "학생 학기 수정 처리에 실패했습니다.";

    try {
      const latestPendingAction =
        await db.getAiPendingActionForConfirmation({
          id:
            pendingActionId,

          organizationId,

          requestedByUserId,
        });

      if (
        latestPendingAction
          ?.status !==
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
       * 실패 상태 저장 중 오류가 발생해도
       * 최초 학기 수정 오류를 유지한다.
       */
    }

    throw error;
  }
}