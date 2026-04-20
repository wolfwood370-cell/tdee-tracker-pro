import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  parseMealsLog,
  aggregatesFromMeals,
  type MealEntry,
} from "@/lib/mealsLog";

interface EditMealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealEntry | null;
  logDate: string;
}

export function EditMealModal({ open, onOpenChange, meal, logDate }: EditMealModalProps) {
  const { user, updateLog } = useAppStore();
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (meal) {
      setName(meal.name ?? "");
      setCalories(String(meal.calories ?? ""));
      setProtein(String(meal.protein ?? ""));
      setCarbs(String(meal.carbs ?? ""));
      setFats(String(meal.fats ?? ""));
    }
  }, [meal]);

  const handleSave = async () => {
    if (!user || !meal) return;
    const cal = parseFloat(calories);
    if (!isFinite(cal) || cal < 0) {
      toast.error("Inserisci un valore di calorie valido.");
      return;
    }
    const num = (s: string) => {
      const n = parseFloat(s);
      return isFinite(n) && n >= 0 ? n : 0;
    };

    setSaving(true);
    try {
      // Race-safe: re-read latest meals_log from DB.
      const { data: fresh, error: readErr } = await supabase
        .from("daily_metrics")
        .select("meals_log")
        .eq("user_id", user.id)
        .eq("log_date", logDate)
        .maybeSingle();
      if (readErr) throw readErr;

      const currentMeals = parseMealsLog(fresh?.meals_log);
      const nextMeals = currentMeals.map((m) =>
        m.id === meal.id
          ? {
              ...m,
              name: name.trim() || m.name,
              calories: Math.round(cal),
              protein: num(protein),
              carbs: num(carbs),
              fats: num(fats),
            }
          : m,
      );
      const agg = aggregatesFromMeals(nextMeals);

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
      toast.success("Pasto aggiornato.");
      onOpenChange(false);
    } catch (e) {
      console.error("Edit meal error:", e);
      toast.error("Errore nell'aggiornamento del pasto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Pencil className="h-5 w-5 text-primary" />
            Modifica Pasto
          </DialogTitle>
          <DialogDescription className="text-xs">
            Aggiorna i macro: i totali del giorno si ricalcolano in automatico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome pasto</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Pollo e riso"
              className="border-border"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Calorie (kcal)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Proteine (g)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Carboidrati (g)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Grassi (g)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={fats}
                onChange={(e) => setFats(e.target.value)}
                className="border-border"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              "Salva modifiche"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
