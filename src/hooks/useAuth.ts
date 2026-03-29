import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import type { AppRole } from "@/stores";

export function useAuth() {
  const { setUser, setLoading, setProfile, logout } = useAppStore();

  useEffect(() => {
    // Restore session first (non-blocking)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Fire and forget — do NOT await inside callbacks
        handleSession(session.user.id, session.user.email ?? "");
      } else {
        setLoading(false);
      }
    });

    // Listen for subsequent auth changes (sign in/out/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          // Fire and forget — never await inside onAuthStateChange
          handleSession(session.user.id, session.user.email ?? "");
        } else {
          logout();
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();

    async function handleSession(userId: string, email: string) {
      try {
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
      } catch (e) {
        console.error("Error loading session data:", e);
      } finally {
        setLoading(false);
      }
    }
  }, [setUser, setLoading, setProfile, logout]);
}
