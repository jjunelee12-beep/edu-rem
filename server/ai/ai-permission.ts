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
  const {
    context,
  } = params;

  const assigneeId =
    normalizePositiveInteger(
      params.assigneeId
    );

  const currentUserId =
    normalizePositiveInteger(
      context.userId
    );

  if (
    !assigneeId ||
    !currentUserId
  ) {
    return false;
  }

  /**
   * Superhost는 AI 운영 설정·오류 점검만 담당한다.
   * 회사 내부 학생·상담 운영 데이터에는 접근하지 않는다.
   */
  if (
    context.role ===
    "superhost"
  ) {
    return false;
  }

  /**
   * Staff는 반드시 본인 담당 데이터만 조회한다.
   *
   * allowedAssigneeIds 값이 잘못 생성되더라도
   * Staff는 로그인 사용자 본인 ID만 허용한다.
   */
  if (
    context.role ===
    "staff"
  ) {
    return (
      assigneeId ===
      currentUserId
    );
  }

  /**
   * Admin은 본인 소속 팀 담당자 데이터까지 조회한다.
   *
   * 팀 구성원 목록은 서버에서 생성한
   * allowedAssigneeIds만 신뢰한다.
   */
  if (
    context.role ===
    "admin"
  ) {
    if (
      !Array.isArray(
        context.allowedAssigneeIds
      )
    ) {
      return false;
    }

    return context.allowedAssigneeIds.includes(
      assigneeId
    );
  }

  /**
   * Host는 같은 회사 전체 담당자의 데이터를 조회한다.
   *
   * 조직 일치 여부는
   * assertCanAccessStudent 또는
   * assertCanAccessConsultation에서 먼저 검사한다.
   */
  if (
    context.role ===
    "host"
  ) {
    return true;
  }

  return false;
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
  const {
    context,
    student,
  } = params;

  if (!student) {
    throw new AiPermissionError(
      "학생 정보를 확인할 수 없습니다."
    );
  }

  /**
   * Superhost는 회사 운영 데이터에 접근하지 않는다.
   */
  if (
    context.role ===
    "superhost"
  ) {
    throw new AiPermissionError(
      "슈퍼호스트는 학생 운영 정보를 조회할 수 없습니다."
    );
  }

  const contextOrganizationId =
    normalizePositiveInteger(
      context.organizationId
    );

  const studentOrganizationId =
    normalizePositiveInteger(
      student.organizationId
    );

  /**
   * 조직 정보가 하나라도 없으면 통과시키지 않는다.
   *
   * 기존 코드는 studentOrganizationId가 없으면
   * 조직 검사가 생략될 수 있었다.
   */
  if (
    !contextOrganizationId ||
    !studentOrganizationId
  ) {
    throw new AiPermissionError(
      "학생의 회사 범위를 확인할 수 없습니다."
    );
  }

  /**
   * 다른 회사 학생은 모든 권한에서 차단한다.
   */
  if (
    studentOrganizationId !==
    contextOrganizationId
  ) {
    throw new AiPermissionError(
      "다른 회사의 학생 정보에는 접근할 수 없습니다."
    );
  }

  /**
   * 역할별 담당자 조회 범위 검사
   *
   * Staff: 본인
   * Admin: 팀
   * Host: 회사 전체
   */
  assertCanAccessAssignee({
    context,
    assigneeId:
      student.assigneeId,
    resourceName: "해당 학생",
  });
}

export function assertCanAccessConsultation(
  params: {
    context: AiUserContext;
    consultation: any;
  }
) {
  const {
    context,
    consultation,
  } = params;

  if (!consultation) {
    throw new AiPermissionError(
      "상담 정보를 확인할 수 없습니다."
    );
  }

  /**
   * Superhost는 회사 운영 상담정보에 접근하지 않는다.
   */
  if (
    context.role ===
    "superhost"
  ) {
    throw new AiPermissionError(
      "슈퍼호스트는 상담 운영 정보를 조회할 수 없습니다."
    );
  }

  const contextOrganizationId =
    normalizePositiveInteger(
      context.organizationId
    );

  const consultationOrganizationId =
    normalizePositiveInteger(
      consultation.organizationId
    );

  /**
   * 조직 범위를 확인할 수 없으면 무조건 차단한다.
   */
  if (
    !contextOrganizationId ||
    !consultationOrganizationId
  ) {
    throw new AiPermissionError(
      "상담의 회사 범위를 확인할 수 없습니다."
    );
  }

  /**
   * 다른 회사 상담정보는 무조건 차단한다.
   */
  if (
    consultationOrganizationId !==
    contextOrganizationId
  ) {
    throw new AiPermissionError(
      "다른 회사의 상담 정보에는 접근할 수 없습니다."
    );
  }

  /**
   * 역할별 담당자 조회 범위 검사
   *
   * Staff: 본인
   * Admin: 팀
   * Host: 회사 전체
   */
  assertCanAccessAssignee({
    context,
    assigneeId:
      consultation.assigneeId,
    resourceName: "해당 상담",
  });
}

