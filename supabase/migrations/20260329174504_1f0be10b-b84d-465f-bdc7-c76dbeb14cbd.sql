ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_type text NOT NULL DEFAULT 'sustainable_loss',
  ADD COLUMN IF NOT EXISTS diet_type text NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS protein_pref text NOT NULL DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS calorie_distribution text NOT NULL DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS training_days_per_week integer NOT NULL DEFAULT 4;