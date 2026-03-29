import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { toast } from "@/hooks/use-toast";
import { evaluateBiofeedbackTrigger } from "@/lib/autoRegulation";
import { AutoRegulationModal } from "@/components/AutoRegulationModal";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClipboardCheck, Loader2, Utensils, Zap, Moon, Dumbbell } from "lucide-react";

const SCORE_LABELS: Record<number, string> = {
  1: "Molto basso",
  2: "Basso",
  3: "Nella norma",
  4: "Buono",
  5: "Eccellente",
};

const METRICS = [
  { key: "hunger", label: "Fame / Sazietà", icon: Utensils, low: "Affamato", high: "Sazio" },
  { key: "energy", label: "Energia & NEAT", icon: Zap, low: "Letargico", high: "Molto attivo" },
  { key: "sleep", label: "Qualità del Sonno", icon: Moon, low: "Scarsa", high: "Eccellente" },
  { key: "performance", label: "Performance in Allenamento", icon: Dumbbell, low: "In calo", high: "PRs" },
] as const;

interface BiofeedbackCheckinProps {
  onComplete: () => void;
}

export function BiofeedbackCheckin({ onComplete }: BiofeedbackCheckinProps) {
  const { user, profile, setProfile, recalculateMetrics } = useAppStore();
  const [scores, setScores] = useState({ hunger: 3, energy: 3, sleep: 3, performance: 3 });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  const getWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday as week start
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return monday.toISOString().slice(0, 10);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const weekStart = getWeekStart();

      const { error } = await supabase
        .from("biofeedback_logs" as any)
        .upsert(
          {
            user_id: user.id,
            week_start_date: weekStart,
            hunger_score: scores.hunger,
            energy_score: scores.energy,
            sleep_score: scores.sleep,
            performance_score: scores.performance,
            notes: notes || null,
          },
          { onConflict: "user_id,week_start_date" }
        );

      if (error) throw error;

      // --- Auto-Regulation Check ---
      if (profile) {
        // Fetch previous biofeedback logs
        const { data: prevLogs } = await supabase
          .from("biofeedback_logs" as any)
          .select("*")
          .eq("user_id", user.id)
          .order("week_start_date", { ascending: false })
          .limit(5);

        const currentLog = {
          week_start_date: weekStart,
          hunger_score: scores.hunger,
          energy_score: scores.energy,
          sleep_score: scores.sleep,
          performance_score: scores.performance,
        };

        const result = evaluateBiofeedbackTrigger(
          currentLog,
          (prevLogs ?? []) as any[],
          {
            goal_type: (profile as any).goal_type ?? "sustainable_loss",
            diet_strategy: (profile as any).diet_strategy ?? "linear",
          }
        );

        if (result.triggered && result.newStrategy) {
          // Update profile in DB
          await supabase
            .from("profiles")
            .update({ diet_strategy: result.newStrategy } as any)
            .eq("id", user.id);

          // Update local state
          setProfile({ ...profile, diet_strategy: result.newStrategy } as any);
          recalculateMetrics();

          // Show modal instead of completing immediately
          setSubmitting(false);
          setShowAIModal(true);
          return;
        }
      }

      toast({ title: "Check-in completato ✓", description: "Grazie per il feedback settimanale!" });
      onComplete();
    } catch (e: any) {
      console.error("Biofeedback submit error:", e);
      toast({ title: "Errore", description: e.message ?? "Riprova.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAIModalConfirm = () => {
    setShowAIModal(false);
    toast({
      title: "Diet Break attivato 🛡️",
      description: "I tuoi target sono stati aggiornati a calorie di mantenimento.",
    });
    onComplete();
  };

  return (
    <>
      <Card className="glass-card border-primary/30 glow-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Check-in Settimanale
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Come ti sei sentito questa settimana? Valuta ogni area da 1 a 5.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {METRICS.map((m) => (
            <div key={m.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-foreground flex items-center gap-1.5">
                  <m.icon className="h-3.5 w-3.5 text-primary" />
                  {m.label}
                </Label>
                <span className="text-xs font-semibold text-primary">
                  {scores[m.key]} — {SCORE_LABELS[scores[m.key]]}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-16 text-right">{m.low}</span>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[scores[m.key]]}
                  onValueChange={([v]) => setScores((s) => ({ ...s, [m.key]: v }))}
                  className="flex-1"
                />
                <span className="text-[10px] text-muted-foreground w-16">{m.high}</span>
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Note (opzionale)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Come ti senti? Qualcosa da segnalare al coach?"
              rows={2}
              className="border-border text-sm"
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Invio...
              </>
            ) : (
              "Invia Check-in"
            )}
          </Button>
        </CardContent>
      </Card>

      <AutoRegulationModal open={showAIModal} onConfirm={handleAIModalConfirm} />
    </>
  );
}
