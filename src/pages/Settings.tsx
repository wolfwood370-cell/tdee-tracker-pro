import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
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
import { Settings as SettingsIcon, Loader2, Save, Dumbbell, Trash2 } from "lucide-react";
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
  { value: "sustainable_loss", label: "Perdita di peso sostenibile" },
  { value: "aggressive_minicut", label: "Mini-cut aggressivo" },
  { value: "maintenance", label: "Mantenimento" },
  { value: "weight_gain", label: "Aumento di massa magra" },
];

const DIET_TYPES = [
  { value: "balanced", label: "Bilanciata" },
  { value: "low_fat", label: "Low Fat" },
  { value: "low_carb", label: "Low Carb" },
  { value: "keto", label: "Keto" },
];

const PROTEIN_PREFS = [
  { value: "low", label: "Basso", desc: "Livello base" },
  { value: "moderate", label: "Moderato", desc: "Consigliato" },
  { value: "high", label: "Alto", desc: "Per deficit calorico" },
  { value: "very_high", label: "Molto alto", desc: "Per mini-cut intensi" },
];

export default function Settings() {
  const { user, profile, setProfile, recalculateMetrics } = useAppStore();

  const [fullName, setFullName] = useState("");
  const [sex, setSex] = useState("not_set");
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
  const [deleting, setDeleting] = useState(false);
  const [trackMenstrualCycle, setTrackMenstrualCycle] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setSex(profile.sex ?? "not_set");
      setBirthDate(profile.birth_date ?? "");
      setHeightCm(profile.height_cm?.toString() ?? "");
      setActivityLevel(profile.activity_level?.toString() ?? "1.2");
      setGoalType(profile.goal_type ?? "sustainable_loss");
      setDietType(profile.diet_type ?? "balanced");
      setProteinPref(profile.protein_pref ?? "moderate");
      setCalorieDistribution(profile.calorie_distribution ?? "stable");
      setTrainingDays((profile.training_days_per_week ?? 4).toString());
      setDietStrategy(profile.diet_strategy ?? "linear");
      setTrackMenstrualCycle((profile as Record<string, unknown>).track_menstrual_cycle === true);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const newTrainingDays = parseInt(trainingDays);
      
      // Sync training_schedule when training_days_per_week changes
      const currentSchedule: boolean[] =
        (profile?.training_schedule as boolean[] | null) ??
        [true, false, true, false, true, false, false];
      
      const currentCount = currentSchedule.filter(Boolean).length;
      const newSchedule = [...currentSchedule];
      
      if (currentCount > newTrainingDays) {
        // Too many active days — deactivate from the end
        let excess = currentCount - newTrainingDays;
        for (let i = 6; i >= 0 && excess > 0; i--) {
          if (newSchedule[i]) {
            newSchedule[i] = false;
            excess--;
          }
        }
      }

      const updatePayload: Record<string, unknown> = {
          full_name: fullName || null,
          sex: sex === "not_set" ? null : sex,
          birth_date: birthDate || null,
          height_cm: heightCm ? parseFloat(heightCm) : null,
          activity_level: parseFloat(activityLevel),
          goal_type: goalType,
          diet_type: dietType,
          protein_pref: proteinPref,
          calorie_distribution: calorieDistribution,
          training_days_per_week: newTrainingDays,
          diet_strategy: dietStrategy,
          training_schedule: newSchedule,
          track_menstrual_cycle: trackMenstrualCycle,
      };
      const { data, error } = await supabase
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(updatePayload as any)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      recalculateMetrics();
      toast({ title: "Impostazioni salvate ✓", description: "I tuoi target sono stati aggiornati." });
    } catch (e) {
      console.error("Settings save error:", e);
      toast({ title: "Errore", description: e instanceof Error ? e.message : "Riprova.", variant: "destructive" });
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
                  <SelectItem value="not_set">Seleziona</SelectItem>
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

          {/* Menstrual Cycle Toggle (female only) */}
          {sex === 'F' && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm text-foreground">Traccia Ciclo Mestruale</Label>
                <p className="text-xs text-muted-foreground">Ottimizza il TDEE e ignora gli sbalzi di peso dovuti alla ritenzione idrica.</p>
              </div>
              <Switch checked={trackMenstrualCycle} onCheckedChange={setTrackMenstrualCycle} />
            </div>
          )}
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

          {/* Diet Strategy */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Strategia Dietetica
            </Label>
            <RadioGroup value={dietStrategy} onValueChange={setDietStrategy} className="grid grid-cols-1 gap-2">
              {DIET_STRATEGIES.map((ds) => (
                <label
                  key={ds.value}
                  className={`flex flex-col rounded-lg border p-3 cursor-pointer transition-colors ${
                    dietStrategy === ds.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <RadioGroupItem value={ds.value} className="sr-only" />
                  <span className="text-sm font-semibold text-foreground">{ds.label}</span>
                  <span className="text-xs text-muted-foreground">{ds.desc}</span>
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

      {/* Delete Account */}
      <Card className="glass-card border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Elimina Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Questa azione è irreversibile. Tutti i tuoi dati, log e impostazioni verranno eliminati permanentemente.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={deleting}>
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminazione in corso...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Elimina il mio account
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa azione non può essere annullata. Il tuo account e tutti i dati associati verranno eliminati permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) throw new Error("Non autenticato");
                      
                      const res = await supabase.functions.invoke("delete-user");
                      if (res.error) throw res.error;
                      
                      await supabase.auth.signOut();
                      toast({ title: "Account eliminato", description: "Il tuo account è stato eliminato con successo." });
                    } catch (e) {
                      console.error("Delete account error:", e);
                      toast({ title: "Errore", description: e instanceof Error ? e.message : "Impossibile eliminare l'account.", variant: "destructive" });
                      setDeleting(false);
                    }
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Elimina definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
