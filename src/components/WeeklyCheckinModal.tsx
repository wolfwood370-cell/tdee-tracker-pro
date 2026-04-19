import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WeeklyCheckinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSubmitted?: () => void;
}

export function WeeklyCheckinModal({ open, onOpenChange, userId, onSubmitted }: WeeklyCheckinModalProps) {
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const text = feedback.trim();
    if (text.length < 10) {
      toast.error("Scrivi almeno qualche riga", {
        description: "Aiuta il coach a capire come è andata la tua settimana.",
      });
      return;
    }
    setSubmitting(true);
    try {
      // Cast: types.ts is regenerated post-migration; in the meantime use loose typing.
      const { error } = await (supabase as unknown as {
        from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: unknown }> };
      })
        .from("weekly_checkins")
        .insert({ user_id: userId, feedback_text: text, status: "pending" });
      if (error) throw error;

      toast.success("Check-in inviato con successo", {
        description: "Il coach lo revisionerà a breve.",
      });
      setFeedback("");
      onOpenChange(false);
      onSubmitted?.();
    } catch (e) {
      toast.error("Errore invio check-in", {
        description: e instanceof Error ? e.message : "Riprova tra qualche istante.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Check-in Settimanale</DialogTitle>
          <DialogDescription>
            Una breve riflessione sulla settimana aiuta il coach a calibrare la tua strategia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="checkin-feedback" className="text-sm">
            Come ti sei sentito questa settimana? Hai avuto fame, cali di energia o difficoltà a seguire i macro?
          </Label>
          <Textarea
            id="checkin-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Es. Settimana intensa al lavoro, ho avuto fame nei giorni di riposo. Allenamenti buoni ma sonno scarso giovedì..."
            rows={6}
            className="text-base resize-none"
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">
            {feedback.length} caratteri · Sii sincero, è un canale privato col tuo coach.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Invia Check-in al Coach
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
