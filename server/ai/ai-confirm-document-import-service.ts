import {
  executeDocumentImportPendingAction,
} from "./document-import-executor";

import {
  safePatchAiWorkSessionAfterPendingAction,
} from "./ai-pending-action-work-session-service";

import {
  throwAppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

import type {
  AiUserContext,
} from "./ai.types";

export async function confirmDocumentImportPendingAction(
  params: {
    pendingActionId:
      number;

    expectedVersion:
      number;

    aiContext:
      AiUserContext;

    actorName:
      string | null;

    requestedByUserId:
      number;
  }
) {
  const {
    pendingActionId,
    expectedVersion,
    aiContext,
    actorName,
    requestedByUserId,
  } = params;

  /**
   * OCR 초안을 처음 생성한 사용자 ID를 사용한다.
   *
   * 현재 승인 사용자의 ID로 대체하면 안 된다.
   */
  const documentRequestedByUserId =
    Number(
      requestedByUserId ||
      0
    );

  if (
    !Number.isFinite(
      documentRequestedByUserId
    ) ||
    documentRequestedByUserId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서 분석 승인 요청의 최초 요청자 정보를 확인할 수 없습니다.",
      400
    );
  }

  /**
   * 문서 분석 결과를 실제 CRM에 반영한다.
   *
   * organizationId / 현재 승인자 / 권한은
   * 서버에서 생성한 AI Context를 기준으로
   * Executor가 다시 검사한다.
   */
  const result =
    await executeDocumentImportPendingAction({
      pendingActionId:
        Math.floor(
          pendingActionId
        ),

      requestedByUserId:
        Math.floor(
          documentRequestedByUserId
        ),

      context:
        aiContext,

      expectedVersion,

      actorName,
    });

  /**
   * 실제 DB 반영 성공 여부를 기준으로
   * Work Session을 후처리한다.
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