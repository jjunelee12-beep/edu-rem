import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, PencilLine, Trash2, Plus, FileText } from "lucide-react";

import NoticeEditorDialog from "@/components/notices/NoticeEditorDialog";
import NoticeListTable, {
  type NoticeListItem,
} from "@/components/notices/NoticeListTable";

export default function NoticesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingRow, setEditingRow] = useState<NoticeListItem | null>(null);

  const canManage =
    user?.role === "host" || user?.role === "superhost";

  const { data: rows = [], isLoading } = trpc.notice.list.useQuery(
    {
      search: search.trim() || undefined,
    },
    {
      staleTime: 10_000,
    }
  );

  const createMutation = trpc.notice.create.useMutation({
    onSuccess: async () => {
      toast.success("공지사항이 등록되었습니다.");
      setEditorOpen(false);
      setEditingRow(null);
      await utils.notice.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "공지사항 등록 중 오류가 발생했습니다.");
    },
  });

  const updateMutation = trpc.notice.update.useMutation({
    onSuccess: async () => {
      toast.success("공지사항이 수정되었습니다.");
      setEditorOpen(false);
      setEditingRow(null);
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
    },
    onError: (err) => {
      toast.error(err.message || "공지사항 삭제 중 오류가 발생했습니다.");
    },
  });

  const bulkDeleteMutation = trpc.notice.bulkDelete.useMutation({
    onSuccess: async (res) => {
      toast.success(`${res.deletedCount}건 삭제되었습니다.`);
      setSelectedIds([]);
      setEditMode(false);
      await utils.notice.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "공지사항 삭제 중 오류가 발생했습니다.");
    },
  });

  const filteredRows = useMemo(() => {
    return (rows as NoticeListItem[]) ?? [];
  }, [rows]);

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const ids = filteredRows.map((row) => Number(row.id));
    const allChecked = ids.length > 0 && ids.every((id) => selectedIds.includes(id));

    if (allChecked) {
      setSelectedIds([]);
    } else {
      setSelectedIds(ids);
    }
  };

  const handleOpenCreate = () => {
    setEditorMode("create");
    setEditingRow(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (row: NoticeListItem) => {
    setEditorMode("edit");
    setEditingRow(row);
    setEditorOpen(true);
  };

const handleSubmitEditor = (payload: {
  title: string;
  content: string;
  isPinned?: boolean;
importance?: "normal" | "important" | "urgent";
}) => {
  if (editorMode === "create") {
    createMutation.mutate({
      title: payload.title,
      content: payload.content,
      isPinned: !!payload.isPinned,
importance: payload.importance ?? "normal",
    });
    return;
  }

  if (!editingRow?.id) {
    toast.error("수정할 공지사항 정보가 없습니다.");
    return;
  }

  updateMutation.mutate({
    id: Number(editingRow.id),
    title: payload.title,
    content: payload.content,
    isPinned: !!payload.isPinned,
importance: payload.importance ?? "normal",
  });
};
  const handleSingleDelete = (id: number) => {
    if (!confirm("이 공지사항을 삭제하시겠습니까?")) return;
    deleteMutation.mutate({ id });
  };

  const handleBulkDelete = () => {
    if (!selectedIds.length) {
      toast.error("삭제할 공지사항을 선택해주세요.");
      return;
    }

    if (!confirm(`선택한 ${selectedIds.length}건을 삭제하시겠습니까?`)) return;

    bulkDeleteMutation.mutate({
      ids: selectedIds,
    });
  };

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold">공지사항</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                직원/관리자는 조회만 가능하고, 호스트/슈퍼호스트는 작성 및 관리가 가능합니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="제목 또는 내용 검색"
                  className="pl-9"
                />
              </div>

              {canManage ? (
                <>
                  <Button
                    variant={editMode ? "default" : "outline"}
                    onClick={() => {
                      setEditMode((prev) => !prev);
                      setSelectedIds([]);
                    }}
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    {editMode ? "수정모드 종료" : "수정모드"}
                  </Button>

                  {editMode ? (
                    <Button
                      variant="destructive"
                      onClick={handleBulkDelete}
                      disabled={bulkDeleteMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      선택삭제
                    </Button>
                  ) : (
                    <Button onClick={handleOpenCreate}>
                      <Plus className="mr-2 h-4 w-4" />
                      글쓰기
                    </Button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              공지사항 불러오는 중...
            </div>
          ) : (
            <NoticeListTable
              rows={filteredRows}
              canManage={!!canManage}
              editMode={editMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onOpenDetail={(id) => setLocation(`/notices/${id}`)}
              onEdit={handleOpenEdit}
            />
          )}
        </CardContent>
      </Card>

      {canManage && !editMode && editingRow ? (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            onClick={() => handleSingleDelete(Number(editingRow.id))}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            현재 선택 글 삭제
          </Button>
        </div>
      ) : null}

      <NoticeEditorDialog
        open={editorOpen}
        mode={editorMode}
      initialValue={
  editorMode === "edit"
    ? {
        title: editingRow?.title ?? "",
        content: editingRow?.content ?? "",
        isPinned: !!editingRow?.isPinned,
        importance: (editingRow as any)?.importance ?? "normal",
      }
    : {
        title: "",
        content: "",
        isPinned: false,
        importance: "normal",
      }
}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setEditorOpen(false);
          setEditingRow(null);
        }}
        onSubmit={handleSubmitEditor}
      />
    </div>
  );
}