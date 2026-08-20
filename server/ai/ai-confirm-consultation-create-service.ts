import * as db from "../db";

import {
  executeConsultationCreatePendingAction,
} from "./consultation-create-executor";

import {
  safePatchAiWorkSessionAfterPendingAction,
} from "./ai-pending-action-work-session-service";

import type {
  AiUserContext,
} from "./ai.types";

export async function confirmConsultationCreatePendingAction(
  params: {
    pendingActionId:
      number;

    expectedVersion:
      number;

    aiContext:
      AiUserContext;

    actorName:
      string | null;
  }
) {
  const {
    pendingActionId,
    expectedVersion,
    aiContext,
    actorName,
  } = params;

  /**
   * 실제 상담DB 신규등록 실행.
   */
  const result =
    await executeConsultationCreatePendingAction({
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
   * Pending Action 실행 결과를
   * 기존 AI Work Session에 반영한다.
   */
  let workSession =
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

  /**
   * 상담DB 신규등록이 정상 완료되면
   * 바로 등록예정 학생 통합등록으로
   * 이어갈 수 있도록 Work Session을 전환한다.
   */
  if (
    (
      result.success ===
        true ||
      result.alreadyExecuted ===
        true
    ) &&
    result.executing !==
      true &&
    Number.isFinite(
      Number(
        result.consultationId
      )
    ) &&
    Number(
      result.consultationId
    ) >
      0 &&
    workSession
  ) {
    const consultationId =
      Math.floor(
        Number(
          result.consultationId
        )
      );

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
            activeTarget: {
              type:
                "consultation",

              id:
                consultationId,

              name:
                null,
            },

            linkedContext: {
              consultationId,

              studentId:
                null,
            },

            workflow: {
              type:
                "consultation_registration",

              step:
                "collecting_data",

              clearDraft:
                true,

              draftPatch: {
                consultationId,

                originalMessage:
                  "",
              },

              waitingFor: [
                "registrationPlan",
              ],
            },

            lastPresentedAction: {
              actionId:
                `consultation-registration-followup-${consultationId}`,

              actionType:
                "student_registration_followup",

              targetType:
                "consultation",

              targetId:
                consultationId,

              payload: {
                consultationId,

                sourceActionType:
                  "consultation_create",

                nextTool:
                  "student_registration_preview",
              },

              expiresAt:
                new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
            },
          },
        });
    } catch (
      followupWorkSessionError
    ) {
      console.error(
        "[AI CONSULTATION CREATE] 후속 등록 Work Session 저장 실패",
        {
          organizationId:
            aiContext.organizationId,

          userId:
            aiContext.userId,

          pendingActionId:
            Math.floor(
              pendingActionId
            ),

          consultationId,

          message:
            followupWorkSessionError instanceof
              Error
              ? String(
                  followupWorkSessionError.message ||
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
          "[AI CONSULTATION CREATE] Work Session 재조회 실패",
          {
            organizationId:
              aiContext.organizationId,

            userId:
              aiContext.userId,

            consultationId,

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

  const completed =
    (
      result.success ===
        true ||
      result.alreadyExecuted ===
        true
    ) &&
    result.executing !==
      true &&
    Number(
      result.consultationId ||
      0
    ) >
      0;

  return {
    result,

    pendingAction:
      result.pendingAction,

    workSession,

    message:
      completed
        ? [
            "상담DB 신규등록이 완료되었습니다.",
            "",
            "이어서 등록예정 학생 전환과 학기·과목설계를 진행할까요?",
          ].join(
            "\n"
          )
        : result.message,
  };
}