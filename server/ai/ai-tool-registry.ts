import * as db from "../db";

import {
  AiPermissionError,
  assertAiToolAllowed,
  assertCanAccessStudent,
  assertToolNameIsSafe,
  stripUntrustedScopeFields,
} from "./ai-permission";

import {
  createAiRequestId,
  summarizeAiToolOutput,
  writeAiAuditLog,
} from "./ai-audit";

import type {
  AiToolDefinition,
  AiToolExecutionResult,
  AiToolName,
  AiUserContext,

  ConsultationSearchToolInput,
  ConsultationSearchToolOutput,

  MissingDataAlertToolInput,
  MissingDataAlertToolOutput,

  StudentSearchToolInput,
  StudentSearchToolOutput,

  StudentSummaryToolInput,
  StudentSummaryToolOutput,

  StudentDetailRiskToolInput,
  StudentDetailRiskToolOutput,

  StudentListRiskToolInput,
  StudentListRiskToolOutput,
} from "./ai.types";

import {
  analyzeStudentDetailRisk,
  analyzeStudentListRisk,
} from "./ai-risk-engine";

const toolRegistry = new Map<
  string,
  AiToolDefinition<any, any>
>();

function normalizeLimit(
  value: unknown,
  defaultValue = 20,
  maxValue = 100
) {
  const normalized = Number(value);

  if (
    !Number.isFinite(normalized) ||
    normalized <= 0
  ) {
    return defaultValue;
  }

  return Math.min(
    maxValue,
    Math.floor(normalized)
  );
}

function normalizeSearchQuery(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .slice(0, 200);
}

function getScopedAssigneeIds(
  context: AiUserContext
): number[] | undefined {
  /**
   * db.listStudents / listConsultations에서
   * undefined는 회사 전체를 의미한다.
   */
  if (
    context.allowedAssigneeIds ===
    null
  ) {
    return undefined;
  }

  return context.allowedAssigneeIds;
}

function isTextMatched(params: {
  queryLower: string;
  queryDigits: string;
  values: unknown[];
}) {
  const textMatched =
    params.values.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(params.queryLower)
    );

  /**
   * 전화번호는 숫자 4자리 이상일 때만 검색
   * 빈 문자열이 모든 번호와 일치하는 문제 방지
   */
  const phoneMatched =
    params.queryDigits.length >= 4 &&
    params.values.some((value) =>
      String(value ?? "")
        .replace(/\D/g, "")
        .includes(params.queryDigits)
    );

  return textMatched || phoneMatched;
}

function registerTool<
  TInput,
  TOutput
>(
  definition: AiToolDefinition<
    TInput,
    TOutput
  >
) {
  assertToolNameIsSafe(definition.name);

  if (
    toolRegistry.has(definition.name)
  ) {
    throw new Error(
      `중복된 AI Tool 이름입니다: ${definition.name}`
    );
  }

  toolRegistry.set(
    definition.name,
    definition as AiToolDefinition<
      any,
      any
    >
  );
}

/**
 * 학생 검색
 */
registerTool<
  StudentSearchToolInput,
  StudentSearchToolOutput
>({
  name: "student.search",
  description:
    "현재 사용자의 권한 범위 안에서 학생을 이름, 연락처, 과정, 상태, 교육원으로 검색합니다.",

  accessMode: "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
    "superhost",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as StudentSearchToolInput;

    const query =
      normalizeSearchQuery(
        safeInput.query
      );

    if (!query) {
      throw new Error(
        "학생 검색어를 입력해주세요."
      );
    }

    const limit = normalizeLimit(
      safeInput.limit,
      20,
      50
    );

    const assigneeIds =
      getScopedAssigneeIds(context);

    const students =
      await db.listStudents(
        assigneeIds,
        {
          organizationId:
            context.organizationId,
        }
      );

    const queryLower =
      query.toLowerCase();

    const queryDigits =
      query.replace(/\D/g, "");

    const matched = (
      students || []
    )
      .filter((student: any) =>
        isTextMatched({
          queryLower,
          queryDigits,
          values: [
            student.clientName,
            student.phone,
            student.course,
            student.status,
            student.institution,
          ],
        })
      )
      .slice(0, limit)
      .map((student: any) => ({
        id: Number(student.id),

        clientName:
          student.clientName ?? null,

        phone:
          student.phone ?? null,

        course:
          student.course ?? null,

        status:
          student.status ?? null,

        institution:
          student.institution ?? null,

        assigneeId:
          student.assigneeId
            ? Number(
                student.assigneeId
              )
            : null,
      }));

    return {
      query,
      count: matched.length,
      students: matched,
    };
  },
});

