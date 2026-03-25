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
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const staffMenuItems = [
  { icon: LayoutDashboard, label: "대시보드", path: "/" },
  { icon: PhoneCall, label: "상담 DB", path: "/consultations" },
  { icon: GraduationCap, label: "학생 관리", path: "/students" },
  { icon: CalendarDays, label: "학기별 예정표", path: "/semesters" },
];

const adminMenuItems = [
  { icon: ShieldCheck, label: "승인 관리", path: "/approvals" },
  { icon: Calculator, label: "정산 리포트", path: "/settlement" },
  { icon: Award, label: "민간자격증", path: "/private-certificate-center" },
  { icon: GraduationCap, label: "실습배정지원센터", path: "/practice-support-center" },
  { icon: Briefcase, label: "취업지원센터", path: "/job-support-center" },
];

const hostMenuItems = [
  { icon: Settings, label: "시스템 관리", path: "/system" },
  { icon: GraduationCap, label: "교육원 관리", path: "/education-institutions" },
  { icon: PhoneCall, label: "문자 발송", path: "/sms" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

type AuthUser = {
  id: number;
  username: string;
  role: "host" | "admin" | "staff";
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
        user={user}
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
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const isHost = user?.role === "host";
  const isAdmin = user?.role === "admin";
  const isAdminOrHost = isAdmin || isHost;

  const allMenuItems = [
    ...staffMenuItems,
    ...(isAdminOrHost ? adminMenuItems : []),
    ...(isHost ? hostMenuItems : []),
  ];

  const activeMenuItem = allMenuItems.find((item) => {
    if (item.path === "/") return location === "/";
    return location.startsWith(item.path);
  });

  const notificationQuery = trpc.notification.list.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      void notificationQuery.refetch();
    },
  });

  const notifications = (notificationQuery.data ?? []) as NotificationItem[];

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

  const renderMenuSection = (
    items: { icon: any; label: string; path: string }[],
    title?: string
  ) => {
    if (items.length === 0) return null;

    return (
      <>
        {title && !isCollapsed && (
          <div className="px-4 py-2 mt-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                  className="h-10 transition-all font-normal"
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

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>

              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-bold tracking-tight truncate text-sm">
                    위드원 교육 CRM
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {renderMenuSection(staffMenuItems)}
            {isAdminOrHost && renderMenuSection(adminMenuItems, "관리자")}
            {isHost && renderMenuSection(hostMenuItems, "호스트")}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {user?.role === "host" ? (
                        <span className="inline-flex items-center gap-1">
                          <BadgeCheck className="h-3 w-3" />
                          호스트
                        </span>
                      ) : user?.role === "admin" ? (
                        <span className="inline-flex items-center gap-1">
                          <BadgeCheck className="h-3 w-3" />
                          관리자
                        </span>
                      ) : (
                        "직원"
                      )}
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
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${
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
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-3 md:px-6 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
          <div className="flex items-center gap-2">
            {isMobile ? (
              <>
                <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
                <span className="tracking-tight text-foreground font-medium">
                  {activeMenuItem?.label ?? "메뉴"}
                </span>
              </>
            ) : (
              <span className="tracking-tight text-foreground font-medium">
                {activeMenuItem?.label ?? "대시보드"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-background hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="알림"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="px-3 py-2 border-b">
                  <p className="text-sm font-semibold">알림</p>
                  <p className="text-xs text-muted-foreground">
                    최근 상담 알림을 확인할 수 있습니다.
                  </p>
                </div>

                <div className="max-h-[360px] overflow-y-auto">
                  {notificationQuery.isLoading ? (
                    <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                      알림 불러오는 중...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                      알림이 없습니다.
                    </div>
                  ) : (
                    notifications.slice(0, 15).map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => void handleNotificationClick(item)}
                        className="flex flex-col items-start gap-1 px-3 py-3 cursor-pointer rounded-none border-b last:border-b-0"
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <span
                            className={`text-sm ${
                              item.isRead ? "font-normal text-muted-foreground" : "font-semibold"
                            }`}
                          >
                            {item.message}
                          </span>
                          {!item.isRead && (
                            <span className="mt-1 h-2 w-2 rounded-full bg-red-500 shrink-0" />
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