import * as db from "../db";

import {
  throwAppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

export type ConsultationCreateDraft = {
  consultDate:
    string;

  channel:
    string;

  clientName:
    string;

  phone:
    string;

  finalEducation:
    string | null;

  desiredCourse:
    string | null;

  notes:
    string | null;

  status:
    string;

  canConfirm:
    boolean;

  missingFields:
    string[];

  warnings?:
    string[];
};

export type ExecuteConsultationCreatePendingActionInput = {
  pendingActionId:
    number;

  organizationId:
    number;

  requestedByUserId:
    number;

  confirmedByUserId:
    number;

  expectedVersion:
    number;

  actorName?:
    string | null;

  actorRole?:
    string | null;
};

export type ExecuteConsultationCreatePendingActionResult = {
  success:
    boolean;

  alreadyExecuted:
    boolean;

  executing:
    boolean;

  pendingAction:
    any;

  consultationId:
    number | null;

  message:
    string;
};

function normalizePositiveInteger(
  value:
    unknown,

  message:
    string
): number {
  const normalized =
    Number(
      value ||
      0
    );

  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      message,
      400
    );
  }

  return Math.floor(
    normalized
  );
}

function normalizeRequiredText(
  value:
    unknown,

  fieldLabel:
    string,

  maxLength:
    number
): string {
  const normalized =
    String(
      value ??
      ""
    )
      .trim()
      .slice(
        0,
        maxLength
      );

  if (
    !normalized
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${fieldLabel} 정보가 필요합니다.`,
      400
    );
  }

  return normalized;
}

function normalizeNullableText(
  value:
    unknown,

  maxLength:
    number
): string | null {
  const normalized =
    String(
      value ??
      ""
    )
      .trim()
      .slice(
        0,
        maxLength
      );

  return normalized ||
    null;
}

function normalizePhone(
  value:
    unknown
): string {
  const normalized =
    String(
      value ??
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
    normalized.length <
      10 ||
    normalized.length >
      11
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "올바른 연락처가 필요합니다.",
      400
    );
  }

  return normalized;
}

function normalizeConsultDate(
  value:
    unknown
): Date {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  if (
    !normalized
  ) {
    return new Date();
  }

  const date =
    new Date(
      normalized
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "상담 날짜가 올바르지 않습니다.",
      400
    );
  }

  return date;
}

function normalizePendingDraft(
  value:
    unknown
): ConsultationCreateDraft {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "상담DB 신규등록 초안이 올바르지 않습니다.",
      400
    );
  }

  const draft =
    value as
      ConsultationCreateDraft;

  if (
    draft.canConfirm !==
      true ||
    (
      Array.isArray(
        draft.missingFields
      ) &&
      draft.missingFields
        .length >
        0
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "필수 정보가 누락된 상담DB 신규등록 초안입니다.",
      409
    );
  }

  return {
    consultDate:
      String(
        draft.consultDate ||
        ""
      ).trim(),

    channel:
      normalizeRequiredText(
        draft.channel ||
        "AI 상담 등록",
        "상담 경로",
        100
      ),

    clientName:
      normalizeRequiredText(
        draft.clientName,
        "이름",
        100
      ),

    phone:
      normalizePhone(
        draft.phone
      ),

    finalEducation:
      normalizeNullableText(
        draft.finalEducation,
        100
      ),

    desiredCourse:
      normalizeNullableText(
        draft.desiredCourse,
        100
      ),

    notes:
      normalizeNullableText(
        draft.notes,
        5000
      ),

    status:
      normalizeRequiredText(
        draft.status ||
        "상담중",
        "상담 상태",
        50
      ),

    canConfirm:
      true,

    missingFields:
      [],

    warnings:
      Array.isArray(
        draft.warnings
      )
        ? draft.warnings
            .map(
              (
                warning
              ) =>
                String(
                  warning ||
                  ""
                ).trim()
            )
            .filter(
              Boolean
            )
        : [],
  };
}

export async function executeConsultationCreatePendingAction(
  input:
    ExecuteConsultationCreatePendingActionInput
): Promise<
  ExecuteConsultationCreatePendingActionResult
> {
  const pendingActionId =
    normalizePositiveInteger(
      input.pendingActionId,
      "올바른 AI 승인 요청 ID가 필요합니다."
    );

  const organizationId =
    normalizePositiveInteger(
      input.organizationId,
      "올바른 회사 정보가 필요합니다."
    );

  const requestedByUserId =
    normalizePositiveInteger(
      input.requestedByUserId,
      "AI 초안 요청 사용자 정보가 올바르지 않습니다."
    );

  const confirmedByUserId =
    normalizePositiveInteger(
      input.confirmedByUserId,
      "AI 초안 승인 사용자 정보가 올바르지 않습니다."
    );

  const expectedVersion =
    normalizePositiveInteger(
      input.expectedVersion,
      "올바른 AI 초안 버전이 필요합니다."
    );

  if (
    requestedByUserId !==
    confirmedByUserId
  ) {
    throwAppError(
      ERROR_CODES.FORBIDDEN,
      "상담DB 신규등록 초안을 만든 담당자만 승인할 수 있습니다.",
      403
    );
  }

  const claim =
    await db.claimAiPendingActionForExecution({
      id:
        pendingActionId,

      organizationId,

      requestedByUserId,

      confirmedByUserId,

      expectedVersion,
    });

  if (
    claim.alreadyExecuted
  ) {
    const executionResult =
      claim.action
        ?.executionResultJson &&
      typeof claim.action
        .executionResultJson ===
        "object"
        ? claim.action
            .executionResultJson as any
        : null;

    const consultationId =
      Number(
        executionResult
          ?.consultationId ||
        claim.action
          ?.consultationId ||
        0
      );

    return {
      success:
        true,

      alreadyExecuted:
        true,

      executing:
        false,

      pendingAction:
        claim.action,

      consultationId:
        Number.isFinite(
          consultationId
        ) &&
        consultationId >
          0
          ? consultationId
          : null,

      message:
        executionResult
          ?.message ||
        "이미 상담DB 신규등록이 완료된 요청입니다.",
    };
  }

  if (
    !claim.claimed
  ) {
    return {
      success:
        false,

      alreadyExecuted:
        false,

      executing:
        true,

      pendingAction:
        claim.action,

      consultationId:
        null,

      message:
        "상담DB 신규등록 작업이 이미 실행 중입니다.",
    };
  }

  const action =
    claim.action;

  const completedSteps:
    string[] = [];

  try {
    if (
      action.actionType !==
      "consultation_create"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "상담DB 신규등록 승인 요청이 아닙니다.",
        400
      );
    }

    const draft =
      normalizePendingDraft(
        action.payloadJson
      );

    completedSteps.push(
      "승인 초안 검증"
    );

    /**
     * 담당자는 프론트 또는 AI가 입력한 값을 사용하지 않는다.
     * 초안을 요청하고 승인한 현재 사용자를 담당자로 지정한다.
     */
    const assigneeId =
      confirmedByUserId;

    /**
     * 실행 직전 중복 여부를 다시 확인한다.
     *
     * 이름만 같다고 차단하면 동명이인을 등록할 수 없으므로
     * 연락처 숫자 전체 일치를 최종 중복 기준으로 사용한다.
     */
    const consultations =
  await db.listConsultations(
    undefined,
    {
      organizationId,
    }
  );

    const normalizedPhone =
      normalizePhone(
        draft.phone
      );

    const duplicateConsultation =
      (
        consultations ||
        []
      ).find(
        (
          consultation:
            any
        ) =>
          String(
            consultation
              ?.phone ||
            ""
          )
            .replace(
              /\D/g,
              ""
            ) ===
          normalizedPhone
      );

   if (
  duplicateConsultation
) {
  throwAppError(
    ERROR_CODES.DUPLICATE_RESOURCE,
    "동일한 연락처가 회사 상담DB에 이미 등록되어 있어 신규등록할 수 없습니다. 관리자 또는 호스트에게 기존 상담 담당자를 확인해주세요.",
    409
  );
}

    completedSteps.push(
      "상담DB 중복 여부 확인"
    );

    const consultationId =
      await db.createConsultation({
        organizationId,

        assigneeId,

        consultDate:
          normalizeConsultDate(
            draft.consultDate
          ),

        channel:
          draft.channel,

        clientName:
          draft.clientName,

        phone:
          normalizedPhone,

        finalEducation:
          draft.finalEducation ||
          "",

        desiredCourse:
          draft.desiredCourse ||
          "",

        notes:
          draft.notes ||
          "",

        status:
          draft.status ||
          "상담중",
      } as any);

    const normalizedConsultationId =
      normalizePositiveInteger(
        consultationId,
        "생성된 상담DB ID를 확인할 수 없습니다."
      );

    completedSteps.push(
      "상담DB 신규등록"
    );

   const executedAction =
  await db.markAiPendingActionExecuted({
    id:
      pendingActionId,

    organizationId,

    requestedByUserId,

    expectedVersion,

    consultationId:
      normalizedConsultationId,

    studentId:
      null,

    scheduleId:
      null,

    planId:
      null,

    semesterIds:
      [],

    planSubjectIds:
      [],

    transferSubjectIds:
      [],

    practiceSaved:
      false,

    paymentUpdated:
      false,

    completedSteps,

    failedSteps:
      [],

    message:
      "상담DB 신규등록이 완료되었습니다.",
  });

    if (
      !executedAction
    ) {
      throwAppError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        "완료된 AI 승인 요청 결과가 없습니다.",
        500
      );
    }

    try {
      await db.createAiActionLog({
        organizationId,

        userId:
          confirmedByUserId,

        userName:
          input.actorName ||
          `사용자 ${confirmedByUserId}`,

        action:
          "consultation_create",

        targetStudentId:
          null,

        targetStudentName:
          draft.clientName,

        payload: {
          pendingActionId,

          consultationId:
            normalizedConsultationId,

          status:
            draft.status,

          assigneeId,
        },
      });
    } catch (
      logError
    ) {
      console.error(
        "[AI CONSULTATION CREATE] 실행로그 저장 실패",
        {
          pendingActionId,

          organizationId,

          consultationId:
            normalizedConsultationId,

          message:
            logError instanceof
              Error
              ? String(
                  logError.message ||
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

    return {
      success:
        true,

      alreadyExecuted:
        false,

      executing:
        false,

      pendingAction:
        executedAction,

      consultationId:
        normalizedConsultationId,

      message:
        "상담DB 신규등록이 완료되었습니다. 이어서 등록예정 전환과 과목설계를 진행할 수 있습니다.",
    };
  } catch (
    error:
      any
  ) {
    const errorMessage =
      String(
        error?.message ||
        "상담DB 신규등록 중 오류가 발생했습니다."
      );

    try {
      const latestAction =
        await db.getAiPendingActionForConfirmation({
          id:
            pendingActionId,

          organizationId,

          requestedByUserId,
        });

      if (
        latestAction?.status !==
        "executed"
      ) {
        await db.markAiPendingActionFailed({
          id:
            pendingActionId,

          organizationId,

          requestedByUserId,

          expectedVersion,

          errorMessage,

          completedSteps,

          failedSteps: [
            errorMessage,
          ],
        });
      }
    } catch {
      /**
       * 원래 실행 오류를 유지한다.
       */
    }

    throw error;
  }
}