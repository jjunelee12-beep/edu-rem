import { router, hostProcedure } from "./trpc";
import { z } from "zod";
import {
  listConsultations,
  listStudents,
  getAllUsersDetailed,
  getSmsSettings,
  saveSmsSettings,
  createSmsLogs,
  createOrReactivateSmsOptOut,
  releaseSmsOptOut,
  listSmsOptOuts,
  getActiveSmsOptOutHashSet,
  createSmsPhoneHash,
  splitSmsPhonesByOptOut,
} from "../db";
import { sendBulkSms } from "./sms.sender";
import { getOrganizationLimitStatus } from "../saasdb";

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
  
settings: hostProcedure.query(async ({ ctx }) => {
  const organizationId = Number(ctx.user.organizationId || 0);

  const settings = await getSmsSettings({
  organizationId,
});

  return {
  provider: settings?.provider || "aligo",
  apiKey: settings?.apiKey || "",
  apiSecret: (settings as any)?.apiSecret || "",
  userId: settings?.userId || "",
  accessKey: (settings as any)?.accessKey || "",
  secretKey: (settings as any)?.secretKey || "",
  serviceId: (settings as any)?.serviceId || "",
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
  apiSecret: z.string().optional().default(""),
  userId: z.string().optional().default(""),
  accessKey: z.string().optional().default(""),
  secretKey: z.string().optional().default(""),
  serviceId: z.string().optional().default(""),
  senderNumber: z.string().optional().default(""),
  senderName: z.string().optional().default(""),
  isActive: z.boolean().default(true),
})
  )
  .mutation(async ({ ctx, input }) => {
  await saveSmsSettings({
    ...input,
    organizationId: Number(ctx.user.organizationId || 0),
  });
    return { success: true };
  }),
