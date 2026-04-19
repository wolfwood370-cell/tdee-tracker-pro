import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

export const PWAInstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed (standalone display mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Hide inside Lovable preview iframe to avoid noise
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }
    if (inIframe) return;

    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS doesn't fire beforeinstallprompt — show manual instructions
    if (ios) setVisible(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
      <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
        <Smartphone className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Installa NC Nutrition</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isIOS
            ? "Tocca Condividi → \"Aggiungi a Home\" per un'esperienza nativa."
            : "Aggiungi questa pagina alla schermata Home per un'esperienza nativa."}
        </p>
        {!isIOS && deferred && (
          <Button size="sm" className="mt-2 h-8" onClick={install}>
            Installa ora
          </Button>
        )}
      </div>
      <button
        onClick={dismiss}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Chiudi"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
