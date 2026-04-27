import { router, hostProcedure } from "./trpc";
import { z } from "zod";
import {
  listConsultations,
  listStudents,
  getAllUsersDetailed,
  getSmsSettings,
  saveSmsSettings,
} from "../db";
import { sendBulkSms } from "./sms.sender";

function normalizePhone(phone: string | null | undefined) {
  return String(phone || "").replace(/\D/g, "");
}

function includesKeyword(value: unknown, keyword: string) {
  return String(value || "").toLowerCase().includes(keyword.toLowerCase());
}

function normalizeSearchText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .trim();
}

function courseMatches(courseValue: unknown, keywordValue: string) {
  const course = normalizeSearchText(courseValue);
  const keyword = normalizeSearchText(keywordValue);

  if (!keyword) return true;

  if (keyword.includes("사회복지")) {
    return course.includes("사회복지");
  }

  if (keyword.includes("보육")) {
    return course.includes("보육");
  }

  if (keyword.includes("아동")) {
    return course.includes("아동");
  }

  if (keyword.includes("평생교육")) {
    return course.includes("평생교육");
  }

  return course.includes(keyword);
}

export const smsRouter = router({
  
settings: hostProcedure.query(async () => {
  const settings = await getSmsSettings();

  return {
    provider: settings?.provider || "aligo",
    apiKey: settings?.apiKey || "",
    userId: settings?.userId || "",
    senderNumber: settings?.senderNumber || "",
    senderName: settings?.senderName || "",
    isActive: settings?.isActive === undefined ? true : Boolean(settings.isActive),
  };
}),

saveSettings: hostProcedure
  .input(
    z.object({
      provider: z.string().default("aligo"),
      apiKey: z.string().optional().default(""),
      userId: z.string().optional().default(""),
      senderNumber: z.string().optional().default(""),
      senderName: z.string().optional().default(""),
      isActive: z.boolean().default(true),
    })
  )
  .mutation(async ({ input }) => {
    await saveSmsSettings(input);
    return { success: true };
  }),
/**
   * 담당자 목록
   */
  assignees: hostProcedure.query(async () => {
  const users = await getAllUsersDetailed();

  const items = users
    .map((u: any) => ({
      id: Number(u.id),
      name: String(u.name || u.username || `담당자-${u.id}`),
      phone: String(u.phone || ""),
      isActive: u.isActive,
    }))
    .filter((u: any) => u.name.trim() !== "");

  return {
    items,
  };
}),

  /**
   * 발송 대상 미리보기
   * - 미등록자: consultations.status !== "등록"
   * - 등록자: students 전체
   * - 담당자 필터 적용
   * - 고객 검색: 이름 / 전화번호 / 희망과정
   */
  preview: hostProcedure
    .input(
      z.object({
        includeConsultations: z.boolean().default(false),
        includeStudents: z.boolean().default(false),
        assigneeId: z.number().optional(),
        keyword: z.string().optional().default(""),
searchType: z.enum(["all", "name", "phone", "course"]).optional().default("all"),
      })
    )
    .query(async ({ input }) => {
      const items: Array<{
        id: string;
        name: string;
        phone: string;
        course: string;
        targetType: "consultation" | "student";
        category: "미등록" | "등록";
        assigneeId: number | null;
      }> = [];

      const keyword = String(input.keyword || "").trim().toLowerCase();

      if (input.includeConsultations) {
        const consultations = await listConsultations();

        consultations
          .filter((c: any) => {
            const isUnregistered = String(c.status || "").trim() !== "등록";
            if (!isUnregistered) return false;

            if (input.assigneeId && Number(c.assigneeId) !== Number(input.assigneeId)) {
              return false;
            }

            if (keyword) {
  const searchType = input.searchType || "all";

  const matched =
    searchType === "name"
      ? includesKeyword(c.clientName, keyword)
      : searchType === "phone"
      ? includesKeyword(normalizePhone(c.phone), normalizePhone(keyword)) ||
        includesKeyword(c.phone, keyword)
      : searchType === "course"
      ? courseMatches(c.desiredCourse, keyword)
      : includesKeyword(c.clientName, keyword) ||
        includesKeyword(normalizePhone(c.phone), normalizePhone(keyword)) ||
        includesKeyword(c.phone, keyword) ||
        courseMatches(c.desiredCourse, keyword);

  if (!matched) return false;
}

            return true;
          })
          .forEach((c: any) => {
            const phone = normalizePhone(c.phone);
            if (phone.length < 10) return;

         items.push({
  id: `consultation-${c.id}`,
  name: String(c.clientName || ""),
  phone,
  course: String(c.desiredCourse || ""),
  targetType: "consultation",
  category: "미등록",
  assigneeId: c.assigneeId ? Number(c.assigneeId) : null,
});
          });
      }

      if (input.includeStudents) {
        const students = await listStudents();

        students
          .filter((s: any) => {
            if (input.assigneeId && Number(s.assigneeId) !== Number(input.assigneeId)) {
              return false;
            }

           if (keyword) {
  const searchType = input.searchType || "all";
  const courseText = [s.course, s.desiredCourse, s.hopeCourse]
    .filter(Boolean)
    .join(" ");

  const matched =
    searchType === "name"
      ? includesKeyword(s.clientName, keyword)
      : searchType === "phone"
      ? includesKeyword(normalizePhone(s.phone), normalizePhone(keyword)) ||
        includesKeyword(s.phone, keyword)
      : searchType === "course"
      ? courseMatches(courseText, keyword)
      : includesKeyword(s.clientName, keyword) ||
        includesKeyword(normalizePhone(s.phone), normalizePhone(keyword)) ||
        includesKeyword(s.phone, keyword) ||
        courseMatches(courseText, keyword);

  if (!matched) return false;
}

            return true;
          })
          .forEach((s: any) => {
            const phone = normalizePhone(s.phone);
            if (phone.length < 10) return;

     items.push({
  id: `student-${s.id}`,
  name: String(s.clientName || ""),
  phone,
  course: String(s.course || ""),
  targetType: "student",
  category: "등록",
  assigneeId: s.assigneeId ? Number(s.assigneeId) : null,
});
          });
      }

      // 전화번호 기준 중복 제거
      const seen = new Set<string>();
      const uniqueItems = items.filter((item) => {
        if (seen.has(item.phone)) return false;
        seen.add(item.phone);
        return true;
      });

      return {
        total: uniqueItems.length,
        items: uniqueItems,
      };
    }),

  /**
   * 실제 문자 발송
   */
  send: hostProcedure
    .input(
      z.object({
        phones: z.array(z.string()).min(1),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const normalized = input.phones
        .map((p) => normalizePhone(p))
        .filter((p) => p.length >= 10);

      const unique = [...new Set(normalized)];

      const settings = await getSmsSettings();
const result = await sendBulkSms(unique, input.message, settings);

      return {
        total: unique.length,
        success: result.success ?? 0,
        fail: result.fail ?? 0,
      };
    }),

  /**
   * 테스트 문자 발송
   */
  testSend: hostProcedure
    .input(
      z.object({
        phone: z.string().min(10),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const phone = normalizePhone(input.phone);

      if (phone.length < 10) {
        throw new Error("유효한 전화번호가 아닙니다.");
      }

      const settings = await getSmsSettings();
const result = await sendBulkSms([phone], input.message, settings);

      return {
        total: 1,
        success: result.success ?? 0,
        fail: result.fail ?? 0,
      };
    }),
});