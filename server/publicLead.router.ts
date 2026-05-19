import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { throwAppError } from "./_core/appError";
import { ERROR_CODES } from "./_core/errorCodes";

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
        throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "유효하지 않은 링크입니다.",
  400
);
      }

      const normalizedPhone = input.phone.replace(/\D/g, "").slice(0, 11);
const safeAssigneeId = Number(form.assigneeId);
const organizationId = Number((form as any).organizationId || 0);
if (!organizationId) return { ok: false };

      if (!Number.isFinite(safeAssigneeId) || safeAssigneeId <= 0) {
        throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "담당자 정보가 올바르지 않습니다.",
  400
);
      }

      const consultationId = await db.createConsultation({
  organizationId,
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
  organizationId,
  userId: safeAssigneeId,
  type: "lead",
  message: `[신규 상담] ${input.clientName.trim()} / ${normalizedPhone}`,
  relatedId: consultationId,
  isRead: false,
} as any);

      const expoPushTokens = await db.listActiveExpoPushTokensByUserId(
  safeAssigneeId,
  { organizationId }
);

     if (expoPushTokens.length > 0) {
  try {
    const messages = expoPushTokens.map((token) => ({
      to: token,
      sound: "default",
      title: "신규 상담 접수",
      body: `${input.clientName.trim()} / ${normalizedPhone}`,
      data: {
        type: "lead",
        consultationId,
        userId: safeAssigneeId,
      },
    }));

    const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    await pushResponse.text();
  } catch (pushError) {
    console.error("[EXPO PUSH SEND ERROR]", pushError);
  }
}
      return {
        ok: true,
        id: consultationId,
      };
    }),
});