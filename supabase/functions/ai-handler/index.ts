import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, payload } = await req.json();

    let messages: { role: string; content: any }[] = [];
    let tools: any[] | undefined;
    let tool_choice: any | undefined;

    if (action === "parse_meal") {
      const systemPrompt =
        "Sei un nutrizionista esperto. L'utente fornisce una descrizione testuale o un'immagine di un pasto. Stima calorie e macronutrienti con precisione. Inoltre, valuta la qualità biologica, la densità di micronutrienti e il livello di lavorazione del cibo su una scala da 1 a 10 (10 = alimenti integrali e nutrienti, 1 = ultra-processati). Restituisci questo come 'qualityScore' (number). Fornisci anche un breve feedback di 1 frase in italiano come 'qualityFeedback'. Rispondi SEMPRE in italiano.";

      const userContent: any[] = [];

      if (payload.imageBase64) {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${payload.mimeType || "image/jpeg"};base64,${payload.imageBase64}` },
        });
        userContent.push({ type: "text", text: "Analizza questo piatto e stima i macronutrienti." });
      } else {
        userContent.push({ type: "text", text: payload.text || "Petto di pollo e riso" });
      }

      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ];

      tools = [
        {
          type: "function",
          function: {
            name: "parse_meal_result",
            description: "Return parsed meal nutritional data",
            parameters: {
              type: "object",
              properties: {
                foodName: { type: "string", description: "Nome del piatto in italiano" },
                calories: { type: "number", description: "Calorie totali stimate (kcal)" },
                protein: { type: "number", description: "Proteine in grammi" },
                carbs: { type: "number", description: "Carboidrati in grammi" },
                fats: { type: "number", description: "Grassi in grammi" },
                confidenceScore: { type: "number", description: "Punteggio di confidenza 0-100" },
                qualityScore: { type: "number", description: "Punteggio qualità biologica 1-10 (10=integrale, 1=ultra-processato)" },
                qualityFeedback: { type: "string", description: "Breve feedback sulla qualità nutrizionale in italiano" },
              },
              required: ["foodName", "calories", "protein", "carbs", "fats", "confidenceScore", "qualityScore", "qualityFeedback"],
              additionalProperties: false,
            },
          },
        },
      ];
      tool_choice = { type: "function", function: { name: "parse_meal_result" } };
    } else if (action === "analyze_checkin") {
      const systemPrompt = `Sei uno scienziato sportivo senior che assiste un coach di nutrizione. Analizza i dati settimanali del cliente forniti e genera un riepilogo clinico dettagliato in italiano.

Dati cliente: ${JSON.stringify(payload.clientData)}
Log recenti: ${JSON.stringify(payload.recentLogs)}`;

      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analizza la settimana di questo cliente e fornisci un riepilogo completo con sentiment, azioni suggerite e una bozza di risposta motivazionale." },
      ];

      tools = [
        {
          type: "function",
          function: {
            name: "checkin_analysis",
            description: "Return weekly check-in analysis",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "Riepilogo clinico della settimana" },
                sentiment: { type: "string", enum: ["positive", "neutral", "negative", "burnout_risk"] },
                suggestedAction: { type: "string", description: "Azione consigliata per il coach" },
                magicReplyDraft: { type: "string", description: "Bozza messaggio motivazionale per il cliente" },
              },
              required: ["summary", "sentiment", "suggestedAction", "magicReplyDraft"],
              additionalProperties: false,
            },
          },
        },
      ];
      tool_choice = { type: "function", function: { name: "checkin_analysis" } };
    } else if (action === "generate_meal_plan") {
      const {
        targetCalories,
        protein,
        carbs,
        fats,
        dietType,
        numMeals = 4,
        fridgeItems = "",
        dietaryPreference = "onnivoro",
        allergies = "",
      } = payload;

      const allergiesLine = allergies && String(allergies).trim()
        ? `IMPORTANTE: Evita rigorosamente questi ingredienti per allergie/intolleranze: ${allergies}.`
        : "Nessuna allergia segnalata.";
      const fridgeLine = fridgeItems && String(fridgeItems).trim()
        ? `ANTI-SPRECO: L'utente ha già in frigo: ${fridgeItems}. Dai PRIORITÀ a questi ingredienti per ridurre la lista della spesa.`
        : "";

      const systemPrompt = `Sei un dietologo clinico esperto. Crea un piano di ${numMeals} pasti che rispetti STRETTAMENTE questi target giornalieri: ${targetCalories} kcal, ${protein}g proteine, ${carbs}g carboidrati, ${fats}g grassi per una dieta di tipo "${dietType}".

REGOLE ALIMENTARI:
- Stile alimentare: ${dietaryPreference} — rispetta rigorosamente questo regime (vegano = nessun prodotto animale; vegetariano = no carne/pesce; pescatariano = no carne ma sì pesce; onnivoro = libero).
- ${allergiesLine}
${fridgeLine}

STRUTTURA: Distribuisci i ${numMeals} pasti in modo logico nella giornata (es: 3 pasti = Colazione/Pranzo/Cena; 4 = aggiungi Spuntino; 5-6 = aggiungi Spuntini multipli). Tutti i nomi dei piatti, descrizioni e categorie devono essere in italiano. Usa emoji nei nomi dei pasti.

Devi rispondere ESCLUSIVAMENTE con un file JSON valido che rispetti esattamente questa struttura: una chiave 'meals' (array di oggetti con: type, name, description, macros) e una chiave 'groceryList' (array di oggetti con: category, items).

Per ogni pasto:
- type: tipologia (es. "Colazione", "Pranzo", "Spuntino", "Cena")
- name: nome del piatto con emoji
- description: breve descrizione con ingredienti principali e grammature
- macros: stringa formato "XXX kcal | XXg P | XXg C | XXg G"

Per la lista della spesa, raggruppa per categoria (es. "Proteine", "Carboidrati", "Ortaggi", "Frutta", "Grassi", "Latticini", "Altro").

Sei un assistente matematico e nutrizionale. I pasti che generi sono ESCLUSIVAMENTE ESEMPI TEORICI per far combaciare i macronutrienti richiesti dall'utente. Usa sempre un tono probabilistico (es. 'Un'idea potrebbe essere...', 'Circa 100g di...') e non formulare MAI i pasti come se fossero prescrizioni mediche o diete assolute.`;

      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Genera un menù di ${numMeals} pasti con la lista della spesa categorizzata.` },
      ];

      tools = [
        {
          type: "function",
          function: {
            name: "meal_plan_result",
            description: "Return generated meal plan with categorized grocery list",
            parameters: {
              type: "object",
              properties: {
                meals: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      name: { type: "string" },
                      description: { type: "string" },
                      macros: { type: "string" },
                    },
                    required: ["type", "name", "description", "macros"],
                    additionalProperties: false,
                  },
                },
                groceryList: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      items: { type: "array", items: { type: "string" } },
                    },
                    required: ["category", "items"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["meals", "groceryList"],
              additionalProperties: false,
            },
          },
        },
      ];
      tool_choice = { type: "function", function: { name: "meal_plan_result" } };
    } else if (action === "replace_meal") {
      const {
        mealType,
        targetMacros,
        dietType = "balanced",
        dietaryPreference = "onnivoro",
        allergies = "",
        fridgeItems = "",
      } = payload;

      const allergiesLine = allergies && String(allergies).trim()
        ? `Evita rigorosamente: ${allergies}.`
        : "";
      const fridgeLine = fridgeItems && String(fridgeItems).trim()
        ? `Se possibile usa: ${fridgeItems}.`
        : "";

      const systemPrompt = `Sei un dietologo esperto. Genera UN'ALTERNATIVA per il pasto "${mealType}" che abbia ESATTAMENTE questi macro: ${targetMacros}.

VINCOLI:
- Stile alimentare: ${dietaryPreference} (rispetta rigorosamente).
- Tipo di dieta: ${dietType}.
- ${allergiesLine}
- ${fridgeLine}

Il pasto deve essere DIVERSO da quello sostituito ma con macro equivalenti. Italiano, emoji nel nome, descrizione con grammature.

Rispondi ESCLUSIVAMENTE con un oggetto JSON con: type, name, description, macros (formato "XXX kcal | XXg P | XXg C | XXg G").

Sei un assistente matematico e nutrizionale. I pasti che generi sono ESCLUSIVAMENTE ESEMPI TEORICI per far combaciare i macronutrienti richiesti dall'utente. Usa sempre un tono probabilistico (es. 'Un'idea potrebbe essere...', 'Circa 100g di...') e non formulare MAI i pasti come se fossero prescrizioni mediche o diete assolute.`;

      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Proponi un'alternativa per ${mealType}.` },
      ];

      tools = [
        {
          type: "function",
          function: {
            name: "replace_meal_result",
            description: "Return a replacement meal with matching macros",
            parameters: {
              type: "object",
              properties: {
                type: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
                macros: { type: "string" },
              },
              required: ["type", "name", "description", "macros"],
              additionalProperties: false,
            },
          },
        },
      ];
      tool_choice = { type: "function", function: { name: "replace_meal_result" } };
    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages,
    };
    if (tools) body.tools = tools;
    if (tool_choice) body.tool_choice = tool_choice;

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit superato, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti. Ricarica il workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Errore del servizio AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    const sanitizeJson = (text: string): string =>
      text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const safeParse = (text: string) => {
      try {
        return JSON.parse(sanitizeJson(text));
      } catch {
        return null;
      }
    };

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = safeParse(toolCall.function.arguments);
      if (result) {
        return new Response(JSON.stringify({ data: result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fallback: try content
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const parsed = safeParse(content);
      if (parsed) {
        return new Response(JSON.stringify({ data: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ data: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "No result from AI" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-handler error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
