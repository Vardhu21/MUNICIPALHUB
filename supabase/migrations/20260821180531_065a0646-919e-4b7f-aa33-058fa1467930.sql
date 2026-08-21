DROP POLICY IF EXISTS "complaints officer update" ON public.complaints;
CREATE POLICY "complaints officer update" ON public.complaints
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'field_officer') OR public.has_role(auth.uid(),'zonal_commissioner')
  OR public.has_role(auth.uid(),'commissioner') OR public.has_role(auth.uid(),'councillor')
  OR public.has_role(auth.uid(),'admin')
)
WITH CHECK (
  public.has_role(auth.uid(),'field_officer') OR public.has_role(auth.uid(),'zonal_commissioner')
  OR public.has_role(auth.uid(),'commissioner') OR public.has_role(auth.uid(),'councillor')
  OR public.has_role(auth.uid(),'admin')
);

CREATE OR REPLACE FUNCTION public.protect_complaint_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  is_officer boolean;
BEGIN
  is_officer := (auth.uid() IS NULL)
    OR public.has_role(auth.uid(), 'field_officer')
    OR public.has_role(auth.uid(), 'zonal_commissioner')
    OR public.has_role(auth.uid(), 'commissioner')
    OR public.has_role(auth.uid(), 'councillor')
    OR public.has_role(auth.uid(), 'admin');

  IF NOT is_officer THEN
    NEW.current_tier := OLD.current_tier;
    NEW.clock_offset_hours := OLD.clock_offset_hours;
    NEW.sla_hours := OLD.sla_hours;
    NEW.escalated_at := OLD.escalated_at;
    NEW.assigned_officer := OLD.assigned_officer;
    NEW.priority := OLD.priority;
    NEW.frozen_fake := OLD.frozen_fake;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('resolved','verification','citizen_verification','reopened','resolved_by_citizen') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;