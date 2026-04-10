export interface AIParsedMeal {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidenceScore: number;
}

export interface AICheckInSummary {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'burnout_risk';
  suggestedAction: string;
  magicReplyDraft: string;
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

// --- AI Meal Plan Generator ---

export interface AIMealPlan {
  dailyMeals: { name: string; description: string; estimatedMacros: string }[];
  groceryList: string[];
}

/**
 * Mock AI meal plan generator. Returns dummy data after a simulated delay.
 * Will be replaced with actual Lovable AI integration.
 */
export async function generateMealPlanWithAI(
  targetCalories: number,
  protein: number,
  carbs: number,
  fats: number,
  dietType: string,
): Promise<AIMealPlan> {
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const isKeto = dietType === "keto";
  const isLowCarb = dietType === "low_carb";

  if (isKeto) {
    return {
      dailyMeals: [
        { name: "🥑 Colazione: Uova e Avocado", description: "3 uova strapazzate con mezzo avocado e formaggio cremoso", estimatedMacros: `${Math.round(targetCalories * 0.3)} kcal | ${Math.round(protein * 0.3)}P | ${Math.round(carbs * 0.2)}C | ${Math.round(fats * 0.35)}F` },
        { name: "🥩 Pranzo: Salmone e Verdure al Burro", description: "Filetto di salmone con broccoli e cavolfiore saltati nel burro", estimatedMacros: `${Math.round(targetCalories * 0.4)} kcal | ${Math.round(protein * 0.4)}P | ${Math.round(carbs * 0.3)}C | ${Math.round(fats * 0.35)}F` },
        { name: "🥗 Cena: Insalata di Pollo con Noci", description: "Petto di pollo grigliato su insalata con noci, olio EVO e parmigiano", estimatedMacros: `${Math.round(targetCalories * 0.3)} kcal | ${Math.round(protein * 0.3)}P | ${Math.round(carbs * 0.5)}C | ${Math.round(fats * 0.3)}F` },
      ],
      groceryList: ["Uova (12 pz)", "Avocado (3 pz)", "Salmone fresco (400g)", "Broccoli (500g)", "Petto di pollo (500g)", "Noci (100g)", "Olio EVO", "Parmigiano Reggiano", "Burro"],
    };
  }

  if (isLowCarb) {
    return {
      dailyMeals: [
        { name: "🍳 Colazione: Frittata di Verdure", description: "Frittata con zucchine, peperoni e formaggio di capra", estimatedMacros: `${Math.round(targetCalories * 0.3)} kcal | ${Math.round(protein * 0.3)}P | ${Math.round(carbs * 0.25)}C | ${Math.round(fats * 0.3)}F` },
        { name: "🍗 Pranzo: Pollo alla Griglia e Verdure", description: "Petto di pollo con insalata mista, pomodorini e olio EVO", estimatedMacros: `${Math.round(targetCalories * 0.4)} kcal | ${Math.round(protein * 0.4)}P | ${Math.round(carbs * 0.35)}C | ${Math.round(fats * 0.35)}F` },
        { name: "🐟 Cena: Merluzzo con Asparagi", description: "Merluzzo al forno con asparagi e limone", estimatedMacros: `${Math.round(targetCalories * 0.3)} kcal | ${Math.round(protein * 0.3)}P | ${Math.round(carbs * 0.4)}C | ${Math.round(fats * 0.35)}F` },
      ],
      groceryList: ["Uova (6 pz)", "Zucchine (3 pz)", "Peperoni (2 pz)", "Petto di pollo (600g)", "Merluzzo (400g)", "Asparagi (500g)", "Limoni (3 pz)", "Olio EVO"],
    };
  }

  // Default balanced/standard plan
  return {
    dailyMeals: [
      { name: "🥣 Colazione: Avena Proteica", description: `Porridge d'avena con whey, banana e miele. Perfetto per ${Math.round(protein * 0.25)}g di proteine al mattino.`, estimatedMacros: `${Math.round(targetCalories * 0.25)} kcal | ${Math.round(protein * 0.25)}P | ${Math.round(carbs * 0.3)}C | ${Math.round(fats * 0.2)}F` },
      { name: "🍗 Pranzo: Pollo e Riso Basmati", description: "Petto di pollo grigliato con riso basmati, zucchine grigliate e olio EVO", estimatedMacros: `${Math.round(targetCalories * 0.4)} kcal | ${Math.round(protein * 0.4)}P | ${Math.round(carbs * 0.4)}C | ${Math.round(fats * 0.3)}F` },
      { name: "🐟 Cena: Salmone e Patate Dolci", description: "Filetto di salmone al forno con patate dolci e spinaci saltati", estimatedMacros: `${Math.round(targetCalories * 0.35)} kcal | ${Math.round(protein * 0.35)}P | ${Math.round(carbs * 0.3)}C | ${Math.round(fats * 0.5)}F` },
    ],
    groceryList: ["Fiocchi d'avena (500g)", "Whey protein (1 misurino)", "Banane (6 pz)", "Petto di pollo (600g)", "Riso basmati (500g)", "Salmone fresco (400g)", "Patate dolci (500g)", "Spinaci (300g)", "Olio EVO", "Zucchine (3 pz)"],
  };
}

/**
 * Mock Coach Copilot analysis. Returns a dummy AI-generated check-in summary.
 * Will be replaced with actual Lovable AI integration.
 */
export async function analyzeClientCheckIn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientData: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentLogs: any[],
): Promise<AICheckInSummary> {
  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Vary response based on log data
  const hasLogs = recentLogs.length > 0;
  const avgCal = hasLogs
    ? Math.round(recentLogs.filter(l => l.calories).reduce((s, l) => s + (l.calories ?? 0), 0) / Math.max(recentLogs.filter(l => l.calories).length, 1))
    : 0;

  if (!hasLogs || recentLogs.length < 3) {
    return {
      summary: "Il cliente ha pochi dati registrati questa settimana. L'aderenza al tracciamento è bassa e non è possibile trarre conclusioni affidabili sullo stato metabolico.",
      sentiment: 'negative',
      suggestedAction: "Contattare il cliente per verificare le motivazioni e ricordare l'importanza del tracciamento quotidiano.",
      magicReplyDraft: "Ciao! Ho notato che questa settimana hai registrato pochi dati. Capisco che a volte è difficile essere costanti, ma i dati sono il nostro strumento più potente. Anche solo peso e calorie ogni giorno fanno una differenza enorme. Ripartiamo insieme da domani? 💪",
    };
  }

  if (avgCal > 0 && avgCal < 1200) {
    return {
      summary: `Il cliente ha una media calorica molto bassa (${avgCal} kcal). Possibili segnali di restrizione eccessiva. Il peso potrebbe essere stabile a causa di ritenzione idrica da stress metabolico.`,
      sentiment: 'burnout_risk',
      suggestedAction: "Consigliato: Assegnare un Diet Break di 3 giorni per resettare cortisolo e leptina.",
      magicReplyDraft: `Ciao! Ho analizzato i tuoi dati. Stai andando benissimo con la costanza, ma noto che la fame è aumentata e lo stress si fa sentire. Ho detto al sistema di alzare le tue calorie per i prossimi 3 giorni (Diet Break). Resettiamo gli ormoni e poi ripartiamo più forti. Goditi un po' di carboidrati in più! 🍝`,
    };
  }

  // Default: positive mock
  return {
    summary: `Il cliente ha rispettato i macro al 95%, con una media di ${avgCal || '~2000'} kcal. Il peso trend è in linea con l'obiettivo. Aderenza eccellente e buona compliance generale.`,
    sentiment: 'positive',
    suggestedAction: "Mantenere la strategia attuale. Considerare un leggero aggiustamento calorico alla prossima revisione settimanale.",
    magicReplyDraft: "Ciao! Settimana fantastica 🎉 I numeri parlano chiaro: stai facendo un lavoro eccezionale. Il peso sta seguendo esattamente la traiettoria pianificata. Continua così e ci rivediamo la prossima settimana per il check-in. Bravo/a! 💪",
  };
}
