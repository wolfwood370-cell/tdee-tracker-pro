import { useAppStore } from "@/stores";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["L", "M", "M", "G", "V", "S", "D"];

export function TrainingScheduleToggle() {
  const { user, profile, setProfile } = useAppStore();

  const schedule: boolean[] =
    (profile?.training_schedule as boolean[] | null) ??
    [true, false, true, false, true, false, false];

  const maxDays = profile?.training_days_per_week ?? 4;
  const trainingCount = schedule.filter(Boolean).length;

  const handleToggle = async (index: number) => {
    if (!user || !profile) return;

    const newSchedule = [...schedule];
    const turningOn = !newSchedule[index];

    // Block if trying to add more than allowed training days
    if (turningOn && trainingCount >= maxDays) {
      toast({
        title: "Limite raggiunto",
        description: `Puoi selezionare al massimo ${maxDays} giorni di allenamento.`,
        variant: "destructive",
      });
      return;
    }

    newSchedule[index] = turningOn;

    // Optimistic update
    setProfile({ ...profile, training_schedule: newSchedule });

    const { error } = await supabase
      .from("profiles")
      .update({ training_schedule: newSchedule })
      .eq("id", user.id);

    if (error) {
      setProfile({ ...profile, training_schedule: schedule });
      toast({ title: "Errore", description: "Impossibile aggiornare il programma.", variant: "destructive" });
    }

    useAppStore.getState().recalculateMetrics();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Pianificazione Settimanale
        </p>
        <span className="text-xs text-muted-foreground">
          {trainingCount}/{maxDays} giorni allenamento
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {DAY_LABELS.map((label, i) => {
          const isOn = schedule[i];
          const wouldExceed = !isOn && trainingCount >= maxDays;
          return (
            <button
              key={i}
              onClick={() => handleToggle(i)}
              disabled={wouldExceed}
              className={cn(
                "w-9 h-9 rounded-full text-xs font-bold transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                isOn
                  ? "bg-primary text-primary-foreground shadow-md"
                  : wouldExceed
                    ? "bg-muted text-muted-foreground/40 cursor-not-allowed"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
