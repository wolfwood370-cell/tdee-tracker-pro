-- Add tracking_start_date column to profiles. This anchors the 28-day calibration
-- window. Defaults to created_at for existing users so they exit calibration quickly
-- if they already have data.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tracking_start_date timestamp with time zone;

-- Backfill: existing users get their created_at as tracking_start_date.
UPDATE public.profiles
SET tracking_start_date = created_at
WHERE tracking_start_date IS NULL;