import { useState } from "react";
import { Trash2, UtensilsCrossed, Sparkles, Heart, PencilLine, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { parseMealsLog, aggregatesFromMeals, type MealEntry, type MealSource } from "@/lib/mealsLog";

const sourceMeta: Record<MealSource, { label: string; Icon: typeof Sparkles }> = {
  ai: { label: "AI", Icon: Sparkles },
  vault: { label: "Cassaforte", Icon: Heart },
  manual: { label: "Manuale", Icon: PencilLine },
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

interface TodayDiaryProps {
  logDate: string; // YYYY-MM-DD
}

export function TodayDiary({ logDate }: TodayDiaryProps) {
  const { user, dailyLogs, updateLog } = useAppStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const todayLog = dailyLogs.find((l) => l.log_date === logDate && l.user_id === user?.id);
  const meals = parseMealsLog((todayLog as { meals_log?: unknown } | undefined)?.meals_log);

  const handleDelete = async (mealId: string) => {
    if (!user || !todayLog) return;
    setDeletingId(mealId);
    try {
      // Re-read latest meals_log from DB to avoid clobbering concurrent additions.
      const { data: fresh, error: readErr } = await supabase
        .from("daily_metrics")
        .select("meals_log")
        .eq("user_id", user.id)
        .eq("log_date", logDate)
        .maybeSingle();
      if (readErr) throw readErr;
      const currentMeals = parseMealsLog(fresh?.meals_log);
      const nextMeals = currentMeals.filter((m) => m.id !== mealId);
      const agg = aggregatesFromMeals(nextMeals);
      // Minimal payload: only update changed columns; others stay intact.
      const payload = {
        user_id: user.id,
        log_date: logDate,
        meals_log: nextMeals,
        calories: agg.calories,
        protein: agg.protein,
        carbs: agg.carbs,
        fats: agg.fats,
        fiber: agg.fiber,
      };
      const { data, error } = await supabase
        .from("daily_metrics")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(payload as any, { onConflict: "user_id,log_date" })
        .select()
        .single();
      if (error) throw error;
      updateLog(data);
      toast.success("Pasto rimosso dal diario.");
    } catch (e) {
      console.error("Delete meal entry error:", e);
      toast.error("Errore nella rimozione del pasto.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="glass-card border-border">
      <CardContent className="p-2 md:p-3">
        {meals.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              🍽️ Nessun Pasto Registrato
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Usa "Aggiungi Pasto" per registrare il tuo primo pasto della giornata.
            </p>
          </div>
        ) : (
          <Accordion type="single" collapsible defaultValue={undefined}>
            <AccordionItem value="meals" className="border-0">
              <AccordionTrigger className="px-2 hover:no-underline">
                <span className="text-sm font-display font-semibold flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-primary" />
                  🍽️ Pasti Registrati
                  <Badge variant="secondary" className="text-xs">
                    {meals.length}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-[11px] text-muted-foreground px-2 pb-2">
                  Tocca il cestino per eliminare un pasto: i totali si aggiornano in tempo reale.
                </p>
                <ul className="space-y-2 px-1">
            {[...meals]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((m) => {
                const meta = sourceMeta[m.source] ?? sourceMeta.manual;
                const Icon = meta.Icon;
                return (
                  <li
                    key={m.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3"
                  >
                    <div className="mt-0.5 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground truncate">{m.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {meta.label}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          {formatTime(m.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {Math.round(m.calories)} kcal · {Math.round(m.protein)}g P ·{" "}
                        {Math.round(m.carbs)}g C · {Math.round(m.fats)}g G
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === m.id}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          aria-label="Elimina pasto"
                        >
                          {deletingId === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminare questo pasto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Stai per rimuovere <strong>{m.name}</strong> ({Math.round(m.calories)} kcal)
                            dal diario di oggi. I totali si aggiorneranno automaticamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(m.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                );
              })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
