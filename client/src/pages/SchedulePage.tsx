import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus, PencilLine, Trash2, Clock3 } from "lucide-react";

import ScheduleCalendar, {
  type ScheduleCalendarItem,
} from "@/components/schedule/ScheduleCalendar";
import ScheduleEditorDialog from "@/components/schedule/ScheduleEditorDialog";

type ScheduleRow = {
  id: number;
  title: string;
  description?: string | null;
  date: string;
  ampm: "AM" | "PM";
  hour: number;
  minute: number;
  isGlobal?: boolean;
  userId?: number;
};

function pad2(v: number) {
  return String(v).padStart(2, "0");
}

function getTodayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function formatScheduleTime(row: ScheduleRow) {
  return `${row.ampm === "AM" ? "오전" : "오후"} ${row.hour}:${pad2(
    Number(row.minute || 0)
  )}`;
}

function sortSchedules(rows: ScheduleRow[]) {
  return [...rows].sort((a, b) => {
    const a24 =
      a.ampm === "AM"
        ? a.hour === 12
          ? 0
          : a.hour
        : a.hour === 12
        ? 12
        : a.hour + 12;

    const b24 =
      b.ampm === "AM"
        ? b.hour === 12
          ? 0
          : b.hour
        : b.hour === 12
        ? 12
        : b.hour + 12;

    if (a24 !== b24) return a24 - b24;
    return Number(a.minute) - Number(b.minute);
  });
}

export default function SchedulePage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const today = getTodayString();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(today);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingRow, setEditingRow] = useState<ScheduleRow | null>(null);

  const canCreate =
    !!user &&
    ["staff", "admin", "host", "superhost"].includes(String(user.role));

  const { data: monthRows = [], isLoading } = trpc.schedule.listMonth.useQuery(
    {
      year,
      month,
    },
    {
      staleTime: 10_000,
    }
  );

  const createMutation = trpc.schedule.create.useMutation({
    onSuccess: async () => {
      toast.success("일정이 등록되었습니다.");
      setEditorOpen(false);
      setEditingRow(null);

      await Promise.all([
        utils.schedule.listMonth.invalidate({ year, month }),
        utils.schedule.listToday.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message || "일정 등록 중 오류가 발생했습니다.");
    },
  });

  const updateMutation = trpc.schedule.update.useMutation({
    onSuccess: async () => {
      toast.success("일정이 수정되었습니다.");
      setEditorOpen(false);
      setEditingRow(null);

      await Promise.all([
        utils.schedule.listMonth.invalidate({ year, month }),
        utils.schedule.listToday.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message || "일정 수정 중 오류가 발생했습니다.");
    },
  });

  const deleteMutation = trpc.schedule.delete.useMutation({
    onSuccess: async () => {
      toast.success("일정이 삭제되었습니다.");

      await Promise.all([
        utils.schedule.listMonth.invalidate({ year, month }),
        utils.schedule.listToday.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message || "일정 삭제 중 오류가 발생했습니다.");
    },
  });

  const calendarItems = useMemo<ScheduleCalendarItem[]>(() => {
    return ((monthRows as ScheduleRow[]) ?? []).map((row) => ({
      id: Number(row.id),
      title: row.title,
      date: row.date,
      ampm: row.ampm,
      hour: Number(row.hour),
      minute: Number(row.minute),
      isGlobal: !!row.isGlobal,
    }));
  }, [monthRows]);

  const selectedDateRows = useMemo(() => {
    const rows = ((monthRows as ScheduleRow[]) ?? []).filter(
      (row) => String(row.date) === String(selectedDate)
    );

    return sortSchedules(rows);
  }, [monthRows, selectedDate]);

  const handleOpenCreate = () => {
    setEditorMode("create");
    setEditingRow(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (row: ScheduleRow) => {
    setEditorMode("edit");
    setEditingRow(row);
    setEditorOpen(true);
  };

  const handleDelete = (row: ScheduleRow) => {
    if (!confirm("이 일정을 삭제하시겠습니까?")) return;

    deleteMutation.mutate({
      id: Number(row.id),
    });
  };

  const handleSubmitEditor = (payload: {
    title: string;
    description: string;
    date: string;
    ampm: "AM" | "PM";
    hour: number;
    minute: number;
    isGlobal: boolean;
  }) => {
    if (editorMode === "create") {
      createMutation.mutate({
        title: payload.title,
        description: payload.description,
        date: payload.date,
        ampm: payload.ampm,
        hour: payload.hour,
        minute: payload.minute,
        isGlobal: payload.isGlobal,
      });
      return;
    }

    if (!editingRow?.id) {
      toast.error("수정할 일정 정보가 없습니다.");
      return;
    }

    updateMutation.mutate({
      id: Number(editingRow.id),
      title: payload.title,
      description: payload.description,
      date: payload.date,
      ampm: payload.ampm,
      hour: payload.hour,
      minute: payload.minute,
    });
  };

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold">일정 / 캘린더</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                날짜를 클릭해서 개인 일정 또는 전체 일정을 등록할 수 있습니다.
              </p>
            </div>

            {canCreate ? (
              <Button onClick={handleOpenCreate}>
                <Plus className="mr-2 h-4 w-4" />
                일정 등록
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            {isLoading ? (
              <div className="rounded-2xl border bg-white px-4 py-20 text-center text-sm text-muted-foreground">
                달력 불러오는 중...
              </div>
            ) : (
              <ScheduleCalendar
                year={year}
                month={month}
                selectedDate={selectedDate}
                schedules={calendarItems}
                onChangeMonth={(nextYear, nextMonth) => {
                  setYear(nextYear);
                  setMonth(nextMonth);

                  const nextSelected = `${nextYear}-${pad2(nextMonth)}-01`;
                  setSelectedDate(nextSelected);
                }}
                onSelectDate={(date) => {
                  setSelectedDate(date);
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">선택한 날짜 일정</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedDate || "-"}
                </p>
              </div>

              {canCreate ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditorMode("create");
                    setEditingRow(null);
                    setEditorOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  추가
                </Button>
              ) : null}
            </div>

            <div className="space-y-3">
              {selectedDateRows.length === 0 ? (
                <div className="rounded-2xl border bg-white px-4 py-10 text-center text-sm text-muted-foreground">
                  선택한 날짜에 등록된 일정이 없습니다.
                </div>
              ) : (
                selectedDateRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border bg-white px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {row.title}
                          </p>

                          {row.isGlobal ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              전체
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                              개인
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatScheduleTime(row)}
                        </p>

                        {row.description ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                            {row.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(row)}
                        >
                          <PencilLine className="mr-2 h-4 w-4" />
                          수정
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(row)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          삭제
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ScheduleEditorDialog
        open={editorOpen}
        mode={editorMode}
        selectedDate={selectedDate}
        initialValue={
          editorMode === "edit" && editingRow
            ? {
                title: editingRow.title ?? "",
                description: editingRow.description ?? "",
                date: editingRow.date ?? selectedDate,
                ampm: editingRow.ampm ?? "AM",
                hour: Number(editingRow.hour ?? 9),
                minute: Number(editingRow.minute ?? 0),
                isGlobal: !!editingRow.isGlobal,
              }
            : {
                title: "",
                description: "",
                date: selectedDate,
                ampm: "AM",
                hour: 9,
                minute: 0,
                isGlobal: false,
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