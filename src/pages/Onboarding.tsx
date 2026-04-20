import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { toast } from "@/hooks/use-toast";
import { InBodySegmentalInputs, emptySegmentalFields, segmentalToPayload, type SegmentalFields } from "@/components/InBodySegmentalInputs";
import { isUnderweightRisk, isObesityRisk } from "@/lib/algorithms";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Lightbulb,
  Settings,
  ShieldCheck,
  FileText,
  AlertTriangle as AlertTriangleIcon,
} from "lucide-react";

const STEPS = [
  "Biometria",
  "Obiettivo",
  "Allenamento",
  "Nutrizione",
  "Biofeedback",
  "Disclaimer",
];

const ACTIVITY_LEVELS = [
  { value: "1.2", label: "Sedentario (ufficio, poco movimento)" },
  { value: "1.375", label: "Leggermente attivo (1-3 allenamenti/sett)" },
  { value: "1.55", label: "Moderatamente attivo (3-5 allenamenti/sett)" },
  { value: "1.725", label: "Molto attivo (6-7 allenamenti/sett)" },
  { value: "1.9", label: "Estremamente attivo (atleta)" },
];

const GOAL_TYPES = [
  { value: "sustainable_loss", label: "Perdita di peso sostenibile" },
  { value: "aggressive_minicut", label: "Mini-cut aggressivo" },
  { value: "maintenance", label: "Mantenimento" },
  { value: "weight_gain", label: "Aumento di massa magra" },
];

const DIET_TYPES = [
  { value: "balanced", label: "Bilanciata" },
  { value: "low_fat", label: "Low Fat" },
  { value: "low_carb", label: "Low Carb" },
  { value: "keto", label: "Keto" },
];

const PROTEIN_PREFS = [
  { value: "low", label: "Basso" },
  { value: "moderate", label: "Moderato" },
  { value: "high", label: "Alto" },
  { value: "very_high", label: "Molto alto" },
];

const DEFICIT_DURATIONS = [
  { value: "none", label: "Non sto facendo dieta" },
  { value: "1-4", label: "1–4 settimane" },
  { value: "4-12", label: "4–12 settimane" },
  { value: "12+", label: "Più di 12 settimane" },
];

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

type RecommendedStrategy = {
  diet_strategy: string;
  calorie_distribution: string;
  reason: string;
};

function computeRecommendation(
  deficitDuration: string,
  weekendStruggle: boolean
): RecommendedStrategy | null {
  if (deficitDuration === "12+") {
    return {
      diet_strategy: "reverse_diet",
      calorie_distribution: "stable",
      reason:
        "Sei in deficit da più di 12 settimane. Ti raccomandiamo una fase di Reverse Diet per ripristinare il TDEE prima di riprendere il deficit.",
    };
  }

  if (deficitDuration === "4-12") {
    if (weekendStruggle) {
      return {
        diet_strategy: "matador_break",
        calorie_distribution: "polarized",
        reason:
          "Dopo diverse settimane di deficit e difficoltà nel weekend, il protocollo MATADOR con distribuzione polarizzata ti aiuterà a gestire la fatica metabolica.",
      };
    }
    return {
      diet_strategy: "refeed_1_day",
      calorie_distribution: "stable",
      reason:
        "Dopo 4-12 settimane di deficit, un giorno di refeed settimanale stimolerà la leptina e aiuterà a mantenere aderenza e performance.",
    };
  }

  if (weekendStruggle) {
    return {
      diet_strategy: "refeed_2_days",
      calorie_distribution: "polarized",
      reason:
        "Per gestire la tendenza a eccedere nel weekend, ti consigliamo 2 giorni di refeed con distribuzione polarizzata.",
    };
  }

  return null; // no special recommendation needed — linear is fine
}

function generateTrainingSchedule(days: number): boolean[] {
  // Spread training days evenly across the week (Mon=0 ... Sun=6)
  const schedule = Array(7).fill(false);
  if (days <= 0) return schedule;
  if (days >= 7) return Array(7).fill(true);
  const gap = 7 / days;
  for (let i = 0; i < days; i++) {
    schedule[Math.round(i * gap) % 7] = true;
  }
  return schedule;
}

