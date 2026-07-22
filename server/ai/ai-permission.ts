import type {
  AiRole,
  AiToolDefinition,
  AiUserContext,
} from "./ai.types";

export class AiPermissionError extends Error {
  code = "AI_PERMISSION_DENIED" as const;
  status = 403;

  constructor(message: string) {
    super(message);
    this.name = "AiPermissionError";
  }
}

function normalizePositiveInteger(
  value: unknown
): number | null {
  const normalized = Number(value);

  if (
    !Number.isFinite(normalized) ||
    normalized <= 0
  ) {
    return null;
  }

  return Math.floor(normalized);
}

export function assertAiRoleAllowed(params: {
  context: AiUserContext;
  allowedRoles: AiRole[];
  toolName?: string;
}) {
  if (
    !params.allowedRoles.includes(
      params.context.role
    )
  ) {
    throw new AiPermissionError(
      `${
        params.toolName || "해당 AI 기능"
      }을 사용할 권한이 없습니다.`
    );
  }
}

export function assertAiToolAllowed<
  TInput,
  TOutput
>(params: {
  context: AiUserContext;
  tool: AiToolDefinition<
    TInput,
    TOutput
  >;
}) {
  const { context, tool } = params;

  assertAiRoleAllowed({
    context,
    allowedRoles: tool.allowedRoles,
    toolName: tool.name,
  });

  if (
    tool.requiresOrganization &&
    (!context.organizationId ||
      context.organizationId <= 0)
  ) {
    throw new AiPermissionError(
      "회사 범위를 확인할 수 없어 AI Tool을 실행할 수 없습니다."
    );
  }

  if (
    tool.accessMode === "write" &&
    !context.canWrite
  ) {
    throw new AiPermissionError(
      "현재 AI는 조회 전용 모드입니다. 변경 작업은 사용할 수 없습니다."
    );
  }

  if (tool.accessMode === "system") {
    if (context.role !== "superhost") {
      throw new AiPermissionError(
        "시스템 AI 기능은 슈퍼호스트만 사용할 수 있습니다."
      );
    }
  }
}

export function canAccessAssignee(params: {
  context: AiUserContext;
  assigneeId: unknown;
}) {
  const assigneeId =
    normalizePositiveInteger(
      params.assigneeId
    );

  if (!assigneeId) return false;

  /**
   * Host / 선택 회사 범위 Superhost
   */
  if (
    params.context.allowedAssigneeIds ===
    null
  ) {
    return true;
  }

  return params.context.allowedAssigneeIds.includes(
    assigneeId
  );
}

export function assertCanAccessAssignee(params: {
  context: AiUserContext;
  assigneeId: unknown;
  resourceName?: string;
}) {
  if (!canAccessAssignee(params)) {
    throw new AiPermissionError(
      `${
        params.resourceName || "해당 데이터"
      }에 접근할 권한이 없습니다.`
    );
  }
}

export function assertCanAccessStudent(params: {
  context: AiUserContext;
  student: any;
}) {
  if (!params.student) {
    throw new AiPermissionError(
      "학생 정보를 확인할 수 없습니다."
    );
  }

  const studentOrganizationId =
    normalizePositiveInteger(
      params.student.organizationId
    );

  /**
   * 조직 ID가 다르면 무조건 차단
   */
  if (
    studentOrganizationId &&
    studentOrganizationId !==
      params.context.organizationId
  ) {
    throw new AiPermissionError(
      "다른 회사의 학생 정보에는 접근할 수 없습니다."
    );
  }

  assertCanAccessAssignee({
    context: params.context,
    assigneeId:
      params.student.assigneeId,
    resourceName: "해당 학생",
  });
}

export function assertCanAccessConsultation(
  params: {
    context: AiUserContext;
    consultation: any;
  }
) {
  if (!params.consultation) {
    throw new AiPermissionError(
      "상담 정보를 확인할 수 없습니다."
    );
  }

  const consultationOrganizationId =
    normalizePositiveInteger(
      params.consultation.organizationId
    );

  if (
    consultationOrganizationId &&
    consultationOrganizationId !==
      params.context.organizationId
  ) {
    throw new AiPermissionError(
      "다른 회사의 상담 정보에는 접근할 수 없습니다."
    );
  }

  assertCanAccessAssignee({
    context: params.context,
    assigneeId:
      params.consultation.assigneeId,
    resourceName: "해당 상담",
  });
}

/**
 * 프론트 입력에서 권한 관련 값을 제거한다.
 *
 * AI 요청자가 organizationId, teamId, assigneeId를
 * 조작해서 보내더라도 Tool에는 전달하지 않는다.
 */
export function stripUntrustedScopeFields<
  T extends Record<string, unknown>
>(input: T): Omit<
  T,
  | "organizationId"
  | "teamId"
  | "assigneeId"
  | "userId"
  | "role"
  | "allowedAssigneeIds"
> {
  const {
    organizationId: _organizationId,
    teamId: _teamId,
    assigneeId: _assigneeId,
    userId: _userId,
    role: _role,
    allowedAssigneeIds:
      _allowedAssigneeIds,
    ...safeInput
  } = input;

  return safeInput;
}

/**
 * AI에서는 삭제 Tool을 등록하지 않는다.
 * 혹시 실수로 등록할 경우에도 여기서 차단한다.
 */
export function assertToolNameIsSafe(
  toolName: string
) {
  const normalized = toolName
    .trim()
    .toLowerCase();

  const forbiddenKeywords = [
    ".delete",
    ".remove",
    ".destroy",
    ".drop",
    ".truncate",
    "schema.alter",
    "server.modify",
    "database.raw",
  ];

  const forbidden =
    forbiddenKeywords.some((keyword) =>
      normalized.includes(keyword)
    );

  if (forbidden) {
    throw new AiPermissionError(
      "AI에는 삭제·스키마 변경·서버 수정 기능을 등록할 수 없습니다."
    );
  }
}