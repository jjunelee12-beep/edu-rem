import * as db from "../db";

import {
  throwAppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

import {
  runAiAssistant,
  type RunAiAssistantOutput,
} from "./ai-runner";

import {
  resolveKakaoAiStaffAssistantContext,
  type KakaoAiStaffAssistantContextResult,
} from "./kakao-ai-staff-assistant-context";

import {
  cancelAiPendingAction,
} from "./ai-pending-action-cancel-service";

import {
  prepareAiPendingActionForConfirmation,
} from "./ai-pending-action-confirm-guard";

import {
  dispatchAiPendingActionConfirmation,
} from "./ai-pending-action-confirm-dispatcher";

export type KakaoAiStaffAssistantRunnerResult = {
  handled:
    boolean;

  staffContext:
    KakaoAiStaffAssistantContextResult |
    null;

  result:
    RunAiAssistantOutput |
    null;
};

/**
 * 카카오 담당자 인증 Session을
 * 기존 EduCanvas CRM 업무비서 Runner에 연결한다.
 *
 * 중요:
 *
 * 카카오 Staff Session을 기존 CRM 업무비서 Runner에 연결하고,
 * 웹 CRM과 동일한 Pending Action 검증/저장/승인/취소 흐름을 사용한다.
 *
 * 카카오 대화도 AI Chat DB와 WorkSession에 저장하여
 * 웹 CRM 업무비서와 문맥을 이어서 사용할 수 있도록 한다.
 */

function toKakaoAiPendingActionPublicResult(
  action:
    any
) {
  if (
    !action
  ) {
    return null;
  }

  return {
    id:
      Number(
        action.id ||
        0
      ),

    actionType:
      action.actionType ??
      null,

    status:
      action.status ??
      null,

    consultationId:
      action.consultationId ??
      null,

    studentId:
      action.studentId ??
      null,

    semesterId:
      action.semesterId ??
      null,

    requestedByUserId:
      action.requestedByUserId ??
      null,

    requestedByRole:
      action.requestedByRole ??
      null,

    version:
      Number(
        action.version ||
        0
      ),

    preview:
      action.previewJson ??
      action.preview ??
      null,

    expiresAt:
      action.expiresAt
        ? new Date(
            action.expiresAt
          ).toISOString()
        : null,

    createdAt:
      action.createdAt
        ? new Date(
            action.createdAt
          ).toISOString()
        : null,

    updatedAt:
      action.updatedAt
        ? new Date(
            action.updatedAt
          ).toISOString()
        : null,
  };
}

function getKakaoAiChatKindFromResult(
  result:
    any
) {
  const toolName =
    String(
      result?.toolName ||
      result?.data?.toolName ||
      result?.data?.tool ||
      ""
    );

  if (
    result?.registrationPreview
  ) {
    return "student_registration_preview" as const;
  }

  if (
    toolName ===
      "student.summary"
  ) {
    return "student_summary" as const;
  }

  if (
    toolName ===
      "student.dashboard"
  ) {
    return "student_dashboard" as const;
  }

  if (
    toolName ===
      "risk.studentDetail"
  ) {
    return "student_risk" as const;
  }

  if (
    toolName ===
      "risk.studentList"
  ) {
    return "organization_risk" as const;
  }

  if (
    toolName ===
      "student.search" ||
    toolName ===
      "consultation.search"
  ) {
    return "search_result" as const;
  }

  if (
    toolName ===
      "alert.missingData"
  ) {
    return "warning" as const;
  }

  if (
    toolName ===
      "document.analysis"
  ) {
    return "document_analysis" as const;
  }

  return "text" as const;
}

export async function runKakaoAiStaffAssistant(
  params: {
    organizationId:
      number;

    conversationId:
      number;

    message:
      string;
  }
): Promise<KakaoAiStaffAssistantRunnerResult> {
  const message =
    String(
      params.message ||
      ""
    ).trim();

  if (
    !message
  ) {
    return {
      handled:
        false,

      staffContext:
        null,

      result:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * 1. 카카오 Staff Session
   * → 기존 CRM 업무비서 Context 변환
   * ---------------------------------------------------------
   */
  const staffContext =
    await resolveKakaoAiStaffAssistantContext({
      organizationId:
        params.organizationId,

      conversationId:
        params.conversationId,
    });

  /**
   * 담당자 인증 Session이 없다면
   * 기존 신규자 / 등록회원 카카오 AI가
   * 계속 처리해야 한다.
   */
  if (
    !staffContext
  ) {
    return {
      handled:
        false,

      staffContext:
        null,

      result:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * 2. 기존 CRM 업무비서 Runner 실행
   * ---------------------------------------------------------
   *
   * 웹 CRM에서 사용하는 것과 동일하게:
   *
   * - AiUserContext
   * - AiWorkSession
   * - selectedStudentId
   * - selectedStudentName
   * - conversationHistory
   *
   * 를 그대로 전달한다.
   */
  const result =
    await runAiAssistant({
      context:
        staffContext.aiContext,

      message,

      imageAttachment:
        null,

      recentDocument:
        null,

      workSession:
        staffContext.workSession,

      selectedStudentId:
        staffContext
          .selectedStudentId,

      selectedStudentName:
        staffContext
          .selectedStudentName,

      conversationHistory:
        staffContext
          .conversationHistory,
    });


  const aiContext =
    staffContext.aiContext;

  let workSession =
    staffContext.workSession;

  const conversationHistory =
    staffContext.conversationHistory;

  const activeStudentId =
    staffContext.selectedStudentId;

  const input = {
    message,
    targetOrganizationId:
      null as
        number |
        null,
  };

  const ctx:
    any =
    null;

  let assistantMessageSaved =
    false;

  /**
   * 카카오 담당자 메시지도 기존 AI Chat DB에 저장한다.
   * 다음 카카오 턴 및 웹 CRM 업무비서에서 같은 대화 문맥을 복원한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "user",

    kind:
      "text",

    content:
      message,

    messageDataJson:
      null,

    selectedStudentId:
      activeStudentId,
  });

  /**
   * 현재 요청이 기존 승인 초안 수정인지 확인한다.
   * 웹 Router와 동일하게 high confidence revise만 이전 초안 교체 대상으로 본다.
   */
  const isPendingActionRevision =
    result.pendingActionDecision
      ?.decision ===
      "revise" &&
    result.pendingActionDecision
      ?.confidence ===
      "high";

  const previousPendingActionId =
    isPendingActionRevision
      ? Number(
          workSession
            .lastPresentedAction
            ?.payload
            ?.pendingActionId ||
          0
        )
      : 0;

  const previousPendingActionType =
    isPendingActionRevision
      ? String(
          workSession
            .lastPresentedAction
            ?.actionType ||
          ""
        )
      : "";

  async function replacePreviousAiPendingActionIfNeeded(
    params: {
      ctx:
        any;

      isPendingActionRevision:
        boolean;

      previousPendingActionId:
        number;

      previousPendingActionType:
        string;

      expectedActionType:
        string;

      newPendingActionId:
        number;

      targetOrganizationId?:
        number |
        null;
    }
  ) {
    if (
      !params.isPendingActionRevision ||
      params.previousPendingActionType !==
        params.expectedActionType ||
      !Number.isFinite(
        params.previousPendingActionId
      ) ||
      params.previousPendingActionId <=
        0 ||
      params.previousPendingActionId ===
        params.newPendingActionId
    ) {
      return null;
    }

    return cancelAiPendingAction({
      context:
        aiContext,

      pendingActionId:
        Math.floor(
          params.previousPendingActionId
        ),

      expectedVersion:
        null,
    });
  }

  /**
   * 자연어 취소
   */
  if (
    result.pendingActionCommand
      ?.command ===
    "cancel"
  ) {
    const pendingActionId =
      Number(
        result.pendingActionCommand
          .pendingActionId ||
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
        "취소할 AI 승인 초안 정보가 올바르지 않습니다.",
        400
      );
    }

    const cancelled =
      await cancelAiPendingAction({
        context:
          aiContext,

        pendingActionId:
          Math.floor(
            pendingActionId
          ),

        expectedVersion:
          null,
      });

    workSession =
      cancelled.workSession;

    const assistantReply =
      String(
        cancelled.message ||
        "AI 승인 초안이 취소되었습니다."
      ).trim();

    await db.saveAiChatMessage({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      role:
        "assistant",

      kind:
        "text",

      content:
        assistantReply,

      messageDataJson: {
        intent:
          "pending_action_cancel",

        pendingAction:
          toKakaoAiPendingActionPublicResult(
            cancelled.pendingAction
          ),

        pendingActionCommand: {
          command:
            "cancel",

          pendingActionId:
            Math.floor(
              pendingActionId
            ),

          actionId:
            result.pendingActionCommand
              .actionId,

          actionType:
            cancelled.pendingAction
              ?.actionType ||
            result.pendingActionCommand
              .actionType ||
            null,
        },

        workflow: {
          type:
            workSession.workflow.type,

          step:
            workSession.workflow.step,

          waitingFor:
            workSession.workflow
              .waitingFor,
        },

        workSessionVersion:
          workSession.version,
      },

      selectedStudentId:
        activeStudentId,
    });

    return {
      handled:
        true,

      staffContext,

      result: {
        ...result,

        success:
          true,

        reply:
          assistantReply,

        data: {
          pendingAction:
            toKakaoAiPendingActionPublicResult(
              cancelled.pendingAction
            ),
        },

        pendingActionCommand:
          null,
      },
    };
  }

  /**
   * 자연어 승인
   */
  if (
    result.pendingActionCommand
      ?.command ===
    "confirm"
  ) {
    const pendingActionId =
      Number(
        result.pendingActionCommand
          .pendingActionId ||
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
        "승인할 AI 초안 정보가 올바르지 않습니다.",
        400
      );
    }

    const confirmation =
      await prepareAiPendingActionForConfirmation({
        pendingActionId:
          Math.floor(
            pendingActionId
          ),

        expectedVersion:
          null,

        aiContext,

        actorName:
          aiContext.userName ||
          null,
      });

    const confirmed =
      await dispatchAiPendingActionConfirmation({
        aiContext,

        confirmation,
      });

    if (
      confirmed.workSession
    ) {
      workSession =
        confirmed.workSession;
    }

    const assistantReply =
      String(
        confirmed.message ||
        (
          confirmed.executing
            ? "AI 승인 작업을 실행하고 있습니다."
            : confirmed.alreadyExecuted
              ? "이미 처리된 AI 승인 작업입니다."
              : confirmed.success
                ? "AI 승인 작업이 완료되었습니다."
                : "AI 승인 작업을 완료하지 못했습니다."
        )
      ).trim();

    const resultStudentId =
      Number(
        confirmed.studentId ||
        0
      );

    const savedStudentId =
      resultStudentId > 0
        ? resultStudentId
        : activeStudentId;

    await db.saveAiChatMessage({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      role:
        "assistant",

      kind:
        confirmed.actionType ===
          "student_registration_create"
          ? "student_registration_result"
          : "text",

      content:
        assistantReply,

      messageDataJson: {
        intent:
          "pending_action_confirm",

        actionType:
          confirmed.actionType,

        pendingAction:
          confirmed.pendingAction,

        executionResult: {
          success:
            confirmed.success,

          alreadyExecuted:
            confirmed.alreadyExecuted,

          executing:
            confirmed.executing,

          consultationId:
            confirmed.consultationId,

          studentId:
            confirmed.studentId,

          studentDetailPath:
            "studentDetailPath" in
              confirmed
              ? confirmed
                  .studentDetailPath
              : null,

          scheduleId:
            confirmed.scheduleId,

          planId:
            confirmed.planId,

          semesterId:
            confirmed.semesterId,

          semesterIds:
            confirmed.semesterIds,

          planSubjectIds:
            confirmed.planSubjectIds,

          transferSubjectIds:
            confirmed.transferSubjectIds,

          practiceSaved:
            confirmed.practiceSaved,

          paymentUpdated:
            confirmed.paymentUpdated,
        },

        pendingActionCommand: {
          command:
            "confirm",

          pendingActionId:
            Math.floor(
              pendingActionId
            ),

          actionId:
            result.pendingActionCommand
              .actionId,

          actionType:
            confirmed.actionType ||
            result.pendingActionCommand
              .actionType ||
            null,
        },

        workflow: {
          type:
            workSession.workflow.type,

          step:
            workSession.workflow.step,

          waitingFor:
            workSession.workflow
              .waitingFor,
        },

        workSessionVersion:
          workSession.version,
      },

      selectedStudentId:
        savedStudentId,
    });

    return {
      handled:
        true,

      staffContext,

      result: {
        ...result,

        success:
          confirmed.success,

        reply:
          assistantReply,

        data: {
          actionType:
            confirmed.actionType,

          pendingAction:
            confirmed.pendingAction,

          executionResult: {
            success:
              confirmed.success,

            alreadyExecuted:
              confirmed.alreadyExecuted,

            executing:
              confirmed.executing,

            consultationId:
              confirmed.consultationId,

            studentId:
              confirmed.studentId,

            studentDetailPath:
              "studentDetailPath" in
                confirmed
                ? confirmed
                    .studentDetailPath
                : null,

            scheduleId:
              confirmed.scheduleId,

            planId:
              confirmed.planId,

            semesterId:
              confirmed.semesterId,

            semesterIds:
              confirmed.semesterIds,

            planSubjectIds:
              confirmed.planSubjectIds,

            transferSubjectIds:
              confirmed.transferSubjectIds,

            practiceSaved:
              confirmed.practiceSaved,

            paymentUpdated:
              confirmed.paymentUpdated,
          },
        },

        pendingActionCommand:
          null,
      },
    };
  }

  /**
   * 웹 Router와 동일하게 Runner의 WorkSessionPatch를
   * WRITE Pending Action 생성 전에 먼저 반영한다.
   */
  if (
    result.workSessionPatch
  ) {
    workSession =
      await db.patchAiWorkSession({
        organizationId:
          aiContext.organizationId,

        userId:
          aiContext.userId,

        expectedVersion:
          workSession.version,

        patch:
          result.workSessionPatch,
      });
  }

  if (
    result.success !==
      true
  ) {
    const failureReply =
      String(
        result.reply ||
        result.toolResult
          ?.error
          ?.message ||
        "AI 요청을 처리하지 못했습니다."
      ).trim();

    await db.saveAiChatMessage({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      role:
        "assistant",

      kind:
        "error",

      content:
        failureReply,

      messageDataJson:
        result.toolResult &&
        typeof result.toolResult ===
          "object"
          ? {
              toolResult:
                result.toolResult,
            }
          : null,

      selectedStudentId:
        activeStudentId,
    });

    if (
      result.toolResult &&
      result.toolResult.success ===
        false
    ) {
      throwAppError(
        (result.toolResult.error?.code ||
          ERROR_CODES.INVALID_REQUEST) as any,
        result.toolResult.error?.message ||
          failureReply,
        result.toolResult.error?.code ===
          "AI_PERMISSION_DENIED"
          ? 403
          : result.toolResult.error?.code ===
              "AI_TARGET_NOT_FOUND"
            ? 404
            : 400
      );
    }

    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      failureReply,
      400
    );
  }

  const webWriteResult =
    await (
      async ():
        Promise<any> => {
/**
 * 일정 등록 Tool은 실제 DB 일정을 바로 생성하지 않는다.
 *
 * Runner가 만든 검증된 초안을
 * AI Pending Action으로 저장하고
 * 사용자 승인 카드를 반환한다.
 */
if (
  result.scheduleCreateDraft &&
  result.scheduleCreateDraft
    .pendingActionRequired ===
    true
) {
  const scheduleDraft =
    result.scheduleCreateDraft;

  const studentId =
    Number(
      scheduleDraft.studentId ||
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "일정을 연결할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "schedule_create",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      payload: {
        draft: {
          studentId:
            Math.floor(
              studentId
            ),

          studentName:
            scheduleDraft.studentName,

          title:
            scheduleDraft.title,

          description:
            scheduleDraft.description,

          scheduleDate:
            scheduleDraft.scheduleDate,

          meridiem:
            scheduleDraft.meridiem,

          hour12:
            scheduleDraft.hour12,

          minute:
            scheduleDraft.minute,

          startAt:
            scheduleDraft.startAt,

          scope:
            scheduleDraft.isGlobal ===
              true
              ? "global"
              : "personal",
        },

        originalMessage:
          input.message,
      },

      preview: {
        title:
          scheduleDraft.preview
            .title,

        summary:
          scheduleDraft.preview
            .summary,

        sections: [
  {
    label:
      "일정 정보",

    items:
      scheduleDraft.preview
        .items,
  },
],

        changes: [
  {
    label:
      "일정명",

    before:
      null,

    after:
      scheduleDraft.title,
  },

  {
    label:
      "일정 날짜",

    before:
      null,

    after:
      scheduleDraft.scheduleDate,
  },

  {
    label:
      "일정 시간",

    before:
      null,

    after:
      `${
        scheduleDraft.meridiem ===
          "PM"
          ? "오후"
          : "오전"
      } ${scheduleDraft.hour12}시 ${String(
        scheduleDraft.minute
      ).padStart(
        2,
        "0"
      )}분`,
  },

  {
    label:
      "일정 범위",

    before:
      null,

    after:
      scheduleDraft.isGlobal ===
        true
        ? "회사 전체"
        : "개인",
  },
],

        executionSteps: [
          "학생 접근권한을 다시 확인합니다.",
          "일정 날짜와 시간을 다시 검증합니다.",
          "학생 일정에 등록합니다.",
        ],

        missingFields:
          [],

        warnings:
          Array.isArray(
            scheduleDraft.preview
              .warnings
          )
            ? scheduleDraft.preview
                .warnings
            : [],

        canConfirm:
          scheduleDraft.preview
            .canConfirm === true,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
  toKakaoAiPendingActionPublicResult(
    pendingAction
  );

workSession =
  await db.patchAiWorkSession({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    expectedVersion:
      workSession.version,

    patch: {
      lastPresentedAction: {
  actionId:
    `pending-action-${Number(
      pendingAction.id
    )}`,

  actionType:
    "schedule_create",

  targetType:
    "student",

        targetId:
          Math.floor(
            studentId
          ),

        payload: {
          pendingActionId:
            Number(
              pendingAction.id
            ),
        },

        expiresAt:
          pendingAction.expiresAt
            ? new Date(
                pendingAction.expiresAt
              ).toISOString()
            : new Date(
                Date.now() +
                30 * 60 * 1000
              ).toISOString(),
      },
    },
  });

/**
 * 기존 승인 초안을 수정해서 새 일정 초안이
 * 정상적으로 생성된 경우에만 이전 초안을 취소한다.
 *
 * 새 초안을 Work Session에 연결한 뒤 취소하므로
 * 이전 초안 취소가 새 Work Session을 초기화하지 않는다.
 */
await replacePreviousAiPendingActionIfNeeded({
  ctx,

  isPendingActionRevision,

  previousPendingActionId,

  previousPendingActionType,

  expectedActionType:
    "schedule_create",

  newPendingActionId:
    Number(
      pendingAction.id
    ),

  targetOrganizationId:
    input.targetOrganizationId ??
    null,
});

const reply =
    String(
      result.reply ||
      `${scheduleDraft.studentName || "선택 학생"}의 일정 등록 초안을 만들었습니다.`
    ).trim();

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "text",

    content:
      reply,

    messageDataJson: {
  toolName:
    "schedule.create",

  pendingActionDecision:
    result.pendingActionDecision ??
    null,

  replacedPendingActionId:
  isPendingActionRevision &&
  previousPendingActionType ===
    "schedule_create" &&
  previousPendingActionId > 0
    ? Math.floor(
        previousPendingActionId
      )
    : null,

  scheduleCreateDraft:
    scheduleDraft,

  pendingAction:
    publicPendingAction,
},

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

      return {
    ...result,

    pendingAction:
      publicPendingAction,

    scheduleCreateDraft:
      scheduleDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 상담DB 신규등록 Tool은
 * consultations 테이블을 즉시 생성하지 않는다.
 *
 * Runner에서 생성한 신규 상담 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.consultationCreateDraft &&
  result.consultationCreateDraft
    .pendingActionRequired ===
    true
) {
  const consultationDraft =
    result.consultationCreateDraft;

  const draft =
    consultationDraft.draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "상담DB 신규등록 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  const clientName =
    String(
      draft.clientName ||
      ""
    )
      .trim()
      .slice(
        0,
        100
      );

  if (
    !clientName
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "신규 상담자의 이름이 필요합니다.",
      400
    );
  }

  const phone =
    String(
      draft.phone ||
      ""
    )
      .replace(
        /\D/g,
        ""
      )
      .slice(
        0,
        11
      );

  if (
    phone.length <
      10 ||
    phone.length >
      11
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "신규 상담자의 연락처가 올바르지 않습니다.",
      400
    );
  }

  if (
    Number(
      draft.requestedByUserId ||
      0
    ) !==
      aiContext.userId
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "상담DB 신규등록 초안의 요청자 정보가 일치하지 않습니다.",
      403
    );
  }

  if (
    draft.requestedByRole !==
      aiContext.role
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "상담DB 신규등록 초안의 요청자 권한 정보가 일치하지 않습니다.",
      403
    );
  }

  const missingFields =
    Array.isArray(
      consultationDraft.preview
        ?.missingFields
    )
      ? consultationDraft.preview
          .missingFields
          .map(
            (
              value
            ) =>
              String(
                value ||
                ""
              ).trim()
          )
          .filter(
            Boolean
          )
      : [];

  const warnings =
    Array.isArray(
      consultationDraft.preview
        ?.warnings
    )
      ? consultationDraft.preview
          .warnings
          .map(
            (
              value
            ) =>
              String(
                value ||
                ""
              ).trim()
          )
          .filter(
            Boolean
          )
      : [];

  const previewSections =
    Array.isArray(
      consultationDraft.preview
        ?.sections
    )
      ? consultationDraft.preview
          .sections
          .map(
            (
              section
            ) => ({
              label:
                String(
                  section?.title ||
                  "신규 상담정보"
                ),

              items:
                Array.isArray(
                  section?.items
                )
                  ? section.items
                      .map(
                        (
                          item
                        ) =>
                          String(
                            item ||
                            ""
                          ).trim()
                      )
                      .filter(
                        Boolean
                      )
                  : [],
            })
          )
      : [];

  const previewChanges =
    Array.isArray(
      consultationDraft.preview
        ?.changes
    )
      ? consultationDraft.preview
          .changes
          .map(
            (
              change
            ) => ({
              label:
                String(
                  change?.label ||
                  change?.field ||
                  "신규 입력 항목"
                ),

              before:
                null,

              after:
                change?.after ??
                null,
            })
          )
      : [];

  /**
   * consultation-create-executor는
   * action.payloadJson 자체를 신규 상담 초안으로 읽는다.
   *
   * payload 안에 draft를 한 번 더 감싸지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "consultation_create",

      consultationId:
        null,

      studentId:
        null,

      semesterId:
        null,

      payload: {
        consultDate:
          String(
            draft.consultDate ||
            ""
          ).trim(),

        channel:
          String(
            draft.channel ||
            "AI 상담 등록"
          ).trim(),

        clientName,

        phone,

        finalEducation:
          draft.finalEducation ??
          null,

        desiredCourse:
          draft.desiredCourse ??
          null,

        notes:
          draft.notes ??
          null,

        status:
          String(
            draft.status ||
            "상담중"
          ).trim(),

        canConfirm:
          draft.canConfirm ===
            true &&
          missingFields.length ===
            0,

        missingFields,

        warnings,
      },

      preview: {
        title:
          consultationDraft.preview
            ?.title ||
          "상담DB 신규등록",

        summary:
          consultationDraft.preview
            ?.summary ||
          `${clientName}님의 신규 상담정보를 등록합니다.`,

        sections:
          previewSections,

        changes:
          previewChanges,

        executionSteps:
          Array.isArray(
            consultationDraft.preview
              ?.executionSteps
          )
            ? consultationDraft.preview
                .executionSteps
            : [
                "승인 요청의 회사와 최초 요청자를 다시 확인합니다.",
                "동일한 연락처의 기존 상담DB가 있는지 다시 확인합니다.",
                "현재 로그인 사용자를 상담 담당자로 지정합니다.",
                "상담DB 신규등록 결과와 AI 실행 이력을 기록합니다.",
              ],

        missingFields,

        warnings,

        canConfirm:
          consultationDraft.preview
            ?.canConfirm ===
            true &&
          missingFields.length ===
            0,
      },

      sourceSnapshot: {
        requestedByUserId:
          aiContext.userId,

        requestedByRole:
          aiContext.role,

        clientName,

        phoneLast4:
          phone.slice(
            -4
          ),

        draftCreatedAt:
          draft.createdAt ??
          null,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toKakaoAiPendingActionPublicResult(
      pendingAction
    );

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
            "consultation_registration",

          step:
            "awaiting_confirmation",

          draftPatch: {
            ...draft,
          },

          waitingFor:
            [],
        },

        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "consultation_create",

          /**
           * 신규 상담은 아직 실제 consultationId가 없으므로
           * 임시 대상 ID로 Pending Action ID를 사용한다.
           *
           * 실제 상담 생성 후 Executor 결과의
           * consultationId로 다시 연결된다.
           */
          targetType:
            "consultation",

          targetId:
            Number(
              pendingAction.id
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 사용자가 기존 상담 신규등록 초안을 수정한 경우
   * 새 Pending Action 생성 후 이전 초안을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
  ctx,

  isPendingActionRevision,

  previousPendingActionId,

  previousPendingActionType,

  expectedActionType:
    "consultation_create",

  newPendingActionId:
    Number(
      pendingAction.id
    ),

  targetOrganizationId:
    input.targetOrganizationId ??
    null,
});

  const reply =
    String(
      result.reply ||
      `${clientName}님의 상담DB 신규등록 초안을 만들었습니다.`
    ).trim();

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "consultation.create",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "consultation_create" &&
        previousPendingActionId >
          0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      consultationCreateDraft:
        consultationDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      activeStudentId,
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    consultationCreateDraft:
      consultationDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 상담DB 수정 Tool은 상담정보를 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 상담 수정 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.consultationUpdateDraft &&
  result.consultationUpdateDraft
    .pendingActionRequired ===
    true
) {
  const consultationDraft =
    result.consultationUpdateDraft;

  const consultationId =
    Number(
      consultationDraft
        .consultationId ||
      0
    );

  /**
   * Runner와 Tool에서 검증했더라도
   * Pending Action 저장 직전에 ID를 다시 검사한다.
   */
  if (
    !Number.isFinite(
      consultationId
    ) ||
    consultationId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 상담DB 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 실제 변경 항목이 존재하는지 다시 확인한다.
   */
  const changes =
    Array.isArray(
      consultationDraft.changes
    )
      ? consultationDraft.changes
      : [];

  if (
    changes.length ===
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "변경할 상담정보가 없습니다.",
      400
    );
  }

  /**
   * Tool에서 생성한 변경 초안을
   * Pending Action에 저장한다.
   *
   * 이 시점에는 consultations 테이블을
   * 실제로 수정하지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "consultation_update",

      consultationId:
        Math.floor(
          consultationId
        ),

      studentId:
        null,

      semesterId:
        null,

      /**
       * 다음 단계의 Executor가 사용할
       * 승인된 변경 초안이다.
       */
      payload: {
        draft:
          consultationDraft.draft,

        originalMessage:
          input.message,
      },

      /**
       * 사용자 승인 카드에 표시할 데이터다.
       */
      preview: {
        title:
          consultationDraft.preview
            .title ||
          "상담DB 정보 수정",

        summary:
          consultationDraft.preview
            .summary ||
          "상담DB 변경 내용을 확인해주세요.",

        /**
         * 공용 Pending Action Preview 구조는
         * label + items 형태를 사용한다.
         */
        sections:
          Array.isArray(
            consultationDraft.preview
              .sections
          )
            ? consultationDraft.preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        section?.title ||
                        "수정 대상"
                      ),

                    items:
                      Array.isArray(
                        section?.items
                      )
                        ? section.items
                            .map(
                              (
                                item
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        /**
         * 변경 전·후 비교 카드 데이터다.
         */
        changes:
          changes.map(
            (
              change
            ) => ({
              label:
                String(
                  change.label ||
                  change.field ||
                  "변경 항목"
                ),

              before:
                change.before ??
                null,

              after:
                change.after ??
                null,
            })
          ),

        executionSteps:
          Array.isArray(
            consultationDraft.preview
              .executionSteps
          )
            ? consultationDraft.preview
                .executionSteps
            : [
                "현재 상담정보를 다시 확인합니다.",
                "사용자의 상담 접근권한을 다시 확인합니다.",
                "승인된 변경 항목만 상담DB에 반영합니다.",
              ],

        missingFields:
          Array.isArray(
            consultationDraft.preview
              .missingFields
          )
            ? consultationDraft.preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            consultationDraft.preview
              .warnings
          )
            ? consultationDraft.preview
                .warnings
            : [],

        canConfirm:
          consultationDraft.preview
            .canConfirm ===
            true &&
          changes.length >
            0,
      },

      /**
       * 다음 Executor 단계에서
       * 초안 생성 후 원본이 변경됐는지 비교할 스냅샷이다.
       */
      sourceSnapshot: {
        consultation: {
          id:
            Math.floor(
              consultationId
            ),

          clientName:
            consultationDraft.clientName ??
            null,

          status:
            consultationDraft.draft
              .originalValues
              .status ??
            null,

          notes:
            consultationDraft.draft
              .originalValues
              .notes ??
            null,
        },

        draftCreatedAt:
          consultationDraft.draft
            .createdAt,
      },

      expiresInMinutes:
        30,
    });

  /**
   * DB 내부 JSON 값을
   * 프론트에 안전하게 전달할 공용 형태로 변환한다.
   */
  const publicPendingAction =
  toKakaoAiPendingActionPublicResult(
    pendingAction
  );

workSession =
  await db.patchAiWorkSession({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    expectedVersion:
      workSession.version,

    patch: {
      lastPresentedAction: {
  actionId:
    `pending-action-${Number(
      pendingAction.id
    )}`,

  actionType:
    "consultation_update",

  targetType:
    "consultation",

        targetId:
          Math.floor(
            consultationId
          ),

        payload: {
          pendingActionId:
            Number(
              pendingAction.id
            ),
        },

        expiresAt:
          pendingAction.expiresAt
            ? new Date(
                pendingAction.expiresAt
              ).toISOString()
            : new Date(
                Date.now() +
                30 * 60 * 1000
              ).toISOString(),
      },
    },
  });

/**
 * 기존 상담DB 수정 승인 초안을 변경한 경우
 * 새 초안 생성 성공 후 이전 초안을 취소한다.
 */
await replacePreviousAiPendingActionIfNeeded({
  ctx,

  isPendingActionRevision,

  previousPendingActionId,

  previousPendingActionType,

  expectedActionType:
    "consultation_update",

  newPendingActionId:
    Number(
      pendingAction.id
    ),

  targetOrganizationId:
    input.targetOrganizationId ??
    null,
});

const reply =
    String(
      result.reply ||
      `${
        consultationDraft.clientName ||
        `상담DB ${consultationId}번`
      }의 상담정보 수정 초안을 만들었습니다.`
    ).trim();

  /**
   * 대화 기록에도 Pending Action을 함께 저장한다.
   *
   * 새로고침 후에도 승인 카드를 복원할 수 있도록
   * pendingAction과 초안 정보를 모두 보존한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    /**
     * 현재 프론트가 Pending Action 카드를
     * student_registration_preview 종류로 처리하고 있으므로
     * 별도 Kind 추가 전까지 기존 값을 재사용한다.
     */
    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
  toolName:
    "consultation.update",

  pendingActionDecision:
    result.pendingActionDecision ??
    null,

  replacedPendingActionId:
  isPendingActionRevision &&
  previousPendingActionType ===
    "consultation_update" &&
  previousPendingActionId > 0
    ? Math.floor(
        previousPendingActionId
      )
    : null,

  consultationUpdateDraft:
    consultationDraft,

  pendingAction:
    publicPendingAction,
},

        selectedStudentId:
      activeStudentId,
  });

  assistantMessageSaved =
    true;

    return {
    ...result,

    pendingAction:
      publicPendingAction,

    consultationUpdateDraft:
      consultationDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 플랜 생성 Tool은
 * plans 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 플랜 생성 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.planCreateDraft &&
  result.planCreateDraft
    .pendingActionRequired ===
    true
) {
  const planDraft =
    result.planCreateDraft;

  const studentId =
    Number(
      planDraft.studentId ||
      0
    );

  /**
   * Pending Action 저장 직전
   * 핵심 대상 학생을 다시 검사한다.
   */
  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜을 생성할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * Tool 결과 안의 실제 승인 초안
   */
  const draft =
    planDraft.draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 생성 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * 바깥쪽 Tool 결과의 학생과
   * 내부 승인 초안의 학생이 같은지 확인한다.
   */
  if (
    Number(
      draft.studentId ||
      0
    ) !==
    Math.floor(
      studentId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 생성 초안의 대상 학생 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 신규 생성 초안은 반드시
   * 기존 플랜이 없었던 상태에서 만들어져야 한다.
   */
  if (
    draft.originalPlanExists !==
    false
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 생성 초안의 기존 플랜 상태가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 실습 여부는 플랜 생성 시
   * 반드시 명확한 boolean이어야 한다.
   */
  if (
    typeof draft.hasPractice !==
    "boolean"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "실습 필요 여부가 확정되지 않았습니다.",
      400
    );
  }

  const totalTheorySubjects =
    Number(
      draft.totalTheorySubjects
    );

  const requiredMajorCount =
    Number(
      draft.requiredMajorCount
    );

  const electiveMajorCount =
    Number(
      draft.electiveMajorCount
    );

  const liberalCount =
    Number(
      draft.liberalCount
    );

  const generalCount =
    Number(
      draft.generalCount
    );

  const planCounts = [
    totalTheorySubjects,
    requiredMajorCount,
    electiveMajorCount,
    liberalCount,
    generalCount,
  ];

  /**
   * 모든 과목 수는 0 이상의 정수만 허용한다.
   */
  if (
    planCounts.some(
      (
        value
      ) =>
        !Number.isFinite(
          value
        ) ||
        !Number.isInteger(
          value
        ) ||
        value < 0
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수 정보가 올바르지 않습니다.",
      400
    );
  }

  const categoryTotal =
    requiredMajorCount +
    electiveMajorCount +
    liberalCount +
    generalCount;

  if (
    categoryTotal !==
    totalTheorySubjects
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `전체 이론 과목 수(${totalTheorySubjects})와 분류 합계(${categoryTotal})가 일치하지 않습니다.`,
      400
    );
  }

  /**
   * 플랜 생성 초안을 Pending Action으로 저장한다.
   *
   * 이 시점에는 plans 테이블을
   * 절대로 변경하지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "plan_create",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      /**
       * Executor가 최종 승인 후
       * 실제 plans 테이블 생성에 사용하는 초안
       */
      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          planDraft.preview
            .title ||
          "학생 플랜 생성",

        summary:
          planDraft.preview
            .summary ||
          "생성할 학생 플랜 내용을 확인해주세요.",

        /**
         * plan.create Registry는
         * label + items 형식을 사용하고 있다.
         */
        sections:
          Array.isArray(
            planDraft.preview
              .sections
          )
            ? planDraft.preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        (section as any)
                          ?.label ||
                        (section as any)
                          ?.title ||
                        "플랜 생성 내용"
                      ),

                    items:
                      Array.isArray(
                        (section as any)
                          ?.items
                      )
                        ? (
                            section as any
                          ).items
                            .map(
                              (
                                item:
                                  unknown
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          Array.isArray(
            planDraft.preview
              .changes
          )
            ? planDraft.preview
                .changes
            : [],

        executionSteps:
          Array.isArray(
            planDraft.preview
              .executionSteps
          )
            ? planDraft.preview
                .executionSteps
            : [
                "현재 학생과 조직 정보를 다시 확인합니다.",
                "학생 플랜 생성 권한을 다시 확인합니다.",
                "학생 담당자 변경 여부를 다시 확인합니다.",
                "기존 플랜이 새로 생성되지 않았는지 확인합니다.",
                "플랜 과목 수와 실습 필요 여부를 검증합니다.",
                "승인된 내용으로 학생 플랜을 생성합니다.",
              ],

        missingFields:
          Array.isArray(
            planDraft.preview
              .missingFields
          )
            ? planDraft.preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            planDraft.preview
              .warnings
          )
            ? planDraft.preview
                .warnings
            : [],

        canConfirm:
          planDraft.preview
            .canConfirm ===
            true,
      },

      /**
       * 초안 생성 시점 학생/플랜 상태
       *
       * 실제 Executor에서는 현재 DB를 다시 조회한다.
       */
      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            planDraft.studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        plan: {
          originalPlanExists:
            false,

          desiredCourse:
            draft.desiredCourse ??
            null,

          finalEducation:
            draft.finalEducation ??
            null,

          hasPractice:
            draft.hasPractice,

          totalTheorySubjects,

          requiredMajorCount,

          electiveMajorCount,

          liberalCount,

          generalCount,
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toKakaoAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 사용자가 이후
   * "ㅇㅇ", "진행해줘", "승인"
   * 이라고 했을 때 바로 plan_create를 찾는다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "plan_create",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 plan_create 승인 초안을
   * 수정해서 새 초안이 만들어진 경우
   * 새 초안 생성 성공 후 이전 초안을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "plan_create",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        planDraft.studentName ||
        `학생 ${studentId}번`
      }의 플랜 생성 초안을 만들었습니다.`
    ).trim();

  /**
   * 새로고침해도 승인 카드가 복원되도록
   * AI 대화 기록에 저장한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "plan.create",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "plan_create" &&
        previousPendingActionId > 0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      planCreateDraft:
        planDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

    return {
    ...result,

    pendingAction:
      publicPendingAction,

    planCreateDraft:
      planDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 플랜 수정 Tool은
 * plans 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 플랜 수정 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.planUpdateDraft &&
  result.planUpdateDraft
    .pendingActionRequired ===
    true
) {
  const planUpdateDraft =
    result.planUpdateDraft;

  const studentId =
    Number(
      planUpdateDraft.studentId ||
      0
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
      "플랜을 수정할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  const planId =
    Number(
      planUpdateDraft.planId ||
      0
    );

  if (
    !Number.isFinite(
      planId
    ) ||
    planId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 플랜 정보가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    planUpdateDraft.draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * Tool 바깥 대상과
   * 실제 승인 Draft 대상 학생이 동일해야 한다.
   */
  if (
    Number(
      draft.studentId ||
      0
    ) !==
    Math.floor(
      studentId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 초안의 대상 학생 정보가 일치하지 않습니다.",
      400
    );
  }

  if (
    Number(
      draft.planId ||
      0
    ) !==
    Math.floor(
      planId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 초안의 플랜 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  const originalValues =
    draft.originalValues;

  if (
    !originalValues ||
    typeof originalValues !==
      "object" ||
    Array.isArray(
      originalValues
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 원본 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    Number(
      originalValues.planId ||
      0
    ) !==
    Math.floor(
      planId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 원본의 플랜 ID가 일치하지 않습니다.",
      400
    );
  }

  const updates =
    draft.updates;

  if (
    !updates ||
    typeof updates !==
      "object" ||
    Array.isArray(
      updates
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 변경정보가 올바르지 않습니다.",
      400
    );
  }

  const allowedUpdateFields = [
    "desiredCourse",
    "finalEducation",
    "hasPractice",
    "totalTheorySubjects",
    "requiredMajorCount",
    "electiveMajorCount",
    "liberalCount",
    "generalCount",
  ] as const;

  const requestedFields =
    allowedUpdateFields.filter(
      (
        field
      ) =>
        Object.prototype.hasOwnProperty.call(
          updates,
          field
        )
    );

  if (
    requestedFields.length ===
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 초안에 변경 항목이 없습니다.",
      400
    );
  }

  /**
   * Router에서도 승인 초안 핵심 형식을 재검증한다.
   *
   * 실제 값과 Snapshot 충돌 검사는
   * Executor에서 현재 DB를 다시 조회한 뒤 처리한다.
   */
  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "hasPractice"
    ) &&
    typeof (
      updates as any
    ).hasPractice !==
      "boolean"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "실습 필요 여부가 올바르지 않습니다.",
      400
    );
  }

  const numericFields = [
    "totalTheorySubjects",
    "requiredMajorCount",
    "electiveMajorCount",
    "liberalCount",
    "generalCount",
  ] as const;

  for (
    const field of
    numericFields
  ) {
    if (
      !Object.prototype.hasOwnProperty.call(
        updates,
        field
      )
    ) {
      continue;
    }

    const value =
      Number(
        (
          updates as any
        )[
          field
        ]
      );

    if (
      !Number.isInteger(
        value
      ) ||
      value <
        0
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 수 변경정보가 올바르지 않습니다.",
        400
      );
    }
  }

  /**
   * 현재 createAiPendingAction()은
   * 별도 planId 컬럼 입력을 받지 않는다.
   *
   * planId는 payload와 sourceSnapshot에 보존한다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "plan_update",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          planUpdateDraft
            .preview
            .title ||
          "학생 플랜 수정",

        summary:
          planUpdateDraft
            .preview
            .summary ||
          "수정할 학생 플랜 내용을 확인해주세요.",

        sections:
          Array.isArray(
            planUpdateDraft
              .preview
              .sections
          )
            ? planUpdateDraft
                .preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        (section as any)
                          ?.label ||
                        (section as any)
                          ?.title ||
                        "플랜 수정 내용"
                      ),

                    items:
                      Array.isArray(
                        (section as any)
                          ?.items
                      )
                        ? (
                            section as any
                          ).items
                            .map(
                              (
                                item:
                                  unknown
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          Array.isArray(
            planUpdateDraft
              .preview
              .changes
          )
            ? planUpdateDraft
                .preview
                .changes
            : [],

        executionSteps:
          Array.isArray(
            planUpdateDraft
              .preview
              .executionSteps
          )
            ? planUpdateDraft
                .preview
                .executionSteps
            : [],

        missingFields:
          Array.isArray(
            planUpdateDraft
              .preview
              .missingFields
          )
            ? planUpdateDraft
                .preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            planUpdateDraft
              .preview
              .warnings
          )
            ? planUpdateDraft
                .preview
                .warnings
            : [],

        canConfirm:
          planUpdateDraft
            .preview
            .canConfirm ===
            true,
      },

      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            planUpdateDraft
              .studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        plan: {
          id:
            Math.floor(
              planId
            ),

          originalValues,
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toKakaoAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 이후 사용자가 승인/진행 요청을 보내면
   * plan_update Pending Action을 바로 찾는다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "plan_update",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),

            planId:
              Math.floor(
                planId
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 plan_update 초안을 수정하여
   * 새 초안을 만든 경우 이전 초안을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "plan_update",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        planUpdateDraft
          .studentName ||
        `학생 ${studentId}번`
      }의 플랜 수정 초안을 만들었습니다.`
    ).trim();

  /**
   * 새로고침 후에도 승인카드를 복원할 수 있도록
   * 대화 기록에 Pending Action 정보를 저장한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "plan.update",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "plan_update" &&
        previousPendingActionId >
          0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      planUpdateDraft:
        planUpdateDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    planUpdateDraft:
      planUpdateDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}



/**
 * 학생 플랜 과목 생성 Tool은
 * planSemesters 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 플랜 과목 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.planSubjectsCreateDraft &&
  result.planSubjectsCreateDraft
    .pendingActionRequired ===
    true
) {
  const planSubjectsDraft =
    result.planSubjectsCreateDraft;

  const studentId =
    Number(
      planSubjectsDraft.studentId ||
      0
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
      "플랜 과목을 생성할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  const planId =
    Number(
      planSubjectsDraft.planId ||
      0
    );

  if (
    !Number.isFinite(
      planId
    ) ||
    planId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목을 생성할 플랜 정보가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    planSubjectsDraft.draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 생성 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * 바깥 Tool 결과와 내부 Draft의
   * 학생 ID가 동일해야 한다.
   */
  if (
    Number(
      draft.studentId ||
      0
    ) !==
    Math.floor(
      studentId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 생성 초안의 대상 학생 정보가 일치하지 않습니다.",
      400
    );
  }

  /**
   * 바깥 Tool 결과와 내부 Draft의
   * 플랜 ID도 동일해야 한다.
   */
  if (
    Number(
      draft.planId ||
      0
    ) !==
    Math.floor(
      planId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 생성 초안의 플랜 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  const originalPlanSubjectIds =
    Array.isArray(
      draft.originalPlanSubjectIds
    )
      ? Array.from(
          new Set(
            draft.originalPlanSubjectIds
              .map(
                (
                  value
                ) =>
                  Number(
                    value
                  )
              )
              .filter(
                (
                  value
                ) =>
                  Number.isFinite(
                    value
                  ) &&
                  value >
                    0
              )
              .map(
                (
                  value
                ) =>
                  Math.floor(
                    value
                  )
              )
          )
        ).sort(
          (
            a,
            b
          ) =>
            a -
            b
        )
      : [];

  const subjects =
    Array.isArray(
      draft.subjects
    )
      ? draft.subjects
      : [];

  if (
    subjects.length ===
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "등록할 플랜 과목이 없습니다.",
      400
    );
  }

  if (
    subjects.length >
    100
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "한 번에 등록할 수 있는 플랜 과목은 최대 100개입니다.",
      400
    );
  }

  /**
   * Pending Action 저장 직전에도
   * 개별 과목의 핵심값을 검증한다.
   *
   * 최종 실행 시 Executor와 DB Transaction에서
   * 다시 한 번 전체 검증한다.
   */
  for (
    let index =
      0;
    index <
      subjects.length;
    index +=
      1
  ) {
    const subject =
      subjects[index];

    if (
      !subject ||
      typeof subject !==
        "object" ||
      Array.isArray(
        subject
      )
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${index + 1}번째 플랜 과목 정보가 올바르지 않습니다.`,
        400
      );
    }

    const semesterNo =
      Number(
        subject.semesterNo
      );

    if (
      !Number.isInteger(
        semesterNo
      ) ||
      semesterNo <
        1 ||
      semesterNo >
        20
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${index + 1}번째 플랜 과목의 학기 번호가 올바르지 않습니다.`,
        400
      );
    }

    const subjectName =
      String(
        subject.subjectName ||
        ""
      )
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    if (
      !subjectName
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${index + 1}번째 플랜 과목명이 없습니다.`,
        400
      );
    }

    const planCategory =
      String(
        subject.planCategory ||
        ""
      ).trim();

    if (
      planCategory !==
        "전공" &&
      planCategory !==
        "교양" &&
      planCategory !==
        "일반"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${subjectName} 과목의 플랜 분류가 올바르지 않습니다.`,
        400
      );
    }

    const planRequirementType =
      String(
        subject.planRequirementType ||
        ""
      ).trim();

    if (
      planRequirementType !==
        "전공필수" &&
      planRequirementType !==
        "전공선택" &&
      planRequirementType !==
        "교양" &&
      planRequirementType !==
        "일반"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${subjectName} 과목의 요구구분이 올바르지 않습니다.`,
        400
      );
    }

    const credits =
      Number(
        subject.credits
      );

    if (
      !Number.isInteger(
        credits
      ) ||
      credits <
        1 ||
      credits >
        10
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${subjectName} 과목의 학점 정보가 올바르지 않습니다.`,
        400
      );
    }

    const sortOrder =
      Number(
        subject.sortOrder
      );

    if (
      !Number.isInteger(
        sortOrder
      ) ||
      sortOrder <
        0
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${subjectName} 과목의 정렬 순서가 올바르지 않습니다.`,
        400
      );
    }

    if (
      typeof subject
        .settlementIncluded !==
      "boolean"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${subjectName} 과목의 정산 포함 여부가 올바르지 않습니다.`,
        400
      );
    }
  }

  /**
   * createAiPendingAction()의 현재 실제 타입에는
   * planId 컬럼 인자가 없다.
   *
   * 따라서 planId는 draft와 sourceSnapshot에 보존한다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "plan_subjects_create",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          planSubjectsDraft
            .preview
            .title ||
          "학생 플랜 과목 생성",

        summary:
          planSubjectsDraft
            .preview
            .summary ||
          "등록할 학생 플랜 과목을 확인해주세요.",

        sections:
          Array.isArray(
            planSubjectsDraft
              .preview
              .sections
          )
            ? planSubjectsDraft
                .preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        (section as any)
                          ?.label ||
                        (section as any)
                          ?.title ||
                        "플랜 과목 등록 내용"
                      ),

                    items:
                      Array.isArray(
                        (section as any)
                          ?.items
                      )
                        ? (
                            section as any
                          ).items
                            .map(
                              (
                                item:
                                  unknown
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          Array.isArray(
            planSubjectsDraft
              .preview
              .changes
          )
            ? planSubjectsDraft
                .preview
                .changes
            : [],

        executionSteps:
          Array.isArray(
            planSubjectsDraft
              .preview
              .executionSteps
          )
            ? planSubjectsDraft
                .preview
                .executionSteps
            : [],

        missingFields:
          Array.isArray(
            planSubjectsDraft
              .preview
              .missingFields
          )
            ? planSubjectsDraft
                .preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            planSubjectsDraft
              .preview
              .warnings
          )
            ? planSubjectsDraft
                .preview
                .warnings
            : [],

        canConfirm:
          planSubjectsDraft
            .preview
            .canConfirm ===
            true,
      },

      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            planSubjectsDraft
              .studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        plan: {
          id:
            Math.floor(
              planId
            ),
        },

        originalPlanSubjectIds,

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toKakaoAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 이후 "승인", "진행해줘"라고 하면
   * 이 plan_subjects_create Pending Action을 사용한다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "plan_subjects_create",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),

            planId:
              Math.floor(
                planId
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 플랜과목 생성 초안을 수정해서
   * 새 초안이 만들어진 경우 이전 것을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "plan_subjects_create",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        planSubjectsDraft
          .studentName ||
        `학생 ${studentId}번`
      }의 플랜 과목 ${subjects.length}개 등록 초안을 만들었습니다.`
    ).trim();

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "plan.subjects.create",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "plan_subjects_create" &&
        previousPendingActionId >
          0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      planSubjectsCreateDraft:
        planSubjectsDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    planSubjectsCreateDraft:
      planSubjectsDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 플랜 과목 수정 Tool은
 * planSemesters 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 과목 수정 초안을
 * Pending Action으로 저장하고
 * 사용자 최종 승인을 기다린다.
 */
