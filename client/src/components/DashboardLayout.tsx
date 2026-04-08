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
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";
import { pushAppToast } from "@/lib/appNotifications";
import { useIsMobile } from "@/hooks/useMobile";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import MessengerPage from "@/pages/MessengerPage";

import {
 readAppNotificationSettings,
 isNowInDndRange,
} from "@/lib/notificationSettings";

import {
 Bell,
 LayoutDashboard,
 LogOut,
 PanelLeft,
 PhoneCall,
 GraduationCap,
 ShieldCheck,
 Calculator,
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
 {
 icon: GraduationCap,
 label: "실습배정지원센터",
 path: "/practice-support-center",
 },
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
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

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
 title?: string | null;
 level?: string | null;
 message: string;
 imageUrl?: string | null;
 relatedId?: number | null;
 isRead: boolean;
 createdAt?: string | Date;
};

export default function DashboardLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);

 useEffect(() => {
 const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
 if (!saved) return;

 const parsed = parseInt(saved, 10);
 if (!Number.isNaN(parsed)) {
 setSidebarWidth(parsed);
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
 const [isMessengerOpen, setIsMessengerOpen] = useState(false);
 const [openedRoomIds, setOpenedRoomIds] = useState<number[]>([]);
 const shownToastIdsRef = useRef<Set<number>>(new Set());
 const didInitToastRef = useRef(false);
 const [appNotificationSettings, setAppNotificationSettings] = useState(() =>
 readAppNotificationSettings()
 );

 const { data: myProfile, refetch: refetchMyProfile } =
 trpc.users.me.useQuery();
 const { data: branding } = trpc.branding.get.useQuery();
 const utils = trpc.useUtils();

 const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
 /\/$/,
 ""
 );

 const normalizeProfileImageUrl = (raw?: string | null) => {
 if (!raw) return "";
 if (
 raw.startsWith("http://") ||
 raw.startsWith("https://") ||
 raw.startsWith("data:")
 ) {
 return raw;
 }
 if (raw.startsWith("//")) return `https:${raw}`;
 if (!API_BASE_URL) return raw;
 return raw.startsWith("/")
 ? `${API_BASE_URL}${raw}`
 : `${API_BASE_URL}/${raw}`;
 };

 const companyName = branding?.companyName || "위드원 교육";
 const companySubtitle = branding?.messengerSubtitle || "사내 메신저";
 const companyLogoUrl = normalizeAssetUrl(branding?.companyLogoUrl || "");

 useEffect(() => {
 const saved = localStorage.getItem("messenger-open");
 if (saved === "true") {
 setIsMessengerOpen(true);
 }
 }, []);

 useEffect(() => {
 localStorage.setItem("messenger-open", String(isMessengerOpen));
 }, [isMessengerOpen]);

 useEffect(() => {
 window.dispatchEvent(
 new CustomEvent("messenger:main-open-changed", {
 detail: { isOpen: isMessengerOpen },
 })
 );
 }, [isMessengerOpen]);

 useEffect(() => {
 const handleOpenedRoomsChanged = (event: Event) => {
 const customEvent = event as CustomEvent;
 const roomIds = Array.isArray(customEvent.detail?.roomIds)
 ? customEvent.detail.roomIds
 .map((id: unknown) => Number(id))
 .filter((id: number) => Number.isFinite(id) && id > 0)
 : [];

 setOpenedRoomIds(roomIds);
 };

 window.addEventListener(
 "messenger:opened-rooms-changed",
 handleOpenedRoomsChanged as EventListener
 );

 return () => {
 window.removeEventListener(
 "messenger:opened-rooms-changed",
 handleOpenedRoomsChanged as EventListener
 );
 };
 }, []);

 useEffect(() => {
 const syncSettings = () => {
 setAppNotificationSettings(readAppNotificationSettings());
 };

 syncSettings();
 window.addEventListener("app:notification-settings-changed", syncSettings);

 return () => {
 window.removeEventListener(
 "app:notification-settings-changed",
 syncSettings
 );
 };
 }, []);

 useEffect(() => {
 const handleOpenMessenger = () => setIsMessengerOpen(true);
 const handleCloseMessenger = () => setIsMessengerOpen(false);

 window.addEventListener("open-messenger", handleOpenMessenger);
 window.addEventListener(
 "messenger:request-close-main",
 handleCloseMessenger
 );

 return () => {
 window.removeEventListener("open-messenger", handleOpenMessenger);
 window.removeEventListener(
 "messenger:request-close-main",
 handleCloseMessenger
 );
 };
 }, []);

 useEffect(() => {
 const handleProfileImageUpdated = () => {
 void refetchMyProfile();
 };

 window.addEventListener("profile-image-updated", handleProfileImageUpdated);

 return () => {
 window.removeEventListener(
 "profile-image-updated",
 handleProfileImageUpdated
 );
 };
 }, [refetchMyProfile]);

 useEffect(() => {
 const handleBrandingUpdated = () => {
 void utils.branding.get.invalidate();
 };

 window.addEventListener("branding:updated", handleBrandingUpdated);

 return () => {
 window.removeEventListener("branding:updated", handleBrandingUpdated);
 };
 }, [utils]);

 useEffect(() => {
 const handlePushOpen = (event: Event) => {
 const customEvent = event as CustomEvent;
 const detail = customEvent.detail || {};

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

 const { state, toggleSidebar, setOpen } = useSidebar();

useEffect(() => {
  const handleAutoCollapse = () => {
    const viewportWidth = window.innerWidth;

    if (viewportWidth <= 1400) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  };

  handleAutoCollapse();
  window.addEventListener("resize", handleAutoCollapse);

  return () => {
    window.removeEventListener("resize", handleAutoCollapse);
  };
}, [setOpen]);

 const isCollapsed = state === "collapsed";
 const [isResizing, setIsResizing] = useState(false);
 const sidebarRef = useRef<HTMLDivElement>(null);
const sidebarContentRef = useRef<HTMLDivElement | null>(null);
const eApprovalMenuRef = useRef<HTMLLIElement | null>(null);
 const isMobile = useIsMobile();

const [isNarrowViewport, setIsNarrowViewport] = useState(false);

useEffect(() => {
  const syncViewport = () => {
    setIsNarrowViewport(window.innerWidth <= 1400);
  };

  syncViewport();
  window.addEventListener("resize", syncViewport);

  return () => {
    window.removeEventListener("resize", syncViewport);
  };
}, []);

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

useEffect(() => {
  if (!eApprovalMenuOpen || isCollapsed) return;

  const timer = window.setTimeout(() => {
    const container = sidebarContentRef.current;
    const target = eApprovalMenuRef.current;

    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const currentScrollTop = container.scrollTop;
    const targetTop = targetRect.top - containerRect.top + currentScrollTop;

    const paddingTop = 12;
    const paddingBottom = 24;

    const nextScrollTop =
      targetTop -
      paddingTop +
      Math.max(0, targetRect.height - container.clientHeight + paddingBottom);

    container.scrollTo({
      top: Math.max(0, nextScrollTop),
      behavior: "smooth",
    });
  }, 120);

  return () => window.clearTimeout(timer);
}, [eApprovalMenuOpen, isCollapsed]);

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
 const visibleHostMenuItems = isHost || isSuperhost ? hostMenuItems : [];
 const visibleSuperhostMenuItems = isSuperhost ? superhostMenuItems : [];

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
 ? {
 label: activeEApprovalMenuItem.label,
 path: activeEApprovalMenuItem.href,
 }
 : allMenuItems.find((item) => {
 if (item.path === "/") return location === "/";
 return location.startsWith(item.path);
 });

 const notificationEnabled = true;

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

 const buildToastAction = (item: NotificationItem) => {
 if (item.type === "messenger" && item.relatedId) {
 return {
 kind: "messenger-room" as const,
 payload: { roomId: Number(item.relatedId) },
 };
 }

 if (item.type === "notice" && item.relatedId) {
 return {
 kind: "notice-detail" as const,
 payload: { noticeId: Number(item.relatedId) },
 };
 }

 if (item.type === "schedule" && item.relatedId) {
 return {
 kind: "schedule-detail" as const,
 payload: { scheduleId: Number(item.relatedId) },
 };
 }

 if (item.type === "lead") {
 return {
 kind: "route" as const,
 payload: { path: "/consultations" },
 };
 }

 if (item.type === "approval" && item.relatedId) {
 return {
 kind: "approval-detail" as const,
 payload: { approvalId: Number(item.relatedId) },
 };
 }

 return {
 kind: "route" as const,
 payload: { path: "/notifications" },
 };
 };

 const unreadCount = useMemo(() => {
 return notifications.filter((item) => !item.isRead).length;
 }, [notifications]);

 const notificationSummary = useMemo(() => {
 const summary = {
 total: notifications.length,
 unread: notifications.filter((item) => !item.isRead).length,
 messenger: notifications.filter((item) => item.type === "messenger")
 .length,
 approval: notifications.filter((item) => item.type === "approval")
 .length,
 notice: notifications.filter((item) => item.type === "notice").length,
 schedule: notifications.filter((item) => item.type === "schedule")
 .length,
 };

 return summary;
 }, [notifications]);

 useEffect(() => {
 if (!notificationEnabled) return;
 if (!notifications.length) return;

 const settings = appNotificationSettings;
 if (!settings.enabled) return;
 if (
 settings.dndEnabled &&
 isNowInDndRange(settings.dndStart, settings.dndEnd)
 ) {
 return;
 }

 const sorted = [...notifications].sort((a, b) => {
 const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
 const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
 return bTime - aTime;
 });

 if (!didInitToastRef.current) {
 sorted.forEach((item) => {
 shownToastIdsRef.current.add(item.id);
 });
 didInitToastRef.current = true;
 return;
 }

 for (const item of sorted) {
 if (item.isRead) continue;
 if (shownToastIdsRef.current.has(item.id)) continue;

 if (item.type === "messenger") {
 shownToastIdsRef.current.add(item.id);
 continue;
 }

 if (item.type === "approval" && !settings.approval) {
 shownToastIdsRef.current.add(item.id);
 continue;
 }

 if (item.type === "notice" && !settings.notice) {
 shownToastIdsRef.current.add(item.id);
 continue;
 }

 if (item.type === "schedule" && !settings.schedule) {
 shownToastIdsRef.current.add(item.id);
 continue;
 }

 shownToastIdsRef.current.add(item.id);

 const category =
 item.type === "notice"
 ? "notice"
 : item.type === "schedule"
 ? "schedule"
 : item.type === "approval"
 ? "approval"
 : "system";

 const level = (item.level as any) || "normal";
	const title = getNotificationTitle(item);

 pushAppToast({
 category,
 level,
 title,
 body: item.message,
 imageUrl: item.imageUrl
 ? normalizeAssetUrl(item.imageUrl)
 : undefined,
 durationMs: 5000,
 action: buildToastAction(item),
 });
 }
 }, [
 notificationEnabled,
 notifications,
 appNotificationSettings,
 ]);

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
 <div className="mt-4 px-3 pb-2 pt-2">
  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
    {title}
  </p>
</div>
 )}

 <SidebarMenu className="px-2 py-1">
 {items.map((item) => {
 const isActive =
 item.path === "/" ? location === "/" : location.startsWith(item.path);

 return (
 <SidebarMenuItem key={item.path}>
 <SidebarMenuButton
 isActive={isActive}
 onClick={() => setLocation(item.path)}
 tooltip={item.label}
 className="min-w-0 font-medium text-black"
 >
 <item.icon
 className={`h-4 w-4 shrink-0 ${
 isActive ? "text-primary" : "text-slate-700"
 }`}
 />
 <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-black">
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

 if (item.type === "messenger" && item.relatedId) {
 setIsMessengerOpen(true);

 window.dispatchEvent(new Event("open-messenger"));
 window.dispatchEvent(
 new CustomEvent("messenger:open-room", {
 detail: { roomId: Number(item.relatedId) },
 })
 );
 return;
 }

 if (item.type === "approval" && item.relatedId) {
 setLocation(`/e-approval/${item.relatedId}`);
 return;
 }

 if (item.type === "notice" && item.relatedId) {
 setLocation(`/notices/${item.relatedId}`);
 return;
 }

 if (item.type === "schedule" && item.relatedId) {
 setLocation(`/schedules`);
 return;
 }

 if (item.type === "lead") {
 setLocation("/consultations");
 return;
 }

 if (item.type === "messenger") {
 setIsMessengerOpen(true);
 window.dispatchEvent(new Event("open-messenger"));
 return;
 }

 if (item.type === "notice") {
 setLocation("/notices");
 return;
 }

 if (item.type === "schedule") {
 setLocation("/schedules");
 return;
 }

 if (item.type === "approval") {
 setLocation("/e-approval");
 return;
 }

 setLocation("/notifications");
 };

 const displayProfileImageUrl = normalizeProfileImageUrl(
 (myProfile as any)?.profileImageUrl || user?.profileImageUrl || ""
 );

 const displayProfileName = (myProfile as any)?.name || user?.name || "-";
 const displayTeamName = (myProfile as any)?.teamName || "팀 미지정";
 const displayPositionName =
 (myProfile as any)?.positionName || "직급 미지정";

 return (
 <>
 <div className="relative" ref={sidebarRef}>
 <Sidebar
  collapsible="icon"
  className="h-screen overflow-hidden border-r-0"
  disableTransition={isResizing}
>
 <SidebarHeader className="h-16 justify-center">
 <div className="flex w-full items-center gap-3 px-1">
 <button
 onClick={toggleSidebar}
 className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-slate-700 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 aria-label="Toggle navigation"
 >
 <PanelLeft className="h-4 w-4" />
 </button>

 {!isCollapsed ? (
 <div className="flex min-w-0 items-center gap-2">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]">
 {companyLogoUrl ? (
 <img
 src={companyLogoUrl}
 alt={companyName}
 className="h-full w-full object-cover"
 />
 ) : isSuperhost ? (
 <Crown className="h-4 w-4 text-primary" />
 ) : (
 <GraduationCap className="h-4 w-4 text-primary" />
 )}
 </div>

 <span className="truncate text-sm font-bold tracking-tight text-black">
 {isSuperhost
 ? `${companyName} CRM · SUPERHOST`
 : `${companyName} CRM`}
 </span>
 </div>
 ) : null}
 </div>
 </SidebarHeader>

 <SidebarContent
  ref={sidebarContentRef}
  className="min-h-0 flex-1 gap-1 overflow-y-auto overflow-x-hidden pb-3"
>
 {renderMenuSection(visibleStaffMenuItems)}

 <SidebarMenu className={`px-2 py-1 ${!isCollapsed && eApprovalMenuOpen ? "pb-5" : ""}`}>
 <SidebarMenuItem ref={eApprovalMenuRef}>
  <SidebarMenuButton
 isActive={isEApprovalPath}
 onClick={() => setEApprovalMenuOpen((prev) => !prev)}
 tooltip="전자결재"
 className="min-w-0 justify-between font-medium text-black"
 >
 <div className="flex min-w-0 flex-1 items-center gap-2">
 <FileCheck2
 className={`h-4 w-4 shrink-0 ${
 isEApprovalPath ? "text-primary" : "text-slate-700"
 }`}
 />
 <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-black">
 전자결재
 </span>
 </div>

 {!isCollapsed &&
 (eApprovalMenuOpen ? (
 <ChevronDown className="h-4 w-4 shrink-0 text-slate-600" />
 ) : (
 <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
 ))}
 </SidebarMenuButton>

 {!isCollapsed && eApprovalMenuOpen && (
 <SidebarMenuSub className="mt-1 mb-5 space-y-1">
 {eApprovalSubMenus.map((item) => {
 const isActive = location === item.href;

 return (
 <SidebarMenuSubItem key={item.href}>
 <SidebarMenuSubButton
 type="button"
 isActive={isActive}
 size="md"
 onClick={() => setLocation(item.href)}
 className="font-medium text-black"
 >
 <span className="truncate text-black">
 {item.label}
 </span>
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

 <SidebarFooter className="shrink-0 pt-2">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <button className="flex w-full items-start gap-3 rounded-2xl bg-white px-3 py-3 text-left transition-colors hover:bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
 <Avatar className="h-9 w-9 shrink-0 border border-slate-200">
 <AvatarImage
 src={displayProfileImageUrl}
 alt={displayProfileName || "user"}
 />
 <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
 {displayProfileName?.charAt(0).toUpperCase() || "U"}
 </AvatarFallback>
 </Avatar>

 <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
 <p className="truncate text-sm font-semibold leading-none text-black">
 {displayProfileName}
 </p>
 <div className="mt-1 text-xs leading-tight text-slate-600">
 <p className="truncate">{displayTeamName}</p>
 <p className="truncate">{displayPositionName}</p>
 </div>
 </div>
 </button>
 </DropdownMenuTrigger>

 <DropdownMenuContent align="end" className="w-48 rounded-2xl">
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
    isCollapsed || isNarrowViewport ? "hidden" : ""
  }`}
 onMouseDown={() => {
 if (isCollapsed) return;
 setIsResizing(true);
 }}
 style={{ zIndex: 50 }}
 />
 </div>

 <SidebarInset>
 <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-black/5 bg-transparent px-4 md:px-6">
 <div className="flex items-center gap-2">
 {isMobile ? (
 <>
 <SidebarTrigger className="h-9 w-9 rounded-2xl bg-white text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.06)]" />
 <span className="font-semibold tracking-tight text-black">
 {activeMenuItem?.label ?? (isSuperhost ? "슈퍼호스트" : "메뉴")}
 </span>
 </>
 ) : (
 <span className="font-semibold tracking-tight text-black">
 {activeMenuItem?.label ?? (isSuperhost ? "슈퍼호스트" : "메뉴")}
 </span>
 )}
 </div>

 {isSuperhost && (
 <>
 {location.startsWith("/superhost") ? (
 <button
 onClick={() => setLocation("/")}
 className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-sm font-medium text-black transition shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07),0_8px_18px_rgba(15,23,42,0.05)]"
 >
 일반 CRM으로 돌아가기
 </button>
 ) : (
 <button
 onClick={() => setLocation("/superhost")}
 className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-sm font-medium text-black transition shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07),0_8px_18px_rgba(15,23,42,0.05)]"
 >
 슈퍼호스트 콘솔
 </button>
 )}
 </>
 )}

 <div className="flex items-center gap-2">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <button
 className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-900 transition hover:bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

 <DropdownMenuContent align="end" className="w-80 rounded-2xl p-0">
 <div className="border-b border-black/5 px-3 py-3">
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-sm font-semibold text-black">
 알림 센터
 </p>
 <p className="text-xs text-slate-500">
 메신저, 전자결재, 공지, 일정 등 최근 알림을 확인할 수 있습니다.
 </p>
 </div>

 <button
 type="button"
 onClick={() => setLocation("/notifications")}
 className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50"
 >
 전체보기
 </button>
 </div>

 <div className="mt-3 flex flex-wrap gap-2">
 <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
 전체 {notificationSummary.total}
 </span>

 <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
 안읽음 {notificationSummary.unread}
 </span>

 <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
 메신저 {notificationSummary.messenger}
 </span>

 <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
 전자결재 {notificationSummary.approval}
 </span>

 <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
 공지 {notificationSummary.notice}
 </span>

 <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700">
 일정 {notificationSummary.schedule}
 </span>
 </div>
 </div>

 <div className="max-h-[360px] overflow-y-auto">
 {notificationQuery.isLoading ? (
 <div className="px-3 py-6 text-center text-sm text-slate-500">
 알림 센터를 불러오는 중...
 </div>
 ) : notifications.length === 0 ? (
 <div className="px-3 py-6 text-center text-sm text-slate-500">
 최근 표시할 알림이 없습니다.
 </div>
 ) : (
 notifications.slice(0, 15).map((item) => {
 const badge = getNotificationBadge(item);
 const title = getNotificationTitle(item);

 return (
 <DropdownMenuItem
 key={item.id}
 onClick={() => void handleNotificationClick(item)}
 className="flex cursor-pointer flex-col items-start gap-2 rounded-none border-b border-black/5 px-3 py-3 last:border-b-0"
 >
 <div className="flex w-full items-start justify-between gap-2">
 <div className="min-w-0 flex-1">
 <div className="mb-1 flex items-center gap-2">
 <span
 className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
 >
 {badge.label}
 </span>

 <span
 className={`truncate text-xs ${
 item.isRead
 ? "font-medium text-slate-500"
 : "font-semibold text-slate-900"
 }`}
 >
 {title}
 </span>
 </div>

 <p
 className={`line-clamp-2 text-sm leading-5 ${
 item.isRead
 ? "font-normal text-slate-500"
 : "font-medium text-slate-900"
 }`}
 >
 {item.message}
 </p>
 </div>

 {!item.isRead && (
 <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
 )}
 </div>

 <span className="text-[11px] text-slate-500">
 {formatNotificationDate(item.createdAt)}
 </span>
 </DropdownMenuItem>
 );
 })
 )}
 </div>
 </DropdownMenuContent>
 </DropdownMenu>

 <button
 onClick={() => setIsMessengerOpen(true)}
 className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-900 transition hover:bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 aria-label="메신저"
 >
 <MessageSquare className="h-4 w-4" />
 </button>

 <button
 onClick={() => setLocation("/my")}
 className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-900 transition hover:bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 aria-label="내 정보"
 >
 <User className="h-4 w-4" />
 </button>

 {(isHost || isSuperhost || isAdmin) && (
 <button
 onClick={() => setLocation("/system")}
 className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-900 transition hover:bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 aria-label="설정"
 >
 <Settings className="h-4 w-4" />
 </button>
 )}
 </div>
 </div>

 <div className="flex min-h-0 flex-1 overflow-x-auto">
  <main
    className={`min-w-[980px] flex-1 p-4 md:p-6 transition-all duration-200 ${
      isMessengerOpen && !isMobile ? "pr-[560px]" : ""
    }`}
  >
 {children}
 </main>
 </div>
 </SidebarInset>

 {isMessengerOpen && !isMobile && (
 <div className="fixed right-0 top-16 z-[9999] h-[calc(100vh-64px)] w-[520px] border-l border-black/5 bg-white shadow-[-12px_0_40px_rgba(15,23,42,0.10)]">
 <div className="flex h-16 items-center justify-between border-b border-black/5 bg-white px-4">
 <div className="flex min-w-0 items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06),0_6px_16px_rgba(15,23,42,0.06)]">
 {companyLogoUrl ? (
 <img
 src={companyLogoUrl}
 alt={companyName}
 className="h-[82%] w-[82%] object-contain"
 />
 ) : (
 <MessageSquare className="h-5 w-5 text-slate-900" />
 )}
 </div>

 <div className="min-w-0">
 <p className="truncate text-sm font-semibold text-black">
 {companyName}
 </p>
 <p className="truncate text-xs text-slate-500">
 {companySubtitle}
 </p>
 </div>
 </div>

 <button
 onClick={() => setIsMessengerOpen(false)}
 className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-700 transition hover:bg-slate-100"
 aria-label="메신저 닫기"
 >
 <X className="h-4 w-4" />
 </button>
 </div>

 <div className="h-[calc(100%-64px)] overflow-hidden">
 <MessengerPage
 companyName={companyName}
 onRequestClose={() => setIsMessengerOpen(false)}
 />
 </div>
 </div>
 )}
 </>
 );
}

function getNotificationBadge(item: NotificationItem) {
 const level = String(item.level || "normal");

 if (item.type === "approval") {
 if (level === "success") {
 return {
 label: "승인완료",
 className: "border-emerald-200 bg-emerald-50 text-emerald-700",
 };
 }

 if (level === "danger") {
 return {
 label: "반려",
 className: "border-rose-200 bg-rose-50 text-rose-700",
 };
 }

 if (level === "important" || level === "urgent") {
 return {
 label: "결재요청",
 className: "border-blue-200 bg-blue-50 text-blue-700",
 };
 }

 return {
 label: "전자결재",
 className: "border-slate-200 bg-slate-50 text-slate-700",
 };
 }

 if (item.type === "notice") {
 if (level === "urgent") {
 return {
 label: "긴급공지",
 className: "border-red-200 bg-red-50 text-red-700",
 };
 }

 if (level === "important") {
 return {
 label: "중요공지",
 className: "border-amber-200 bg-amber-50 text-amber-700",
 };
 }

 return {
 label: "공지",
 className: "border-amber-200 bg-amber-50 text-amber-700",
 };
 }

 if (item.type === "schedule") {
 if (level === "important" || level === "urgent") {
 return {
 label: "중요일정",
 className: "border-violet-200 bg-violet-50 text-violet-700",
 };
 }

 return {
 label: "일정",
 className: "border-violet-200 bg-violet-50 text-violet-700",
 };
 }

 if (item.type === "messenger") {
 return {
 label: "메신저",
 className: "border-sky-200 bg-sky-50 text-sky-700",
 };
 }

 if (item.type === "lead") {
 return {
 label: "상담DB",
 className: "border-teal-200 bg-teal-50 text-teal-700",
 };
 }

 return {
 label: "알림",
 className: "border-slate-200 bg-slate-50 text-slate-700",
 };
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
 if (item.type === "lead") return "상담 DB 알림";

 return "새 알림";
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