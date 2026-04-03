import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ScheduleCalendar from "@/components/schedule/ScheduleCalendar";
import ScheduleEditorDialog from "@/components/schedule/ScheduleEditorDialog";
import { formatTime } from "@/lib/datetime";
import {
  Search,
  Bell,
  User,
  Clock3,
  Megaphone,
  CheckCircle2,
  UserCheck,
  UserX,
  CalendarRange,
  MessageSquare,
} from "lucide-react";

type AttendanceCardStatus =
  | "출근"
  | "퇴근"
  | "미출근"
  | "출근전"
  | "근무중"
  | "퇴근완료"
  | "지각"
  | "조퇴"
  | "병가"
  | "연차"
  | "출장"
  | "반차"
  | "결근";

type AttendanceCardItem = {
  id: number;
  userId: number;
  name: string;
  status: AttendanceCardStatus;
  time?: string;
  team?: string;
  position?: string;
};

function SectionTitle({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: attendanceRows = [] } = trpc.attendance.list.useQuery();
  const { data: userRows = [] } = trpc.users.list.useQuery();
  const { data: todayAttendanceRow } = trpc.attendance.today.useQuery();
  const { data: myProfile } = trpc.users.me.useQuery();
  const { data: notices = [] } = trpc.notice.list.useQuery();
  const { data: notifications = [] } = trpc.notification.list.useQuery();
  const { data: todaySchedules = [] } = trpc.schedule.listToday.useQuery();

  const { urgentNotices, pinnedNotices, normalNotices } = useMemo(() => {
    const list = notices as any[];

    return {
      urgentNotices: list.filter((n) => n.importance === "urgent"),
      pinnedNotices: list.filter((n) => n.isPinned && n.importance !== "urgent"),
      normalNotices: list.filter((n) => !n.isPinned && n.importance !== "urgent"),
    };
  }, [notices]);

  const now = new Date();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`
  );
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);

  const { data: homeMonthSchedules = [] } = trpc.schedule.listMonth.useQuery({
    year: calendarYear,
    month: calendarMonth,
  });

  const utils = trpc.useUtils();

  const createScheduleMutation = trpc.schedule.create.useMutation({
    onSuccess: async () => {
      toast.success("일정이 등록되었습니다.");
      setScheduleEditorOpen(false);

      await Promise.all([
        utils.schedule.listMonth.invalidate({ year: calendarYear, month: calendarMonth }),
        utils.schedule.listToday.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message || "일정 등록 중 오류가 발생했습니다.");
    },
  });

  const clockInMutation = trpc.attendance.clockIn.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.attendance.today.invalidate(),
        utils.attendance.list.invalidate(),
      ]);
    },
    onError: (err) => {
      alert(err.message || "출근 처리 중 오류가 발생했습니다.");
    },
  });

  const clockOutMutation = trpc.attendance.clockOut.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.attendance.today.invalidate(),
        utils.attendance.list.invalidate(),
      ]);
    },
    onError: (err) => {
      alert(err.message || "퇴근 처리 중 오류가 발생했습니다.");
    },
  });

  const usersById = useMemo(() => {
    const map = new Map<number, any>();
    (userRows as any[]).forEach((u: any) => {
      map.set(Number(u.id), u);
    });
    return map;
  }, [userRows]);

  const isSuperAdmin = user?.role === "host" || user?.role === "superhost";
  const isTeamManager = user?.role === "admin";

  const todayText = useMemo(() => {
    const nowDate = new Date();
    return `${nowDate.getFullYear()}년 ${nowDate.getMonth() + 1}월 ${nowDate.getDate()}일`;
  }, []);

  const profileImageSrc = (myProfile as any)?.profileImageUrl || "";

  const todayAttendance = useMemo(() => {
    const nowDate = new Date();
    const kst = new Date(nowDate.getTime() + 9 * 60 * 60 * 1000);
    const today = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(
      kst.getUTCDate()
    ).padStart(2, "0")}`;

    return (attendanceRows as any[]).filter((r) => {
      const workDate = String(r.workDate || "").slice(0, 10);
      return workDate === today;
    });
  }, [attendanceRows]);

  const unreadNotificationCount = useMemo(() => {
    return (notifications as any[]).filter((item) => !item.isRead).length;
  }, [notifications]);

  const activeUsers = useMemo(() => {
    if (isSuperAdmin) {
      return (userRows as any[]).filter((u: any) => !!u?.isActive);
    }

    if (isTeamManager) {
      const myTeam = (userRows as any[]).find(
        (u: any) => Number(u.id) === Number(user?.id)
      )?.teamId;

      return (userRows as any[]).filter(
        (u: any) => !!u?.isActive && u.teamId === myTeam
      );
    }

    return [];
  }, [userRows, user?.id, isSuperAdmin, isTeamManager]);

  const todayAttendanceByUserId = useMemo(() => {
    const map = new Map<number, any>();
    (todayAttendance as any[]).forEach((row: any) => {
      map.set(Number(row.userId), row);
    });
    return map;
  }, [todayAttendance]);

  const myTodayAttendance = useMemo(() => {
    if (!user?.id) return null;

    return todayAttendanceRow ?? todayAttendanceByUserId.get(Number(user.id)) ?? null;
  }, [todayAttendanceRow, todayAttendanceByUserId, user?.id]);

  const attendanceSummary = useMemo(() => {
    if (!isSuperAdmin && !isTeamManager) {
      const checkedIn = myTodayAttendance?.clockInAt ? 1 : 0;
      const checkedOut = myTodayAttendance?.clockOutAt ? 1 : 0;
      const absent = myTodayAttendance?.clockInAt ? 0 : 1;

      return { checkedIn, checkedOut, absent };
    }

    const checkedIn = activeUsers.filter((u: any) => {
      const row = todayAttendanceByUserId.get(Number(u.id));
      return !!row?.clockInAt;
    }).length;

    const checkedOut = activeUsers.filter((u: any) => {
      const row = todayAttendanceByUserId.get(Number(u.id));
      return !!row?.clockOutAt;
    }).length;

    const absent = activeUsers.filter((u: any) => {
      const row = todayAttendanceByUserId.get(Number(u.id));
      return !row?.clockInAt;
    }).length;

    return { checkedIn, checkedOut, absent };
  }, [isSuperAdmin, isTeamManager, activeUsers, todayAttendanceByUserId, myTodayAttendance]);

  const attendanceListUI = useMemo<AttendanceCardItem[]>(() => {
    if (!isSuperAdmin && !isTeamManager) {
      if (!user?.id) return [];

      const myUser = usersById.get(Number(user.id));
      const myRow = todayAttendanceByUserId.get(Number(user.id));

      if (!myRow) {
        return [
          {
            id: Number(user.id),
            userId: Number(user.id),
            name: myUser?.name || user?.name || "이름없음",
            status: "미출근",
            time: "",
            team: myUser?.teamName || myUser?.team || "미분류",
            position:
              myUser?.positionName ||
              myUser?.position ||
              (myUser?.role === "superhost"
                ? "슈퍼호스트"
                : myUser?.role === "host"
                ? "호스트"
                : myUser?.role === "admin"
                ? "관리자"
                : "직원"),
          },
        ];
      }

      let status: "출근" | "퇴근" | "미출근" = "미출근";
      let time = "";

      if (myRow.clockOutAt) {
        status = "퇴근";
        time = formatTime(myRow.clockOutAt);
      } else if (myRow.clockInAt) {
        status = "출근";
        time = formatTime(myRow.clockInAt);
      }

      return [
        {
          id: Number(myRow.id || user.id),
          userId: Number(user.id),
          name: myRow.name || myUser?.name || user?.name || "이름없음",
          status,
          time,
          team: myUser?.teamName || myUser?.team || "미분류",
          position:
            myUser?.positionName ||
            myUser?.position ||
            (myUser?.role === "superhost"
              ? "슈퍼호스트"
              : myUser?.role === "host"
              ? "호스트"
              : myUser?.role === "admin"
              ? "관리자"
              : "직원"),
        },
      ];
    }

    return activeUsers
      .map((u: any) => {
        const row = todayAttendanceByUserId.get(Number(u.id));

        if (!row) {
          return {
            id: Number(u.id),
            userId: Number(u.id),
            name: u.name || u.username || "이름없음",
            status: "미출근" as const,
            time: "",
            team: u.teamName || u.team || "미분류",
            position:
              u.positionName ||
              u.position ||
              (u.role === "superhost"
                ? "슈퍼호스트"
                : u.role === "host"
                ? "호스트"
                : u.role === "admin"
                ? "관리자"
                : "직원"),
          };
        }

        let status: "출근" | "퇴근" | "미출근" = "미출근";
        let time = "";

        if (row.clockOutAt) {
          status = "퇴근";
          time = formatTime(row.clockOutAt);
        } else if (row.clockInAt) {
          status = "출근";
          time = formatTime(row.clockInAt);
        }

        return {
          id: Number(row.id || u.id),
          userId: Number(u.id),
          name: row.name || u.name || u.username || "이름없음",
          status,
          time,
          team: u.teamName || u.team || "미분류",
          position:
            u.positionName ||
            u.position ||
            (u.role === "superhost"
              ? "슈퍼호스트"
              : u.role === "host"
              ? "호스트"
              : u.role === "admin"
              ? "관리자"
              : "직원"),
        };
      })
      .sort((a, b) => {
        const teamCompare = String(a.team || "").localeCompare(String(b.team || ""));
        if (teamCompare !== 0) return teamCompare;

        const posCompare = String(a.position || "").localeCompare(String(b.position || ""));
        if (posCompare !== 0) return posCompare;

        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [isSuperAdmin, isTeamManager, user?.id, user?.name, activeUsers, todayAttendanceByUserId, usersById]);

  const visibleAttendanceList = useMemo(() => {
    return attendanceListUI;
  }, [attendanceListUI]);

  const canClockIn = !myTodayAttendance?.clockInAt;
  const canClockOut = !!myTodayAttendance?.clockInAt && !myTodayAttendance?.clockOutAt;

  const homeCalendarItems = useMemo(() => {
    return (homeMonthSchedules as any[]).map((row: any) => ({
      id: Number(row.id),
      title: row.title ?? "",
      date: row.date ?? "",
      ampm: row.ampm ?? "AM",
      hour: Number(row.hour ?? 9),
      minute: Number(row.minute ?? 0),
      isGlobal: !!row.isGlobal,
    }));
  }, [homeMonthSchedules]);

  const selectedCalendarDateSchedules = useMemo(() => {
    return (homeMonthSchedules as any[])
      .filter((row: any) => String(row.date) === String(selectedCalendarDate))
      .sort((a: any, b: any) => {
        const a24 =
          a.ampm === "AM"
            ? a.hour === 12
              ? 0
              : a.hour
            : a.hour === 12
            ? 12
            : a.hour + 12;

        const b24 =
          b.ampm === "AM"
            ? b.hour === 12
              ? 0
              : b.hour
            : b.hour === 12
            ? 12
            : b.hour + 12;

        if (a24 !== b24) return a24 - b24;
        return Number(a.minute) - Number(b.minute);
      });
  }, [homeMonthSchedules, selectedCalendarDate]);

  const openMessenger = () => {
    window.dispatchEvent(new Event("open-messenger"));
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_28px_rgba(15,23,42,0.04)] backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">{todayText}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              {user?.name}님, 안녕하세요
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 lg:w-[260px] lg:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="공지 검색"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-300"
              />
            </div>

            <Button variant="outline" onClick={() => setLocation("/overview")}>
              운영 대시보드
            </Button>

            <button
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50"
              onClick={() => setLocation("/notifications")}
            >
              <Bell className="h-4 w-4" />
              {unreadNotificationCount > 0 ? (
                <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              ) : null}
            </button>

            <button
              onClick={openMessenger}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              <MessageSquare className="h-4 w-4" />
            </button>

            <button
              onClick={() => setLocation("/my")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              <User className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <button
                    onClick={() => setLocation("/my")}
                    className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xl font-semibold text-slate-700"
                  >
                    {profileImageSrc ? (
                      <img
                        src={profileImageSrc}
                        alt="프로필"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{user?.name?.[0] ?? "U"}</span>
                    )}
                  </button>

                  <h3 className="mt-3 text-lg font-semibold text-slate-950">
                    {user?.name ?? "-"}
                  </h3>
                  <div className="text-sm leading-tight text-slate-500">
                    <p className="truncate">{(myProfile as any)?.teamName || "미분류"}</p>
                    <p className="truncate">
                      {(myProfile as any)?.positionName || "미분류"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={openMessenger}
                    className="rounded-2xl bg-slate-50 p-4 text-center transition hover:bg-slate-100"
                  >
                    <div className="flex items-center justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
                        <MessageSquare className="h-5 w-5 text-slate-900" />
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">메신저</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      열기
                    </p>
                  </button>

                  <div className="rounded-2xl bg-slate-50 p-4 text-center">
                    <p className="text-xs text-slate-500">오늘 일정</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {todaySchedules.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <SectionTitle
                  icon={<Clock3 className="h-4 w-4 text-primary" />}
                  title="오늘 출퇴근"
                />

                <div className="mb-4 text-right text-sm text-slate-500">
                  {currentTime.toLocaleString("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => clockInMutation.mutate()}
                    disabled={!canClockIn || clockInMutation.isPending}
                  >
                    출근
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => clockOutMutation.mutate()}
                    disabled={!canClockOut || clockOutMutation.isPending}
                  >
                    퇴근
                  </Button>

                  <Button variant="secondary" onClick={() => setLocation("/attendance")}>
                    기록부
                  </Button>
                </div>

                {isSuperAdmin || isTeamManager ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-2xl bg-emerald-50 p-4 text-center">
                        <p className="text-xs text-slate-500">출근</p>
                        <p className="mt-1 text-xl font-bold text-emerald-600">
                          {attendanceSummary.checkedIn}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 text-center">
                        <p className="text-xs text-slate-500">퇴근</p>
                        <p className="mt-1 text-xl font-bold text-slate-700">
                          {attendanceSummary.checkedOut}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-red-50 p-4 text-center">
                        <p className="text-xs text-slate-500">미출근</p>
                        <p className="mt-1 text-xl font-bold text-red-600">
                          {attendanceSummary.absent}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {visibleAttendanceList.length === 0 ? (
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                          오늘 등록된 근태 기록이 없습니다.
                        </div>
                      ) : (
                        visibleAttendanceList.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              {item.status === "출근" ? (
                                <UserCheck className="h-4 w-4 text-emerald-600" />
                              ) : item.status === "퇴근" ? (
                                <CheckCircle2 className="h-4 w-4 text-slate-600" />
                              ) : (
                                <UserX className="h-4 w-4 text-red-500" />
                              )}

                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {item.name}
                                </p>
                                <div className="text-[11px] leading-tight text-slate-500">
                                  <p className="truncate">{item.team || "미분류"}</p>
                                  <p className="truncate">{item.position || "미분류"}</p>
                                </div>
                              </div>
                            </div>

                            <span className="text-xs text-slate-500">
                              {item.time ? `${item.status} ${item.time}` : item.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">오늘 상태</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {myTodayAttendance?.status || "출근전"}
                      </p>
                      <div className="mt-1 text-xs leading-tight text-slate-500">
                        <p className="truncate">{attendanceListUI[0]?.team || "미분류"}</p>
                        <p className="truncate">
                          {attendanceListUI[0]?.position || "미분류"}
                        </p>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        {myTodayAttendance?.clockInAt
                          ? `출근 ${formatTime(myTodayAttendance.clockInAt)}`
                          : "아직 출근하지 않았습니다."}
                        {myTodayAttendance?.clockOutAt
                          ? ` · 퇴근 ${formatTime(myTodayAttendance.clockOutAt)}`
                          : ""}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">출근 시간</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatTime(myTodayAttendance?.clockInAt) || "-"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">퇴근 시간</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatTime(myTodayAttendance?.clockOutAt) || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">근무 시간</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {myTodayAttendance?.workMinutes
                          ? `${Math.floor(Number(myTodayAttendance.workMinutes) / 60)}시간 ${
                              Number(myTodayAttendance.workMinutes) % 60
                            }분`
                          : "-"}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <SectionTitle
                  icon={<Megaphone className="h-4 w-4 text-primary" />}
                  title="공지사항"
                  right={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setLocation("/notices")}
                    >
                      더보기
                    </Button>
                  }
                />

                <div className="space-y-3">
                  {urgentNotices.slice(0, 3).map((notice: any) => (
                    <button
                      key={notice.id}
                      onClick={() => setLocation(`/notices/${notice.id}`)}
                      className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-left transition hover:bg-red-100"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-semibold text-red-700">
                          🚨 {notice.title}
                        </p>
                        <span className="text-xs text-red-600">긴급</span>
                      </div>
                    </button>
                  ))}

                  {pinnedNotices.slice(0, 3).map((notice: any) => (
                    <button
                      key={notice.id}
                      onClick={() => setLocation(`/notices/${notice.id}`)}
                      className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-left transition hover:bg-amber-100"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-semibold text-amber-800">
                          📌 {notice.title}
                        </p>
                        <span className="text-xs text-slate-500">
                          {notice.createdAt
                            ? new Date(notice.createdAt).toLocaleDateString("ko-KR")
                            : "-"}
                        </span>
                      </div>
                    </button>
                  ))}

                  {normalNotices
                    .filter((notice: any) => {
                      const q = search.trim().toLowerCase();
                      if (!q) return true;
                      return String(notice.title || "").toLowerCase().includes(q);
                    })
                    .slice(0, 5)
                    .map((notice: any) => (
                      <button
                        key={notice.id}
                        onClick={() => setLocation(`/notices/${notice.id}`)}
                        className="w-full rounded-2xl bg-slate-50 px-4 py-4 text-left transition hover:bg-slate-100"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800">
                              {notice.title}
                            </p>
                          </div>
                          <span className="text-xs text-slate-500">
                            {notice.createdAt
                              ? new Date(notice.createdAt).toLocaleDateString("ko-KR")
                              : "-"}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardContent className="p-6">
                  <SectionTitle
                    icon={<CalendarRange className="h-4 w-4 text-primary" />}
                    title="일정 / 캘린더"
                    right={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setLocation("/schedules")}
                      >
                        전체 보기
                      </Button>
                    }
                  />

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <ScheduleCalendar
                      year={calendarYear}
                      month={calendarMonth}
                      selectedDate={selectedCalendarDate}
                      schedules={homeCalendarItems}
                      onChangeMonth={(nextYear, nextMonth) => {
                        setCalendarYear(nextYear);
                        setCalendarMonth(nextMonth);
                        setSelectedCalendarDate(
                          `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
                        );
                      }}
                      onSelectDate={(date) => {
                        setSelectedCalendarDate(date);
                        setScheduleEditorOpen(true);
                      }}
                    />

                    <div className="mt-4 space-y-2">
                      {selectedCalendarDateSchedules.length === 0 ? (
                        <div className="rounded-xl bg-white px-3 py-3 text-sm text-slate-500">
                          선택한 날짜에 등록된 일정이 없습니다.
                        </div>
                      ) : (
                        selectedCalendarDateSchedules.slice(0, 3).map((item: any) => (
                          <div key={item.id} className="rounded-xl bg-white px-3 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {item.title}
                              </p>
                              <span className="text-xs text-slate-500">
                                {item.ampm === "AM" ? "오전" : "오후"} {item.hour}:
                                {String(item.minute).padStart(2, "0")}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {item.isGlobal ? "전체 일정" : "개인 일정"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <SectionTitle
                    icon={<Clock3 className="h-4 w-4 text-primary" />}
                    title="오늘 일정"
                  />

                  <div className="space-y-3">
                    {(todaySchedules as any[]).length === 0 ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        오늘 등록된 일정이 없습니다.
                      </div>
                    ) : (
                      (todaySchedules as any[]).map((item: any) => (
                        <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {item.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {item.isGlobal ? "전체 일정" : "개인 일정"}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                item.tone === "green"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : item.tone === "orange"
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-blue-50 text-blue-600"
                              }`}
                            >
                              {item.ampm === "AM" ? "오전" : "오후"} {item.hour}:
                              {String(item.minute).padStart(2, "0")}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <ScheduleEditorDialog
        open={scheduleEditorOpen}
        mode="create"
        selectedDate={selectedCalendarDate}
        initialValue={{
          title: "",
          description: "",
          date: selectedCalendarDate,
          ampm: "AM",
          hour: 9,
          minute: 0,
          isGlobal: false,
        }}
        isSubmitting={createScheduleMutation.isPending}
        onClose={() => setScheduleEditorOpen(false)}
        onSubmit={(payload) => {
          createScheduleMutation.mutate({
            title: payload.title,
            description: payload.description,
            date: payload.date,
            ampm: payload.ampm,
            hour: payload.hour,
            minute: payload.minute,
            isGlobal: payload.isGlobal,
          });
        }}
      />
    </>
  );
}