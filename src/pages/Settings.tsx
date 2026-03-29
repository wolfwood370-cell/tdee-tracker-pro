import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { toast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings as SettingsIcon, Loader2, Save, Dumbbell } from "lucide-react";

const ACTIVITY_LEVELS = [
  { value: "1.2", label: "Sedentario (ufficio, poco movimento)" },
  { value: "1.375", label: "Leggermente attivo (1-3 allenamenti/sett)" },
  { value: "1.55", label: "Moderatamente attivo (3-5 allenamenti/sett)" },
  { value: "1.725", label: "Molto attivo (6-7 allenamenti/sett)" },
  { value: "1.9", label: "Estremamente attivo (atleta)" },
];

const DIET_STRATEGIES = [
  { value: "linear", label: "Lineare", desc: "Deficit costante ogni giorno" },
  { value: "refeed_1_day", label: "Refeed 1 giorno", desc: "1 giorno a mantenimento (Dom), deficit distribuito nei restanti 6" },
  { value: "refeed_2_days", label: "Refeed 2 giorni", desc: "2 giorni a mantenimento (Sab-Dom), deficit distribuito nei restanti 5" },
  { value: "matador_break", label: "MATADOR", desc: "Ciclo 2 sett deficit + 2 sett mantenimento" },
  { value: "reverse_diet", label: "Reverse Diet", desc: "Post-cut: +75 kcal/sett fino al TDEE" },
];

const GOAL_TYPES = [
  { value: "sustainable_loss", label: "Dimagrimento sostenibile (-0.5% BW/sett)" },
  { value: "aggressive_minicut", label: "Mini-cut aggressivo (-1% BW/sett)" },
  { value: "maintenance", label: "Mantenimento" },
  { value: "weight_gain", label: "Aumento massa (+0.3% BW/sett)" },
];

const DIET_TYPES = [
  { value: "balanced", label: "Bilanciata (50/50 carb/grassi)" },
  { value: "low_fat", label: "Low Fat (grassi minimi 0.6g/kg)" },
  { value: "low_carb", label: "Low Carb (carb fissi 1g/kg)" },
  { value: "keto", label: "Keto (max 30g carb)" },
];

const PROTEIN_PREFS = [
  { value: "low", label: "1.6 g/kg", desc: "Basso" },
  { value: "moderate", label: "2.0 g/kg", desc: "Moderato" },
  { value: "high", label: "2.2 g/kg", desc: "Alto" },
  { value: "very_high", label: "2.6 g/kg", desc: "Molto alto" },
];

