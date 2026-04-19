import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Flame, Target, Utensils, TrendingUp, MessageSquare, Microscope, Leaf, Droplets, GlassWater, Hourglass, ShieldAlert, ShoppingCart, Sparkles, ClipboardCheck } from "lucide-react";
import { WeeklyCheckinModal } from "@/components/WeeklyCheckinModal";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { DailyLogWidget } from "@/components/DailyLogWidget";
import { WeightTrendChart } from "@/components/WeightTrendChart";
import { BiofeedbackCheckin } from "@/components/BiofeedbackCheckin";
import { LogHistoryTable } from "@/components/LogHistoryTable";
import { BodyCompositionChart } from "@/components/BodyCompositionChart";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { MacroRings } from "@/components/MacroRings";
import { StreakIndicator } from "@/components/StreakIndicator";
import { calculateStreak } from "@/lib/streaks";
import {
  calculateMicronutrients,
  computeDayTargets,
  isUnderweightRisk,
  isObesityRisk,
  type ProteinPref,
  type DietType,
} from "@/lib/algorithms";
import { AIMealPlanModal } from "@/components/AIMealPlanModal";
import { PaywallModal } from "@/components/PaywallModal";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { TodayDiary } from "@/components/TodayDiary";
import { QuickWaterButton } from "@/components/QuickWaterButton";
import { parseWeeklySchedule, getDayKey, toLocalISODate, type DayType } from "@/lib/weeklyBudget";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

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
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Phase 69: Soft Paywall — block premium actions when subscription is expired.
  // Coaches are never paywalled (defensive: their subscription_status is irrelevant).
  const isCoach = user?.role === "coach";
  const isExpired = !isCoach && profile?.subscription_status === "expired";
  const guardPremium = (action: () => void) => () => {
    if (isExpired) {
      setPaywallOpen(true);
      return;
    }
    action();
  };

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

        // Phase 65: One-time welcome toast for first-time users
        try {
          const welcomeKey = `nc-welcome-shown-${user.id}`;
          const alreadyShown = localStorage.getItem(welcomeKey);
          if (!alreadyShown && (data?.length ?? 0) <= 1) {
            toast.success("Benvenuto a bordo.", {
              description: "Il tuo metabolismo è in fase di calcolo. Registra il peso e i pasti ogni giorno per permettere all'algoritmo di adattarsi a te.",
              duration: 6000,
            });
            localStorage.setItem(welcomeKey, "1");
          }
        } catch {
          // localStorage non disponibile (es. modalità privata) — ignora
        }
      });

    // Check biofeedback status (week start in LOCAL time, not UTC)
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    const weekStart = toLocalISODate(monday);

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

  const todayStr = toLocalISODate(new Date());
  const todayLog = dailyLogs.find((l) => l.log_date === todayStr);
  const todayCalories = todayLog?.calories ?? 0;
  // Phase 60: live macros consumed today (from manual logger / future entries)
  const todayLogAny = todayLog as Record<string, unknown> | undefined;
  const todayProtein = Number(todayLogAny?.protein) || 0;
  const todayCarbs = Number(todayLogAny?.carbs) || 0;
  const todayFats = Number(todayLogAny?.fats) || 0;

  const calories = targetCalories ?? 2450;
  const macros = targetMacros ?? { protein: 185, carbs: 280, fats: 78 };

  // Phase 53: Today's dayType is read from profile.weekly_schedule (Strategy)
  const weeklySchedule = useMemo(
    () => parseWeeklySchedule((profile as { weekly_schedule?: unknown } | null)?.weekly_schedule),
    [profile],
  );
  const todayDayType: DayType = weeklySchedule[getDayKey()];

  // Latest weight + LBM for on-the-fly target recomputation
  const latestLog = [...dailyLogs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime())[0];
  const latestWeight = latestLog?.weight ?? null;
  const latestTbw = useMemo(() => {
    const sorted = [...dailyLogs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
    return sorted.find((l) => l.tbw != null)?.tbw ?? null;
  }, [dailyLogs]);
  const latestLbm = useMemo(() => {
    const sorted = [...dailyLogs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
    const log = sorted.find((l) => l.bfm != null || l.pbf != null);
    if (!log) return null;
    if (log.bfm != null && log.weight != null) return Number(log.weight) - Number(log.bfm);
    if (log.pbf != null && log.weight != null) return Number(log.weight) * (1 - Number(log.pbf) / 100);
    return null;
  }, [dailyLogs]);

  // Active targets for TODAY based on weekly_schedule
  const activeTargets = useMemo(() => {
    const labels: Record<DayType, string> = {
      training: "Allenamento",
      rest: "Riposo",
      refeed: "Refeed",
    };
    // Use a sensible bodyweight fallback so target differentiation by dayType
    // works even before the user has logged a weight (rest = -10%, refeed = TDEE).
    const bw = latestWeight ?? 70;
    const tdeeForCalc = currentTDEE ?? Math.round(calories / 0.85); // approx maintenance from baseline
    const t = computeDayTargets({
      dayType: todayDayType,
      baselineDailyCal: calories,
      tdee: tdeeForCalc,
      bodyWeightKg: bw,
      proteinPref: (profile?.protein_pref as ProteinPref) ?? "moderate",
      dietType: (profile?.diet_type as DietType) ?? "balanced",
      lbmKg: latestLbm,
      age: userAge,
      polarized: polarizedTargets,
    });
    return { calories: t.calories, macros: t.macros, label: labels[todayDayType] };
  }, [todayDayType, currentTDEE, latestWeight, calories, profile?.protein_pref, profile?.diet_type, latestLbm, userAge, polarizedTargets]);

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

  const microTargets = useMemo(() => {
    const activityLevel = profile?.activity_level ?? 1.55;
    return calculateMicronutrients(
      activeTargets.calories,
      typeof activityLevel === 'number' ? activityLevel : parseFloat(String(activityLevel)),
      latestWeight,
      latestTbw,
      todayDayType === "training",
      profile?.sex ?? null,
    );
  }, [activeTargets.calories, profile?.activity_level, profile?.sex, latestWeight, latestTbw, todayDayType]);

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
          <Alert className="border-success/50 bg-success/10 ring-1 ring-success/20">
            <Leaf className="h-4 w-4 text-success" />
            <AlertTitle className="font-display text-success">Diet Break Attivo (Fino al {formattedDate})</AlertTitle>
            <AlertDescription className="text-sm text-success/80 mt-1">
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

      {/* Daily Biofeedback — always above tabs */}
      {needsCheckin && !checkinDismissed && (
        <BiofeedbackCheckin onComplete={() => { setNeedsCheckin(false); setCheckinDismissed(true); }} />
      )}

      <Tabs defaultValue="action" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger value="action" className="py-2.5 text-xs sm:text-sm font-display data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Oggi
          </TabsTrigger>
          <TabsTrigger value="strategy" className="py-2.5 text-xs sm:text-sm font-display data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Strategia
          </TabsTrigger>
          <TabsTrigger value="analytics" className="py-2.5 text-xs sm:text-sm font-display data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Analisi
          </TabsTrigger>
        </TabsList>

        {/* ============ ACTION TAB ============ */}
        <TabsContent value="action" className="space-y-6 animate-fade-in">
          {/* Hero - Obiettivi di Oggi */}
          <Card className="glass-card glow-primary border-border overflow-hidden">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                        <p className="text-xs">Ottimizzato con dati clinici InBody</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {tefDelta > 0 && (
                  <Badge variant="secondary" className="text-xs bg-warning/10 text-warning border-warning/30">
                    TEF: +{tefDelta} kcal
                  </Badge>
                )}
                {userAge != null && userAge >= 45 && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/30">
                    Over-45
                  </Badge>
                )}
                 {activeMenstrualPhase === 'luteal' && (
                  <Badge variant="secondary" className="text-xs bg-accent text-accent-foreground border-accent">
                    Fase Luteale: +150 kcal
                  </Badge>
                )}
                {goalETA && (
                  <Badge
                    variant={goalETA.startsWith("Blocco Clinico") ? "destructive" : "secondary"}
                    className={goalETA.startsWith("Blocco Clinico")
                      ? "text-xs"
                      : "text-xs bg-success/10 text-success border-success/30"
                    }
                  >
                    <Hourglass className="h-3 w-3 mr-1" />
                    {goalETA.startsWith("Blocco Clinico") ? goalETA : `ETA: ${goalETA}`}
                  </Badge>
                )}
                {profile?.target_weight && profile?.height_cm && isUnderweightRisk(Number(profile.target_weight), Number(profile.height_cm)) && (
                  <Badge variant="destructive" className="text-xs">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Avviso Medico: Target Sottopeso
                  </Badge>
                )}
                {profile?.target_weight && profile?.height_cm && !isUnderweightRisk(Number(profile.target_weight), Number(profile.height_cm)) && isObesityRisk(Number(profile.target_weight), Number(profile.height_cm)) && (
                  <Badge variant="secondary" className="text-xs bg-warning/10 text-warning border-warning/30">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Avviso Medico: Target BMI ≥ 30
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

              {/* Macro Rings */}
              <div className="flex flex-col items-center justify-center py-2 gap-2">
                <MacroRings
                  protein={{ current: todayProtein, target: activeTargets.macros.protein }}
                  carbs={{ current: todayCarbs, target: activeTargets.macros.carbs }}
                  fats={{ current: todayFats, target: activeTargets.macros.fats }}
                  calories={{ current: todayCalories, target: activeTargets.calories }}
                  onPerfect={handlePerfectMacros}
                />
                <Badge variant="secondary" className="text-xs">
                  Target di Oggi: {activeTargets.label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {[
                  { label: "Calorie", value: todayCalories > 0 ? todayCalories.toLocaleString("it-IT") : "—", target: activeTargets.calories.toLocaleString("it-IT"), icon: Flame, color: "text-destructive", pct: calPct },
                  { label: "Proteine", value: todayProtein > 0 ? `${Math.round(todayProtein)}g` : "—", target: `${activeTargets.macros.protein}g`, icon: Target, color: "text-primary", pct: activeTargets.macros.protein > 0 ? Math.min(100, Math.round((todayProtein / activeTargets.macros.protein) * 100)) : 0 },
                  { label: "Carboidrati", value: todayCarbs > 0 ? `${Math.round(todayCarbs)}g` : "—", target: `${activeTargets.macros.carbs}g`, icon: Utensils, color: "text-accent-foreground", pct: activeTargets.macros.carbs > 0 ? Math.min(100, Math.round((todayCarbs / activeTargets.macros.carbs) * 100)) : 0 },
                  { label: "Grassi", value: todayFats > 0 ? `${Math.round(todayFats)}g` : "—", target: `${activeTargets.macros.fats}g`, icon: TrendingUp, color: "text-muted-foreground", pct: activeTargets.macros.fats > 0 ? Math.min(100, Math.round((todayFats / activeTargets.macros.fats) * 100)) : 0 },
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

              {/* Micronutrient Targets */}
              <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-3 py-2">
                  <GlassWater className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">Acqua:</span>
                  <span className="text-xs font-semibold text-foreground">{microTargets.waterL} L</span>
                </div>
                <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-3 py-2">
                  <Droplets className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">Elettroliti:</span>
                  <span className="text-xs font-semibold text-foreground">{microTargets.sodiumMg} mg Na / {microTargets.potassiumMg} mg K</span>
                </div>
                <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-3 py-2">
                  <Leaf className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">Fibre:</span>
                  <span className="text-xs font-semibold text-foreground">~{microTargets.fiberG}g</span>
                 </div>
                {(() => {
                  const quality = todayLog?.average_food_quality;
                  if (quality == null) return null;
                  const isGood = quality >= 8;
                  const isMid = quality >= 5;
                  const bgCls = isGood ? "bg-success/10" : isMid ? "bg-warning/10" : "bg-destructive/10";
                  const fgCls = isGood ? "text-success" : isMid ? "text-warning" : "text-destructive";
                  return (
                    <div className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${bgCls}`}>
                      <Leaf className={`h-3.5 w-3.5 ${fgCls}`} />
                      <span className="text-xs text-muted-foreground">Qualità:</span>
                      <span className={`text-xs font-semibold ${fgCls}`}>
                        {quality}/10 — {isGood ? 'Ottima' : isMid ? 'Discreta' : 'Bassa'}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-4 pt-3 border-t border-border grid sm:grid-cols-2 gap-2">
                <Button
                  onClick={guardPremium(() => setMealPlanOpen(true))}
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-md"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Idee Pasti e Spesa AI
                </Button>
                <Button
                  onClick={guardPremium(() => setCheckinOpen(true))}
                  variant="outline"
                  className="w-full border-primary/40 hover:bg-primary/10 hover:text-primary"
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  📝 Check-in con il Coach
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Hydration */}
          <Card className="glass-card border-border">
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <GlassWater className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm font-display font-semibold text-foreground">Idratazione Rapida</p>
                  <p className="text-xs text-muted-foreground">
                    Target: {microTargets.waterL} L · Tocca per registrare un sorso
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <QuickWaterButton logDate={todayStr} incrementL={0.25} />
                <QuickWaterButton logDate={todayStr} incrementL={0.5} />
              </div>
            </CardContent>
          </Card>

          {/* Today's Diary (deletable meal entries) */}
          <TodayDiary logDate={todayStr} />

          {/* Daily Log */}
          <div ref={logWidgetRef}>
            <DailyLogWidget editTrigger={editTrigger} onEditConsumed={() => setEditTrigger(null)} />
          </div>
        </TabsContent>

        {/* ============ STRATEGY TAB ============ */}
        <TabsContent value="strategy" className="space-y-6 animate-fade-in">
          <div className="space-y-1">
            <h2 className="text-lg font-display font-semibold text-foreground">Piano Settimanale</h2>
            <p className="text-sm text-muted-foreground">
              Pianifica la tua settimana per ottimizzare il budget calorico.
            </p>
          </div>
          {weeklyPlan && (
            <WeeklyPlan plan={weeklyPlan} todayTarget={activeTargets.calories} />
          )}

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
        </TabsContent>

        {/* ============ ANALYTICS TAB ============ */}
        <TabsContent value="analytics" className="space-y-6 animate-fade-in">
          <WeightTrendChart />
          <BodyCompositionChart />

          <Card className="glass-card border-border">
            <CardContent className="p-2 md:p-4">
              <Accordion type="single" collapsible>
                <AccordionItem value="history" className="border-0">
                  <AccordionTrigger className="px-2 hover:no-underline">
                    <span className="text-lg font-display flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Storico Completo
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <LogHistoryTable onEditLog={handleEditLog} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AIMealPlanModal
        open={mealPlanOpen}
        onOpenChange={setMealPlanOpen}
        targetCalories={activeTargets.calories}
        protein={activeTargets.macros.protein}
        carbs={activeTargets.macros.carbs}
        fats={activeTargets.macros.fats}
        dietType={profile?.diet_type ?? "balanced"}
        dietaryPreference={profile?.dietary_preference ?? "onnivoro"}
        allergies={profile?.allergies ?? ""}
      />
      {user && (
        <WeeklyCheckinModal
          open={checkinOpen}
          onOpenChange={setCheckinOpen}
          userId={user.id}
        />
      )}
      <PaywallModal open={paywallOpen} onOpenChange={setPaywallOpen} />
    </div>
  );
};

export default ClientDashboard;
