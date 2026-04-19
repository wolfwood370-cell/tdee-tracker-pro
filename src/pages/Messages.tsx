import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { ChatWindow } from "@/components/ChatWindow";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, MessageCircle, ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  calculateComplianceScore,
  type ComplianceStatus,
  type DailyTargets,
  type BiofeedbackEntry,
} from "@/lib/compliance";
import { getWeekDates } from "@/lib/weeklyBudget";
import type { DailyMetric } from "@/stores";

interface Conversation {
  recipientId: string;
  recipientName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

const Messages = () => {
  const { user } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipient, setSelectedRecipient] = useState<Conversation | null>(null);
  const [search, setSearch] = useState("");

  const isCoach = user?.role === "coach";

  // Fetch all clients for coach (even without messages)
  const fetchCoachClients = useCallback(async () => {
    if (!user?.id || !isCoach) return;
    setLoading(true);

    try {
      // Get all client user_ids
      const { data: clientRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");

      const clientIds = (clientRoles ?? []).map((r) => r.user_id);
      if (clientIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", clientIds);

      // Get all messages for coach
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      // Build message map
      const msgMap = new Map<string, { lastMsg: typeof msgs extends Array<infer M> | null ? M : never; unread: number }>();
      for (const msg of msgs ?? []) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!msgMap.has(partnerId)) {
          msgMap.set(partnerId, { lastMsg: msg, unread: 0 });
        }
        const entry = msgMap.get(partnerId)!;
        if (msg.receiver_id === user.id && !msg.read_at) {
          entry.unread++;
        }
      }

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p.full_name || p.id.slice(0, 8)])
      );

      // Merge: all clients, with or without messages
      const convList: Conversation[] = clientIds.map((cid) => {
        const entry = msgMap.get(cid);
        return {
          recipientId: cid,
          recipientName: profileMap.get(cid) ?? cid.slice(0, 8),
          lastMessage: entry?.lastMsg?.content ?? "",
          lastMessageAt: entry?.lastMsg?.created_at ?? "",
          unreadCount: entry?.unread ?? 0,
        };
      });

      // Sort: unread first, then by last message date
      convList.sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
        if (!a.lastMessageAt && !b.lastMessageAt) return a.recipientName.localeCompare(b.recipientName);
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });

      setConversations(convList);
    } catch (e) {
      console.error("Error fetching coach clients:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isCoach]);

  // Fetch conversations for client
  const fetchClientConversations = useCallback(async () => {
    if (!user?.id || isCoach) return;
    setLoading(true);

    try {
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const convMap = new Map<string, { msgs: NonNullable<typeof msgs>; unread: number }>();
      for (const msg of msgs ?? []) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, { msgs: [], unread: 0 });
        }
        const entry = convMap.get(partnerId)!;
        entry.msgs.push(msg);
        if (msg.receiver_id === user.id && !msg.read_at) {
          entry.unread++;
        }
      }

      const partnerIds = Array.from(convMap.keys());
      if (partnerIds.length === 0) {
        // No conversations yet, find coach
        const { data: coachId } = await supabase.rpc("get_coach_user_id");
        if (coachId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", coachId)
            .single();

          const coachConv: Conversation = {
            recipientId: coachId,
            recipientName: profile?.full_name || "Coach",
            lastMessage: "",
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0,
          };
          setConversations([coachConv]);
          setSelectedRecipient(coachConv);
        }
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", partnerIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p.full_name || p.id.slice(0, 8)])
      );

      const convList: Conversation[] = partnerIds.map((pid) => {
        const entry = convMap.get(pid)!;
        const lastMsg = entry.msgs[0];
        return {
          recipientId: pid,
          recipientName: profileMap.get(pid) ?? pid.slice(0, 8),
          lastMessage: lastMsg.content,
          lastMessageAt: lastMsg.created_at,
          unreadCount: entry.unread,
        };
      });

      convList.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      setConversations(convList);
    } catch (e) {
      console.error("Error fetching conversations:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isCoach]);

  // Initial fetch
  useEffect(() => {
    if (isCoach) {
      fetchCoachClients();
    } else {
      fetchClientConversations();
    }
  }, [isCoach, fetchCoachClients, fetchClientConversations]);

  // Auto-select from URL param ?clientId=
  useEffect(() => {
    const clientId = searchParams.get("clientId");
    if (clientId && conversations.length > 0) {
      const conv = conversations.find((c) => c.recipientId === clientId);
      if (conv) {
        setSelectedRecipient(conv);
        // Clear param after selecting
        setSearchParams({}, { replace: true });
      }
    }
  }, [conversations, searchParams, setSearchParams]);

  // Auto-select for clients
  useEffect(() => {
    if (!isCoach && conversations.length > 0 && !selectedRecipient) {
      setSelectedRecipient(conversations[0]);
    }
  }, [conversations, isCoach, selectedRecipient]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      c.recipientName.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  // Realtime: refetch on new messages
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("messages-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          if (isCoach) fetchCoachClients();
          else fetchClientConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isCoach, fetchCoachClients, fetchClientConversations]);

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedRecipient(conv);
  };

  const handleBackToList = () => {
    setSelectedRecipient(null);
  };

  // Mobile: show either list or chat
  const showList = !isMobile || !selectedRecipient;
  const showChat = !isMobile || !!selectedRecipient;

  return (
    <div className="animate-fade-in h-[calc(100vh-4rem)]">
      <div className="flex h-full gap-4">
        {/* Conversation List */}
        {showList && (
          <Card className={cn(
            "glass-card border-border flex flex-col",
            isMobile ? "w-full" : "w-80 shrink-0"
          )}>
            <div className="p-3 border-b border-border">
              <h2 className="font-display font-bold text-foreground mb-2">
                {isCoach ? "Clienti" : "Messaggi"}
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="space-y-2 p-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isCoach ? "Nessun cliente trovato" : "Nessuna conversazione"}
                  </p>
                </div>
              ) : (
                <div>
                  {filtered.map((conv) => (
                    <button
                      key={conv.recipientId}
                      onClick={() => handleSelectConversation(conv)}
                      className={cn(
                        "w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border/50",
                        selectedRecipient?.recipientId === conv.recipientId &&
                          "bg-primary/5 border-l-2 border-l-primary"
                      )}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {conv.recipientName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground truncate">
                            {conv.recipientName}
                          </p>
                          {conv.lastMessageAt && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {format(parseISO(conv.lastMessageAt), "HH:mm")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.lastMessage || "Inizia a chattare…"}
                          </p>
                          {conv.unreadCount > 0 && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full ml-1 shrink-0">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Chat Area */}
        {showChat && (
          <Card className="glass-card border-border flex-1 flex flex-col overflow-hidden">
            {selectedRecipient ? (
              <>
                <div className="border-b border-border px-4 py-3 flex items-center gap-3">
                  {isMobile && (
                    <Button variant="ghost" size="icon" onClick={handleBackToList} className="shrink-0 -ml-2">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {selectedRecipient.recipientName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="font-display font-semibold text-foreground text-sm">
                    {selectedRecipient.recipientName}
                  </p>
                </div>
                <ChatWindow
                  recipientId={selectedRecipient.recipientId}
                  recipientName={selectedRecipient.recipientName}
                  className="flex-1 min-h-0"
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {isCoach ? "Seleziona un cliente per iniziare" : "Seleziona una conversazione"}
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default Messages;
