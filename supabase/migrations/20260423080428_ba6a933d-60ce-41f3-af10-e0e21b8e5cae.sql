-- Create weekly_targets table to "freeze" weekly nutritional targets
CREATE TABLE public.weekly_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start_date DATE NOT NULL, -- always an ISO Monday
  frozen_tdee NUMERIC NOT NULL,
  target_calories INTEGER NOT NULL,
  target_protein NUMERIC NOT NULL,
  target_carbs NUMERIC NOT NULL,
  target_fats NUMERIC NOT NULL,
  goal_rate NUMERIC,
  goal_type TEXT,
  diet_strategy TEXT,
  calorie_distribution TEXT,
  snapshot_reason TEXT NOT NULL DEFAULT 'weekly', -- 'weekly' | 'strategy_change' | 'manual'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

CREATE INDEX idx_weekly_targets_user_week
  ON public.weekly_targets (user_id, week_start_date DESC);

-- Enable RLS
ALTER TABLE public.weekly_targets ENABLE ROW LEVEL SECURITY;

-- Client policies
CREATE POLICY "Users can view own weekly targets"
  ON public.weekly_targets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly targets"
  ON public.weekly_targets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly targets"
  ON public.weekly_targets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly targets"
  ON public.weekly_targets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Coach policies
CREATE POLICY "Coach can view all weekly targets"
  ON public.weekly_targets FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role));

CREATE POLICY "Coach can update all weekly targets"
  ON public.weekly_targets FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coach'::app_role));

-- Updated_at trigger using existing function
CREATE TRIGGER update_weekly_targets_updated_at
  BEFORE UPDATE ON public.weekly_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_monthly_assessment_timestamp();