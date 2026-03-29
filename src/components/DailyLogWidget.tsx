import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, Loader2, Scale, Flame } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { toast } from "@/hooks/use-toast";

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

export function DailyLogWidget() {
  const { user, addLog, updateLog, dailyLogs } = useAppStore();

  const [date, setDate] = useState<Date>(new Date());
  const [weight, setWeight] = useState("");
  const [calories, setCalories] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (!weight && !calories) {
      toast({ title: "Inserisci almeno un valore", description: "Peso o calorie sono richiesti.", variant: "destructive" });
      return;
    }

    const logDate = format(date, "yyyy-MM-dd");
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("daily_metrics")
        .upsert(
          {
            user_id: user.id,
            log_date: logDate,
            weight: weight ? parseFloat(weight) : null,
            calories: calories ? parseInt(calories, 10) : null,
          },
          { onConflict: "user_id,log_date" }
        )
        .select()
        .single();

      if (error) throw error;

      // Update Zustand store
      const existingLog = dailyLogs.find(
        (l) => l.log_date === logDate && l.user_id === user.id
      );
      if (existingLog) {
        updateLog(data);
      } else {
        addLog(data);
      }

      toast({ title: "Dati salvati ✓", description: `Log del ${format(date, "d MMMM yyyy", { locale: it })} registrato.` });
      setWeight("");
      setCalories("");
    } catch (e: any) {
      console.error("Upsert error:", e);
      toast({ title: "Errore nel salvataggio", description: e.message ?? "Riprova più tardi.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          Registra Dati Giornalieri
        </CardTitle>
        <p className="text-xs text-muted-foreground">Inserisci peso e calorie per la giornata selezionata</p>
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
                onSelect={(d) => d && setDate(d)}
                disabled={(d) => d > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Weight & Calories */}
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
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || (!weight && !calories)}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvataggio...
            </>
          ) : (
            "Salva Log"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
