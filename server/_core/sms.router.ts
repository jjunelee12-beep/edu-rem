import { router, hostProcedure } from "./trpc";
import { z } from "zod";
import { listConsultations, listStudents, getAllUsers } from "../db";

export const smsRouter = router({

  preview: hostProcedure
    .input(
      z.object({
        includeConsultations: z.boolean(),
        includeStudents: z.boolean(),
        assigneeId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {

      let phones: string[] = [];

      if (input.includeConsultations) {
        const consultations = await listConsultations(input.assigneeId);

        consultations.forEach((c: any) => {
          if (c.phone) phones.push(c.phone);
        });
      }

      if (input.includeStudents) {
        const students = await listStudents(input.assigneeId);

        students.forEach((s: any) => {
          if (s.phone) phones.push(s.phone);
        });
      }

      const normalized = phones
        .map((p) => p.replace(/\D/g, ""))
        .filter((p) => p.length >= 10);

      const unique = [...new Set(normalized)];

      return {
        total: unique.length,
        phones: unique,
      };
    }),

  assignees: hostProcedure.query(async () => {
    return getAllUsers();
  }),

});