import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import NoticeRichEditor from "@/components/notices/NoticeRichEditor";

import {
  ArrowLeft,
  BellRing,
  Pin,
  Paperclip,
  Upload,
  X,
  Loader2,
  Eye,
  Send,
  FileText,
} from "lucide-react";

type UploadedAttachment = {
  name: string;
  url: string;
  size?: number;
};

const NOTICE_WRITE_DRAFT_KEY = "notice-write-draft";

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10}KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10}MB`;
}

async function uploadNoticeAttachment(file: File): Promise<UploadedAttachment> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL || ""}/api/upload`,
    {
      method: "POST",
      body: formData,
      credentials: "include",
    }
  );

  if (!res.ok) {
    throw new Error("첨부파일 업로드에 실패했습니다.");
  }

  const json = await res.json();
  const fileUrl = json?.fileUrl || json?.url;

  if (!fileUrl) {
    throw new Error("업로드 URL을 가져오지 못했습니다.");
  }

  return {
    name: file.name,
    url: String(fileUrl),
    size: file.size,
  };
}

function buildAttachmentHtml(content: string, attachments: UploadedAttachment[]) {
  if (!attachments.length) return content;

  const attachmentHtml = `
    <div class="notice-attachments-block" data-notice-attachments="true">
      <hr />
      <h3>첨부파일</h3>
      <ul>
        ${attachments
          .map(
            (file) =>
              `<li><a href="${file.url}" target="_blank" rel="noopener noreferrer">${file.name}</a></li>`
          )
          .join("")}
      </ul>
    </div>
  `;

  const cleaned = content.replace(
    /<div class="notice-attachments-block" data-notice-attachments="true">[\s\S]*?<\/div>/g,
    ""
  );

  return `${cleaned}${attachmentHtml}`;
}

function parseDraftSafely(raw: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return {
      title: parsed?.title ?? "",
      content: parsed?.content ?? "",
      isPinned: !!parsed?.isPinned,
      importance: (parsed?.importance ?? "normal") as
        | "normal"
        | "important"
        | "urgent",
      attachments: Array.isArray(parsed?.attachments) ? parsed.attachments : [],
    };
  } catch {
    return null;
  }
}

export default function NoticeWritePage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [importance, setImportance] = useState<"normal" | "important" | "urgent">("normal");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

