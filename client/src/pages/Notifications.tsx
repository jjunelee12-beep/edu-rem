import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Megaphone,
  CalendarRange,
  MessageSquare,
  Clock3,
  CheckCircle2,
  XCircle,
  Info,
  Siren,
} from "lucide-react";

type NotificationItem = {
  id: number;
  userId: number;
  type?: string | null;
  title?: string | null;
  level?: string | null;
  message: string;
  imageUrl?: string | null;
  relatedId?: number | null;
  isRead?: boolean | null;
  createdAt?: string | Date | null;
};

function formatDateTime(value?: string | Date | null) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function getNotificationIcon(item: NotificationItem) {
  switch (item.type) {
    case "notice":
      return <Megaphone className="h-4 w-4 text-blue-600" />;
    case "schedule":
      return <CalendarRange className="h-4 w-4 text-emerald-600" />;
    case "messenger":
      return <MessageSquare className="h-4 w-4 text-violet-600" />;
    case "attendance":
      return <Clock3 className="h-4 w-4 text-amber-600" />;
    case "approval":
      return <FileText className="h-4 w-4 text-indigo-600" />;
    default:
      return <Bell className="h-4 w-4 text-slate-600" />;
  }
}

function getLevelIcon(level?: string | null) {
  switch (String(level || "normal")) {
    case "success":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "danger":
      return <XCircle className="h-3.5 w-3.5" />;
    case "important":
      return <Info className="h-3.5 w-3.5" />;
    case "urgent":
      return <Siren className="h-3.5 w-3.5" />;
    default:
      return <Bell className="h-3.5 w-3.5" />;
  }
}

function getLevelBadgeClass(level?: string | null) {
  switch (String(level || "normal")) {
    case "important":
      return "border-blue-100 bg-blue-50 text-blue-700";
    case "urgent":
      return "border-red-100 bg-red-50 text-red-700";
    case "success":
      return "border-emerald-100 bg-emerald-50 text-emerald-700";
    case "danger":
      return "border-rose-100 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getLevelLabel(level?: string | null) {
  switch (String(level || "normal")) {
    case "important":
      return "중요";
    case "urgent":
      return "긴급";
    case "success":
      return "완료";
    case "danger":
      return "반려";
    default:
      return "알림";
  }
}

function getNotificationTitle(item: NotificationItem) {
  const title = item.title?.trim();
  if (title) return title;

  const message = String(item.message || "");
  const level = String(item.level || "normal");

  if (item.type === "approval") {
    if (level === "success") return "전자결재 승인완료";
    if (level === "danger") return "전자결재 반려";
    if (level === "important" || level === "urgent") return "전자결재 요청";

    if (message.includes("승인완료") || message.includes("최종 승인")) {
      return "전자결재 승인완료";
    }
    if (message.includes("반려")) {
      return "전자결재 반려";
    }
    if (
      message.includes("요청") ||
      message.includes("결재 요청") ||
      message.includes("결재 단계") ||
      message.includes("결재 차례")
    ) {
      return "전자결재 요청";
    }

    return "전자결재 알림";
  }

  if (item.type === "notice") {
    if (level === "urgent") return "긴급 공지";
    if (level === "important") return "중요 공지";
    return "공지 알림";
  }

  if (item.type === "schedule") {
    if (level === "important" || level === "urgent") return "중요 일정";
    return "일정 알림";
  }

  if (item.type === "messenger") return "메신저 알림";
  if (item.type === "attendance") return "근태 알림";
  if (item.type === "lead") return "상담 DB 알림";

  return "새 알림";
}

function getNotificationTypeBadge(item: NotificationItem) {
  const level = String(item.level || "normal");

  if (item.type === "notice") {
    if (level === "urgent") {
      return {
        label: "긴급공지",
        className: "bg-red-50 text-red-700",
      };
    }
    if (level === "important") {
      return {
        label: "중요공지",
        className: "bg-amber-50 text-amber-700",
      };
    }
    return {
      label: "공지",
      className: "bg-blue-50 text-blue-600",
    };
  }

  if (item.type === "schedule") {
    if (level === "important" || level === "urgent") {
      return {
        label: "중요일정",
        className: "bg-violet-50 text-violet-700",
      };
    }

    return {
      label: "일정",
      className: "bg-emerald-50 text-emerald-600",
    };
  }

  if (item.type === "messenger") {
    return {
      label: "메신저",
      className: "bg-violet-50 text-violet-600",
    };
  }

  if (item.type === "attendance") {
    return {
      label: "근태",
      className: "bg-amber-50 text-amber-600",
    };
  }

  if (item.type === "approval") {
    if (level === "success") {
      return {
        label: "승인완료",
        className: "bg-emerald-50 text-emerald-600",
      };
    }

    if (level === "danger") {
      return {
        label: "반려",
        className: "bg-rose-50 text-rose-600",
      };
    }

    if (level === "important" || level === "urgent") {
      return {
        label: "결재요청",
        className: "bg-blue-50 text-blue-600",
      };
    }

    return {
      label: "전자결재",
      className: "bg-indigo-50 text-indigo-600",
    };
  }

  if (item.type === "lead") {
    return {
      label: "상담DB",
      className: "bg-teal-50 text-teal-700",
    };
  }

  return {
    label: "알림",
    className: "bg-slate-50 text-slate-600",
  };
}

export default function Notifications() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: rows = [], isLoading } = trpc.notification.list.useQuery();

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: async () => {
      await utils.notification.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "알림 읽음 처리 중 오류가 발생했습니다.");
    },
  });

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: async () => {
      toast.success("전체 알림을 읽음 처리했습니다.");
      await utils.notification.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "전체 읽음 처리 실패");
    },
  });

  const deleteMutation = trpc.notification.delete.useMutation({
    onSuccess: async () => {
      await utils.notification.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "삭제 실패");
    },
  });

  const [filter, setFilter] = useState<
    "all" | "unread" | "approval" | "messenger" | "notice" | "schedule"
  >("all");

  const notifications = useMemo(() => {
    return ((rows as NotificationItem[]) ?? []).slice().sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [rows]);

  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.isRead).length;
  }, [notifications]);

  const handleOpenNotification = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await markReadMutation.mutateAsync({ id: Number(item.id) });
        utils.notification.list.setData(undefined, (prev) =>
          prev?.map((n: any) =>
            n.id === item.id ? { ...n, isRead: true } : n
          )
        );
      } catch {
        return;
      }
    }

