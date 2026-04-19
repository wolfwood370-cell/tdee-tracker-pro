import { useEffect, useState } from "react";
import { ChefHat, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface GlobalMeal {
  id: string;
  name: string;
  meal_type: string;
  description: string | null;
  ingredients: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  created_at: string;
}

const MEAL_TYPES = [
  { value: "colazione", label: "Colazione" },
  { value: "pranzo", label: "Pranzo" },
  { value: "cena", label: "Cena" },
  { value: "spuntino", label: "Spuntino" },
];

export function CoachRecipeManager() {
  const user = useAppStore((s) => s.user);

  const [meals, setMeals] = useState<GlobalMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState<string>("pranzo");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [ingredients, setIngredients] = useState("");

  const fetchMeals = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("favorite_meals")
        .select("id, name, meal_type, description, ingredients, calories, protein, carbs, fats, created_at")
        .eq("is_global", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMeals((data ?? []) as GlobalMeal[]);
    } catch (e) {
      console.error("[CoachRecipeManager] fetch error:", e);
      toast.error("Errore nel caricamento delle ricette globali.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeals();
  }, []);

  const resetForm = () => {
    setName("");
    setMealType("pranzo");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFats("");
    setIngredients("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Inserisci il nome della ricetta.");
      return;
    }
    const cal = parseInt(calories, 10);
    if (!isFinite(cal) || cal <= 0) {
      toast.error("Inserisci calorie valide (> 0).");
      return;
    }
    const num = (s: string) => {
      const n = parseInt(s, 10);
      return isFinite(n) && n >= 0 ? n : 0;
    };

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("favorite_meals").insert({
        user_id: user.id,
        name: trimmedName,
        meal_type: mealType,
        calories: cal,
        protein: num(protein),
        carbs: num(carbs),
        fats: num(fats),
        ingredients: ingredients.trim() || null,
        is_global: true,
      });
      if (error) throw error;
      toast.success("Ricetta aggiunta al Ricettario Globale.");
      resetForm();
      fetchMeals();
    } catch (e) {
      console.error("[CoachRecipeManager] save error:", e);
      toast.error("Errore nel salvataggio della ricetta.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa ricetta dal Ricettario Globale? Verrà rimossa per tutti i clienti.")) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from("favorite_meals").delete().eq("id", id);
      if (error) throw error;
      setMeals((prev) => prev.filter((m) => m.id !== id));
      toast.success("Ricetta eliminata.");
    } catch (e) {
      console.error("[CoachRecipeManager] delete error:", e);
      toast.error("Errore nell'eliminazione.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Form */}
      <Card className="glass-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Crea Nuova Ricetta Globale
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Le ricette qui salvate appariranno automaticamente nel Ricettario di tutti i tuoi clienti.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="recipe-name" className="text-xs">Nome della ricetta *</Label>
                <Input
                  id="recipe-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="es. Bowl di pollo e quinoa"
                  className="border-border text-base"
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe-type" className="text-xs">Tipo pasto</Label>
                <select
                  id="recipe-type"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {MEAL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="recipe-cal" className="text-xs">Calorie *</Label>
                <Input id="recipe-cal" type="number" inputMode="numeric" min={0} value={calories}
                  onChange={(e) => setCalories(e.target.value)} className="border-border text-base" placeholder="kcal" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe-pro" className="text-xs">Proteine (g)</Label>
                <Input id="recipe-pro" type="number" inputMode="numeric" min={0} value={protein}
                  onChange={(e) => setProtein(e.target.value)} className="border-border text-base" placeholder="g" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe-carb" className="text-xs">Carbo (g)</Label>
                <Input id="recipe-carb" type="number" inputMode="numeric" min={0} value={carbs}
                  onChange={(e) => setCarbs(e.target.value)} className="border-border text-base" placeholder="g" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe-fat" className="text-xs">Grassi (g)</Label>
                <Input id="recipe-fat" type="number" inputMode="numeric" min={0} value={fats}
                  onChange={(e) => setFats(e.target.value)} className="border-border text-base" placeholder="g" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recipe-ingredients" className="text-xs">Ingredienti / Note (opzionale)</Label>
              <Textarea
                id="recipe-ingredients"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="es. 150g petto di pollo, 70g quinoa, 100g spinaci, 1 cucchiaio olio EVO..."
                className="border-border min-h-[90px] resize-none text-base"
                maxLength={1000}
              />
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold shadow-lg"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Salva nel Ricettario Globale
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing meals */}
      <Card className="glass-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            Ricettario Globale
            <Badge variant="secondary" className="ml-1 text-xs">{meals.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : meals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ChefHat className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-sm">
                Nessuna ricetta globale ancora. Crea la prima qui sopra.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {meals.map((m) => (
                <Card key={m.id} className="border border-border bg-secondary/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="text-[10px] capitalize">{m.meal_type}</Badge>
                        </div>
                        <h3 className="font-display font-semibold text-foreground leading-tight">
                          {m.name}
                        </h3>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        aria-label="Elimina ricetta"
                      >
                        {deletingId === m.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="rounded-md bg-background p-1.5 border border-border">
                        <p className="text-sm font-bold text-foreground">{m.calories}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">kcal</p>
                      </div>
                      <div className="rounded-md bg-background p-1.5 border border-border">
                        <p className="text-sm font-bold text-primary">{m.protein}g</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Pro</p>
                      </div>
                      <div className="rounded-md bg-background p-1.5 border border-border">
                        <p className="text-sm font-bold text-accent-foreground">{m.carbs}g</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Carb</p>
                      </div>
                      <div className="rounded-md bg-background p-1.5 border border-border">
                        <p className="text-sm font-bold text-destructive">{m.fats}g</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Gra</p>
                      </div>
                    </div>

                    {m.ingredients && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-wrap">
                        {m.ingredients}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
