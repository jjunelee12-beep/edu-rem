import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  useLocation,
  useRoute,
} from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileText,
  LockKeyhole,
  MessageCircle,
  Paperclip,
  Pin,
  Reply,
  Send,
  Trash2,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type WorkPostAttachment = {
  id: number;
  originalName: string;
  storedName: string;
  url: string;
  mimeType?: string | null;
  sizeBytes: number;
  uploadedBy: number;
  createdAt: string | Date;
};

type WorkPostTarget = {
  userId: number;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  profileImageUrl?: string | null;
};

type WorkPostDetail = {
  id: number;
  organizationId: number;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  authorId: number;
  authorName?: string | null;
  title: string;
  content: string;
  visibility: "all" | "targeted";
  requiresAcknowledgement: boolean;
  isPinned: boolean;
  viewCount: number;
  commentCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  firstReadAt?: string | Date | null;
  lastReadAt?: string | Date | null;
  acknowledgedAt?: string | Date | null;
  targets: WorkPostTarget[];
  attachments: WorkPostAttachment[];
  canManage: boolean;
};

type WorkPostComment = {
  id: number;
  organizationId: number;
  postId: number;
  parentCommentId?: number | null;
  authorId: number;
  authorName?: string | null;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  canManage: boolean;
};

type WorkPostReader = {
  userId: number;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  profileImageUrl?: string | null;
  firstReadAt?: string | Date | null;
  lastReadAt?: string | Date | null;
  acknowledgedAt?: string | Date | null;
};

type WorkPostTargetStatus = {
  userId: number;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  profileImageUrl?: string | null;
  isRead: boolean;
  isAcknowledged: boolean;
  firstReadAt?: string | Date | null;
  lastReadAt?: string | Date | null;
  acknowledgedAt?: string | Date | null;
};

const CATEGORY_COLOR_CLASS: Record<
  string,
  string
> = {
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue:
    "border-blue-200 bg-blue-50 text-blue-700",
  violet:
    "border-violet-200 bg-violet-50 text-violet-700",
  amber:
    "border-amber-200 bg-amber-50 text-amber-700",
  cyan:
    "border-cyan-200 bg-cyan-50 text-cyan-700",
  slate:
    "border-slate-200 bg-slate-50 text-slate-700",
};

function getCategoryColorClass(
  color?: string | null
) {
  return (
    CATEGORY_COLOR_CLASS[
      String(color || "slate")
    ] ??
    CATEGORY_COLOR_CLASS.slate
  );
}

function formatDate(
  value?: string | Date | null
) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}

function formatFileSize(size?: number | null) {
  const value = Number(size || 0);

  if (value < 1024) {
    return `${value}B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)}KB`;
  }

  return `${(
    value /
    (1024 * 1024)
  ).toFixed(1)}MB`;
}

function getDisplayName(value: {
  name?: string | null;
  username?: string | null;
  userId?: number;
}) {
  return (
    value.name ||
    value.username ||
    `사용자 ${value.userId || ""}`
  );
}

