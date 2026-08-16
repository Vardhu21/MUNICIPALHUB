CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
BEGIN
  is_privileged := (auth.uid() IS NULL)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'commissioner')
    OR public.has_role(auth.uid(), 'zonal_commissioner');

  IF NOT is_privileged THEN
    NEW.digilocker_verified := OLD.digilocker_verified;
    NEW.frozen := OLD.frozen;
    NEW.id := OLD.id;
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_sensitive ON public.profiles;
CREATE TRIGGER profiles_protect_sensitive
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();