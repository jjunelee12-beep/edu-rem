import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type NoticeEditorDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initialValue?: {
    title?: string;
    content?: string;
  } | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { title: string; content: string }) => void;
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

  useEffect(() => {
    if (!open) return;

    setTitle(initialValue?.title ?? "");
    setContent(initialValue?.content ?? "");
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
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "공지사항 작성" : "공지사항 수정"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">제목</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="공지사항 제목을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">내용</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="공지사항 내용을 입력하세요"
              className="min-h-[320px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {mode === "create" ? "등록" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}