if (
  result.planSubjectsUpdateDraft &&
  result.planSubjectsUpdateDraft
    .pendingActionRequired ===
    true
) {
  const planSubjectsUpdateDraft =
    result.planSubjectsUpdateDraft;

  const studentId =
    Number(
      planSubjectsUpdateDraft
        .studentId ||
      0
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
      "플랜 과목을 수정할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  const planId =
    Number(
      planSubjectsUpdateDraft
        .planId ||
      0
    );

  if (
    !Number.isFinite(
      planId
    ) ||
    planId <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목을 수정할 플랜 정보가 올바르지 않습니다.",
      400
    );
  }

  const planSubjectId =
    Number(
      planSubjectsUpdateDraft
        .planSubjectId ||
      0
    );

  if (
    !Number.isFinite(
      planSubjectId
    ) ||
    planSubjectId <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 플랜 과목 정보가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    planSubjectsUpdateDraft
      .draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * Tool 결과 대상과
   * 내부 Draft 대상이 동일해야 한다.
   */
  if (
    Number(
      draft.studentId ||
      0
    ) !==
    Math.floor(
      studentId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 초안의 학생 정보가 일치하지 않습니다.",
      400
    );
  }

  if (
    Number(
      draft.planId ||
      0
    ) !==
    Math.floor(
      planId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 초안의 플랜 정보가 일치하지 않습니다.",
      400
    );
  }

  if (
    Number(
      draft.planSubjectId ||
      0
    ) !==
    Math.floor(
      planSubjectId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 초안의 과목 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  const originalValues =
    draft.originalValues;

  if (
    !originalValues ||
    typeof originalValues !==
      "object" ||
    Array.isArray(
      originalValues
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 원본 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    Number(
      originalValues.id ||
      0
    ) !==
    Math.floor(
      planSubjectId
    ) ||
    Number(
      originalValues.studentId ||
      0
    ) !==
    Math.floor(
      studentId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 원본 대상 정보가 일치하지 않습니다.",
      400
    );
  }

  const updates =
    draft.updates;

  if (
    !updates ||
    typeof updates !==
      "object" ||
    Array.isArray(
      updates
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 변경정보가 올바르지 않습니다.",
      400
    );
  }

  const allowedUpdateFields = [
    "semesterNo",
    "subjectName",
    "planCategory",
    "planRequirementType",
    "credits",
    "sortOrder",
    "settlementIncluded",
  ] as const;

  const requestedFields =
    allowedUpdateFields.filter(
      (
        field
      ) =>
        Object.prototype
          .hasOwnProperty.call(
            updates,
            field
          )
    );

  if (
    requestedFields.length ===
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 초안에 변경 항목이 없습니다.",
      400
    );
  }

  /**
   * 승인 저장 직전 핵심 입력형식을
   * Router에서도 재확인한다.
   */
  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "semesterNo"
      )
  ) {
    const value =
      Number(
        (
          updates as any
        ).semesterNo
      );

    if (
      !Number.isInteger(
        value
      ) ||
      value <
        1 ||
      value >
        20
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 학기 정보가 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "subjectName"
      )
  ) {
    const value =
      String(
        (
          updates as any
        ).subjectName ||
        ""
      )
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    if (
      !value
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목명이 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "planCategory"
      )
  ) {
    const value =
      String(
        (
          updates as any
        ).planCategory ||
        ""
      ).trim();

    if (
      value !==
        "전공" &&
      value !==
        "교양" &&
      value !==
        "일반"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 분류가 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "planRequirementType"
      )
  ) {
    const value =
      String(
        (
          updates as any
        ).planRequirementType ||
        ""
      ).trim();

    if (
      value !==
        "전공필수" &&
      value !==
        "전공선택" &&
      value !==
        "교양" &&
      value !==
        "일반"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 요구구분이 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "credits"
      )
  ) {
    const value =
      Number(
        (
          updates as any
        ).credits
      );

    if (
      !Number.isInteger(
        value
      ) ||
      value <
        1 ||
      value >
        10
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 학점 정보가 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "sortOrder"
      )
  ) {
    const value =
      Number(
        (
          updates as any
        ).sortOrder
      );

    if (
      !Number.isInteger(
        value
      ) ||
      value <
        0
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 정렬 순서가 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "settlementIncluded"
      ) &&
    typeof (
      updates as any
    ).settlementIncluded !==
      "boolean"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 정산 포함 여부가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 실제 DB 수정은 하지 않고
   * 승인용 Pending Action만 만든다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "plan_subjects_update",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          planSubjectsUpdateDraft
            .preview
            .title ||
          "학생 플랜 과목 수정",

        summary:
          planSubjectsUpdateDraft
            .preview
            .summary ||
          "수정할 플랜 과목 내용을 확인해주세요.",

        sections:
          Array.isArray(
            planSubjectsUpdateDraft
              .preview
              .sections
          )
            ? planSubjectsUpdateDraft
                .preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        (section as any)
                          ?.label ||
                        (section as any)
                          ?.title ||
                        "플랜 과목 수정 내용"
                      ),

                    items:
                      Array.isArray(
                        (section as any)
                          ?.items
                      )
                        ? (
                            section as any
                          ).items
                            .map(
                              (
                                item:
                                  unknown
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          Array.isArray(
            planSubjectsUpdateDraft
              .preview
              .changes
          )
            ? planSubjectsUpdateDraft
                .preview
                .changes
            : [],

        executionSteps:
          Array.isArray(
            planSubjectsUpdateDraft
              .preview
              .executionSteps
          )
            ? planSubjectsUpdateDraft
                .preview
                .executionSteps
            : [],

        missingFields:
          Array.isArray(
            planSubjectsUpdateDraft
              .preview
              .missingFields
          )
            ? planSubjectsUpdateDraft
                .preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            planSubjectsUpdateDraft
              .preview
              .warnings
          )
            ? planSubjectsUpdateDraft
                .preview
                .warnings
            : [],

        canConfirm:
          planSubjectsUpdateDraft
            .preview
            .canConfirm ===
            true,
      },

      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            planSubjectsUpdateDraft
              .studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        plan: {
          id:
            Math.floor(
              planId
            ),
        },

        planSubject: {
          id:
            Math.floor(
              planSubjectId
            ),

          originalValues,
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toKakaoAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 승인/진행 요청이 들어오면
   * 이 Pending Action을 바로 찾도록 유지한다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "plan_subjects_update",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),

            planId:
              Math.floor(
                planId
              ),

            planSubjectId:
              Math.floor(
                planSubjectId
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 플랜 과목 수정 초안을
   * 다시 수정한 경우 이전 초안을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "plan_subjects_update",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        planSubjectsUpdateDraft
          .studentName ||
        `학생 ${studentId}번`
      }의 플랜 과목 수정 초안을 만들었습니다.`
    ).trim();

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "plan.subjects.update",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "plan_subjects_update" &&
        previousPendingActionId >
          0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      planSubjectsUpdateDraft:
        planSubjectsUpdateDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    planSubjectsUpdateDraft:
      planSubjectsUpdateDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}



/**
 * 학생 학기 생성 Tool은
 * semesters 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 학기 생성 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.semesterCreateDraft &&
  result.semesterCreateDraft
    .pendingActionRequired ===
    true
) {
  const semesterDraft =
    result.semesterCreateDraft;

  const studentId =
    Number(
      semesterDraft.studentId ||
      0
    );

  const semesterOrder =
    Number(
      semesterDraft.semesterOrder ||
      0
    );

  const semesterLabel =
    String(
      semesterDraft.semesterLabel ||
      ""
    ).trim();

  /**
   * Runner와 Tool에서 검증했더라도
   * Pending Action 저장 직전에
   * 핵심 식별값을 다시 검사한다.
   */
  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기를 생성할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

    if (
    !Number.isInteger(
      semesterOrder
    ) ||
    semesterOrder < 1 ||
    semesterOrder > 20
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "생성할 학기 순서는 1부터 20 사이의 정수여야 합니다.",
      400
    );
  }

    if (
    !semesterLabel
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "생성할 학기 구분이 없습니다.",
      400
    );
  }

  if (
    !/^(\d{4})년\s([12])학기$/.test(
      semesterLabel
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "생성할 학기 구분은 2026년 1학기 형식이어야 합니다.",
      400
    );
  }

  /**
   * Tool 결과 안의 실제 승인 초안을 확인한다.
   */
  const draft =
    semesterDraft.draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 생성 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * 바깥쪽 결과값과 실제 승인 초안의
   * 학생 및 학기 값이 동일한지 검사한다.
   */
   if (
    Number(
      draft.studentId ||
      0
    ) !==
      Math.floor(
        studentId
      ) ||
    Number(
      draft.semesterOrder ||
      0
    ) !==
      semesterOrder ||
    String(
      draft.semesterLabel ||
      ""
    ).trim() !==
      semesterLabel
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 생성 초안의 대상 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  const originalLastSemesterOrder =
    Number(
      draft.originalLastSemesterOrder ??
      0
    );

    if (
    !Number.isInteger(
      originalLastSemesterOrder
    ) ||
    originalLastSemesterOrder < 0 ||
    originalLastSemesterOrder > 19
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "기존 마지막 학기 순서 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 학기 생성 초안을 Pending Action으로 저장한다.
   *
   * 이 시점에는 semesters 테이블을
   * 실제로 변경하지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "semester_create",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      /**
       * 아직 실제 학기가 생성되지 않았으므로
       * semesterId는 null로 저장한다.
       */
      semesterId:
        null,

      /**
       * 다음 단계의 Executor가 사용할
       * 학기 생성 승인 초안이다.
       */
      payload: {
        draft,

        originalMessage:
          input.message,
      },

      /**
       * 사용자 승인 카드에 표시할 데이터다.
       */
      preview: {
        title:
          semesterDraft.preview
            .title ||
          "학생 학기 생성",

        summary:
          semesterDraft.preview
            .summary ||
          "생성할 학기 내용을 확인해주세요.",

        /**
         * Runner/Registry에서는 title + items,
         * Pending Action 공용 구조에서는
         * label + items를 사용한다.
         */
        sections:
          Array.isArray(
            semesterDraft.preview
              .sections
          )
            ? semesterDraft.preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        section?.title ||
                        "학기 생성 내용"
                      ),

                    items:
                      Array.isArray(
                        section?.items
                      )
                        ? section.items
                            .map(
                              (
                                item
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        /**
         * 신규 생성이므로 기존 값과 변경값을
         * 비교하는 changes는 비워둔다.
         */
        changes:
          [],

        executionSteps:
          Array.isArray(
            semesterDraft.preview
              .executionSteps
          )
            ? semesterDraft.preview
                .executionSteps
            : [
                "현재 학생과 조직 정보를 다시 확인합니다.",
                "학생 학기 수정 권한을 다시 확인합니다.",
                "초안 생성 이후 추가된 학기가 있는지 확인합니다.",
                "동일한 학기 순서와 학기 구분이 있는지 확인합니다.",
                "승인된 내용으로 새 학기를 생성합니다.",
              ],

        missingFields:
          Array.isArray(
            semesterDraft.preview
              .missingFields
          )
            ? semesterDraft.preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            semesterDraft.preview
              .warnings
          )
            ? semesterDraft.preview
                .warnings
            : [],

        canConfirm:
          semesterDraft.preview
            .canConfirm ===
            true,
      },

      /**
       * 초안이 만들어졌을 당시 학생 및
       * 기존 마지막 학기 상태를 보존한다.
       *
       * Executor에서 현재 DB와 다시 비교하여
       * 동시 수정이나 중복 등록을 차단한다.
       */
      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            semesterDraft.studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        semester: {
          semesterOrder:
            Math.floor(
              semesterOrder
            ),

          semesterLabel,

          originalLastSemesterOrder:
            Math.floor(
              originalLastSemesterOrder
            ),
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toKakaoAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 사용자가 이후 "ㅇㅇ", "진행해줘"라고
   * 답했을 때 방금 생성한 Pending Action을
   * 정확하게 승인할 수 있도록 업무 세션에 연결한다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "semester_create",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 학기 생성 승인 초안을 수정한 경우
   * 새 초안 생성 성공 후 이전 초안을 취소한다.
   */
 await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "semester_create",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        semesterDraft.studentName ||
        `학생 ${studentId}번`
      }의 ${semesterOrder}학기 생성 초안을 만들었습니다.`
    ).trim();

  /**
   * 새로고침 후에도 학기 생성 승인 카드를
   * 복원할 수 있도록 AI 대화 기록에 저장한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    /**
     * 현재 프론트의 Pending Action 카드가
     * student_registration_preview kind를
     * 사용하므로 기존 종류를 재사용한다.
     */
    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "semester.create",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "semester_create" &&
        previousPendingActionId > 0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      semesterCreateDraft:
        semesterDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    semesterCreateDraft:
      semesterDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 학기 수정 Tool은
 * semesters 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 학기 수정 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.semesterUpdateDraft &&
  result.semesterUpdateDraft
    .pendingActionRequired ===
    true
) {
  const semesterUpdateDraft =
    result.semesterUpdateDraft;

  const studentId =
    Number(
      semesterUpdateDraft
        .studentId ||
      0
    );

  const semesterId =
    Number(
      semesterUpdateDraft
        .semesterId ||
      0
    );

  const semesterOrder =
    Number(
      semesterUpdateDraft
        .semesterOrder ||
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    !Number.isFinite(
      semesterId
    ) ||
    semesterId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 학기 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    !Number.isInteger(
      semesterOrder
    ) ||
    semesterOrder <= 0 ||
    semesterOrder > 20
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 학기 순서가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    semesterUpdateDraft
      .draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 수정 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  if (
    Number(
      draft.studentId ||
      0
    ) !==
      Math.floor(
        studentId
      ) ||
    Number(
      draft.semesterId ||
      0
    ) !==
      Math.floor(
        semesterId
      ) ||
    Number(
      draft.semesterOrder ||
      0
    ) !==
      Math.floor(
        semesterOrder
      )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 수정 초안의 대상 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  const originalValues =
    draft.originalValues;

  if (
    !originalValues ||
    typeof originalValues !==
      "object" ||
    Array.isArray(
      originalValues
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 수정 원본 정보가 올바르지 않습니다.",
      400
    );
  }

  const updates =
    draft.updates;

  if (
    !updates ||
    typeof updates !==
      "object" ||
    Array.isArray(
      updates
    ) ||
    Object.keys(
      updates
    ).length === 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "변경할 학기 정보가 없습니다.",
      400
    );
  }

  const allowedUpdateFields =
    new Set([
      "semesterLabel",
      "plannedMonth",
      "plannedInstitution",
      "plannedSubjectCount",
      "plannedAmount",
      "actualStartDate",
      "actualInstitution",
      "actualSubjectCount",
      "actualAmount",
      "actualPaymentDate",
    ]);

  const updateKeys =
    Object.keys(
      updates
    );

  if (
    updateKeys.some(
      (
        key
      ) =>
        !allowedUpdateFields.has(
          key
        )
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "허용되지 않은 학기 수정 항목이 포함되어 있습니다.",
      400
    );
  }

  const originalApprovalStatus =
    String(
      originalValues
        .approvalStatus ||
      "요청전"
    ).trim();

  if (
    originalApprovalStatus !==
      "요청전" &&
    originalApprovalStatus !==
      "불승인"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      originalApprovalStatus ===
        "대기"
        ? "승인 대기 중인 학기는 수정할 수 없습니다."
        : originalApprovalStatus ===
            "승인"
          ? "이미 승인된 학기는 수정할 수 없습니다."
          : "현재 승인 상태에서는 학기를 수정할 수 없습니다.",
      409
    );
  }

  const changes =
    Array.isArray(
      semesterUpdateDraft
        .changes
    )
      ? semesterUpdateDraft
          .changes
      : [];

  if (
    changes.length ===
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "실제로 변경되는 학기 정보가 없습니다.",
      400
    );
  }

  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "semester_update",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        Math.floor(
          semesterId
        ),

      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          semesterUpdateDraft
            .preview
            .title ||
          "학생 학기 수정",

        summary:
          semesterUpdateDraft
            .preview
            .summary ||
          "학기 수정 내용을 확인해주세요.",

        sections:
          Array.isArray(
            semesterUpdateDraft
              .preview
              .sections
          )
            ? semesterUpdateDraft
                .preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        section?.title ||
                        "학기 수정 내용"
                      ),

                    items:
                      Array.isArray(
                        section?.items
                      )
                        ? section.items
                            .map(
                              (
                                item
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          changes.map(
            (
              change
            ) => ({
              label:
                String(
                  change?.label ||
                  change?.field ||
                  "변경 항목"
                ),

              before:
                change?.before ??
                null,

              after:
                change?.after ??
                null,
            })
          ),

        executionSteps:
          Array.isArray(
            semesterUpdateDraft
              .preview
              .executionSteps
          )
            ? semesterUpdateDraft
                .preview
                .executionSteps
            : [],

        missingFields:
          Array.isArray(
            semesterUpdateDraft
              .preview
              .missingFields
          )
            ? semesterUpdateDraft
                .preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            semesterUpdateDraft
              .preview
              .warnings
          )
            ? semesterUpdateDraft
                .preview
                .warnings
            : [],

        canConfirm:
          semesterUpdateDraft
            .preview
            .canConfirm ===
            true,
      },

      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            semesterUpdateDraft
              .studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        semester: {
          id:
            Math.floor(
              semesterId
            ),

          semesterOrder:
            Math.floor(
              semesterOrder
            ),

          originalValues,
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toKakaoAiPendingActionPublicResult(
      pendingAction
    );

  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "semester_update",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "semester_update",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        semesterUpdateDraft
          .studentName ||
        `학생 ${studentId}번`
      }의 ${semesterOrder}학기 수정 초안을 만들었습니다.`
    ).trim();

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "semester.update",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "semester_update" &&
        previousPendingActionId > 0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      semesterUpdateDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    semesterUpdateDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 학기 입력완료 Tool은
 * semesters 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 입력완료 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.semesterCompleteDraft &&
  result.semesterCompleteDraft
    .pendingActionRequired ===
    true
) {
  const semesterCompleteDraft =
    result.semesterCompleteDraft;

  const studentId =
    Number(
      semesterCompleteDraft
        .studentId ||
      0
    );

  const semesterId =
    Number(
      semesterCompleteDraft
        .semesterId ||
      0
    );

  const semesterOrder =
    Number(
      semesterCompleteDraft
        .semesterOrder ||
      0
    );

  /**
   * Runner와 Tool에서 이미 검증했더라도
   * Pending Action 저장 직전에
   * 대상 학생과 학기 값을 다시 검사한다.
   */
  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "입력완료 처리할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    !Number.isFinite(
      semesterId
    ) ||
    semesterId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "입력완료 처리할 학기 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    !Number.isInteger(
      semesterOrder
    ) ||
    semesterOrder <= 0 ||
    semesterOrder > 20
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "입력완료 처리할 학기 순서가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    semesterCompleteDraft
      .draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 입력완료 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * 바깥쪽 Tool 결과와 내부 승인 초안의
   * 학생·학기 정보가 모두 일치해야 한다.
   */
  if (
    Number(
      draft.studentId ||
      0
    ) !==
      Math.floor(
        studentId
      ) ||
    Number(
      draft.semesterId ||
      0
    ) !==
      Math.floor(
        semesterId
      ) ||
    Number(
      draft.semesterOrder ||
      0
    ) !==
      Math.floor(
        semesterOrder
      )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 입력완료 초안의 대상 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 입력완료 시 허용되는 변경값은
   * 아래 두 값으로 고정한다.
   *
   * 다른 필드를 포함한 초안은 저장하지 않는다.
   */
  if (
    draft.updates
      ?.isCompleted !==
      true ||
    draft.updates
      ?.approvalStatus !==
      "대기"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 입력완료 변경값이 올바르지 않습니다.",
      400
    );
  }

  const originalValues =
    draft.originalValues;

  if (
    !originalValues ||
    typeof originalValues !==
      "object" ||
    Array.isArray(
      originalValues
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 입력완료 원본 상태가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 이미 완료된 학기를 대상으로 만든 초안은
   * Pending Action으로 저장하지 않는다.
   */
  if (
    originalValues.isCompleted ===
    true
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "이미 입력완료 처리된 학기입니다.",
      409
    );
  }

  const originalApprovalStatus =
    String(
      originalValues
        .approvalStatus ||
      ""
    ).trim();

  /**
   * 학생 상세페이지의 입력완료 버튼과
   * 동일한 허용 규칙을 적용한다.
   */
  if (
    originalApprovalStatus !==
      "요청전" &&
    originalApprovalStatus !==
      "불승인"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      originalApprovalStatus ===
        "대기"
        ? "이미 승인 대기 중인 학기입니다."
        : originalApprovalStatus ===
            "승인"
          ? "이미 승인된 학기는 입력완료 처리할 수 없습니다."
          : "현재 승인 상태에서는 입력완료 처리할 수 없습니다.",
      409
    );
  }

  /**
   * 학기 입력완료 초안을 Pending Action으로 저장한다.
   *
   * 이 시점에는 semesters 테이블을
   * 실제로 변경하지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "semester_complete",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        Math.floor(
          semesterId
        ),

      /**
       * Executor가 승인 실행 시 사용할
       * 학기 입력완료 초안이다.
       */
      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          semesterCompleteDraft
            .preview
            .title ||
          "학생 학기 입력완료",

        summary:
          semesterCompleteDraft
            .preview
            .summary ||
          "학기 입력완료 처리 내용을 확인해주세요.",

        sections:
          Array.isArray(
            semesterCompleteDraft
              .preview
              .sections
          )
            ? semesterCompleteDraft
                .preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        section?.title ||
                        "입력완료 처리 내용"
                      ),

                    items:
                      Array.isArray(
                        section?.items
                      )
                        ? section.items
                            .map(
                              (
                                item
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          Array.isArray(
            semesterCompleteDraft
              .preview
              .changes
          )
            ? semesterCompleteDraft
                .preview
                .changes
                .map(
                  (
                    change
                  ) => ({
                    label:
                      String(
                        change?.label ||
                        "변경 항목"
                      ),

                    before:
                      change?.before ??
                      null,

                    after:
                      change?.after ??
                      null,

                    description:
                      change?.description ??
                      null,
                  })
                )
            : [
                {
                  label:
                    "입력 상태",

                  before:
                    false,

                  after:
                    true,
                },
                {
                  label:
                    "승인 상태",

                  before:
                    originalApprovalStatus,

                  after:
                    "대기",
                },
              ],

        executionSteps:
          Array.isArray(
            semesterCompleteDraft
              .preview
              .executionSteps
          )
            ? semesterCompleteDraft
                .preview
                .executionSteps
            : [
                "현재 학생과 조직 정보를 다시 확인합니다.",
                "현재 담당자의 학생 수정 권한을 다시 확인합니다.",
                "학기 상태가 초안 생성 이후 변경되지 않았는지 확인합니다.",
                "실제 등록정보와 우리플랜 과목 수를 다시 확인합니다.",
                "입력완료 상태와 승인 대기 상태만 반영합니다.",
              ],

        missingFields:
          Array.isArray(
            semesterCompleteDraft
              .preview
              .missingFields
          )
            ? semesterCompleteDraft
                .preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            semesterCompleteDraft
              .preview
              .warnings
          )
            ? semesterCompleteDraft
                .preview
                .warnings
            : [],

        canConfirm:
          semesterCompleteDraft
            .preview
            .canConfirm ===
            true,
      },

      /**
       * 초안 생성 당시 학생 담당자와
       * 학기의 실제 등록정보를 함께 보존한다.
       *
       * Executor는 payload.draft.originalValues를
       * 기준으로 현재 DB와 다시 비교한다.
       */
      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            semesterCompleteDraft
              .studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        semester: {
          id:
            Math.floor(
              semesterId
            ),

          semesterOrder:
            Math.floor(
              semesterOrder
            ),

          semesterLabel:
            semesterCompleteDraft
              .semesterLabel ??
            null,

          actualSubjectCount:
            Number(
              draft.actualSubjectCount ||
              0
            ),

          planSubjectCount:
            Number(
              draft.planSubjectCount ||
              0
            ),

          originalValues,
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toKakaoAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 사용자가 이후 “ㅇㅇ”, “진행해줘”라고
   * 답했을 때 방금 만든 입력완료 Action을
   * 정확히 승인할 수 있도록 연결한다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "semester_complete",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 입력완료 승인 초안을 수정하거나
   * 다시 생성한 경우 새 초안 생성 이후
   * 이전 초안을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "semester_complete",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        semesterCompleteDraft
          .studentName ||
        `학생 ${studentId}번`
      }의 ${semesterOrder}학기 입력완료 초안을 만들었습니다.`
    ).trim();

  /**
   * 새로고침 후에도 입력완료 승인 카드를
   * 복원할 수 있도록 AI 대화 기록에 저장한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "semester.complete",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "semester_complete" &&
        previousPendingActionId > 0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      semesterCompleteDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    semesterCompleteDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 기본정보 수정 Tool은
 * 학생정보를 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 학생 수정 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.studentUpdateDraft &&
  result.studentUpdateDraft
    .pendingActionRequired ===
    true
) {
  const studentDraft =
    result.studentUpdateDraft;

  const studentId =
    Number(
      studentDraft.studentId ||
      0
    );

  /**
   * Runner와 Tool에서 검증했더라도
   * Pending Action 저장 직전에
   * 학생 ID를 다시 검사한다.
   */
  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 실제 변경 항목이 존재하는지
   * 다시 확인한다.
   */
  const changes =
    Array.isArray(
      studentDraft.changes
    )
      ? studentDraft.changes
      : [];

  if (
    changes.length ===
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "변경할 학생정보가 없습니다.",
      400
    );
  }

  /**
   * Tool에서 생성한 변경 초안을
   * Pending Action에 저장한다.
   *
   * 이 시점에는 students 테이블을
   * 실제로 수정하지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "student_update",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      /**
       * Executor가 실제 승인 실행 시
       * 사용할 학생 수정 초안이다.
       */
      payload: {
        draft:
          studentDraft.draft,

        originalMessage:
          input.message,
      },

      /**
       * 사용자 승인 카드에 표시할 데이터다.
       */
      preview: {
        title:
          studentDraft.preview
            .title ||
          "학생 기본정보 수정",

        summary:
          studentDraft.preview
            .summary ||
          "학생 기본정보 변경 내용을 확인해주세요.",

        sections:
  Array.isArray(
    studentDraft.preview
      .sections
  )
    ? studentDraft.preview
        .sections
        .map(
          (
            section
          ) => ({
            label:
              String(
                section?.title ||
                "수정 대상"
              ),

            items:
              Array.isArray(
                section?.items
              )
                ? section.items
                    .map(
                      (
                        item
                      ) =>
                        String(
                          item ||
                          ""
                        ).trim()
                    )
                    .filter(
                      Boolean
                    )
                : [],
          })
        )
    : [],

        changes:
          changes.map(
            (
              change
            ) => ({
              label:
                String(
                  change.label ||
                  change.field ||
                  "변경 항목"
                ),

              before:
                change.before ??
                null,

              after:
                change.after ??
                null,
            })
          ),

        executionSteps:
          Array.isArray(
            studentDraft.preview
              .executionSteps
          )
            ? studentDraft.preview
                .executionSteps
            : [
                "현재 학생정보를 다시 확인합니다.",
                "학생 조회 및 수정 권한을 다시 확인합니다.",
                "승인된 변경 항목만 학생정보에 반영합니다.",
              ],

        missingFields:
          Array.isArray(
            studentDraft.preview
              .missingFields
          )
            ? studentDraft.preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            studentDraft.preview
              .warnings
          )
            ? studentDraft.preview
                .warnings
            : [],

        canConfirm:
          studentDraft.preview
            .canConfirm ===
            true &&
          changes.length >
            0,
      },

      /**
       * Executor에서도 draft.originalValues를
       * 기준으로 충돌검사를 수행한다.
       *
       * sourceSnapshot은 사용자 승인 기록과
       * 추후 감사 확인을 위해 함께 보존한다.
       */
      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            studentDraft.studentName ??
            null,

          status:
            studentDraft.draft
              .originalValues
              .status ??
            null,

          course:
            studentDraft.draft
              .originalValues
              .course ??
            null,

          address:
            studentDraft.draft
              .originalValues
              .address ??
            null,

          detailAddress:
            studentDraft.draft
              .originalValues
              .detailAddress ??
            null,
        },

        draftCreatedAt:
          studentDraft.draft
            .createdAt,
      },

      expiresInMinutes:
        30,
    });

 const publicPendingAction =
  toKakaoAiPendingActionPublicResult(
    pendingAction
  );

