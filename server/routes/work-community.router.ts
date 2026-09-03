import { z } from "zod";
import { protectedProcedure } from "../_core/trpc";
import {
  listWorkCategories,
  createWorkCategory,
  updateWorkCategory,
  listWorkCommunityMembers,
  listWorkPosts,
  getWorkPost,
  createWorkPost,
  updateWorkPost,
  deleteWorkPost,
  markWorkPostRead,
  acknowledgeWorkPost,
  listWorkPostReaders,
  getWorkPostTargetStatus,
  listWorkPostComments,
  createWorkPostComment,
    updateWorkPostComment,
  deleteWorkPostComment,
  createWorkPostNotifications,
  createWorkPostCommentNotifications,
} from "../db";
import { throwAppError } from "../_core/appError";
import { ERROR_CODES } from "../_core/errorCodes";

/**
 * 현재 로그인 사용자의 organizationId를 가져온다.
 *
 * 클라이언트가 organizationId를 직접 보내지 못하게 하고
 * 반드시 로그인 세션의 organizationId만 사용한다.
 */
function getCtxOrganizationId(ctx: any) {
  const organizationId = Number(
    ctx?.organizationId ??
      ctx?.user?.organizationId ??
      ctx?.user?.organization_id ??
      ctx?.user?.organization?.id ??
      ctx?.session?.organizationId ??
      ctx?.session?.user?.organizationId ??
      0
  );

  if (
    !Number.isFinite(organizationId) ||
    organizationId <= 0
  ) {
    throwAppError(
      ERROR_CODES.ORGANIZATION_REQUIRED,
      "organizationId is required",
      400
    );
  }

  return organizationId;
}

/**
 * 현재 로그인 사용자 ID를 가져온다.
 */
function getCtxUserId(ctx: any) {
  const userId = Number(
    ctx?.user?.id ??
      ctx?.session?.user?.id ??
      0
  );

  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("로그인이 필요합니다.");
  }

  return userId;
}

/**
 * 현재 로그인 사용자 역할
 */
function getCtxUserRole(ctx: any) {
  return String(
    ctx?.user?.role ??
      ctx?.session?.user?.role ??
      ""
  );
}

/**
 * 현재 로그인 사용자 이름
 *
 * ctx.user.name은 인증 단계에서 이미 복호화된 값을 사용한다.
 */
function getCtxUserName(ctx: any) {
  return String(
    ctx?.user?.name ??
      ctx?.session?.user?.name ??
      ""
  ).trim();
}

/**
 * Host와 Superhost만 허용한다.
 *
 * 카테고리 추가·수정·비활성화에 사용한다.
 */
function assertWorkCommunityHost(ctx: any) {
  const role = getCtxUserRole(ctx);

  if (role !== "host" && role !== "superhost") {
    throw new Error(
      "업무 커뮤니티 관리 권한이 없습니다."
    );
  }
}

const visibilitySchema = z.enum([
  "all",
  "targeted",
]);

const targetUserIdsSchema = z
  .array(z.coerce.number().int().positive())
  .max(100, "지정 사용자는 최대 100명까지 선택할 수 있습니다.")
  .optional()
  .default([]);

const postInputSchema = z
  .object({
    categoryId: z.coerce
      .number()
      .int()
      .positive("카테고리를 선택해주세요."),

    title: z
      .string()
      .trim()
      .min(1, "제목을 입력해주세요.")
      .max(255, "제목은 255자 이하로 입력해주세요."),

    content: z
      .string()
      .trim()
      .min(1, "내용을 입력해주세요.")
      .max(
        100_000,
        "내용은 100,000자 이하로 입력해주세요."
      ),

    visibility: visibilitySchema,

    targetUserIds: targetUserIdsSchema,

    requiresAcknowledgement: z
      .boolean()
      .optional()
      .default(false),

    isPinned: z
      .boolean()
      .optional()
      .default(false),
  })
  .superRefine((value, ctx) => {
    if (
      value.visibility === "targeted" &&
      value.targetUserIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetUserIds"],
        message:
          "지정 사용자 공개 글은 대상자를 한 명 이상 선택해야 합니다.",
      });
    }
  });

