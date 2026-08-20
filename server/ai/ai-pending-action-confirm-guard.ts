import * as db from "../db";

import {
  throwAppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

import {
  assertCanWriteStudent,
} from "./ai-permission";

import type {
  AiUserContext,
} from "./ai.types";

export type AiPendingActionConfirmGuardResult = {
  pendingAction:
    any;

  pendingActionId:
    number;

  actionType:
    string;

  expectedVersion:
    number;

  isDocumentPendingAction:
    boolean;

  actorName:
    string | null;
};

const DOCUMENT_PENDING_ACTION_TYPES =
  new Set([
    "document_transfer_import",
    "document_plan_import",
    "document_payment_import",
    "document_plan_payment_import",
  ]);

export async function prepareAiPendingActionForConfirmation(
  params: {
    pendingActionId:
      number;

    expectedVersion?:
      number |
      null;

    aiContext:
      AiUserContext;

    actorName?:
      string |
      null;
  }
): Promise<AiPendingActionConfirmGuardResult> {
  const pendingActionId =
    Math.floor(
      Number(
        params.pendingActionId ||
        0
      )
    );

  if (
    !Number.isFinite(
      pendingActionId
    ) ||
    pendingActionId <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "올바른 AI 승인 요청 ID가 필요합니다.",
      400
    );
  }

  const aiContext =
    params.aiContext;

  if (
    aiContext.canWrite !==
      true
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "현재 계정은 AI 승인 작업을 실행할 수 없습니다.",
      403
    );
  }

  /**
   * Pending Action ID + 회사 범위로 조회한다.
   *
   * organizationId는 서버에서 생성된
   * AiUserContext 값만 사용한다.
   */
  const pendingAction =
    await db.getAiPendingActionByIdForExecution({
      id:
        pendingActionId,

      organizationId:
        aiContext.organizationId,
    });

  if (
    !pendingAction
  ) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "AI 승인 초안을 찾을 수 없습니다.",
      404
    );
  }

  /**
   * Action Type 역시 DB 원본만 신뢰한다.
   */
  const actionType =
    String(
      pendingAction.actionType ||
      ""
    ).trim();

  if (
    !actionType
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 승인 작업 종류를 확인할 수 없습니다.",
      400
    );
  }

  const isDocumentPendingAction =
    DOCUMENT_PENDING_ACTION_TYPES.has(
      actionType
    );

  /**
   * 모든 Pending Action은
   * 최초 생성자 본인만 승인 가능하다.
   */
  const requestedByUserId =
    Math.floor(
      Number(
        pendingAction
          .requestedByUserId ||
        0
      )
    );

  if (
    !Number.isFinite(
      requestedByUserId
    ) ||
    requestedByUserId <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 승인 초안의 최초 요청자 정보를 확인할 수 없습니다.",
      400
    );
  }

  if (
    requestedByUserId !==
      aiContext.userId
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "본인이 생성한 AI 승인 초안만 실행할 수 있습니다.",
      403
    );
  }

  /**
   * OCR Pending Action은
   * 최초 생성자 검사뿐 아니라
   * 현재 학생 쓰기 권한까지 다시 검사한다.
   */
  if (
    isDocumentPendingAction
  ) {
    const studentId =
      Math.floor(
        Number(
          pendingAction
            .studentId ||
          0
        )
      );

    if (
      !Number.isFinite(
        studentId
      ) ||
      studentId <=
        0
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "문서 승인 초안의 대상 학생 정보를 확인할 수 없습니다.",
        400
      );
    }

    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            aiContext.organizationId,
        }
      );

    if (
      !student
    ) {
      throwAppError(
        ERROR_CODES.DATA_NOT_FOUND,
        "문서 반영 대상 학생을 찾을 수 없습니다.",
        404
      );
    }

    assertCanWriteStudent({
      context:
        aiContext,

      student,
    });
  }

  /**
   * DB 현재 버전 확인.
   */
  const currentVersion =
    Math.floor(
      Number(
        pendingAction.version ||
        0
      )
    );

  if (
    !Number.isFinite(
      currentVersion
    ) ||
    currentVersion <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 승인 초안 버전 정보가 올바르지 않습니다.",
      409
    );
  }

  const requestedVersion =
    Math.floor(
      Number(
        params.expectedVersion ||
        0
      )
    );

  /**
   * 승인 카드에서 전달된 버전이 있다면
   * 현재 DB 버전과 반드시 같아야 한다.
   *
   * 자연어 승인은 expectedVersion이 없으므로
   * 현재 DB 버전을 그대로 사용한다.
   */
  if (
    requestedVersion > 0 &&
    requestedVersion !==
      currentVersion
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 승인 초안이 변경되었습니다. 최신 내용을 다시 확인해주세요.",
      409
    );
  }

  const actorName =
    String(
      params.actorName ||
      aiContext.userName ||
      ""
    ).trim() ||
    null;

  return {
    pendingAction,

    pendingActionId,

    actionType,

    expectedVersion:
      currentVersion,

    isDocumentPendingAction,

    actorName,
  };
}