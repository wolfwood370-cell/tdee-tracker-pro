import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { toast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Activity, ArrowRight, ArrowLeft, Loader2, Lightbulb, Settings } from "lucide-react";

const STEPS = ["Biometria", "Storia Dietetica", "Comportamento", "Raccomandazione"];

const ACTIVITY_LEVELS = [
  { value: "1.2", label: "Sedentario (ufficio, poco movimento)" },
  { value: "1.375", label: "Leggermente attivo (1-3 allenamenti/sett)" },
  { value: "1.55", label: "Moderatamente attivo (3-5 allenamenti/sett)" },
  { value: "1.725", label: "Molto attivo (6-7 allenamenti/sett)" },
  { value: "1.9", label: "Estremamente attivo (atleta)" },
];

const DEFICIT_DURATIONS = [
  { value: "none", label: "Non sto facendo dieta" },
  { value: "1-4", label: "1–4 settimane" },
  { value: "4-12", label: "4–12 settimane" },
  { value: "12+", label: "Più di 12 settimane" },
];

type RecommendedStrategy = {
  diet_strategy: string;
  calorie_distribution: string;
  goal_type: string;
  reason: string;
};

function computeRecommendation(deficitDuration: string, weekendStruggle: boolean): RecommendedStrategy {
  if (deficitDuration === "12+") {
    return {
      diet_strategy: "reverse_diet",
      calorie_distribution: "stable",
      goal_type: "maintenance",
      reason: "Sei in deficit da più di 12 settimane. Il tuo metabolismo potrebbe aver subito un adattamento significativo. Ti raccomandiamo una fase di Reverse Diet per ripristinare gradualmente il TDEE prima di riprendere il deficit.",
    };
  }

  if (deficitDuration === "4-12") {
    if (weekendStruggle) {
      return {
        diet_strategy: "matador_break",
        calorie_distribution: "polarized",
        goal_type: "sustainable_loss",
        reason: "Dopo diverse settimane di deficit e difficoltà nel weekend, il protocollo MATADOR con distribuzione polarizzata ti aiuterà a gestire la fatica metabolica con fasi di recupero strutturate e calorie più alte nei giorni di allenamento.",
      };
    }
    return {
      diet_strategy: "refeed_1_day",
      calorie_distribution: "stable",
      goal_type: "sustainable_loss",
      reason: "Dopo 4-12 settimane di deficit, un giorno di refeed settimanale stimolerà la leptina e aiuterà a mantenere aderenza e performance senza interrompere i progressi.",
    };
  }

  if (weekendStruggle) {
    return {
      diet_strategy: "refeed_2_days",
      calorie_distribution: "polarized",
      goal_type: "sustainable_loss",
      reason: "Per gestire la tua tendenza a eccedere nel weekend, ti consigliamo 2 giorni di refeed (Sab-Dom) a calorie di mantenimento con distribuzione polarizzata: il deficit verrà redistribuito nei giorni feriali.",
    };
  }

  return {
    diet_strategy: "linear",
    calorie_distribution: "stable",
    goal_type: "sustainable_loss",
    reason: "Il tuo profilo è ideale per un approccio lineare standard. Deficit costante e sostenibile ogni giorno per massimizzare la semplicità e l'aderenza.",
  };
}

const STRATEGY_LABELS: Record<string, string> = {
  linear: "Lineare",
  refeed_1_day: "Refeed 1 giorno",
  refeed_2_days: "Refeed 2 giorni",
  matador_break: "MATADOR (2+2 sett)",
  reverse_diet: "Reverse Diet",
};

const DISTRIBUTION_LABELS: Record<string, string> = {
  stable: "Stabile",
  polarized: "Polarizzata",
};

