CREATE POLICY "complaints author delete own"
ON public.complaints
FOR DELETE
TO authenticated
USING (auth.uid() = author_id);