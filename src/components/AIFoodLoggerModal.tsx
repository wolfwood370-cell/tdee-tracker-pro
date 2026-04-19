import { useState, useCallback, useEffect } from "react";
import { Camera, Sparkles, X, CheckCircle2, Leaf, Heart, Trash2, Plus, Loader2, PencilLine, ChefHat } from "lucide-react";
import { toast } from "sonner";

import { parseMealWithAI, type AIParsedMeal } from "@/lib/aiService";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { useSyncStore } from "@/stores/syncStore";
import { bumpStreak } from "@/lib/streaks";
import { toLocalISODate } from "@/lib/weeklyBudget";
import {
  parseMealsLog,
  aggregatesFromMeals,
  newMealId,
  type MealEntry,
  type MealSource,
} from "@/lib/mealsLog";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface AIFoodLoggerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logDate: string;
}

interface FavoriteMeal {
  id: string;
  meal_type: string;
  name: string;
  description: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  is_global: boolean;
  user_id: string;
  ingredients?: string | null;
}

type Phase = "input" | "analyzing" | "result";

export function AIFoodLoggerModal({ open, onOpenChange, logDate }: AIFoodLoggerModalProps) {
  const { user, profile, setProfile, dailyLogs, addLog, updateLog } = useAppStore();

  const [phase, setPhase] = useState<Phase>("input");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AIParsedMeal | null>(null);

  // Vault state
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [logging, setLogging] = useState<string | null>(null);

  // Manual logger state
  const [mCalories, setMCalories] = useState("");
  const [mProtein, setMProtein] = useState("");
  const [mCarbs, setMCarbs] = useState("");
  const [mFats, setMFats] = useState("");
  const [mFiber, setMFiber] = useState("");
  const [mWater, setMWater] = useState("");
  const [mSodium, setMSodium] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const resetState = useCallback(() => {
    setPhase("input");
    setTextInput("");
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
  }, [previewUrl]);

  const handleClose = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  const handleFileSelect = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileSelect(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch favorites when modal opens
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    const fetchFavorites = async () => {
      setFavoritesLoading(true);
      try {
        // RLS auto-filters: returns own meals + all is_global=true rows.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("favorite_meals")
          .select("id, meal_type, name, description, calories, protein, carbs, fats, is_global, user_id, ingredients")
          .order("is_global", { ascending: false })
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (!cancelled) setFavorites((data ?? []) as FavoriteMeal[]);
      } catch (e) {
        console.error("Fetch favorites error:", e);
      } finally {
        if (!cancelled) setFavoritesLoading(false);
      }
    };
    fetchFavorites();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const handleAnalyze = async () => {
    if (!textInput.trim() && !selectedFile) return;
    setPhase("analyzing");

    try {
      const input = selectedFile ?? textInput;
      const parsed = await parseMealWithAI(input);
      setResult(parsed);
      setPhase("result");
    } catch {
      toast.error("Errore nell'analisi AI. Riprova.");
      setPhase("input");
    }
  };

  /**
   * Phase 61 — Append a meal entry to today's `meals_log` JSONB and recompute
   * aggregate columns as a perfect SUM of the array. This guarantees totals
   * stay in lockstep with the diary list (so deletions decrement correctly).
   *
   * Preserves ALL existing fields (InBody/segmental/notes) via spread.
   */
  const appendMealEntry = async (
    entry: Omit<MealEntry, "id" | "timestamp">,
    qualityScore?: number,
  ) => {
    if (!user) throw new Error("No user");

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    const existingLog = dailyLogs.find(
      (l) => l.log_date === logDate && l.user_id === user.id,
    );

    // ── Build the next state from local store first (optimistic) ─────────
    const localPrevMeals = parseMealsLog(
      (existingLog as { meals_log?: unknown } | undefined)?.meals_log,
    );
    const meal: MealEntry = {
      ...entry,
      id: newMealId(),
      timestamp: new Date().toISOString(),
    };
    const localNextMeals = [...localPrevMeals, meal];
    const localAgg = aggregatesFromMeals(localNextMeals);
    const localQuality = (existingLog as { average_food_quality?: number | null } | undefined)?.average_food_quality;
    const optimisticQuality = qualityScore != null
      ? (localQuality != null ? Math.round(((localQuality + qualityScore) / 2) * 10) / 10 : qualityScore)
      : localQuality ?? null;

    // Optimistic local patch — UI updates instantly even if offline.
    const optimisticRow = {
      ...(existingLog ?? {
        id: `optimistic_${logDate}_${user.id}`,
        user_id: user.id,
        log_date: logDate,
        is_interpolated: false,
        is_perfect_day: false,
      }),
      meals_log: localNextMeals,
      calories: localAgg.calories,
      protein: localAgg.protein,
      carbs: localAgg.carbs,
      fats: localAgg.fats,
      fiber: localAgg.fiber,
      average_food_quality: optimisticQuality,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (existingLog) updateLog(optimisticRow as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else addLog(optimisticRow as any);

    // ── If offline, enqueue and bail out — do NOT touch the network ──────
    if (!isOnline) {
      useSyncStore.getState().addToQueue({
        type: "ADD_MEAL_UPSERT",
        payload: {
          user_id: user.id,
          log_date: logDate,
          meals_log: localNextMeals,
          calories: localAgg.calories,
          protein: localAgg.protein,
          carbs: localAgg.carbs,
          fats: localAgg.fats,
          fiber: localAgg.fiber,
          average_food_quality: optimisticQuality,
        },
      });
      toast.info("Connessione assente. Pasto salvato offline.", {
        description: "Verrà sincronizzato appena possibile.",
      });
      return;
    }

    // ── Online path: re-read freshest server state to avoid race conditions
    try {
      const { data: fresh, error: readErr } = await supabase
        .from("daily_metrics")
        .select("meals_log, average_food_quality")
        .eq("user_id", user.id)
        .eq("log_date", logDate)
        .maybeSingle();
      if (readErr) throw readErr;

      const prevMeals = parseMealsLog(fresh?.meals_log);
      const nextMeals = [...prevMeals, meal];
      const agg = aggregatesFromMeals(nextMeals);

      const dbQuality = fresh?.average_food_quality as number | null | undefined;
      let newQuality: number | null | undefined = dbQuality;
      if (qualityScore != null) {
        newQuality = dbQuality != null
          ? Math.round(((dbQuality + qualityScore) / 2) * 10) / 10
          : qualityScore;
      }

      const upsertPayload = {
        user_id: user.id,
        log_date: logDate,
        meals_log: nextMeals,
        calories: agg.calories,
        protein: agg.protein,
        carbs: agg.carbs,
        fats: agg.fats,
        fiber: agg.fiber,
        average_food_quality: newQuality ?? null,
      };

      const { data, error } = await supabase
        .from("daily_metrics")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(upsertPayload as any, { onConflict: "user_id,log_date" })
        .select()
        .single();
      if (error) throw error;

      // Reconcile with authoritative server row.
      if (existingLog) updateLog(data);
      else addLog(data);

      // Phase 70: bump streak only for TODAY's activity.
      if (profile && logDate === toLocalISODate(new Date())) {
        const newStreak = await bumpStreak(
          user.id,
          profile.current_streak ?? 0,
          profile.last_activity_date ?? null,
        );
        if (newStreak != null && newStreak !== profile.current_streak) {
          setProfile({ ...profile, current_streak: newStreak, last_activity_date: toLocalISODate(new Date()) });
          if (newStreak > 1) {
            toast.success(`🔥 ${newStreak} giorni di fuoco!`, { description: "Continua così, la costanza paga." });
          }
        }
      }
    } catch (e) {
      // Network failure mid-flight: enqueue with the OPTIMISTIC payload so
      // the SyncManager will retry. UI stays as-is (no revert).
      console.warn("[appendMealEntry] online save failed, enqueueing", e);
      useSyncStore.getState().addToQueue({
        type: "ADD_MEAL_UPSERT",
        payload: {
          user_id: user.id,
          log_date: logDate,
          meals_log: localNextMeals,
          calories: localAgg.calories,
          protein: localAgg.protein,
          carbs: localAgg.carbs,
          fats: localAgg.fats,
          fiber: localAgg.fiber,
          average_food_quality: optimisticQuality,
        },
      });
      toast.info("Connessione assente. Pasto salvato offline.", {
        description: "Verrà sincronizzato appena possibile.",
      });
    }
  };

  const handleConfirm = async () => {
    if (!result || !user) return;
    try {
      await appendMealEntry(
        {
          name: result.foodName,
          calories: result.calories,
          protein: result.protein,
          carbs: result.carbs,
          fats: result.fats,
          source: "ai" as MealSource,
        },
        result.qualityScore,
      );
      toast.success(
        `Pasto loggato con successo! Precisione stimata: ${result.confidenceScore}%`,
        { description: `${result.foodName} — ${result.calories} kcal` },
      );
      handleClose(false);
    } catch (e) {
      console.error("AI log save error:", e);
      toast.error("Errore nel salvataggio del pasto.");
    }
  };

  const handleLogFavorite = async (fav: FavoriteMeal) => {
    setLogging(fav.id);
    try {
      await appendMealEntry({
        name: fav.name,
        calories: fav.calories,
        protein: fav.protein,
        carbs: fav.carbs,
        fats: fav.fats,
        source: "vault" as MealSource,
      });
      toast.success(`${fav.name} registrato!`, {
        description: `+${fav.calories} kcal`,
      });
      handleClose(false);
    } catch (e) {
      console.error("Log favorite error:", e);
      toast.error("Errore nel salvataggio del pasto.");
    } finally {
      setLogging(null);
    }
  };

  const handleDeleteFavorite = async (id: string) => {
    try {
      const { error } = await supabase.from("favorite_meals").delete().eq("id", id);
      if (error) throw error;
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      toast.success("Pasto rimosso dalla Cassaforte.");
    } catch (e) {
      console.error("Delete favorite error:", e);
      toast.error("Errore nella rimozione.");
    }
  };

  // ── Manual logger: append numeric values directly to today's row ────────
  const resetManual = () => {
    setMCalories("");
    setMProtein("");
    setMCarbs("");
    setMFats("");
    setMFiber("");
    setMWater("");
    setMSodium("");
  };

  const handleManualSubmit = async () => {
    if (!user) return;
    const calories = parseFloat(mCalories);
    if (!isFinite(calories) || calories <= 0) {
      toast.error("Inserisci un valore di calorie valido (> 0).");
      return;
    }
    const num = (s: string) => {
      const n = parseFloat(s);
      return isFinite(n) && n > 0 ? n : 0;
    };
    const macroEntry = {
      calories: Math.round(calories),
      protein: num(mProtein),
      carbs: num(mCarbs),
      fats: num(mFats),
      fiber: num(mFiber),
    };
    const extraWater = num(mWater);
    const extraSodium = num(mSodium);

    setSavingManual(true);
    try {
      // Race-safe: re-read latest meals_log + water_l + sodium_mg from DB.
      const { data: fresh, error: readErr } = await supabase
        .from("daily_metrics")
        .select("meals_log, water_l, sodium_mg")
        .eq("user_id", user.id)
        .eq("log_date", logDate)
        .maybeSingle();
      if (readErr) throw readErr;

      const existingLog = dailyLogs.find(
        (l) => l.log_date === logDate && l.user_id === user.id,
      );

      const meal: MealEntry = {
        id: newMealId(),
        name: "Voce manuale",
        ...macroEntry,
        source: "manual" as MealSource,
        timestamp: new Date().toISOString(),
      };
      const prevMeals = parseMealsLog(fresh?.meals_log);
      const nextMeals = [...prevMeals, meal];
      const agg = aggregatesFromMeals(nextMeals);

      const prevWater = Number(fresh?.water_l) || 0;
      const prevSodium = Number(fresh?.sodium_mg) || 0;

      // Minimal payload: only touch the columns we change.
      const upsertPayload = {
        user_id: user.id,
        log_date: logDate,
        meals_log: nextMeals,
        calories: agg.calories,
        protein: agg.protein,
        carbs: agg.carbs,
        fats: agg.fats,
        fiber: agg.fiber,
        water_l: extraWater > 0 ? Math.round((prevWater + extraWater) * 100) / 100 : prevWater,
        sodium_mg: extraSodium > 0 ? Math.round(prevSodium + extraSodium) : prevSodium,
      };

      const { data, error } = await supabase
        .from("daily_metrics")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(upsertPayload as any, { onConflict: "user_id,log_date" })
        .select()
        .single();

      if (error) throw error;
      if (existingLog) updateLog(data);
      else addLog(data);

      // Phase 70: streak bump on today's activity.
      if (profile && logDate === toLocalISODate(new Date())) {
        const newStreak = await bumpStreak(
          user.id,
          profile.current_streak ?? 0,
          profile.last_activity_date ?? null,
        );
        if (newStreak != null && newStreak !== profile.current_streak) {
          setProfile({ ...profile, current_streak: newStreak, last_activity_date: toLocalISODate(new Date()) });
          if (newStreak > 1) {
            toast.success(`🔥 ${newStreak} giorni di fuoco!`, { description: "Continua così, la costanza paga." });
          }
        }
      }

      toast.success("Valori aggiunti con successo!");
      resetManual();
      handleClose(false);
    } catch (e) {
      console.error("Manual log error:", e);
      toast.error("Errore nel salvataggio.");
    } finally {
      setSavingManual(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg border-border bg-background/95 backdrop-blur-xl p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Sparkles className="h-5 w-5 text-primary" />
            Registra Pasto
          </DialogTitle>
          <DialogDescription className="text-xs">
            Scansiona con AI, scegli dai tuoi pasti salvati o inserisci manualmente
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="ai" className="w-full">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ai" className="gap-1 text-xs">
                Scanner AI
              </TabsTrigger>
              <TabsTrigger value="vault" className="gap-1 text-xs">
                I Miei Pasti
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-1 text-xs">
                Manuale
              </TabsTrigger>
            </TabsList>
          </div>

          {/* === AI Scan Tab === */}
          <TabsContent value="ai" className="mt-0">
            <ScrollArea className="max-h-[70vh]">
              <div className="p-6 pt-4">
                {phase === "input" && (
                  <div className="space-y-5">
                    {/* Image Upload Zone */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Scansiona Piatto
                      </Label>
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        className="relative border-2 border-dashed border-primary/30 rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-primary/60 hover:bg-primary/5"
                        onClick={() => document.getElementById("ai-file-input")?.click()}
                      >
                        {previewUrl ? (
                          <div className="relative">
                            <img
                              src={previewUrl}
                              alt="Preview"
                              className="max-h-40 mx-auto rounded-lg object-cover"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFile(null);
                                setPreviewUrl(null);
                              }}
                              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <Camera className="h-6 w-6 text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Trascina una foto o{" "}
                              <span className="text-primary font-medium">
                                clicca per caricare
                              </span>
                            </p>
                          </div>
                        )}
                        <input
                          id="ai-file-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(file);
                          }}
                        />
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground font-medium">oppure</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Text Input */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Descrivi cosa hai mangiato...
                      </Label>
                      <Textarea
                        placeholder="es. 200g di petto di pollo con 80g di riso basmati e insalata mista"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        className="border-border min-h-[80px] resize-none text-base"
                      />
                    </div>

                    <Button
                      onClick={handleAnalyze}
                      disabled={!textInput.trim() && !selectedFile}
                      className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold shadow-lg"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analizza con AI
                    </Button>
                  </div>
                )}

                {phase === "analyzing" && (
                  <div className="py-10 flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                        <Sparkles
                          className="h-8 w-8 text-primary animate-spin"
                          style={{ animationDuration: "3s" }}
                        />
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-medium text-foreground">Analisi in corso...</p>
                      <p className="text-sm text-muted-foreground">
                        L'Intelligenza Artificiale sta calcolando i macronutrienti
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {phase === "result" && result && (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-foreground">{result.foodName}</span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="rounded-lg bg-background p-2 border border-border">
                          <p className="text-lg font-bold text-foreground">{result.calories}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            kcal
                          </p>
                        </div>
                        <div className="rounded-lg bg-background p-2 border border-border">
                          <p className="text-lg font-bold text-primary">{result.protein}g</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Proteine
                          </p>
                        </div>
                        <div className="rounded-lg bg-background p-2 border border-border">
                          <p className="text-lg font-bold text-accent-foreground">
                            {result.carbs}g
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Carbs
                          </p>
                        </div>
                        <div className="rounded-lg bg-background p-2 border border-border">
                          <p className="text-lg font-bold text-destructive">{result.fats}g</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Grassi
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground text-center">
                        Precisione stimata:{" "}
                        <span className="font-semibold text-primary">
                          {result.confidenceScore}%
                        </span>
                      </p>

                      <div
                        className={`flex items-center gap-2 rounded-lg p-2.5 border ${
                          result.qualityScore >= 8
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : result.qualityScore >= 5
                              ? "bg-amber-500/10 border-amber-500/30"
                              : "bg-red-500/10 border-red-500/30"
                        }`}
                      >
                        <Leaf
                          className={`h-4 w-4 ${
                            result.qualityScore >= 8
                              ? "text-emerald-600"
                              : result.qualityScore >= 5
                                ? "text-amber-600"
                                : "text-red-600"
                          }`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold">
                              Qualità Nutrizionale: {result.qualityScore}/10
                            </span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                result.qualityScore >= 8
                                  ? "bg-emerald-500/20 text-emerald-700"
                                  : result.qualityScore >= 5
                                    ? "bg-amber-500/20 text-amber-700"
                                    : "bg-red-500/20 text-red-700"
                              }`}
                            >
                              {result.qualityScore >= 8
                                ? "Ottima"
                                : result.qualityScore >= 5
                                  ? "Discreta"
                                  : "Bassa"}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {result.qualityFeedback}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          resetState();
                        }}
                      >
                        Riprova
                      </Button>
                      <Button
                        className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                        onClick={handleConfirm}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Conferma e Salva
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* === Vault Tab === */}
          <TabsContent value="vault" className="mt-0">
            <ScrollArea className="max-h-[70vh]">
              <div className="p-6 pt-4 space-y-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-destructive" fill="currentColor" />
                  Registra i tuoi pasti preferiti con un clic, senza attese.
                </p>

                {favoritesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i} className="border-border bg-secondary/20">
                        <CardContent className="p-4 space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Heart className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-display font-semibold text-foreground">
                      La tua cassaforte è vuota
                    </p>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                      Quando generi un pasto perfetto con l'AI, clicca sul cuore ❤️ per salvarlo qui e riutilizzarlo con un tap.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {favorites.map((fav) => (
                      <Card
                        key={fav.id}
                        className="border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
                      >
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase tracking-wide"
                            >
                              {fav.meal_type}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFavorite(fav.id)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              aria-label="Rimuovi"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <h4 className="font-display font-semibold text-base text-foreground leading-tight">
                            {fav.name}
                          </h4>
                          {fav.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                              {fav.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <Badge variant="default" className="text-[11px] font-mono">
                              {fav.calories} kcal · {fav.protein}P · {fav.carbs}C · {fav.fats}G
                            </Badge>
                            <Button
                              size="sm"
                              onClick={() => handleLogFavorite(fav)}
                              disabled={logging !== null}
                              className="h-8 gap-1"
                            >
                              {logging === fav.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                              Registra
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* === Manual Tab === */}
          <TabsContent value="manual" className="mt-0">
            <ScrollArea className="max-h-[70vh]">
              <div className="p-6 pt-4 space-y-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <PencilLine className="h-3.5 w-3.5 text-primary" />
                  Inserisci manualmente i valori del pasto. Verranno sommati al totale di oggi.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Calorie <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="1"
                      min="0"
                      placeholder="0 kcal"
                      value={mCalories}
                      onChange={(e) => setMCalories(e.target.value)}
                      className="border-border h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Proteine
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      placeholder="0 g"
                      value={mProtein}
                      onChange={(e) => setMProtein(e.target.value)}
                      className="border-border h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Carboidrati
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      placeholder="0 g"
                      value={mCarbs}
                      onChange={(e) => setMCarbs(e.target.value)}
                      className="border-border h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Grassi
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      placeholder="0 g"
                      value={mFats}
                      onChange={(e) => setMFats(e.target.value)}
                      className="border-border h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Fibre
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      placeholder="0 g"
                      value={mFiber}
                      onChange={(e) => setMFiber(e.target.value)}
                      className="border-border h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Acqua
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      placeholder="0 L"
                      value={mWater}
                      onChange={(e) => setMWater(e.target.value)}
                      className="border-border h-10"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Sodio
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="1"
                      min="0"
                      placeholder="0 mg"
                      value={mSodium}
                      onChange={(e) => setMSodium(e.target.value)}
                      className="border-border h-10"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleManualSubmit}
                  disabled={savingManual || !mCalories.trim()}
                  className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold shadow-lg"
                >
                  {savingManual ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Aggiungi ai Macro di Oggi
                </Button>

                <p className="text-[11px] text-muted-foreground text-center">
                  Solo le calorie sono obbligatorie. Gli altri valori saranno trattati come 0 se vuoti.
                </p>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
