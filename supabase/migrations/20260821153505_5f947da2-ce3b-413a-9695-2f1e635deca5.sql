-- 1. Officers/admins may also record evidence rows
CREATE POLICY "evidence insert by officers"
ON public.complaint_evidence FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'field_officer')
  OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner')
  OR public.has_role(auth.uid(), 'admin')
);

-- 2. Resolution votes: immutable by design, made explicit (admins may remove fraudulent votes)
CREATE POLICY "votes delete by admins"
ON public.resolution_votes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "votes update by admins"
ON public.resolution_votes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Hide personal mobile numbers of ULB leaders from public reads
DROP POLICY IF EXISTS "leadership public read" ON public.ulb_leadership;
REVOKE SELECT ON public.ulb_leadership FROM anon, authenticated;
GRANT ALL ON public.ulb_leadership TO service_role;

CREATE POLICY "leadership read by officials"
ON public.ulb_leadership FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_officer')
  OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner')
  OR public.has_role(auth.uid(), 'admin')
);
GRANT SELECT ON public.ulb_leadership TO authenticated;

CREATE OR REPLACE VIEW public.ulb_leadership_public
WITH (security_invoker = off) AS
SELECT authority_id, ulb_id, role, name, office_phone, email,
       official_source, source_checked_at, created_at, updated_at
FROM public.ulb_leadership;

GRANT SELECT ON public.ulb_leadership_public TO anon, authenticated;
GRANT ALL ON public.ulb_leadership_public TO service_role;