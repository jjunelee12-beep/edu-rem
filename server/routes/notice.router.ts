import { z } from "zod";
import { protectedProcedure } from "../_core/trpc";
import {
  listNotices,
  getNotice,
  createNotice,
  updateNotice,
  deleteNotice,
  bulkDeleteNotices,
  increaseNoticeView,
  createNoticeNotifications,
} from "../db";

function assertHostOrSuperhost(user: any) {
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  if (user.role !== "host" && user.role !== "superhost") {
    throw new Error("공지사항 작성 권한이 없습니다.");
  }
}

export const noticeRouter = {
 list: protectedProcedure
  .input(
    z
      .object({
        search: z.string().optional(),
      })
      .optional()
  )
  .query(async ({ input }) => {
    const rows = await listNotices();

    const search = input?.search?.trim().toLowerCase();

    const filtered = !search
      ? (rows as any[])
      : (rows as any[]).filter((row) => {
          const title = String(row.title ?? "").toLowerCase();
          const content = String(row.content ?? "").toLowerCase();
          return title.includes(search) || content.includes(search);
        });

    const importanceRank = (importance?: string | null) => {
      if (importance === "urgent") return 3;
      if (importance === "important") return 2;
      return 1;
    };

    return [...filtered].sort((a: any, b: any) => {
      const aPinned = a?.isPinned ? 1 : 0;
      const bPinned = b?.isPinned ? 1 : 0;

      if (aPinned !== bPinned) return bPinned - aPinned;

      const aImportance = importanceRank(a?.importance);
      const bImportance = importanceRank(b?.importance);

      if (aImportance !== bImportance) return bImportance - aImportance;

      const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;

      return bTime - aTime;
    });
  }),

  get: protectedProcedure
    .input(
      z.object({
        id: z.coerce.number(),
        increaseView: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const row = await getNotice(input.id);
      if (!row) {
        throw new Error("공지사항을 찾을 수 없습니다.");
      }

      if (input.increaseView ?? true) {
        await increaseNoticeView(input.id);
        const updated = await getNotice(input.id);
        return updated ?? row;
      }

      return row;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1, "제목을 입력해주세요.").max(255),
        content: z.string().trim().min(1, "내용을 입력해주세요."),
        isPinned: z.boolean().optional().default(false),
        importance: z.enum(["normal", "important", "urgent"]).optional().default("normal"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertHostOrSuperhost(ctx.user);

      const id = await createNotice({
        title: input.title,
        content: input.content,
        authorId: Number(ctx.user.id),
        authorName: String(ctx.user.name ?? ""),
        isPinned: !!input.isPinned,
        importance: input.importance,
      });

      await createNoticeNotifications({
        noticeId: Number(id),
        actorUserId: Number(ctx.user.id),
        title: input.title,
        importance: input.importance,
      });

      return {
        ok: true,
        id: Number(id),
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.coerce.number(),
        title: z.string().trim().min(1, "제목을 입력해주세요.").max(255),
        content: z.string().trim().min(1, "내용을 입력해주세요."),
        isPinned: z.boolean().optional().default(false),
        importance: z.enum(["normal", "important", "urgent"]).optional().default("normal"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertHostOrSuperhost(ctx.user);

      const existing = await getNotice(input.id);
      if (!existing) {
        throw new Error("공지사항을 찾을 수 없습니다.");
      }

      await updateNotice(input.id, {
        title: input.title,
        content: input.content,
        isPinned: !!input.isPinned,
        importance: input.importance,
      });

      return { ok: true };
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.coerce.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertHostOrSuperhost(ctx.user);

      const existing = await getNotice(input.id);
      if (!existing) {
        throw new Error("공지사항을 찾을 수 없습니다.");
      }

      await deleteNotice(input.id);

      return { ok: true };
    }),

  bulkDelete: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.coerce.number()).min(1, "삭제할 공지사항을 선택해주세요."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertHostOrSuperhost(ctx.user);

      const ids = Array.from(
        new Set(input.ids.map((x) => Number(x)).filter(Boolean))
      );

      if (!ids.length) {
        throw new Error("삭제할 공지사항이 없습니다.");
      }

      await bulkDeleteNotices(ids);

      return {
        ok: true,
        deletedCount: ids.length,
      };
    }),
};