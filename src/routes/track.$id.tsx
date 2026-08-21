import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { complaintFieldReport } from "@/lib/workflow.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { TopBar } from "@/components/TopBar";
import { StatusPill, PriorityPill } from "@/components/StatusPill";
import { SlaBar } from "@/components/SlaBar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { issueWardToken } from "@/lib/civic.functions";
import { applyEscalation, fetchComplaint, fetchEvents, type Complaint } from "@/lib/data";
import type { Tier } from "@/lib/sla";
import { EmblemLoader } from "@/components/EmblemLoader";

export const Route = createFileRoute("/track/$id")({
  head: () => ({
    meta: [
      { title: "Live Grievance Tracking — TN SmartMunicipality" },
      {
        name: "description",
        content:
          "Shareable real-time tracking page for a municipal grievance: status pills, SLA countdown, escalation audit trail and ward-verified resolution voting.",
      },
      { property: "og:title", content: "Live Grievance Tracking — TN SmartMunicipality" },
      { property: "og:description", content: "Follow this ticket from assignment to verified closure." },
    ],
  }),
  component: TrackPage,
});

type EventRow = { id: string; event_type: string; actor_label: string; note: string | null; created_at: string };
type FieldReport = Awaited<ReturnType<typeof complaintFieldReport>>;

/** Plain-language explanation of where the ticket currently stands. */
function plainStatus(status: string, ta: boolean) {
  const map: Record<string, { en: string; ta: string }> = {
    submitted: { en: "Your complaint has been received and is waiting to be assigned to a worker.", ta: "உங்கள் புகார் பெறப்பட்டது; பணியாளர் நியமிக்கப்பட உள்ளது." },
    assigned: { en: "A field worker has been assigned and will visit the spot soon.", ta: "களப் பணியாளர் நியமிக்கப்பட்டார்; விரைவில் வருவார்." },
    worker_accepted: { en: "The worker accepted the job and is preparing to travel.", ta: "பணியாளர் பணியை ஏற்றுக்கொண்டார்." },
    travelling: { en: "The worker is on the way to your location.", ta: "பணியாளர் உங்கள் இடத்திற்கு வந்து கொண்டிருக்கிறார்." },
    arrived: { en: "The worker has reached the spot.", ta: "பணியாளர் இடத்தை அடைந்துவிட்டார்." },
    in_progress: { en: "Work is going on at the spot right now.", ta: "இடத்தில் பணி நடைபெற்று வருகிறது." },
    evidence_submitted: { en: "The worker finished and uploaded a photo of the completed work.", ta: "பணி முடிந்து புகைப்படம் பதிவேற்றப்பட்டது." },
    officer_review: { en: "The officer is checking the worker's photo and report.", ta: "அலுவலர் புகைப்படத்தையும் அறிக்கையையும் சரிபார்க்கிறார்." },
    officer_approved: { en: "The officer approved the work. Your confirmation is next.", ta: "அலுவலர் பணியை ஏற்றார். உங்கள் உறுதிப்படுத்தல் தேவை." },
    citizen_verification: { en: "Please confirm whether the issue is really fixed.", ta: "பிரச்சினை சரிசெய்யப்பட்டதா என்பதை உறுதிப்படுத்தவும்." },
    verification: { en: "Neighbours in your ward are voting on whether the work is genuine.", ta: "உங்கள் வார்டு மக்கள் பணி குறித்து வாக்களிக்கின்றனர்." },
    resolved: { en: "This complaint is closed as resolved.", ta: "இந்தப் புகார் தீர்க்கப்பட்டு மூடப்பட்டது." },
    resolved_by_citizen: { en: "You confirmed the fix, so the complaint is closed.", ta: "நீங்கள் உறுதிப்படுத்தியதால் புகார் மூடப்பட்டது." },
    reopened: { en: "You were not satisfied, so the complaint was reopened for rework.", ta: "திருப்தி இல்லாததால் புகார் மீண்டும் திறக்கப்பட்டது." },
    auto_closed_no_response: { en: "No reply was received in time, so the complaint closed automatically.", ta: "பதில் வராததால் புகார் தானாக மூடப்பட்டது." },
    escalated: { en: "The deadline passed, so a senior officer has taken over.", ta: "கால அவகாசம் முடிந்ததால் மூத்த அலுவலர் பொறுப்பேற்றார்." },
    joint_task_force: { en: "A joint task force of departments is handling this case.", ta: "கூட்டுப் பணிக்குழு இதைக் கையாள்கிறது." },
    rejected: { en: "This complaint was rejected after review.", ta: "மறுஆய்வுக்குப் பிறகு புகார் நிராகரிக்கப்பட்டது." },
  };
  const e = map[status];
  return e ? (ta ? e.ta : e.en) : ta ? "நிலை புதுப்பிக்கப்பட்டு வருகிறது." : "Status is being updated.";
}

