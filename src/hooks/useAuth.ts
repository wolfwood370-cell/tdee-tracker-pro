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
        store.setUser({ id: userId, email, role });

        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (profileData) {
          store.setProfile(profileData);
          // Trigger recalculation after profile is loaded
          useAppStore.getState().recalculateMetrics();
        }
      } catch (e) {
        console.error("Error loading session data:", e);
      } finally {
        useAppStore.getState().setLoading(false);
      }
    }
  }, []);
}
