ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dietary_preference text NOT NULL DEFAULT 'onnivoro',
  ADD COLUMN IF NOT EXISTS allergies text;