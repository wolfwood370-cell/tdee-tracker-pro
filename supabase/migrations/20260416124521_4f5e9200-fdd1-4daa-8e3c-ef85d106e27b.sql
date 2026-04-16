
-- Create progress_entries table
CREATE TABLE public.progress_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  -- Measurements
  weight NUMERIC,
  neck NUMERIC,
  chest NUMERIC,
  arm_right NUMERIC,
  arm_left NUMERIC,
  waist NUMERIC,
  hips NUMERIC,
  thigh_right NUMERIC,
  thigh_left NUMERIC,
  calf_right NUMERIC,
  calf_left NUMERIC,
  -- Nutrition snapshot
  snap_tdee NUMERIC,
  snap_calories NUMERIC,
  snap_protein NUMERIC,
  snap_fats NUMERIC,
  snap_carbs NUMERIC,
  snap_sodium NUMERIC,
  snap_water NUMERIC,
  -- Photos
  photo_front TEXT,
  photo_back TEXT,
  photo_side TEXT,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

ALTER TABLE public.progress_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress" ON public.progress_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.progress_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.progress_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own progress" ON public.progress_entries FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Coach can view all progress" ON public.progress_entries FOR SELECT USING (has_role(auth.uid(), 'coach'::app_role));

-- Storage bucket for progress photos
INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', true);

CREATE POLICY "Progress photos are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'progress-photos');
CREATE POLICY "Users can upload own progress photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own progress photos" ON storage.objects FOR UPDATE USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own progress photos" ON storage.objects FOR DELETE USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
