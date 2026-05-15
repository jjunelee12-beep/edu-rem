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
getAttendancePolicy,
saveAttendancePolicy,
updateAttendanceStatusByManager,
} from "./db";

function getCtxOrganizationId(ctx: any) {
  const organizationId = Number(
    ctx?.organizationId ||
      ctx?.user?.organizationId ||
      ctx?.user?.organization?.id ||
      0
  );

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  return organizationId;
}

export const attendanceRouter = router({
  today: protectedProcedure.query(async ({ ctx }) => {
  return await getTodayAttendanceRecord(Number(ctx.user.id), {
    organizationId: getCtxOrganizationId(ctx),
  });
}),

  clockIn: protectedProcedure.mutation(async ({ ctx }) => {
  return await clockInAttendance(Number(ctx.user.id), {
    organizationId: getCtxOrganizationId(ctx),
  });
}),

  clockOut: protectedProcedure.mutation(async ({ ctx }) => {
  return await clockOutAttendance(Number(ctx.user.id), {
    organizationId: getCtxOrganizationId(ctx),
  });
}),

  myList: protectedProcedure.query(async ({ ctx }) => {
  return await listMyAttendanceRecords(Number(ctx.user.id), {
    organizationId: getCtxOrganizationId(ctx),
  });
}),

  list: protectedProcedure.query(async ({ ctx }) => {
    const role = String(ctx.user.role || "");
    const userId = Number(ctx.user.id);

    // 호스트/슈퍼호스트: 전체 조회
    if (role === "host") {
      return await listAllAttendanceRecords({
  organizationId: getCtxOrganizationId(ctx),
});
    }

    // 관리자: 자기 팀만 조회
    if (role === "admin") {
      return await listTeamAttendanceRecords(userId, {
  organizationId: getCtxOrganizationId(ctx),
});
    }

    // 직원: 본인만 조회
    return await listMyAttendanceRecords(userId, {
  organizationId: getCtxOrganizationId(ctx),
});
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
      if (role !== "host" && role !== "admin") {
        throw new Error("근태 수정 권한이 없습니다.");
      }

      return await updateAttendanceRecordByManager({
  organizationId: getCtxOrganizationId(ctx),
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
      if (role === "host") {
        return await listAttendanceAdjustmentLogs(input.attendanceId, {
  organizationId: getCtxOrganizationId(ctx),
});
      }

      // 관리자: 자기 팀 수정 로그만
      if (role === "admin") {
        return await listTeamAttendanceAdjustmentLogs(userId, input.attendanceId, {
  organizationId: getCtxOrganizationId(ctx),
});
      }

      throw new Error("수정 로그 조회 권한이 없습니다.");
    }),

	  getPolicy: protectedProcedure.query(async ({ ctx }) => {
    const role = String(ctx.user.role || "");

    if (role !== "host") {
      throw new Error("근무시간 설정 조회 권한이 없습니다.");
    }

    return await getAttendancePolicy({
  organizationId: getCtxOrganizationId(ctx),
});
  }),

  savePolicy: protectedProcedure
    .input(
      z.object({
        workStartHour: z.number().int().min(0).max(23),
        workStartMinute: z.number().int().min(0).max(59),
        workEndHour: z.number().int().min(0).max(23),
        workEndMinute: z.number().int().min(0).max(59),
        autoClockOutEnabled: z.boolean(),
        autoClockOutHour: z.number().int().min(0).max(23),
        autoClockOutMinute: z.number().int().min(0).max(59),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = String(ctx.user.role || "");
      if (role !== "host") {
        throw new Error("근무시간 설정 저장 권한이 없습니다.");
      }

      return await saveAttendancePolicy({
  organizationId: getCtxOrganizationId(ctx),
  actorUserId: Number(ctx.user.id),
  ...input,
});
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        attendanceId: z.number(),
        status: z.enum([
          "출근전",
          "근무중",
          "퇴근완료",
          "지각",
          "조퇴",
          "병가",
          "연차",
          "출장",
          "반차",
          "결근",
        ]),
        reason: z.string().max(255).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = String(ctx.user.role || "");
      const actorUserId = Number(ctx.user.id);

      if (role !== "host" && role !== "admin") {
        throw new Error("상태 수정 권한이 없습니다.");
      }

      return await updateAttendanceStatusByManager({
  organizationId: getCtxOrganizationId(ctx),
  attendanceId: input.attendanceId,
  actorUserId,
  actorRole: role,
  status: input.status,
  reason: input.reason ?? null,
});
    }),
});