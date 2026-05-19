import { z } from "zod";
import { sql } from "drizzle-orm";
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
  getDb,
} from "./db";
import { throwAppError } from "./_core/appError";
import { ERROR_CODES } from "./_core/errorCodes";

async function getCtxOrganizationId(ctx: any) {
  const directOrganizationId = Number(
    ctx?.organizationId ??
      ctx?.user?.organizationId ??
      ctx?.user?.organization_id ??
      ctx?.user?.organization?.id ??
      ctx?.session?.organizationId ??
      ctx?.session?.user?.organizationId ??
      ctx?.auth?.organizationId ??
      0
  );

  if (Number.isFinite(directOrganizationId) && directOrganizationId > 0) {
    return directOrganizationId;
  }

  const userId = Number(ctx?.user?.id || 0);

  if (userId > 0) {
    const db = await getDb();

    if (db) {
      const [rows] = await db.execute(sql`
        SELECT organizationId
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `);

      const row = Array.isArray(rows) ? (rows as any[])[0] : null;
      const organizationId = Number(row?.organizationId || 0);

      if (Number.isFinite(organizationId) && organizationId > 0) {
        return organizationId;
      }
    }
  }

  throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
}

export const attendanceRouter = router({
  today: protectedProcedure.query(async ({ ctx }) => {
    return await getTodayAttendanceRecord(Number(ctx.user.id), {
      organizationId: await getCtxOrganizationId(ctx),
    });
  }),

  clockIn: protectedProcedure.mutation(async ({ ctx }) => {
    return await clockInAttendance(Number(ctx.user.id), {
      organizationId: await getCtxOrganizationId(ctx),
    });
  }),

  clockOut: protectedProcedure.mutation(async ({ ctx }) => {
    return await clockOutAttendance(Number(ctx.user.id), {
      organizationId: await getCtxOrganizationId(ctx),
    });
  }),

  myList: protectedProcedure.query(async ({ ctx }) => {
    return await listMyAttendanceRecords(Number(ctx.user.id), {
      organizationId: await getCtxOrganizationId(ctx),
    });
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const role = String(ctx.user.role || "");
    const userId = Number(ctx.user.id);
    const organizationId = await getCtxOrganizationId(ctx);

    if (role === "host") {
      return await listAllAttendanceRecords({ organizationId });
    }

    if (role === "admin") {
      return await listTeamAttendanceRecords(userId, { organizationId });
    }

    return await listMyAttendanceRecords(userId, { organizationId });
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

      if (role !== "host" && role !== "admin") {
        throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "근태 수정 권한이 없습니다.",
  403
);
      }

      return await updateAttendanceRecordByManager({
        organizationId: await getCtxOrganizationId(ctx),
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
      const organizationId = await getCtxOrganizationId(ctx);

      if (role === "host") {
        return await listAttendanceAdjustmentLogs(input.attendanceId, {
          organizationId,
        });
      }

      if (role === "admin") {
        return await listTeamAttendanceAdjustmentLogs(
          userId,
          input.attendanceId,
          { organizationId }
        );
      }

      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "수정 로그 조회 권한이 없습니다.",
  403
);
    }),

  getPolicy: protectedProcedure.query(async ({ ctx }) => {
    const role = String(ctx.user.role || "");

    if (role !== "host") {
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "근무시간 설정 조회 권한이 없습니다.",
  403
);
    }

    return await getAttendancePolicy({
      organizationId: await getCtxOrganizationId(ctx),
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
        throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "근무시간 설정 저장 권한이 없습니다.",
  403
);
      }

      return await saveAttendancePolicy({
        organizationId: await getCtxOrganizationId(ctx),
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
        throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "상태 수정 권한이 없습니다.",
  403
);
      }

      return await updateAttendanceStatusByManager({
        organizationId: await getCtxOrganizationId(ctx),
        attendanceId: input.attendanceId,
        actorUserId,
        actorRole: role,
        status: input.status,
        reason: input.reason ?? null,
      });
    }),
});