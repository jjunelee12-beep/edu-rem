import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  hostProcedure,
  router,
} from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { publicLeadRouter } from "./publicLead.router";
import bcrypt from "bcryptjs";

function isAdminOrHost(user: any) {
  return user?.role === "admin" || user?.role === "host";
}

export const appRouter = router({
  system: systemRouter,
  leadForm: publicLeadRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: -1,
      });
      return { success: true } as const;
    }),
  }),

  users: router({
    list: protectedProcedure.query(async () => db.getAllUsersDetailed()),

    create: hostProcedure
      .input(
        z.object({
          openId: z.string().min(1),
          username: z.string().min(1),
          password: z.string().min(4),
          name: z.string().min(1),
          email: z.string().optional(),
          role: z.enum(["staff", "admin", "host"]).default("staff"),
          bankName: z.string().optional(),
          bankAccount: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const passwordHash = await bcrypt.hash(input.password, 10);

        await db.createUserAccount({
          openId: input.openId.trim(),
          username: input.username.trim(),
          passwordHash,
          name: input.name.trim(),
          email: input.email?.trim() || null,
          role: input.role,
          bankName: input.bankName?.trim() || null,
          bankAccount: input.bankAccount?.trim() || null,
          loginMethod: "manual",
          isActive: true,
        });

        return { success: true };
      }),

    update: hostProcedure
      .input(
        z.object({
          id: z.number(),
          username: z.string().optional(),
          password: z.string().optional(),
          name: z.string().optional(),
          email: z.string().optional(),
          bankName: z.string().optional(),
          bankAccount: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, password, ...rest } = input;

        let passwordHash: string | undefined = undefined;

        if (password !== undefined && password.trim() !== "") {
          passwordHash = await bcrypt.hash(password, 10);
        }

        await db.updateUserAccount(id, {
          username: rest.username?.trim(),
          name: rest.name?.trim(),
          email: rest.email?.trim(),
          bankName: rest.bankName?.trim(),
          bankAccount: rest.bankAccount?.trim(),
          passwordHash,
        });

        return { success: true };
      }),

    updateRole: hostProcedure
      .input(
        z.object({
          id: z.number(),
          role: z.enum(["staff", "admin", "host"]),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.id, input.role);
        return { success: true };
      }),

    updateActive: hostProcedure
      .input(
        z.object({
          id: z.number(),
          isActive: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateUserActive(input.id, input.isActive);
        return { success: true };
      }),
  }),

  leadFormAdmin: router({
    list: hostProcedure.query(async () => {
      return db.listLeadForms();
    }),

    create: hostProcedure
      .input(
        z.object({
          assigneeId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const token =
          "lf_" +
          Math.random().toString(36).slice(2, 10) +
          Date.now().toString(36).slice(-4);

        const id = await db.createLeadForm({
          token,
          assigneeId: input.assigneeId,
          isActive: true,
        } as any);

        return { success: true, id, token };
      }),

    updateActive: hostProcedure
      .input(
        z.object({
          id: z.number(),
          isActive: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateLeadFormActive(input.id, input.isActive);
        return { success: true };
      }),
  }),

  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user) ? undefined : ctx.user.id;
      return db.getDashboardStats(assigneeId);
    }),

    monthApprovals: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user) ? undefined : ctx.user.id;
      return db.getMonthApprovals(assigneeId);
    }),
  }),

  consultation: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user)
        ? undefined
        : Number(ctx.user.id) || 1;

      return db.listConsultations(assigneeId);
    }),

    create: protectedProcedure
      .input(
        z.object({
          consultDate: z.string(),
          channel: z.string(),
          clientName: z.string(),
          phone: z.string().max(30),
          finalEducation: z.string().optional(),
          desiredCourse: z.string().optional(),
          notes: z.string().optional(),
          status: z.string().default("상담중"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const assigneeId = Number(ctx.user.id);
        const safeAssigneeId =
          Number.isFinite(assigneeId) && assigneeId > 0 ? assigneeId : 1;

        const id = await db.createConsultation({
          ...input,
          consultDate: new Date(input.consultDate),
          finalEducation: input.finalEducation ?? "",
          assigneeId: safeAssigneeId,
        } as any);

        return { id };
      }),

    bulkCreate: protectedProcedure
      .input(
        z.object({
          rows: z.array(
            z.object({
              consultDate: z.string(),
              channel: z.string(),
              clientName: z.string(),
              phone: z.string(),
              finalEducation: z.string().optional(),
              desiredCourse: z.string().optional(),
              notes: z.string().optional(),
              status: z.string().default("상담중"),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const assigneeId = Number(ctx.user.id);
        const safeAssigneeId =
          Number.isFinite(assigneeId) && assigneeId > 0 ? assigneeId : 1;

        const dataList = input.rows.map((row) => ({
          ...row,
          consultDate: new Date(row.consultDate),
          finalEducation: row.finalEducation ?? "",
          assigneeId: safeAssigneeId,
        }));

        await db.bulkCreateConsultations(dataList as any);

        return {
          success: true,
          count: dataList.length,
        };
      }),

    importCsv: protectedProcedure
      .input(
        z.object({
          csvText: z.string(),
          hasHeader: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const assigneeId = Number(ctx.user.id);
        const safeAssigneeId =
          Number.isFinite(assigneeId) && assigneeId > 0 ? assigneeId : 1;

        const lines = input.csvText.trim().split("\n").filter((l) => l.trim());
        const startIdx = input.hasHeader ? 1 : 0;
        const rows: any[] = [];

        for (let i = startIdx; i < lines.length; i++) {
          const cols = lines[i].includes("\t")
            ? lines[i].split("\t")
            : lines[i].split(",");

          const consultDateStr =
            cols[0]?.trim() || new Date().toISOString().slice(0, 10);

          const channel = cols[1]?.trim() || "";
          const clientName = cols[2]?.trim() || "";
          const phone = (cols[3]?.trim() || "").replace(/\D/g, "").slice(0, 11);
          const finalEducation = cols[4]?.trim() || "";
          const desiredCourse = cols[5]?.trim() || "";
          const notes = cols[6]?.trim() || "";
          const status = cols[7]?.trim() || "상담중";

          if (!clientName || !phone) continue;

          rows.push({
            consultDate: new Date(consultDateStr),
            channel,
            clientName,
            phone,
            finalEducation,
            desiredCourse,
            notes,
            status,
            assigneeId: safeAssigneeId,
          });
        }

        if (rows.length === 0) {
          throw new Error("유효한 데이터가 없습니다");
        }

        await db.bulkCreateConsultations(rows as any);

        return {
          success: true,
          count: rows.length,
        };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          consultDate: z.string().optional(),
          channel: z.string().optional(),
          clientName: z.string().optional(),
          phone: z.string().optional(),
          finalEducation: z.string().optional(),
          desiredCourse: z.string().optional(),
          notes: z.string().optional(),
          status: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const item = await db.getConsultation(input.id);

        if (!item) {
          throw new Error("상담 기록을 찾을 수 없습니다");
        }

        const myId = Number(ctx.user.id) || 1;

        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throw new Error("권한이 없습니다");
        }

        const { id, ...rest } = input;
        const data: any = { ...rest };

        if (rest.consultDate) {
          data.consultDate = new Date(rest.consultDate);
        }

        if (rest.status === "등록") {
          const existing = await db.getConsultation(id);

          if (existing && existing.status !== "등록") {
            await db.createStudent({
              clientName: existing.clientName,
              phone: existing.phone,
              course: existing.desiredCourse || "",
              assigneeId: existing.assigneeId,
              consultationId: id,
            });

            data.status = "등록";
          }
        }

        await db.updateConsultation(id, data);

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const item = await db.getConsultation(input.id);

        if (!item) {
          throw new Error("상담 기록을 찾을 수 없습니다");
        }

        const myId = Number(ctx.user.id) || 1;

        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throw new Error("권한이 없습니다");
        }

        await db.deleteConsultation(input.id);

        return { success: true };
      }),
  }),
student: router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const assigneeId = isAdminOrHost(ctx.user)
      ? undefined
      : Number(ctx.user.id) || 1;

    return db.listStudents(assigneeId);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const item = await db.getStudent(input.id);
      if (!item) return null;

      if (!isAdminOrHost(ctx.user) && item.assigneeId !== Number(ctx.user.id)) {
        return null;
      }

      return item;
    }),

  paymentSummary: protectedProcedure
    .input(z.object({ studentId: z.number() }))
    .query(async ({ input }) => {
      return db.getStudentPaymentSummary(input.studentId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        clientName: z.string(),
        phone: z.string(),
        course: z.string(),
        startDate: z.string().optional(),
        paymentAmount: z.string().optional(),
        subjectCount: z.number().optional(),
        paymentDate: z.string().optional(),
        institution: z.string().optional(),
        totalSemesters: z.number().optional(),
        consultationId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: any = {
        ...input,
        assigneeId: Number(ctx.user.id) || 1,
      };

      if (input.startDate) data.startDate = new Date(input.startDate);
      if (input.paymentDate) data.paymentDate = new Date(input.paymentDate);

      const id = await db.createStudent(data);
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        clientName: z.string().optional(),
        phone: z.string().optional(),
        course: z.string().optional(),
        status: z.enum(["등록", "종료"]).optional(),
        startDate: z.string().optional(),
        paymentAmount: z.string().optional(),
        subjectCount: z.number().optional(),
        paymentDate: z.string().optional(),
        institution: z.string().optional(),
        totalSemesters: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await db.getStudent(input.id);
      if (!item) throw new Error("학생 기록을 찾을 수 없습니다");

      const myId = Number(ctx.user.id) || 1;
      if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
        throw new Error("권한이 없습니다");
      }

      const { id, ...rest } = input;
      const data: any = { ...rest };

      if (rest.startDate) data.startDate = new Date(rest.startDate);
      if (rest.paymentDate) data.paymentDate = new Date(rest.paymentDate);

      await db.updateStudent(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const item = await db.getStudent(input.id);
      if (!item) throw new Error("학생 기록을 찾을 수 없습니다");

      const myId = Number(ctx.user.id) || 1;
      if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
        throw new Error("권한이 없습니다");
      }

      await db.deleteStudent(input.id);
      return { success: true };
    }),

  approve: adminProcedure
    .input(
      z.object({
        id: z.number(),
        approvalStatus: z.enum(["승인", "불승인"]),
      })
    )
    .mutation(async ({ input }) => {
      const now = new Date();
      const updateData: any = { approvalStatus: input.approvalStatus };

      if (input.approvalStatus === "승인") {
        updateData.approvedAt = now;
        updateData.rejectedAt = null;
      } else {
        updateData.rejectedAt = now;
        updateData.approvedAt = null;
      }

      await db.updateStudent(input.id, updateData);

      if (input.approvalStatus === "승인") {
        const sems = await db.listSemesters(input.id);
        for (const sem of sems) {
          if (!sem.isLocked) {
            await db.updateSemester(sem.id, { isLocked: true });
          }
        }
      }

      return { success: true };
    }),
}),
semester: router({
  list: protectedProcedure
    .input(z.object({ studentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const student = await db.getStudent(input.studentId);
      if (!student) return [];

      if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
        return [];
      }

      return db.listSemesters(input.studentId);
    }),

  listAll: protectedProcedure
    .input(
      z.object({
        plannedMonth: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const assigneeId = isAdminOrHost(ctx.user)
        ? undefined
        : Number(ctx.user.id) || 1;

      return db.listAllSemesters(assigneeId, input.plannedMonth);
    }),

  create: protectedProcedure
    .input(
      z.object({
        studentId: z.number(),
        semesterOrder: z.number(),
        plannedMonth: z.string().optional(),
        plannedInstitution: z.string().optional(),
        plannedSubjectCount: z.number().optional(),
        plannedAmount: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const student = await db.getStudent(input.studentId);
      if (!student) throw new Error("학생을 찾을 수 없습니다");

      if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
        throw new Error("권한이 없습니다");
      }

      const id = await db.createSemester(input as any);
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        plannedMonth: z.string().optional(),
        plannedInstitution: z.string().optional(),
        plannedSubjectCount: z.number().optional(),
        plannedAmount: z.string().optional(),
        actualStartDate: z.string().optional(),
        actualInstitution: z.string().optional(),
        actualSubjectCount: z.number().optional(),
        actualAmount: z.string().optional(),
        actualPaymentDate: z.string().optional(),
        isCompleted: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const sem = await db.getSemester(input.id);
      if (!sem) throw new Error("학기를 찾을 수 없습니다");

      if (sem.isLocked) {
        const {
          id,
          actualStartDate,
          actualInstitution,
          actualSubjectCount,
          actualAmount,
          actualPaymentDate,
          isCompleted,
          ...plannedFields
        } = input;

        const hasPlannedChanges = Object.values(plannedFields).some((v) => v !== undefined);
        if (hasPlannedChanges) {
          throw new Error("승인된 예정표는 수정할 수 없습니다");
        }
      }

      const { id, ...rest } = input;
      const data: any = { ...rest };

      if (rest.actualStartDate) data.actualStartDate = new Date(rest.actualStartDate);
      if (rest.actualPaymentDate) data.actualPaymentDate = new Date(rest.actualPaymentDate);

      await db.updateSemester(id, data);

      if (input.isCompleted) {
        await db.checkAndAutoComplete(sem.studentId);
      }

      return { success: true };
    }),

  copyPlannedToActual: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const sem = await db.getSemester(input.id);
      if (!sem) throw new Error("학기를 찾을 수 없습니다");

      await db.updateSemester(input.id, {
        actualInstitution: sem.plannedInstitution,
        actualSubjectCount: sem.plannedSubjectCount,
        actualAmount: sem.plannedAmount,
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const sem = await db.getSemester(input.id);
      if (sem?.isLocked) throw new Error("승인된 학기는 삭제할 수 없습니다");

      await db.deleteSemester(input.id);
      return { success: true };
    }),
}),
settlement: router({
  report: adminProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        assigneeId: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const canSeeAll = isAdminOrHost(ctx.user);

      return db.getSettlementReport(
        input.year,
        input.month,
        canSeeAll ? input.assigneeId : Number(ctx.user.id)
      );
    }),
}),
});

export type AppRouter = typeof appRouter;