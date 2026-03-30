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
  views?: number | null;
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
  const allChecked = rows.length > 0 && rows.every((row) => selectedIds.includes(Number(row.id)));

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
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          등록된 공지사항이 없습니다.
        </div>
      ) : (
        rows.map((row, index) => {
          const checked = selectedIds.includes(Number(row.id));

          return (
            <div
              key={row.id}
              className="grid grid-cols-[56px_minmax(0,1fr)_120px_100px_110px] items-center border-b px-4 py-3 last:border-b-0"
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

              <div className="min-w-0">
                <button
                  onClick={() => onOpenDetail(Number(row.id))}
                  className="max-w-full truncate text-left text-sm font-semibold hover:underline"
                >
                  {row.title}
                </button>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {String(row.content ?? "").replace(/\n/g, " ")}
                </p>

                {canManage && !editMode ? (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => onEdit(row)}>
                      수정
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="text-center text-sm">
                {row.authorName || "-"}
              </div>

              <div className="text-center text-sm">
                {Number(row.views ?? 0)}
              </div>

              <div className="text-center text-sm text-muted-foreground">
                {formatDate(row.createdAt)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}