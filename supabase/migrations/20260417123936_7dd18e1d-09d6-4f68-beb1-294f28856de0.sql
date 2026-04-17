-- Restrict public listing on progress-photos bucket while preserving direct file access via signed/public URLs.
-- The previous SELECT policy allowed anyone to LIST all files in the bucket (security warning #0025).
DROP POLICY IF EXISTS "Progress photos are publicly readable" ON storage.objects;

-- Coach can view all progress photos for review
CREATE POLICY "Coach can view all progress photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'progress-photos'
  AND public.has_role(auth.uid(), 'coach'::public.app_role)
);

-- Owners can view their own progress photos (folder convention: <user_id>/<file>)
CREATE POLICY "Users can view own progress photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'progress-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);