if (item.type === "payment" && item.relatedId) {
  setLocation(`/students/${item.relatedId}`);
  return;
}

    switch (item.type) {
      case "notice":
        if (item.relatedId) {
          setLocation(`/notices/${item.relatedId}`);
          return;
        }
        setLocation("/notices");
        return;

            case "schedule":
        if (item.relatedId) {
          setLocation(`/schedules`);
          return;
        }
        setLocation("/schedules");
        return;

      case "messenger":
        window.dispatchEvent(new Event("open-messenger"));

        if (item.relatedId) {
          window.dispatchEvent(
            new CustomEvent("messenger:open-room", {
              detail: { roomId: Number(item.relatedId) },
            })
          );
        }

        return;

      case "attendance":
        setLocation("/attendance");
        return;

      case "approval":
        if (item.relatedId) {
          setLocation(`/e-approval/${item.relatedId}`);
          return;
        }
        setLocation("/e-approval");
        return;

      default:
        break;
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold">알림</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                공지사항, 일정, 메신저, 전자결재 등 주요 알림을 확인할 수 있습니다.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm">
                미읽음{" "}
                <span className="ml-1 font-semibold text-primary">
                  {unreadCount}
                </span>
              </div>

              <Button
                variant="outline"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending || unreadCount === 0}
              >
                전체 읽음
              </Button>

              <Button variant="outline" onClick={() => setLocation("/")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                홈으로
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "전체" },
              { key: "unread", label: "안읽음" },
              { key: "approval", label: "전자결재" },
              { key: "messenger", label: "메신저" },
              { key: "notice", label: "공지" },
              { key: "schedule", label: "일정" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  filter === tab.key
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              알림 불러오는 중...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              표시할 알림이 없습니다.
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((item) => {
                const unread = !item.isRead;
                const title = getNotificationTitle(item);
                const typeBadge = getNotificationTypeBadge(item);
                const level = String(item.level || "normal");

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenNotification(item)}
                    className={`flex w-full items-start justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50 ${
                      unread ? "bg-blue-50/60" : "bg-white"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {getNotificationIcon(item)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {unread ? (
                            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                              NEW
                            </span>
                          ) : null}

                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeBadge.className}`}
                          >
                            {typeBadge.label}
                          </span>

                          {item.type !== "messenger" ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getLevelBadgeClass(
                                level
                              )}`}
                            >
                              {getLevelIcon(level)}
                              {getLevelLabel(level)}
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                          {title}
                        </p>

                        <p
                          className={`mt-1 break-all text-sm leading-6 ${
                            unread
                              ? "font-medium text-slate-800"
                              : "text-slate-700"
                          }`}
                        >
                          {item.message}
                        </p>

                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate({ id: Number(item.id) });
                        }}
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        ✕
                      </button>

                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}