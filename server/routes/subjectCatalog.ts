import { z } from "zod";
import { router, protectedProcedure, hostProcedure } from "../_core/trpc";
import * as db from "../db";

export const subjectCatalogRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          activeOnly: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return db.listSubjectCatalogs({
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
      const id = await db.createSubjectCatalog({
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
      await db.deleteSubjectCatalog(input.id);
      return { success: true };
    }),

  itemList: protectedProcedure
    .input(
      z.object({
        catalogId: z.number(),
        activeOnly: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      return db.listSubjectCatalogItems({
        catalogId: input.catalogId,
        activeOnly: input.activeOnly ?? false,
      });
    }),

  itemCreate: hostProcedure
    .input(
      z.object({
        catalogId: z.number(),
        subjectName: z.string().min(1),
        requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]),
        category: z.enum(["전공", "교양", "일반"]).optional(),
        credits: z.number().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.createSubjectCatalogItem({
        catalogId: input.catalogId,
        subjectName: input.subjectName.trim(),
        requirementType: input.requirementType,
        category: input.category,
        credits: input.credits ?? 3,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        createdBy: Number(ctx.user.id),
        updatedBy: Number(ctx.user.id),
      } as any);

      return { success: true, id };
    }),

  itemDelete: hostProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await db.deleteSubjectCatalogItem(input.id);
      return { success: true };
    }),
});