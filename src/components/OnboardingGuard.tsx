import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading } = useAppStore();
  const location = useLocation();

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

  // Profile not yet fetched: spinner instead of flicker
  if (!profile) {
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
