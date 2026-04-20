import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings as SettingsIcon, Loader2, Save, Dumbbell, Trash2, Salad, LogOut } from "lucide-react";
import { PushNotificationManager } from "@/components/PushNotificationManager";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  const { user, profile, setProfile, logout } = useAppStore();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [sex, setSex] = useState("not_set");
  const [birthDate, setBirthDate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [activityLevel, setActivityLevel] = useState("1.2");
  const [dietType, setDietType] = useState("balanced");
  const [proteinPref, setProteinPref] = useState("moderate");
  const [calorieDistribution, setCalorieDistribution] = useState("stable");
  const [trainingDays, setTrainingDays] = useState("4");
  const [dietStrategy, setDietStrategy] = useState("linear");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [trackMenstrualCycle, setTrackMenstrualCycle] = useState(false);
  const [dietaryPreference, setDietaryPreference] = useState("onnivoro");
  const [allergies, setAllergies] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setSex(profile.sex ?? "not_set");
      setBirthDate(profile.birth_date ?? "");
      setHeightCm(profile.height_cm?.toString() ?? "");
      setActivityLevel(profile.activity_level?.toString() ?? "1.2");
      setDietType(profile.diet_type ?? "balanced");
      setProteinPref(profile.protein_pref ?? "moderate");
      setCalorieDistribution(profile.calorie_distribution ?? "stable");
      setTrainingDays((profile.training_days_per_week ?? 4).toString());
      setDietStrategy(profile.diet_strategy ?? "linear");
      setTrackMenstrualCycle(profile.track_menstrual_cycle === true);
      setDietaryPreference(profile.dietary_preference ?? "onnivoro");
      setAllergies(profile.allergies ?? "");
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

      const previousStrategy = profile?.diet_strategy ?? "linear";
      const strategyChanged = dietStrategy !== previousStrategy;

      const updatePayload: Record<string, unknown> = {
          full_name: fullName || null,
          sex: sex === "not_set" ? null : sex,
          birth_date: birthDate || null,
          height_cm: heightCm ? parseFloat(heightCm) : null,
          activity_level: parseFloat(activityLevel),
          diet_type: dietType,
          protein_pref: proteinPref,
          calorie_distribution: calorieDistribution,
          training_days_per_week: newTrainingDays,
          diet_strategy: dietStrategy,
          training_schedule: newSchedule,
          weekly_schedule: (() => {
            const keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
            const existing = (profile?.weekly_schedule as Record<string, string> | null) ?? {};
            const out: Record<string, "training" | "rest" | "refeed"> = {} as Record<string, "training" | "rest" | "refeed">;
            keys.forEach((k, i) => {
              if (existing[k] === "refeed") {
                out[k] = "refeed";
              } else {
                out[k] = newSchedule[i] ? "training" : "rest";
              }
            });
            return out;
          })(),
           track_menstrual_cycle: trackMenstrualCycle,
           dietary_preference: dietaryPreference,
           allergies: allergies.trim() || null,
      };
      // Phase 82: reset strategy_start_date when diet strategy changes,
      // so MATADOR/Reverse week counting starts fresh from today.
      if (strategyChanged) {
        updatePayload.strategy_start_date = new Date().toISOString();
      }
      const { data, error } = await supabase
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(updatePayload as any)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      toast({ title: "Impostazioni salvate", description: "I tuoi target sono stati aggiornati." });
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

      <Accordion
        type="multiple"
        defaultValue={["biometrics"]}
        className="space-y-3"
      >
        {/* ============ GROUP 1: BIOMETRICS ============ */}
        <AccordionItem
          value="biometrics"
          className="glass-card border border-border rounded-lg px-4"
        >
          <AccordionTrigger className="text-base font-display font-semibold hover:no-underline">
            Impostazioni Biometriche
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
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
          </AccordionContent>
        </AccordionItem>

        {/* ============ GROUP: NUTRITION & GOALS ============ */}
        <AccordionItem
          value="nutrition"
          className="glass-card border border-border rounded-lg px-4"
        >
          <AccordionTrigger className="text-base font-display font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              Nutrizione & Obiettivi
            </span>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
          <div className="space-y-5">
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

          {/* Dietary Preference & Allergies */}
          <div className="space-y-3 rounded-lg border border-border p-4 bg-secondary/20">
            <div className="flex items-center gap-2">
              <Salad className="h-4 w-4 text-primary" />
              <Label className="text-sm font-display font-semibold text-foreground">Preferenze Alimentari</Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Stile alimentare</Label>
              <Select value={dietaryPreference} onValueChange={setDietaryPreference}>
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onnivoro">🥩 Onnivoro</SelectItem>
                  <SelectItem value="vegetariano">🥗 Vegetariano</SelectItem>
                  <SelectItem value="vegano">🌱 Vegano</SelectItem>
                  <SelectItem value="pescatariano">🐟 Pescatariano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Allergie e intolleranze (opzionale)</Label>
              <Textarea
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Es: lattosio, glutine, frutta a guscio, uova..."
                className="border-border min-h-[70px] text-base"
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground">L'AI eviterà questi ingredienti nei piani pasto generati.</p>
            </div>
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
          </div>
          </AccordionContent>
        </AccordionItem>

        {/* ============ GROUP 2: SUBSCRIPTION ============ */}
        <AccordionItem
          value="subscription"
          className="glass-card border border-border rounded-lg px-4"
        >
          <AccordionTrigger className="text-base font-display font-semibold hover:no-underline">
            Abbonamento e Pagamenti
          </AccordionTrigger>
          <AccordionContent className="pt-2 space-y-3">
            <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stato abbonamento</span>
                <span className="text-sm font-semibold text-foreground capitalize">
                  {profile?.subscription_status ?? "—"}
                </span>
              </div>
              {profile?.trial_ends_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Periodo di prova fino al</span>
                  <span className="text-sm font-semibold text-foreground">
                    {new Date(profile.trial_ends_at).toLocaleDateString("it-IT")}
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-1">
                Per gestire il tuo abbonamento o aggiornare il metodo di pagamento, contatta il tuo coach.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ============ GROUP 3: SECURITY & PRIVACY ============ */}
        <AccordionItem
          value="security"
          className="glass-card border border-destructive/30 rounded-lg px-4"
        >
          <AccordionTrigger className="text-base font-display font-semibold hover:no-underline">
            Sicurezza e Privacy
          </AccordionTrigger>
          <AccordionContent className="pt-2 space-y-4">
            {/* Logout removed: only top-right header button is used */}

            {/* Push Notifications */}
            <PushNotificationManager />

            {/* Privacy & Cookie Policy links (hosted on Iubenda) */}
            <div className="rounded-lg border border-border p-4 space-y-2">
              <p className="text-sm font-display font-semibold text-foreground">
                Privacy e Cookie
              </p>
              <p className="text-xs text-muted-foreground">
                Consulta le nostre policy ufficiali aggiornate.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="w-full">
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <a href="/cookies" target="_blank" rel="noopener noreferrer">
                    Cookie Policy
                  </a>
                </Button>
              </div>
            </div>

            {/* Delete Account */}
            <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                <span className="font-display font-semibold">Elimina Account</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Questa azione è irreversibile. Tutti i tuoi dati, log e impostazioni verranno eliminati permanentemente.
              </p>
              <AlertDialog>
            <AlertDialogTrigger asChild>
              <span className="block w-full">
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
              </span>
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
                      
                      // User no longer exists server-side: clear local session only
                      // (a global signOut would 403 on user_not_found and leave a ghost token).
                      try {
                        await supabase.auth.signOut({ scope: 'local' });
                      } catch (e) {
                        console.warn("Local signOut warning:", e);
                      }

                      // Reset Zustand store and clear app-managed local storage
                      logout();
                      try {
                        Object.keys(localStorage)
                          .filter((k) => k.startsWith('sb-') || k.startsWith('nc-') || k === 'app-storage')
                          .forEach((k) => localStorage.removeItem(k));
                      } catch {
                        // localStorage may be unavailable (private mode); safe to ignore.
                      }

                      toast({ title: "Account eliminato", description: "Il tuo account è stato eliminato con successo." });
                      navigate("/", { replace: true });
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
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
