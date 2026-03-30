ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS steps integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coach_note text;