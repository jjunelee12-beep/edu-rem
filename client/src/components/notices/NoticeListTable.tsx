import { Checkbox } from "@/components/ui/checkbox";

export type NoticeListItem = {
  id: number;
  title: string;
  content: string;
  authorId?: number | null;
  authorName?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  viewCount?: number | null;
  isPinned?: boolean | null;
  importance?: "normal" | "important" | "urgent" | null;
};

type NoticeListTableProps = {
  rows: NoticeListItem[];
  canManage: boolean;
  editMode: boolean;
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onOpenDetail: (id: number) => void;
};

export default function NoticeListTable({
  rows,
  canManage,
  editMode,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenDetail,
}: NoticeListTableProps) {
  const allChecked =
    rows.length > 0 && rows.every((row) => selectedIds.includes(Number(row.id)));

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="grid grid-cols-[56px_minmax(0,1fr)] border-b bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700">
        <div className="flex items-center justify-center">
          {canManage && editMode ? (
            <Checkbox checked={allChecked} onCheckedChange={onToggleSelectAll} />
          ) : (
            <span>No</span>
          )}
        </div>
        <div>제목</div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-16 text-center text-sm text-muted-foreground">
          등록된 공지사항이 없습니다.
        </div>
      ) : (
        rows.map((row, index) => {
          const checked = selectedIds.includes(Number(row.id));

          return (
            <div
              key={row.id}
              className="grid grid-cols-[56px_minmax(0,1fr)] items-center border-b px-5 py-4 last:border-b-0 hover:bg-slate-50/70"
            >
              <div className="flex items-center justify-center text-sm text-muted-foreground">
                {canManage && editMode ? (
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggleSelect(Number(row.id))}
                  />
                ) : (
                  index + 1
                )}
              </div>

              <button
                onClick={() => onOpenDetail(Number(row.id))}
                className="min-w-0 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {row.isPinned ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                      📌 고정
                    </span>
                  ) : null}

                  {row.importance === "urgent" ? (
                    <span className="rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                      긴급
                    </span>
                  ) : row.importance === "important" ? (
                    <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                      중요
                    </span>
                  ) : null}

                  <span className="truncate text-[15px] font-semibold text-slate-900 hover:underline">
                    {row.title}
                  </span>
                </div>
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}