CREATE POLICY "Il coach può aggiornare i profili dei clienti"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'coach'::app_role))
WITH CHECK (has_role(auth.uid(), 'coach'::app_role));