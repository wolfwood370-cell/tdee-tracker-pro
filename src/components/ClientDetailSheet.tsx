import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Download, Flame, Target, TrendingUp, Utensils, Zap, Loader2, AlertTriangle, Moon, Dumbbell, ClipboardCheck, Bot, ShieldCheck, MessageSquareText, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { exportClientCSV } from "@/lib/csvExport";
import { toast } from "@/hooks/use-toast";
import {
  calculateSmoothedWeight,
  calculateAdaptiveTDEE,
  calculateTargetCalories,
  calculateTargetMacros,
  calculateDynamicGoalRate,
  calculateWeeklyPlan,
  extractLatestBIA,
  calculateLBM,
  checkCatabolismRisk,
  calculateGoalETA,
  type DietStrategy,
  type GoalType,
  type ProteinPref,
  type DietType,
} from "@/lib/algorithms";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { Tables } from "@/integrations/supabase/types";
import type { SmoothedLog } from "@/lib/algorithms";

const STRATEGY_OPTIONS: { value: DietStrategy; label: string }[] = [
  { value: "linear", label: "Lineare" },
  { value: "refeed_1_day", label: "Refeed 1 giorno" },
  { value: "refeed_2_days", label: "Refeed 2 giorni" },
  { value: "matador_break", label: "MATADOR (2+2 sett)" },
  { value: "reverse_diet", label: "Reverse Diet" },
];

interface ClientDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: {
    id: string;
    displayName: string;
    profile: Tables<"profiles">;
  } | null;
}

