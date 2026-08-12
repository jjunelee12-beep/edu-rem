import * as db from "../db";

import {
  assertCanAccessStudent,
  assertCanWriteStudent,
} from "./ai-permission";

import type {
  AiUserContext,
  SemesterCompleteDraft,
  SemesterCompleteOriginalValues,
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

function normalizePositiveAmount(
  value:
    unknown
): number {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return 0;
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
    normalized <=
      0
  ) {
    return 0;
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

  const raw =
    String(
      value
    ).trim();

  const matched =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})/
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

  return [
    String(
      year
    ).padStart(
      4,
      "0"
    ),

    String(
      month
    ).padStart(
      2,
      "0"
    ),

    String(
      day
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
}

function normalizeOriginalValues(
  value:
    unknown
): SemesterCompleteOriginalValues {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw new Error(
      "학기 입력완료 초안의 원본값이 올바르지 않습니다."
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

    isCompleted:
      normalizeBoolean(
        source.isCompleted
      ),

    approvalStatus:
      normalizeNullableText(
        source.approvalStatus,
        100
      ),

    semesterLabel:
      normalizeNullableText(
        source.semesterLabel,
        100
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
      source.actualSubjectCount ===
        null ||
      source.actualSubjectCount ===
        undefined ||
      source.actualSubjectCount ===
        ""
        ? null
        : Number.isFinite(
            Number(
              source.actualSubjectCount
            )
          )
          ? Math.floor(
              Number(
                source.actualSubjectCount
              )
            )
          : null,

    actualAmount:
      source.actualAmount ===
        null ||
      source.actualAmount ===
        undefined ||
      source.actualAmount ===
        ""
        ? null
        : source.actualAmount as
            string |
            number,

    actualPaymentDate:
      source.actualPaymentDate ===
        null ||
      source.actualPaymentDate ===
        undefined
        ? null
        : source.actualPaymentDate as
            string |
            Date,
  };
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

export async function executeSemesterCompletePendingAction(
  params: {
    pendingActionId:
      number;

    expectedVersion:
      number;

    /**
     * Router에서 buildAiContext()로 생성한
     * 실제 서버 권한 Context다.
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
      "학기 입력완료 승인 실행 정보가 올바르지 않습니다."
    );
  }

  /**
   * Pending Action을 원자적으로
   * executing 상태로 전환한다.
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

  if (
    !claimed
  ) {
    throw new Error(
      "학기 입력완료 승인 초안을 실행할 수 없습니다."
    );
  }

  const pendingAction =
    claimed.action;

  if (
    !pendingAction
  ) {
    throw new Error(
      "학기 입력완료 승인 초안을 찾을 수 없습니다."
    );
  }

  /**
   * 이미 실행된 요청이면
   * 학기 상태를 다시 변경하지 않는다.
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

      semesterOrder:
        normalizePositiveInteger(
          executionResult
            .semesterOrder
        ) ||
        null,

      isCompleted:
        executionResult
          .isCompleted ===
          true,

      approvalStatus:
        normalizeNullableText(
          executionResult
            .approvalStatus,
          100
        ) ||
        "대기",

      pendingAction,

      message:
        String(
          executionResult
            .message ||
          "이미 입력완료 처리된 학기입니다."
        ),
    };
  }

  /**
   * 다른 요청이 이미 실행 중이면
   * 중복 실행하지 않는다.
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

      semesterOrder:
        null,

      isCompleted:
        false,

      approvalStatus:
        null,

      pendingAction,

      message:
        "학생 학기 입력완료 처리를 진행하고 있습니다.",
    };
  }

  const completedSteps:
    string[] =
    [];

  try {
    /**
     * 작업 종류 재검사
     */
    if (
      String(
        pendingAction
          .actionType ||
        ""
      ) !==
      "semester_complete"
    ) {
      throw new Error(
        "학기 입력완료 승인 초안이 아닙니다."
      );
    }

    completedSteps.push(
      "승인 작업 종류 확인"
    );

    /**
     * Pending Action Payload에서
     * Tool이 생성한 draft를 복원한다.
     */
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
          SemesterCompleteDraft
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
        "입력완료 처리할 학생 정보가 없습니다."
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
        "입력완료 처리할 학기 정보가 없습니다."
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
        "입력완료 처리할 학기 순서가 올바르지 않습니다."
      );
    }

    /**
     * 학생 재조회
     */
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
        "입력완료 처리할 학생을 찾을 수 없습니다."
      );
    }

    assertCanAccessStudent({
      context,
      student,
    });

    completedSteps.push(
      "학생 조회권한 확인"
    );

    /**
     * 현재 로그인 사용자가
     * 해당 학생을 실제 수정할 수 있는지 재검사한다.
     */
    assertCanWriteStudent({
      context,
      student,
    });

    completedSteps.push(
      "학생 담당자 입력완료 권한 확인"
    );

    /**
     * 초안 생성 당시 담당자와
     * 현재 담당자를 다시 비교한다.
     */
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
        "학기 입력완료 초안 이후 학생 담당자가 변경되었습니다. 최신 학생 정보를 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "학생 담당자 변경 여부 확인"
    );

    /**
     * Pending Action이 참조하는 학생과 학기가
     * 초안의 값과 같은지 확인한다.
     */
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
        "승인 요청의 학생 정보와 입력완료 초안의 학생 정보가 일치하지 않습니다."
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
        "승인 요청의 학기 정보와 입력완료 초안의 학기 정보가 일치하지 않습니다."
      );
    }

    completedSteps.push(
      "승인 요청 대상 학생 및 학기 확인"
    );

    /**
     * 초안의 입력완료 적용값 검증
     */
    if (
      draft.updates
        ?.isCompleted !==
        true ||
      draft.updates
        ?.approvalStatus !==
        "대기"
    ) {
      throw new Error(
        "학기 입력완료 초안의 적용값이 올바르지 않습니다."
      );
    }

    const actualSubjectCount =
      normalizePositiveInteger(
        draft.actualSubjectCount
      );

    const planSubjectCount =
      normalizePositiveInteger(
        draft.planSubjectCount
      );

    if (
      !actualSubjectCount
    ) {
      throw new Error(
        "학기 입력완료 초안의 실제 과목 수가 올바르지 않습니다."
      );
    }

    if (
      !planSubjectCount
    ) {
      throw new Error(
        "학기 입력완료 초안의 우리플랜 과목 수가 올바르지 않습니다."
      );
    }

    if (
      actualSubjectCount !==
        planSubjectCount
    ) {
      throw new Error(
        `실제 과목 수는 ${actualSubjectCount}개이지만 우리플랜 과목은 ${planSubjectCount}개입니다.`
      );
    }

    const actualStartDate =
      normalizeSemesterDate(
        draft.actualStartDate
      );

    if (
      !actualStartDate
    ) {
      throw new Error(
        "학기 입력완료 초안의 실제 개강일이 올바르지 않습니다."
      );
    }

    const actualInstitution =
      normalizeNullableText(
        draft.actualInstitution,
        255
      );

    const originalValues =
      normalizeOriginalValues(
        draft.originalValues
      );

    /**
     * actualInstitution 이름이 비어 있어도
     * 실제 교육원 ID가 있으면 허용한다.
     */
    if (
      !actualInstitution &&
      !originalValues
        .actualInstitutionId
    ) {
      throw new Error(
        "학기 입력완료 초안의 실제 교육원 정보가 없습니다."
      );
    }

    const actualAmount =
      normalizePositiveAmount(
        draft.actualAmount
      );

    if (
      !actualAmount
    ) {
      throw new Error(
        "학기 입력완료 초안의 실제 결제금액이 올바르지 않습니다."
      );
    }

    const actualPaymentDate =
      normalizeSemesterDate(
        draft.actualPaymentDate
      );

    if (
      !actualPaymentDate
    ) {
      throw new Error(
        "학기 입력완료 초안의 실제 결제일이 올바르지 않습니다."
      );
    }

    completedSteps.push(
      "학기 입력완료 초안 필수정보 확인"
    );

    /**
     * 현재 학기를 다시 조회하여
     * 대상 학생에게 속한 학기인지 확인한다.
     *
     * 최종 동시성 검사는 DB Transaction 안에서
     * FOR UPDATE로 한 번 더 처리한다.
     */
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
        "입력완료 처리할 학기를 찾을 수 없습니다."
      );
    }

    if (
      Number(
        (
          currentSemester as
            any
        ).studentId ||
        0
      ) !==
      studentId
    ) {
      throw new Error(
        "입력완료 처리할 학기가 선택한 학생에게 속하지 않습니다."
      );
    }

    if (
      Number(
        (
          currentSemester as
            any
        ).semesterOrder ||
        0
      ) !==
      semesterOrder
    ) {
      throw new Error(
        "입력완료 초안 이후 대상 학기 순서가 변경되었습니다."
      );
    }

    completedSteps.push(
      "대상 학기 재조회 및 소속 확인"
    );

    /**
     * 학기 상태 변경과 Pending Action executed 처리를
     * 하나의 DB Transaction으로 실행한다.
     */
    const transactionResult =
      await db.executeSemesterCompleteTransaction({
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
        "실행 완료된 학기 입력완료 승인 요청을 확인하지 못했습니다."
      );
    }

    /**
     * 실제 변경된 학기를 화면 반환용으로 재조회한다.
     *
     * 재조회 실패가 실제 입력완료 성공을
     * 실패로 바꾸지 않도록 별도 처리한다.
     */
    let completedSemester:
      any =
      null;

    try {
      completedSemester =
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
        "[AI SEMESTER COMPLETE] 입력완료 학기 재조회 실패",
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

    /**
     * 학기 입력완료 감사로그
     *
     * 트랜잭션은 이미 완료됐으므로
     * 감사로그 실패로 학기 상태를 되돌리지 않는다.
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
          "update",

        title:
          "AI 학생 학기 입력완료",

        beforeJson: {
          id:
            semesterId,

          semesterOrder,

          semesterLabel:
            originalValues
              .semesterLabel,

          isCompleted:
            originalValues
              .isCompleted,

          approvalStatus:
            originalValues
              .approvalStatus ||
            "요청전",

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
        },

        afterJson: {
          id:
            semesterId,

          semesterOrder,

          semesterLabel:
            normalizeNullableText(
              draft.semesterLabel,
              100
            ),

          isCompleted:
            true,

          approvalStatus:
            "대기",

          actualStartDate,

          actualInstitution,

          actualInstitutionId:
            originalValues
              .actualInstitutionId,

          actualSubjectCount,

          actualAmount,

          actualPaymentDate,

          planSubjectCount,
        },

        diffJson: {
          isCompleted: {
            before:
              originalValues
                .isCompleted,

            after:
              true,
          },

          approvalStatus: {
            before:
              originalValues
                .approvalStatus ||
              "요청전",

            after:
              "대기",
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
        "학기 입력완료 감사로그 기록"
      );
    } catch (
      auditLogError
    ) {
      completedSteps.push(
        "학기 입력완료 성공 - 감사로그 기록 실패"
      );

      console.error(
        "[AI SEMESTER COMPLETE] 감사로그 저장 실패",
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
        completedSemester,

      isCompleted:
        true,

      approvalStatus:
        "대기",

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
        : "학생 학기 입력완료 처리에 실패했습니다.";

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
       * 후속 재조회 또는 감사로그 오류 때문에
       * failed 상태로 되돌리지 않는다.
       */
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
       * 최초 입력완료 오류를 유지한다.
       */
    }

    throw error;
  }
}