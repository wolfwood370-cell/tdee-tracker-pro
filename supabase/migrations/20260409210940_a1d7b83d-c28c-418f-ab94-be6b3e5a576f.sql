
ALTER TABLE public.profiles ADD COLUMN track_menstrual_cycle boolean NOT NULL DEFAULT false;

ALTER TABLE public.daily_metrics ADD COLUMN menstrual_phase text;
