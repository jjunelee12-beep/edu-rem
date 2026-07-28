import * as db from "../db";

import {
  assertCanAccessStudent,
  assertCanWriteStudent,
} from "./ai-permission";

import type {
  AiUserContext,
  StudentUpdateDraft,
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

function normalizeStudentStatus(
  value:
    unknown
): "등록" |
  "종료" |
  "등록 종료" {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  if (
    normalized ===
      "등록" ||
    normalized ===
      "종료" ||
    normalized ===
      "등록 종료"
  ) {
    return normalized;
  }

  throw new Error(
    "학생 상태는 등록, 종료, 등록 종료 중 하나여야 합니다."
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

function hasOwnProperty(
  value:
    Record<
      string,
      any
    >,

  key:
    string
): boolean {
  return Object.prototype
    .hasOwnProperty
    .call(
      value,
      key
    );
}

function isSameValue(
  before:
    string |
    null,

  after:
    string |
    null
): boolean {
  return before ===
    after;
}

export async function executeStudentUpdatePendingAction(
  params: {
    pendingActionId:
      number;

    expectedVersion:
      number;

    /**
     * Router에서 buildAiContext()로 생성한
     * 실제 서버 Context다.
     *
     * organizationId, userId, role을
     * 프론트 입력값으로 받지 않는다.
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
      "학생 수정 승인 실행 정보가 올바르지 않습니다."
    );
  }

  /**
   * 승인 초안을 원자적으로 실행 상태로 전환한다.
   *
   * 중복 클릭과 동시 실행을 방지한다.
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
      "학생 수정 승인 초안을 실행할 수 없습니다."
    );
  }

  const pendingAction =
    claimed.action;

  if (!pendingAction) {
    throw new Error(
      "학생 수정 승인 초안을 찾을 수 없습니다."
    );
  }

  /**
   * 이미 정상 실행된 초안이면
   * DB를 다시 수정하지 않고 기존 결과를 반환한다.
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

      studentId:
        normalizePositiveInteger(
          executionResult
            .studentId ??
          pendingAction
            .studentId
        ) ||
        null,

      pendingAction,

      message:
        String(
          executionResult
            .message ||
          "이미 수정된 학생 정보입니다."
        ),
    };
  }

  /**
   * 다른 요청에서 현재 실행 중이면
   * 중복 실행하지 않는다.
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

      studentId:
        normalizePositiveInteger(
          pendingAction
            .studentId
        ) ||
        null,

      pendingAction,

      message:
        "학생 정보를 수정하고 있습니다.",
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
      "student_update"
    ) {
      throw new Error(
        "학생 수정 승인 초안이 아닙니다."
      );
    }

    completedSteps.push(
      "승인 작업 종류 확인"
    );

    const payload =
      parseJsonRecord(
        pendingAction
          .payloadJson
      );

    /**
     * Pending Action 생성 방식에 따라
     * payloadJson이 다음 두 구조 중 하나일 수 있다.
     *
     * {
     *   draft: { ... }
     * }
     *
     * 또는
     *
     * {
     *   studentId: ...,
     *   updates: ...
     * }
     */
    const draftSource =
      parseJsonRecord(
        payload.draft ??
        payload
      );

    const draft =
      draftSource as
        Partial<
          StudentUpdateDraft
        >;

    const studentId =
      normalizePositiveInteger(
        draft.studentId ??
        pendingAction
          .studentId
      );

    if (!studentId) {
      throw new Error(
        "수정할 학생 정보가 없습니다."
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
        "수정할 학생을 찾을 수 없습니다."
      );
    }

    /**
     * 조직과 조회 범위를 재검사한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    completedSteps.push(
      "학생 조회권한 확인"
    );

    /**
     * 초안 생성 후 담당자가 변경됐을 수도 있으므로
     * 실행 시점의 현재 담당자를 기준으로 재검사한다.
     */
    assertCanWriteStudent({
      context,
      student,
    });

    completedSteps.push(
      "학생 담당자 수정권한 확인"
    );

    const originalValues =
      parseJsonRecord(
        draft.originalValues
      );

    const updates =
      parseJsonRecord(
        draft.updates
      );

    const allowedUpdateFields = [
      "status",
      "course",
      "address",
      "detailAddress",
] as const;

    const requestedFields =
      allowedUpdateFields.filter(
        (
          field
        ) =>
          hasOwnProperty(
            updates,
            field
          )
      );

    if (
      requestedFields.length ===
      0
    ) {
      throw new Error(
        "학생 수정 초안에 변경 항목이 없습니다."
      );
    }

    /**
     * 허용되지 않은 필드가 들어와도
     * 아래 updateData에는 포함되지 않는다.
     *
     * organizationId, assigneeId,
     * approvalStatus, 결제정보 등은 수정 불가다.
     */
    const currentValues = {
      status:
  normalizeStudentStatus(
    (student as any)
      .status
  ),

      course:
        normalizeNullableText(
          (student as any)
            .course,
          255
        ),

      address:
        normalizeNullableText(
          (student as any)
            .address,
          500
        ),

      detailAddress:
        normalizeNullableText(
          (student as any)
            .detailAddress,
          500
        ),
    };

    const normalizedOriginalValues = {
      status:
  normalizeStudentStatus(
    originalValues.status
  ),

      course:
        normalizeNullableText(
          originalValues
            .course,
          255
        ),

      address:
        normalizeNullableText(
          originalValues
            .address,
          500
        ),

      detailAddress:
        normalizeNullableText(
          originalValues
            .detailAddress,
          500
        ),
    };

    /**
     * 낙관적 잠금 검사
     *
     * 초안 생성 이후 다른 사용자가 수정했다면
     * 오래된 초안으로 덮어쓰지 않는다.
     *
     * 이번 초안에서 수정하려는 필드만 비교한다.
     */
    for (
      const field of
      requestedFields
    ) {
      if (
        !isSameValue(
          currentValues[
            field
          ],

          normalizedOriginalValues[
            field
          ]
        )
      ) {
        throw new Error(
          `${
            field ===
            "status"
              ? "학생 상태"
              : field ===
                  "course"
                ? "진행 과정"
                  : field ===
                      "address"
                    ? "주소"
                    : "상세주소"
          }가 초안 생성 후 변경되었습니다. 최신 정보를 다시 확인해주세요.`
        );
      }
    }

    completedSteps.push(
      "학생정보 변경 충돌 검사"
    );

    const updateData:
      Record<
        string,
        string |
        null
      > = {};

    if (
  hasOwnProperty(
    updates,
    "status"
  )
) {
  updateData.status =
    normalizeStudentStatus(
      updates.status
    );
}

    if (
      hasOwnProperty(
        updates,
        "course"
      )
    ) {
      updateData.course =
        normalizeNullableText(
          updates.course,
          255
        );
    }

    if (
      hasOwnProperty(
        updates,
        "address"
      )
    ) {
      updateData.address =
        normalizeNullableText(
          updates.address,
          500
        );
    }

    if (
      hasOwnProperty(
        updates,
        "detailAddress"
      )
    ) {
      updateData.detailAddress =
        normalizeNullableText(
          updates.detailAddress,
          500
        );
    }

    /**
     * 이미 현재 값과 같아진 항목은 제외한다.
     *
     * 충돌검사를 통과한 뒤에도
     * 실제 변경값이 하나도 없으면 실행하지 않는다.
     */
    const effectiveUpdates:
      Record<
        string,
        string |
        null
      > = {};

    for (
      const field of
      requestedFields
    ) {
      const nextValue =
        updateData[
          field
        ];

      if (
        currentValues[
          field
        ] !==
        nextValue
      ) {
        effectiveUpdates[
          field
        ] =
          nextValue;
      }
    }

    if (
      Object.keys(
        effectiveUpdates
      ).length ===
      0
    ) {
      throw new Error(
        "현재 학생 정보와 승인된 변경값이 동일합니다."
      );
    }

    /**
 * 주소 또는 상세주소가 실제 변경되는지 확인한다.
 *
 * 주소가 바뀌면 기존 latitude, longitude,
 * geocodedAt은 이전 주소 기준이므로 초기화해야 한다.
 */
const addressUpdated =
  hasOwnProperty(
    effectiveUpdates,
    "address"
  );

const detailAddressUpdated =
  hasOwnProperty(
    effectiveUpdates,
    "detailAddress"
  );

const addressFieldsChanged =
  addressUpdated ||
  detailAddressUpdated;

/**
 * 주소를 제외한 일반 학생정보만 분리한다.
 */
const basicUpdates:
  Record<
    string,
    string |
    null
  > = {
    ...effectiveUpdates,
  };

delete basicUpdates
  .address;

delete basicUpdates
  .detailAddress;

/**
 * 상태 또는 과정 수정
 */
if (
  Object.keys(
    basicUpdates
  ).length >
  0
) {
  await db.updateStudent(
    studentId,
    basicUpdates,
    {
      organizationId,
    }
  );

  completedSteps.push(
    "학생 기본정보 수정"
  );
}

/**
 * 주소 또는 상세주소가 바뀐 경우
 * 기존 좌표를 초기화한다.
 *
 * 변경하지 않은 주소 항목은 현재 값을 유지한다.
 */
if (
  addressFieldsChanged
) {
  const nextAddress =
    hasOwnProperty(
      effectiveUpdates,
      "address"
    )
      ? effectiveUpdates
          .address
      : currentValues
          .address;

  const nextDetailAddress =
    hasOwnProperty(
      effectiveUpdates,
      "detailAddress"
    )
      ? effectiveUpdates
          .detailAddress
      : currentValues
          .detailAddress;

  await db.updateStudentAddressAndCoords({
  organizationId,

  studentId,

  address:
    nextAddress,

  detailAddress:
    nextDetailAddress,

  latitude:
    addressUpdated
      ? null
      : (student as any)
          .latitude ?? null,

  longitude:
    addressUpdated
      ? null
      : (student as any)
          .longitude ?? null,
});

  completedSteps.push(
    "학생 주소 수정 및 위치 좌표 초기화"
  );
}

    const updatedStudent =
      await db.getStudentById(
        studentId,
        {
          organizationId,
        }
      );

    if (!updatedStudent) {
      throw new Error(
        "수정 후 학생 정보를 다시 확인할 수 없습니다."
      );
    }

    completedSteps.push(
      "수정 결과 재조회"
    );

/**
 * 실제 변경된 필드만 학생 감사로그에 기록한다.
 */
const beforeJson:
  Record<
    string,
    string |
    null
  > = {};

const afterJson:
  Record<
    string,
    string |
    null
  > = {};

const diffJson:
  Record<
    string,
    {
      before:
        string |
        null;

      after:
        string |
        null;
    }
  > = {};

for (
  const field of
  Object.keys(
    effectiveUpdates
  )
) {
  const beforeValue =
    currentValues[
      field as
        keyof typeof currentValues
    ] ??
    null;

  const afterValue =
    normalizeNullableText(
      (
        updatedStudent as
          any
      )[field],
      field ===
        "course"
        ? 255
        : field ===
            "address" ||
          field ===
            "detailAddress"
          ? 500
          : 100
    );

  beforeJson[
    field
  ] =
    beforeValue;

  afterJson[
    field
  ] =
    afterValue;

  diffJson[
    field
  ] = {
    before:
      beforeValue,

    after:
      afterValue,
  };
}

/**
 * 학생 수정 감사로그 저장
 *
 * db.createStudentAuditLog 내부에서
 * actorName과 JSON 데이터가 암호화된다.
 */
try {
  await db.createStudentAuditLog({
    organizationId,

    studentId,

    entityType:
      "student",

    entityId:
      studentId,

    action:
      "update",

    title:
      "AI 학생 기본정보 수정",

    beforeJson,

    afterJson,

    diffJson,

    actorUserId:
      requestedByUserId,

    actorName:
      context.userName ??
      null,

    actorRole:
      context.role,

    ipAddress:
      null,

    userAgent:
      null,
  });

  completedSteps.push(
    "학생 수정 감사로그 기록"
  );
} catch {
  /**
   * 학생 수정은 이미 완료됐으므로
   * 감사로그 오류로 전체 작업을 실패 처리하지 않는다.
   */
  completedSteps.push(
    "학생 수정 완료 - 감사로그 기록 실패"
  );
}

const successMessage =
  addressUpdated
    ? "학생 기본정보가 수정되었으며, 주소 변경에 따라 기존 위치 좌표가 초기화되었습니다."
    : "학생 기본정보가 수정되었습니다.";

    /**
     * claim 함수는 version을 증가시키지 않으므로
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
  successMessage,
      });

    return {
      success:
        true,

      alreadyExecuted:
        false,

      executing:
        false,

      studentId,

      updatedFields:
        Object.keys(
          effectiveUpdates
        ),

      student:
        updatedStudent,

      pendingAction:
        completed,

      message:
  successMessage,
    };
  } catch (
    error
  ) {
    const message =
      error instanceof
        Error
        ? error.message
        : "학생 기본정보 수정에 실패했습니다.";

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
       * 실패 상태 기록 자체가 실패해도
       * 원래 학생 수정 오류를 유지한다.
       */
    }

    throw error;
  }
}