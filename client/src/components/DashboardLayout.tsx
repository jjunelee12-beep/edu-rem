import { useAuth } from "@/_core/hooks/useAuth";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import Login from "@/components/Login";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

import {
  Bell,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  PhoneCall,
  GraduationCap,
  ShieldCheck,
  Calculator,
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  Settings,
  Award,
  Briefcase,
  Sparkles,
  Crown,
  Building2,
  Palette,
  BarChart3,
  MessageSquare,
  Megaphone,
  User,
  X,
  ChevronRight,
  ChevronDown,
  FileCheck2,
} from "lucide-react";

type UserRole = "staff" | "admin" | "host" | "superhost";

type MenuItem = {
  icon: any;
  label: string;
  path: string;
};

const staffMenuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "홈", path: "/" },
  { icon: BarChart3, label: "운영 대시보드", path: "/overview" },
  { icon: PhoneCall, label: "상담 DB", path: "/consultations" },
  { icon: GraduationCap, label: "학생 관리", path: "/students" },
  { icon: CalendarDays, label: "학기별 예정표", path: "/semesters" },
  { icon: Megaphone, label: "공지사항", path: "/notices" },
  { icon: CalendarRange, label: "일정 / 캘린더", path: "/schedules" },
];

const adminMenuItems: MenuItem[] = [
  { icon: ShieldCheck, label: "승인 관리", path: "/approvals" },
  { icon: Calculator, label: "정산 리포트", path: "/settlement" },
  { icon: Award, label: "민간자격증", path: "/private-certificate-center" },
  { icon: GraduationCap, label: "실습배정지원센터", path: "/practice-support-center" },
  { icon: Briefcase, label: "취업지원센터", path: "/job-support-center" },
];

const hostMenuItems: MenuItem[] = [
  { icon: Settings, label: "시스템 관리", path: "/system" },
  { icon: GraduationCap, label: "교육원 관리", path: "/education-institutions" },
  { icon: PhoneCall, label: "문자 발송", path: "/sms" },
  { icon: Sparkles, label: "AI 상담", path: "/ai" },
];

