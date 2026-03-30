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

export default function NoticeDetailPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/notices/:id");

  const noticeId = Number(params?.id || 0);
  const canManage =
    user?.role === "host" || user?.role === "superhost";

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
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h1 className="truncate text-2xl font-bold">{pageTitle}</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                공지사항 상세 내용을 확인할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setLocation("/notices")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                목록으로
              </Button>

              {canManage ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setEditorOpen(true)}
                    disabled={!notice}
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    수정
                  </Button>

                  <Button
                    variant="destructive"
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
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              공지사항 불러오는 중...
            </div>
          ) : !notice ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              공지사항을 찾을 수 없습니다.
            </div>
          ) : (
            <div>
              <div className="border-b px-6 py-5">
                <h2 className="text-2xl font-bold leading-tight">
                  {notice.title}
                </h2>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>작성일 {formatDateTime(notice.createdAt)}</span>
                  </div>

                  <div className="inline-flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span>조회수 {Number(notice.views ?? 0)}</span>
                  </div>

                  <div>
                    작성자 {notice.authorName || "-"}
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                <div className="min-h-[320px] whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
                  {notice.content}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {notice ? (
        <NoticeEditorDialog
          open={editorOpen}
          mode="edit"
          initialValue={{
            title: notice.title ?? "",
            content: notice.content ?? "",
          }}
          isSubmitting={updateMutation.isPending}
          onClose={() => setEditorOpen(false)}
          onSubmit={(payload) => {
            updateMutation.mutate({
              id: noticeId,
              title: payload.title,
              content: payload.content,
            });
          }}
        />
      ) : null}
    </div>
  );
}