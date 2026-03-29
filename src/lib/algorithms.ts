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
export type DietStrategy = 'linear' | 'refeed_1_day' | 'refeed_2_days' | 'matador_break' | 'reverse_diet';

// ─── Non-Linear Day Plan ─────────────────────────────────────
export interface DayPlan {
  label: string;
  calories: number;
  macros: TargetMacros;
  isRefeed?: boolean;
}

export interface WeeklyPlan {
  strategy: DietStrategy;
  days: DayPlan[]; // always 7 elements (Mon–Sun)
  weeklyTotal: number;
  isMaintenancePhase?: boolean; // for MATADOR
  reverseWeekNumber?: number; // for reverse diet
}

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

// ─── Refeed Day Macros ───────────────────────────────────────
// Protein & fat stay the same as deficit days; extra cals go 100% to carbs.
function calculateRefeedMacros(
  maintenanceCal: number,
  deficitMacros: TargetMacros
): TargetMacros {
  const baseCal = deficitMacros.protein * 4 + deficitMacros.fats * 9 + deficitMacros.carbs * 4;
  const extraCal = Math.max(0, maintenanceCal - baseCal);
  const extraCarbs = Math.round(extraCal / 4);
  return {
    protein: deficitMacros.protein,
    fats: deficitMacros.fats,
    carbs: deficitMacros.carbs + extraCarbs,
  };
}

// ─── Non-Linear Weekly Plan ──────────────────────────────────
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export function calculateWeeklyPlan(opts: {
  strategy: DietStrategy;
  tdee: number;
  goalRateKgPerWeek: number;
  bodyWeightKg: number;
  proteinPref: ProteinPref;
  dietType: DietType;
  profileCreatedAt?: string; // ISO date for reverse diet week calc
}): WeeklyPlan {
  const {
    strategy, tdee, goalRateKgPerWeek, bodyWeightKg,
    proteinPref, dietType, profileCreatedAt,
  } = opts;

  const linearDailyCal = calculateTargetCalories(tdee, goalRateKgPerWeek);
  const linearMacros = calculateTargetMacros(linearDailyCal, bodyWeightKg, proteinPref, dietType);

  // Helper to create a uniform week
  const uniformWeek = (cal: number, macros: TargetMacros, label?: string): DayPlan[] =>
    DAY_LABELS.map((d) => ({ label: label ?? d, calories: cal, macros }));

  switch (strategy) {
    // ── Refeed 1 or 2 days ───────────────────────────────
    case 'refeed_1_day':
    case 'refeed_2_days': {
      const refeedCount = strategy === 'refeed_1_day' ? 1 : 2;
      const weeklyDeficit = (linearDailyCal - tdee) * 7; // negative number (deficit)
      // Refeed days are at TDEE (maintenance). Deficit days absorb entire weekly deficit.
      const deficitDays = 7 - refeedCount;
      const deficitDayCal = Math.round((tdee * 7 + weeklyDeficit - tdee * refeedCount) / deficitDays);
      const refeedDayCal = Math.round(tdee);

      const deficitMacros = calculateTargetMacros(deficitDayCal, bodyWeightKg, proteinPref, dietType);
      const refeedMacros = calculateRefeedMacros(refeedDayCal, deficitMacros);

      // Place refeed on last days of the week (Sat, Sun)
      const days: DayPlan[] = DAY_LABELS.map((label, i) => {
        const isRefeed = i >= 7 - refeedCount;
        return {
          label,
          calories: isRefeed ? refeedDayCal : deficitDayCal,
          macros: isRefeed ? refeedMacros : deficitMacros,
          isRefeed,
        };
      });

      return {
        strategy,
        days,
        weeklyTotal: days.reduce((s, d) => s + d.calories, 0),
      };
    }

    // ── MATADOR (2 weeks deficit, 2 weeks maintenance) ───
    case 'matador_break': {
      // Determine which phase we're in based on the current date
      const startDate = profileCreatedAt ? new Date(profileCreatedAt) : new Date();
      const now = new Date();
      const weeksSinceStart = Math.floor(
        (now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      const cycleWeek = weeksSinceStart % 4; // 0,1 = deficit; 2,3 = maintenance
      const isMaintenancePhase = cycleWeek >= 2;

      if (isMaintenancePhase) {
        const maintMacros = calculateTargetMacros(Math.round(tdee), bodyWeightKg, proteinPref, dietType);
        return {
          strategy,
          days: uniformWeek(Math.round(tdee), maintMacros),
          weeklyTotal: Math.round(tdee) * 7,
          isMaintenancePhase: true,
        };
      }

      return {
        strategy,
        days: uniformWeek(linearDailyCal, linearMacros),
        weeklyTotal: linearDailyCal * 7,
        isMaintenancePhase: false,
      };
    }

    // ── Reverse Diet (+75 kcal/week until TDEE) ──────────
    case 'reverse_diet': {
      const startDate = profileCreatedAt ? new Date(profileCreatedAt) : new Date();
      const now = new Date();
      const weeksSinceStart = Math.max(
        0,
        Math.floor((now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
      );
      // Start from the linear deficit target and add 75 kcal per week, capped at TDEE
      const reverseCal = Math.min(Math.round(tdee), linearDailyCal + 75 * weeksSinceStart);
      const reverseMacros = calculateTargetMacros(reverseCal, bodyWeightKg, proteinPref, dietType);

      return {
        strategy,
        days: uniformWeek(reverseCal, reverseMacros),
        weeklyTotal: reverseCal * 7,
        reverseWeekNumber: weeksSinceStart + 1,
      };
    }

    // ── Linear (default) ─────────────────────────────────
    default:
      return {
        strategy: 'linear',
        days: uniformWeek(linearDailyCal, linearMacros),
        weeklyTotal: linearDailyCal * 7,
      };
  }
}
