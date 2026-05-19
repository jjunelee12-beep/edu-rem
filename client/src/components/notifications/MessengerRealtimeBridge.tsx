import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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

function readOpenedRoomIdsFromStorage(): number[] {
  try {
    const raw = localStorage.getItem("messenger-opened-room-ids");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => Number(v)).filter(Boolean);
  } catch {
    return [];
  }
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
  if (type === "system") return payload?.content || "시스템 메시지";

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
  const { user } = useAuth();

  const socketRef = useRef<any>(null);
  const shownMessageKeysRef = useRef<Set<string>>(new Set());
  const notificationMapRef = useRef<Map<number, Notification>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [openRoomIds, setOpenRoomIds] = useState<number[]>(() =>
    readOpenedRoomIdsFromStorage()
  );
  const [isMessengerMainOpen, setIsMessengerMainOpen] = useState(false);
  const [mutedRoomIds, setMutedRoomIds] = useState<number[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [appSettings, setAppSettings] = useState(() =>
    readAppNotificationSettings()
  );

  const { data: me } = trpc.users.me.useQuery(undefined, {
  staleTime: 30_000,
  enabled: !!user,
});

  const myUserId = Number((user as any)?.id || (me as any)?.id || 0);

  const { data: userList = [] } = trpc.users.list.useQuery(undefined, {
  staleTime: 30_000,
  enabled: !!user, 
});

  const usersById = useMemo(() => {
    const map = new Map<number, any>();
    (userList as any[]).forEach((u: any) => {
      map.set(Number(u.id), u);
    });
    return map;
  }, [userList]);

  useEffect(() => {
    if (!("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "default") return;

    const timer = setTimeout(() => {
      Notification.requestPermission().catch(() => {});
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    audioRef.current = new Audio("/sounds/message.mp3");
    audioRef.current.preload = "auto";

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const nextMuted = readMutedRooms();
      const nextSound = readSoundEnabled();
      const nextAppSettings = readAppNotificationSettings();
      const nextOpenedRoomIds = readOpenedRoomIdsFromStorage();

      setMutedRoomIds(nextMuted);
      setSoundEnabled(nextSound);
      setAppSettings(nextAppSettings);
      setOpenRoomIds(nextOpenedRoomIds);
    };

    sync();

    window.addEventListener("messenger:settings-changed", sync);
    window.addEventListener("app:notification-settings-changed", sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("messenger:settings-changed", sync);
      window.removeEventListener("app:notification-settings-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

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
      const isOpen = !!custom.detail?.isOpen;
      setIsMessengerMainOpen(isOpen);
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

  useEffect(() => {
    const timer = setInterval(() => {
      if (shownMessageKeysRef.current.size > 300) {
        const recent = Array.from(shownMessageKeysRef.current).slice(-150);
        shownMessageKeysRef.current = new Set(recent);
      }
    }, 60_000);

    return () => clearInterval(timer);
  }, []);

 useEffect(() => {
  if (!(user as any)?.id) {
    return;
  }

  let liveSocket: any = null;
    const handleNewMessage = (payload: any) => {
      const roomId = Number(payload?.roomId || 0);
      const senderId = Number(payload?.senderId || 0);
      const messageId = Number(payload?.id || payload?.messageId || 0);
      const createdAtKey = payload?.createdAt || payload?.created_at || "";
      const messageType = String(payload?.messageType || "text");
      if (!roomId || !senderId) {

        return;
      }

      if (myUserId > 0 && senderId === myUserId) {
       
        return;
      }

      const messageKey = `${roomId}:${
        messageId || createdAtKey || `${senderId}:${messageType}:${payload?.content || ""}`
      }`;

      if (shownMessageKeysRef.current.has(messageKey)) {
        
        return;
      }

      const latestOpenedRoomIds =
        openRoomIds.length > 0 ? openRoomIds : readOpenedRoomIdsFromStorage();

      const roomIsOpen = latestOpenedRoomIds.includes(roomId);


      if (!appSettings.enabled) {
        
        return;
      }

      if (!appSettings.messenger) {
        
        return;
      }

      if (mutedRoomIds.includes(roomId)) {
        
        return;
      }

      if (roomIsOpen) {
        
        return;
      }

      if (
        appSettings.dndEnabled &&
        isNowInDndRange(appSettings.dndStart, appSettings.dndEnd)
      ) {
       
        return;
      }

      shownMessageKeysRef.current.add(messageKey);

      const sender = usersById.get(senderId);

      const senderName =
        sender?.name ||
        payload?.senderName ||
        payload?.senderUsername ||
        "이름없음";

      const senderPosition =
        sender?.positionName ||
        sender?.position ||
        payload?.senderPositionName ||
        roleToPosition(sender?.role);

      const content = normalizeMessageContent(payload);

      const senderAvatar = normalizeAssetUrl(
        sender?.avatarUrl ||
          sender?.profileImageUrl ||
          sender?.avatar ||
          payload?.senderProfileImageUrl ||
          payload?.senderAvatarUrl ||
          ""
      );


      const toast = pushAppToast({
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

      const isFocused = document.hasFocus();

      if (soundEnabled && appSettings.sound && !isFocused) {
    
        playMessageSound(audioRef);
      } 

      if ("Notification" in window && Notification.permission === "granted") {
        const old = notificationMapRef.current.get(roomId);
        if (old) {
          
          old.close();
        }

        const noti = new Notification(senderName, {
          body: senderPosition ? `${content}` : content,
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
      try {
        const socket = await getSocket();
        liveSocket = socket;
        socketRef.current = socket;

        socket.off("message:new", handleNewMessage);
        socket.on("message:new", handleNewMessage);

      } catch (error) {
        console.error("[MessengerRealtimeBridge] socket init failed", error);
      }
    })();

    return () => {
      if (!liveSocket) return;
      liveSocket.off("message:new", handleNewMessage);

    };
  }, [
     user,
  usersById,
  myUserId,
  openRoomIds,
  mutedRoomIds,
  soundEnabled,
  isMessengerMainOpen,
  appSettings,
  ]);

  return null;
}