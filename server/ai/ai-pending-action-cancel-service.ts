import * as db from "../db";

import {
  throwAppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

import type {
  AiUserContext,
} from "./ai.types";

/**
 * AI Pending Action 취소 공통 서비스.
 *
 * 이 함수는 HTTP / tRPC / Kakao Session을 알지 못한다.
 *
 * 오직 서버에서 이미 검증된 AiUserContext만 받는다.
 *
 * 따라서:
 *
 * 웹 CRM
 *   createRequestAiContext()
 *       ↓
 *   cancelAiPendingAction()
 *
 * 카카오 담당자
 *   buildAiContext()
 *       ↓
 *   cancelAiPendingAction()
 *
 * 두 경로가 완전히 동일한 취소 권한을 사용한다.
 */
export async function cancelAiPendingAction(
  params: {
    context:
      AiUserContext;

    pendingActionId:
      number;

    /**
     * 승인 카드 버튼에서는 현재 프론트가 알고 있는
     * Pending Action version을 전달한다.
     *
     * 자연어 취소에서는 null.
     *
     * null이면 서버 DB의 현재 version을 사용한다.
     */
    expectedVersion?:
      number |
      null;
  }
) {
  const aiContext =
    params.context;

  const pendingActionId =
    Number(
      params.pendingActionId ||
      0
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

  /**
   * ---------------------------------------------------------
   * 1. Pending Action 서버 재조회
   * ---------------------------------------------------------
   *
   * AI가 말한:
   *
   * - actionType
   * - organizationId
   * - userId
   * - version
   *
   * 을 신뢰하지 않는다.
   *
   * 서버에서 인증된 AiUserContext를 기준으로
   * 다시 조회한다.
   */
  const currentPendingAction =
    await db.getAiPendingActionForConfirmation({
      id:
        Math.floor(
          pendingActionId
        ),

      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,
    });

  if (
    !currentPendingAction
  ) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "AI 승인 초안을 찾을 수 없습니다.",
      404
    );
  }

  /**
   * ---------------------------------------------------------
   * 2. 현재 DB version 검증
   * ---------------------------------------------------------
   */
  const currentVersion =
    Number(
      currentPendingAction.version ||
      0
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
    Number(
      params.expectedVersion ||
      0
    );

  /**
   * 카드 버튼처럼 클라이언트가 version을 알고 있는
   * 요청에서는 현재 DB version과 반드시 비교한다.
   *
   * 자연어 취소에서는 expectedVersion=null이므로
   * 이 검사를 건너뛰고 서버 현재 version을 사용한다.
   */
  if (
    requestedVersion >
      0 &&
    requestedVersion !==
      currentVersion
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "AI 승인 초안이 변경되었습니다. 최신 내용을 다시 확인해주세요.",
      409
    );
  }

  /**
   * ---------------------------------------------------------
   * 3. 현재 Work Session 조회
   * ---------------------------------------------------------
   */
  let workSession =
    await db.getAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,
    });

  /**
   * ---------------------------------------------------------
   * 4. 실제 Pending Action 취소
   * ---------------------------------------------------------
   *
   * DB에서 직접 읽은 currentVersion으로 취소한다.
   */
  const row =
    await db.cancelAiPendingAction({
      id:
        Math.floor(
          pendingActionId
        ),

      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      expectedVersion:
        currentVersion,
    });

  /**
   * ---------------------------------------------------------
   * 5. 감사로그
   * ---------------------------------------------------------
   *
   * 감사로그 오류 때문에 이미 완료된 취소가
   * 실패 처리되면 안 되므로 별도 try/catch.
   */
  try {
    await db.createAiActionLog({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      userName:
        aiContext.userName ||
        "",

      action:
        "ai_pending_action_cancel",

      targetStudentId:
        row?.studentId
          ? Number(
              row.studentId
            )
          : null,

      targetStudentName:
        null,

      payload: {
        pendingActionId:
          Number(
            row?.id ||
            pendingActionId
          ),

        actionType:
          row?.actionType ||
          null,

        version:
          Number(
            row?.version ||
            currentVersion
          ),

        status:
          row?.status ||
          "cancelled",

        source:
          params.expectedVersion
            ? "pending_action_button"
            : "ai_natural_language",
      },
    });
  } catch (
    auditLogError
  ) {
    console.error(
      "[AI PENDING ACTION CANCEL] 감사로그 저장 실패",
      {
        organizationId:
          aiContext.organizationId,

        userId:
          aiContext.userId,

        pendingActionId:
          Number(
            row?.id ||
            pendingActionId
          ),

        actionType:
          row?.actionType ||
          null,

        message:
          auditLogError instanceof
            Error
            ? String(
                auditLogError.message ||
                "알 수 없는 오류"
              )
                .replace(
                  /\s+/g,
                  " "
                )
                .trim()
                .slice(
                  0,
                  300
                )
            : "알 수 없는 오류",
      }
    );
  }

  const cancelledPendingActionId =
    Number(
      row?.id ||
      pendingActionId
    );

  const lastPresentedPendingActionId =
    Number(
      workSession
        .lastPresentedAction
        ?.payload
        ?.pendingActionId ||
      0
    );

  /**
   * ---------------------------------------------------------
   * 6. Work Session 정리
   * ---------------------------------------------------------
   *
   * 실제 취소된 Pending Action이
   * 현재 사용자에게 제시 중인 Action과 같은 경우에만
   * workflow / lastPresentedAction을 초기화한다.
   *
   * 이전 작업을 취소했다는 이유로
   * 현재 다른 작업까지 날리면 안 된다.
   */
  if (
    lastPresentedPendingActionId ===
      cancelledPendingActionId
  ) {
    try {
      workSession =
        await db.patchAiWorkSession({
          organizationId:
            aiContext.organizationId,

          userId:
            aiContext.userId,

          expectedVersion:
            workSession.version,

          patch: {
            workflow: {
              type:
                null,

              step:
                "idle",

              clearDraft:
                true,

              draftPatch:
                {},

              waitingFor:
                [],
            },

            lastPresentedAction:
              null,
          },
        });
    } catch (
      workSessionError
    ) {
      /**
       * Pending Action 자체 취소는 이미 성공했다.
       *
       * Work Session 정리 실패 때문에
       * 실제 취소 결과까지 실패로 바꾸면 안 된다.
       */
      console.error(
        "[AI PENDING ACTION CANCEL] Work Session 초기화 실패",
        {
          organizationId:
            aiContext.organizationId,

          userId:
            aiContext.userId,

          pendingActionId:
            cancelledPendingActionId,

          message:
            workSessionError instanceof
              Error
              ? String(
                  workSessionError.message ||
                  "알 수 없는 오류"
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim()
                  .slice(
                    0,
                    300
                  )
              : "알 수 없는 오류",
        }
      );

      /**
       * 최신 Work Session이라도 다시 돌려주기 위해
       * 재조회한다.
       */
      try {
        workSession =
          await db.getAiWorkSession({
            organizationId:
              aiContext.organizationId,

            userId:
              aiContext.userId,
          });
      } catch (
        readWorkSessionError
      ) {
        console.error(
          "[AI PENDING ACTION CANCEL] Work Session 재조회 실패",
          {
            organizationId:
              aiContext.organizationId,

            userId:
              aiContext.userId,

            pendingActionId:
              cancelledPendingActionId,

            message:
              readWorkSessionError instanceof
                Error
                ? String(
                    readWorkSessionError.message ||
                    "알 수 없는 오류"
                  )
                    .replace(
                      /\s+/g,
                      " "
                    )
                    .trim()
                    .slice(
                      0,
                      300
                    )
                : "알 수 없는 오류",
          }
        );

        workSession =
          null;
      }
    }
  }

  return {
    success:
      true as const,

    /**
     * Router에서는 이 row를 기존
     * toAiPendingActionPublicResult()로 변환한다.
     *
     * 카카오에서는 굳이 프론트 카드 DTO가 필요 없으므로
     * 공통 서비스 안에서 UI DTO를 만들지 않는다.
     */
    pendingAction:
      row,

    message:
      "AI 승인 초안이 취소되었습니다.",

    workSession,

    aiContext,
  };
}