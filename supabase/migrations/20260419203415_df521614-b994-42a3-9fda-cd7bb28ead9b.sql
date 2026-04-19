ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS strategy_start_date timestamp with time zone NULL;

-- Backfill: existing users get created_at as their strategy start date
UPDATE public.profiles
SET strategy_start_date = created_at
WHERE strategy_start_date IS NULL;