import { useState, useRef } from "react";
import { format } from "date-fns";
import { Camera, Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PHOTO_DISCLAIMER_KEY = "nc_photo_disclaimer_ack_v1";

type Slot = "front" | "side" | "back";

const SLOT_LABELS: Record<Slot, string> = {
  front: "Fronte",
  side: "Lato",
  back: "Retro",
};

interface ProgressPhotoUploadProps {
  onUploaded?: () => void;
}

export function ProgressPhotoUpload({ onUploaded }: ProgressPhotoUploadProps) {
  const { user, dailyLogs } = useAppStore();
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [files, setFiles] = useState<Record<Slot, File | null>>({
    front: null,
    side: null,
    back: null,
  });
  const [previews, setPreviews] = useState<Record<Slot, string | null>>({
    front: null,
    side: null,
    back: null,
  });
  const [uploading, setUploading] = useState(false);
  const [disclaimerAck, setDisclaimerAck] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem(PHOTO_DISCLAIMER_KEY) === "1"
  );
  const ackDisclaimer = () => {
    try {
      localStorage.setItem(PHOTO_DISCLAIMER_KEY, "1");
    } catch {
      // ignore storage errors (private mode)
    }
    setDisclaimerAck(true);
  };
  const inputRefs = {
    front: useRef<HTMLInputElement>(null),
    side: useRef<HTMLInputElement>(null),
    back: useRef<HTMLInputElement>(null),
  };

  const handleFile = (slot: Slot, file: File | null) => {
    setFiles((prev) => ({ ...prev, [slot]: file }));
    setPreviews((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot]!);
      return { ...prev, [slot]: file ? URL.createObjectURL(file) : null };
    });
  };

  const uploadOne = async (slot: Slot, file: File): Promise<string> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user!.id}/${Date.now()}_${slot}.${ext}`;
    const { error } = await supabase.storage
      .from("progress_photos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!files.front && !files.side && !files.back) {
      toast.error("Carica almeno una foto.");
      return;
    }

    setUploading(true);
    try {
      const uploads: Partial<Record<Slot, string>> = {};
      for (const slot of ["front", "side", "back"] as const) {
        if (files[slot]) uploads[slot] = await uploadOne(slot, files[slot]!);
      }

      // Find weight on that date if logged
      const log = dailyLogs.find((l) => l.log_date === date);
      const weight = log?.weight ?? null;

      // Fetch existing row for that date
      const { data: existing } = await supabase
        .from("progress_photos")
        .select("id, front_url, side_url, back_url")
        .eq("user_id", user.id)
        .eq("date", date)
        .maybeSingle();

      const payload = {
        user_id: user.id,
        date,
        weight,
        front_url: uploads.front ?? existing?.front_url ?? null,
        side_url: uploads.side ?? existing?.side_url ?? null,
        back_url: uploads.back ?? existing?.back_url ?? null,
      };

      if (existing?.id) {
        const { error } = await supabase
          .from("progress_photos")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("progress_photos")
          .insert(payload);
        if (error) throw error;
      }

      toast.success("Foto caricate.", {
        description: `Check-in del ${format(new Date(date), "d MMMM yyyy")} aggiornato.`,
      });

      // Reset
      setFiles({ front: null, side: null, back: null });
      Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u));
      setPreviews({ front: null, side: null, back: null });
      onUploaded?.();
    } catch (e) {
      console.error(e);
      toast.error("Errore durante il caricamento.", {
        description: e instanceof Error ? e.message : "Riprova.",
      });
    } finally {
      setUploading(false);
    }
  };

  if (!disclaimerAck) {
    return (
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Foto sensibili — informativa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Stai caricando immagini sensibili. Queste foto sono visibili solo a te
            e al tuo coach in forma crittografata. Caricando le foto, confermi di
            aver compreso la nostra politica sui dati biometrici.
          </p>
          <Button
            onClick={ackDisclaimer}
            className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
          >
            Ho capito
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          Nuovo Check-in Foto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="photo-date" className="text-xs text-muted-foreground">
            Data
          </Label>
          <Input
            id="photo-date"
            type="date"
            value={date}
            max={format(new Date(), "yyyy-MM-dd")}
            onChange={(e) => setDate(e.target.value)}
            className="text-base"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(["front", "side", "back"] as const).map((slot) => (
            <div key={slot} className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                {SLOT_LABELS[slot]}
              </Label>
              <button
                type="button"
                onClick={() => inputRefs[slot].current?.click()}
                className="relative w-full aspect-[3/4] rounded-lg border-2 border-dashed border-border bg-secondary/30 hover:border-primary/60 hover:bg-primary/5 transition-colors overflow-hidden flex items-center justify-center"
                aria-label={`Carica foto ${SLOT_LABELS[slot]}`}
              >
                {previews[slot] ? (
                  <img
                    src={previews[slot]!}
                    alt={`Anteprima ${SLOT_LABELS[slot]}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px]">Tocca</span>
                  </div>
                )}
              </button>
              <input
                ref={inputRefs[slot]}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleFile(slot, e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Caricamento…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Carica Foto
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