/**
 * 학생 상세 요약
 */
registerTool<
  StudentSummaryToolInput,
  StudentSummaryToolOutput
>({
  name: "student.summary",
  description:
    "현재 사용자가 접근 가능한 학생 한 명의 기본 정보를 조회합니다.",

  accessMode: "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
    "superhost",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as StudentSummaryToolInput;

    const studentId =
      Number(safeInput.studentId);

    if (
      !Number.isFinite(studentId) ||
      studentId <= 0
    ) {
      throw new Error(
        "올바른 학생 ID가 필요합니다."
      );
    }

    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (!student) {
      throw new Error(
        "학생 정보를 찾을 수 없습니다."
      );
    }

    assertCanAccessStudent({
  context,
  student,
});

const registrationSummary =
  await db.getStudentRegistrationSummary(
    studentId,
    {
      organizationId:
        context.organizationId,
    }
  );

const safeStudent:
  StudentSummaryToolOutput["student"] = {
      id: Number(
        (student as any).id
      ),

      organizationId:
        Number(
          (student as any)
            .organizationId
        ),

      clientName:
        (student as any)
          .clientName ?? null,

      phone:
        (student as any).phone ??
        null,

      course:
  (student as any).course ??
  null,

status:
  registrationSummary.status ||
  (student as any).status ||
  null,

finalEducation:
  (student as any)
    .finalEducation ?? null,

startDate:
  registrationSummary.startDate ??
  (student as any).startDate ??
  null,

     paymentAmount:
  Number(registrationSummary.paymentAmount || 0) > 0
    ? registrationSummary.paymentAmount
    : (student as any).paymentAmount ?? null,

      paymentDate:
  registrationSummary.paymentDate ??
  (student as any).paymentDate ??
  null,

      subjectCount:
  Number(registrationSummary.subjectCount || 0) > 0
    ? Number(registrationSummary.subjectCount)
    : Number((student as any).subjectCount || 0) > 0
      ? Number((student as any).subjectCount)
      : null,

      institution:
  registrationSummary.institution ||
  (student as any).institution ||
  null,

     totalSemesters:
  Number(
    registrationSummary.totalSemesters || 0
  ) > 0
    ? Number(
        registrationSummary.totalSemesters
      )
    : Number(
        (student as any).totalSemesters || 0
      ) > 0
      ? Number(
          (student as any).totalSemesters
        )
      : null,

      approvalStatus:
        (student as any)
          .approvalStatus ?? null,

      assigneeId:
        Number(
          (student as any)
            .assigneeId || 0
        ) || null,

      address:
        (student as any).address ??
        null,

      detailAddress:
        (student as any)
          .detailAddress ?? null,
    };

    return {
      student: safeStudent,
    };
  },
});

/**
 * 상담 검색
 */
registerTool<
  ConsultationSearchToolInput,
  ConsultationSearchToolOutput
