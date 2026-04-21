/**
 * Clinical Triage Compliance Engine
 * --------------------------------------------------
 * Calculates a 0-100 compliance score per client to drive the Coach Dashboard
 * triage view. The score is a weighted composite:
 *
 *   - Adherence  (40%): how close are logged calories to the day's target?
 *   - Consistency(40%): logged days vs planned days in current ISO week
 *   - Biofeedback(20%): penalties for high hunger / low sleep / low energy
 *
 * Status thresholds:
 *   - critical : score < 60   → 🔴 Intervento Urgente
 *   - warning  : 60 ≤ s ≤ 85  → 🟡 Monitorare
 *   - healthy  : score > 85   → 🟢 In Target
 */

import type { DailyMetric, Profile } from "@/stores";
import {
  DAY_KEYS,
  getWeekDates,
  getWeekStartISO,
  parseWeeklySchedule,
  type DayType,
  type WeeklySchedule,
} from "@/lib/weeklyBudget";

export type ComplianceStatus = "critical" | "warning" | "healthy" | "onboarding";

export interface ComplianceReasons {
  adherence: string;
  consistency: string;
  biofeedback: string;
}

export interface ComplianceResult {
  score: number; // 0..100
  status: ComplianceStatus;
  adherencePct: number; // 0..100, how close to target
  loggedDays: number;
  plannedDays: number;
  reasons: ComplianceReasons;
  /** Short human-readable reason for the badge tooltip. */
  primaryReason: string;
}

export interface BiofeedbackEntry {
  hunger_score: number;
  energy_score: number;
  sleep_score: number;
  performance_score: number;
  created_at: string;
}

/**
 * Targets per day-type. Provided by caller (computed from weeklyPlan).
 * Falls back to `default` if a specific type is missing.
 */
export interface DailyTargets {
  training?: number;
  rest?: number;
  refeed?: number;
  default: number; // safety net (e.g. linear plan kcal)
}

function statusFromScore(score: number): ComplianceStatus {
  if (score < 60) return "critical";
  if (score <= 85) return "warning";
  return "healthy";
}

function targetForDayType(targets: DailyTargets, type: DayType | null): number {
  if (type && targets[type] != null) return targets[type] as number;
  return targets.default;
}

/**
 * Resolve a day's planned type from the profile's weekly_schedule, given an ISO date.
 */
function dayTypeForDate(schedule: WeeklySchedule, isoDate: string): DayType {
  const d = new Date(isoDate + "T00:00:00");
  const idx = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
  return schedule[DAY_KEYS[idx]];
}

/**
 * ADHERENCE (0..100)
 * For each logged day in the current week, compare logged calories to the
 * target for that day's planned type. The deviation pct → adherence pct.
 *
 * Penalty applies when |logged - target| / target > 5%.
 * Linear decay: 0% deviation → 100, 50%+ deviation → 0.
 */
function calcAdherence(
  weekLogs: DailyMetric[],
  targets: DailyTargets,
  schedule: WeeklySchedule,
): { score: number; reason: string } {
  const logged = weekLogs.filter((l) => (l.calories ?? 0) > 0);
  if (logged.length === 0) {
    return { score: 0, reason: "Nessun pasto loggato questa settimana" };
  }

  let sumPct = 0;
  let worstDev = 0;
  let worstDate: string | null = null;

  for (const log of logged) {
    const dayType = dayTypeForDate(schedule, log.log_date);
    const target = targetForDayType(targets, dayType);
    if (target <= 0) {
      sumPct += 100;
      continue;
    }
    const dev = Math.abs((log.calories ?? 0) - target) / target;
    if (dev > worstDev) {
      worstDev = dev;
      worstDate = log.log_date;
    }
    if (dev <= 0.05) {
      sumPct += 100;
    } else {
      // Linear decay: dev=0.05 → 100, dev=0.50 → 0
      const score = Math.max(0, 100 - ((dev - 0.05) / 0.45) * 100);
      sumPct += score;
    }
  }

  const avg = Math.round(sumPct / logged.length);
  const reason =
    worstDev > 0.2 && worstDate
      ? `Scostamento ${Math.round(worstDev * 100)}% dal target il ${worstDate}`
      : `Aderenza media ${avg}%`;
  return { score: avg, reason };
}

