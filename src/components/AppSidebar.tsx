import { Activity, LayoutDashboard, Settings, LogOut, Moon, Sun, MessageCircle, TrendingUp } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAppStore } from "@/stores";
import { useTheme } from "@/components/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
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

  const items = user?.role === "coach" ? coachNav : clientNav;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="p-4 flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-display font-bold text-foreground text-sm tracking-tight">
              NC Smart Nutrition
            </span>
          )}
        </div>

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
          onClick={async () => {
            await supabase.auth.signOut();
            logout();
          }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && "Esci"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
