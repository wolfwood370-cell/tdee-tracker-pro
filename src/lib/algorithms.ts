import type { DailyMetric } from "@/stores";

// ─── Constants ───────────────────────────────────────────────
const KCAL_PER_KG = 7700;

// ─── Types ───────────────────────────────────────────────────
export interface SmoothedLog extends DailyMetric {
  trendWeight: number | null;
}

// ─── EMA Weight Smoothing ────────────────────────────────────
/**
 * Calculates an Exponential Moving Average (EMA) "trend weight" for each log.
 * Logs MUST be sorted ascending by `log_date`.
 * Missing weight days carry over the previous trend value.
 */
export function calculateSmoothedWeight(
  logs: DailyMetric[],
  alpha = 0.15
): SmoothedLog[] {
  if (logs.length === 0) return [];

  // Sort ascending by date (defensive copy)
  const sorted = [...logs].sort(
    (a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime()
  );

  let prevTrend: number | null = null;

  return sorted.map((log) => {
    if (log.weight != null) {
      if (prevTrend == null) {
        // Seed with the first real weight
        prevTrend = log.weight;
      } else {
        prevTrend = log.weight * alpha + prevTrend * (1 - alpha);
      }
    }
    // If weight is null, prevTrend stays as-is (carry-over)
    return { ...log, trendWeight: prevTrend };
  });
}

// ─── Adaptive TDEE ───────────────────────────────────────────
/**
 * Calculates the user's adaptive TDEE over a rolling window.
 *
 * @param smoothedLogs – logs with `trendWeight` already computed (ascending).
 * @param days – window size in days (default 14).
 * @returns Adaptive TDEE as a rounded integer, or `null` if insufficient data.
 */
export function calculateAdaptiveTDEE(
  smoothedLogs: SmoothedLog[],
  days = 14
): number | null {
  if (smoothedLogs.length < 2) return null;

  // Take the last `days` logs (they should already be sorted ascending)
  const window = smoothedLogs.slice(-days);

  // 1. Average daily caloric intake (ignore null / 0)
  const validCalories = window
    .map((l) => l.calories)
    .filter((c): c is number => c != null && c > 0);

  if (validCalories.length === 0) return null;

  const avgCalories =
    validCalories.reduce((sum, c) => sum + c, 0) / validCalories.length;

  // 2. Weight delta using trend weights at edges of window
  const firstTrend = window.find((l) => l.trendWeight != null)?.trendWeight;
  const lastTrend = [...window]
    .reverse()
    .find((l) => l.trendWeight != null)?.trendWeight;

  if (firstTrend == null || lastTrend == null) return null;

  const deltaWeight = lastTrend - firstTrend; // kg gained/lost

  // Actual elapsed days between first and last log in window
  const firstDate = new Date(window[0].log_date).getTime();
  const lastDate = new Date(window[window.length - 1].log_date).getTime();
  const elapsedDays = Math.max(
    1,
    (lastDate - firstDate) / (1000 * 60 * 60 * 24)
  );

  // 3. Daily energy delta
  const dailyEnergyDelta = (deltaWeight * KCAL_PER_KG) / elapsedDays;

  // 4. TDEE = intake − surplus (or + deficit)
  const tdee = avgCalories - dailyEnergyDelta;

  return Math.round(tdee);
}

// ─── Target Calories & Macros ────────────────────────────────
export interface TargetMacros {
  protein: number;
  carbs: number;
  fats: number;
}

/**
 * Derives daily calorie target from TDEE and a weekly weight-change goal.
 * @param tdee – current adaptive TDEE (kcal)
 * @param goalRateKgPerWeek – target weekly change (negative = loss)
 */
export function calculateTargetCalories(
  tdee: number,
  goalRateKgPerWeek: number
): number {
  const dailyDelta = (goalRateKgPerWeek * KCAL_PER_KG) / 7;
  return Math.round(tdee + dailyDelta);
}

/**
 * Simple macro split: 2g protein/kg, 25% fat, rest carbs.
 * @param targetCalories – daily calorie target
 * @param bodyWeightKg – current (or trend) weight
 */
export function calculateTargetMacros(
  targetCalories: number,
  bodyWeightKg: number
): TargetMacros {
  const protein = Math.round(bodyWeightKg * 2); // 2 g/kg
  const fatCalories = targetCalories * 0.25;
  const fats = Math.round(fatCalories / 9);
  const remainingCalories = targetCalories - protein * 4 - fats * 9;
  const carbs = Math.max(0, Math.round(remainingCalories / 4));
  return { protein, carbs, fats };
}
