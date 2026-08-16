-- 1. Enum extensions -------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'worker';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'worker_accepted';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'travelling';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'arrived';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'evidence_submitted';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'officer_review';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'officer_approved';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'citizen_verification';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'reopened';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'auto_closed_no_response';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'resolved_by_citizen';

-- 2. Distance helper --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.geo_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- 3. Workers ----------------------------------------------------------------
CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  department text NOT NULL DEFAULT 'general',
  ward_id uuid REFERENCES public.wards(id),
  phone_masked text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workers readable by signed in" ON public.workers FOR SELECT TO authenticated USING (true);
CREATE POLICY "workers self register" ON public.workers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workers self update" ON public.workers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workers officer manage" ON public.workers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner') OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner') OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER workers_touch BEFORE UPDATE ON public.workers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Assignments ------------------------------------------------------------
CREATE TABLE public.complaint_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  officer_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  sla_deadline timestamptz NOT NULL,
  dest_lat double precision,
  dest_lng double precision,
  stage text NOT NULL DEFAULT 'assigned',
  accepted_at timestamptz,
  travel_started_at timestamptz,
  arrived_at timestamptz,
  work_started_at timestamptz,
  completed_at timestamptz,
  last_distance_m double precision,
  last_ping_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX complaint_assignments_complaint_idx ON public.complaint_assignments (complaint_id);
CREATE INDEX complaint_assignments_worker_idx ON public.complaint_assignments (worker_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaint_assignments TO authenticated;
GRANT ALL ON public.complaint_assignments TO service_role;
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments read scoped" ON public.complaint_assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.workers w WHERE w.id = complaint_assignments.worker_id AND w.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_assignments.complaint_id AND c.author_id = auth.uid())
  OR public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "assignments officer insert" ON public.complaint_assignments FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "assignments officer update" ON public.complaint_assignments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner') OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner') OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER complaint_assignments_touch BEFORE UPDATE ON public.complaint_assignments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Evidence ---------------------------------------------------------------
CREATE TABLE public.complaint_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.complaint_assignments(id) ON DELETE SET NULL,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  description text NOT NULL DEFAULT '',
  worker_lat double precision,
  worker_lng double precision,
  exif_lat double precision,
  exif_lng double precision,
  gps_distance_m double precision,
  exif_distance_m double precision,
  gps_state text NOT NULL DEFAULT 'PENDING',
  exif_state text NOT NULL DEFAULT 'EXIF_UNAVAILABLE',
  ai_state text NOT NULL DEFAULT 'PENDING',
  ai_relevance text,
  ai_confidence numeric,
  ai_observed_issue text,
  ai_explanation text,
  officer_state text NOT NULL DEFAULT 'PENDING',
  officer_id uuid,
  officer_reason text,
  officer_decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX complaint_evidence_complaint_idx ON public.complaint_evidence (complaint_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaint_evidence TO authenticated;
GRANT ALL ON public.complaint_evidence TO service_role;
ALTER TABLE public.complaint_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence read scoped" ON public.complaint_evidence FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.workers w WHERE w.id = complaint_evidence.worker_id AND w.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_evidence.complaint_id AND c.author_id = auth.uid())
  OR public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
);
CREATE TRIGGER complaint_evidence_touch BEFORE UPDATE ON public.complaint_evidence FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Citizen verification ---------------------------------------------------
CREATE TABLE public.citizen_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  evidence_id uuid REFERENCES public.complaint_evidence(id) ON DELETE SET NULL,
  citizen_id uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL,
  decision text NOT NULL DEFAULT 'pending',
  reason text,
  photo_path text,
  lat double precision,
  lng double precision,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX citizen_verifications_complaint_idx ON public.citizen_verifications (complaint_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.citizen_verifications TO authenticated;
GRANT ALL ON public.citizen_verifications TO service_role;
ALTER TABLE public.citizen_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verifications read scoped" ON public.citizen_verifications FOR SELECT TO authenticated USING (
  citizen_id = auth.uid()
  OR public.has_role(auth.uid(), 'field_officer') OR public.has_role(auth.uid(), 'zonal_commissioner')
  OR public.has_role(auth.uid(), 'commissioner') OR public.has_role(auth.uid(), 'admin')
);
CREATE TRIGGER citizen_verifications_touch BEFORE UPDATE ON public.citizen_verifications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. Configurable workflow settings ----------------------------------------
CREATE TABLE public.workflow_config (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workflow_config TO authenticated;
GRANT SELECT ON public.workflow_config TO anon;
GRANT ALL ON public.workflow_config TO service_role;
ALTER TABLE public.workflow_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config public read" ON public.workflow_config FOR SELECT USING (true);
CREATE POLICY "config admin write" ON public.workflow_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.workflow_config (key, value, description) VALUES
  ('arrival_radius_m', 40, 'Geofence radius in metres used to mark a worker as ARRIVED'),
  ('approach_radius_m', 250, 'Radius in metres at which a worker is considered APPROACHING'),
  ('nearby_radius_m', 300, 'Search radius in metres for nearby unresolved complaints'),
  ('evidence_gps_radius_m', 75, 'Maximum allowed distance in metres between evidence GPS and complaint location'),
  ('citizen_window_hours', 6, 'Hours a citizen has to confirm resolution before auto close'),
  ('sla_reminder_ratio', 0.8, 'Fraction of the SLA window after which a reminder is sent');

-- 8. Nearby unresolved complaints ------------------------------------------
CREATE OR REPLACE FUNCTION public.nearby_unresolved_complaints(
  _lat double precision,
  _lng double precision,
  _radius_m double precision DEFAULT 300,
  _exclude uuid DEFAULT NULL,
  _category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  category text,
  priority public.complaint_priority,
  status public.complaint_status,
  lat double precision,
  lng double precision,
  created_at timestamptz,
  distance_m double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.title, c.category, c.priority, c.status, c.lat, c.lng, c.created_at,
         public.geo_distance_m(_lat, _lng, c.lat, c.lng) AS distance_m
  FROM public.complaints c
  WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
    AND c.frozen_fake = false
    AND c.status NOT IN ('resolved', 'rejected')
    AND (_exclude IS NULL OR c.id <> _exclude)
    AND (_category IS NULL OR c.category = _category)
    AND public.geo_distance_m(_lat, _lng, c.lat, c.lng) <= _radius_m
  ORDER BY distance_m ASC
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_unresolved_complaints(double precision, double precision, double precision, uuid, text) TO authenticated, service_role;