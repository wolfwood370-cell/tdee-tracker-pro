import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface ChatWindowProps {
  recipientId: string;
  recipientName: string;
  className?: string;
}

function formatMessageDate(dateStr: string) {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Oggi";
  if (isYesterday(date)) return "Ieri";
  return format(date, "d MMM yyyy", { locale: it });
}

export function ChatWindow({ recipientId, recipientName, className }: ChatWindowProps) {
  const { user } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentUserId = user?.id;

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch messages
  useEffect(() => {
    if (!currentUserId || !recipientId) return;

    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        setMessages((data as Message[]) ?? []);
      }
      setLoading(false);
    };

    fetchMessages();
  }, [currentUserId, recipientId]);

  // Mark unread messages as read
  useEffect(() => {
    if (!currentUserId || messages.length === 0) return;

    const unread = messages.filter(
      (m) => m.receiver_id === currentUserId && !m.read_at
    );
    if (unread.length === 0) return;

    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread.map((m) => m.id))
      .then(({ error }) => {
        if (error) console.error("Error marking as read:", error);
      });
  }, [messages, currentUserId]);

  // Realtime subscription
  useEffect(() => {
    if (!currentUserId || !recipientId) return;

    const channel = supabase
      .channel(`chat-${[currentUserId, recipientId].sort().join("-")}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const msg = payload.new as Message;
          // Only add if it's part of this conversation
          if (
            (msg.sender_id === currentUserId && msg.receiver_id === recipientId) ||
            (msg.sender_id === recipientId && msg.receiver_id === currentUserId)
          ) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });

            // Auto-mark as read if we're the receiver
            if (msg.receiver_id === currentUserId) {
              supabase
                .from("messages")
                .update({ read_at: new Date().toISOString() })
                .eq("id", msg.id)
                .then(() => {});
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, recipientId]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUserId || sending) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      receiver_id: recipientId,
      content,
    });

    if (error) {
      toast.error("Errore nell'invio del messaggio");
      setNewMessage(content);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let lastDate = "";
  for (const msg of messages) {
    const dateKey = msg.created_at.slice(0, 10);
    if (dateKey !== lastDate) {
      groupedMessages.push({ date: msg.created_at, messages: [msg] });
      lastDate = dateKey;
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages area */}
      <ScrollArea className="flex-1 px-4 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nessun messaggio con {recipientName}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Inizia la conversazione inviando un messaggio
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div className="flex justify-center my-3">
                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {formatMessageDate(group.date)}
                  </span>
                </div>
                {group.messages.map((msg) => {
                  const isMine = msg.sender_id === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex mb-1",
                        isMine ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words",
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={cn(
                            "text-[10px] mt-1",
                            isMine
                              ? "text-primary-foreground/60"
                              : "text-muted-foreground"
                          )}
                        >
                          {format(parseISO(msg.created_at), "HH:mm")}
                          {isMine && msg.read_at && " ✓✓"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border p-3 flex gap-2 items-center">
        <Input
          placeholder={`Scrivi a ${recipientName}...`}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
