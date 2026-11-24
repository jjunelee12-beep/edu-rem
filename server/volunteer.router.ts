import { z } from "zod";
import {
  router,
  publicProcedure,
} from "./_core/trpc";

import {
  getVolunteerList,
  getVolunteerDetail,
} from "./volunteer.service";

const optionalText = z
  .string()
  .trim()
  .max(100)
  .optional();

const optionalDate = z
  .string()
  .regex(/^\d{8}$/)
  .optional();

const optionalYn = z
  .enum(["Y", "N"])
  .optional();

export const volunteerRouter = router({
  list: publicProcedure
    .input(
      z.object({
        pageNo: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .default(1),

        numOfRows: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20),

        activeOnly: z.boolean().optional(),
        keyword: optionalText,
        schCateGu: optionalText,

        schSido: optionalText,
        schSign1: optionalText,

        upperClCode: optionalText,
        nanmClCode: optionalText,

        progrmBgnde: optionalDate,
        progrmEndde: optionalDate,

        adultPosblAt: optionalYn,
        yngbgsPosblAt: optionalYn,

        actBeginTm: optionalText,
        actEndTm: optionalText,

        noticeBgnde: optionalDate,
        noticeEndde: optionalDate,

        actPlace: optionalText,
        nanmmbyNm: optionalText,
      })
    )
    .query(async ({ input }) => {
      return getVolunteerList(input);
    }),

  detail: publicProcedure
    .input(
      z.object({
        progrmRegistNo: z
          .string()
          .trim()
          .min(1)
          .max(50),
      })
    )
    .query(async ({ input }) => {
      return getVolunteerDetail(
        input.progrmRegistNo
      );
    }),
});