import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface AutoRegulationModalProps {
  open: boolean;
  onConfirm: () => void;
}

export function AutoRegulationModal({ open, onConfirm }: AutoRegulationModalProps) {
  if (!open) return null;
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle className="font-display">
              Fatica Metabolica Rilevata ⚠️
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-3 leading-relaxed">
            In base ai tuoi ultimi check-in biofeedback, il tuo corpo sta
            sperimentando un elevato livello di fatica sistemica. Per proteggere
            il tuo metabolismo e la massa muscolare, l'AI Coach ha
            automaticamente messo in pausa il deficit calorico e avviato un{" "}
            <strong className="text-foreground">"Diet Break"</strong>{" "}
            (calorie di mantenimento) per la prossima settimana.
            <br />
            <br />
            Mangia, recupera le energie e fidati del processo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onConfirm} className="w-full">
            Ho capito, aggiorna i miei target
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
