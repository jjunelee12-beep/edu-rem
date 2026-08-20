import {
  executeConsultationUpdatePendingAction,
} from "./consultation-update-executor";

import {
  safePatchAiWorkSessionAfterPendingAction,
} from "./ai-pending-action-work-session-service";

import type {
  AiUserContext,
} from "./ai.types";

export async function confirmConsultationUpdatePendingAction(
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
   * 상담DB 정보 수정 실제 실행.
   */
  const result =
    await executeConsultationUpdatePendingAction({
      pendingActionId:
        Math.floor(
          pendingActionId
        ),

      expectedVersion,

      context:
        aiContext,
    });

  /**
   * 상담DB 수정과 Pending Action 완료는
   * Executor에서 처리한다.
   *
   * Work Session 후처리 오류가
   * 실제 상담DB 수정 결과를 실패로
   * 변경하지 않도록 안전 함수를 사용한다.
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
        result.consultationId,

      studentId:
        null,

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