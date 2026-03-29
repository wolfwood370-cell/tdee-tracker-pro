import type { DailyMetric } from "@/stores";

// ─── Constants ───────────────────────────────────────────────
const KCAL_PER_KG = 7700;

// ─── Types ───────────────────────────────────────────────────
export interface SmoothedLog extends DailyMetric {
  trendWeight: number | null;
}

export interface TargetMacros {
  protein: number;
  carbs: number;
  fats: number;
}

export interface PolarizedTargets {
  trainingDay: { calories: number; macros: TargetMacros };
  restDay: { calories: number; macros: TargetMacros };
}

export type GoalType = 'sustainable_loss' | 'aggressive_minicut' | 'maintenance' | 'weight_gain';
export type DietType = 'balanced' | 'low_fat' | 'low_carb' | 'keto';
export type ProteinPref = 'low' | 'moderate' | 'high' | 'very_high';
export type CalorieDistribution = 'stable' | 'polarized';

// ─── EMA Weight Smoothing ────────────────────────────────────
export function calculateSmoothedWeight(
  logs: DailyMetric[],
  alpha = 0.15
): SmoothedLog[] {
  if (logs.length === 0) return [];

  const sorted = [...logs].sort(
    (a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime()
  );

  let prevTrend: number | null = null;

  return sorted.map((log) => {
    if (log.weight != null) {
      if (prevTrend == null) {
        prevTrend = log.weight;
      } else {
        prevTrend = log.weight * alpha + prevTrend * (1 - alpha);
      }
    }
    return { ...log, trendWeight: prevTrend };
  });
}

// ─── Adaptive TDEE ───────────────────────────────────────────
export function calculateAdaptiveTDEE(
  smoothedLogs: SmoothedLog[],
  days = 14
): number | null {
  if (smoothedLogs.length < 2) return null;

  const window = smoothedLogs.slice(-days);

  const validCalories = window
    .map((l) => l.calories)
    .filter((c): c is number => c != null && c > 0);

  if (validCalories.length === 0) return null;

  const avgCalories =
    validCalories.reduce((sum, c) => sum + c, 0) / validCalories.length;

  const firstTrend = window.find((l) => l.trendWeight != null)?.trendWeight;
  const lastTrend = [...window]
    .reverse()
    .find((l) => l.trendWeight != null)?.trendWeight;

  if (firstTrend == null || lastTrend == null) return null;

  const deltaWeight = lastTrend - firstTrend;

  const firstDate = new Date(window[0].log_date).getTime();
  const lastDate = new Date(window[window.length - 1].log_date).getTime();
  const elapsedDays = Math.max(
    1,
    (lastDate - firstDate) / (1000 * 60 * 60 * 24)
  );

  const dailyEnergyDelta = (deltaWeight * KCAL_PER_KG) / elapsedDays;
  const tdee = avgCalories - dailyEnergyDelta;

  return Math.round(tdee);
}

// ─── Dynamic Goal Rate ───────────────────────────────────────
export function calculateDynamicGoalRate(
  goalType: GoalType,
  trendWeight: number
): number {
  switch (goalType) {
    case 'sustainable_loss':
      return trendWeight * -0.005;
    case 'aggressive_minicut':
      return trendWeight * -0.010;
    case 'maintenance':
      return 0;
    case 'weight_gain':
      return trendWeight * 0.003;
    default:
      return 0;
  }
}

// ─── Target Calories ─────────────────────────────────────────
export function calculateTargetCalories(
  tdee: number,
  goalRateKgPerWeek: number
): number {
  const dailyDelta = (goalRateKgPerWeek * KCAL_PER_KG) / 7;
  return Math.round(tdee + dailyDelta);
}

// ─── Polarized Distribution ──────────────────────────────────
export function calculatePolarizedCalories(
  baseDailyCalories: number,
  trainingDays: number
): { trainingDayCal: number; restDayCal: number } {
  const W = baseDailyCalories * 7;
  const T = trainingDays;
  const R = 7 - T;
  const restDayCal = Math.round(W / (1.2 * T + R));
  const trainingDayCal = Math.round(restDayCal * 1.2);
  return { trainingDayCal, restDayCal };
}

// ─── Protein from preference ─────────────────────────────────
const PROTEIN_MULTIPLIERS: Record<ProteinPref, number> = {
  low: 1.6,
  moderate: 2.0,
  high: 2.2,
  very_high: 2.6,
};

// ─── Macro Split ─────────────────────────────────────────────
export function calculateTargetMacros(
  targetCalories: number,
  bodyWeightKg: number,
  proteinPref: ProteinPref = 'moderate',
  dietType: DietType = 'balanced'
): TargetMacros {
  const protein = Math.round(bodyWeightKg * PROTEIN_MULTIPLIERS[proteinPref]);
  const proteinCal = protein * 4;
  const remainingCal = Math.max(0, targetCalories - proteinCal);

  let fats: number;
  let carbs: number;

  switch (dietType) {
    case 'balanced': {
      const fatCal = remainingCal * 0.5;
      fats = Math.round(fatCal / 9);
      carbs = Math.max(0, Math.round((remainingCal - fatCal) / 4));
      break;
    }
    case 'low_fat': {
      fats = Math.round(bodyWeightKg * 0.6);
      const fatCal = fats * 9;
      carbs = Math.max(0, Math.round((remainingCal - fatCal) / 4));
      break;
    }
    case 'low_carb': {
      carbs = Math.round(bodyWeightKg * 1.0);
      const carbCal = carbs * 4;
      fats = Math.max(0, Math.round((remainingCal - carbCal) / 9));
      break;
    }
    case 'keto': {
      carbs = 30;
      const carbCal = carbs * 4;
      fats = Math.max(0, Math.round((remainingCal - carbCal) / 9));
      break;
    }
    default: {
      fats = Math.round((remainingCal * 0.5) / 9);
      carbs = Math.max(0, Math.round((remainingCal * 0.5) / 4));
    }
  }

  return { protein, carbs, fats };
}
