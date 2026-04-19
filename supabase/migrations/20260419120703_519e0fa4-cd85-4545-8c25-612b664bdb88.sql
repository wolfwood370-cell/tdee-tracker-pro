-- 1. Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress_photos', 'progress_photos', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Table
CREATE TABLE public.progress_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL,
  front_url text,
  side_url text,
  back_url text,
  weight numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_progress_photos_user_date
  ON public.progress_photos (user_id, date DESC);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

-- Table RLS policies
CREATE POLICY "Users can view own progress photos"
  ON public.progress_photos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress photos"
  ON public.progress_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress photos"
  ON public.progress_photos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress photos"
  ON public.progress_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Coach can view all progress photos"
  ON public.progress_photos FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::app_role));

-- 3. Storage policies for bucket progress_photos
-- Path convention: {user_id}/{filename}
CREATE POLICY "Users can view own progress photo files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'progress_photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own progress photo files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'progress_photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own progress photo files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'progress_photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own progress photo files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'progress_photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Coach can view all progress photo files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'progress_photos'
    AND public.has_role(auth.uid(), 'coach'::app_role)
  );
