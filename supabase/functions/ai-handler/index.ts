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
      const { targetCalories, protein, carbs, fats, dietType } = payload;
      const systemPrompt = `Sei un dietologo clinico esperto. Genera 3 pasti e una lista della spesa che rispettino STRETTAMENTE questi target giornalieri: ${targetCalories} kcal, ${protein}g proteine, ${carbs}g carboidrati, ${fats}g grassi per una dieta di tipo "${dietType}". Tutti i nomi dei piatti e le descrizioni devono essere in italiano. Usa emoji nei nomi dei pasti.`;

      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Genera il piano pasti giornaliero con lista della spesa." },
      ];

      tools = [
        {
          type: "function",
          function: {
            name: "meal_plan_result",
            description: "Return generated meal plan",
            parameters: {
              type: "object",
              properties: {
                dailyMeals: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      estimatedMacros: { type: "string" },
                    },
                    required: ["name", "description", "estimatedMacros"],
                    additionalProperties: false,
                  },
                },
                groceryList: { type: "array", items: { type: "string" } },
              },
              required: ["dailyMeals", "groceryList"],
              additionalProperties: false,
            },
          },
        },
      ];
      tool_choice = { type: "function", function: { name: "meal_plan_result" } };
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
