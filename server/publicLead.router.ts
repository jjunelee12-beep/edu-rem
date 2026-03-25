import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const publicLeadRouter = router({
  getByToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const form = await db.getLeadFormByToken(input.token);

      if (!form || !form.isActive) {
        return { ok: false };
      }

      return {
        ok: true,
        formId: form.id,
      };
    }),

  submit: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        clientName: z.string().min(1),
        phone: z.string().min(10),
        finalEducation: z.string().min(1),
        channel: z.string().optional(),
        notes: z.string().optional(),
        desiredCourse: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const form = await db.getLeadFormByToken(input.token);

      if (!form || !form.isActive) {
        throw new Error("유효하지 않은 링크입니다.");
      }

      const normalizedPhone = input.phone.replace(/\D/g, "").slice(0, 11);
      const safeAssigneeId = Number(form.assigneeId);

      const consultationId = await db.createConsultation({
        consultDate: new Date(),
        channel: input.channel?.trim() || "랜딩페이지",
        clientName: input.clientName.trim(),
        phone: normalizedPhone,
        finalEducation: input.finalEducation.trim(),
        desiredCourse: input.desiredCourse.trim(),
        notes: input.notes?.trim() || "랜딩페이지 유입",
        status: "상담중",
        assigneeId: safeAssigneeId,
      } as any);

      await db.createNotification({
        userId: safeAssigneeId,
        type: "lead",
        message: `[신규 상담] ${input.clientName.trim()} / ${normalizedPhone}`,
        relatedId: consultationId,
      } as any);

      console.log("[PUBLIC LEAD SUBMIT]", {
        consultationId,
        assigneeId: safeAssigneeId,
        clientName: input.clientName.trim(),
        phone: normalizedPhone,
      });

      return {
        ok: true,
        id: consultationId,
      };
    }),
});