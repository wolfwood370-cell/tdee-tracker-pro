import { create } from 'zustand';
import type { Tables, TablesInsert, TablesUpdate, Enums } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
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
  computeWeeklyTargetSnapshot,
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
  type WeeklyTargetSnapshot,
} from '@/lib/algorithms';
import { toLocalISODate, getWeekStartISO } from '@/lib/weeklyBudget';

// Re-export useful types
export type Profile = Tables<'profiles'>;
export type DailyMetric = Tables<'daily_metrics'>;
export type WeeklyAnalytic = Tables<'weekly_analytics'>;
export type WeeklyTarget = Tables<'weekly_targets'>;
export type AppRole = Enums<'app_role'>;
export type DailyMetricInsert = TablesInsert<'daily_metrics'>;
export type DailyMetricUpdate = TablesUpdate<'daily_metrics'>;
export type WeeklyAnalyticInsert = TablesInsert<'weekly_analytics'>;
export type WeeklyTargetInsert = TablesInsert<'weekly_targets'>;

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

// --- Weekly Targets Slice ---
interface WeeklyTargetsSlice {
  weeklyTargets: WeeklyTarget[];
  currentWeekTarget: WeeklyTarget | null;
  setWeeklyTargets: (targets: WeeklyTarget[]) => void;
  loadWeeklyTargets: () => Promise<void>;
  /** Ensures a snapshot exists for the current ISO week. Creates one if missing. */
  ensureCurrentWeekTarget: () => Promise<WeeklyTarget | null>;
  /** Forces a fresh snapshot for the current week (deletes & recreates). */
  forceRecalculateWeeklyTarget: (reason?: 'manual' | 'strategy_change' | 'weekly') => Promise<WeeklyTarget | null>;
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

export type AppState = AuthSlice & ProfileSlice & LogsSlice & CalculationSlice & WeeklyTargetsSlice & {
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
  // Weekly targets
  weeklyTargets: [] as WeeklyTarget[],
  currentWeekTarget: null as WeeklyTarget | null,
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

// Helper: compute age in years from ISO birth date.
function computeAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const bd = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) {
    age--;
  }
  return age;
}

