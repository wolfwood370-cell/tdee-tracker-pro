-- Phase 70: Streaks & Perfect Day
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_date date;

ALTER TABLE public.daily_metrics
  ADD COLUMN IF NOT EXISTS is_perfect_day boolean NOT NULL DEFAULT false;