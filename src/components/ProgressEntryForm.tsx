import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { calculateMicronutrients } from "@/lib/algorithms";
import { MEASUREMENT_GROUPS } from "@/types/progress";
import { Camera, Upload, Save, Ruler } from "lucide-react";

interface Props {
  onSaved: () => void;
}

export function ProgressEntryForm({ onSaved }: Props) {
  const { toast } = useToast();
  const { user, profile, currentTDEE, targetCalories, targetMacros } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  // Measurements
  const [measurements, setMeasurements] = useState<Record<string, string>>({});

  // Photos (local preview + File objects)
  const [photos, setPhotos] = useState<Record<string, { file: File; preview: string }>>({});
  // Ref mirror so the unmount cleanup sees the latest set of object URLs (closure fix).
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  const fileRefs = {
    front: useRef<HTMLInputElement>(null),
    back: useRef<HTMLInputElement>(null),
    side: useRef<HTMLInputElement>(null),
  };

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(photosRef.current).forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

  const handleMeasurement = (key: string, val: string) => {
    setMeasurements((prev) => ({ ...prev, [key]: val }));
  };

  const handlePhoto = useCallback((position: "front" | "back" | "side", file: File) => {
    setPhotos((prev) => {
      // Revoke previous URL if replacing
      if (prev[position]) {
        URL.revokeObjectURL(prev[position].preview);
      }
      const preview = URL.createObjectURL(file);
      return { ...prev, [position]: { file, preview } };
    });
  }, []);

  const uploadPhoto = async (position: string, file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${date}-${position}.${ext}`;
    const { error } = await supabase.storage.from("progress-photos").upload(path, file, { upsert: true });
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data } = supabase.storage.from("progress-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate: no future dates
    if (date > today) {
      toast({ title: "Data non valida", description: "Non puoi inserire un check-in con una data futura.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload photos
      const photoUrls: Record<string, string | null> = {};
      for (const pos of ["front", "back", "side"] as const) {
        if (photos[pos]) {
          photoUrls[pos] = await uploadPhoto(pos, photos[pos].file);
        }
      }

      // Capture nutrition snapshot
      const activityLevel = profile?.activity_level ?? 1.55;
      const latestWeight = measurements.weight ? parseFloat(measurements.weight) : null;
      const micro = calculateMicronutrients(
        targetCalories ?? 0,
        typeof activityLevel === "number" ? activityLevel : parseFloat(String(activityLevel)),
        latestWeight,
        null,
        false,
        profile?.sex ?? null
      );

      const numOrNull = (key: string) => {
        const v = measurements[key];
        if (!v || v === "") return null;
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      };

      const { error } = await supabase.from("progress_entries").insert({
        user_id: user.id,
        entry_date: date,
        weight: numOrNull("weight"),
        neck: numOrNull("neck"),
        chest: numOrNull("chest"),
        arm_right: numOrNull("arm_right"),
        arm_left: numOrNull("arm_left"),
        waist: numOrNull("waist"),
        hips: numOrNull("hips"),
        thigh_right: numOrNull("thigh_right"),
        thigh_left: numOrNull("thigh_left"),
        calf_right: numOrNull("calf_right"),
        calf_left: numOrNull("calf_left"),
        snap_tdee: currentTDEE,
        snap_calories: targetCalories,
        snap_protein: targetMacros?.protein ?? null,
        snap_fats: targetMacros?.fats ?? null,
        snap_carbs: targetMacros?.carbs ?? null,
        snap_sodium: micro.sodiumMg ? parseFloat(micro.sodiumMg) : null,
        snap_water: micro.waterL,
        photo_front: photoUrls.front ?? null,
        photo_back: photoUrls.back ?? null,
        photo_side: photoUrls.side ?? null,
      });

      if (error) {
        // Handle duplicate entry
        if (error.code === "23505") {
          toast({ title: "Check-in già presente", description: `Esiste già un check-in per il ${new Date(date).toLocaleDateString("it-IT")}. Scegli un'altra data.`, variant: "destructive" });
          return;
        }
        throw error;
      }

      toast({ title: "Check-in salvato!", description: "I tuoi progressi sono stati registrati." });
      // Cleanup previews
      Object.values(photos).forEach((p) => URL.revokeObjectURL(p.preview));
      setMeasurements({});
      setPhotos({});
      onSaved();
    } catch (err: unknown) {
      toast({ title: "Errore", description: err instanceof Error ? err.message : "Errore sconosciuto", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const photoZone = (position: "front" | "back" | "side", label: string) => (
    <div
      className="flex flex-col items-center gap-2 cursor-pointer"
      onClick={() => fileRefs[position].current?.click()}
    >
      <input
        ref={fileRefs[position]}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handlePhoto(position, f);
        }}
      />
      <div className="w-28 h-36 rounded-lg border-2 border-dashed border-border bg-secondary/30 flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
        {photos[position] ? (
          <img src={photos[position].preview} alt={label} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <Camera className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="entry-date">Data Check-in</Label>
        <Input
          id="entry-date"
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className="bg-secondary border-border max-w-xs"
        />
      </div>

      {/* Weight */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Ruler className="h-4 w-4 text-primary" /> Peso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label htmlFor="m-weight" className="text-xs text-muted-foreground">Peso (kg)</Label>
            <Input
              id="m-weight"
              type="number"
              step="0.1"
              placeholder="75.0"
              value={measurements.weight ?? ""}
              onChange={(e) => handleMeasurement("weight", e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
        </CardContent>
      </Card>

      {/* Torso */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Ruler className="h-4 w-4 text-primary" /> Busto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {MEASUREMENT_GROUPS.torso.map((m) => (
              <div key={m.key}>
                <Label htmlFor={`m-${m.key}`} className="text-xs text-muted-foreground">{m.label} (cm)</Label>
                <Input
                  id={`m-${m.key}`}
                  type="number"
                  step="0.1"
                  placeholder="—"
                  value={measurements[m.key] ?? ""}
                  onChange={(e) => handleMeasurement(m.key, e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Limbs */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Ruler className="h-4 w-4 text-primary" /> Arti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {MEASUREMENT_GROUPS.limbs.map((m) => (
              <div key={m.key}>
                <Label htmlFor={`m-${m.key}`} className="text-xs text-muted-foreground">{m.label} (cm)</Label>
                <Input
                  id={`m-${m.key}`}
                  type="number"
                  step="0.1"
                  placeholder="—"
                  value={measurements[m.key] ?? ""}
                  onChange={(e) => handleMeasurement(m.key, e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Foto Progressi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center gap-6 flex-wrap">
            {photoZone("front", "Fronte")}
            {photoZone("side", "Lato")}
            {photoZone("back", "Retro")}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        <Save className="h-4 w-4 mr-2" />
        {isSubmitting ? "Salvataggio..." : "Salva Check-in"}
      </Button>
    </form>
  );
}
