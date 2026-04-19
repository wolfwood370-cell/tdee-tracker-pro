import { useEffect, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { GitCompare, ImageOff, Loader2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Slot = "front" | "side" | "back";

const SLOT_LABELS: Record<Slot, string> = {
  front: "Fronte",
  side: "Lato",
  back: "Retro",
};

interface PhotoRow {
  id: string;
  user_id: string;
  date: string;
  front_url: string | null;
  side_url: string | null;
  back_url: string | null;
  weight: number | null;
}

interface SignedRow extends PhotoRow {
  front_signed: string | null;
  side_signed: string | null;
  back_signed: string | null;
}

interface ProgressPhotoGalleryProps {
  /** If provided, fetches photos for this user (used by coach). Defaults to current user. */
  userId: string;
  /** When viewing as coach, hide weight if you want; default shows it. */
  showWeight?: boolean;
  /** Refresh trigger key — change it to force a refetch. */
  refreshKey?: number;
}

export function ProgressPhotoGallery({
  userId,
  showWeight = true,
  refreshKey = 0,
}: ProgressPhotoGalleryProps) {
  const [rows, setRows] = useState<SignedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [dateA, setDateA] = useState<string>("");
  const [dateB, setDateB] = useState<string>("");
  const [slotView, setSlotView] = useState<Slot>("front");

  const signUrl = useCallback(async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    const { data } = await supabase.storage
      .from("progress_photos")
      .createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  }, []);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("progress_photos")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as PhotoRow[];
    const signed: SignedRow[] = await Promise.all(
      list.map(async (r) => ({
        ...r,
        front_signed: await signUrl(r.front_url),
        side_signed: await signUrl(r.side_url),
        back_signed: await signUrl(r.back_url),
      })),
    );
    setRows(signed);
    setLoading(false);
  }, [userId, signUrl]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos, refreshKey]);

  const findRow = (date: string) => rows.find((r) => r.date === date);
  const rowA = dateA ? findRow(dateA) : undefined;
  const rowB = dateB ? findRow(dateB) : undefined;

  const slotKey = (slot: Slot) => `${slot}_signed` as const;

  if (loading) {
    return (
      <Card className="glass-card border-border">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="glass-card border-border">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <ImageOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Nessuna foto caricata.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {rows.length} check-in
          </Badge>
        </div>
        <Button
          variant={compareMode ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setCompareMode((v) => !v);
            if (!compareMode && rows.length >= 2) {
              setDateA(rows[rows.length - 1].date);
              setDateB(rows[0].date);
            }
          }}
          disabled={rows.length < 2}
        >
          <GitCompare className="h-4 w-4 mr-2" />
          {compareMode ? "Chiudi confronto" : "Confronta"}
        </Button>
      </div>

      {compareMode && (
        <Card className="glass-card border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display">Confronto Before / After</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-[11px] text-muted-foreground">Prima</span>
                <Select value={dateA} onValueChange={setDateA}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Seleziona data" />
                  </SelectTrigger>
                  <SelectContent>
                    {rows.map((r) => (
                      <SelectItem key={r.id} value={r.date}>
                        {format(parseISO(r.date), "d MMM yyyy", { locale: it })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] text-muted-foreground">Dopo</span>
                <Select value={dateB} onValueChange={setDateB}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Seleziona data" />
                  </SelectTrigger>
                  <SelectContent>
                    {rows.map((r) => (
                      <SelectItem key={r.id} value={r.date}>
                        {format(parseISO(r.date), "d MMM yyyy", { locale: it })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-center">
              <ToggleGroup
                type="single"
                value={slotView}
                onValueChange={(v) => v && setSlotView(v as Slot)}
                size="sm"
              >
                {(["front", "side", "back"] as const).map((s) => (
                  <ToggleGroupItem key={s} value={s} className="text-xs">
                    {SLOT_LABELS[s]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {rowA && rowB && (
              <div className="grid grid-cols-2 gap-3">
                {[rowA, rowB].map((r, idx) => {
                  const url = r[slotKey(slotView)];
                  return (
                    <div key={`${r.id}-${idx}`} className="space-y-1.5">
                      <AspectRatio ratio={3 / 4} className="rounded-lg overflow-hidden bg-secondary/40">
                        {url ? (
                          <img
                            src={url}
                            alt={`${SLOT_LABELS[slotView]} del ${r.date}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageOff className="h-6 w-6" />
                          </div>
                        )}
                      </AspectRatio>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {format(parseISO(r.date), "d MMM yyyy", { locale: it })}
                        </span>
                        {showWeight && r.weight != null && (
                          <span className="font-semibold text-foreground">
                            {Number(r.weight).toFixed(1)} kg
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((r) => (
          <Card key={r.id} className="glass-card border-border overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-display">
                  {format(parseISO(r.date), "d MMM yyyy", { locale: it })}
                </CardTitle>
                {showWeight && r.weight != null && (
                  <Badge variant="secondary" className="text-xs">
                    {Number(r.weight).toFixed(1)} kg
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-2">
                {(["front", "side", "back"] as const).map((slot) => {
                  const url = r[slotKey(slot)];
                  return (
                    <div key={slot} className="space-y-1">
                      <AspectRatio ratio={3 / 4} className="rounded-md overflow-hidden bg-secondary/40">
                        {url ? (
                          <img
                            src={url}
                            alt={`${SLOT_LABELS[slot]} del ${r.date}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/60">
                            <X className="h-4 w-4" />
                          </div>
                        )}
                      </AspectRatio>
                      <p className="text-[10px] text-center text-muted-foreground">
                        {SLOT_LABELS[slot]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
