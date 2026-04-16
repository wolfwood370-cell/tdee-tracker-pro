import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Flame, Target, Utensils, TrendingUp, Dumbbell, Moon, BarChart3, RefreshCw, MessageSquare, Microscope, Leaf, Droplets, GlassWater, Hourglass, ShieldAlert, ShoppingCart, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { DailyLogWidget } from "@/components/DailyLogWidget";
import { WeightTrendChart } from "@/components/WeightTrendChart";
import { BiofeedbackCheckin } from "@/components/BiofeedbackCheckin";
import { DayTypeSelector, type DayType } from "@/components/DayTypeSelector";
import { LogHistoryTable } from "@/components/LogHistoryTable";
import { BodyCompositionChart } from "@/components/BodyCompositionChart";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { MacroRings } from "@/components/MacroRings";
import { StreakIndicator } from "@/components/StreakIndicator";
import { calculateStreak } from "@/lib/streaks";
import type { TargetMacros } from "@/stores";
import type { DietStrategy, WeeklyPlan } from "@/lib/algorithms";
import { calculateMicronutrients, isUnderweightRisk, isObesityRisk } from "@/lib/algorithms";
import { AIMealPlanModal } from "@/components/AIMealPlanModal";

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
    (profile?.training_schedule as boolean[] | null) ??
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
        {/* Day Type Selector inline preview removed; managed at Hero level */}

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
    usingBIAData,
    tefDelta,
    userAge,
    activeMenstrualPhase,
    goalETA,
    setLogs,
  } = useAppStore();

  const [needsCheckin, setNeedsCheckin] = useState(false);
  const [checkinDismissed, setCheckinDismissed] = useState(false);
  const [editTrigger, setEditTrigger] = useState<{ logDate: string; weight: number | null; calories: number | null; [key: string]: string | number | null | undefined } | null>(null);
  const logWidgetRef = useRef<HTMLDivElement>(null);
  const [mealPlanOpen, setMealPlanOpen] = useState(false);
  const [dayType, setDayType] = useState<DayType>("training");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleEditLog = useCallback((logDate: string, weight: number | null, calories: number | null, extra?: Record<string, unknown>) => {
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

  // Determine active targets based on selected day type
  const activeTargets = useMemo(() => {
    if (dayType === "refeed" && weeklyPlan) {
      const refeedDay = weeklyPlan.days.find((d) => d.isRefeed);
      if (refeedDay) {
        return {
          calories: refeedDay.calories,
          macros: refeedDay.macros,
          label: "🍝 Refeed",
        };
      }
    }
    if (isPolarized && polarizedTargets) {
      if (dayType === "rest") {
        return {
          calories: polarizedTargets.restDay.calories,
          macros: polarizedTargets.restDay.macros,
          label: "🛋️ Riposo",
        };
      }
      return {
        calories: polarizedTargets.trainingDay.calories,
        macros: polarizedTargets.trainingDay.macros,
        label: "🏋️ Allenamento",
      };
    }
    return {
      calories,
      macros,
      label: dayType === "rest" ? "🛋️ Riposo" : dayType === "refeed" ? "🍝 Refeed" : "🏋️ Allenamento",
    };
  }, [dayType, isPolarized, polarizedTargets, weeklyPlan, calories, macros]);

  const calPct = todayCalories > 0 ? Math.min(100, Math.round((todayCalories / activeTargets.calories) * 100)) : 0;

  // Streak calculation
  const streak = useMemo(
    () => calculateStreak(dailyLogs, { targetCalories: calories, targetProtein: macros.protein }),
    [dailyLogs, calories, macros.protein]
  );

  // Track if perfect toast was shown this render cycle
  const perfectShownRef = useRef(false);
  const handlePerfectMacros = useCallback(() => {
    if (!perfectShownRef.current) {
      perfectShownRef.current = true;
      toast.success("Pasto Perfetto! ✨", {
        description: "Tutti i macro sono nel range ottimale!",
      });
    }
  }, []);
  const todayDayIndex = (new Date().getDay() + 6) % 7; // Mon=0 .. Sun=6
  const trainingSchedule = (profile?.training_schedule as boolean[] | null) ?? [true, false, true, false, true, false, false];
  const isTodayTraining = trainingSchedule[todayDayIndex] ?? false;

  // Extract latest weight and TBW for hydration calc
  const latestLog = [...dailyLogs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime())[0];
  const latestWeight = latestLog?.weight ?? null;
  // TBW may be in an older InBody scan, not necessarily the latest log
  const latestTbw = useMemo(() => {
    const sorted = [...dailyLogs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
    return sorted.find((l) => l.tbw != null)?.tbw ?? null;
  }, [dailyLogs]);

  const microTargets = useMemo(() => {
    const activityLevel = profile?.activity_level ?? 1.55;
    return calculateMicronutrients(
      calories,
      typeof activityLevel === 'number' ? activityLevel : parseFloat(String(activityLevel)),
      latestWeight,
      latestTbw,
      isTodayTraining,
      profile?.sex ?? null,
    );
  }, [calories, profile?.activity_level, profile?.sex, latestWeight, latestTbw, isTodayTraining]);

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
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Panoramica giornaliera di nutrizione e progressi
          </p>
        </div>
        <StreakIndicator streak={streak} className="ml-auto" />
      </div>

      {/* Diet Break Banner */}
      {(() => {
        const breakUntil = profile?.diet_break_until;
        if (!breakUntil) return null;
        const breakDate = new Date(breakUntil);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (breakDate < today) return null;
        const formattedDate = breakDate.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
        return (
          <Alert className="border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-400/20">
            <Leaf className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="font-display text-emerald-700 dark:text-emerald-400">🌴 Diet Break Attivo (Fino al {formattedDate})</AlertTitle>
            <AlertDescription className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">
              Il tuo metabolismo aveva bisogno di respirare. Goditi i carboidrati extra per resettare gli ormoni, si torna in deficit a breve!
            </AlertDescription>
          </Alert>
        );
      })()}

      {/* Coach Note */}
      {profile?.coach_note && String(profile.coach_note).trim() !== "" && (
        <Alert className="border-primary/50 bg-primary/5">
          <MessageSquare className="h-4 w-4 text-primary" />
          <AlertTitle className="font-display text-foreground">Messaggio dal tuo Coach:</AlertTitle>
          <AlertDescription className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">
            {profile.coach_note}
          </AlertDescription>
        </Alert>
      )}

      {/* Hero - Obiettivi di Oggi */}
      <Card className="glass-card glow-primary border-border overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Obiettivi di Oggi</h2>
            {profile?.manual_override_active && (
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/30">
                Override Manuale
              </Badge>
            )}
            {usingBIAData && !profile?.manual_override_active && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs bg-accent/20 text-accent-foreground border-accent/30 cursor-help">
                      <Microscope className="h-3 w-3 mr-1" />
                      InBody
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">🎯 Ottimizzato con dati clinici InBody</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {tefDelta > 0 && (
              <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/30">
                🔥 TEF: +{tefDelta} kcal
              </Badge>
            )}
            {userAge != null && userAge >= 45 && (
              <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                🛡️ Over-45
              </Badge>
            )}
             {activeMenstrualPhase === 'luteal' && (
              <Badge variant="secondary" className="text-xs bg-pink-500/10 text-pink-600 border-pink-500/30">
                🌸 Fase Luteale: +150 kcal
              </Badge>
            )}
            {goalETA && (
              <Badge
                variant={goalETA.startsWith("Blocco Clinico") ? "destructive" : "secondary"}
                className={goalETA.startsWith("Blocco Clinico")
                  ? "text-xs bg-red-500/10 text-red-600 border-red-500/30"
                  : "text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                }
              >
                <Hourglass className="h-3 w-3 mr-1" />
                {goalETA.startsWith("Blocco Clinico") ? `⚠️ ${goalETA}` : `ETA: ${goalETA}`}
              </Badge>
            )}
            {profile?.target_weight && profile?.height_cm && isUnderweightRisk(Number(profile.target_weight), Number(profile.height_cm)) && (
              <Badge variant="destructive" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                <ShieldAlert className="h-3 w-3 mr-1" />
                🛑 Avviso Medico: Target Sottopeso
              </Badge>
            )}
            {profile?.target_weight && profile?.height_cm && !isUnderweightRisk(Number(profile.target_weight), Number(profile.height_cm)) && isObesityRisk(Number(profile.target_weight), Number(profile.height_cm)) && (
              <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/30">
                <ShieldAlert className="h-3 w-3 mr-1" />
                ⚠️ Avviso Medico: Target BMI ≥ 30
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

          {/* Day Type Selector (when polarized) */}
          {isPolarized && (
            <div className="py-2">
              <DayTypeSelector onChange={setDayType} />
            </div>
          )}

          {/* Macro Rings — adapt to selected day type */}
          <div className="flex flex-col items-center justify-center py-2 gap-2">
            <MacroRings
              protein={{ current: 0, target: activeTargets.macros.protein }}
              carbs={{ current: 0, target: activeTargets.macros.carbs }}
              fats={{ current: 0, target: activeTargets.macros.fats }}
              calories={{ current: todayCalories, target: activeTargets.calories }}
              onPerfect={handlePerfectMacros}
            />
            <Badge variant="secondary" className="text-xs">
              🎯 Target Attuale: {activeTargets.label}
            </Badge>
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

          {/* Micronutrient Targets */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-3 py-2">
              <GlassWater className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">💧 Acqua:</span>
              <span className="text-xs font-semibold text-foreground">{microTargets.waterL} L</span>
            </div>
            <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-3 py-2">
              <Droplets className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">🧂 Elettroliti:</span>
              <span className="text-xs font-semibold text-foreground">{microTargets.sodiumMg} mg Na / {microTargets.potassiumMg} mg K</span>
            </div>
            <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-3 py-2">
              <Leaf className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">🌾 Fibre:</span>
              <span className="text-xs font-semibold text-foreground">~{microTargets.fiberG}g</span>
             </div>
            {/* Food Quality Badge */}
            {(() => {
              const quality = todayLog?.average_food_quality;
              if (quality == null) return null;
              const isGood = quality >= 8;
              const isMid = quality >= 5;
              return (
                <div className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${
                  isGood ? 'bg-emerald-500/10' : isMid ? 'bg-amber-500/10' : 'bg-red-500/10'
                }`}>
                  <Leaf className={`h-3.5 w-3.5 ${isGood ? 'text-emerald-600' : isMid ? 'text-amber-600' : 'text-red-600'}`} />
                  <span className="text-xs text-muted-foreground">🍃 Qualità:</span>
                  <span className={`text-xs font-semibold ${isGood ? 'text-emerald-600' : isMid ? 'text-amber-600' : 'text-red-600'}`}>
                    {quality}/10 — {isGood ? 'Ottima' : isMid ? 'Discreta' : 'Bassa'}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* AI Meal Plan Button */}
          <div className="mt-4 pt-3 border-t border-border">
            <Button
              onClick={() => setMealPlanOpen(true)}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-md"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Idee Pasti e Spesa AI
            </Button>
          </div>
        </CardContent>
      </Card>

      <AIMealPlanModal
        open={mealPlanOpen}
        onOpenChange={setMealPlanOpen}
        targetCalories={calories}
        protein={macros.protein}
        carbs={macros.carbs}
        fats={macros.fats}
        dietType={profile?.diet_type ?? "balanced"}
      />

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
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
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
              <div key={item.label} className="bg-secondary/50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-display font-bold text-foreground">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Log History */}
      <LogHistoryTable onEditLog={handleEditLog} />
    </div>
  );
};

export default ClientDashboard;
