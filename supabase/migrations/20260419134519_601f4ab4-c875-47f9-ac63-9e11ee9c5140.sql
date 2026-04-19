CREATE TABLE public.monthly_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month_year TEXT NOT NULL,
  metrics_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  report_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_year)
);

CREATE INDEX idx_monthly_assessments_user_month ON public.monthly_assessments(user_id, month_year DESC);

ALTER TABLE public.monthly_assessments ENABLE ROW LEVEL SECURITY;

-- Clients: see own approved reports only
CREATE POLICY "Clients can view own approved reports"
  ON public.monthly_assessments FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND status = 'approved');

-- Coach: full read access
CREATE POLICY "Coach can view all reports"
  ON public.monthly_assessments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role));

-- Coach: insert
CREATE POLICY "Coach can insert reports"
  ON public.monthly_assessments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'coach'::app_role));

-- Coach: update
CREATE POLICY "Coach can update reports"
  ON public.monthly_assessments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coach'::app_role));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_monthly_assessment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_monthly_assessments_updated_at
BEFORE UPDATE ON public.monthly_assessments
FOR EACH ROW EXECUTE FUNCTION public.update_monthly_assessment_timestamp();