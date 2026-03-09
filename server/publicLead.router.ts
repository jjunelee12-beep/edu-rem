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
        desiredCourse: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const form = await db.getLeadFormByToken(input.token);

      if (!form || !form.isActive) {
        throw new Error("유효하지 않은 링크입니다.");
      }

      const id = await db.createConsultation({
        consultDate: new Date(),
        channel: "랜딩페이지",
        clientName: input.clientName.trim(),
        phone: input.phone.replace(/\D/g, "").slice(0, 11),
        finalEducation: input.finalEducation,
        desiredCourse: input.desiredCourse,
        notes: "",
        status: "상담중",
        assigneeId: form.assigneeId,
      } as any);

      return {
        ok: true,
        id,
      };
    }),
});