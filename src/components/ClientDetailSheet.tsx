import { useEffect, useState } from "react";
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
} from "recharts";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Download, Flame, Target, TrendingUp, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportClientCSV } from "@/lib/csvExport";
import {
  calculateSmoothedWeight,
  calculateAdaptiveTDEE,
  calculateTargetCalories,
  calculateTargetMacros,
} from "@/lib/algorithms";
import type { Tables } from "@/integrations/supabase/types";
import type { SmoothedLog } from "@/lib/algorithms";

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

  useEffect(() => {
    if (!client || !open) return;
    setLoading(true);

    supabase
      .from("daily_metrics")
      .select("*")
      .eq("user_id", client.id)
      .order("log_date", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching client logs:", error);
          setLogs([]);
        } else {
          setLogs(data ?? []);
        }
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

  const goalRate = client.profile.goal_rate ?? -0.25;
  const targetCal = tdee ? calculateTargetCalories(tdee, goalRate) : null;
  const latestTrend = [...smoothed]
    .reverse()
    .find((l) => l.trendWeight != null)?.trendWeight;
  const targetMac =
    targetCal && latestTrend
      ? calculateTargetMacros(targetCal, latestTrend)
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

  // Weekly stats
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
            <div className="flex items-center justify-center py-12 text-muted-foreground animate-pulse">
              Caricamento dati cliente...
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

              {/* Weight Chart — reusable with props */}
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
                      value: `${goalRate > 0 ? "+" : ""}${goalRate} kg/sett`,
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

// Inline chart — uses design tokens, accepts data as props
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
