import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useAppStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  const { user, logout } = useAppStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[logout] signOut error:", e);
    }
    try {
      logout();
    } catch {
      // safe to ignore
    }
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") || k.startsWith("nc-") || k === "app-storage")
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // localStorage may be unavailable
    }
    toast.success("Sessione terminata. A presto!");
    window.location.href = "/login";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card/50 backdrop-blur-sm">
            <SidebarTrigger className="mr-4 hidden md:flex" />
            <div className="flex-1" />
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive gap-2"
                aria-label="Esci"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Esci</span>
              </Button>
            )}
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto max-md:pb-24">
            {children}
          </main>
        </div>
        <PWAInstallPrompt />
        {user?.role === "client" && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
};

export default AuthLayout;
