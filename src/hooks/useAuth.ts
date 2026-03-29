import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import type { AppRole } from "@/stores";

export function useAuth() {
  const { setUser, setLoading, logout } = useAppStore();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Fetch role from user_roles table
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .single();

          const role: AppRole = roleData?.role ?? "client";

          setUser({
            id: session.user.id,
            email: session.user.email ?? "",
            role,
          });
        } else {
          logout();
        }
        setLoading(false);
      }
    );

    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        const role: AppRole = roleData?.role ?? "client";

        setUser({
          id: session.user.id,
          email: session.user.email ?? "",
          role,
        });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading, logout]);
}
