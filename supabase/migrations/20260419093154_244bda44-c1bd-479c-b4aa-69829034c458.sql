CREATE TABLE public.weekly_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feedback_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT weekly_checkins_status_check CHECK (status IN ('pending', 'reviewed'))
);

ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can insert own checkins"
ON public.weekly_checkins
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Clients can view own checkins"
ON public.weekly_checkins
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Coach can view all checkins"
ON public.weekly_checkins
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coach'::app_role));

CREATE POLICY "Coach can update all checkins"
ON public.weekly_checkins
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'coach'::app_role))
WITH CHECK (has_role(auth.uid(), 'coach'::app_role));

CREATE INDEX idx_weekly_checkins_user_status ON public.weekly_checkins(user_id, status, created_at DESC);
CREATE INDEX idx_weekly_checkins_status ON public.weekly_checkins(status, created_at DESC);