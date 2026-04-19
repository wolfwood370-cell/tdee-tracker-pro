import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { useSyncStore } from "@/stores/syncStore";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/**
 * Phase 72 — Background Sync Manager.
 *
 * Mounts once near the root of the authenticated app. When connectivity
 * returns, it drains the offline queue by replaying each pending mutation
 * against Supabase. Items are removed only on success; failures stay
 * queued for the next online cycle.
 */
export const SyncManager = () => {
  const isOnline = useNetworkStatus();
  const { syncQueue, removeFromQueue } = useSyncStore();
  const { user, addLog, updateLog } = useAppStore();
  const flushingRef = useRef(false);

  useEffect(() => {
    if (!isOnline || !user || syncQueue.length === 0 || flushingRef.current) return;

    let cancelled = false;
    flushingRef.current = true;

    (async () => {
      // Snapshot the queue so concurrent enqueues during flush don't loop forever.
      const snapshot = [...useSyncStore.getState().syncQueue];
      let success = 0;
      let failed = 0;

      for (const item of snapshot) {
        if (cancelled) break;
        try {
          if (item.type === "ADD_MEAL_UPSERT") {
            const payload = item.payload as Record<string, unknown>;
            const { data, error } = await supabase
              .from("daily_metrics")
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .upsert(payload as any, { onConflict: "user_id,log_date" })
              .select()
              .single();
            if (error) throw error;
            // Reconcile with FRESH store state (avoid stale closure on dailyLogs).
            const currentLogs = useAppStore.getState().dailyLogs;
            const exists = currentLogs.some(
              (l) => l.id === data.id || (l.user_id === data.user_id && l.log_date === data.log_date),
            );
            if (exists) updateLog(data);
            else addLog(data);
            removeFromQueue(item.id);
            success++;
          } else {
            // Unknown type — drop to avoid poisoning the queue forever.
            removeFromQueue(item.id);
          }
        } catch (e) {
          // Keep the item in the queue and try again next online cycle.
          console.warn("[SyncManager] flush failed for", item.id, e);
          failed++;
        }
      }

      flushingRef.current = false;

      if (success > 0 && failed === 0) {
        toast.success("Sincronizzazione offline completata.", {
          description:
            success === 1 ? "1 voce sincronizzata." : `${success} voci sincronizzate.`,
        });
      } else if (success > 0 && failed > 0) {
        toast(`Sincronizzate ${success} voci, ${failed} ancora in coda.`);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, syncQueue.length, user?.id]);

  // Visibility wake: some browsers (mobile Safari, bfcache) don't fire 'online'
  // when returning from background. Force a re-check by touching the queue.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        // No-op state touch to re-trigger the flush effect if queue has items.
        const q = useSyncStore.getState().syncQueue;
        if (q.length > 0) useSyncStore.setState({ syncQueue: [...q] });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
};
