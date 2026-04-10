import { useState, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, Loader2, Scale, Flame, Footprints, FileText, Sparkles } from "lucide-react";
import { AIFoodLoggerModal } from "@/components/AIFoodLoggerModal";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { toast } from "@/hooks/use-toast";
import { InBodySegmentalInputs, emptySegmentalFields, segmentalFromLog, segmentalToPayload, type SegmentalFields } from "@/components/InBodySegmentalInputs";
import type { MenstrualPhase } from "@/lib/algorithms";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface EditTriggerData {
  logDate: string;
  weight: number | null;
  calories: number | null;
  [key: string]: string | number | null | undefined;
}

interface DailyLogWidgetProps {
  editTrigger?: EditTriggerData | null;
  onEditConsumed?: () => void;
}

export function DailyLogWidget({ editTrigger, onEditConsumed }: DailyLogWidgetProps) {
  const { user, addLog, updateLog, dailyLogs, profile } = useAppStore();
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const [date, setDate] = useState<Date>(new Date());
  const [weight, setWeight] = useState("");
  const [calories, setCalories] = useState("");
  const [steps, setSteps] = useState("");
  const [smm, setSmm] = useState("");
  const [bfm, setBfm] = useState("");
  const [pbf, setPbf] = useState("");
  const [vfa, setVfa] = useState("");
  const [bmrInbody, setBmrInbody] = useState("");
  const [segmental, setSegmental] = useState<SegmentalFields>(emptySegmentalFields);
  const [menstrualPhase, setMenstrualPhase] = useState<string>("none");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExternalEdit, setIsExternalEdit] = useState(false);

  const logDate = format(date, "yyyy-MM-dd");
  const existingLog = dailyLogs.find(
    (l) => l.log_date === logDate && l.user_id === user?.id
  );

  const isEditing = !!existingLog;

  useEffect(() => {
    if (isExternalEdit) {
      setIsExternalEdit(false);
      return;
    }
    if (existingLog) {
      setWeight(existingLog.weight?.toString() ?? "");
      setCalories(existingLog.calories?.toString() ?? "");
      setSteps(existingLog.steps?.toString() ?? "");
      setSmm(existingLog.smm?.toString() ?? "");
      setBfm(existingLog.bfm?.toString() ?? "");
      setPbf(existingLog.pbf?.toString() ?? "");
      setVfa(existingLog.vfa?.toString() ?? "");
      setBmrInbody(existingLog.bmr_inbody?.toString() ?? "");
      setSegmental(segmentalFromLog(existingLog));
      setMenstrualPhase(existingLog.menstrual_phase ?? "none");
    } else {
      setWeight("");
      setCalories("");
      setSteps("");
      setSmm("");
      setBfm("");
      setPbf("");
      setVfa("");
      setBmrInbody("");
      setSegmental(emptySegmentalFields);
      setMenstrualPhase("none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logDate, existingLog?.id]);

  useEffect(() => {
    if (editTrigger) {
      setIsExternalEdit(true);
      const d = new Date(editTrigger.logDate + "T00:00:00");
      setDate(d);
      setWeight(editTrigger.weight?.toString() ?? "");
      setCalories(editTrigger.calories?.toString() ?? "");
      setSteps(editTrigger.steps?.toString() ?? "");
      setSmm(editTrigger.smm?.toString() ?? "");
      setBfm(editTrigger.bfm?.toString() ?? "");
      setPbf(editTrigger.pbf?.toString() ?? "");
      setVfa(editTrigger.vfa?.toString() ?? "");
      setBmrInbody(editTrigger.bmr_inbody?.toString() ?? "");
      setSegmental(segmentalFromLog(editTrigger));
      setMenstrualPhase(editTrigger.menstrual_phase?.toString() ?? "none");
      onEditConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTrigger]);

  const handleDateChange = (d: Date) => {
    setDate(d);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!weight && !calories && !steps) {
      toast({ title: "Inserisci almeno un valore", description: "Peso, calorie o passi sono richiesti.", variant: "destructive" });
      return;
    }

    const submitDate = format(date, "yyyy-MM-dd");
    setIsSubmitting(true);

    try {
      const upsertPayload: Record<string, unknown> = {
            user_id: user.id,
            log_date: submitDate,
            weight: weight ? parseFloat(weight) : null,
            calories: calories ? parseInt(calories, 10) : null,
            steps: steps ? parseInt(steps, 10) : null,
            smm: smm ? parseFloat(smm) : null,
            bfm: bfm ? parseFloat(bfm) : null,
            pbf: pbf ? parseFloat(pbf) : null,
            vfa: vfa ? parseFloat(vfa) : null,
            bmr_inbody: bmrInbody ? parseInt(bmrInbody, 10) : null,
            menstrual_phase: menstrualPhase === "none" ? null : menstrualPhase,
            ...segmentalToPayload(segmental),
      };
      const { data, error } = await supabase
        .from("daily_metrics")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(upsertPayload as any, { onConflict: "user_id,log_date" })
        .select()
        .single();

      if (error) throw error;

      const existingEntry = dailyLogs.find(
        (l) => l.log_date === submitDate && l.user_id === user.id
      );
      if (existingEntry) {
        updateLog(data);
      } else {
        addLog(data);
      }

      toast({ title: "Dati salvati ✓", description: `Log del ${format(date, "d MMMM yyyy", { locale: it })} registrato.` });
    } catch (e) {
      console.error("Upsert error:", e);
      toast({ title: "Errore nel salvataggio", description: e instanceof Error ? e.message : "Riprova più tardi.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-0">
      {/* Two-column layout: Log form + InBody accordion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Daily Log Form */}
        <Card className="glass-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              {isEditing ? "Modifica Log" : "Registra Dati Giornalieri"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {isEditing
                ? "Stai modificando un log esistente per questa data"
                : "Inserisci peso e calorie per la giornata selezionata"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal border-border",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "d MMMM yyyy", { locale: it }) : "Seleziona data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && handleDateChange(d)}
                    disabled={(d) => d > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Weight, Calories & Steps */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="weight" className="text-xs text-muted-foreground flex items-center gap-1">
                  <Scale className="h-3 w-3" /> Peso (kg)
                </Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="es. 78.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calories" className="text-xs text-muted-foreground flex items-center gap-1">
                  <Flame className="h-3 w-3" /> Calorie (kcal)
                </Label>
                <Input
                  id="calories"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="es. 2200"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="border-border"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="steps" className="text-xs text-muted-foreground flex items-center gap-1">
                  <Footprints className="h-3 w-3" /> Passi Giornalieri
                </Label>
                <Input
                  id="steps"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="es. 8000"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  className="border-border"
                />
              </div>
            </div>

            {/* Menstrual Cycle Phase (female only) */}
            {profile?.track_menstrual_cycle === true && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">🌸 Fase del Ciclo</Label>
                <Select value={menstrualPhase} onValueChange={setMenstrualPhase}>
                  <SelectTrigger className="border-border">
                    <SelectValue placeholder="Nessuna specifica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuna specifica</SelectItem>
                    <SelectItem value="menstruation">Mestruazioni</SelectItem>
                    <SelectItem value="follicular">Follicolare</SelectItem>
                    <SelectItem value="ovulation">Ovulazione</SelectItem>
                    <SelectItem value="luteal">Luteale / Pre-ciclo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (!weight && !calories && !steps)}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                isEditing ? "Aggiorna Log" : "Salva Log"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right: InBody Data */}
        <Card className="glass-card border-border">
          <CardContent className="pt-6 space-y-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="inbody" className="border-border">
                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                  <span className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Aggiungi dati InBody (Opzionale)
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Massa Muscolare (kg)</Label>
                      <Input type="number" step="0.1" min="0" placeholder="es. 32.5" value={smm} onChange={(e) => setSmm(e.target.value)} className="border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Massa Grassa (kg)</Label>
                      <Input type="number" step="0.1" min="0" placeholder="es. 15.2" value={bfm} onChange={(e) => setBfm(e.target.value)} className="border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">% Massa Grassa</Label>
                      <Input type="number" step="0.1" min="0" max="100" placeholder="es. 18.5" value={pbf} onChange={(e) => setPbf(e.target.value)} className="border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Grasso Viscerale</Label>
                      <Input type="number" step="1" min="0" placeholder="es. 8" value={vfa} onChange={(e) => setVfa(e.target.value)} className="border-border" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Metabolismo Basale InBody (kcal)</Label>
                      <Input type="number" step="1" min="0" placeholder="es. 1650" value={bmrInbody} onChange={(e) => setBmrInbody(e.target.value)} className="border-border" />
                    </div>
                  </div>

                  {/* Segmental Analysis */}
                  <InBodySegmentalInputs fields={segmental} onChange={setSegmental} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
