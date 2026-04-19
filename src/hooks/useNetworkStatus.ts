import { useEffect, useState } from "react";

/**
 * Phase 72 — Tracks the browser's online/offline status.
 * Returns `true` when the device reports a network connection.
 *
 * Note: `navigator.onLine === true` only guarantees a local link is up;
 * it does NOT guarantee the server is reachable. The SyncManager will
 * still verify by attempting actual network requests.
 */
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return isOnline;
}
