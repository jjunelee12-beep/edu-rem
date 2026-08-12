import * as db from "../db";

import {
  assertCanAccessStudent,
  assertCanWriteStudent,
} from "./ai-permission";

import type {
  AiUserContext,
  PlanCreateDraft,
} from "./ai.types";

/**
 * 양의 정수 정규화
 */
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

/**
 * 0 이상의 정수 정규화
 *
 * plan_create에서는 과목 수가
 * 반드시 확정된 상태여야 하므로
 * 잘못된 값은 null로 반환한다.
 */
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
    !Number.isFinite(
      normalized
    ) ||
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

/**
 * nullable 문자열 정규화
 */
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

/**
 * Pending Action payloadJson / executionResultJson
 * 안전 파싱
 */
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

/**
 * plan_create 승인 실행
 *
 * 처리 순서
 *
 * 1. Pending Action claim
 * 2. actionType 확인
 * 3. 학생 재조회
 * 4. 조회 권한 재검사
 * 5. 쓰기 권한 재검사
 * 6. 담당자 변경 충돌 검사
 * 7. 기존 플랜 재검사
 * 8. 플랜 값 재검증
 * 9. 신규 플랜 생성
 * 10. 생성 결과 재조회
 * 11. 감사로그 기록
 * 12. Pending Action executed 처리
 */
