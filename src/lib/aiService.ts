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