>({
  name: "consultation.search",
  description:
    "현재 사용자의 권한 범위 안에서 상담DB를 이름, 연락처, 희망과정, 상태, 상담내용으로 검색합니다.",

  accessMode: "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
    "superhost",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as ConsultationSearchToolInput;

    const query =
      normalizeSearchQuery(
        safeInput.query
      );

    if (!query) {
      throw new Error(
        "상담 검색어를 입력해주세요."
      );
    }

    const limit = normalizeLimit(
      safeInput.limit,
      20,
      50
    );

    const assigneeIds =
      getScopedAssigneeIds(context);

    const consultations =
  await db.listConsultations(
    context.allowedAssigneeIds === null
      ? undefined
      : context.allowedAssigneeIds.length === 1
        ? context.allowedAssigneeIds[0]
        : undefined,
    {
      organizationId:
        context.organizationId,

      assigneeIds:
        context.allowedAssigneeIds !== null &&
        context.allowedAssigneeIds.length > 1
          ? context.allowedAssigneeIds
          : undefined,
    }
  );

    const queryLower =
      query.toLowerCase();

    const queryDigits =
      query.replace(/\D/g, "");

    const matched = (
      consultations || []
    )
      .filter((consultation: any) =>
        isTextMatched({
          queryLower,
          queryDigits,
          values: [
            consultation.clientName,
            consultation.phone,
            consultation.desiredCourse,
            consultation.status,
            consultation.notes,
            consultation.channel,
          ],
        })
      )
      .slice(0, limit)
      .map(
        (consultation: any) => ({
          id: Number(
            consultation.id
          ),

          clientName:
            consultation.clientName ??
            null,

          phone:
            consultation.phone ??
            null,

          desiredCourse:
            consultation.desiredCourse ??
            null,

          status:
            consultation.status ??
            null,

          assigneeId:
            consultation.assigneeId
              ? Number(
                  consultation.assigneeId
                )
              : null,
        })
      );

    return {
      query,
      count: matched.length,
      consultations: matched,
    };
  },
});

/**
 * 기본 누락 점검
 *
 * 이후 risk.studentDetail 규칙 엔진과 분리할 예정.
 */
registerTool<
  MissingDataAlertToolInput,
  MissingDataAlertToolOutput
>({
  name: "alert.missingData",
  description:
    "현재 사용자의 권한 범위 안에서 결제일, 결제금액, 담당자, 실습 배정 누락을 점검합니다.",

  accessMode: "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
    "superhost",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as MissingDataAlertToolInput;

    const limit = normalizeLimit(
      safeInput.limit,
      100,
      300
    );

    const assigneeIds =
      getScopedAssigneeIds(context);

    const [
      students,
      consultations,
    ] = await Promise.all([
      db.listStudents(
        assigneeIds,
        {
          organizationId:
            context.organizationId,
        }
      ),

      db.listConsultations(
  context.allowedAssigneeIds === null
    ? undefined
    : context.allowedAssigneeIds.length === 1
      ? context.allowedAssigneeIds[0]
      : undefined,
  {
    organizationId:
      context.organizationId,

    assigneeIds:
      context.allowedAssigneeIds !== null &&
      context.allowedAssigneeIds.length > 1
        ? context.allowedAssigneeIds
        : undefined,
  }
),
    ]);

    const items: MissingDataAlertToolOutput["items"] =
      [];

    for (const student of (
      students || []
    ) as any[]) {
      if (!student.paymentDate) {
        items.push({
          type: "student_payment_date_missing",
          studentId: Number(
            student.id
          ),
          clientName:
            student.clientName ??
            null,
          assigneeId:
            student.assigneeId
              ? Number(
                  student.assigneeId
                )
              : null,
          message:
            "학생 결제일이 입력되지 않았습니다.",
        });
      }

      const paymentAmount =
        Number(
          student.paymentAmount ||
            0
        );

      if (
        !Number.isFinite(
          paymentAmount
        ) ||
        paymentAmount <= 0
      ) {
        items.push({
          type: "student_payment_amount_missing",
          studentId: Number(
            student.id
          ),
          clientName:
            student.clientName ??
            null,
          assigneeId:
            student.assigneeId
              ? Number(
                  student.assigneeId
                )
              : null,
          message:
            "학생 결제금액이 입력되지 않았습니다.",
        });
      }
    }

    for (const consultation of (
      consultations || []
    ) as any[]) {
      if (
        !consultation.assigneeId ||
        Number(
          consultation.assigneeId
        ) <= 0
      ) {
        items.push({
          type: "consultation_assignee_missing",
          consultationId: Number(
            consultation.id
          ),
          clientName:
            consultation.clientName ??
            null,
          assigneeId: null,
          message:
            "상담DB 담당자가 지정되지 않았습니다.",
        });
      }
    }

    /**
     * 실습 미섭외 항목은 현재 실습 요청 조회 함수 구조가
     * routers.ts에 섞여 있어 2차에서 Tool로 별도 연결한다.
     *
     * 현재는 0건으로 두고 인터페이스만 유지한다.
     */
    const practiceUnassignedCount = 0;

    const paymentDateMissingCount =
      items.filter(
        (item) =>
          item.type ===
          "student_payment_date_missing"
      ).length;

    const paymentAmountMissingCount =
      items.filter(
        (item) =>
          item.type ===
          "student_payment_amount_missing"
      ).length;

    const consultationAssigneeMissingCount =
      items.filter(
        (item) =>
          item.type ===
          "consultation_assignee_missing"
      ).length;

    const totalIssueCount =
      paymentDateMissingCount +
      paymentAmountMissingCount +
      consultationAssigneeMissingCount +
      practiceUnassignedCount;

    return {
      summary: {
        paymentDateMissingCount,
        paymentAmountMissingCount,
        consultationAssigneeMissingCount,
        practiceUnassignedCount,
        totalIssueCount,
      },

      items: items.slice(0, limit),
    };
  },
});

