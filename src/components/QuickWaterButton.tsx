import { useState } from "react";
import { GlassWater, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { Button } from "@/components/ui/button";

interface QuickWaterButtonProps {
  logDate: string; // YYYY-MM-DD
  incrementL?: number; // default 0.25
}

/** One-tap hydration logger: increments today's water_l by 0.25 L. */
export function QuickWaterButton({ logDate, incrementL = 0.25 }: QuickWaterButtonProps) {
  const { user, dailyLogs, addLog, updateLog } = useAppStore();
  const [busy, setBusy] = useState(false);

  const todayLog = dailyLogs.find((l) => l.log_date === logDate && l.user_id === user?.id);
  const currentL = Number((todayLog as { water_l?: number | null } | undefined)?.water_l) || 0;

  const handleAdd = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const next = Math.round((currentL + incrementL) * 100) / 100;
      const { id: _id, ...rest } = todayLog ?? {};
      const payload = {
        ...rest,
        user_id: user.id,
        log_date: logDate,
        water_l: next,
      };
      const { data, error } = await supabase
        .from("daily_metrics")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(payload as any, { onConflict: "user_id,log_date" })
        .select()
        .single();
      if (error) throw error;
      if (todayLog) updateLog(data);
      else addLog(data);
      toast.success(`+${incrementL * 1000} ml 💧`, {
        description: `Totale oggi: ${next.toFixed(2)} L`,
      });
    } catch (e) {
      console.error("Quick water error:", e);
      toast.error("Errore nell'aggiunta dell'acqua.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      onClick={handleAdd}
      disabled={busy}
      variant="outline"
      className="h-11 gap-2 border-primary/30 bg-primary/5 hover:bg-primary/10 text-foreground"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <GlassWater className="h-4 w-4 text-primary" />
      )}
      + 💧 {incrementL * 1000} ml
      <span className="text-xs text-muted-foreground ml-1 font-mono">
        ({currentL.toFixed(2)} L)
      </span>
    </Button>
  );
}
