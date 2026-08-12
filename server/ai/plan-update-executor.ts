import * as db from "../db";

import {
  assertCanAccessStudent,
  assertCanWriteStudent,
} from "./ai-permission";

import type {
  AiUserContext,
  PlanUpdateDraft,
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

function normalizeNonNegativeInteger(
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
    !Number.isInteger(
      normalized
    ) ||
    normalized <
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

function hasOwnProperty(
  value:
    Record<
      string,
      any
    >,

  key:
    string
): boolean {
  return Object.prototype
    .hasOwnProperty
    .call(
      value,
      key
    );
}

function isSameValue(
  before:
    string |
    number |
    boolean |
    null,

  after:
    string |
    number |
    boolean |
    null
): boolean {
  return before ===
    after;
}

export async function executePlanUpdatePendingAction(
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
      "플랜 수정 승인 실행 정보가 올바르지 않습니다."
    );
  }

  /**
   * Pending Action 실행 선점
   *
   * 중복 승인 / 동시 실행을 방지한다.
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
      "플랜 수정 승인 초안을 실행할 수 없습니다."
    );
  }

  const pendingAction =
    claimed.action;

  if (
    !pendingAction
  ) {
    throw new Error(
      "플랜 수정 승인 초안을 찾을 수 없습니다."
    );
  }

  /**
   * 이미 실행 완료된 승인건이면
   * DB를 다시 수정하지 않는다.
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

      planId:
        normalizePositiveInteger(
          executionResult
            .planId
        ) ||
        null,

      updatedFields:
        Array.isArray(
          executionResult
            .updatedFields
        )
          ? executionResult
              .updatedFields
          : [],

      pendingAction,

      message:
        String(
          executionResult
            .message ||
          "이미 수정된 학생 플랜입니다."
        ),
    };
  }

  /**
   * 다른 요청에서 실행 중인 경우
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

      planId:
        null,

      updatedFields:
        [] as string[],

      pendingAction,

      message:
        "학생 플랜을 수정하고 있습니다.",
    };
  }

  const completedSteps:
    string[] =
    [];

  try {
    /**
     * 잘못된 Pending Action 타입 실행 방지
     */
    if (
      String(
        pendingAction
          .actionType ||
        ""
      ) !==
      "plan_update"
    ) {
      throw new Error(
        "플랜 수정 승인 초안이 아닙니다."
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
          PlanUpdateDraft
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
        "플랜을 수정할 학생 정보가 없습니다."
      );
    }

    const planId =
      normalizePositiveInteger(
        draft.planId
      );

    if (
      !planId
    ) {
      throw new Error(
        "수정할 플랜 정보가 없습니다."
      );
    }

    /**
     * 현재 학생 재조회
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
        "플랜을 수정할 학생을 찾을 수 없습니다."
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
      "학생 담당자 플랜수정 권한 확인"
    );

    /**
     * 초안 생성 당시 담당자와
     * 현재 담당자를 비교한다.
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
        "플랜 수정 초안 이후 학생 담당자가 변경되었습니다. 최신 학생 정보를 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "학생 담당자 변경 여부 확인"
    );

    /**
     * 현재 플랜 재조회
     */
    const currentPlan =
      await db.getPlan(
        studentId,
        {
          organizationId,
        }
      );

    if (
      !currentPlan
    ) {
      throw new Error(
        "수정할 학생 플랜을 찾을 수 없습니다."
      );
    }

    const currentPlanId =
      normalizePositiveInteger(
        (currentPlan as any)
          .id
      );

    if (
      !currentPlanId ||
      currentPlanId !==
        planId
    ) {
      throw new Error(
        "플랜 수정 초안 이후 학생 플랜이 변경되었습니다. 최신 플랜을 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "학생 플랜 동일성 확인"
    );

    const originalValues =
      parseJsonRecord(
        draft.originalValues
      );

    const updates =
      parseJsonRecord(
        draft.updates
      );

    /**
     * AI가 수정할 수 있는 필드만 허용
     */
    const allowedUpdateFields = [
      "desiredCourse",
      "finalEducation",
      "hasPractice",
      "totalTheorySubjects",
      "requiredMajorCount",
      "electiveMajorCount",
      "liberalCount",
      "generalCount",
    ] as const;

    const requestedFields =
      allowedUpdateFields.filter(
        (
          field
        ) =>
          hasOwnProperty(
            updates,
            field
          )
      );

    if (
      requestedFields.length ===
      0
    ) {
      throw new Error(
        "플랜 수정 초안에 변경 항목이 없습니다."
      );
    }

    /**
     * 현재 DB값 정규화
     */
    const currentValues = {
      desiredCourse:
        normalizeNullableText(
          (currentPlan as any)
            .desiredCourse,
          255
        ),

      finalEducation:
        normalizeNullableText(
          (currentPlan as any)
            .finalEducation,
          255
        ),

      hasPractice:
        (currentPlan as any)
          .hasPractice ===
        true,

      totalTheorySubjects:
        normalizeNonNegativeInteger(
          (currentPlan as any)
            .totalTheorySubjects
        ),

      requiredMajorCount:
        normalizeNonNegativeInteger(
          (currentPlan as any)
            .requiredMajorCount
        ),

      electiveMajorCount:
        normalizeNonNegativeInteger(
          (currentPlan as any)
            .electiveMajorCount
        ),

      liberalCount:
        normalizeNonNegativeInteger(
          (currentPlan as any)
            .liberalCount
        ),

      generalCount:
        normalizeNonNegativeInteger(
          (currentPlan as any)
            .generalCount
        ),
    };

    if (
      currentValues
        .totalTheorySubjects ===
        null ||
      currentValues
        .requiredMajorCount ===
        null ||
      currentValues
        .electiveMajorCount ===
        null ||
      currentValues
        .liberalCount ===
        null ||
      currentValues
        .generalCount ===
        null
    ) {
      throw new Error(
        "현재 플랜 과목 수 정보가 올바르지 않습니다."
      );
    }

    /**
     * 초안 생성 당시 원본값 정규화
     */
    const normalizedOriginalValues = {
      planId:
        normalizePositiveInteger(
          originalValues.planId
        ),

      desiredCourse:
        normalizeNullableText(
          originalValues
            .desiredCourse,
          255
        ),

      finalEducation:
        normalizeNullableText(
          originalValues
            .finalEducation,
          255
        ),

      hasPractice:
        originalValues
          .hasPractice ===
        true,

      totalTheorySubjects:
        normalizeNonNegativeInteger(
          originalValues
            .totalTheorySubjects
        ),

      requiredMajorCount:
        normalizeNonNegativeInteger(
          originalValues
            .requiredMajorCount
        ),

      electiveMajorCount:
        normalizeNonNegativeInteger(
          originalValues
            .electiveMajorCount
        ),

      liberalCount:
        normalizeNonNegativeInteger(
          originalValues
            .liberalCount
        ),

      generalCount:
        normalizeNonNegativeInteger(
          originalValues
            .generalCount
        ),
    };

    if (
      normalizedOriginalValues
        .planId !==
        planId ||
      normalizedOriginalValues
        .totalTheorySubjects ===
        null ||
      normalizedOriginalValues
        .requiredMajorCount ===
        null ||
      normalizedOriginalValues
        .electiveMajorCount ===
        null ||
      normalizedOriginalValues
        .liberalCount ===
        null ||
      normalizedOriginalValues
        .generalCount ===
        null
    ) {
      throw new Error(
        "플랜 수정 원본 정보가 올바르지 않습니다."
      );
    }

    /**
     * 낙관적 잠금
     *
     * 초안 생성 후 누군가 수정한 필드는
     * 오래된 초안으로 덮어쓰지 않는다.
     *
     * 이번 수정 요청에 포함된 필드만 비교한다.
     */
    for (
      const field of
      requestedFields
    ) {
      if (
        !isSameValue(
          currentValues[
            field
          ],

          normalizedOriginalValues[
            field
          ]
        )
      ) {
        const label =
          field ===
            "desiredCourse"
            ? "희망 과정"
            : field ===
                "finalEducation"
              ? "최종학력"
              : field ===
                  "hasPractice"
                ? "실습 필요 여부"
                : field ===
                    "totalTheorySubjects"
                  ? "전체 이론 과목 수"
                  : field ===
                      "requiredMajorCount"
                    ? "전공필수 과목 수"
                    : field ===
                        "electiveMajorCount"
                      ? "전공선택 과목 수"
                      : field ===
                          "liberalCount"
                        ? "교양 과목 수"
                        : "일반 과목 수";

        throw new Error(
          `${label}가 초안 생성 후 변경되었습니다. 최신 정보를 다시 확인해주세요.`
        );
      }
    }

    completedSteps.push(
      "플랜 변경 충돌 검사"
    );

    /**
     * 승인된 수정값만 새 객체에 구성한다.
     */
    const updateData:
      Record<
        string,
        string |
        number |
        boolean |
        null
      > =
      {};

    if (
      hasOwnProperty(
        updates,
        "desiredCourse"
      )
    ) {
      updateData.desiredCourse =
        normalizeNullableText(
          updates.desiredCourse,
          255
        );
    }

    if (
      hasOwnProperty(
        updates,
        "finalEducation"
      )
    ) {
      updateData.finalEducation =
        normalizeNullableText(
          updates.finalEducation,
          255
        );
    }

    if (
      hasOwnProperty(
        updates,
        "hasPractice"
      )
    ) {
      if (
        typeof updates
          .hasPractice !==
        "boolean"
      ) {
        throw new Error(
          "실습 필요 여부가 올바르지 않습니다."
        );
      }

      updateData.hasPractice =
        updates.hasPractice;
    }

    const numericFields = [
      "totalTheorySubjects",
      "requiredMajorCount",
      "electiveMajorCount",
      "liberalCount",
      "generalCount",
    ] as const;

    for (
      const field of
      numericFields
    ) {
      if (
        !hasOwnProperty(
          updates,
          field
        )
      ) {
        continue;
      }

      const value =
        normalizeNonNegativeInteger(
          updates[
            field
          ]
        );

      if (
        value ===
        null
      ) {
        throw new Error(
          `${
            field ===
              "totalTheorySubjects"
              ? "전체 이론 과목 수"
              : field ===
                  "requiredMajorCount"
                ? "전공필수 과목 수"
                : field ===
                    "electiveMajorCount"
                  ? "전공선택 과목 수"
                  : field ===
                      "liberalCount"
                    ? "교양 과목 수"
                    : "일반 과목 수"
          }가 올바르지 않습니다.`
        );
      }

      updateData[
        field
      ] =
        value;
    }

    /**
     * 실제 현재 값과 달라지는 필드만 남긴다.
     */
    const effectiveUpdates:
      Record<
        string,
        string |
        number |
        boolean |
        null
      > =
      {};

    for (
      const field of
      requestedFields
    ) {
      const nextValue =
        updateData[
          field
        ];

      if (
        !isSameValue(
          currentValues[
            field
          ],

          nextValue
        )
      ) {
        effectiveUpdates[
          field
        ] =
          nextValue;
      }
    }

    if (
      Object.keys(
        effectiveUpdates
      ).length ===
      0
    ) {
      throw new Error(
        "현재 플랜 정보와 승인된 변경값이 동일합니다."
      );
    }

    /**
     * 기존 플랜 수정 전용 DB 함수.
     *
     * upsertPlan()을 사용하지 않는다.
     */
    const updatedPlan =
      await db.updatePlanOnly({
        organizationId,

        studentId,

        planId,

        updates:
          effectiveUpdates as any,
      });

    if (
      !updatedPlan
    ) {
      throw new Error(
        "플랜 수정 결과를 확인하지 못했습니다."
      );
    }

    completedSteps.push(
      "학생 플랜 수정"
    );

    /**
     * DB 재조회
     */
    const reloadedPlan =
      await db.getPlan(
        studentId,
        {
          organizationId,
        }
      );

    if (
      !reloadedPlan ||
      normalizePositiveInteger(
        (reloadedPlan as any)
          .id
      ) !==
        planId
    ) {
      throw new Error(
        "수정된 플랜을 다시 확인할 수 없습니다."
      );
    }

    completedSteps.push(
      "수정 결과 재조회"
    );

    /**
     * 실제 변경된 필드만 감사로그에 기록한다.
     */
    const beforeJson:
      Record<
        string,
        string |
        number |
        boolean |
        null
      > =
      {};

    const afterJson:
      Record<
        string,
        string |
        number |
        boolean |
        null
      > =
      {};

    const diffJson:
      Record<
        string,
        {
          before:
            string |
            number |
            boolean |
            null;

          after:
            string |
            number |
            boolean |
            null;
        }
      > =
      {};

    for (
      const field of
      Object.keys(
        effectiveUpdates
      )
    ) {
      const typedField =
        field as
          keyof typeof currentValues;

      const beforeValue =
        currentValues[
          typedField
        ];

      let afterValue:
        string |
        number |
        boolean |
        null;

      if (
        field ===
          "desiredCourse" ||
        field ===
          "finalEducation"
      ) {
        afterValue =
          normalizeNullableText(
            (
              reloadedPlan as any
            )[
              field
            ],
            255
          );
      } else if (
        field ===
          "hasPractice"
      ) {
        afterValue =
          (
            reloadedPlan as any
          ).hasPractice ===
          true;
      } else {
        afterValue =
          normalizeNonNegativeInteger(
            (
              reloadedPlan as any
            )[
              field
            ]
          );
      }

      beforeJson[
        field
      ] =
        beforeValue;

      afterJson[
        field
      ] =
        afterValue;

      diffJson[
        field
      ] = {
        before:
          beforeValue,

        after:
          afterValue,
      };
    }

    try {
      await db.createStudentAuditLog({
        organizationId,

        studentId,

        entityType:
          "plan",

        entityId:
          planId,

        action:
          "update",

        title:
          "AI 학생 플랜 수정",

        beforeJson,

        afterJson,

        diffJson,

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
      });

      completedSteps.push(
        "플랜 수정 감사로그 기록"
      );
    } catch {
      completedSteps.push(
        "플랜 수정 완료 - 감사로그 기록 실패"
      );
    }

    const studentName =
      String(
        (student as any)
          .clientName ||
        ""
      ).trim();

    const successMessage =
      `${
        studentName ||
        `학생 #${studentId}`
      }님의 플랜 정보 ${
        Object.keys(
          effectiveUpdates
        ).length
      }개 항목이 수정되었습니다.`;

    /**
     * 기존 Executor와 동일하게
     * claim 이후 expectedVersion을 그대로 사용한다.
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

        planId,

        semesterIds:
          [],

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

      planId,

      updatedFields:
        Object.keys(
          effectiveUpdates
        ),

      plan:
        reloadedPlan,

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
        : "학생 플랜 수정에 실패했습니다.";

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
       * Pending 실패 상태 기록 자체가 실패해도
       * 원래 플랜 수정 오류를 유지한다.
       */
    }

    throw error;
  }
}