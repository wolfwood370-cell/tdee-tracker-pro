import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Trash2, Pencil, FileText } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { toast } from "@/hooks/use-toast";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LogHistoryTableProps {
  onEditLog?: (logDate: string, weight: number | null, calories: number | null, extra?: Record<string, any>) => void;
}

export function LogHistoryTable({ onEditLog }: LogHistoryTableProps) {
  const { dailyLogs, deleteLog } = useAppStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sorted = [...dailyLogs].sort(
    (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);

    deleteLog(deleteId);

    const { error } = await supabase
      .from("daily_metrics")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare il record.", variant: "destructive" });
    } else {
      toast({ title: "Record eliminato ✓" });
    }

    setDeleteId(null);
    setIsDeleting(false);
  };

  const handleEdit = (log: typeof sorted[0]) => {
    const l = log as any;
    const { id, user_id, log_date, weight, calories, is_interpolated, notes, ...extra } = l;
    onEditLog?.(log.log_date, log.weight, log.calories, extra);
  };

  if (sorted.length === 0) return null;

  return (
    <>
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display">Storico Log</CardTitle>
          <p className="text-xs text-muted-foreground">I tuoi dati giornalieri registrati</p>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Peso</TableHead>
                  <TableHead>Calorie</TableHead>
                  <TableHead>Passi</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((log) => {
                  const hasBia = (log as any).pbf != null;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          {format(new Date(log.log_date + "T00:00:00"), "d MMM yyyy", { locale: it })}
                          {hasBia && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5">
                                    <FileText className="h-2.5 w-2.5" />
                                    BIA
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Dati InBody registrati</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.weight != null ? `${log.weight} kg` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.calories != null ? `${log.calories} kcal` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(log as any).steps != null ? (log as any).steps.toLocaleString("it-IT") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(log)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(log.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questo record?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Il record verrà rimosso definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
