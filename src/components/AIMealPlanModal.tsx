import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, ShoppingCart, Utensils, Loader2, ChefHat, RotateCw, Heart } from "lucide-react";
import {
  generateMealPlanWithAI,
  replaceMealWithAI,
  type AIMealPlan,
  type AIMeal,
} from "@/lib/aiService";
import { parseMacrosString } from "@/lib/macroParser";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { toast } from "sonner";

const PLAN_STORAGE_KEY = "nc-ai-meal-plan-v1";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AIMealPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  dietType: string;
  dietaryPreference?: string;
  allergies?: string;
}

export function AIMealPlanModal({
  open,
  onOpenChange,
  targetCalories,
  protein,
  carbs,
  fats,
  dietType,
  dietaryPreference = "onnivoro",
  allergies = "",
}: AIMealPlanModalProps) {
  const { user } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [mealPlan, setMealPlan] = useState<AIMealPlan | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Pre-generation controls
  const [numMeals, setNumMeals] = useState<string>("4");
  const [fridgeItems, setFridgeItems] = useState<string>("");

  // Per-meal regeneration loading state (index-based)
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // Saved (favorited) meal indices for heart-fill feedback
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  // Restore plan from localStorage on open
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(PLAN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AIMealPlan;
        if (parsed?.meals && parsed?.groceryList) {
          setMealPlan(parsed);
        }
      }
    } catch {
      // ignore corrupt cache
    }
  }, [open]);

  // Persist plan to localStorage on change
  useEffect(() => {
    if (mealPlan) {
      try {
        localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(mealPlan));
      } catch {
        // ignore quota errors
      }
    }
  }, [mealPlan]);

  const handleSaveFavorite = async (index: number) => {
    if (!mealPlan || !user) return;
    const meal = mealPlan.meals[index];
    const macros = parseMacrosString(meal.macros);
    setSavingIndex(index);
    try {
      const { error } = await supabase.from("favorite_meals").insert({
        user_id: user.id,
        meal_type: meal.type,
        name: meal.name,
        description: meal.description,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fats: macros.fats,
      });
      if (error) throw error;
      setSavedIndices((prev) => new Set(prev).add(index));
      toast.success("Pasto salvato nella Cassaforte! ❤️");
    } catch (e) {
      console.error("Save favorite error:", e);
      toast.error("Errore nel salvataggio del pasto.");
    } finally {
      setSavingIndex(null);
    }
  };

  const fetchPlan = async () => {
    setIsLoading(true);
    setMealPlan(null);
    setCheckedItems(new Set());
    try {
      const result = await generateMealPlanWithAI({
        targetCalories,
        protein,
        carbs,
        fats,
        dietType,
        numMeals: parseInt(numMeals, 10),
        fridgeItems: fridgeItems.trim(),
        dietaryPreference,
        allergies,
      });
      if (!result?.meals || !result?.groceryList) {
        throw new Error("Risposta AI non valida");
      }
      setMealPlan(result);
      setSavedIndices(new Set());
    } catch (e) {
      console.error("AI meal plan error:", e);
      toast.error("Errore nella generazione del piano pasti. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplaceMeal = async (index: number) => {
    if (!mealPlan) return;
    const old = mealPlan.meals[index];
    setReplacingIndex(index);
    try {
      const replacement = await replaceMealWithAI({
        mealType: old.type,
        targetMacros: old.macros,
        dietType,
        dietaryPreference,
        allergies,
        fridgeItems: fridgeItems.trim(),
      });
      if (!replacement?.name) throw new Error("Risposta AI non valida");
      setMealPlan((prev) => {
        if (!prev) return prev;
        const newMeals: AIMeal[] = [...prev.meals];
        newMeals[index] = replacement;
        return { ...prev, meals: newMeals };
      });
      // Replaced meal is no longer "saved"
      setSavedIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      toast.success(`Pasto sostituito ✨`);
    } catch (e) {
      console.error("AI replace meal error:", e);
      toast.error("Errore nella sostituzione del pasto. Riprova.");
    } finally {
      setReplacingIndex(null);
    }
  };

  const resetToConfig = () => {
    setMealPlan(null);
    setCheckedItems(new Set());
    setSavedIndices(new Set());
    try {
      localStorage.removeItem(PLAN_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const toggleItem = (key: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="font-display flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Le tue idee pasto AI
          </DialogTitle>
          <DialogDescription className="text-xs">
            Target: {targetCalories} kcal · {protein}g P · {carbs}g C · {fats}g G
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6">
            {/* Step 1: Configuration */}
            {!mealPlan && !isLoading && (
              <div className="space-y-5">
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <ChefHat className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">Configura le tue idee pasto</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Personalizza il piano in base alle tue esigenze. L'AI rispetterà preferenze e allergie del tuo profilo.
                  </p>
                </div>

                {/* Profile preferences pills */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="secondary" className="text-xs capitalize">
                    🥗 {dietaryPreference}
                  </Badge>
                  {allergies?.trim() && (
                    <Badge variant="outline" className="text-xs">
                      ⚠️ Allergie: {allergies.length > 30 ? `${allergies.slice(0, 30)}…` : allergies}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quanti pasti vuoi oggi?</Label>
                  <Select value={numMeals} onValueChange={setNumMeals}>
                    <SelectTrigger className="border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} pasti
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cosa hai in frigo? (Opzionale)</Label>
                  <Textarea
                    value={fridgeItems}
                    onChange={(e) => setFridgeItems(e.target.value)}
                    placeholder="Es: uova, spinaci, riso, petto di pollo..."
                    rows={3}
                    className="border-border min-h-[80px] text-base resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    💡 Gemini userà questi ingredienti per ridurre gli sprechi e la tua lista della spesa.
                  </p>
                </div>

                <Button onClick={fetchPlan} size="lg" className="w-full gap-2">
                  <Sparkles className="h-4 w-4" />
                  Genera Idee Pasto AI
                </Button>
              </div>
            )}

            {/* Loading state (full plan) */}
            {isLoading && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  <span className="animate-pulse">
                    L'AI sta elaborando le tue idee pasto...
                  </span>
                </div>
                <div className="space-y-3 pt-2">
                  {Array.from({ length: parseInt(numMeals, 10) }).map((_, i) => (
                    <Card key={i} className="border-border bg-secondary/30">
                      <CardContent className="p-4 space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Result state */}
            {mealPlan && !isLoading && (
              <>
                <Tabs defaultValue="menu" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="menu" className="gap-1.5">
                      <Utensils className="h-3.5 w-3.5" />
                      Idee Pasto
                    </TabsTrigger>
                    <TabsTrigger value="grocery" className="gap-1.5">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      🛒 Spesa
                    </TabsTrigger>
                  </TabsList>

                  {/* Menu Tab */}
                  <TabsContent value="menu" className="space-y-3 mt-0">
                    {mealPlan.meals.map((meal, i) => {
                      const isReplacing = replacingIndex === i;
                      return (
                        <Card key={i} className="border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                          <CardContent className="p-4 space-y-2">
                            {isReplacing ? (
                              <div className="space-y-2 py-1">
                                <div className="flex items-center gap-2 text-xs text-primary">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span className="animate-pulse">Sostituzione {meal.type} in corso…</span>
                                </div>
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-1/2" />
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-2">
                                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                    {meal.type}
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleSaveFavorite(i)}
                                      disabled={savingIndex !== null || savedIndices.has(i)}
                                      className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      aria-label="Salva nella Cassaforte"
                                    >
                                      {savingIndex === i ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Heart
                                          className="h-3 w-3"
                                          fill={savedIndices.has(i) ? "currentColor" : "none"}
                                        />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleReplaceMeal(i)}
                                      disabled={replacingIndex !== null}
                                      className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                                    >
                                      <RotateCw className="h-3 w-3" />
                                      🔄 Cambia
                                    </Button>
                                  </div>
                                </div>
                                <h4 className="font-display font-semibold text-base text-foreground leading-tight">
                                  {meal.name}
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {meal.description}
                                </p>
                                <div className="pt-1">
                                  <Badge variant="default" className="text-[11px] font-mono">
                                    {meal.macros}
                                  </Badge>
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </TabsContent>

                  {/* Grocery Tab */}
                  <TabsContent value="grocery" className="space-y-4 mt-0">
                    {mealPlan.groceryList.map((group, gi) => (
                      <div key={gi} className="space-y-2">
                        <h4 className="text-sm font-semibold text-primary uppercase tracking-wide border-b border-border pb-1">
                          {group.category}
                        </h4>
                        <div className="space-y-1.5 pl-1">
                          {group.items.map((item, ii) => {
                            const key = `${gi}-${ii}`;
                            const checked = checkedItems.has(key);
                            return (
                              <label
                                key={key}
                                className="flex items-center gap-2.5 text-sm cursor-pointer group py-1"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleItem(key)}
                                />
                                <span
                                  className={
                                    checked
                                      ? "line-through text-muted-foreground"
                                      : "text-foreground"
                                  }
                                >
                                  {item}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>

                <div className="grid grid-cols-2 gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetToConfig}
                    disabled={replacingIndex !== null}
                  >
                    <ChefHat className="h-3.5 w-3.5 mr-1.5" />
                    Riconfigura
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchPlan}
                    disabled={replacingIndex !== null}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Rigenera Tutto
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
