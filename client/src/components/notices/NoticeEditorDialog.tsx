import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PencilLine,
  Pin,
  FileText,
  Paperclip,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import NoticeRichEditor from "@/components/notices/NoticeRichEditor";

type NoticeEditorDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initialValue?: {
    title?: string;
    content?: string;
    isPinned?: boolean;
    importance?: "normal" | "important" | "urgent";
  } | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    content: string;
    isPinned?: boolean;
    importance?: "normal" | "important" | "urgent";
  }) => void;
};

type UploadedAttachment = {
  name: string;
  url: string;
  size?: number;
};

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

export default function NoticeEditorDialog({
  open,
  mode,
  initialValue,
  isSubmitting,
  onClose,
  onSubmit,
}: NoticeEditorDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [importance, setImportance] = useState<"normal" | "important" | "urgent">("normal");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  useEffect(() => {
    if (!open) return;

    setTitle(initialValue?.title ?? "");
    setContent(initialValue?.content ?? "");
    setIsPinned(!!initialValue?.isPinned);
    setImportance(initialValue?.importance ?? "normal");
    setAttachments([]);
  }, [open, initialValue]);

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

  const handleSubmit = () => {
    const nextTitle = title.trim();
    const nextContent = content.trim();

    if (!nextTitle) {
      alert("제목을 입력해주세요.");
      return;
    }

    if (!nextContent) {
      alert("내용을 입력해주세요.");
      return;
    }

    const mergedContent = buildAttachmentHtml(nextContent, attachments);

    onSubmit({
      title: nextTitle,
      content: mergedContent,
      isPinned,
      importance,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="w-[96vw] max-w-[1280px] overflow-hidden p-0">
        <DialogHeader className="border-b bg-slate-50 px-8 py-6">
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
            {mode === "create" ? (
              <FileText className="h-6 w-6 text-primary" />
            ) : (
              <PencilLine className="h-6 w-6 text-primary" />
            )}
            {mode === "create" ? "공지사항 작성" : "공지사항 수정"}
          </DialogTitle>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {importanceLabel}
            </span>
            {isPinned ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                상단 고정
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            직원들이 바로 확인할 수 있도록 제목과 내용을 자세히 작성하세요.
            이미지와 첨부파일도 함께 등록할 수 있습니다.
          </p>
        </DialogHeader>

        <div className="space-y-6 px-8 py-7">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_180px]">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">제목</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="공지사항 제목을 입력하세요"
                className="h-14 text-base"
              />
            </div>

            <div className="flex items-end">
              <label className="flex h-14 w-full items-center gap-3 rounded-xl border bg-white px-4 text-sm font-medium shadow-sm">
                <Checkbox
                  checked={isPinned}
                  onCheckedChange={(checked) => setIsPinned(!!checked)}
                />
                <Pin className="h-4 w-4 text-amber-500" />
                상단 고정
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">중요도</label>
              <select
                value={importance}
                onChange={(e) =>
                  setImportance(e.target.value as "normal" | "important" | "urgent")
                }
                className="h-14 w-full rounded-xl border bg-white px-4 text-sm shadow-sm"
              >
                <option value="normal">일반</option>
                <option value="important">중요</option>
                <option value="urgent">긴급</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">내용</label>
            <NoticeRichEditor value={content} onChange={setContent} />
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800">첨부파일</h3>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1 space-y-3">
                {attachments.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
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

          <div className="rounded-2xl border bg-slate-50 px-5 py-5">
            <div className="mb-2 text-sm font-semibold text-slate-700">미리 안내</div>
            <ul className="space-y-1.5 text-sm leading-6 text-muted-foreground">
              <li>• 제목은 한눈에 전달되도록 짧고 분명하게 작성하세요.</li>
              <li>• 본문은 문단과 줄바꿈을 충분히 사용해 읽기 쉽게 정리하세요.</li>
              <li>• 이미지와 첨부파일이 있으면 직원들이 내용을 더 빠르게 이해할 수 있습니다.</li>
              <li>• 자주 확인해야 하는 공지는 상단 고정과 중요도를 함께 활용하세요.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="border-t bg-white px-8 py-5">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting || isUploadingAttachment}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isUploadingAttachment}>
            {mode === "create" ? "공지 등록" : "수정 저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}