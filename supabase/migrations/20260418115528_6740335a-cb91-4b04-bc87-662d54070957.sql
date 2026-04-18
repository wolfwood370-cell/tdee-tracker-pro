ALTER TABLE public.daily_metrics
ADD COLUMN IF NOT EXISTS meals_log JSONB NOT NULL DEFAULT '[]'::jsonb;