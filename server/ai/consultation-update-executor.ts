import * as db from "../db";

import {
  assertCanAccessConsultation,
  assertCanWriteConsultation,
} from "./ai-permission";

import type {
  AiUserContext,
} from "./ai.types";

type ConsultationUpdateDraft = {
  consultationId:
    number;

  clientName:
    string |
    null;

  originalValues: {
    status:
      string |
      null;

    notes:
      string |
      null;
  };

  updates: {
    status?:
      string |
      null;

    notes?:
      string |
      null;
  };

  requestedByUserId:
    number;

  requestedByRole:
    string;

  createdAt:
    string;
};

function normalizePositiveInteger(
  value:
    unknown
): number {
  const normalized =
    Number(
      value
    );

  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized <= 0
  ) {
    return 0;
  }

  return Math.floor(
    normalized
  );
}

function parseJsonRecord(
  value:
    unknown
): Record<
  string,
  any
> {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  ) {
    return value as Record<
      string,
      any
    >;
  }

  if (
    typeof value !==
      "string"
  ) {
    return {};
  }

  try {
    const parsed =
      JSON.parse(
        value
      );

    if (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(
        parsed
      )
    ) {
      return parsed as Record<
        string,
        any
      >;
    }
  } catch {
    return {};
  }

  return {};
}

