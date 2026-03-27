import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Send,
  User,
  Sparkles,
  Paperclip,
  X,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";
import { Streamdown } from "streamdown";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type MessageRole = "system" | "user" | "assistant";

export type MessageAttachment = {
  id?: string;
  name: string;
  url?: string;
  type?: string;
  size?: number;
};
export type SearchResultItem = {
  id: number;
  type: "student" | "consultation";
  clientName?: string;
  phone?: string;
  course?: string;
  desiredCourse?: string;
  status?: string;
  institution?: string;
};

export type MessageSearchResults = {
  students?: SearchResultItem[];
  consultations?: SearchResultItem[];
};

export type MessageKind =
  | "text"
  | "error"
  | "search_result"
  | "action_result"
  | "warning";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt?: string;
  kind?: MessageKind;
  attachments?: MessageAttachment[];
  searchResults?: MessageSearchResults;
};

export type QuickAction = {
  key: "student_search" | "consultation_search" | "alerts_missing" | "alerts_payment" | "error_analysis";
  label: string;
  prompt: string;
  runImmediately?: boolean;
};

export type AIChatBoxProps = {
  messages: Message[];
  onSendMessage: (content: string, files?: File[]) => void | Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  height?: string | number;
  emptyStateMessage?: string;
  suggestedPrompts?: string[];
  quickActions?: QuickAction[];
  onQuickAction?: (action: QuickAction) => void | Promise<void>;
  onSearchResultAction?: (
    action:
      | { type: "open_student"; id: number }
      | { type: "open_consultation"; id: number }
      | { type: "start_transfer_subject"; id: number; name?: string }
      | { type: "start_plan_semester"; id: number; name?: string }
	      | { type: "select_student_for_pending_action"; id: number; name?: string }
  ) => void | Promise<void>;
  allowImageUpload?: boolean;
  disabled?: boolean;
  errorMessage?: string | null;
  maxFiles?: number;
  maxFileSizeMb?: number;
};

type LocalPreviewFile = {
  id: string;
  file: File;
  previewUrl?: string;
};

