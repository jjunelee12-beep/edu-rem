import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";

import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";

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
import MyPage from "@/pages/MyPage";

function PublicRouter() {
  return (
    <Switch>
      <Route path="/form/:token" component={PublicLeadFormPage} />
      <Route path="/ad-form/:token" component={AdFormPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PrivateRouter() {
  return (
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
        <Route path="/messenger" component={MessengerPage} />
	<Route path="/attendance" component={AttendancePage} />
	<Route path="/my" component={MyPage} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function AppContent() {
  const [location] = useLocation();

  const isPublicFormPage =
    location.startsWith("/form/") || location.startsWith("/ad-form/");

  if (isPublicFormPage) {
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
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}