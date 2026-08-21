DROP POLICY IF EXISTS "evidence insert by assigned worker" ON public.complaint_evidence;
CREATE POLICY "evidence insert by assigned worker"
ON public.complaint_evidence
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workers w
    JOIN public.complaint_assignments a ON a.worker_id = w.id
    WHERE w.id = complaint_evidence.worker_id
      AND w.user_id = auth.uid()
      AND w.active
      AND a.complaint_id = complaint_evidence.complaint_id
      AND (complaint_evidence.assignment_id IS NULL OR complaint_evidence.assignment_id = a.id)
  )
);

DROP POLICY IF EXISTS "evidence insert scoped" ON storage.objects;
CREATE POLICY "evidence insert scoped"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidence'
  AND (
    name LIKE ('complaints/' || auth.uid()::text || '/%')
    OR EXISTS (
      SELECT 1
      FROM public.workers w
      JOIN public.complaint_assignments a ON a.worker_id = w.id
      WHERE w.user_id = auth.uid()
        AND w.active
        AND a.complaint_id::text = split_part(storage.objects.name, '/', 1)
    )
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.author_id = auth.uid()
        AND c.id::text = split_part(storage.objects.name, '/', 1)
    )
    OR public.has_role(auth.uid(), 'field_officer')
    OR public.has_role(auth.uid(), 'zonal_commissioner')
    OR public.has_role(auth.uid(), 'commissioner')
    OR public.has_role(auth.uid(), 'admin')
  )
);