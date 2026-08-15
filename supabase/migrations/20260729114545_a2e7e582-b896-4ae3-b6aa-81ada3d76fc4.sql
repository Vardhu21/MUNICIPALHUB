-- ENUMS
CREATE TYPE public.app_role AS ENUM ('citizen','field_officer','zonal_commissioner','commissioner','councillor','admin');
CREATE TYPE public.ulb_type AS ENUM ('corporation','municipality','town_panchayat');
CREATE TYPE public.complaint_priority AS ENUM ('emergency','high','medium','low');
CREATE TYPE public.complaint_status AS ENUM ('submitted','assigned','in_progress','verification','resolved','escalated','joint_task_force','rejected');

-- WARDS
CREATE TABLE public.wards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ulb_name_en text NOT NULL,
  ulb_name_ta text NOT NULL,
  ulb_type public.ulb_type NOT NULL,
  zone text NOT NULL,
  ward_number int NOT NULL,
  ward_name_en text NOT NULL,
  ward_name_ta text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wards TO anon, authenticated;
GRANT ALL ON public.wards TO service_role;
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wards readable by all" ON public.wards FOR SELECT USING (true);

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  pseudonym text NOT NULL UNIQUE,
  ward_id uuid REFERENCES public.wards(id),
  language text NOT NULL DEFAULT 'en',
  digilocker_verified boolean NOT NULL DEFAULT false,
  frozen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- PRIVATE IDENTITIES (no client access at all)
CREATE TABLE public.user_identities (
  user_id uuid PRIMARY KEY,
  legal_name text NOT NULL,
  aadhaar_masked text NOT NULL,
  phone_encrypted text NOT NULL,
  digilocker_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_identities TO service_role;
ALTER TABLE public.user_identities ENABLE ROW LEVEL SECURITY;
-- intentionally no policies: readable only via service role (judicial override)

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  ward_id uuid REFERENCES public.wards(id),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "roles demo manage own" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "roles delete own" ON public.user_roles FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- COMPLAINTS
CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  author_pseudonym text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  priority public.complaint_priority NOT NULL DEFAULT 'medium',
  status public.complaint_status NOT NULL DEFAULT 'submitted',
  ward_id uuid REFERENCES public.wards(id),
  lat double precision,
  lng double precision,
  street_address text,
  photo_url text,
  captured_at timestamptz,
  geo_verified boolean NOT NULL DEFAULT false,
  current_tier text NOT NULL DEFAULT 'field',
  assigned_officer text,
  sla_hours int NOT NULL DEFAULT 24,
  clock_offset_hours int NOT NULL DEFAULT 0,
  escalated_at timestamptz,
  resolution_photo_url text,
  complainant_approved boolean,
  frozen_fake boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT SELECT ON public.complaints TO anon;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaints public read" ON public.complaints FOR SELECT USING (true);
CREATE POLICY "complaints insert own" ON public.complaints FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "complaints author update" ON public.complaints FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "complaints officer update" ON public.complaints FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'field_officer') OR public.has_role(auth.uid(),'zonal_commissioner') OR public.has_role(auth.uid(),'commissioner') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'field_officer') OR public.has_role(auth.uid(),'zonal_commissioner') OR public.has_role(auth.uid(),'commissioner') OR public.has_role(auth.uid(),'admin'));

-- TIMELINE
CREATE TABLE public.complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_label text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.complaint_events TO authenticated;
GRANT SELECT ON public.complaint_events TO anon;
GRANT ALL ON public.complaint_events TO service_role;
ALTER TABLE public.complaint_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events public read" ON public.complaint_events FOR SELECT USING (true);
CREATE POLICY "events insert authed" ON public.complaint_events FOR INSERT TO authenticated WITH CHECK (true);

-- ENGAGEMENT
CREATE TABLE public.complaint_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (complaint_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.complaint_likes TO authenticated;
GRANT SELECT ON public.complaint_likes TO anon;
GRANT ALL ON public.complaint_likes TO service_role;
ALTER TABLE public.complaint_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes public read" ON public.complaint_likes FOR SELECT USING (true);
CREATE POLICY "likes own write" ON public.complaint_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes own delete" ON public.complaint_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.complaint_reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (complaint_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.complaint_reposts TO authenticated;
GRANT SELECT ON public.complaint_reposts TO anon;
GRANT ALL ON public.complaint_reposts TO service_role;
ALTER TABLE public.complaint_reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reposts public read" ON public.complaint_reposts FOR SELECT USING (true);
CREATE POLICY "reposts own write" ON public.complaint_reposts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reposts own delete" ON public.complaint_reposts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.complaint_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pseudonym text NOT NULL,
  body text NOT NULL,
  ward_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.complaint_comments TO authenticated;
GRANT SELECT ON public.complaint_comments TO anon;
GRANT ALL ON public.complaint_comments TO service_role;
ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments public read" ON public.complaint_comments FOR SELECT USING (true);
CREATE POLICY "comments own write" ON public.complaint_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments own delete" ON public.complaint_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RESOLUTION VOTES
CREATE TABLE public.resolution_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  approve boolean NOT NULL,
  zkp_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (complaint_id, voter_id)
);
GRANT SELECT, INSERT ON public.resolution_votes TO authenticated;
GRANT SELECT ON public.resolution_votes TO anon;
GRANT ALL ON public.resolution_votes TO service_role;
ALTER TABLE public.resolution_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes public read" ON public.resolution_votes FOR SELECT USING (true);
CREATE POLICY "votes own write" ON public.resolution_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = voter_id);

