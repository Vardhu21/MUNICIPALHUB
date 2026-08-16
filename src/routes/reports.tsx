import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, Download, RefreshCw, ShieldCheck, Bell, Timer } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useLang } from "@/lib/i18n";
import { EmblemLoader } from "@/components/EmblemLoader";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "SLA Reports Archive — TN SmartMunicipality" },
      {
        name: "description",
        content:
          "Scheduled SLA compliance reports for Tamil Nadu commissioners with downloadable ward, department and officer CSV snapshots.",
      },
      { property: "og:title", content: "SLA Reports Archive — TN SmartMunicipality" },
      {
        property: "og:description",
        content: "Commissioner-only archive of automated SLA digests delivered by the schedule daemon.",
      },
    ],
  }),
  component: ReportsArchive,
});

type ReportRow = {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  total_tickets: number;
  resolved_tickets: number;
  escalated_tickets: number;
  breached_tickets: number;
  sla_compliance_pct: number;
  avg_resolution_hours: number | null;
  ward_csv: string;
  department_csv: string;
  officer_csv: string;
  generated_by: string;
  created_at: string;
};

function ReportsArchive() {
  const { lang } = useLang();
  const { user, loading: sessionLoading } = useSession();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sla_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      // RLS blocks non-commissioners; surface that clearly.
      if (/permission|denied|policy/i.test(error.message)) setDenied(true);
      else toast.error(error.message);
    } else {
      setRows((data ?? []) as ReportRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!sessionLoading) load().catch(() => setLoading(false));
  }, [load, sessionLoading]);

  const download = (report: ReportRow, scope: "ward" | "department" | "officer") => {
    const csv =
      scope === "ward" ? report.ward_csv : scope === "department" ? report.department_csv : report.officer_csv;
    const blob = new Blob([csv || "no data"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sla-${scope}-${new Date(report.created_at).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const runNow = async () => {
    setTriggering(true);
    try {
      const res = await fetch("/api/public/hooks/generate-sla-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      toast.success("Report generated", {
        description: `Notified ${json.notified ?? 0} commissioners`,
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to run scheduler");
    } finally {
      setTriggering(false);
    }
  };

  if (!sessionLoading && !user) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <p className="civic-card p-6 text-sm text-muted-foreground">
            Sign in as a commissioner to view scheduled SLA reports.{" "}
            <Link to="/officer/login" className="text-primary underline">
              Officer sign-in
            </Link>
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-xl font-bold">
              <FileSpreadsheet className="size-5 shrink-0 text-primary" />{" "}
              {lang === "ta" ? "SLA அறிக்கை காப்பகம்" : "SLA report archive"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {lang === "ta"
                ? "தானியங்கி SLA டைஜெஸ்ட் — ஆணையர் மட்டுமே"
                : "Auto-generated SLA digests · commissioner access only"}
            </p>
          </div>
          <button
            onClick={runNow}
            disabled={triggering}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${triggering ? "animate-spin" : ""}`} />
            {triggering ? "Running…" : "Run now"}
          </button>
        </header>

        <p className="civic-card flex items-start gap-2 p-3 text-xs">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <span>
            The scheduler runs daily at 06:00 IST via pg_cron. Commissioners receive an in-app{" "}
            <Bell className="inline size-3" /> notification with a link to each digest.
          </span>
        </p>

        {denied && (
          <p className="civic-card border-destructive/40 p-4 text-sm text-destructive">
            Your role cannot access SLA reports. Only commissioners, zonal assistant commissioners and admins are
            permitted.
          </p>
        )}

        {loading && <EmblemLoader label="Loading archive…" />}
        {!loading && !denied && rows.length === 0 && (
          <p className="civic-card p-6 text-center text-sm text-muted-foreground">
            No reports generated yet. Click <b>Run now</b> or wait for the next scheduled window.
          </p>
        )}

        <div className="grid gap-3">
          {rows.map((r) => (
            <article key={r.id} className="civic-card space-y-3 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold">{r.period_label}</h2>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Generated {new Date(r.created_at).toLocaleString()} · {r.generated_by}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    r.sla_compliance_pct >= 75
                      ? "bg-success/15 text-success"
                      : r.sla_compliance_pct >= 50
                        ? "bg-warning/15 text-warning"
                        : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {r.sla_compliance_pct}% SLA
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Kpi label="Tickets" value={r.total_tickets} />
                <Kpi label="Resolved" value={r.resolved_tickets} tone="success" />
                <Kpi label="Escalated" value={r.escalated_tickets} tone="warning" />
                <Kpi label="Breached" value={r.breached_tickets} tone="danger" />
              </div>

              {r.avg_resolution_hours != null && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Timer className="size-3.5" /> Avg resolution {r.avg_resolution_hours}h
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {(["ward", "department", "officer"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => download(r, s)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <Download className="size-3.5" /> {s.charAt(0).toUpperCase() + s.slice(1)} CSV
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className={`text-lg font-bold leading-tight ${toneClass}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
