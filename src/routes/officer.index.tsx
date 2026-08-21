import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Activity,
  AlertTriangle,
  BarChart3,
  FastForward,
  HardHat,
  MapPin,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { StatusPill } from "@/components/StatusPill";
import { BAND_LABEL, BAND_TONE, queueRank, triage } from "@/lib/triage";
import { SlaBar } from "@/components/SlaBar";
import { type Capture } from "@/components/GeoCamera";
import { WorkReportForm, type WorkReport } from "@/components/WorkReportForm";
import { MaskedCallModal } from "@/components/MaskedCallModal";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { computeClock, type Tier } from "@/lib/sla";
import {
  applyEscalation,
  escalateNow,
  fastForward,
  fetchComplaints,
  fetchWards,
  logEvent,
  officerForTier,
  wardLabel,
  type Complaint,
  type Ward,
} from "@/lib/data";
import { EmblemLoader } from "@/components/EmblemLoader";
import { AssignWorkerControl } from "@/components/AssignWorkerControl";
import { OfficerVerificationQueue } from "@/components/OfficerVerificationQueue";
import { RoleGate } from "@/components/RoleGate";

export const Route = createFileRoute("/officer/")({
  head: () => ({
    meta: [
      { title: "Officer Workspace — TN SmartMunicipality" },
      {
        name: "description",
        content:
          "Ward-scoped task board for MAWS field officers with masked citizen calls, geotagged completion proofs and live SLA meters.",
      },
      { property: "og:title", content: "Officer Workspace — TN SmartMunicipality" },
      {
        property: "og:description",
        content: "Ward tasks, escalations and resolution uploads for on-ground officers.",
      },
    ],
  }),
  component: OfficerRoute,
});

function OfficerRoute() {
  return (
    <RoleGate allow={["field_officer", "zonal_commissioner", "commissioner", "councillor", "admin"]}>
      <OfficerWorkspace />
    </RoleGate>
  );
}

