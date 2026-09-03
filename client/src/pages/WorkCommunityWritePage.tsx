import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  LockKeyhole,
  Paperclip,
  Pin,
  Search,
  Send,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type WorkCategory = {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
};

type WorkCommunityMember = {
  id: number;
  displayNo: number;
  name?: string | null;
  username?: string | null;
  role:
    | "staff"
    | "admin"
    | "host"
    | "superhost"
    | string;
  profileImageUrl?: string | null;
  teamId?: number | null;
  teamName?: string | null;
  positionId?: number | null;
  positionName?: string | null;
};

type Visibility = "all" | "targeted";

const MAX_FILE_SIZE_BYTES =
  20 * 1024 * 1024;

const MAX_FILE_COUNT = 10;

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "com",
  "bat",
  "cmd",
  "msi",
  "scr",
  "ps1",
  "sh",
  "js",
  "mjs",
  "cjs",
  "php",
  "jsp",
  "asp",
  "aspx",
]);

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size}B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)}KB`;
  }

  return `${(
    size /
    (1024 * 1024)
  ).toFixed(1)}MB`;
}

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");

  if (index < 0) {
    return "";
  }

  return fileName
    .slice(index + 1)
    .toLowerCase();
}

function getRoleLabel(role?: string | null) {
  if (role === "superhost") return "Superhost";
  if (role === "host") return "Host";
  if (role === "admin") return "Admin";
  return "Staff";
}

export default function WorkCommunityWritePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [categoryId, setCategoryId] =
    useState<number | null>(null);

  const [title, setTitle] =
    useState("");

  const [content, setContent] =
    useState("");

  const [visibility, setVisibility] =
    useState<Visibility>("all");

  const [selectedUserIds, setSelectedUserIds] =
    useState<number[]>([]);

  const [memberSearch, setMemberSearch] =
    useState("");

  const [
    requiresAcknowledgement,
    setRequiresAcknowledgement,
  ] = useState(false);

  const [isPinned, setIsPinned] =
    useState(false);

  const [files, setFiles] =
    useState<File[]>([]);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const organizationSlug =
    (user as any)?.organizationSlug ||
    (user as any)?.organization?.slug ||
    "";

  const currentUserId =
    Number((user as any)?.id || 0);

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
    data: memberRows = [],
    isLoading: membersLoading,
  } =
    trpc.workCommunity.members.useQuery();

  const createMutation =
    trpc.workCommunity.create.useMutation();

  const categories = useMemo(
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

  const members = useMemo(
    () =>
      (memberRows as WorkCommunityMember[])
        .filter(
          (member) =>
            Number(member.id) !==
            currentUserId
        )
        .sort((a, b) => {
          if (
            Number(a.displayNo) !==
            Number(b.displayNo)
          ) {
            return (
              Number(a.displayNo) -
              Number(b.displayNo)
            );
          }

          return Number(a.id) - Number(b.id);
        }),
    [memberRows, currentUserId]
  );

  const filteredMembers = useMemo(() => {
    const keyword =
      memberSearch
        .trim()
        .toLowerCase();

    if (!keyword) {
      return members;
    }

    return members.filter((member) => {
      const searchable = [
        member.name,
        member.username,
        member.teamName,
        member.positionName,
        getRoleLabel(member.role),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [members, memberSearch]);

  const selectedMembers = useMemo(
    () =>
      members.filter((member) =>
        selectedUserIds.includes(
          Number(member.id)
        )
      ),
    [members, selectedUserIds]
  );

  const handleBack = () => {
    setLocation(
      withOrgPath("/work-community")
    );
  };

  const handleVisibilityChange = (
    nextVisibility: Visibility
  ) => {
    setVisibility(nextVisibility);

    if (nextVisibility === "all") {
      setSelectedUserIds([]);
    }
  };

  const handleToggleMember = (
    userId: number
  ) => {
    setSelectedUserIds((previous) =>
      previous.includes(userId)
        ? previous.filter(
            (id) => id !== userId
          )
        : [...previous, userId]
    );
  };

  const handleSelectAllFilteredMembers = () => {
    const filteredIds =
      filteredMembers.map((member) =>
        Number(member.id)
      );

    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) =>
        selectedUserIds.includes(id)
      );

    if (allSelected) {
      setSelectedUserIds((previous) =>
        previous.filter(
          (id) =>
            !filteredIds.includes(id)
        )
      );

      return;
    }

    setSelectedUserIds((previous) =>
      Array.from(
        new Set([
          ...previous,
          ...filteredIds,
        ])
      )
    );
  };

  const handleFilesChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles =
      Array.from(
        event.target.files || []
      );

    if (!selectedFiles.length) {
      return;
    }

    const nextFiles = [...files];

    for (const file of selectedFiles) {
      if (
        nextFiles.length >=
        MAX_FILE_COUNT
      ) {
        toast.error(
          `첨부파일은 최대 ${MAX_FILE_COUNT}개까지 선택할 수 있습니다.`
        );
        break;
      }

      if (
        file.size >
        MAX_FILE_SIZE_BYTES
      ) {
        toast.error(
          `${file.name}: 파일 크기는 최대 20MB까지 가능합니다.`
        );
        continue;
      }

      const extension =
        getFileExtension(file.name);

      if (
        BLOCKED_EXTENSIONS.has(
          extension
        )
      ) {
        toast.error(
          `${file.name}: 허용되지 않는 파일 형식입니다.`
        );
        continue;
      }

      const duplicated =
        nextFiles.some(
          (existingFile) =>
            existingFile.name ===
              file.name &&
            existingFile.size ===
              file.size &&
            existingFile.lastModified ===
              file.lastModified
        );

      if (duplicated) {
        toast.error(
          `${file.name}: 이미 선택된 파일입니다.`
        );
        continue;
      }

      nextFiles.push(file);
    }

    setFiles(nextFiles);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (
    index: number
  ) => {
    setFiles((previous) =>
      previous.filter(
        (_, fileIndex) =>
          fileIndex !== index
      )
    );
  };

  const validateForm = () => {
    if (!categoryId) {
      toast.error(
        "업무 카테고리를 선택해주세요."
      );
      return false;
    }

    if (!title.trim()) {
      toast.error("제목을 입력해주세요.");
      return false;
    }

    if (title.trim().length > 255) {
      toast.error(
        "제목은 255자 이하로 입력해주세요."
      );
      return false;
    }

    if (!content.trim()) {
      toast.error("내용을 입력해주세요.");
      return false;
    }

    if (
      visibility === "targeted" &&
      selectedUserIds.length === 0
    ) {
      toast.error(
        "지정 공개 대상자를 한 명 이상 선택해주세요."
      );
      return false;
    }

    return true;
  };

  const uploadAttachments = async (
    postId: number
  ) => {
    const failedFileNames: string[] = [];

    for (const file of files) {
      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        const response =
          await fetch(
            `/api/work-community/${postId}/attachments`,
            {
              method: "POST",
              body: formData,
              credentials: "include",
            }
          );

        if (!response.ok) {
          let message =
            "파일 업로드에 실패했습니다.";

          try {
            const body =
              await response.json();

            message =
              body?.message || message;
          } catch {
            // JSON 응답이 아니면 기본 메시지 사용
          }

          throw new Error(message);
        }
      } catch (error) {
        console.error(
          "[WORK_COMMUNITY_FILE_UPLOAD_ERROR]",
          error
        );

        failedFileNames.push(
          file.name
        );
      }
    }

    return failedFileNames;
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        await createMutation.mutateAsync({
          categoryId:
            Number(categoryId),

          title: title.trim(),

          content:
            content.trim(),

          visibility,

          targetUserIds:
            visibility === "targeted"
              ? selectedUserIds
              : [],

          requiresAcknowledgement,

          isPinned,
        });

      const postId =
        Number(result.id);

      if (
        !Number.isFinite(postId) ||
        postId <= 0
      ) {
        throw new Error(
          "생성된 게시글 ID가 올바르지 않습니다."
        );
      }

      const failedFileNames =
        await uploadAttachments(
          postId
        );

      if (
        failedFileNames.length > 0
      ) {
        toast.warning(
          `게시글은 등록됐지만 ${failedFileNames.length}개 파일 업로드에 실패했습니다.`
        );
      } else {
        toast.success(
          "업무 게시글이 등록되었습니다."
        );
      }

      setLocation(
        withOrgPath(
          `/work-community/${postId}`
        )
      );
    } catch (error: any) {
      console.error(
        "[WORK_COMMUNITY_CREATE_ERROR]",
        error
      );

      toast.error(
        error?.message ||
          "게시글 등록 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const allFilteredSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((member) =>
      selectedUserIds.includes(
        Number(member.id)
      )
    );

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit}
    >
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div>
                <h1 className="text-2xl font-bold">
                  업무 글쓰기
                </h1>

                <p className="mt-1 text-sm text-muted-foreground">
                  업무자료, 인수인계와 필요한 파일을 공유합니다.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={
                isSubmitting ||
                categoriesLoading
              }
            >
              <Send className="mr-2 h-4 w-4" />

              {isSubmitting
                ? "등록 중..."
                : "게시글 등록"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            기본 정보
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="work-category">
              업무 카테고리
            </Label>

            <select
              id="work-category"
              value={
                categoryId ?? ""
              }
              onChange={(event) =>
                setCategoryId(
                  event.target.value
                    ? Number(
                        event.target.value
                      )
                    : null
                )
              }
              disabled={
                categoriesLoading ||
                isSubmitting
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">
                카테고리를 선택해주세요.
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="work-title">
              제목
            </Label>

            <Input
              id="work-title"
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value
                )
              }
              maxLength={255}
              disabled={isSubmitting}
              placeholder="업무 제목을 입력해주세요."
            />

            <div className="text-right text-xs text-muted-foreground">
              {title.length}/255
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="work-content">
              내용
            </Label>

            <Textarea
              id="work-content"
              value={content}
              onChange={(event) =>
                setContent(
                  event.target.value
                )
              }
              disabled={isSubmitting}
              placeholder="업무 내용이나 인수인계 사항을 입력해주세요."
              className="min-h-[280px] resize-y leading-7"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            공개 대상
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                handleVisibilityChange(
                  "all"
                )
              }
              className={[
                "rounded-xl border p-4 text-left transition-colors",
                visibility === "all"
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/40",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <Users className="h-5 w-5 text-primary" />

                {visibility === "all" ? (
                  <Check className="h-5 w-5 text-primary" />
                ) : null}
              </div>

              <p className="mt-3 font-semibold">
                전체 공개
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                회사 구성원 모두가 볼 수 있습니다.
              </p>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                handleVisibilityChange(
                  "targeted"
                )
              }
              className={[
                "rounded-xl border p-4 text-left transition-colors",
                visibility === "targeted"
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/40",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <LockKeyhole className="h-5 w-5 text-primary" />

                {visibility ===
                "targeted" ? (
                  <Check className="h-5 w-5 text-primary" />
                ) : null}
              </div>

              <p className="mt-3 font-semibold">
                지정 사용자만 공개
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                작성자, 지정된 직원과 Host만 볼 수 있습니다.
              </p>
            </button>
          </div>

          {visibility === "targeted" ? (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    공개 대상 직원
                  </p>

                  <p className="text-sm text-muted-foreground">
                    선택되지 않은 직원에게는 게시글 자체가 표시되지 않습니다.
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={
                    handleSelectAllFilteredMembers
                  }
                  disabled={
                    isSubmitting ||
                    membersLoading ||
                    filteredMembers.length ===
                      0
                  }
                >
                  {allFilteredSelected
                    ? "검색 결과 선택 해제"
                    : "검색 결과 전체 선택"}
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  value={memberSearch}
                  onChange={(event) =>
                    setMemberSearch(
                      event.target.value
                    )
                  }
                  disabled={
                    isSubmitting
                  }
                  placeholder="이름, 아이디, 팀, 직급 검색"
                  className="pl-9"
                />
              </div>

              {selectedMembers.length >
              0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map(
                    (member) => (
                      <Badge
                        key={member.id}
                        variant="secondary"
                        className="gap-1 py-1.5"
                      >
                        {member.name ||
                          member.username ||
                          `사용자 ${member.id}`}

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleMember(
                              Number(
                                member.id
                              )
                            )
                          }
                          className="ml-1 rounded-full hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    )
                  )}
                </div>
              ) : null}

              <div className="max-h-72 divide-y overflow-y-auto rounded-lg border bg-background">
                {membersLoading ? (
                  <div className="p-5 text-center text-sm text-muted-foreground">
                    직원 목록을 불러오고 있습니다.
                  </div>
                ) : filteredMembers.length ===
                  0 ? (
                  <div className="p-5 text-center text-sm text-muted-foreground">
                    검색된 직원이 없습니다.
                  </div>
                ) : (
                  filteredMembers.map(
                    (member) => {
                      const memberId =
                        Number(member.id);

                      const checked =
                        selectedUserIds.includes(
                          memberId
                        );

                      return (
                        <button
                          key={memberId}
                          type="button"
                          onClick={() =>
                            handleToggleMember(
                              memberId
                            )
                          }
                          disabled={
                            isSubmitting
                          }
                          className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={
                              checked
                            }
                            tabIndex={-1}
                            aria-hidden
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">
                                {member.name ||
                                  member.username ||
                                  `사용자 ${memberId}`}
                              </span>

                              <Badge
                                variant="outline"
                                className="text-[10px]"
                              >
                                {getRoleLabel(
                                  member.role
                                )}
                              </Badge>
                            </div>

                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {[
                                member.teamName,
                                member.positionName,
                                member.username,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(" · ") ||
                                "소속 정보 없음"}
                            </p>
                          </div>
                        </button>
                      );
                    }
                  )
                )}
              </div>

              <p className="text-sm font-medium text-primary">
                {selectedUserIds.length}명 선택
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            업무 설정
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="requires-acknowledgement"
              checked={
                requiresAcknowledgement
              }
              onCheckedChange={(
                checked
              ) =>
                setRequiresAcknowledgement(
                  checked === true
                )
              }
              disabled={isSubmitting}
            />

            <div className="space-y-1">
              <Label
                htmlFor="requires-acknowledgement"
                className="flex cursor-pointer items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4 text-primary" />
                확인 완료 요청
              </Label>

              <p className="text-sm text-muted-foreground">
                열람자가 확인 완료 버튼을 눌러야 하며 작성자는 확인 현황을 볼 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="work-pinned"
              checked={isPinned}
              onCheckedChange={(
                checked
              ) =>
                setIsPinned(
                  checked === true
                )
              }
              disabled={isSubmitting}
            />

            <div className="space-y-1">
              <Label
                htmlFor="work-pinned"
                className="flex cursor-pointer items-center gap-2"
              >
                <Pin className="h-4 w-4 text-amber-600" />
                목록 상단 고정
              </Label>

              <p className="text-sm text-muted-foreground">
                중요한 업무 게시글을 목록 상단에 표시합니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Paperclip className="h-5 w-5" />
            첨부파일
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesChange}
          />

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() =>
              fileInputRef.current?.click()
            }
            className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors hover:border-primary hover:bg-primary/[0.025]"
          >
            <UploadCloud className="h-9 w-9 text-primary" />

            <p className="mt-3 font-medium">
              파일 선택
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              파일당 최대 20MB · 최대 10개
            </p>
          </button>

          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map(
                (file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-primary" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {file.name}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(
                          file.size
                        )}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        handleRemoveFile(
                          index
                        )
                      }
                      disabled={
                        isSubmitting
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={isSubmitting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          취소
        </Button>

        <Button
          type="submit"
          disabled={
            isSubmitting ||
            categoriesLoading
          }
        >
          <Send className="mr-2 h-4 w-4" />

          {isSubmitting
            ? files.length > 0
              ? "게시글 및 파일 등록 중..."
              : "게시글 등록 중..."
            : "게시글 등록"}
        </Button>
      </div>
    </form>
  );
}