import type { DailyMetric, Profile } from "@/stores";
import type { WeeklyPlan, DietStrategy } from "@/lib/algorithms";

export type DayType = "training" | "rest" | "refeed";

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
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? 6 : day - 1; // Monday-based
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
  return day === 0 ? 7 : day; // Mon=1..Sun=7
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
  const schedule = (profile?.training_schedule as boolean[] | null) ??
    [true, false, true, false, true, false, false];
  const trainingAllowed = schedule.filter(Boolean).length;
  const strategy = (profile?.diet_strategy as DietStrategy) ?? "linear";
  const refeedAllowed =
    strategy === "refeed_1_day" ? 1 : strategy === "refeed_2_days" ? 2 : 0;
  // Rest = remaining non-training, non-refeed slots
  const restAllowed = Math.max(0, 7 - trainingAllowed - refeedAllowed);
  return { trainingAllowed, restAllowed, refeedAllowed };
}

export interface WeeklyUsage {
  trainingUsed: number;
  restUsed: number;
  refeedUsed: number;
}

/**
 * Counts how many days of the current week have been explicitly tagged
 * with each dayType (via daily_metrics.day_type).
 */
export function getWeeklyUsage(
  dailyLogs: DailyMetric[],
  weekStart: string = getWeekStartISO(),
): WeeklyUsage {
  const weekDates = getWeekDates(new Date(weekStart));
  const inWeek = dailyLogs.filter((l) => weekDates.includes(l.log_date));
  const usage: WeeklyUsage = { trainingUsed: 0, restUsed: 0, refeedUsed: 0 };
  for (const l of inWeek) {
    const t = (l as DailyMetric & { day_type?: string | null }).day_type;
    if (t === "training") usage.trainingUsed++;
    else if (t === "rest") usage.restUsed++;
    else if (t === "refeed") usage.refeedUsed++;
  }
  return usage;
}

export interface WeeklyBudget {
  /** Sum of calories actually logged in days of the current week */
  consumedKcal: number;
  /** Total weekly target derived from the WeeklyPlan (or daily target × 7) */
  totalKcal: number;
  /** Pro-rated target up to today (avoids false "all green" mid-week) */
  expectedSoFarKcal: number;
  /** consumed / total ratio (0-1+) */
  ratio: number;
  /** Predicted overrun in kcal if the user proceeds with `pendingType` today */
  pendingOverrunKcal: number | null;
}

/**
 * Returns weekly caloric budget vs. consumed for the current week.
 * If `pendingType` is provided, it estimates the overrun delta vs. choosing a normal day.
 */
export function getWeeklyRemainingBudget(
  profile: Profile | null,
  dailyLogs: DailyMetric[],
  weeklyPlan: WeeklyPlan | null,
  todayTarget: number | null,
  pendingType?: DayType | null,
): WeeklyBudget {
  const weekDates = getWeekDates();
  const weekLogs = dailyLogs.filter((l) => weekDates.includes(l.log_date));
  const consumedKcal = weekLogs.reduce(
    (s, l) => s + (l.calories ?? 0),
    0,
  );

  const totalKcal = weeklyPlan?.weeklyTotal ?? (todayTarget ? todayTarget * 7 : 0);
  const elapsed = daysElapsedInWeek();
  const expectedSoFarKcal = Math.round((totalKcal * elapsed) / 7);

  // Estimate overrun based on slot usage
  let pendingOverrunKcal: number | null = null;
  if (pendingType === "refeed") {
    const slots = getWeeklySlots(profile);
    const usage = getWeeklyUsage(dailyLogs);
    if (usage.refeedUsed >= slots.refeedAllowed) {
      const refeedDay = weeklyPlan?.days.find((d) => d.isRefeed);
      const restDay = weeklyPlan?.days.find((d) => !d.isRefeed);
      const delta =
        (refeedDay?.calories ?? 0) - (restDay?.calories ?? 0);
      pendingOverrunKcal = Math.max(0, delta);
    } else {
      pendingOverrunKcal = 0;
    }
  }

  const ratio = totalKcal > 0 ? consumedKcal / totalKcal : 0;

  return { consumedKcal, totalKcal, expectedSoFarKcal, ratio, pendingOverrunKcal };
}

/**
 * Estimates the kcal delta on the WEEKLY budget when forcing an extra
 * day of `newType` (replacing what would otherwise be the default day).
 * Positive = surplus (slows fat loss). Negative = deficit (risk of LBM loss).
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

