import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, TrendingUp, Activity, BarChart3, Search, Eye, Loader2 } from "lucide-react";
import { ClientDetailSheet } from "@/components/ClientDetailSheet";
import type { Tables } from "@/integrations/supabase/types";
import { differenceInYears, parseISO } from "date-fns";

interface ClientRow {
  id: string;
  email: string;
  profile: Tables<"profiles">;
  lastLogDate: string | null;
  logsLast7: number;
}

function getAdherenceBadge(lastLogDate: string | null, logsLast7: number) {
  if (!lastLogDate) {
    return <Badge variant="destructive">Nessun log</Badge>;
  }
  const daysSince = Math.floor(
    (Date.now() - new Date(lastLogDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSince <= 1) return <Badge className="bg-emerald-600 text-white border-0">Attivo</Badge>;
  if (daysSince <= 3) return <Badge className="bg-yellow-600 text-white border-0">Attenzione</Badge>;
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
      // 1. Get all client role entries
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

      // 2. Fetch profiles for these clients
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .in("id", clientIds);

      if (profErr) throw profErr;

      // 3. Fetch latest log dates and count of logs in last 7 days
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

      // Also fetch the absolute latest log per client
      const { data: allLatest, error: latestErr } = await supabase
        .from("daily_metrics")
        .select("user_id, log_date")
        .in("user_id", clientIds)
        .order("log_date", { ascending: false });

      if (latestErr) throw latestErr;

      // Build lookup maps
      const latestLogMap = new Map<string, string>();
      const logs7Map = new Map<string, number>();

      for (const log of (allLatest ?? [])) {
        if (!latestLogMap.has(log.user_id)) {
          latestLogMap.set(log.user_id, log.log_date);
        }
      }
      for (const log of (recentLogs ?? [])) {
        logs7Map.set(log.user_id, (logs7Map.get(log.user_id) ?? 0) + 1);
      }

      // 4. We need emails — fetch from profiles or use ID as fallback
      // Since we can't access auth.users, we'll show the user ID or use a display approach
      const rows: ClientRow[] = (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.id.slice(0, 8) + "…", // placeholder — will be replaced below
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
      (c) => c.email.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [clients, search]);

  // Summary stats
  const activeCount = clients.filter((c) => {
    if (!c.lastLogDate) return false;
    const days = Math.floor((Date.now() - new Date(c.lastLogDate).getTime()) / (1000 * 60 * 60 * 24));
    return days <= 1;
  }).length;

  const avgAdherence = clients.length > 0
    ? Math.round((clients.reduce((s, c) => s + c.logsLast7, 0) / (clients.length * 7)) * 100)
    : 0;

  const checkinToday = clients.filter((c) => c.lastLogDate === new Date().toISOString().slice(0, 10)).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard Coach</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestisci e monitora i tuoi clienti</p>
      </div>

      {/* Stats Overview */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Clienti Totali", value: String(clients.length), icon: Users },
          { label: "Aderenza Media", value: `${avgAdherence}%`, icon: TrendingUp },
          { label: "Check-in Oggi", value: String(checkinToday), icon: Activity },
          { label: "Clienti Attivi", value: String(activeCount), icon: BarChart3 },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client Roster */}
      <Card className="glass-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg font-display">Lista Clienti</CardTitle>
            <div className="relative w-64">
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
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Caricamento clienti...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {search ? "Nessun cliente trovato" : "Nessun cliente ancora"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? "Prova con un termine diverso" : "I clienti appariranno qui una volta registrati"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Età</TableHead>
                    <TableHead>Sesso</TableHead>
                    <TableHead>Goal Rate</TableHead>
                    <TableHead>Log (7gg)</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium text-foreground">
                        <div>
                          <p className="text-sm">{client.email}</p>
                          <p className="text-xs text-muted-foreground font-mono">{client.id.slice(0, 8)}</p>
                        </div>
                      </TableCell>
                      <TableCell>{calcAge(client.profile.birth_date)}</TableCell>
                      <TableCell className="capitalize">{client.profile.sex ?? "—"}</TableCell>
                      <TableCell>
                        {client.profile.goal_rate != null
                          ? `${client.profile.goal_rate > 0 ? "+" : ""}${client.profile.goal_rate} kg/sett`
                          : "—"}
                      </TableCell>
                      <TableCell>{client.logsLast7}/7</TableCell>
                      <TableCell>{getAdherenceBadge(client.lastLogDate, client.logsLast7)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedClient(client);
                            setSheetOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Dettagli
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

      {/* Client Detail Sheet */}
      <ClientDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        client={selectedClient}
      />
    </div>
  );
};

export default CoachDashboard;
