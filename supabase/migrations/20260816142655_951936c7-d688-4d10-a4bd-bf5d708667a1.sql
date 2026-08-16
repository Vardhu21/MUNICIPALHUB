DROP POLICY IF EXISTS "roles demo manage own" ON public.user_roles;

CREATE POLICY "roles self insert citizen only"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'citizen'::app_role);

CREATE POLICY "roles admin insert any"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));