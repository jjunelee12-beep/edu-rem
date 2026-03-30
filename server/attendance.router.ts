import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import {
  getTodayAttendanceRecord,
  clockInAttendance,
  clockOutAttendance,
  listMyAttendanceRecords,
  listAllAttendanceRecords,
  updateAttendanceRecordByManager,
  listAttendanceAdjustmentLogs,
} from "./db";

export const attendanceRouter = router({
  today: protectedProcedure.query(async ({ ctx }) => {
    return await getTodayAttendanceRecord(Number(ctx.user.id));
  }),

  clockIn: protectedProcedure.mutation(async ({ ctx }) => {
    return await clockInAttendance(Number(ctx.user.id));
  }),

  clockOut: protectedProcedure.mutation(async ({ ctx }) => {
    return await clockOutAttendance(Number(ctx.user.id));
  }),

  myList: protectedProcedure.query(async ({ ctx }) => {
    return await listMyAttendanceRecords(Number(ctx.user.id));
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const role = String(ctx.user.role || "");

    if (role === "host" || role === "superhost") {
      return await listAllAttendanceRecords();
    }

    return await listMyAttendanceRecords(Number(ctx.user.id));
  }),


  updateByManager: protectedProcedure
    .input(
      z.object({
        attendanceId: z.number(),
        clockInAt: z.string().nullable().optional(),
        clockOutAt: z.string().nullable().optional(),
        reason: z.string().max(255).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = String(ctx.user.role || "");
      if (role !== "host" && role !== "superhost") {
        throw new Error("근태 수정 권한이 없습니다.");
      }

      return await updateAttendanceRecordByManager({
        attendanceId: input.attendanceId,
        actorUserId: Number(ctx.user.id),
        clockInAt: input.clockInAt ?? null,
        clockOutAt: input.clockOutAt ?? null,
        reason: input.reason ?? null,
      });
    }),

  adjustmentLogs: protectedProcedure
    .input(
      z.object({
        attendanceId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const role = String(ctx.user.role || "");
      if (role !== "host" && role !== "superhost") {
        throw new Error("수정 로그 조회 권한이 없습니다.");
      }

      return await listAttendanceAdjustmentLogs(input.attendanceId);
    }),
});