const superhostMenuItems: MenuItem[] = [
  { icon: Crown, label: "슈퍼호스트 대시보드", path: "/superhost" },
  { icon: Building2, label: "테넌트 관리", path: "/superhost/tenants" },
  { icon: Palette, label: "레이아웃 빌더", path: "/superhost/layout-builder" },
  { icon: Sparkles, label: "AI 정책 관리", path: "/superhost/ai-policy" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

type AuthUser = {
  id: number;
  username: string;
  role: UserRole;
  name?: string;
profileImageUrl?: string | null;
};

type NotificationItem = {
  id: number;
  userId: number;
  type?: string | null;
  message: string;
  relatedId?: number | null;
  isRead: boolean;
  createdAt?: string | Date;
};

type RightDockTab = "channels" | "profile" | "settings";

type MessengerRoom = {
  id: number;
  name: string;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
  members?: string;
};

type ChatMessage = {
  id: number;
  sender: string;
  content: string;
  time: string;
  mine?: boolean;
};

const messengerRooms: MessengerRoom[] = [
  {
    id: 1,
    name: "운영팀",
    lastMessage: "오늘 승인 건 먼저 확인 부탁드립니다.",
    unreadCount: 2,
    updatedAt: "방금 전",
    members: "운영 4명",
  },
  {
    id: 2,
    name: "상담팀",
    lastMessage: "신규 문의 3건 들어왔습니다.",
    unreadCount: 0,
    updatedAt: "12분 전",
    members: "상담 6명",
  },
  {
    id: 3,
    name: "1:1 · 관리자",
    lastMessage: "정산 리포트 확인 부탁드려요.",
    unreadCount: 1,
    updatedAt: "35분 전",
    members: "1:1 대화",
  },
  {
    id: 4,
    name: "실습지원센터",
    lastMessage: "기관 배정표 업데이트 해주세요.",
    unreadCount: 0,
    updatedAt: "1시간 전",
    members: "실습 3명",
  },
];

const mockMessagesByRoom: Record<number, ChatMessage[]> = {
  1: [
    { id: 1, sender: "김민지", content: "오늘 승인 건 먼저 확인 부탁드립니다.", time: "10:20" },
    { id: 2, sender: "나", content: "네, 오전 안에 확인해둘게요.", time: "10:24", mine: true },
    { id: 3, sender: "박지훈", content: "환불 건도 같이 보면 좋겠습니다.", time: "10:26" },
  ],
  2: [
    { id: 1, sender: "최서연", content: "신규 문의 3건 들어왔습니다.", time: "09:40" },
    { id: 2, sender: "나", content: "상담 DB 반영 상태 먼저 확인할게요.", time: "09:43", mine: true },
  ],
  3: [
    { id: 1, sender: "관리자", content: "정산 리포트 확인 부탁드려요.", time: "11:02" },
    { id: 2, sender: "나", content: "네 확인 후 바로 말씀드리겠습니다.", time: "11:05", mine: true },
  ],
  4: [
    { id: 1, sender: "이서윤", content: "기관 배정표 업데이트 해주세요.", time: "13:10" },
    { id: 2, sender: "나", content: "오후에 최신본으로 반영하겠습니다.", time: "13:14", mine: true },
  ],
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed)) {
        setSidebarWidth(parsed);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  const { loading, user, logout } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <Login />;

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent
        user={user as AuthUser}
        logout={logout}
        setSidebarWidth={setSidebarWidth}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  user: AuthUser;
  logout: () => Promise<void>;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  user,
  logout,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const [location, setLocation] = useLocation();
  const [rightDockTab, setRightDockTab] = useState<RightDockTab>("channels");
  const [isChatSlideOpen, setIsChatSlideOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<MessengerRoom | null>(null);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    const handlePushOpen = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail || {};

      console.log("[WEB PUSH OPEN EVENT]", detail);

      if (detail.type === "lead") {
        setLocation("/consultations");
        return;
      }

      setLocation("/consultations");
    };

    window.addEventListener("push-open", handlePushOpen as EventListener);

    return () => {
      window.removeEventListener("push-open", handlePushOpen as EventListener);
    };
  }, [setLocation]);

  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const isStaff = user?.role === "staff";
  const isAdmin = user?.role === "admin";
  const isHost = user?.role === "host";
  const isSuperhost = user?.role === "superhost";

const canViewApprovalInbox = isAdmin || isHost || isSuperhost;
const canViewApprovalStats = isAdmin || isHost || isSuperhost;
const canViewApprovalSettings = isSuperhost;

const isEApprovalPath =
  location === "/e-approval" || location.startsWith("/e-approval/");

const [eApprovalMenuOpen, setEApprovalMenuOpen] = useState(isEApprovalPath);

useEffect(() => {
  if (isEApprovalPath) {
    setEApprovalMenuOpen(true);
  }
}, [isEApprovalPath]);

const eApprovalSubMenus = useMemo(() => {
  const items = [
    { label: "문서함", href: "/e-approval" },
    { label: "근태", href: "/e-approval/attendance" },
    { label: "출장", href: "/e-approval/business-trip" },
    { label: "일반", href: "/e-approval/general" },
  ];

  if (canViewApprovalInbox) {
    items.push({ label: "전자결재 승인", href: "/e-approval/inbox" });
  }

  if (canViewApprovalStats) {
    items.push({ label: "통계", href: "/e-approval/stats" });
  }

  if (canViewApprovalSettings) {
    items.push({ label: "전자결재 설정", href: "/e-approval/settings" });
  }

  return items;
}, [canViewApprovalInbox, canViewApprovalStats, canViewApprovalSettings]);

  const visibleStaffMenuItems =
  isStaff || isAdmin || isHost || isSuperhost ? staffMenuItems : [];

const visibleAdminMenuItems =
  isAdmin || isHost || isSuperhost ? adminMenuItems : [];