/**
 * 학생 한 명 상세 위험 분석
 */
registerTool<
  StudentDetailRiskToolInput,
  StudentDetailRiskToolOutput
>({
  name: "risk.studentDetail",

  description:
    "현재 사용자가 접근 가능한 학생 한 명의 플랜, 과목, 학점, 결제, 중복 과목, 실습 상태를 종합 점검합니다.",

  accessMode: "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
    "superhost",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as StudentDetailRiskToolInput;

    const studentId =
      Number(
        safeInput.studentId
      );

    if (
      !Number.isFinite(
        studentId
      ) ||
      studentId <= 0
    ) {
      throw new Error(
        "올바른 학생 ID가 필요합니다."
      );
    }

    return analyzeStudentDetailRisk({
      context,
      studentId,
    });
  },
});

/**
 * 권한 범위 내 학생 전체 위험 점검
 */
registerTool<
  StudentListRiskToolInput,
  StudentListRiskToolOutput
>({
  name: "risk.studentList",

  description:
    "현재 사용자의 권한 범위 안에서 학생 전체의 플랜, 학점, 과목 중복, 결제, 실습 상태를 종합 점검합니다.",

  accessMode: "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
    "superhost",
  ],

  requiresOrganization: true,
  requiresConfirmation: false,
  autoExecutable: true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (input || {}) as Record<
          string,
          unknown
        >
      ) as StudentListRiskToolInput;

    const rawLimit =
      Number(
        safeInput.limit
      );

    const limit =
      Number.isFinite(rawLimit) &&
      rawLimit > 0
        ? Math.min(
            Math.floor(rawLimit),
            100
          )
        : 30;

    const riskLevel =
      safeInput.riskLevel ===
        "danger" ||
      safeInput.riskLevel ===
        "warning"
        ? safeInput.riskLevel
        : "all";

    return analyzeStudentListRisk({
      context,
      limit,
      riskLevel,
    });
  },
});

export function listRegisteredAiTools() {
  return Array.from(
    toolRegistry.values()
  ).map((tool) => ({
    name: tool.name,
    description: tool.description,
    accessMode: tool.accessMode,
    allowedRoles: tool.allowedRoles,
    requiresOrganization:
      tool.requiresOrganization,
    requiresConfirmation:
      tool.requiresConfirmation,
    autoExecutable:
      tool.autoExecutable,
  }));
}

