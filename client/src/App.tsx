import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useState } from "react";

import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";

import Home from "./pages/Home";
import Consultations from "./pages/Consultations";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import Approvals from "./pages/Approvals";
import Settlement from "./pages/Settlement";
import SemesterList from "./pages/SemesterList";
import System from "./pages/System";
import Login from "./components/Login";
import PublicLeadFormPage from "@/pages/PublicLeadFormPage";

type Me = {
  id: number;
  username: string;
  role: "host" | "admin" | "staff";
  name?: string;
};

function PublicRouter() {
  return (
    <Switch>
      <Route path="/form/:token" component={PublicLeadFormPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PrivateRouter() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/consultations" component={Consultations} />
        <Route path="/students" component={Students} />
        <Route path="/students/:id" component={StudentDetail} />
        <Route path="/semesters" component={SemesterList} />
        <Route path="/approvals" component={Approvals} />
        <Route path="/settlement" component={Settlement} />
        <Route path="/system" component={System} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function AppContent() {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
  console.log("APP API_BASE =", API_BASE);

  const [location] = useLocation();
  const isPublicFormPage = location.startsWith("/form/");

  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPublicFormPage) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
        });

        if (res.ok) {
          const data = (await res.json()) as Me;
          setMe(data);
        } else {
          setMe(null);
        }
      } catch (err) {
        console.error("[auth/me] error:", err);
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [isPublicFormPage, API_BASE]);

  const debugBar = (
    <div style={{ position: "fixed", top: 0, left: 0, background: "yellow", zIndex: 9999, padding: 4 }}>
      APP API_BASE: {String(API_BASE)}
    </div>
  );

  if (isPublicFormPage) {
    return (
      <>
        {debugBar}
        <PublicRouter />
      </>
    );
  }

  if (loading) return debugBar;

  if (!me) {
    return (
      <>
        {debugBar}
        <Login />
      </>
    );
  }

  return (
    <>
      {debugBar}
      <PrivateRouter />
    </>
  );
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