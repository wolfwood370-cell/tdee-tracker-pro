-- Recompute tracking_start_date as the FIRST day each user logged BOTH weight AND
-- meaningful calories (>= 500 kcal). Days with only calories or only weight don't count.
WITH first_valid AS (
  SELECT user_id, MIN(log_date)::timestamp with time zone AS first_day
  FROM public.daily_metrics
  WHERE weight IS NOT NULL
    AND calories IS NOT NULL
    AND calories >= 500
  GROUP BY user_id
)
UPDATE public.profiles p
SET tracking_start_date = fv.first_day
FROM first_valid fv
WHERE p.id = fv.user_id
  AND (p.tracking_start_date IS DISTINCT FROM fv.first_day);

-- Users who have NO valid (weight + calories) day yet → reset to NULL so the
-- calibration clock only starts on their first complete log.
UPDATE public.profiles p
SET tracking_start_date = NULL
WHERE p.tracking_start_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.daily_metrics dm
    WHERE dm.user_id = p.id
      AND dm.weight IS NOT NULL
      AND dm.calories IS NOT NULL
      AND dm.calories >= 500
  );