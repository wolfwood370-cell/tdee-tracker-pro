-- Add is_global flag and optional notes/ingredients column
ALTER TABLE public.favorite_meals
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ingredients text;

CREATE INDEX IF NOT EXISTS idx_favorite_meals_is_global
  ON public.favorite_meals (is_global) WHERE is_global = true;

-- Replace SELECT policies: clients see own + global; coach already covered.
DROP POLICY IF EXISTS "Users can view own favorite meals" ON public.favorite_meals;
CREATE POLICY "Users can view own or global favorite meals"
  ON public.favorite_meals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_global = true);

-- Replace INSERT: clients can only insert non-global rows for themselves;
-- coach can insert global rows (own user_id, is_global=true).
DROP POLICY IF EXISTS "Users can insert own favorite meals" ON public.favorite_meals;
CREATE POLICY "Users can insert own personal favorite meals"
  ON public.favorite_meals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_global = false);

CREATE POLICY "Coach can insert global favorite meals"
  ON public.favorite_meals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND is_global = true
    AND public.has_role(auth.uid(), 'coach'::public.app_role)
  );

-- Replace DELETE: clients only their own non-global; coach can delete globals.
DROP POLICY IF EXISTS "Users can delete own favorite meals" ON public.favorite_meals;
CREATE POLICY "Users can delete own personal favorite meals"
  ON public.favorite_meals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_global = false);

CREATE POLICY "Coach can delete global favorite meals"
  ON public.favorite_meals
  FOR DELETE
  TO authenticated
  USING (
    is_global = true
    AND public.has_role(auth.uid(), 'coach'::public.app_role)
  );

-- Add UPDATE: clients own non-global; coach globals.
CREATE POLICY "Users can update own personal favorite meals"
  ON public.favorite_meals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_global = false)
  WITH CHECK (auth.uid() = user_id AND is_global = false);

CREATE POLICY "Coach can update global favorite meals"
  ON public.favorite_meals
  FOR UPDATE
  TO authenticated
  USING (
    is_global = true
    AND public.has_role(auth.uid(), 'coach'::public.app_role)
  )
  WITH CHECK (
    is_global = true
    AND public.has_role(auth.uid(), 'coach'::public.app_role)
  );