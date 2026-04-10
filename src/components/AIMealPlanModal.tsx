import { useState } from "react";
import { Sparkles, RefreshCw, ShoppingCart, Utensils, Loader2, Check } from "lucide-react";
import { generateMealPlanWithAI, type AIMealPlan } from "@/lib/aiService";

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
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const fetchPlan = async () => {
    setIsLoading(true);
    setMealPlan(null);
    setCheckedItems(new Set());
    try {
      const result = await generateMealPlanWithAI(targetCalories, protein, carbs, fats, dietType);
      setMealPlan(result);
    } catch (e) {
      console.error("AI meal plan error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !mealPlan && !isLoading) {
      fetchPlan();
    }
  };

  const toggleItem = (index: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Idee Pasti e Spesa AI
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pasti su misura per i tuoi macro: {targetCalories} kcal | {protein}P | {carbs}C | {fats}F
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="animate-pulse">👩‍🍳 L'AI sta formulando i pasti perfetti per i tuoi macro di oggi...</span>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
            <Skeleton className="h-4 w-1/3 mt-4" />
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={`g-${i}`} className="h-4 w-2/3" />
            ))}
          </div>
        )}

        {mealPlan && !isLoading && (
          <div className="space-y-5">
            {/* Meals */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Utensils className="h-4 w-4 text-primary" />
                💡 Idee Pasti
              </h3>
              {mealPlan.dailyMeals.map((meal, i) => (
                <Card key={i} className="border-border bg-secondary/30">
                  <CardContent className="p-3 space-y-1">
                    <p className="text-sm font-semibold text-foreground">{meal.name}</p>
                    <p className="text-xs text-muted-foreground">{meal.description}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {meal.estimatedMacros}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Grocery List */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <ShoppingCart className="h-4 w-4 text-primary" />
                🛒 Lista della Spesa
              </h3>
              <div className="space-y-1.5">
                {mealPlan.groceryList.map((item, i) => (
                  <label
                    key={i}
                    className="flex items-center gap-2 text-sm cursor-pointer group"
                  >
                    <Checkbox
                      checked={checkedItems.has(i)}
                      onCheckedChange={() => toggleItem(i)}
                    />
                    <span
                      className={
                        checkedItems.has(i)
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }
                    >
                      {item}
                    </span>
                    {checkedItems.has(i) && (
                      <Check className="h-3 w-3 text-primary ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Regenerate */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPlan}
              className="w-full"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              🔄 Rigenera Idee
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
