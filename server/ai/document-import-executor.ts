import * as db from "../db";

import type {
  AiDocumentImportDraft,
  AiPendingActionType,
  AiUserContext,
} from "./ai.types";

import {
  throwAppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

import {
  assertCanWriteStudent,
} from "./ai-permission";

export type ExecuteDocumentImportPendingActionInput = {
  /**
   * 실행할 Pending Action ID
   */
  pendingActionId:
    number;

  /**
   * Pending Action을 처음 생성한 사용자 ID
   *
   * OCR 분석자와 실제 적용자는 다를 수 있으므로
   * 이 값은 Pending Action 선점 확인에만 사용한다.
   */
  requestedByUserId:
    number;

  /**
   * 현재 로그인 사용자의 서버 AI Context
   *
   * organizationId, 승인 사용자 ID, 역할과
   * 실제 적용 권한은 이 Context를 기준으로 판단한다.
   */
  context:
    AiUserContext;

  /**
   * Pending Action 낙관적 잠금 버전
   */
  expectedVersion:
    number;

  /**
   * 실행 로그에 사용할 이름
   *
   * 전달되지 않으면 context.userName을 사용한다.
   */
  actorName?:
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

  /**
   * 회사 범위는 요청 파라미터가 아니라
   * 서버에서 생성한 AI Context를 사용한다.
   */
  const organizationId =
    normalizePositiveInteger(
      input.context.organizationId,
      "현재 로그인 사용자의 회사 정보를 확인할 수 없습니다."
    );

  /**
   * Pending Action 최초 생성 사용자
   *
   * OCR 분석자와 실제 적용자가 다를 수 있으므로
   * 이 값은 학생 담당자 검사에 사용하지 않는다.
   */
  const requestedByUserId =
    normalizePositiveInteger(
      input.requestedByUserId,
      "AI 초안 요청 사용자 정보가 올바르지 않습니다."
    );

  /**
   * 실제 CRM 적용을 승인한 사용자는
   * 현재 서버 AI Context의 사용자이다.
   */
  const confirmedByUserId =
    normalizePositiveInteger(
      input.context.userId,
      "현재 AI 승인 사용자 정보를 확인할 수 없습니다."
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

    /**
     * OCR 결과의 실제 CRM 반영 권한을
     * 실행 직전에 다시 검사한다.
     *
     * 조회 범위:
     * Staff → 본인 담당 학생
     * Admin → 같은 팀 학생
     * Host → 같은 회사 전체 학생
     *
     * 실제 적용:
     * 역할과 무관하게 현재 로그인 사용자가
     * 해당 학생의 실제 담당자인 경우만 가능
     */
    assertCanWriteStudent({
      context:
        input.context,

      student,
    });

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
      "학생 원본·조회 범위·실제 담당자 권한 재검증"
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
          input.context.userName ??
          null,

        actorRole:
          input.context.role,
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
          input.context.userName ||
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