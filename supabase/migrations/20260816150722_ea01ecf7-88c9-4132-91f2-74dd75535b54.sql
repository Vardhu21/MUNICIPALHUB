
-- 1) profiles: remove public read; scope to self + officials
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
CREATE POLICY "profiles read self or officials" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'field_officer'::app_role)
  OR public.has_role(auth.uid(), 'zonal_commissioner'::app_role)
  OR public.has_role(auth.uid(), 'commissioner'::app_role)
  OR public.has_role(auth.uid(), 'councillor'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
REVOKE SELECT ON public.profiles FROM anon;

-- 2) resolution_votes: no public read of zkp tokens / voter ids
DROP POLICY IF EXISTS "votes public read" ON public.resolution_votes;
CREATE POLICY "votes read scoped" ON public.resolution_votes
FOR SELECT TO authenticated
USING (
  auth.uid() = voter_id
  OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = resolution_votes.complaint_id AND c.author_id = auth.uid())
  OR public.has_role(auth.uid(), 'field_officer'::app_role)
  OR public.has_role(auth.uid(), 'zonal_commissioner'::app_role)
  OR public.has_role(auth.uid(), 'commissioner'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
REVOKE SELECT ON public.resolution_votes FROM anon;

-- 3) complaint_evidence: explicit admin-only delete path
CREATE POLICY "evidence delete by admins" ON public.complaint_evidence
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) user_roles: explicit admin-only update path
CREATE POLICY "roles update admin only" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
GRANT UPDATE ON public.user_roles TO authenticated;
