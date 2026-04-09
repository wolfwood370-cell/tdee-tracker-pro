import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

/**
 * All 21 segmental InBody fields + tbw, keyed exactly
 * as the DB columns for easy spreading into upsert payloads.
 */
export interface SegmentalFields {
  tbw: string;
  lean_ra_kg: string; lean_ra_pct: string;
  lean_la_kg: string; lean_la_pct: string;
  lean_tr_kg: string; lean_tr_pct: string;
  lean_rl_kg: string; lean_rl_pct: string;
  lean_ll_kg: string; lean_ll_pct: string;
  fat_ra_kg: string;  fat_ra_pct: string;
  fat_la_kg: string;  fat_la_pct: string;
  fat_tr_kg: string;  fat_tr_pct: string;
  fat_rl_kg: string;  fat_rl_pct: string;
  fat_ll_kg: string;  fat_ll_pct: string;
}

export const emptySegmentalFields: SegmentalFields = {
  tbw: "",
  lean_ra_kg: "", lean_ra_pct: "",
  lean_la_kg: "", lean_la_pct: "",
  lean_tr_kg: "", lean_tr_pct: "",
  lean_rl_kg: "", lean_rl_pct: "",
  lean_ll_kg: "", lean_ll_pct: "",
  fat_ra_kg: "",  fat_ra_pct: "",
  fat_la_kg: "",  fat_la_pct: "",
  fat_tr_kg: "",  fat_tr_pct: "",
  fat_rl_kg: "",  fat_rl_pct: "",
  fat_ll_kg: "",  fat_ll_pct: "",
};

/** Convert string fields → numeric payload for DB upsert. Only non-empty fields are included. */
export function segmentalToPayload(f: SegmentalFields): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [key, val] of Object.entries(f)) {
    if (val !== "") {
      out[key] = key.endsWith("_pct") || key === "tbw"
        ? parseFloat(val)
        : key.endsWith("_kg")
          ? parseFloat(val)
          : parseFloat(val);
    }
  }
  return out;
}

/** Populate SegmentalFields from a log record (any). */
export function segmentalFromLog(log: any): SegmentalFields {
  const f = { ...emptySegmentalFields };
  for (const key of Object.keys(f) as (keyof SegmentalFields)[]) {
    if (log[key] != null) f[key] = String(log[key]);
  }
  return f;
}

const SEGMENTS = [
  { label: "Braccio Dx", kgKey: "ra_kg", pctKey: "ra_pct" },
  { label: "Braccio Sx", kgKey: "la_kg", pctKey: "la_pct" },
  { label: "Tronco",     kgKey: "tr_kg", pctKey: "tr_pct" },
  { label: "Gamba Dx",   kgKey: "rl_kg", pctKey: "rl_pct" },
  { label: "Gamba Sx",   kgKey: "ll_kg", pctKey: "ll_pct" },
] as const;

interface Props {
  fields: SegmentalFields;
  onChange: (fields: SegmentalFields) => void;
}

export function InBodySegmentalInputs({ fields, onChange }: Props) {
  const set = (key: keyof SegmentalFields, value: string) =>
    onChange({ ...fields, [key]: value });

  return (
    <div className="space-y-4 pt-2">
      {/* TBW */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Acqua Corporea Totale (L)</Label>
        <Input
          type="number"
          step="0.1"
          min="0"
          placeholder="es. 38.5"
          value={fields.tbw}
          onChange={(e) => set("tbw", e.target.value)}
          className="border-border"
        />
      </div>

      <Separator />

      {/* Lean Mass */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground">Analisi Segmentale Massa Magra</Label>
        <div className="rounded-lg border border-border p-3 space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-[10px] text-muted-foreground font-medium">
            <span>Segmento</span>
            <span className="text-center">Kg</span>
            <span className="text-center">%</span>
          </div>
          {SEGMENTS.map((seg) => {
            const kgKey = `lean_${seg.kgKey}` as keyof SegmentalFields;
            const pctKey = `lean_${seg.pctKey}` as keyof SegmentalFields;
            return (
              <div key={seg.label + "_lean"} className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center">
                <span className="text-xs text-muted-foreground">{seg.label}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Kg"
                  value={fields[kgKey]}
                  onChange={(e) => set(kgKey, e.target.value)}
                  className="border-border h-8 text-xs"
                />
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="%"
                  value={fields[pctKey]}
                  onChange={(e) => set(pctKey, e.target.value)}
                  className="border-border h-8 text-xs"
                />
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Fat Mass */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground">Analisi Segmentale Massa Grassa</Label>
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-[10px] text-muted-foreground font-medium">
            <span>Segmento</span>
            <span className="text-center">Kg</span>
            <span className="text-center">%</span>
          </div>
          {SEGMENTS.map((seg) => {
            const kgKey = `fat_${seg.kgKey}` as keyof SegmentalFields;
            const pctKey = `fat_${seg.pctKey}` as keyof SegmentalFields;
            return (
              <div key={seg.label + "_fat"} className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center">
                <span className="text-xs text-muted-foreground">{seg.label}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Kg"
                  value={fields[kgKey]}
                  onChange={(e) => set(kgKey, e.target.value)}
                  className="border-border h-8 text-xs"
                />
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="%"
                  value={fields[pctKey]}
                  onChange={(e) => set(pctKey, e.target.value)}
                  className="border-border h-8 text-xs"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