export function ClientDetailSheet({ open, onOpenChange, client }: ClientDetailSheetProps) {
  const [logs, setLogs] = useState<Tables<"daily_metrics">[]>([]);
  const [smoothed, setSmoothed] = useState<SmoothedLog[]>([]);
  const [tdee, setTdee] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<DietStrategy>("linear");
  const [savingStrategy, setSavingStrategy] = useState(false);
  const [biofeedbackLogs, setBiofeedbackLogs] = useState<Tables<"biofeedback_logs">[]>([]);
  
  // Manual Override state
  const [overrideActive, setOverrideActive] = useState(false);
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualFats, setManualFats] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  // Strategy Editor state
  const [editGoalType, setEditGoalType] = useState<string>("sustainable_loss");
  const [editDietStrategy, setEditDietStrategy] = useState<string>("linear");
  const [editDietType, setEditDietType] = useState<string>("balanced");
  const [editProteinPref, setEditProteinPref] = useState<string>("moderate");
  const [editCalorieDist, setEditCalorieDist] = useState<string>("stable");
  const [editTrainingDays, setEditTrainingDays] = useState<string>("4");
  const [editActivityLevel, setEditActivityLevel] = useState<string>("1.2");
  const [editTargetWeight, setEditTargetWeight] = useState<string>("");
  const [savingConfig, setSavingConfig] = useState(false);

  // Coach Note state
  const [coachNote, setCoachNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!client || !open) return;
    setLoading(true);
    setSelectedStrategy((client.profile.diet_strategy as DietStrategy) ?? "linear");
    setOverrideActive(client.profile.manual_override_active ?? false);
    setManualCalories(client.profile.manual_calories?.toString() ?? "");
    setManualProtein(client.profile.manual_protein?.toString() ?? "");
    setManualFats(client.profile.manual_fats?.toString() ?? "");
    setManualCarbs(client.profile.manual_carbs?.toString() ?? "");

    // Strategy editor pre-population
    setEditGoalType(client.profile.goal_type ?? "sustainable_loss");
    setEditDietStrategy(client.profile.diet_strategy ?? "linear");
    setEditDietType(client.profile.diet_type ?? "balanced");
    setEditProteinPref(client.profile.protein_pref ?? "moderate");
    setEditCalorieDist(client.profile.calorie_distribution ?? "stable");
    setEditTrainingDays(String(client.profile.training_days_per_week ?? 4));
    setEditActivityLevel(String(client.profile.activity_level ?? 1.2));
    setEditTargetWeight(((client.profile as Record<string, unknown>).target_weight as number | null)?.toString() ?? "");
    setCoachNote(client.profile.coach_note ?? "");

    // Fetch daily metrics and biofeedback in parallel
    Promise.all([
      supabase
        .from("daily_metrics")
        .select("*")
        .eq("user_id", client.id)
        .order("log_date", { ascending: true }),
      supabase
        .from("biofeedback_logs")
        .select("*")
        .eq("user_id", client.id)
        .order("week_start_date", { ascending: false })
        .limit(8),
    ]).then(([metricsRes, bioRes]) => {
      if (metricsRes.error) {
        console.error("Error fetching client logs:", metricsRes.error);
        setLogs([]);
      } else {
        setLogs(metricsRes.data ?? []);
      }
      setBiofeedbackLogs(bioRes.data ?? []);
      setLoading(false);
    });
  }, [client?.id, open]);

  useEffect(() => {
    if (logs.length === 0) {
      setSmoothed([]);
      setTdee(null);
      return;
    }
    const s = calculateSmoothedWeight(logs);
    setSmoothed(s);
    setTdee(calculateAdaptiveTDEE(s, 14, client?.profile?.created_at));
  }, [logs, client?.profile?.created_at]);

  if (!client) return null;

  const goalType = (client.profile.goal_type as GoalType) ?? "sustainable_loss";
  const proteinPref = (client.profile.protein_pref as ProteinPref) ?? "moderate";
  const dietType = (client.profile.diet_type as DietType) ?? "balanced";

  const latestTrend = [...smoothed]
    .reverse()
    .find((l) => l.trendWeight != null)?.trendWeight;

  // BIA-driven calculations
  const bia = extractLatestBIA(logs);
  const lbm = bia ? calculateLBM(bia, latestTrend ?? undefined) : null;
  const fatMass = bia?.bfm ?? (bia?.pbf != null && latestTrend ? latestTrend * bia.pbf / 100 : null);

  const dynamicRate = latestTrend != null
    ? calculateDynamicGoalRate(goalType, latestTrend, fatMass, lbm)
    : (client.profile.goal_rate ?? -0.25);

  // Menstrual phase from latest log
  const latestLogSorted = [...logs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
  const clientTrackCycle = (client.profile as Record<string, unknown>)?.track_menstrual_cycle === true;
  const clientMenstrualPhase = clientTrackCycle
    ? ((latestLogSorted[0] as Record<string, unknown>)?.menstrual_phase as string | null) ?? null
    : null;

  // Age calculation
  let clientAge: number | null = null;
  if (client.profile.birth_date) {
    const bd = new Date(client.profile.birth_date);
    const now = new Date();
    clientAge = now.getFullYear() - bd.getFullYear();
    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) {
      clientAge--;
    }
  }

  const targetCal = tdee ? calculateTargetCalories(tdee, dynamicRate, clientMenstrualPhase as import('@/lib/algorithms').MenstrualPhase | null) : null;
  const targetMac =
    targetCal && latestTrend
      ? calculateTargetMacros(targetCal, latestTrend, proteinPref, dietType, lbm, clientAge).macros
      : null;

  // Catabolism risk
  const catabolismRisk = tdee && targetCal
    ? checkCatabolismRisk(tdee, targetCal, fatMass)
    : null;

  // Build preview weekly plan for the selected strategy
  const previewPlan =
    tdee && latestTrend
      ? calculateWeeklyPlan({
          strategy: selectedStrategy,
          tdee,
          goalRateKgPerWeek: dynamicRate,
          bodyWeightKg: latestTrend,
          proteinPref,
          dietType,
          profileCreatedAt: client.profile.created_at,
          lbmKg: lbm,
        })
      : null;

  const chartData = smoothed
    .filter((l) => l.weight != null || l.trendWeight != null)
    .map((l) => ({
      date: l.log_date,
      scaleWeight: l.weight ?? undefined,
      trendWeight:
        l.trendWeight != null
          ? Math.round(l.trendWeight * 100) / 100
          : undefined,
    }));

  const last7 = logs.filter((l) => {
    const d = new Date(l.log_date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  });
  const validCalLogs = last7.filter((l) => l.calories && l.calories > 0);
  const avgCal =
    validCalLogs.length > 0
      ? Math.round(
          validCalLogs.reduce((s, l) => s + (l.calories ?? 0), 0) /
            validCalLogs.length
        )
      : null;

  const handleAssignStrategy = async () => {
    if (!client) return;
    setSavingStrategy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ diet_strategy: selectedStrategy })
        .eq("id", client.id);
      if (error) throw error;
      toast({ title: "Strategia assegnata ✓", description: `${STRATEGY_OPTIONS.find(o => o.value === selectedStrategy)?.label} assegnata a ${client.displayName}` });
    } catch (e) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore sconosciuto", variant: "destructive" });
    } finally {
      setSavingStrategy(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!client) return;
    setSavingOverride(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          manual_override_active: overrideActive,
          manual_calories: overrideActive && manualCalories ? parseInt(manualCalories) : null,
          manual_protein: overrideActive && manualProtein ? parseInt(manualProtein) : null,
          manual_fats: overrideActive && manualFats ? parseInt(manualFats) : null,
          manual_carbs: overrideActive && manualCarbs ? parseInt(manualCarbs) : null,
        })
        .eq("id", client.id);
      if (error) throw error;
      toast({ title: "Override salvato ✓", description: overrideActive ? "Target manuali attivi per il cliente." : "Override disattivato, target algoritmici ripristinati." });
    } catch (e) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore sconosciuto", variant: "destructive" });
    } finally {
      setSavingOverride(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!client) return;
    setSavingConfig(true);
    try {
      const { error } = await supabase
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({
          goal_type: editGoalType,
          diet_strategy: editDietStrategy,
          diet_type: editDietType,
          protein_pref: editProteinPref,
          calorie_distribution: editCalorieDist,
          training_days_per_week: parseInt(editTrainingDays),
          activity_level: parseFloat(editActivityLevel),
          target_weight: editTargetWeight ? parseFloat(editTargetWeight) : null,
        } as any)
        .eq("id", client.id);
      if (error) throw error;
      // Update local client profile for immediate reactivity
      Object.assign(client.profile, {
        goal_type: editGoalType,
        diet_strategy: editDietStrategy,
        diet_type: editDietType,
        protein_pref: editProteinPref,
        calorie_distribution: editCalorieDist,
        training_days_per_week: parseInt(editTrainingDays),
        activity_level: parseFloat(editActivityLevel),
        target_weight: editTargetWeight ? parseFloat(editTargetWeight) : null,
      });
      setSelectedStrategy(editDietStrategy as DietStrategy);
      toast({ title: "Strategia aggiornata ✓", description: "Strategia del cliente aggiornata con successo!" });
    } catch (e) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore sconosciuto", variant: "destructive" });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveNote = async () => {
    if (!client) return;
    setSavingNote(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ coach_note: coachNote || null })
        .eq("id", client.id);
      if (error) throw error;
      Object.assign(client.profile, { coach_note: coachNote || null });
      toast({ title: "Nota salvata con successo ✓" });
    } catch (e) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore sconosciuto", variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="font-display">
                Dashboard di {client.displayName}
              </SheetTitle>
              <p className="text-xs text-muted-foreground">
                Vista in sola lettura
              </p>
            </div>
            {smoothed.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportClientCSV(smoothed, client.displayName)}
              >
                <Download className="mr-2 h-4 w-4" />
                Esporta CSV
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {loading ? (
            <div className="space-y-6">
              <Card className="glass-card border-border">
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-32 mb-4" />
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="bg-secondary/50 rounded-lg p-3 space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card border-border">
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-28 mb-3" />
                  <Skeleton className="h-56 w-full rounded-lg" />
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {/* Catabolism Risk Alert */}
              {catabolismRisk?.isAtRisk && (
                <Alert variant="destructive" className="border-destructive bg-destructive/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="font-display font-semibold">⚠️ Rischio Catabolico Elevato</AlertTitle>
                  <AlertDescription className="text-sm mt-1">
                    Il deficit calorico impostato ({catabolismRisk.currentDeficit} kcal/giorno) supera la capacità massima di ossidazione lipidica del cliente (Regola di Alpert: max {catabolismRisk.maxSafeDeficit} kcal/giorno per {fatMass?.toFixed(1)} kg di massa grassa). Il corpo smonterà tessuto muscolare per compensare la mancanza di energia. Si consiglia di ridurre il deficit o assegnare un Diet Break.
                  </AlertDescription>
                </Alert>
              )}

              {/* Targets Hero */}
              <Card className="glass-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Activity className="h-4 w-4 text-primary" />
                    <h3 className="font-display font-semibold text-foreground text-sm">
                      Target Calcolati
                    </h3>
                    {(() => {
                      const clientTargetWeight = (client.profile as Record<string, unknown>)?.target_weight as number | null;
                      const eta = latestTrend != null
                        ? calculateGoalETA(latestTrend, clientTargetWeight, dynamicRate, goalType)
                        : null;
                      return eta ? (
                        <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          <Hourglass className="h-3 w-3 mr-1" />
                          ETA: {eta}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        label: "TDEE",
                        value: tdee
                          ? `${tdee.toLocaleString("it-IT")} kcal`
                          : "—",
                        icon: Flame,
                        color: "text-destructive",
                      },
                      {
                        label: "Target Cal",
                        value: targetCal
                          ? `${targetCal.toLocaleString("it-IT")} kcal`
                          : "—",
                        icon: Target,
                        color: "text-primary",
                      },
                      {
                        label: "Proteine",
                        value: targetMac ? `${targetMac.protein}g` : "—",
                        icon: Utensils,
                        color: "text-accent-foreground",
                      },
                      {
                        label: "Peso Trend",
                        value: latestTrend
                          ? `${latestTrend.toFixed(1)} kg`
                          : "—",
                        icon: TrendingUp,
                        color: "text-primary",
                      },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className="bg-secondary/50 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
                          <span className="text-xs text-muted-foreground">
                            {m.label}
                          </span>
                        </div>
                        <p className="text-lg font-display font-bold text-foreground">
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Strategic Protocols - Coach Assignment */}
              <Card className="glass-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Protocolli Strategici
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Assegna una strategia dietetica non-lineare al cliente
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Strategia</Label>
                      <Select value={selectedStrategy} onValueChange={(v) => setSelectedStrategy(v as DietStrategy)}>
                        <SelectTrigger className="border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STRATEGY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleAssignStrategy}
                      disabled={savingStrategy}
                    >
                      {savingStrategy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Assegna"
                      )}
                    </Button>
                  </div>

                  {/* 7-day preview bar chart */}
                  {previewPlan && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Anteprima distribuzione settimanale
                        {previewPlan.isMaintenancePhase && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">Fase Mantenimento</Badge>
                        )}
                        {previewPlan.reverseWeekNumber && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">Sett. {previewPlan.reverseWeekNumber}</Badge>
                        )}
                      </p>
                      <div className="h-32 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={previewPlan.days}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis
                              dataKey="label"
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "0.5rem",
                                fontSize: 11,
                                color: "hsl(var(--card-foreground))",
                              }}
                              formatter={(value: number) => [`${value} kcal`, "Calorie"]}
                            />
                            <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                              {previewPlan.days.map((d, i) => (
                                <Cell
                                  key={i}
                                  fill={d.isRefeed ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Totale: {previewPlan.weeklyTotal.toLocaleString("it-IT")} kcal/sett
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Coach Manual Override */}
              <Card className="glass-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Override Manuale Coach
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Bypassa l'algoritmo e imposta target personalizzati
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-foreground">Override attivo</Label>
                    <Switch checked={overrideActive} onCheckedChange={setOverrideActive} />
                  </div>
                  {overrideActive && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Calorie (kcal)</Label>
                        <Input type="number" min="0" placeholder="es. 2200" value={manualCalories} onChange={(e) => setManualCalories(e.target.value)} className="border-border" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Proteine (g)</Label>
                        <Input type="number" min="0" placeholder="es. 180" value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} className="border-border" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Grassi (g)</Label>
                        <Input type="number" min="0" placeholder="es. 70" value={manualFats} onChange={(e) => setManualFats(e.target.value)} className="border-border" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Carboidrati (g)</Label>
                        <Input type="number" min="0" placeholder="es. 250" value={manualCarbs} onChange={(e) => setManualCarbs(e.target.value)} className="border-border" />
                      </div>
                    </div>
                  )}
                  <Button size="sm" onClick={handleSaveOverride} disabled={savingOverride} className="w-full">
                    {savingOverride ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva Override"}
                  </Button>
                </CardContent>
              </Card>

              {/* Configurazione Strategia */}
              <Card className="glass-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Configurazione Strategia
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Modifica le impostazioni fondamentali del cliente
                  </p>
                  {(() => {
                    const latestBia = [...logs].reverse().find((l) => l.bmr_inbody != null);
                    if (!latestBia) return null;
                    return (
                      <div className="mt-2 flex items-center gap-2 bg-secondary/50 rounded-md px-3 py-1.5">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs text-muted-foreground">BMR InBody:</span>
                        <span className="text-xs font-semibold text-foreground">{latestBia.bmr_inbody} kcal</span>
                      </div>
                    );
                  })()}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Obiettivo</Label>
                      <Select value={editGoalType} onValueChange={setEditGoalType}>
                        <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sustainable_loss">Perdita di peso sostenibile</SelectItem>
                          <SelectItem value="aggressive_loss">Mini-cut aggressivo</SelectItem>
                          <SelectItem value="maintenance">Mantenimento</SelectItem>
                          <SelectItem value="weight_gain">Aumento di peso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editGoalType !== 'maintenance' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Peso Obiettivo (kg)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="30"
                          max="300"
                          value={editTargetWeight}
                          onChange={(e) => setEditTargetWeight(e.target.value)}
                          placeholder="es. 72.0"
                          className="border-border"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Strategia Dietetica</Label>
                      <Select value={editDietStrategy} onValueChange={setEditDietStrategy}>
                        <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STRATEGY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Tipo di Dieta</Label>
                      <Select value={editDietType} onValueChange={setEditDietType}>
                        <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="balanced">Bilanciata</SelectItem>
                          <SelectItem value="low_fat">Pochi grassi</SelectItem>
                          <SelectItem value="low_carb">Pochi carboidrati</SelectItem>
                          <SelectItem value="keto">Keto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Preferenza Proteine</Label>
                      <Select value={editProteinPref} onValueChange={setEditProteinPref}>
                        <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Basse</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="high">Alte</SelectItem>
                          <SelectItem value="very_high">Molto alte</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Distribuzione Calorie</Label>
                      <Select value={editCalorieDist} onValueChange={setEditCalorieDist}>
                        <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stable">Stabile</SelectItem>
                          <SelectItem value="polarized">Polarizzata</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Giorni di Allenamento</Label>
                      <Select value={editTrainingDays} onValueChange={setEditTrainingDays}>
                        <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5,6,7].map((d) => (
                            <SelectItem key={d} value={String(d)}>{d} {d === 1 ? "giorno" : "giorni"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Livello di Attività</Label>
                      <Select value={editActivityLevel} onValueChange={setEditActivityLevel}>
                        <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1.2">Sedentario (1.2)</SelectItem>
                          <SelectItem value="1.375">Leggero (1.375)</SelectItem>
                          <SelectItem value="1.55">Moderato (1.55)</SelectItem>
                          <SelectItem value="1.725">Attivo (1.725)</SelectItem>
                          <SelectItem value="1.9">Molto attivo (1.9)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig} className="w-full">
                    {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva Nuova Strategia"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="glass-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    Biofeedback & Fatica
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Check-in settimanali del cliente
                  </p>
                </CardHeader>
                <CardContent>
                  {biofeedbackLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nessun check-in registrato dal cliente.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {biofeedbackLogs.slice(0, 6).map((log) => {
                        const hasAlert = log.energy_score <= 2 || log.performance_score <= 2;
                        return (
                          <div
                            key={log.id}
                            className={`rounded-lg border p-3 space-y-2 ${
                              hasAlert ? "border-destructive/50 bg-destructive/5" : "border-border"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">
                                Sett. {log.week_start_date}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {log.energy_score <= 2 && log.performance_score <= 2 && (
                                   <Badge variant="secondary" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/30">
                                    <Bot className="h-3 w-3" />
                                    AI Auto-regolazione
                                  </Badge>
                                )}
                                {hasAlert && (
                                  <Badge variant="destructive" className="text-[10px] gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Attenzione
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { label: "Fame", value: log.hunger_score, icon: Utensils },
                                { label: "Energia", value: log.energy_score, icon: Zap },
                                { label: "Sonno", value: log.sleep_score, icon: Moon },
                                { label: "Perf.", value: log.performance_score, icon: Dumbbell },
                              ].map((m) => (
                                <div key={m.label} className="text-center">
                                  <m.icon className={`h-3 w-3 mx-auto mb-0.5 ${
                                    m.value <= 2 ? "text-destructive" : "text-muted-foreground"
                                  }`} />
                                  <p className={`text-lg font-display font-bold ${
                                    m.value <= 2 ? "text-destructive" : "text-foreground"
                                  }`}>
                                    {m.value}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                                </div>
                              ))}
                            </div>
                            {log.notes && (
                              <p className="text-xs text-muted-foreground italic">"{log.notes}"</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Note del Coach */}
              <Card className="glass-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-primary" />
                    Note del Coach
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Scrivi una nota visibile al cliente nella sua dashboard
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Scrivi una nota per il cliente..."
                    value={coachNote}
                    onChange={(e) => setCoachNote(e.target.value)}
                    rows={3}
                    className="border-border"
                  />
                  <Button size="sm" onClick={handleSaveNote} disabled={savingNote} className="w-full">
                    {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva Nota"}
                  </Button>
                </CardContent>
              </Card>

              {/* Weight Chart */}
              {chartData.length > 0 ? (
                <ClientWeightChart data={chartData} />
              ) : (
                <Card className="glass-card border-border">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nessun dato di peso registrato dal cliente.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Stats */}
              <Card className="glass-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display">
                    Statistiche Settimanali
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    {
                      label: "Giorni registrati (7gg)",
                      value: `${last7.filter((l) => l.weight != null || (l.calories && l.calories > 0)).length}/7`,
                    },
                    {
                      label: "Media calorie",
                      value: avgCal
                        ? `${avgCal.toLocaleString("it-IT")} kcal`
                        : "—",
                    },
                    {
                      label: "Goal rate",
                      value: `${dynamicRate > 0 ? "+" : ""}${dynamicRate.toFixed(2)} kg/sett`,
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex justify-between py-1.5 border-b border-border last:border-0"
                    >
                      <span className="text-xs text-muted-foreground">
                        {s.label}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {s.value}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* InBody BIA History */}
              {(() => {
                const biaLogs = logs.filter((l) => l.pbf != null).slice(-10).reverse();
                if (biaLogs.length === 0) return null;
                return (
                  <Card className="glass-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-display flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Storico InBody BIA
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-auto max-h-60">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-1.5 text-muted-foreground font-medium">Data</th>
                              <th className="text-right py-1.5 text-muted-foreground font-medium">SMM</th>
                              <th className="text-right py-1.5 text-muted-foreground font-medium">BFM</th>
                              <th className="text-right py-1.5 text-muted-foreground font-medium">PBF%</th>
                              <th className="text-right py-1.5 text-muted-foreground font-medium">VFA</th>
                              <th className="text-right py-1.5 text-muted-foreground font-medium">BMR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {biaLogs.map((l) => (
                              <tr key={l.id} className="border-b border-border last:border-0">
                                <td className="py-1.5">{format(parseISO(l.log_date), "d MMM", { locale: it })}</td>
                                <td className="text-right">{l.smm != null ? `${l.smm} kg` : "—"}</td>
                                <td className="text-right">{l.bfm != null ? `${l.bfm} kg` : "—"}</td>
                                <td className="text-right">{l.pbf != null ? `${l.pbf}%` : "—"}</td>
                                <td className="text-right">{l.vfa ?? "—"}</td>
                                <td className="text-right">{l.bmr_inbody != null ? `${l.bmr_inbody}` : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ClientWeightChart({
  data,
}: {
  data: { date: string; scaleWeight?: number; trendWeight?: number }[];
}) {
  const weights = data.flatMap((d) =>
    [d.scaleWeight, d.trendWeight].filter((v): v is number => v != null)
  );
  const minW = Math.floor(Math.min(...weights) - 1);
  const maxW = Math.ceil(Math.max(...weights) + 1);

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Andamento Peso
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(v) =>
                  format(parseISO(v), "d MMM", { locale: it })
                }
                tick={{
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 11,
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[minW, maxW]}
                tick={{
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 11,
                }}
                axisLine={false}
                tickLine={false}
                unit=" kg"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: 12,
                  color: "hsl(var(--card-foreground))",
                }}
                labelFormatter={(v) =>
                  format(parseISO(v as string), "d MMMM yyyy", { locale: it })
                }
                formatter={(value: number, name: string) => [
                  `${value} kg`,
                  name === "scaleWeight" ? "Bilancia" : "Trend",
                ]}
              />
              <Scatter
                dataKey="scaleWeight"
                fill="hsl(var(--muted-foreground))"
                name="scaleWeight"
                shape="circle"
                r={3}
              />
              <Line
                type="monotone"
                dataKey="trendWeight"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={false}
                name="trendWeight"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
