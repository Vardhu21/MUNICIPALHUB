ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS work_summary text,
  ADD COLUMN IF NOT EXISTS materials_used text,
  ADD COLUMN IF NOT EXISTS work_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS work_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS proof_caption text;