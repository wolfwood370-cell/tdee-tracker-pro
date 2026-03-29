import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import type { AppRole } from "@/stores";

export function useAuth() {
  const { setUser, setLoading, setProfile, logout } = useAppStore();

  useEffect(() => {
    async function handleSession(userId: string, email: string) {
      // Fetch role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      const role: AppRole = roleData?.role ?? "client";
      setUser({ id: userId, email, role });

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileData) {
        setProfile(profileData);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await handleSession(session.user.id, session.user.email ?? "");
        } else {
          logout();
        }
        setLoading(false);
      }
    );

    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await handleSession(session.user.id, session.user.email ?? "");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading, setProfile, logout]);
}
