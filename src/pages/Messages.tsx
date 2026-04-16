import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { ChatWindow } from "@/components/ChatWindow";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MessageCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Conversation {
  recipientId: string;
  recipientName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

const Messages = () => {
  const { user } = useAppStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipient, setSelectedRecipient] = useState<Conversation | null>(null);
  const [search, setSearch] = useState("");

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const convMap = new Map<string, { msgs: any[]; unread: number }>();
      for (const msg of msgs ?? []) {
        const partnerId =
          msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
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
        setConversations([]);
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
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime()
      );

      setConversations(convList);
    } catch (e) {
      console.error("Error fetching conversations:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetchConversations();
  }, [user?.id, fetchConversations]);

  async function fetchConversations() {
    if (!user?.id) return;
    setLoading(true);

    try {
      // Get all messages involving this user
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by conversation partner
      const convMap = new Map<string, { msgs: any[]; unread: number }>();
      for (const msg of msgs ?? []) {
        const partnerId =
          msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, { msgs: [], unread: 0 });
        }
        const entry = convMap.get(partnerId)!;
        entry.msgs.push(msg);
        if (msg.receiver_id === user.id && !msg.read_at) {
          entry.unread++;
        }
      }

      // Fetch partner profiles
      const partnerIds = Array.from(convMap.keys());
      if (partnerIds.length === 0) {
        setConversations([]);
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
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime()
      );

      setConversations(convList);
    } catch (e) {
      console.error("Error fetching conversations:", e);
    } finally {
      setLoading(false);
    }
  }

  // For clients: auto-select the coach conversation or show empty
  useEffect(() => {
    if (user?.role === "client" && conversations.length > 0 && !selectedRecipient) {
      setSelectedRecipient(conversations[0]);
    }
  }, [conversations, user?.role, selectedRecipient]);

  // For clients with no conversations yet: find the coach
  useEffect(() => {
    if (user?.role === "client" && !loading && conversations.length === 0) {
      supabase
        .rpc("get_coach_user_id")
        .then(({ data: coachId }) => {
          if (coachId) {
            supabase
              .from("profiles")
              .select("id, full_name")
              .eq("id", coachId)
              .single()
              .then(({ data: profile }) => {
                const coachConv: Conversation = {
                  recipientId: coachId,
                  recipientName: profile?.full_name || "Coach",
                  lastMessage: "",
                  lastMessageAt: new Date().toISOString(),
                  unreadCount: 0,
                };
                setConversations([coachConv]);
                setSelectedRecipient(coachConv);
              });
          }
        });
    }
  }, [user?.role, loading, conversations.length]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      c.recipientName.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  // Realtime: refetch conversations on new messages
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("messages-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <div className="animate-fade-in h-[calc(100vh-4rem)]">
      <div className="flex h-full gap-4">
        {/* Conversation List */}
        <Card className="glass-card border-border w-80 shrink-0 flex flex-col">
          <div className="p-3 border-b border-border">
            <h2 className="font-display font-bold text-foreground mb-2">
              Messaggi
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
                  Nessuna conversazione
                </p>
              </div>
            ) : (
              <div>
                {filtered.map((conv) => (
                  <button
                    key={conv.recipientId}
                    onClick={() => setSelectedRecipient(conv)}
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

        {/* Chat Area */}
        <Card className="glass-card border-border flex-1 flex flex-col overflow-hidden">
          {selectedRecipient ? (
            <>
              <div className="border-b border-border px-4 py-3 flex items-center gap-3">
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
                  Seleziona una conversazione
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Messages;
