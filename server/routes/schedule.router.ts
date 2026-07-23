import { z } from "zod";
import { protectedProcedure } from "../_core/trpc";
import {
  listMonthSchedules,
  listTodaySchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  createNotification,
  getAllUsersDetailed,
  getStudentById,
} from "../db";
import { emitLiveNotification } from "../_core/live-notifications";
import { throwAppError } from "../_core/appError";
import { ERROR_CODES } from "../_core/errorCodes";

function assertLoggedIn(user: any) {
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }
}

function getCtxOrganizationId(ctx: any) {
  const organizationId = Number(
    ctx?.organizationId ??
      ctx?.user?.organizationId ??
      ctx?.user?.organization_id ??
      ctx?.user?.organization?.id ??
      ctx?.session?.organizationId ??
      ctx?.session?.user?.organizationId ??
      0
  );

  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    throwAppError(
      ERROR_CODES.ORGANIZATION_REQUIRED,
      "organizationId is required",
      400
    );
  }

  return organizationId;
}

function canCreateGlobalSchedule(user: any) {
  return user?.role === "host" || user?.role === "superhost";
}

async function resolveScheduleStudentId(
  params: {
    ctx:
      any;

    studentId?:
      number |
      null;
  }
): Promise<number | null> {
  const rawStudentId =
    params.studentId;

  if (
    rawStudentId ===
      null ||
    rawStudentId ===
      undefined
  ) {
    return null;
  }

  const studentId =
    Number(
      rawStudentId
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <=
      0
  ) {
    throwAppError(
      ERROR_CODES
        .INVALID_REQUEST,
      "올바른 학생 ID가 필요합니다.",
      400
    );
  }

  const organizationId =
    getCtxOrganizationId(
      params.ctx
    );

  const student =
    await getStudentById(
      studentId,
      {
        organizationId,
      }
    );

  if (!student) {
    throwAppError(
      ERROR_CODES
        .DATA_NOT_FOUND,
      "연결할 학생을 찾을 수 없습니다.",
      404
    );
  }

  const role =
    String(
      params.ctx
        ?.user
        ?.role ||
      ""
    );

  const userId =
    Number(
      params.ctx
        ?.user
        ?.id ||
      0
    );

  /**
   * Host와 Superhost는
   * 현재 조직의 모든 학생 일정 연결 가능
   */
  if (
    role ===
      "host" ||
    role ===
      "superhost"
  ) {
    return studentId;
  }

  /**
   * 현재 팀 정보가 없는 일정 Router에서는
   * Admin도 임의의 다른 담당자 학생에
   * 일정을 연결하지 못하도록 제한한다.
   *
   * 추후 Admin 팀 범위 조회 함수가 확인되면
   * 팀 담당 학생까지 확장할 수 있다.
   */
  if (
    Number(
      student.assigneeId ||
      0
    ) ===
    userId
  ) {
    return studentId;
  }

  throwAppError(
    ERROR_CODES
      .PERMISSION_DENIED,
    "본인 담당 학생 또는 조직 관리자만 학생 일정을 등록할 수 있습니다.",
    403
  );
}

function to24Hour(ampm: "AM" | "PM", hour12: number) {
  const h = Number(hour12);

  if (ampm === "AM") {
    return h === 12 ? 0 : h;
  }

  return h === 12 ? 12 : h + 12;
}

