ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_data_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false;