/**
 * CONSISTENCY (0..100)
 * Ratio of logged days vs planned (non-rest? — we count ALL planned days as
 * loggable, since even rest days expect calorie logging).
 *
 * Planned days = elapsed days in current week (up to today, capped at 7).
 */
function calcConsistency(
  weekLogs: DailyMetric[],
  schedule: WeeklySchedule,
  now: Date = new Date(),
): { score: number; loggedDays: number; plannedDays: number; reason: string } {
  void schedule; // currently treat all 7 days as loggable
  const weekDates = getWeekDates(now);
  // Planned = days from Monday up to today (inclusive)
  const todayIso = weekDates[(now.getDay() + 6) % 7];
  const plannedDays = weekDates.indexOf(todayIso) + 1;

  const loggedSet = new Set(
    weekLogs
      .filter((l) => (l.calories ?? 0) > 0 || l.weight != null)
      .map((l) => l.log_date),
  );
  const loggedDays = weekDates.slice(0, plannedDays).filter((d) => loggedSet.has(d)).length;

  const score = plannedDays > 0 ? Math.round((loggedDays / plannedDays) * 100) : 100;
  const missed = plannedDays - loggedDays;
  const reason =
    missed >= 3
      ? `Mancato log da ${missed} giorni questa settimana`
      : `${loggedDays}/${plannedDays} giorni loggati`;

  return { score, loggedDays, plannedDays, reason };
}

/**
 * BIOFEEDBACK (0..100)
 * Penalty if last 2 entries show: hunger > 8 OR sleep < 5 OR energy < 4.
 * Each problematic entry = -25 points. Floor at 0.
 * Missing entries = neutral (100, no penalty).
 */
function calcBiofeedback(
  recentEntries: BiofeedbackEntry[],
): { score: number; reason: string } {
  if (recentEntries.length === 0) {
    return { score: 100, reason: "Nessun check-in recente" };
  }
  const last2 = recentEntries.slice(0, 2);
  let score = 100;
  const flags: string[] = [];
  for (const e of last2) {
    let entryFlag: string | null = null;
    if (e.hunger_score > 8) entryFlag = "fame eccessiva";
    else if (e.sleep_score < 5) entryFlag = "sonno scarso";
    else if (e.energy_score < 4) entryFlag = "energia bassa";
    if (entryFlag) {
      score -= 25;
      flags.push(entryFlag);
    }
  }
  score = Math.max(0, score);
  const reason =
    flags.length > 0
      ? `Biofeedback critico: ${[...new Set(flags)].join(", ")}`
      : "Biofeedback nella norma";
  return { score, reason };
}

/**
 * Main entry point: compute compliance for a client.
 *
 * @param dailyMetrics - all daily logs for the client (will be filtered to current week)
 * @param profile      - client profile (for weekly_schedule)
 * @param targets      - per-day-type calorie targets
 * @param biofeedback  - recent biofeedback_logs entries (most recent first)
 * @param now          - clock injection for tests
 */
