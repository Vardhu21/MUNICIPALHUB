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

const CHART_COLORS = ["#6C4CE8", "#5635C9", "#8163EE", "#9B85F0", "#B29FF4", "#C3B4F7", "#D6CCF9", "#E7E0FC"];

function AnalyticsPage() {
  const { lang, t } = useLang();
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
  const scopeLabel = scope === "ward" ? t("analytics.scopeWard") : scope === "department" ? t("analytics.scopeDepartment") : t("analytics.scopeOfficer");

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-xl font-bold">
              <BarChart3 className="size-5 shrink-0 text-primary" /> {t("analytics.title")}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {t("analytics.subtitle")}
            </p>
          </div>
          <Link
            to="/dashboard"
            className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            {t("analytics.backToConsole")}
          </Link>
        </header>

        {loading && <p className="text-sm text-muted-foreground">{t("analytics.aggregating")}</p>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label={t("analytics.totalTickets")} value={stats.total} icon={Activity} />
          <Kpi
            label={t("analytics.slaCompliance")}
            value={`${stats.slaCompliancePct}%`}
            icon={Timer}
            tone={stats.slaCompliancePct >= 75 ? "success" : stats.slaCompliancePct >= 50 ? "warning" : "danger"}
          />
          <Kpi
            label={t("analytics.escalationRate")}
            value={`${stats.total ? Math.round((stats.escalated / stats.total) * 100) : 0}%`}
            icon={AlertTriangle}
            tone={stats.escalated > 0 ? "danger" : "success"}
          />
          <Kpi
            label={t("analytics.avgResolution")}
            value={stats.avgResolutionHours == null ? "—" : `${stats.avgResolutionHours.toFixed(1)}h`}
            icon={Trophy}
          />
        </section>

        <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1">
          {(
            [
              { s: "ward" as const, label: t("analytics.byWard"), icon: Building2 },
              { s: "department" as const, label: t("analytics.byDepartment"), icon: BarChart3 },
              { s: "officer" as const, label: t("analytics.byOfficer"), icon: HardHat },
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
          title={`${t("analytics.slaComplianceChartTitle")} ${scopeLabel.toLowerCase()}`}
          filename={`sla-compliance-by-${scope}`}
          rows={activeRows}
        >
          {(ref) => (
            <div ref={ref} className="bg-card p-2">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={activeRows.slice(0, 12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E3F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6F6B78" }} angle={-25} textAnchor="end" height={70} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6F6B78" }} />
                  <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E7E3F0", color: "#17151C" }} />
                  <Bar dataKey="slaCompliancePct" name={t("analytics.slaPct")} radius={[4, 4, 0, 0]}>
                    {activeRows.slice(0, 12).map((r, i) => (
                      <Cell
                        key={r.key}
                        fill={r.slaCompliancePct >= 75 ? "#6C4CE8" : r.slaCompliancePct >= 50 ? "#9B85F0" : "#D6CCF9"}
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
            title={t("analytics.avgResolutionChartTitle")}
            filename={`avg-resolution-by-${scope}`}
            rows={activeRows}
          >
            {(ref) => (
              <div ref={ref} className="bg-card p-2">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={activeRows.slice(0, 10).map((r) => ({ ...r, hours: r.avgResolutionHours ?? 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E3F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6F6B78" }} angle={-25} textAnchor="end" height={70} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: "#6F6B78" }} />
                    <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E7E3F0", color: "#17151C" }} />
                    <Line type="monotone" dataKey="hours" stroke="#6C4CE8" strokeWidth={2} dot={{ fill: "#6C4CE8" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard title={t("analytics.volumeChartTitle")} filename={`volume-by-${scope}`} rows={activeRows}>
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
                      label={{ fontSize: 10, fill: "#17151C" }}
                    >
                      {activeRows.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 10, color: "#6F6B78" }} />
                    <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E7E3F0", color: "#17151C" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        <Leaderboard title={`${scopeLabel} ${t("analytics.leaderboardTitle")}`} rows={activeRows} scope={scope} />
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
  const { t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const downloadPng = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(ref.current, { backgroundColor: "#FFFFFF", pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${filename}.png`;
      a.click();
      toast.success(t("analytics.chartExported"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("analytics.exportFailed"));
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
    toast.success(t("analytics.csvExported"));
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
            <FileImage className="size-3.5" /> {t("analytics.png")}
          </button>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            <Download className="size-3.5" /> {t("analytics.csv")}
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
  const { t } = useLang();
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
    toast.success(t("analytics.leaderboardExported"));
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
          <Download className="size-3.5" /> {t("analytics.exportCsv")}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">{t("analytics.rank")}</th>
              <th className="px-3 py-2 font-semibold">
                {scope === "ward" ? t("analytics.scopeWard") : scope === "department" ? t("analytics.scopeDepartment") : t("analytics.scopeOfficer")}
              </th>
              <th className="px-3 py-2 text-right font-semibold">{t("analytics.tickets")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("analytics.slaPct")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("analytics.avgHrs")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("analytics.escalPct")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("analytics.breached")}</th>
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
                  {t("analytics.noDataYet")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
