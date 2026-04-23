import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";

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
import PrivateCertificateMasterPage from "./pages/PrivateCertificateMasterPage";
import SubjectCatalogMasterPage from "./pages/SubjectCatalogMasterPage";

// ✅ 추가
import AppToastHost from "@/components/notifications/AppToastHost";
import MessengerRealtimeBridge from "@/components/notifications/MessengerRealtimeBridge";
import AppRealtimeBridge from "@/components/notifications/AppRealtimeBridge";

function PublicRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/form/:token" component={PublicLeadFormPage} />
      <Route path="/ad-form/:token" component={AdFormPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PrivateRouter() {
  return (
    <>
      <MessengerRealtimeBridge />
      <AppRealtimeBridge />

      <DashboardLayout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/overview" component={OverviewDashboard} />
          <Route path="/consultations" component={Consultations} />
          <Route path="/students" component={Students} />
          <Route path="/students/:id" component={StudentDetail} />
          <Route path="/semesters" component={SemesterList} />
          <Route path="/sms" component={SmsSender} />
          <Route path="/approvals" component={Approvals} />
          <Route path="/settlement" component={Settlement} />
          <Route path="/private-certificate-center" component={PrivateCertificateCenterPage} />
          <Route path="/practice-support-center" component={PracticeSupportCenterPage} />
          <Route path="/job-support-center" component={JobSupportCenterPage} />
          <Route path="/system" component={System} />
          <Route path="/ai" component={AIAssistant} />
          <Route path="/education-institutions" component={EducationInstitutions} />
          <Route path="/superhost" component={SuperhostHome} />
          <Route path="/attendance" component={AttendancePage} />
          <Route path="/attendance/view" component={AttendanceViewPage} />
          <Route path="/my" component={MyPage} />
          <Route path="/notices" component={NoticesPage} />
          <Route path="/notices/write" component={NoticeWritePage} />
          <Route path="/notices/preview" component={NoticePreviewPage} />
          <Route path="/notices/:id/edit" component={NoticeEditPage} />
          <Route path="/notices/:id" component={NoticeDetailPage} />
          <Route path="/schedules" component={SchedulePage} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/e-approval" component={ApprovalsDashboardPage} />
          <Route path="/e-approval/attendance" component={ApprovalAttendancePage} />
          <Route path="/e-approval/business-trip" component={ApprovalBusinessTripPage} />
          <Route path="/e-approval/general" component={ApprovalGeneralPage} />
          <Route path="/e-approval/inbox" component={ApprovalInboxPage} />
          <Route path="/e-approval/settings" component={ApprovalSettingsPage} />
          <Route path="/e-approval/stats" component={ApprovalStatsPage} />
          <Route path="/e-approval/preview" component={ApprovalPreviewPage} />
          <Route path="/e-approval/:id/print" component={ApprovalPrintPage} />
          <Route path="/e-approval/:id" component={ApprovalDetailPage} />
          <Route path="/private-certificate-master" component={PrivateCertificateMasterPage} />
          <Route path="/subject-catalog-master" component={SubjectCatalogMasterPage} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    </>
  );
}

function AppContent() {
  const [location] = useLocation();

  const isPublicPage =
    location === "/login" ||
    location.startsWith("/form/") ||
    location.startsWith("/ad-form/");

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