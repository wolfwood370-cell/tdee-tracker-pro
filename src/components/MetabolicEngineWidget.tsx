import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, TrendingDown, TrendingUp, Hourglass } from "lucide-react";
import { useAppStore } from "@/stores";
import { generateEngineInsight, type EngineInsightStatus } from "@/lib/engineInsights";

const STATUS_META: Record<EngineInsightStatus, { label: string; icon: typeof Brain; cls: string }> = {
  on_track: { label: "Allineato", icon: Sparkles, cls: "bg-success/10 text-success border-success/30" },
  adapting: { label: "Sto Adattando", icon: TrendingDown, cls: "bg-warning/10 text-warning border-warning/30" },
  ahead: { label: "In Anticipo", icon: TrendingUp, cls: "bg-primary/10 text-primary border-primary/30" },
  needs_data: { label: "In Calibrazione", icon: Hourglass, cls: "bg-muted text-muted-foreground border-border" },
};

export const MetabolicEngineWidget = () => {
  const { profile, dailyLogs, currentTDEE, dynamicGoalRate } = useAppStore();

  const insight = useMemo(
    () => generateEngineInsight({ profile, recentMetrics: dailyLogs, currentTDEE, dynamicGoalRate }),
    [profile, dailyLogs, currentTDEE, dynamicGoalRate],
  );

  const meta = STATUS_META[insight.status];
  const Icon = meta.icon;

  // Stable timestamp: refreshed when the insight payload changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lastUpdate = useMemo(
    () => new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    [insight],
  );

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 ring-1 ring-primary/10 shadow-md overflow-hidden">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-foreground">
            Analisi del Motore Metabolico
          </h3>
          <Badge variant="secondary" className={`text-xs ml-auto ${meta.cls}`}>
            <Icon className="h-3 w-3 mr-1" />
            {meta.label}
          </Badge>
        </div>

        <p className="text-sm text-foreground/85 leading-relaxed">
          {insight.message}
        </p>

        {insight.weeklyDeltaKg != null && (
          <p className="text-xs text-muted-foreground mt-2">
            Trend ultimi 7 giorni:{" "}
            <span className="font-semibold text-foreground">
              {insight.weeklyDeltaKg > 0 ? "+" : ""}
              {insight.weeklyDeltaKg.toFixed(2)} kg/sett
            </span>
          </p>
        )}

        <p className="text-[11px] text-muted-foreground mt-3 pt-2 border-t border-border/50">
          Ultimo ricalcolo: oggi alle {lastUpdate}
        </p>
      </CardContent>
    </Card>
  );
};
