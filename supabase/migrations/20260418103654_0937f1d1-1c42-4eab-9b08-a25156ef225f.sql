ALTER TABLE public.daily_metrics
  ADD COLUMN IF NOT EXISTS protein numeric,
  ADD COLUMN IF NOT EXISTS carbs numeric,
  ADD COLUMN IF NOT EXISTS fats numeric,
  ADD COLUMN IF NOT EXISTS fiber numeric,
  ADD COLUMN IF NOT EXISTS water_l numeric,
  ADD COLUMN IF NOT EXISTS sodium_mg numeric;