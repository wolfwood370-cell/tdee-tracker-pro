import { useMemo } from "react";
import { BookOpen, GlassWater, Droplets, Leaf } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TodayDiary } from "@/components/TodayDiary";
import { DailyLogWidget } from "@/components/DailyLogWidget";
import { QuickWaterButton } from "@/components/QuickWaterButton";
import { useAppStore } from "@/stores";
import { toLocalISODate } from "@/lib/weeklyBudget";
import { calculateMicronutrients } from "@/lib/algorithms";

const Log = () => {
  const { profile, dailyLogs, targetCalories } = useAppStore();
  const todayStr = toLocalISODate(new Date());

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
            Registra pasti, peso e idratazione di oggi.
          </p>
        </div>
      </div>

      {/* Quick Hydration */}
      <Card className="glass-card border-border">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <GlassWater className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm font-display font-semibold text-foreground">Idratazione Rapida</p>
              <p className="text-xs text-muted-foreground">
                Target: {microTargets.waterL} L · Tocca per registrare un sorso
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <QuickWaterButton logDate={todayStr} incrementL={0.25} />
            <QuickWaterButton logDate={todayStr} incrementL={0.5} />
          </div>
        </CardContent>
      </Card>

      {/* Micronutrient targets summary */}
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

      {/* Today's diary entries (deletable) */}
      <TodayDiary logDate={todayStr} />

      {/* Manual daily log widget */}
      <DailyLogWidget />
    </div>
  );
};

export default Log;
