import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores";
import { useAuth } from "@/hooks/useAuth";
import AuthPage from "./pages/AuthPage";
import ClientDashboard from "./pages/ClientDashboard";
import CoachDashboard from "./pages/CoachDashboard";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Settings from "./pages/Settings";
import AuthLayout from "./components/AuthLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole?: "coach" | "client" }) {
  const { user, isLoading, profile } = useAppStore();

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

  // Onboarding check for clients
  if (user.role === "client" && profile && (!profile.height_cm || !profile.birth_date)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <AuthLayout>{children}</AuthLayout>;
}

function AppRoutes() {
  const { user, isLoading } = useAppStore();
  useAuth();

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
            <AuthPage />
          )
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