/**
 * 학생 쓰기 권한 검사
 *
 * 조회 가능 여부와 수정 가능 여부는 분리한다.
 *
 * Staff:
 * 본인 담당 학생만 수정 가능
 *
 * Admin:
 * 팀 학생은 조회할 수 있지만
 * 본인 담당 학생만 수정 가능
 *
 * Host:
 * 회사 전체 학생을 조회할 수 있지만
 * 본인 담당 학생만 수정 가능
 *
 * Superhost:
 * 직접 수정 불가
 */
export function assertCanWriteStudent(params: {
  context: AiUserContext;
  student: any;
}) {
  const {
    context,
    student,
  } = params;

  /**
   * 수정 전에 먼저 조회 가능한 대상인지 검사한다.
   *
   * Staff: 본인
   * Admin: 팀
   * Host: 회사 전체
   * Superhost: 차단
   */
  assertCanAccessStudent({
    context,
    student,
  });

  /**
   * AI Context 자체가 조회 전용이면 수정 불가
   */
  if (!context.canWrite) {
    throw new AiPermissionError(
      "현재 AI는 조회 전용 모드입니다. 학생 정보를 수정할 수 없습니다."
    );
  }

  const studentAssigneeId =
    normalizePositiveInteger(
      student.assigneeId
    );

  const currentUserId =
    normalizePositiveInteger(
      context.userId
    );

  /**
   * 실제 DB에 저장된 학생 담당자와
   * 현재 로그인 사용자가 같아야 한다.
   *
   * Admin과 Host도 다른 담당자의 학생은
   * 조회만 가능하고 수정할 수 없다.
   */
  if (
    !studentAssigneeId ||
    !currentUserId ||
    studentAssigneeId !==
      currentUserId
  ) {
    throw new AiPermissionError(
      "해당 학생의 실제 담당자만 수정하거나 CRM에 적용할 수 있습니다."
    );
  }
}

/**
 * 상담DB 쓰기 권한 검사
 *
 * 조회 가능 여부와 수정 가능 여부는 분리한다.
 *
 * Staff:
 * 본인 담당 상담만 수정 가능
 *
 * Admin:
 * 팀 상담은 조회할 수 있지만
 * 본인 담당 상담만 수정 가능
 *
 * Host:
 * 회사 전체 상담을 조회할 수 있지만
 * 본인 담당 상담만 수정 가능
 *
 * Superhost:
 * 직접 수정 불가
 */
export function assertCanWriteConsultation(
  params: {
    context: AiUserContext;
    consultation: any;
  }
) {
  const {
    context,
    consultation,
  } = params;

  /**
   * 먼저 역할별 상담 조회 범위를 검사한다.
   */
  assertCanAccessConsultation({
    context,
    consultation,
  });

  /**
   * 조회 전용 AI Context에서는 수정할 수 없다.
   */
  if (!context.canWrite) {
    throw new AiPermissionError(
      "현재 AI는 조회 전용 모드입니다. 상담 정보를 수정할 수 없습니다."
    );
  }

  const consultationAssigneeId =
    normalizePositiveInteger(
      consultation.assigneeId
    );

  const currentUserId =
    normalizePositiveInteger(
      context.userId
    );

  /**
   * 실제 상담DB 담당자만 수정 가능하다.
   *
   * Admin과 Host도 다른 담당자의 상담은
   * 조회만 가능하고 변경할 수 없다.
   */
  if (
    !consultationAssigneeId ||
    !currentUserId ||
    consultationAssigneeId !==
      currentUserId
  ) {
    throw new AiPermissionError(
      "해당 상담의 실제 담당자만 수정할 수 있습니다."
    );
  }
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
  | "managerId"
  | "staffId"
  | "ownerId"
  | "assignedUserId"
  | "requestedByUserId"
  | "confirmedByUserId"
  | "userId"
  | "role"
  | "allowedAssigneeIds"
  | "scope"
> {
  const {
    organizationId:
      _organizationId,

    teamId:
      _teamId,

    assigneeId:
      _assigneeId,

    managerId:
      _managerId,

    staffId:
      _staffId,

    ownerId:
      _ownerId,

    assignedUserId:
      _assignedUserId,

    requestedByUserId:
      _requestedByUserId,

    confirmedByUserId:
      _confirmedByUserId,

    userId:
      _userId,

    role:
      _role,

    allowedAssigneeIds:
      _allowedAssigneeIds,

    scope:
      _scope,

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