import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

const CURRENT_VERSION = "1.1.0";
const STORAGE_KEY = "nc_nutrition_seen_version";

export const ReleaseNotesModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen === CURRENT_VERSION) {
        setOpen(false);
      } else {
        setOpen(true);
      }
    } catch {
      // localStorage may be unavailable (private mode); skip silently.
    }
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    } catch {
      // safe to ignore
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : setOpen(true))}>
      <DialogContent className="sm:max-w-md border-primary/20 bg-gradient-to-br from-background via-background to-primary/5 shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-mono text-xs">
              Versione {CURRENT_VERSION}
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Novità della Piattaforma
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Abbiamo migliorato la tua esperienza con aggiornamenti pensati per te.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">🌿 Nuovo Nutrition Hub dedicato</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Un'area centralizzata per consultare strategie nutrizionali, idee pasti AI e liste della spesa intelligenti.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">⚡ Algoritmo metabolico più preciso</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Introdotti limiti fisiologici sui grassi e ridistribuzione automatica delle calorie per macro più equilibrati e sicuri.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">🌙 Miglioramenti UI Dark Mode</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Contrasti ottimizzati, alert leggibili e dettagli visivi più raffinati per un'esperienza confortevole anche di notte.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
            Ho capito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReleaseNotesModal;