-- JUDICIAL OVERRIDES (immutable audit)
CREATE TABLE public.judicial_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
  case_reference text NOT NULL,
  granted boolean NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.judicial_overrides TO authenticated;
GRANT ALL ON public.judicial_overrides TO service_role;
ALTER TABLE public.judicial_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overrides admin read" ON public.judicial_overrides FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- EMERGENCY ALERTS
CREATE TABLE public.emergency_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id uuid REFERENCES public.wards(id),
  title_en text NOT NULL,
  title_ta text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m int NOT NULL DEFAULT 500,
  severity text NOT NULL DEFAULT 'critical',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.emergency_alerts TO authenticated;
GRANT SELECT ON public.emergency_alerts TO anon;
GRANT ALL ON public.emergency_alerts TO service_role;
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts public read" ON public.emergency_alerts FOR SELECT USING (true);
CREATE POLICY "alerts officer insert" ON public.emergency_alerts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'commissioner') OR public.has_role(auth.uid(),'zonal_commissioner') OR public.has_role(auth.uid(),'admin'));

-- FRAUD FLAGS
CREATE TABLE public.fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  flagged_by uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (complaint_id, flagged_by)
);
GRANT SELECT, INSERT ON public.fraud_flags TO authenticated;
GRANT SELECT ON public.fraud_flags TO anon;
GRANT ALL ON public.fraud_flags TO service_role;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flags public read" ON public.fraud_flags FOR SELECT USING (true);
CREATE POLICY "flags own write" ON public.fraud_flags FOR INSERT TO authenticated WITH CHECK (auth.uid() = flagged_by);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER complaints_touch BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- SEED WARDS
INSERT INTO public.wards (ulb_name_en, ulb_name_ta, ulb_type, zone, ward_number, ward_name_en, ward_name_ta, lat, lng) VALUES
('Greater Chennai Corporation','பெருநகர சென்னை மாநகராட்சி','corporation','Zone 9 - Teynampet',110,'Teynampet North','தேனாம்பேட்டை வடக்கு',13.0418,80.2500),
('Greater Chennai Corporation','பெருநகர சென்னை மாநகராட்சி','corporation','Zone 9 - Teynampet',111,'Alwarpet','ஆழ்வார்பேட்டை',13.0330,80.2540),
('Greater Chennai Corporation','பெருநகர சென்னை மாநகராட்சி','corporation','Zone 10 - Kodambakkam',124,'T. Nagar West','தி. நகர் மேற்கு',13.0405,80.2337),
('Greater Chennai Corporation','பெருநகர சென்னை மாநகராட்சி','corporation','Zone 13 - Adyar',176,'Adyar Gandhi Nagar','அடையாறு காந்தி நகர்',13.0060,80.2570),
('Coimbatore City Municipal Corporation','கோயம்புத்தூர் மாநகராட்சி','corporation','East Zone',45,'Peelamedu','பீளமேடு',11.0290,77.0270),
('Coimbatore City Municipal Corporation','கோயம்புத்தூர் மாநகராட்சி','corporation','Central Zone',52,'RS Puram','ஆர்.எஸ். புரம்',11.0060,76.9500),
('Madurai City Municipal Corporation','மதுரை மாநகராட்சி','corporation','Zone 4',68,'Anna Nagar Madurai','அண்ணா நகர் மதுரை',9.9390,78.1440),
('Hosur Municipality','ஓசூர் நகராட்சி','municipality','Municipal Zone A',12,'Bagalur Road','பாகலூர் சாலை',12.7409,77.8253),
('Hosur Municipality','ஓசூர் நகராட்சி','municipality','Municipal Zone B',18,'Mathigiri','மத்திகிரி',12.7830,77.8320),
('Kumbakonam Municipality','கும்பகோணம் நகராட்சி','municipality','Municipal Zone A',7,'Big Street','பெரிய தெரு',10.9600,79.3800),
('Sriperumbudur Town Panchayat','ஸ்ரீபெரும்புதூர் பேரூராட்சி','town_panchayat','TP Ward Cluster 1',3,'Bypass Road','பைபாஸ் சாலை',12.9670,79.9440),
('Mamallapuram Town Panchayat','மாமல்லபுரம் பேரூராட்சி','town_panchayat','TP Ward Cluster 2',5,'Shore Temple Road','கடற்கரை கோயில் சாலை',12.6160,80.1940);