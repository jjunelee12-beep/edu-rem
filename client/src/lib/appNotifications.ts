import type {
  AppNotification,
  AppNotificationClickEventDetail,
  AppToastEventDetail,
} from "@/types/notification";

export const APP_TOAST_EVENT = "app:toast";
export const APP_TOAST_REMOVE_EVENT = "app:toast-remove";
export const APP_NOTIFICATION_CLICK_EVENT = "app:notification-click";

function makeNotificationId() {
  return `app-notification-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createAppNotification(
  input: Omit<AppNotification, "id" | "createdAt">
): AppNotification {
  return {
    id: makeNotificationId(),
    createdAt: new Date().toISOString(),
    read: false,
    level: "normal",
    durationMs: 5000,
    ...input,
  };
}

export function pushAppToast(input: Omit<AppNotification, "id" | "createdAt">) {
  const notification = createAppNotification(input);

  window.dispatchEvent(
    new CustomEvent<AppToastEventDetail>(APP_TOAST_EVENT, {
      detail: notification,
    })
  );

  return notification;
}

export function removeAppToast(notificationId: string) {
  window.dispatchEvent(
    new CustomEvent<string>(APP_TOAST_REMOVE_EVENT, {
      detail: notificationId,
    })
  );
}

export function emitNotificationClick(notification: AppNotification) {
  window.dispatchEvent(
    new CustomEvent<AppNotificationClickEventDetail>(
      APP_NOTIFICATION_CLICK_EVENT,
      {
        detail: { notification },
      }
    )
  );
}

export function handleNotificationAction(notification: AppNotification) {
  const action = notification.action;
  if (!action) return;

  if (action.kind === "messenger-room") {
    const roomId = Number(action.payload?.roomId || 0);
    if (!roomId) return;

    window.dispatchEvent(new Event("open-messenger"));

    window.dispatchEvent(
      new CustomEvent("messenger:open-room", {
        detail: { roomId },
      })
    );

    emitNotificationClick(notification);
    return;
  }

  if (action.kind === "approval-detail") {
    const approvalId = action.payload?.approvalId;
    if (!approvalId) return;

    window.location.href = `/e-approval/${approvalId}`;
    emitNotificationClick(notification);
    return;
  }

  if (action.kind === "notice-detail") {
    const noticeId = action.payload?.noticeId;
    if (!noticeId) return;

    window.location.href = `/notices/${noticeId}`;
    emitNotificationClick(notification);
    return;
  }

  if (action.kind === "schedule-detail") {
    const scheduleId = action.payload?.scheduleId;

    if (!scheduleId) {
      window.location.href = "/schedules";
      emitNotificationClick(notification);
      return;
    }

    window.location.href = `/schedules?scheduleId=${scheduleId}`;
    emitNotificationClick(notification);
    return;
  }

  if (action.kind === "route") {
    const path = String(action.payload?.path || "").trim();
    if (!path) return;

    window.location.href = path;
    emitNotificationClick(notification);
    return;
  }

  if (action.kind === "custom") {
    const eventName = String(action.payload?.eventName || "").trim();
    const detail = action.payload?.detail;

    if (!eventName) return;

    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail,
      })
    );

    emitNotificationClick(notification);
  }
}