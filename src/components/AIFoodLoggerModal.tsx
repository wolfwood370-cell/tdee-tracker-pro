import { useState, useCallback } from "react";
import { Camera, Sparkles, FileText, X, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { parseMealWithAI, type AIParsedMeal } from "@/lib/aiService";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AIFoodLoggerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logDate: string;
}

type Phase = "input" | "analyzing" | "result";

export function AIFoodLoggerModal({ open, onOpenChange, logDate }: AIFoodLoggerModalProps) {
  const { user, dailyLogs, addLog, updateLog } = useAppStore();

  const [phase, setPhase] = useState<Phase>("input");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AIParsedMeal | null>(null);

  const resetState = useCallback(() => {
    setPhase("input");
    setTextInput("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
  }, []);

  const handleClose = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileSelect(file);
  }, []);

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

  const handleConfirm = async () => {
    if (!result || !user) return;

    const existingLog = dailyLogs.find(
      (l) => l.log_date === logDate && l.user_id === user.id
    );

    const newCalories = (existingLog?.calories ?? 0) + result.calories;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upsertPayload: Record<string, unknown> = {
        user_id: user.id,
        log_date: logDate,
        calories: newCalories,
        weight: existingLog?.weight ?? null,
        steps: existingLog?.steps ?? null,
      };

      const { data, error } = await supabase
        .from("daily_metrics")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(upsertPayload as any, { onConflict: "user_id,log_date" })
        .select()
        .single();

      if (error) throw error;

      if (existingLog) {
        updateLog(data);
      } else {
        addLog(data);
      }

      toast.success(
        `Pasto loggato con successo! Precisione stimata: ${result.confidenceScore}%`,
        { description: `${result.foodName} — ${result.calories} kcal` }
      );
      handleClose(false);
    } catch (e) {
      console.error("AI log save error:", e);
      toast.error("Errore nel salvataggio del pasto.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg border-border bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Smart Log
          </DialogTitle>
        </DialogHeader>

        {phase === "input" && (
          <div className="space-y-5">
            {/* Image Upload Zone */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">📸 Scansiona Piatto</Label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="relative border-2 border-dashed border-primary/30 rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-primary/60 hover:bg-primary/5"
                onClick={() => document.getElementById("ai-file-input")?.click()}
              >
                {previewUrl ? (
                  <div className="relative">
                    <img src={previewUrl} alt="Preview" className="max-h-40 mx-auto rounded-lg object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPreviewUrl(null); }}
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
                      Trascina una foto o <span className="text-primary font-medium">clicca per caricare</span>
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
              <Label className="text-xs text-muted-foreground mb-2 block">🎤 Descrivi cosa hai mangiato...</Label>
              <Textarea
                placeholder="es. 200g di petto di pollo con 80g di riso basmati e insalata mista"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="border-border min-h-[80px] resize-none"
              />
            </div>

            {/* Submit */}
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
                <Sparkles className="h-8 w-8 text-primary animate-spin" style={{ animationDuration: "3s" }} />
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
            {/* Parsed Result */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">{result.foodName}</span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-background p-2 border border-border">
                  <p className="text-lg font-bold text-foreground">{result.calories}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">kcal</p>
                </div>
                <div className="rounded-lg bg-background p-2 border border-border">
                  <p className="text-lg font-bold text-blue-500">{result.protein}g</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Proteine</p>
                </div>
                <div className="rounded-lg bg-background p-2 border border-border">
                  <p className="text-lg font-bold text-amber-500">{result.carbs}g</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Carbs</p>
                </div>
                <div className="rounded-lg bg-background p-2 border border-border">
                  <p className="text-lg font-bold text-rose-500">{result.fats}g</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Grassi</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Precisione stimata: <span className="font-semibold text-primary">{result.confidenceScore}%</span>
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { resetState(); }}>
                Riprova
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-primary to-primary/80" onClick={handleConfirm}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Conferma e Salva
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
