import type { DailyMetric, Profile } from "@/stores";
import type { WeeklyPlan, DietStrategy } from "@/lib/algorithms";

export type DayType = "training" | "rest" | "refeed";

/** Day keys used in profiles.weekly_schedule (Monday-first). */
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABELS_IT: Record<DayKey, string> = {
  mon: "Lunedì",
  tue: "Martedì",
  wed: "Mercoledì",
  thu: "Giovedì",
  fri: "Venerdì",
  sat: "Sabato",
  sun: "Domenica",
};

export type WeeklySchedule = Record<DayKey, DayType>;

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  mon: "rest",
  tue: "rest",
  wed: "rest",
  thu: "rest",
  fri: "rest",
  sat: "rest",
  sun: "rest",
};

/**
 * Coerce arbitrary JSON into a fully-typed WeeklySchedule.
 * Falls back to "rest" for missing/invalid keys.
 */
export function parseWeeklySchedule(raw: unknown): WeeklySchedule {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const valid: DayType[] = ["training", "rest", "refeed"];
  const out = { ...DEFAULT_WEEKLY_SCHEDULE };
  for (const k of DAY_KEYS) {
    const v = obj[k];
    if (typeof v === "string" && (valid as string[]).includes(v)) {
      out[k] = v as DayType;
    }
  }
  return out;
}

/** Returns the DayKey for a given JS Date (Monday-first). */
export function getDayKey(d: Date = new Date()): DayKey {
  const idx = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
  return DAY_KEYS[idx];
}

/**
 * Returns local YYYY-MM-DD for a given Date (timezone-safe, unlike toISOString).
 */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Computes the ISO week (Monday → Sunday) start date for a given date.
 * Returns local ISO date string (YYYY-MM-DD).
 */
export function getWeekStartISO(d: Date = new Date()): string {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return toLocalISODate(date);
}

/**
 * Returns the 7 ISO date strings (Mon-Sun) of the week containing `d`.
 */
export function getWeekDates(d: Date = new Date()): string[] {
  const start = new Date(getWeekStartISO(d));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return toLocalISODate(x);
  });
}

/** How many days of the current week have already elapsed (1..7, including today). */
export function daysElapsedInWeek(now: Date = new Date()): number {
  const day = now.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Allowed slots per week, based on profile diet strategy and training schedule.
 */
export interface WeeklySlots {
  trainingAllowed: number;
  restAllowed: number;
  refeedAllowed: number;
}

export function getWeeklySlots(profile: Profile | null): WeeklySlots {
  // Phase 53: trainingAllowed comes from profile.training_days_per_week (the user's
  // declared weekly training capacity), NOT from training_schedule (legacy boolean
  // array kept only for backward compatibility). weekly_schedule is the assignment.
  const trainingAllowed = Math.max(0, Math.min(7, profile?.training_days_per_week ?? 4));
  const strategy = (profile?.diet_strategy as DietStrategy) ?? "linear";
  const refeedAllowed =
    strategy === "refeed_1_day" ? 1 : strategy === "refeed_2_days" ? 2 : 0;
  const restAllowed = Math.max(0, 7 - trainingAllowed - refeedAllowed);
  return { trainingAllowed, restAllowed, refeedAllowed };
}

export interface WeeklyUsage {
  trainingUsed: number;
  restUsed: number;
  refeedUsed: number;
}

/**
 * Counts how many days of the week are assigned to each type
 * in the user's planned `weekly_schedule` (the Strategy).
 *
 * Phase 53: source of truth is profile.weekly_schedule, NOT daily_metrics.day_type.
 */
export function getWeeklyUsage(schedule: WeeklySchedule): WeeklyUsage {
  const usage: WeeklyUsage = { trainingUsed: 0, restUsed: 0, refeedUsed: 0 };
  for (const k of DAY_KEYS) {
    const t = schedule[k];
    if (t === "training") usage.trainingUsed++;
    else if (t === "rest") usage.restUsed++;
    else if (t === "refeed") usage.refeedUsed++;
  }
  return usage;
}

export interface WeeklyBudget {
  consumedKcal: number;
  totalKcal: number;
  expectedSoFarKcal: number;
  ratio: number;
  pendingOverrunKcal: number | null;
}

/**
 * Returns weekly caloric budget vs. consumed for the current week.
 */
export function getWeeklyRemainingBudget(
  dailyLogs: DailyMetric[],
  weeklyPlan: WeeklyPlan | null,
  todayTarget: number | null,
): WeeklyBudget {
  const weekDates = getWeekDates();
  const weekLogs = dailyLogs.filter((l) => weekDates.includes(l.log_date));
  const consumedKcal = weekLogs.reduce((s, l) => s + (l.calories ?? 0), 0);

  const totalKcal = weeklyPlan?.weeklyTotal ?? (todayTarget ? todayTarget * 7 : 0);
  const elapsed = daysElapsedInWeek();
  const expectedSoFarKcal = Math.round((totalKcal * elapsed) / 7);
  const ratio = totalKcal > 0 ? consumedKcal / totalKcal : 0;

  return { consumedKcal, totalKcal, expectedSoFarKcal, ratio, pendingOverrunKcal: null };
}

/**
 * Estimates the kcal delta on the WEEKLY budget when forcing an extra
 * day of `newType`.
 */
export function estimateExtraDayDelta(
  newType: DayType,
  weeklyPlan: WeeklyPlan | null,
  todayTarget: number | null,
): number {
  if (!weeklyPlan) {
    const base = todayTarget ?? 0;
    if (newType === "refeed") return Math.round(base * 0.25);
    if (newType === "rest") return -Math.round(base * 0.15);
    return 0;
  }
  const refeedDay = weeklyPlan.days.find((d) => d.isRefeed);
  const restDay = weeklyPlan.days.find((d) => !d.isRefeed && d.calories > 0);
  const trainingDay = weeklyPlan.days.reduce(
    (max, d) => (!d.isRefeed && d.calories > (max?.calories ?? 0) ? d : max),
    undefined as typeof weeklyPlan.days[number] | undefined,
  );
  const baseline = todayTarget ?? Math.round(weeklyPlan.weeklyTotal / 7);

  if (newType === "refeed") {
    const refeedCal = refeedDay?.calories ?? Math.round(baseline * 1.25);
    return Math.max(0, refeedCal - baseline);
  }
  if (newType === "rest") {
    const restCal = restDay?.calories ?? Math.round(baseline * 0.9);
    const trainingCal = trainingDay?.calories ?? baseline;
    return -Math.max(0, trainingCal - restCal);
  }
  return 0;
}
