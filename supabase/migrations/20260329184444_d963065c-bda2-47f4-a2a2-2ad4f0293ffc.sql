
-- Create biofeedback_logs table
CREATE TABLE public.biofeedback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  hunger_score INTEGER NOT NULL CHECK (hunger_score BETWEEN 1 AND 5),
  energy_score INTEGER NOT NULL CHECK (energy_score BETWEEN 1 AND 5),
  sleep_score INTEGER NOT NULL CHECK (sleep_score BETWEEN 1 AND 5),
  performance_score INTEGER NOT NULL CHECK (performance_score BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

-- Enable RLS
ALTER TABLE public.biofeedback_logs ENABLE ROW LEVEL SECURITY;

-- Clients can insert their own rows
CREATE POLICY "Clients can insert own biofeedback"
  ON public.biofeedback_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Clients can select their own rows
CREATE POLICY "Clients can select own biofeedback"
  ON public.biofeedback_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Clients can update their own rows (for upsert)
CREATE POLICY "Clients can update own biofeedback"
  ON public.biofeedback_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Coach can select all rows
CREATE POLICY "Coach can select all biofeedback"
  ON public.biofeedback_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));
