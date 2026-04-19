ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Backfill: chi ha già i dati biometrici minimi è considerato onboarded
UPDATE public.profiles
SET onboarding_completed = true
WHERE height_cm IS NOT NULL
  AND birth_date IS NOT NULL
  AND onboarding_completed = false;