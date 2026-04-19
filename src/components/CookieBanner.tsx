import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "cookie_consent";

type ConsentValue =
  | "accepted"
  | "rejected"
  | { technical: true; payments: boolean };

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [paymentsAllowed, setPaymentsAllowed] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const persist = (value: ConsentValue) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        typeof value === "string" ? value : JSON.stringify(value),
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
    setCustomizeOpen(false);
  };

  if (!visible) return null;

  return (
    <>
      <div
        role="dialog"
        aria-label="Consenso cookie"
        className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
      >
        <div className="mx-auto max-w-4xl rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-lg p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Utilizziamo cookie tecnici e di terze parti (come Stripe) per
              garantirti la migliore esperienza e gestire i pagamenti. Puoi
              consultare la nostra{" "}
              <Link
                to="/privacy"
                className="text-primary underline-offset-4 hover:underline font-medium"
              >
                Privacy Policy
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2 sm:flex-nowrap shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => persist("rejected")}
              >
                Rifiuta
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCustomizeOpen(true)}
              >
                Personalizza
              </Button>
              <Button size="sm" onClick={() => persist("accepted")}>
                Accetta tutto
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preferenze cookie</DialogTitle>
            <DialogDescription>
              Scegli quali categorie di cookie vuoi abilitare. I cookie tecnici
              sono necessari al funzionamento del servizio e non possono essere
              disattivati.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">
                  Cookie tecnici
                </Label>
                <p className="text-xs text-muted-foreground">
                  Necessari per autenticazione, sessione e funzionamento
                  dell'app.
                </p>
              </div>
              <Switch checked disabled aria-label="Cookie tecnici (sempre attivi)" />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-1">
                <Label
                  htmlFor="cookie-payments"
                  className="text-sm font-medium text-foreground"
                >
                  Pagamenti (Stripe)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Cookie di Stripe usati durante il checkout per gestire in
                  sicurezza le transazioni.
                </p>
              </div>
              <Switch
                id="cookie-payments"
                checked={paymentsAllowed}
                onCheckedChange={setPaymentsAllowed}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => persist("rejected")}
            >
              Rifiuta tutto
            </Button>
            <Button
              onClick={() =>
                persist({ technical: true, payments: paymentsAllowed })
              }
            >
              Salva preferenze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CookieBanner;
