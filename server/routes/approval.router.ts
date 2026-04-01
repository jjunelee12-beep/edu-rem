import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createApprovalDocument,
  listMyApprovalDocuments,
  listPendingApprovalDocumentsForApprover,
  getApprovalDocument,
  approveApprovalDocument,
  rejectApprovalDocument,
  getApprovalSetting,
  saveApprovalSetting,
  getUserById,
  createNotification,
getApprovalPrintSettings,
saveApprovalPrintSettings,
} from "../db";

const formTypeSchema = z.enum(["attendance", "business_trip", "general"]);

export const approvalRouter = router({
  myDocuments: protectedProcedure.query(async ({ ctx }) => {
    return listMyApprovalDocuments(ctx.user.id);
  }),

  pendingForMe: protectedProcedure.query(async ({ ctx }) => {
    const role = String(ctx.user.role || "");
    if (!["admin", "host", "superhost"].includes(role)) {
      throw new Error("승인 문서 조회 권한이 없습니다.");
    }

    return listPendingApprovalDocumentsForApprover(ctx.user.id);
  }),

  detail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getApprovalDocument(input.id);
    }),

  create: protectedProcedure
   .input(
  z.object({
    formType: formTypeSchema,
    subType: z.string().min(1),
    title: z.string().min(1),
    reason: z.string().optional().nullable(),

    targetDate: z.string().optional().nullable(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),

    // 🔥 추가
    attendanceDetailType: z.string().optional().nullable(),
    attendanceStartTime: z.string().optional().nullable(),
    attendanceEndTime: z.string().optional().nullable(),

    destination: z.string().optional().nullable(),
    visitPlace: z.string().optional().nullable(),
    companion: z.string().optional().nullable(),

    requestDepartment: z.string().optional().nullable(),
    extraNote: z.string().optional().nullable(),

    attachmentName: z.string().optional().nullable(),
    attachmentUrl: z.string().optional().nullable(),
  })
)
    .mutation(async ({ ctx, input }) => {
      const me = await getUserById(ctx.user.id);

     const documentId = await createApprovalDocument({
  formType: input.formType,
  subType: input.subType,
  title: input.title,
  reason: input.reason ?? null,

  applicantUserId: ctx.user.id,
  applicantUserName: me?.name ?? null,

  targetDate: input.targetDate ?? null,
  startDate: input.startDate ?? null,
  endDate: input.endDate ?? null,

  // 🔥 추가
  attendanceDetailType: input.attendanceDetailType ?? null,
  attendanceStartTime: input.attendanceStartTime ?? null,
  attendanceEndTime: input.attendanceEndTime ?? null,

  destination: input.destination ?? null,
  visitPlace: input.visitPlace ?? null,
  companion: input.companion ?? null,

  requestDepartment: input.requestDepartment ?? null,
  extraNote: input.extraNote ?? null,

  attachmentName: input.attachmentName ?? null,
  attachmentUrl: input.attachmentUrl ?? null,
});

      // 신청 시 1차 승인자 알림
      const detail = await getApprovalDocument(Number(documentId));
      const firstLine = detail?.lines?.find((line: any) => Number(line.stepOrder) === 1);

     if (firstLine?.approverUserId && Number(firstLine.approverUserId) !== Number(ctx.user.id)) {
        await createNotification({
          userId: Number(firstLine.approverUserId),
          type: "approval",
          message: `[전자결재] ${me?.name}님의 "${input.title}" 결재 요청이 도착했습니다.`,
          relatedId: Number(documentId),
          isRead: false,
        } as any);
      }

      return documentId;
    }),

  approve: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        comment: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const me = await getUserById(ctx.user.id);

      await approveApprovalDocument({
        documentId: input.documentId,
        approverUserId: ctx.user.id,
        approverUserName: me?.name ?? null,
        comment: input.comment ?? null,
      });

      const updatedDetail = await getApprovalDocument(input.documentId);
      const updatedDoc = updatedDetail?.document;
      const updatedLines = updatedDetail?.lines ?? [];

      if (updatedDoc?.status === "pending") {
        const nextLine = updatedLines.find(
          (line: any) =>
            Number(line.stepOrder) === Number(updatedDoc.currentStepOrder) &&
            String(line.stepStatus) === "pending"
        );

        if (nextLine?.approverUserId && Number(nextLine.approverUserId) !== Number(ctx.user.id)) {
          await createNotification({
            userId: Number(nextLine.approverUserId),
            type: "approval",
            message: `[전자결재] "${updatedDoc.title}" 문서 결재 차례입니다.`,
            relatedId: Number(input.documentId),
            isRead: false,
          } as any);
        }
      }

      if (
  updatedDoc?.status === "approved" &&
  updatedDoc?.applicantUserId &&
  Number(updatedDoc.applicantUserId) !== Number(ctx.user.id)
) {
        await createNotification({
          userId: Number(updatedDoc.applicantUserId),
          type: "approval",
          message: `[전자결재] "${updatedDoc.title}" 문서가 최종 승인되었습니다.`,
          relatedId: Number(input.documentId),
          isRead: false,
        } as any);
      }

      return true;
    }),

  reject: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        comment: z.string().min(1, "반려 사유를 입력하세요."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const me = await getUserById(ctx.user.id);

      await rejectApprovalDocument({
        documentId: input.documentId,
        approverUserId: ctx.user.id,
        approverUserName: me?.name ?? null,
        comment: input.comment,
      });

      const updatedDetail = await getApprovalDocument(input.documentId);
      const updatedDoc = updatedDetail?.document;

      if (
  updatedDoc?.applicantUserId &&
  Number(updatedDoc.applicantUserId) !== Number(ctx.user.id)
) {
        await createNotification({
          userId: Number(updatedDoc.applicantUserId),
          type: "approval",
          message: `[전자결재] "${updatedDoc.title}" 문서가 반려되었습니다.`,
          relatedId: Number(input.documentId),
          isRead: false,
        } as any);
      }

      return true;
    }),

  getSetting: protectedProcedure
    .input(z.object({ formType: formTypeSchema }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "superhost") {
        throw new Error("설정 조회 권한이 없습니다.");
      }
      return getApprovalSetting(input.formType);
    }),

  saveSetting: protectedProcedure
    .input(
      z.object({
        formType: formTypeSchema,
        firstApproverUserId: z.number().nullable().optional(),
        secondApproverUserId: z.number().nullable().optional(),
        thirdApproverUserId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "superhost") {
        throw new Error("설정 저장 권한이 없습니다.");
      }

      return saveApprovalSetting({
        formType: input.formType,
        firstApproverUserId: input.firstApproverUserId ?? null,
        secondApproverUserId: input.secondApproverUserId ?? null,
        thirdApproverUserId: input.thirdApproverUserId ?? null,
        actorUserId: ctx.user.id,
      });
    }),
// ─── Print Settings ─────────────────────────────────────

getPrintSettings: protectedProcedure.query(async () => {
  return getApprovalPrintSettings();
}),

savePrintSettings: protectedProcedure
  .input(
    z.object({
      companyName: z.string().min(1),
      documentTitle: z.string().min(1),
      applicantSignLabel: z.string().min(1),
      finalApproverSignLabel: z.string().min(1),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "superhost") {
      throw new Error("출력 설정 저장 권한이 없습니다.");
    }

    return saveApprovalPrintSettings({
      companyName: input.companyName,
      documentTitle: input.documentTitle,
      applicantSignLabel: input.applicantSignLabel,
      finalApproverSignLabel: input.finalApproverSignLabel,
      updatedBy: ctx.user.id,
    });
  }),
});