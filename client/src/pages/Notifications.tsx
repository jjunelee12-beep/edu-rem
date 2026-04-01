import { useMemo } from "react";
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
} from "lucide-react";

type NotificationItem = {
  id: number;
  userId: number;
  type?: string | null;
  message: string;
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

function getNotificationIcon(type?: string | null) {
  switch (type) {
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

  const notifications = useMemo(() => {
    return ((rows as NotificationItem[]) ?? []).slice().sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [rows]);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.isRead).length;
  }, [notifications]);

  const handleOpenNotification = async (item: NotificationItem) => {
  if (!item.isRead) {
    try {
      await markReadMutation.mutateAsync({ id: Number(item.id) });
    } catch {
      return;
    }
  }

  switch (item.type) {
    case "notice":
      if (item.relatedId) {
        setLocation(`/notices/${item.relatedId}`);
        return;
      }
      break;

    case "schedule":
      setLocation("/schedules");
      return;

    case "messenger":
      if (item.relatedId) {
        setLocation(`/messenger?roomId=${item.relatedId}`);
        return;
      }
      setLocation("/messenger");
      return;

    case "attendance":
      setLocation("/attendance");
      return;

    // ✅ 추가
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
                공지사항, 일정, 메신저 등 주요 알림을 확인할 수 있습니다.
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
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              알림 불러오는 중...
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              표시할 알림이 없습니다.
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((item) => {
                const unread = !item.isRead;

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
                        {getNotificationIcon(item.type)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {unread ? (
                            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                              NEW
                            </span>
                          ) : null}

                          {item.type === "notice" ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                              공지
                            </span>
                          ) : null}

                          {item.type === "schedule" ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                              일정
                            </span>
                          ) : null}

                          {item.type === "messenger" ? (
                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-600">
                              메신저
                            </span>
                          ) : null}

                          {item.type === "attendance" ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                              근태
                            </span>
                          ) : null}
		{item.type === "approval" ? (
  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
    전자결재
  </span>
) : null}
                        </div>

                        <p
                          className={`mt-2 break-all text-sm leading-6 ${
                            unread ? "font-semibold text-slate-900" : "text-slate-800"
                          }`}
                        >
                          {item.message}
                        </p>

                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pt-1 text-muted-foreground">
                      <ChevronRight className="h-4 w-4" />
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