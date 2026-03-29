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
import { Activity, Download, Flame, Target, TrendingUp, Utensils, Zap, Loader2, AlertTriangle, Moon, Dumbbell, ClipboardCheck, Bot, ShieldCheck } from "lucide-react";
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
import { exportClientCSV } from "@/lib/csvExport";
import { toast } from "@/hooks/use-toast";
import {
  calculateSmoothedWeight,
  calculateAdaptiveTDEE,
  calculateTargetCalories,
  calculateTargetMacros,
  calculateDynamicGoalRate,
  calculateWeeklyPlan,
  type DietStrategy,
  type GoalType,
  type ProteinPref,
  type DietType,
} from "@/lib/algorithms";
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
  const [biofeedbackLogs, setBiofeedbackLogs] = useState<any[]>([]);
  
  // Manual Override state
  const [overrideActive, setOverrideActive] = useState(false);
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualFats, setManualFats] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    if (!client || !open) return;
    setLoading(true);
    setSelectedStrategy(((client.profile as any)?.diet_strategy as DietStrategy) ?? "linear");
    setOverrideActive((client.profile as any)?.manual_override_active ?? false);
    setManualCalories((client.profile as any)?.manual_calories?.toString() ?? "");
    setManualProtein((client.profile as any)?.manual_protein?.toString() ?? "");
    setManualFats((client.profile as any)?.manual_fats?.toString() ?? "");
    setManualCarbs((client.profile as any)?.manual_carbs?.toString() ?? "");

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
    setTdee(calculateAdaptiveTDEE(s, 14));
  }, [logs]);

  if (!client) return null;

  const goalType = ((client.profile as any)?.goal_type as GoalType) ?? "sustainable_loss";
  const proteinPref = ((client.profile as any)?.protein_pref as ProteinPref) ?? "moderate";
  const dietType = ((client.profile as any)?.diet_type as DietType) ?? "balanced";

  const latestTrend = [...smoothed]
    .reverse()
    .find((l) => l.trendWeight != null)?.trendWeight;

  const dynamicRate = latestTrend != null
    ? calculateDynamicGoalRate(goalType, latestTrend)
    : (client.profile.goal_rate ?? -0.25);

  const targetCal = tdee ? calculateTargetCalories(tdee, dynamicRate) : null;
  const targetMac =
    targetCal && latestTrend
      ? calculateTargetMacros(targetCal, latestTrend, proteinPref, dietType)
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
        .update({ diet_strategy: selectedStrategy } as any)
        .eq("id", client.id);
      if (error) throw error;
      toast({ title: "Strategia assegnata ✓", description: `${STRATEGY_OPTIONS.find(o => o.value === selectedStrategy)?.label} assegnata a ${client.displayName}` });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
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
        } as any)
        .eq("id", client.id);
      if (error) throw error;
      toast({ title: "Override salvato ✓", description: overrideActive ? "Target manuali attivi per il cliente." : "Override disattivato, target algoritmici ripristinati." });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSavingOverride(false);
    }
  };
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
              {/* Targets Hero */}
              <Card className="glass-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-primary" />
                    <h3 className="font-display font-semibold text-foreground text-sm">
                      Target Calcolati
                    </h3>
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

              {/* Biofeedback & Fatigue */}
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
                      {biofeedbackLogs.slice(0, 6).map((log: any) => {
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
