import {
  executeSemesterCreatePendingAction,
} from "./semester-create-executor";

import {
  safePatchAiWorkSessionAfterPendingAction,
} from "./ai-pending-action-work-session-service";

import type {
  AiUserContext,
} from "./ai.types";

export async function confirmSemesterCreatePendingAction(
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
   * 학생 학기 생성 실제 실행.
   */
  const result =
    await executeSemesterCreatePendingAction({
      pendingActionId:
        Math.floor(
          pendingActionId
        ),

      expectedVersion,

      context:
        aiContext,
    });

  /**
   * 학기와 Pending Action 실행은 이미
   * Executor의 DB 트랜잭션에서 완료된다.
   *
   * Work Session 후처리 오류가 실제 학기 생성
   * 결과를 실패로 변경하지 않도록 안전 함수를 사용한다.
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