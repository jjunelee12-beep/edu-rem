import { useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { trpc } from "@/lib/trpc";

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
  const messageType = payload?.messageType || "text";

  if (messageType === "image") {
    return "사진을 보냈습니다.";
  }

  if (messageType === "file") {
    return payload?.fileName ? `${payload.fileName}` : "파일을 보냈습니다.";
  }

  return payload?.content || "";
}

export default function MessengerToastHost() {
  const socketRef = useRef<any>(null);
  const notificationMapRef = useRef<Map<number, Notification>>(new Map());

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [openRoomIds, setOpenRoomIds] = useState<number[]>([]);
  const [isMessengerMainOpen, setIsMessengerMainOpen] = useState(false);

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
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    const timer = window.setTimeout(() => {
      Notification.requestPermission().catch(() => {});
    }, 1200);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleOpenedRoomsChanged = (event: Event) => {
      const custom = event as CustomEvent;
      const ids = Array.isArray(custom.detail?.roomIds)
        ? custom.detail.roomIds.map((v: any) => Number(v)).filter(Boolean)
        : [];
      setOpenRoomIds(ids);
    };

    const handleMessengerOpenChanged = (event: Event) => {
      const custom = event as CustomEvent;
      setIsMessengerMainOpen(!!custom.detail?.isOpen);
    };

    window.addEventListener(
      "messenger:opened-rooms-changed",
      handleOpenedRoomsChanged as EventListener
    );
    window.addEventListener(
      "messenger:main-open-changed",
      handleMessengerOpenChanged as EventListener
    );

    return () => {
      window.removeEventListener(
        "messenger:opened-rooms-changed",
        handleOpenedRoomsChanged as EventListener
      );
      window.removeEventListener(
        "messenger:main-open-changed",
        handleMessengerOpenChanged as EventListener
      );
    };
  }, []);

  useEffect(() => {
    const roomIdsSet = new Set(openRoomIds);

    setToasts((prev) => prev.filter((item) => !roomIdsSet.has(Number(item.roomId))));

    openRoomIds.forEach((roomId) => {
      const existing = notificationMapRef.current.get(Number(roomId));
      if (existing) {
        existing.close();
        notificationMapRef.current.delete(Number(roomId));
      }
    });
  }, [openRoomIds]);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const handleNewMessage = (payload: any) => {
      const roomId = Number(payload?.roomId || 0);
      const senderId = Number(payload?.senderId || 0);
      if (!roomId || !senderId) return;

      const sender = usersById.get(senderId);
      const content = normalizeMessageContent(payload);

      const alreadyOpen = openRoomIds.includes(roomId);
      if (alreadyOpen) return;

      const nextBase = {
        roomId,
        senderId,
        senderName: sender?.name || sender?.username || "이름없음",
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
        const existing = prev.find((item) => Number(item.roomId) === roomId);

        if (existing) {
          return prev.map((item) =>
            Number(item.roomId) === roomId
              ? {
                  ...item,
                  content,
                  createdAt: Date.now(),
                  unreadCount: Number(item.unreadCount || 1) + 1,
                }
              : item
          );
        }

        return [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            ...nextBase,
            unreadCount: 1,
          },
        ];
      });

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          const oldNoti = notificationMapRef.current.get(roomId);
          if (oldNoti) {
            oldNoti.close();
            notificationMapRef.current.delete(roomId);
          }

          const systemNotification = new Notification(nextBase.senderName, {
            body: content,
            icon: nextBase.senderAvatar || undefined,
            tag: `messenger-room-${roomId}`,
            silent: false,
          });

          systemNotification.onclick = () => {
            window.focus();
            window.dispatchEvent(new Event("open-messenger"));
            window.dispatchEvent(
              new CustomEvent("messenger:open-room", {
                detail: { roomId },
              })
            );
            systemNotification.close();
            notificationMapRef.current.delete(roomId);
          };

          notificationMapRef.current.set(roomId, systemNotification);

          window.setTimeout(() => {
            systemNotification.close();
            notificationMapRef.current.delete(roomId);
          }, 5000);
        }
      }
    };

    socket.on("message:new", handleNewMessage);

    return () => {
      socket.off("message:new", handleNewMessage);

      notificationMapRef.current.forEach((noti) => {
        noti.close();
      });
      notificationMapRef.current.clear();
    };
  }, [usersById, openRoomIds, isMessengerMainOpen]);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, 5000)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  const handleClickToast = (toast: ToastItem) => {
    window.dispatchEvent(new Event("open-messenger"));
    window.dispatchEvent(
      new CustomEvent("messenger:open-room", {
        detail: {
          roomId: toast.roomId,
        },
      })
    );

    const existing = notificationMapRef.current.get(Number(toast.roomId));
    if (existing) {
      existing.close();
      notificationMapRef.current.delete(Number(toast.roomId));
    }

    setToasts((prev) => prev.filter((item) => item.id !== toast.id));
  };

  const handleCloseToast = (toast: ToastItem) => {
    const existing = notificationMapRef.current.get(Number(toast.roomId));
    if (existing) {
      existing.close();
      notificationMapRef.current.delete(Number(toast.roomId));
    }

    setToasts((prev) => prev.filter((item) => item.id !== toast.id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[10050] flex w-[320px] flex-col gap-3">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => handleClickToast(toast)}
          className="pointer-events-auto w-full rounded-2xl border border-slate-300 bg-white p-4 text-left shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition hover:bg-slate-50"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
              {toast.senderAvatar ? (
                <img
                  src={toast.senderAvatar}
                  alt={toast.senderName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{toast.senderName?.slice(0, 1)}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {toast.senderName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {toast.senderPosition}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {toast.unreadCount > 1 ? (
                    <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {toast.unreadCount}
                    </span>
                  ) : null}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseToast(toast);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <p className="mt-2 line-clamp-2 text-sm text-slate-700">
                {toast.content}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}