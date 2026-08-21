UPDATE public.profiles SET digilocker_verified = true WHERE digilocker_verified = false;
ALTER TABLE public.profiles ALTER COLUMN digilocker_verified SET DEFAULT true;