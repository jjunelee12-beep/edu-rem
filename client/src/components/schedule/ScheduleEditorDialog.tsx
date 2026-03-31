import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ScheduleEditorDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  selectedDate?: string;
  initialValue?: {
    title?: string;
    description?: string;
    date?: string;
    ampm?: "AM" | "PM";
    hour?: number;
    minute?: number;
    isGlobal?: boolean;
  } | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    date: string;
    ampm: "AM" | "PM";
    hour: number;
    minute: number;
    isGlobal: boolean;
  }) => void;
};

const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function pad2(v: number) {
  return String(v).padStart(2, "0");
}

export default function ScheduleEditorDialog({
  open,
  mode,
  selectedDate,
  initialValue,
  isSubmitting,
  onClose,
  onSubmit,
}: ScheduleEditorDialogProps) {
  const { user } = useAuth();

  const canCreateGlobal =
    user?.role === "host" || user?.role === "superhost";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState("00");
  const [isGlobal, setIsGlobal] = useState(false);

  useEffect(() => {
    if (!open) return;

    setTitle(initialValue?.title ?? "");
    setDescription(initialValue?.description ?? "");
    setDate(initialValue?.date ?? selectedDate ?? "");
    setAmpm(initialValue?.ampm ?? "AM");
    setHour(initialValue?.hour ?? 9);
    setMinute(
      initialValue?.minute !== undefined && initialValue?.minute !== null
        ? pad2(Number(initialValue.minute))
        : "00"
    );
    setIsGlobal(canCreateGlobal ? !!initialValue?.isGlobal : false);
  }, [open, initialValue, selectedDate, canCreateGlobal]);

  const minuteNumber = useMemo(() => {
    const n = Number(minute);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 59) return 59;
    return n;
  }, [minute]);

  const handleSubmit = () => {
    const nextTitle = title.trim();
    const nextDescription = description.trim();
    const nextDate = date.trim();

    if (!nextTitle) {
      alert("일정 제목을 입력해주세요.");
      return;
    }

    if (!nextDate) {
      alert("날짜를 선택해주세요.");
      return;
    }

    onSubmit({
      title: nextTitle,
      description: nextDescription,
      date: nextDate,
      ampm,
      hour: Number(hour),
      minute: minuteNumber,
      isGlobal: canCreateGlobal ? isGlobal : false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "일정 등록" : "일정 수정"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">일정 제목</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 오전 상담 체크"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">날짜</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">오전/오후</label>
              <select
                value={ampm}
                onChange={(e) => setAmpm(e.target.value as "AM" | "PM")}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="AM">오전</option>
                <option value="PM">오후</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">시간</label>
              <select
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h}시
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">분</label>
              <Input
                value={minute}
                onChange={(e) => {
                  const onlyNum = e.target.value.replace(/[^0-9]/g, "");
                  setMinute(onlyNum.slice(0, 2));
                }}
                placeholder="00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">내용</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="일정 상세 내용을 입력하세요"
              className="min-h-[140px]"
            />
          </div>

          {canCreateGlobal ? (
  <label className="flex items-center gap-2 rounded-lg border px-3 py-3">
    <input
      type="checkbox"
      checked={isGlobal}
      onChange={(e) => setIsGlobal(e.target.checked)}
    />
    <span>전체 일정으로 등록</span>
  </label>
) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {mode === "create" ? "저장" : "수정"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}