export function calculateComplianceScore(
  dailyMetrics: DailyMetric[],
  profile: (Pick<Profile, "weekly_schedule"> & { created_at?: string | null }) | null,
  targets: DailyTargets,
  biofeedback: BiofeedbackEntry[] = [],
  now: Date = new Date(),
): ComplianceResult {
  const schedule = parseWeeklySchedule(profile?.weekly_schedule);
  const weekStart = getWeekStartISO(now);
  const weekDates = getWeekDates(now);
  const weekLogs = dailyMetrics.filter((l) => weekDates.includes(l.log_date));
  void weekStart;

  const adherence = calcAdherence(weekLogs, targets, schedule);
  const consistency = calcConsistency(weekLogs, schedule, now);
  const bio = calcBiofeedback(biofeedback);

  const score = Math.round(
    adherence.score * 0.4 + consistency.score * 0.4 + bio.score * 0.2,
  );

  // --- Onboarding Grace Period (Phase 95) ---
  // New clients (registered < 3 days ago) with zero logs are not yet evaluable.
  // Show a neutral "Nuovo / Onboarding" badge instead of a red critical alert.
  const allLoggedDates = dailyMetrics
    .filter((l) => (l.calories ?? 0) > 0 || l.weight != null)
    .map((l) => l.log_date)
    .sort()
    .reverse();

  const createdAtRaw = profile && "created_at" in profile ? profile.created_at : null;
  const createdAt = createdAtRaw ? new Date(createdAtRaw) : null;
  const daysSinceRegistration = createdAt
    ? Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  if (allLoggedDates.length === 0 && daysSinceRegistration < 3) {
    return {
      score: 0,
      status: "onboarding",
      adherencePct: 0,
      loggedDays: 0,
      plannedDays: consistency.plannedDays,
      reasons: {
        adherence: "In attesa dei primi log",
        consistency: "In attesa dei primi log",
        biofeedback: bio.reason,
      },
      primaryReason: "Cliente nuovo · onboarding in corso",
    };
  }

  // --- Critical Overrides (Phase 66 Triage Rules) ---
  // Hard-flag as critical regardless of weighted score when:
  //  a) No log (weight or meals) in the last 3 days
  //  b) Latest biofeedback shows severe stress (energy < 4 AND sleep < 5)
  let status = statusFromScore(score);
  let overrideReason: string | null = null;

  // Rule (a): inactivity ≥ 3 days
  if (allLoggedDates.length === 0) {
    status = "critical";
    overrideReason = "Nessun log registrato";
  } else {
    const last = new Date(allLoggedDates[0] + "T00:00:00");
    const daysSince = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= 3) {
      status = "critical";
      overrideReason = `Nessun log da ${daysSince} giorni`;
    }
  }

  // Rule (b): severe biofeedback stress
  const latestBio = biofeedback[0];
  if (latestBio && latestBio.energy_score < 4 && latestBio.sleep_score < 5) {
    status = "critical";
    overrideReason = overrideReason ?? "Stress severo: energia e sonno critici";
  }

  // Pick the worst-scoring component for the primary tooltip reason
  const ranked = [
    { key: "consistency" as const, score: consistency.score, reason: consistency.reason },
    { key: "adherence" as const, score: adherence.score, reason: adherence.reason },
    { key: "biofeedback" as const, score: bio.score, reason: bio.reason },
  ].sort((a, b) => a.score - b.score);

  return {
    score,
    status,
    adherencePct: adherence.score,
    loggedDays: consistency.loggedDays,
    plannedDays: consistency.plannedDays,
    reasons: {
      adherence: adherence.reason,
      consistency: consistency.reason,
      biofeedback: bio.reason,
    },
    primaryReason: overrideReason ?? ranked[0].reason,
  };
}

/**
 * Convenience: badge metadata for a status.
 */
export function statusBadgeMeta(status: ComplianceStatus): {
  label: string;
  emoji: string;
  className: string;
} {
  switch (status) {
    case "critical":
      return {
        label: "Intervento Urgente",
        emoji: "🔴",
        className: "bg-destructive text-destructive-foreground border-0",
      };
    case "warning":
      return {
        label: "Monitorare",
        emoji: "🟡",
        className: "bg-accent text-accent-foreground border-0",
      };
    case "healthy":
      return {
        label: "In Target",
        emoji: "🟢",
        className: "bg-primary text-primary-foreground border-0",
      };
    case "onboarding":
      return {
        label: "Nuovo / Onboarding",
        emoji: "🆕",
        className: "bg-muted text-muted-foreground border-0",
      };
  }
}
