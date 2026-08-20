DROP POLICY IF EXISTS "workers readable by signed in" ON public.workers;

CREATE POLICY "Workers can read own record"
ON public.workers FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Officers and admins can read workers"
ON public.workers FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_officer')
  OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner')
  OR public.has_role(auth.uid(), 'admin')
);