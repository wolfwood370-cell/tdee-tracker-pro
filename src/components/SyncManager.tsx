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
  const { user, addLog, updateLog, dailyLogs } = useAppStore();
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
            // Reconcile local store with the authoritative server row.
            const exists = dailyLogs.some((l) => l.id === data.id);
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
        toast.success("✅ Sincronizzazione offline completata.", {
          description:
            success === 1
              ? "1 voce sincronizzata."
              : `${success} voci sincronizzate.`,
        });
      } else if (success > 0 && failed > 0) {
        toast.warning(`Sincronizzate ${success} voci, ${failed} ancora in coda.`);
      }
    })();

    return () => {
      cancelled = true;
    };
    // We intentionally depend on online state and queue length only — the
    // store actions are stable and dailyLogs reference would cause loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, syncQueue.length, user?.id]);

  return null;
};
