import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  FileCheck2,
  Info,
  MessageCircle,
  Siren,
  X,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";
import {
  APP_TOAST_EVENT,
  APP_TOAST_REMOVE_EVENT,
  handleNotificationAction,
} from "@/lib/appNotifications";
import type {
  AppNotification,
  AppNotificationCategory,
  AppNotificationLevel,
} from "@/types/notification";

type ToastItem = AppNotification & {
  visible: boolean;
};

const MAX_TOASTS = 4;
const EXIT_ANIMATION_MS = 220;

function getCategoryIcon(category: AppNotificationCategory) {
  switch (category) {
    case "messenger":
      return MessageCircle;
    case "approval":
      return FileCheck2;
    case "notice":
    case "schedule":
    case "attendance":
    case "payment":
    case "refund":
    case "system":
    default:
      return Bell;
  }
}

function getLevelAccentClass(level: AppNotificationLevel = "normal") {
  switch (level) {
    case "important":
      return "border-l-blue-500";
    case "urgent":
      return "border-l-red-500";
    case "success":
      return "border-l-emerald-500";
    case "danger":
      return "border-l-rose-500";
    case "normal":
    default:
      return "border-l-slate-300";
  }
}

function getLevelBadgeClass(level: AppNotificationLevel = "normal") {
  switch (level) {
    case "important":
      return "border-blue-100 bg-blue-50 text-blue-700";
    case "urgent":
      return "border-red-100 bg-red-50 text-red-700";
    case "success":
      return "border-emerald-100 bg-emerald-50 text-emerald-700";
    case "danger":
      return "border-rose-100 bg-rose-50 text-rose-700";
    case "normal":
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getLevelLabel(level: AppNotificationLevel = "normal") {
  switch (level) {
    case "important":
      return "중요";
    case "urgent":
      return "긴급";
    case "success":
      return "완료";
    case "danger":
      return "반려";
    case "normal":
    default:
      return "알림";
  }
}

function getSmallStatusIcon(level: AppNotificationLevel = "normal") {
  switch (level) {
    case "success":
      return CheckCircle2;
    case "danger":
      return XCircle;
    case "urgent":
      return Siren;
    case "important":
      return Info;
    case "normal":
    default:
      return Bell;
  }
}

function formatRelativeTime(isoString?: string) {
  if (!isoString) return "";

  const time = new Date(isoString).getTime();
  if (Number.isNaN(time)) return "";

  const diffSec = Math.max(0, Math.floor((Date.now() - time) / 1000));

  if (diffSec < 10) return "방금";
  if (diffSec < 60) return `${diffSec}초 전`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

function getInitialLetter(text?: string | null) {
  const value = String(text || "").trim();
  if (!value) return "A";
  return value.charAt(0).toUpperCase();
}

function getCategoryLabel(category: AppNotificationCategory) {
  switch (category) {
    case "approval":
      return "전자결재";
    case "notice":
      return "공지";
    case "schedule":
      return "일정";
    case "attendance":
      return "근태";
    case "payment":
      return "결제";
    case "refund":
      return "환불";
    case "messenger":
      return "메신저";
    case "system":
    default:
      return "알림";
  }
}

type ToastCardProps = {
  toast: ToastItem;
  onClose: (id: string) => void;
  onOpen: (toast: AppNotification) => void;
};

function MessengerToastCard({ toast, onClose, onOpen }: ToastCardProps) {
  const imageUrl = normalizeAssetUrl(toast.imageUrl || "");

  return (
    <div
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-[24px] border border-white/70 bg-white/95 shadow-[0_10px_34px_rgba(15,23,42,0.14)] backdrop-blur-md transition-all duration-200",
        toast.visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(toast)}
        className="flex w-full items-start gap-3 p-4 pr-12 text-left transition hover:bg-slate-50 active:scale-[0.98]"
      >
        <div className="relative mt-0.5 shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={toast.title}
              className="h-12 w-12 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
              {getInitialLetter(toast.title)}
            </div>
          )}

          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-white shadow-sm">
            <MessageCircle className="h-3.5 w-3.5 text-sky-600" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-semibold text-slate-900">
              {toast.title}
            </p>
            <span className="shrink-0 text-[11px] text-slate-400">
              {formatRelativeTime(toast.createdAt)}
            </span>
          </div>

          <p className="mt-1 truncate text-[13px] text-slate-600">
            {toast.body}
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
              메신저
            </span>

            <span className="text-[11px] font-medium text-slate-500">
              클릭하여 열기
            </span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        aria-label="닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function DefaultToastCard({ toast, onClose, onOpen }: ToastCardProps) {
  const CategoryIcon = getCategoryIcon(toast.category);
  const StatusIcon = getSmallStatusIcon(toast.level);
  const imageUrl = normalizeAssetUrl(toast.imageUrl || "");

  return (
    <div
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-[24px] border border-white/70 bg-white/95 shadow-[0_10px_34px_rgba(15,23,42,0.14)] backdrop-blur-md transition-all duration-200",
        "border-l-[5px]",
        getLevelAccentClass(toast.level),
        toast.visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(toast)}
        className="flex w-full items-start gap-3 p-4 pr-12 text-left transition hover:bg-slate-50 active:scale-[0.98]"
      >
        <div className="relative mt-0.5 shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={toast.title}
              className="h-12 w-12 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <CategoryIcon className="h-5 w-5" />
            </div>
          )}

          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-white shadow-sm">
            <StatusIcon className="h-3.5 w-3.5 text-slate-600" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {getCategoryLabel(toast.category)}
                </span>

                <span className="text-[11px] text-slate-400">
                  {formatRelativeTime(toast.createdAt)}
                </span>
              </div>

              <p className="mt-2 truncate text-[15px] font-semibold text-slate-900">
                {toast.title}
              </p>

              <p className="mt-1 line-clamp-2 break-words text-[13px] leading-5 text-slate-600">
                {toast.body}
              </p>
            </div>

            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                getLevelBadgeClass(toast.level)
              )}
            >
              {getLevelLabel(toast.level)}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-end">
            <span className="text-[11px] font-medium text-slate-500">
              클릭하여 열기
            </span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        aria-label="닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function AppToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});
  const removeTimersRef = useRef<Record<string, number>>({});

  const safeToasts = useMemo(() => toasts.slice(0, MAX_TOASTS), [toasts]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const customEvent = event as CustomEvent<AppNotification>;
      const notification = customEvent.detail;
      if (!notification?.id) return;

      setToasts((prev) => {
        const next: ToastItem[] = [
          { ...notification, visible: true },
          ...prev.filter((item) => item.id !== notification.id),
        ];

        return next.slice(0, MAX_TOASTS);
      });

      const durationMs = Math.max(2000, Number(notification.durationMs || 5000));

      if (timersRef.current[notification.id]) {
        window.clearTimeout(timersRef.current[notification.id]);
      }

      timersRef.current[notification.id] = window.setTimeout(() => {
        startRemove(notification.id);
      }, durationMs);
    };

    const onToastRemove = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const notificationId = customEvent.detail;
      if (!notificationId) return;

      startRemove(notificationId);
    };

    window.addEventListener(APP_TOAST_EVENT, onToast as EventListener);
    window.addEventListener(
      APP_TOAST_REMOVE_EVENT,
      onToastRemove as EventListener
    );

    return () => {
      window.removeEventListener(APP_TOAST_EVENT, onToast as EventListener);
      window.removeEventListener(
        APP_TOAST_REMOVE_EVENT,
        onToastRemove as EventListener
      );

      Object.values(timersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });

      Object.values(removeTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, []);

  function startRemove(notificationId: string) {
    if (!notificationId) return;

    if (timersRef.current[notificationId]) {
      window.clearTimeout(timersRef.current[notificationId]);
      delete timersRef.current[notificationId];
    }

    setToasts((prev) =>
      prev.map((item) =>
        item.id === notificationId ? { ...item, visible: false } : item
      )
    );

    if (removeTimersRef.current[notificationId]) {
      window.clearTimeout(removeTimersRef.current[notificationId]);
    }

    removeTimersRef.current[notificationId] = window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== notificationId));
      delete removeTimersRef.current[notificationId];
    }, EXIT_ANIMATION_MS);
  }

  function onClickToast(notification: AppNotification) {
    startRemove(notification.id);
    handleNotificationAction(notification);
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-[360px] max-w-[calc(100vw-24px)] flex-col gap-3 sm:bottom-5 sm:right-5">
      {safeToasts.map((toast) => {
        const isMessenger = toast.category === "messenger";

        if (isMessenger) {
          return (
            <MessengerToastCard
              key={toast.id}
              toast={toast}
              onClose={startRemove}
              onOpen={onClickToast}
            />
          );
        }

        return (
          <DefaultToastCard
            key={toast.id}
            toast={toast}
            onClose={startRemove}
            onOpen={onClickToast}
          />
        );
      })}
    </div>
  );
}