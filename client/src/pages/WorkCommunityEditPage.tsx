import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  LockKeyhole,
  Paperclip,
  Pin,
  Save,
  Search,
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

type Visibility = "all" | "targeted";

type WorkCategory = {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type WorkMember = {
  id: number;
  displayNo: number;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  teamName?: string | null;
  positionName?: string | null;
};

type WorkTarget = {
  userId: number;
};

type WorkAttachment = {
  id: number;
  originalName: string;
  url: string;
  sizeBytes: number;
};

type WorkPost = {
  id: number;
  categoryId: number;
  title: string;
  content: string;
  visibility: Visibility;
  requiresAcknowledgement: boolean;
  isPinned: boolean;
  canManage: boolean;
  targets: WorkTarget[];
  attachments: WorkAttachment[];
};

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
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

function formatFileSize(size?: number | null) {
  const value = Number(size || 0);

  if (value < 1024) {
    return `${value}B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)}KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

function getExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");

  if (index < 0) {
    return "";
  }

  return fileName.slice(index + 1).toLowerCase();
}

function getMemberName(member: WorkMember) {
  return (
    member.name ||
    member.username ||
    `사용자 ${member.id}`
  );
}

export default function WorkCommunityEditPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [, orgParams] = useRoute(
    "/:organizationSlug/work-community/:id/edit"
  );

  const [, plainParams] = useRoute(
    "/work-community/:id/edit"
  );

  const params = orgParams || plainParams;
  const postId = Number(params?.id || 0);

  const fileInputRef = useRef<HTMLInputElement | null>(
    null
  );

  const initializedPostId = useRef<number | null>(null);

  const [categoryId, setCategoryId] =
    useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

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

  const [newFiles, setNewFiles] =
    useState<File[]>([]);

  const [isSaving, setIsSaving] =
    useState(false);

  const organizationSlug =
    (user as any)?.organizationSlug ||
    (user as any)?.organization?.slug ||
    "";

  const currentUserId = Number(
    (user as any)?.id || 0
  );

  const withOrgPath = (path: string) => {
    if (!organizationSlug) {
      return path;
    }

    return `/${organizationSlug}${
      path.startsWith("/") ? path : `/${path}`
    }`;
  };

  const utils = trpc.useUtils();

  const postQuery =
    trpc.workCommunity.get.useQuery(
      { id: postId },
      {
        enabled: postId > 0,
        retry: false,
      }
    );

  const categoriesQuery =
    trpc.workCommunity.categories.useQuery();

  const membersQuery =
    trpc.workCommunity.members.useQuery();

  const updateMutation =
    trpc.workCommunity.update.useMutation();

  const post = postQuery.data as WorkPost | undefined;

  const categories = useMemo(
    () =>
      ((categoriesQuery.data || []) as WorkCategory[])
        .filter((row) => row.isActive !== false)
        .sort(
          (a, b) =>
            Number(a.sortOrder) -
              Number(b.sortOrder) ||
            Number(a.id) - Number(b.id)
        ),
    [categoriesQuery.data]
  );

  const members = useMemo(
    () =>
      ((membersQuery.data || []) as WorkMember[])
        .filter(
          (member) =>
            Number(member.id) !== currentUserId
        )
        .sort(
          (a, b) =>
            Number(a.displayNo) -
              Number(b.displayNo) ||
            Number(a.id) - Number(b.id)
        ),
    [membersQuery.data, currentUserId]
  );

  const filteredMembers = useMemo(() => {
    const keyword = memberSearch
      .trim()
      .toLowerCase();

    if (!keyword) {
      return members;
    }

    return members.filter((member) => {
      const text = [
        member.name,
        member.username,
        member.teamName,
        member.positionName,
        member.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [members, memberSearch]);

  useEffect(() => {
    if (
      !post ||
      initializedPostId.current === Number(post.id)
    ) {
      return;
    }

    initializedPostId.current = Number(post.id);

    setCategoryId(Number(post.categoryId));
    setTitle(String(post.title || ""));
    setContent(String(post.content || ""));
    setVisibility(post.visibility);
    setRequiresAcknowledgement(
      !!post.requiresAcknowledgement
    );
    setIsPinned(!!post.isPinned);

    setSelectedUserIds(
      (post.targets || []).map((target) =>
        Number(target.userId)
      )
    );
  }, [post]);

  const handleBack = () => {
    setLocation(
      withOrgPath(`/work-community/${postId}`)
    );
  };

  const handleToggleMember = (userId: number) => {
    setSelectedUserIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId]
    );
  };

  const handleFilesChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(
      event.target.files || []
    );

    const nextFiles = [...newFiles];

    for (const file of selectedFiles) {
      if (nextFiles.length >= MAX_FILE_COUNT) {
        toast.error(
          `새 첨부파일은 최대 ${MAX_FILE_COUNT}개까지 가능합니다.`
        );
        break;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(
          `${file.name}: 파일 크기는 최대 20MB입니다.`
        );
        continue;
      }

      if (
        BLOCKED_EXTENSIONS.has(
          getExtension(file.name)
        )
      ) {
        toast.error(
          `${file.name}: 허용되지 않는 파일 형식입니다.`
        );
        continue;
      }

      const duplicated = nextFiles.some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified
      );

      if (!duplicated) {
        nextFiles.push(file);
      }
    }

    setNewFiles(nextFiles);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadNewFiles = async () => {
    const failedFiles: string[] = [];

    for (const file of newFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          `/api/work-community/${postId}/attachments`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          }
        );

        if (!response.ok) {
          let message = "파일 업로드에 실패했습니다.";

          try {
            const body = await response.json();
            message = body?.message || message;
          } catch {
            // 기본 메시지 사용
          }

          throw new Error(message);
        }
      } catch (error) {
        console.error(
          "[WORK_COMMUNITY_EDIT_UPLOAD_ERROR]",
          error
        );

        failedFiles.push(file.name);
      }
    }

    return failedFiles;
  };

  const handleDeleteAttachment = async (
    attachment: WorkAttachment
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
        let message = "파일 삭제에 실패했습니다.";

        try {
          const body = await response.json();
          message = body?.message || message;
        } catch {
          // 기본 메시지 사용
        }

        throw new Error(message);
      }

      toast.success("첨부파일이 삭제되었습니다.");

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

  const validate = () => {
    if (!categoryId) {
      toast.error("카테고리를 선택해주세요.");
      return false;
    }

    if (!title.trim()) {
      toast.error("제목을 입력해주세요.");
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

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (isSaving || !validate()) {
      return;
    }

    setIsSaving(true);

    try {
      await updateMutation.mutateAsync({
        id: postId,
        categoryId: Number(categoryId),
        title: title.trim(),
        content: content.trim(),
        visibility,
        targetUserIds:
          visibility === "targeted"
            ? selectedUserIds
            : [],
        requiresAcknowledgement,
        isPinned,
      });

      const failedFiles = await uploadNewFiles();

      await Promise.all([
        utils.workCommunity.get.invalidate({
          id: postId,
        }),
        utils.workCommunity.list.invalidate(),
      ]);

      if (failedFiles.length > 0) {
        toast.warning(
          `게시글은 수정됐지만 ${failedFiles.length}개 파일 업로드에 실패했습니다.`
        );
      } else {
        toast.success("게시글이 수정되었습니다.");
      }

      setLocation(
        withOrgPath(`/work-community/${postId}`)
      );
    } catch (error: any) {
      toast.error(
        error?.message ||
          "게시글 수정 중 오류가 발생했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  };

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
    !post ||
    !post.canManage
  ) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-10 text-center">
          <p className="font-medium">
            게시글을 수정할 수 없습니다.
          </p>

          <p className="mt-2 text-sm text-muted-foreground">
            삭제됐거나 수정 권한이 없는 게시글입니다.
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={handleBack}
          >
            돌아가기
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit}
    >
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={handleBack}
              disabled={isSaving}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="text-2xl font-bold">
                업무 게시글 수정
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                게시글 내용과 공개 대상을 변경합니다.
              </p>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSaving}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "저장 중..." : "저장"}
          </Button>
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
            <Label htmlFor="edit-category">
              업무 카테고리
            </Label>

            <select
              id="edit-category"
              value={categoryId ?? ""}
              onChange={(event) =>
                setCategoryId(
                  event.target.value
                    ? Number(event.target.value)
                    : null
                )
              }
              disabled={isSaving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">
                카테고리를 선택해주세요.
              </option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-title">
              제목
            </Label>

            <Input
              id="edit-title"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              maxLength={255}
              disabled={isSaving}
            />

            <p className="text-right text-xs text-muted-foreground">
              {title.length}/255
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-content">
              내용
            </Label>

            <Textarea
              id="edit-content"
              value={content}
              onChange={(event) =>
                setContent(event.target.value)
              }
              disabled={isSaving}
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
              disabled={isSaving}
              onClick={() => {
                setVisibility("all");
                setSelectedUserIds([]);
              }}
              className={`rounded-xl border p-4 text-left ${
                visibility === "all"
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
            >
              <Users className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">
                전체 공개
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                회사 구성원 모두가 볼 수 있습니다.
              </p>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                setVisibility("targeted")
              }
              className={`rounded-xl border p-4 text-left ${
                visibility === "targeted"
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
            >
              <LockKeyhole className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">
                지정 사용자만 공개
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                지정되지 않은 직원에게는 표시되지 않습니다.
              </p>
            </button>
          </div>

          {visibility === "targeted" ? (
            <div className="space-y-3 rounded-xl border p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  value={memberSearch}
                  onChange={(event) =>
                    setMemberSearch(event.target.value)
                  }
                  placeholder="이름, 아이디, 팀 검색"
                  className="pl-9"
                />
              </div>

              <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                {filteredMembers.map((member) => {
                  const memberId = Number(member.id);
                  const checked =
                    selectedUserIds.includes(memberId);

                  return (
                    <button
                      key={memberId}
                      type="button"
                      onClick={() =>
                        handleToggleMember(memberId)
                      }
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={checked}
                        tabIndex={-1}
                        aria-hidden
                      />

                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {getMemberName(member)}
                        </p>

                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            member.teamName,
                            member.positionName,
                            member.username,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "소속 정보 없음"}
                        </p>
                      </div>

                      {checked ? (
                        <Badge>선택</Badge>
                      ) : null}
                    </button>
                  );
                })}
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
              id="edit-acknowledgement"
              checked={requiresAcknowledgement}
              onCheckedChange={(checked) =>
                setRequiresAcknowledgement(
                  checked === true
                )
              }
            />

            <Label
              htmlFor="edit-acknowledgement"
              className="cursor-pointer"
            >
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                확인 완료 요청
              </span>

              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                열람자가 확인 완료 버튼을 눌러야 합니다.
              </span>
            </Label>
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="edit-pinned"
              checked={isPinned}
              onCheckedChange={(checked) =>
                setIsPinned(checked === true)
              }
            />

            <Label
              htmlFor="edit-pinned"
              className="cursor-pointer"
            >
              <span className="flex items-center gap-2 font-medium">
                <Pin className="h-4 w-4 text-amber-600" />
                목록 상단 고정
              </span>
            </Label>
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
          {post.attachments.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                기존 첨부파일
              </p>

              {post.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <FileText className="h-5 w-5 text-primary" />

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
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      handleDeleteAttachment(attachment)
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesChange}
          />

          <button
            type="button"
            disabled={isSaving}
            onClick={() =>
              fileInputRef.current?.click()
            }
            className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed p-5 hover:border-primary"
          >
            <UploadCloud className="h-8 w-8 text-primary" />
            <p className="mt-2 font-medium">
              새 파일 추가
            </p>
            <p className="text-sm text-muted-foreground">
              파일당 최대 20MB
            </p>
          </button>

          {newFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <FileText className="h-5 w-5 text-primary" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  setNewFiles((previous) =>
                    previous.filter(
                      (_, fileIndex) =>
                        fileIndex !== index
                    )
                  )
                }
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={isSaving}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          취소
        </Button>

        <Button
          type="submit"
          disabled={isSaving}
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "저장 중..." : "변경사항 저장"}
        </Button>
      </div>
    </form>
  );
}