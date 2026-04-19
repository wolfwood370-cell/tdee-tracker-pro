import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores";

/**
 * OnboardingGuard
 * --------------------------------
 * Hard guard that prevents an authenticated client from reaching the
 * main app before completing onboarding (and viceversa).
 *
 * Behavior:
 *  - Not authenticated → render children (auth flow handled elsewhere).
 *  - Loading profile     → full-screen spinner (no flicker).
 *  - Coach              → bypass (coaches have no onboarding flow).
 *  - Client + onboarding NOT completed + path !== "/onboarding"
 *      → redirect to /onboarding.
 *  - Client + onboarding completed + path === "/onboarding"
 *      → redirect to /client-dashboard.
 *
 * Performance: uses individual selectors so this guard only re-renders
 * when auth/profile state actually changes (not on every log mutation).
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const user = useAppStore((s) => s.user);
  const profile = useAppStore((s) => s.profile);
  const isLoading = useAppStore((s) => s.isLoading);
  const location = useLocation();

  // Safety net: if profile fetch never resolves (network error in useAuth),
  // surface a recoverable UI instead of an infinite spinner.
  const [profileTimeout, setProfileTimeout] = useState(false);
  const isClient = !!user && user.role === "client";
  const waitingForProfile = isClient && !profile && !isLoading;

  useEffect(() => {
    if (!waitingForProfile) {
      setProfileTimeout(false);
      return;
    }
    const t = setTimeout(() => setProfileTimeout(true), 5000);
    return () => clearTimeout(t);
  }, [waitingForProfile]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Unauthenticated: let the auth flow handle it
  if (!user) return <>{children}</>;

  // Coaches don't go through onboarding
  if (user.role === "coach") return <>{children}</>;

  // Profile not yet fetched
  if (!profile) {
    if (profileTimeout) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <p className="text-foreground font-medium">
              Impossibile caricare il tuo profilo
            </p>
            <p className="text-sm text-muted-foreground">
              Controlla la connessione e riprova.
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Riprova
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const completed = profile.onboarding_completed === true;
  const onOnboardingRoute = location.pathname === "/onboarding";

  if (!completed && !onOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  if (completed && onOnboardingRoute) {
    return <Navigate to="/client-dashboard" replace />;
  }

  return <>{children}</>;
}
