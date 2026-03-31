import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  PencilLine,
  Trash2,
  FileText,
  Eye,
  CalendarDays,
  Paperclip,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

import NoticeEditorDialog from "@/components/notices/NoticeEditorDialog";

function formatDateTime(value?: string | Date | null) {
  if (!value) return "-";
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

export default function NoticeDetailPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/notices/:id");

  const noticeId = Number(params?.id || 0);
  const canManage = user?.role === "host" || user?.role === "superhost";

  const utils = trpc.useUtils();
  const [editorOpen, setEditorOpen] = useState(false);

  const { data: notice, isLoading } = trpc.notice.get.useQuery(
    {
      id: noticeId,
      increaseView: true,
    },
    {
      enabled: !!noticeId,
    }
  );

  const { data: allNotices = [] } = trpc.notice.list.useQuery();

  const { prevNotice, nextNotice } = useMemo(() => {
    if (!allNotices.length || !noticeId) {
      return { prevNotice: null, nextNotice: null };
    }

    const sorted = [...(allNotices as any[])].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const index = sorted.findIndex((n: any) => Number(n.id) === noticeId);

    return {
      prevNotice: index < sorted.length - 1 ? sorted[index + 1] : null,
      nextNotice: index > 0 ? sorted[index - 1] : null,
    };
  }, [allNotices, noticeId]);

  const updateMutation = trpc.notice.update.useMutation({
    onSuccess: async () => {
      toast.success("공지사항이 수정되었습니다.");
      setEditorOpen(false);
      await utils.notice.get.invalidate({ id: noticeId, increaseView: true });
      await utils.notice.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "공지사항 수정 중 오류가 발생했습니다.");
    },
  });

  const deleteMutation = trpc.notice.delete.useMutation({
    onSuccess: async () => {
      toast.success("공지사항이 삭제되었습니다.");
      await utils.notice.list.invalidate();
      setLocation("/notices");
    },
    onError: (err) => {
      toast.error(err.message || "공지사항 삭제 중 오류가 발생했습니다.");
    },
  });

  const pageTitle = useMemo(() => {
    if (isLoading) return "공지사항";
    return notice?.title || "공지사항 상세";
  }, [isLoading, notice]);

  const attachments = useMemo(() => {
    return extractAttachmentLinks(notice?.content);
  }, [notice?.content]);

  const bodyContent = useMemo(() => {
    return stripAttachmentBlock(notice?.content);
  }, [notice?.content]);

  const handleDelete = () => {
    if (!noticeId) return;
    if (!confirm("이 공지사항을 삭제하시겠습니까?")) return;

    deleteMutation.mutate({
      id: noticeId,
    });
  };

  if (!noticeId) {
    return (
      <div className="space-y-5">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            잘못된 접근입니다.
          </CardContent>
        </Card>
      </div>
    );
  }

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
                      {pageTitle}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      공지사항 상세 내용을 확인할 수 있습니다.
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

                {canManage ? (
                  <>
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl"
                      onClick={() => setEditorOpen(true)}
                      disabled={!notice}
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      수정
                    </Button>

                    <Button
                      variant="destructive"
                      className="h-11 rounded-xl"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending || !notice}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      삭제
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            {isLoading ? (
              <div className="rounded-2xl border bg-white px-6 py-20 text-center text-sm text-muted-foreground">
                공지사항 불러오는 중...
              </div>
            ) : !notice ? (
              <div className="rounded-2xl border bg-white px-6 py-20 text-center text-sm text-muted-foreground">
                공지사항을 찾을 수 없습니다.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                  <div className="border-b bg-gradient-to-r from-slate-50 to-white px-7 py-7">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      {notice.isPinned ? (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                          📌 고정 공지
                        </span>
                      ) : null}

                      {(notice as any).importance === "urgent" ? (
                        <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
                          긴급
                        </span>
                      ) : (notice as any).importance === "important" ? (
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
                      {notice.title}
                    </h2>

                    <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <span>👤</span>
                        <span>작성자 {notice.authorName || "관리자"}</span>
                      </div>

                      <div className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        <span>{formatDateTime(notice.createdAt)}</span>
                      </div>

                      <div className="inline-flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        <span>조회수 {Number(notice.viewCount ?? 0)}</span>
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

                <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <div className="border-b bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
                    글 이동
                  </div>

                  <div className="divide-y">
                    <button
                      onClick={() => {
                        if (prevNotice) setLocation(`/notices/${prevNotice.id}`);
                      }}
                      disabled={!prevNotice}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ChevronUp className="h-4 w-4" />
                        이전글
                      </div>
                      <span className="flex-1 truncate text-sm font-medium text-slate-800">
                        {prevNotice ? prevNotice.title : "이전글이 없습니다."}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        if (nextNotice) setLocation(`/notices/${nextNotice.id}`);
                      }}
                      disabled={!nextNotice}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ChevronDown className="h-4 w-4" />
                        다음글
                      </div>
                      <span className="flex-1 truncate text-sm font-medium text-slate-800">
                        {nextNotice ? nextNotice.title : "다음글이 없습니다."}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {notice ? (
        <NoticeEditorDialog
          open={editorOpen}
          mode="edit"
          initialValue={{
            title: notice.title ?? "",
            content: notice.content ?? "",
            isPinned: !!notice.isPinned,
            importance: (notice as any).importance ?? "normal",
          }}
          isSubmitting={updateMutation.isPending}
          onClose={() => setEditorOpen(false)}
          onSubmit={(payload) => {
            updateMutation.mutate({
              id: noticeId,
              title: payload.title,
              content: payload.content,
              isPinned: !!payload.isPinned,
              importance: payload.importance ?? "normal",
            });
          }}
        />
      ) : null}
    </div>
  );
}