import { useMemo, useState, useEffect } from "react";
import { Bell, UserPlus, LogOut, X, Volume2, Moon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";

import type {
  MessengerRoom,
  MessengerMessage,
  MessengerUser,
} from "@/components/messenger/mockMessengerData";

const ROOM_MUTE_KEY = "messenger-muted-room-ids";
const SOUND_ENABLED_KEY = "messenger-sound-enabled";
const DND_KEY = "messenger-dnd-range";

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

function readMutedRooms(): number[] {
  try {
    const raw = localStorage.getItem(ROOM_MUTE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => Number(v)).filter(Boolean);
  } catch {
    return [];
  }
}

function readSoundEnabled() {
  const raw = localStorage.getItem(SOUND_ENABLED_KEY);
  if (raw === null) return true;
  return raw === "true";
}

function readDnd() {
  try {
    const raw = localStorage.getItem(DND_KEY);
    if (!raw) {
      return {
        enabled: false,
        start: "22:00",
        end: "08:00",
      };
    }
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed?.enabled,
      start: parsed?.start || "22:00",
      end: parsed?.end || "08:00",
    };
  } catch {
    return {
      enabled: false,
      start: "22:00",
      end: "08:00",
    };
  }
}

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

  const mainUser = participants[0] || null;

  const [mutedRooms, setMutedRooms] = useState<number[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState("22:00");
  const [dndEnd, setDndEnd] = useState("08:00");

  useEffect(() => {
    setMutedRooms(readMutedRooms());
    setSoundEnabled(readSoundEnabled());

    const dnd = readDnd();
    setDndEnabled(!!dnd.enabled);
    setDndStart(dnd.start);
    setDndEnd(dnd.end);
  }, [open]);

  const roomMuted = activeRoom?.id
    ? mutedRooms.includes(Number(activeRoom.id))
    : false;

  const syncSettings = () => {
    window.dispatchEvent(new Event("messenger:settings-changed"));
  };

  const toggleRoomMute = () => {
    if (!activeRoom?.id) return;

    const roomId = Number(activeRoom.id);
    const next = roomMuted
      ? mutedRooms.filter((id) => id !== roomId)
      : [roomId, ...mutedRooms];

    setMutedRooms(next);
    localStorage.setItem(ROOM_MUTE_KEY, JSON.stringify(next));
    syncSettings();
  };

  const toggleGlobalSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_ENABLED_KEY, String(next));
    syncSettings();
  };

  const saveDnd = (enabled: boolean, start: string, end: string) => {
    localStorage.setItem(
      DND_KEY,
      JSON.stringify({
        enabled,
        start,
        end,
      })
    );
    syncSettings();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[10030] flex w-[360px] flex-col border-l border-slate-300 bg-[#f5f7fa] shadow-[-8px_0_24px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between border-b border-slate-300 bg-white px-4 py-4">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-slate-900">
            채팅방 설정
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-700 transition hover:bg-slate-100"
          aria-label="채팅방 설정 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-slate-300 bg-white px-6 py-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] bg-slate-100 text-2xl font-semibold text-slate-700">
              {mainUser?.avatar ? (
                <img
  src={normalizeAssetUrl(mainUser.avatar)}
  alt={mainUser.name}
  className="h-full w-full object-cover"
/>
              ) : (
                <span>{mainUser?.name?.slice(0, 1) || activeRoom?.name?.slice(0, 1) || "?"}</span>
              )}
            </div>

            <div className="mt-5 w-full">
              <div className="truncate text-lg font-semibold text-slate-900">
                {mainUser?.name || activeRoom?.name || "채팅방"}
              </div>

              <div className="mt-1 text-sm text-slate-500">
                {mainUser?.position || "-"}
                {mainUser?.team ? ` · ${mainUser.team}` : ""}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8 px-4 py-5">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">알림 설정</h3>

            <div className="space-y-3">
              <button
                type="button"
                onClick={toggleRoomMute}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-4 text-left transition hover:bg-slate-50"
              >
                <div className="flex items-start gap-3">
                  <Bell className="mt-0.5 h-4 w-4 text-slate-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      이 방 알림
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {roomMuted ? "현재 음소거됨" : "현재 알림 켜짐"}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  {roomMuted ? "꺼짐" : "켜짐"}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleGlobalSound}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-4 text-left transition hover:bg-slate-50"
              >
                <div className="flex items-start gap-3">
                  <Volume2 className="mt-0.5 h-4 w-4 text-slate-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      전체 소리 알림
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      새 메시지 효과음을 제어합니다.
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  {soundEnabled ? "켜짐" : "꺼짐"}
                </span>
              </button>

              <div className="rounded-2xl border border-slate-300 bg-white px-4 py-4">
                <div className="flex items-start gap-3">
                  <Moon className="mt-0.5 h-4 w-4 text-slate-600" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">
                        방해금지 시간
                      </p>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={dndEnabled}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setDndEnabled(next);
                            saveDnd(next, dndStart, dndEnd);
                          }}
                        />
                        사용
                      </label>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="time"
                        value={dndStart}
                        onChange={(e) => {
                          const next = e.target.value;
                          setDndStart(next);
                          saveDnd(dndEnabled, next, dndEnd);
                        }}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                      <span className="text-sm text-slate-500">~</span>
                      <input
                        type="time"
                        value={dndEnd}
                        onChange={(e) => {
                          const next = e.target.value;
                          setDndEnd(next);
                          saveDnd(dndEnabled, dndStart, next);
                        }}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">사진</h3>

            {imageMessages.length === 0 ? (
              <div className="rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                사진 없음
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {imageMessages.slice(-12).map((img) => (
                  <div
                    key={img.id}
                    className="overflow-hidden rounded-2xl border border-slate-300 bg-white"
                  >
                    <img
  src={normalizeAssetUrl(img.fileUrl)}
  alt={img.fileName || "image"}
  className="h-24 w-full object-cover"
/>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">첨부파일</h3>

            {fileMessages.length === 0 ? (
              <div className="rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                파일 없음
              </div>
            ) : (
              <div className="space-y-2">
                {fileMessages.slice(-10).map((file) => (
                  <a
                    key={file.id}
                    href={normalizeAssetUrl(file.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    {file.fileName || "파일"}
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-300 bg-white p-4">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 rounded-2xl"
          onClick={onToggleNotifications}
        >
          <Bell className="h-4 w-4" />
          알림 설정
        </Button>
      </div>
    </div>
  );
}