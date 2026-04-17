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

export interface AIMealPlan {
  dailyMeals: { name: string; description: string; estimatedMacros: string }[];
  groceryList: string[];
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
export async function generateMealPlanWithAI(
  targetCalories: number,
  protein: number,
  carbs: number,
  fats: number,
  dietType: string,
): Promise<AIMealPlan> {
  const { data, error } = await supabase.functions.invoke("ai-handler", {
    body: {
      action: "generate_meal_plan",
      payload: { targetCalories, protein, carbs, fats, dietType },
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
