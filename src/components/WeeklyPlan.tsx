import { useMemo, useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CalendarDays, Dumbbell, Moon, RefreshCw, Info, Target, AlertTriangle as AlertTriangleIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/hooks/use-toast";
import { isUnderweightRisk, isObesityRisk } from "@/lib/algorithms";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/stores";
import { supabase } from "@/integrations/supabase/client";
import {
  getWeeklySlots,
  getWeeklyUsage,
  getWeeklyRemainingBudget,
  daysElapsedInWeek,
  estimateExtraDayDelta,
  parseWeeklySchedule,
  getDayKey,
  DAY_KEYS,
  DAY_LABELS_IT,
  type DayType,
  type DayKey,
  type WeeklySchedule,
} from "@/lib/weeklyBudget";
import {
  computeDayTargets,
  calculateMicronutrients,
  type WeeklyPlan as WeeklyPlanType,
  type DietStrategy,
  type ProteinPref,
  type DietType,
} from "@/lib/algorithms";

const STRATEGY_LABELS: Record<DietStrategy, string> = {
  linear: "Lineare",
  refeed_1_day: "Refeed 1g",
  refeed_2_days: "Refeed 2g",
  matador_break: "MATADOR",
  reverse_diet: "Reverse Diet",
};

const GOAL_TYPES = [
  { value: "sustainable_loss", label: "Perdita di peso sostenibile" },
  { value: "aggressive_minicut", label: "Mini-cut aggressivo" },
  { value: "maintenance", label: "Mantenimento" },
  { value: "weight_gain", label: "Aumento di massa magra" },
] as const;

interface WeeklyPlanProps {
  plan: WeeklyPlanType;
  /** Today's effective calorie target (used as fallback when plan is missing) */
  todayTarget?: number | null;
}

export function WeeklyPlan({ plan, todayTarget }: WeeklyPlanProps) {
  const {
    user,
    profile,
    dailyLogs,
    polarizedTargets,
    currentTDEE,
    targetCalories,
    setProfile,
  } = useAppStore();

  const dietStrategy = (profile?.diet_strategy as DietStrategy) ?? "linear";
  const allowRefeed = dietStrategy === "refeed_1_day" || dietStrategy === "refeed_2_days";

  const schedule: WeeklySchedule = useMemo(
    () => parseWeeklySchedule((profile as { weekly_schedule?: unknown } | null)?.weekly_schedule),
    [profile],
  );

  const slots = useMemo(() => getWeeklySlots(profile), [profile]);
  const usage = useMemo(() => getWeeklyUsage(schedule), [schedule]);

  // Latest weight for macro recomputation
  const latestWeight = useMemo(() => {
    const sorted = [...dailyLogs].sort(
      (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime(),
    );
    return sorted.find((l) => l.weight != null)?.weight ?? null;
  }, [dailyLogs]);

  const latestTbw = useMemo(() => {
    const sorted = [...dailyLogs].sort(
      (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime(),
    );
    return sorted.find((l) => l.tbw != null)?.tbw ?? null;
  }, [dailyLogs]);

  // LBM derived from latest BIA log (for protein calc)
  const latestLbm = useMemo(() => {
    const sorted = [...dailyLogs].sort(
      (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime(),
    );
    const log = sorted.find((l) => l.bfm != null || l.pbf != null);
    if (!log) return null;
    if (log.bfm != null && log.weight != null) return log.weight - Number(log.bfm);
    if (log.pbf != null && log.weight != null) return Number(log.weight) * (1 - Number(log.pbf) / 100);
    return null;
  }, [dailyLogs]);

  // User age
  const userAge = useMemo(() => {
    if (!profile?.birth_date) return null;
    const bd = new Date(profile.birth_date);
    const now = new Date();
    let age = now.getFullYear() - bd.getFullYear();
    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) {
      age--;
    }
    return age;
  }, [profile?.birth_date]);

  const baselineDailyCal = targetCalories ?? plan.days[0]?.calories ?? 2000;
  const tdee = currentTDEE ?? baselineDailyCal;
  const bodyWeight = latestWeight ?? 70;
  const proteinPref = (profile?.protein_pref as ProteinPref) ?? "moderate";
  const dietType = (profile?.diet_type as DietType) ?? "balanced";

  // Per-day on-the-fly target calculation
  const computeRowTargets = useCallback(
    (dayType: DayType) =>
      computeDayTargets({
        dayType,
        baselineDailyCal,
        tdee,
        bodyWeightKg: bodyWeight,
        proteinPref,
        dietType,
        lbmKg: latestLbm,
        age: userAge,
        polarized: polarizedTargets,
      }),
    [baselineDailyCal, tdee, bodyWeight, proteinPref, dietType, latestLbm, userAge, polarizedTargets],
  );

  // Per-day micronutrients (water/sodium) — depends on activity level + day type
  const computeRowMicro = useCallback(
    (dayType: DayType, calories: number) => {
      const activityLevel =
        typeof profile?.activity_level === "number"
          ? profile.activity_level
          : profile?.activity_level
            ? parseFloat(String(profile.activity_level))
            : 1.55;
      return calculateMicronutrients(
        calories,
        activityLevel,
        latestWeight,
        latestTbw,
        dayType === "training",
        profile?.sex ?? null,
      );
    },
    [profile?.activity_level, profile?.sex, latestWeight, latestTbw],
  );

  // Weekly budget (reads consumption from logs)
  const budget = useMemo(
    () => getWeeklyRemainingBudget(dailyLogs, plan, todayTarget ?? null),
    [dailyLogs, plan, todayTarget],
  );

  const consumedPct = budget.totalKcal > 0
    ? Math.min(100, Math.round((budget.consumedKcal / budget.totalKcal) * 100))
    : 0;
  const expectedPct = budget.totalKcal > 0
    ? Math.min(100, Math.round((budget.expectedSoFarKcal / budget.totalKcal) * 100))
    : 0;
  const overBudget = budget.consumedKcal > budget.totalKcal;
  const overPace = !overBudget && budget.consumedKcal > budget.expectedSoFarKcal * 1.05;
  const remainingKcal = Math.max(0, budget.totalKcal - budget.consumedKcal);

  // Today highlight (single source: DayKey of today, no double check)
  const todayKey = getDayKey();

  // ── Persistence + Guardrails ──────────────────────────────
  const [pending, setPending] = useState<{ key: DayKey; newType: DayType } | null>(null);
  const [guardrailMessage, setGuardrailMessage] = useState<{ title: string; description: string } | null>(null);
  const [saving, setSaving] = useState<DayKey | null>(null);

  // ── Current Goal (moved from Settings) ────────────────────
  const [goalType, setGoalType] = useState<string>(profile?.goal_type ?? "sustainable_loss");
  const [targetWeight, setTargetWeight] = useState<string>(profile?.target_weight?.toString() ?? "");
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    setGoalType(profile?.goal_type ?? "sustainable_loss");
    setTargetWeight(profile?.target_weight?.toString() ?? "");
  }, [profile?.goal_type, profile?.target_weight]);

  const heightCmNum = profile?.height_cm ?? null;
  const targetWeightNum = targetWeight ? parseFloat(targetWeight) : null;

  const persistGoal = useCallback(
    async (next: { goal_type?: string; target_weight?: number | null }) => {
      if (!user || !profile) return;
      setSavingGoal(true);
      const { data, error } = await supabase
        .from("profiles")
        .update(next)
        .eq("id", user.id)
        .select()
        .single();
      setSavingGoal(false);
      if (error) {
        toast({ title: "Errore", description: "Impossibile salvare l'obiettivo.", variant: "destructive" });
        return;
      }
      if (data) setProfile(data);
    },
    [user, profile, setProfile],
  );

  const handleGoalChange = (value: string) => {
    setGoalType(value);
    void persistGoal({ goal_type: value });
  };

  const handleTargetWeightBlur = () => {
    const trimmed = targetWeight.trim();
    let parsed: number | null = null;
    if (trimmed) {
      const n = parseFloat(trimmed);
      if (!isFinite(n) || n < 30 || n > 300) {
        toast({
          title: "Peso non valido",
          description: "Inserisci un valore tra 30 e 300 kg.",
          variant: "destructive",
        });
        // Reset display value to last persisted value
        setTargetWeight(profile?.target_weight?.toString() ?? "");
        return;
      }
      parsed = n;
    }
    if (parsed !== (profile?.target_weight ?? null)) {
      void persistGoal({ target_weight: parsed });
    }
  };

  const persistSchedule = useCallback(
    async (key: DayKey, newType: DayType) => {
      if (!user || !profile) return;
      setSaving(key);
      const nextSchedule: WeeklySchedule = { ...schedule, [key]: newType };
      const { data, error } = await supabase
        .from("profiles")
        .update({ weekly_schedule: nextSchedule })
        .eq("id", user.id)
        .select()
        .single();

      setSaving(null);
      if (error) {
        toast({
          title: "Errore",
          description: "Impossibile salvare la pianificazione settimanale.",
          variant: "destructive",
        });
        return;
      }
      if (data) setProfile(data);
    },
    [user, profile, schedule, setProfile],
  );

  const handleChange = (key: DayKey, value: string) => {
    if (!value) return;
    const newType = value as DayType;
    if (newType === schedule[key]) return;

    // Compute usage WITHOUT the previous assignment for this day, so we evaluate the new pick fairly
    const adjUsage = { ...usage };
    const prev = schedule[key];
    if (prev === "training") adjUsage.trainingUsed--;
    if (prev === "rest") adjUsage.restUsed--;
    if (prev === "refeed") adjUsage.refeedUsed--;

    if (newType === "refeed" && slots.refeedAllowed > 0 && adjUsage.refeedUsed >= slots.refeedAllowed) {
      const delta = estimateExtraDayDelta("refeed", plan, todayTarget ?? null);
      setPending({ key, newType });
      setGuardrailMessage({
        title: "Budget Settimanale a Rischio",
        description: `Attenzione: aggiungere un altro giorno di Refeed non previsto porterà un eccesso di circa +${delta.toLocaleString("it-IT")} kcal sul tuo bilancio settimanale, rallentando il dimagrimento. Hai già pianificato ${slots.refeedAllowed}/${slots.refeedAllowed} refeed. Vuoi forzare la selezione?`,
      });
      return;
    }

    if (newType === "rest" && slots.restAllowed > 0 && adjUsage.restUsed >= slots.restAllowed) {
      const delta = estimateExtraDayDelta("rest", plan, todayTarget ?? null);
      setPending({ key, newType });
      setGuardrailMessage({
        title: "Troppi Giorni di Riposo",
        description: `Attenzione: aggiungere un giorno di Riposo non previsto ridurrà il tuo budget di circa ${delta.toLocaleString("it-IT")} kcal sulla settimana, aumentando il rischio di perdita di massa magra. Hai già pianificato ${slots.restAllowed}/${slots.restAllowed} giorni di riposo. Vuoi forzare la selezione?`,
      });
      return;
    }

    void persistSchedule(key, newType);
  };

  const confirmPending = async () => {
    if (pending) await persistSchedule(pending.key, pending.newType);
    setPending(null);
    setGuardrailMessage(null);
  };

  const cancelPending = () => {
    setPending(null);
    setGuardrailMessage(null);
  };

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Piano Settimanale — La Tua Strategia
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {STRATEGY_LABELS[plan.strategy] ?? plan.strategy}
            {plan.isMaintenancePhase && " — Fase Mantenimento"}
            {plan.reverseWeekNumber && ` — Settimana ${plan.reverseWeekNumber}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* === 🎯 Obiettivo Attuale (moved from Settings) === */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-display font-semibold text-foreground">Obiettivo Attuale</h3>
            {savingGoal && <span className="text-[10px] text-muted-foreground ml-auto">salvataggio…</span>}
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">
            Modifica il tuo obiettivo qui; i macro sottostanti si aggiorneranno automaticamente.
          </p>

          <RadioGroup value={goalType} onValueChange={handleGoalChange} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {GOAL_TYPES.map((gt) => (
              <label
                key={gt.value}
                className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer transition-colors ${
                  goalType === gt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 bg-background"
                }`}
              >
                <RadioGroupItem value={gt.value} />
                <span className="text-xs text-foreground">{gt.label}</span>
              </label>
            ))}
          </RadioGroup>

          {goalType !== "maintenance" && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                Peso Obiettivo (kg)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="30"
                max="300"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                onBlur={handleTargetWeightBlur}
                placeholder="es. 72.0"
                className="border-border bg-background h-9"
              />
              {targetWeightNum != null && heightCmNum != null && isUnderweightRisk(targetWeightNum, heightCmNum) && (
                <Alert variant="destructive" className="border-destructive bg-destructive/10 mt-1">
                  <AlertTriangleIcon className="h-4 w-4" />
                  <AlertTitle className="font-display font-semibold text-xs">⚠️ Attenzione Clinica</AlertTitle>
                  <AlertDescription className="text-[11px] mt-1">
                    Il peso obiettivo porterebbe a un BMI inferiore a 18.5 (sottopeso severo). Procedere senza supervisione medica può comportare gravi rischi per la salute.
                  </AlertDescription>
                </Alert>
              )}
              {targetWeightNum != null && heightCmNum != null && !isUnderweightRisk(targetWeightNum, heightCmNum) && isObesityRisk(targetWeightNum, heightCmNum) && (
                <Alert className="border-orange-500/50 bg-orange-500/10 mt-1">
                  <AlertTriangleIcon className="h-4 w-4 text-orange-600" />
                  <AlertTitle className="font-display font-semibold text-xs text-orange-700">⚠️ Avviso Clinico</AlertTitle>
                  <AlertDescription className="text-[11px] mt-1 text-orange-700/80">
                    Il peso obiettivo porterebbe a un BMI ≥ 30 (Obesità). Richiede attenzione per prevenire insulino-resistenza e stress cardiovascolare.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* === Stile Alimentare: Polarizzato vs Lineare === */}
        {(() => {
          const distribution = (profile?.calorie_distribution as string) ?? "stable";
          const isPolarized = distribution === "polarized";
          const handleDistributionChange = async (next: "polarized" | "stable") => {
            if (!user || !profile) return;
            if (next === distribution) return;
            const { data, error } = await supabase
              .from("profiles")
              .update({ calorie_distribution: next })
              .eq("id", user.id)
              .select()
              .single();
            if (error) {
              toast({
                title: "Errore",
                description: "Impossibile salvare lo stile dieta.",
                variant: "destructive",
              });
              return;
            }
            if (data) setProfile(data);
          };
          return (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-display font-semibold text-foreground flex items-center gap-1.5">
                  Stile Alimentare
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="Info stile alimentare" className="text-muted-foreground hover:text-foreground transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        <p><span className="font-semibold">Lineare:</span> Stesse calorie ogni giorno.</p>
                        <p><span className="font-semibold">Polarizzata:</span> Più calorie nei giorni di allenamento, meno nei giorni di riposo.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <ToggleGroup
                  type="single"
                  value={isPolarized ? "polarized" : "linear"}
                  onValueChange={(v) => v && handleDistributionChange(v === "polarized" ? "polarized" : "stable")}
                  className="gap-1"
                >
                  <ToggleGroupItem
                    value="polarized"
                    size="sm"
                    className="text-[11px] px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border"
                  >
                    Polarizzata
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="linear"
                    size="sm"
                    className="text-[11px] px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border"
                  >
                    Lineare
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isPolarized
                  ? "Calorie diverse tra giorni di allenamento, riposo e refeed per ottimizzare la performance."
                  : "Macro fissi ogni giorno: zero pianificazione, massima semplicità."}
              </p>
            </div>
          );
        })()}

        {/* Weekly Budget Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground inline-flex items-center gap-1 cursor-help">
                    Budget Settimanale <Info className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  Questo è il tuo "conto in banca" calorico della settimana. Le calorie consumate vengono prelevate dal totale; il marker verticale mostra dove dovresti essere oggi.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className={`font-semibold ${overBudget ? "text-destructive" : overPace ? "text-amber-600" : "text-foreground"}`}>
              {budget.consumedKcal.toLocaleString("it-IT")} / {budget.totalKcal.toLocaleString("it-IT")} kcal
            </span>
          </div>
          <div className="relative">
            <Progress
              value={consumedPct}
              className={overBudget ? "[&>div]:bg-destructive" : overPace ? "[&>div]:bg-amber-500" : ""}
            />
            {expectedPct < 100 && (
              <div
                className="absolute top-0 bottom-0 right-0 bg-muted-foreground/10 pointer-events-none rounded-r"
                style={{ left: `${Math.max(consumedPct, expectedPct)}%` }}
                aria-hidden
              />
            )}
            {expectedPct > 0 && expectedPct < 100 && (
              <div
                className="absolute top-0 bottom-0 w-px bg-foreground/60"
                style={{ left: `${expectedPct}%` }}
                aria-hidden
              />
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {overBudget
                ? `⚠️ Superato di ${(budget.consumedKcal - budget.totalKcal).toLocaleString("it-IT")} kcal`
                : overPace
                ? `⚡ Sopra il ritmo previsto (atteso a oggi: ${budget.expectedSoFarKcal.toLocaleString("it-IT")} kcal)`
                : `Restano ${remainingKcal.toLocaleString("it-IT")} kcal — atteso a oggi: ${budget.expectedSoFarKcal.toLocaleString("it-IT")} kcal`}
            </span>
            <span className="text-muted-foreground/70">Giorno {daysElapsedInWeek()}/7</span>
          </div>
        </div>

        {/* Conditional rendering: Polarized → 7-day selector | Linear → single fixed-macro card */}
        {((profile?.calorie_distribution as string) ?? "stable") !== "polarized" ? (
          <LinearMacroCard
            calories={Math.round(budget.totalKcal / 7)}
            macros={(() => {
              const avg = Math.round(budget.totalKcal / 7);
              return computeDayTargets({
                dayType: "training",
                baselineDailyCal: avg,
                tdee,
                bodyWeightKg: bodyWeight,
                proteinPref,
                dietType,
                lbmKg: latestLbm,
                age: userAge,
                polarized: null,
              }).macros;
            })()}
          />
        ) : (
          <>
            {/* Slot counters */}
            <div className="grid grid-cols-3 gap-2">
              <SlotCounter icon={Dumbbell} label="Allenamento" used={usage.trainingUsed} allowed={slots.trainingAllowed} tone="primary" />
              <SlotCounter icon={Moon} label="Riposo" used={usage.restUsed} allowed={slots.restAllowed} tone="muted" />
              {slots.refeedAllowed > 0 && (
                <SlotCounter icon={RefreshCw} label="Refeed" used={usage.refeedUsed} allowed={slots.refeedAllowed} tone="accent" />
              )}
            </div>
          </>
        )}

        {/* Per-day Strategy Rows */}
        {/* Per-day Strategy Rows — only in Polarized mode */}
        {((profile?.calorie_distribution as string) ?? "stable") === "polarized" && (
        <div className="space-y-2 pt-1">
          {DAY_KEYS.map((key) => {
            const dayType = schedule[key];
            const targets = computeRowTargets(dayType);
            const micro = computeRowMicro(dayType, targets.calories);
            const isToday = key === todayKey;
            const isSavingRow = saving === key;

            return (
              <div
                key={key}
                className={`rounded-lg border p-2.5 transition-colors ${
                  isToday ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/30"
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-display font-semibold w-20 shrink-0 ${isToday ? "text-primary" : "text-foreground"}`}>
                    {DAY_LABELS_IT[key]}
                    {isToday && <span className="ml-1 text-[10px] text-primary/70">(oggi)</span>}
                  </span>
                  <ToggleGroup
                    type="single"
                    value={dayType}
                    onValueChange={(v) => handleChange(key, v)}
                    className="gap-1"
                    disabled={isSavingRow}
                  >
                    <ToggleGroupItem
                      value="rest"
                      size="sm"
                      aria-label="Riposo"
                      title="Riposo"
                      className="h-8 w-8 p-0 data-[state=on]:bg-muted-foreground/30 data-[state=on]:text-foreground border border-border"
                    >
                      <Moon className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="training"
                      size="sm"
                      aria-label="Allenamento"
                      title="Allenamento"
                      className="h-8 w-8 p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border"
                    >
                      <Dumbbell className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                    {allowRefeed && (
                      <ToggleGroupItem
                        value="refeed"
                        size="sm"
                        aria-label="Refeed"
                        title="Refeed"
                        className="h-8 w-8 p-0 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground border border-border"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </ToggleGroupItem>
                    )}
                  </ToggleGroup>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground font-mono leading-tight">
                  Cal <span className="text-foreground font-semibold">{targets.calories}</span> {" | "}
                  P <span className="text-foreground font-semibold">{targets.macros.protein}g</span> {" | "}
                  G <span className="text-foreground font-semibold">{targets.macros.fats}g</span> {" | "}
                  C <span className="text-foreground font-semibold">{targets.macros.carbs}g</span> {" | "}
                  A <span className="text-foreground font-semibold">{micro.waterL}L</span> {" | "}
                  Na <span className="text-foreground font-semibold">{micro.sodiumMg}mg</span>
                </p>
              </div>
            );
          })}
        </div>
        )}
      </CardContent>

      <AlertDialog open={guardrailMessage != null} onOpenChange={(open) => { if (!open) cancelPending(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{guardrailMessage?.title}</AlertDialogTitle>
            <AlertDialogDescription>{guardrailMessage?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPending}>Mantieni Piano</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPending}>Procedi Comunque</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

interface SlotCounterProps {
  icon: React.ElementType;
  label: string;
  used: number;
  allowed: number;
  tone: "primary" | "muted" | "accent";
}

function SlotCounter({ icon: Icon, label, used, allowed, tone }: SlotCounterProps) {
  const exceeded = allowed > 0 && used > allowed;
  const exhausted = allowed > 0 && used >= allowed;
  const toneClass =
    tone === "primary" ? "text-primary" : tone === "accent" ? "text-accent-foreground" : "text-muted-foreground";
  return (
    <div className="bg-secondary/50 rounded-lg p-2.5 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p
        className={`text-sm font-display font-bold ${
          exceeded ? "text-destructive" : exhausted ? "text-amber-600" : "text-foreground"
        }`}
      >
        {used}/{allowed} <span className="text-[10px] font-normal text-muted-foreground">pianificati</span>
      </p>
    </div>
  );
}

interface LinearMacroCardProps {
  calories: number;
  macros: { protein: number; carbs: number; fats: number };
}

function LinearMacroCard({ calories, macros }: LinearMacroCardProps) {
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-display font-semibold text-foreground">
          Macro Fissi Giornalieri
        </h3>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Stessi target ogni giorno della settimana — semplice e diretto.
      </p>
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-background/60 rounded-lg p-2.5 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Kcal</p>
          <p className="text-lg font-display font-bold text-foreground">{calories.toLocaleString("it-IT")}</p>
        </div>
        <div className="bg-background/60 rounded-lg p-2.5 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">P</p>
          <p className="text-lg font-display font-bold text-foreground">{macros.protein}g</p>
        </div>
        <div className="bg-background/60 rounded-lg p-2.5 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">C</p>
          <p className="text-lg font-display font-bold text-foreground">{macros.carbs}g</p>
        </div>
        <div className="bg-background/60 rounded-lg p-2.5 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">G</p>
          <p className="text-lg font-display font-bold text-foreground">{macros.fats}g</p>
        </div>
      </div>
    </div>
  );
}
