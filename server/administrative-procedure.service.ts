import * as db from "./db";
import { throwAppError } from "./_core/appError";
import { ERROR_CODES } from "./_core/errorCodes";

export type AdministrativeProcedureType =
  | "learner_registration"
  | "credit_recognition"
  | "degree_application"
  | "qualification_application";

export type AdministrativeProcedureStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "review_required";

export type AdministrativeProcedureSource =
  | "STAFF"
  | "KAKAO_AI"
  | "SYSTEM_AI"
  | "SYSTEM";

export interface UpdateAdministrativeProcedureInput {
  organizationId: number;
  studentId: number;

  procedureType:
    AdministrativeProcedureType;

  status:
    AdministrativeProcedureStatus;

  sourceType:
    AdministrativeProcedureSource;

  /**
   * STAFF가 직접 변경한 경우
   * 실제 CRM 사용자 ID.
   *
   * KAKAO_AI / SYSTEM_AI / SYSTEM은
   * null일 수 있다.
   */
  actorUserId?: number | null;

  reportedDate?: string | null;

  evidenceSummary?: string | null;

  referenceType?: string | null;

  referenceId?: string | null;

  memo?: string | null;
}

function normalizePositiveInteger(
  value: unknown,
  label: string
): number {
  const number =
    Math.floor(
      Number(value)
    );

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${label} 정보가 올바르지 않습니다.`,
      400
    );
  }

  return number;
}

function normalizeNullableText(
  value: unknown,
  maxLength: number
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    String(value).trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(
    0,
    maxLength
  );
}

function normalizeReportedDate(
  value: unknown
): string | null {
  const normalized =
    normalizeNullableText(
      value,
      10
    );

  if (!normalized) {
    return null;
  }

  /**
   * 사용자가 말한 날짜는
   * YYYY-MM-DD 형식만 허용한다.
   *
   * 완료시간 completedAt은
   * 이 날짜를 사용하지 않는다.
   */
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalized
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "보고일 형식은 YYYY-MM-DD여야 합니다.",
      400
    );
  }

  const date =
    new Date(
      `${normalized}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "보고일 정보가 올바르지 않습니다.",
      400
    );
  }

  return normalized;
}

function validateProcedureType(
  value: unknown
): AdministrativeProcedureType {
  const normalized =
    String(value || "").trim() as
      AdministrativeProcedureType;

  const allowed =
    new Set<
      AdministrativeProcedureType
    >([
      "learner_registration",
      "credit_recognition",
      "degree_application",
      "qualification_application",
    ]);

  if (
    !allowed.has(
      normalized
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "행정절차 종류가 올바르지 않습니다.",
      400
    );
  }

  return normalized;
}

function validateStatus(
  value: unknown
): AdministrativeProcedureStatus {
  const normalized =
    String(value || "").trim() as
      AdministrativeProcedureStatus;

  const allowed =
    new Set<
      AdministrativeProcedureStatus
    >([
      "not_started",
      "in_progress",
      "completed",
      "review_required",
    ]);

  if (
    !allowed.has(
      normalized
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "행정절차 상태가 올바르지 않습니다.",
      400
    );
  }

  return normalized;
}

function validateSourceType(
  value: unknown
): AdministrativeProcedureSource {
  const normalized =
    String(value || "").trim() as
      AdministrativeProcedureSource;

  const allowed =
    new Set<
      AdministrativeProcedureSource
    >([
      "STAFF",
      "KAKAO_AI",
      "SYSTEM_AI",
      "SYSTEM",
    ]);

  if (
    !allowed.has(
      normalized
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "행정절차 변경 출처가 올바르지 않습니다.",
      400
    );
  }

  return normalized;
}

/**
 * 출처별 행정절차 쓰기 규칙.
 *
 * STAFF
 * - 담당자가 직접 판단하므로 모든 상태 변경 가능
 *
 * KAKAO_AI
 * - completed 처리 시 반드시 증빙 근거 필요
 *
 * SYSTEM_AI
 * - completed 처리 시 반드시 판단 근거 필요
 *
 * SYSTEM
 * - 내부 시스템 자동 동기화용
 */
function assertSourceWritePolicy(params: {
  sourceType:
    AdministrativeProcedureSource;

  status:
    AdministrativeProcedureStatus;

  actorUserId:
    number | null;

  evidenceSummary:
    string | null;

  referenceType:
    string | null;

  referenceId:
    string | null;
}) {
  const {
    sourceType,
    status,
    actorUserId,
    evidenceSummary,
    referenceType,
    referenceId,
  } = params;

  /**
   * 직원이 직접 변경하는 경우
   * 사용자 ID가 반드시 있어야 한다.
   */
  if (
    sourceType === "STAFF"
  ) {
    if (
      !actorUserId ||
      actorUserId <= 0
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "담당자 변경 사용자 정보가 필요합니다.",
        400
      );
    }

    return;
  }

  /**
   * 카카오 AI 또는 SYSTEM_AI가
   * '완료'를 임의 추측하면 안 된다.
   *
   * 최소한 어떤 근거로 완료라고
   * 판단했는지 남겨야 한다.
   */
  if (
    (
      sourceType === "KAKAO_AI" ||
      sourceType === "SYSTEM_AI"
    ) &&
    status === "completed"
  ) {
    if (
      !evidenceSummary
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "AI가 행정절차를 완료 처리하려면 확인 근거가 필요합니다.",
        409
      );
    }

    /**
     * 카카오 AI는 실제 메시지/이미지와
     * 연결할 수 있어야 한다.
     */
    if (
      sourceType === "KAKAO_AI" &&
      (
        !referenceType ||
        !referenceId
      )
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "카카오 AI 완료 처리에는 원본 메시지 또는 증빙 참조정보가 필요합니다.",
        409
      );
    }
  }
}

