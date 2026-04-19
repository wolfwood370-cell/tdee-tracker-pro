import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  TrendingUp,
  Activity,
  AlertTriangle,
  Search,
  Eye,
  Filter,
  Info,
  ClipboardCheck,
  Inbox,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClientDetailSheet } from "@/components/ClientDetailSheet";
import type { Tables } from "@/integrations/supabase/types";
import { differenceInYears, parseISO } from "date-fns";
import {
  calculateComplianceScore,
  statusBadgeMeta,
  type ComplianceResult,
  type ComplianceStatus,
  type DailyTargets,
  type BiofeedbackEntry,
} from "@/lib/compliance";
import { getWeekDates, toLocalISODate } from "@/lib/weeklyBudget";
import type { DailyMetric } from "@/stores";

interface ClientRow {
  id: string;
  displayName: string;
  profile: Tables<"profiles">;
  lastLogDate: string | null;
  recentTdee: number | null;
  compliance: ComplianceResult;
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  return String(differenceInYears(new Date(), parseISO(birthDate)));
}

/**
 * Build per-day-type calorie targets for a client.
 * Strategy: prefer manual override → fallback to a heuristic based on
 * adaptive TDEE (if available) and goal_rate.
 */
function buildDailyTargets(
  profile: Tables<"profiles">,
  adaptiveTdee: number | null,
): DailyTargets {
  // Manual override path
  if (profile.manual_override_active && profile.manual_calories) {
    return {
      default: profile.manual_calories,
      training: profile.manual_calories,
      rest: profile.manual_calories,
      refeed: Math.round(profile.manual_calories * 1.15),
    };
  }

  // Adaptive heuristic: TDEE - (goal_rate * 7700 / 7) for daily delta
  const tdee = adaptiveTdee ?? 2000; // safe fallback
  const goalRate = profile.goal_rate ?? 0;
  const dailyDelta = Math.round((goalRate * 7700) / 7);
  const linear = Math.max(1200, tdee + dailyDelta);

  return {
    default: linear,
    training: linear,
    rest: linear,
    refeed: Math.round(tdee), // refeed = at maintenance
  };
}