function normalizeNullableText(
  value:
    unknown,

  maxLength:
    number
): string | null {
  if (
    value ===
    null
  ) {
    return null;
  }

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

function isSameValue(
  first:
    unknown,

  second:
    unknown,

  maxLength:
    number
) {
  return (
    normalizeNullableText(
      first,
      maxLength
    ) ===
    normalizeNullableText(
      second,
      maxLength
    )
  );
}

/**
 * 상담DB 수정 Pending Action 실행
 *
 * 처리 순서
 * 1. Pending Action 실행 선점
 * 2. 초안 및 대상 상담 검증
 * 3. 권한 재검사
 * 4. 초안 생성 당시 값과 현재 값 비교
 * 5. 상담DB 수정
 * 6. Pending Action 실행 완료 처리
 */
export async function executeConsultationUpdatePendingAction(
  params: {
    pendingActionId:
      number;

    expectedVersion:
      number;

    /**
     * Router에서 buildAiContext()로 만든
     * 서버 권한 Context만 사용한다.
     */
    context:
      AiUserContext;
  }
) {
  const pendingActionId =
    normalizePositiveInteger(
      params.pendingActionId
    );

  const expectedVersion =
    normalizePositiveInteger(
      params.expectedVersion
    );

  const context =
    params.context;

  const organizationId =
    normalizePositiveInteger(
      context.organizationId
    );

  const requestedByUserId =
    normalizePositiveInteger(
      context.userId
    );

  const confirmedByUserId =
    normalizePositiveInteger(
      context.userId
    );

  if (
    !pendingActionId ||
    !expectedVersion ||
    !organizationId ||
    !requestedByUserId ||
    !confirmedByUserId
  ) {
    throw new Error(
      "상담 수정 승인 실행 정보가 올바르지 않습니다."
    );
  }

  /**
   * 중복 클릭과 중복 요청을 막기 위해
   * awaiting_confirmation → executing 상태를 선점한다.
   */
  const claimed =
    await db.claimAiPendingActionForExecution({
      id:
        pendingActionId,

      organizationId,

      requestedByUserId,

      confirmedByUserId,

      expectedVersion,
    });

  if (!claimed) {
    throw new Error(
      "상담 수정 승인 초안을 실행할 수 없습니다."
    );
  }

  const pendingAction =
    claimed.action;

  if (!pendingAction) {
    throw new Error(
      "상담 수정 승인 초안을 찾을 수 없습니다."
    );
  }

  /**
   * 이미 실행된 요청은 재수정하지 않고
   * 기존 결과를 그대로 반환한다.
   */
  if (
    claimed.alreadyExecuted ===
    true
  ) {
    const executionResult =
      parseJsonRecord(
        pendingAction
          .executionResultJson
      );

    return {
      success:
        true,

      alreadyExecuted:
        true,

      executing:
        false,

      consultationId:
        normalizePositiveInteger(
          executionResult
            .consultationId ??
          pendingAction
            .consultationId
        ) ||
        null,

      pendingAction,

      message:
        String(
          executionResult
            .message ||
          "이미 상담DB 수정이 완료된 요청입니다."
        ),
    };
  }

  /**
   * 다른 요청이 이미 실행 중이면
   * 다시 수정하지 않는다.
   */
  if (
    claimed.claimed !==
    true
  ) {
    return {
      success:
        true,

      alreadyExecuted:
        false,

      executing:
        true,

      consultationId:
        normalizePositiveInteger(
          pendingAction
            .consultationId
        ) ||
        null,

      pendingAction,

      message:
        "상담DB 정보를 수정하고 있습니다.",
    };
  }

  const completedSteps:
    string[] = [];

  let consultationId:
    number |
    null = null;

  try {
    if (
      String(
        pendingAction
          .actionType ||
        ""
      ) !==
      "consultation_update"
    ) {
      throw new Error(
        "상담DB 수정 승인 초안이 아닙니다."
      );
    }

    completedSteps.push(
      "승인 작업 유형 확인"
    );

    const payload =
      parseJsonRecord(
        pendingAction
          .payloadJson
      );

    const draftSource =
      parseJsonRecord(
        payload.draft ??
        payload
      );

    const draft =
      draftSource as
        Partial<
          ConsultationUpdateDraft
        >;

    consultationId =
      normalizePositiveInteger(
        draft.consultationId ??
        pendingAction
          .consultationId
      ) ||
      null;

    if (!consultationId) {
      throw new Error(
        "수정할 상담DB 정보가 없습니다."
      );
    }

    if (
      normalizePositiveInteger(
        pendingAction
          .consultationId
      ) !==
      consultationId
    ) {
      throw new Error(
        "승인 초안의 상담DB 정보가 일치하지 않습니다."
      );
    }

    const updates =
      draft.updates &&
      typeof draft.updates ===
        "object" &&
      !Array.isArray(
        draft.updates
      )
        ? draft.updates
        : {};

    const hasStatusUpdate =
      Object.prototype
        .hasOwnProperty
        .call(
          updates,
          "status"
        );

    const hasNotesUpdate =
      Object.prototype
        .hasOwnProperty
        .call(
          updates,
          "notes"
        );

    if (
      !hasStatusUpdate &&
      !hasNotesUpdate
    ) {
      throw new Error(
        "변경할 상담정보가 없습니다."
      );
    }

    /**
     * 허용된 필드 외의 값이 들어오면 차단한다.
     */
    const updateKeys =
      Object.keys(
        updates
      );

    const forbiddenKeys =
      updateKeys.filter(
        (
          key
        ) =>
          key !==
            "status" &&
          key !==
            "notes"
      );

    if (
      forbiddenKeys.length >
      0
    ) {
      throw new Error(
        "허용되지 않은 상담정보 수정 항목이 포함되어 있습니다."
      );
    }

    completedSteps.push(
      "상담 수정 초안 검증"
    );

    /**
     * 조직 범위를 포함하여 현재 상담을 다시 조회한다.
     */
    const consultation =
      await db.getConsultation(
        consultationId,
        {
          organizationId,
        }
      );

    if (!consultation) {
      throw new Error(
        "수정할 상담DB 정보를 찾을 수 없습니다."
      );
    }

   /**
 * 현재 사용자가 해당 상담을
 * 조회할 수 있는 범위인지 먼저 검사한다.
 *
 * Staff:
 * 본인 담당 상담
 *
 * Admin:
 * 같은 팀 상담
 *
 * Host:
 * 회사 전체 상담
 *
 * Superhost:
 * 선택한 회사 상담
 */
assertCanAccessConsultation({
  context,
  consultation,
});

completedSteps.push(
  "상담 조회권한 확인"
);

/**
 * 조회 가능 여부와 수정 가능 여부는 다르다.
 *
 * Admin은 팀 상담을 조회할 수 있고,
 * Host는 회사 전체 상담을 조회할 수 있지만,
 * 실제 수정은 현재 사용자 본인 담당 상담만 허용한다.
 *
 * Superhost는 직접 수정할 수 없다.
 */
assertCanWriteConsultation({
  context,
  consultation,
});

completedSteps.push(
  "상담 담당자 수정권한 확인"
);

    const originalValues =
      draft.originalValues &&
      typeof draft.originalValues ===
        "object" &&
      !Array.isArray(
        draft.originalValues
      )
        ? draft.originalValues
        : null;

    if (!originalValues) {
      throw new Error(
        "상담 수정 전 원본 정보가 없습니다."
      );
    }

    /**
     * 초안 생성 이후 다른 직원이 값을 변경했는지 검사한다.
     *
     * 변경 대상 필드만 비교한다.
     */
    if (
      hasStatusUpdate &&
      !isSameValue(
        (consultation as any)
          .status,
        originalValues.status,
        100
      )
    ) {
      throw new Error(
        "상담 상태가 초안 생성 이후 변경되었습니다. 최신 정보를 다시 확인해주세요."
      );
    }

    if (
      hasNotesUpdate &&
      !isSameValue(
        (consultation as any)
          .notes,
        originalValues.notes,
        5000
      )
    ) {
      throw new Error(
        "상담내용이 초안 생성 이후 변경되었습니다. 최신 정보를 다시 확인해주세요."
      );
    }

    completedSteps.push(
      "상담 원본 변경 여부 확인"
    );

/**
 * 감사로그에 기록할 변경 전 데이터
 *
 * 실제 수정 대상 필드만 포함한다.
 */
const beforeAuditData:
  Record<
    string,
    string |
    null
  > = {};

if (
  hasStatusUpdate
) {
  beforeAuditData.status =
    normalizeNullableText(
      (consultation as any)
        .status,
      100
    );
}

if (
  hasNotesUpdate
) {
  beforeAuditData.notes =
    normalizeNullableText(
      (consultation as any)
        .notes,
      5000
    );
}

/**
 * 실제 consultations 테이블에 적용할 데이터
 */
const updateData:
  Record<
    string,
    unknown
  > = {};

if (
  hasStatusUpdate
) {
  updateData.status =
    normalizeNullableText(
      updates.status,
      100
    );
}

if (
  hasNotesUpdate
) {
  updateData.notes =
    normalizeNullableText(
      updates.notes,
      5000
    );
}

/**
 * 감사로그에 기록할 변경 후 데이터
 *
 * updateData를 모두 만든 후 생성해야 한다.
 */
const afterAuditData:
  Record<
    string,
    string |
    null
  > = {};

if (
  hasStatusUpdate
) {
  afterAuditData.status =
    updateData.status as
      string |
      null;
}

if (
  hasNotesUpdate
) {
  afterAuditData.notes =
    updateData.notes as
      string |
      null;
}

    /**
     * 현재값과 최종 변경값이 동일해졌다면
     * 불필요한 UPDATE를 막는다.
     */
    const statusChanged =
      hasStatusUpdate &&
      !isSameValue(
        (consultation as any)
          .status,
        updateData.status,
        100
      );

    const notesChanged =
      hasNotesUpdate &&
      !isSameValue(
        (consultation as any)
          .notes,
        updateData.notes,
        5000
      );

    if (
      !statusChanged &&
      !notesChanged
    ) {
      throw new Error(
        "현재 상담정보와 변경할 값이 동일합니다."
      );
    }

    await db.updateConsultation(
      consultationId,
      updateData as any,
      {
        organizationId,
      }
    );

    completedSteps.push(
      "상담DB 정보 수정"
    );

    /**
     * 실제 반영 여부를 다시 조회한다.
     */
    const updatedConsultation =
      await db.getConsultation(
        consultationId,
        {
          organizationId,
        }
      );

    if (!updatedConsultation) {
      throw new Error(
        "상담DB 수정 후 결과를 확인하지 못했습니다."
      );
    }

    if (
      hasStatusUpdate &&
      !isSameValue(
        (updatedConsultation as any)
          .status,
        updateData.status,
        100
      )
    ) {
      throw new Error(
        "상담 상태 수정 결과가 요청값과 일치하지 않습니다."
      );
    }

    if (
      hasNotesUpdate &&
      !isSameValue(
        (updatedConsultation as any)
          .notes,
        updateData.notes,
        5000
      )
    ) {
      throw new Error(
        "상담내용 수정 결과가 요청값과 일치하지 않습니다."
      );
    }

    completedSteps.push(
      "상담 수정 결과 확인"
    );

/**
 * AI 상담DB 수정 감사로그
 *
 * 상담 수정은 이미 완료된 상태이므로
 * 감사로그 저장 실패 때문에 전체 작업을
 * failed로 변경하지 않는다.
 */
try {
  await db.createAuditLog({
    organizationId,

    actorUserId:
      context.userId,

    actorRole:
      context.role,

    action:
      "ai.consultation.update",

    targetType:
      "consultation",

    targetId:
      consultationId,

    beforeJson:
      beforeAuditData,

    afterJson:
      afterAuditData,

    memo:
      `AI 상담DB 수정 승인 실행 · Pending Action #${pendingActionId}`,
  } as any);

  completedSteps.push(
    "상담 수정 감사로그 기록"
  );
} catch (
  auditError
) {
  completedSteps.push(
    "상담 수정 완료 · 감사로그 기록 실패"
  );

  console.error(
    "[AI consultation.update audit failed]",
    {
      pendingActionId,

      consultationId,

      organizationId,

      error:
        auditError instanceof
          Error
          ? auditError.message
          : String(
              auditError
            ),
    }
  );
}

    const completed =
      await db.markAiPendingActionExecuted({
        id:
          pendingActionId,

        organizationId,

        requestedByUserId,

        expectedVersion,

        consultationId,

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
          "상담DB 정보가 수정되었습니다.",
      });

    return {
      success:
        true,

      alreadyExecuted:
        false,

      executing:
        false,

      consultationId,

      pendingAction:
        completed ||
        pendingAction,

      message:
        "상담DB 정보가 수정되었습니다.",
    };
  } catch (
    error
  ) {
    const message =
      error instanceof
        Error
        ? error.message
        : "상담DB 정보 수정에 실패했습니다.";

    await db.markAiPendingActionFailed({
      id:
        pendingActionId,

      organizationId,

      requestedByUserId,

      expectedVersion,

      errorMessage:
        message,

      completedSteps,

      failedSteps: [
        message,
      ],
    });

    throw error;
  }
}