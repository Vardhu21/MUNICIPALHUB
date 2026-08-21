ALTER TABLE public.user_identities ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS user_identities_id_key ON public.user_identities (id);