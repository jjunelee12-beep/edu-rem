import * as db from "../db";

import type {
  AiDocumentImportDraft,
  AiPendingActionType,
} from "./ai.types";

import {
  throwAppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

export type ExecuteDocumentImportPendingActionInput = {
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
    string |
    null;

  actorRole?:
    string |
    null;
};

export type ExecuteDocumentImportPendingActionResult = {
  success:
    boolean;

  alreadyExecuted:
    boolean;

  executing:
    boolean;

  pendingAction:
    any;

  studentId:
    number |
    null;

  semesterId:
    number |
    null;

  planSubjectIds:
    number[];

  transferSubjectIds:
    number[];

  paymentUpdated:
    boolean;

  message:
    string;
};

const DOCUMENT_IMPORT_ACTION_TYPES =
  new Set<AiPendingActionType>([
    "document_transfer_import",
    "document_plan_import",
    "document_payment_import",
    "document_plan_payment_import",
  ]);

function normalizePositiveInteger(
  value:
    unknown,

  message:
    string
): number {
  const number =
    Number(
      value ||
      0
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      message,
      400
    );
  }

  return Math.floor(
    number
  );
}

function normalizePositiveIntegerArray(
  value:
    unknown
): number[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(Number)
        .filter(
          (
            id
          ) =>
            Number.isFinite(
              id
            ) &&
            id > 0
        )
        .map(
          (
            id
          ) =>
            Math.floor(
              id
            )
        )
    )
  );
}

function getDocumentDraftFromPayload(
  value:
    unknown
): AiDocumentImportDraft {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서 CRM 반영 초안 payload가 올바르지 않습니다.",
      400
    );
  }

  const payload =
    value as
      Record<
        string,
        unknown
      >;

  const draft =
    payload.draft;

  if (
    !draft ||
    typeof draft !==
      "object"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서 CRM 반영 초안 데이터가 없습니다.",
      400
    );
  }

  return draft as
    AiDocumentImportDraft;
}

function validateDocumentDraft(
  draft:
    AiDocumentImportDraft,

  actionType:
    unknown,

  studentId:
    number
) {
  if (
    !DOCUMENT_IMPORT_ACTION_TYPES.has(
      actionType as
        AiPendingActionType
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서 CRM 반영 승인 요청이 아닙니다.",
      400
    );
  }

  if (
    draft.actionType !==
    actionType
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "Pending Action과 문서 초안의 작업 유형이 일치하지 않습니다.",
      409
    );
  }

  if (
    Number(
      draft.studentId ||
      0
    ) !==
    studentId
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "Pending Action과 문서 초안의 학생 정보가 일치하지 않습니다.",
      409
    );
  }

  if (
    draft.canConfirm !==
      true ||
    !Array.isArray(
      draft.missingFields
    ) ||
    draft.missingFields
      .length > 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "필수 정보가 누락된 문서 CRM 반영 초안입니다.",
      409
    );
  }

  if (
    !String(
      draft.analysisId ||
      ""
    ).trim()
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서 분석 ID가 없습니다.",
      400
    );
  }
}

function getExecutedResult(
  action:
    any
) {
  const result =
    action
      ?.executionResultJson &&
    typeof action
      .executionResultJson ===
      "object"
      ? action
          .executionResultJson as
          Record<
            string,
            any
          >
      : null;

  const studentId =
    Number(
      result?.studentId ||
      action?.studentId ||
      0
    );

  const semesterIds =
    normalizePositiveIntegerArray(
      result?.semesterIds
    );

  return {
    studentId:
      Number.isFinite(
        studentId
      ) &&
      studentId > 0
        ? Math.floor(
            studentId
          )
        : null,

    semesterId:
      semesterIds[0] ||
      null,

    planSubjectIds:
      normalizePositiveIntegerArray(
        result?.planSubjectIds
      ),

    transferSubjectIds:
      normalizePositiveIntegerArray(
        result?.transferSubjectIds
      ),

    paymentUpdated:
      result
        ?.paymentUpdated ===
      true,

    message:
      String(
        result?.message ||
        "이미 문서 CRM 반영이 완료된 요청입니다."
      ),
  };
}

