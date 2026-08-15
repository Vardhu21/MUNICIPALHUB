DROP POLICY "events insert authed" ON public.complaint_events;
CREATE POLICY "events insert by author or officer" ON public.complaint_events
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.author_id = auth.uid())
  OR public.has_role(auth.uid(),'field_officer')
  OR public.has_role(auth.uid(),'zonal_commissioner')
  OR public.has_role(auth.uid(),'commissioner')
  OR public.has_role(auth.uid(),'admin')
);