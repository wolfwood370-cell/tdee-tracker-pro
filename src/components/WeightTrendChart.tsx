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
import { TrendingUp } from "lucide-react";

import { useAppStore } from "@/stores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WeightTrendChart() {
  const { smoothedLogs } = useAppStore();

  // Only logs with at least one weight data point
  const chartData = smoothedLogs
    .filter((l) => l.weight != null || l.trendWeight != null)
    .map((l) => ({
      date: l.log_date,
      scaleWeight: l.weight ?? undefined,
      trendWeight: l.trendWeight != null ? Math.round(l.trendWeight * 100) / 100 : undefined,
    }));

  if (chartData.length === 0) {
    return (
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Andamento Peso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Registra il tuo peso per qualche giorno per vedere il trend.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compute Y domain with padding
  const weights = chartData.flatMap((d) =>
    [d.scaleWeight, d.trendWeight].filter((v): v is number => v != null)
  );
  const minW = Math.floor(Math.min(...weights) - 1);
  const maxW = Math.ceil(Math.max(...weights) + 1);

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Andamento Peso
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Peso bilancia vs peso trend (EMA)
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(220 14% 18%)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(parseISO(v), "d MMM", { locale: it })}
                tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[minW, maxW]}
                tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                unit=" kg"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220 18% 10%)",
                  border: "1px solid hsl(220 14% 18%)",
                  borderRadius: "0.5rem",
                  fontSize: 12,
                }}
                labelFormatter={(v) => format(parseISO(v as string), "d MMMM yyyy", { locale: it })}
                formatter={(value: number, name: string) => [
                  `${value} kg`,
                  name === "scaleWeight" ? "Bilancia" : "Trend",
                ]}
              />
              {/* Raw weight as dots */}
              <Scatter
                dataKey="scaleWeight"
                fill="hsl(215 12% 50%)"
                name="scaleWeight"
                shape="circle"
                r={3}
              />
              {/* Trend line */}
              <Line
                type="monotone"
                dataKey="trendWeight"
                stroke="hsl(160 84% 39%)"
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
