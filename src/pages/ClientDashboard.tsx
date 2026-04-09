import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Flame, Target, Utensils, TrendingUp, Dumbbell, Moon, BarChart3, RefreshCw, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { DailyLogWidget } from "@/components/DailyLogWidget";
import { WeightTrendChart } from "@/components/WeightTrendChart";
import { BiofeedbackCheckin } from "@/components/BiofeedbackCheckin";
import { TrainingScheduleToggle } from "@/components/TrainingScheduleToggle";
import { LogHistoryTable } from "@/components/LogHistoryTable";
import { BodyCompositionChart } from "@/components/BodyCompositionChart";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { TargetMacros } from "@/stores";
import type { DietStrategy, WeeklyPlan } from "@/lib/algorithms";

interface MacroCardProps {
  title: string;
  icon: React.ElementType;
  calories: number;
  macros: TargetMacros;
  todayCalories: number;
}

function MacroCard({ title, icon: Icon, calories, macros, todayCalories }: MacroCardProps) {
  const calPct = todayCalories > 0 ? Math.min(100, Math.round((todayCalories / calories) * 100)) : 0;

  const metrics = [
    { label: "Calorie", value: todayCalories > 0 ? todayCalories.toLocaleString("it-IT") : "—", target: calories.toLocaleString("it-IT"), icon: Flame, color: "text-destructive", pct: calPct },
    { label: "Proteine", value: "—", target: `${macros.protein}g`, icon: Target, color: "text-primary", pct: 0 },
    { label: "Carboidrati", value: "—", target: `${macros.carbs}g`, icon: Utensils, color: "text-accent-foreground", pct: 0 },
    { label: "Grassi", value: "—", target: `${macros.fats}g`, icon: TrendingUp, color: "text-muted-foreground", pct: 0 },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-display font-semibold text-foreground">{title}</h3>
        <span className="ml-auto text-xs font-semibold text-primary">{calories.toLocaleString("it-IT")} kcal</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="bg-secondary/50 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
            <p className="text-lg font-display font-bold text-foreground">{m.value}</p>
            <p className="text-xs text-muted-foreground">di {m.target}</p>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${m.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STRATEGY_LABELS: Record<DietStrategy, string> = {
  linear: "Lineare",
  refeed_1_day: "Refeed 1g",
  refeed_2_days: "Refeed 2g",
  matador_break: "MATADOR",
  reverse_diet: "Reverse Diet",
};

function WeeklyPlanBar({ plan }: { plan: WeeklyPlan }) {
  const { polarizedTargets, profile } = useAppStore();
  const isPolarized = polarizedTargets != null;
  const maxCal = Math.max(...plan.days.map((d) => d.calories));

  const schedule: boolean[] =
    ((profile as any)?.training_schedule as boolean[] | null) ??
    [true, false, true, false, true, false, false];

  // Determine per-day calorie target based on training schedule
  const getDayCalories = (dayIndex: number) => {
    if (!isPolarized) return null;
    return schedule[dayIndex]
      ? polarizedTargets.trainingDay.calories
      : polarizedTargets.restDay.calories;
  };

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
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
        <p className="text-xs text-muted-foreground">
          Totale settimanale: {plan.weeklyTotal.toLocaleString("it-IT")} kcal
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Training Schedule Toggle (polarized only) */}
        {isPolarized && <TrainingScheduleToggle />}

        {/* Bar chart */}
        <div className="flex items-end gap-1.5 h-28">
          {plan.days.map((d, i) => {
            const dayCal = getDayCalories(i);
            const displayCal = dayCal ?? d.calories;
            const pct = maxCal > 0 ? (displayCal / maxCal) * 100 : 0;
            const isTraining = isPolarized && schedule[i];
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-foreground">
                  {displayCal}
                </span>
                <div
                  className={`w-full rounded-t transition-all ${
                    d.isRefeed ? "bg-accent" : isTraining ? "bg-primary" : "bg-muted-foreground/40"
                  }`}
                  style={{ height: `${pct}%`, minHeight: 4 }}
                />
                <span className="text-[10px] text-muted-foreground">{d.label}</span>
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

const ClientDashboard = () => {
  const {
    user,
    profile,
    currentTDEE,
    targetCalories,
    targetMacros,
    polarizedTargets,
    dynamicGoalRate,
    smoothedLogs,
    dailyLogs,
    weeklyPlan,
    setLogs,
  } = useAppStore();

  const [needsCheckin, setNeedsCheckin] = useState(false);
  const [checkinDismissed, setCheckinDismissed] = useState(false);
  const [editTrigger, setEditTrigger] = useState<Record<string, any> | null>(null);
  const logWidgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("daily_metrics")
      .select("*")
      .eq("user_id", user.id)
      .order("log_date", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching daily logs:", error);
          return;
        }
        if (data && data.length > 0) {
          setLogs(data);
        }
      });

    // Check biofeedback status
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    const weekStart = monday.toISOString().slice(0, 10);

    supabase
      .from("biofeedback_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start_date", weekStart)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNeedsCheckin(true);
      });
  }, [user?.id]);

  const handleEditLog = useCallback((logDate: string, weight: number | null, calories: number | null, extra?: Record<string, any>) => {
    setEditTrigger({ logDate, weight, calories, ...extra });
    setTimeout(() => {
      logWidgetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLog = dailyLogs.find((l) => l.log_date === todayStr);
  const todayCalories = todayLog?.calories ?? 0;

  const calories = targetCalories ?? 2450;
  const macros = targetMacros ?? { protein: 185, carbs: 280, fats: 78 };
  const isPolarized = polarizedTargets != null;

  const calPct = todayCalories > 0 ? Math.min(100, Math.round((todayCalories / calories) * 100)) : 0;

  const last7Logs = dailyLogs.filter((l) => {
    const d = new Date(l.log_date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  });
  const validCalLogs = last7Logs.filter((l) => l.calories && l.calories > 0);
  const avgWeeklyCal =
    validCalLogs.length > 0
      ? Math.round(validCalLogs.reduce((s, l) => s + (l.calories ?? 0), 0) / validCalLogs.length)
      : null;
  const adherencePct =
    last7Logs.length > 0
      ? Math.round(
          (last7Logs.filter((l) => l.weight != null || (l.calories != null && l.calories > 0)).length / 7) * 100
        )
      : null;

  const latestTrend =
    smoothedLogs.length > 0
      ? [...smoothedLogs].reverse().find((l) => l.trendWeight != null)?.trendWeight
      : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Panoramica giornaliera di nutrizione e progressi
        </p>
      </div>

      {/* Coach Note */}
      {(profile as any)?.coach_note && String((profile as any).coach_note).trim() !== "" && (
        <Alert className="border-primary/50 bg-primary/5">
          <MessageSquare className="h-4 w-4 text-primary" />
          <AlertTitle className="font-display text-foreground">Messaggio dal tuo Coach:</AlertTitle>
          <AlertDescription className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">
            {(profile as any).coach_note}
          </AlertDescription>
        </Alert>
      )}

      {/* Hero - Obiettivi di Oggi */}
      <Card className="glass-card glow-primary border-border overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Obiettivi di Oggi</h2>
            {(profile as any)?.manual_override_active && (
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/30">
                Override Manuale
              </Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date().toLocaleDateString("it-IT", { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
            {currentTDEE && (
              <p className="text-xs text-muted-foreground">
                TDEE adattivo: <span className="text-primary font-semibold">{currentTDEE.toLocaleString("it-IT")} kcal</span>
              </p>
            )}
            {dynamicGoalRate != null && (
              <p className="text-xs text-muted-foreground">
                Variazione target: <span className="text-primary font-semibold">{dynamicGoalRate > 0 ? "+" : ""}{dynamicGoalRate.toFixed(2)} kg/sett</span>
              </p>
            )}
          </div>

          {isPolarized ? (
            <div className="grid md:grid-cols-2 gap-4">
              <MacroCard
                title="Giorno Allenamento"
                icon={Dumbbell}
                calories={polarizedTargets.trainingDay.calories}
                macros={polarizedTargets.trainingDay.macros}
                todayCalories={todayCalories}
              />
              <MacroCard
                title="Giorno Riposo"
                icon={Moon}
                calories={polarizedTargets.restDay.calories}
                macros={polarizedTargets.restDay.macros}
                todayCalories={todayCalories}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[
                { label: "Calorie", value: todayCalories > 0 ? todayCalories.toLocaleString("it-IT") : "—", target: calories.toLocaleString("it-IT"), icon: Flame, color: "text-destructive", pct: calPct },
                { label: "Proteine", value: "—", target: `${macros.protein}g`, icon: Target, color: "text-primary", pct: 0 },
                { label: "Carboidrati", value: "—", target: `${macros.carbs}g`, icon: Utensils, color: "text-accent-foreground", pct: 0 },
                { label: "Grassi", value: "—", target: `${macros.fats}g`, icon: TrendingUp, color: "text-muted-foreground", pct: 0 },
              ].map((metric) => (
                <div key={metric.label} className="bg-secondary/50 rounded-lg p-3 md:p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <metric.icon className={`h-4 w-4 ${metric.color}`} />
                    <span className="text-xs text-muted-foreground">{metric.label}</span>
                  </div>
                  <div>
                    <p className="text-xl md:text-2xl font-display font-bold text-foreground">{metric.value}</p>
                    <p className="text-xs text-muted-foreground">di {metric.target}</p>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${metric.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Biofeedback Check-in */}
      {needsCheckin && !checkinDismissed && (
        <BiofeedbackCheckin onComplete={() => { setNeedsCheckin(false); setCheckinDismissed(true); }} />
      )}

      {/* Non-Linear Weekly Plan / Polarized Schedule */}
      {(weeklyPlan && (weeklyPlan.strategy !== 'linear' || isPolarized)) && (
        <WeeklyPlanBar plan={weeklyPlan} />
      )}

      {/* Charts */}
      <WeightTrendChart />
      <BodyCompositionChart />

      <div className="grid md:grid-cols-2 gap-6">
        <div ref={logWidgetRef}>
          <DailyLogWidget editTrigger={editTrigger} onEditConsumed={() => setEditTrigger(null)} />
        </div>

        <Card className="glass-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Obiettivi Settimanali
            </CardTitle>
            <p className="text-xs text-muted-foreground">Obiettivi algoritmici per questa settimana</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                label: "Peso Trend Attuale",
                value: latestTrend != null ? `${latestTrend.toFixed(1)} kg` : "— kg",
                sub: "Media mobile esponenziale",
              },
              {
                label: "Calorie Giornaliere Target",
                value: `${calories.toLocaleString("it-IT")} kcal`,
                sub: currentTDEE ? "Calcolate dal TDEE adattivo" : "Valore predefinito",
              },
              {
                label: "Media Calorie Settimanale",
                value: avgWeeklyCal != null ? `${avgWeeklyCal.toLocaleString("it-IT")} kcal` : "— kcal",
                sub: validCalLogs.length > 0 ? `Su ${validCalLogs.length} giorni registrati` : "Registra per calcolare",
              },
              {
                label: "Aderenza",
                value: adherencePct != null ? `${adherencePct} %` : "— %",
                sub: `${last7Logs.filter((l) => l.weight != null || (l.calories != null && l.calories > 0)).length}/7 giorni registrati`,
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
                <p className="text-sm font-display font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Log History */}
      <LogHistoryTable onEditLog={handleEditLog} />
    </div>
  );
};

export default ClientDashboard;
