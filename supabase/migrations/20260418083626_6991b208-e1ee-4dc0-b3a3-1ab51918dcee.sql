-- Create favorite_meals table for the Recipe Vault feature
CREATE TABLE public.favorite_meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  calories INTEGER NOT NULL DEFAULT 0,
  protein INTEGER NOT NULL DEFAULT 0,
  carbs INTEGER NOT NULL DEFAULT 0,
  fats INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX idx_favorite_meals_user_id ON public.favorite_meals(user_id);

-- Enable RLS
ALTER TABLE public.favorite_meals ENABLE ROW LEVEL SECURITY;

-- Users can view own favorites
CREATE POLICY "Users can view own favorite meals"
ON public.favorite_meals
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert own favorites
CREATE POLICY "Users can insert own favorite meals"
ON public.favorite_meals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can delete own favorites
CREATE POLICY "Users can delete own favorite meals"
ON public.favorite_meals
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Coach can view all (consistent with other tables)
CREATE POLICY "Coach can view all favorite meals"
ON public.favorite_meals
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coach'::app_role));