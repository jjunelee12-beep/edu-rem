import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search,
  Bell,
  Settings,
  User,
  CalendarDays,
  Clock3,
  MessageSquare,
  PhoneCall,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Megaphone,
  CheckCircle2,
  UserCheck,
  UserX,
  LayoutGrid,
  Briefcase,
  ChevronRight,
  Home as HomeIcon,
  Building2,
  PanelLeftClose,
  CalendarRange,
} from "lucide-react";

type NoticeItem = {
  id: number;
  title: string;
  summary: string;
  createdAt: string;
  isImportant?: boolean;
};

type MessengerItem = {
  id: number;
  roomName: string;
  lastMessage: string;
  updatedAt: string;
  unreadCount: number;
  members?: string;
};

type ScheduleItem = {
  id: number;
  title: string;
  time: string;
  tone?: "default" | "blue" | "green" | "orange";
};

type AttendanceCardItem = {
  id: number;
  userId: number;
  name: string;
  status: "출근" | "퇴근" | "미출근";
  time?: string;
  team?: string;
  position?: string;
};

const notices: NoticeItem[] = [
  {
    id: 1,
    title: "3월 마감 일정 확인",
    summary: "승인/정산 전 누락 데이터 및 환불 처리 건을 점검해주세요.",
    createdAt: "오늘",
    isImportant: true,
  },
  {
    id: 2,
    title: "광고폼 신규 운영 시작",
    summary: "광고 유입 건은 상담 DB 반영 여부를 꼭 확인해주세요.",
    createdAt: "오늘",
  },
  {
    id: 3,
    title: "AI 상담 기능 업데이트",
    summary: "전적대 OCR 인식과 과목 정리 기능이 개선되었습니다.",
    createdAt: "어제",
  },
];

const messengerRooms: MessengerItem[] = [
  {
    id: 1,
    roomName: "운영팀",
    lastMessage: "오늘 승인 건 먼저 확인 부탁드립니다.",
    updatedAt: "방금 전",
    unreadCount: 2,
    members: "운영 4명",
  },
  {
    id: 2,
    roomName: "상담팀",
    lastMessage: "신규 문의 3건 들어왔습니다.",
    updatedAt: "12분 전",
    unreadCount: 0,
    members: "상담 6명",
  },
  {
    id: 3,
    roomName: "1:1 · 관리자",
    lastMessage: "정산 리포트 확인 부탁드려요.",
    updatedAt: "35분 전",
    unreadCount: 1,
    members: "1:1 대화",
  },
  {
    id: 4,
    roomName: "실습지원센터",
    lastMessage: "기관 배정표 업데이트 해주세요.",
    updatedAt: "1시간 전",
    unreadCount: 0,
    members: "실습 3명",
  },
];

const todaySchedules: ScheduleItem[] = [
  { id: 1, title: "오전 상담 체크", time: "10:30", tone: "blue" },
  { id: 2, title: "승인 대기 검토", time: "13:00", tone: "green" },
  { id: 3, title: "광고폼 유입 확인", time: "16:00", tone: "orange" },
];

const quickApps = [
  {
    title: "상담 DB",
    desc: "신규 문의와 상담 내역 관리",
    icon: <PhoneCall className="h-5 w-5" />,
    path: "/consultations",
  },
  {
    title: "학생 관리",
    desc: "등록 학생 현황 및 상세 관리",
    icon: <GraduationCap className="h-5 w-5" />,
    path: "/students",
  },
  {
    title: "승인 관리",
    desc: "승인/불승인/대기 처리",
    icon: <ShieldCheck className="h-5 w-5" />,
    path: "/approvals",
  },
  {
    title: "AI 상담",
    desc: "OCR·검색·전적대 입력",
    icon: <Sparkles className="h-5 w-5" />,
    path: "/ai",
  },
  {
    title: "운영 대시보드",
    desc: "매출·환불·상담 지표 확인",
    icon: <BarChart3 className="h-5 w-5" />,
    path: "/overview",
  },
  {
    title: "시스템 관리",
    desc: "기본 설정 및 사용자 관리",
    icon: <Settings className="h-5 w-5" />,
    path: "/system",
  },
];

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
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function AppShortcut({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-3 text-left transition hover:bg-slate-50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function formatClock(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: attendanceRows = [] } = trpc.attendance.list.useQuery();
const { data: userRows = [] } = trpc.users.list.useQuery();

const utils = trpc.useUtils();

const { data: todayAttendanceRow } = trpc.attendance.today.useQuery();

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


  const isManager =
    user?.role === "host" || user?.role === "superhost";

  const todayText = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
  }, []);

  const todayAttendance = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return (attendanceRows as any[]).filter((r) => {
      const workDate = String(r.workDate || "").slice(0, 10);
      return workDate === today;
    });
  }, [attendanceRows]);

