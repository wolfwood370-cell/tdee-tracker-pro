import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Sparkles, Copy, CheckCircle, AlertTriangle, TrendingUp, Meh, Flame } from "lucide-react";
import { toast } from "sonner";
import { analyzeClientCheckIn, type AICheckInSummary } from "@/lib/aiService";
import type { Tables } from "@/integrations/supabase/types";

interface CoachCopilotSectionProps {
  client: {
    id: string;
    displayName: string;
    profile: Tables<"profiles">;
  };
  logs: Tables<"daily_metrics">[];
}

const SENTIMENT_CONFIG = {
  positive: {
    label: "Positivo",
    icon: TrendingUp,
    className: "bg-primary/10 text-primary border-primary/30",
  },
  neutral: {
    label: "Neutro",
    icon: Meh,
    className: "bg-muted text-muted-foreground border-border",
  },
  negative: {
    label: "Negativo",
    icon: AlertTriangle,
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
  burnout_risk: {
    label: "Rischio Burnout",
    icon: Flame,
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
} as const;

export function CoachCopilotSection({ client, logs }: CoachCopilotSectionProps) {
  const [analysis, setAnalysis] = useState<AICheckInSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [editedReply, setEditedReply] = useState("");
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const last7 = logs.filter((l) => {
        const d = new Date(l.log_date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      });

      const result = await analyzeClientCheckIn(client.profile, last7);
      setAnalysis(result);
      setEditedReply(result.magicReplyDraft);
    } catch (e) {
      toast.error("Impossibile analizzare i dati del cliente. " + (e instanceof Error ? e.message : ""));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedReply);
      setCopied(true);
      toast.success("Messaggio copiato");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossibile copiare il messaggio.");
    }
  };

  const sentimentInfo = analysis ? SENTIMENT_CONFIG[analysis.sentiment] : null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm">
              Coach Copilot
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Analisi AI del check-in settimanale
            </p>
          </div>
        </div>

        {!analysis && !loading && (
          <Button
            onClick={handleAnalyze}
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-md"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Analizza Settimana con AI
          </Button>
        )}

        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              L'AI sta analizzando i dati metabolici...
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {analysis && sentimentInfo && (
          <div className="space-y-4 animate-fade-in">
            {/* Sentiment Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Sentiment:</span>
              <Badge className={sentimentInfo.className}>
                <sentimentInfo.icon className="h-3 w-3 mr-1" />
                {sentimentInfo.label}
              </Badge>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Riepilogo</p>
              <p className="text-sm text-foreground leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Suggested Action */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-medium text-primary mb-1">Azione Suggerita</p>
              <p className="text-sm text-foreground font-medium">{analysis.suggestedAction}</p>
            </div>

            {/* Magic Reply */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Magic Reply (modificabile)
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="h-7 text-xs gap-1"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-3 w-3 text-primary" />
                      Copiato!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copia Messaggio
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                value={editedReply}
                onChange={(e) => setEditedReply(e.target.value)}
                rows={5}
                className="text-sm border-border bg-background resize-y"
              />
            </div>

            {/* Re-analyze */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAnalyze}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Ri-analizza
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
