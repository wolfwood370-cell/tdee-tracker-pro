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
  type SmoothedLog,
  type GoalType,
  type DietType,
  type ProteinPref,
  type CalorieDistribution,
  type DietStrategy,
  type PolarizedTargets,
  type WeeklyPlan,
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
    if ((profile as any)?.manual_override_active) {
      const manualCal = (profile as any)?.manual_calories as number | null;
      const manualP = (profile as any)?.manual_protein as number | null;
      const manualF = (profile as any)?.manual_fats as number | null;
      const manualC = (profile as any)?.manual_carbs as number | null;

      // Still compute smoothed weights for chart
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
      } as any);
      return;
    }

    // 1. Smooth weights via EMA
    const smoothed = calculateSmoothedWeight(dailyLogs);
    const updates: Partial<AppState> = { smoothedLogs: smoothed };

    // 2. Adaptive TDEE (need ≥2 data points)
    const tdee = calculateAdaptiveTDEE(smoothed, 14);
    if (tdee != null) {
      updates.currentTDEE = tdee;

      // Get latest trend weight
      const latestWeight = [...smoothed].reverse().find((l) => l.trendWeight != null)?.trendWeight;

      // 3. Dynamic goal rate based on goal_type and trend weight
      const goalType = ((profile as any)?.goal_type as GoalType) ?? 'sustainable_loss';
      const proteinPref = ((profile as any)?.protein_pref as ProteinPref) ?? 'moderate';
      const dietType = ((profile as any)?.diet_type as DietType) ?? 'balanced';
      const calorieDistribution = ((profile as any)?.calorie_distribution as CalorieDistribution) ?? 'stable';
      const trainingDays = ((profile as any)?.training_days_per_week as number) ?? 4;
      const dietStrategy = ((profile as any)?.diet_strategy as DietStrategy) ?? 'linear';

      const dynamicRate = latestWeight != null
        ? calculateDynamicGoalRate(goalType, latestWeight)
        : (profile?.goal_rate ?? -0.25);

      updates.dynamicGoalRate = dynamicRate;

      const targetCal = calculateTargetCalories(tdee, dynamicRate);
      updates.targetCalories = targetCal;

      // 4. Macros
      if (latestWeight != null) {
        updates.targetMacros = calculateTargetMacros(targetCal, latestWeight, proteinPref, dietType);

        // 5. Polarized distribution
        if (calorieDistribution === 'polarized') {
          const { trainingDayCal, restDayCal } = calculatePolarizedCalories(targetCal, trainingDays);
          updates.polarizedTargets = {
            trainingDay: {
              calories: trainingDayCal,
              macros: calculateTargetMacros(trainingDayCal, latestWeight, proteinPref, dietType),
            },
            restDay: {
              calories: restDayCal,
              macros: calculateTargetMacros(restDayCal, latestWeight, proteinPref, dietType),
            },
          };
        } else {
          updates.polarizedTargets = null;
        }

        // 6. Non-linear weekly plan
        updates.weeklyPlan = calculateWeeklyPlan({
          strategy: dietStrategy,
          tdee,
          goalRateKgPerWeek: dynamicRate,
          bodyWeightKg: latestWeight,
          proteinPref,
          dietType,
          profileCreatedAt: profile?.created_at,
        });
      }
    }

    set(updates as any);
  },

  // Full reset on logout
  logout: () => set({ ...initialState, isLoading: false }),
}));
