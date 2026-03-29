import { create } from 'zustand';

// Auth slice
interface AuthSlice {
  user: { id: string; email: string; role: 'coach' | 'client' } | null;
  isLoading: boolean;
  setUser: (user: AuthSlice['user']) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

// Profile slice (placeholder for future)
interface ProfileSlice {
  profile: Record<string, unknown> | null;
  setProfile: (profile: Record<string, unknown> | null) => void;
}

// Logs slice (placeholder for future)
interface LogsSlice {
  logs: unknown[];
  setLogs: (logs: unknown[]) => void;
}

// Calculation slice (placeholder for future)
interface CalculationSlice {
  tdee: number | null;
  setTdee: (tdee: number | null) => void;
}

export type AppState = AuthSlice & ProfileSlice & LogsSlice & CalculationSlice;

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null }),

  // Profile
  profile: null,
  setProfile: (profile) => set({ profile }),

  // Logs
  logs: [],
  setLogs: (logs) => set({ logs }),

  // Calculation
  tdee: null,
  setTdee: (tdee) => set({ tdee }),
}));