export const workCommunityRouter = {
  /**
   * 카테고리 목록
   *
   * 모든 로그인 사용자 사용 가능.
   * 일반 사용자는 활성 카테고리만 반환한다.
   */
  categories: protectedProcedure.query(
    async ({ ctx }) => {
      return await listWorkCategories({
        organizationId:
          getCtxOrganizationId(ctx),
        includeInactive: false,
      });
    }
  ),

  /**
   * 카테고리 관리용 전체 목록
   *
   * 비활성화된 카테고리까지 포함한다.
   * Host/Superhost만 사용 가능.
   */
  categoriesForManagement:
    protectedProcedure.query(async ({ ctx }) => {
      assertWorkCommunityHost(ctx);

      return await listWorkCategories({
        organizationId:
          getCtxOrganizationId(ctx),
        includeInactive: true,
      });
    }),

  /**
   * 신규 카테고리 등록
   */
  createCategory: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .trim()
          .min(1, "카테고리명을 입력해주세요.")
          .max(
            80,
            "카테고리명은 80자 이하로 입력해주세요."
          ),

        color: z
          .string()
          .trim()
          .min(1)
          .max(20)
          .optional()
          .default("slate"),

        sortOrder: z.coerce
          .number()
          .int()
          .min(0)
          .max(10000)
          .optional()
          .default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertWorkCommunityHost(ctx);

      const id = await createWorkCategory({
        organizationId:
          getCtxOrganizationId(ctx),
        name: input.name,
        color: input.color,
        sortOrder: input.sortOrder,
        createdBy: getCtxUserId(ctx),
      });

      return {
        ok: true,
        id: Number(id),
      };
    }),

  /**
   * 카테고리 수정 또는 비활성화
   */
  updateCategory: protectedProcedure
    .input(
      z.object({
        id: z.coerce
          .number()
          .int()
          .positive(),

        name: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .optional(),

        color: z
          .string()
          .trim()
          .min(1)
          .max(20)
          .optional(),

        sortOrder: z.coerce
          .number()
          .int()
          .min(0)
          .max(10000)
          .optional(),

        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertWorkCommunityHost(ctx);

      await updateWorkCategory({
        organizationId:
          getCtxOrganizationId(ctx),
        id: input.id,
        name: input.name,
        color: input.color,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      });

      return { ok: true };
    }),

  /**
   * 게시글 공개 대상을 지정할 때 사용하는
   * 같은 회사 직원 목록
   */
  members: protectedProcedure.query(
    async ({ ctx }) => {
      return await listWorkCommunityMembers({
        organizationId:
          getCtxOrganizationId(ctx),
      });
    }
  ),

  /**
   * 내가 열람 가능한 게시글 목록
   *
   * categoryId가 없으면 전체 탭
   * onlyMine은 내가 작성한 글
   * onlyTargetedToMe는 나에게 지정된 글
   */
  list: protectedProcedure
    .input(
      z
        .object({
          categoryId: z.coerce
            .number()
            .int()
            .positive()
            .nullable()
            .optional(),

          search: z
            .string()
            .trim()
            .max(100)
            .optional(),

          onlyMine: z.boolean().optional(),

          onlyTargetedToMe:
            z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return await listWorkPosts({
        organizationId:
          getCtxOrganizationId(ctx),
        userId: getCtxUserId(ctx),
        role: getCtxUserRole(ctx),
        categoryId: input?.categoryId ?? null,
        search: input?.search ?? null,
        onlyMine: input?.onlyMine ?? false,
        onlyTargetedToMe:
          input?.onlyTargetedToMe ?? false,
      });
    }),

  /**
   * 게시글 상세 조회
   *
   * 여기서는 조회 기록을 변경하지 않는다.
   * 상세화면 진입 후 markRead mutation을 별도로 호출한다.
   */
  get: protectedProcedure
    .input(
      z.object({
        id: z.coerce
          .number()
          .int()
          .positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const post = await getWorkPost({
        organizationId:
          getCtxOrganizationId(ctx),
        postId: input.id,
        userId: getCtxUserId(ctx),
        role: getCtxUserRole(ctx),
      });

      if (!post) {
        // 권한이 없는 경우에도 게시글 존재 여부를
        // 외부에 알려주지 않기 위해 동일한 메시지를 사용한다.
        throw new Error(
          "게시글을 찾을 수 없습니다."
        );
      }

      return post;
    }),

  /**
   * 게시글 작성
   *
   * Staff/Admin/Host 모두 작성 가능.
   */
    create: protectedProcedure
    .input(postInputSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId =
        getCtxOrganizationId(ctx);

      const actorUserId =
        getCtxUserId(ctx);

      const actorName =
        getCtxUserName(ctx);

      const id = await createWorkPost({
        organizationId,
        categoryId: input.categoryId,
        authorId: actorUserId,
        authorName: actorName,
        title: input.title,
        content: input.content,
        visibility: input.visibility,
        targetUserIds:
          input.visibility === "targeted"
            ? input.targetUserIds
            : [],
        requiresAcknowledgement:
          input.requiresAcknowledgement,
        isPinned: input.isPinned,
      });

      try {
        await createWorkPostNotifications({
          organizationId,
          postId: Number(id),
          actorUserId,
          title: input.title,
          visibility: input.visibility,
          requiresAcknowledgement:
            input.requiresAcknowledgement,
        });
      } catch (error) {
        /**
         * 알림 생성 실패로 이미 등록된 게시글까지
         * 실패 처리되거나 중복 등록되지 않도록 한다.
         */
        console.error(
          "[WORK_COMMUNITY_NOTIFICATION_ERROR]",
          {
            organizationId,
            postId: Number(id),
            actorUserId,
            error,
          }
        );
      }

      return {
        ok: true,
        id: Number(id),
      };
    }),

  /**
   * 게시글 수정
   *
   * 작성자 또는 Host/Superhost만 가능.
   * 실제 권한 검사는 db.ts에서 한 번 더 수행한다.
   */
  update: protectedProcedure
    .input(
      postInputSchema.and(
        z.object({
          id: z.coerce
            .number()
            .int()
            .positive(),
        })
      )
    )
    .mutation(async ({ ctx, input }) => {
      await updateWorkPost({
        organizationId:
          getCtxOrganizationId(ctx),
        postId: input.id,
        userId: getCtxUserId(ctx),
        role: getCtxUserRole(ctx),
        categoryId: input.categoryId,
        title: input.title,
        content: input.content,
        visibility: input.visibility,
        targetUserIds:
          input.visibility === "targeted"
            ? input.targetUserIds
            : [],
        requiresAcknowledgement:
          input.requiresAcknowledgement,
        isPinned: input.isPinned,
      });

      return { ok: true };
    }),

  /**
   * 게시글 삭제
   *
   * 작성자 또는 Host/Superhost만 가능.
   * 실제 DB 행은 남기고 isActive만 false로 변경한다.
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.coerce
          .number()
          .int()
          .positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await deleteWorkPost({
        organizationId:
          getCtxOrganizationId(ctx),
        postId: input.id,
        userId: getCtxUserId(ctx),
        role: getCtxUserRole(ctx),
      });

      return { ok: true };
    }),

  /**
   * 게시글 읽음 처리
   */
  markRead: protectedProcedure
    .input(
      z.object({
        id: z.coerce
          .number()
          .int()
          .positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await markWorkPostRead({
        organizationId:
          getCtxOrganizationId(ctx),
        postId: input.id,
        userId: getCtxUserId(ctx),
        role: getCtxUserRole(ctx),
      });

      return { ok: true };
    }),

  /**
   * 확인 요청 게시글의 확인 완료 처리
   */
  acknowledge: protectedProcedure
    .input(
      z.object({
        id: z.coerce
          .number()
          .int()
          .positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await acknowledgeWorkPost({
        organizationId:
          getCtxOrganizationId(ctx),
        postId: input.id,
        userId: getCtxUserId(ctx),
        role: getCtxUserRole(ctx),
      });

      return { ok: true };
    }),

  /**
   * 읽은 사용자 목록
   *
   * 게시글 작성자 또는 Host/Superhost만 조회 가능.
   */
  readers: protectedProcedure
    .input(
      z.object({
        postId: z.coerce
          .number()
          .int()
          .positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await listWorkPostReaders({
        organizationId:
          getCtxOrganizationId(ctx),
        postId: input.postId,
        userId: getCtxUserId(ctx),
        role: getCtxUserRole(ctx),
      });
    }),

  /**
   * 지정된 사람들의 열람·확인완료 상태
   *
   * 게시글 작성자 또는 Host/Superhost만 조회 가능.
   */
  targetStatus: protectedProcedure
    .input(
      z.object({
        postId: z.coerce
          .number()
          .int()
          .positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await getWorkPostTargetStatus({
        organizationId:
          getCtxOrganizationId(ctx),
        postId: input.postId,
        userId: getCtxUserId(ctx),
        role: getCtxUserRole(ctx),
      });
    }),

  /**
   * 댓글 및 답글 목록
   */
  comments: protectedProcedure
    .input(
      z.object({
        postId: z.coerce
          .number()
          .int()
          .positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await listWorkPostComments({
        organizationId:
          getCtxOrganizationId(ctx),
        postId: input.postId,
        userId: getCtxUserId(ctx),
        role: getCtxUserRole(ctx),
      });
    }),

  /**
   * 댓글 또는 답글 작성
   */
    createComment: protectedProcedure
    .input(
      z.object({
        postId: z.coerce
          .number()
          .int()
          .positive(),

        parentCommentId: z.coerce
          .number()
          .int()
          .positive()
          .nullable()
          .optional(),

        content: z
          .string()
          .trim()
          .min(
            1,
            "댓글 내용을 입력해주세요."
          )
          .max(
            5000,
            "댓글은 5,000자 이하로 입력해주세요."
          ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId =
        getCtxOrganizationId(ctx);

      const actorUserId =
        getCtxUserId(ctx);

      const actorName =
        getCtxUserName(ctx);

      const id =
        await createWorkPostComment({
          organizationId,
          postId: input.postId,
          userId: actorUserId,
          userName: actorName,
          role: getCtxUserRole(ctx),
          content: input.content,
          parentCommentId:
            input.parentCommentId ?? null,
        });

      try {
        await createWorkPostCommentNotifications({
          organizationId,
          postId: input.postId,
          commentId: Number(id),
          actorUserId,
          actorName,
          parentCommentId:
            input.parentCommentId ?? null,
        });
      } catch (error) {
        /**
         * 댓글은 이미 등록됐으므로 알림 오류만 기록한다.
         */
        console.error(
          "[WORK_COMMUNITY_COMMENT_NOTIFICATION_ERROR]",
          {
            organizationId,
            postId: input.postId,
            commentId: Number(id),
            actorUserId,
            error,
          }
        );
      }

      return {
        ok: true,
        id: Number(id),
      };
    }),

  /**
   * 댓글 수정
   *
   * 댓글 작성자 본인만 가능.
   */
  updateComment: protectedProcedure
    .input(
      z.object({
        commentId: z.coerce
          .number()
          .int()
          .positive(),

        content: z
          .string()
          .trim()
          .min(1, "댓글 내용을 입력해주세요.")
          .max(
            5000,
            "댓글은 5,000자 이하로 입력해주세요."
          ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateWorkPostComment({
        organizationId:
          getCtxOrganizationId(ctx),
        commentId: input.commentId,
        userId: getCtxUserId(ctx),
        content: input.content,
      });

      return { ok: true };
    }),

  /**
   * 댓글 삭제
   *
   * 작성자 또는 Host/Superhost만 가능.
   */
  deleteComment: protectedProcedure
    .input(
      z.object({
        commentId: z.coerce
          .number()
          .int()
          .positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await deleteWorkPostComment({
        organizationId:
          getCtxOrganizationId(ctx),
        commentId: input.commentId,
        userId: getCtxUserId(ctx),
        role: getCtxUserRole(ctx),
      });

      return { ok: true };
    }),
};