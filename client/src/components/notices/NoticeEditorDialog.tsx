import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PencilLine, Pin, FileText } from "lucide-react";
import NoticeRichEditor from "@/components/notices/NoticeRichEditor";

type NoticeEditorDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initialValue?: {
  title?: string;
  content?: string;
  isPinned?: boolean;
  importance?: "normal" | "important" | "urgent";
} | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
  title: string;
  content: string;
  isPinned?: boolean;
  importance?: "normal" | "important" | "urgent";
}) => void;
};

export default function NoticeEditorDialog({
  open,
  mode,
  initialValue,
  isSubmitting,
  onClose,
  onSubmit,
}: NoticeEditorDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
const [importance, setImportance] = useState<"normal" | "important" | "urgent">("normal");

  useEffect(() => {
    if (!open) return;

    setTitle(initialValue?.title ?? "");
    setContent(initialValue?.content ?? "");
    setIsPinned(!!initialValue?.isPinned);
	setImportance(initialValue?.importance ?? "normal");
  }, [open, initialValue]);

  const handleSubmit = () => {
    const nextTitle = title.trim();
    const nextContent = content.trim();

    if (!nextTitle) {
      alert("제목을 입력해주세요.");
      return;
    }

    if (!nextContent) {
      alert("내용을 입력해주세요.");
      return;
    }

   onSubmit({
  title: nextTitle,
  content: nextContent,
  isPinned,
  importance,
});
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="w-[95vw] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b bg-slate-50 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            {mode === "create" ? (
              <FileText className="h-5 w-5 text-primary" />
            ) : (
              <PencilLine className="h-5 w-5 text-primary" />
            )}
            {mode === "create" ? "공지사항 작성" : "공지사항 수정"}
          </DialogTitle>

          <p className="mt-2 text-sm text-muted-foreground">
            직원들이 바로 확인할 수 있도록 제목과 내용을 자세히 작성하세요.
            중요한 공지는 상단 고정으로 표시할 수 있습니다.
          </p>
        </DialogHeader>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
  <div className="space-y-2">
    <label className="text-sm font-semibold text-slate-700">제목</label>
    <Input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="공지사항 제목을 입력하세요"
      className="h-12 text-base"
    />
  </div>

  <div className="flex items-end">
    <label className="flex h-12 items-center gap-2 rounded-md border px-4 text-sm font-medium">
      <Checkbox
        checked={isPinned}
        onCheckedChange={(checked) => setIsPinned(!!checked)}
      />
      <Pin className="h-4 w-4 text-amber-500" />
      상단 고정
    </label>
  </div>

  <div className="flex items-end">
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-700">중요도</label>
      <select
        value={importance}
        onChange={(e) =>
          setImportance(e.target.value as "normal" | "important" | "urgent")
        }
        className="h-12 rounded-md border bg-white px-3 text-sm"
      >
        <option value="normal">일반</option>
        <option value="important">중요</option>
        <option value="urgent">긴급</option>
      </select>
    </div>
  </div>
</div>

         <div className="space-y-2">
  <label className="text-sm font-semibold text-slate-700">내용</label>
  <NoticeRichEditor value={content} onChange={setContent} />
</div>

          <div className="rounded-xl border bg-slate-50 px-4 py-4">
            <div className="mb-2 text-sm font-semibold text-slate-700">미리 안내</div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• 제목은 한눈에 내용이 보이게 작성하세요.</li>
              <li>• 내용은 줄바꿈으로 구분해서 읽기 쉽게 작성하세요.</li>
              <li>• 자주 확인해야 하는 공지는 상단 고정을 활용하세요.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="border-t bg-white px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {mode === "create" ? "공지 등록" : "수정 저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}