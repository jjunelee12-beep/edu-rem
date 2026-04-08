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
} from "../db";
import { emitLiveNotification } from "../_core/live-notifications";

function assertLoggedIn(user: any) {
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }
}

function canCreateGlobalSchedule(user: any) {
  return user?.role === "host" || user?.role === "superhost";
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

  const rows = await listMonthSchedules(input.year, input.month);

  return (rows as any[]).map((row: any) => ({
    id: Number(row.id),
    title: row.title ?? "",
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

  const rows = await listTodaySchedules(Number(ctx.user.id), String(ctx.user.role));

  return (rows as any[]).map((row: any) => ({
    id: Number(row.id),
    title: row.title ?? "",
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
        title: z.string().trim().min(1, "일정 제목을 입력해주세요.").max(255),
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

      const globalAllowed = canCreateGlobalSchedule(ctx.user);
const scope = globalAllowed && input.isGlobal ? "global" : "personal";

const startAt = buildDateTimeString(
  input.date,
  input.ampm,
  input.hour,
  input.minute
);

const id = await createSchedule({
  title: input.title,
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
        ok: true,
        id: Number(id),
        startAt,
      };
    }),

  // 수정
  update: protectedProcedure
    .input(
      z.object({
        id: z.coerce.number(),
        title: z.string().trim().min(1, "일정 제목을 입력해주세요.").max(255),
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

     await updateSchedule(
  input.id,
  Number(ctx.user.id),
  String(ctx.user.role),
  {
    title: input.title,
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
  String(ctx.user.role)
);

      return { ok: true };
    }),
};