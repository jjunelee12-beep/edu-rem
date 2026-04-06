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

  useEffect(() => {
    if (!("Notification" in window)) {
      console.log(
        "[MessengerRealtimeBridge] Browser Notification API not supported"
      );
      return;
    }

    console.log(
      "[MessengerRealtimeBridge] Notification permission:",
      Notification.permission
    );

    if (Notification.permission !== "default") return;

    const timer = setTimeout(() => {
      console.log(
        "[MessengerRealtimeBridge] Requesting notification permission"
      );
      Notification.requestPermission().catch(() => {});
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    audioRef.current = new Audio("/sounds/message.mp3");
    audioRef.current.preload = "auto";
    console.log(
      "[MessengerRealtimeBridge] Audio initialized: /sounds/message.mp3"
    );

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      console.log("[MessengerRealtimeBridge] Audio cleaned up");
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const nextMuted = readMutedRooms();
      const nextSound = readSoundEnabled();
      const nextAppSettings = readAppNotificationSettings();

      setMutedRoomIds(nextMuted);
      setSoundEnabled(nextSound);
      setAppSettings(nextAppSettings);

      console.log("[MessengerRealtimeBridge] sync settings", {
        mutedRoomIds: nextMuted,
        soundEnabled: nextSound,
        appSettings: nextAppSettings,
      });
    };

    sync();

    window.addEventListener("messenger:settings-changed", sync);
    window.addEventListener("app:notification-settings-changed", sync);

    return () => {
      window.removeEventListener("messenger:settings-changed", sync);
      window.removeEventListener("app:notification-settings-changed", sync);
    };
  }, []);

  useEffect(() => {
    const handleOpened = (event: Event) => {
      const custom = event as CustomEvent;
      const roomIds = Array.isArray(custom.detail?.roomIds)
        ? custom.detail.roomIds.map(Number).filter(Boolean)
        : [];

      setOpenRoomIds(roomIds);
      console.log("[MessengerRealtimeBridge] opened rooms changed", roomIds);
    };

    const handleMain = (event: Event) => {
      const custom = event as CustomEvent;
      const isOpen = !!custom.detail?.isOpen;
      setIsMessengerMainOpen(isOpen);
      console.log(
        "[MessengerRealtimeBridge] main messenger open changed",
        isOpen
      );
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
    let liveSocket: any = null;

    const handleNewMessage = (payload: any) => {
      const roomId = Number(payload?.roomId || 0);
      const senderId = Number(payload?.senderId || 0);
      const messageId = Number(payload?.id || payload?.messageId || 0);

      console.log("[MessengerRealtimeBridge] message:new received", {
        payload,
        roomId,
        senderId,
        messageId,
      });

      if (!roomId || !senderId) {
        console.log(
          "[MessengerRealtimeBridge] blocked: invalid roomId or senderId",
          {
            roomId,
            senderId,
          }
        );
        return;
      }

      const messageKey = `${
        roomId
      }:${messageId || payload?.createdAt || `no-createdAt-${Date.now()}`}`;

      if (shownMessageKeysRef.current.has(messageKey)) {
        console.log(
          "[MessengerRealtimeBridge] blocked: duplicate messageKey",
          messageKey
        );
        return;
      }

      shownMessageKeysRef.current.add(messageKey);

      console.log("[MessengerRealtimeBridge] check conditions", {
        roomId,
        senderId,
        messageKey,
        mutedRoomIds,
        openRoomIds,
        isMessengerMainOpen,
        soundEnabled,
        appSettings,
        documentHasFocus: document.hasFocus(),
        localMessengerOpen: localStorage.getItem("messenger-open"),
      });

      if (!appSettings.enabled) {
        console.log(
          "[MessengerRealtimeBridge] blocked: appSettings.enabled = false"
        );
        return;
      }

      if (!appSettings.messenger) {
        console.log(
          "[MessengerRealtimeBridge] blocked: appSettings.messenger = false"
        );
        return;
      }

      if (mutedRoomIds.includes(roomId)) {
        console.log("[MessengerRealtimeBridge] blocked: room muted", {
          roomId,
          mutedRoomIds,
        });
        return;
      }

      if (
        appSettings.dndEnabled &&
        isNowInDndRange(appSettings.dndStart, appSettings.dndEnd)
      ) {
        console.log("[MessengerRealtimeBridge] blocked: app DND active", {
          dndStart: appSettings.dndStart,
          dndEnd: appSettings.dndEnd,
        });
        return;
      }

      const sender = usersById.get(senderId);

      const senderName = sender?.name || "이름없음";
      const senderPosition =
        sender?.positionName ||
        sender?.position ||
        roleToPosition(sender?.role);

      const content = normalizeMessageContent(payload);

      const senderAvatar = normalizeAssetUrl(
        sender?.avatarUrl || sender?.profileImageUrl || sender?.avatar || ""
      );

      console.log("[MessengerRealtimeBridge] toast data prepared", {
        sender,
        senderName,
        senderPosition,
        content,
        senderAvatar,
      });

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

      console.log("[MessengerRealtimeBridge] pushAppToast fired", toast);

      const isFocused = document.hasFocus();

      if (soundEnabled && appSettings.sound && !isFocused) {
        console.log("[MessengerRealtimeBridge] playing sound");
        playMessageSound(audioRef);
      } else {
        console.log("[MessengerRealtimeBridge] sound skipped", {
          soundEnabled,
          appSoundEnabled: appSettings.sound,
          isFocused,
        });
      }

      if ("Notification" in window && Notification.permission === "granted") {
        const old = notificationMapRef.current.get(roomId);
        if (old) {
          console.log(
            "[MessengerRealtimeBridge] closing previous browser notification",
            {
              roomId,
            }
          );
          old.close();
        }

        const noti = new Notification(senderName, {
          body: content,
          icon: senderAvatar || undefined,
          silent: !(soundEnabled && appSettings.sound),
        });

        console.log("[MessengerRealtimeBridge] browser notification created", {
          roomId,
          senderName,
          content,
        });

        noti.onclick = () => {
          console.log(
            "[MessengerRealtimeBridge] browser notification clicked",
            {
              roomId,
            }
          );

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
          console.log(
            "[MessengerRealtimeBridge] browser notification auto closed",
            {
              roomId,
            }
          );
        }, 5000);
      } else {
        console.log("[MessengerRealtimeBridge] browser notification skipped", {
          supported: "Notification" in window,
          permission:
            "Notification" in window ? Notification.permission : "unsupported",
        });
      }
    };

    (async () => {
      try {
        const socket = await getSocket();
        liveSocket = socket;
        socketRef.current = socket;

        console.log("[MessengerRealtimeBridge] socket connected", socket);

        socket.on("message:new", handleNewMessage);
        console.log(
          "[MessengerRealtimeBridge] socket listener attached: message:new"
        );
      } catch (error) {
        console.error("[MessengerRealtimeBridge] socket init failed", error);
      }
    })();

    return () => {
      if (!liveSocket) return;
      liveSocket.off("message:new", handleNewMessage);
      console.log(
        "[MessengerRealtimeBridge] socket listener removed: message:new"
      );
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