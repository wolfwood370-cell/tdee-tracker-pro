import { useEffect, useState } from "react";
import { useAppStore } from "@/stores";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type DayType = "training" | "rest" | "refeed";

interface DayTypeSelectorProps {
  onChange?: (dayType: DayType) => void;
}

export function DayTypeSelector({ onChange }: DayTypeSelectorProps) {
  const { user, profile, dailyLogs, updateLog, addLog } = useAppStore();
  const todayStr = new Date().toISOString().slice(0, 10);
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

  useEffect(() => {
    const t = ((todayLog as unknown as { day_type?: DayType | null })?.day_type) ?? defaultType;
    setDayType(t);
    onChange?.(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayLog?.id]);

  const handleChange = async (value: string) => {
    if (!value || !user) return;
    const newType = value as DayType;
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

  return (
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
  );
}
