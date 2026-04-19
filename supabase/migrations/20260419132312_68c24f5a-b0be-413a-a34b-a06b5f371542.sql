
-- 1) Make 'progress-photos' bucket private
UPDATE storage.buckets SET public = false WHERE id = 'progress-photos';

-- 2) progress_entries: change roles from public to authenticated
DROP POLICY IF EXISTS "Coach can view all progress" ON public.progress_entries;
CREATE POLICY "Coach can view all progress"
  ON public.progress_entries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role));

DROP POLICY IF EXISTS "Users can delete own progress" ON public.progress_entries;
CREATE POLICY "Users can delete own progress"
  ON public.progress_entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own progress" ON public.progress_entries;
CREATE POLICY "Users can insert own progress"
  ON public.progress_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own progress" ON public.progress_entries;
CREATE POLICY "Users can update own progress"
  ON public.progress_entries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own progress" ON public.progress_entries;
CREATE POLICY "Users can view own progress"
  ON public.progress_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3) Restrict realtime topic subscription to topics that contain the user's id.
--    App uses postgres_changes only (no broadcast/presence with sensitive payloads),
--    but we lock down the policy anyway as defense-in-depth.
DROP POLICY IF EXISTS "Authenticated users can subscribe to own topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to own topics"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE '%' || auth.uid()::text || '%'
    OR realtime.topic() IN ('messages-list', 'unread-counter')
  );
