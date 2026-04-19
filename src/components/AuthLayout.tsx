import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { useAppStore } from "@/stores";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  const { user } = useAppStore();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card/50 backdrop-blur-sm">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            {user && (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
        <div>
          <PWAInstallPrompt />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AuthLayout;
