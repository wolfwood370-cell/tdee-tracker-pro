import { supabase } from "@/integrations/supabase/client";

export interface AIParsedMeal {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidenceScore: number;
  qualityScore: number;
  qualityFeedback: string;
}

export interface AICheckInSummary {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'burnout_risk';
  suggestedAction: string;
  magicReplyDraft: string;
}

export interface AIMeal {
  type: string;
  name: string;
  description: string;
  macros: string;
}

export interface AIMealPlan {
  meals: AIMeal[];
  groceryList: {
    category: string;
    items: string[];
  }[];
}

export interface MealPlanOptions {
  targetCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  dietType: string;
  numMeals?: number;
  fridgeItems?: string;
  dietaryPreference?: string;
  allergies?: string;
}

export interface ReplaceMealOptions {
  mealType: string;
  targetMacros: string;
  dietType: string;
  dietaryPreference?: string;
  allergies?: string;
  fridgeItems?: string;
}

/**
 * Convert a File to base64 string for vision model input.
 */
async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * AI-powered meal parser using Lovable AI Gateway.
 */
export async function parseMealWithAI(input: string | File): Promise<AIParsedMeal> {
  const payload: Record<string, string> = {};

  if (input instanceof File) {
    const { base64, mimeType } = await fileToBase64(input);
    payload.imageBase64 = base64;
    payload.mimeType = mimeType;
  } else {
    payload.text = input;
  }

  const { data, error } = await supabase.functions.invoke("ai-handler", {
    body: { action: "parse_meal", payload },
  });

  if (error) {
    console.error("parseMealWithAI error:", error);
    throw new Error("Servizio AI temporaneamente non disponibile");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.data as AIParsedMeal;
}

/**
 * AI Coach Copilot analysis using Lovable AI Gateway.
 */
export async function analyzeClientCheckIn(
  clientData: Record<string, unknown>,
  recentLogs: Array<Record<string, unknown>>,
): Promise<AICheckInSummary> {
  const { data, error } = await supabase.functions.invoke("ai-handler", {
    body: {
      action: "analyze_checkin",
      payload: { clientData, recentLogs },
    },
  });

  if (error) {
    console.error("analyzeClientCheckIn error:", error);
    throw new Error("Servizio AI temporaneamente non disponibile");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.data as AICheckInSummary;
}

/**
 * AI Meal Plan generator using Lovable AI Gateway.
 */
export async function generateMealPlanWithAI(opts: MealPlanOptions): Promise<AIMealPlan> {
  const { data, error } = await supabase.functions.invoke("ai-handler", {
    body: {
      action: "generate_meal_plan",
      payload: {
        targetCalories: opts.targetCalories,
        protein: opts.protein,
        carbs: opts.carbs,
        fats: opts.fats,
        dietType: opts.dietType,
        numMeals: opts.numMeals ?? 4,
        fridgeItems: opts.fridgeItems ?? "",
        dietaryPreference: opts.dietaryPreference ?? "onnivoro",
        allergies: opts.allergies ?? "",
      },
    },
  });

  if (error) {
    console.error("generateMealPlanWithAI error:", error);
    throw new Error("Servizio AI temporaneamente non disponibile");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.data as AIMealPlan;
}

/**
 * Regenerate a single meal preserving target macros.
 */
export async function replaceMealWithAI(opts: ReplaceMealOptions): Promise<AIMeal> {
  const { data, error } = await supabase.functions.invoke("ai-handler", {
    body: {
      action: "replace_meal",
      payload: {
        mealType: opts.mealType,
        targetMacros: opts.targetMacros,
        dietType: opts.dietType,
        dietaryPreference: opts.dietaryPreference ?? "onnivoro",
        allergies: opts.allergies ?? "",
        fridgeItems: opts.fridgeItems ?? "",
      },
    },
  });

  if (error) {
    console.error("replaceMealWithAI error:", error);
    throw new Error("Servizio AI temporaneamente non disponibile");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.data as AIMeal;
}

/**
 * Generate a monthly progress report draft for a client (Coach side, AI-assisted).
 */
export interface MonthlyMetricsSummary {
  avgWeight: number | null;
  weightDelta: number | null;
  avgCalories: number | null;
  compliancePct: number | null;
  trainingDaysLogged: number | null;
  daysLogged: number;
}

export async function generateMonthlyReportDraft(
  clientName: string,
  metricsSummary: MonthlyMetricsSummary,
  checkinNotes: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("ai-handler", {
    body: {
      action: "generate_monthly_report",
      payload: { clientName, metricsSummary, checkinNotes },
    },
  });

  if (error) {
    console.error("generateMonthlyReportDraft error:", error);
    throw new Error("Servizio AI temporaneamente non disponibile");
  }
  if (data?.error) throw new Error(data.error);

  const result = data?.data as { reportText?: string } | string | undefined;
  if (typeof result === "string") return result;
  return result?.reportText ?? "";
}
