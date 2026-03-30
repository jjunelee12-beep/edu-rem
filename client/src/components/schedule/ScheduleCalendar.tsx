import { ChevronLeft, ChevronRight } from "lucide-react";

export type ScheduleCalendarItem = {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  ampm: "AM" | "PM";
  hour: number;
  minute: number;
  isGlobal?: boolean;
};

type ScheduleCalendarProps = {
  year: number;
  month: number; // 1~12
  selectedDate?: string;
  schedules: ScheduleCalendarItem[];
  onChangeMonth: (year: number, month: number) => void;
  onSelectDate: (date: string) => void;
};

const weekLabels = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(v: number) {
  return String(v).padStart(2, "0");
}

function toDateString(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function isSameDate(a?: string, b?: string) {
  return String(a || "") === String(b || "");
}

function getTodayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function getMonthMatrix(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const cells: Array<{
    year: number;
    month: number;
    day: number;
    currentMonth: boolean;
  }> = [];

  for (let i = 0; i < startWeekday; i++) {
    const day = prevMonthDays - startWeekday + i + 1;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    cells.push({
      year: prevYear,
      month: prevMonth,
      day,
      currentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      year,
      month,
      day,
      currentMonth: true,
    });
  }

  const remain = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);

  for (let i = 1; i <= remain; i++) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    cells.push({
      year: nextYear,
      month: nextMonth,
      day: i,
      currentMonth: false,
    });
  }

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return rows;
}

function sortSchedules(items: ScheduleCalendarItem[]) {
  return [...items].sort((a, b) => {
    const aHour24 = a.ampm === "AM" ? (a.hour === 12 ? 0 : a.hour) : a.hour === 12 ? 12 : a.hour + 12;
    const bHour24 = b.ampm === "AM" ? (b.hour === 12 ? 0 : b.hour) : b.hour === 12 ? 12 : b.hour + 12;

    if (aHour24 !== bHour24) return aHour24 - bHour24;
    return Number(a.minute) - Number(b.minute);
  });
}

function formatTime(item: ScheduleCalendarItem) {
  const minute = pad2(Number(item.minute || 0));
  return `${item.ampm === "AM" ? "오전" : "오후"} ${item.hour}:${minute}`;
}

export default function ScheduleCalendar({
  year,
  month,
  selectedDate,
  schedules,
  onChangeMonth,
  onSelectDate,
}: ScheduleCalendarProps) {
  const today = getTodayString();
  const rows = getMonthMatrix(year, month);

  const scheduleMap = new Map<string, ScheduleCalendarItem[]>();
  schedules.forEach((item) => {
    const key = String(item.date || "");
    if (!scheduleMap.has(key)) {
      scheduleMap.set(key, []);
    }
    scheduleMap.get(key)!.push(item);
  });

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {year}. {pad2(month)}
        </h3>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const prevMonth = month === 1 ? 12 : month - 1;
              const prevYear = month === 1 ? year - 1 : year;
              onChangeMonth(prevYear, prevMonth);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-background transition hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              const nextMonth = month === 12 ? 1 : month + 1;
              const nextYear = month === 12 ? year + 1 : year;
              onChangeMonth(nextYear, nextMonth);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-background transition hover:bg-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
        {weekLabels.map((label) => (
          <div key={label} className="py-1 font-medium">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-2 space-y-2">
        {rows.map((week, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-7 gap-2">
            {week.map((cell, colIdx) => {
              const dateStr = toDateString(cell.year, cell.month, cell.day);
              const cellSchedules = sortSchedules(scheduleMap.get(dateStr) ?? []);
              const isToday = isSameDate(dateStr, today);
              const isSelected = isSameDate(dateStr, selectedDate);

              return (
                <button
                  key={`${dateStr}-${colIdx}`}
                  type="button"
                  onClick={() => onSelectDate(dateStr)}
                  className={[
                    "min-h-[110px] rounded-xl border p-2 text-left transition",
                    cell.currentMonth ? "bg-white" : "bg-slate-50 text-muted-foreground",
                    isSelected ? "border-primary ring-2 ring-primary/20" : "hover:bg-slate-50",
                    isToday ? "shadow-sm" : "",
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={[
                        "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-semibold",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : isToday
                          ? "bg-blue-50 text-blue-600"
                          : "",
                      ].join(" ")}
                    >
                      {cell.day}
                    </span>

                    {cellSchedules.length > 0 ? (
                      <span className="text-[11px] text-muted-foreground">
                        {cellSchedules.length}건
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    {cellSchedules.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className={[
                          "truncate rounded-md px-2 py-1 text-[11px]",
                          item.isGlobal
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-700",
                        ].join(" ")}
                        title={`${formatTime(item)} · ${item.title}`}
                      >
                        {formatTime(item)} · {item.title}
                      </div>
                    ))}

                    {cellSchedules.length > 3 ? (
                      <div className="text-[11px] text-muted-foreground">
                        + {cellSchedules.length - 3}개 더보기
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}