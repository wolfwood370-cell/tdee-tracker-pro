import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, TrendingDown, TrendingUp, Activity, CalendarDays } from "lucide-react";

interface MetricsSummary {
  avgWeight?: number | null;
  weightDelta?: number | null;
  avgCalories?: number | null;
  compliancePct?: number | null;
  trainingDaysLogged?: number | null;
  daysLogged?: number;
}

interface MonthlyAssessment {
  id: string;
  month_year: string;
  metrics_summary: MetricsSummary;
  report_text: string;
  status: string;
  created_at: string;
}

function formatMonth(monthKey: string): string {
  // monthKey: "2026-04"
  const [y, m] = monthKey.split("-");
  if (!y || !m) return monthKey;
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

export function MonthlyReportsView() {
  const { user } = useAppStore();
  const [reports, setReports] = useState<MonthlyAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("monthly_assessments")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .order("month_year", { ascending: false });

      setReports((data ?? []) as unknown as MonthlyAssessment[]);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground animate-pulse">Caricamento report…</div>;
  }

  if (reports.length === 0) {
    return (
      <Card className="glass-card border-border">
        <CardContent className="py-12 text-center space-y-3">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nessun report mensile ancora pubblicato. Il tuo coach lo renderà disponibile al termine di ogni mese di lavoro.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((r) => {
        const m = r.metrics_summary ?? {};
        const delta = m.weightDelta;
        return (
          <Card
            key={r.id}
            className="glass-card border-border shadow-glow-primary"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2 capitalize">
                <FileText className="h-4 w-4 text-primary" />
                Report di {formatMonth(r.month_year)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stat blocks */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg bg-secondary/60 border border-border p-3 text-center">
                  <Activity className="h-4 w-4 mx-auto text-primary mb-1" />
                  <div className="text-xs text-muted-foreground">Peso medio</div>
                  <div className="text-sm font-semibold">{m.avgWeight ?? "—"} kg</div>
                </div>
                <div className="rounded-lg bg-secondary/60 border border-border p-3 text-center">
                  {delta != null && delta < 0 ? (
                    <TrendingDown className="h-4 w-4 mx-auto text-primary mb-1" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mx-auto text-primary mb-1" />
                  )}
                  <div className="text-xs text-muted-foreground">Variazione</div>
                  <div className="text-sm font-semibold">{delta ?? "—"} kg</div>
                </div>
                <div className="rounded-lg bg-secondary/60 border border-border p-3 text-center">
                  <CalendarDays className="h-4 w-4 mx-auto text-primary mb-1" />
                  <div className="text-xs text-muted-foreground">Giorni tracciati</div>
                  <div className="text-sm font-semibold">{m.daysLogged ?? "—"}</div>
                </div>
                <div className="rounded-lg bg-secondary/60 border border-border p-3 text-center">
                  <Activity className="h-4 w-4 mx-auto text-primary mb-1" />
                  <div className="text-xs text-muted-foreground">Costanza</div>
                  <div className="text-sm font-semibold">{m.compliancePct ?? "—"}%</div>
                </div>
              </div>

              {/* Report body */}
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-foreground">
                {r.report_text}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
