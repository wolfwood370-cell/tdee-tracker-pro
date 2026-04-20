import { Activity, LayoutDashboard, Settings, LogOut, Moon, Sun, MessageCircle, TrendingUp, WifiOff } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/stores";
import { useTheme } from "@/components/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSyncStore } from "@/stores/syncStore";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const clientNav = [
  { title: "Dashboard", url: "/client-dashboard", icon: LayoutDashboard },
  { title: "Progressi", url: "/progress", icon: TrendingUp },
  { title: "Messaggi", url: "/messages", icon: MessageCircle, showBadge: true },
  { title: "Impostazioni", url: "/settings", icon: Settings },
];

const coachNav = [
  { title: "Dashboard", url: "/coach-dashboard", icon: LayoutDashboard },
  { title: "Messaggi", url: "/messages", icon: MessageCircle, showBadge: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  const unreadCount = useUnreadMessages();
  const isOnline = useNetworkStatus();
  const queueLength = useSyncStore((s) => s.syncQueue.length);
  const navigate = useNavigate();

  const items = user?.role === "coach" ? coachNav : clientNav;

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
      // localStorage may be unavailable; safe to ignore.
    }
    toast.success("Sessione terminata. A presto!");
    navigate("/auth", { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="p-4 flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-display font-bold text-foreground text-sm tracking-tight">
              NC Nutrition
            </span>
          )}
        </div>

        {/* Phase 72: Offline indicator */}
        {!isOnline && (
          <div className="px-3">
            <Badge
              variant="outline"
              className="w-full justify-center gap-1.5 bg-warning/10 text-warning border-warning/40 py-1"
            >
              <WifiOff className="h-3 w-3" />
              {!collapsed && (
                <span className="text-[11px] font-medium">
                  Offline{queueLength > 0 ? ` · ${queueLength} in coda` : ""}
                </span>
              )}
            </Badge>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Navigazione</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50 relative"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                      {item.showBadge && unreadCount > 0 && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] h-4 min-w-4 flex items-center justify-center rounded-full ml-auto px-1">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 mr-2 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 mr-2 shrink-0" />
          )}
          {!collapsed && (theme === "dark" ? "Tema Chiaro" : "Tema Scuro")}
        </Button>

        {!collapsed && user && (
          <div className="px-2">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <p className="text-xs text-primary capitalize">{user.role === "coach" ? "coach" : "cliente"}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && "Esci"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