useEffect(() => {
  const saved = parseDraftSafely(sessionStorage.getItem(NOTICE_WRITE_DRAFT_KEY));
  if (!saved) return;

  setTitle(saved.title);
  setContent(saved.content);
  setIsPinned(saved.isPinned);
  setImportance(saved.importance);
  setAttachments(saved.attachments);
}, []);

  const createMutation = trpc.notice.create.useMutation({
    onSuccess: async () => {
  sessionStorage.removeItem(NOTICE_WRITE_DRAFT_KEY);
  toast.success("공지사항이 등록되었습니다.");
  await utils.notice.list.invalidate();
  setLocation("/notices");
},
    onError: (err) => {
      toast.error(err.message || "공지사항 등록 중 오류가 발생했습니다.");
    },
  });

  const importanceLabel = useMemo(() => {
    if (importance === "urgent") return "긴급 공지";
    if (importance === "important") return "중요 공지";
    return "일반 공지";
  }, [importance]);

  const handleUploadAttachments = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      setIsUploadingAttachment(true);

      const uploaded = await Promise.all(
        Array.from(files).map((file) => uploadNoticeAttachment(file))
      );

      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (error: any) {
      alert(error?.message || "첨부파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

const handleSaveDraft = () => {
  sessionStorage.setItem(
    NOTICE_WRITE_DRAFT_KEY,
    JSON.stringify({
      title,
      content,
      isPinned,
      importance,
      attachments,
      savedAt: new Date().toISOString(),
    })
  );

  toast.success("임시저장되었습니다.");
};

  const handleSubmit = () => {
    const nextTitle = title.trim();
    const nextContent = content.trim();

    if (!nextTitle) {
      alert("제목을 입력해주세요.");
      return;
    }

    if (!nextContent || nextContent === "<p></p>") {
      alert("내용을 입력해주세요.");
      return;
    }

    const mergedContent = buildAttachmentHtml(nextContent, attachments);

    createMutation.mutate({
      title: nextTitle,
      content: mergedContent,
      isPinned,
      importance,
    });
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 rounded-3xl border bg-white/90 px-6 py-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  공지사항 작성
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  중요한 안내를 전사에 공유하는 공지 작성 화면입니다.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          <Button
  variant="outline"
  className="h-11 rounded-xl"
  onClick={() => setLocation("/notices")}
>
  <ArrowLeft className="mr-2 h-4 w-4" />
  목록으로
</Button>

<Button
  variant="outline"
  className="h-11 rounded-xl"
  onClick={() => {
    const nextTitle = title.trim();
    const nextContent = content.trim();

    if (!nextTitle) {
      alert("제목을 입력해주세요.");
      return;
    }

    if (!nextContent || nextContent === "<p></p>") {
      alert("내용을 입력해주세요.");
      return;
    }

    const mergedContent = buildAttachmentHtml(nextContent, attachments);

    sessionStorage.setItem(
      NOTICE_WRITE_DRAFT_KEY,
      JSON.stringify({
        title: nextTitle,
        content: nextContent,
        isPinned,
        importance,
        attachments,
        savedAt: new Date().toISOString(),
      })
    );

    sessionStorage.setItem(
      "notice-preview",
      JSON.stringify({
        mode: "create",
        backPath: "/notices/write",
        title: nextTitle,
        content: mergedContent,
        isPinned,
        importance,
      })
    );

    setLocation("/notices/preview");
  }}
>
  <Eye className="mr-2 h-4 w-4" />
  미리보기
</Button>

<Button
  variant="outline"
  className="h-11 rounded-xl"
  onClick={handleSaveDraft}
>
  임시저장
</Button>

<Button
  className="h-11 rounded-xl"
  onClick={handleSubmit}
  disabled={createMutation.isPending || isUploadingAttachment}
>
  {createMutation.isPending ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : (
    <Send className="mr-2 h-4 w-4" />
  )}
  공지 등록
</Button>  
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {importanceLabel}
                </span>

                {isPinned ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                    상단 고정
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  제목
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="공지사항 제목을 입력하세요"
                  className="h-14 text-base"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  내용
                </label>
                <NoticeRichEditor value={content} onChange={setContent} />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-800">첨부파일</h2>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-3">
                  {attachments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-slate-50 px-4 py-8 text-sm text-muted-foreground">
                      첨부된 파일이 없습니다. 아래 버튼으로 파일을 추가하세요.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((file, index) => (
                        <div
                          key={`${file.url}-${index}`}
                          className="flex items-center justify-between rounded-xl border bg-slate-50 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {file.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatBytes(file.size)}
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAttachment(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="w-full lg:w-[220px]">
                  <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-medium shadow-sm transition hover:bg-slate-50">
                    {isUploadingAttachment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        업로드 중...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        파일 첨부
                      </>
                    )}

                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        void handleUploadAttachments(e.target.files);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-slate-50 px-6 py-6">
            <div className="mb-3 text-sm font-semibold text-slate-700">
              작성 가이드
            </div>
            <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
              <li>• 제목은 한눈에 전달되도록 짧고 분명하게 작성하세요.</li>
              <li>• 본문은 문단과 줄바꿈을 충분히 사용해 읽기 쉽게 정리하세요.</li>
              <li>• 중요한 공지는 중요도와 상단 고정을 함께 활용하세요.</li>
              <li>• 첨부파일이 있으면 직원들이 내용을 더 빠르게 이해할 수 있습니다.</li>
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="sticky top-24 space-y-6">
            <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
              <div className="border-b bg-slate-50 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-800">공지 설정</h2>
              </div>

              <div className="space-y-5 px-5 py-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    중요도
                  </label>
                  <select
                    value={importance}
                    onChange={(e) =>
                      setImportance(e.target.value as "normal" | "important" | "urgent")
                    }
                    className="h-11 w-full rounded-xl border bg-white px-4 text-sm shadow-sm"
                  >
                    <option value="normal">일반</option>
                    <option value="important">중요</option>
                    <option value="urgent">긴급</option>
                  </select>
                </div>

                <div className="rounded-2xl border bg-slate-50 px-4 py-4">
                  <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
                    <Checkbox
                      checked={isPinned}
                      onCheckedChange={(checked) => setIsPinned(!!checked)}
                    />
                    <Pin className="h-4 w-4 text-amber-500" />
                    상단 고정
                  </label>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
              <div className="border-b bg-slate-50 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-800">발행 요약</h2>
              </div>

              <div className="space-y-4 px-5 py-5 text-sm">
                <div className="flex items-start gap-3">
                  <BellRing className="mt-0.5 h-4 w-4 text-slate-500" />
                  <div>
                    <div className="font-medium text-slate-800">현재 중요도</div>
                    <div className="mt-1 text-muted-foreground">{importanceLabel}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Pin className="mt-0.5 h-4 w-4 text-slate-500" />
                  <div>
                    <div className="font-medium text-slate-800">상단 고정 여부</div>
                    <div className="mt-1 text-muted-foreground">
                      {isPinned ? "고정됨" : "고정 안 함"}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Paperclip className="mt-0.5 h-4 w-4 text-slate-500" />
                  <div>
                    <div className="font-medium text-slate-800">첨부파일 수</div>
                    <div className="mt-1 text-muted-foreground">
                      {attachments.length}개
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button
              className="h-12 w-full rounded-2xl"
              onClick={handleSubmit}
              disabled={createMutation.isPending || isUploadingAttachment}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              공지 등록
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}