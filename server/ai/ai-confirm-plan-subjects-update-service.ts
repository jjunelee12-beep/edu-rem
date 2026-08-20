import {
  executePlanSubjectsUpdatePendingAction,
} from "./plan-subjects-update-executor";

import {
  safePatchAiWorkSessionAfterPendingAction,
} from "./ai-pending-action-work-session-service";

import type {
  AiUserContext,
} from "./ai.types";

export async function confirmPlanSubjectsUpdatePendingAction(
  params: {
    pendingActionId:
      number;

    expectedVersion:
      number;

    aiContext:
      AiUserContext;
  }
) {
  const {
    pendingActionId,
    expectedVersion,
    aiContext,
  } = params;

  /**
   * 학생 플랜 과목 수정 실제 실행.
   */
  const result =
    await executePlanSubjectsUpdatePendingAction({
      pendingActionId:
        Math.floor(
          pendingActionId
        ),

      expectedVersion,

      context:
        aiContext,
    });

  /**
   * 실제 planSemesters 수정과
   * Pending Action 완료 처리는
   * Executor에서 이미 수행된다.
   *
   * 여기서는 Work Session 후처리만 담당한다.
   */
  const workSession =
    await safePatchAiWorkSessionAfterPendingAction({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      pendingActionId:
        Math.floor(
          pendingActionId
        ),

      success:
        result.success,

      alreadyExecuted:
        result.alreadyExecuted,

      executing:
        result.executing,

      consultationId:
        null,

      studentId:
        result.studentId,

      studentName:
        null,
    });

  return {
    result,

    pendingAction:
      result.pendingAction,

    workSession,
  };
}