function formatBytes(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isImageFile(fileOrType?: File | string) {
  if (!fileOrType) return false;
  if (typeof fileOrType === "string") return fileOrType.startsWith("image/");
  return fileOrType.type.startsWith("image/");
}

function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "AI에게 요청 내용을 입력하세요...",
  className,
  height = "680px",
  emptyStateMessage = "AI와 대화를 시작해보세요.",
  suggestedPrompts = [],
  quickActions = [],
onQuickAction,
  onSearchResultAction,
  allowImageUpload = true,
  disabled = false,
  errorMessage = null,
  maxFiles = 4,
  maxFileSizeMb = 10,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<LocalPreviewFile[]>([]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayMessages = useMemo(
    () => messages.filter((msg) => msg.role !== "system"),
    [messages]
  );

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement | null;

    if (!viewport) return;

    requestAnimationFrame(() => {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior,
      });
    });
  };

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [input]);

  useEffect(() => {
    scrollToBottom(displayMessages.length > 1 ? "smooth" : "auto");
  }, [displayMessages, isLoading]);

  useEffect(() => {
    return () => {
      attachedFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [attachedFiles]);

  const clearComposerError = () => {
    if (localError) setLocalError(null);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length) return;

    clearComposerError();

    const remainingCount = Math.max(0, maxFiles - attachedFiles.length);
    if (remainingCount <= 0) {
      setLocalError(`첨부는 최대 ${maxFiles}개까지 가능합니다.`);
      e.target.value = "";
      return;
    }

    const nextFiles = fileList.slice(0, remainingCount);
    const oversized = nextFiles.find(
      (file) => file.size > maxFileSizeMb * 1024 * 1024
    );

    if (oversized) {
      setLocalError(
        `${oversized.name} 파일이 너무 큽니다. 파일당 최대 ${maxFileSizeMb}MB까지 가능합니다.`
      );
      e.target.value = "";
      return;
    }

    const mapped = nextFiles.map<LocalPreviewFile>((file) => ({
      id: makeLocalId(),
      file,
      previewUrl: isImageFile(file) ? URL.createObjectURL(file) : undefined,
    }));

    setAttachedFiles((prev) => [...prev, ...mapped]);
    e.target.value = "";
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => {
      const found = prev.find((item) => item.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const openFilePicker = () => {
    if (disabled || isLoading || !allowImageUpload) return;
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const trimmedInput = input.trim();
    const files = attachedFiles.map((item) => item.file);

    if ((!trimmedInput && files.length === 0) || isLoading || disabled) return;

    clearComposerError();

    try {
      await onSendMessage(trimmedInput, files);
      setInput("");

      attachedFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setAttachedFiles([]);

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (err) {
      console.error("[AIChatBox] send failed:", err);
      setLocalError("메시지 전송 중 오류가 발생했습니다.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const fillPrompt = (prompt: string) => {
    if (disabled || isLoading) return;
    setInput(prompt);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const renderMessageBubble = (message: Message) => {
    const isUser = message.role === "user";
    const isError =
      message.kind === "error" || message.kind === "warning";
const isActionResult = message.kind === "action_result";

    return (
      <div
        key={message.id}
        className={cn(
          "flex gap-3",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {!isUser && (
          <div
            className={cn(
              "mt-1 flex size-8 shrink-0 items-center justify-center rounded-full",
              isError
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            )}
          >
            {isError ? (
              <AlertCircle className="size-4" />
            ) : (
              <Sparkles className="size-4" />
            )}
          </div>
        )}

        <div
          className={cn(
            "max-w-[85%] rounded-2xl border px-4 py-3 shadow-sm",
            isUser
              ? "border-primary bg-primary text-primary-foreground"
              : isError
? "border-destructive/20 bg-destructive/5 text-foreground"
: isActionResult
? "border-emerald-200 bg-emerald-50 text-foreground"
: "border-border bg-muted text-foreground"
          )}
        >
          {message.createdAt && (
            <div
              className={cn(
                "mb-2 text-[11px]",
                isUser
                  ? "text-primary-foreground/70"
                  : "text-muted-foreground"
              )}
            >
              {message.createdAt}
            </div>
          )}

          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {message.content}
            </p>
          ) : (
            <div className="max-w-none text-sm leading-6 [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:bg-background [&_pre]:p-3 [&_ul]:pl-5 [&_ol]:pl-5">
              <Streamdown>{message.content}</Streamdown>
	{message.kind === "search_result" && message.searchResults && (
  <div className="mt-3 space-y-2">
    {message.searchResults.students?.map((item) => (
      <div key={item.id} className="rounded-lg border p-2 text-xs">
        <div>이름: {item.clientName}</div>
        <div>전화: {item.phone}</div>
        <div>과정: {item.course}</div>

        <div className="mt-2 flex gap-1">
          <button
            className="text-blue-500"
            onClick={() =>
              onSearchResultAction?.({
                type: "open_student",
                id: item.id,
              })
            }
          >
            상세보기
          </button>

          <button
            className="text-green-500"
            onClick={() =>
              onSearchResultAction?.({
                type: "start_transfer_subject",
                id: item.id,
                name: item.clientName,
              })
            }
          >
            전적대 입력
          </button>

          <button
            className="text-purple-500"
            onClick={() =>
              onSearchResultAction?.({
                type: "start_plan_semester",
                id: item.id,
                name: item.clientName,
              })
            }
          >
            플랜 입력
          </button>
        </div>
      </div>
    ))}
  </div>
)}
            </div>
          )}

          {message.attachments && message.attachments.length > 0 && (
	          {message.searchResults &&
            ((message.searchResults.students?.length ?? 0) > 0 ||
              (message.searchResults.consultations?.length ?? 0) > 0) && (
              <div className="mt-3 space-y-3">
                {(message.searchResults.students?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      학생 검색 결과
                    </p>
                    {message.searchResults.students?.map((item) => (
                      <div
                        key={`student-${item.id}`}
                        className="rounded-xl border bg-background px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              {item.clientName || "-"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              연락처: {item.phone || "-"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              과정: {item.course || "-"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              상태: {item.status || "-"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              교육원: {item.institution || "-"}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col gap-2">
  <button
    type="button"
    onClick={() => onSearchResultAction?.({ type: "open_student", id: item.id })}
    className="rounded-lg border px-2 py-1 text-xs transition hover:bg-accent"
  >
    상세보기
  </button>

  <button
    type="button"
    onClick={() =>
      onSearchResultAction?.({
        type: "start_transfer_subject",
        id: item.id,
        name: item.clientName,
      })
    }
    className="rounded-lg border px-2 py-1 text-xs transition hover:bg-accent"
  >
    전적대 입력
  </button>

  <button
    type="button"
    onClick={() =>
      onSearchResultAction?.({
        type: "start_plan_semester",
        id: item.id,
        name: item.clientName,
      })
    }
    className="rounded-lg border px-2 py-1 text-xs transition hover:bg-accent"
  >
    플랜 입력
  </button>
<button
  type="button"
  onClick={() =>
    onSearchResultAction?.({
      type: "select_student_for_pending_action",
      id: item.id,
      name: item.clientName,
    } as any)
  }
  className="rounded-lg border px-2 py-1 text-xs transition hover:bg-accent"
>
  이 학생 선택
</button>
</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(message.searchResults.consultations?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      상담 검색 결과
                    </p>
                    {message.searchResults.consultations?.map((item) => (
                      <div
                        key={`consultation-${item.id}`}
                        className="rounded-xl border bg-background px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {item.clientName || "-"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            연락처: {item.phone || "-"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            희망과정: {item.desiredCourse || "-"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            상태: {item.status || "-"}
                          </p>
                        </div>
<div className="mt-3 flex justify-end">
  <button
    type="button"
    onClick={() =>
      onSearchResultAction?.({ type: "open_consultation", id: item.id })
    }
    className="rounded-lg border px-2 py-1 text-xs transition hover:bg-accent"
  >
    상담 상세로 이동
  </button>
</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 space-y-2">
              {message.attachments.map((attachment, index) => {
                const image = !!attachment.url && isImageFile(attachment.type);

                if (image) {
                  return (
                    <div
                      key={`${message.id}-attachment-${index}`}
                      className="overflow-hidden rounded-xl border bg-background"
                    >
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="max-h-72 w-full object-contain"
                      />
                      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                        {attachment.name}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={`${message.id}-attachment-${index}`}
                    className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground"
                  >
                    <Paperclip className="size-3.5" />
                    <span className="truncate">{attachment.name}</span>
                    {attachment.size ? (
                      <span className="shrink-0">{formatBytes(attachment.size)}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isUser && (
          <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <User className="size-4" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm",
        className
      )}
      style={{ height }}
    >
      {(quickActions.length > 0 || suggestedPrompts.length > 0) && (
        <div className="border-b bg-muted/30 px-4 py-3">
          {quickActions.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
 onClick={() => {
  if (action.runImmediately && onQuickAction) {
    void onQuickAction(action);
    return;
  }
  fillPrompt(action.prompt);
}}
                  disabled={disabled || isLoading}
                  className="rounded-full"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          {suggestedPrompts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={`${prompt}-${index}`}
                  type="button"
                  onClick={() => fillPrompt(prompt)}
                  disabled={disabled || isLoading}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="size-8 text-primary/70" />
              </div>
              <div>
                <p className="text-sm font-medium">{emptyStateMessage}</p>
                <p className="mt-1 text-xs">
                  학생 조회, 상담 검색, 누락 확인, 전적대 과목 입력 같은 요청을 해보세요.
                </p>
              </div>
            </div>

            {suggestedPrompts.length > 0 && (
              <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                {suggestedPrompts.map((prompt, index) => (
                  <button
                    key={`${prompt}-${index}`}
                    type="button"
                    onClick={() => fillPrompt(prompt)}
                    disabled={disabled || isLoading}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map(renderMessageBubble)}

              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="rounded-2xl border border-border bg-muted px-4 py-3 shadow-sm">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="border-t bg-background/80 backdrop-blur">
        {(errorMessage || localError) && (
          <div className="border-b bg-destructive/5 px-4 py-2 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4" />
              <span>{errorMessage || localError}</span>
            </div>
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-3 border-b px-4 py-3">
            {attachedFiles.map((item) => {
              const isImage = !!item.previewUrl;

              return (
                <div
                  key={item.id}
                  className="relative overflow-hidden rounded-xl border bg-muted/40"
                >
                  {isImage ? (
                    <div className="relative">
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="h-24 w-24 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttachedFile(item.id)}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white transition hover:bg-black"
                        aria-label="첨부 삭제"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex min-w-[180px] max-w-[220px] items-center gap-2 px-3 py-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background">
                        <Paperclip className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{item.file.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatBytes(item.file.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachedFile(item.id)}
                        className="rounded-full p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
                        aria-label="첨부 삭제"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}

                  {isImage && (
                    <div className="border-t bg-background px-2 py-1.5">
                      <p className="max-w-[96px] truncate text-[11px]">
                        {item.file.name}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2 p-4">
          {allowImageUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={openFilePicker}
                disabled={disabled || isLoading}
                className="h-[42px] w-[42px] shrink-0 rounded-xl"
                aria-label="파일 첨부"
              >
                <Paperclip className="size-4" />
              </Button>
            </>
          )}

          <div className="flex-1 rounded-2xl border bg-background px-3 py-2 shadow-sm">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                clearComposerError();
                setInput(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              rows={1}
              className="min-h-[24px] max-h-40 resize-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
            />

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {allowImageUpload && (
                  <>
                    <ImageIcon className="size-3.5" />
                    <span>
                      이미지/문서 첨부 가능 · 최대 {maxFiles}개 · 파일당 {maxFileSizeMb}MB
                    </span>
                  </>
                )}
              </div>

              <div className="text-[11px] text-muted-foreground">
                Enter 전송 · Shift+Enter 줄바꿈
              </div>
            </div>
          </div>

          <Button
            type="submit"
            size="icon"
            disabled={
              disabled ||
              isLoading ||
              (!input.trim() && attachedFiles.length === 0)
            }
            className="h-[42px] w-[42px] shrink-0 rounded-xl"
            aria-label="전송"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}