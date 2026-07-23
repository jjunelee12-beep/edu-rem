import * as db from "../db";

import {
  AiPermissionError,
  assertAiToolAllowed,
  assertCanAccessConsultation,
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

ConsultationUpdateToolInput,
ConsultationUpdateToolOutput,

  MissingDataAlertToolInput,
  MissingDataAlertToolOutput,

  StudentSearchToolInput,
  StudentSearchToolOutput,

    StudentSummaryToolInput,
  StudentSummaryToolOutput,

StudentUpdateToolInput,
StudentUpdateToolOutput,

    StudentDashboardToolInput,
  StudentDashboardToolOutput,

  ScheduleCreateToolInput,
  ScheduleCreateToolOutput,

  StudentDetailRiskToolInput,
  StudentDetailRiskToolOutput,

  StudentListRiskToolInput,
  StudentListRiskToolOutput,
} from "./ai.types";

import {
  analyzeStudentDetailRisk,
  analyzeStudentListRisk,
} from "./ai-risk-engine";

import {
  getStudentDashboard,
} from "./student-dashboard";

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

function normalizeConsultationUpdateText(
  value:
    unknown,

  maxLength:
    number
): string | null {
  if (
    value === null
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

function normalizeStudentUpdateText(
  value:
    unknown,

  maxLength:
    number
): string | null {
  /**
   * 명시적으로 null을 전달하면
   * 기존 값을 비우는 요청으로 처리한다.
   */
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

function buildScheduleStartAt(params: {
  scheduleDate:
    string;

  meridiem:
    "AM" |
    "PM";

  hour12:
    number;

  minute:
    number;
}): string {
  const dateMatched =
    /^\d{4}-\d{2}-\d{2}$/.test(
      params.scheduleDate
    );

  if (!dateMatched) {
    throw new Error(
      "일정 날짜는 YYYY-MM-DD 형식이어야 합니다."
    );
  }

  const hour12 =
    normalizePositiveInteger(
      params.hour12
    );

  if (
    hour12 < 1 ||
    hour12 > 12
  ) {
    throw new Error(
      "일정 시간은 1시부터 12시 사이여야 합니다."
    );
  }

  const minute =
    Number(
      params.minute
    );

  if (
    !Number.isFinite(
      minute
    ) ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(
      "일정 분은 0분부터 59분 사이여야 합니다."
    );
  }

  let hour24 =
    hour12 %
    12;

  if (
    params.meridiem ===
    "PM"
  ) {
    hour24 +=
      12;
  }

  return `${params.scheduleDate} ${String(
    hour24
  ).padStart(
    2,
    "0"
  )}:${String(
    Math.floor(
      minute
    )
  ).padStart(
    2,
    "0"
  )}:00`;
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
 * 학생 기본정보 수정 승인 초안
 *
 * 이 Tool은 students 테이블을 직접 수정하지 않는다.
 * 현재 학생 값과 변경할 값을 비교하고
 * Pending Action 생성에 사용할 초안만 반환한다.
 */
registerTool<
  StudentUpdateToolInput,
  StudentUpdateToolOutput
>({
  name:
    "student.update",

  description:
    "현재 사용자가 담당하는 학생의 상태, 과정, 최종학력, 주소 정보를 수정하기 위한 승인 초안을 생성합니다.",

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  /**
   * 실제 수정은 Pending Action 승인 후
   * student-update-executor에서 실행한다.
   */
  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as StudentUpdateToolInput;

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (
      studentId <=
      0
    ) {
      throw new Error(
        "수정할 학생 ID가 필요합니다."
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
        "수정할 학생 정보를 찾을 수 없습니다."
      );
    }

    /**
     * 초안 단계에서는 조회 가능 범위를 확인한다.
     *
     * 실제 실행 단계에서는
     * assertCanWriteStudent()로
     * 본인 담당 학생인지 다시 검사한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    const hasStatusUpdate =
      safeInput.status !==
      undefined;

    const hasCourseUpdate =
      safeInput.course !==
      undefined;

    const hasFinalEducationUpdate =
      safeInput.finalEducation !==
      undefined;

    const hasAddressUpdate =
      safeInput.address !==
      undefined;

    const hasDetailAddressUpdate =
      safeInput.detailAddress !==
      undefined;

    if (
      !hasStatusUpdate &&
      !hasCourseUpdate &&
      !hasFinalEducationUpdate &&
      !hasAddressUpdate &&
      !hasDetailAddressUpdate
    ) {
      throw new Error(
        "변경할 학생 정보가 필요합니다."
      );
    }

    const currentStatus =
      normalizeStudentUpdateText(
        (student as any)
          .status,
        100
      );

    const currentCourse =
      normalizeStudentUpdateText(
        (student as any)
          .course,
        255
      );

    const currentFinalEducation =
      normalizeStudentUpdateText(
        (student as any)
          .finalEducation,
        100
      );

    const currentAddress =
      normalizeStudentUpdateText(
        (student as any)
          .address,
        500
      );

    const currentDetailAddress =
      normalizeStudentUpdateText(
        (student as any)
          .detailAddress,
        500
      );

    const nextStatus =
      hasStatusUpdate
        ? normalizeStudentUpdateText(
            safeInput.status,
            100
          )
        : currentStatus;

    const nextCourse =
      hasCourseUpdate
        ? normalizeStudentUpdateText(
            safeInput.course,
            255
          )
        : currentCourse;

    const nextFinalEducation =
      hasFinalEducationUpdate
        ? normalizeStudentUpdateText(
            safeInput.finalEducation,
            100
          )
        : currentFinalEducation;

    const nextAddress =
      hasAddressUpdate
        ? normalizeStudentUpdateText(
            safeInput.address,
            500
          )
        : currentAddress;

    const nextDetailAddress =
      hasDetailAddressUpdate
        ? normalizeStudentUpdateText(
            safeInput.detailAddress,
            500
          )
        : currentDetailAddress;

    const changes:
      StudentUpdateToolOutput["changes"] =
      [];

    if (
      hasStatusUpdate &&
      currentStatus !==
        nextStatus
    ) {
      changes.push({
        field:
          "status",

        label:
          "학생 상태",

        before:
          currentStatus,

        after:
          nextStatus,
      });
    }

    if (
      hasCourseUpdate &&
      currentCourse !==
        nextCourse
    ) {
      changes.push({
        field:
          "course",

        label:
          "진행 과정",

        before:
          currentCourse,

        after:
          nextCourse,
      });
    }

    if (
      hasFinalEducationUpdate &&
      currentFinalEducation !==
        nextFinalEducation
    ) {
      changes.push({
        field:
          "finalEducation",

        label:
          "최종학력",

        before:
          currentFinalEducation,

        after:
          nextFinalEducation,
      });
    }

    if (
      hasAddressUpdate &&
      currentAddress !==
        nextAddress
    ) {
      changes.push({
        field:
          "address",

        label:
          "주소",

        before:
          currentAddress,

        after:
          nextAddress,
      });
    }

    if (
      hasDetailAddressUpdate &&
      currentDetailAddress !==
        nextDetailAddress
    ) {
      changes.push({
        field:
          "detailAddress",

        label:
          "상세주소",

        before:
          currentDetailAddress,

        after:
          nextDetailAddress,
      });
    }

    if (
      changes.length ===
      0
    ) {
      throw new Error(
        "현재 학생 정보와 변경할 값이 동일합니다."
      );
    }

    const updates:
      StudentUpdateToolOutput["draft"]["updates"] =
      {};

    if (
      hasStatusUpdate &&
      currentStatus !==
        nextStatus
    ) {
      updates.status =
        nextStatus;
    }

    if (
      hasCourseUpdate &&
      currentCourse !==
        nextCourse
    ) {
      updates.course =
        nextCourse;
    }

    if (
      hasFinalEducationUpdate &&
      currentFinalEducation !==
        nextFinalEducation
    ) {
      updates.finalEducation =
        nextFinalEducation;
    }

    if (
      hasAddressUpdate &&
      currentAddress !==
        nextAddress
    ) {
      updates.address =
        nextAddress;
    }

    if (
      hasDetailAddressUpdate &&
      currentDetailAddress !==
        nextDetailAddress
    ) {
      updates.detailAddress =
        nextDetailAddress;
    }

    const studentName =
      normalizeStudentUpdateText(
        (student as any)
          .clientName,
        100
      );

    const warnings:
      string[] =
      [];

    if (
      updates.status ===
      null
    ) {
      warnings.push(
        "학생 상태가 비어 있는 값으로 변경됩니다."
      );
    }

    if (
      updates.course ===
      null
    ) {
      warnings.push(
        "학생 진행 과정이 비어 있는 값으로 변경됩니다."
      );
    }

    if (
      updates.finalEducation ===
      null
    ) {
      warnings.push(
        "학생 최종학력이 비어 있는 값으로 변경됩니다."
      );
    }

    const createdAt =
      new Date()
        .toISOString();

    return {
      pendingActionRequired:
        true,

      studentId,

      studentName,

      changes,

      draft: {
        studentId,

        studentName,

        originalValues: {
          status:
            currentStatus,

          course:
            currentCourse,

          finalEducation:
            currentFinalEducation,

          address:
            currentAddress,

          detailAddress:
            currentDetailAddress,
        },

        updates,

        requestedByUserId:
          context.userId,

        requestedByRole:
          context.role,

        createdAt,
      },

      preview: {
        title:
          "학생 기본정보 수정",

        summary:
          `${
            studentName ||
            `학생 #${studentId}`
          }의 기본정보 ${changes.length}개 항목을 수정합니다.`,

        sections: [
          {
            title:
              "수정 대상 학생",

            items: [
              `학생 번호 · ${studentId}`,
              `학생명 · ${studentName || "확인 필요"}`,
            ],
          },
        ],

        changes,

        executionSteps: [
          "현재 학생정보와 초안 생성 당시 값을 다시 비교합니다.",
          "로그인 사용자의 조직과 학생 접근 범위를 다시 확인합니다.",
          "현재 로그인 사용자가 실제 담당자인지 다시 확인합니다.",
          "승인된 변경 항목만 학생 기본정보에 반영합니다.",
          "AI 실행 결과와 변경 내역을 기록합니다.",
        ],

        missingFields:
          [],

        warnings,

        canConfirm:
          changes.length >
          0,
      },
    };
  },
});

/**
 * 학생 종합 업무 현황
 *
 * 학생 기본정보, 학기, 과목, 학점,
 * 결제, 실습, 위험요소 및 다음 업무를
 * 한 번에 조회한다.
 */
registerTool<
  StudentDashboardToolInput,
  StudentDashboardToolOutput
>({
  name:
    "student.dashboard",

  description:
    "현재 사용자가 접근 가능한 학생 한 명의 기본정보, 학기, 과목, 학점, 결제, 실습, 위험요소와 다음 처리 업무를 종합 조회합니다.",

  accessMode:
    "read",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  requiresConfirmation:
    false,

  autoExecutable:
    true,

  handler: async ({
    context,
    input,
  }) => {
    /**
     * 프론트에서 전달한 organizationId,
     * assigneeId, role 등의 권한값을 제거한다.
     */
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as StudentDashboardToolInput;

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

    /**
     * 실제 조직 범위와 학생 접근 권한 검사는
     * getStudentDashboard 내부에서 다시 확인한다.
     */
    return getStudentDashboard({
      context,
      studentId:
        Math.floor(
          studentId
        ),
    });
  },
});

/**
 * 학생 일정 등록 초안
 *
 * 이 Tool은 schedules 테이블을 직접 수정하지 않는다.
 * 학생 및 권한을 검증한 뒤
 * Pending Action 생성에 사용할 일정 초안을 반환한다.
 */
registerTool<
  ScheduleCreateToolInput,
  ScheduleCreateToolOutput
>({
  name:
    "schedule.create",

  description:
    "현재 사용자가 접근 가능한 학생에게 연결할 일정 등록 초안을 생성합니다. 실제 일정 등록은 사용자의 최종 승인 후 실행합니다.",

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  /**
   * 이 Tool 자체는 DB를 수정하지 않고
   * 승인용 초안만 반환하므로 false다.
   *
   * 실제 일정 Executor가 승인 이후 실행된다.
   */
  requiresConfirmation:
    false,

  autoExecutable:
    true,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as ScheduleCreateToolInput;

    const studentId =
      normalizePositiveInteger(
        safeInput.studentId
      );

    if (!studentId) {
      throw new Error(
        "일정을 연결할 올바른 학생 ID가 필요합니다."
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
        "일정을 연결할 학생을 찾을 수 없습니다."
      );
    }

    /**
     * Staff/Admin/Host/Superhost별
     * 학생 접근 가능 범위를 검사한다.
     */
    assertCanAccessStudent({
      context,
      student,
    });

    const title =
      normalizeNullableText(
        safeInput.title,
        255
      );

    if (!title) {
      throw new Error(
        "일정 제목을 입력해주세요."
      );
    }

    const description =
      normalizeNullableText(
        safeInput.description,
        2000
      );

    const scheduleDate =
      String(
        safeInput.scheduleDate ||
        ""
      ).trim();

    const meridiem =
      safeInput.meridiem ===
        "PM"
        ? "PM"
        : safeInput.meridiem ===
            "AM"
          ? "AM"
          : null;

    if (!meridiem) {
      throw new Error(
        "일정 오전·오후 구분이 필요합니다."
      );
    }

    const hour12 =
      normalizePositiveInteger(
        safeInput.hour12
      );

    const minute =
      Number(
        safeInput.minute
      );

    const startAt =
      buildScheduleStartAt({
        scheduleDate,
        meridiem,
        hour12,
        minute,
      });

    /**
 * 회사 공용 일정은 Host만 요청할 수 있다.
 *
 * Superhost는 조회 및 점검만 가능하고
 * CRM 쓰기 초안도 생성하지 않는다.
 */
const globalRequested =
  safeInput.isGlobal ===
  true;

const globalAllowed =
  context.role ===
  "host";

if (
  globalRequested &&
  !globalAllowed
) {
  throw new Error(
    "회사 전체 일정은 Host만 등록할 수 있습니다."
  );
}

    const isGlobal =
      globalRequested &&
      globalAllowed;

    const studentName =
      String(
        (student as any)
          .clientName ||
        safeInput.studentName ||
        ""
      ).trim() ||
      null;

    const meridiemLabel =
      meridiem ===
        "PM"
        ? "오후"
        : "오전";

    return {
      pendingActionRequired:
        true,

      studentId,

      studentName,

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

      isGlobal,

      preview: {
        title:
          "학생 일정 등록",

        summary:
          `${studentName || `학생 #${studentId}`} 학생의 일정을 등록합니다.`,

        items: [
          `학생: ${studentName || `학생 #${studentId}`}`,
          `일정명: ${title}`,
          `날짜: ${scheduleDate}`,
          `시간: ${meridiemLabel} ${hour12}시 ${String(
            Math.floor(
              minute
            )
          ).padStart(
            2,
            "0"
          )}분`,
          `공개범위: ${isGlobal ? "회사 전체" : "개인 일정"}`,
          description
            ? `내용: ${description}`
            : "내용: 없음",
        ],

        warnings:
          [],

        canConfirm:
          true,
      },
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
 * 상담DB 수정 승인 초안
 *
 * 이 Tool은 consultations 테이블을 직접 수정하지 않는다.
 * 현재 값과 변경값을 비교하여 승인용 초안만 반환한다.
 */
registerTool<
  ConsultationUpdateToolInput,
  ConsultationUpdateToolOutput
>({
  name:
    "consultation.update",

  description:
    "현재 사용자가 접근 가능한 상담DB의 상담 상태 또는 상담내용을 수정하기 위한 승인 초안을 생성합니다.",

  accessMode:
    "draft",

  allowedRoles: [
    "staff",
    "admin",
    "host",
  ],

  requiresOrganization:
    true,

  requiresConfirmation:
    true,

  autoExecutable:
    false,

  handler: async ({
    context,
    input,
  }) => {
    const safeInput =
      stripUntrustedScopeFields(
        (
          input ||
          {}
        ) as Record<
          string,
          unknown
        >
      ) as ConsultationUpdateToolInput;

    const consultationId =
      normalizePositiveInteger(
        safeInput.consultationId
      );

    if (
      consultationId <= 0
    ) {
      throw new Error(
        "상담DB 번호가 필요합니다."
      );
    }

    const consultation =
      await db.getConsultation(
        consultationId,
        {
          organizationId:
            context.organizationId,
        }
      );

    if (!consultation) {
      throw new Error(
        "상담 정보를 찾을 수 없습니다."
      );
    }

    /**
     * Staff는 본인 상담,
     * Admin은 팀 상담,
     * Host는 회사 상담만 접근 가능하다.
     */
    assertCanAccessConsultation({
      context,
      consultation,
    });

    const hasStatusUpdate =
      safeInput.status !==
      undefined;

    const hasNotesUpdate =
      safeInput.notes !==
      undefined;

    if (
      !hasStatusUpdate &&
      !hasNotesUpdate
    ) {
      throw new Error(
        "변경할 상담 상태 또는 상담내용이 필요합니다."
      );
    }

    const currentStatus =
      normalizeConsultationUpdateText(
        (consultation as any)
          .status,
        100
      );

    const currentNotes =
      normalizeConsultationUpdateText(
        (consultation as any)
          .notes,
        5000
      );

    const nextStatus =
      hasStatusUpdate
        ? normalizeConsultationUpdateText(
            safeInput.status,
            100
          )
        : currentStatus;

    const nextNotes =
      hasNotesUpdate
        ? normalizeConsultationUpdateText(
            safeInput.notes,
            5000
          )
        : currentNotes;

    const changes:
      ConsultationUpdateToolOutput["changes"] =
      [];

    if (
      hasStatusUpdate &&
      currentStatus !==
        nextStatus
    ) {
      changes.push({
        field:
          "status",

        label:
          "상담 상태",

        before:
          currentStatus,

        after:
          nextStatus,
      });
    }

    if (
      hasNotesUpdate &&
      currentNotes !==
        nextNotes
    ) {
      changes.push({
        field:
          "notes",

        label:
          "상담 내용",

        before:
          currentNotes,

        after:
          nextNotes,
      });
    }

    if (
      changes.length ===
      0
    ) {
      throw new Error(
        "현재 값과 변경할 값이 동일합니다."
      );
    }

    const updates:
      ConsultationUpdateToolOutput["draft"]["updates"] =
      {};

    if (
      hasStatusUpdate &&
      currentStatus !==
        nextStatus
    ) {
      updates.status =
        nextStatus;
    }

    if (
      hasNotesUpdate &&
      currentNotes !==
        nextNotes
    ) {
      updates.notes =
        nextNotes;
    }

    const clientName =
      normalizeConsultationUpdateText(
        (consultation as any)
          .clientName,
        100
      );

    const phone =
      normalizeConsultationUpdateText(
        (consultation as any)
          .phone,
        30
      );

    const warnings:
      string[] = [];

    if (
      updates.status ===
      null
    ) {
      warnings.push(
        "상담 상태가 비어 있는 값으로 변경됩니다."
      );
    }

    if (
      updates.notes ===
      null
    ) {
      warnings.push(
        "기존 상담내용이 삭제됩니다."
      );
    }

    const createdAt =
      new Date()
        .toISOString();

    return {
      pendingActionRequired:
        true,

      consultationId,

      clientName,

      phone,

      changes,

      draft: {
        consultationId,

        clientName,

        originalValues: {
          status:
            currentStatus,

          notes:
            currentNotes,
        },

        updates,

        requestedByUserId:
          context.userId,

        requestedByRole:
          context.role,

        createdAt,
      },

      preview: {
        title:
          "상담DB 정보 수정",

        summary:
          `${
            clientName ||
            `상담DB ${consultationId}번`
          }의 상담정보 ${changes.length}개 항목을 수정합니다.`,

        sections: [
          {
            title:
              "수정 대상",

            items: [
              `상담DB 번호 · ${consultationId}`,
              `이름 · ${clientName || "확인 필요"}`,
              `연락처 · ${phone || "확인 필요"}`,
            ],
          },
        ],

        changes,

        executionSteps: [
          "현재 상담정보와 초안 생성 당시 값을 다시 비교합니다.",
          "로그인 사용자의 조직 및 담당 범위를 다시 확인합니다.",
          "승인된 변경 항목만 상담DB에 반영합니다.",
          "AI 실행 결과와 변경 내역을 기록합니다.",
        ],

        missingFields:
          [],

        warnings,

        canConfirm:
          changes.length >
          0,
      },
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