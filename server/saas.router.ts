import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import {
  listOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  createOrganizationDefaults,
  assignUserToOrganization,
} from "./saasdb";
import bcrypt from "bcryptjs";
import * as db from "./db";

function assertSuperhost(ctx: any) {
  if (ctx.user?.role !== "superhost") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "superhost만 접근 가능합니다.",
    });
  }
}

export const saasRouter = router({
  listOrganizations: protectedProcedure.query(async ({ ctx }) => {
    assertSuperhost(ctx);
    return listOrganizations();
  }),

  getOrganization: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      assertSuperhost(ctx);
      return getOrganizationById(input.id);
    }),

  createOrganization: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        businessName: z.string().optional().nullable(),
        businessNumber: z.string().optional().nullable(),
        planCode: z.enum(["free", "basic", "pro", "enterprise"]).default("basic"),
        maxUsers: z.number().optional(),
        maxLandingForms: z.number().optional(),
        maxSmsPerMonth: z.number().optional(),
        memo: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertSuperhost(ctx);

      const organization = await createOrganization({
        ...input,
        createdBy: Number(ctx.user.id),
      });

      if (organization?.id) {
        await createOrganizationDefaults({
          organizationId: Number(organization.id),
          actorUserId: Number(ctx.user.id),
          companyName: input.businessName || input.name,
        });
      }

      return organization;
    }),

  updateOrganization: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        businessName: z.string().optional().nullable(),
        businessNumber: z.string().optional().nullable(),
        planCode: z.enum(["free", "basic", "pro", "enterprise"]).optional(),
        status: z.enum(["active", "inactive", "suspended"]).optional(),
        maxUsers: z.number().optional(),
        maxLandingForms: z.number().optional(),
        maxSmsPerMonth: z.number().optional(),
        memo: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertSuperhost(ctx);

      return updateOrganization({
        ...input,
        updatedBy: Number(ctx.user.id),
      });
    }),

  assignUserToOrganization: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        organizationId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertSuperhost(ctx);
      return assignUserToOrganization(input);
    }),

createHostAccount: protectedProcedure
  .input(
    z.object({
      organizationId: z.number(),
      username: z.string().min(1),
      password: z.string().min(4),
      name: z.string().min(1),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    assertSuperhost(ctx);

    const organization = await getOrganizationById(input.organizationId);
    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "회사를 찾을 수 없습니다.",
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const id = await db.createUserAccount({
      openId: `manual_${input.username.trim()}`,
      username: input.username.trim(),
      passwordHash,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      role: "host",
      organizationId: input.organizationId,
      loginMethod: "manual",
      isActive: true,
    });

    return {
      success: true,
      id,
    };
  }),
});