import {
  executePlanSubjectsCreatePendingAction,
} from "./plan-subjects-create-executor";

import {
  safePatchAiWorkSessionAfterPendingAction,
} from "./ai-pending-action-work-session-service";

import type {
  AiUserContext,
} from "./ai.types";

export async function confirmPlanSubjectsCreatePendingAction(
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
   * 학생 플랜 과목 생성 실제 실행.
   */
  const result =
    await executePlanSubjectsCreatePendingAction({
      pendingActionId:
        Math.floor(
          pendingActionId
        ),

      expectedVersion,

      context:
        aiContext,
    });

  /**
   * 실제 플랜 과목 생성과 Pending Action 처리는
   * Executor에서 완료된다.
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