export function getAiTool(
  toolName: string
) {
  return toolRegistry.get(toolName);
}

export async function executeAiTool<
  TInput = unknown,
  TOutput = unknown
>(params: {
  toolName: AiToolName | string;
  context: AiUserContext;
  input: TInput;
}): Promise<
  AiToolExecutionResult<TOutput>
> {
  const requestId =
    createAiRequestId();

  const startedAt =
    new Date().toISOString();

  const startedTimestamp =
    Date.now();

  const tool =
    getAiTool(params.toolName);

  if (!tool) {
    const finishedAt =
      new Date().toISOString();

    const durationMs =
      Date.now() -
      startedTimestamp;

    await writeAiAuditLog({
      context: params.context,

      requestId,
      toolName: params.toolName,
      status: "failed",

      input: params.input,

      startedAt,
      finishedAt,
      durationMs,

      errorMessage:
        "등록되지 않은 AI Tool입니다.",
    });

    return {
      success: false,
      toolName: params.toolName,

      error: {
        code: "AI_TOOL_NOT_FOUND",
        message:
          "등록되지 않은 AI Tool입니다.",
      },

      meta: {
        requestId,
        startedAt,
        finishedAt,
        durationMs,

        toolName:
          params.toolName,
        status: "failed",

        organizationId:
          params.context
            .organizationId,

        userId:
          params.context.userId,

        userRole:
          params.context.role,

        errorMessage:
          "등록되지 않은 AI Tool입니다.",
      },
    };
  }

  try {
    assertAiToolAllowed({
      context: params.context,
      tool,
    });

    const output =
      await tool.handler({
        context: params.context,
        input: params.input,
        requestId,
      });

    const finishedAt =
      new Date().toISOString();

    const durationMs =
      Date.now() -
      startedTimestamp;

    const outputSummary =
      summarizeAiToolOutput(output);

    await writeAiAuditLog({
      context: params.context,

      requestId,
      toolName: tool.name,
      status: "success",

      input: params.input,
      outputSummary,

      targetStudentId:
        Number(
          (params.input as any)
            ?.studentId || 0
        ) || null,

      startedAt,
      finishedAt,
      durationMs,
    });

    return {
      success: true,
      toolName: tool.name,

      data: output as TOutput,

      meta: {
        requestId,
        startedAt,
        finishedAt,
        durationMs,

        toolName: tool.name,
        status: "success",

        organizationId:
          params.context
            .organizationId,

        userId:
          params.context.userId,

        userRole:
          params.context.role,

        targetStudentId:
          Number(
            (params.input as any)
              ?.studentId || 0
          ) || null,
      },
    };
  } catch (error) {
    const finishedAt =
      new Date().toISOString();

    const durationMs =
      Date.now() -
      startedTimestamp;

    const isPermissionError =
      error instanceof
      AiPermissionError;

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    await writeAiAuditLog({
      context: params.context,

      requestId,
      toolName: tool.name,

      status: isPermissionError
        ? "denied"
        : "failed",

      input: params.input,

      targetStudentId:
        Number(
          (params.input as any)
            ?.studentId || 0
        ) || null,

      startedAt,
      finishedAt,
      durationMs,

      errorMessage,
    });

    return {
      success: false,
      toolName: tool.name,

      error: {
        code: isPermissionError
          ? "AI_PERMISSION_DENIED"
          : "AI_TOOL_EXECUTION_FAILED",

        message: errorMessage,
      },

      meta: {
        requestId,
        startedAt,
        finishedAt,
        durationMs,

        toolName: tool.name,

        status: isPermissionError
          ? "denied"
          : "failed",

        organizationId:
          params.context
            .organizationId,

        userId:
          params.context.userId,

        userRole:
          params.context.role,

        targetStudentId:
          Number(
            (params.input as any)
              ?.studentId || 0
          ) || null,

        errorMessage,
      },
    };
  }
}