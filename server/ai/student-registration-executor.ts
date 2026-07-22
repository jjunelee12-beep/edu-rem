import * as db from "../db";

import type {
  StudentRegistrationDraft,
} from "./ai.types";

import {
  throwAppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

export type ExecuteStudentRegistrationPendingActionInput = {
  pendingActionId: number;

  organizationId: number;

  requestedByUserId: number;
  confirmedByUserId: number;

  expectedVersion: number;

  actorName?: string | null;
  actorRole?: string | null;
};

export type ExecuteStudentRegistrationPendingActionResult = {
  success: boolean;

  alreadyExecuted: boolean;
  executing: boolean;

  pendingAction: any;

   studentId: number | null;

  planId: number | null;

  semesterIds: number[];

  planSubjectIds: number[];

  transferSubjectIds: number[];

  practiceSaved: boolean;

  message: string;
};

function normalizePositiveInteger(
  value: unknown,
  message: string
) {
  const numberValue =
    Number(value || 0);

  if (
    !Number.isFinite(
      numberValue
    ) ||
    numberValue <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      message,
      400
    );
  }

  return Math.floor(
    numberValue
  );
}

function normalizePositiveIntegerArray(
  value: unknown
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
          (id) =>
            Number.isFinite(
              id
            ) &&
            id > 0
        )
        .map(
          (id) =>
            Math.floor(id)
        )
    )
  );
}

function normalizePendingDraft(
  value: unknown
): StudentRegistrationDraft {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 통합등록 초안 데이터가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    value as StudentRegistrationDraft;

  if (
    draft.canConfirm !== true ||
    (
      Array.isArray(
        draft.missingFields
      ) &&
      draft.missingFields.length > 0
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "필수 정보가 누락된 학생 통합등록 초안입니다.",
      409
    );
  }

  if (
    !Array.isArray(
      draft.semesters
    ) ||
    draft.semesters.length === 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "등록할 학기 정보가 없습니다.",
      400
    );
  }

  if (
    !Array.isArray(
      draft.planSubjects
    ) ||
    draft.planSubjects.length === 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "저장할 우리플랜 과목 정보가 없습니다.",
      400
    );
  }

  if (
    Array.isArray(
      draft.duplicateSubjects
    ) &&
    draft.duplicateSubjects.length > 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "중복 과목이 포함된 학생 과목설계 초안입니다.",
      409
    );
  }

  const hasUnconfirmedPlanSubject =
    draft.planSubjects.some(
      (subject) =>
        subject.isConfirmed ===
        false
    );

  const hasUnconfirmedTransferSubject =
    Array.isArray(
      draft.transferSubjects
    ) &&
    draft.transferSubjects.some(
      (subject) =>
        subject.isConfirmed ===
        false
    );

  if (
    hasUnconfirmedPlanSubject ||
    hasUnconfirmedTransferSubject
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "확인이 완료되지 않은 과목이 포함된 초안입니다.",
      409
    );
  }

  return draft;
}

/**
 * 등록예정 학생 생성 및 과목설계 Pending Action 실행
 *
 * 1. 실행 선점
 * 2. 과목설계 초안 검증
 * 3. 원본 상담 변경 여부 확인
 * 4. 등록예정 학생 및 과목설계 트랜잭션
 * 5. Pending Action 성공 또는 실패 처리
 */