const GOAL_LABELS: Record<string, string> = {
  sustainable_loss: "Dimagrimento sostenibile",
  maintenance: "Mantenimento",
  weight_gain: "Aumento massa",
  aggressive_minicut: "Mini-cut aggressivo",
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setProfile } = useAppStore();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 - Biometrics
  const [sex, setSex] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState("");

  // Step 2 - Dietary History
  const [deficitDuration, setDeficitDuration] = useState("");

  // Step 3 - Behavioral
  const [weekendStruggle, setWeekendStruggle] = useState<string>("");

  const canNext = () => {
    if (step === 0) return sex !== "" && birthDate !== "" && heightCm !== "" && currentWeight !== "" && activityLevel !== "";
    if (step === 1) return deficitDuration !== "";
    if (step === 2) return weekendStruggle !== "";
    return true;
  };

  const recommendation = computeRecommendation(deficitDuration, weekendStruggle === "yes");

  const handleAcceptRecommendation = async () => {
    await saveProfile(recommendation.diet_strategy, recommendation.calorie_distribution, recommendation.goal_type);
  };

  const handleCustomize = async () => {
    // Save basic biometrics then redirect to settings
    await saveProfile("linear", "stable", "sustainable_loss", true);
  };

  const saveProfile = async (dietStrategy: string, calorieDistribution: string, goalType: string, goToSettings = false) => {
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
          goal_type: goalType,
          diet_strategy: dietStrategy,
          calorie_distribution: calorieDistribution,
        } as any)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      // Also log the initial weight
      if (currentWeight) {
        await supabase.from("daily_metrics").upsert(
          {
            user_id: user.id,
            log_date: new Date().toISOString().slice(0, 10),
            weight: parseFloat(currentWeight),
          },
          { onConflict: "user_id,log_date" }
        );
      }

      setProfile(data);
      toast({ title: "Profilo completato! 🎉", description: "Benvenuto nella tua dashboard." });
      navigate(goToSettings ? "/settings" : "/client-dashboard", { replace: true });
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
              {step === 0 && "Inserisci i tuoi dati biometrici di base."}
              {step === 1 && "Aiutaci a capire la tua storia dietetica recente."}
              {step === 2 && "Una domanda sul tuo comportamento alimentare."}
              {step === 3 && "Ecco la nostra raccomandazione personalizzata."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 0 - Biometrics */}
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Sesso</Label>
                    <Select value={sex || undefined} onValueChange={setSex}>
                      <SelectTrigger className="border-border">
                        <SelectValue placeholder="Seleziona" />
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
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                    <Label className="text-xs text-muted-foreground">Peso attuale (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="30"
                      max="300"
                      placeholder="es. 78.5"
                      value={currentWeight}
                      onChange={(e) => setCurrentWeight(e.target.value)}
                      className="border-border"
                    />
                  </div>
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

            {/* Step 1 - Dietary History */}
            {step === 1 && (
              <div className="space-y-2">
                <Label className="text-sm text-foreground font-medium">
                  Da quanto tempo sei in deficit calorico continuo?
                </Label>
                <RadioGroup value={deficitDuration} onValueChange={setDeficitDuration} className="space-y-2">
                  {DEFICIT_DURATIONS.map((dd) => (
                    <label
                      key={dd.value}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        deficitDuration === dd.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <RadioGroupItem value={dd.value} />
                      <span className="text-sm text-foreground">{dd.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Step 2 - Behavioral */}
            {step === 2 && (
              <div className="space-y-2">
                <Label className="text-sm text-foreground font-medium">
                  Fai fatica a mantenere l'aderenza alla dieta durante il weekend?
                </Label>
                <RadioGroup value={weekendStruggle} onValueChange={setWeekendStruggle} className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex flex-col items-center rounded-lg border p-4 cursor-pointer transition-colors ${
                      weekendStruggle === "yes"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <RadioGroupItem value="yes" className="sr-only" />
                    <span className="text-lg mb-1">😩</span>
                    <span className="text-sm font-semibold text-foreground">Sì</span>
                    <span className="text-xs text-muted-foreground">È il mio punto debole</span>
                  </label>
                  <label
                    className={`flex flex-col items-center rounded-lg border p-4 cursor-pointer transition-colors ${
                      weekendStruggle === "no"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <RadioGroupItem value="no" className="sr-only" />
                    <span className="text-lg mb-1">💪</span>
                    <span className="text-sm font-semibold text-foreground">No</span>
                    <span className="text-xs text-muted-foreground">Nessun problema</span>
                  </label>
                </RadioGroup>
              </div>
            )}

            {/* Step 3 - Recommendation */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground leading-relaxed">{recommendation.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {STRATEGY_LABELS[recommendation.diet_strategy] ?? recommendation.diet_strategy}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {DISTRIBUTION_LABELS[recommendation.calorie_distribution]}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {GOAL_LABELS[recommendation.goal_type]}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleAcceptRecommendation}
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Lightbulb className="mr-2 h-4 w-4" />
                        Accetta
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCustomize}
                    disabled={submitting}
                    className="flex-1"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Personalizza
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation (steps 0-2) */}
            {step < 3 && (
              <div className="flex gap-3 pt-2">
                {step > 0 && (
                  <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Indietro
                  </Button>
                )}
                <Button onClick={() => setStep(step + 1)} disabled={!canNext()} className="flex-1">
                  Avanti
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