export default function WorkCommunityDetailPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [, orgParams] = useRoute(
    "/:organizationSlug/work-community/:id"
  );

  const [, plainParams] = useRoute(
    "/work-community/:id"
  );

  const params =
    orgParams || plainParams;

  const postId = Number(
    params?.id || 0
  );

  const organizationSlug =
    (user as any)?.organizationSlug ||
    (user as any)?.organization?.slug ||
    "";

  const readRequestedPostId =
    useRef<number | null>(null);

  const [commentContent, setCommentContent] =
    useState("");

  const [replyTarget, setReplyTarget] =
    useState<WorkPostComment | null>(null);

  const [replyContent, setReplyContent] =
    useState("");

  const [editingCommentId, setEditingCommentId] =
    useState<number | null>(null);

  const [editingContent, setEditingContent] =
    useState("");

  const withOrgPath = (path: string) => {
    const cleanPath =
      String(path || "").trim();

    if (!cleanPath) {
      return organizationSlug
        ? `/${organizationSlug}`
        : "/";
    }

    if (!organizationSlug) {
      return cleanPath;
    }

    return (
      `/${organizationSlug}` +
      `${
        cleanPath.startsWith("/")
          ? cleanPath
          : `/${cleanPath}`
      }`
    );
  };

  const utils = trpc.useUtils();

  const postQuery =
    trpc.workCommunity.get.useQuery(
      {
        id: postId,
      },
      {
        enabled:
          Number.isFinite(postId) &&
          postId > 0,
        retry: false,
      }
    );

  const post =
    postQuery.data as
      | WorkPostDetail
      | undefined;

  const commentsQuery =
    trpc.workCommunity.comments.useQuery(
      {
        postId,
      },
      {
        enabled:
          !!post &&
          postId > 0,
      }
    );

  const readersQuery =
    trpc.workCommunity.readers.useQuery(
      {
        postId,
      },
      {
        enabled:
          !!post?.canManage &&
          postId > 0,
        retry: false,
      }
    );

  const targetStatusQuery =
    trpc.workCommunity.targetStatus.useQuery(
      {
        postId,
      },
      {
        enabled:
          !!post?.canManage &&
          post?.visibility === "targeted" &&
          postId > 0,
        retry: false,
      }
    );

  const markReadMutation =
    trpc.workCommunity.markRead.useMutation({
      onSuccess: async () => {
        await Promise.all([
          utils.workCommunity.get.invalidate({
            id: postId,
          }),
          utils.workCommunity.list.invalidate(),
        ]);
      },
    });

  const acknowledgeMutation =
    trpc.workCommunity.acknowledge.useMutation({
      onSuccess: async () => {
        toast.success(
          "확인 완료 처리되었습니다."
        );

        await Promise.all([
          utils.workCommunity.get.invalidate({
            id: postId,
          }),
          utils.workCommunity.list.invalidate(),
          utils.workCommunity.readers.invalidate({
            postId,
          }),
          utils.workCommunity.targetStatus.invalidate({
            postId,
          }),
        ]);
      },

      onError: (error) => {
        toast.error(
          error.message ||
            "확인 완료 처리 중 오류가 발생했습니다."
        );
      },
    });

  const deletePostMutation =
    trpc.workCommunity.delete.useMutation({
      onSuccess: async () => {
        toast.success(
          "게시글이 삭제되었습니다."
        );

        await utils.workCommunity.list.invalidate();

        setLocation(
          withOrgPath("/work-community")
        );
      },

      onError: (error) => {
        toast.error(
          error.message ||
            "게시글 삭제 중 오류가 발생했습니다."
        );
      },
    });

  const createCommentMutation =
    trpc.workCommunity.createComment.useMutation({
      onSuccess: async () => {
        setCommentContent("");
        setReplyContent("");
        setReplyTarget(null);

        await Promise.all([
          utils.workCommunity.comments.invalidate({
            postId,
          }),
          utils.workCommunity.get.invalidate({
            id: postId,
          }),
          utils.workCommunity.list.invalidate(),
        ]);
      },

      onError: (error) => {
        toast.error(
          error.message ||
            "댓글 등록 중 오류가 발생했습니다."
        );
      },
    });

  const updateCommentMutation =
    trpc.workCommunity.updateComment.useMutation({
      onSuccess: async () => {
        setEditingCommentId(null);
        setEditingContent("");

        toast.success(
          "댓글이 수정되었습니다."
        );

        await utils.workCommunity.comments.invalidate({
          postId,
        });
      },

      onError: (error) => {
        toast.error(
          error.message ||
            "댓글 수정 중 오류가 발생했습니다."
        );
      },
    });

  const deleteCommentMutation =
    trpc.workCommunity.deleteComment.useMutation({
      onSuccess: async () => {
        toast.success(
          "댓글이 삭제되었습니다."
        );

        await Promise.all([
          utils.workCommunity.comments.invalidate({
            postId,
          }),
          utils.workCommunity.get.invalidate({
            id: postId,
          }),
          utils.workCommunity.list.invalidate(),
        ]);
      },

      onError: (error) => {
        toast.error(
          error.message ||
            "댓글 삭제 중 오류가 발생했습니다."
        );
      },
    });

  useEffect(() => {
    if (
      !post ||
      postId <= 0 ||
      readRequestedPostId.current === postId
    ) {
      return;
    }

    readRequestedPostId.current = postId;

    markReadMutation.mutate({
      id: postId,
    });
  }, [post, postId]);

  const comments =
    (commentsQuery.data ||
      []) as WorkPostComment[];

  const rootComments = useMemo(
    () =>
      comments.filter(
        (comment) =>
          !comment.parentCommentId
      ),
    [comments]
  );

  const replyMap = useMemo(() => {
    const map = new Map<
      number,
      WorkPostComment[]
    >();

    for (const comment of comments) {
      if (!comment.parentCommentId) {
        continue;
      }

      const parentId = Number(
        comment.parentCommentId
      );

      const rows =
        map.get(parentId) || [];

      rows.push(comment);
      map.set(parentId, rows);
    }

    return map;
  }, [comments]);

  const handleBack = () => {
    setLocation(
      withOrgPath("/work-community")
    );
  };

  const handleEditPost = () => {
    setLocation(
      withOrgPath(
        `/work-community/${postId}/edit`
      )
    );
  };

  const handleDeletePost = () => {
    if (
      !confirm(
        "이 게시글을 삭제하시겠습니까?"
      )
    ) {
      return;
    }

    deletePostMutation.mutate({
      id: postId,
    });
  };

  const handleCreateComment = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const content =
      commentContent.trim();

    if (!content) {
      toast.error(
        "댓글 내용을 입력해주세요."
      );
      return;
    }

    createCommentMutation.mutate({
      postId,
      content,
      parentCommentId: null,
    });
  };

  const handleCreateReply = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!replyTarget) return;

    const content =
      replyContent.trim();

    if (!content) {
      toast.error(
        "답글 내용을 입력해주세요."
      );
      return;
    }

    createCommentMutation.mutate({
      postId,
      content,
      parentCommentId:
        Number(replyTarget.id),
    });
  };

  const handleStartEditComment = (
    comment: WorkPostComment
  ) => {
    setEditingCommentId(
      Number(comment.id)
    );

    setEditingContent(
      comment.content
    );
  };

  const handleUpdateComment = (
    commentId: number
  ) => {
    const content =
      editingContent.trim();

    if (!content) {
      toast.error(
        "댓글 내용을 입력해주세요."
      );
      return;
    }

    updateCommentMutation.mutate({
      commentId,
      content,
    });
  };

  const handleDeleteComment = (
    commentId: number
  ) => {
    if (
      !confirm(
        "이 댓글을 삭제하시겠습니까?"
      )
    ) {
      return;
    }

    deleteCommentMutation.mutate({
      commentId,
    });
  };

  const handleDeleteAttachment = async (
    attachment: WorkPostAttachment
  ) => {
    if (
      !confirm(
        `${attachment.originalName} 파일을 삭제하시겠습니까?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/work-community/attachments/${attachment.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        let message =
          "첨부파일 삭제에 실패했습니다.";

        try {
          const body =
            await response.json();

          message =
            body?.message || message;
        } catch {
          // 기본 오류 메시지 사용
        }

        throw new Error(message);
      }

      toast.success(
        "첨부파일이 삭제되었습니다."
      );

      await utils.workCommunity.get.invalidate({
        id: postId,
      });
    } catch (error: any) {
      toast.error(
        error?.message ||
          "첨부파일 삭제 중 오류가 발생했습니다."
      );
    }
  };

  if (
    !Number.isFinite(postId) ||
    postId <= 0
  ) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center">
          <p>
            올바른 게시글 주소가 아닙니다.
          </p>

          <Button
            className="mt-4"
            variant="outline"
            onClick={handleBack}
          >
            목록으로
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (postQuery.isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          게시글을 불러오고 있습니다.
        </CardContent>
      </Card>
    );
  }

  if (
    postQuery.isError ||
    !post
  ) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-10 text-center">
          <p className="font-medium">
            게시글을 찾을 수 없습니다.
          </p>

          <p className="mt-2 text-sm text-muted-foreground">
            삭제됐거나 열람 권한이 없는 게시글입니다.
          </p>

          <Button
            className="mt-5"
            variant="outline"
            onClick={handleBack}
          >
            목록으로
          </Button>
        </CardContent>
      </Card>
    );
  }

  const readers =
    (readersQuery.data ||
      []) as WorkPostReader[];

  const targetStatuses =
    (targetStatusQuery.data ||
      []) as WorkPostTargetStatus[];

  const needsAcknowledgement =
    post.requiresAcknowledgement &&
    !post.acknowledgedAt;

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={getCategoryColorClass(
                      post.categoryColor
                    )}
                  >
                    {post.categoryName}
                  </Badge>

                  {post.visibility ===
                  "targeted" ? (
                    <Badge
                      variant="outline"
                      className="border-rose-200 bg-rose-50 text-rose-700"
                    >
                      <LockKeyhole className="mr-1 h-3 w-3" />
                      지정공개
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <Users className="mr-1 h-3 w-3" />
                      전체공개
                    </Badge>
                  )}

                  {post.isPinned ? (
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-700"
                    >
                      <Pin className="mr-1 h-3 w-3" />
                      고정
                    </Badge>
                  ) : null}
                </div>

                <h1 className="mt-3 break-words text-2xl font-bold">
                  {post.title}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    {post.authorName ||
                      "작성자"}
                  </span>

                  <span>
                    {formatDate(
                      post.createdAt
                    )}
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {Number(
                      post.viewCount || 0
                    )}
                    명 열람
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    {Number(
                      post.commentCount || 0
                    )}
                  </span>
                </div>
              </div>
            </div>

            {post.canManage ? (
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleEditPost}
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  수정
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeletePost}
                  disabled={
                    deletePostMutation.isPending
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  삭제
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {needsAcknowledgement ? (
        <Card className="border-orange-200 bg-orange-50/60 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-orange-900">
                확인이 필요한 업무입니다.
              </p>

              <p className="mt-1 text-sm text-orange-700">
                내용을 확인한 후 확인 완료 버튼을 눌러주세요.
              </p>
            </div>

            <Button
              type="button"
              onClick={() =>
                acknowledgeMutation.mutate({
                  id: postId,
                })
              }
              disabled={
                acknowledgeMutation.isPending
              }
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              확인 완료
            </Button>
          </CardContent>
        </Card>
      ) : post.requiresAcknowledgement &&
        post.acknowledgedAt ? (
        <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />

            <div>
              <p className="font-semibold text-emerald-900">
                확인 완료
              </p>

              <p className="text-sm text-emerald-700">
                {formatDate(
                  post.acknowledgedAt
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-0 shadow-sm">
        <CardContent className="p-5 sm:p-7">
          <div className="min-h-40 whitespace-pre-wrap break-words text-sm leading-7 sm:text-base">
            {post.content}
          </div>
        </CardContent>
      </Card>

      {post.visibility ===
        "targeted" &&
      post.targets.length > 0 ? (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRoundCheck className="h-5 w-5" />
              공개 대상
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="flex flex-wrap gap-2">
              {post.targets.map(
                (target) => (
                  <Badge
                    key={target.userId}
                    variant="secondary"
                    className="py-1.5"
                  >
                    {getDisplayName(
                      target
                    )}
                  </Badge>
                )
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {post.attachments.length >
      0 ? (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Paperclip className="h-5 w-5" />
              첨부파일
              <Badge variant="secondary">
                {post.attachments.length}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            {post.attachments.map(
              (attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <FileText className="h-5 w-5 shrink-0 text-primary" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {attachment.originalName}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(
                        attachment.sizeBytes
                      )}
                    </p>
                  </div>

                  <Button
                    asChild
                    type="button"
                    size="icon"
                    variant="ghost"
                  >
                    <a
                      href={
  `/api/work-community/attachments/${attachment.id}/download`
}
                      download={
                        attachment.originalName
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>

                  {post.canManage ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        handleDeleteAttachment(
                          attachment
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              )
            )}
          </CardContent>
        </Card>
      ) : null}

      {post.canManage ? (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5" />
              열람 및 확인 현황
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {post.visibility ===
              "targeted" &&
            targetStatuses.length > 0 ? (
              targetStatuses.map(
                (status) => (
                  <div
                    key={status.userId}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {getDisplayName(
                          status
                        )}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {status.isRead
                          ? `열람 ${formatDate(
                              status.firstReadAt
                            )}`
                          : "미열람"}
                      </p>
                    </div>

                    <Badge
                      variant={
                        status.isAcknowledged
                          ? "default"
                          : "outline"
                      }
                    >
                      {status.isAcknowledged
                        ? "확인 완료"
                        : status.isRead
                          ? "열람"
                          : "미열람"}
                    </Badge>
                  </div>
                )
              )
            ) : readers.length > 0 ? (
              readers.map((reader) => (
                <div
                  key={reader.userId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {getDisplayName(
                        reader
                      )}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      최근 열람{" "}
                      {formatDate(
                        reader.lastReadAt
                      )}
                    </p>
                  </div>

                  {reader.acknowledgedAt ? (
                    <Badge>
                      확인 완료
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      열람
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                아직 열람한 사용자가 없습니다.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            댓글
            <Badge variant="secondary">
              {comments.length}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <form
            className="space-y-2"
            onSubmit={handleCreateComment}
          >
            <Textarea
              value={commentContent}
              onChange={(event) =>
                setCommentContent(
                  event.target.value
                )
              }
              placeholder="댓글을 입력해주세요."
              className="min-h-24"
              maxLength={5000}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  createCommentMutation.isPending
                }
              >
                <Send className="mr-2 h-4 w-4" />
                댓글 등록
              </Button>
            </div>
          </form>

          {commentsQuery.isLoading ? (
            <p className="py-5 text-center text-sm text-muted-foreground">
              댓글을 불러오고 있습니다.
            </p>
          ) : rootComments.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">
              아직 등록된 댓글이 없습니다.
            </p>
          ) : (
            <div className="space-y-4">
              {rootComments.map(
                (comment) => {
                  const replies =
                    replyMap.get(
                      Number(comment.id)
                    ) || [];

                  return (
                    <div
                      key={comment.id}
                      className="space-y-3"
                    >
                      <div className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {comment.authorName ||
                                `사용자 ${comment.authorId}`}
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(
                                comment.createdAt
                              )}
                            </p>
                          </div>

                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setReplyTarget(
                                  comment
                                );
                                setReplyContent(
                                  ""
                                );
                              }}
                            >
                              <Reply className="mr-1 h-4 w-4" />
                              답글
                            </Button>

                            {comment.canManage ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleStartEditComment(
                                      comment
                                    )
                                  }
                                >
                                  수정
                                </Button>

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleDeleteComment(
                                      Number(
                                        comment.id
                                      )
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {editingCommentId ===
                        Number(comment.id) ? (
                          <div className="mt-3 space-y-2">
                            <Textarea
                              value={editingContent}
                              onChange={(event) =>
                                setEditingContent(
                                  event.target.value
                                )
                              }
                              maxLength={5000}
                            />

                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingCommentId(
                                    null
                                  );
                                  setEditingContent(
                                    ""
                                  );
                                }}
                              >
                                취소
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  handleUpdateComment(
                                    Number(
                                      comment.id
                                    )
                                  )
                                }
                              >
                                저장
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                            {comment.content}
                          </p>
                        )}
                      </div>

                      {replies.map(
                        (reply) => (
                          <div
                            key={reply.id}
                            className="ml-5 rounded-lg border bg-muted/30 p-4 sm:ml-10"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">
                                  {reply.authorName ||
                                    `사용자 ${reply.authorId}`}
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formatDate(
                                    reply.createdAt
                                  )}
                                </p>
                              </div>

                              {reply.canManage ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    handleDeleteComment(
                                      Number(
                                        reply.id
                                      )
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              ) : null}
                            </div>

                            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                              {reply.content}
                            </p>
                          </div>
                        )
                      )}

                      {replyTarget?.id ===
                      comment.id ? (
                        <form
                          className="ml-5 space-y-2 rounded-lg border bg-muted/20 p-3 sm:ml-10"
                          onSubmit={
                            handleCreateReply
                          }
                        >
                          <p className="text-sm font-medium">
                            {comment.authorName ||
                              "작성자"}
                            님에게 답글
                          </p>

                          <Textarea
                            value={replyContent}
                            onChange={(event) =>
                              setReplyContent(
                                event.target.value
                              )
                            }
                            placeholder="답글을 입력해주세요."
                            maxLength={5000}
                          />

                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReplyTarget(
                                  null
                                );
                                setReplyContent(
                                  ""
                                );
                              }}
                            >
                              취소
                            </Button>

                            <Button
                              type="submit"
                              size="sm"
                              disabled={
                                createCommentMutation.isPending
                              }
                            >
                              <Send className="mr-2 h-4 w-4" />
                              답글 등록
                            </Button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
      </div>
    </div>
  );
}