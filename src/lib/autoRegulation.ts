/**
 * Auto-Regulation Engine
 * Detects metabolic fatigue from biofeedback and triggers automated diet breaks.
 */

interface BiofeedbackLog {
  week_start_date: string;
  hunger_score: number;
  energy_score: number;
  sleep_score: number;
  performance_score: number;
  notes?: string | null;
}

interface UserProfile {
  goal_type: string;
  diet_strategy: string;
}

export interface AutoRegulationResult {
  triggered: boolean;
  newStrategy?: "matador_break";
  reason?: string;
}

/**
 * Evaluates whether an automated diet break should be triggered.
 *
 * Trigger conditions:
 * 1. User is in a caloric deficit (goal_type is sustainable_loss or aggressive_minicut)
 * 2. energy_score <= 2 AND performance_score <= 2 for TWO consecutive weeks
 */
export function evaluateBiofeedbackTrigger(
  currentLog: BiofeedbackLog,
  previousLogs: BiofeedbackLog[],
  userProfile: UserProfile
): AutoRegulationResult {
  // Only trigger for deficit goals
  const deficitGoals = ["sustainable_loss", "aggressive_minicut"];
  if (!deficitGoals.includes(userProfile.goal_type)) {
    return { triggered: false };
  }

  // Already on matador_break — no need to trigger again
  if (userProfile.diet_strategy === "matador_break") {
    return { triggered: false };
  }

  // Check current week fatigue
  const currentFatigued =
    currentLog.energy_score <= 2 && currentLog.performance_score <= 2;

  if (!currentFatigued) {
    return { triggered: false };
  }

  // Check previous week (most recent entry before current)
  const sorted = [...previousLogs].sort(
    (a, b) => b.week_start_date.localeCompare(a.week_start_date)
  );

  // Find the most recent log that is NOT the same week as currentLog
  const previousLog = sorted.find(
    (l) => l.week_start_date !== currentLog.week_start_date
  );

  if (!previousLog) {
    return { triggered: false };
  }

  const previousFatigued =
    previousLog.energy_score <= 2 && previousLog.performance_score <= 2;

  if (previousFatigued) {
    return {
      triggered: true,
      newStrategy: "matador_break",
      reason:
        "Fatica metabolica rilevata per 2 settimane consecutive. Il sistema ha attivato automaticamente un Diet Break (MATADOR) per proteggere il metabolismo.",
    };
  }

  return { triggered: false };
}

// ─── Metabolic Burnout Detection ─────────────────────────────

interface DailyMetricLike {
  log_date: string;
  weight?: number | null;
  calories?: number | null;
  // biofeedback proxies — if available via joined data
  [key: string]: unknown;
}

/**
 * Detects metabolic burnout from recent daily metrics.
 *
 * A day is flagged as "stressed" if:
 * - Calories were logged AND are very low (< 1200 kcal, indicating extreme restriction or skipping meals)
 * - OR no weight was logged (disengagement signal)
 *
 * If 4+ out of the last 7 days are stressed → burnout detected.
 */
export function detectMetabolicBurnout(recentLogs: DailyMetricLike[]): boolean {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  const last7 = recentLogs.filter((l) => {
    const d = new Date(l.log_date);
    return d >= sevenDaysAgo && d <= now;
  });

  if (last7.length < 4) return false; // not enough data

  let stressedDays = 0;
  for (const log of last7) {
    const lowCal = log.calories != null && log.calories > 0 && log.calories < 1200;
    const noWeight = log.weight == null;
    if (lowCal || noWeight) {
      stressedDays++;
    }
  }

  return stressedDays >= 4;
}