const CoachDashboard = () => {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCritical, setFilterCritical] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingCheckinUserIds, setPendingCheckinUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchClients();
    fetchPendingCheckins();
  }, []);

  async function fetchPendingCheckins() {
    try {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => Promise<{ data: { user_id: string }[] | null; error: unknown }>;
          };
        };
      })
        .from("weekly_checkins")
        .select("user_id")
        .eq("status", "pending");
      if (error) throw error;
      setPendingCheckinUserIds(new Set((data ?? []).map((r) => r.user_id)));
    } catch (e) {
      console.error("Error fetching pending checkins:", e);
    }
  }


  async function fetchClients() {
    setLoading(true);
    try {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");

      if (rolesErr) throw rolesErr;
      if (!roles || roles.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      const clientIds = roles.map((r) => r.user_id);

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .in("id", clientIds);

      if (profErr) throw profErr;

      // Pull current-week logs for ALL clients in one query
      const weekDates = getWeekDates();
      const weekStart = weekDates[0];
      const weekEnd = weekDates[6];

      const { data: weekLogs, error: logErr } = await supabase
        .from("daily_metrics")
        .select("*")
        .in("user_id", clientIds)
        .gte("log_date", weekStart)
        .lte("log_date", weekEnd);

      if (logErr) throw logErr;

      // Latest log per client (for "last activity")
      const { data: allLatest, error: latestErr } = await supabase
        .from("daily_metrics")
        .select("user_id, log_date")
        .in("user_id", clientIds)
        .order("log_date", { ascending: false })
        .limit(clientIds.length * 14);

      if (latestErr) throw latestErr;

      // Adaptive TDEE: most recent weekly_analytics per client
      const { data: analytics, error: anErr } = await supabase
        .from("weekly_analytics")
        .select("user_id, adaptive_tdee, week_start_date")
        .in("user_id", clientIds)
        .order("week_start_date", { ascending: false });
      if (anErr) throw anErr;

      // Recent biofeedback (last 2 entries per client) — pull last ~30 days
      const thirtyAgo = new Date();
      thirtyAgo.setDate(thirtyAgo.getDate() - 30);
      const thirtyAgoStr = thirtyAgo.toISOString().slice(0, 10);
      const { data: biofeedback, error: bioErr } = await supabase
        .from("biofeedback_logs")
        .select("user_id, hunger_score, energy_score, sleep_score, performance_score, created_at")
        .in("user_id", clientIds)
        .gte("week_start_date", thirtyAgoStr)
        .order("created_at", { ascending: false });
      if (bioErr) throw bioErr;

      // Index data by client
      const logsByClient = new Map<string, DailyMetric[]>();
      for (const l of weekLogs ?? []) {
        const arr = logsByClient.get(l.user_id) ?? [];
        arr.push(l as DailyMetric);
        logsByClient.set(l.user_id, arr);
      }

      const latestByClient = new Map<string, string>();
      for (const l of allLatest ?? []) {
        if (!latestByClient.has(l.user_id)) latestByClient.set(l.user_id, l.log_date);
      }

      const tdeeByClient = new Map<string, number>();
      for (const a of analytics ?? []) {
        if (!tdeeByClient.has(a.user_id) && a.adaptive_tdee != null) {
          tdeeByClient.set(a.user_id, a.adaptive_tdee);
        }
      }

      const bioByClient = new Map<string, BiofeedbackEntry[]>();
      for (const b of biofeedback ?? []) {
        const arr = bioByClient.get(b.user_id) ?? [];
        if (arr.length < 2) {
          arr.push(b as BiofeedbackEntry);
          bioByClient.set(b.user_id, arr);
        }
      }

      const rows: ClientRow[] = (profiles ?? []).map((p) => {
        const tdee = tdeeByClient.get(p.id) ?? null;
        const targets = buildDailyTargets(p, tdee);
        const compliance = calculateComplianceScore(
          logsByClient.get(p.id) ?? [],
          p,
          targets,
          bioByClient.get(p.id) ?? [],
        );
        return {
          id: p.id,
          displayName: p.full_name || p.id.slice(0, 8) + "…",
          profile: p,
          lastLogDate: latestByClient.get(p.id) ?? null,
          recentTdee: tdee,
          compliance,
        };
      });

      // Sort: critical first, then warning, then healthy. Within each, by score asc.
      const statusRank: Record<ComplianceStatus, number> = {
        critical: 0,
        warning: 1,
        healthy: 2,
      };
      rows.sort((a, b) => {
        const rs = statusRank[a.compliance.status] - statusRank[b.compliance.status];
        if (rs !== 0) return rs;
        return a.compliance.score - b.compliance.score;
      });

      setClients(rows);
    } catch (e) {
      console.error("Error fetching clients:", e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let out = clients;
    if (filterCritical) {
      out = out.filter((c) => c.compliance.status === "critical");
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
      );
    }
    return out;
  }, [clients, search, filterCritical]);

  // Stats
  const criticalCount = clients.filter((c) => c.compliance.status === "critical").length;
  const healthyCount = clients.filter((c) => c.compliance.status === "healthy").length;
  const avgScore =
    clients.length > 0
      ? Math.round(clients.reduce((s, c) => s + c.compliance.score, 0) / clients.length)
      : 0;
  const todayLocalIso = toLocalISODate(new Date());
  const checkinToday = clients.filter((c) => c.lastLogDate === todayLocalIso).length;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Triage Clinico
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sistema di priorità: i clienti critici sono in cima
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[
            {
              label: "Clienti Totali",
              value: String(clients.length),
              icon: Users,
              tone: "default",
            },
            {
              label: "🔴 Urgenti",
              value: String(criticalCount),
              icon: AlertTriangle,
              tone: criticalCount > 0 ? "destructive" : "default",
            },
            {
              label: "🟢 In Target",
              value: String(healthyCount),
              icon: TrendingUp,
              tone: "default",
            },
            {
              label: "Score Medio",
              value: `${avgScore}/100`,
              icon: Activity,
              tone: "default",
              tooltip: "Basato su aderenza calorica, costanza nel tracciamento e parametri di biofeedback (fame, sonno, energie).",
            },
          ].map((stat) => (
            <Card
              key={stat.label}
              className={`glass-card border-border ${
                stat.tone === "destructive" && criticalCount > 0
                  ? "ring-2 ring-destructive/40"
                  : ""
              }`}
            >
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <stat.icon
                    className={`h-5 w-5 ${
                      stat.tone === "destructive" && criticalCount > 0
                        ? "text-destructive"
                        : "text-primary"
                    }`}
                  />
                  {stat.tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="Info compliance score" className="text-muted-foreground hover:text-foreground transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        {stat.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-xl md:text-2xl font-display font-bold text-foreground">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Triage list with tabs: All clients vs Pending check-ins */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
            <TabsTrigger value="all" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span>Tutti i Clienti</span>
            </TabsTrigger>
            <TabsTrigger value="checkins" className="gap-1.5 relative">
              <Inbox className="h-3.5 w-3.5" />
              <span>Check-in in Attesa</span>
              {pendingCheckinUserIds.size > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-[10px] flex items-center justify-center">
                  {pendingCheckinUserIds.size}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
        <Card className="glass-card border-border">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-lg font-display">
                Lista Clienti{" "}
                <span className="text-xs font-sans text-muted-foreground font-normal">
                  · {checkinToday} check-in oggi
                </span>
              </CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant={filterCritical ? "destructive" : "outline"}
                  onClick={() => setFilterCritical((v) => !v)}
                  className="gap-1.5"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Solo Urgenti
                  {criticalCount > 0 && !filterCritical && (
                    <Badge
                      variant="destructive"
                      className="ml-1 h-5 px-1.5 text-[10px]"
                    >
                      {criticalCount}
                    </Badge>
                  )}
                </Button>
                <div className="relative flex-1 sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca cliente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 border-border"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  {search
                    ? "Nessun cliente trovato"
                    : filterCritical
                    ? "Nessun cliente in stato critico — ottimo lavoro!"
                    : "Nessun cliente ancora"}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filtered.map((client) => {
                  const meta = statusBadgeMeta(client.compliance.status);
                  return (
                    <Card
                      key={client.id}
                      className={`border cursor-pointer transition-all hover:shadow-md ${
                        client.compliance.status === "critical"
                          ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
                          : client.compliance.status === "warning"
                          ? "border-accent/40 bg-accent/5 hover:bg-accent/10"
                          : "border-border bg-secondary/20 hover:bg-secondary/40"
                      }`}
                      onClick={() => {
                        setSelectedClient(client);
                        setSheetOpen(true);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className={`${meta.className} text-xs`}>
                                    {meta.emoji} {meta.label}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="space-y-1 text-xs">
                                    <p className="font-semibold">
                                      Score: {client.compliance.score}/100
                                    </p>
                                    <p>• {client.compliance.reasons.adherence}</p>
                                    <p>• {client.compliance.reasons.consistency}</p>
                                    <p>• {client.compliance.reasons.biofeedback}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              {pendingCheckinUserIds.has(client.id) && (
                                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/30">
                                  <ClipboardCheck className="h-3 w-3 mr-1" />
                                  Check-in
                                </Badge>
                              )}
                              <h3 className="font-display font-semibold text-foreground truncate">
                                {client.displayName}
                              </h3>
                            </div>

                            <p className="text-xs text-muted-foreground mt-1.5 truncate">
                              {client.compliance.primaryReason}
                            </p>

                            <div className="flex items-center gap-3 mt-2.5 text-xs flex-wrap">
                              <span className="text-muted-foreground">
                                Aderenza:{" "}
                                <span className="font-semibold text-foreground">
                                  {client.compliance.adherencePct}%
                                </span>
                              </span>
                              <span className="text-muted-foreground">
                                Log:{" "}
                                <span className="font-semibold text-foreground">
                                  {client.compliance.loggedDays}/
                                  {client.compliance.plannedDays} giorni
                                </span>
                              </span>
                              {client.recentTdee != null && (
                                <span className="text-muted-foreground">
                                  TDEE:{" "}
                                  <span className="font-semibold text-foreground">
                                    {Math.round(client.recentTdee)} kcal
                                  </span>
                                </span>
                              )}
                              {client.profile.birth_date && (
                                <span className="text-muted-foreground hidden sm:inline">
                                  {calcAge(client.profile.birth_date)}{" "}
                                  {client.profile.sex ?? ""}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <div
                              className={`text-2xl font-display font-bold ${
                                client.compliance.status === "critical"
                                  ? "text-destructive"
                                  : client.compliance.status === "warning"
                                  ? "text-accent-foreground"
                                  : "text-primary"
                              }`}
                            >
                              {client.compliance.score}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 hover:bg-primary/10 hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClient(client);
                                setSheetOpen(true);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Dettagli
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="checkins" className="mt-4">
            <Card className="glass-card border-border">
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-primary" />
                  Check-in da Revisionare
                  {pendingCheckinUserIds.size > 0 && (
                    <Badge variant="destructive" className="ml-1 text-xs">
                      {pendingCheckinUserIds.size}
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Apri il dettaglio del cliente per leggere il feedback e marcarlo come revisionato.
                </p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(2)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                ) : pendingCheckinUserIds.size === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">
                      Nessun check-in in attesa. Inbox vuota ✨
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {clients
                      .filter((c) => pendingCheckinUserIds.has(c.id))
                      .map((client) => {
                        const meta = statusBadgeMeta(client.compliance.status);
                        return (
                          <Card
                            key={client.id}
                            className="border border-primary/30 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-all"
                            onClick={() => {
                              setSelectedClient(client);
                              setSheetOpen(true);
                            }}
                          >
                            <CardContent className="p-4 flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className={`${meta.className} text-xs`}>
                                    {meta.emoji} {meta.label}
                                  </Badge>
                                  <h3 className="font-display font-semibold text-foreground truncate">
                                    {client.displayName}
                                  </h3>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1.5">
                                  Check-in settimanale in attesa di revisione
                                </p>
                              </div>
                              <Button size="sm" variant="default" className="gap-1.5 shrink-0">
                                <Eye className="h-3.5 w-3.5" />
                                Apri
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ClientDetailSheet
          open={sheetOpen}
          onOpenChange={(o) => {
            setSheetOpen(o);
            if (!o) fetchPendingCheckins();
          }}
          client={selectedClient}
          onClientDeleted={fetchClients}
        />
      </div>
    </TooltipProvider>
  );
};

export default CoachDashboard;
