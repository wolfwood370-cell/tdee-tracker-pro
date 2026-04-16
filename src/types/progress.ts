import type { Tables } from "@/integrations/supabase/types";

export type ProgressEntry = Tables<"progress_entries">;

export interface ProgressMeasurements {
  weight: number | null;
  neck: number | null;
  chest: number | null;
  arm_right: number | null;
  arm_left: number | null;
  waist: number | null;
  hips: number | null;
  thigh_right: number | null;
  thigh_left: number | null;
  calf_right: number | null;
  calf_left: number | null;
}

export interface NutritionSnapshot {
  snap_tdee: number | null;
  snap_calories: number | null;
  snap_protein: number | null;
  snap_fats: number | null;
  snap_carbs: number | null;
  snap_sodium: number | null;
  snap_water: number | null;
}

export const MEASUREMENT_GROUPS = {
  torso: [
    { key: "neck", label: "Collo" },
    { key: "chest", label: "Petto" },
    { key: "waist", label: "Vita" },
    { key: "hips", label: "Fianchi" },
  ],
  limbs: [
    { key: "arm_right", label: "Braccio Dx" },
    { key: "arm_left", label: "Braccio Sx" },
    { key: "thigh_right", label: "Coscia Dx" },
    { key: "thigh_left", label: "Coscia Sx" },
    { key: "calf_right", label: "Polpaccio Dx" },
    { key: "calf_left", label: "Polpaccio Sx" },
  ],
} as const;

/** Measurements where a decrease is typically positive (fat loss zones) */
export const REDUCTION_POSITIVE_KEYS = ["waist", "hips"];
