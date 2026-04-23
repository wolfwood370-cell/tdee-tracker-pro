import { useMemo, useState } from "react";
import { BookOpen, GlassWater, Droplets, Leaf, Plus, ShoppingCart, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodayDiary } from "@/components/TodayDiary";
import { QuickWaterButton } from "@/components/QuickWaterButton";
import { AIFoodLoggerModal } from "@/components/AIFoodLoggerModal";
import { AIMealPlanModal } from "@/components/AIMealPlanModal";
import { PaywallModal } from "@/components/PaywallModal";
import { useAppStore } from "@/stores";
import { toLocalISODate } from "@/lib/weeklyBudget";
import { calculateMicronutrients } from "@/lib/algorithms";

const Log = () => {
  const { user, profile, dailyLogs, targetCalories, targetMacros, calibration } = useAppStore();
  const isCalibrating = calibration.isCalibrating;
  const todayStr = toLocalISODate(new Date());

  const [aiOpen, setAiOpen] = useState(false);
  const [mealPlanOpen, setMealPlanOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Phase 89: Soft Paywall — block premium AI actions when subscription expired.
  const isCoach = user?.role === "coach";
  const isExpired =
    !isCoach &&
    (profile as { subscription_status?: string } | null)?.subscription_status === "expired";
  const guardPremium = (action: () => void) => () => {
    if (isExpired) {
      setPaywallOpen(true);
      return;
    }
    action();
  };

  const latestLog = [...dailyLogs].sort(
    (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime(),
  )[0];
  const latestWeight = latestLog?.weight ?? null;
  const latestTbw = useMemo(() => {
    const sorted = [...dailyLogs].sort(
      (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime(),
    );
    return sorted.find((l) => l.tbw != null)?.tbw ?? null;
  }, [dailyLogs]);

  const microTargets = useMemo(() => {
    const activityLevel = profile?.activity_level ?? 1.55;
    return calculateMicronutrients(
      targetCalories ?? 2200,
      typeof activityLevel === "number" ? activityLevel : parseFloat(String(activityLevel)),
      latestWeight,
      latestTbw,
      false,
      profile?.sex ?? null,
    );
  }, [targetCalories, profile?.activity_level, profile?.sex, latestWeight, latestTbw]);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Diario Alimentare</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registra pasti, idratazione e gestisci le idee per i tuoi prossimi pasti.
          </p>
        </div>
      </div>

      {/* Primary actions: AI Logger + Meal Plan */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Button
          onClick={guardPremium(() => setAiOpen(true))}
          className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-md"
        >
          <Plus className="h-4 w-4 mr-1" />
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Aggiungi Pasto
        </Button>
        <Button
          onClick={guardPremium(() => setMealPlanOpen(true))}
          variant="outline"
          className="w-full border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Idee Pasti e Spesa AI
        </Button>
      </div>

      {/* Quick Hydration */}
      <Card className="glass-card border-border">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <GlassWater className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm font-display font-semibold text-foreground">Idratazione Rapida</p>
              <p className="text-xs text-muted-foreground">
                {isCalibrating
                  ? "Tocca per registrare un sorso · target in calibrazione"
                  : `Target: ${microTargets.waterL} L · Tocca per registrare un sorso`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <QuickWaterButton logDate={todayStr} incrementL={0.25} />
            <QuickWaterButton logDate={todayStr} incrementL={0.5} />
          </div>
        </CardContent>
      </Card>

      {/* Micronutrient targets summary — hidden during calibration */}
      {!isCalibrating && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-3 py-2">
            <Droplets className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Elettroliti:</span>
            <span className="text-xs font-semibold text-foreground">
              {microTargets.sodiumMg} mg Na / {microTargets.potassiumMg} mg K
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-3 py-2">
            <Leaf className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Fibre:</span>
            <span className="text-xs font-semibold text-foreground">~{microTargets.fiberG} g</span>
          </div>
        </div>
      )}

      {/* Today's diary entries (edit + delete) */}
      <TodayDiary logDate={todayStr} />

      {/* Modals */}
      <AIFoodLoggerModal open={aiOpen} onOpenChange={setAiOpen} logDate={todayStr} />
      <AIMealPlanModal
        open={mealPlanOpen}
        onOpenChange={setMealPlanOpen}
        targetCalories={targetCalories ?? 2200}
        protein={targetMacros?.protein ?? 0}
        carbs={targetMacros?.carbs ?? 0}
        fats={targetMacros?.fats ?? 0}
        dietType={profile?.diet_type ?? "balanced"}
        dietaryPreference={profile?.dietary_preference ?? "onnivoro"}
        allergies={profile?.allergies ?? ""}
      />
      <PaywallModal open={paywallOpen} onOpenChange={setPaywallOpen} />
    </div>
  );
};

export default Log;
