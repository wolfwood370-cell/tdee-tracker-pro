ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS weekly_schedule jsonb NOT NULL DEFAULT '{"mon":"rest","tue":"rest","wed":"rest","thu":"rest","fri":"rest","sat":"rest","sun":"rest"}'::jsonb;

-- Backfill weekly_schedule from existing training_schedule for all users
-- (training_schedule is a 7-element boolean array Mon..Sun: true=training, false=rest)
UPDATE public.profiles
SET weekly_schedule = jsonb_build_object(
  'mon', CASE WHEN (training_schedule->>0)::boolean THEN 'training' ELSE 'rest' END,
  'tue', CASE WHEN (training_schedule->>1)::boolean THEN 'training' ELSE 'rest' END,
  'wed', CASE WHEN (training_schedule->>2)::boolean THEN 'training' ELSE 'rest' END,
  'thu', CASE WHEN (training_schedule->>3)::boolean THEN 'training' ELSE 'rest' END,
  'fri', CASE WHEN (training_schedule->>4)::boolean THEN 'training' ELSE 'rest' END,
  'sat', CASE WHEN (training_schedule->>5)::boolean THEN 'training' ELSE 'rest' END,
  'sun', CASE WHEN (training_schedule->>6)::boolean THEN 'training' ELSE 'rest' END
)
WHERE weekly_schedule = '{"mon":"rest","tue":"rest","wed":"rest","thu":"rest","fri":"rest","sat":"rest","sun":"rest"}'::jsonb
  AND training_schedule IS NOT NULL;