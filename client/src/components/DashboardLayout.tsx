import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import Login from "@/components/Login";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";
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
  Settings,
  Award,
  Briefcase,
  Sparkles,
  Crown,
  Building2,
  Palette,
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

type UserRole = "staff" | "admin" | "host" | "superhost";

type MenuItem = {
  icon: any;
  label: string;
  path: string;
};

const staffMenuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "대시보드", path: "/" },
  { icon: PhoneCall, label: "상담 DB", path: "/consultations" },
  { icon: GraduationCap, label: "학생 관리", path: "/students" },
  { icon: CalendarDays, label: "학기별 예정표", path: "/semesters" },
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

/**
 * superhost 전용 메뉴
 * host/admin/staff 에게는 절대 노출되지 않음
 */
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  const { loading, user, logout } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

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

  /**
   * 권한 원칙
   * - staff: staff 메뉴만
   * - admin: staff + admin
   * - host: staff + admin + host
   * - superhost: superhost 전용 메뉴만 (host 영역과 분리)
   *
   * 즉 superhost는 host 메뉴를 굳이 공유하지 않게 해서
   * 시스템상 "총관리자 전용 공간" 느낌으로 분리
   */
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

  const activeMenuItem = allMenuItems.find((item) => {
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
                  className="h-10 font-normal transition-all"
                >
                  <item.icon
                    className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                  />
                  <span>{item.label}</span>
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
            {renderMenuSection(visibleAdminMenuItems, "관리자")}
            {renderMenuSection(visibleHostMenuItems, "호스트")}
            {renderMenuSection(visibleSuperhostMenuItems, "슈퍼호스트")}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group-data-[collapsible=icon]:justify-center flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 shrink-0 border">
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
          </div>
        </div>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
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