import { Activity, LayoutDashboard, ClipboardList, Settings, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAppStore } from "@/stores";
import { supabase } from "@/integrations/supabase/client";
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

const clientNav = [
  { title: "Dashboard", url: "/client-dashboard", icon: LayoutDashboard },
];

const coachNav = [
  { title: "Dashboard", url: "/coach-dashboard", icon: LayoutDashboard },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAppStore();

  const items = user?.role === "coach" ? coachNav : clientNav;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="p-4 flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-display font-bold text-foreground text-sm tracking-tight">
              AdaptiveTDEE
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
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && user && (
          <div className="mb-2 px-2">
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
