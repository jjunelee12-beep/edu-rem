import { useMemo, useState } from "react";
import {
  useLocation,
} from "wouter";

import {
  Search,
  Plus,
  Users,
  UserRoundCheck,
  PenLine,
  MessageCircle,
  Paperclip,
  Eye,
  Pin,
  LockKeyhole,
  CheckCircle2,
  FolderKanban,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  Badge,
} from "@/components/ui/badge";

type WorkCategory = {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
};

type WorkPostListItem = {
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
  attachmentCount: number;
  targetCount: number;
  isRead: boolean;
  acknowledgedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type SpecialFilter =
  | "all"
  | "targeted"
  | "mine";

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

function stripHtml(value?: string | null) {
  if (!value) return "";

  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export default function WorkCommunityPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [searchInput, setSearchInput] =
    useState("");

  const [submittedSearch, setSubmittedSearch] =
    useState("");

  const [selectedCategoryId, setSelectedCategoryId] =
    useState<number | null>(null);

  const [specialFilter, setSpecialFilter] =
    useState<SpecialFilter>("all");

  const organizationSlug =
    (user as any)?.organizationSlug ||
    (user as any)?.organization?.slug ||
    "";

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

    if (cleanPath === "/") {
      return `/${organizationSlug}`;
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

  const {
    data: categoryRows = [],
    isLoading: categoriesLoading,
  } =
    trpc.workCommunity.categories.useQuery();

  const {
    data: postRows = [],
    isLoading: postsLoading,
    isFetching: postsFetching,
  } =
    trpc.workCommunity.list.useQuery(
      {
        categoryId:
          selectedCategoryId ?? undefined,

        search:
          submittedSearch || undefined,

        onlyMine:
          specialFilter === "mine",

        onlyTargetedToMe:
          specialFilter === "targeted",
      },
      {
        staleTime: 5_000,
      }
    );

  const categories =
    useMemo(
      () =>
        (categoryRows as WorkCategory[])
          .filter(
            (category) =>
              category.isActive !== false
          )
          .sort((a, b) => {
            if (
              Number(a.sortOrder) !==
              Number(b.sortOrder)
            ) {
              return (
                Number(a.sortOrder) -
                Number(b.sortOrder)
              );
            }

            return Number(a.id) - Number(b.id);
          }),
      [categoryRows]
    );

  const posts =
    useMemo(
      () =>
        (postRows as WorkPostListItem[]) ??
        [],
      [postRows]
    );

  const handleSearch = () => {
    setSubmittedSearch(
      searchInput.trim()
    );
  };

  const handleSearchKeyDown = (
    event:
      React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  const handleSelectAll = () => {
    setSelectedCategoryId(null);
    setSpecialFilter("all");
  };

  const handleSelectCategory = (
    categoryId: number
  ) => {
    setSelectedCategoryId(categoryId);
    setSpecialFilter("all");
  };

  const handleSelectTargeted = () => {
    setSelectedCategoryId(null);
    setSpecialFilter("targeted");
  };

  const handleSelectMine = () => {
    setSelectedCategoryId(null);
    setSpecialFilter("mine");
  };

  const handleOpenPost = (
    postId: number
  ) => {
    setLocation(
      withOrgPath(
        `/work-community/${postId}`
      )
    );
  };

  const handleOpenWrite = () => {
    setLocation(
      withOrgPath(
        "/work-community/write"
      )
    );
  };

  const isLoading =
    categoriesLoading || postsLoading;

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-6 w-6 text-primary" />

                <h1 className="text-2xl font-bold tracking-tight">
                  업무 커뮤니티
                </h1>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                업무자료와 인수인계를 필요한 직원에게
                안전하게 공유할 수 있습니다.
              </p>
            </div>

            <Button
              onClick={handleOpenWrite}
              className="shrink-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              글쓰기
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={
                  selectedCategoryId === null &&
                  specialFilter === "all"
                    ? "default"
                    : "outline"
                }
                onClick={handleSelectAll}
              >
                <Users className="mr-1.5 h-4 w-4" />
                전체
              </Button>

              {categories.map(
                (category) => (
                  <Button
                    key={category.id}
                    type="button"
                    size="sm"
                    variant={
                      selectedCategoryId ===
                      Number(category.id)
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      handleSelectCategory(
                        Number(category.id)
                      )
                    }
                  >
                    {category.name}
                  </Button>
                )
              )}

              <Button
                type="button"
                size="sm"
                variant={
                  specialFilter === "targeted"
                    ? "default"
                    : "outline"
                }
                onClick={
                  handleSelectTargeted
                }
              >
                <UserRoundCheck className="mr-1.5 h-4 w-4" />
                나에게 지정
              </Button>

              <Button
                type="button"
                size="sm"
                variant={
                  specialFilter === "mine"
                    ? "default"
                    : "outline"
                }
                onClick={handleSelectMine}
              >
                <PenLine className="mr-1.5 h-4 w-4" />
                내가 작성
              </Button>
            </div>

            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  value={searchInput}
                  onChange={(event) =>
                    setSearchInput(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleSearchKeyDown
                  }
                  placeholder="제목, 내용, 작성자 검색"
                  className="pl-9"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleSearch}
                disabled={postsFetching}
              >
                검색
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between px-1">
        <div className="text-sm text-muted-foreground">
          총{" "}
          <span className="font-semibold text-foreground">
            {posts.length}
          </span>
          건
        </div>

        {postsFetching &&
        !postsLoading ? (
          <span className="text-xs text-muted-foreground">
            목록을 갱신하고 있습니다.
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex min-h-56 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              업무 게시글을 불러오고 있습니다.
            </p>
          </CardContent>
        </Card>
      ) : posts.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
            <FolderKanban className="h-10 w-10 text-muted-foreground/50" />

            <div>
              <p className="font-medium">
                표시할 업무 게시글이 없습니다.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                새로운 업무자료나 인수인계를
                공유해보세요.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleOpenWrite}
            >
              <Plus className="mr-2 h-4 w-4" />
              첫 게시글 작성
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const preview =
              stripHtml(post.content);

            const needsMyAcknowledgement =
              !!post.requiresAcknowledgement &&
              !post.acknowledgedAt;

            return (
              <Card
                key={post.id}
                className={[
                  "cursor-pointer border transition-colors hover:border-primary/40 hover:bg-muted/20",
                  !post.isRead
                    ? "border-primary/30 bg-primary/[0.025]"
                    : "",
                ].join(" ")}
                onClick={() =>
                  handleOpenPost(
                    Number(post.id)
                  )
                }
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            getCategoryColorClass(
                              post.categoryColor
                            )
                          }
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
                        ) : null}

                        {post.isPinned ? (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700"
                          >
                            <Pin className="mr-1 h-3 w-3" />
                            고정
                          </Badge>
                        ) : null}

                        {needsMyAcknowledgement ? (
                          <Badge
                            variant="outline"
                            className="border-orange-200 bg-orange-50 text-orange-700"
                          >
                            확인 필요
                          </Badge>
                        ) : null}

                        {post.acknowledgedAt ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            확인 완료
                          </Badge>
                        ) : null}

                        {!post.isRead ? (
                          <Badge>새 글</Badge>
                        ) : null}
                      </div>

                      <h2 className="mt-3 truncate text-base font-semibold sm:text-lg">
                        {post.title}
                      </h2>

                      {preview ? (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {preview}
                        </p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
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
                          <Eye className="h-3.5 w-3.5" />
                          {Number(
                            post.viewCount || 0
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {Number(
                            post.commentCount ||
                              0
                          )}
                        </span>

                        {Number(
                          post.attachmentCount ||
                            0
                        ) > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3.5 w-3.5" />
                            {Number(
                              post.attachmentCount
                            )}
                          </span>
                        ) : null}

                        {post.visibility ===
                          "targeted" &&
                        Number(
                          post.targetCount || 0
                        ) > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <UserRoundCheck className="h-3.5 w-3.5" />
                            {Number(
                              post.targetCount
                            )}
                            명 지정
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}