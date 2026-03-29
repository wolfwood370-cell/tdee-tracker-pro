import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, TrendingUp, Activity, BarChart3, Search, Eye } from "lucide-react";
import { ClientDetailSheet } from "@/components/ClientDetailSheet";
import type { Tables } from "@/integrations/supabase/types";
import { differenceInYears, parseISO } from "date-fns";

interface ClientRow {
  id: string;
  displayName: string;
  profile: Tables<"profiles">;
  lastLogDate: string | null;
  logsLast7: number;
}

function getAdherenceBadge(lastLogDate: string | null) {
  if (!lastLogDate) {
    return <Badge variant="destructive">Nessun log</Badge>;
  }
  const daysSince = Math.floor(
    (Date.now() - new Date(lastLogDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSince <= 1) return <Badge className="bg-primary text-primary-foreground border-0">Attivo</Badge>;
  if (daysSince <= 3) return <Badge className="bg-accent text-accent-foreground border-0">Attenzione</Badge>;
  return <Badge variant="destructive">Azione richiesta</Badge>;
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  return String(differenceInYears(new Date(), parseISO(birthDate)));
}

const CoachDashboard = () => {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

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

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().slice(0, 10);

      const { data: recentLogs, error: logErr } = await supabase
        .from("daily_metrics")
        .select("user_id, log_date")
        .in("user_id", clientIds)
        .gte("log_date", weekAgoStr)
        .order("log_date", { ascending: false });

      if (logErr) throw logErr;

      const { data: allLatest, error: latestErr } = await supabase
        .from("daily_metrics")
        .select("user_id, log_date")
        .in("user_id", clientIds)
        .order("log_date", { ascending: false });

      if (latestErr) throw latestErr;

      const latestLogMap = new Map<string, string>();
      const logs7Map = new Map<string, number>();

      for (const log of allLatest ?? []) {
        if (!latestLogMap.has(log.user_id)) {
          latestLogMap.set(log.user_id, log.log_date);
        }
      }
      for (const log of recentLogs ?? []) {
        logs7Map.set(log.user_id, (logs7Map.get(log.user_id) ?? 0) + 1);
      }

      const rows: ClientRow[] = (profiles ?? []).map((p) => ({
        id: p.id,
        displayName: p.full_name || p.id.slice(0, 8) + "…",
        profile: p,
        lastLogDate: latestLogMap.get(p.id) ?? null,
        logsLast7: logs7Map.get(p.id) ?? 0,
      }));

      setClients(rows);
    } catch (e) {
      console.error("Error fetching clients:", e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const activeCount = clients.filter((c) => {
    if (!c.lastLogDate) return false;
    const days = Math.floor(
      (Date.now() - new Date(c.lastLogDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days <= 1;
  }).length;

  const avgAdherence =
    clients.length > 0
      ? Math.round(
          (clients.reduce((s, c) => s + c.logsLast7, 0) /
            (clients.length * 7)) *
            100
        )
      : 0;

  const checkinToday = clients.filter(
    (c) => c.lastLogDate === new Date().toISOString().slice(0, 10)
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Dashboard Coach
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestisci e monitora i tuoi clienti
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Clienti Totali", value: String(clients.length), icon: Users },
          { label: "Aderenza Media", value: `${avgAdherence}%`, icon: TrendingUp },
          { label: "Check-in Oggi", value: String(checkinToday), icon: Activity },
          { label: "Clienti Attivi", value: String(activeCount), icon: BarChart3 },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card border-border">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xl md:text-2xl font-display font-bold text-foreground">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client Roster */}
      <Card className="glass-card border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg font-display">Lista Clienti</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 border-border"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <div className="ml-auto">
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {search ? "Nessun cliente trovato" : "Nessun cliente ancora"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search
                  ? "Prova con un termine diverso"
                  : "I clienti appariranno qui una volta registrati"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell">Età</TableHead>
                    <TableHead className="hidden sm:table-cell">Sesso</TableHead>
                    <TableHead className="hidden md:table-cell">Goal Rate</TableHead>
                    <TableHead className="hidden md:table-cell">Log (7gg)</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((client) => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedClient(client);
                        setSheetOpen(true);
                      }}
                    >
                      <TableCell className="font-medium text-foreground">
                        <div>
                          <p className="text-sm">{client.displayName}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {client.id.slice(0, 8)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {calcAge(client.profile.birth_date)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell capitalize">
                        {client.profile.sex ?? "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {client.profile.goal_rate != null
                          ? `${client.profile.goal_rate > 0 ? "+" : ""}${client.profile.goal_rate} kg/sett`
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{client.logsLast7}/7</TableCell>
                      <TableCell>
                        {getAdherenceBadge(client.lastLogDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClient(client);
                            setSheetOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Dettagli</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ClientDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        client={selectedClient}
      />
    </div>
  );
};

export default CoachDashboard;
