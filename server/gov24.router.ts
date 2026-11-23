import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  GOV24_CATEGORIES, GOV24_EDUCATION_SUBCATEGORIES,
  getGov24ServiceById, getGov24SupportConditions,
  listGov24Services, searchGov24Services,
} from "./gov24.service";

/** 공개 통합지원센터용. API 인증키는 Railway 서버에만 보관 */
export const gov24Router = router({
  // 기존 클라이언트 호환
  list: publicProcedure
    .input(z.object({
      page: z.number().int().min(1).max(10000).default(1),
      perPage: z.number().int().min(1).max(30).default(10),
      keyword: z.string().trim().max(60).optional(),
    }).default({}))
    .query(({ input }) => listGov24Services(input)),

  // 전체 데이터 대상 검색 및 분류
  search: publicProcedure
    .input(z.object({
      page: z.number().int().min(1).max(10000).default(1),
      perPage: z.number().int().min(1).max(30).default(10),
      keyword: z.string().trim().max(60).optional(),
      category: z.enum(GOV24_CATEGORIES).default("전체"),
      educationSubcategory: z.enum(GOV24_EDUCATION_SUBCATEGORIES).default("전체"),
    }).default({}))
    .query(({ input }) => searchGov24Services(input)),

  detail: publicProcedure
    .input(z.object({ serviceId: z.string().trim().min(1).max(80) }))
    .query(({ input }) => getGov24ServiceById(input.serviceId)),

  conditions: publicProcedure
    .input(z.object({ serviceId: z.string().trim().min(1).max(80) }))
    .query(({ input }) => getGov24SupportConditions(input.serviceId)),
});
