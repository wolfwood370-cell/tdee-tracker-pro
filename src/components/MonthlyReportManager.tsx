import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Save, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { generateMonthlyReportDraft, type MonthlyMetricsSummary } from "@/lib/aiService";
import type { Tables } from "@/integrations/supabase/types";

interface MonthlyAssessment {
  id: string;
  user_id: string;
  month_year: string;
  metrics_summary: MonthlyMetricsSummary | Record<string, unknown>;
  report_text: string;
  status: "draft" | "approved";
  created_at: string;
  updated_at: string;
}

interface Props {
  clientId: string;
  clientName: string;
  logs: Tables<"daily_metrics">[];
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function computeMetrics(logs: Tables<"daily_metrics">[]): MonthlyMetricsSummary {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recent = logs.filter((l) => new Date(l.log_date) >= cutoff);

  const weights = recent.map((l) => l.weight).filter((w): w is number => w != null && w > 0);
  const cals = recent.map((l) => l.calories).filter((c): c is number => c != null && c > 0);
  const trainingDays = recent.filter((l) => l.day_type === "training").length;

  const avgWeight = weights.length ? weights.reduce((s, x) => s + x, 0) / weights.length : null;
  const avgCalories = cals.length ? Math.round(cals.reduce((s, x) => s + x, 0) / cals.length) : null;
  const weightDelta =
    weights.length >= 2 ? Number((weights[weights.length - 1] - weights[0]).toFixed(2)) : null;
  const compliancePct = recent.length
    ? Math.round((recent.filter((l) => l.is_perfect_day).length / recent.length) * 100)
    : null;

  return {
    avgWeight: avgWeight != null ? Number(avgWeight.toFixed(2)) : null,
    weightDelta,
    avgCalories,
    compliancePct,
    trainingDaysLogged: trainingDays,
    daysLogged: recent.length,
  };
}

export function MonthlyReportManager({ clientId, clientName, logs }: Props) {
  const [reports, setReports] = useState<MonthlyAssessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [monthKey, setMonthKey] = useState<string>(currentMonthKey());
  const [draftText, setDraftText] = useState<string>("");
  const [draftMetrics, setDraftMetrics] = useState<MonthlyMetricsSummary | null>(null);

  const metrics = useMemo(() => computeMetrics(logs), [logs]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            order: (col: string, opts: { ascending: boolean }) => Promise<{ data: MonthlyAssessment[] | null; error: unknown }>;
          };
        };
      };
    })
      .from("monthly_assessments")
      .select("*")
      .eq("user_id", clientId)
      .order("month_year", { ascending: false });

    if (!error) setReports(data ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // When user picks a month with an existing report, prefill the editor
  useEffect(() => {
    const existing = reports.find((r) => r.month_year === monthKey);
    if (existing) {
      setDraftText(existing.report_text);
      setDraftMetrics(existing.metrics_summary as MonthlyMetricsSummary);
    } else {
      setDraftText("");
      setDraftMetrics(null);
    }
  }, [monthKey, reports]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const text = await generateMonthlyReportDraft(clientName, metrics, "");
      setDraftText(text);
      setDraftMetrics(metrics);
      toast({ title: "Bozza generata", description: "Rivedi e modifica prima di pubblicare." });
    } catch (e) {
      toast({
        title: "Errore generazione",
        description: e instanceof Error ? e.message : "Errore sconosciuto",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!draftText.trim()) {
      toast({ title: "Report vuoto", description: "Genera o scrivi un testo prima di pubblicare.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: clientId,
        month_year: monthKey,
        metrics_summary: (draftMetrics ?? metrics) as unknown as Record<string, unknown>,
        report_text: draftText.trim(),
        status: "approved" as const,
      };

      const client = supabase as unknown as {
        from: (t: string) => {
          upsert: (
            row: Record<string, unknown>,
            opts: { onConflict: string }
          ) => Promise<{ error: unknown }>;
        };
      };

      const { error } = await client
        .from("monthly_assessments")
        .upsert(payload, { onConflict: "user_id,month_year" });

      if (error) throw error;
      toast({ title: "Report pubblicato", description: `Il cliente vedrà il report di ${monthKey}.` });
      fetchReports();
    } catch (e) {
      toast({
        title: "Errore salvataggio",
        description: e instanceof Error ? e.message : "Errore sconosciuto",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Report Mensili
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Month picker + metrics summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="month-key">Mese (AAAA-MM)</Label>
            <Input
              id="month-key"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              placeholder="2026-04"
            />
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-2 text-xs">
            <Badge variant="outline" className="justify-center py-2">
              Peso medio: <span className="ml-1 font-semibold">{metrics.avgWeight ?? "—"} kg</span>
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              Δ Peso 30g: <span className="ml-1 font-semibold">{metrics.weightDelta ?? "—"} kg</span>
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              Aderenza: <span className="ml-1 font-semibold">{metrics.compliancePct ?? "—"}%</span>
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              Giorni logged: <span className="ml-1 font-semibold">{metrics.daysLogged}</span>
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGenerate} disabled={generating} variant="default">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Genera Bozza Mensile (AI)
          </Button>
          <Button onClick={handlePublish} disabled={saving || !draftText.trim()} variant="secondary">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salva e Pubblica
          </Button>
        </div>

        <Textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="La bozza generata dall'AI apparirà qui. Puoi modificarla liberamente prima di pubblicarla al cliente."
          className="min-h-[260px] text-base"
        />

        {/* History */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Cronologia</h4>
          {loading ? (
            <p className="text-sm text-muted-foreground">Caricamento…</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun report ancora.</p>
          ) : (
            <ul className="space-y-1">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => setMonthKey(r.month_year)}
                    className="text-left flex-1 truncate hover:text-primary"
                  >
                    {r.month_year}
                  </button>
                  <Badge variant={r.status === "approved" ? "default" : "outline"} className="ml-2">
                    {r.status === "approved" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Pubblicato
                      </>
                    ) : (
                      "Bozza"
                    )}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
