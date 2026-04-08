import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import FileHandler from "@tiptap/extension-file-handler";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import HorizontalRule from "@tiptap/extension-horizontal-rule";

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
  Pilcrow,
  Link as LinkIcon,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table as TableIcon,
  Rows3,
  Columns3,
  Trash2,
} from "lucide-react";
import { useEffect, useRef } from "react";

type NoticeRichEditorProps = {
  value: string;
  onChange: (html: string) => void;
};

async function uploadNoticeImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL || ""}/api/upload`,
    {
      method: "POST",
      body: formData,
      credentials: "include",
    }
  );

  if (!res.ok) {
    throw new Error("이미지 업로드에 실패했습니다.");
  }

  const json = await res.json();
  const fileUrl = json?.fileUrl || json?.url;

  if (!fileUrl) {
    throw new Error("업로드 URL을 받지 못했습니다.");
  }

  return String(fileUrl);
}

export default function NoticeRichEditor({
  value,
  onChange,
}: NoticeRichEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        protocols: ["http", "https"],
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      HorizontalRule,
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
                attrs: { src: url, alt: file.name },
              })
              .run();
          }
        },
        onPaste: async (editor, files) => {
          for (const file of files) {
            const url = await uploadNoticeImage(file);
            editor.chain().focus().setImage({ src: url, alt: file.name }).run();
          }
        },
      }),
    ],
    content: value || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "notice-editor-content min-h-[720px] w-full px-6 py-5 text-[15px] leading-8 outline-none focus:outline-none",
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
    editor.chain().focus().setImage({ src: url, alt: file.name }).run();
  };

  const handleSetLink = () => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("링크 URL을 입력하세요.", previousUrl);

    if (url === null) return;

    const trimmed = url.trim();

    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  };

  const handleInsertTable = () => {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

const handleAddColumnBefore = () => {
  if (!editor) return;
  editor.chain().focus().addColumnBefore().run();
};

const handleAddColumnAfter = () => {
  if (!editor) return;
  editor.chain().focus().addColumnAfter().run();
};

const handleDeleteColumn = () => {
  if (!editor) return;
  editor.chain().focus().deleteColumn().run();
};

const handleAddRowBefore = () => {
  if (!editor) return;
  editor.chain().focus().addRowBefore().run();
};

const handleAddRowAfter = () => {
  if (!editor) return;
  editor.chain().focus().addRowAfter().run();
};

const handleDeleteRow = () => {
  if (!editor) return;
  editor.chain().focus().deleteRow().run();
};

const handleDeleteTable = () => {
  if (!editor) return;
  editor.chain().focus().deleteTable().run();
};

  if (!editor) {
    return (
      <div className="min-h-[720px] rounded-2xl border bg-white px-6 py-5 text-sm text-muted-foreground">
        에디터 불러오는 중...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handlePickImage(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 px-4 py-3">
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
          variant={editor.isActive("paragraph") ? "default" : "outline"}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <Button
          type="button"
          size="sm"
          variant={editor.isActive({ textAlign: "left" }) ? "default" : "outline"}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive({ textAlign: "center" }) ? "default" : "outline"}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive({ textAlign: "right" }) ? "default" : "outline"}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <Button
          type="button"
          size="sm"
          variant={editor.isActive("link") ? "default" : "outline"}
          onClick={handleSetLink}
        >
          <LinkIcon className="mr-1 h-4 w-4" />
          링크
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="mr-1 h-4 w-4" />
          구분선
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleInsertTable}
        >
          <TableIcon className="mr-1 h-4 w-4" />
          표
        </Button>
<Button
  type="button"
  size="sm"
  variant={editor.isActive("table") ? "default" : "outline"}
  onClick={handleAddColumnBefore}
>
  <Columns3 className="mr-1 h-4 w-4" />
  열앞추가
</Button>

<Button
  type="button"
  size="sm"
  variant={editor.isActive("table") ? "default" : "outline"}
  onClick={handleAddColumnAfter}
>
  <Columns3 className="mr-1 h-4 w-4" />
  열뒤추가
</Button>

<Button
  type="button"
  size="sm"
  variant={editor.isActive("table") ? "default" : "outline"}
  onClick={handleDeleteColumn}
>
  <Columns3 className="mr-1 h-4 w-4" />
  열삭제
</Button>

<Button
  type="button"
  size="sm"
  variant={editor.isActive("table") ? "default" : "outline"}
  onClick={handleAddRowBefore}
>
  <Rows3 className="mr-1 h-4 w-4" />
  행위추가
</Button>

<Button
  type="button"
  size="sm"
  variant={editor.isActive("table") ? "default" : "outline"}
  onClick={handleAddRowAfter}
>
  <Rows3 className="mr-1 h-4 w-4" />
  행아래추가
</Button>

<Button
  type="button"
  size="sm"
  variant={editor.isActive("table") ? "default" : "outline"}
  onClick={handleDeleteRow}
>
  <Rows3 className="mr-1 h-4 w-4" />
  행삭제
</Button>

<Button
  type="button"
  size="sm"
  variant="outline"
  onClick={handleDeleteTable}
>
  <Trash2 className="mr-1 h-4 w-4" />
  표삭제
</Button>

<div className="mx-1 h-6 w-px bg-slate-200" />

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          <ImageIcon className="mr-1 h-4 w-4" />
          이미지
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