export async function executePlanCreatePendingAction(
  params: {
    pendingActionId:
      number;

    expectedVersion:
      number;

    /**
     * Router에서 buildAiContext()로 생성한
     * 실제 서버 권한 Context
     *
     * organizationId, userId, role 등을
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
      "플랜 생성 승인 실행 정보가 올바르지 않습니다."
    );
  }

  /**
   * Pending Action을 executing 상태로 claim한다.
   *
   * 중복 승인 클릭 및 동시 실행을 방지한다.
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
      "플랜 생성 승인 초안을 실행할 수 없습니다."
    );
  }

  const pendingAction =
    claimed.action;

  if (!pendingAction) {
    throw new Error(
      "플랜 생성 승인 초안을 찾을 수 없습니다."
    );
  }

  /**
   * 이미 실행된 작업이면
   * 플랜을 다시 생성하지 않는다.
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

    const studentId =
      normalizePositiveInteger(
        executionResult
          .studentId ??
        pendingAction
          .studentId
      ) ||
      null;

    const planId =
      normalizePositiveInteger(
        executionResult
          .planId ??
        pendingAction
          .planId
      ) ||
      null;

    return {
      success:
        true,

      alreadyExecuted:
        true,

      executing:
        false,

      studentId,

      planId,

      pendingAction,

      message:
        String(
          executionResult
            .message ||
          "이미 생성된 학생 플랜입니다."
        ),
    };
  }

  /**
   * 다른 요청에서 현재 실행 중이라면
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
        normalizePositiveInteger(
          pendingAction
            .planId
        ) ||
        null,

      pendingAction,

      message:
        "학생 플랜을 생성하고 있습니다.",
    };
  }

  const completedSteps:
    string[] =
    [];

  try {
    /**
     * 다른 Pending Action 타입을
     * 잘못 실행하지 못하도록 재검사한다.
     */
    if (
      String(
        pendingAction
          .actionType ||
        ""
      ) !==
      "plan_create"
    ) {
      throw new Error(
        "플랜 생성 승인 초안이 아닙니다."
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

    /**
     * Router가 payload에
     * { draft, ... } 형태로 넣는 경우와
     * draft 자체를 넣는 경우를 모두 처리한다.
     */
    const draftSource =
      parseJsonRecord(
        payload.draft ??
        payload
      );

    const draft =
      draftSource as
        Partial<
          PlanCreateDraft
        >;

    const studentId =
      normalizePositiveInteger(
        draft.studentId ??
        pendingAction
          .studentId
      );

    if (!studentId) {
      throw new Error(
        "플랜을 생성할 학생 정보가 없습니다."
      );
    }

    /**
     * 현재 조직 범위에서 학생을 다시 가져온다.
     *
     * 초안 생성 시점 학생 객체를 신뢰하지 않는다.
     */
    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId,
        }
      );

    if (!student) {
      throw new Error(
        "플랜을 생성할 학생을 찾을 수 없습니다."
      );
    }

    /**
     * 현재 사용자 조회 범위 재검사
     */
    assertCanAccessStudent({
      context,
      student,
    });

    completedSteps.push(
      "학생 조회권한 확인"
    );

    /**
     * 실제 DB 생성 직전
     * 담당자 기준 쓰기 권한 재검사
     */
    assertCanWriteStudent({
      context,
      student,
    });

    completedSteps.push(
      "학생 담당자 플랜생성 권한 확인"
    );

    /**
     * 초안 생성 당시 담당자와
     * 현재 담당자를 비교한다.
     *
     * 초안 생성 후 담당자가 변경됐으면
     * 오래된 승인 초안을 실행하지 않는다.
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
        "플랜 생성 초안 이후 학생 담당자가 변경되었습니다. 최신 학생 정보를 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "학생 담당자 변경 여부 확인"
    );

    /**
     * 이 Tool은 신규 생성 전용이다.
     *
     * 초안 이후 다른 사용자가 플랜을 생성했다면
     * 기존 플랜을 절대로 수정하지 않고 차단한다.
     */
    const currentPlan =
      await db.getPlan(
        studentId,
        {
          organizationId,
        }
      );

    if (
      currentPlan
    ) {
      throw new Error(
        "플랜 생성 초안 이후 학생 플랜이 새로 등록되었습니다. 기존 플랜을 덮어쓰지 않고 작업을 중단합니다."
      );
    }

    if (
      draft.originalPlanExists !==
      false
    ) {
      throw new Error(
        "플랜 생성 초안의 기존 플랜 상태가 올바르지 않습니다."
      );
    }

    completedSteps.push(
      "기존 플랜 중복 및 충돌 검사"
    );

    const desiredCourse =
      normalizeNullableText(
        draft.desiredCourse,
        200
      );

    const finalEducation =
      normalizeNullableText(
        draft.finalEducation,
        100
      );

    /**
     * hasPractice는 boolean만 허용한다.
     *
     * 문자열 "true", "false" 등을
     * 임의 변환하지 않는다.
     */
    if (
      typeof draft.hasPractice !==
      "boolean"
    ) {
      throw new Error(
        "실습 필요 여부가 확정되지 않았습니다."
      );
    }

    const hasPractice =
      draft.hasPractice;

    const totalTheorySubjects =
      normalizeNonNegativeInteger(
        draft.totalTheorySubjects
      );

    const requiredMajorCount =
      normalizeNonNegativeInteger(
        draft.requiredMajorCount
      );

    const electiveMajorCount =
      normalizeNonNegativeInteger(
        draft.electiveMajorCount
      );

    const liberalCount =
      normalizeNonNegativeInteger(
        draft.liberalCount
      );

    const generalCount =
      normalizeNonNegativeInteger(
        draft.generalCount
      );

    if (
      totalTheorySubjects ===
        null ||
      requiredMajorCount ===
        null ||
      electiveMajorCount ===
        null ||
      liberalCount ===
        null ||
      generalCount ===
        null
    ) {
      throw new Error(
        "플랜 과목 수 정보가 올바르지 않습니다."
      );
    }

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

    completedSteps.push(
      "플랜 과목 수 및 실습 여부 검증"
    );

    /**
     * 신규 생성 전용 DB 함수를 사용한다.
     *
     * upsertPlan()은 사용하지 않는다.
     * 승인 시점에 기존 플랜이 생긴 경우
     * update로 덮어쓰는 것을 방지하기 위해서다.
     */
    const planIdRaw =
      await db.createPlanOnly({
        organizationId,

        studentId,

        desiredCourse:
          desiredCourse ??
          undefined,

        finalEducation:
          finalEducation ??
          undefined,

        totalTheorySubjects,

        requiredMajorCount,

        electiveMajorCount,

        liberalCount,

        generalCount,

        hasPractice,

        /**
         * 실습 세부값은
         * 추후 실습 Workflow가 관리한다.
         */
        practiceArranged:
          false,

        practiceStatus:
          "미섭외",
      } as any);

    const planId =
      normalizePositiveInteger(
        planIdRaw
      );

    if (!planId) {
      throw new Error(
        "플랜 생성 후 플랜 ID를 확인하지 못했습니다."
      );
    }

    completedSteps.push(
      "학생 플랜 생성"
    );

    /**
     * DB에 실제 생성됐는지 다시 조회한다.
     */
    const createdPlan =
      await db.getPlan(
        studentId,
        {
          organizationId,
        }
      );

    if (
      !createdPlan
    ) {
      throw new Error(
        "생성된 플랜 정보를 다시 확인할 수 없습니다."
      );
    }

    const createdPlanId =
      normalizePositiveInteger(
        (createdPlan as any)
          .id
      );

    if (
      !createdPlanId ||
      createdPlanId !==
        planId
    ) {
      throw new Error(
        "생성된 플랜 ID가 예상한 결과와 일치하지 않습니다."
      );
    }

    completedSteps.push(
      "생성 결과 재조회"
    );

    /**
     * 학생 감사로그
     *
     * 실제 플랜 생성이 성공한 뒤
     * 감사로그만 실패했다고 플랜을 롤백하지 않는다.
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
          "AI 학생 플랜 생성",

        beforeJson:
          null,

        afterJson: {
          id:
            planId,

          desiredCourse,

          finalEducation,

          totalTheorySubjects,

          requiredMajorCount,

          electiveMajorCount,

          liberalCount,

          generalCount,

          hasPractice,

          practiceArranged:
            false,

          practiceStatus:
            "미섭외",
        },

        diffJson: {
          plan: {
            before:
              null,

            after: {
              id:
                planId,

              desiredCourse,

              finalEducation,

              totalTheorySubjects,

              requiredMajorCount,

              electiveMajorCount,

              liberalCount,

              generalCount,

              hasPractice,
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
        "플랜 생성 감사로그 기록"
      );
    } catch {
      completedSteps.push(
        "플랜 생성 완료 - 감사로그 기록 실패"
      );
    }

    const studentName =
      normalizeNullableText(
        (student as any)
          .clientName,
        100
      );

    const successMessage =
      `${
        studentName ||
        `학생 #${studentId}`
      }님의 플랜이 생성되었습니다.`;

    /**
     * claim 함수는 version을 별도로 증가시키지 않는
     * 기존 Executor 구조를 그대로 따른다.
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

      plan:
        createdPlan,

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
        : "학생 플랜 생성에 실패했습니다.";

    /**
     * 실제 오류를 Pending Action에도 남긴다.
     */
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
       * 실패 상태 저장 자체가 실패해도
       * 원래 플랜 생성 오류를 유지한다.
       */
    }

    throw error;
  }
}