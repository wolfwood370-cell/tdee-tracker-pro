import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MEASUREMENT_GROUPS, REDUCTION_POSITIVE_KEYS } from "@/types/progress";
import type { ProgressEntry } from "@/types/progress";
import { useAppStore } from "@/stores";
import { ArrowDown, ArrowUp, Camera } from "lucide-react";

interface Props {
  entries: ProgressEntry[];
}

const ALL_MEASUREMENTS = [
  { key: "weight", label: "Peso", unit: "kg" },
  ...MEASUREMENT_GROUPS.torso.map((m) => ({ ...m, unit: "cm" })),
  ...MEASUREMENT_GROUPS.limbs.map((m) => ({ ...m, unit: "cm" })),
];

export function ProgressComparison({ entries }: Props) {
  const { profile } = useAppStore();
  const goalType = profile?.goal_type ?? "sustainable_loss";
  const isBulk = goalType === "lean_bulk" || goalType === "aggressive_bulk";

  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()),
    [entries]
  );

  const [dateA, setDateA] = useState<string>("");
  const [dateB, setDateB] = useState<string>("");

  // Sync selectors when entries change
  useEffect(() => {
    if (sorted.length >= 2) {
      setDateA(sorted[0].id);
      setDateB(sorted[sorted.length - 1].id);
    }
  }, [sorted]);

  const entryA = sorted.find((e) => e.id === dateA);
  const entryB = sorted.find((e) => e.id === dateB);

  if (sorted.length < 2) {
    return (
      <Card className="glass-card border-border">
        <CardContent className="py-12 text-center">
          <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Servono almeno 2 check-in per la comparativa.</p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });

  const renderDelta = (key: string, valA: number | null, valB: number | null) => {
    if (valA == null || valB == null) return <span className="text-muted-foreground text-xs">—</span>;
    const delta = valB - valA;
    if (Math.abs(delta) < 0.05) return <span className="text-muted-foreground text-xs">—</span>;

    // In bulk mode, weight gain is positive; in cut mode, weight loss is positive
    const isWeightKey = key === "weight";
    const isReductionPositive = REDUCTION_POSITIVE_KEYS.includes(key) || (isWeightKey && !isBulk);
    const isPositiveChange = isReductionPositive ? delta < 0 : delta > 0;

    return (
      <Badge variant="outline" className={`text-xs gap-1 ${isPositiveChange ? "text-emerald-500 border-emerald-500/30" : "text-amber-500 border-amber-500/30"}`}>
        {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {delta > 0 ? "+" : ""}{delta.toFixed(1)}
      </Badge>
    );
  };

  const renderNutritionCard = (entry: ProgressEntry, label: string) => (
    <div className="bg-secondary/50 rounded-lg p-3 space-y-1 flex-1">
      <p className="text-xs font-semibold text-primary">{label} — {formatDate(entry.entry_date)}</p>
      <p className="text-xs text-foreground">
        {entry.snap_calories ?? "—"} kcal ({entry.snap_protein ?? "—"}P / {entry.snap_carbs ?? "—"}C / {entry.snap_fats ?? "—"}F)
      </p>
      <p className="text-xs text-muted-foreground">
        TDEE: {entry.snap_tdee ?? "—"} kcal · Na: {entry.snap_sodium ?? "—"} mg · Acqua: {entry.snap_water ?? "—"} L
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Date selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Baseline (Data A)</p>
          <Select value={dateA} onValueChange={setDateA}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((e) => (
                <SelectItem key={e.id} value={e.id}>{formatDate(e.entry_date)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Attuale (Data B)</p>
          <Select value={dateB} onValueChange={setDateB}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((e) => (
                <SelectItem key={e.id} value={e.id}>{formatDate(e.entry_date)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {entryA && entryB && (
        <>
          {/* Photo comparison */}
          {(entryA.photo_front || entryB.photo_front || entryA.photo_side || entryB.photo_side || entryA.photo_back || entryB.photo_back) && (
            <Card className="glass-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display">Confronto Visivo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {(["front", "side", "back"] as const).map((pos) => {
                    const photoA = entryA[`photo_${pos}`];
                    const photoB = entryB[`photo_${pos}`];
                    if (!photoA && !photoB) return null;
                    const posLabel = pos === "front" ? "Fronte" : pos === "side" ? "Lato" : "Retro";
                    return (
                      <div key={pos} className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">{posLabel}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg overflow-hidden bg-secondary/30 aspect-[3/4] flex items-center justify-center">
                            {photoA ? (
                              <img src={photoA} alt={`${posLabel} A`} className="w-full h-full object-cover" />
                            ) : (
                              <Camera className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                          <div className="rounded-lg overflow-hidden bg-secondary/30 aspect-[3/4] flex items-center justify-center">
                            {photoB ? (
                              <img src={photoB} alt={`${posLabel} B`} className="w-full h-full object-cover" />
                            ) : (
                              <Camera className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Measurement delta table */}
          <Card className="glass-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display">Variazioni Misure</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Misura</TableHead>
                    <TableHead className="text-xs text-center">{formatDate(entryA.entry_date)}</TableHead>
                    <TableHead className="text-xs text-center">{formatDate(entryB.entry_date)}</TableHead>
                    <TableHead className="text-xs text-center">Delta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALL_MEASUREMENTS.map((m) => {
                    const valA = (entryA as Record<string, number | null>)[m.key] ?? null;
                    const valB = (entryB as Record<string, number | null>)[m.key] ?? null;
                    return (
                      <TableRow key={m.key}>
                        <TableCell className="text-xs font-medium">{m.label}</TableCell>
                        <TableCell className="text-xs text-center">{valA != null ? `${valA} ${m.unit}` : "—"}</TableCell>
                        <TableCell className="text-xs text-center">{valB != null ? `${valB} ${m.unit}` : "—"}</TableCell>
                        <TableCell className="text-center">{renderDelta(m.key, valA, valB)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Nutrition context */}
          <Card className="glass-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display">Contesto Nutrizionale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                {renderNutritionCard(entryA, "Baseline")}
                {renderNutritionCard(entryB, "Attuale")}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
