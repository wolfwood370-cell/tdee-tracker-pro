
-- ============================================
-- ENUM per i ruoli utente
-- ============================================
CREATE TYPE public.app_role AS ENUM ('coach', 'client');

-- ============================================
-- Tabella PROFILES
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sex VARCHAR(10),
  height_cm NUMERIC,
  birth_date DATE,
  activity_level NUMERIC DEFAULT 1.2,
  goal_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Tabella USER_ROLES (separata per sicurezza)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'client',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Funzione SECURITY DEFINER per controllare ruoli
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- ============================================
-- Tabella DAILY_METRICS
-- ============================================
CREATE TABLE public.daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  weight NUMERIC,
  calories INTEGER,
  is_interpolated BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  UNIQUE (user_id, log_date)
);

ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Tabella WEEKLY_ANALYTICS
-- ============================================
CREATE TABLE public.weekly_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  avg_weight NUMERIC,
  avg_calories INTEGER,
  adaptive_tdee NUMERIC,
  UNIQUE (user_id, week_start_date)
);

ALTER TABLE public.weekly_analytics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Trigger per creare profilo e ruolo automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- RLS POLICIES: user_roles
-- ============================================
CREATE POLICY "Gli utenti possono vedere i propri ruoli"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: profiles
-- ============================================
CREATE POLICY "Gli utenti possono vedere il proprio profilo"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Gli utenti possono aggiornare il proprio profilo"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Il coach può vedere tutti i profili"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

-- ============================================
-- RLS POLICIES: daily_metrics
-- ============================================
CREATE POLICY "Gli utenti possono vedere le proprie metriche"
  ON public.daily_metrics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Gli utenti possono inserire le proprie metriche"
  ON public.daily_metrics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Gli utenti possono aggiornare le proprie metriche"
  ON public.daily_metrics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Gli utenti possono eliminare le proprie metriche"
  ON public.daily_metrics FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Il coach può vedere tutte le metriche"
  ON public.daily_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

-- ============================================
-- RLS POLICIES: weekly_analytics
-- ============================================
CREATE POLICY "Gli utenti possono vedere le proprie analisi"
  ON public.weekly_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Gli utenti possono inserire le proprie analisi"
  ON public.weekly_analytics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Gli utenti possono aggiornare le proprie analisi"
  ON public.weekly_analytics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Gli utenti possono eliminare le proprie analisi"
  ON public.weekly_analytics FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Il coach può vedere tutte le analisi"
  ON public.weekly_analytics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

-- ============================================
-- Indici per performance
-- ============================================
CREATE INDEX idx_daily_metrics_user_date ON public.daily_metrics (user_id, log_date);
CREATE INDEX idx_weekly_analytics_user_week ON public.weekly_analytics (user_id, week_start_date);
CREATE INDEX idx_user_roles_user_id ON public.user_roles (user_id);
