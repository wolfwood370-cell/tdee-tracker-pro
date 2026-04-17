import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Dumbbell, Moon, RefreshCw, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/hooks/use-toast";
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
  getWeekStartISO,
  toLocalISODate,
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

  // Today highlight
  const todayKey = getDayKey();
  const weekStart = getWeekStartISO();
  const weekDates = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(start);
      x.setDate(start.getDate() + i);
      return toLocalISODate(x);
    });
  }, [weekStart]);

  // ── Persistence + Guardrails ──────────────────────────────
  const [pending, setPending] = useState<{ key: DayKey; newType: DayType } | null>(null);
  const [guardrailMessage, setGuardrailMessage] = useState<{ title: string; description: string } | null>(null);
  const [saving, setSaving] = useState<DayKey | null>(null);

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

        {/* Slot counters */}
        <div className="grid grid-cols-3 gap-2">
          <SlotCounter icon={Dumbbell} label="Allenamento" used={usage.trainingUsed} allowed={slots.trainingAllowed} tone="primary" />
          <SlotCounter icon={Moon} label="Riposo" used={usage.restUsed} allowed={slots.restAllowed} tone="muted" />
          {slots.refeedAllowed > 0 && (
            <SlotCounter icon={RefreshCw} label="Refeed" used={usage.refeedUsed} allowed={slots.refeedAllowed} tone="accent" />
          )}
        </div>

        {/* Per-day Strategy Rows */}
        <div className="space-y-2 pt-1">
          {DAY_KEYS.map((key, idx) => {
            const dayType = schedule[key];
            const targets = computeRowTargets(dayType);
            const micro = computeRowMicro(dayType, targets.calories);
            const isToday = weekDates[idx] === toLocalISODate(new Date()) || key === todayKey;
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
