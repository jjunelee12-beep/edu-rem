import {
  executeStudentRegistrationPendingAction,
} from "./student-registration-executor";

import {
  safePatchAiWorkSessionAfterPendingAction,
} from "./ai-pending-action-work-session-service";

import type {
  AiUserContext,
} from "./ai.types";

export async function confirmStudentRegistrationPendingAction(
  params: {
    pendingActionId:
      number;

    expectedVersion:
      number;

    aiContext:
      AiUserContext;

    actorName:
      string | null;

    consultationId:
      number | null;
  }
) {
  const {
    pendingActionId,
    expectedVersion,
    aiContext,
    actorName,
    consultationId,
  } = params;

  /**
   * 등록예정 학생 통합등록 실제 실행.
   */
  const result =
    await executeStudentRegistrationPendingAction({
      pendingActionId:
        Math.floor(
          pendingActionId
        ),

      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      confirmedByUserId:
        aiContext.userId,

      expectedVersion,

      actorName,

      actorRole:
        aiContext.role,
    });

  /**
   * 생성된 학생을 현재 Work Session 대상으로 연결한다.
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

      consultationId,

      studentId:
        result.studentId,

      studentName:
        null,
    });

  /**
   * 실제 생성된 학생 상세페이지 경로.
   */
  const studentDetailPath =
    result.studentId &&
    Number(
      result.studentId
    ) > 0
      ? `/students/${Number(
          result.studentId
        )}`
      : null;

  /**
   * 기존 웹 업무비서 완료 메시지를 그대로 유지한다.
   */
  const completionMessage =
    result.success ===
        true ||
    result.alreadyExecuted ===
        true
      ? [
          result.message,
          "",
          studentDetailPath
            ? "생성된 학생 상세페이지에서 학기와 과목설계를 확인해주세요."
            : null,
        ]
          .filter(
            Boolean
          )
          .join(
            "\n"
          )
      : result.message;

  return {
    result,

    pendingAction:
      result.pendingAction,

    workSession,

    studentDetailPath,

    completionMessage,
  };
}