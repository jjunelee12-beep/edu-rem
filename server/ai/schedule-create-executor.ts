import * as db from "../db";

import {
  assertCanAccessStudent,
  assertCanWriteStudent,
} from "./ai-permission";

import type {
  AiUserContext,
  ScheduleCreateDraft,
} from "./ai.types";

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
      return parsed;
    }
  } catch {
    return {};
  }

  return {};
}

export async function executeScheduleCreatePendingAction(
  params: {
    pendingActionId:
      number;

    expectedVersion:
      number;

    /**
     * Router에서 buildAiContext()로 생성한
     * 실제 서버 권한 Context다.
     *
     * 프론트에서 전달받은 값이 아니다.
     */
    context:
      AiUserContext;
  }
) {
  const pendingActionId =
    normalizePositiveInteger(
      params.pendingActionId
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

  const expectedVersion =
    normalizePositiveInteger(
      params.expectedVersion
    );

  if (
    !pendingActionId ||
    !organizationId ||
    !requestedByUserId ||
    !confirmedByUserId ||
    !expectedVersion
  ) {
    throw new Error(
      "일정 승인 실행 정보가 올바르지 않습니다."
    );
  }

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
      "일정 승인 초안을 실행할 수 없습니다."
    );
  }

  /**
   * 실제 db.ts 반환 필드는 action이다.
   */
  const pendingAction =
    claimed.action;

  if (!pendingAction) {
    throw new Error(
      "일정 승인 초안을 찾을 수 없습니다."
    );
  }

  /**
   * 이미 실행된 작업
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

      scheduleId:
        normalizePositiveInteger(
          executionResult
            .scheduleId
        ) ||
        null,

      studentId:
        normalizePositiveInteger(
          pendingAction
            .studentId
        ) ||
        null,

      pendingAction,

      message:
        String(
          executionResult
            .message ||
          "이미 등록된 일정입니다."
        ),
    };
  }

  /**
   * claimed가 false면서 실행 완료가 아니면
   * 다른 요청이 이미 실행 중인 상태다.
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

      scheduleId:
        null,

      studentId:
        normalizePositiveInteger(
          pendingAction
            .studentId
        ) ||
        null,

      pendingAction,

      message:
        "일정을 등록하고 있습니다.",
    };
  }

   const completedSteps:
    string[] = [];

  try {
    if (
      String(
        pendingAction
          .actionType ||
        ""
      ) !==
      "schedule_create"
    ) {
      throw new Error(
        "일정 등록 승인 초안이 아닙니다."
      );
    }

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
        ScheduleCreateDraft
      >;

  const studentId =
    normalizePositiveInteger(
      draft.studentId ??
      pendingAction
        .studentId
    );

  if (!studentId) {
    throw new Error(
      "일정을 연결할 학생 정보가 없습니다."
    );
  }

  const student =
    await db.getStudentById(
      studentId,
      {
        organizationId,
      }
    );

  if (!student) {
    throw new Error(
      "일정을 연결할 학생을 찾을 수 없습니다."
    );
  }

  /**
 * 학생 조회 범위를 검사한다.
 */
assertCanAccessStudent({
  context,
  student,
});

completedSteps.push(
  "학생 조회권한 확인"
);

/**
 * 학생에게 연결되는 일정 등록은
 * 해당 학생의 현재 담당자만 실행할 수 있다.
 *
 * Admin과 Host는 넓은 범위를 조회할 수 있지만,
 * 본인이 담당하지 않는 학생 일정은 등록할 수 없다.
 *
 * Superhost는 AI 쓰기 작업을 실행할 수 없다.
 */
assertCanWriteStudent({
  context,
  student,
});

completedSteps.push(
  "학생 담당자 일정등록 권한 확인"
);

  const title =
    String(
      draft.title ||
      ""
    ).trim();

  const description =
    String(
      draft.description ||
      ""
    ).trim() ||
    null;

  const scheduleDate =
    String(
      draft.scheduleDate ||
      ""
    ).trim();

  const startAt =
    String(
      draft.startAt ||
      ""
    ).trim();

  const meridiem =
    draft.meridiem ===
      "PM"
      ? "PM"
      : draft.meridiem ===
          "AM"
        ? "AM"
        : null;

  const hour12 =
    normalizePositiveInteger(
      draft.hour12
    );

  const minute =
    Number(
      draft.minute
    );

  if (
    !title ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      scheduleDate
    ) ||
    !startAt ||
    !meridiem ||
    hour12 < 1 ||
    hour12 > 12 ||
    !Number.isFinite(
      minute
    ) ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(
      "일정 등록 초안의 날짜 또는 시간 정보가 올바르지 않습니다."
    );
  }

  const isGlobal =
    draft.scope ===
      "global";

   /**
 * 회사 전체 일정은 Host만 등록할 수 있다.
 *
 * Superhost는 회사 데이터를 조회하고 점검할 수 있지만
 * 실제 CRM 쓰기 작업은 실행하지 않는다.
 */
if (
  isGlobal &&
  context.role !==
    "host"
) {
  throw new Error(
    "회사 전체 일정은 Host만 등록할 수 있습니다."
  );
}

      const scheduleId =
      await db.createSchedule({
        organizationId,

        studentId,

        title,

        description,

        scheduleDate,

        meridiem,

        hour12,

        minute:
          Math.floor(
            minute
          ),

        startAt,

        scope:
          isGlobal
            ? "global"
            : "personal",

        ownerUserId:
          confirmedByUserId,

               ownerUserName:
          context.userName,

        createdByRole:
          context.role,
      });

    const normalizedScheduleId =
      normalizePositiveInteger(
        scheduleId
      );

    if (!normalizedScheduleId) {
      throw new Error(
        "일정 등록 후 일정 ID를 확인하지 못했습니다."
      );
    }

    completedSteps.push(
  "일정 날짜 및 시간 검증",
  "학생 일정 등록"
);

    /**
     * claim 함수는 상태만 executing으로 바꾸고
     * version은 증가시키지 않는다.
     *
     * 따라서 expectedVersion + 1이 아니라
     * 기존 expectedVersion을 그대로 전달한다.
     */
    const completed =
      await db.markAiPendingActionExecuted({
        id:
          pendingActionId,

        organizationId,

        requestedByUserId,

        expectedVersion,

        studentId,

        scheduleId:
          normalizedScheduleId,

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
          "학생 일정이 등록되었습니다.",
      });

    return {
      success:
        true,

      alreadyExecuted:
        false,

      executing:
        false,

      scheduleId:
        normalizedScheduleId,

      studentId,

      pendingAction:
        completed,

      message:
        "학생 일정이 등록되었습니다.",
    };
  } catch (
    error
  ) {
    const message =
      error instanceof
        Error
        ? error.message
        : "학생 일정 등록에 실패했습니다.";

   try {
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
} catch {
  /**
   * 실패 상태 저장 오류가 발생해도
   * 실제 일정 실행 오류를 유지한다.
   */
}

throw error;
  }
}