import type { Tables } from "@/integrations/supabase/types";

interface ConsistencyParams {
  targetCalories: number;
  targetProtein: number;
}

/**
 * A day is "consistent" if:
 * 1. Calories within ±100 kcal of target
 * 2. Weight was logged
 * (Protein check skipped since we don't track actual protein intake per day yet)
 */
export function isConsistentDay(
  log: Tables<"daily_metrics">,
  params: ConsistencyParams
): boolean {
  const hasWeight = log.weight != null && Number(log.weight) > 0;
  const hasCalories = log.calories != null && log.calories > 0;
  if (!hasWeight || !hasCalories) return false;

  const calDiff = Math.abs(log.calories! - params.targetCalories);
  return calDiff <= 100;
}

/**
 * Calculate the current streak of consecutive consistent days,
 * ending at today (or yesterday if today has no log yet).
 */
export function calculateStreak(
  logs: Tables<"daily_metrics">[],
  params: ConsistencyParams
): number {
  if (logs.length === 0) return 0;

  // Sort descending by date
  const sorted = [...logs].sort(
    (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from today and go backwards
  let checkDate = new Date(today);

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    const log = sorted.find((l) => l.log_date === dateStr);

    if (log && isConsistentDay(log, params)) {
      streak++;
    } else {
      // If it's today and no log yet, skip to yesterday
      if (i === 0 && !log) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break;
    }

    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}
