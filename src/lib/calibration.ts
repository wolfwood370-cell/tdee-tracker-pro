/**
 * Metabolic Calibration Phase
 * ───────────────────────────
 * To prevent "Cold Start" errors, every new user enters a mandatory 28-day
 * calibration window during which the algorithm purely OBSERVES their habits
 * instead of prescribing precise targets.
 *
 * Exit conditions (BOTH must be false to remain calibrating):
 *   1. They have ≥ 21 valid days of logged data (weight + calories ≥ 500), AND
 *   2. Their tracking_start_date (or created_at fallback) is ≥ 28 days ago.
 *
 * Manual override (`manual_override_active = true`) bypasses calibration
 * immediately — the user has declared their own TDEE.
 */

import type { DailyMetric, Profile } from "@/stores";

export const CALIBRATION_MIN_DAYS = 28;
export const CALIBRATION_MIN_VALID_LOGS = 21;

export interface CalibrationStatus {
  isCalibrating: boolean;
  validLogDays: number;
  daysSinceStart: number;
  daysRemaining: number;
  /** Reason calibration is still active (for UI tooltips). */
  reason: "too_few_logs" | "too_recent" | "complete" | "manual_override";
}

/**
 * Counts logs that have BOTH a real weight AND a real calorie entry (≥ 500 kcal,
 * to filter accidental partial logs). Caps at CALIBRATION_MIN_VALID_LOGS.
 */
function countValidLogs(logs: DailyMetric[]): number {
  let n = 0;
  for (const l of logs) {
    if (l.weight != null && l.calories != null && l.calories >= 500) n++;
  }
  return n;
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Finds the FIRST log_date where the user recorded BOTH weight AND meaningful
 * calories (≥ 500 kcal). Days with only calories or only weight don't anchor
 * the calibration clock — the user must have a complete day to start tracking.
 */
function findFirstValidLogDate(logs: DailyMetric[]): Date | null {
  let earliest: string | null = null;
  for (const l of logs) {
    if (l.weight != null && l.calories != null && l.calories >= 500) {
      if (earliest == null || l.log_date < earliest) earliest = l.log_date;
    }
  }
  return earliest ? new Date(earliest) : null;
}

export function getCalibrationStatus(
  profile: Profile | null,
  dailyLogs: DailyMetric[],
): CalibrationStatus {
  // Manual override: user declared their own TDEE → bypass calibration.
  if (profile?.manual_override_active) {
    return {
      isCalibrating: false,
      validLogDays: countValidLogs(dailyLogs),
      daysSinceStart: 0,
      daysRemaining: 0,
      reason: "manual_override",
    };
  }

  const validLogDays = countValidLogs(dailyLogs);

  // Anchor: first day the user logged BOTH weight AND calories (≥ 500). This is
  // derived from the actual logs — `tracking_start_date` on profile is just a
  // server-side cache. Falls back to profile.tracking_start_date, then created_at,
  // then today (= still calibrating) when no valid day exists yet.
  const firstValid = findFirstValidLogDate(dailyLogs);
  const startStr =
    firstValid?.toISOString() ??
    (profile as { tracking_start_date?: string | null } | null)?.tracking_start_date ??
    profile?.created_at ??
    null;

  // No valid log yet → calibration clock hasn't started: stay calibrating with
  // a full 28-day window remaining.
  if (!firstValid && !startStr) {
    return {
      isCalibrating: true,
      validLogDays,
      daysSinceStart: 0,
      daysRemaining: CALIBRATION_MIN_DAYS,
      reason: "too_few_logs",
    };
  }

  const start = startStr ? new Date(startStr) : new Date();
  const daysSinceStart = daysBetween(start, new Date());

  const enoughLogs = validLogDays >= CALIBRATION_MIN_VALID_LOGS;
  const enoughTime = daysSinceStart >= CALIBRATION_MIN_DAYS;

  const isCalibrating = !(enoughLogs && enoughTime);

  let reason: CalibrationStatus["reason"] = "complete";
  if (isCalibrating) {
    if (!enoughLogs) reason = "too_few_logs";
    else reason = "too_recent";
  }

  const daysRemaining = Math.max(0, CALIBRATION_MIN_DAYS - daysSinceStart);

  return { isCalibrating, validLogDays, daysSinceStart, daysRemaining, reason };
}
