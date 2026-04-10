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
export type MenstrualPhase = 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
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
  days = 14,
  phaseStartDate?: string | null
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

  // ── Glycogen Dampening Factor ──────────────────────────
  // During the first 14 days of a diet phase, initial weight loss
  // is primarily water & glycogen (~3g water per 1g glycogen).
  // We dampen the weight-delta contribution to avoid TDEE spikes.
  // Multiplier scales linearly from 0.3 (day 1) to 1.0 (day 15).
  let dampening = 1.0;
  if (phaseStartDate) {
    const phaseStart = new Date(phaseStartDate).getTime();
    const now = new Date(window[window.length - 1].log_date).getTime();
    const daysSinceStart = Math.max(0, (now - phaseStart) / (1000 * 60 * 60 * 24));
    if (daysSinceStart <= 14) {
      dampening = 0.3 + (0.7 * daysSinceStart) / 14;
    }
  }

  // Menstrual cycle water weight dampening: during luteal/menstruation phases,
  // sudden weight gains are likely fluid retention — dampen them severely.
  const latestLog = window[window.length - 1];
  const menstrualPhase = (latestLog as DailyMetric & { menstrual_phase?: string | null }).menstrual_phase;
  if (deltaWeight > 0 && (menstrualPhase === 'luteal' || menstrualPhase === 'menstruation')) {
    dampening = Math.min(dampening, 0.3);
  }

  const dampenedDelta = deltaWeight * dampening;
  const dailyEnergyDelta = (dampenedDelta * KCAL_PER_KG) / elapsedDays;
  const tdee = avgCalories - dailyEnergyDelta;

  return Math.round(tdee);
}

// ─── Essential Fat Constants ─────────────────────────────────
const ESSENTIAL_BF_MALE = 0.05;   // 5%
const ESSENTIAL_BF_FEMALE = 0.14; // 14% — prevents Hypothalamic Amenorrhea

// ─── Dynamic Goal Rate ───────────────────────────────────────
/**
 * Calculate weekly weight change target (kg/week).
 *
 * IF BIA data is available (bfm & lbm):
 *   - Subtract essential fat mass before applying Alpert's rule
 *   - max daily deficit = disposable_fat_kg * 69
 *   - max weekly loss   = (max_daily_deficit * 7) / 7700
 *
 * FALLBACK (no BIA): standard bodyweight percentages.
 */
