import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  FastForward,
  PhoneCall,
  ShieldCheck,
  Users,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { StatusPill, PriorityPill } from "@/components/StatusPill";
import { SlaBar } from "@/components/SlaBar";
import { MaskedCallModal } from "@/components/MaskedCallModal";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { GeoCamera, type Capture } from "@/components/GeoCamera";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { ROLE_LABEL, useActiveRole, useSession } from "@/lib/session";
import { computeClock, SLA_MATRIX, TIER_LABEL, type Tier } from "@/lib/sla";
import {
  applyEscalation,
  fastForward,
  fetchComplaints,
  fetchWards,
  logEvent,
  officerForTier,
  wardLabel,
  type Complaint,
  type Ward,
} from "@/lib/data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Role Dashboards — TN SmartMunicipality" },
      {
        name: "description",
        content:
          "Switch between Citizen, Field Officer, Zonal Commissioner, Corporation Commissioner and Ward Councillor viewports with live SLA escalation controls.",
      },
      { property: "og:title", content: "Role Dashboards — TN SmartMunicipality" },
      {
        property: "og:description",
        content: "Ward task boards, escalation queues, heatmaps and the deadlock breaker in one console.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { lang, t } = useLang();
  const [role] = useActiveRole();
  const { user } = useSession();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [list, w] = await Promise.all([fetchComplaints(), fetchWards()]);
    const escalated = await Promise.all(list.map((c) => applyEscalation(c).catch(() => c)));
    setComplaints(escalated);
    setWards(w);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const wardMap = useMemo(() => new Map(wards.map((w) => [w.id, w])), [wards]);

  const advance = async (c: Complaint, hours = 1) => {
    setBusyId(c.id);
    try {
      const updated = await fastForward(c, hours);
      setComplaints((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      if (updated.status !== c.status || updated.current_tier !== c.current_tier) {
        toast.error(`Auto-escalated → ${TIER_LABEL[updated.current_tier as Tier][lang]}`, {
          description: updated.assigned_officer ?? undefined,
        });
      } else {
        toast.info(`SLA clock +${hours}h`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setBusyId(null);
    }
  };

  const patch = async (c: Complaint, values: Partial<Complaint>, note: string, actor: string) => {
    const { data, error } = await supabase.from("complaints").update(values).eq("id", c.id).select().maybeSingle();
    if (error) return toast.error(error.message);
    await logEvent(c.id, "update", actor, note);
    setComplaints((prev) => prev.map((x) => (x.id === c.id ? ((data ?? x) as Complaint) : x)));
    toast.success(note);
  };

  const mine = complaints.filter((c) => c.author_id === user?.id);
  const breached = complaints.filter((c) =>
    computeClock(c.created_at, c.priority, c.clock_offset_hours).breached,
  );

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{ROLE_LABEL[role][lang]}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {lang === "ta" ? "பங்கு மாற்றி மேலே உள்ளது" : "Switch viewports from the role selector above"}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {complaints.length} tickets
          </span>
        </header>

        {loading && <p className="text-sm text-muted-foreground">Loading console…</p>}

        {role === "citizen" && (
          <CitizenView complaints={mine} wardMap={wardMap} onAdvance={advance} busyId={busyId} onPatch={patch} />
        )}
        {role === "field_officer" && (
          <FieldView complaints={complaints} wardMap={wardMap} onPatch={patch} onAdvance={advance} busyId={busyId} />
        )}
        {role === "zonal_commissioner" && (
          <ZonalView complaints={complaints} breached={breached} wardMap={wardMap} onPatch={patch} onAdvance={advance} />
        )}
        {role === "commissioner" && <CommissionerView complaints={complaints} wardMap={wardMap} onPatch={patch} />}
        {role === "councillor" && <CouncillorView complaints={complaints} wardMap={wardMap} />}
        {role === "admin" && (
          <section className="civic-card space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <ShieldCheck className="size-4" /> Administrator console
            </h2>
            <p className="text-sm text-muted-foreground">
              Citizen legal identity stays sealed platform-wide. Monitor SLA compliance, breaches and ward
              performance from the analytics console.
            </p>
            <Link
              to="/analytics"
              className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Open SLA analytics
            </Link>
          </section>
        )}
      </main>
      <VoiceAssistant />
    </div>
  );
}

/* ------------------------------- shared bits ------------------------------ */

function TicketRow({
  c,
  ward,
  children,
}: {
  c: Complaint;
  ward?: Ward;
  children?: React.ReactNode;
}) {
  const { lang } = useLang();
  return (
    <article className="civic-card space-y-3 p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-primary">{c.author_pseudonym}</p>
          <h3 className="truncate text-sm font-bold">{c.title}</h3>
          <p className="truncate text-xs text-muted-foreground">{wardLabel(ward, lang)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusPill status={c.status} />
          <PriorityPill priority={c.priority} />
        </div>
      </div>
      <SlaBar
        createdAt={c.created_at}
        priority={c.priority}
        offsetHours={c.clock_offset_hours}
        tier={c.current_tier as Tier}
      />
      {children}
    </article>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="civic-card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold leading-tight">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

/* -------------------------------- viewports ------------------------------- */

function CitizenView({
  complaints,
  wardMap,
  onAdvance,
  busyId,
  onPatch,
}: {
  complaints: Complaint[];
  wardMap: Map<string, Ward>;
  onAdvance: (c: Complaint) => void;
  busyId: string | null;
  onPatch: (c: Complaint, v: Partial<Complaint>, note: string, actor: string) => void;
}) {
  const { t } = useLang();
  const [calling, setCalling] = useState<Complaint | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="My grievances" value={complaints.length} icon={Activity} />
        <Stat
          label="Resolved"
          value={complaints.filter((c) => c.status === "resolved").length}
          icon={ShieldCheck}
        />
        <Stat
          label="Escalated"
          value={complaints.filter((c) => c.status === "escalated" || c.status === "joint_task_force").length}
          icon={AlertTriangle}
        />
      </div>

      <div className="civic-card flex items-center gap-2 p-3 text-xs">
        <ShieldCheck className="size-4 shrink-0 text-success" />
        <span className="min-w-0">
          <strong>{t("verifiedResident")}</strong> — issued after DigiLocker verification. It proves ward
          residency for voting and commenting without revealing who you are.
        </span>
      </div>

      <h2 className="text-sm font-bold">{t("myGrievances")}</h2>
      {complaints.length === 0 && (
        <p className="civic-card p-6 text-center text-sm text-muted-foreground">
          You haven't reported anything yet. <Link to="/report" className="text-primary underline">Report an issue</Link>.
        </p>
      )}
      {complaints.map((c) => (
        <TicketRow key={c.id} c={c} ward={c.ward_id ? wardMap.get(c.ward_id) : undefined}>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCalling(c)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
            >
              <PhoneCall className="size-3.5" /> {t("callOfficer")}
            </button>
            <Link
              to="/track/$id"
              params={{ id: c.id }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
            >
              Tracking page
            </Link>
            <button
              onClick={() => onAdvance(c)}
              disabled={busyId === c.id}
              className="flex items-center gap-1.5 rounded-lg border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning disabled:opacity-50"
            >
              <FastForward className="size-3.5" /> {t("fastForward")}
            </button>
          </div>

          {c.status === "verification" && (
            <div className="space-y-2 rounded-lg border border-chart-5/40 bg-chart-5/10 p-3">
              <p className="text-xs font-semibold">Dual verification — your approval is required</p>
              {c.resolution_photo_url && (
                <img src={c.resolution_photo_url} alt="Resolution proof" className="w-full rounded-md" />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    onPatch(c, { complainant_approved: true, status: "resolved" }, "Complainant accepted the resolution", "Complainant")
                  }
                  className="flex-1 rounded-lg bg-success px-3 py-2 text-xs font-semibold text-success-foreground"
                >
                  Accept resolution
                </button>
                <button
                  onClick={() =>
                    onPatch(c, { complainant_approved: false, status: "escalated", current_tier: "zonal", assigned_officer: officerForTier("zonal") }, "Complainant rejected the resolution — escalated", "Complainant")
                  }
                  className="flex-1 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </TicketRow>
      ))}

      <MaskedCallModal
        open={!!calling}
        onClose={() => setCalling(null)}
        officer={calling?.assigned_officer ?? officerForTier("field")}
        citizenAlias={calling?.author_pseudonym ?? "@citizen"}
      />
    </div>
  );
}

function FieldView({
  complaints,
  wardMap,
  onPatch,
  onAdvance,
  busyId,
}: {
  complaints: Complaint[];
  wardMap: Map<string, Ward>;
  onPatch: (c: Complaint, v: Partial<Complaint>, note: string, actor: string) => void;
  onAdvance: (c: Complaint) => void;
  busyId: string | null;
}) {
  const [proofFor, setProofFor] = useState<Complaint | null>(null);
  const [calling, setCalling] = useState<Complaint | null>(null);
  const queue = complaints.filter((c) => c.current_tier === "field" && c.status !== "resolved");

  const submitProof = (c: Complaint, cap: Capture) => {
    onPatch(
      c,
      { resolution_photo_url: cap.dataUrl, status: "verification" },
      "Resolution proof uploaded — moved to dual verification phase",
      "Field Officer",
    );
    setProofFor(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Ward-scoped tasks" value={queue.length} icon={Activity} />
        <Stat label="In progress" value={queue.filter((c) => c.status === "in_progress").length} icon={BarChart3} />
        <Stat
          label="Awaiting verification"
          value={complaints.filter((c) => c.status === "verification").length}
          icon={ShieldCheck}
        />
      </div>

      <p className="civic-card p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mr-1.5 inline size-3.5 text-success" />
        Citizen legal names and phone numbers are not available to field staff. Contact runs through the masked
        VoIP relay only.
      </p>

      {queue.map((c) => (
        <TicketRow key={c.id} c={c} ward={c.ward_id ? wardMap.get(c.ward_id) : undefined}>
          {c.photo_url && <img src={c.photo_url} alt="" className="max-h-56 w-full rounded-lg object-cover" />}
          <div className="flex flex-wrap gap-2">
            {c.status === "assigned" && (
              <button
                onClick={() => onPatch(c, { status: "in_progress" }, "Work started on site", "Field Officer")}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Start work
              </button>
            )}
            <button
              onClick={() => setProofFor(c)}
              className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground"
            >
              Upload completion proof
            </button>
            <button
              onClick={() => setCalling(c)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
            >
              <PhoneCall className="size-3.5" /> Call complainant (masked)
            </button>
            <button
              onClick={() => onAdvance(c)}
              disabled={busyId === c.id}
              className="flex items-center gap-1.5 rounded-lg border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning disabled:opacity-50"
            >
              <FastForward className="size-3.5" /> +1h
            </button>
          </div>

          {proofFor?.id === c.id && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold">Geotagged completion proof</p>
              <GeoCamera
                wardLabel={wardLabel(c.ward_id ? wardMap.get(c.ward_id) : undefined, "en")}
                zoneLabel="Officer completion capture"
                onCapture={(cap) => submitProof(c, cap)}
              />
            </div>
          )}
        </TicketRow>
      ))}

      <MaskedCallModal
        open={!!calling}
        onClose={() => setCalling(null)}
        officer={calling?.author_pseudonym ?? "@citizen"}
        citizenAlias="Officer relay identity"
      />
    </div>
  );
}

function ZonalView({
  complaints,
  breached,
  wardMap,
  onPatch,
  onAdvance,
}: {
  complaints: Complaint[];
  breached: Complaint[];
  wardMap: Map<string, Ward>;
  onPatch: (c: Complaint, v: Partial<Complaint>, note: string, actor: string) => void;
  onAdvance: (c: Complaint) => void;
}) {
  const { lang } = useLang();
  const zones = useMemo(() => {
    const map = new Map<string, { total: number; breached: number }>();
    complaints.forEach((c) => {
      const zone = (c.ward_id && wardMap.get(c.ward_id)?.zone) || "Unassigned";
      const row = map.get(zone) ?? { total: 0, breached: 0 };
      row.total += 1;
      if (computeClock(c.created_at, c.priority, c.clock_offset_hours).breached) row.breached += 1;
      map.set(zone, row);
    });
    return [...map.entries()];
  }, [complaints, wardMap]);

  const queue = complaints.filter((c) => c.current_tier === "zonal");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Escalated to zone" value={queue.length} icon={AlertTriangle} />
        <Stat label="SLA breaches" value={breached.length} icon={Activity} />
        <Stat label="Zones monitored" value={zones.length} icon={BarChart3} />
      </div>

      <section className="civic-card overflow-hidden">
        <h2 className="border-b border-border px-4 py-3 text-sm font-bold">Zonal performance matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Zone</th>
                <th className="px-4 py-2">Tickets</th>
                <th className="px-4 py-2">Breached</th>
                <th className="px-4 py-2">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {zones.map(([zone, row]) => {
                const pct = row.total ? Math.round(((row.total - row.breached) / row.total) * 100) : 100;
                return (
                  <tr key={zone} className="border-t border-border">
                    <td className="px-4 py-2.5 font-semibold">{zone}</td>
                    <td className="px-4 py-2.5">{row.total}</td>
                    <td className="px-4 py-2.5 text-destructive">{row.breached}</td>
                    <td className="px-4 py-2.5">
                      <span className={pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <h2 className="text-sm font-bold">Escalated ticket queue</h2>
      {queue.length === 0 && (
        <p className="civic-card p-6 text-center text-sm text-muted-foreground">
          No field SLA breaches have reached the zonal desk. Use the +1h simulator to demonstrate one.
        </p>
      )}
      {queue.map((c) => (
        <TicketRow key={c.id} c={c} ward={c.ward_id ? wardMap.get(c.ward_id) : undefined}>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                onPatch(
                  c,
                  { assigned_officer: officerForTier("field"), current_tier: "field", status: "assigned" },
                  "Reassigned back to a field officer by the Zonal Assistant Commissioner",
                  "Zonal Assistant Commissioner",
                )
              }
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              Reassign to field officer
            </button>
            <button
              onClick={() =>
                onPatch(
                  c,
                  { current_tier: "commissioner", status: "escalated", assigned_officer: officerForTier("commissioner") },
                  "Escalated to the Corporation Commissioner",
                  "Zonal Assistant Commissioner",
                )
              }
              className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
            >
              Escalate to Commissioner
            </button>
            <button
              onClick={() => onAdvance(c)}
              className="flex items-center gap-1.5 rounded-lg border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning"
            >
              <FastForward className="size-3.5" /> +1h
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Current tier: {TIER_LABEL[c.current_tier as Tier][lang]}
          </p>
        </TicketRow>
      ))}
    </div>
  );
}

function CommissionerView({
  complaints,
  wardMap,
  onPatch,
}: {
  complaints: Complaint[];
  wardMap: Map<string, Ward>;
  onPatch: (c: Complaint, v: Partial<Complaint>, note: string, actor: string) => void;
}) {
  const heat = useMemo(() => {
    const map = new Map<string, number>();
    complaints.forEach((c) => {
      const key = c.ward_id ? wardMap.get(c.ward_id)?.ward_name_en ?? "Unknown" : "Unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [complaints, wardMap]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { total: number; resolved: number }>();
    complaints.forEach((c) => {
      const row = map.get(c.category) ?? { total: 0, resolved: 0 };
      row.total += 1;
      if (c.status === "resolved") row.resolved += 1;
      map.set(c.category, row);
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [complaints]);

  const deadlockCandidates = complaints.filter((c) => {
    const clock = computeClock(c.created_at, c.priority, c.clock_offset_hours);
    return c.current_tier === "commissioner" && clock.deadlockHours >= 48;
  });

  const max = heat[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total tickets" value={complaints.length} icon={Activity} />
        <Stat label="Resolved" value={complaints.filter((c) => c.status === "resolved").length} icon={ShieldCheck} />
        <Stat label="At Commissioner tier" value={complaints.filter((c) => c.current_tier === "commissioner").length} icon={Users} />
        <Stat label="Joint Task Force" value={complaints.filter((c) => c.current_tier === "jtf").length} icon={AlertTriangle} />
      </div>

      <section className="civic-card space-y-3 p-4">
        <h2 className="text-sm font-bold">Ward heatmap</h2>
        <div className="space-y-2">
          {heat.map(([ward, n]) => (
            <div key={ward} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 text-xs">
              <span className="truncate text-muted-foreground">{ward}</span>
              <span className="h-2 overflow-hidden rounded-full bg-secondary">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-primary to-destructive"
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </span>
              <span className="font-semibold">{n}</span>
            </div>
          ))}
          {heat.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
        </div>
      </section>

      <section className="civic-card overflow-hidden">
        <h2 className="border-b border-border px-4 py-3 text-sm font-bold">Department performance ranking</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Tickets</th>
                <th className="px-4 py-2">Closure rate</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map(([cat, row]) => (
                <tr key={cat} className="border-t border-border">
                  <td className="px-4 py-2.5 font-semibold capitalize">{cat}</td>
                  <td className="px-4 py-2.5">{row.total}</td>
                  <td className="px-4 py-2.5">{Math.round((row.resolved / row.total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="civic-card space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <AlertTriangle className="size-4 text-destructive" /> Cross-departmental deadlock breaker
        </h2>
        <p className="text-xs text-muted-foreground">
          Tickets parked at the Commissioner tier for more than 48 hours convert into a Joint Task Force
          Request and ping TWAD Board and the Highways Department.
        </p>
        {deadlockCandidates.length === 0 && (
          <p className="text-xs text-muted-foreground">No ticket has crossed the 48h commissioner threshold.</p>
        )}
        {deadlockCandidates.map((c) => (
          <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <span className="min-w-0 truncate text-xs font-semibold">{c.title}</span>
            <button
              onClick={() =>
                onPatch(
                  c,
                  { current_tier: "jtf", status: "joint_task_force", assigned_officer: officerForTier("jtf") },
                  "Joint Task Force Request raised — TWAD Board & Highways Department notified",
                  "Corporation Commissioner (IAS)",
                )
              }
              className="shrink-0 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
            >
              Trigger JTF
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function CouncillorView({ complaints, wardMap }: { complaints: Complaint[]; wardMap: Map<string, Ward> }) {
  const { lang } = useLang();
  const active = complaints.filter((c) => c.status !== "resolved");
  const resolved = complaints.filter((c) => c.status === "resolved");

  return (
    <div className="space-y-4">
      <p className="civic-card p-3 text-xs text-muted-foreground">
        Read-only constituency view for council session auditing. Councillors cannot reassign officers or edit
        ticket state.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Active in constituency" value={active.length} icon={Activity} />
        <Stat label="Closed this cycle" value={resolved.length} icon={ShieldCheck} />
      </div>
      {complaints.map((c) => (
        <article key={c.id} className="civic-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{c.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {wardLabel(c.ward_id ? wardMap.get(c.ward_id) : undefined, lang)}
            </span>
          </span>
          <StatusPill status={c.status} />
        </article>
      ))}
    </div>
  );
}
