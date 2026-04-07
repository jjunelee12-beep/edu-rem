import { useMemo, useState, useEffect } from "react";
import {
  X,
  ImagePlus,
  LogOut,
  Image as ImageIcon,
  Paperclip,
  Users,
} from "lucide-react";

import ImagePreviewModal from "@/components/messenger/ImagePreviewModal";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";
import { isRoomMuted, setRoomMuted } from "@/lib/messengerRoomMute";

import type {
  MessengerRoom,
  MessengerMessage,
  MessengerUser,
} from "@/components/messenger/mockMessengerData";

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
      typeof reader.result === "string" ? resolve(reader.result) : reject();
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
  notificationEnabled?: boolean;
  chatBackground?: string;
  onChangeBackground?: (value: string) => void;
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
  notificationEnabled = true,
  chatBackground = "",
  onChangeBackground,
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

  const mainUser =
    activeRoom?.type === "direct" ? participants[0] : participants[0];
  const currentRoomId = Number(activeRoom?.id || 0);

  const [localMuted, setLocalMuted] = useState(false);
  const [currentBg, setCurrentBg] = useState("");
  const [previewImage, setPreviewImage] = useState<{
    open: boolean;
    url?: string;
    name?: string;
  }>({ open: false });

  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    setLocalMuted(isRoomMuted(currentRoomId));
  }, [currentRoomId]);

  useEffect(() => {
    const syncMuteState = () => {
      setLocalMuted(isRoomMuted(currentRoomId));
    };

    window.addEventListener("messenger:settings-changed", syncMuteState);

    return () => {
      window.removeEventListener("messenger:settings-changed", syncMuteState);
    };
  }, [currentRoomId]);

  useEffect(() => {
    if (!activeRoom?.id) return;
    const all = readRoomBackgrounds();
    const saved = all[String(activeRoom.id)] || "";
    setCurrentBg(saved);
    onChangeBackground?.(saved);
  }, [open, activeRoom?.id, onChangeBackground]);

  const handleToggleRoomMute = () => {
    if (!currentRoomId) return;

    const nextMuted = !localMuted;
    setRoomMuted(currentRoomId, nextMuted);
    setLocalMuted(nextMuted);
    onToggleNotifications?.();
  };

  const handleUploadBackground = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom?.id) return;

    const dataUrl = await fileToDataUrl(file);
    saveRoomBackground(Number(activeRoom.id), dataUrl);
    setCurrentBg(dataUrl);
    onChangeBackground?.(dataUrl);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[10030] w-[380px] border-l border-slate-200 bg-[#f5f7fa]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
        <div className="font-semibold text-slate-900">채팅방 설정</div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="h-[calc(100%-65px)] space-y-6 overflow-y-auto p-4">
        <div className="rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="text-center">
            <div className="mx-auto h-20 w-20 overflow-hidden rounded-full bg-slate-200">
              {mainUser?.avatar ? (
                <img
                  src={normalizeAssetUrl(mainUser.avatar)}
                  alt={mainUser?.name || "프로필"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-slate-500">
                  {String(activeRoom?.name || "?").slice(0, 1)}
                </div>
              )}
            </div>

            <div className="mt-3 font-bold text-slate-900">
              {activeRoom?.type === "group" ? (
                editingTitle ? (
                  <div className="flex items-center justify-center gap-2">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
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
                      className="text-sm font-medium text-blue-600"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTitle(false);
                        setEditTitle(activeRoom?.name || "");
                      }}
                      className="text-sm font-medium text-slate-500"
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
                    className="cursor-pointer font-bold text-slate-900"
                  >
                    {activeRoom?.name}
                  </button>
                )
              ) : (
                activeRoom?.name
              )}
            </div>

            {activeRoom?.type === "group" ? (
              <p className="mt-2 text-xs text-slate-500">
                그룹 채팅방 설정과 참여자 관리를 할 수 있습니다.
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                1:1 대화 설정과 배경을 관리할 수 있습니다.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">이 방 알림</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                이 채팅방의 새 메시지 토스트 알림을 끄거나 다시 켤 수 있습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleRoomMute}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${
                localMuted ? "bg-slate-300" : "bg-slate-900"
              }`}
              title={localMuted ? "알림 꺼짐" : "알림 켜짐"}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  localMuted ? "translate-x-1" : "translate-x-8"
                }`}
              />
            </button>
          </div>
        </div>

        {activeRoom?.type === "group" && (
          <div className="rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-700" />
                  <p className="text-sm font-semibold text-slate-900">
                    참여자 관리
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  여러 명을 선택해 그룹 채팅에 추가할 수 있습니다.
                </p>
              </div>

              <button
                type="button"
                onClick={onAddParticipant}
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-900 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                + 추가
              </button>
            </div>

            {participants.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-xs text-slate-500">
                표시할 참여자가 없습니다.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {participants.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="relative h-10 w-10 shrink-0">
                      <div className="h-full w-full overflow-hidden rounded-full bg-slate-200">
                        {member.avatar ? (
                          <img
                            src={normalizeAssetUrl(member.avatar)}
                            alt={member.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500">
                            {String(member.name || "?").slice(0, 1)}
                          </div>
                        )}
                      </div>

                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {member.name}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {member.team || "미분류"}
                        {member.position ? ` · ${member.position}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-3">
            <p className="text-sm font-semibold text-slate-900">배경</p>
            <p className="mt-1 text-xs text-slate-500">
              채팅창 배경을 프리셋 색상이나 직접 선택한 이미지로 설정할 수 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {BG_PRESETS.map((bg) => {
              const selected = currentBg === bg.value;

              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => {
                    const value = bg.value;
                    saveRoomBackground(Number(activeRoom?.id), value);
                    setCurrentBg(value);
                    onChangeBackground?.(value);
                  }}
                  className={`relative h-16 rounded-2xl border transition ${
                    selected
                      ? "scale-[1.02] border-slate-900 ring-2 ring-slate-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  style={{ background: bg.value || "#d1d5db" }}
                  title={bg.label}
                >
                  {selected && (
                    <span className="absolute inset-x-0 bottom-1 text-[10px] font-medium text-slate-700">
                      선택됨
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              saveRoomBackground(Number(activeRoom?.id), "");
              setCurrentBg("");
              onChangeBackground?.("");
            }}
            className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            배경 초기화
          </button>

          <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 transition hover:bg-slate-100">
            <ImagePlus className="h-4 w-4" />
            <span>사용자 지정 배경 업로드</span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleUploadBackground}
            />
          </label>

          <div className="mt-4">
            <div className="mb-2 text-xs font-medium text-slate-500">
              현재 배경 미리보기
            </div>

            <div
              className="h-28 w-full overflow-hidden rounded-2xl border border-slate-200"
              style={{
                backgroundColor:
                  currentBg && !currentBg.startsWith("data:")
                    ? currentBg
                    : "#b7c7d8",
                backgroundImage:
                  currentBg && currentBg.startsWith("data:")
                    ? `url(${currentBg})`
                    : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="flex h-full items-end bg-gradient-to-t from-black/10 to-transparent p-3">
                <div className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
                  채팅 배경 미리보기
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-slate-700" />
            <div className="text-sm font-semibold text-slate-900">사진</div>
          </div>

          {sortedImageMessages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              없음
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sortedImageMessages.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  className="overflow-hidden rounded-2xl border border-slate-200"
                  onClick={() =>
                    setPreviewImage({
                      open: true,
                      url: img.fileUrl,
                      name: img.fileName,
                    })
                  }
                >
                  <img
                    src={normalizeAssetUrl(img.fileUrl)}
                    alt={img.fileName || "image"}
                    className="h-20 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-slate-700" />
            <div className="text-sm font-semibold text-slate-900">파일</div>
          </div>

          {sortedFileMessages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              없음
            </div>
          ) : (
            <div className="space-y-2">
              {sortedFileMessages.map((file) => (
                <a
                  key={file.id}
                  href={normalizeAssetUrl(file.fileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  {file.fileName}
                </a>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onLeaveRoom}
          className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-red-200 bg-white px-4 py-3 text-red-500 transition hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          방 나가기
        </button>
      </div>

      <ImagePreviewModal
        open={previewImage.open}
        imageUrl={previewImage.url}
        imageName={previewImage.name}
        onClose={() => setPreviewImage({ open: false })}
      />
    </div>
  );
}