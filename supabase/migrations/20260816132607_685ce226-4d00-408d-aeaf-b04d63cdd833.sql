
-- 1) Move SECURITY DEFINER role check out of the exposed API schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- public wrapper keeps existing policies working but is no longer SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, _role);
$$;

-- 2) fraud_flags: no public read
DROP POLICY IF EXISTS "flags public read" ON public.fraud_flags;
CREATE POLICY "flags scoped read" ON public.fraud_flags
FOR SELECT TO authenticated
USING (
  flagged_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = fraud_flags.complaint_id AND c.author_id = auth.uid())
  OR public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
);
REVOKE SELECT ON public.fraud_flags FROM anon;

-- 3) citizen_verifications explicit write policies
CREATE POLICY "verifications insert scoped" ON public.citizen_verifications
FOR INSERT TO authenticated
WITH CHECK (
  citizen_id = auth.uid()
  OR public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "verifications update scoped" ON public.citizen_verifications
FOR UPDATE TO authenticated
USING (
  citizen_id = auth.uid()
  OR public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  citizen_id = auth.uid()
  OR public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
);

-- 4) complaint_evidence explicit write policies
CREATE POLICY "evidence insert by assigned worker" ON public.complaint_evidence
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.workers w WHERE w.id = complaint_evidence.worker_id AND w.user_id = auth.uid())
);
CREATE POLICY "evidence update by officers" ON public.complaint_evidence
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
);

-- 5) storage.objects policies for the private evidence bucket
DROP POLICY IF EXISTS "evidence read scoped" ON storage.objects;
DROP POLICY IF EXISTS "evidence write officers" ON storage.objects;
DROP POLICY IF EXISTS "evidence delete officers" ON storage.objects;

CREATE POLICY "evidence read scoped" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'evidence' AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.complaint_evidence e
      JOIN public.workers w ON w.id = e.worker_id
      WHERE e.image_path = storage.objects.name AND w.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.complaint_evidence e
      JOIN public.complaints c ON c.id = e.complaint_id
      WHERE e.image_path = storage.objects.name AND c.author_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner')
    OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "evidence delete officers" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'evidence' AND (
    public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
  )
);
