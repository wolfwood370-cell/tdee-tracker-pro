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
import { Settings as SettingsIcon, Loader2, Save } from "lucide-react";

const ACTIVITY_LEVELS = [
  { value: "1.2", label: "Sedentario (ufficio, poco movimento)" },
  { value: "1.375", label: "Leggermente attivo (1-3 allenamenti/sett)" },
  { value: "1.55", label: "Moderatamente attivo (3-5 allenamenti/sett)" },
  { value: "1.725", label: "Molto attivo (6-7 allenamenti/sett)" },
  { value: "1.9", label: "Estremamente attivo (atleta)" },
];

const GOAL_RATES = [
  { value: "-0.75", label: "Dimagrimento aggressivo (-0.75 kg/sett)" },
  { value: "-0.5", label: "Dimagrimento moderato (-0.5 kg/sett)" },
  { value: "-0.25", label: "Dimagrimento leggero (-0.25 kg/sett)" },
  { value: "0", label: "Mantenimento" },
  { value: "0.25", label: "Surplus leggero (+0.25 kg/sett)" },
  { value: "0.5", label: "Surplus moderato (+0.5 kg/sett)" },
];

export default function Settings() {
  const { user, profile, setProfile, recalculateMetrics } = useAppStore();

  const [fullName, setFullName] = useState("");
  const [sex, setSex] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [goalRate, setGoalRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setSex(profile.sex ?? "");
      setBirthDate(profile.birth_date ?? "");
      setHeightCm(profile.height_cm?.toString() ?? "");
      setActivityLevel(profile.activity_level?.toString() ?? "1.2");
      setGoalRate(profile.goal_rate?.toString() ?? "0");
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
          goal_rate: parseFloat(goalRate),
        })
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
        </CardContent>
      </Card>

      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display">Parametri di Calcolo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Modifica questi valori per ricalcolare istantaneamente i tuoi target
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Obiettivo Settimanale</Label>
            <Select value={goalRate} onValueChange={setGoalRate}>
              <SelectTrigger className="border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_RATES.map((gr) => (
                  <SelectItem key={gr.value} value={gr.value}>
                    {gr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