workSession =
  await db.patchAiWorkSession({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    expectedVersion:
      workSession.version,

    patch: {
      lastPresentedAction: {
  actionId:
    `pending-action-${Number(
      pendingAction.id
    )}`,

  actionType:
    "student_update",

  targetType:
    "student",

        targetId:
          Math.floor(
            studentId
          ),

        payload: {
          pendingActionId:
            Number(
              pendingAction.id
            ),
        },

        expiresAt:
          pendingAction.expiresAt
            ? new Date(
                pendingAction.expiresAt
              ).toISOString()
            : new Date(
                Date.now() +
                30 * 60 * 1000
              ).toISOString(),
      },
    },
  });

/**
 * 기존 학생 수정 승인 초안을 변경한 경우
 * 새 초안 생성 성공 후 이전 초안을 취소한다.
 */
await replacePreviousAiPendingActionIfNeeded({
  ctx,

  isPendingActionRevision,

  previousPendingActionId,

  previousPendingActionType,

  expectedActionType:
    "student_update",

  newPendingActionId:
    Number(
      pendingAction.id
    ),

  targetOrganizationId:
    input.targetOrganizationId ??
    null,
});

const reply =
    String(
      result.reply ||
      `${
        studentDraft.studentName ||
        `학생 ${studentId}번`
      }의 기본정보 수정 초안을 만들었습니다.`
    ).trim();

  /**
   * 새로고침 후에도 승인 카드를
   * 복원할 수 있도록 대화 기록에 저장한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    /**
     * 현재 프론트 Pending Action 카드가
     * 이 kind를 기준으로 복원되고 있으므로
     * 기존 값을 재사용한다.
     */
    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "student.update",

  pendingActionDecision:
    result.pendingActionDecision ??
    null,

  replacedPendingActionId:
  isPendingActionRevision &&
  previousPendingActionType ===
    "student_update" &&
  previousPendingActionId > 0
    ? Math.floor(
        previousPendingActionId
      )
    : null,

      studentUpdateDraft:
        studentDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

    return {
    ...result,

    pendingAction:
      publicPendingAction,

    studentUpdateDraft:
      studentDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}


        return null;
      }
    )();

  if (
    webWriteResult
  ) {
    return {
      handled:
        true,

      staffContext,

      result:
        webWriteResult as
          RunAiAssistantOutput,
    };
  }

  /**
   * READ / 일반 업무비서 답변도 AI Chat DB에 저장하여
   * 다음 카카오 턴과 웹 CRM에서 문맥을 복원한다.
   */
  const assistantReply =
    String(
      result.reply ||
      ""
    ).trim();

  if (
    assistantReply &&
    !assistantMessageSaved
  ) {
    const messageData:
      Record<
        string,
        unknown
      > = {};

    if (
      result.data &&
      typeof result.data ===
        "object" &&
      !Array.isArray(
        result.data
      )
    ) {
      Object.assign(
        messageData,
        result.data
      );
    }

    if (
      result.registrationPreview
    ) {
      messageData.registrationPreview =
        result.registrationPreview;
    }

    if (
      result.toolResult &&
      typeof result.toolResult ===
        "object"
    ) {
      messageData.toolResult =
        result.toolResult;
    }

    await db.saveAiChatMessage({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      role:
        "assistant",

      kind:
        getKakaoAiChatKindFromResult(
          result
        ),

      content:
        assistantReply,

      messageDataJson:
        Object.keys(
          messageData
        ).length > 0
          ? messageData
          : null,

      selectedStudentId:
        activeStudentId,
    });
  }

  return {
    handled:
      true,

    staffContext,

    result,
  };
}