function buildDateTimeString(
  scheduleDate: string,
  meridiem: "AM" | "PM",
  hour12: number,
  minute: number
) {
  const hour24 = to24Hour(meridiem, hour12);
  const hh = String(hour24).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${scheduleDate} ${hh}:${mm}:00`;
}

export const scheduleRouter = {
  // 월별 일정 조회
  listMonth: protectedProcedure
    .input(
      z.object({
        year: z.coerce.number().int().min(2000).max(2100),
        month: z.coerce.number().int().min(1).max(12),
      })
    )
    .query(async ({ ctx, input }) => {
  assertLoggedIn(ctx.user);

  const rows = await listMonthSchedules(input.year, input.month, {
  organizationId: getCtxOrganizationId(ctx),
});

  return (rows as any[]).map((row: any) => ({
  id:
    Number(
      row.id
    ),

  studentId:
    row.studentId ===
      null ||
    row.studentId ===
      undefined
      ? null
      : Number(
          row.studentId
        ),

  title:
    row.title ??
    "",
    description: row.description ?? "",
    date: String(row.scheduleDate ?? row.date ?? ""),
    ampm: (row.meridiem ?? row.ampm ?? "AM") as "AM" | "PM",
    hour: Number(row.hour12 ?? row.hour ?? 9),
    minute: Number(row.minute ?? 0),
    isGlobal:
      typeof row.isGlobal === "boolean"
        ? row.isGlobal
        : String(row.scope ?? "") === "global",
    userId: Number(row.ownerUserId ?? row.userId ?? 0),
    ownerUserName: row.ownerUserName ?? "",
    scope: row.scope ?? "personal",
    startAt: row.startAt ?? null,
  }));
}),


  // 오늘 일정 조회
 listToday: protectedProcedure.query(async ({ ctx }) => {
  assertLoggedIn(ctx.user);

  const rows = await listTodaySchedules(
  Number(ctx.user.id),
  String(ctx.user.role),
  {
    organizationId: getCtxOrganizationId(ctx),
  }
);

  return (rows as any[]).map((row: any) => ({
  id:
    Number(
      row.id
    ),

  studentId:
    row.studentId ===
      null ||
    row.studentId ===
      undefined
      ? null
      : Number(
          row.studentId
        ),

  title:
    row.title ??
    "",
    description: row.description ?? "",
    date: String(row.scheduleDate ?? row.date ?? ""),
    ampm: (row.meridiem ?? row.ampm ?? "AM") as "AM" | "PM",
    hour: Number(row.hour12 ?? row.hour ?? 9),
    minute: Number(row.minute ?? 0),
    isGlobal:
      typeof row.isGlobal === "boolean"
        ? row.isGlobal
        : String(row.scope ?? "") === "global",
    userId: Number(row.ownerUserId ?? row.userId ?? 0),
    ownerUserName: row.ownerUserName ?? "",
    scope: row.scope ?? "personal",
    startAt: row.startAt ?? null,
  }));
}),

  // 생성
  create: protectedProcedure
    .input(
      z.object({
  studentId:
    z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .nullable(),

  title:
    z.string()
      .trim()
      .min(
        1,
        "일정 제목을 입력해주세요."
      )
      .max(
        255
      ),
        description: z.string().trim().optional().default(""),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다."),
        ampm: z.enum(["AM", "PM"]),
        hour: z.coerce.number().int().min(1).max(12),
        minute: z.coerce.number().int().min(0).max(59),
        isGlobal: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertLoggedIn(ctx.user);

const studentId =
  await resolveScheduleStudentId({
    ctx,

    studentId:
      input.studentId ??
      null,
  });

      const globalAllowed = canCreateGlobalSchedule(ctx.user);
const scope = globalAllowed && input.isGlobal ? "global" : "personal";

const startAt = buildDateTimeString(
  input.date,
  input.ampm,
  input.hour,
  input.minute
);

const id =
  await createSchedule({
    organizationId:
      getCtxOrganizationId(
        ctx
      ),

    studentId,

    title:
      input.title,
  description: input.description,
  scheduleDate: input.date,
  meridiem: input.ampm,
  hour12: input.hour,
  minute: input.minute,
  startAt,
  scope,
  ownerUserId: Number(ctx.user.id),
  ownerUserName: String(ctx.user.name ?? ""),
  createdByRole: String(ctx.user.role) as "staff" | "admin" | "host" | "superhost",
});

      return {
  ok:
    true,

  id:
    Number(
      id
    ),

  studentId,

  startAt,
};
    }),

  // 수정
  update: protectedProcedure
    .input(
     z.object({
  id:
    z.coerce
      .number()
      .int()
      .positive(),

  studentId:
    z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .nullable(),

  title:
    z.string()
      .trim()
      .min(
        1,
        "일정 제목을 입력해주세요."
      )
      .max(
        255
      ),
        description: z.string().trim().optional().default(""),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다."),
        ampm: z.enum(["AM", "PM"]),
        hour: z.coerce.number().int().min(1).max(12),
        minute: z.coerce.number().int().min(0).max(59),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertLoggedIn(ctx.user);

      const startAt = buildDateTimeString(
        input.date,
        input.ampm,
        input.hour,
        input.minute
      );

const hasStudentIdInput =
  Object.prototype
    .hasOwnProperty
    .call(
      input,
      "studentId"
    );

const studentId =
  hasStudentIdInput
    ? await resolveScheduleStudentId({
        ctx,

        studentId:
          input.studentId ??
          null,
      })
    : undefined;

     await updateSchedule(
  input.id,
  Number(ctx.user.id),
  String(ctx.user.role),
{
  organizationId:
    getCtxOrganizationId(
      ctx
    ),

  ...(
    hasStudentIdInput
      ? {
          studentId,
        }
      : {}
  ),

  title:
    input.title,
    description: input.description,
    scheduleDate: input.date,
    meridiem: input.ampm,
    hour12: input.hour,
    minute: input.minute,
    startAt: buildDateTimeString(input.date, input.ampm, input.hour, input.minute),
  }
);

      return { ok: true };
    }),

  // 삭제
  delete: protectedProcedure
    .input(
      z.object({
        id: z.coerce.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertLoggedIn(ctx.user);

      await deleteSchedule(
  input.id,
  Number(ctx.user.id),
  String(ctx.user.role),
  {
    organizationId: getCtxOrganizationId(ctx),
  }
);

      return { ok: true };
    }),
};