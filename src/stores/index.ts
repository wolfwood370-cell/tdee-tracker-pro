import { create } from 'zustand';
import type { Tables, TablesInsert, TablesUpdate, Enums } from '@/integrations/supabase/types';
import {
  calculateSmoothedWeight,
  calculateAdaptiveTDEE,
  calculateTargetCalories,
  calculateTargetMacros,
  calculateDynamicGoalRate,
  calculatePolarizedCalories,
  calculateWeeklyPlan,
  extractLatestBIA,
  calculateLBM,
  calculateBaselineTDEE,
  checkCatabolismRisk,
  calculateGoalETA,
  type SmoothedLog,
  type GoalType,
  type DietType,
  type ProteinPref,
  type CalorieDistribution,
  type DietStrategy,
  type PolarizedTargets,
  type WeeklyPlan,
  type CatabolismRiskResult,
  type MenstrualPhase,
} from '@/lib/algorithms';

// Re-export useful types
export type Profile = Tables<'profiles'>;
export type DailyMetric = Tables<'daily_metrics'>;
export type WeeklyAnalytic = Tables<'weekly_analytics'>;
export type AppRole = Enums<'app_role'>;
export type DailyMetricInsert = TablesInsert<'daily_metrics'>;
export type DailyMetricUpdate = TablesUpdate<'daily_metrics'>;
export type WeeklyAnalyticInsert = TablesInsert<'weekly_analytics'>;

// Macros type
export interface TargetMacros {
  protein: number;
  carbs: number;
  fats: number;
}

// --- Auth Slice ---
interface AuthSlice {
  user: { id: string; email: string; role: AppRole } | null;
  isLoading: boolean;
  setUser: (user: AuthSlice['user']) => void;
  setLoading: (loading: boolean) => void;
}

// --- Profile Slice ---
interface ProfileSlice {
  profile: Profile | null;
  isLoadingProfile: boolean;
  setProfile: (profile: Profile | null) => void;
  clearProfile: () => void;
  updateGoalRate: (newRate: number) => void;
}

// --- Logs Slice ---
interface LogsSlice {
  dailyLogs: DailyMetric[];
  smoothedLogs: SmoothedLog[];
  setLogs: (logs: DailyMetric[]) => void;
  addLog: (log: DailyMetric) => void;
  updateLog: (log: DailyMetric) => void;
  deleteLog: (id: string) => void;
}

// --- Calculations Slice ---
interface CalculationSlice {
  currentTDEE: number | null;
  targetCalories: number | null;
  targetMacros: TargetMacros | null;
  polarizedTargets: PolarizedTargets | null;
  dynamicGoalRate: number | null;
  weeklyPlan: WeeklyPlan | null;
  weeklyAnalytics: WeeklyAnalytic[];
  usingBIAData: boolean;
  catabolismRisk: CatabolismRiskResult | null;
  tefDelta: number;
  userAge: number | null;
  activeMenstrualPhase: MenstrualPhase | null;
  goalETA: string | null;
  setCalculations: (tdee: number, calories: number, macros: TargetMacros) => void;
  setWeeklyAnalytics: (analytics: WeeklyAnalytic[]) => void;
  recalculateMetrics: () => void;
}

export type AppState = AuthSlice & ProfileSlice & LogsSlice & CalculationSlice & {
  logout: () => void;
};

