export interface AIParsedMeal {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidenceScore: number;
}

/**
 * Mock AI meal parser. Returns dummy data after a simulated delay.
 * Will be replaced with actual Lovable AI integration.
 */
export async function parseMealWithAI(input: string | File): Promise<AIParsedMeal> {
  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 2500));

  // Mock responses based on input type
  if (input instanceof File) {
    return {
      foodName: "Petto di Pollo alla Griglia con Riso Basmati e Verdure",
      calories: 520,
      protein: 42,
      carbs: 55,
      fats: 12,
      confidenceScore: 87,
    };
  }

  const text = input.toLowerCase();

  if (text.includes("pizza")) {
    return {
      foodName: "Pizza Margherita (1 porzione)",
      calories: 680,
      protein: 24,
      carbs: 78,
      fats: 28,
      confidenceScore: 82,
    };
  }

  if (text.includes("insalata") || text.includes("salad")) {
    return {
      foodName: "Insalata di Pollo con Avocado",
      calories: 380,
      protein: 32,
      carbs: 15,
      fats: 22,
      confidenceScore: 79,
    };
  }

  if (text.includes("pasta")) {
    return {
      foodName: "Pasta al Pomodoro con Parmigiano",
      calories: 540,
      protein: 18,
      carbs: 72,
      fats: 16,
      confidenceScore: 85,
    };
  }

  // Default response
  return {
    foodName: "Petto di Pollo e Riso",
    calories: 450,
    protein: 40,
    carbs: 50,
    fats: 10,
    confidenceScore: 90,
  };
}
