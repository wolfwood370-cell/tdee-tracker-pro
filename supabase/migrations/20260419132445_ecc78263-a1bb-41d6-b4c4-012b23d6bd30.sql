
-- Restrict storage policies on 'progress-photos' bucket to authenticated users only
DROP POLICY IF EXISTS "Users can upload own progress photos" ON storage.objects;
CREATE POLICY "Users can upload own progress photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own progress photos" ON storage.objects;
CREATE POLICY "Users can update own progress photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own progress photos" ON storage.objects;
CREATE POLICY "Users can delete own progress photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Tighten realtime topic policy: exact matches per user, plus message-pair channels
-- Topics used by the app:
--   chat-{sortedUserA}-{sortedUserB}  (ChatWindow) -> contains both ids, requires user's id
--   messages-list                      (Messages page list)
--   unread-counter                     (Unread counter)
-- We keep the LIKE check for chat-* (must contain user uuid) and explicitly allow the two
-- public-metadata channels which only carry minimal change events that the underlying
-- 'messages' table RLS already filters per user before delivery.
DROP POLICY IF EXISTS "Authenticated users can subscribe to own topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to own topics"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    (realtime.topic() LIKE 'chat-%' AND realtime.topic() LIKE '%' || auth.uid()::text || '%')
    OR realtime.topic() = 'messages-list'
    OR realtime.topic() = 'unread-counter'
  );