// Phase 53: build weekly_schedule (the new source of truth) from a boolean[] array.
function buildWeeklySchedule(schedule: boolean[]): Record<string, "training" | "rest" | "refeed"> {
  const keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const out: Record<string, "training" | "rest" | "refeed"> = {} as Record<string, "training" | "rest" | "refeed">;
  keys.forEach((k, i) => {
    out[k] = schedule[i] ? "training" : "rest";
  });
  return out;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setProfile, addLog } = useAppStore();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingText, setLoadingText] = useState(
    "Inizializzazione motore metabolico..."
  );

  const goNext = () => {
    setDirection(1);
    setStep((s) => s + 1);
  };
  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };


  // Track whether the user manually changed smart-default fields
  const userTouchedDistribution = useRef(false);
  const userTouchedProtein = useRef(false);
  const userTouchedDiet = useRef(false);
  const [smartDefaultApplied, setSmartDefaultApplied] = useState({
    distribution: false,
    protein: false,
    diet: false,
  });

  // Step 0 — Biometrics
  const [sex, setSex] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState("");

  // Step 1 — Goal
  const [goalType, setGoalType] = useState("");
  const [targetWeight, setTargetWeight] = useState("");

  // Step 2 — Training
  const [trainingDays, setTrainingDays] = useState("4");
  const [calorieDistribution, setCalorieDistribution] = useState("stable");

  // Step 3 — Nutrition
  const [dietType, setDietType] = useState("balanced");
  const [proteinPref, setProteinPref] = useState("moderate");

  // Step 4 — Biofeedback / History
  const [deficitDuration, setDeficitDuration] = useState("");
  const [weekendStruggle, setWeekendStruggle] = useState("");

  // BIA InBody (optional, step 0)
  const [biaSmm, setBiaSmm] = useState("");
  const [biaBfm, setBiaBfm] = useState("");
  const [biaPbf, setBiaPbf] = useState("");
  const [biaVfa, setBiaVfa] = useState("");
  const [biaBmr, setBiaBmr] = useState("");
  const [biaSegmental, setBiaSegmental] = useState<SegmentalFields>(emptySegmentalFields);

  // Step 5 — Disclaimer
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [trackMenstrualCycle, setTrackMenstrualCycle] = useState(false);

  // Recommendation (computed when reaching step 5)
  const recommendation = computeRecommendation(
    deficitDuration,
    weekendStruggle === "yes"
  );

  // ─── Smart Defaults Engine ───
  useEffect(() => {
    // Step 2 → auto-set calorie distribution
    if (step === 2 && !userTouchedDistribution.current) {
      const days = parseInt(trainingDays) || 4;
      const recommended = days >= 3 ? "polarized" : "stable";
      setCalorieDistribution(recommended);
      setSmartDefaultApplied((prev) => ({ ...prev, distribution: true }));
    }
    // Step 3 → auto-set protein & diet type
    if (step === 3) {
      if (!userTouchedProtein.current) {
        let recommended = "moderate";
        if (goalType === "aggressive_minicut") recommended = "very_high";
        else if (goalType === "sustainable_loss") recommended = "high";
        setProteinPref(recommended);
        setSmartDefaultApplied((prev) => ({ ...prev, protein: true }));
      }
      if (!userTouchedDiet.current) {
        setDietType("balanced");
        setSmartDefaultApplied((prev) => ({ ...prev, diet: true }));
      }
    }
  }, [step, trainingDays, goalType]);

  const canNext = () => {
    switch (step) {
      case 0:
        return (
          sex !== "" &&
          birthDate !== "" &&
          heightCm !== "" &&
          currentWeight !== "" &&
          activityLevel !== ""
        );
      case 1:
        return goalType !== "" && (goalType === 'maintenance' || targetWeight !== '');
      case 2:
        return trainingDays !== "";
      case 3:
        return true; // defaults are set
      case 4:
        return deficitDuration !== "" && weekendStruggle !== "";
      case 5:
        return disclaimerAccepted;
      default:
        return false;
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSubmitting(true);

    // Determine strategy
    let finalStrategy = "linear";
    let finalDistribution = calorieDistribution;
    let finalGoal = goalType;

    if (recommendation) {
      finalStrategy = recommendation.diet_strategy;
      finalDistribution = recommendation.calorie_distribution;
      // Override goal for reverse_diet
      if (recommendation.diet_strategy === "reverse_diet") {
        finalGoal = "maintenance";
      }
    }

    const schedule = generateTrainingSchedule(parseInt(trainingDays));

    try {
      const updatePayload: Record<string, unknown> = {
          sex,
          birth_date: birthDate,
          height_cm: parseFloat(heightCm),
          activity_level: parseFloat(activityLevel),
          goal_type: finalGoal,
          diet_strategy: finalStrategy,
          calorie_distribution: finalDistribution,
          diet_type: dietType,
          protein_pref: proteinPref,
          training_days_per_week: parseInt(trainingDays),
          training_schedule: schedule,
          weekly_schedule: buildWeeklySchedule(schedule),
           track_menstrual_cycle: trackMenstrualCycle,
           target_weight: targetWeight ? parseFloat(targetWeight) : null,
           onboarding_completed: true,
      };
      const { data, error } = await supabase
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(updatePayload as any)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      // Log initial weight + optional BIA data
      if (currentWeight) {
        const metricsRow = {
          user_id: user.id,
          log_date: new Date().toISOString().slice(0, 10),
          weight: parseFloat(currentWeight),
          smm: biaSmm ? parseFloat(biaSmm) : null,
          bfm: biaBfm ? parseFloat(biaBfm) : null,
          pbf: biaPbf ? parseFloat(biaPbf) : null,
          vfa: biaVfa ? parseFloat(biaVfa) : null,
          bmr_inbody: biaBmr ? parseInt(biaBmr) : null,
          ...segmentalToPayload(biaSegmental),
        };
        const { data: logData } = await supabase
          .from("daily_metrics")
          .upsert(metricsRow, { onConflict: "user_id,log_date" })
          .select()
          .single();

        if (logData) {
          addLog(logData);
        }
      }

      setProfile(data);
      toast({
        title: "Profilo completato!",
        description: "Benvenuto nella tua dashboard.",
      });
      navigate("/client-dashboard", { replace: true });
    } catch (e) {
      console.error("Onboarding error:", e);
      toast({
        title: "Errore",
        description: e instanceof Error ? e.message : "Riprova.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Loader text cycling + delayed save when "analyzing"
  useEffect(() => {
    if (!isAnalyzing) return;
    const messages = [
      "Analisi della composizione corporea...",
      "Calcolo del TDEE adattivo...",
      "Sincronizzazione della gerarchia dei macronutrienti...",
      "Generazione del piano nutrizionale...",
    ];
    setLoadingText(messages[0]);
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingText(messages[i]);
    }, 1500);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      saveProfile();
    }, 4500);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalyzing]);

  const handleComplete = () => {
    if (!canNext()) return;
    setIsAnalyzing(true);
  };

  // ─── Analyzing screen ───
  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col items-center gap-8 text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30"
          >
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
            <Activity className="relative h-10 w-10 text-primary" />
          </motion.div>
          <div className="space-y-3">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              Stiamo costruendo il tuo piano
            </h2>
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingText}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="text-sm text-muted-foreground min-h-[1.25rem]"
              >
                {loadingText}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="h-1 w-56 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="h-full w-1/2 bg-primary"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6 animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <span className="font-display font-bold text-xl text-foreground">
            AdaptiveTDEE
          </span>
        </div>

        {/* Top progress bar */}
        <div className="space-y-2 px-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-medium text-primary">{STEPS[step]}</span>
            <span>
              Passo {step + 1} di {STEPS.length}
            </span>
          </div>
        </div>

        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              {STEPS[step]}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {step === 0 && "Inserisci i tuoi dati biometrici di base."}
              {step === 1 && "Qual è il tuo obiettivo principale?"}
              {step === 2 && "Dicci come ti alleni."}
              {step === 3 && "Scegli le tue preferenze nutrizionali."}
              {step === 4 &&
                "Aiutaci a capire la tua storia dietetica recente."}
              {step === 5 && "Leggi e accetta il disclaimer per completare."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={step}
                custom={direction}
                initial={{ opacity: 0, x: direction > 0 ? 24 : -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? -24 : 24 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="space-y-4"
              >
            {/* ─── Step 0: Biometrics ─── */}
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Sesso
                    </Label>
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
                    <Label className="text-xs text-muted-foreground">
                      Data di nascita
                    </Label>
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
                    <Label className="text-xs text-muted-foreground">
                      Altezza (cm)
                    </Label>
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
                    <Label className="text-xs text-muted-foreground">
                      Peso attuale (kg)
                    </Label>
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
                  <Label className="text-xs text-muted-foreground">
                    Livello di Attività
                  </Label>
                  <Select
                    value={activityLevel || undefined}
                    onValueChange={setActivityLevel}
                  >
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

                {/* Menstrual Cycle Toggle (female only) */}
                {sex === 'F' && (
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm text-foreground">Traccia Ciclo Mestruale</Label>
                      <p className="text-xs text-muted-foreground">Ottimizza il TDEE e ignora gli sbalzi di peso dovuti alla ritenzione idrica.</p>
                    </div>
                    <Switch checked={trackMenstrualCycle} onCheckedChange={setTrackMenstrualCycle} />
                  </div>
                )}

                {/* Optional InBody BIA */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="inbody" className="border-border">
                    <AccordionTrigger className="text-sm py-2 hover:no-underline">
                      <span className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        Hai un referto BIA InBody? (Opzionale)
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Massa Muscolare Scheletrica (kg)</Label>
                          <Input type="number" step="0.1" min="0" placeholder="es. 32.5" value={biaSmm} onChange={(e) => setBiaSmm(e.target.value)} className="border-border" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Massa Grassa (kg)</Label>
                          <Input type="number" step="0.1" min="0" placeholder="es. 15.2" value={biaBfm} onChange={(e) => setBiaBfm(e.target.value)} className="border-border" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">% Massa Grassa</Label>
                          <Input type="number" step="0.1" min="0" max="100" placeholder="es. 18.5" value={biaPbf} onChange={(e) => setBiaPbf(e.target.value)} className="border-border" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Grasso Viscerale</Label>
                          <Input type="number" step="1" min="0" placeholder="es. 8" value={biaVfa} onChange={(e) => setBiaVfa(e.target.value)} className="border-border" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Metabolismo Basale InBody (kcal)</Label>
                          <Input type="number" step="1" min="0" placeholder="es. 1650" value={biaBmr} onChange={(e) => setBiaBmr(e.target.value)} className="border-border" />
                        </div>
                      </div>

                      {/* Segmental Analysis */}
                      <InBodySegmentalInputs fields={biaSegmental} onChange={setBiaSegmental} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}

            {/* ─── Step 1: Goal ─── */}
            {step === 1 && (
              <>
                <RadioGroup
                  value={goalType}
                  onValueChange={setGoalType}
                  className="space-y-2"
                >
                  {GOAL_TYPES.map((g) => (
                    <label
                      key={g.value}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        goalType === g.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <RadioGroupItem value={g.value} />
                      <span className="text-sm text-foreground">{g.label}</span>
                    </label>
                  ))}
                </RadioGroup>
                {goalType !== 'maintenance' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Peso Obiettivo (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="30"
                      max="300"
                      placeholder="es. 72.0"
                      value={targetWeight}
                      onChange={(e) => setTargetWeight(e.target.value)}
                      className="border-border"
                    />
                    {targetWeight && heightCm && isUnderweightRisk(parseFloat(targetWeight), parseFloat(heightCm)) && (
                      <Alert variant="destructive" className="border-destructive bg-destructive/10 mt-2">
                        <AlertTriangleIcon className="h-4 w-4" />
                        <AlertTitle className="font-display font-semibold text-sm">⚠️ Attenzione Clinica</AlertTitle>
                        <AlertDescription className="text-xs mt-1">
                          Il peso obiettivo inserito porterebbe a un Indice di Massa Corporea (BMI) inferiore a 18.5, classificato come sottopeso severo. Procedere con questo obiettivo senza supervisione medica può comportare gravi rischi per la salute.
                        </AlertDescription>
                      </Alert>
                    )}
                    {targetWeight && heightCm && !isUnderweightRisk(parseFloat(targetWeight), parseFloat(heightCm)) && isObesityRisk(parseFloat(targetWeight), parseFloat(heightCm)) && (
                      <Alert className="border-orange-500/50 bg-orange-500/10 mt-2">
                        <AlertTriangleIcon className="h-4 w-4 text-orange-600" />
                        <AlertTitle className="font-display font-semibold text-sm text-orange-700">⚠️ Avviso Clinico</AlertTitle>
                        <AlertDescription className="text-xs mt-1 text-orange-700/80">
                          Il peso obiettivo porterebbe a un BMI ≥ 30 (Obesità). Sebbene il BMI non distingua tra massa muscolare e grassa, superare questa soglia richiede attenzione per prevenire insulino-resistenza e stress cardiovascolare.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ─── Step 2: Training ─── */}
            {step === 2 && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Giorni di allenamento a settimana
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="7"
                    value={trainingDays}
                    onChange={(e) => {
                      const v = Math.min(7, Math.max(1, parseInt(e.target.value) || 1));
                      setTrainingDays(String(v));
                    }}
                    className="border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-foreground font-medium">
                    Distribuzione Calorie
                  </Label>
                  <RadioGroup
                    value={calorieDistribution}
                    onValueChange={(v) => { userTouchedDistribution.current = true; setSmartDefaultApplied((p) => ({ ...p, distribution: false })); setCalorieDistribution(v); }}
                    className="grid grid-cols-2 gap-3"
                  >
                    <label
                      className={`flex flex-col items-center rounded-lg border p-4 cursor-pointer transition-colors ${
                        calorieDistribution === "stable"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <RadioGroupItem value="stable" className="sr-only" />
                      <span className="text-sm font-semibold text-foreground">
                        Stabile
                      </span>
                      <span className="text-xs text-muted-foreground text-center">
                        Stesse calorie ogni giorno
                      </span>
                    </label>
                    <label
                      className={`flex flex-col items-center rounded-lg border p-4 cursor-pointer transition-colors ${
                        calorieDistribution === "polarized"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <RadioGroupItem value="polarized" className="sr-only" />
                      <span className="text-sm font-semibold text-foreground">
                        Polarizzata
                      </span>
                      <span className="text-xs text-muted-foreground text-center">
                        +20% nei giorni di allenamento
                      </span>
                    </label>
                  </RadioGroup>
                  {smartDefaultApplied.distribution && (
                    <p className="text-xs text-muted-foreground mt-1">Selezionato dal sistema in base ai tuoi dati</p>
                  )}
                </div>
              </>
            )}

            {/* ─── Step 3: Nutrition ─── */}
            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm text-foreground font-medium">
                    Stile Alimentare
                  </Label>
                  <RadioGroup
                    value={dietType}
                    onValueChange={(v) => { userTouchedDiet.current = true; setSmartDefaultApplied((p) => ({ ...p, diet: false })); setDietType(v); }}
                    className="space-y-2"
                  >
                    {DIET_TYPES.map((d) => (
                      <label
                        key={d.value}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          dietType === d.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <RadioGroupItem value={d.value} />
                        <span className="text-sm text-foreground">
                          {d.label}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                  {smartDefaultApplied.diet && (
                    <p className="text-xs text-muted-foreground mt-1">✨ Selezionato dal sistema in base ai tuoi dati</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-foreground font-medium">
                    Apporto Proteico
                  </Label>
                  <RadioGroup
                    value={proteinPref}
                    onValueChange={(v) => { userTouchedProtein.current = true; setSmartDefaultApplied((p) => ({ ...p, protein: false })); setProteinPref(v); }}
                    className="grid grid-cols-2 gap-3"
                  >
                    {PROTEIN_PREFS.map((p) => (
                      <label
                        key={p.value}
                        className={`flex flex-col items-center rounded-lg border p-3 cursor-pointer transition-colors ${
                          proteinPref === p.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <RadioGroupItem value={p.value} className="sr-only" />
                        <span className="text-sm font-semibold text-foreground">
                          {p.label}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                  {smartDefaultApplied.protein && (
                    <p className="text-xs text-muted-foreground mt-1">✨ Selezionato dal sistema in base ai tuoi dati</p>
                  )}
                </div>
              </>
            )}

            {/* ─── Step 4: Biofeedback / History ─── */}
            {step === 4 && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm text-foreground font-medium">
                    Da quanto tempo sei in deficit calorico continuo?
                  </Label>
                  <RadioGroup
                    value={deficitDuration}
                    onValueChange={setDeficitDuration}
                    className="space-y-2"
                  >
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
                        <span className="text-sm text-foreground">
                          {dd.label}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-foreground font-medium">
                    Fai fatica a mantenere l'aderenza alla dieta durante il
                    weekend?
                  </Label>
                  <RadioGroup
                    value={weekendStruggle}
                    onValueChange={setWeekendStruggle}
                    className="grid grid-cols-2 gap-3"
                  >
                    <label
                      className={`flex flex-col items-center rounded-lg border p-4 cursor-pointer transition-colors ${
                        weekendStruggle === "yes"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <RadioGroupItem value="yes" className="sr-only" />
                      <span className="text-lg mb-1">😩</span>
                      <span className="text-sm font-semibold text-foreground">
                        Sì
                      </span>
                      <span className="text-xs text-muted-foreground">
                        È il mio punto debole
                      </span>
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
                      <span className="text-sm font-semibold text-foreground">
                        No
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Nessun problema
                      </span>
                    </label>
                  </RadioGroup>
                </div>
              </>
            )}

            {/* ─── Step 5: Disclaimer ─── */}
            {step === 5 && (
              <div className="space-y-4">
                {/* AI Recommendation banner (if applicable) */}
                {recommendation && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-primary">
                          Raccomandazione automatica
                        </p>
                        <p className="text-sm text-foreground leading-relaxed">
                          {recommendation.reason}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {STRATEGY_LABELS[recommendation.diet_strategy] ??
                          recommendation.diet_strategy}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {DISTRIBUTION_LABELS[
                          recommendation.calorie_distribution
                        ]}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Disclaimer Legale e Medico
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Dichiaro di aver compreso che NC Nutrition e i
                    servizi offerti dal Coach non sostituiscono in alcun modo il
                    parere di un medico o le prescrizioni di un biologo
                    nutrizionista. Le strategie proposte sono calcoli matematici
                    basati sul dispendio energetico a puro scopo sportivo e di
                    ricomposizione corporea. Sollevo il Coach da qualsiasi
                    responsabilità legata a patologie o disturbi derivanti
                    dall'applicazione di questi calcoli. Accetto di consultare un
                    medico prima di intraprendere qualsiasi variazione drastica
                    della mia dieta o del mio stile di vita.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="disclaimer"
                      checked={disclaimerAccepted}
                      onCheckedChange={(checked) =>
                        setDisclaimerAccepted(checked === true)
                      }
                    />
                    <Label
                      htmlFor="disclaimer"
                      className="text-sm font-medium text-foreground cursor-pointer"
                    >
                      Ho letto, compreso e accetto il disclaimer.
                    </Label>
                  </div>
                </div>
              </div>
            )}
              </motion.div>
            </AnimatePresence>

            {/* ─── Navigation ─── */}
            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <Button
                  variant="outline"
                  onClick={goBack}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Indietro
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button
                  onClick={goNext}
                  disabled={!canNext()}
                  className="flex-1"
                >
                  Avanti
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={!canNext() || submitting}
                  className="flex-1"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
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
