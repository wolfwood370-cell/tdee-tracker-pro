import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const AdminBroadcastCard = () => {
  const [title, setTitle] = useState("Versione 1.1.0 Disponibile!");
  const [body, setBody] = useState(
    "Nuovo Nutrition Hub, algoritmo metabolico più preciso e miglioramenti UI Dark Mode. Apri l'app per scoprire le novità.",
  );
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      toast.error("Titolo e messaggio sono obbligatori.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          broadcast: true,
          title: t,
          body: b,
          url: "/client-dashboard",
        },
      });
      if (error) throw error;
      const sent = (data as { sent?: number; total?: number })?.sent ?? 0;
      const total = (data as { sent?: number; total?: number })?.total ?? 0;
      toast.success(`Notifica inviata a ${sent}/${total} clienti.`);
    } catch (e) {
      console.error("[broadcast] error:", e);
      toast.error(e instanceof Error ? e.message : "Errore durante l'invio della notifica.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Megaphone className="h-4 w-4 text-primary" />
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-mono text-xs">
            Broadcast
          </Badge>
        </div>
        <CardTitle className="text-xl font-display tracking-tight">Annuncio Nuova Release</CardTitle>
        <CardDescription>
          Invia una notifica push a tutti i clienti con sottoscrizione attiva. Usa questo strumento per comunicare aggiornamenti importanti della piattaforma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Titolo notifica</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Es. Versione 1.1.0 Disponibile!"
            maxLength={60}
            disabled={loading}
            className="text-base"
          />
          <p className="text-xs text-muted-foreground">{title.length}/60 caratteri</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Corpo del messaggio</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Riassumi le novità principali in poche righe..."
            maxLength={200}
            rows={4}
            disabled={loading}
            className="text-base resize-none"
          />
          <p className="text-xs text-muted-foreground">{body.length}/200 caratteri</p>
        </div>

        <Button
          onClick={handleSend}
          disabled={loading || !title.trim() || !body.trim()}
          className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Invio in corso...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Invia Notifica a Tutti
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminBroadcastCard;