const activeUsers = useMemo(() => {
  return (userRows as any[]).filter((u: any) => {
    return !!u?.isActive;
  });
}, [userRows]);

const todayAttendanceByUserId = useMemo(() => {
  const map = new Map<number, any>();

  (todayAttendance as any[]).forEach((row: any) => {
    map.set(Number(row.userId), row);
  });

  return map;
}, [todayAttendance]);

 const myTodayAttendance = useMemo(() => {
  if (!user?.id) return null;

  return (
    todayAttendanceRow ??
    todayAttendanceByUserId.get(Number(user.id)) ??
    null
  );
}, [todayAttendanceRow, todayAttendanceByUserId, user?.id]);


  const attendanceSummary = useMemo(() => {
  if (!isManager) {
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
}, [isManager, activeUsers, todayAttendanceByUserId, myTodayAttendance]);

 
const attendanceListUI = useMemo<AttendanceCardItem[]>(() => {
  if (!isManager) {
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
      time = formatClock(myRow.clockOutAt);
    } else if (myRow.clockInAt) {
      status = "출근";
      time = formatClock(myRow.clockInAt);
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
        time = formatClock(row.clockOutAt);
      } else if (row.clockInAt) {
        status = "출근";
        time = formatClock(row.clockInAt);
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
}, [isManager, user?.id, user?.name, activeUsers, todayAttendanceByUserId, usersById]);

  const visibleAttendanceList = useMemo(() => {
  return attendanceListUI;
}, [attendanceListUI]);



const canClockIn = !myTodayAttendance?.clockInAt;
const canClockOut =
  !!myTodayAttendance?.clockInAt &&
  !myTodayAttendance?.clockOutAt;


  const filteredMessenger = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messengerRooms;
    return messengerRooms.filter(
      (room) =>
        room.roomName.toLowerCase().includes(q) ||
        room.lastMessage.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[28px] border bg-white shadow-sm">
        <div className="flex min-h-[calc(100vh-150px)]">
          <aside className="hidden w-[72px] shrink-0 border-r bg-[#0ea5b7] text-white lg:flex lg:flex-col lg:items-center lg:py-4">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <PanelLeftClose className="h-5 w-5" />
            </div>

            <div className="flex flex-1 flex-col items-center gap-3">
              <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0ea5b7] shadow-sm">
                <HomeIcon className="h-5 w-5" />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15">
                <MessageSquare className="h-5 w-5" />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15">
                <Bell className="h-5 w-5" />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15">
                <CalendarDays className="h-5 w-5" />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15">
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15">
                <Building2 className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-auto flex flex-col items-center gap-3">
              <button className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/15">
                <Settings className="h-5 w-5" />
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                {user?.name?.[0] ?? "U"}
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col bg-[#f7f9fc]">
            <div className="border-b bg-white px-4 py-3 md:px-6">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{todayText}</p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight">
                    {user?.name}님, 안녕하세요
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[240px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="메신저 / 공지 검색"
                      className="h-10 w-full rounded-xl border bg-slate-50 pl-9 pr-3 text-sm outline-none ring-0 transition focus:border-primary"
                    />
                  </div>

                  <Button variant="outline" onClick={() => setLocation("/overview")}>
                    운영 대시보드
                  </Button>

                  <button className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white">
                    <Bell className="h-4 w-4" />
                  </button>
                  <button className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white">
                    <Settings className="h-4 w-4" />
                  </button>
                  <button
  onClick={() => setLocation("/my")}
  className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white"
>
  <User className="h-4 w-4" />
</button>
                </div>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-4 md:p-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-col items-center text-center">
                      <button
  onClick={() => setLocation("/my")}
  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold"
>
  {user?.name?.[0] ?? "U"}
</button>
                      <h3 className="mt-3 text-lg font-semibold">{user?.name ?? "-"}</h3>
                      <p className="text-sm text-muted-foreground">
                        {user?.role === "superhost"
                          ? "슈퍼호스트"
                          : user?.role === "host"
                          ? "호스트"
                          : user?.role === "admin"
                          ? "관리자"
                          : "직원"}
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-3 text-center">
                        <p className="text-xs text-muted-foreground">오늘 메일</p>
                        <p className="mt-1 text-lg font-bold">0</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 text-center">
                        <p className="text-xs text-muted-foreground">오늘 일정</p>
                        <p className="mt-1 text-lg font-bold">{todaySchedules.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <SectionTitle
                      icon={<LayoutGrid className="h-4 w-4 text-primary" />}
                      title="바로가기"
                    />

                    <div className="space-y-2">
                      <AppShortcut
                        icon={<PhoneCall className="h-5 w-5" />}
                        label="상담 DB"
                        onClick={() => setLocation("/consultations")}
                      />
                      <AppShortcut
                        icon={<GraduationCap className="h-5 w-5" />}
                        label="학생 관리"
                        onClick={() => setLocation("/students")}
                      />
                      <AppShortcut
                        icon={<ShieldCheck className="h-5 w-5" />}
                        label="승인 관리"
                        onClick={() => setLocation("/approvals")}
                      />
                      <AppShortcut
                        icon={<Sparkles className="h-5 w-5" />}
                        label="AI 상담"
                        onClick={() => setLocation("/ai")}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <SectionTitle
                      icon={<Briefcase className="h-4 w-4 text-primary" />}
                      title="주요 앱"
                    />
                    <div className="space-y-3">
                      {quickApps.slice(0, 4).map((app) => (
                        <button
                          key={app.title}
                          onClick={() => setLocation(app.path)}
                          className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              {app.icon}
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{app.title}</p>
                              <p className="text-xs text-muted-foreground">{app.desc}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-5">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <SectionTitle
                      icon={<Megaphone className="h-4 w-4 text-primary" />}
                      title="공지사항"
                      right={
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                          더보기
                        </Button>
                      }
                    />

                    <div className="space-y-3">
                      {notices.map((notice) => (
                        <div
                          key={notice.id}
                          className="rounded-2xl border bg-white px-4 py-4 transition hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate font-semibold">{notice.title}</p>
                                {notice.isImportant ? (
                                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                                    중요
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {notice.summary}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {notice.createdAt}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <SectionTitle
                        icon={<CalendarRange className="h-4 w-4 text-primary" />}
                        title="일정 / 캘린더"
                      />

                      <div className="rounded-2xl border bg-white p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="font-semibold">2026. 03</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <button>{"<"}</button>
                            <button>{">"}</button>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
                          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                            <div key={d} className="py-1">
                              {d}
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 grid grid-cols-7 gap-2 text-center text-sm">
                          {Array.from({ length: 35 }).map((_, idx) => {
                            const day = idx + 1;
                            return (
                              <div
                                key={idx}
                                className={`flex h-10 items-center justify-center rounded-lg ${
                                  day === 17
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-slate-50"
                                }`}
                              >
                                {day <= 31 ? day : ""}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <SectionTitle
                        icon={<Clock3 className="h-4 w-4 text-primary" />}
                        title="오늘 일정"
                      />

                      <div className="space-y-3">
                        {todaySchedules.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border bg-white px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">{item.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  예정 업무
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
                                {item.time}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <SectionTitle
                      icon={<MessageSquare className="h-4 w-4 text-primary" />}
                      title="최근 메신저"
                      right={
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                          전체 보기
                        </Button>
                      }
                    />

                    <div className="space-y-3">
                      {filteredMessenger.map((room) => (
                        <button
                          key={room.id}
                          className="flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-4 text-left transition hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-semibold">{room.roomName}</p>
                              {room.unreadCount > 0 ? (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                                  {room.unreadCount}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-sm text-muted-foreground">
                              {room.lastMessage}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {room.members}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {room.updatedAt}
                          </span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-5">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <SectionTitle
  icon={<Clock3 className="h-4 w-4 text-primary" />}
  title="오늘 출퇴근"
/>

<div className="mb-3 grid grid-cols-3 gap-2">
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

  <Button
    variant="secondary"
    onClick={() => setLocation("/attendance")}
  >
    기록부
  </Button>
</div>

                    {isManager ? (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                            <p className="text-xs text-muted-foreground">출근</p>
                            <p className="mt-1 text-xl font-bold text-emerald-600">
                              {attendanceSummary.checkedIn}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3 text-center">
                            <p className="text-xs text-muted-foreground">퇴근</p>
                            <p className="mt-1 text-xl font-bold text-slate-700">
                              {attendanceSummary.checkedOut}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-red-50 p-3 text-center">
                            <p className="text-xs text-muted-foreground">미출근</p>
                            <p className="mt-1 text-xl font-bold text-red-600">
                              {attendanceSummary.absent}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          {visibleAttendanceList.length === 0 ? (
                            <div className="rounded-xl border bg-white px-3 py-3 text-sm text-muted-foreground">
                              오늘 등록된 근태 기록이 없습니다.
                            </div>
                          ) : (
                            visibleAttendanceList.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between rounded-xl border bg-white px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  {item.status === "출근" ? (
                                    <UserCheck className="h-4 w-4 text-emerald-600" />
                                  ) : item.status === "퇴근" ? (
                                    <CheckCircle2 className="h-4 w-4 text-slate-600" />
                                  ) : (
                                    <UserX className="h-4 w-4 text-red-500" />
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{item.name}</p>
                                    <p className="text-[11px] text-muted-foreground">
  {[item.team, item.position].filter(Boolean).join(" · ")}
</p>
                                  </div>
                                </div>
                                <span className="text-xs text-muted-foreground">
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
  <p className="text-xs text-muted-foreground">오늘 상태</p>
  <p className="mt-1 text-lg font-bold">
    {myTodayAttendance?.status || "출근전"}
  </p>
  <p className="mt-1 text-xs text-muted-foreground">
    {attendanceListUI[0]
      ? [attendanceListUI[0].team, attendanceListUI[0].position]
          .filter(Boolean)
          .join(" · ")
      : "-"}
  </p>
  <p className="mt-2 text-[11px] text-muted-foreground">
    {myTodayAttendance?.clockInAt
      ? `출근 ${formatClock(myTodayAttendance.clockInAt)}`
      : "아직 출근하지 않았습니다."}
    {myTodayAttendance?.clockOutAt
      ? ` · 퇴근 ${formatClock(myTodayAttendance.clockOutAt)}`
      : ""}
  </p>
</div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs text-muted-foreground">출근 시간</p>
                            <p className="mt-1 text-sm font-semibold">
                              {formatClock(myTodayAttendance?.clockInAt) || "-"}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs text-muted-foreground">퇴근 시간</p>
                            <p className="mt-1 text-sm font-semibold">
                              {formatClock(myTodayAttendance?.clockOutAt) || "-"}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs text-muted-foreground">근무 시간</p>
                          <p className="mt-1 text-sm font-semibold">
                            {myTodayAttendance?.workMinutes
                              ? `${Math.floor(Number(myTodayAttendance.workMinutes) / 60)}시간 ${Number(myTodayAttendance.workMinutes) % 60}분`
                              : "-"}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}