/**
 * 행정절차 상태를 변경하는
 * 모든 시스템의 공통 진입점.
 *
 * 이 Service를 통해서만:
 *
 * STAFF
 * KAKAO_AI
 * SYSTEM_AI
 * SYSTEM
 *
 * 상태 변경 규칙을 통일한다.
 */
export async function updateAdministrativeProcedure(
  input:
    UpdateAdministrativeProcedureInput
) {
  const organizationId =
    normalizePositiveInteger(
      input.organizationId,
      "organizationId"
    );

  const studentId =
    normalizePositiveInteger(
      input.studentId,
      "studentId"
    );

  const procedureType =
    validateProcedureType(
      input.procedureType
    );

  const status =
    validateStatus(
      input.status
    );

  const sourceType =
    validateSourceType(
      input.sourceType
    );

  const actorUserId =
    input.actorUserId ===
      null ||
    input.actorUserId ===
      undefined
      ? null
      : normalizePositiveInteger(
          input.actorUserId,
          "actorUserId"
        );

  const reportedDate =
    normalizeReportedDate(
      input.reportedDate
    );

  const evidenceSummary =
    normalizeNullableText(
      input.evidenceSummary,
      5000
    );

  const referenceType =
    normalizeNullableText(
      input.referenceType,
      100
    );

  const referenceId =
    normalizeNullableText(
      input.referenceId,
      191
    );

  const memo =
    normalizeNullableText(
      input.memo,
      10000
    );

  assertSourceWritePolicy({
    sourceType,
    status,
    actorUserId,
    evidenceSummary,
    referenceType,
    referenceId,
  });

  /**
   * 조직 경계까지 포함하여
   * 실제 학생이 존재하는지 다시 확인한다.
   *
   * AI가 studentId만 임의로 넘겨
   * 다른 회사 학생을 수정할 수 없어야 한다.
   */
  const student =
    await db.getStudent(
      studentId,
      {
        organizationId,
      }
    );

  if (!student) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "학생을 찾을 수 없습니다.",
      404
    );
  }

  const before =
    await db.getStudentAdministrativeProcedure({
      organizationId,
      studentId,
      procedureType,
    });

  const updated =
    await db.upsertStudentAdministrativeProcedure({
      organizationId,
      studentId,
      procedureType,
      status,
      sourceType,

      /**
       * completedAt은 여기서 생성하지 않는다.
       *
       * 실제 저장 함수가 status === completed일 때
       * 서버 시간을 사용한다.
       */
      reportedDate,

      evidenceSummary,
      referenceType,
      referenceId,
      memo,

      createdBy:
        actorUserId,

      updatedBy:
        actorUserId,
    } as any);

  if (!updated) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "행정절차 상태 저장에 실패했습니다.",
      500
    );
  }

  const hasChanged =
    JSON.stringify(
      {
        status:
          (before as any)?.status ??
          null,

        sourceType:
          (before as any)?.sourceType ??
          null,

        reportedDate:
          (before as any)?.reportedDate ??
          null,

        evidenceSummary:
          (before as any)?.evidenceSummary ??
          null,

        referenceType:
          (before as any)?.referenceType ??
          null,

        referenceId:
          (before as any)?.referenceId ??
          null,

        memo:
          (before as any)?.memo ??
          null,
      }
    ) !==
    JSON.stringify(
      {
        status:
          (updated as any)?.status ??
          null,

        sourceType:
          (updated as any)?.sourceType ??
          null,

        reportedDate:
          (updated as any)?.reportedDate ??
          null,

        evidenceSummary:
          (updated as any)?.evidenceSummary ??
          null,

        referenceType:
          (updated as any)?.referenceType ??
          null,

        referenceId:
          (updated as any)?.referenceId ??
          null,

        memo:
          (updated as any)?.memo ??
          null,
      }
    );

  /**
   * 아직 AI 이벤트 테이블은 만들지 않았으므로
   * 이벤트 저장 대신 Router / AI 실행기에서 사용할
   * 메타데이터만 반환한다.
   */
  return {
    success:
      true as const,

    student,

    before:
      before ??
      null,

    data:
      updated,

    created:
      !before,

    changed:
      hasChanged,

    shouldNotifyStaff:
      hasChanged &&
      (
        sourceType ===
          "KAKAO_AI" ||
        sourceType ===
          "SYSTEM_AI"
      ),

    sourceType,

    procedureType,

    status,
  };
}