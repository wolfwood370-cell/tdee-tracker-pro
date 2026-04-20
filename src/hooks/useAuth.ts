import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import type { AppRole } from "@/stores";

export function useAuth() {
  const storeRef = useRef(useAppStore.getState());
  
  // Keep ref current without causing re-renders
  useEffect(() => {
    return useAppStore.subscribe((state) => {
      storeRef.current = state;
    });
  }, []);

  useEffect(() => {
    const { setUser, setLoading, setProfile, logout } = storeRef.current;

    // Restore session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleSession(session.user.id, session.user.email ?? "");
      } else {
        setLoading(false);
      }
    });

    // Listen for subsequent auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          handleSession(session.user.id, session.user.email ?? "");
        } else {
          useAppStore.getState().logout();
          useAppStore.getState().setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();

    async function handleSession(userId: string, email: string) {
      const store = useAppStore.getState();
      try {
        // Fetch role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .single();

        const role: AppRole = roleData?.role ?? "client";

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        // Ghost session: authenticated but profile missing → wipe local session.
        if (!profileData || profileError) {
          console.warn("Ghost session detected (profile missing). Forcing local logout.");
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          try {
            Object.keys(localStorage)
              .filter((k) => k.startsWith("sb-") || k.startsWith("nc-") || k === "app-storage")
              .forEach((k) => localStorage.removeItem(k));
          } catch {}
          useAppStore.getState().logout();
          return;
        }

        store.setUser({ id: userId, email, role });
        store.setProfile(profileData);
      } catch (e) {
        console.error("Error loading session data:", e);
      } finally {
        useAppStore.getState().setLoading(false);
      }
    }
  }, []);
}
