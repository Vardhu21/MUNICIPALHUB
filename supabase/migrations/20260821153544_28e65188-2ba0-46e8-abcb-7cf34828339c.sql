DROP VIEW IF EXISTS public.ulb_leadership_public;

DROP POLICY IF EXISTS "leadership read by officials" ON public.ulb_leadership;

CREATE POLICY "leadership public read"
ON public.ulb_leadership FOR SELECT TO anon, authenticated
USING (true);

-- Column-level privileges: personal mobile ("phone") is not readable publicly
REVOKE SELECT ON public.ulb_leadership FROM anon, authenticated;
GRANT SELECT (authority_id, ulb_id, role, name, office_phone, email,
              official_source, source_checked_at, created_at, updated_at)
ON public.ulb_leadership TO anon, authenticated;
GRANT ALL ON public.ulb_leadership TO service_role;