import * as db from "../db";

import {
  assertCanAccessStudent,
  assertCanWriteStudent,
} from "./ai-permission";

import type {
  AiUserContext,
  PlanSubjectsCreateDraft,
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

function normalizeSubjectName(
  value:
    unknown
): string {
  return String(
    value ||
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

function normalizePositiveIntegerArray(
  value:
    unknown
): number[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          (
            item
          ) =>
            normalizePositiveInteger(
              item
            )
        )
        .filter(
          (
            item
          ) =>
            item >
            0
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
}

export async function executePlanSubjectsCreatePendingAction(
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
      "플랜 과목 생성 승인 실행 정보가 올바르지 않습니다."
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
      "플랜 과목 생성 승인 초안을 실행할 수 없습니다."
    );
  }

  const pendingAction =
    claimed.action;

  if (
    !pendingAction
  ) {
    throw new Error(
      "플랜 과목 생성 승인 초안을 찾을 수 없습니다."
    );
  }

  /**
   * 동일 Pending Action이 이미 실행된 경우
   * 과목을 다시 생성하지 않는다.
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

    const planSubjectIds =
      normalizePositiveIntegerArray(
        executionResult
          .planSubjectIds
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
            .planId ??
          pendingAction
            .planId
        ) ||
        null,

      planSubjectIds,

      pendingAction,

      message:
        String(
          executionResult
            .message ||
          "이미 생성된 플랜 과목입니다."
        ),
    };
  }

  /**
   * 이미 다른 요청이 실행 중이면
   * 두 번 실행하지 않는다.
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
        normalizePositiveInteger(
          pendingAction
            .planId
        ) ||
        null,

      planSubjectIds:
        [] as number[],

      pendingAction,

      message:
        "학생 플랜 과목을 생성하고 있습니다.",
    };
  }

  const completedSteps:
    string[] =
    [];

  try {
    /**
     * 다른 Pending Action 타입을
     * 잘못 실행하지 못하도록 확인한다.
     */
    if (
      String(
        pendingAction
          .actionType ||
        ""
      ) !==
      "plan_subjects_create"
    ) {
      throw new Error(
        "플랜 과목 생성 승인 초안이 아닙니다."
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
          PlanSubjectsCreateDraft
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
        "플랜 과목을 생성할 학생 정보가 없습니다."
      );
    }

    const planId =
      normalizePositiveInteger(
        draft.planId ??
        pendingAction
          .planId
      );

    if (
      !planId
    ) {
      throw new Error(
        "플랜 과목을 생성할 플랜 정보가 없습니다."
      );
    }

    /**
     * 현재 조직 기준 학생 재조회
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
        "플랜 과목을 생성할 학생을 찾을 수 없습니다."
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
      "학생 담당자 플랜과목 생성권한 확인"
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
        "플랜 과목 생성 초안 이후 학생 담당자가 변경되었습니다. 최신 학생 정보를 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "학생 담당자 변경 여부 확인"
    );

    /**
     * 현재 학생 플랜 재조회
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
        "플랜 과목 생성 초안 이후 학생 플랜이 변경되었습니다. 최신 플랜을 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "학생 플랜 동일성 확인"
    );

    /**
     * Snapshot ID 목록 검증
     */
    const originalPlanSubjectIds =
      normalizePositiveIntegerArray(
        draft.originalPlanSubjectIds
      );

    /**
     * 과목 초안 정규화 및
     * Executor 자체 검증
     */
    const rawSubjects =
      Array.isArray(
        draft.subjects
      )
        ? draft.subjects
        : [];

    if (
      rawSubjects.length ===
      0
    ) {
      throw new Error(
        "생성할 플랜 과목이 없습니다."
      );
    }

    if (
      rawSubjects.length >
      100
    ) {
      throw new Error(
        "한 번에 생성할 수 있는 플랜 과목은 최대 100개입니다."
      );
    }

    const normalizedSubjects:
      PlanSubjectsCreateDraft[
        "subjects"
      ] =
      [];

    const subjectNameSet =
      new Set<
        string
      >();

    for (
      let index =
        0;
      index <
        rawSubjects.length;
      index +=
        1
    ) {
      const subject =
        rawSubjects[index];

      if (
        !subject ||
        typeof subject !==
          "object" ||
        Array.isArray(
          subject
        )
      ) {
        throw new Error(
          `${index + 1}번째 플랜 과목 정보가 올바르지 않습니다.`
        );
      }

      const semesterNo =
        normalizePositiveInteger(
          subject.semesterNo
        );

      if (
        semesterNo <
          1 ||
        semesterNo >
          20
      ) {
        throw new Error(
          `${index + 1}번째 과목의 학기 번호가 올바르지 않습니다.`
        );
      }

      const subjectName =
        normalizeSubjectName(
          subject.subjectName
        );

      if (
        !subjectName
      ) {
        throw new Error(
          `${index + 1}번째 플랜 과목명이 없습니다.`
        );
      }

      const subjectNameKey =
        subjectName
          .toLowerCase();

      if (
        subjectNameSet.has(
          subjectNameKey
        )
      ) {
        throw new Error(
          `플랜 과목 생성 초안에 중복 과목이 있습니다: ${subjectName}`
        );
      }

      subjectNameSet.add(
        subjectNameKey
      );

      const planCategory =
        String(
          subject.planCategory ||
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
          `${subjectName}의 플랜 분류가 올바르지 않습니다.`
        );
      }

      const planRequirementType =
        String(
          subject
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
          `${subjectName}의 요구구분이 올바르지 않습니다.`
        );
      }

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
          `${subjectName}의 요구구분과 플랜 분류가 일치하지 않습니다.`
        );
      }

      if (
        planRequirementType ===
          "교양" &&
        planCategory !==
          "교양"
      ) {
        throw new Error(
          `${subjectName}의 요구구분과 플랜 분류가 일치하지 않습니다.`
        );
      }

      if (
        planRequirementType ===
          "일반" &&
        planCategory !==
          "일반"
      ) {
        throw new Error(
          `${subjectName}의 요구구분과 플랜 분류가 일치하지 않습니다.`
        );
      }

      const credits =
        normalizePositiveInteger(
          subject.credits
        );

      if (
        credits <
          1 ||
        credits >
          10
      ) {
        throw new Error(
          `${subjectName}의 학점 정보가 올바르지 않습니다.`
        );
      }

      const sortOrder =
        normalizeNonNegativeInteger(
          subject.sortOrder
        );

      if (
        sortOrder ===
        null
      ) {
        throw new Error(
          `${subjectName}의 정렬 순서가 올바르지 않습니다.`
        );
      }

      if (
        typeof subject
          .settlementIncluded !==
        "boolean"
      ) {
        throw new Error(
          `${subjectName}의 정산 포함 여부가 올바르지 않습니다.`
        );
      }

      normalizedSubjects.push({
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

        settlementIncluded:
          subject
            .settlementIncluded,
      });
    }

    completedSteps.push(
      "플랜 과목 초안 재검증"
    );

    /**
     * 실제 DB 생성은 한 번의 transaction으로 처리한다.
     *
     * 여기서 DB가:
     * - planId 동일성
     * - 기존 planSemester Snapshot
     * - 기존 과목 중복
     * - 요구구분 한도
     * - 전체 이론과목 한도
     * 를 다시 검사한다.
     */
    const creationResult =
      await db.createPlanSubjectsAtomic({
        organizationId,

        studentId,

        planId,

        originalPlanSubjectIds,

        subjects:
          normalizedSubjects,
      });

    const planSubjectIds =
      normalizePositiveIntegerArray(
        creationResult
          ?.planSubjectIds
      );

    if (
      planSubjectIds.length !==
      normalizedSubjects.length
    ) {
      throw new Error(
        "플랜 과목 생성 결과 수가 승인된 과목 수와 일치하지 않습니다."
      );
    }

    completedSteps.push(
      `플랜 과목 ${planSubjectIds.length}개 생성`
    );

    /**
     * 생성 이후 전체 과목을 다시 조회하고
     * 방금 생성한 ID가 실제 존재하는지 확인한다.
     */
    const currentPlanSubjects =
      await db.listPlanSemesters(
        studentId,
        {
          organizationId,
        }
      );

    const currentPlanSubjectIdSet =
      new Set(
        (
          currentPlanSubjects ||
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
      );

    const allCreatedSubjectsExist =
      planSubjectIds.every(
        (
          id
        ) =>
          currentPlanSubjectIdSet.has(
            id
          )
      );

    if (
      !allCreatedSubjectsExist
    ) {
      throw new Error(
        "생성된 플랜 과목을 다시 확인할 수 없습니다."
      );
    }

    completedSteps.push(
      "생성된 플랜 과목 재조회"
    );

    /**
     * 학생 감사로그
     *
     * 현재 프로젝트에서 플랜 생성 감사로그가
     * entityType = "plan"을 사용하므로
     * 플랜 과목도 동일 플랜 엔터티 아래 기록한다.
     */
    try {
      await db.createStudentAuditLog({
        organizationId,

        studentId,

        entityType:
          "plan",

        entityId:
          planId,

        action:
          "create",

        title:
          "AI 학생 플랜 과목 생성",

        beforeJson: {
          planSubjectIds:
            originalPlanSubjectIds,
        },

        afterJson: {
          addedPlanSubjectIds:
            planSubjectIds,

          subjects:
            normalizedSubjects,
        },

        diffJson: {
          planSubjects: {
            before:
              originalPlanSubjectIds,

            after:
              planSubjectIds,
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
        "플랜 과목 생성 감사로그 기록"
      );
    } catch {
      completedSteps.push(
        "플랜 과목 생성 완료 - 감사로그 기록 실패"
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
      }님의 플랜 과목 ${planSubjectIds.length}개가 생성되었습니다.`;

    /**
     * Pending Action 성공 처리
     *
     * markAiPendingActionExecuted()의 현재 실제 인자와 맞춘다.
     */
    const completed =
      await db.markAiPendingActionExecuted({
        id:
          pendingActionId,

        organizationId,

        requestedByUserId,

        expectedVersion,

        consultationId:
          null,

        studentId,

        scheduleId:
          null,

        planId,

        semesterIds:
          [],

        planSubjectIds,

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

      planSubjectIds,

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
        : "학생 플랜 과목 생성에 실패했습니다.";

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
       * 실패 상태 기록 실패가
       * 원래 실행 오류를 덮지 않도록 한다.
       */
    }

    throw error;
  }
}