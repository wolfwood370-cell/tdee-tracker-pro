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
  type SmoothedLog,
  type GoalType,
  type DietType,
  type ProteinPref,
  type CalorieDistribution,
  type DietStrategy,
  type PolarizedTargets,
  type WeeklyPlan,
  type CatabolismRiskResult,
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
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  // Auth actions
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  // Profile actions
  setProfile: (profile) => set({ profile, isLoadingProfile: false }),
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
    set((state) => ({ dailyLogs: [log, ...state.dailyLogs] }));
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

    // --- Manual Override: bypass all calculations ---
    if (profile?.manual_override_active) {
      const manualCal = profile.manual_calories;
      const manualP = profile.manual_protein;
      const manualF = profile.manual_fats;
      const manualC = profile.manual_carbs;

      const smoothed = calculateSmoothedWeight(dailyLogs);
      const tdee = calculateAdaptiveTDEE(smoothed, 14);

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
      });
      return;
    }

    // 1. Smooth weights via EMA
    const smoothed = calculateSmoothedWeight(dailyLogs);
    const updates: Partial<AppState> = { smoothedLogs: smoothed, usingBIAData: false, catabolismRisk: null };

    // Extract BIA data from latest log
    const bia = extractLatestBIA(dailyLogs);
    const activityMultiplier = profile?.activity_level ?? 1.2;
    const lbm = bia ? calculateLBM(bia) : null;

    // 2. TDEE: prefer adaptive (more accurate over time), BIA baseline as seed
    const adaptiveTDEE = calculateAdaptiveTDEE(smoothed, 14);
    const baselineTDEE = calculateBaselineTDEE(bia, activityMultiplier);
    const tdee = adaptiveTDEE ?? baselineTDEE;

    if (tdee != null) {
      updates.currentTDEE = tdee;

      const latestWeight = [...smoothed].reverse().find((l) => l.trendWeight != null)?.trendWeight;

      const goalType = (profile?.goal_type as GoalType) ?? 'sustainable_loss';
      const proteinPref = (profile?.protein_pref as ProteinPref) ?? 'moderate';
      const dietType = (profile?.diet_type as DietType) ?? 'balanced';
      const calorieDistribution = (profile?.calorie_distribution as CalorieDistribution) ?? 'stable';
      const trainingSchedule = (profile?.training_schedule as boolean[] | null) ?? [true, false, true, false, true, false, false];
      const trainingDays = calorieDistribution === 'polarized'
        ? trainingSchedule.filter(Boolean).length
        : profile?.training_days_per_week ?? 4;
      const dietStrategy = (profile?.diet_strategy as DietStrategy) ?? 'linear';

      const bfmKg = bia?.bfm ?? (bia?.pbf != null && latestWeight ? latestWeight * bia.pbf / 100 : null);

      const dynamicRate = latestWeight != null
        ? calculateDynamicGoalRate(goalType, latestWeight, bfmKg, lbm)
        : (profile?.goal_rate ?? -0.25);

      updates.dynamicGoalRate = dynamicRate;

      const targetCal = calculateTargetCalories(tdee, dynamicRate);
      updates.targetCalories = targetCal;

      if (latestWeight != null) {
        const useBIA = lbm != null && lbm > 0;
        updates.usingBIAData = useBIA;

        // Calculate age from birth_date
        let age: number | null = null;
        if (profile?.birth_date) {
          const bd = new Date(profile.birth_date);
          const now = new Date();
          age = now.getFullYear() - bd.getFullYear();
          if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) {
            age--;
          }
        }
        updates.userAge = age;

        const macroResult = calculateTargetMacros(
          targetCal, latestWeight, proteinPref, dietType,
          useBIA ? lbm : undefined, age
        );
        updates.targetMacros = macroResult.macros;
        updates.tefDelta = macroResult.tefDelta;

        // Catabolism risk check (reuse bfmKg computed above)
        updates.catabolismRisk = checkCatabolismRisk(tdee, targetCal, bfmKg);

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
