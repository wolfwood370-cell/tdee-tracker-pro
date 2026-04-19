import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Phase 72 — Offline Sync Queue.
 * Persists pending mutations to localStorage so they survive reloads/closures
 * and can be replayed by the SyncManager when connectivity is restored.
 */

export type SyncItemType = "ADD_MEAL_UPSERT";

export interface SyncItem {
  id: string;
  type: SyncItemType;
  /** Free-form payload; each handler in SyncManager knows its shape. */
  payload: Record<string, unknown>;
  timestamp: number;
}

interface SyncState {
  syncQueue: SyncItem[];
  addToQueue: (item: Omit<SyncItem, "id" | "timestamp"> & { id?: string }) => SyncItem;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      syncQueue: [],
      addToQueue: (item) => {
        const full: SyncItem = {
          id: item.id ?? newId(),
          type: item.type,
          payload: item.payload,
          timestamp: Date.now(),
        };
        set((s) => ({ syncQueue: [...s.syncQueue, full] }));
        return full;
      },
      removeFromQueue: (id) =>
        set((s) => ({ syncQueue: s.syncQueue.filter((q) => q.id !== id) })),
      clearQueue: () => set({ syncQueue: [] }),
    }),
    { name: "nc-sync-queue-v1" },
  ),
);
