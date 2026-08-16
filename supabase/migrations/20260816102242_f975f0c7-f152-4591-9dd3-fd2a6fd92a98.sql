ALTER TABLE public.citizen_verifications
  ADD COLUMN IF NOT EXISTS gps_state text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS distance_m double precision,
  ADD COLUMN IF NOT EXISTS accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS complaint_lat double precision,
  ADD COLUMN IF NOT EXISTS complaint_lng double precision;

ALTER TABLE public.complaint_assignments
  ADD COLUMN IF NOT EXISTS assignment_source text NOT NULL DEFAULT 'OFFICER_ASSIGNED',
  ADD COLUMN IF NOT EXISTS accepted_by_worker_at timestamp with time zone;

INSERT INTO public.workflow_config (key, value, description)
VALUES ('citizen_evidence_radius_m', 150, 'Radius (m) within which citizen rejection evidence GPS is treated as verified')
ON CONFLICT (key) DO NOTHING;