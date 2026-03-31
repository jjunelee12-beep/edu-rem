import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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
  onEdit: (row: NoticeListItem) => void;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}.${mm}.${dd}`;
}

export default function NoticeListTable({
  rows,
  canManage,
  editMode,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenDetail,
  onEdit,
}: NoticeListTableProps) {
  const allChecked =
    rows.length > 0 && rows.every((row) => selectedIds.includes(Number(row.id)));

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="grid grid-cols-[56px_minmax(0,1fr)_120px_100px_110px] border-b bg-slate-50 px-4 py-3 text-sm font-semibold">
        <div className="flex items-center justify-center">
          {canManage && editMode ? (
            <Checkbox checked={allChecked} onCheckedChange={onToggleSelectAll} />
          ) : (
            <span>No</span>
          )}
        </div>
        <div>제목</div>
        <div className="text-center">작성자</div>
        <div className="text-center">조회수</div>
        <div className="text-center">작성일</div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-14 text-center text-sm text-muted-foreground">
          등록된 공지사항이 없습니다.
        </div>
      ) : (
        rows.map((row, index) => {
          const checked = selectedIds.includes(Number(row.id));

          return (
            <div
              key={row.id}
              className="grid grid-cols-[56px_minmax(0,1fr)_120px_100px_110px] items-start border-b px-4 py-4 last:border-b-0 hover:bg-slate-50/60"
            >
              <div className="flex items-center justify-center pt-1 text-sm text-muted-foreground">
                {canManage && editMode ? (
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggleSelect(Number(row.id))}
                  />
                ) : (
                  index + 1
                )}
              </div>

              <div className="min-w-0 pr-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
  {row.isPinned ? (
    <span className="rounded bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">
      📌 고정
    </span>
  ) : null}

  {row.importance === "urgent" ? (
    <span className="rounded bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
      긴급
    </span>
  ) : null}

  {row.importance === "important" ? (
    <span className="rounded bg-orange-400 px-2 py-0.5 text-[11px] font-semibold text-white">
      중요
    </span>
  ) : null}
</div>

<button
  onClick={() => onOpenDetail(Number(row.id))}
  className="max-w-full truncate text-left text-[15px] font-semibold text-slate-900 hover:underline"
>
  {row.title}
</button>

                <p className="mt-1 line-clamp-2 break-all text-sm leading-6 text-muted-foreground">
                  {String(row.content ?? "").replace(/\n/g, " ")}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>작성자 {row.authorName || "관리자"}</span>
                  <span>조회수 {Number(row.viewCount ?? 0)}</span>
                  <span>{formatDate(row.createdAt)}</span>
                </div>

                {canManage && !editMode ? (
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => onEdit(row)}>
                      수정
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="pt-1 text-center text-sm">
                {row.authorName || "-"}
              </div>

              <div className="pt-1 text-center text-sm">
                {Number(row.viewCount ?? 0)}
              </div>

              <div className="pt-1 text-center text-sm text-muted-foreground">
                {formatDate(row.createdAt)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}