function officerDecisionLabel(state: string, ta: boolean) {
  if (state === "OFFICER_APPROVED") return ta ? "அலுவலர் ஏற்றார்" : "Approved by officer";
  if (state === "OFFICER_REJECTED") return ta ? "அலுவலர் நிராகரித்தார்" : "Rejected — rework ordered";
  return ta ? "அலுவலர் சரிபார்ப்பில்" : "Awaiting officer check";
}

function TrackPage() {
  const { t, lang } = useLang();
  const ta = lang === "ta";
  const { id } = Route.useParams();
  const { user } = useSession();
  const [c, setC] = useState<Complaint | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [comments, setComments] = useState<{ id: string; pseudonym: string; body: string; ward_verified: boolean }[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<{ approve: boolean; voter_id: string }[]>([]);
  const [report, setReport] = useState<FieldReport>(null);
  const loadReport = useServerFn(complaintFieldReport);

  const refresh = async () => {
    const found = await fetchComplaint(id);
    if (!found) {
      setLoading(false);
      return;
    }
    const updated = await applyEscalation(found).catch(() => found);
    setC(updated);
    setEvents((await fetchEvents(id)) as EventRow[]);
    const { data } = await supabase
      .from("complaint_comments")
      .select("id,pseudonym,body,ward_verified")
      .eq("complaint_id", id)
      .order("created_at");
    setComments(data ?? []);
    const { data: voteRows } = await supabase
      .from("resolution_votes")
      .select("approve,voter_id")
      .eq("complaint_id", id);
    setVotes(voteRows ?? []);
    await loadReport({ data: { complaintId: id } })
      .then((r) => setReport(r))
      .catch(() => undefined);
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addComment = async () => {
    if (!user || !c) return toast.error(t("track.signInComment"));
    if (body.trim().length < 2) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudonym, ward_id")
      .eq("id", user.id)
      .maybeSingle();
    let wardVerified = false;
    try {
      if (c.ward_id && profile?.ward_id === c.ward_id) {
        await issueWardToken({ data: { wardId: c.ward_id } });
        wardVerified = true;
      }
    } catch {
      wardVerified = false;
    }
    const { error } = await supabase.from("complaint_comments").insert({
      complaint_id: c.id,
      user_id: user.id,
      pseudonym: profile?.pseudonym ?? "@citizen",
      body: body.trim(),
      ward_verified: wardVerified,
    });
    if (error) return toast.error(error.message);
    setBody("");
    refresh();
  };

  const vote = async (approve: boolean) => {
    if (!user || !c?.ward_id) return toast.error(t("track.signInVote"));
    try {
      const { token } = await issueWardToken({ data: { wardId: c.ward_id } });
      const { error } = await supabase
        .from("resolution_votes")
        .insert({ complaint_id: c.id, voter_id: user.id, approve, zkp_token: token });
      if (error) throw error;
      toast.success(approve ? t("track.voteApproved") : t("track.voteRejected"));
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("track.zkpProofFailed"));
    }
  };

  const approveCount = votes.filter((v) => v.approve).length;
  const rejectCount = votes.length - approveCount;
  const totalVotes = votes.length;
  const hasVoted = !!user && votes.some((v) => v.voter_id === user.id);

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        {loading && <EmblemLoader label={t("track.loadingTicket")} />}
        {!loading && !c && <p className="civic-card p-6 text-center text-sm">{t("track.invalidLink")}</p>}

        {c && (
          <>
            <article className="civic-card space-y-3 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-primary">{c.author_pseudonym}</p>
                  <h1 className="text-lg font-bold leading-snug">{c.title}</h1>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusPill status={c.status} />
                  <PriorityPill priority={c.priority} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{c.description}</p>
              {c.photo_url && <img src={c.photo_url} alt={c.title} className="w-full rounded-lg" />}
              <SlaBar
                createdAt={c.created_at}
                priority={c.priority}
                offsetHours={c.clock_offset_hours}
                tier={c.current_tier as Tier}
              />
            </article>

            <section className="civic-card space-y-2 p-4">
              <h2 className="text-sm font-bold">{ta ? "இப்போது என்ன நடக்கிறது?" : "What is happening now?"}</h2>
              <p className="text-sm text-muted-foreground">{plainStatus(c.status, ta)}</p>
            </section>

            {(report || c.resolution_photo_url || c.work_summary || c.resolution_note) && (
              <section className="civic-card space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold">
                    {ta ? "அலுவலர் அளித்த பணி அறிக்கை" : "Officer-verified work report"}
                  </h2>
                  {(() => {
                    const st = report?.officerState ?? (c.resolution_photo_url ? "OFFICER_APPROVED" : "PENDING");
                    const map: Record<string, { en: string; ta: string; cls: string }> = {
                      OFFICER_APPROVED: {
                        en: "Approved & published",
                        ta: "அங்கீகரிக்கப்பட்டு வெளியிடப்பட்டது",
                        cls: "bg-primary/10 text-primary border-primary/30",
                      },
                      OFFICER_REJECTED: {
                        en: "Rejected by officer",
                        ta: "அலுவலரால் நிராகரிக்கப்பட்டது",
                        cls: "bg-destructive/10 text-destructive border-destructive/30",
                      },
                      PENDING: {
                        en: "Proof uploaded — awaiting officer approval",
                        ta: "ஆதாரம் பதிவேற்றப்பட்டது — அலுவலர் ஒப்புதலுக்கு காத்திருக்கிறது",
                        cls: "bg-muted text-muted-foreground border-border",
                      },
                    };
                    const badge = map[st] ?? map.PENDING;
                    return (
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>
                        {ta ? badge.ta : badge.en}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {ta
                    ? "களப் பணியாளர் அனுப்பிய விவரம், புகைப்படம் மற்றும் அலுவலர் முடிவு."
                    : "What the field worker did, the photo they took on site, and the officer's decision."}
                </p>


                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {ta ? "செய்யப்பட்ட பணி" : "Work done"}
                  </p>
                  <p className="text-sm">
                    {report?.description ??
                      c.work_summary ??
                      c.resolution_note ??
                      (ta ? "விவரம் பதிவு செய்யப்படவில்லை." : "No description was added.")}
                  </p>
                </div>

                <dl className="grid gap-2 sm:grid-cols-3">
                  {(report?.workerName || c.assigned_officer) && (
                    <Detail
                      label={ta ? "பணி செய்தவர்" : "Done by"}
                      value={
                        report?.workerName
                          ? `${report.workerName}${report.workerDepartment ? ` · ${report.workerDepartment}` : ""}`
                          : (c.assigned_officer as string)
                      }
                    />
                  )}
                  {c.materials_used && (
                    <Detail label={ta ? "பயன்படுத்திய பொருட்கள்" : "Materials used"} value={c.materials_used} />
                  )}
                  {(report?.workStartedAt ?? c.work_started_at) && (
                    <Detail
                      label={ta ? "தொடங்கியது" : "Started"}
                      value={new Date((report?.workStartedAt ?? c.work_started_at) as string).toLocaleString("en-IN")}
                    />
                  )}
                  {(report?.workCompletedAt ?? c.work_completed_at) && (
                    <Detail
                      label={ta ? "முடிந்தது" : "Finished"}
                      value={new Date((report?.workCompletedAt ?? c.work_completed_at) as string).toLocaleString("en-IN")}
                    />
                  )}
                  {report && (
                    <Detail
                      label={ta ? "இட சரிபார்ப்பு" : "Location check"}
                      value={
                        report.locationVerified
                          ? ta
                            ? "புகார் இடத்தில் எடுக்கப்பட்டது"
                            : "Photo taken at the complaint spot"
                          : ta
                            ? "சரிபார்க்கப்படவில்லை"
                            : "Not confirmed"
                      }
                    />
                  )}
                  {report && (
                    <Detail
                      label={ta ? "அலுவலர் முடிவு" : "Officer decision"}
                      value={officerDecisionLabel(report.officerState, ta)}
                    />
                  )}
                </dl>

                {report?.officerReason && (
                  <p className="rounded-lg border border-border bg-secondary/40 p-2 text-xs">
                    {ta ? "அலுவலர் குறிப்பு" : "Officer note"}: {report.officerReason}
                  </p>
                )}

                {(report?.photoUrl || c.resolution_photo_url) && (
                  <figure className="space-y-1.5">
                    <img
                      src={(report?.photoUrl ?? c.resolution_photo_url) as string}
                      alt={`Work completion photo for ${c.title}`}
                      className="w-full rounded-lg"
                    />
                    <figcaption className="text-xs text-muted-foreground">
                      {c.proof_caption ?? (ta ? "இடத்தில் எடுக்கப்பட்ட புகைப்படம்" : "Photo captured on site")}
                    </figcaption>
                  </figure>
                )}
              </section>
            )}

            {c.status === "verification" && (
              <section className="civic-card space-y-3 p-4">
                <h2 className="text-sm font-bold">{t("track.regionalVote")}</h2>
                <p className="text-xs text-muted-foreground">{t("track.regionalVoteDesc")}</p>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-success">
                      {approveCount} {ta ? "ஆம்" : "yes"}
                    </span>
                    <span className="text-destructive">
                      {rejectCount} {ta ? "இல்லை" : "no"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-success transition-all"
                      style={{ width: `${totalVotes ? (approveCount / totalVotes) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {hasVoted ? (
                  <p className="rounded-lg border border-border bg-secondary/40 p-2 text-center text-xs font-semibold">
                    {ta ? "உங்கள் வாக்கு பதிவு செய்யப்பட்டது" : "Your vote has been recorded"}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => vote(true)} className="flex-1 rounded-lg bg-success px-3 py-2 text-xs font-semibold text-success-foreground">
                      {t("track.worksMatches")}
                    </button>
                    <button onClick={() => vote(false)} className="flex-1 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground">
                      {t("track.doesNotMatch")}
                    </button>
                  </div>
                )}
              </section>
            )}

            <section className="civic-card space-y-3 p-4">
              <h2 className="text-sm font-bold">{t("track.auditTrail")}</h2>
              <ol className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">{e.actor_label}</span>
                      <span className="block text-xs text-muted-foreground">{e.note ?? e.event_type}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("en-IN")}
                      </span>
                    </span>
                  </li>
                ))}
                {events.length === 0 && <p className="text-xs text-muted-foreground">{t("track.noEventsYet")}</p>}
              </ol>
            </section>

            <section className="civic-card space-y-3 p-4">
              <h2 className="text-sm font-bold">{t("track.wardDiscussion")}</h2>
              {comments.map((m) => (
                <div key={m.id} className="rounded-lg border border-border p-3">
                  <p className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs font-semibold">
                    <span className="truncate text-primary">{m.pseudonym}</span>
                    {m.ward_verified && (
                      <span className="shrink-0 rounded-full border border-success/50 bg-success/10 px-2 py-0.5 text-[10px] text-success">
                        {t("track.zkpWardResident")}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
                </div>
              ))}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={500}
                  placeholder={t("track.addComment")}
                  className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button onClick={addComment} className="shrink-0 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground">
                  {t("track.post")}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-xs">{value}</dd>
    </div>
  );
}
