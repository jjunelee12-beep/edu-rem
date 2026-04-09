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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.createPrivateCertificateMaster({
        name: input.name.trim(),
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        createdBy: Number(ctx.user.id),
        updatedBy: Number(ctx.user.id),
      } as any);

      return { success: true, id };
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