export async function executeStudentRegistrationPendingAction(
  input: ExecuteStudentRegistrationPendingActionInput
): Promise<ExecuteStudentRegistrationPendingActionResult> {
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

  /**
   * 동일 pending action 중복 실행 선점
   */
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
   * 이미 실행 완료된 요청이면
   * 저장된 결과를 그대로 반환한다.
   */
   if (
    claim.alreadyExecuted
  ) {
    const result =
      claim.action
        ?.executionResultJson &&
      typeof claim.action
        .executionResultJson ===
        "object"
        ? claim.action
            .executionResultJson as any
        : null;

    const studentId =
      result?.studentId
        ? Number(
            result.studentId
          )
        : claim.action
            ?.studentId
          ? Number(
              claim.action
                .studentId
            )
          : null;

    const planId =
      result?.planId
        ? Number(
            result.planId
          )
        : null;

    return {
      success:
        true,

      alreadyExecuted:
        true,

      executing:
        false,

      pendingAction:
        claim.action,

      studentId:
        studentId &&
        Number.isFinite(
          studentId
        ) &&
        studentId > 0
          ? studentId
          : null,

      planId:
        planId &&
        Number.isFinite(
          planId
        ) &&
        planId > 0
          ? planId
          : null,

      semesterIds:
        normalizePositiveIntegerArray(
          result?.semesterIds
        ),

      planSubjectIds:
        normalizePositiveIntegerArray(
          result?.planSubjectIds
        ),

      transferSubjectIds:
        normalizePositiveIntegerArray(
          result?.transferSubjectIds
        ),

      practiceSaved:
        result?.practiceSaved ===
        true,

      message:
        result?.message ||
        "이미 등록예정 학생 생성 및 과목설계 저장이 완료된 요청입니다.",
    };
  }

  /**
   * 다른 요청에서 이미 실행 중
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

      message:
        "등록예정 학생 생성 및 과목설계 저장 작업이 이미 실행 중입니다.",
    };
  }

  const action =
    claim.action;

  const completedSteps:
    string[] = [];

  try {
    if (
      action.actionType !==
      "student_registration_create"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "등록예정 학생 생성 및 과목설계 승인 요청이 아닙니다.",
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

    const consultationId =
      normalizePositiveInteger(
        draft.consultationId,
        "상담DB 정보가 올바르지 않습니다."
      );

    if (
      Number(
        action.consultationId ||
        0
      ) !== consultationId
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "승인 초안의 상담DB 정보가 일치하지 않습니다.",
        409
      );
    }

    /**
     * Preview 이후 상담DB가 변경됐는지 검사
     */
    const consultation =
      await db.getConsultation(
        consultationId,
        {
          organizationId,
        }
      );

    if (!consultation) {
      throwAppError(
        ERROR_CODES.DATA_NOT_FOUND,
        "상담DB 정보를 찾을 수 없습니다.",
        404
      );
    }

    const sourceSnapshot =
      action.sourceSnapshotJson &&
      typeof action
        .sourceSnapshotJson ===
        "object"
        ? action
            .sourceSnapshotJson as any
        : null;

    const sourceConsultation =
      sourceSnapshot
        ?.consultation ||
      null;

    if (
      sourceConsultation
        ?.updatedAt &&
      consultation.updatedAt
    ) {
      const originalUpdatedAt =
        new Date(
          sourceConsultation
            .updatedAt
        ).getTime();

      const currentUpdatedAt =
        new Date(
          consultation
            .updatedAt
        ).getTime();

      if (
        Number.isFinite(
          originalUpdatedAt
        ) &&
        Number.isFinite(
          currentUpdatedAt
        ) &&
        originalUpdatedAt !==
          currentUpdatedAt
      ) {
        throwAppError(
          ERROR_CODES.INVALID_REQUEST,
          "미리보기 생성 후 상담DB 내용이 변경되었습니다. 최신 내용으로 다시 미리보기를 생성해주세요.",
          409
        );
      }
    }

    completedSteps.push(
      "상담DB 원본 재검증"
    );

    const existingStudent =
      await db.getStudentByConsultationId(
        consultationId,
        {
          organizationId,
        }
      );

    if (existingStudent) {
      throwAppError(
        ERROR_CODES.DUPLICATE_RESOURCE,
        "이미 등록예정 학생으로 전환되었거나 기존 학생과 연결된 상담DB입니다.",
        409
      );
    }

    /**
     * 실제 학생 통합등록
     */
    const transactionResult =
      await db.executeStudentRegistrationTransaction({
        organizationId,

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
     * Pending Action 성공 처리
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
          transactionResult
            .planId,

        semesterIds:
          transactionResult
            .semesterIds,

        planSubjectIds:
          transactionResult
            .planSubjectIds,

        transferSubjectIds:
          transactionResult
            .transferSubjectIds,

        practiceSaved:
          transactionResult
            .practiceSaved,

        completedSteps,

        failedSteps:
          [],

                message:
          "등록예정 학생 생성 및 과목설계 저장이 완료되었습니다.",
      });

    /**
     * AI 실행 이력
     *
     * 로그 저장 실패는 실제 등록 결과에 영향을 주지 않는다.
     */
    await db.createAiActionLog({
      organizationId,

      userId:
        confirmedByUserId,

      userName:
        input.actorName ||
        `사용자 ${confirmedByUserId}`,

      action:
        "student_registration_create",

      targetStudentId:
        transactionResult
          .studentId,

      targetStudentName:
        draft.student
          ?.clientName ||
        null,

            payload: {
        pendingActionId,

        consultationId,

        registrationMode:
          "planning",

        consultationStatus:
          "등록예정",

        studentStatus:
          "등록",

        studentApprovalStatus:
          "대기",

        semesterApprovalStatus:
          "요청전",

        planId:
          transactionResult
            .planId,

        semesterIds:
          transactionResult
            .semesterIds,

        planSubjectIds:
          transactionResult
            .planSubjectIds,

        transferSubjectIds:
          transactionResult
            .transferSubjectIds,

        practiceSaved:
          transactionResult
            .practiceSaved,
      },
    });

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

      planId:
        transactionResult
          .planId,

      semesterIds:
        transactionResult
          .semesterIds,

      planSubjectIds:
        transactionResult
          .planSubjectIds,

      transferSubjectIds:
        transactionResult
          .transferSubjectIds,

      practiceSaved:
        transactionResult
          .practiceSaved,

      message:
        "등록예정 학생 생성 및 과목설계 저장이 완료되었습니다.",
    };
  } catch (
    error: any
  ) {
    const errorMessage =
      String(
        error?.message ||
             "등록예정 학생 생성 및 과목설계 저장 중 오류가 발생했습니다."
      );

    /**
     * 트랜잭션 실패 후 Pending Action을 failed로 변경한다.
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