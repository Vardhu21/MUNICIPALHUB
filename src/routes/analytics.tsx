import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Download,
  FileImage,
  HardHat,
  Timer,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { useLang } from "@/lib/i18n";
import { applyEscalation, fetchComplaints, fetchWards, type Complaint, type Ward } from "@/lib/data";
import {
  byDepartment,
  byOfficer,
  byWard,
  overallStats,
  toCSV,
  type BucketMetrics,
} from "@/lib/analytics";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "SLA Analytics & Commissioner Oversight — TN SmartMunicipality" },
      {
        name: "description",
        content:
          "Role-based SLA performance analytics by ward, department and officer with downloadable Recharts visualisations and CSV exports.",
      },
      { property: "og:title", content: "SLA Analytics — TN SmartMunicipality" },
      {
        property: "og:description",
        content: "Commissioner-grade oversight dashboards: compliance %, resolution time, leaderboards.",
      },
    ],
  }),
  component: AnalyticsPage,
});

type Scope = "ward" | "department" | "officer";

const CHART_COLORS = ["#FFFFFF", "#D4D4D4", "#ABABAB", "#8A8A8A", "#6E6E6E", "#565656", "#3F3F3F", "#2B2B2B"];

function AnalyticsPage() {
  const { lang } = useLang();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>("ward");

  useEffect(() => {
    (async () => {
      try {
        const [list, w] = await Promise.all([fetchComplaints(), fetchWards()]);
        const escalated = await Promise.all(list.map((c) => applyEscalation(c).catch(() => c)));
        setComplaints(escalated);
        setWards(w);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => overallStats(complaints), [complaints]);
  const wardRows = useMemo(() => byWard(complaints, wards), [complaints, wards]);
  const deptRows = useMemo(() => byDepartment(complaints), [complaints]);
  const officerRows = useMemo(() => byOfficer(complaints), [complaints]);

  const activeRows = scope === "ward" ? wardRows : scope === "department" ? deptRows : officerRows;
  const scopeLabel = scope === "ward" ? "Ward" : scope === "department" ? "Department" : "Officer";

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-xl font-bold">
              <BarChart3 className="size-5 shrink-0 text-primary" /> SLA analytics & oversight
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {lang === "ta"
                ? "வார்டு, துறை மற்றும் அலுவலர் அடிப்படையிலான செயல்திறன் அறிக்கை"
                : "Commissioner-grade compliance reporting across wards, departments and officers"}
            </p>
          </div>
          <Link
            to="/dashboard"
            className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            Back to console
          </Link>
        </header>

        {loading && <p className="text-sm text-muted-foreground">Aggregating tickets…</p>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Total tickets" value={stats.total} icon={Activity} />
          <Kpi
            label="SLA compliance"
            value={`${stats.slaCompliancePct}%`}
            icon={Timer}
            tone={stats.slaCompliancePct >= 75 ? "success" : stats.slaCompliancePct >= 50 ? "warning" : "danger"}
          />
          <Kpi
            label="Escalation rate"
            value={`${stats.total ? Math.round((stats.escalated / stats.total) * 100) : 0}%`}
            icon={AlertTriangle}
            tone={stats.escalated > 0 ? "danger" : "success"}
          />
          <Kpi
            label="Avg resolution"
            value={stats.avgResolutionHours == null ? "—" : `${stats.avgResolutionHours.toFixed(1)}h`}
            icon={Trophy}
          />
        </section>

        <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1">
          {(
            [
              { s: "ward" as const, label: "By Ward", icon: Building2 },
              { s: "department" as const, label: "By Department", icon: BarChart3 },
              { s: "officer" as const, label: "By Officer", icon: HardHat },
            ]
          ).map(({ s, label, icon: Icon }) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                scope === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>

        <ChartCard
          title={`SLA compliance % — by ${scopeLabel.toLowerCase()}`}
          filename={`sla-compliance-by-${scope}`}
          rows={activeRows}
        >
          {(ref) => (
            <div ref={ref} className="bg-card p-2">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={activeRows.slice(0, 12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#A3A3A3" }} angle={-25} textAnchor="end" height={70} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#A3A3A3" }} />
                  <Tooltip contentStyle={{ background: "#262626", border: "1px solid #334155", color: "#F5F5F5" }} />
                  <Bar dataKey="slaCompliancePct" name="SLA %" radius={[4, 4, 0, 0]}>
                    {activeRows.slice(0, 12).map((r, i) => (
                      <Cell
                        key={r.key}
                        fill={r.slaCompliancePct >= 75 ? "#FFFFFF" : r.slaCompliancePct >= 50 ? "#9A9A9A" : "#4D4D4D"}
                        opacity={0.85 - (i % 5) * 0.05}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title="Avg resolution time (hours)"
            filename={`avg-resolution-by-${scope}`}
            rows={activeRows}
          >
            {(ref) => (
              <div ref={ref} className="bg-card p-2">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={activeRows.slice(0, 10).map((r) => ({ ...r, hours: r.avgResolutionHours ?? 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#A3A3A3" }} angle={-25} textAnchor="end" height={70} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: "#A3A3A3" }} />
                    <Tooltip contentStyle={{ background: "#262626", border: "1px solid #334155", color: "#F5F5F5" }} />
                    <Line type="monotone" dataKey="hours" stroke="#FFFFFF" strokeWidth={2} dot={{ fill: "#FFFFFF" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Ticket volume distribution" filename={`volume-by-${scope}`} rows={activeRows}>
            {(ref) => (
              <div ref={ref} className="bg-card p-2">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={activeRows.slice(0, 8)}
                      dataKey="total"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      label={{ fontSize: 10, fill: "#F5F5F5" }}
                    >
                      {activeRows.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 10, color: "#A3A3A3" }} />
                    <Tooltip contentStyle={{ background: "#262626", border: "1px solid #334155", color: "#F5F5F5" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        <Leaderboard title={`${scopeLabel} performance leaderboard`} rows={activeRows} scope={scope} />
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : tone === "danger"
          ? "bg-destructive/15 text-destructive"
          : "bg-primary/15 text-primary";
  return (
    <div className="civic-card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${toneClass}`}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-tight">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function ChartCard({
  title,
  filename,
  rows,
  children,
}: {
  title: string;
  filename: string;
  rows: BucketMetrics[];
  children: (ref: React.RefObject<HTMLDivElement | null>) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const downloadPng = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(ref.current, { backgroundColor: "#262626", pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${filename}.png`;
      a.click();
      toast.success("Chart exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = () => {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <section className="civic-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={downloadPng}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <FileImage className="size-3.5" /> PNG
          </button>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            <Download className="size-3.5" /> CSV
          </button>
        </div>
      </div>
      {children(ref)}
    </section>
  );
}

function Leaderboard({
  title,
  rows,
  scope,
}: {
  title: string;
  rows: BucketMetrics[];
  scope: Scope;
}) {
  const ranked = useMemo(
    () =>
      [...rows]
        .filter((r) => r.total > 0)
        .sort((a, b) => b.slaCompliancePct - a.slaCompliancePct || (a.avgResolutionHours ?? Infinity) - (b.avgResolutionHours ?? Infinity)),
    [rows],
  );

  const downloadCsv = () => {
    const csv = toCSV(ranked);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leaderboard-${scope}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Leaderboard exported");
  };

  return (
    <section className="civic-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Trophy className="size-4 text-warning" /> {title}
        </h2>
        <button
          onClick={downloadCsv}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
        >
          <Download className="size-3.5" /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Rank</th>
              <th className="px-3 py-2 font-semibold">
                {scope === "ward" ? "Ward" : scope === "department" ? "Department" : "Officer"}
              </th>
              <th className="px-3 py-2 text-right font-semibold">Tickets</th>
              <th className="px-3 py-2 text-right font-semibold">SLA %</th>
              <th className="px-3 py-2 text-right font-semibold">Avg hrs</th>
              <th className="px-3 py-2 text-right font-semibold">Escal %</th>
              <th className="px-3 py-2 text-right font-semibold">Breached</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={r.key} className="border-t border-border">
                <td className="px-3 py-2 font-bold">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </td>
                <td className="px-3 py-2">
                  <span className="line-clamp-1">{r.label}</span>
                </td>
                <td className="px-3 py-2 text-right">{r.total}</td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    r.slaCompliancePct >= 75
                      ? "text-success"
                      : r.slaCompliancePct >= 50
                        ? "text-warning"
                        : "text-destructive"
                  }`}
                >
                  {r.slaCompliancePct}%
                </td>
                <td className="px-3 py-2 text-right">
                  {r.avgResolutionHours == null ? "—" : r.avgResolutionHours.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right">{r.escalationRatePct}%</td>
                <td className="px-3 py-2 text-right text-destructive">{r.breached}</td>
              </tr>
            ))}
            {ranked.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
