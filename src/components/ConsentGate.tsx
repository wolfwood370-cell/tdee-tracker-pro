import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * Blocking modal shown when a logged-in client has not yet provided
 * the mandatory GDPR consents (terms_accepted + health_data_consent).
 *
 * Used by ClientDashboard as a hard guard before any health data is processed.
 */
export function ConsentGate() {
  const { user, profile, setProfile } = useAppStore();
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = terms && health && !submitting;

  const handleConfirm = async () => {
    if (!user || !profile || !canSubmit) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          terms_accepted: true,
          health_data_consent: true,
          marketing_consent: marketing,
        })
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw error;
      if (data) setProfile(data);
      toast.success("Consensi registrati.");
    } catch (e) {
      console.error(e);
      toast.error("Impossibile salvare i consensi.", {
        description: e instanceof Error ? e.message : "Riprova.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Pre-tick fields already accepted (e.g. partial state)
  const showMarketing = !profile?.marketing_consent;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="glass-card border-border max-w-lg w-full shadow-glow-primary">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-display">Consensi necessari</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Per usare NC Nutrition è necessario fornire i consensi richiesti dal GDPR
            per il trattamento dei tuoi dati sanitari.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
            <Checkbox
              id="gate-terms"
              checked={terms}
              onCheckedChange={(v) => setTerms(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="gate-terms" className="text-sm leading-relaxed cursor-pointer">
              Accetto i{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Termini e Condizioni
              </a>{" "}
              e la{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Privacy Policy
              </a>
              . <span className="text-destructive">*</span>
            </Label>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
            <Checkbox
              id="gate-health"
              checked={health}
              onCheckedChange={(v) => setHealth(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="gate-health" className="text-sm leading-relaxed cursor-pointer">
              Consento al trattamento dei miei dati sanitari e biometrici (peso, macro,
              biofeedback, foto) per le finalità del servizio.{" "}
              <span className="text-destructive">*</span>
            </Label>
          </div>

          {showMarketing && (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3">
              <Checkbox
                id="gate-marketing"
                checked={marketing}
                onCheckedChange={(v) => setMarketing(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="gate-marketing" className="text-sm leading-relaxed cursor-pointer text-muted-foreground">
                Voglio ricevere aggiornamenti e consigli via email (opzionale).
              </Label>
            </div>
          )}

          <Button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvataggio…
              </>
            ) : (
              "Conferma e continua"
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            * Campi obbligatori per l'uso dell'app.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
