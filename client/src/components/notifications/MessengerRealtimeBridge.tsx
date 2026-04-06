import { useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { trpc } from "@/lib/trpc";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";
import { pushAppToast } from "@/lib/appNotifications";
import {
  readAppNotificationSettings,
  isNowInDndRange,
} from "@/lib/notificationSettings";

const ROOM_MUTE_KEY = "messenger-muted-room-ids";
const SOUND_ENABLED_KEY = "messenger-sound-enabled";

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

function roleToPosition(role?: string) {
  if (role === "superhost") return "슈퍼호스트";
  if (role === "host") return "호스트";
  if (role === "admin") return "관리자";
  return "직원";
}

function normalizeMessageContent(payload: any) {
  const type = payload?.messageType || "text";

  if (type === "image") return "사진을 보냈습니다.";
  if (type === "file") return payload?.fileName || "파일을 보냈습니다.";

  return payload?.content || "(내용 없음)";
}

function playMessageSound(
  audioRef: React.MutableRefObject<HTMLAudioElement | null>
) {
  const audio = audioRef.current;
  if (!audio) return;

  try {
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {}
}

export default function MessengerRealtimeBridge() {
  const socketRef = useRef<any>(null);
  const shownMessageKeysRef = useRef<Set<string>>(new Set());
  const notificationMapRef = useRef<Map<number, Notification>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [openRoomIds, setOpenRoomIds] = useState<number[]>([]);
  const [isMessengerMainOpen, setIsMessengerMainOpen] = useState(false);
  const [mutedRoomIds, setMutedRoomIds] = useState<number[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [appSettings, setAppSettings] = useState(() =>
    readAppNotificationSettings()
  );

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

  /* ------------------ 브라우저 알림 권한 ------------------ */
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    const timer = setTimeout(() => {
      Notification.requestPermission().catch(() => {});
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  /* ------------------ 사운드 ------------------ */
  useEffect(() => {
    audioRef.current = new Audio("/sounds/message.mp3");
    audioRef.current.preload = "auto";

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  /* ------------------ 설정 sync ------------------ */
  useEffect(() => {
    const sync = () => {
      setMutedRoomIds(readMutedRooms());
      setSoundEnabled(readSoundEnabled());
      setAppSettings(readAppNotificationSettings());
    };

    sync();

    window.addEventListener("messenger:settings-changed", sync);
    window.addEventListener("app:notification-settings-changed", sync);

    return () => {
      window.removeEventListener("messenger:settings-changed", sync);
      window.removeEventListener("app:notification-settings-changed", sync);
    };
  }, []);

  /* ------------------ 열린 방 / 메인 상태 ------------------ */
  useEffect(() => {
    const handleOpened = (event: Event) => {
      const custom = event as CustomEvent;
      const roomIds = Array.isArray(custom.detail?.roomIds)
        ? custom.detail.roomIds.map(Number).filter(Boolean)
        : [];

      setOpenRoomIds(roomIds);
    };

    const handleMain = (event: Event) => {
      const custom = event as CustomEvent;
      setIsMessengerMainOpen(!!custom.detail?.isOpen);
    };

    window.addEventListener(
      "messenger:opened-rooms-changed",
      handleOpened as EventListener
    );

    window.addEventListener(
      "messenger:main-open-changed",
      handleMain as EventListener
    );

    return () => {
      window.removeEventListener(
        "messenger:opened-rooms-changed",
        handleOpened as EventListener
      );

      window.removeEventListener(
        "messenger:main-open-changed",
        handleMain as EventListener
      );
    };
  }, []);

  /* ------------------ 메시지 수신 ------------------ */
  useEffect(() => {
    let liveSocket: any = null;

    const handleNewMessage = (payload: any) => {
      const roomId = Number(payload?.roomId || 0);
      const senderId = Number(payload?.senderId || 0);
      const messageId = Number(payload?.id || payload?.messageId || 0);

      if (!roomId || !senderId) return;

      const messageKey = `${roomId}:${messageId || payload?.createdAt}`;
      if (shownMessageKeysRef.current.has(messageKey)) return;
      shownMessageKeysRef.current.add(messageKey);

      /* ------------------ 알림 차단 조건 ------------------ */

      if (!appSettings.enabled) return;
      if (!appSettings.messenger) return;

      if (mutedRoomIds.includes(roomId)) return;

      if (openRoomIds.includes(roomId)) return;
      if (isMessengerMainOpen) return;

      if (
        appSettings.dndEnabled &&
        isNowInDndRange(appSettings.dndStart, appSettings.dndEnd)
      ) {
        return;
      }

      /* ------------------ 데이터 가공 ------------------ */

      const sender = usersById.get(senderId);

      const senderName = sender?.name || "이름없음";
      const content = normalizeMessageContent(payload);

      const senderAvatar = normalizeAssetUrl(
        sender?.avatarUrl ||
          sender?.profileImageUrl ||
          sender?.avatar ||
          ""
      );

      /* ------------------ 토스트 ------------------ */

      pushAppToast({
        category: "messenger",
        level: "normal",
        title: senderName,
        body: content,
        imageUrl: senderAvatar || undefined,
        durationMs: 6000,
        action: {
          kind: "messenger-room",
          payload: { roomId },
        },
      });

      /* ------------------ 사운드 ------------------ */

      const isFocused = document.hasFocus();

      if (soundEnabled && appSettings.sound && !isFocused) {
        playMessageSound(audioRef);
      }

      /* ------------------ 브라우저 알림 ------------------ */

      if ("Notification" in window && Notification.permission === "granted") {
        const old = notificationMapRef.current.get(roomId);
        if (old) old.close();

        const noti = new Notification(senderName, {
          body: content,
          icon: senderAvatar || undefined,
          silent: !(soundEnabled && appSettings.sound),
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

    (async () => {
      const socket = await getSocket();
      liveSocket = socket;
      socketRef.current = socket;

      socket.on("message:new", handleNewMessage);
    })();

    return () => {
      if (!liveSocket) return;
      liveSocket.off("message:new", handleNewMessage);
    };
  }, [
    usersById,
    openRoomIds,
    mutedRoomIds,
    soundEnabled,
    isMessengerMainOpen,
    appSettings,
  ]);

  return null;
}