import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Dumbbell, Moon, RefreshCw, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores";
import {
  getWeeklySlots,
  getWeeklyUsage,
  getWeeklyRemainingBudget,
  getWeekStartISO,
  toLocalISODate,
  daysElapsedInWeek,
  type DayType,
} from "@/lib/weeklyBudget";
import type { WeeklyPlan as WeeklyPlanType, DietStrategy } from "@/lib/algorithms";

const STRATEGY_LABELS: Record<DietStrategy, string> = {
  linear: "Lineare",
  refeed_1_day: "Refeed 1g",
  refeed_2_days: "Refeed 2g",
  matador_break: "MATADOR",
  reverse_diet: "Reverse Diet",
};

interface WeeklyPlanProps {
  plan: WeeklyPlanType;
  /** Day type currently selected on the dashboard (reflects optimistic preview) */
  selectedDayType?: DayType;
  /** Today's effective calorie target (used as fallback when plan is missing) */
  todayTarget?: number | null;
}

export function WeeklyPlan({ plan, selectedDayType, todayTarget }: WeeklyPlanProps) {
  const { profile, dailyLogs, polarizedTargets } = useAppStore();
  const isPolarized = polarizedTargets != null;

  const schedule: boolean[] =
    (profile?.training_schedule as boolean[] | null) ??
    [true, false, true, false, true, false, false];

  const slots = useMemo(() => getWeeklySlots(profile), [profile]);

  // Optimistic usage: if today's selection is not yet persisted in dailyLogs,
  // overlay it for live counter feedback.
  const todayStr = toLocalISODate(new Date());
  const usage = useMemo(() => {
    const base = getWeeklyUsage(dailyLogs);
    if (!selectedDayType) return base;
    const todayLog = dailyLogs.find((l) => l.log_date === todayStr) as
      | (typeof dailyLogs[number] & { day_type?: string | null })
      | undefined;
    const persistedToday = todayLog?.day_type ?? null;
    if (persistedToday === selectedDayType) return base;
    // Remove previously-counted persisted type for today, add the optimistic one
    const adjusted = { ...base };
    if (persistedToday === "training") adjusted.trainingUsed = Math.max(0, adjusted.trainingUsed - 1);
    if (persistedToday === "rest") adjusted.restUsed = Math.max(0, adjusted.restUsed - 1);
    if (persistedToday === "refeed") adjusted.refeedUsed = Math.max(0, adjusted.refeedUsed - 1);
    if (selectedDayType === "training") adjusted.trainingUsed += 1;
    if (selectedDayType === "rest") adjusted.restUsed += 1;
    if (selectedDayType === "refeed") adjusted.refeedUsed += 1;
    return adjusted;
  }, [dailyLogs, selectedDayType, todayStr]);

  const budget = useMemo(
    () => getWeeklyRemainingBudget(profile, dailyLogs, plan, todayTarget ?? null, selectedDayType ?? null),
    [profile, dailyLogs, plan, todayTarget, selectedDayType],
  );

  // Pace-aware status: compare consumed against the pro-rated expected total so far.
  const consumedPct = budget.totalKcal > 0
    ? Math.min(100, Math.round((budget.consumedKcal / budget.totalKcal) * 100))
    : 0;
  const expectedPct = budget.totalKcal > 0
    ? Math.min(100, Math.round((budget.expectedSoFarKcal / budget.totalKcal) * 100))
    : 0;
  const overBudget = budget.consumedKcal > budget.totalKcal;
  const overPace = !overBudget && budget.consumedKcal > budget.expectedSoFarKcal * 1.05;
  const remainingKcal = Math.max(0, budget.totalKcal - budget.consumedKcal);

  const maxCal = Math.max(...plan.days.map((d) => d.calories));
  const weekStart = getWeekStartISO();
  const weekDates = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(start);
      x.setDate(start.getDate() + i);
      return toLocalISODate(x);
    });
  }, [weekStart]);

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Piano Settimanale
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
            {/* Planned-future shading: from expected pace marker to end represents future planned days */}
            {expectedPct < 100 && (
              <div
                className="absolute top-0 bottom-0 right-0 bg-muted-foreground/10 pointer-events-none rounded-r"
                style={{ left: `${Math.max(consumedPct, expectedPct)}%` }}
                aria-hidden
              />
            )}
            {/* Expected-pace marker (where you "should be" mid-week) */}
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
            <span className="text-muted-foreground/70">
              Giorno {daysElapsedInWeek()}/7
            </span>
          </div>
        </div>

        {/* Slot counters */}
        <div className="grid grid-cols-3 gap-2">
          <SlotCounter
            icon={Dumbbell}
            label="Allenamento"
            used={usage.trainingUsed}
            allowed={slots.trainingAllowed}
            tone="primary"
          />
          <SlotCounter
            icon={Moon}
            label="Riposo"
            used={usage.restUsed}
            allowed={slots.restAllowed}
            tone="muted"
          />
          {slots.refeedAllowed > 0 && (
            <SlotCounter
              icon={RefreshCw}
              label="Refeed"
              used={usage.refeedUsed}
              allowed={slots.refeedAllowed}
              tone="accent"
            />
          )}
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-1.5 h-28">
          {plan.days.map((d, i) => {
            const dayCal = isPolarized && polarizedTargets
              ? schedule[i]
                ? polarizedTargets.trainingDay.calories
                : polarizedTargets.restDay.calories
              : d.calories;
            const displayCal = d.isRefeed ? d.calories : dayCal;
            const pct = maxCal > 0 ? (displayCal / maxCal) * 100 : 0;
            const isTraining = isPolarized && schedule[i];
            const isToday = weekDates[i] === todayStr;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-foreground">
                  {displayCal}
                </span>
                <div
                  className={`w-full rounded-t transition-all ${
                    d.isRefeed ? "bg-accent" : isTraining ? "bg-primary" : "bg-muted-foreground/40"
                  } ${isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
                  style={{ height: `${pct}%`, minHeight: 4 }}
                />
                <span className={`text-[10px] ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>

        {plan.days.some((d) => d.isRefeed) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            <span>I giorni evidenziati sono giorni di refeed a mantenimento (extra carb)</span>
          </div>
        )}
      </CardContent>
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
    tone === "primary"
      ? "text-primary"
      : tone === "accent"
      ? "text-accent-foreground"
      : "text-muted-foreground";
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
        {used}/{allowed} <span className="text-[10px] font-normal text-muted-foreground">usati</span>
      </p>
    </div>
  );
}
