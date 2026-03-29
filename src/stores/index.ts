import { create } from 'zustand';
import type { Tables, TablesInsert, TablesUpdate, Enums } from '@/integrations/supabase/types';
import {
  calculateSmoothedWeight,
  calculateAdaptiveTDEE,
  calculateTargetCalories,
  calculateTargetMacros,
  type SmoothedLog,
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

    // 1. Smooth weights via EMA
    const smoothed = calculateSmoothedWeight(dailyLogs);
    const updates: Partial<AppState> = { smoothedLogs: smoothed };

    // 2. Adaptive TDEE (need ≥2 data points)
    const tdee = calculateAdaptiveTDEE(smoothed, 14);
    if (tdee != null) {
      updates.currentTDEE = tdee;

      // 3. Target calories from goal rate
      const goalRate = profile?.goal_rate ?? -0.25; // kg/week default
      const targetCal = calculateTargetCalories(tdee, goalRate);
      updates.targetCalories = targetCal;

      // 4. Target macros from latest trend weight
      const latestWeight = [...smoothed].reverse().find((l) => l.trendWeight != null)?.trendWeight;
      if (latestWeight != null) {
        updates.targetMacros = calculateTargetMacros(targetCal, latestWeight);
      }
    }

    set(updates as any);
  },

  // Full reset on logout
  logout: () => set({ ...initialState, isLoading: false }),
}));
