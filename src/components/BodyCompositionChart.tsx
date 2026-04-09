import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Users } from "lucide-react";

import { useAppStore } from "@/stores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CompositionPoint {
  date: string;
  smm?: number;
  bfm?: number;
  pbf?: number;
}

export function BodyCompositionChart() {
  const { dailyLogs } = useAppStore();

  const chartData: CompositionPoint[] = dailyLogs
    .filter((l) => l.smm != null || l.bfm != null || l.pbf != null)
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .map((l) => ({
      date: l.log_date,
      smm: l.smm != null ? Number(l.smm) : undefined,
      bfm: l.bfm != null ? Number(l.bfm) : undefined,
      pbf: l.pbf != null ? Number(l.pbf) : undefined,
    }));

  if (chartData.length === 0) {
    return null;
  }

  const kgVals = chartData.flatMap((d) =>
    [d.smm, d.bfm].filter((v): v is number => v != null)
  );
  const minV = kgVals.length ? Math.floor(Math.min(...kgVals) - 1) : 0;
  const maxV = kgVals.length ? Math.ceil(Math.max(...kgVals) + 1) : 50;

  const pbfVals = chartData.map((d) => d.pbf).filter((v): v is number => v != null);
  const minPbf = pbfVals.length ? Math.floor(Math.min(...pbfVals) - 2) : 0;
  const maxPbf = pbfVals.length ? Math.ceil(Math.max(...pbfVals) + 2) : 40;

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Composizione Corporea
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Massa muscolare (SMM) vs massa grassa (BFM) nel tempo
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
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
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="kg"
                domain={[minV, maxV]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                unit=" kg"
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                domain={[minPbf, maxPbf]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                unit="%"
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
                  name === "pbf" ? `${value.toFixed(1)}%` : `${value.toFixed(1)} kg`,
                  name === "smm" ? "Massa Muscolare" : name === "bfm" ? "Massa Grassa" : "% Grasso Corporeo",
                ]}
              />
              <Line
                yAxisId="kg"
                type="monotone"
                dataKey="smm"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                name="smm"
                connectNulls
              />
              <Line
                yAxisId="kg"
                type="monotone"
                dataKey="bfm"
                stroke="hsl(var(--destructive))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--destructive))" }}
                name="bfm"
                connectNulls
              />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="pbf"
                stroke="hsl(var(--accent-foreground))"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3, fill: "hsl(var(--accent-foreground))" }}
                name="pbf"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm bg-primary" />
            Massa Muscolare (SMM)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm bg-destructive" />
            Massa Grassa (BFM)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm bg-accent-foreground border border-dashed border-accent-foreground" />
            % Grasso (PBF)
          </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