const initialState = {
  // Auth
  user: null,
  isLoading: true,
  // Profile
  profile: null,
  isLoadingProfile: false,
  // Logs
  dailyLogs: [],
  smoothedLogs: [],
  // Calculations
  currentTDEE: null,
  targetCalories: null,
  targetMacros: null,
  polarizedTargets: null,
  dynamicGoalRate: null,
  weeklyPlan: null,
  weeklyAnalytics: [],
  usingBIAData: false,
  catabolismRisk: null,
  tefDelta: 0,
  userAge: null,
  activeMenstrualPhase: null,
  goalETA: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  // Auth actions
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  // Profile actions
  setProfile: (profile) => {
    set({ profile, isLoadingProfile: false });
    // Trigger recalculation whenever profile changes (e.g. goal_type, diet_type)
    get().recalculateMetrics();
  },
  clearProfile: () => set({ profile: null }),
  updateGoalRate: (newRate) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, goal_rate: newRate } : null,
    })),

  // Logs actions (optimistic) — trigger recalculation after mutation
  setLogs: (dailyLogs) => {
    set({ dailyLogs });
    get().recalculateMetrics();
  },
  addLog: (log) => {
    set((state) => {
      const updated = [...state.dailyLogs, log].sort(
        (a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime()
      );
      return { dailyLogs: updated };
    });
    get().recalculateMetrics();
  },
  updateLog: (log) => {
    set((state) => ({
      dailyLogs: state.dailyLogs.map((l) => (l.id === log.id ? log : l)),
    }));
    get().recalculateMetrics();
  },
  deleteLog: (id) => {
    set((state) => ({
      dailyLogs: state.dailyLogs.filter((l) => l.id !== id),
    }));
    get().recalculateMetrics();
  },

  // Calculations actions
  setCalculations: (tdee, calories, macros) =>
    set({ currentTDEE: tdee, targetCalories: calories, targetMacros: macros }),
  setWeeklyAnalytics: (weeklyAnalytics) => set({ weeklyAnalytics }),

  recalculateMetrics: () => {
    const { dailyLogs, profile } = get();

    // --- Manual Override: bypass macro calculations but keep other fields ---
    if (profile?.manual_override_active) {
      const manualCal = profile.manual_calories;
      const manualP = profile.manual_protein;
      const manualF = profile.manual_fats;
      const manualC = profile.manual_carbs;

      const smoothed = calculateSmoothedWeight(dailyLogs);
      const tdee = calculateAdaptiveTDEE(smoothed, 14);

      // Calculate age for display
      let age: number | null = null;
      if (profile.birth_date) {
        const bd = new Date(profile.birth_date);
        const now = new Date();
        age = now.getFullYear() - bd.getFullYear();
        if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) {
          age--;
        }
      }

      // Menstrual phase
      const latestLogSorted = [...dailyLogs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
      const trackCycle = profile.track_menstrual_cycle === true;
      const menstrualPhase: MenstrualPhase | null = trackCycle
        ? (latestLogSorted[0]?.menstrual_phase as MenstrualPhase | null) ?? null
        : null;

      // Goal ETA
      const latestWeight = [...smoothed].reverse().find((l) => l.trendWeight != null)?.trendWeight;
      const goalType = (profile.goal_type as GoalType) ?? 'sustainable_loss';
      const goalETA = latestWeight != null
        ? calculateGoalETA(latestWeight, profile.target_weight ?? null, profile.goal_rate ?? -0.25, goalType)
        : null;

      set({
        smoothedLogs: smoothed,
        currentTDEE: tdee,
        targetCalories: manualCal ?? 2000,
        targetMacros: {
          protein: manualP ?? 150,
          carbs: manualC ?? 200,
          fats: manualF ?? 70,
        },
        polarizedTargets: null,
        dynamicGoalRate: null,
        weeklyPlan: null,
        usingBIAData: false,
        catabolismRisk: null,
        userAge: age,
        activeMenstrualPhase: menstrualPhase,
        goalETA,
      });
      return;
    }

    // 1. Smooth weights via EMA
    const smoothed = calculateSmoothedWeight(dailyLogs);
    const updates: Partial<AppState> = { smoothedLogs: smoothed, usingBIAData: false, catabolismRisk: null, activeMenstrualPhase: null, goalETA: null };

    // Extract BIA data from latest log
    const bia = extractLatestBIA(dailyLogs);
    const activityMultiplier = profile?.activity_level ?? 1.2;
    const lbm = bia ? calculateLBM(bia) : null;
    const profileSex = profile?.sex ?? null;

    // Calculate age from birth_date (needed for Mifflin-St Jeor fallback)
    let age: number | null = null;
    if (profile?.birth_date) {
      const bd = new Date(profile.birth_date);
      const now = new Date();
      age = now.getFullYear() - bd.getFullYear();
      if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) {
        age--;
      }
    }

    // 2. TDEE: prefer adaptive (more accurate over time), BIA baseline as seed, Mifflin-St Jeor as last resort
    const phaseStart = profile?.created_at ?? null;
    const adaptiveTDEE = calculateAdaptiveTDEE(smoothed, 14, phaseStart);
    const latestWeight = [...smoothed].reverse().find((l) => l.trendWeight != null)?.trendWeight;
    const baselineTDEE = calculateBaselineTDEE(bia, activityMultiplier, latestWeight ?? undefined, profileSex, profile?.height_cm ?? null, age);
    const tdee = adaptiveTDEE ?? baselineTDEE;

    if (tdee != null) {
      updates.currentTDEE = tdee;

      const goalType = (profile?.goal_type as GoalType) ?? 'sustainable_loss';
      const proteinPref = (profile?.protein_pref as ProteinPref) ?? 'moderate';
      const dietType = (profile?.diet_type as DietType) ?? 'balanced';
      const calorieDistribution = (profile?.calorie_distribution as CalorieDistribution) ?? 'stable';
      // Phase 53: derive trainingDays from weekly_schedule (single source of truth).
      // Falls back to training_days_per_week if schedule is missing or empty.
      const weeklyScheduleRaw = (profile as { weekly_schedule?: Record<string, string> } | null)?.weekly_schedule;
      const scheduledTrainingDays = weeklyScheduleRaw
        ? Object.values(weeklyScheduleRaw).filter((v) => v === 'training').length
        : 0;
      const trainingDays = calorieDistribution === 'polarized'
        ? (scheduledTrainingDays > 0 ? scheduledTrainingDays : (profile?.training_days_per_week ?? 4))
        : profile?.training_days_per_week ?? 4;
      const dietStrategy = (profile?.diet_strategy as DietStrategy) ?? 'linear';

      const bfmKg = bia?.bfm ?? (bia?.pbf != null && latestWeight ? latestWeight * bia.pbf / 100 : null);

      const dynamicRate = latestWeight != null
        ? calculateDynamicGoalRate(goalType, latestWeight, bfmKg, lbm, profileSex)
        : (profile?.goal_rate ?? -0.25);

      updates.dynamicGoalRate = dynamicRate;

      // Goal ETA
      const profileTargetWeight = profile?.target_weight ?? null;
      if (latestWeight != null) {
        updates.goalETA = calculateGoalETA(latestWeight, profileTargetWeight, dynamicRate, goalType);
      }

      // Determine active menstrual phase from latest log
      const latestLogSorted = [...dailyLogs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
      const trackCycle = profile?.track_menstrual_cycle === true;
      const currentMenstrualPhase: MenstrualPhase | null = trackCycle
        ? (latestLogSorted[0]?.menstrual_phase as MenstrualPhase | null) ?? null
        : null;
      updates.activeMenstrualPhase = currentMenstrualPhase;

      let targetCal = calculateTargetCalories(tdee, dynamicRate, currentMenstrualPhase);

      // Diet Break Override: force maintenance + extra carbs
      const dietBreakUntil = profile?.diet_break_until;
      const isDietBreakActive = dietBreakUntil && new Date(dietBreakUntil) >= new Date(new Date().toISOString().slice(0, 10));
      if (isDietBreakActive) {
        targetCal = tdee; // cancel deficit, go to maintenance
      }

      updates.targetCalories = targetCal;

      if (latestWeight != null) {
        const useBIA = lbm != null && lbm > 0;
        updates.usingBIAData = useBIA;

        updates.userAge = age;

        const macroResult = calculateTargetMacros(
          targetCal, latestWeight, proteinPref, dietType,
          useBIA ? lbm : undefined, age
        );
        updates.targetMacros = macroResult.macros;
        updates.tefDelta = macroResult.tefDelta;

        // Catabolism risk check (reuse bfmKg computed above)
        updates.catabolismRisk = checkCatabolismRisk(tdee, targetCal, bfmKg, latestWeight, profileSex);

        // Polarized distribution
        if (calorieDistribution === 'polarized') {
          const { trainingDayCal, restDayCal } = calculatePolarizedCalories(targetCal, trainingDays);
          updates.polarizedTargets = {
            trainingDay: {
              calories: trainingDayCal,
              macros: calculateTargetMacros(trainingDayCal, latestWeight, proteinPref, dietType, useBIA ? lbm : undefined, age).macros,
            },
            restDay: {
              calories: restDayCal,
              macros: calculateTargetMacros(restDayCal, latestWeight, proteinPref, dietType, useBIA ? lbm : undefined, age).macros,
            },
          };
        } else {
          updates.polarizedTargets = null;
        }

        // Non-linear weekly plan
        updates.weeklyPlan = calculateWeeklyPlan({
          strategy: dietStrategy,
          tdee,
          goalRateKgPerWeek: dynamicRate,
          bodyWeightKg: latestWeight,
          proteinPref,
          dietType,
          profileCreatedAt: profile?.created_at,
          lbmKg: useBIA ? lbm : undefined,
        });
      }
    }

    set(updates);
  },

  // Full reset on logout
  logout: () => set({ ...initialState, isLoading: false }),
}));
