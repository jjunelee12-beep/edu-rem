import { router, hostProcedure } from "./trpc";
import { z } from "zod";
import { listConsultations, listStudents, getAllUsersDetailed } from "../db";
import { sendBulkSms } from "./sms.sender";

function normalizePhone(phone: string | null | undefined) {
  return String(phone || "").replace(/\D/g, "");
}

function includesKeyword(value: unknown, keyword: string) {
  return String(value || "").toLowerCase().includes(keyword.toLowerCase());
}

export const smsRouter = router({
  /**
   * 담당자 목록
   */
  assignees: hostProcedure.query(async () => {
    const users = await getAllUsersDetailed();

    const items = users.map((u: any) => ({
      id: Number(u.id),
      name: String(u.name || u.username || ""),
      phone: String(u.phone || u.mobile || u.tel || ""),
    }));

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
              const matched =
                includesKeyword(c.name, keyword) ||
                includesKeyword(normalizePhone(c.phone), keyword) ||
                includesKeyword(c.phone, keyword) ||
                includesKeyword(c.course, keyword);

              if (!matched) return false;
            }

            return true;
          })
          .forEach((c: any) => {
            const phone = normalizePhone(c.phone);
            if (phone.length < 10) return;

            items.push({
              id: `consultation-${c.id}`,
              name: String(c.name || ""),
              phone,
              course: String(c.course || ""),
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
              const matched =
                includesKeyword(s.name, keyword) ||
                includesKeyword(normalizePhone(s.phone), keyword) ||
                includesKeyword(s.phone, keyword) ||
                includesKeyword(s.course, keyword);

              if (!matched) return false;
            }

            return true;
          })
          .forEach((s: any) => {
            const phone = normalizePhone(s.phone);
            if (phone.length < 10) return;

            items.push({
              id: `student-${s.id}`,
              name: String(s.name || ""),
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

      const result = await sendBulkSms(unique, input.message);

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

      const result = await sendBulkSms([phone], input.message);

      return {
        total: 1,
        success: result.success ?? 0,
        fail: result.fail ?? 0,
      };
    }),
});