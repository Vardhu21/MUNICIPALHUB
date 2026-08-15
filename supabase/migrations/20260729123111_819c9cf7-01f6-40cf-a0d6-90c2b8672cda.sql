
CREATE TABLE public.sla_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_label TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_tickets INTEGER NOT NULL DEFAULT 0,
  resolved_tickets INTEGER NOT NULL DEFAULT 0,
  escalated_tickets INTEGER NOT NULL DEFAULT 0,
  breached_tickets INTEGER NOT NULL DEFAULT 0,
  sla_compliance_pct INTEGER NOT NULL DEFAULT 0,
  avg_resolution_hours NUMERIC(8,2),
  ward_csv TEXT NOT NULL DEFAULT '',
  department_csv TEXT NOT NULL DEFAULT '',
  officer_csv TEXT NOT NULL DEFAULT '',
  generated_by TEXT NOT NULL DEFAULT 'scheduler',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sla_reports TO authenticated;
GRANT ALL ON public.sla_reports TO service_role;
ALTER TABLE public.sla_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_reports commissioner read" ON public.sla_reports
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'commissioner'::app_role)
    OR has_role(auth.uid(), 'zonal_commissioner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'sla_report',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  report_id UUID REFERENCES public.sla_reports(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications own read" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notifications own update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
