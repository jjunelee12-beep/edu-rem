import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";

import Login from "./components/Login";
import Home from "./pages/Home";
import OverviewDashboard from "./pages/OverviewDashboard";
import Consultations from "./pages/Consultations";
import Students from "./pages/Students";
import SmsSender from "@/pages/sms/SmsSender";
import StudentDetail from "./pages/StudentDetail";
import Approvals from "./pages/Approvals";
import Settlement from "./pages/Settlement";
import SemesterList from "./pages/SemesterList";
import System from "./pages/System";
import PublicLeadFormPage from "@/pages/PublicLeadFormPage";
import AdFormPage from "@/pages/AdFormPage";
import EducationInstitutions from "@/pages/EducationInstitutions";
import PrivateCertificateCenterPage from "@/pages/private-certificate-center";
import PracticeSupportCenterPage from "@/pages/practice-support-center";
import JobSupportCenterPage from "@/pages/job-support-center";
import AIAssistant from "@/pages/AIAssistant";
import SuperhostHome from "@/pages/SuperhostHome";
import TenantsPage from "@/pages/superhost/TenantsPage";
import OrganizationMonitoringPage from "@/pages/superhost/OrganizationMonitoringPage";
import SaasInquiriesPage from "@/pages/superhost/SaasInquiriesPage";
import SubscriptionPaymentsPage from "@/pages/superhost/SubscriptionPaymentsPage";
import BillingRegisterPage from "@/pages/BillingRegisterPage";
import MessengerPage from "@/pages/MessengerPage";
import AttendancePage from "@/pages/AttendancePage";
import AttendanceViewPage from "@/pages/AttendanceViewPage";
import MyPage from "@/pages/MyPage";

import NoticesPage from "@/pages/NoticesPage";
import NoticeDetailPage from "@/pages/NoticeDetailPage";
import NoticeWritePage from "@/pages/NoticeWritePage";
import NoticeEditPage from "@/pages/NoticeEditPage";
import NoticePreviewPage from "@/pages/NoticePreviewPage";
import SchedulePage from "@/pages/SchedulePage";
import Notifications from "@/pages/Notifications";

import ApprovalsDashboardPage from "./pages/ApprovalsDashboardPage";
import ApprovalAttendancePage from "./pages/ApprovalAttendancePage";
import ApprovalBusinessTripPage from "./pages/ApprovalBusinessTripPage";
import ApprovalGeneralPage from "./pages/ApprovalGeneralPage";
import ApprovalInboxPage from "./pages/ApprovalInboxPage";
import ApprovalSettingsPage from "./pages/ApprovalSettingsPage";
import ApprovalDetailPage from "./pages/ApprovalDetailPage";
import ApprovalPrintPage from "./pages/ApprovalPrintPage";
import ApprovalStatsPage from "./pages/ApprovalStatsPage";
import ApprovalPreviewPage from "./pages/ApprovalPreviewPage";
import ApprovalHistoryDetailPage from "./pages/ApprovalHistoryDetailPage";
import PrivateCertificateMasterPage from "./pages/PrivateCertificateMasterPage";
import SubjectCatalogMasterPage from "./pages/SubjectCatalogMasterPage";

// ✅ 추가
import AppToastHost from "@/components/notifications/AppToastHost";
import MessengerRealtimeBridge from "@/components/notifications/MessengerRealtimeBridge";
import AppRealtimeBridge from "@/components/notifications/AppRealtimeBridge";

function SuperhostRoute({
  component: Component,
}: {
  component: React.ComponentType<any>;
}) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user?.role !== "superhost") {
    return <NotFound />;
  }

  return <Component />;
}

function RedirectToMyOrg({ path = "" }: { path?: string }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) return null;

  if (!user) return <Login />;

  if (user.role === "superhost") {
    setLocation("/saas");
    return null;
  }

  const slug =
    (user as any).organizationSlug ||
    (user as any).organization?.slug ||
    (user as any).organization?.organizationSlug;

  if (!slug) {
    return <NotFound />;
  }

  setLocation(`/${slug}${path}`);
  return null;
}

function FeatureGate({
  feature,
  children,
}: {
  feature:
    | "allowSettlementReport"
    | "allowPrivateCertificate"
    | "allowPracticeCenter";
  children: React.ReactNode;
}) {
  const { data: features, isLoading } =
    trpc.organizationFeatures.useQuery();

  if (isLoading) return null;

  if (features?.[feature] === false) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function HostOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user?.role !== "host") {
    return <NotFound />;
  }

  return <>{children}</>;
}

function TenantPathGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  if (loading) return null;
  if (!user) return <Login />;

  if (user.role === "superhost") {
    return <>{children}</>;
  }

  const mySlug =
    (user as any).organizationSlug ||
    (user as any).organization?.slug ||
    (user as any).organization?.organizationSlug;

  if (!mySlug) return <NotFound />;

  const firstSegment = location.split("/").filter(Boolean)[0] || "";

  if (!firstSegment) {
    return <>{children}</>;
  }

  const allowedRootPaths = new Set(["login", "form", "ad-form"]);

  if (allowedRootPaths.has(firstSegment)) {
    return <>{children}</>;
  }

  if (firstSegment !== mySlug) {
    const restPath = location.startsWith(`/${firstSegment}`)
      ? location.slice(firstSegment.length + 1)
      : "";

    setLocation(`/${mySlug}${restPath}`);
    return null;
  }

  return <>{children}</>;
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/form/:token" component={PublicLeadFormPage} />
      <Route path="/ad-form/:token" component={AdFormPage} />
<Route
  path="/billing/register/:token"
  component={BillingRegisterPage}
/>
      <Route component={NotFound} />
    </Switch>
  );
}

function PrivateRouter() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <MessengerRealtimeBridge />
      <AppRealtimeBridge />
      <TenantPathGuard>
  <DashboardLayout>
    <Switch>
      {/* slug 없는 기존 경로 → 자기 organization 으로 강제 이동 */}
      <Route path="/" component={() => <RedirectToMyOrg path="" />} />
      <Route path="/overview" component={() => <RedirectToMyOrg path="/overview" />} />
      <Route path="/consultations" component={() => <RedirectToMyOrg path="/consultations" />} />

      <Route path="/students/:id">
        {(params) => <RedirectToMyOrg path={`/students/${params.id}`} />}
      </Route>
      <Route path="/students" component={() => <RedirectToMyOrg path="/students" />} />

      <Route path="/semesters" component={() => <RedirectToMyOrg path="/semesters" />} />
      <Route path="/sms" component={() => <RedirectToMyOrg path="/sms" />} />
      <Route path="/approvals" component={() => <RedirectToMyOrg path="/approvals" />} />
      <Route path="/settlement" component={() => <RedirectToMyOrg path="/settlement" />} />
      <Route path="/private-certificate-center" component={() => <RedirectToMyOrg path="/private-certificate-center" />} />
      <Route path="/practice-support-center" component={() => <RedirectToMyOrg path="/practice-support-center" />} />
      <Route path="/job-support-center" component={() => <RedirectToMyOrg path="/job-support-center" />} />
      <Route path="/system" component={() => <RedirectToMyOrg path="/system" />} />

      <Route path="/attendance/view" component={() => <RedirectToMyOrg path="/attendance/view" />} />
      <Route path="/attendance" component={() => <RedirectToMyOrg path="/attendance" />} />
      <Route path="/my" component={() => <RedirectToMyOrg path="/my" />} />

      <Route path="/notices/write" component={() => <RedirectToMyOrg path="/notices/write" />} />
      <Route path="/notices/preview" component={() => <RedirectToMyOrg path="/notices/preview" />} />
      <Route path="/notices/:id/edit">
        {(params) => <RedirectToMyOrg path={`/notices/${params.id}/edit`} />}
      </Route>
      <Route path="/notices/:id">
        {(params) => <RedirectToMyOrg path={`/notices/${params.id}`} />}
      </Route>
      <Route path="/notices" component={() => <RedirectToMyOrg path="/notices" />} />

      <Route path="/schedules" component={() => <RedirectToMyOrg path="/schedules" />} />
      <Route path="/notifications" component={() => <RedirectToMyOrg path="/notifications" />} />

      <Route path="/e-approval/attendance" component={() => <RedirectToMyOrg path="/e-approval/attendance" />} />
      <Route path="/e-approval/business-trip" component={() => <RedirectToMyOrg path="/e-approval/business-trip" />} />
      <Route path="/e-approval/general" component={() => <RedirectToMyOrg path="/e-approval/general" />} />
      <Route path="/e-approval/inbox" component={() => <RedirectToMyOrg path="/e-approval/inbox" />} />
      <Route path="/e-approval/settings" component={() => <RedirectToMyOrg path="/e-approval/settings" />} />
      <Route path="/e-approval/stats" component={() => <RedirectToMyOrg path="/e-approval/stats" />} />
      <Route path="/e-approval/preview" component={() => <RedirectToMyOrg path="/e-approval/preview" />} />
      <Route path="/e-approval/:id/print">
        {(params) => <RedirectToMyOrg path={`/e-approval/${params.id}/print`} />}
      </Route>
      <Route path="/e-approval/:id">
        {(params) => <RedirectToMyOrg path={`/e-approval/${params.id}`} />}
      </Route>
      <Route path="/e-approval" component={() => <RedirectToMyOrg path="/e-approval" />} />

      <Route path="/education-institutions" component={() => <RedirectToMyOrg path="/education-institutions" />} />
      <Route path="/private-certificate-master" component={() => <RedirectToMyOrg path="/private-certificate-master" />} />
      <Route path="/subject-catalog-master" component={() => <RedirectToMyOrg path="/subject-catalog-master" />} />

      {/* superhost */}
      <Route path="/ai">
        <SuperhostRoute component={AIAssistant} />
      </Route>
      <Route path="/superhost" component={SuperhostHome} />
      <Route path="/superhost/tenants" component={TenantsPage} />