function OfficerWorkspace() {
  const { lang, t } = useLang();
  const { user, loading: sessionLoading } = useSession();
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [officerWardId, setOfficerWardId] = useState<string | null>(null);
  const [officerName, setOfficerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofFor, setProofFor] = useState<Complaint | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [calling, setCalling] = useState<Complaint | null>(null);

  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate({ to: "/officer/login", replace: true });
    }
  }, [user, sessionLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    const [list, w, prof] = await Promise.all([
      fetchComplaints(),
      fetchWards(),
      supabase.from("profiles").select("ward_id, pseudonym").eq("id", user.id).maybeSingle(),
    ]);
    const escalated = await Promise.all(list.map((c) => applyEscalation(c).catch(() => c)));
    setComplaints(escalated);
    setWards(w);
    setOfficerWardId(prof.data?.ward_id ?? null);
    setOfficerName(prof.data?.pseudonym ?? "@officer");
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const wardMap = useMemo(() => new Map(wards.map((w) => [w.id, w])), [wards]);
  const officerWard = officerWardId ? wardMap.get(officerWardId) : undefined;

  // Ranked by the health-impact triage engine: odour, sewage, stagnant water and
  // rotting-waste hazards surface at the top regardless of how "small" they look.
  const queue = useMemo(() => {
    const active = complaints.filter((c) => c.status !== "resolved");
    // Ward-scoped view first, but never hide work: complaints with no ward and
    // (when the ward is empty) the wider corporation queue still surface.
    const inWard = officerWardId
      ? active.filter((c) => c.ward_id === officerWardId || !c.ward_id)
      : active;
    const scoped = inWard.length ? inWard : active;
    return [...scoped].sort((a, b) => queueRank(b) - queueRank(a));
  }, [complaints, officerWardId]);


  // Proof uploaded by the officer → waiting for the complainant's confirmation.
  const awaitingVerification = useMemo(
    () => queue.filter((c) => c.status === "verification"),
    [queue],
  );

  const citizenReopened = useMemo(() => queue.filter((c) => c.status === "reopened"), [queue]);


  const breachedCount = useMemo(
    () =>
      queue.filter((c) => computeClock(c.created_at, c.priority, c.clock_offset_hours, { slaHours: c.sla_hours }).breached).length,
    [queue],
  );

  const patch = async (c: Complaint, values: Partial<Complaint>, note: string) => {
    const { data, error } = await supabase.from("complaints").update(values).eq("id", c.id).select().maybeSingle();
    if (error) return toast.error(error.message);
    if (!data) {
      return toast.error(
        lang === "ta"
          ? "புதுப்பிக்க முடியவில்லை — உங்கள் கணக்கிற்கு அலுவலர் அனுமதி இல்லை."
          : "Update blocked — your account does not have officer permission for this ticket.",
      );
    }
    await logEvent(c.id, "update", officerName || "Field Officer", note);
    setComplaints((prev) => prev.map((x) => (x.id === c.id ? ((data ?? x) as Complaint) : x)));
    toast.success(note);
  };


  const advance = async (c: Complaint) => {
    setBusyId(c.id);
    try {
      const updated = await fastForward(c, 1);
      setComplaints((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      if (updated.status !== c.status) {
        toast.error(`${t("officer.autoEscalated")} ${updated.assigned_officer ?? t("officer.nextTier")}`);
      } else {
        toast.info(t("officer.slaClockPlusOne"));
      }
    } finally {
      setBusyId(null);
    }
  };

  /** Officer-only: push the ticket up one authority tier immediately. */
  const escalate = async (c: Complaint) => {
    setBusyId(c.id);
    try {
      const updated = await escalateNow(c);
      setComplaints((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(`${t("officer.autoEscalated")} ${updated.assigned_officer ?? t("officer.nextTier")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Escalation failed");
    } finally {
      setBusyId(null);
    }
  };

  const submitProof = (c: Complaint, report: WorkReport, cap: Capture) => {
    patch(
      c,
      {
        resolution_photo_url: cap.dataUrl,
        status: "verification",
        ...report,
      },
      t("officer.proofUploadedNote"),
    );
    setProofFor(null);
    setProofNote("");
  };

  if (sessionLoading || (!user && !sessionLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <main className="mx-auto max-w-6xl px-4 py-6">
          <p className="text-sm text-muted-foreground">{t("officer.redirecting")}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-xl font-bold">
              <HardHat className="size-5 shrink-0 text-primary" /> {t("officer.workspace")}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {officerName} · <MapPin className="inline size-3" /> {wardLabel(officerWard, lang)}
            </p>
          </div>
          <Link
            to="/analytics"
            className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            <BarChart3 className="mr-1.5 inline size-3.5" /> {t("officer.slaAnalytics")}
          </Link>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={t("officer.myWardTasks")} value={queue.length} icon={Activity} />
          <Stat label={t("officer.slaBreaches")} value={breachedCount} icon={AlertTriangle} />
          <Stat label={t("officer.awaitingVerification")} value={awaitingVerification.length} icon={ShieldCheck} />
        </div>

        <p className="civic-card flex items-start gap-2 border-warning/40 p-3 text-xs">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            <strong>{t("officer.aiRankingTitle")}</strong> {t("officer.aiRankingBody")}
          </span>
        </p>

        <p className="civic-card flex items-start gap-2 p-3 text-xs">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <span>{t("officer.maskedContactNotice")}</span>
        </p>


        <OfficerVerificationQueue />

        {(awaitingVerification.length > 0 || citizenReopened.length > 0) && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <ShieldCheck className="size-4 text-primary" />
              {lang === "ta" ? "குடிமகன் உறுதிப்படுத்தல் நிலுவையில்" : "Awaiting citizen confirmation"}
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                {awaitingVerification.length}
              </span>
            </h2>

            {awaitingVerification.map((c) => (
              <article key={c.id} className="civic-card space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold">{c.title}</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.author_pseudonym} · {wardLabel(c.ward_id ? wardMap.get(c.ward_id) : undefined, lang)}
                    </p>
                  </div>
                  <StatusPill status={c.status} />
                </div>
                {c.resolution_photo_url && (
                  <img src={c.resolution_photo_url} alt="" className="max-h-48 w-full rounded-lg object-cover" />
                )}
                {(c.work_summary || c.resolution_note) && (
                  <p className="text-xs text-muted-foreground">{c.work_summary ?? c.resolution_note}</p>
                )}
                <p className="rounded-lg border border-border bg-secondary/40 p-2 text-[11px] text-muted-foreground">
                  {lang === "ta"
                    ? "சான்று பதிவேற்றப்பட்டது. குடிமகன் 'சரி' என்றால் புகார் தானாக 'தீர்க்கப்பட்டது' நிலைக்கு மாறும்."
                    : "Proof uploaded. When the complainant confirms, the ticket moves automatically to Resolved."}
                </p>
                <Link
                  to="/track/$id"
                  params={{ id: c.id }}
                  className="inline-block rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                >
                  {t("officer.trackingPage")}
                </Link>
              </article>
            ))}

            {citizenReopened.map((c) => (
              <article key={c.id} className="civic-card space-y-2 border-destructive/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold">{c.title}</h3>
                    <p className="text-xs text-destructive">
                      {lang === "ta"
                        ? "குடிமகன் திருப்தி அடையவில்லை — மீண்டும் பணி தேவை."
                        : "Citizen not satisfied — rework required."}
                    </p>
                  </div>
                  <StatusPill status={c.status} />
                </div>
                <Link
                  to="/track/$id"
                  params={{ id: c.id }}
                  className="inline-block rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                >
                  {t("officer.trackingPage")}
                </Link>
              </article>
            ))}
          </section>
        )}



        {loading && <EmblemLoader label={t("officer.loadingQueue")} />}

        {!loading && queue.length === 0 && (
          <p className="civic-card p-6 text-center text-sm text-muted-foreground">
            {t("officer.emptyQueuePrefix")}{" "}
            <Link to="/analytics" className="text-primary underline">
              {t("officer.emptyQueueLink")}
            </Link>{" "}
            {t("officer.emptyQueueSuffix")}
          </p>
        )}

        {queue.map((c, i) => {
          const tri = triage(c);
          return (
          <article key={c.id} className="civic-card space-y-3 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-primary">
                  #{i + 1} · {c.author_pseudonym}
                </p>
                <h3 className="truncate text-sm font-bold">{c.title}</h3>
                <p className="truncate text-xs text-muted-foreground">
                  {wardLabel(c.ward_id ? wardMap.get(c.ward_id) : undefined, lang)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusPill status={c.status} />
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${BAND_TONE[tri.band]}`}
                >
                  {BAND_LABEL[tri.band][lang]} · {tri.score}
                </span>
              </div>
            </div>

            <p className="rounded-lg border border-border bg-secondary/40 p-2 text-[11px] text-muted-foreground">
              <strong className="text-foreground">{t("officer.whyThisRank")}</strong> {tri.reasons.join(" · ")}
            </p>

            <SlaBar
              createdAt={c.created_at}
              priority={c.priority}
              offsetHours={c.clock_offset_hours}
              tier={c.current_tier as Tier}
              slaHours={c.sla_hours}
            />


            {c.photo_url && (
              <img src={c.photo_url} alt="" className="max-h-56 w-full rounded-lg object-cover" />
            )}

            <p className="text-xs text-muted-foreground">{c.description}</p>

            <div className="flex flex-wrap gap-2">
              {c.status === "assigned" && (
                <button
                  onClick={() => patch(c, { status: "in_progress" }, t("officer.startWorkNote"))}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  {t("officer.startWork")}
                </button>
              )}
              {c.status !== "verification" && c.status !== "resolved" && (
                <button
                  onClick={() => {
                    setProofFor(c);
                    setProofNote("");
                  }}
                  className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground"
                >
                  {t("officer.uploadProof")}
                </button>
              )}
              <button
                onClick={() => setCalling(c)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
              >
                <PhoneCall className="size-3.5" /> {t("officer.callComplainant")}
              </button>
              <button
                onClick={() => advance(c)}
                disabled={busyId === c.id}
                className="flex items-center gap-1.5 rounded-lg border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning disabled:opacity-50"
              >
                <FastForward className="size-3.5" /> {t("officer.plusOneHour")}
              </button>
              <button
                onClick={() => escalate(c)}
                disabled={busyId === c.id}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50"
              >
                <ArrowUpRight className="size-3.5" />
                {lang === "ta" ? "மேல் அதிகாரிக்கு அனுப்பு" : "Escalate to higher authority"}
              </button>
              <AssignWorkerControl complaintId={c.id} onAssigned={load} />
              <Link
                to="/track/$id"
                params={{ id: c.id }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
              >
                {t("officer.trackingPage")}
              </Link>
            </div>

            {proofFor?.id === c.id && (
              <WorkReportForm
                wardLabel={wardLabel(c.ward_id ? wardMap.get(c.ward_id) : undefined, "en")}
                zoneLabel={t("officer.completionCapture")}
                onSubmit={(report, cap) => submitProof(c, report, cap)}
                onCancel={() => {
                  setProofFor(null);
                  setProofNote("");
                }}
              />
            )}
          </article>
          );
        })}


        <MaskedCallModal
          open={!!calling}
          onClose={() => setCalling(null)}
          officer={calling?.author_pseudonym ?? "@citizen"}
          citizenAlias={officerName || officerForTier("field")}
        />
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
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
