import * as db from "../db";

import {
  assertCanAccessStudent,
  assertCanWriteStudent,
} from "./ai-permission";

import type {
  AiUserContext,
  PlanSubjectsUpdateDraft,
} from "./ai.types";

function normalizePositiveInteger(
  value: unknown
): number {
  const normalized =
    Number(value);

  if (
    !Number.isFinite(normalized) ||
    normalized <= 0
  ) {
    return 0;
  }

  return Math.floor(normalized);
}

function normalizeNonNegativeInteger(
  value: unknown
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
    !Number.isInteger(normalized) ||
    normalized < 0
  ) {
    return null;
  }

  return normalized;
}

function normalizeSubjectName(
  value: unknown
): string {
  return String(
    value || ""
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
}

function parseJsonRecord(
  value: unknown
): Record<string, any> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      any
    >;
  }

  if (
    typeof value !== "string"
  ) {
    return {};
  }

  try {
    const parsed =
      JSON.parse(value);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
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
  value: Record<string, any>,
  key: string
): boolean {
  return Object.prototype
    .hasOwnProperty
    .call(
      value,
      key
    );
}

function normalizePlanCategory(
  value: unknown
):
  | "전공"
  | "교양"
  | "일반"
  | null {
  const normalized =
    String(
      value || ""
    ).trim();

  if (
    normalized === "전공" ||
    normalized === "교양" ||
    normalized === "일반"
  ) {
    return normalized;
  }

  return null;
}

function normalizeRequirementType(
  value: unknown
):
  | "전공필수"
  | "전공선택"
  | "교양"
  | "일반"
  | null {
  const normalized =
    String(
      value || ""
    ).trim();

  if (
    normalized === "전공필수" ||
    normalized === "전공선택" ||
    normalized === "교양" ||
    normalized === "일반"
  ) {
    return normalized;
  }

  return null;
}

function assertCategoryRequirementPair(
  params: {
    subjectName:
      string;

    planCategory:
      "전공" |
      "교양" |
      "일반";

    planRequirementType:
      "전공필수" |
      "전공선택" |
      "교양" |
      "일반";
  }
) {
  if (
    (
      params.planRequirementType ===
        "전공필수" ||
      params.planRequirementType ===
        "전공선택"
    ) &&
    params.planCategory !==
      "전공"
  ) {
    throw new Error(
      `${params.subjectName} 과목은 ${params.planRequirementType}이므로 플랜 분류가 전공이어야 합니다.`
    );
  }

  if (
    params.planRequirementType ===
      "교양" &&
    params.planCategory !==
      "교양"
  ) {
    throw new Error(
      `${params.subjectName} 과목은 교양이므로 플랜 분류도 교양이어야 합니다.`
    );
  }

  if (
    params.planRequirementType ===
      "일반" &&
    params.planCategory !==
      "일반"
  ) {
    throw new Error(
      `${params.subjectName} 과목은 일반이므로 플랜 분류도 일반이어야 합니다.`
    );
  }
}