// Detects if any field that should invalidate the weekly snapshot has changed.
function strategyChanged(prev: Profile | null, next: Profile | null): boolean {
  if (!prev || !next) return false;
  return (
    prev.goal_type !== next.goal_type ||
    prev.diet_strategy !== next.diet_strategy ||
    prev.calorie_distribution !== next.calorie_distribution ||
    prev.manual_override_active !== next.manual_override_active ||
    prev.goal_rate !== next.goal_rate ||
    prev.protein_pref !== next.protein_pref ||
    prev.diet_type !== next.diet_type
  );
}

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  // Auth actions
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  // Profile actions
  setProfile: (profile) => {
    const previousProfile = get().profile;
    set({ profile, isLoadingProfile: false });

    // Invalidate weekly snapshot if strategy/goal changed mid-week.
    if (profile && previousProfile && strategyChanged(previousProfile, profile)) {
      // Fire-and-forget: regenerate the frozen snapshot then recalc.
      void get().forceRecalculateWeeklyTarget('strategy_change').then(() => {
        get().recalculateMetrics();
      });
    } else {
      get().recalculateMetrics();
      // Make sure the current week always has a snapshot (covers fresh logins).
      void get().ensureCurrentWeekTarget().then((created) => {
        if (created) get().recalculateMetrics();
      });
    }
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

  // Weekly targets actions
  setWeeklyTargets: (weeklyTargets) => {
    const weekStart = getWeekStartISO();
    const currentWeekTarget = weeklyTargets.find((t) => t.week_start_date === weekStart) ?? null;
    set({ weeklyTargets, currentWeekTarget });
  },

  loadWeeklyTargets: async () => {
    const { user } = get();
    if (!user) return;
    const { data, error } = await supabase
      .from('weekly_targets')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start_date', { ascending: false })
      .limit(52);
    if (error) {
      console.error('loadWeeklyTargets error:', error);
      return;
    }
    get().setWeeklyTargets((data ?? []) as WeeklyTarget[]);
    get().recalculateMetrics();
  },

  ensureCurrentWeekTarget: async () => {
    const { user, profile, currentWeekTarget } = get();
    if (!user || !profile || profile.manual_override_active) return null;
    if (currentWeekTarget) return currentWeekTarget;
    return await get().forceRecalculateWeeklyTarget('weekly');
  },

  forceRecalculateWeeklyTarget: async (reason = 'manual') => {
    const { user, profile, dailyLogs } = get();
    if (!user || !profile) return null;

    // Manual override: do not freeze automatic targets.
    if (profile.manual_override_active) return null;

    const smoothed = calculateSmoothedWeight(dailyLogs);
    const bia = extractLatestBIA(dailyLogs);
    const age = computeAge(profile.birth_date);

    const latestLogSorted = [...dailyLogs].sort(
      (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
    );
    const trackCycle = profile.track_menstrual_cycle === true;
    const menstrualPhase: MenstrualPhase | null = trackCycle
      ? (latestLogSorted[0]?.menstrual_phase as MenstrualPhase | null) ?? null
      : null;

    const snapshot: WeeklyTargetSnapshot | null = computeWeeklyTargetSnapshot({
      smoothedLogs: smoothed,
      bia,
      profile: {
        activity_level: profile.activity_level,
        sex: profile.sex,
        height_cm: profile.height_cm,
        age,
        goal_type: (profile.goal_type as GoalType) ?? 'sustainable_loss',
        goal_rate: profile.goal_rate,
        diet_strategy: (profile.diet_strategy as DietStrategy) ?? 'linear',
        diet_type: (profile.diet_type as DietType) ?? 'balanced',
        protein_pref: (profile.protein_pref as ProteinPref) ?? 'moderate',
        calorie_distribution: (profile.calorie_distribution as CalorieDistribution) ?? 'stable',
        created_at: profile.created_at,
        menstrualPhase,
      },
    });

    if (!snapshot) return null;

    const week_start_date = getWeekStartISO();
    const payload: WeeklyTargetInsert = {
      user_id: user.id,
      week_start_date,
      frozen_tdee: snapshot.frozen_tdee,
      target_calories: snapshot.target_calories,
      target_protein: snapshot.target_protein,
      target_carbs: snapshot.target_carbs,
      target_fats: snapshot.target_fats,
      goal_rate: snapshot.goal_rate,
      goal_type: snapshot.goal_type,
      diet_strategy: snapshot.diet_strategy,
      calorie_distribution: snapshot.calorie_distribution,
      snapshot_reason: reason,
    };

    const { data, error } = await supabase
      .from('weekly_targets')
      .upsert(payload, { onConflict: 'user_id,week_start_date' })
      .select()
      .single();

    if (error) {
      console.error('forceRecalculateWeeklyTarget upsert error:', error);
      return null;
    }

    const created = data as WeeklyTarget;
    set((state) => {
      const others = state.weeklyTargets.filter((t) => t.week_start_date !== created.week_start_date);
      return {
        weeklyTargets: [created, ...others].sort(
          (a, b) => b.week_start_date.localeCompare(a.week_start_date)
        ),
        currentWeekTarget: created,
      };
    });
    get().recalculateMetrics();
    return created;
  },

  // Calculations actions
  setCalculations: (tdee, calories, macros) =>
    set({ currentTDEE: tdee, targetCalories: calories, targetMacros: macros }),
  setWeeklyAnalytics: (weeklyAnalytics) => set({ weeklyAnalytics }),

  recalculateMetrics: () => {
    const { dailyLogs, profile, currentWeekTarget } = get();

    // --- Manual Override: bypass macro calculations but keep other fields ---
    if (profile?.manual_override_active) {
      const manualCal = profile.manual_calories;
      const manualP = profile.manual_protein;
      const manualF = profile.manual_fats;
      const manualC = profile.manual_carbs;

      const smoothed = calculateSmoothedWeight(dailyLogs);
      const tdee = calculateAdaptiveTDEE(smoothed, 14);

      const age = computeAge(profile.birth_date);

      // Menstrual phase
      const latestLogSorted = [...dailyLogs].sort(
        (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
      );
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

    // 1. Smooth weights via EMA (always — needed for trends, ETA, BIA, etc.)
    const smoothed = calculateSmoothedWeight(dailyLogs);
    const updates: Partial<AppState> = {
      smoothedLogs: smoothed,
      usingBIAData: false,
      catabolismRisk: null,
      activeMenstrualPhase: null,
      goalETA: null,
    };

    const bia = extractLatestBIA(dailyLogs);
    const activityMultiplier = profile?.activity_level ?? 1.2;
    const lbm = bia ? calculateLBM(bia) : null;
    const profileSex = profile?.sex ?? null;
    const age = computeAge(profile?.birth_date);

    // 2. TDEE for DISPLAY: still adaptive on the fly (so trend cards stay live).
    //    Targets, however, come from the FROZEN weekly snapshot when available.
    const phaseStart = profile?.created_at ?? null;
    const adaptiveTDEE = calculateAdaptiveTDEE(smoothed, 14, phaseStart);
    const latestWeight = [...smoothed].reverse().find((l) => l.trendWeight != null)?.trendWeight;
    const baselineTDEE = calculateBaselineTDEE(
      bia,
      activityMultiplier,
      latestWeight ?? undefined,
      profileSex,
      profile?.height_cm ?? null,
      age,
    );
    const liveTDEE = adaptiveTDEE ?? baselineTDEE;

    if (liveTDEE != null) {
      const goalType = (profile?.goal_type as GoalType) ?? 'sustainable_loss';
      const proteinPref = (profile?.protein_pref as ProteinPref) ?? 'moderate';
      const dietType = (profile?.diet_type as DietType) ?? 'balanced';
      const calorieDistribution = (profile?.calorie_distribution as CalorieDistribution) ?? 'stable';
      const weeklyScheduleRaw = (profile as { weekly_schedule?: Record<string, string> } | null)?.weekly_schedule;
      const scheduledTrainingDays = weeklyScheduleRaw
        ? Object.values(weeklyScheduleRaw).filter((v) => v === 'training').length
        : 0;
      const trainingDays = calorieDistribution === 'polarized'
        ? (scheduledTrainingDays > 0 ? scheduledTrainingDays : (profile?.training_days_per_week ?? 4))
        : profile?.training_days_per_week ?? 4;
      const dietStrategy = (profile?.diet_strategy as DietStrategy) ?? 'linear';

      const bfmKg = bia?.bfm ?? (bia?.pbf != null && latestWeight ? latestWeight * bia.pbf / 100 : null);

      // Live "for-display" dynamic goal rate (used by goal ETA, catabolism risk).
      const liveDynamicRate = latestWeight != null
        ? calculateDynamicGoalRate(goalType, latestWeight, bfmKg, lbm, profileSex)
        : (profile?.goal_rate ?? -0.25);

      // Goal ETA always uses live data (predictive, not frozen).
      const profileTargetWeight = profile?.target_weight ?? null;
      if (latestWeight != null) {
        updates.goalETA = calculateGoalETA(latestWeight, profileTargetWeight, liveDynamicRate, goalType);
      }

      // Determine active menstrual phase from latest log
      const latestLogSorted = [...dailyLogs].sort(
        (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
      );
      const trackCycle = profile?.track_menstrual_cycle === true;
      const currentMenstrualPhase: MenstrualPhase | null = trackCycle
        ? (latestLogSorted[0]?.menstrual_phase as MenstrualPhase | null) ?? null
        : null;
      updates.activeMenstrualPhase = currentMenstrualPhase;
      updates.userAge = age;

      // ─── FROZEN WEEKLY TARGET (single source of truth for the week) ───
      // If a snapshot exists for the current week, USE IT for targetCalories/macros.
      // Otherwise compute live values (same as before) and let
      // ensureCurrentWeekTarget() persist them asynchronously.
      let displayedTDEE = liveTDEE;
      let targetCal: number;
      let targetMacrosResult: { macros: TargetMacros; tefDelta: number };
      let frozenDynamicRate = liveDynamicRate;

      if (currentWeekTarget) {
        displayedTDEE = currentWeekTarget.frozen_tdee;
        targetCal = currentWeekTarget.target_calories;
        targetMacrosResult = {
          macros: {
            protein: Number(currentWeekTarget.target_protein),
            carbs: Number(currentWeekTarget.target_carbs),
            fats: Number(currentWeekTarget.target_fats),
          },
          tefDelta: 0,
        };
        if (currentWeekTarget.goal_rate != null) {
          frozenDynamicRate = Number(currentWeekTarget.goal_rate);
        }
      } else {
        // Diet Break Override only applies in live (un-frozen) mode.
        targetCal = calculateTargetCalories(liveTDEE, liveDynamicRate, currentMenstrualPhase);
        const dietBreakUntil = profile?.diet_break_until;
        const isDietBreakActive = dietBreakUntil
          && new Date(dietBreakUntil) >= new Date(toLocalISODate(new Date()));
        if (isDietBreakActive) targetCal = liveTDEE;

        if (latestWeight == null) {
          // Not enough data — bail out with what we have.
          updates.currentTDEE = liveTDEE;
          updates.dynamicGoalRate = liveDynamicRate;
          updates.targetCalories = targetCal;
          set(updates);
          return;
        }
        const useBIA = lbm != null && lbm > 0;
        targetMacrosResult = calculateTargetMacros(
          targetCal, latestWeight, proteinPref, dietType,
          useBIA ? lbm : undefined, age,
        );
      }

      updates.currentTDEE = displayedTDEE;
      updates.dynamicGoalRate = frozenDynamicRate;
      updates.targetCalories = targetCal;
      updates.targetMacros = targetMacrosResult.macros;
      updates.tefDelta = targetMacrosResult.tefDelta;

      if (latestWeight != null) {
        const useBIA = lbm != null && lbm > 0;
        updates.usingBIAData = useBIA;

        // Catabolism risk uses the FROZEN target (matches what the user is eating against).
        updates.catabolismRisk = checkCatabolismRisk(
          displayedTDEE, targetCal, bfmKg, latestWeight, profileSex,
        );

        // Polarized distribution — recomputed on top of frozen baseline (flexible schedule).
        if (calorieDistribution === 'polarized') {
          const { trainingDayCal, restDayCal } = calculatePolarizedCalories(targetCal, trainingDays);
          updates.polarizedTargets = {
            trainingDay: {
              calories: trainingDayCal,
              macros: calculateTargetMacros(
                trainingDayCal, latestWeight, proteinPref, dietType, useBIA ? lbm : undefined, age,
              ).macros,
            },
            restDay: {
              calories: restDayCal,
              macros: calculateTargetMacros(
                restDayCal, latestWeight, proteinPref, dietType, useBIA ? lbm : undefined, age,
              ).macros,
            },
          };
        } else {
          updates.polarizedTargets = null;
        }

        // Non-linear weekly plan — uses frozen TDEE + frozen rate for stability.
        updates.weeklyPlan = calculateWeeklyPlan({
          strategy: dietStrategy,
          tdee: displayedTDEE,
          goalRateKgPerWeek: frozenDynamicRate,
          bodyWeightKg: latestWeight,
          proteinPref,
          dietType,
          profileCreatedAt: profile?.created_at,
          strategyStartDate: (profile as { strategy_start_date?: string | null } | null)?.strategy_start_date ?? null,
          lbmKg: useBIA ? lbm : undefined,
        });
      }
    }

    set(updates);
  },

  // Full reset on logout
  logout: () => set({ ...initialState, isLoading: false }),
}));