<Route path="/superhost/saas-inquiries">
  <SuperhostRoute component={SaasInquiriesPage} />
</Route>
<Route path="/superhost/subscription-payments">
  <SuperhostRoute component={SubscriptionPaymentsPage} />
</Route>
<Route path="/saas/monitoring/:organizationId">
  <SuperhostRoute component={OrganizationMonitoringPage} />
</Route>      
<Route path="/saas">
        <SuperhostRoute component={TenantsPage} />
      </Route>

      {/* organization slug 실제 CRM - 상세/하위 경로가 항상 먼저 */}
      <Route path="/:organizationSlug/students/:id" component={StudentDetail} />
      <Route path="/:organizationSlug/students" component={Students} />
      <Route path="/:organizationSlug/overview" component={OverviewDashboard} />
      <Route path="/:organizationSlug/consultations" component={Consultations} />
      <Route path="/:organizationSlug/semesters" component={SemesterList} />
      <Route path="/:organizationSlug/sms" component={SmsSender} />
      <Route path="/:organizationSlug/approvals" component={Approvals} />

<Route
  path="/:organizationSlug/approval-history/:type/:id"
  component={ApprovalHistoryDetailPage}
/>

      <Route
  path="/:organizationSlug/settlement"
  component={() => (
    <FeatureGate feature="allowSettlementReport">
      <HostOnly>
        <Settlement />
      </HostOnly>
    </FeatureGate>
  )}
/>

<Route
  path="/:organizationSlug/private-certificate-center"
  component={() => (
    <FeatureGate feature="allowPrivateCertificate">
      <PrivateCertificateCenterPage />
    </FeatureGate>
  )}
/>

<Route
  path="/:organizationSlug/practice-support-center"
  component={() => (
    <FeatureGate feature="allowPracticeCenter">
      <PracticeSupportCenterPage />
    </FeatureGate>
  )}
/>
      <Route path="/:organizationSlug/job-support-center" component={JobSupportCenterPage} />
      <Route path="/:organizationSlug/system" component={System} />

      <Route path="/:organizationSlug/attendance/view" component={AttendanceViewPage} />
      <Route path="/:organizationSlug/attendance" component={AttendancePage} />
      <Route path="/:organizationSlug/my" component={MyPage} />

      <Route path="/:organizationSlug/notices/write" component={NoticeWritePage} />
      <Route path="/:organizationSlug/notices/preview" component={NoticePreviewPage} />
      <Route path="/:organizationSlug/notices/:id/edit" component={NoticeEditPage} />
      <Route path="/:organizationSlug/notices/:id" component={NoticeDetailPage} />
      <Route path="/:organizationSlug/notices" component={NoticesPage} />

      <Route path="/:organizationSlug/schedules" component={SchedulePage} />
      <Route path="/:organizationSlug/notifications" component={Notifications} />

      <Route path="/:organizationSlug/e-approval/attendance" component={ApprovalAttendancePage} />
      <Route path="/:organizationSlug/e-approval/business-trip" component={ApprovalBusinessTripPage} />
      <Route path="/:organizationSlug/e-approval/general" component={ApprovalGeneralPage} />
      <Route path="/:organizationSlug/e-approval/inbox" component={ApprovalInboxPage} />
      <Route path="/:organizationSlug/e-approval/settings" component={ApprovalSettingsPage} />
      <Route path="/:organizationSlug/e-approval/stats" component={ApprovalStatsPage} />
      <Route path="/:organizationSlug/e-approval/preview" component={ApprovalPreviewPage} />
      <Route path="/:organizationSlug/e-approval/:id/print" component={ApprovalPrintPage} />
      <Route path="/:organizationSlug/e-approval/:id" component={ApprovalDetailPage} />
      <Route path="/:organizationSlug/e-approval" component={ApprovalsDashboardPage} />

      <Route
  path="/:organizationSlug/private-certificate-master"
  component={() => (
    <FeatureGate feature="allowPrivateCertificate">
      <PrivateCertificateMasterPage />
    </FeatureGate>
  )}
/>
      <Route path="/:organizationSlug/subject-catalog-master" component={SubjectCatalogMasterPage} />
      <Route path="/:organizationSlug/education-institutions" component={EducationInstitutions} />

      <Route path="/:organizationSlug" component={Home} />

      <Route component={NotFound} />
    </Switch>
  </DashboardLayout>
</TenantPathGuard>
    </>
  );
}

function AppContent() {
  const [location] = useLocation();

  const isPublicPage =
  location === "/login" ||
  location.startsWith("/form/") ||
  location.startsWith("/ad-form/") ||
  location.startsWith("/billing/register/");

  if (isPublicPage) {
    return <PublicRouter />;
  }

  return <PrivateRouter />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppToastHost />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}