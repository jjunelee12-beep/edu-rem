import { z } from "zod";
import { router, protectedProcedure, hostProcedure } from "../_core/trpc";
import * as db from "../db";

export const privateCertificateMasterRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          activeOnly: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return db.listPrivateCertificateMasters({
        activeOnly: input?.activeOnly ?? false,
      });
    }),

  create: hostProcedure
    .input(
      z.object({
  name: z.string().min(1),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),

  defaultFeeAmount: z.string().optional(),
  defaultFreelancerAmount: z.string().optional(),
  isSettlementEnabled: z.boolean().optional(),
})
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.createPrivateCertificateMaster({
  name: input.name.trim(),
  sortOrder: input.sortOrder ?? 0,
  isActive: input.isActive ?? true,

  defaultFeeAmount: input.defaultFeeAmount ?? "0",
  defaultFreelancerAmount: input.defaultFreelancerAmount ?? "0",
  isSettlementEnabled: input.isSettlementEnabled ?? true,

  createdBy: Number(ctx.user.id),
  updatedBy: Number(ctx.user.id),
} as any);

      return { success: true, id };
    }),

update: hostProcedure
  .input(
    z.object({
      id: z.number(),

      name: z.string().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),

      defaultFeeAmount: z.string().optional(),
      defaultFreelancerAmount: z.string().optional(),
      isSettlementEnabled: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const data: any = {};

    if (input.name !== undefined) data.name = input.name.trim();
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    if (input.defaultFeeAmount !== undefined)
      data.defaultFeeAmount = input.defaultFeeAmount;

    if (input.defaultFreelancerAmount !== undefined)
      data.defaultFreelancerAmount = input.defaultFreelancerAmount;

    if (input.isSettlementEnabled !== undefined)
      data.isSettlementEnabled = input.isSettlementEnabled;

    data.updatedBy = Number(ctx.user.id);

    await db.updatePrivateCertificateMaster(input.id, data);

    return { success: true };
  }),

  delete: hostProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await db.deletePrivateCertificateMaster(input.id);
      return { success: true };
    }),
});