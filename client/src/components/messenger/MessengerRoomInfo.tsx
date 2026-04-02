import { useMemo } from "react";
import { Bell, UserPlus, LogOut, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type {
  MessengerRoom,
  MessengerMessage,
  MessengerUser,
} from "@/components/messenger/mockMessengerData";

type MessengerRoomInfoProps = {
  open: boolean;
  activeRoom: MessengerRoom | null;
  participants: MessengerUser[];
  messages: MessengerMessage[];
  onClose: () => void;
  onToggleNotifications: () => void;
  onLeaveRoom: () => void;
  onAddParticipant: () => void;
};

export default function MessengerRoomInfo({
  open,
  activeRoom,
  participants,
  messages,
  onClose,
  onToggleNotifications,
  onLeaveRoom,
  onAddParticipant,
}: MessengerRoomInfoProps) {
  const imageMessages = useMemo(() => {
    return messages.filter((m) => m.type === "image" && m.fileUrl);
  }, [messages]);

  const fileMessages = useMemo(() => {
    return messages.filter((m) => m.type === "file" && m.fileUrl);
  }, [messages]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10030] flex justify-end bg-black/20">
      <div className="flex h-full w-[340px] flex-col border-l border-slate-200 bg-[#fcfcfd] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {activeRoom?.name || "채팅방 정보"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {activeRoom?.type === "direct" ? "1:1 채팅" : "그룹 채팅"}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-700 transition hover:bg-slate-100"
            aria-label="채팅방 정보 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">참여자</div>

            <div className="space-y-2">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm"
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                    {p.avatar ? (
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{p.name?.slice(0, 1)}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {p.name}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      {p.position} / {p.team}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">사진</div>

            {imageMessages.length === 0 ? (
              <div className="rounded-2xl bg-white px-3 py-3 text-xs text-slate-500 shadow-sm">
                사진 없음
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {imageMessages.slice(-9).map((img) => (
                  <img
                    key={img.id}
                    src={img.fileUrl}
                    alt="img"
                    className="h-20 w-full rounded-xl object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">첨부파일</div>

            {fileMessages.length === 0 ? (
              <div className="rounded-2xl bg-white px-3 py-3 text-xs text-slate-500 shadow-sm">
                파일 없음
              </div>
            ) : (
              <div className="space-y-2">
                {fileMessages.slice(-10).map((file) => (
                  <a
                    key={file.id}
                    href={file.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl bg-white px-3 py-3 text-sm text-blue-600 underline shadow-sm"
                  >
                    {file.fileName || "파일"}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-200 p-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 rounded-2xl"
            onClick={onToggleNotifications}
          >
            <Bell className="h-4 w-4" />
            알림 설정
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-2 rounded-2xl"
            onClick={onAddParticipant}
          >
            <UserPlus className="h-4 w-4" />
            대화상대 추가
          </Button>

          <Button
            variant="destructive"
            className="w-full justify-start gap-2 rounded-2xl"
            onClick={onLeaveRoom}
          >
            <LogOut className="h-4 w-4" />
            방 나가기
          </Button>
        </div>
      </div>
    </div>
  );
}