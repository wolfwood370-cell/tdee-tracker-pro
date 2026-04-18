/**
 * Phase 61 — Meals Log helper utilities.
 *
 * The `meals_log` JSONB column on `daily_metrics` stores every individual
 * meal entry as a discrete object. Aggregate columns (calories/protein/...)
 * are ALWAYS derived as a perfect sum of the array, so adding/removing
 * entries keeps totals in sync.
 */
export type MealSource = "ai" | "vault" | "manual";

export interface MealEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
  source: MealSource;
  timestamp: string; // ISO string
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function parseMealsLog(raw: unknown): MealEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((m): m is MealEntry =>
    !!m && typeof m === "object" && typeof (m as MealEntry).id === "string",
  );
}

export function sumMealsLog(meals: MealEntry[]) {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (Number(m.calories) || 0),
      protein: acc.protein + (Number(m.protein) || 0),
      carbs: acc.carbs + (Number(m.carbs) || 0),
      fats: acc.fats + (Number(m.fats) || 0),
      fiber: acc.fiber + (Number(m.fiber) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 },
  );
}

export function aggregatesFromMeals(meals: MealEntry[]) {
  const s = sumMealsLog(meals);
  return {
    calories: Math.round(s.calories),
    protein: round1(s.protein),
    carbs: round1(s.carbs),
    fats: round1(s.fats),
    fiber: round1(s.fiber),
  };
}

export function newMealId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
