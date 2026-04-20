import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAppStore } from "@/stores";
import { useAuth } from "@/hooks/useAuth";
import AuthPage from "./pages/AuthPage";
import LandingPage from "./pages/LandingPage";
import ClientDashboard from "./pages/ClientDashboard";
import CoachDashboard from "./pages/CoachDashboard";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Settings from "./pages/Settings";
import Progress from "./pages/Progress";
import Log from "./pages/Log";
import Messages from "./pages/Messages";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import Terms from "./pages/Terms";
import AuthLayout from "./components/AuthLayout";
import NotFound from "./pages/NotFound";
import { SyncManager } from "./components/SyncManager";
import { OnboardingGuard } from "./components/OnboardingGuard";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole?: "coach" | "client" }) {
  const { user, isLoading } = useAppStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === "coach" ? "/coach-dashboard" : "/client-dashboard"} replace />;
  }

  return (
    <OnboardingGuard>
      <AuthLayout>{children}</AuthLayout>
    </OnboardingGuard>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAppStore();
  const profile = useAppStore((s) => s.profile);
  useAuth();

  // Phase 96: global safety timeout. If auth+profile aren't ready in 5s,
  // force a local logout and bounce to /login to keep the app interactive.
  useEffect(() => {
    if (!isLoading && (!user || profile)) return;
    const t = setTimeout(async () => {
      const state = useAppStore.getState();
      if (state.isLoading || (state.user && !state.profile)) {
        console.warn("Global auth timeout reached. Forcing logout.");
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        } catch {}
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith("sb-") || k.startsWith("nc-") || k === "app-storage")
            .forEach((k) => localStorage.removeItem(k));
        } catch {}
        useAppStore.getState().logout();
        useAppStore.getState().setLoading(false);
        if (window.location.pathname !== "/" && window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [isLoading, user, profile]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={user.role === "coach" ? "/coach-dashboard" : "/client-dashboard"} replace />
          ) : (
            <LandingPage />
          )
        }
      />
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={user.role === "coach" ? "/coach-dashboard" : "/client-dashboard"} replace />
          ) : (
            <AuthPage />
          )
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/terms" element={<Terms />} />
      <Route
        path="/onboarding"
        element={
          user && user.role === "client" ? (
            <OnboardingGuard>
              <Onboarding />
            </OnboardingGuard>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRole="client">
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/progress"
        element={
          <ProtectedRoute allowedRole="client">
            <Progress />
          </ProtectedRoute>
        }
      />
      <Route
        path="/log"
        element={
          <ProtectedRoute allowedRole="client">
            <Log />
          </ProtectedRoute>
        }
      />
      <Route
        path="/client-dashboard"
        element={
          <ProtectedRoute allowedRole="client">
            <ClientDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coach-dashboard"
        element={
          <ProtectedRoute allowedRole="coach">
            <CoachDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SyncManager />
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
