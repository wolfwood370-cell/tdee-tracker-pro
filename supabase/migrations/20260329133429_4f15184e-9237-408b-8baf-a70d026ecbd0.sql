CREATE POLICY "Il coach può vedere tutti i ruoli"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coach'::app_role));