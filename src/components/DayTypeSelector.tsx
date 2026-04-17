import { useEffect, useState } from "react";
import { useAppStore } from "@/stores";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getWeeklySlots, getWeeklyUsage, toLocalISODate, type DayType } from "@/lib/weeklyBudget";

export type { DayType };

interface DayTypeSelectorProps {
  onChange?: (dayType: DayType) => void;
}

export function DayTypeSelector({ onChange }: DayTypeSelectorProps) {
  const { user, profile, dailyLogs, updateLog, addLog } = useAppStore();
  const todayStr = toLocalISODate(new Date());
  const todayLog = dailyLogs.find((l) => l.log_date === todayStr);

  const isPolarized = profile?.calorie_distribution === "polarized";
  const dietStrategy = profile?.diet_strategy ?? "linear";
  const allowRefeed =
    isPolarized && (dietStrategy === "refeed_1_day" || dietStrategy === "refeed_2_days");

  const todayDayIndex = (new Date().getDay() + 6) % 7;
  const trainingSchedule =
    (profile?.training_schedule as boolean[] | null) ??
    [true, false, true, false, true, false, false];
  const defaultType: DayType = trainingSchedule[todayDayIndex] ? "training" : "rest";

  const [dayType, setDayType] = useState<DayType>(
    ((todayLog as unknown as { day_type?: DayType | null })?.day_type) ?? defaultType
  );

  const [pendingType, setPendingType] = useState<DayType | null>(null);
  const [guardrailMessage, setGuardrailMessage] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const persistedType = (todayLog as unknown as { day_type?: DayType | null })?.day_type ?? null;

  useEffect(() => {
    const t = persistedType ?? defaultType;
    setDayType(t);
    onChange?.(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedType, defaultType]);

  const persistDayType = async (newType: DayType) => {
    if (!user) return;
    setDayType(newType);
    onChange?.(newType);

    const payload = {
      user_id: user.id,
      log_date: todayStr,
      day_type: newType,
    };

    const { data, error } = await supabase
      .from("daily_metrics")
      .upsert(payload, { onConflict: "user_id,log_date" })
      .select()
      .single();

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile salvare il tipo di giorno.",
        variant: "destructive",
      });
      return;
    }

    if (data) {
      if (todayLog) updateLog(data);
      else addLog(data);
    }
  };

  const handleChange = (value: string) => {
    if (!value || !user) return;
    const newType = value as DayType;
    if (newType === dayType) return;

    // ── Guardrails ───────────────────────────────────────
    const slots = getWeeklySlots(profile);
    const usage = getWeeklyUsage(dailyLogs);
    // Subtract today's persisted type so we evaluate the *new* selection fairly
    const adjUsage = { ...usage };
    if (persistedType === "training") adjUsage.trainingUsed = Math.max(0, adjUsage.trainingUsed - 1);
    if (persistedType === "rest") adjUsage.restUsed = Math.max(0, adjUsage.restUsed - 1);
    if (persistedType === "refeed") adjUsage.refeedUsed = Math.max(0, adjUsage.refeedUsed - 1);

    if (newType === "refeed" && slots.refeedAllowed > 0 && adjUsage.refeedUsed >= slots.refeedAllowed) {
      setPendingType(newType);
      setGuardrailMessage({
        title: "Budget Settimanale Esaurito",
        description: `Hai già utilizzato i tuoi ${slots.refeedAllowed} giorni di refeed per questa settimana. Aggiungerne un altro comprometterebbe il tuo obiettivo settimanale. Vuoi procedere comunque (sconsigliato) o mantenere il piano?`,
      });
      return;
    }

    if (newType === "rest" && slots.restAllowed > 0 && adjUsage.restUsed >= slots.restAllowed) {
      setPendingType(newType);
      setGuardrailMessage({
        title: "Troppi Giorni di Riposo",
        description: `Hai già pianificato ${slots.restAllowed} giorni di riposo questa settimana (in base ai tuoi giorni di allenamento programmati). Aggiungerne un altro potrebbe ridurre l'apporto calorico settimanale sotto il livello necessario per supportare gli allenamenti. Vuoi procedere comunque?`,
      });
      return;
    }

    // No guardrail triggered → persist immediately
    void persistDayType(newType);
  };

  const confirmPending = async () => {
    if (pendingType) {
      await persistDayType(pendingType);
    }
    setPendingType(null);
    setGuardrailMessage(null);
  };

  const cancelPending = () => {
    setPendingType(null);
    setGuardrailMessage(null);
  };

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Tipo di Giornata
        </p>
        <ToggleGroup
          type="single"
          value={dayType}
          onValueChange={handleChange}
          className="justify-start gap-2"
        >
          <ToggleGroupItem
            value="rest"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border"
          >
            🛋️ Riposo
          </ToggleGroupItem>
          <ToggleGroupItem
            value="training"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border"
          >
            🏋️ Allenamento
          </ToggleGroupItem>
          {allowRefeed && (
            <ToggleGroupItem
              value="refeed"
              className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground border border-border"
            >
              🍝 Refeed
            </ToggleGroupItem>
          )}
        </ToggleGroup>
      </div>

      <AlertDialog
        open={guardrailMessage != null}
        onOpenChange={(open) => {
          if (!open) cancelPending();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{guardrailMessage?.title}</AlertDialogTitle>
            <AlertDialogDescription>{guardrailMessage?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPending}>Mantieni Piano</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPending}>Procedi Comunque</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
