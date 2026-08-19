import * as db from "./db";
import { throwAppError } from "./_core/appError";
import { ERROR_CODES } from "./_core/errorCodes";

export type StudentAiManagementSource =
  | "KAKAO_AI"
  | "SYSTEM_AI"
  | "STAFF"
  | "SYSTEM";

export type StudentAiManagementNoteType =
  | "administrative"
  | "practice"
  | "schedule"
  | "subject"
  | "degree"
  | "qualification"
  | "document"
  | "risk"
  | "learning_plan"
  | "general";

export type StudentAiManagementNoteStatus =
  | "info"
  | "action_required"
  | "in_progress"
  | "resolved"
  | "dismissed";

export type StudentAiManagementEventType =
  | "administrative_status_changed"
  | "document_submitted"
  | "practice_condition_changed"
  | "schedule_changed"
  | "risk_changed"
  | "important_note_created"
  | "learning_plan_changed"
  | "other";

export type StudentAiManagementSeverity =
  | "info"
  | "warning"
  | "important";

export interface CreateStudentAiManagementRecordInput {
  organizationId: number;
  studentId: number;

  sourceType:
    StudentAiManagementSource;

  noteType:
    StudentAiManagementNoteType;

  noteStatus?:
    StudentAiManagementNoteStatus;

  inquirySummary?:
    string | null;

  aiSummary:
    string;

  actionSummary?:
    string | null;

  referenceType?:
    string | null;

  referenceId?:
    string | null;

  actorUserId?:
    number | null;

  /**
   * true인 경우에만
   * 담당자 AI 업데이트 이벤트를 만든다.
   *
   * 단순 질문 / 일반안내는 false.
   */
  notifyStaff:
    boolean;

  eventType?:
    StudentAiManagementEventType;

  eventSeverity?:
    StudentAiManagementSeverity;

  eventTitle?:
    string | null;

  eventMessage?:
    string | null;
}

function requirePositiveInteger(
  value: unknown,
  label: string
) {
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

function normalizeRequiredText(
  value: unknown,
  label: string,
  maxLength: number
) {
  const normalized =
    normalizeNullableText(
      value,
      maxLength
    );

  if (!normalized) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${label} 내용이 필요합니다.`,
      400
    );
  }

  return normalized;
}

/**
 * AI 메모 + 필요할 경우 담당자 알림 이벤트를
 * 동일한 정책으로 생성한다.
 *
 * 중요:
 * notifyStaff=false
 * → Note만 생성
 *
 * notifyStaff=true
 * → Note + Event 생성
 *
 * 따라서 카카오 메시지 한 건마다
 * AI 업데이트 숫자가 증가하지 않는다.
 */
export async function createStudentAiManagementRecord(
  input:
    CreateStudentAiManagementRecordInput
) {
  const organizationId =
    requirePositiveInteger(
      input.organizationId,
      "organizationId"
    );

  const studentId =
    requirePositiveInteger(
      input.studentId,
      "studentId"
    );

  const actorUserId =
    input.actorUserId ===
      null ||
    input.actorUserId ===
      undefined
      ? null
      : requirePositiveInteger(
          input.actorUserId,
          "actorUserId"
        );

  /**
   * 다른 회사 studentId를 넘겨서
   * AI 메모를 생성할 수 없도록 재검증.
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

  const inquirySummary =
    normalizeNullableText(
      input.inquirySummary,
      5000
    );

  const aiSummary =
    normalizeRequiredText(
      input.aiSummary,
      "AI 요약",
      10000
    );

  const actionSummary =
    normalizeNullableText(
      input.actionSummary,
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

  /**
   * 카카오 AI가 만든 관리기록은
   * 가능하면 실제 원본 메시지 ID와 연결한다.
   *
   * 단, 단순 텍스트에서 생성되는 비중요 Note까지
   * 강제로 막지는 않는다.
   */
  if (
    input.sourceType ===
      "KAKAO_AI" &&
    input.notifyStaff &&
    (
      !referenceType ||
      !referenceId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "카카오 AI 중요 관리기록에는 원본 메시지 참조정보가 필요합니다.",
      409
    );
  }

  const note =
    await db.createStudentAiNote({
      organizationId,
      studentId,

      noteType:
        input.noteType,

      status:
        input.noteStatus ??
        (
          input.notifyStaff
            ? "action_required"
            : "info"
        ),

      sourceType:
        input.sourceType,

      inquirySummary,
      aiSummary,
      actionSummary,

      referenceType,
      referenceId,

      createdBy:
        actorUserId,

      updatedBy:
        actorUserId,
    } as any);

  if (!note) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "AI 관리 메모 생성에 실패했습니다.",
      500
    );
  }

  /**
   * 일반적인 상담 내용이면 Note까지만.
   */
  if (!input.notifyStaff) {
    return {
      success:
        true as const,

      student,

      note,

      event:
        null,

      unreadCount:
        await db.countUnreadStudentAiEvents({
          organizationId,
          studentId,
        }),
    };
  }

  const eventTitle =
    normalizeRequiredText(
      input.eventTitle ||
      input.actionSummary ||
      input.aiSummary,
      "AI 업데이트 제목",
      255
    );

  const eventMessage =
    normalizeNullableText(
      input.eventMessage ||
      input.actionSummary ||
      input.aiSummary,
      10000
    );

  const event =
    await db.createStudentAiEvent({
      organizationId,
      studentId,

      eventType:
        input.eventType ??
        "important_note_created",

      sourceType:
        input.sourceType,

      severity:
        input.eventSeverity ??
        (
          input.noteStatus ===
            "action_required"
            ? "important"
            : "info"
        ),

      title:
        eventTitle,

      message:
        eventMessage,

      entityType:
        "ai_note",

      entityId:
        Number(
          (note as any).id
        ),

      referenceType,
      referenceId,

      isRead:
        false,

      readAt:
        null,

      readBy:
        null,
    } as any);

  if (!event) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "AI 업데이트 이벤트 생성에 실패했습니다.",
      500
    );
  }

  return {
    success:
      true as const,

    student,

    note,

    event,

    unreadCount:
      await db.countUnreadStudentAiEvents({
        organizationId,
        studentId,
      }),
  };
}