const visibleHostMenuItems =
  isHost || isSuperhost ? hostMenuItems : [];

const visibleSuperhostMenuItems =
  isSuperhost ? superhostMenuItems : [];

  const allMenuItems = [
    ...visibleStaffMenuItems,
    ...visibleAdminMenuItems,
    ...visibleHostMenuItems,
    ...visibleSuperhostMenuItems,
  ];

const activeEApprovalMenuItem = eApprovalSubMenus.find(
  (item) => location === item.href
);

const activeMenuItem = activeEApprovalMenuItem
  ? { label: activeEApprovalMenuItem.label, path: activeEApprovalMenuItem.href }
  : allMenuItems.find((item) => {
      if (item.path === "/") return location === "/";
      return location.startsWith(item.path);
    });

  const notificationEnabled = !isSuperhost;

  const notificationQuery = trpc.notification.list.useQuery(undefined, {
    refetchInterval: notificationEnabled ? 10000 : false,
    enabled: notificationEnabled,
  });

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      if (notificationEnabled) {
        void notificationQuery.refetch();
      }
    },
  });

  const notifications = notificationEnabled
    ? ((notificationQuery.data ?? []) as NotificationItem[])
    : [];

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.isRead).length;
  }, [notifications]);

  const currentMessages = useMemo(() => {
    if (!selectedChannel) return [];
    return mockMessagesByRoom[selectedChannel.id] ?? [];
  }, [selectedChannel]);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const renderMenuSection = (items: MenuItem[], title?: string) => {
    if (items.length === 0) return null;

    return (
      <>
        {title && !isCollapsed && (
          <div className="mt-2 px-4 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
          </div>
        )}

        <SidebarMenu className="px-2 py-1">
          {items.map((item) => {
            const isActive =
              item.path === "/"
                ? location === "/"
                : location.startsWith(item.path);

            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
  isActive={isActive}
  onClick={() => setLocation(item.path)}
  tooltip={item.label}
  className="h-10 min-w-0 font-normal transition-all"
>
  <item.icon
    className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`}
  />
  <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">
    {item.label}
  </span>
</SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </>
    );
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await markReadMutation.mutateAsync({ id: item.id });
      } catch (e) {
        console.error("[notification.markRead] failed:", e);
      }
    }

    if (item.relatedId) {
      setLocation("/consultations");
      return;
    }

    setLocation("/consultations");
  };

  const roleLabel = isSuperhost
    ? "슈퍼호스트"
    : isHost
    ? "호스트"
    : isAdmin
    ? "관리자"
    : "직원";

  const handleOpenChannel = (room: MessengerRoom) => {
    setSelectedChannel(room);
    setIsChatSlideOpen(true);
    setRightDockTab("channels");
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setChatInput("");
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex w-full items-center gap-3 px-2 transition-all">
              <button
                onClick={toggleSidebar}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>

              {!isCollapsed ? (
                <div className="flex min-w-0 items-center gap-2">
                  {isSuperhost ? (
                    <Crown className="h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
                  )}
                  <span className="truncate text-sm font-bold tracking-tight">
                    {isSuperhost ? "위드원 교육 CRM · SUPERHOST" : "위드원 교육 CRM"}
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
  {renderMenuSection(visibleStaffMenuItems)}

 <SidebarMenu className="px-2 py-1">
  <SidebarMenuItem>
    <SidebarMenuButton
      isActive={isEApprovalPath}
      onClick={() => setEApprovalMenuOpen((prev) => !prev)}
      tooltip="전자결재"
      className="h-10 min-w-0 justify-between font-normal transition-all"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <FileCheck2
          className={`h-4 w-4 shrink-0 ${isEApprovalPath ? "text-primary" : ""}`}
        />
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">
          전자결재
        </span>
      </div>

      {!isCollapsed &&
        (eApprovalMenuOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        ))}
    </SidebarMenuButton>

    {!isCollapsed && eApprovalMenuOpen && (
      <SidebarMenuSub>
        {eApprovalSubMenus.map((item) => {
          const isActive = location === item.href;

          return (
            <SidebarMenuSubItem key={item.href}>
              <SidebarMenuSubButton
                type="button"
                isActive={isActive}
                size="md"
                onClick={() => setLocation(item.href)}
              >
                <span className="truncate">{item.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          );
        })}
      </SidebarMenuSub>
    )}
  </SidebarMenuItem>
</SidebarMenu>

  {renderMenuSection(visibleAdminMenuItems, "관리자")}
  {renderMenuSection(visibleHostMenuItems, "호스트")}
  {renderMenuSection(visibleSuperhostMenuItems, "슈퍼호스트")}
</SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group-data-[collapsible=icon]:justify-center flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 shrink-0 border">
  <AvatarImage src={user?.profileImageUrl || ""} alt={user?.name || "user"} />
  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
    {user?.name?.charAt(0).toUpperCase() || "U"}
  </AvatarFallback>
</Avatar>
                  <div className="group-data-[collapsible=icon]:hidden min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <BadgeCheck className="h-3 w-3" />
                        {roleLabel}
                      </span>
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    void logout();
                  }}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/20 ${
            isCollapsed ? "hidden" : ""
          }`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <div className="supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            {isMobile ? (
              <>
                <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
                <span className="font-medium tracking-tight text-foreground">
                  {activeMenuItem?.label ?? (isSuperhost ? "슈퍼호스트" : "메뉴")}
                </span>
              </>
            ) : (
              <span className="font-medium tracking-tight text-foreground">
                {activeMenuItem?.label ?? (isSuperhost ? "슈퍼호스트" : "메뉴")}
              </span>
            )}
          </div>

          {isSuperhost && (
            <>
              {location.startsWith("/superhost") ? (
                <button
                  onClick={() => setLocation("/")}
                  className="inline-flex h-9 items-center justify-center rounded-lg border bg-background px-3 text-sm transition-colors hover:bg-accent"
                >
                  일반 CRM으로 돌아가기
                </button>
              ) : (
                <button
                  onClick={() => setLocation("/superhost")}
                  className="inline-flex h-9 items-center justify-center rounded-lg border bg-background px-3 text-sm transition-colors hover:bg-accent"
                >
                  슈퍼호스트 콘솔
                </button>
              )}
            </>
          )}

          <div className="flex items-center gap-2">
            {!isSuperhost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-background transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="알림"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-80 p-0">
                  <div className="border-b px-3 py-2">
                    <p className="text-sm font-semibold">알림</p>
                    <p className="text-xs text-muted-foreground">
                      최근 상담 알림을 확인할 수 있습니다.
                    </p>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto">
                    {notificationQuery.isLoading ? (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        알림 불러오는 중...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        알림이 없습니다.
                      </div>
                    ) : (
                      notifications.slice(0, 15).map((item) => (
                        <DropdownMenuItem
                          key={item.id}
                          onClick={() => void handleNotificationClick(item)}
                          className="flex cursor-pointer flex-col items-start gap-1 rounded-none border-b px-3 py-3 last:border-b-0"
                        >
                          <div className="flex w-full items-start justify-between gap-2">
                            <span
                              className={`text-sm ${
                                item.isRead
                                  ? "font-normal text-muted-foreground"
                                  : "font-semibold"
                              }`}
                            >
                              {item.message}
                            </span>
                            {!item.isRead && (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {formatNotificationDate(item.createdAt)}
                          </span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <button
              onClick={() => setRightDockTab("channels")}
              className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm transition-colors ${
                rightDockTab === "channels" ? "bg-accent" : "bg-background hover:bg-accent"
              }`}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              채널
            </button>

            <button
              onClick={() => setRightDockTab("profile")}
              className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm transition-colors ${
                rightDockTab === "profile" ? "bg-accent" : "bg-background hover:bg-accent"
              }`}
            >
              <User className="mr-2 h-4 w-4" />
              기본정보
            </button>

            <button
              onClick={() => setRightDockTab("settings")}
              className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm transition-colors ${
                rightDockTab === "settings" ? "bg-accent" : "bg-background hover:bg-accent"
              }`}
            >
              <Settings className="mr-2 h-4 w-4" />
              설정
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>

          {!isMobile && (
            <aside className="hidden w-[320px] shrink-0 border-l bg-background xl:flex xl:flex-col">
              <div className="flex h-14 items-center justify-between border-b px-4">
                <div className="flex items-center gap-2">
                  {rightDockTab === "channels" && <MessageSquare className="h-4 w-4" />}
                  {rightDockTab === "profile" && <User className="h-4 w-4" />}
                  {rightDockTab === "settings" && <Settings className="h-4 w-4" />}
                  <span className="font-semibold">
                    {rightDockTab === "channels"
                      ? "채널 리스트"
                      : rightDockTab === "profile"
                      ? "기본정보"
                      : "환경설정"}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {rightDockTab === "channels" && (
                  <div className="space-y-3">
                    {messengerRooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => handleOpenChannel(room)}
                        className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition hover:bg-accent/40"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">{room.name}</p>
                            {room.unreadCount > 0 && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                                {room.unreadCount}
                              </span>
                            )}
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

                    <button
                      onClick={() => setLocation("/messenger")}
                      className="flex w-full items-center justify-center rounded-xl border px-3 py-3 text-sm font-medium transition hover:bg-accent"
                    >
                      메신저 전체 보기
                    </button>
                  </div>
                )}

                {rightDockTab === "profile" && (
                  <div className="space-y-3">
                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-muted-foreground">이름</p>
                      <p className="mt-1 font-semibold">{user?.name || "-"}</p>
                    </div>

                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-muted-foreground">권한</p>
                      <p className="mt-1 font-semibold">{roleLabel}</p>
                    </div>

                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-muted-foreground">아이디</p>
                      <p className="mt-1 font-semibold">
                        {"username" in (user ?? {}) ? (user as any).username : "-"}
                      </p>
                    </div>

                    <button
                      onClick={() => setLocation("/system")}
                      className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition hover:bg-accent/40"
                    >
                      <div>
                        <p className="text-sm font-semibold">시스템 관리</p>
                        <p className="text-xs text-muted-foreground">
                          사용자 및 기본 설정 확인
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {rightDockTab === "settings" && (
                  <div className="space-y-3">
                    <button className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition hover:bg-accent/40">
                      <div>
                        <p className="text-sm font-semibold">알림 설정</p>
                        <p className="text-xs text-muted-foreground">
                          상담/승인/환불 알림 관리
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>

                    <button className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition hover:bg-accent/40">
                      <div>
                        <p className="text-sm font-semibold">홈 화면 설정</p>
                        <p className="text-xs text-muted-foreground">
                          대시보드 및 홈 구성 제어
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>

                    <button className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition hover:bg-accent/40">
                      <div>
                        <p className="text-sm font-semibold">보안 설정</p>
                        <p className="text-xs text-muted-foreground">
                          접근 정책 및 계정 보안 관리
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </SidebarInset>

      {isChatSlideOpen && selectedChannel && !isMobile && (
        <aside className="fixed right-0 top-14 z-50 h-[calc(100vh-56px)] w-[420px] border-l bg-background shadow-2xl">
          <div className="flex h-14 items-center justify-between border-b px-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">{selectedChannel.name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedChannel.members || "채널 대화"}
              </p>
            </div>

            <button
              onClick={() => setIsChatSlideOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex h-[calc(100%-56px)] flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {currentMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.mine
                        ? "bg-primary text-primary-foreground"
                        : "border bg-white"
                    }`}
                  >
                    {!message.mine && (
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">
                        {message.sender}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <p
                      className={`mt-2 text-[11px] ${
                        message.mine
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      {message.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t p-4">
              <div className="flex items-end gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="메시지를 입력하세요"
                  className="min-h-[44px] flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={handleSendMessage}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  전송
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

function formatNotificationDate(value?: string | Date) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}