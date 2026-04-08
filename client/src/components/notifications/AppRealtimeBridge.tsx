import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { pushAppToast } from "@/lib/appNotifications";
import {
  readAppNotificationSettings,
  isNowInDndRange,
} from "@/lib/notificationSettings";

type LiveNotificationPayload = {
  id: number;
  userId: number;
  type?: string | null;
  title?: string | null;
  level?: "normal" | "important" | "urgent" | "success" | "danger" | null;
  message: string;
  imageUrl?: string | null;
  relatedId?: number | null;
  isRead?: boolean;
  createdAt?: string;
};

function mapNotificationAction(type?: string | null, relatedId?: number | null) {
  const id = Number(relatedId || 0);

  if (type === "approval" && id > 0) {
    return {
      kind: "approval-detail" as const,
      payload: { approvalId: id },
    };
  }

  if (type === "notice" && id > 0) {
    return {
      kind: "notice-detail" as const,
      payload: { noticeId: id },
    };
  }

  if (type === "schedule" && id > 0) {
    return {
      kind: "schedule-detail" as const,
      payload: { scheduleId: id },
    };
  }

  if (type === "payment" || type === "refund" || type === "attendance") {
    return {
      kind: "route" as const,
      payload: { path: "/notifications" },
    };
  }

  return {
    kind: "route" as const,
    payload: { path: "/notifications" },
  };
}

function mapCategory(type?: string | null) {
  if (type === "approval") return "approval";
  if (type === "notice") return "notice";
  if (type === "schedule") return "schedule";
  if (type === "attendance") return "attendance";
  if (type === "payment") return "payment";
  if (type === "refund") return "refund";
  return "system";
}

export default function AppRealtimeBridge() {
  const shownIdsRef = useRef<Set<number>>(new Set());

useEffect(() => {
  const timer = setInterval(() => {
    if (shownIdsRef.current.size > 300) {
      const recent = Array.from(shownIdsRef.current).slice(-150);
      shownIdsRef.current = new Set(recent);
    }
  }, 60_000);

  return () => clearInterval(timer);
}, []);

  useEffect(() => {
    let liveSocket: any = null;

    const handleLiveNotification = (payload: LiveNotificationPayload) => {
      const notificationId = Number(payload?.id || 0);
      if (!notificationId) return;

      if (shownIdsRef.current.has(notificationId)) {
        return;
      }

      const appSettings = readAppNotificationSettings();

      if (!appSettings.enabled) return;

      if (
        appSettings.dndEnabled &&
        isNowInDndRange(appSettings.dndStart, appSettings.dndEnd)
      ) {
        return;
      }

      shownIdsRef.current.add(notificationId);

      const type = String(payload?.type || "system");
      const title = String(payload?.title || "알림");
      const body = String(payload?.message || "");
      const level = payload?.level || "normal";

      pushAppToast({
        category: mapCategory(type) as any,
        level,
        title,
        body,
        imageUrl: payload?.imageUrl || undefined,
        durationMs: 6000,
        action: mapNotificationAction(type, payload?.relatedId),
      });
    };

    (async () => {
      try {
        const socket = await getSocket();
        liveSocket = socket;

        socket.off("notification:new", handleLiveNotification);
        socket.on("notification:new", handleLiveNotification);
      } catch (error) {
        console.error("[AppRealtimeBridge] socket init failed", error);
      }
    })();

    return () => {
      if (!liveSocket) return;
      liveSocket.off("notification:new", handleLiveNotification);
    };
  }, []);

  return null;
}