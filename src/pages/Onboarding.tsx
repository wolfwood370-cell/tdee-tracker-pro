import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { toast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

const STEPS = ["Dati Personali", "Composizione", "Obiettivo"];

const ACTIVITY_LEVELS = [
  { value: "1.2", label: "Sedentario (ufficio, poco movimento)" },
  { value: "1.375", label: "Leggermente attivo (1-3 allenamenti/sett)" },
  { value: "1.55", label: "Moderatamente attivo (3-5 allenamenti/sett)" },
  { value: "1.725", label: "Molto attivo (6-7 allenamenti/sett)" },
  { value: "1.9", label: "Estremamente attivo (atleta)" },
];

const GOAL_RATES = [
  { value: "-0.75", label: "Dimagrimento aggressivo (-0.75 kg/sett)" },
  { value: "-0.5", label: "Dimagrimento moderato (-0.5 kg/sett)" },
  { value: "-0.25", label: "Dimagrimento leggero (-0.25 kg/sett)" },
  { value: "0", label: "Mantenimento" },
  { value: "0.25", label: "Surplus leggero (+0.25 kg/sett)" },
  { value: "0.5", label: "Surplus moderato (+0.5 kg/sett)" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setProfile } = useAppStore();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [sex, setSex] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [goalRate, setGoalRate] = useState("");

  const canNext = () => {
    if (step === 0) return sex !== "" && birthDate !== "";
    if (step === 1) return heightCm !== "" && activityLevel !== "";
    if (step === 2) return goalRate !== "";
    return false;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          sex,
          birth_date: birthDate,
          height_cm: parseFloat(heightCm),
          activity_level: parseFloat(activityLevel),
          goal_rate: parseFloat(goalRate),
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      toast({ title: "Profilo completato! 🎉", description: "Benvenuto nella tua dashboard." });
      navigate("/client-dashboard", { replace: true });
    } catch (e: any) {
      console.error("Onboarding error:", e);
      toast({ title: "Errore", description: e.message ?? "Riprova.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6 animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <span className="font-display font-bold text-xl text-foreground">AdaptiveTDEE</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 px-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
              <span className={`text-xs ${i <= step ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {s}
              </span>
            </div>
          ))}
        </div>

        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">{STEPS[step]}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {step === 0 && "Inserisci i tuoi dati anagrafici di base."}
              {step === 1 && "Informazioni sulla tua composizione e livello di attività."}
              {step === 2 && "Definisci il tuo obiettivo settimanale."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Sesso</Label>
                  <Select value={sex} onValueChange={setSex}>
                    <SelectTrigger className="border-border">
                      <SelectValue placeholder="Seleziona sesso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Maschio</SelectItem>
                      <SelectItem value="F">Femmina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Data di nascita</Label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    className="border-border"
                  />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Altezza (cm)</Label>
                  <Input
                    type="number"
                    min="100"
                    max="250"
                    placeholder="es. 178"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Livello di Attività</Label>
                  <Select value={activityLevel} onValueChange={setActivityLevel}>
                    <SelectTrigger className="border-border">
                      <SelectValue placeholder="Seleziona livello" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_LEVELS.map((al) => (
                        <SelectItem key={al.value} value={al.value}>
                          {al.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Obiettivo Settimanale</Label>
                <Select value={goalRate} onValueChange={setGoalRate}>
                  <SelectTrigger className="border-border">
                    <SelectValue placeholder="Seleziona obiettivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_RATES.map((gr) => (
                      <SelectItem key={gr.value} value={gr.value}>
                        {gr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Indietro
                </Button>
              )}
              {step < 2 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canNext()} className="flex-1">
                  Avanti
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!canNext() || submitting} className="flex-1">
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    "Completa Profilo"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
