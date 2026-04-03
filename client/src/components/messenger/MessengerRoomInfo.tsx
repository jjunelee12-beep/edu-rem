import { useMemo, useState, useEffect } from "react";
import {
  Bell,
  X,
  Volume2,
  Moon,
  ImagePlus,
  LogOut,
  Image as ImageIcon,
  Paperclip,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import ImagePreviewModal from "@/components/messenger/ImagePreviewModal";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";

import type {
  MessengerRoom,
  MessengerMessage,
  MessengerUser,
} from "@/components/messenger/mockMessengerData";

const SOUND_ENABLED_KEY = "messenger-sound-enabled";
const DND_KEY = "messenger-dnd-range";
const ROOM_BG_KEY = "messenger-room-backgrounds";

function readRoomBackgrounds(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ROOM_BG_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveRoomBackground(roomId: number, value: string) {
  const current = readRoomBackgrounds();
  current[String(roomId)] = value;
  localStorage.setItem(ROOM_BG_KEY, JSON.stringify(current));
  window.dispatchEvent(new Event("messenger:bg-changed"));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject();
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const BG_PRESETS = [
  { id: "default", label: "기본", value: "" },
  { id: "blue", label: "블루", value: "#b7c7d8" },
  { id: "green", label: "그린", value: "#c7e0d6" },
  { id: "gray", label: "그레이", value: "#e5e7eb" },
];

type Props = {
  open: boolean;
  activeRoom: MessengerRoom | null;
  participants: MessengerUser[];
  messages: MessengerMessage[];
  roomMuted?: boolean;
  onClose: () => void;
  onToggleNotifications: () => void;
  onLeaveRoom: () => void;
onAddParticipant: () => void;
onUpdateTitle: (title: string) => void;
};

export default function MessengerRoomInfo({
  open,
  activeRoom,
  participants,
  messages,
  roomMuted = false,
  onClose,
  onToggleNotifications,
  onLeaveRoom,
onAddParticipant,
onUpdateTitle,
}: Props) {
  const imageMessages = useMemo(
    () => messages.filter((m) => m.type === "image" && m.fileUrl),
    [messages]
  );

  const fileMessages = useMemo(
    () => messages.filter((m) => m.type === "file" && m.fileUrl),
    [messages]
  );

  const sortedImageMessages = [...imageMessages].reverse();
  const sortedFileMessages = [...fileMessages].reverse();

  const mainUser = participants[0];

  const [currentBg, setCurrentBg] = useState("");

  const [previewImage, setPreviewImage] = useState<{
    open: boolean;
    url?: string;
    name?: string;
  }>({ open: false });

const [editingTitle, setEditingTitle] = useState(false);
const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    if (!activeRoom?.id) return;
    const all = readRoomBackgrounds();
    setCurrentBg(all[String(activeRoom.id)] || "");
  }, [open, activeRoom?.id]);

  const handleUploadBackground = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom?.id) return;

    const dataUrl = await fileToDataUrl(file);
    saveRoomBackground(Number(activeRoom.id), dataUrl);
    setCurrentBg(dataUrl);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[10030] w-[360px] bg-[#f5f7fa] border-l">
      {/* 헤더 */}
      <div className="flex justify-between p-4 border-b bg-white">
        <div className="font-semibold">채팅방 설정</div>
        <button onClick={onClose}>
          <X />
        </button>
      </div>

      {/* 본문 */}
      <div className="p-4 space-y-6 overflow-y-auto h-full">

        {/* 프로필 */}
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-gray-200 overflow-hidden">
            {mainUser?.avatar && (
              <img src={normalizeAssetUrl(mainUser.avatar)} />
            )}
          </div>
          <div className="mt-2 font-bold">
  {activeRoom?.type === "group" ? (
    editingTitle ? (
      <div className="flex items-center justify-center gap-2">
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          placeholder="채팅방 이름"
        />
        <button
          type="button"
          onClick={() => {
            const next = editTitle.trim();
            if (!next) return;
            onUpdateTitle(next);
            setEditingTitle(false);
          }}
          className="text-sm text-blue-600"
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => {
            setEditingTitle(false);
            setEditTitle(activeRoom?.name || "");
          }}
          className="text-sm text-slate-500"
        >
          취소
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => {
          setEditTitle(activeRoom?.name || "");
          setEditingTitle(true);
        }}
        className="cursor-pointer font-bold"
      >
        {activeRoom?.name}
      </button>
    )
  ) : (
    activeRoom?.name
  )}
</div>
        </div>

        {/* 알림 */}
        <button onClick={onToggleNotifications} className="w-full border p-3 rounded-xl">
          {roomMuted ? "🔕 알림 꺼짐" : "🔔 알림 켜짐"}
        </button>

        {/* 배경 */}
        <div>
          <div className="mb-2 font-semibold">배경</div>
          <div className="grid grid-cols-3 gap-2">
            {BG_PRESETS.map((bg) => (
              <button
                key={bg.id}
                onClick={() => {
                  saveRoomBackground(Number(activeRoom?.id), bg.value);
                  setCurrentBg(bg.value);
                }}
                className="h-16 border rounded"
                style={{ background: bg.value || "#ccc" }}
              />
            ))}
          </div>

          <input type="file" onChange={handleUploadBackground} />
        </div>

        {/* 사진 */}
        <div>
          <div className="font-semibold mb-2">사진</div>

          {sortedImageMessages.length === 0 ? (
            <div>없음</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sortedImageMessages.map((img) => (
                <img
                  key={img.id}
                  src={normalizeAssetUrl(img.fileUrl)}
                  className="h-20 object-cover"
                  onClick={() =>
                    setPreviewImage({
                      open: true,
                      url: img.fileUrl,
                      name: img.fileName,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* 파일 */}
        <div>
          <div className="font-semibold mb-2">파일</div>

          {sortedFileMessages.length === 0 ? (
            <div>없음</div>
          ) : (
            sortedFileMessages.map((file) => (
              <a
                key={file.id}
                href={normalizeAssetUrl(file.fileUrl)}
                target="_blank"
                className="block border p-2 rounded"
              >
                {file.fileName}
              </a>
            ))
          )}
        </div>

	{activeRoom?.type === "group" && (
  <button
    onClick={onAddParticipant}
    className="w-full border p-3 rounded-xl bg-blue-50 text-blue-600"
  >
    + 참여자 추가
  </button>
)}

        {/* 나가기 */}
        <button
          onClick={onLeaveRoom}
          className="w-full border p-3 rounded-xl text-red-500"
        >
          방 나가기
        </button>
      </div>

      {/* 이미지 모달 */}
      <ImagePreviewModal
        open={previewImage.open}
        imageUrl={previewImage.url}
        imageName={previewImage.name}
        onClose={() => setPreviewImage({ open: false })}
      />
    </div>
  );
}