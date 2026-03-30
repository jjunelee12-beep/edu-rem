import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

type ImagePreviewModalProps = {
  open: boolean;
  imageUrl?: string;
  imageName?: string;
  onClose: () => void;
};

export default function ImagePreviewModal({
  open,
  imageUrl,
  imageName,
  onClose,
}: ImagePreviewModalProps) {
  if (!open || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* 이미지 */}
        <img
          src={imageUrl}
          alt={imageName || "preview"}
          className="max-h-[80vh] max-w-[90vw] object-contain"
        />

        {/* 파일명 */}
        {imageName && (
          <div className="px-4 py-2 text-center text-xs text-white/80">
            {imageName}
          </div>
        )}
      </div>
    </div>
  );
}