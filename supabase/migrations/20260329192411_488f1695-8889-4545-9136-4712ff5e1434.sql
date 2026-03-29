ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manual_override_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_calories integer,
  ADD COLUMN IF NOT EXISTS manual_protein integer,
  ADD COLUMN IF NOT EXISTS manual_fats integer,
  ADD COLUMN IF NOT EXISTS manual_carbs integer;