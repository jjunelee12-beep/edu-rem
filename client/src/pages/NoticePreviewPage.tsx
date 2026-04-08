import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  FileText,
  CalendarDays,
  Eye,
  Paperclip,
} from "lucide-react";

function formatDateTime(value?: string | Date | null) {
  if (!value) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function extractAttachmentLinks(html?: string | null) {
  if (!html) return [];

  const matches = Array.from(
    html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi)
  );

  return matches.map((match, index) => ({
    id: index + 1,
    url: match[1],
    name:
      String(match[2]).replace(/<[^>]+>/g, "").trim() || `첨부파일 ${index + 1}`,
  }));
}

function stripAttachmentBlock(html?: string | null) {
  if (!html) return "<p></p>";

  return html.replace(
    /<div class="notice-attachments-block" data-notice-attachments="true">[\s\S]*?<\/div>/gi,
    ""
  );
}

export default function NoticePreviewPage() {
  const [, setLocation] = useLocation();

  const raw = sessionStorage.getItem("notice-preview");
  const parsed = raw ? JSON.parse(raw) : null;

  const title = parsed?.title ?? "";
  const content = parsed?.content ?? "<p></p>";
  const isPinned = !!parsed?.isPinned;
  const importance = (parsed?.importance ?? "normal") as
    | "normal"
    | "important"
    | "urgent";
  const mode = parsed?.mode ?? "create";
  const backPath = parsed?.backPath ?? "/notices/write";

  const attachments = useMemo(() => extractAttachmentLinks(content), [content]);
  const bodyContent = useMemo(() => stripAttachmentBlock(content), [content]);

  const pageTitle = title?.trim() || "제목 없는 공지";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="border-b bg-slate-50 px-6 py-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">
                      공지 미리보기
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      실제 등록 전에 표시 상태를 확인하는 화면입니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="h-11 rounded-xl"
                  onClick={() => setLocation(backPath)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {mode === "edit" ? "수정 화면으로" : "작성 화면으로"}
                </Button>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="space-y-5">
              <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                <div className="border-b bg-gradient-to-r from-slate-50 to-white px-7 py-7">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {isPinned ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        📌 고정 공지
                      </span>
                    ) : null}

                    {importance === "urgent" ? (
                      <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
                        긴급
                      </span>
                    ) : importance === "important" ? (
                      <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">
                        중요
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        일반
                      </span>
                    )}
                  </div>

                  <h2 className="break-words text-3xl font-bold leading-tight text-slate-900">
                    {pageTitle}
                  </h2>

                  <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <span>👤</span>
                      <span>작성자 관리자</span>
                    </div>

                    <div className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      <span>{formatDateTime()}</span>
                    </div>

                    <div className="inline-flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span>조회수 0</span>
                    </div>
                  </div>
                </div>

                <div className="px-7 py-8">
                  <div
                    className="notice-content min-h-[420px] break-words text-[16px] leading-8 text-slate-800"
                    dangerouslySetInnerHTML={{ __html: bodyContent || "<p></p>" }}
                  />
                </div>
              </div>

              {attachments.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <div className="border-b bg-slate-50 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-slate-500" />
                      <h3 className="text-sm font-semibold text-slate-800">
                        첨부파일
                      </h3>
                    </div>
                  </div>

                  <div className="px-5 py-4">
                    <div className="space-y-2">
                      {attachments.map((file) => (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-xl border bg-slate-50 px-4 py-3 text-sm transition hover:bg-slate-100"
                        >
                          <span className="truncate font-medium text-slate-800">
                            {file.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            열기
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}