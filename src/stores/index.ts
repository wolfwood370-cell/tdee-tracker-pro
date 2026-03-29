import { create } from 'zustand';
import type { Tables, TablesInsert, TablesUpdate, Enums } from '@/integrations/supabase/types';

// Re-export useful types
export type Profile = Tables<'profiles'>;
export type DailyMetric = Tables<'daily_metrics'>;
export type WeeklyAnalytic = Tables<'weekly_analytics'>;
export type AppRole = Enums<'app_role'>;
export type DailyMetricInsert = TablesInsert<'daily_metrics'>;
export type DailyMetricUpdate = TablesUpdate<'daily_metrics'>;
export type WeeklyAnalyticInsert = TablesInsert<'weekly_analytics'>;

// Auth slice
interface AuthSlice {
  user: { id: string; email: string; role: AppRole } | null;
  isLoading: boolean;
  setUser: (user: AuthSlice['user']) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

// Profile slice
interface ProfileSlice {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
}

// Logs slice
interface LogsSlice {
  logs: DailyMetric[];
  setLogs: (logs: DailyMetric[]) => void;
}

// Calculation slice
interface CalculationSlice {
  tdee: number | null;
  weeklyAnalytics: WeeklyAnalytic[];
  setTdee: (tdee: number | null) => void;
  setWeeklyAnalytics: (analytics: WeeklyAnalytic[]) => void;
}

export type AppState = AuthSlice & ProfileSlice & LogsSlice & CalculationSlice;

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, profile: null, logs: [], weeklyAnalytics: [], tdee: null }),

  // Profile
  profile: null,
  setProfile: (profile) => set({ profile }),

  // Logs
  logs: [],
  setLogs: (logs) => set({ logs }),

  // Calculation
  tdee: null,
  weeklyAnalytics: [],
  setTdee: (tdee) => set({ tdee }),
  setWeeklyAnalytics: (weeklyAnalytics) => set({ weeklyAnalytics }),
}));
