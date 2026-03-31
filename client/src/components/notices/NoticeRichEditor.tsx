import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import FileHandler from "@tiptap/extension-file-handler";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Undo2,
  Redo2,
  Image as ImageIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";

type NoticeRichEditorProps = {
  value: string;
  onChange: (html: string) => void;
};

async function uploadNoticeImage(file: File) {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch("/api/notices/upload-image", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("이미지 업로드에 실패했습니다.");
  }

  const json = await res.json();
  if (!json?.url) {
    throw new Error("업로드 URL을 받지 못했습니다.");
  }

  return json.url as string;
}

export default function NoticeRichEditor({
  value,
  onChange,
}: NoticeRichEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      FileHandler.configure({
        allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
        onDrop: async (editor, files, pos) => {
          for (const file of files) {
            const url = await uploadNoticeImage(file);
            editor
              .chain()
              .focus()
              .insertContentAt(pos, {
                type: "image",
                attrs: { src: url },
              })
              .run();
          }
        },
        onPaste: async (editor, files) => {
          for (const file of files) {
            const url = await uploadNoticeImage(file);
            editor.chain().focus().setImage({ src: url }).run();
          }
        },
      }),
    ],
    content: value || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[420px] w-full rounded-b-xl border-0 px-4 py-4 text-base leading-7 outline-none focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [value, editor]);

  const handlePickImage = async (file?: File | null) => {
    if (!file || !editor) return;
    const url = await uploadNoticeImage(file);
    editor.chain().focus().setImage({ src: url }).run();
  };

  if (!editor) {
    return (
      <div className="min-h-[420px] rounded-xl border bg-white px-4 py-4 text-sm text-muted-foreground">
        에디터 불러오는 중...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handlePickImage(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 px-3 py-3">
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("bold") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive("italic") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive("heading", { level: 1 }) ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive("heading", { level: 2 }) ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive("bulletList") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive("orderedList") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive("blockquote") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}