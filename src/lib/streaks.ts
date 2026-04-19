import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toLocalISODate } from "@/lib/weeklyBudget";

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
  const checkDate = new Date(today);

  const toLocalISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  for (let i = 0; i < 365; i++) {
    const dateStr = toLocalISO(checkDate);
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

/**
 * Phase 70: persistent streak engine.
 * Call after a meaningful daily activity (meal logged, biofeedback saved).
 * - Same-day repeat activity: no change.
 * - Yesterday was the last activity: increment.
 * - Older / never: reset to 1.
 * Updates `profiles.current_streak` and `profiles.last_activity_date`.
 * Returns the new streak (or null on error).
 */
export async function bumpStreak(
  userId: string,
  currentStreak: number,
  lastActivityDate: string | null,
): Promise<number | null> {
  const today = toLocalISODate(new Date());
  if (lastActivityDate === today) return currentStreak; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalISODate(yesterday);

  const newStreak =
    lastActivityDate === yesterdayStr ? (currentStreak ?? 0) + 1 : 1;

  const { error } = await supabase
    .from("profiles")
    .update({ current_streak: newStreak, last_activity_date: today })
    .eq("id", userId);

  if (error) {
    console.error("bumpStreak error:", error);
    return null;
  }
  return newStreak;
}

/**
 * Phase 70: Perfect Day flag — calories within ±5% of target.
 * Persists `is_perfect_day` on the daily_metrics row for that date.
 */
export async function markPerfectDayIfApplicable(
  userId: string,
  logDate: string,
  consumedCalories: number,
  targetCalories: number,
  alreadyPerfect: boolean,
): Promise<boolean> {
  if (!targetCalories || targetCalories <= 0 || !consumedCalories) return alreadyPerfect;
  const lower = targetCalories * 0.95;
  const upper = targetCalories * 1.05;
  const isPerfect = consumedCalories >= lower && consumedCalories <= upper;
  if (isPerfect === alreadyPerfect) return alreadyPerfect;

  const { error } = await supabase
    .from("daily_metrics")
    .update({ is_perfect_day: isPerfect })
    .eq("user_id", userId)
    .eq("log_date", logDate);
  if (error) {
    console.error("markPerfectDayIfApplicable error:", error);
    return alreadyPerfect;
  }
  return isPerfect;
}
