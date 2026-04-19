import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

function isPreviewEnv(): boolean {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return (
    h.includes("id-preview--") ||
    h.includes("lovableproject.com") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

export function PushNotificationManager() {
  const user = useAppStore((s) => s.user);
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [previewBlocked, setPreviewBlocked] = useState(false);

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    if (isPreviewEnv()) {
      setPreviewBlocked(true);
      return;
    }

    setPermission(Notification.permission);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function handleSubscribe() {
    if (!user) return;
    if (!VAPID_PUBLIC_KEY) {
      toast.error("Chiave VAPID pubblica non configurata.");
      return;
    }
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Permesso notifiche negato.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = sub.toJSON();
      const { error } = await supabase
        .from("profiles")
        .update({ push_subscription: subJson as never })
        .eq("id", user.id);

      if (error) throw error;
      setSubscribed(true);
      toast.success("Notifiche attivate.");
    } catch (e) {
      console.error(e);
      toast.error("Impossibile attivare le notifiche.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsubscribe() {
    if (!user) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await supabase
        .from("profiles")
        .update({ push_subscription: null })
        .eq("id", user.id);
      setSubscribed(false);
      toast.success("Notifiche disattivate.");
    } catch (e) {
      console.error(e);
      toast.error("Errore disattivazione.");
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notifiche Push
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Non perderti nulla. Attiva le notifiche per ricevere promemoria sui pasti
          e messaggi dal coach.
        </p>

        {previewBlocked ? (
          <p className="text-xs text-muted-foreground italic">
            Le notifiche push sono disponibili solo nella versione pubblicata
            dell'app, non nell'editor di anteprima.
          </p>
        ) : permission === "denied" ? (
          <p className="text-xs text-destructive">
            Hai bloccato le notifiche per questo sito. Riabilitale dalle
            impostazioni del browser.
          </p>
        ) : subscribed ? (
          <Button
            variant="outline"
            onClick={handleUnsubscribe}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            Disattiva notifiche
          </Button>
        ) : (
          <Button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Attiva Notifiche
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
