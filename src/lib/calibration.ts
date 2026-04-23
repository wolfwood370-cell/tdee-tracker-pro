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

  // Tracking anchor: tracking_start_date (set on first weight log or onboarding)
  // → fall back to created_at → fall back to today (= calibrating).
  const startStr =
    (profile as { tracking_start_date?: string | null } | null)?.tracking_start_date ??
    profile?.created_at ??
    null;

  const start = startStr ? new Date(startStr) : new Date();
  const daysSinceStart = daysBetween(start, new Date());

  const enoughLogs = validLogDays >= CALIBRATION_MIN_VALID_LOGS;
  const enoughTime = daysSinceStart >= CALIBRATION_MIN_DAYS;

  const isCalibrating = !(enoughLogs && enoughTime);

  let reason: CalibrationStatus["reason"] = "complete";
  if (isCalibrating) {
    if (!enoughLogs && !enoughTime) reason = "too_few_logs";
    else if (!enoughLogs) reason = "too_few_logs";
    else reason = "too_recent";
  }

  const daysRemaining = Math.max(0, CALIBRATION_MIN_DAYS - daysSinceStart);

  return { isCalibrating, validLogDays, daysSinceStart, daysRemaining, reason };
}
