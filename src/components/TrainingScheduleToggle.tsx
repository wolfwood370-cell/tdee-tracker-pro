import { useAppStore } from "@/stores";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["L", "M", "M", "G", "V", "S", "D"];

export function TrainingScheduleToggle() {
  const { user, profile, setProfile } = useAppStore();

  const schedule: boolean[] =
    ((profile as any)?.training_schedule as boolean[] | null) ??
    [true, false, true, false, true, false, false];

  const handleToggle = async (index: number) => {
    if (!user || !profile) return;

    const newSchedule = [...schedule];
    newSchedule[index] = !newSchedule[index];

    // Optimistic update
    setProfile({ ...profile, training_schedule: newSchedule } as any);

    const { error } = await supabase
      .from("profiles")
      .update({ training_schedule: newSchedule } as any)
      .eq("id", user.id);

    if (error) {
      // Revert
      setProfile({ ...profile, training_schedule: schedule } as any);
      toast({ title: "Errore", description: "Impossibile aggiornare il programma.", variant: "destructive" });
    }

    // Trigger recalc
    useAppStore.getState().recalculateMetrics();
  };

  const trainingCount = schedule.filter(Boolean).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Pianificazione Settimanale
        </p>
        <span className="text-xs text-muted-foreground">
          {trainingCount} giorni allenamento
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {DAY_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => handleToggle(i)}
            className={cn(
              "w-9 h-9 rounded-full text-xs font-bold transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
              schedule[i]
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
