import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, PencilLine, Trash2, Plus, FileText } from "lucide-react";
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

const [filter, setFilter] = useState<
  "all" | "pinned" | "urgent" | "important"
>("all");

  const canManage = user?.role === "host" || user?.role === "superhost";

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
  const base = (rows as NoticeListItem[]) ?? [];

  return base.filter((row) => {
    if (filter === "pinned") return row.isPinned;
    if (filter === "urgent") return row.importance === "urgent";
    if (filter === "important") return row.importance === "important";
    return true;
  });
}, [rows, filter]);


  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const ids = filteredRows.map((row) => Number(row.id));
    const allChecked =
      ids.length > 0 && ids.every((id) => selectedIds.includes(id));

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
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="border-b bg-slate-50 px-6 py-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                      공지사항
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      중요한 안내를 빠르게 공유하고, 고정/중요/긴급 공지를 한눈에 관리할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-[280px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="제목 검색"
                    className="h-11 rounded-xl bg-white pl-9"
                  />
<div className="mt-4 flex flex-wrap items-center gap-2">
  {[
    { key: "all", label: "전체" },
    { key: "pinned", label: "고정" },
    { key: "urgent", label: "긴급" },
    { key: "important", label: "중요" },
  ].map((tab) => {
    const active = filter === tab.key;

    return (
      <button
        key={tab.key}
        onClick={() => setFilter(tab.key as any)}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition
          ${
            active
              ? "bg-primary text-white"
              : "bg-white text-slate-600 border hover:bg-slate-100"
          }
        `}
      >
        {tab.label}
      </button>
    );
  })}
</div>
                </div>

                {canManage ? (
                  <>
                    <Button
                      variant={editMode ? "default" : "outline"}
                      className="h-11 rounded-xl"
                      onClick={() => {
                        setEditMode((prev) => !prev);
                        setSelectedIds([]);
                      }}
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      {editMode ? "선택모드 종료" : "선택모드"}
                    </Button>

                    {editMode ? (
                      <Button
                        variant="destructive"
                        className="h-11 rounded-xl"
                        onClick={handleBulkDelete}
                        disabled={bulkDeleteMutation.isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        선택 삭제
                      </Button>
                    ) : (
                      <Button className="h-11 rounded-xl" onClick={() => setLocation("/notices/write")}>
                        <Plus className="mr-2 h-4 w-4" />
                        글쓰기
                      </Button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            {isLoading ? (
              <div className="rounded-2xl border bg-white px-4 py-16 text-center text-sm text-muted-foreground">
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

              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}