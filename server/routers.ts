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
import { smsRouter } from "./_core/sms.router";

function isAdminOrHost(user: any) {
  return user?.role === "admin" || user?.role === "host";
}

export const appRouter = router({
  system: systemRouter,
  leadForm: publicLeadRouter,
  sms: smsRouter,

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
          phone: z.string().optional(),
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
          phone: input.phone?.trim() || null,
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
          phone: z.string().optional(),
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
          phone: rest.phone?.trim(),
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

  educationInstitution: router({
    list: protectedProcedure.query(async () => {
      return db.listEducationInstitutions();
    }),

    create: hostProcedure
      .input(
        z.object({
          name: z.string().min(1),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createEducationInstitution({
          name: input.name.trim(),
          isActive: true,
          sortOrder: input.sortOrder ?? 0,
        });

        return { id, success: true };
      }),

    update: hostProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          isActive: z.boolean().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...rest } = input;
        await db.updateEducationInstitution(id, rest);
        return { success: true };
      }),
  }),

  dashboard: router({
    monthApprovals: protectedProcedure.query(async ({ ctx }) => {
      const isAdminHost = isAdminOrHost(ctx.user);
      const assigneeId = isAdminHost ? undefined : Number(ctx.user.id);

      const stats = await db.getDashboardStats(assigneeId);
      const monthEntries = await db.getMonthSalesEntries(assigneeId);
      const students = await db.listStudents(assigneeId);

      const approved = (students || []).filter((s: any) => s.approvalStatus === "승인");
      const rejected = (students || []).filter((s: any) => s.approvalStatus === "불승인");
      const pending = (students || []).filter((s: any) => s.approvalStatus === "대기");

      const approvedTotal = approved.reduce(
        (sum: number, s: any) => sum + Number(s.netPaidAmount || s.paidAmount || 0),
        0
      );

      const rejectedTotal = rejected.reduce(
        (sum: number, s: any) => sum + Number(s.netPaidAmount || s.paidAmount || 0),
        0
      );

      const pendingTotal = pending.reduce(
        (sum: number, s: any) => sum + Number(s.netPaidAmount || s.paidAmount || 0),
        0
      );

      return {
        approved,
        rejected,
        pending,
        approvedTotal,
        rejectedTotal,
        pendingTotal,
        monthRefund: stats?.monthRefund ?? 0,
        totalRefund: stats?.totalRefund ?? 0,
        entries: monthEntries?.entries ?? [],
      };
    }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      return db.getDashboardStats(Number(ctx.user.id));
    }),

    totalStats: hostProcedure.query(async () => {
      return db.getDashboardStats(undefined);
    }),

    monthSalesEntries: protectedProcedure.query(async ({ ctx }) => {
      return db.getMonthSalesEntries(Number(ctx.user.id));
    }),

    totalMonthSalesEntries: hostProcedure.query(async () => {
      return db.getMonthSalesEntries(undefined);
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

        if (ctx.user.role === "staff") {
          const allowedForStaff: any = {};

          if (rest.notes !== undefined) {
            allowedForStaff.notes = rest.notes;
          }

          if (rest.status !== undefined) {
            allowedForStaff.status = rest.status;
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

              allowedForStaff.status = "등록";
            }
          }

          await db.updateConsultation(id, allowedForStaff);
          return { success: true };
        }

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

    reassign: hostProcedure
      .input(
        z.object({
          id: z.number(),
          assigneeId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await db.reassignConsultationAndLinkedStudent(
          input.id,
          input.assigneeId
        );

        return { success: true };
      }),

    bulkReassign: hostProcedure
      .input(
        z.object({
          fromAssigneeId: z.number(),
          toAssigneeId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await db.bulkReassignConsultationsAndLinkedStudents(
          input.fromAssigneeId,
          input.toAssigneeId
        );

        return { success: true };
      }),

    delete: hostProcedure
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
          address: z.string().optional(),
          detailAddress: z.string().optional(),
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
          status: z.enum(["등록", "종료", "등록 종료"]).optional(),
          startDate: z.string().optional(),
          paymentAmount: z.string().optional(),
          subjectCount: z.number().optional(),
          paymentDate: z.string().optional(),
          institution: z.string().optional(),
          institutionId: z.number().optional(),
          totalSemesters: z.number().optional(),
          address: z.string().optional(),
          detailAddress: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        console.log("[student.update] input =", input);

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

        console.log("[student.update] data =", data);

        await db.updateStudent(id, data);
        return { success: true };
      }),

    updateAddressAndCoords: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          address: z.string().optional().nullable(),
          detailAddress: z.string().optional().nullable(),
          latitude: z.number().optional().nullable(),
          longitude: z.number().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const item = await db.getStudent(input.studentId);
        if (!item) throw new Error("학생 기록을 찾을 수 없습니다");

        const myId = Number(ctx.user.id) || 1;
        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throw new Error("권한이 없습니다");
        }

        await db.updateStudentAddressAndCoords(input);
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

    registrationSummary: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return null;

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return null;
        }

        return db.getStudentRegistrationSummary(input.studentId);
      }),

    approve: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          approvalStatus: z.enum(["승인", "불승인"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 처리할 수 있습니다");
        }

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

  plan: router({
    get: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        console.log("[plan.get] student =", student);

        if (!student) {
          console.log("[plan.get] no student");
          return null;
        }

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          console.log("[plan.get] no permission", {
            userId: ctx.user.id,
            assigneeId: student.assigneeId,
          });
          return null;
        }

        const plan = await db.getPlan(input.studentId);
        console.log("[plan.get] plan =", plan);

        return plan ?? null;
      }),

    upsert: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          desiredCourse: z.string().optional(),
          finalEducation: z.string().optional(),
          totalTheorySubjects: z.number().optional(),
          hasPractice: z.boolean().optional(),
          practiceHours: z.number().optional(),
          practiceDate: z.string().optional(),
          practiceArranged: z.boolean().optional(),
          practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
          specialNotes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const id = await db.upsertPlan(input as any);
        return { id, success: true };
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
          plannedInstitutionId: z.number().optional(),
          plannedSubjectCount: z.number().optional(),
          plannedAmount: z.string().optional(),
          practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const id = await db.createSemester({
          ...input,
          status: "등록",
          practiceStatus: input.practiceStatus ?? "미섭외",
        } as any);

        if (input.plannedSubjectCount !== undefined && input.plannedSubjectCount > 0) {
          await db.syncPlanSemestersByCount(
            input.studentId,
            input.semesterOrder,
            input.plannedSubjectCount
          );
        }

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          plannedMonth: z.string().optional(),
          plannedInstitution: z.string().optional(),
          plannedSubjectCount: z.number().optional(),
          plannedAmount: z.string().optional(),
          plannedInstitutionId: z.number().optional(),
          actualInstitutionId: z.number().optional(),
          actualStartDate: z.string().optional(),
          actualInstitution: z.string().optional(),
          actualSubjectCount: z.number().optional(),
          actualAmount: z.string().optional(),
          actualPaymentDate: z.string().optional(),
          isCompleted: z.boolean().optional(),
          status: z.enum(["등록", "종료", "등록 종료"]).optional(),
          practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
          practiceSupportRequestId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const sem = await db.getSemester(input.id);
        if (!sem) throw new Error("학기를 찾을 수 없습니다");

        const allSemsForStatusCheck = await db.listSemesters(sem.studentId);
        const sortedSemsForStatusCheck = [...allSemsForStatusCheck].sort(
          (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
        );
        const lastSem = sortedSemsForStatusCheck[sortedSemsForStatusCheck.length - 1];

        if (input.status === "등록 종료") {
          if (!lastSem || Number(lastSem.id) !== Number(sem.id)) {
            throw new Error("마지막 학기에서만 등록 종료할 수 있습니다");
          }
        }

        if (
          input.status !== undefined &&
          input.status !== "등록" &&
          input.status !== "종료" &&
          input.status !== "등록 종료"
        ) {
          throw new Error("올바르지 않은 상태값입니다");
        }

        if (sem.isLocked) {
          const {
            id,
            actualStartDate,
            actualInstitution,
            actualSubjectCount,
            actualAmount,
            actualPaymentDate,
            isCompleted,
            status,
            practiceStatus,
            practiceSupportRequestId,
            ...plannedFields
          } = input;

          const hasPlannedChanges = Object.values(plannedFields).some(
            (v) => v !== undefined
          );
          if (hasPlannedChanges) {
            throw new Error("승인된 예정표는 수정할 수 없습니다");
          }
        }

        const { id, ...rest } = input;
        const data: any = { ...rest };

        if (rest.actualStartDate) data.actualStartDate = new Date(rest.actualStartDate);
        if (rest.actualPaymentDate) data.actualPaymentDate = new Date(rest.actualPaymentDate);

        await db.updateSemester(id, data);

        if (input.plannedSubjectCount !== undefined) {
          await db.syncPlanSemestersByCount(
            sem.studentId,
            sem.semesterOrder,
            input.plannedSubjectCount
          );
        }

        if (input.status !== undefined) {
          const refreshedSems = await db.listSemesters(sem.studentId);
          const sortedRefreshedSems = [...refreshedSems].sort(
            (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
          );
          const refreshedLastSem =
            sortedRefreshedSems[sortedRefreshedSems.length - 1];

          const studentStatus =
            refreshedLastSem?.status === "등록 종료" ? "등록 종료" : "등록";

          await db.updateStudent(sem.studentId, {
            status: studentStatus,
          });
        }

        const allSems = await db.listSemesters(sem.studentId);

        const firstActual = allSems
          .filter(
            (s: any) =>
              s.actualStartDate ||
              s.actualInstitutionId ||
              s.actualAmount ||
              s.actualPaymentDate
          )
          .sort((a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder))[0];

        if (firstActual) {
          let institutionName: string | undefined = undefined;

          if (firstActual.actualInstitutionId) {
            const institutions = await db.listEducationInstitutions();
            const found = institutions.find(
              (x: any) => Number(x.id) === Number(firstActual.actualInstitutionId)
            );
            institutionName = found?.name;
          }

          const refreshedSems = await db.listSemesters(sem.studentId);
          const sortedRefreshedSems = [...refreshedSems].sort(
            (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
          );
          const refreshedLastSem =
            sortedRefreshedSems[sortedRefreshedSems.length - 1];

          const studentStatus =
            refreshedLastSem?.status === "등록 종료" ? "등록 종료" : "등록";

          await db.updateStudent(sem.studentId, {
            startDate: firstActual.actualStartDate || undefined,
            institutionId: firstActual.actualInstitutionId || undefined,
            institution: institutionName || undefined,
            subjectCount: firstActual.actualSubjectCount || undefined,
            paymentAmount: firstActual.actualAmount || undefined,
            paymentDate: firstActual.actualPaymentDate || undefined,
            status: studentStatus,
          });
        }

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

        const raw = String(sem.plannedMonth || "").replace(/[^0-9]/g, "");
        const actualStartDate =
          raw.length === 6 ? new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-01`) : undefined;

        await db.updateSemester(input.id, {
          actualStartDate,
          actualInstitutionId: sem.plannedInstitutionId,
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

  refund: router({
    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listRefundsByStudent(input.studentId);
      }),

    listPending: protectedProcedure.query(async ({ ctx }) => {
      if (!isAdminOrHost(ctx.user)) {
        throw new Error("관리자 또는 호스트만 확인할 수 있습니다");
      }

      return db.listPendingRefunds();
    }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterId: z.number().optional(),
          refundAmount: z.string(),
          refundDate: z.string(),
          reason: z.string().optional(),
          refundType: z
            .enum(["부분환불", "전액환불", "환불후재등록", "교육원이동"])
            .optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const id = await db.createRefund({
          studentId: input.studentId,
          semesterId: input.semesterId ?? null,
          assigneeId: student.assigneeId,
          refundAmount: input.refundAmount as any,
          refundDate: new Date(input.refundDate),
          reason: input.reason ?? "",
          refundType: input.refundType ?? "부분환불",
          approvalStatus: "대기",
          attachmentName: input.attachmentName ?? null,
          attachmentUrl: input.attachmentUrl ?? null,
        } as any);

        return { id, success: true };
      }),

    approve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 승인할 수 있습니다");
        }

        await db.approveRefund(input.id, Number(ctx.user.id));
        return { success: true };
      }),

    reject: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 불승인 처리할 수 있습니다");
        }

        await db.rejectRefund(input.id, Number(ctx.user.id));
        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          refundAmount: z.string().optional(),
          refundDate: z.string().optional(),
          reason: z.string().optional(),
          refundType: z
            .enum(["부분환불", "전액환불", "환불후재등록", "교육원이동"])
            .optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const data: any = {};

        if (input.refundAmount !== undefined) data.refundAmount = input.refundAmount;
        if (input.refundDate !== undefined) data.refundDate = new Date(input.refundDate);
        if (input.reason !== undefined) data.reason = input.reason;
        if (input.refundType !== undefined) data.refundType = input.refundType;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl;

        await db.updateRefund(input.id, data);
        return { success: true };
      }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteRefund(input.id);
        return { success: true };
      }),
  }),

  planSemester: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listPlanSemesters(input.studentId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterNo: z.number(),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listPlanSemesters(input.studentId);
        const semesterCount = existing.filter(
          (x: any) => Number(x.semesterNo) === Number(input.semesterNo)
        ).length;

        if (semesterCount >= 8) {
          throw new Error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다");
        }

        const id = await db.createPlanSemester({
          studentId: input.studentId,
          semesterNo: input.semesterNo,
          subjectName: input.subjectName.trim(),
          planCategory: input.category,
          planRequirementType: input.requirementType ?? null,
          credits: 3,
          sortOrder: input.sortOrder ?? 0,
        } as any);

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          subjectName: z.string().optional(),
          category: z.enum(["전공", "교양", "일반"]).optional(),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          semesterNo: z.number().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const data: any = {};

        if (input.subjectName !== undefined) data.subjectName = input.subjectName.trim();
        if (input.category !== undefined) data.planCategory = input.category;
        if (input.requirementType !== undefined) data.planRequirementType = input.requirementType;
        if (input.semesterNo !== undefined) data.semesterNo = input.semesterNo;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

        await db.updatePlanSemester(input.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePlanSemester(input.id);
        return { success: true };
      }),
  }),

  transferSubject: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listTransferSubjects(input.studentId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          schoolName: z.string().optional(),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          credits: z.number().min(0).max(30),
          sortOrder: z.number().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listTransferSubjects(input.studentId);
        if ((existing?.length ?? 0) >= 100) {
          throw new Error("전적대 과목은 최대 100개까지 등록할 수 있습니다");
        }

        const id = await db.createTransferSubject({
          studentId: input.studentId,
          schoolName: input.schoolName?.trim() || null,
          subjectName: input.subjectName.trim(),
          transferCategory: input.category,
          transferRequirementType: input.requirementType ?? null,
          credits: input.credits,
          sortOrder: input.sortOrder ?? 0,
          attachmentName: input.attachmentName?.trim() || null,
          attachmentUrl: input.attachmentUrl?.trim() || null,
        } as any);

        return { id, success: true };
      }),

    bulkCreate: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          count: z.number().min(1).max(100),
          schoolName: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listTransferSubjects(input.studentId);
        const existingCount = existing?.length ?? 0;

        if (existingCount + input.count > 100) {
          throw new Error("전적대 과목은 최대 100개까지 등록할 수 있습니다");
        }

        const rows = Array.from({ length: input.count }).map((_, i) => ({
          studentId: input.studentId,
          schoolName: input.schoolName?.trim() || "전적대",
          subjectName: `새 과목${existingCount + i + 1}`,
          transferCategory: "전공" as const,
          transferRequirementType: "전공선택" as const,
          credits: 3,
          sortOrder: existingCount + i,
          attachmentName: null,
          attachmentUrl: null,
        }));

        await db.bulkCreateTransferSubjects(rows as any);

        return { success: true, count: input.count };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          schoolName: z.string().optional(),
          subjectName: z.string().optional(),
          category: z.enum(["전공", "교양", "일반"]).optional(),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          credits: z.number().min(0).max(30).optional(),
          sortOrder: z.number().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const data: any = {};

        if (input.schoolName !== undefined) data.schoolName = input.schoolName.trim();
        if (input.subjectName !== undefined) data.subjectName = input.subjectName.trim();
        if (input.category !== undefined) data.transferCategory = input.category;
        if (input.requirementType !== undefined) data.transferRequirementType = input.requirementType;
        if (input.credits !== undefined) data.credits = input.credits;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName.trim();
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl.trim();

        await db.updateTransferSubject(input.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTransferSubject(input.id);
        return { success: true };
      }),
  }),

  transferAttachment: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listTransferAttachments(input.studentId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          fileName: z.string().min(1),
          fileUrl: z.string().min(1),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listTransferAttachments(input.studentId);
        if ((existing?.length ?? 0) >= 4) {
          throw new Error("첨부파일은 최대 4개까지 등록할 수 있습니다");
        }

        const id = await db.createTransferAttachment({
          studentId: input.studentId,
          fileName: input.fileName.trim(),
          fileUrl: input.fileUrl.trim(),
          sortOrder: input.sortOrder ?? (existing?.length ?? 0),
        } as any);

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          fileName: z.string().optional(),
          fileUrl: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const data: any = {};
        if (input.fileName !== undefined) data.fileName = input.fileName.trim();
        if (input.fileUrl !== undefined) data.fileUrl = input.fileUrl.trim();
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

        await db.updateTransferAttachment(input.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTransferAttachment(input.id);
        return { success: true };
      }),
  }),

  courseTemplate: router({
    list: protectedProcedure
      .input(
        z
          .object({
            courseKey: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return db.listCourseSubjectTemplates(input?.courseKey);
      }),

    create: hostProcedure
      .input(
        z.object({
          courseKey: z.string().min(1),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createCourseSubjectTemplate({
          courseKey: input.courseKey.trim(),
          subjectName: input.subjectName.trim(),
          category: input.category,
          requirementType: input.requirementType ?? null,
          sortOrder: input.sortOrder ?? 0,
          isActive: true,
        } as any);

        return { id, success: true };
      }),

    applyToPlanSemester: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterNo: z.number(),
          subjectIds: z.array(z.number()).min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const result = await db.bulkCreatePlanSemestersFromTemplate({
          studentId: input.studentId,
          semesterNo: input.semesterNo,
          subjectIds: input.subjectIds,
        } as any);

        return { success: true, count: result.count };
      }),
  }),

  privateCertificate: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user) ? undefined : Number(ctx.user.id) || 1;
      return db.listPrivateCertificateRequests(assigneeId);
    }),

    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listPrivateCertificateRequestsByStudent(input.studentId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          certificateName: z.string().min(1),
          inputAddress: z.string().optional(),
          note: z.string().optional(),
          feeAmount: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const assignee = await db.getUserById(student.assigneeId);

        const id = await db.createPrivateCertificateRequest({
          studentId: input.studentId,
          assigneeId: student.assigneeId,
          clientName: student.clientName,
          phone: student.phone,
          assigneeName: assignee?.name || null,
          certificateName: input.certificateName.trim(),
          inputAddress: input.inputAddress?.trim() || null,
          note: input.note || null,
          requestStatus: "요청",
          feeAmount: input.feeAmount || "0",
          paymentStatus: "결제대기",
          attachmentName: input.attachmentName || null,
          attachmentUrl: input.attachmentUrl || null,
        } as any);

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          certificateName: z.string().optional(),
          inputAddress: z.string().optional(),
          note: z.string().optional(),
          requestStatus: z
            .enum(["요청", "안내완료", "입금대기", "입금확인", "진행중", "완료", "취소"])
            .optional(),
          feeAmount: z.string().optional(),
          paymentStatus: z.enum(["결제대기", "입금확인", "완료", "취소"]).optional(),
          paidAt: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
        }

        const data: any = {};
        if (input.certificateName !== undefined) data.certificateName = input.certificateName.trim();
        if (input.inputAddress !== undefined) data.inputAddress = input.inputAddress.trim();
        if (input.note !== undefined) data.note = input.note;
        if (input.requestStatus !== undefined) data.requestStatus = input.requestStatus;
        if (input.feeAmount !== undefined) data.feeAmount = input.feeAmount;
        if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
        if (input.paidAt !== undefined) data.paidAt = input.paidAt ? new Date(input.paidAt) : null;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl;

        await db.updatePrivateCertificateRequest(input.id, data);
        return { success: true };
      }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePrivateCertificateRequest(input.id);
        return { success: true };
      }),
  }),

  practiceSupport: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user) ? undefined : Number(ctx.user.id) || 1;
      return db.listPracticeSupportRequests(assigneeId);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const item = await db.getPracticeSupportRequest(input.id);
        if (!item) return null;

        const student = await db.getStudent(item.studentId);
        if (!student) return null;

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return null;
        }

        return item;
      }),

    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listPracticeSupportRequestsByStudent(input.studentId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterId: z.number().optional(),
          inputAddress: z.string().optional(),
          detailAddress: z.string().optional(),
          managerName: z.string().optional(),
          practiceHours: z.number().optional(),
          includeEducationCenter: z.boolean().optional(),
          includePracticeInstitution: z.boolean().optional(),
          note: z.string().optional(),
          feeAmount: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const assignee = await db.getUserById(student.assigneeId);

        const id = await db.createPracticeSupportRequest({
          studentId: input.studentId,
          semesterId: input.semesterId ?? null,
          assigneeId: student.assigneeId,
          clientName: student.clientName,
          phone: student.phone,
          assigneeName: assignee?.name || null,
          managerName: input.managerName ?? assignee?.name ?? null,
          course: student.course || "사회복지사",
          inputAddress: input.inputAddress?.trim() || student.address || null,
          detailAddress: input.detailAddress?.trim() || student.detailAddress || null,
          practiceHours: input.practiceHours ?? null,
          includeEducationCenter: input.includeEducationCenter ?? true,
          includePracticeInstitution: input.includePracticeInstitution ?? true,
          coordinationStatus: "미섭외",
          feeAmount: input.feeAmount || "0",
          paymentStatus: "미결제",
          note: input.note || null,
          attachmentName: input.attachmentName || null,
          attachmentUrl: input.attachmentUrl || null,
        } as any);

        if (input.semesterId) {
          await db.updateSemester(input.semesterId, {
            practiceStatus: "미섭외",
            practiceSupportRequestId: id,
          } as any);
        }

        await db.upsertPlan({
          studentId: input.studentId,
          hasPractice: true,
          practiceHours: input.practiceHours ?? undefined,
          practiceStatus: "미섭외",
        } as any);

        return { id, success: true };
      }),

    upsertByStudent: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterId: z.number().optional().nullable(),
          assigneeId: z.number(),
          clientName: z.string(),
          phone: z.string(),
          course: z.string(),
          inputAddress: z.string().optional().nullable(),
          detailAddress: z.string().optional().nullable(),
          assigneeName: z.string().optional().nullable(),
          managerName: z.string().optional().nullable(),
          practiceHours: z.number().optional().nullable(),
          includeEducationCenter: z.boolean().optional(),
          includePracticeInstitution: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const id = await db.upsertPracticeSupportRequestByStudent(input);
        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          semesterId: z.number().optional(),
          inputAddress: z.string().optional(),
          detailAddress: z.string().optional(),
          managerName: z.string().optional(),
          practiceHours: z.number().optional(),
          coordinationStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
          selectedEducationCenterId: z.number().optional(),
          selectedEducationCenterName: z.string().optional(),
          selectedEducationCenterAddress: z.string().optional(),
          selectedEducationCenterDistanceKm: z.string().optional(),
          selectedPracticeInstitutionId: z.number().optional(),
          selectedPracticeInstitutionName: z.string().optional(),
          selectedPracticeInstitutionAddress: z.string().optional(),
          selectedPracticeInstitutionDistanceKm: z.string().optional(),
          feeAmount: z.string().optional(),
          paymentStatus: z.enum(["미결제", "결제"]).optional(),
          paidAt: z.string().optional(),
          note: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
        }

        const data: any = {};
        if (input.semesterId !== undefined) data.semesterId = input.semesterId;
        if (input.inputAddress !== undefined) data.inputAddress = input.inputAddress.trim();
        if (input.detailAddress !== undefined) data.detailAddress = input.detailAddress.trim();
        if (input.managerName !== undefined) data.managerName = input.managerName.trim();
        if (input.practiceHours !== undefined) data.practiceHours = input.practiceHours;
        if (input.coordinationStatus !== undefined) data.coordinationStatus = input.coordinationStatus;
        if (input.selectedEducationCenterId !== undefined) data.selectedEducationCenterId = input.selectedEducationCenterId;
        if (input.selectedEducationCenterName !== undefined) data.selectedEducationCenterName = input.selectedEducationCenterName.trim();
        if (input.selectedEducationCenterAddress !== undefined) data.selectedEducationCenterAddress = input.selectedEducationCenterAddress.trim();
        if (input.selectedEducationCenterDistanceKm !== undefined) data.selectedEducationCenterDistanceKm = input.selectedEducationCenterDistanceKm || null;
        if (input.selectedPracticeInstitutionId !== undefined) data.selectedPracticeInstitutionId = input.selectedPracticeInstitutionId;
        if (input.selectedPracticeInstitutionName !== undefined) data.selectedPracticeInstitutionName = input.selectedPracticeInstitutionName.trim();
        if (input.selectedPracticeInstitutionAddress !== undefined) data.selectedPracticeInstitutionAddress = input.selectedPracticeInstitutionAddress.trim();
        if (input.selectedPracticeInstitutionDistanceKm !== undefined) data.selectedPracticeInstitutionDistanceKm = input.selectedPracticeInstitutionDistanceKm || null;
        if (input.feeAmount !== undefined) data.feeAmount = input.feeAmount;
        if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
        if (input.paidAt !== undefined) data.paidAt = input.paidAt ? new Date(input.paidAt) : null;
        if (input.note !== undefined) data.note = input.note;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl;

        await db.updatePracticeSupportRequest(input.id, data);

        if (input.coordinationStatus !== undefined) {
          await db.updatePracticeSupportStatusAndSyncSemester({
            practiceSupportRequestId: input.id,
            coordinationStatus: input.coordinationStatus,
          });
        }

        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          practiceSupportRequestId: z.number(),
          coordinationStatus: z.enum(["미섭외", "섭외중", "섭외완료"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
        }

        await db.updatePracticeSupportStatusAndSyncSemester(input);
        return { success: true };
      }),

    selectInstitution: protectedProcedure
      .input(
        z.object({
          practiceSupportRequestId: z.number(),
          institutionId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 선택할 수 있습니다");
        }

        await db.selectPracticeInstitutionForRequest(input);
        return { success: true };
      }),

    nearbyInstitutions: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          institutionType: z.enum(["education", "institution"]),
          limit: z.number().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listNearbyPracticeInstitutions(input);
      }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePracticeSupportRequest(input.id);
        return { success: true };
      }),
  }),
practiceEducationCenter: router({
  list: protectedProcedure.query(async () => {
    return db.listPracticeEducationCenters();
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getPracticeEducationCenter(input.id);
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        address: z.string().optional(),
        detailAddress: z.string().optional(),
        feeAmount: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        note: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "host") {
        throw new Error("관리자 또는 호스트만 등록할 수 있습니다");
      }

      const id = await db.createPracticeEducationCenter({
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        detailAddress: input.detailAddress?.trim() || null,
        feeAmount: input.feeAmount || "0",
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        note: input.note || null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      } as any);

      return { id, success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        detailAddress: z.string().optional(),
        feeAmount: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        note: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "host") {
        throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
      }

      const { id, ...rest } = input;
      await db.updatePracticeEducationCenter(id, rest as any);
      return { success: true };
    }),

  delete: hostProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deletePracticeEducationCenter(input.id);
      return { success: true };
    }),
}),
  practiceInstitution: router({
    list: protectedProcedure
      .input(
        z.object({
          institutionType: z.enum(["education", "institution"]).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return db.listPracticeInstitutions(input?.institutionType);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getPracticeInstitution(input.id);
      }),

    create: protectedProcedure
      .input(
        z.object({
          institutionType: z.enum(["education", "institution"]),
          name: z.string().min(1),
          representativeName: z.string().optional(),
          phone: z.string().optional(),
          address: z.string().min(1),
          detailAddress: z.string().optional(),
          price: z.string().optional(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          availableCourse: z.string().optional(),
          memo: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 등록할 수 있습니다");
        }

        const id = await db.createPracticeInstitution({
          institutionType: input.institutionType,
          name: input.name.trim(),
          representativeName: input.representativeName?.trim() || null,
          phone: input.phone?.trim() || null,
          address: input.address.trim(),
          detailAddress: input.detailAddress?.trim() || null,
          price: input.price || "0",
          latitude: input.latitude || null,
          longitude: input.longitude || null,
          availableCourse: input.availableCourse?.trim() || null,
          memo: input.memo || null,
          isActive: input.isActive ?? true,
        } as any);

        return { id, success: true };
      }),

    bulkCreate: protectedProcedure
      .input(
        z.object({
          rows: z.array(
            z.object({
              institutionType: z.enum(["education", "institution"]),
              name: z.string().min(1),
              representativeName: z.string().optional(),
              phone: z.string().optional(),
              address: z.string().min(1),
              detailAddress: z.string().optional(),
              price: z.string().optional(),
              latitude: z.string().optional(),
              longitude: z.string().optional(),
              availableCourse: z.string().optional(),
              memo: z.string().optional(),
              isActive: z.boolean().optional(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 등록할 수 있습니다");
        }

        await db.bulkCreatePracticeInstitutions(
          input.rows.map((row) => ({
            institutionType: row.institutionType,
            name: row.name.trim(),
            representativeName: row.representativeName?.trim() || null,
            phone: row.phone?.trim() || null,
            address: row.address.trim(),
            detailAddress: row.detailAddress?.trim() || null,
            price: row.price || "0",
            latitude: row.latitude || null,
            longitude: row.longitude || null,
            availableCourse: row.availableCourse?.trim() || null,
            memo: row.memo || null,
            isActive: row.isActive ?? true,
          })) as any
        );

        return { success: true, count: input.rows.length };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          institutionType: z.enum(["education", "institution"]).optional(),
          name: z.string().optional(),
          representativeName: z.string().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          detailAddress: z.string().optional(),
          price: z.string().optional(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          availableCourse: z.string().optional(),
          memo: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
        }

        const { id, ...rest } = input;
        const data: any = {};

        if (rest.institutionType !== undefined) data.institutionType = rest.institutionType;
        if (rest.name !== undefined) data.name = rest.name.trim();
        if (rest.representativeName !== undefined) data.representativeName = rest.representativeName.trim();
        if (rest.phone !== undefined) data.phone = rest.phone.trim();
        if (rest.address !== undefined) data.address = rest.address.trim();
        if (rest.detailAddress !== undefined) data.detailAddress = rest.detailAddress.trim();
        if (rest.price !== undefined) data.price = rest.price;
        if (rest.latitude !== undefined) data.latitude = rest.latitude || null;
        if (rest.longitude !== undefined) data.longitude = rest.longitude || null;
        if (rest.availableCourse !== undefined) data.availableCourse = rest.availableCourse.trim();
        if (rest.memo !== undefined) data.memo = rest.memo;
        if (rest.isActive !== undefined) data.isActive = rest.isActive;

        await db.updatePracticeInstitution(id, data);
        return { success: true };
      }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePracticeInstitution(input.id);
        return { success: true };
      }),
  }),

  jobSupport: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user) ? undefined : Number(ctx.user.id) || 1;
      return db.listJobSupportRequests(assigneeId);
    }),

    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listJobSupportRequestsByStudent(input.studentId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          inputAddress: z.string().optional(),
          desiredArea: z.string().optional(),
          note: z.string().optional(),
          feeAmount: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const assignee = await db.getUserById(student.assigneeId);

        const id = await db.createJobSupportRequest({
          studentId: input.studentId,
          assigneeId: student.assigneeId,
          clientName: student.clientName,
          phone: student.phone,
          assigneeName: assignee?.name || null,
          inputAddress: input.inputAddress?.trim() || null,
          desiredArea: input.desiredArea?.trim() || null,
          includeWelfareCenter: true,
          includeCareCenter: true,
          includeEtcInstitution: false,
          supportStatus: "요청",
          feeAmount: input.feeAmount || "0",
          paymentStatus: "결제대기",
          note: input.note || null,
          attachmentName: input.attachmentName || null,
          attachmentUrl: input.attachmentUrl || null,
        } as any);

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          inputAddress: z.string().optional(),
          desiredArea: z.string().optional(),
          supportStatus: z.enum(["요청", "진행중", "면접안내", "완료", "보류", "취소"]).optional(),
          selectedInstitutionName: z.string().optional(),
          selectedInstitutionAddress: z.string().optional(),
          selectedInstitutionDistanceKm: z.string().optional(),
          feeAmount: z.string().optional(),
          paymentStatus: z.enum(["결제대기", "입금확인", "완료", "취소"]).optional(),
          paidAt: z.string().optional(),
          note: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
        }

        const data: any = {};
        if (input.inputAddress !== undefined) data.inputAddress = input.inputAddress.trim();
        if (input.desiredArea !== undefined) data.desiredArea = input.desiredArea.trim();
        if (input.supportStatus !== undefined) data.supportStatus = input.supportStatus;
        if (input.selectedInstitutionName !== undefined) data.selectedInstitutionName = input.selectedInstitutionName.trim();
        if (input.selectedInstitutionAddress !== undefined) data.selectedInstitutionAddress = input.selectedInstitutionAddress.trim();
        if (input.selectedInstitutionDistanceKm !== undefined) data.selectedInstitutionDistanceKm = input.selectedInstitutionDistanceKm || null;
        if (input.feeAmount !== undefined) data.feeAmount = input.feeAmount;
        if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
        if (input.paidAt !== undefined) data.paidAt = input.paidAt ? new Date(input.paidAt) : null;
        if (input.note !== undefined) data.note = input.note;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl;

        await db.updateJobSupportRequest(input.id, data);
        return { success: true };
      }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteJobSupportRequest(input.id);
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

console.log("[ROUTER OK] planSemester loaded");
console.log("[ROUTER OK] transferSubject loaded");
console.log("[ROUTER OK] transferAttachment loaded");
console.log("[ROUTER OK] courseTemplate loaded");
console.log("[ROUTER OK] privateCertificate loaded");
console.log("[ROUTER OK] practiceSupport loaded");
console.log("[ROUTER OK] practiceInstitution loaded");
console.log("[ROUTER OK] jobSupport loaded");

export type AppRouter = typeof appRouter;