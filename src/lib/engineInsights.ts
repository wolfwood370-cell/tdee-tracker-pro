import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type DailyMetric = Tables<"daily_metrics">;

export type EngineInsightStatus = "needs_data" | "on_track" | "adapting" | "ahead";

export interface EngineInsight {
  status: EngineInsightStatus;
  message: string;
  tdee: number | null;
  weeklyDeltaKg: number | null;
}

interface GenerateArgs {
  profile: Profile | null;
  recentMetrics: DailyMetric[];
  currentTDEE: number | null;
  dynamicGoalRate: number | null; // kg/week (negative = loss)
}

/**
 * Generate human-readable insight about the metabolic engine state.
 * Compares the user's actual 7-day weight trend against their goal rate
 * to detect on-track, adapting (slowing), or ahead-of-pace progress.
 */
export function generateEngineInsight({
  profile,
  recentMetrics,
  currentTDEE,
  dynamicGoalRate,
}: GenerateArgs): EngineInsight {
  const weightLogs = recentMetrics
    .filter((l) => l.weight != null)
    .sort((a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime());

  if (weightLogs.length < 3 || currentTDEE == null) {
    return {
      status: "needs_data",
      message:
        "Il motore è in fase di calcolo. Inserisci il peso e i pasti per i prossimi giorni per stabilire la tua baseline metabolica.",
      tdee: currentTDEE,
      weeklyDeltaKg: null,
    };
  }

  // Use up to last 7 entries with a weight value
  const window = weightLogs.slice(-7);
  const first = window[0];
  const last = window[window.length - 1];
  const days = Math.max(
    1,
    (new Date(last.log_date).getTime() - new Date(first.log_date).getTime()) / 86_400_000,
  );
  const deltaKg = Number(last.weight) - Number(first.weight);
  const weeklyDelta = (deltaKg / days) * 7;

  const tdeeStr = currentTDEE.toLocaleString("it-IT");
  const goalRate = dynamicGoalRate ?? profile?.goal_rate ?? -0.25;

  // Tolerance: ±40% of goal rate (or 0.15 kg/week absolute, whichever is larger)
  const tolerance = Math.max(0.15, Math.abs(goalRate) * 0.4);
  const diff = weeklyDelta - goalRate; // positive => losing slower than planned

  // Loss goal (negative rate)
  if (goalRate < 0) {
    if (diff > tolerance) {
      return {
        status: "adapting",
        message: `Ho rilevato un adattamento metabolico. Il tuo TDEE aggiornato è di ${tdeeStr} kcal. I tuoi macro sono stati ricalibrati per assicurare il progresso.`,
        tdee: currentTDEE,
        weeklyDeltaKg: weeklyDelta,
      };
    }
    if (diff < -tolerance) {
      return {
        status: "ahead",
        message: `Stai perdendo peso più rapidamente del previsto. TDEE adattivo: ${tdeeStr} kcal. Ho leggermente alzato i target per proteggere la massa magra.`,
        tdee: currentTDEE,
        weeklyDeltaKg: weeklyDelta,
      };
    }
  }
  // Gain goal
  else if (goalRate > 0) {
    if (diff < -tolerance) {
      return {
        status: "adapting",
        message: `La crescita è più lenta del previsto. TDEE aggiornato: ${tdeeStr} kcal. Ho ricalibrato i macro per supportare il surplus.`,
        tdee: currentTDEE,
        weeklyDeltaKg: weeklyDelta,
      };
    }
  }
  // Maintenance
  else {
    if (Math.abs(weeklyDelta) > tolerance) {
      return {
        status: "adapting",
        message: `Il peso si sta muovendo più del previsto in fase di mantenimento. TDEE aggiornato: ${tdeeStr} kcal. Ho regolato i target per stabilizzare.`,
        tdee: currentTDEE,
        weeklyDeltaKg: weeklyDelta,
      };
    }
  }

  return {
    status: "on_track",
    message: `Il trend è perfettamente allineato al tuo obiettivo. Il tuo TDEE adattivo è attualmente di ${tdeeStr} kcal. Mantengo la rotta sui macro attuali.`,
    tdee: currentTDEE,
    weeklyDeltaKg: weeklyDelta,
  };
}