export function calculateDynamicGoalRate(
  goalType: GoalType,
  trendWeight: number,
  bfmKg?: number | null,
  lbmKg?: number | null,
  sex?: string | null,
): number {
  const hasBIA = bfmKg != null && bfmKg > 0 && lbmKg != null && lbmKg > 0;

  if (hasBIA) {
    // Subtract essential fat from disposable fat
    const essentialPct = sex === 'F' ? ESSENTIAL_BF_FEMALE : ESSENTIAL_BF_MALE;
    const essentialFatKg = trendWeight * essentialPct;
    const disposableFatKg = Math.max(0, bfmKg - essentialFatKg);

    const maxDailyDeficit = disposableFatKg * 69;
    const maxLossKgPerWeek = (maxDailyDeficit * 7) / KCAL_PER_KG;

    switch (goalType) {
      case 'sustainable_loss':
        return -(maxLossKgPerWeek * 0.55);
      case 'aggressive_minicut':
        return -maxLossKgPerWeek;
      case 'maintenance':
        return 0;
      case 'weight_gain':
        return lbmKg * 0.003;
      default:
        return 0;
    }
  }

  // Fallback: bodyweight-based
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
  goalRateKgPerWeek: number,
  menstrualPhase?: MenstrualPhase | null
): number {
  // Luteal phase BMR compensation: +150 kcal to TDEE
  const adjustedTDEE = menstrualPhase === 'luteal' ? tdee + 150 : tdee;
  const dailyDelta = (goalRateKgPerWeek * KCAL_PER_KG) / 7;
  return Math.round(adjustedTDEE + dailyDelta);
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

// LBM-based protein multipliers (higher because based on lean mass only)
const LBM_PROTEIN_MULTIPLIERS: Record<ProteinPref, number> = {
  low: 2.2,
  moderate: 2.5,
  high: 2.8,
  very_high: 3.1,
};

// ─── BIA-Driven Utilities ────────────────────────────────────

export interface BIAData {
  bmr_inbody?: number | null;
  bfm?: number | null;
  pbf?: number | null;
  smm?: number | null;
  weight?: number | null;
}

/**
 * Extract the most recent log that contains BIA data.
 */
export function extractLatestBIA(logs: DailyMetric[]): BIAData | null {
  const sorted = [...logs].sort(
    (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  );
  const biaLog = sorted.find(
    (l) => l.bmr_inbody != null || l.bfm != null || l.pbf != null
  );
  if (!biaLog) return null;
  return {
    bmr_inbody: biaLog.bmr_inbody,
    bfm: biaLog.bfm,
    pbf: biaLog.pbf,
    smm: biaLog.smm,
    weight: biaLog.weight,
  };
}

/**
 * Calculate Lean Body Mass from BIA data.
 * Priority: weight - bfm, or weight * (1 - pbf/100)
 */
export function calculateLBM(bia: BIAData, fallbackWeight?: number): number | null {
  const w = bia.weight ?? fallbackWeight;
  if (w == null) return null;
  if (bia.bfm != null) return w - bia.bfm;
  if (bia.pbf != null) return w * (1 - bia.pbf / 100);
  return null;
}

/**
 * BIA-enhanced baseline TDEE calculation.
 * 1. bmr_inbody * activity → if available
 * 2. Katch-McArdle (370 + 21.6 * LBM) * activity → if LBM available
 * 3. Mifflin-St Jeor (gender-specific) * activity → if weight/height/age available
 * 4. null → fallback to adaptive TDEE
 */
export function calculateBaselineTDEE(
  bia: BIAData | null,
  activityMultiplier: number,
  fallbackWeight?: number,
  sex?: string | null,
  heightCm?: number | null,
  age?: number | null,
): number | null {
  if (bia) {
    // Priority 1: InBody BMR
    if (bia.bmr_inbody != null && bia.bmr_inbody > 0) {
      return Math.round(bia.bmr_inbody * activityMultiplier);
    }

    // Priority 2: Katch-McArdle
    const lbm = calculateLBM(bia, fallbackWeight);
    if (lbm != null && lbm > 0) {
      const bmr = 370 + 21.6 * lbm;
      return Math.round(bmr * activityMultiplier);
    }
  }

  // Priority 3: Mifflin-St Jeor (gender-specific)
  const w = bia?.weight ?? fallbackWeight;
  if (w != null && w > 0 && heightCm != null && heightCm > 0 && age != null && age > 0) {
    const sexOffset = sex === 'F' ? -161 : 5;
    const bmr = (10 * w) + (6.25 * heightCm) - (5 * age) + sexOffset;
    return Math.round(bmr * activityMultiplier);
  }

  return null;
}

// ─── Catabolism Risk (Alpert's Rule) ─────────────────────────
export interface CatabolismRiskResult {
  isAtRisk: boolean;
  maxSafeDeficit: number;
  currentDeficit: number;
  essentialFatReached: boolean;
}

/**
 * Check catabolism risk using Alpert's fat transfer rule.
 * Subtracts essential fat before computing max safe deficit.
 */
export function checkCatabolismRisk(
  currentTDEE: number,
  targetCalories: number,
  fatMassKg: number | null,
  weightKg?: number | null,
  sex?: string | null,
): CatabolismRiskResult {
  if (fatMassKg == null || fatMassKg <= 0) {
    return { isAtRisk: false, maxSafeDeficit: 0, currentDeficit: 0, essentialFatReached: false };
  }

  const essentialPct = sex === 'F' ? ESSENTIAL_BF_FEMALE : ESSENTIAL_BF_MALE;
  const essentialFatKg = (weightKg ?? 0) * essentialPct;
  const disposableFatKg = Math.max(0, fatMassKg - essentialFatKg);
  const essentialFatReached = disposableFatKg <= 0;

  const maxSafeDeficit = disposableFatKg * 69;
  const currentDeficit = currentTDEE - targetCalories;
  return {
    isAtRisk: currentDeficit > maxSafeDeficit && !essentialFatReached,
    maxSafeDeficit: Math.round(maxSafeDeficit),
    currentDeficit: Math.round(currentDeficit),
    essentialFatReached,
  };
}

// ─── Micronutrient Targets ────────────────────────────────────
export interface MicronutrientTargets {
  fiberG: number;
  sodiumMg: string;
  potassiumMg: string;
  waterL: number;
}

export function calculateMicronutrients(
  targetCalories: number,
  activityLevel: number,
  weightKg?: number | null,
  tbw?: number | null,
  isTrainingDay?: boolean,
  sex?: string | null,
): MicronutrientTargets {
  const fiberG = Math.max(25, Math.round((targetCalories / 1000) * 14));

  // Sodium target (midpoint of range)
  let sodiumMid: number;
  if (activityLevel <= 1.375) {
    sodiumMid = 2250;
  } else if (activityLevel <= 1.55) {
    sodiumMid = 3000;
  } else {
    sodiumMid = 4000;
  }

  // Potassium: clinical 1:2 Na:K ratio
  const potassiumMid = sodiumMid * 2;

  const sodiumMg = `${sodiumMid}`;
  const potassiumMg = `${potassiumMid}`;

  // Hydration engine
  let waterL = weightKg != null && weightKg > 0 ? weightKg * 0.035 : 2.5;

  if (tbw != null && weightKg != null && weightKg > 0) {
    const hydrationRatio = tbw / weightKg;
    // Gender-specific TBW threshold: women naturally hold less water %
    const tbwThreshold = sex === 'F' ? 0.50 : 0.55;
    if (hydrationRatio < tbwThreshold) {
      waterL += 0.5;
    }
  }

  if (isTrainingDay || activityLevel >= 1.725) {
    waterL += 0.5;
  }

  waterL = Math.round(waterL * 10) / 10;

  return { fiberG, sodiumMg, potassiumMg, waterL };
}

// ─── Macro Split Result (includes TEF delta) ────────────────
export interface MacroResult {
  macros: TargetMacros;
  tefDelta: number;
}

// ─── Macro Split ─────────────────────────────────────────────
export function calculateTargetMacros(
  targetCalories: number,
  bodyWeightKg: number,
  proteinPref: ProteinPref = 'moderate',
  dietType: DietType = 'balanced',
  lbmKg?: number | null,
  age?: number | null
): MacroResult {
  // Step 1: Calculate Protein
  let protein = lbmKg != null && lbmKg > 0
    ? Math.round(lbmKg * LBM_PROTEIN_MULTIPLIERS[proteinPref])
    : Math.round(bodyWeightKg * PROTEIN_MULTIPLIERS[proteinPref]);

  // Age-related Anabolic Resistance: +15% protein for age >= 45
  if (age != null && age >= 45) {
    protein = Math.round(protein * 1.15);
  }

  const proteinCal = protein * 4;

  // Step 2: Calculate Fats & Carbs based on diet type
  let fats: number;
  let carbs: number;

  const fatFloorStd = Math.round(bodyWeightKg * 0.6);
  const fatFloorKeto = Math.round(bodyWeightKg * 1.0);

  switch (dietType) {
    case 'low_fat': {
      fats = fatFloorStd;
      const fatCal = fats * 9;
      const remainingCal = targetCalories - proteinCal - fatCal;
      carbs = Math.max(0, Math.round(remainingCal / 4));
      break;
    }
    case 'low_carb': {
      carbs = Math.round(bodyWeightKg * 1.0);
      const carbCal = carbs * 4;
      const remainingCal = targetCalories - proteinCal - carbCal;
      fats = Math.max(fatFloorStd, Math.round(remainingCal / 9));
      break;
    }
    case 'keto': {
      carbs = 30;
      const carbCal = carbs * 4;
      const remainingCal = targetCalories - proteinCal - carbCal;
      fats = Math.max(fatFloorKeto, Math.round(remainingCal / 9));
      break;
    }
    case 'balanced':
    default: {
      const remainingCal = Math.max(0, targetCalories - proteinCal);
      fats = Math.max(fatFloorStd, Math.round((remainingCal * 0.4) / 9));
      const fatCal = fats * 9;
      carbs = Math.max(0, Math.round((remainingCal - fatCal) / 4));
      break;
    }
  }

  // Step 3: Safety clamp — ensure P*4 + C*4 + F*9 ≈ targetCalories (±5 kcal)
  const minProtein = Math.round(bodyWeightKg * 1.2);
  let generatedCal = protein * 4 + fats * 9 + carbs * 4;
  if (generatedCal > targetCalories + 5) {
    const excessCal = generatedCal - targetCalories;
    const proteinReduction = Math.ceil(excessCal / 4);
    protein = Math.max(minProtein, protein - proteinReduction);
    // Recompute in case protein hit the floor
    generatedCal = protein * 4 + fats * 9 + carbs * 4;
    if (generatedCal > targetCalories + 5) {
      // Still over: trim carbs as last resort
      const stillOver = generatedCal - targetCalories;
      carbs = Math.max(0, carbs - Math.ceil(stillOver / 4));
    }
  }

  // Step 4: Dynamic TEF Reward
  const standardTef = targetCalories * 0.10;
  const dynamicTef = (protein * 4 * 0.25) + (carbs * 4 * 0.08) + (fats * 9 * 0.02);
  const tefDelta = Math.round(dynamicTef - standardTef);

  // If TEF delta is positive, add bonus calories to carbs
  if (tefDelta > 0) {
    carbs += Math.round(tefDelta / 4);
  }

  return { macros: { protein, carbs, fats }, tefDelta: Math.max(0, tefDelta) };
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
  profileCreatedAt?: string;
  lbmKg?: number | null;
}): WeeklyPlan {
  const {
    strategy, tdee, goalRateKgPerWeek, bodyWeightKg,
    proteinPref, dietType, profileCreatedAt, lbmKg,
  } = opts;

  const linearDailyCal = calculateTargetCalories(tdee, goalRateKgPerWeek);
  const linearMacros = calculateTargetMacros(linearDailyCal, bodyWeightKg, proteinPref, dietType, lbmKg).macros;

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

      const deficitMacros = calculateTargetMacros(deficitDayCal, bodyWeightKg, proteinPref, dietType, lbmKg).macros;
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
        const maintMacros = calculateTargetMacros(Math.round(tdee), bodyWeightKg, proteinPref, dietType, lbmKg).macros;
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
      const reverseMacros = calculateTargetMacros(reverseCal, bodyWeightKg, proteinPref, dietType, lbmKg).macros;

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

// ─── Goal ETA Prediction ─────────────────────────────────────
export function calculateGoalETA(
  currentWeight: number,
  targetWeight: number | null,
  weeklyRateKg: number,
  goalType: GoalType
): string | null {
  if (targetWeight == null || goalType === 'maintenance') return null;
  if (weeklyRateKg === 0) return null;

  const weightDelta = targetWeight - currentWeight;

  // Check if goal already reached
  const isLoss = goalType === 'sustainable_loss' || goalType === 'aggressive_minicut';
  if (isLoss && weightDelta >= 0) return "🎉 Obiettivo Raggiunto!";
  if (goalType === 'weight_gain' && weightDelta <= 0) return "🎉 Obiettivo Raggiunto!";

  const absRate = Math.abs(weeklyRateKg);
  if (absRate < 0.01) return null; // rate too small to estimate

  const totalWeeks = Math.abs(weightDelta) / absRate;
  const weeks = Math.floor(totalWeeks);
  const days = Math.round((totalWeeks - weeks) * 7);

  // Italian plural handling
  const wLabel = weeks === 1 ? 'settimana' : 'settimane';
  const dLabel = days === 1 ? 'giorno' : 'giorni';

  if (weeks === 0) return `~ ${days} ${dLabel} rimanenti`;
  if (days === 0) return `~ ${weeks} ${wLabel} rimanenti`;
  return `~ ${weeks} ${wLabel}, ${days} ${dLabel} rimanenti`;
}