/**
   * 담당자 목록
   */
  assignees: hostProcedure.query(async ({ ctx }) => {
  const users = await getAllUsersDetailed({
  organizationId: Number(ctx.user.organizationId || 0),
});

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
    .query(async ({ ctx, input }) => {
      const items: Array<{
  id: string;
  name: string;
  phone: string;
  course: string;
  targetType: "consultation" | "student";
  category: "미등록" | "등록";
  assigneeId: number | null;
  isOptedOut: boolean;
}> = [];

const organizationId = Number(ctx.user.organizationId || 0);

const optedOutHashSet = await getActiveSmsOptOutHashSet({
  organizationId,
});

      const keyword = String(input.keyword || "").trim().toLowerCase();

      if (input.includeConsultations) {
        const consultations = await listConsultations(undefined, {
  organizationId: Number(ctx.user.organizationId || 0),
});

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

if (phone.length < 10 || phone.length > 11) {
  return;
}

        const phoneHash = createSmsPhoneHash(phone);

items.push({
  id: `consultation-${c.id}`,
  name: String(c.clientName || ""),
  phone,
  course: String(c.desiredCourse || ""),
  targetType: "consultation",
  category: "미등록",
  assigneeId: c.assigneeId ? Number(c.assigneeId) : null,
  isOptedOut: optedOutHashSet.has(phoneHash),
});
          });
      }

      if (input.includeStudents) {
       const students = await listStudents(undefined, {
  organizationId: Number(ctx.user.organizationId || 0),
});

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

if (phone.length < 10 || phone.length > 11) {
  return;
}

     const phoneHash = createSmsPhoneHash(phone);

items.push({
  id: `student-${s.id}`,
  name: String(s.clientName || ""),
  phone,
  course: String(s.course || ""),
  targetType: "student",
  category: "등록",
  assigneeId: s.assigneeId ? Number(s.assigneeId) : null,
  isOptedOut: optedOutHashSet.has(phoneHash),
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
  optedOutCount: uniqueItems.filter(
    (item) => item.isOptedOut
  ).length,
  sendableCount: uniqueItems.filter(
    (item) => !item.isOptedOut
  ).length,
  items: uniqueItems,
};
    }),


optOutList: hostProcedure
  .input(
    z.object({
      activeOnly: z.boolean().optional().default(true),
      keyword: z.string().optional().default(""),
      limit: z.number().min(1).max(500).optional().default(200),
    })
  )
  .query(async ({ ctx, input }) => {
    const organizationId = Number(ctx.user.organizationId || 0);

    const items = await listSmsOptOuts({
      organizationId,
      activeOnly: input.activeOnly,
      keyword: input.keyword,
      limit: input.limit,
    });

    return {
  total: items.length,
  items: items.map((item: any) => ({
    id: Number(item.id),
    organizationId: Number(item.organizationId),
    phoneLast4: item.phoneLast4 || null,
    reason: item.reason || null,
    source: item.source,
    isActive: Boolean(item.isActive),
    optedOutAt: item.optedOutAt,
    optedOutBy: item.optedOutBy
      ? Number(item.optedOutBy)
      : null,
    releasedAt: item.releasedAt || null,
    releasedBy: item.releasedBy
      ? Number(item.releasedBy)
      : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })),
};
  }),

optOutCreate: hostProcedure
  .input(
    z.object({
      phone: z.string().min(10),
      reason: z.string().optional().default("회원 요청"),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = Number(ctx.user.organizationId || 0);

    const result = await createOrReactivateSmsOptOut({
      organizationId,
      phone: input.phone,
      reason: input.reason,
      source: "manual",
      optedOutBy: Number(ctx.user.id),
    });

    return {
      success: true,
      item: result,
    };
  }),

optOutRelease: hostProcedure
  .input(
    z.object({
      id: z.number().int().positive(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = Number(ctx.user.organizationId || 0);

    return releaseSmsOptOut({
      organizationId,
      id: input.id,
      releasedBy: Number(ctx.user.id),
    });
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
    .mutation(async ({ ctx, input }) => {
     const organizationId = Number(ctx.user.organizationId || 0);

const splitResult = await splitSmsPhonesByOptOut({
  organizationId,
  phones: input.phones,
});

const requestedPhones = splitResult.requested;
const sendablePhones = splitResult.sendable;
const optedOutPhones = splitResult.optedOut;

const limitStatus = await getOrganizationLimitStatus(organizationId);

const nextUsage =
  Number(limitStatus.usage.smsSentThisMonth || 0) +
  sendablePhones.length;

if (nextUsage > Number(limitStatus.limits.maxSmsPerMonth || 0)) {
  throw new Error(
    `문자 발송 제한을 초과했습니다. 현재 ${limitStatus.usage.smsSentThisMonth}건 / 제한 ${limitStatus.limits.maxSmsPerMonth}건`
  );
}

if (sendablePhones.length === 0) {
  return {
    requestedTotal: requestedPhones.length,
    optedOutExcluded: optedOutPhones.length,
    total: 0,
    success: 0,
    fail: 0,
  };
}

const settings = await getSmsSettings({
  organizationId,
});
const result = await sendBulkSms(
  sendablePhones,
  input.message,
  settings
);

if (Number(result.fail || 0) === 0) {
  const smsLogRows = sendablePhones.map((phone) => ({
    organizationId,
    senderUserId: Number(ctx.user.id),
    phone,
    message: input.message,
    status: "success" as const,
    provider: settings?.provider || "aligo",
  }));

  await createSmsLogs(smsLogRows);
}

      return {
  requestedTotal: requestedPhones.length,
  optedOutExcluded: optedOutPhones.length,
  total: sendablePhones.length,
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
    .mutation(async ({ ctx, input }) => {
  const phone = normalizePhone(input.phone);
  const organizationId = Number(ctx.user.organizationId || 0);
const limitStatus = await getOrganizationLimitStatus(organizationId);

const nextUsage =
  Number(limitStatus.usage.smsSentThisMonth || 0) + 1;

if (nextUsage > Number(limitStatus.limits.maxSmsPerMonth || 0)) {
  throw new Error(
    `문자 발송 제한을 초과했습니다. 현재 ${limitStatus.usage.smsSentThisMonth}건 / 제한 ${limitStatus.limits.maxSmsPerMonth}건`
  );
}

      if (phone.length < 10 || phone.length > 11) {
  throw new Error("유효한 전화번호가 아닙니다.");
}

      const settings = await getSmsSettings({
  organizationId,
});
const result = await sendBulkSms([phone], input.message, settings);

await createSmsLogs([
  {
    organizationId,
    senderUserId: Number(ctx.user.id),
    phone,
    message: input.message,
    status:
      Number(result.fail || 0) > 0
        ? ("fail" as const)
        : ("success" as const),
    provider: settings?.provider || "aligo",
  },
]);

      return {
        total: 1,
        success: result.success ?? 0,
        fail: result.fail ?? 0,
      };
    }),
});