-- 1. Only officers may change escalation-related fields on a complaint.
CREATE OR REPLACE FUNCTION public.protect_complaint_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_officer boolean;
BEGIN
  is_officer := (auth.uid() IS NULL)
    OR public.has_role(auth.uid(), 'field_officer')
    OR public.has_role(auth.uid(), 'zonal_commissioner')
    OR public.has_role(auth.uid(), 'commissioner')
    OR public.has_role(auth.uid(), 'admin');

  IF NOT is_officer THEN
    NEW.current_tier := OLD.current_tier;
    NEW.clock_offset_hours := OLD.clock_offset_hours;
    NEW.sla_hours := OLD.sla_hours;
    NEW.escalated_at := OLD.escalated_at;
    NEW.assigned_officer := OLD.assigned_officer;
    NEW.priority := OLD.priority;
    NEW.frozen_fake := OLD.frozen_fake;
    -- Citizens may only move their own ticket into the resolution/verification
    -- states the workflow allows; escalation states stay officer-controlled.
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('resolved','verification','citizen_verification','reopened','resolved_by_citizen') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS complaints_protect_escalation ON public.complaints;
CREATE TRIGGER complaints_protect_escalation
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.protect_complaint_escalation();

-- 2. Evidence bucket uploads (workers on their own assignments, officers, citizens' own complaint photos).
DROP POLICY IF EXISTS "evidence insert scoped" ON storage.objects;
CREATE POLICY "evidence insert scoped" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidence'
  AND (
    (name LIKE 'complaints/' || auth.uid()::text || '/%')
    OR EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid() AND w.active)
    OR public.has_role(auth.uid(), 'field_officer')
    OR public.has_role(auth.uid(), 'zonal_commissioner')
    OR public.has_role(auth.uid(), 'commissioner')
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "evidence update own" ON storage.objects;
CREATE POLICY "evidence update own" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'evidence' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')))
WITH CHECK (bucket_id = 'evidence' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));

-- 3. Back-fill category SLA windows on existing complaints.
UPDATE public.complaints SET sla_hours = CASE category
  WHEN 'electrical' THEN 1
  WHEN 'water' THEN 2
  WHEN 'sanitation' THEN 4
  WHEN 'drainage' THEN 6
  WHEN 'streetlight' THEN 12
  WHEN 'roads' THEN 24
  WHEN 'encroachment' THEN 48
  WHEN 'parks' THEN 72
  ELSE sla_hours END;