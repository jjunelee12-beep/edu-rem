import * as db from "../db";

export type PatchAiWorkSessionAfterPendingActionParams = {
  organizationId:
    number;

  userId:
    number;

  pendingActionId:
    number;

  success:
    boolean;

  alreadyExecuted:
    boolean;

  executing:
    boolean;

  consultationId?:
    number |
    null;

  studentId?:
    number |
    null;

  studentName?:
    string |
    null;
};

/**
 * Pending Action 실행 결과를
 * AI Work Session에 반영하는 공통 서비스.
 *
 * 웹 CRM / 카카오 담당자 모두
 * 동일한 organizationId + userId 세션을 사용한다.
 */
export async function patchAiWorkSessionAfterPendingAction(
  params:
    PatchAiWorkSessionAfterPendingActionParams
) {
  let workSession =
    await db.getAiWorkSession({
      organizationId:
        params.organizationId,

      userId:
        params.userId,
    });

  const currentPendingActionId =
    Number(
      workSession
        .lastPresentedAction
        ?.payload
        ?.pendingActionId ||
      0
    );

  /**
   * 현재 화면/대화에서 제시 중인 Action과
   * 실제 실행한 Action이 다르면
   * Work Session을 건드리지 않는다.
   */
  if (
    currentPendingActionId !==
    Number(
      params.pendingActionId
    )
  ) {
    return workSession;
  }

  /**
   * Executor가 아직 실행 중인 경우.
   */
  if (
    params.executing ===
      true
  ) {
    workSession =
      await db.patchAiWorkSession({
        organizationId:
          params.organizationId,

        userId:
          params.userId,

        expectedVersion:
          workSession.version,

        patch: {
          workflow: {
            step:
              "executing",

            waitingFor:
              [],
          },
        },
      });

    return workSession;
  }

  /**
   * 정상 완료 또는 이미 실행된 Action.
   */
  if (
    params.success ===
      true ||
    params.alreadyExecuted ===
      true
  ) {
    const studentId =
      Number(
        params.studentId ||
        0
      );

    const consultationId =
      Number(
        params.consultationId ||
        0
      );

    workSession =
      await db.patchAiWorkSession({
        organizationId:
          params.organizationId,

        userId:
          params.userId,

        expectedVersion:
          workSession.version,

        patch: {
          activeTarget:
            studentId >
              0
              ? {
                  type:
                    "student",

                  id:
                    studentId,

                  name:
                    params.studentName ??
                    null,
                }
              : undefined,

          linkedContext: {
            ...(consultationId >
            0
              ? {
                  consultationId,
                }
              : {}),

            ...(studentId >
            0
              ? {
                  studentId,
                }
              : {}),
          },

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

    return workSession;
  }

  /**
   * 실행 실패.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        params.organizationId,

      userId:
        params.userId,

      expectedVersion:
        workSession.version,

      patch: {
        workflow: {
          step:
            "failed",

          waitingFor:
            [],
        },
      },
    });

  return workSession;
}

/**
 * Pending Action 자체 실행은 이미 확정됐는데
 * Work Session 후처리만 실패한 경우
 *
 * 실제 CRM 실행 결과까지 실패로 변경하지 않는다.
 */
export async function safePatchAiWorkSessionAfterPendingAction(
  params:
    PatchAiWorkSessionAfterPendingActionParams
) {
  try {
    return await patchAiWorkSessionAfterPendingAction(
      params
    );
  } catch (
    workSessionError
  ) {
    console.error(
      "[AI PENDING ACTION] Work Session 후처리 실패",
      {
        organizationId:
          params.organizationId,

        userId:
          params.userId,

        pendingActionId:
          params.pendingActionId,

        success:
          params.success,

        alreadyExecuted:
          params.alreadyExecuted,

        executing:
          params.executing,

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
     * 후처리 실패 시 최신 Work Session이라도
     * 다시 반환한다.
     */
    try {
      return await db.getAiWorkSession({
        organizationId:
          params.organizationId,

        userId:
          params.userId,
      });
    } catch (
      readError
    ) {
      console.error(
        "[AI PENDING ACTION] Work Session 재조회 실패",
        {
          organizationId:
            params.organizationId,

          userId:
            params.userId,

          pendingActionId:
            params.pendingActionId,

          message:
            readError instanceof
              Error
              ? String(
                  readError.message ||
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

      return null;
    }
  }
}