export default function Settings() {
  const { user, profile, setProfile, recalculateMetrics } = useAppStore();

  const [fullName, setFullName] = useState("");
  const [sex, setSex] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [activityLevel, setActivityLevel] = useState("1.2");
  const [goalType, setGoalType] = useState("sustainable_loss");
  const [dietType, setDietType] = useState("balanced");
  const [proteinPref, setProteinPref] = useState("moderate");
  const [calorieDistribution, setCalorieDistribution] = useState("stable");
  const [trainingDays, setTrainingDays] = useState("4");
  const [dietStrategy, setDietStrategy] = useState("linear");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setSex(profile.sex ?? "");
      setBirthDate(profile.birth_date ?? "");
      setHeightCm(profile.height_cm?.toString() ?? "");
      setActivityLevel(profile.activity_level?.toString() ?? "1.2");
      setGoalType((profile as any).goal_type ?? "sustainable_loss");
      setDietType((profile as any).diet_type ?? "balanced");
      setProteinPref((profile as any).protein_pref ?? "moderate");
      setCalorieDistribution((profile as any).calorie_distribution ?? "stable");
      setTrainingDays(((profile as any).training_days_per_week ?? 4).toString());
      setDietStrategy((profile as any).diet_strategy ?? "linear");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          sex: sex || null,
          birth_date: birthDate || null,
          height_cm: heightCm ? parseFloat(heightCm) : null,
          activity_level: parseFloat(activityLevel),
          goal_type: goalType,
          diet_type: dietType,
          protein_pref: proteinPref,
          calorie_distribution: calorieDistribution,
          training_days_per_week: parseInt(trainingDays),
        } as any)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      recalculateMetrics();
      toast({ title: "Impostazioni salvate ✓", description: "I tuoi target sono stati aggiornati." });
    } catch (e: any) {
      console.error("Settings save error:", e);
      toast({ title: "Errore", description: e.message ?? "Riprova.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Impostazioni
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestisci il tuo profilo e le variabili di calcolo
        </p>
      </div>

      {/* Profile Card */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display">Profilo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome completo</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="es. Marco Rossi"
              className="border-border"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sesso</Label>
              <Select value={sex} onValueChange={setSex}>
                <SelectTrigger className="border-border">
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Maschio</SelectItem>
                  <SelectItem value="F">Femmina</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data di nascita</Label>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="border-border"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Altezza (cm)</Label>
            <Input
              type="number"
              min="100"
              max="250"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="es. 178"
              className="border-border"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Livello di Attività</Label>
            <Select value={activityLevel} onValueChange={setActivityLevel}>
              <SelectTrigger className="border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_LEVELS.map((al) => (
                  <SelectItem key={al.value} value={al.value}>
                    {al.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Nutrition & Goals Card */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            Nutrizione & Obiettivi
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Questi parametri determinano i tuoi target calorici e macro giornalieri
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Goal Type */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Obiettivo
            </Label>
            <RadioGroup value={goalType} onValueChange={setGoalType} className="grid grid-cols-1 gap-2">
              {GOAL_TYPES.map((gt) => (
                <label
                  key={gt.value}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    goalType === gt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <RadioGroupItem value={gt.value} />
                  <span className="text-sm text-foreground">{gt.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Diet Type */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Tipo di Dieta
            </Label>
            <Select value={dietType} onValueChange={setDietType}>
              <SelectTrigger className="border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIET_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>
                    {dt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Protein Preference */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Proteine Target
            </Label>
            <RadioGroup value={proteinPref} onValueChange={setProteinPref} className="grid grid-cols-2 gap-2">
              {PROTEIN_PREFS.map((pp) => (
                <label
                  key={pp.value}
                  className={`flex flex-col items-center rounded-lg border p-3 cursor-pointer transition-colors ${
                    proteinPref === pp.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <RadioGroupItem value={pp.value} className="sr-only" />
                  <span className="text-sm font-semibold text-foreground">{pp.label}</span>
                  <span className="text-xs text-muted-foreground">{pp.desc}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Calorie Distribution */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Distribuzione Calorica
            </Label>
            <RadioGroup value={calorieDistribution} onValueChange={setCalorieDistribution} className="grid grid-cols-2 gap-2">
              <label
                className={`flex flex-col rounded-lg border p-3 cursor-pointer transition-colors ${
                  calorieDistribution === "stable"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <RadioGroupItem value="stable" className="sr-only" />
                <span className="text-sm font-semibold text-foreground">Stabile</span>
                <span className="text-xs text-muted-foreground">Stesse kcal ogni giorno</span>
              </label>
              <label
                className={`flex flex-col rounded-lg border p-3 cursor-pointer transition-colors ${
                  calorieDistribution === "polarized"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <RadioGroupItem value="polarized" className="sr-only" />
                <span className="text-sm font-semibold text-foreground">Polarizzata</span>
                <span className="text-xs text-muted-foreground">+20% nei giorni di allenamento</span>
              </label>
            </RadioGroup>
          </div>

          {/* Training Days (only if polarized) */}
          {calorieDistribution === "polarized" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Giorni di allenamento / settimana</Label>
              <Select value={trainingDays} onValueChange={setTrainingDays}>
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((d) => (
                    <SelectItem key={d} value={d.toString()}>
                      {d} giorni
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleSave} disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salva Impostazioni
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