/**
 * AI 문서 Pending Action 실제 실행
 *
 * 처리 순서:
 * 1. Pending Action 실행 선점
 * 2. 문서 Draft 검증
 * 3. 원본 학생 변경 여부 검증
 * 4. 문서 반영 DB 트랜잭션
 * 5. Pending 성공 또는 실패 처리
 */
export async function executeDocumentImportPendingAction(
  input:
    ExecuteDocumentImportPendingActionInput
): Promise<
  ExecuteDocumentImportPendingActionResult
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

  const claim =
    await db.claimAiPendingActionForExecution({
      id:
        pendingActionId,

      organizationId,

      requestedByUserId,

      confirmedByUserId,

      expectedVersion,
    });

  /**
   * 이미 완료된 요청은
   * 기존 실행 결과를 반환한다.
   */
  if (
    claim.alreadyExecuted
  ) {
    const result =
      getExecutedResult(
        claim.action
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

      ...result,
    };
  }

  /**
   * 다른 요청이 실행 중인 경우
   */
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

      studentId:
        null,

      semesterId:
        null,

      planSubjectIds:
        [],

      transferSubjectIds:
        [],

      paymentUpdated:
        false,

      message:
        "문서 CRM 반영 작업이 이미 실행 중입니다.",
    };
  }

  const action =
    claim.action;

  const completedSteps:
    string[] = [];

  try {
    if (
      !DOCUMENT_IMPORT_ACTION_TYPES.has(
        action.actionType as
          AiPendingActionType
      )
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "문서 CRM 반영 승인 요청이 아닙니다.",
        400
      );
    }

    const studentId =
      normalizePositiveInteger(
        action.studentId,
        "문서 반영 대상 학생 정보가 올바르지 않습니다."
      );

    const draft =
      getDocumentDraftFromPayload(
        action.payloadJson
      );

    validateDocumentDraft(
      draft,
      action.actionType,
      studentId
    );

    completedSteps.push(
      "문서 반영 승인 초안 검증"
    );

    /**
     * 현재 학생과 조직을 다시 조회한다.
     */
    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId,
        }
      );

    if (!student) {
      throwAppError(
        ERROR_CODES.DATA_NOT_FOUND,
        "문서 반영 대상 학생을 찾을 수 없습니다.",
        404
      );
    }

    if (
      Number(
        student.assigneeId ||
        0
      ) !==
      requestedByUserId
    ) {
      throwAppError(
        ERROR_CODES.PERMISSION_DENIED,
        "본인 담당 학생의 문서만 CRM에 반영할 수 있습니다.",
        403
      );
    }

    /**
     * Preview 생성 후 학생 원본이 변경됐는지 검사한다.
     */
    const sourceSnapshot =
      action
        .sourceSnapshotJson &&
      typeof action
        .sourceSnapshotJson ===
        "object"
        ? action
            .sourceSnapshotJson as
            Record<
              string,
              any
            >
        : null;

    const sourceStudent =
      sourceSnapshot
        ?.student ||
      null;

    if (
      sourceStudent
        ?.updatedAt &&
      student.updatedAt
    ) {
      const previewUpdatedAt =
        new Date(
          sourceStudent.updatedAt
        ).getTime();

      const currentUpdatedAt =
        new Date(
          student.updatedAt
        ).getTime();

      if (
        Number.isFinite(
          previewUpdatedAt
        ) &&
        Number.isFinite(
          currentUpdatedAt
        ) &&
        previewUpdatedAt !==
          currentUpdatedAt
      ) {
        throwAppError(
          ERROR_CODES.INVALID_REQUEST,
          "미리보기 생성 후 학생 정보가 변경되었습니다. 최신 문서 반영 미리보기를 다시 생성해주세요.",
          409
        );
      }
    }

    if (
      sourceStudent
        ?.assigneeId !==
        null &&
      sourceStudent
        ?.assigneeId !==
        undefined &&
      Number(
        sourceStudent
          .assigneeId
      ) !==
      Number(
        student.assigneeId ||
        0
      )
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "미리보기 생성 후 학생 담당자가 변경되었습니다. 최신 문서 반영 미리보기를 다시 생성해주세요.",
        409
      );
    }

    completedSteps.push(
      "학생 원본 및 담당자 재검증"
    );

    const transactionResult =
      await db.executeDocumentImportTransaction({
        organizationId,

        studentId,

        draft,

        actorUserId:
          confirmedByUserId,

        actorName:
          input.actorName ??
          null,

        actorRole:
          input.actorRole ??
          null,
      });

    completedSteps.push(
      ...transactionResult
        .completedSteps
    );

    /**
     * 기존 Pending 성공 결과 구조를 재사용한다.
     *
     * semesterId는 semesterIds 배열에 넣는다.
     */
    const executedAction =
      await db.markAiPendingActionExecuted({
        id:
          pendingActionId,

        organizationId,

        requestedByUserId,

        expectedVersion,

        studentId:
          transactionResult
            .studentId,

        planId:
          null,

        semesterIds:
          transactionResult
            .semesterId
            ? [
                transactionResult
                  .semesterId,
              ]
            : [],

        planSubjectIds:
          transactionResult
            .planSubjectIds,

        transferSubjectIds:
          transactionResult
            .transferSubjectIds,

        practiceSaved:
          false,

paymentUpdated:
  transactionResult
    .paymentUpdated,

        completedSteps,

        failedSteps:
          [],

        message:
          "AI 문서 분석 결과의 CRM 반영이 완료되었습니다.",
      });

    /**
     * AI 실행 로그
     *
     * 로그 실패는 이미 완료된 DB 반영을
     * 실패 처리하지 않도록 별도로 보호한다.
     */
    try {
      await db.createAiActionLog({
        organizationId,

        userId:
          confirmedByUserId,

        userName:
          input.actorName ||
          `사용자 ${confirmedByUserId}`,

        action:
          String(
            action.actionType
          ),

        targetStudentId:
          transactionResult
            .studentId,

        targetStudentName:
          student.clientName ||
          null,

        payload: {
          pendingActionId,

          analysisId:
            draft.analysisId,

          documentType:
            draft.documentType,

          target:
            draft.target,

          actionType:
            draft.actionType,

          semesterId:
            transactionResult
              .semesterId,

          planSubjectIds:
            transactionResult
              .planSubjectIds,

          transferSubjectIds:
            transactionResult
              .transferSubjectIds,

          paymentUpdated:
            transactionResult
              .paymentUpdated,

          paymentAmount:
            draft.paymentAmount,

          paidAt:
            draft.paidAt,
        },
      });
    } catch {
      /**
       * 실행 로그 실패로
       * 실제 CRM 반영을 실패 처리하지 않는다.
       */
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

      studentId:
        transactionResult
          .studentId,

      semesterId:
        transactionResult
          .semesterId,

      planSubjectIds:
        transactionResult
          .planSubjectIds,

      transferSubjectIds:
        transactionResult
          .transferSubjectIds,

      paymentUpdated:
        transactionResult
          .paymentUpdated,

      message:
        "AI 문서 분석 결과의 CRM 반영이 완료되었습니다.",
    };
  } catch (
    error:
      any
  ) {
    const errorMessage =
      String(
        error?.message ||
        "AI 문서 분석 결과를 CRM에 반영하는 중 오류가 발생했습니다."
      );

    /**
     * 실행 선점 이후 오류가 발생하면
     * Pending Action을 failed로 변경한다.
     */
    try {
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
    } catch {
      /**
       * 원래 발생한 실행 오류를 유지한다.
       */
    }

    throw error;
  }
}