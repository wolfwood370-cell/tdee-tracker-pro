import { useState } from "react";
import { Sparkles, RefreshCw, ShoppingCart, Utensils, Loader2, ChefHat } from "lucide-react";
import { generateMealPlanWithAI, type AIMealPlan } from "@/lib/aiService";
import { toast } from "sonner";

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

interface AIMealPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  dietType: string;
}

export function AIMealPlanModal({
  open,
  onOpenChange,
  targetCalories,
  protein,
  carbs,
  fats,
  dietType,
}: AIMealPlanModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [mealPlan, setMealPlan] = useState<AIMealPlan | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const fetchPlan = async () => {
    setIsLoading(true);
    setMealPlan(null);
    setCheckedItems(new Set());
    try {
      const result = await generateMealPlanWithAI(targetCalories, protein, carbs, fats, dietType);
      if (!result?.meals || !result?.groceryList) {
        throw new Error("Risposta AI non valida");
      }
      setMealPlan(result);
    } catch (e) {
      console.error("AI meal plan error:", e);
      toast.error("Errore nella generazione del piano pasti. Riprova.");
    } finally {
      setIsLoading(false);
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
            Idee Pasti e Spesa AI
          </DialogTitle>
          <DialogDescription className="text-xs">
            Target: {targetCalories} kcal · {protein}g P · {carbs}g C · {fats}g G
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6">
            {/* Initial state */}
            {!mealPlan && !isLoading && (
              <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <ChefHat className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-semibold">Pronto a creare il tuo menù?</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    L'AI genererà un menù completo bilanciato sui tuoi macro di oggi e una lista della spesa categorizzata.
                  </p>
                </div>
                <Button onClick={fetchPlan} size="lg" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Genera Menù e Spesa
                </Button>
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  <span className="animate-pulse">
                    👩‍🍳 Gemini sta elaborando il tuo menù perfetto...
                  </span>
                </div>
                <div className="space-y-3 pt-2">
                  {[1, 2, 3, 4].map((i) => (
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
              <Tabs defaultValue="menu" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="menu" className="gap-1.5">
                    <Utensils className="h-3.5 w-3.5" />
                    🍽️ Menù
                  </TabsTrigger>
                  <TabsTrigger value="grocery" className="gap-1.5">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    🛒 Spesa
                  </TabsTrigger>
                </TabsList>

                {/* Menu Tab */}
                <TabsContent value="menu" className="space-y-3 mt-0">
                  {mealPlan.meals.map((meal, i) => (
                    <Card key={i} className="border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                      <CardContent className="p-4 space-y-2">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {meal.type}
                        </Badge>
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
                      </CardContent>
                    </Card>
                  ))}
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

                {/* Regenerate */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchPlan}
                  className="w-full mt-6"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Rigenera Menù
                </Button>
              </Tabs>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
