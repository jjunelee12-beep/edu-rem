import { useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { trpc } from "@/lib/trpc";

const ROOM_MUTE_KEY = "messenger-muted-room-ids";
const SOUND_ENABLED_KEY = "messenger-sound-enabled";
const DND_KEY = "messenger-dnd-range";

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
      return { enabled: false, start: "22:00", end: "08:00" };
    }
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed?.enabled,
      start: parsed?.start || "22:00",
      end: parsed?.end || "08:00",
    };
  } catch {
    return { enabled: false, start: "22:00", end: "08:00" };
  }
}

function isNowInDndRange(start: string, end: string) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const current = `${hh}:${mm}`;

  if (start === end) return true;
  if (start < end) return current >= start && current <= end;
  return current >= start || current <= end;
}

type ToastItem = {
  id: string;
  roomId: number;
  senderId: number;
  senderName: string;
  senderPosition: string;
  senderAvatar?: string;
  content: string;
  createdAt: number;
  unreadCount: number;
};

function roleToPosition(role?: string) {
  if (role === "superhost") return "슈퍼호스트";
  if (role === "host") return "호스트";
  if (role === "admin") return "관리자";
  return "직원";
}

function normalizeMessageContent(payload: any) {
  const type = payload?.messageType || "text";

  if (type === "image") return "사진을 보냈습니다.";
  if (type === "file") {
    return payload?.fileName || "파일을 보냈습니다.";
  }

  return payload?.content || "(내용 없음)";
}

function playMessageSound(audioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  const audio = audioRef.current;
  if (!audio) return;

  try {
    audio.currentTime = 0;
    void audio.play();
  } catch {
    // 브라우저 정책으로 재생이 막힐 수 있으니 무시
  }
}

export default function MessengerToastHost() {
  const socketRef = useRef<any>(null);
  const notificationMapRef = useRef<Map<number, Notification>>(new Map());
	const audioRef = useRef<HTMLAudioElement | null>(null);


  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [openRoomIds, setOpenRoomIds] = useState<number[]>([]);
  const [isMessengerMainOpen, setIsMessengerMainOpen] = useState(false);

  const [mutedRoomIds, setMutedRoomIds] = useState<number[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dnd, setDnd] = useState({
    enabled: false,
    start: "22:00",
    end: "08:00",
  });

  const { data: userList = [] } = trpc.users.list.useQuery(undefined, {
    staleTime: 30_000,
  });

  const usersById = useMemo(() => {
    const map = new Map<number, any>();
    (userList as any[]).forEach((u: any) => {
      map.set(Number(u.id), u);
    });
    return map;
  }, [userList]);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    setTimeout(() => {
      Notification.requestPermission().catch(() => {});
    }, 1000);
  }, []);

useEffect(() => {
  audioRef.current = new Audio("/sounds/message.mp3");
  audioRef.current.preload = "auto";

  return () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };
}, []);

  useEffect(() => {
    const sync = () => {
      setMutedRoomIds(readMutedRooms());
      setSoundEnabled(readSoundEnabled());
      setDnd(readDnd());
    };

    sync();
    window.addEventListener("messenger:settings-changed", sync);

    return () =>
      window.removeEventListener("messenger:settings-changed", sync);
  }, []);

  useEffect(() => {
    const handleOpened = (e: any) => {
      setOpenRoomIds(e.detail?.roomIds || []);
    };

    const handleMain = (e: any) => {
      setIsMessengerMainOpen(!!e.detail?.isOpen);
    };

    window.addEventListener("messenger:opened-rooms-changed", handleOpened);
    window.addEventListener("messenger:main-open-changed", handleMain);

    return () => {
      window.removeEventListener("messenger:opened-rooms-changed", handleOpened);
      window.removeEventListener("messenger:main-open-changed", handleMain);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (payload: any) => {
      const roomId = Number(payload?.roomId || 0);
      const senderId = Number(payload?.senderId || 0);
      if (!roomId || !senderId) return;

      // 🔥 핵심 순서
      if (mutedRoomIds.includes(roomId)) return;

      if (dnd.enabled && isNowInDndRange(dnd.start, dnd.end)) return;

      if (openRoomIds.includes(roomId)) return;
	if (isMessengerMainOpen) return;

      const sender = usersById.get(senderId);
      const content = normalizeMessageContent(payload);

      const base = {
        roomId,
        senderId,
        senderName: sender?.name || "이름없음",
        senderPosition:
          sender?.positionName ||
          sender?.position ||
          roleToPosition(sender?.role),
        senderAvatar:
          sender?.avatarUrl ||
          sender?.profileImageUrl ||
          sender?.avatar ||
          "",
        content,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        const existing = prev.find((t) => t.roomId === roomId);

        if (existing) {
          return prev.map((t) =>
            t.roomId === roomId
              ? { ...t, content, unreadCount: t.unreadCount + 1 }
              : t
          );
        }

        return [
          ...prev,
          {
            id: `${Date.now()}`,
            ...base,
            unreadCount: 1,
          },
        ];
      });

const isWindowFocused = document.hasFocus();

if (soundEnabled && !isWindowFocused) {
  playMessageSound(audioRef);
}

      if (Notification.permission === "granted") {
        const old = notificationMapRef.current.get(roomId);
        if (old) old.close();

        const noti = new Notification(base.senderName, {
          body: content,
          icon: base.senderAvatar || undefined,
          silent: !soundEnabled,
        });

        noti.onclick = () => {
          window.focus();
          window.dispatchEvent(new Event("open-messenger"));
          window.dispatchEvent(
            new CustomEvent("messenger:open-room", {
              detail: { roomId },
            })
          );
        };

        notificationMapRef.current.set(roomId, noti);

        setTimeout(() => {
          noti.close();
          notificationMapRef.current.delete(roomId);
        }, 5000);
      }
    };

    socket.on("message:new", handleNewMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [usersById, openRoomIds, mutedRoomIds, soundEnabled, dnd]);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[10050] flex w-[320px] flex-col gap-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-2xl border bg-white p-4 shadow-lg"
        >
          <div className="text-sm font-semibold">{t.senderName}</div>
          <div className="text-xs text-gray-500">{t.senderPosition}</div>
          <div className="mt-2 text-sm">{t.content}</div>
        </div>
      ))}
    </div>
  );
}