export async function executePlanSubjectsUpdatePendingAction(
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
      "플랜 과목 수정 승인 실행 정보가 올바르지 않습니다."
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
      "플랜 과목 수정 승인 초안을 실행할 수 없습니다."
    );
  }

  const pendingAction =
    claimed.action;

  if (
    !pendingAction
  ) {
    throw new Error(
      "플랜 과목 수정 승인 초안을 찾을 수 없습니다."
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

      planId:
        normalizePositiveInteger(
          executionResult
            .planId
        ) ||
        null,

      planSubjectId:
  normalizePositiveInteger(
    Array.isArray(
      executionResult
        .planSubjectIds
    )
      ? executionResult
          .planSubjectIds[0]
      : 0
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
          "이미 수정된 플랜 과목입니다."
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

      planId:
        null,

      planSubjectId:
        null,

      updatedFields:
        [] as string[],

      pendingAction,

      message:
        "학생 플랜 과목을 수정하고 있습니다.",
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
      "plan_subjects_update"
    ) {
      throw new Error(
        "플랜 과목 수정 승인 초안이 아닙니다."
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
          PlanSubjectsUpdateDraft
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
        "플랜 과목을 수정할 학생 정보가 없습니다."
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
        "플랜 과목을 수정할 플랜 정보가 없습니다."
      );
    }

    const planSubjectId =
      normalizePositiveInteger(
        draft.planSubjectId
      );

    if (
      !planSubjectId
    ) {
      throw new Error(
        "수정할 플랜 과목 정보가 없습니다."
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
        "플랜 과목을 수정할 학생을 찾을 수 없습니다."
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
      "학생 담당자 플랜과목 수정권한 확인"
    );

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
        "플랜 과목 수정 초안 이후 학생 담당자가 변경되었습니다. 최신 학생 정보를 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "학생 담당자 변경 여부 확인"
    );

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
        "학생 플랜을 찾을 수 없습니다."
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
        "플랜 과목 수정 초안 이후 학생 플랜이 변경되었습니다. 최신 플랜을 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "학생 플랜 동일성 확인"
    );

    const currentPlanSubjects =
      await db.listPlanSemesters(
        studentId,
        {
          organizationId,
        }
      );

    const currentSubject =
      (
        currentPlanSubjects ||
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
      !currentSubject
    ) {
      throw new Error(
        "수정 대상 플랜 과목을 현재 학생에게서 찾을 수 없습니다."
      );
    }

    completedSteps.push(
      "수정 대상 플랜 과목 재조회"
    );

    const originalValues =
      parseJsonRecord(
        draft.originalValues
      );

    const updates =
      parseJsonRecord(
        draft.updates
      );

    const originalId =
      normalizePositiveInteger(
        originalValues.id
      );

    const originalStudentId =
      normalizePositiveInteger(
        originalValues.studentId
      );

    if (
      originalId !==
        planSubjectId ||
      originalStudentId !==
        studentId
    ) {
      throw new Error(
        "플랜 과목 수정 원본 대상 정보가 일치하지 않습니다."
      );
    }

    const currentSemesterNo =
      normalizePositiveInteger(
        (currentSubject as any)
          .semesterNo
      );

    const currentSubjectName =
      normalizeSubjectName(
        (currentSubject as any)
          .subjectName
      );

    const currentPlanCategory =
      normalizePlanCategory(
        (currentSubject as any)
          .planCategory
      );

    const currentRequirementType =
      normalizeRequirementType(
        (currentSubject as any)
          .planRequirementType
      );

    const currentCredits =
      normalizePositiveInteger(
        (currentSubject as any)
          .credits
      );

    const currentSortOrder =
      normalizeNonNegativeInteger(
        (currentSubject as any)
          .sortOrder ??
        0
      );

    const currentSettlementIncluded =
      (currentSubject as any)
        .settlementIncluded ===
      true;

    if (
      !currentSemesterNo ||
      !currentSubjectName ||
      !currentPlanCategory ||
      !currentRequirementType ||
      !currentCredits ||
      currentSortOrder ===
        null
    ) {
      throw new Error(
        "현재 플랜 과목 정보가 올바르지 않습니다."
      );
    }

    const originalSemesterNo =
      normalizePositiveInteger(
        originalValues
          .semesterNo
      );

    const originalSubjectName =
      normalizeSubjectName(
        originalValues
          .subjectName
      );

    const originalPlanCategory =
      normalizePlanCategory(
        originalValues
          .planCategory
      );

    const originalRequirementType =
      normalizeRequirementType(
        originalValues
          .planRequirementType
      );

    const originalCredits =
      normalizePositiveInteger(
        originalValues
          .credits
      );

    const originalSortOrder =
      normalizeNonNegativeInteger(
        originalValues
          .sortOrder
      );

    if (
      typeof originalValues
        .settlementIncluded !==
      "boolean"
    ) {
      throw new Error(
        "플랜 과목 수정 원본 정산 정보가 올바르지 않습니다."
      );
    }

    const originalSettlementIncluded =
      originalValues
        .settlementIncluded ===
      true;

    if (
      !originalSemesterNo ||
      !originalSubjectName ||
      !originalPlanCategory ||
      !originalRequirementType ||
      !originalCredits ||
      originalSortOrder ===
        null
    ) {
      throw new Error(
        "플랜 과목 수정 원본 정보가 올바르지 않습니다."
      );
    }

    /**
     * 플랜 과목은 한 행 단위 수정이므로
     * 원본 Snapshot 전체를 비교한다.
     *
     * 초안 생성 이후 다른 수정이 하나라도 있었다면
     * 오래된 초안으로 덮어쓰지 않는다.
     */
    if (
      currentSemesterNo !==
        originalSemesterNo ||
      currentSubjectName !==
        originalSubjectName ||
      currentPlanCategory !==
        originalPlanCategory ||
      currentRequirementType !==
        originalRequirementType ||
      currentCredits !==
        originalCredits ||
      currentSortOrder !==
        originalSortOrder ||
      currentSettlementIncluded !==
        originalSettlementIncluded
    ) {
      throw new Error(
        "플랜 과목 정보가 초안 생성 이후 변경되었습니다. 최신 정보를 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "플랜 과목 변경 충돌 검사"
    );

    const allowedFields = [
      "semesterNo",
      "subjectName",
      "planCategory",
      "planRequirementType",
      "credits",
      "sortOrder",
      "settlementIncluded",
    ] as const;

    const requestedFields =
      allowedFields.filter(
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
        "플랜 과목 수정 초안에 변경 항목이 없습니다."
      );
    }

    const updateData:
      Record<
        string,
        string |
        number |
        boolean
      > =
      {};

    if (
      hasOwnProperty(
        updates,
        "semesterNo"
      )
    ) {
      const value =
        Number(
          updates.semesterNo
        );

      if (
        !Number.isInteger(
          value
        ) ||
        value <
          1 ||
        value >
          20
      ) {
        throw new Error(
          "변경할 학기 번호가 올바르지 않습니다."
        );
      }

      updateData.semesterNo =
        value;
    }

    if (
      hasOwnProperty(
        updates,
        "subjectName"
      )
    ) {
      const value =
        normalizeSubjectName(
          updates.subjectName
        );

      if (
        !value
      ) {
        throw new Error(
          "변경할 과목명이 올바르지 않습니다."
        );
      }

      updateData.subjectName =
        value;
    }

    if (
      hasOwnProperty(
        updates,
        "planCategory"
      )
    ) {
      const value =
        normalizePlanCategory(
          updates.planCategory
        );

      if (
        !value
      ) {
        throw new Error(
          "변경할 플랜 분류가 올바르지 않습니다."
        );
      }

      updateData.planCategory =
        value;
    }

    if (
      hasOwnProperty(
        updates,
        "planRequirementType"
      )
    ) {
      const value =
        normalizeRequirementType(
          updates.planRequirementType
        );

      if (
        !value
      ) {
        throw new Error(
          "변경할 요구구분이 올바르지 않습니다."
        );
      }

      updateData.planRequirementType =
        value;
    }

    if (
      hasOwnProperty(
        updates,
        "credits"
      )
    ) {
      const value =
        Number(
          updates.credits
        );

      if (
        !Number.isInteger(
          value
        ) ||
        value <
          1 ||
        value >
          10
      ) {
        throw new Error(
          "변경할 학점 정보가 올바르지 않습니다."
        );
      }

      updateData.credits =
        value;
    }

    if (
      hasOwnProperty(
        updates,
        "sortOrder"
      )
    ) {
      const value =
        Number(
          updates.sortOrder
        );

      if (
        !Number.isInteger(
          value
        ) ||
        value <
          0
      ) {
        throw new Error(
          "변경할 정렬 순서가 올바르지 않습니다."
        );
      }

      updateData.sortOrder =
        value;
    }

    if (
      hasOwnProperty(
        updates,
        "settlementIncluded"
      )
    ) {
      if (
        typeof updates
          .settlementIncluded !==
        "boolean"
      ) {
        throw new Error(
          "변경할 정산 포함 여부가 올바르지 않습니다."
        );
      }

      updateData.settlementIncluded =
        updates
          .settlementIncluded;
    }

    const nextSubjectName =
      String(
        updateData.subjectName ??
        currentSubjectName
      );

    const nextPlanCategory =
      (
        updateData.planCategory ??
        currentPlanCategory
      ) as
        | "전공"
        | "교양"
        | "일반";

    const nextRequirementType =
      (
        updateData
          .planRequirementType ??
        currentRequirementType
      ) as
        | "전공필수"
        | "전공선택"
        | "교양"
        | "일반";

    assertCategoryRequirementPair({
      subjectName:
        nextSubjectName,

      planCategory:
        nextPlanCategory,

      planRequirementType:
        nextRequirementType,
    });

    /**
     * 과목명이 변경되는 경우
     * 현재 DB 중복검사 함수를 실행 단계에서도 다시 사용한다.
     */
    if (
      nextSubjectName
        .toLowerCase() !==
      currentSubjectName
        .toLowerCase()
    ) {
      const duplicate =
        await db.findDuplicatePlanSubject({
          organizationId,

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

    completedSteps.push(
      "플랜 과목 수정값 재검증"
    );

    /**
     * 실제 기존 DB 수정 함수 사용.
     *
     * 이 함수 내부에서:
     * - 과목명 중복
     * - 정산 포함 여부 재계산
     * - PLAN_REQUIREMENT_ENFORCE 정책
     * 을 다시 검사한다.
     */
    await db.updatePlanSemester(
      planSubjectId,
      updateData as any,
      {
        organizationId,
      }
    );

    completedSteps.push(
      "학생 플랜 과목 수정"
    );

    const reloadedPlanSubjects =
      await db.listPlanSemesters(
        studentId,
        {
          organizationId,
        }
      );

    const reloadedSubject =
      (
        reloadedPlanSubjects ||
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
      !reloadedSubject
    ) {
      throw new Error(
        "수정된 플랜 과목을 다시 확인할 수 없습니다."
      );
    }

    completedSteps.push(
      "수정 결과 재조회"
    );

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
      requestedFields
    ) {
      let beforeValue:
        string |
        number |
        boolean |
        null;

      let afterValue:
        string |
        number |
        boolean |
        null;

      if (
        field ===
          "semesterNo"
      ) {
        beforeValue =
          currentSemesterNo;

        afterValue =
          normalizePositiveInteger(
            (reloadedSubject as any)
              .semesterNo
          );
      } else if (
        field ===
          "subjectName"
      ) {
        beforeValue =
          currentSubjectName;

        afterValue =
          normalizeSubjectName(
            (reloadedSubject as any)
              .subjectName
          );
      } else if (
        field ===
          "planCategory"
      ) {
        beforeValue =
          currentPlanCategory;

        afterValue =
          normalizePlanCategory(
            (reloadedSubject as any)
              .planCategory
          );
      } else if (
        field ===
          "planRequirementType"
      ) {
        beforeValue =
          currentRequirementType;

        afterValue =
          normalizeRequirementType(
            (reloadedSubject as any)
              .planRequirementType
          );
      } else if (
        field ===
          "credits"
      ) {
        beforeValue =
          currentCredits;

        afterValue =
          normalizePositiveInteger(
            (reloadedSubject as any)
              .credits
          );
      } else if (
        field ===
          "sortOrder"
      ) {
        beforeValue =
          currentSortOrder;

        afterValue =
          normalizeNonNegativeInteger(
            (reloadedSubject as any)
              .sortOrder ??
            0
          );
      } else {
        beforeValue =
          currentSettlementIncluded;

        afterValue =
          (reloadedSubject as any)
            .settlementIncluded ===
          true;
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
          "AI 학생 플랜 과목 수정",

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
        "플랜 과목 수정 감사로그 기록"
      );
    } catch {
      completedSteps.push(
        "플랜 과목 수정 완료 - 감사로그 기록 실패"
      );
    }

    const studentName =
      String(
        (student as any)
          .clientName ||
        ""
      ).trim();

    const subjectName =
      normalizeSubjectName(
        (reloadedSubject as any)
          .subjectName
      );

    const successMessage =
      `${
        studentName ||
        `학생 #${studentId}`
      }님의 ${subjectName} 과목 ${
        requestedFields.length
      }개 항목이 수정되었습니다.`;

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

        planSubjectIds: [
          planSubjectId,
        ],

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

      planSubjectId,

      updatedFields:
        requestedFields,

      planSubject:
        reloadedSubject,

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
        : "학생 플랜 과목 수정에 실패했습니다.";

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
       * 실패 상태 기록 오류가
       * 원래 실행 오류를 덮지 않도록 한다.
       */
    }

    throw error;
  }
}