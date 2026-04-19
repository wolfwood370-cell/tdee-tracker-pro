import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaywallModal({ open, onOpenChange }: PaywallModalProps) {
  const handleDiscoverPlans = () => {
    toast.info("Integrazione pagamenti in arrivo!", {
      description: "A breve potrai attivare l'abbonamento direttamente da qui.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="font-display text-center text-xl">
            Passa a NC Nutrition Premium
          </DialogTitle>
          <DialogDescription className="text-center pt-1 leading-relaxed">
            Il tuo periodo di prova è terminato. Attiva l'abbonamento per continuare a usare il
            motore metabolico adattivo, il generatore di pasti AI e il supporto diretto del coach.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground space-y-1.5 my-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Algoritmo TDEE adattivo + biofeedback</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>AI Food Logger e Meal Plan illimitati</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Check-in settimanali con il coach</span>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Forse più tardi
          </Button>
          <Button onClick={handleDiscoverPlans} className="gap-1.5">
            Scopri i Piani
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
