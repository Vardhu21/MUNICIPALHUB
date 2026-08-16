-- 1. Authority directory: ULB -> Zone -> Ward -> Councillor -------------------

CREATE TABLE public.ulbs (
  ulb_id text PRIMARY KEY,
  ulb_name text NOT NULL,
  ulb_name_tamil text NOT NULL,
  ulb_type text NOT NULL,
  district text NOT NULL,
  state text NOT NULL,
  official_source text NOT NULL,
  source_checked_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ulbs TO anon, authenticated;
GRANT ALL ON public.ulbs TO service_role;
ALTER TABLE public.ulbs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ulbs public read" ON public.ulbs FOR SELECT USING (true);

CREATE TABLE public.zones (
  zone_id text PRIMARY KEY,
  ulb_id text NOT NULL REFERENCES public.ulbs(ulb_id) ON DELETE CASCADE,
  zone_number integer NOT NULL,
  zone_name text NOT NULL,
  official_source text NOT NULL,
  source_checked_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX zones_ulb_idx ON public.zones(ulb_id);
GRANT SELECT ON public.zones TO anon, authenticated;
GRANT ALL ON public.zones TO service_role;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones public read" ON public.zones FOR SELECT USING (true);

-- 2. Map the official ward identity onto the EXISTING wards table --------------

ALTER TABLE public.wards
  ADD COLUMN IF NOT EXISTS ward_ref text UNIQUE,
  ADD COLUMN IF NOT EXISTS ulb_id text REFERENCES public.ulbs(ulb_id),
  ADD COLUMN IF NOT EXISTS zone_id text REFERENCES public.zones(zone_id),
  ADD COLUMN IF NOT EXISTS ward_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS official_ward_email text,
  ADD COLUMN IF NOT EXISTS official_source text,
  ADD COLUMN IF NOT EXISTS source_checked_at date;

-- Official ward directory rows carry no coordinates; do not invent them.
ALTER TABLE public.wards ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE public.wards ALTER COLUMN lng DROP NOT NULL;
CREATE INDEX IF NOT EXISTS wards_zone_idx ON public.wards(zone_id);

-- 3. Councillors ---------------------------------------------------------------

CREATE TABLE public.councillors (
  councillor_id text PRIMARY KEY,
  ward_ref text NOT NULL,
  ward_uuid uuid REFERENCES public.wards(id) ON DELETE SET NULL,
  name text,
  designation text NOT NULL,
  official_contact_phone text,
  official_contact_email text,
  status text NOT NULL DEFAULT 'active',
  official_source text NOT NULL,
  source_checked_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX councillors_ward_idx ON public.councillors(ward_uuid);
CREATE INDEX councillors_ward_ref_idx ON public.councillors(ward_ref);
GRANT SELECT ON public.councillors TO anon, authenticated;
GRANT ALL ON public.councillors TO service_role;
ALTER TABLE public.councillors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "councillors public read" ON public.councillors FOR SELECT USING (true);

-- 4. ULB leadership (Mayor / Deputy Mayor) -------------------------------------

CREATE TABLE public.ulb_leadership (
  authority_id text PRIMARY KEY,
  ulb_id text NOT NULL REFERENCES public.ulbs(ulb_id) ON DELETE CASCADE,
  role text NOT NULL,
  name text NOT NULL,
  phone text,
  office_phone text,
  email text,
  official_source text NOT NULL,
  source_checked_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ulb_leadership_ulb_idx ON public.ulb_leadership(ulb_id);
GRANT SELECT ON public.ulb_leadership TO anon, authenticated;
GRANT ALL ON public.ulb_leadership TO service_role;
ALTER TABLE public.ulb_leadership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leadership public read" ON public.ulb_leadership FOR SELECT USING (true);

-- 5. updated_at triggers --------------------------------------------------------

CREATE TRIGGER ulbs_touch BEFORE UPDATE ON public.ulbs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER zones_touch BEFORE UPDATE ON public.zones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER councillors_touch BEFORE UPDATE ON public.councillors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ulb_leadership_touch BEFORE UPDATE ON public.ulb_leadership
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Complaint routing target ---------------------------------------------------

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS routed_councillor_id text REFERENCES public.councillors(councillor_id),
  ADD COLUMN IF NOT EXISTS routed_zone_id text REFERENCES public.zones(zone_id);