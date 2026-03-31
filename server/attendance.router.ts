import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import {
  getTodayAttendanceRecord,
  clockInAttendance,
  clockOutAttendance,
  listMyAttendanceRecords,
  listAllAttendanceRecords,
  listTeamAttendanceRecords,
  updateAttendanceRecordByManager,
  listAttendanceAdjustmentLogs,
  listTeamAttendanceAdjustmentLogs,
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
    const userId = Number(ctx.user.id);

    // 호스트/슈퍼호스트: 전체 조회
    if (role === "host" || role === "superhost") {
      return await listAllAttendanceRecords();
    }

    // 관리자: 자기 팀만 조회
    if (role === "admin") {
      return await listTeamAttendanceRecords(userId);
    }

    // 직원: 본인만 조회
    return await listMyAttendanceRecords(userId);
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
      const actorUserId = Number(ctx.user.id);

      // 호스트/슈퍼호스트/관리자까지만 수정 가능
      if (role !== "host" && role !== "superhost" && role !== "admin") {
        throw new Error("근태 수정 권한이 없습니다.");
      }

      return await updateAttendanceRecordByManager({
        attendanceId: input.attendanceId,
        actorUserId,
        actorRole: role,
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
      const userId = Number(ctx.user.id);

      // 호스트/슈퍼호스트: 전체 수정 로그
      if (role === "host" || role === "superhost") {
        return await listAttendanceAdjustmentLogs(input.attendanceId);
      }

      // 관리자: 자기 팀 수정 로그만
      if (role === "admin") {
        return await listTeamAttendanceAdjustmentLogs(
          userId,
          input.attendanceId
        );
      }

      throw new Error("수정 로그 조회 권한이 없습니다.");
    }),
});