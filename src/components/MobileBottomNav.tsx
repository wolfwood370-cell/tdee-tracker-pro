import { NavLink } from "react-router-dom";
import { Home, BookOpen, TrendingUp, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
}

// Nota: la sezione "Diario" vive dentro la Dashboard (tab "Oggi"),
// quindi punta a /client-dashboard. La pagina Progressi e Impostazioni
// hanno rotte dedicate.
const ITEMS: NavItem[] = [
  { to: "/client-dashboard", label: "Dashboard", icon: Home, end: true },
  { to: "/log", label: "Diario", icon: BookOpen },
  { to: "/progress", label: "Progressi", icon: TrendingUp },
  { to: "/settings", label: "Profilo", icon: User },
];

/**
 * Bottom navigation per esperienza mobile-first.
 * Visibile solo su schermi <md. Rispetta safe-area iOS via env(safe-area-inset-bottom).
 */
export function MobileBottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigazione principale"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map((item) => (
          <li key={item.label}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-5 w-5 transition-transform",
                      isActive && "scale-110",
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
