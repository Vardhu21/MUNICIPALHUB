import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { StatusPill, PriorityPill } from "@/components/StatusPill";
import { SlaBar } from "@/components/SlaBar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { issueWardToken } from "@/lib/civic.functions";
import { applyEscalation, fetchComplaint, fetchEvents, type Complaint } from "@/lib/data";
import type { Tier } from "@/lib/sla";

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

function TrackPage() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const [c, setC] = useState<Complaint | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [comments, setComments] = useState<{ id: string; pseudonym: string; body: string; ward_verified: boolean }[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addComment = async () => {
    if (!user || !c) return toast.error("Sign in to comment on ward grievances.");
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
    if (!user || !c?.ward_id) return toast.error("Sign in as a ward resident to vote.");
    try {
      const { token } = await issueWardToken({ data: { wardId: c.ward_id } });
      const { error } = await supabase
        .from("resolution_votes")
        .insert({ complaint_id: c.id, voter_id: user.id, approve, zkp_token: token });
      if (error) throw error;
      toast.success(approve ? "Vote recorded: work matches the proof" : "Vote recorded: work does not match");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ZKP ward residency proof failed.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        {loading && <p className="text-sm text-muted-foreground">Loading ticket…</p>}
        {!loading && !c && <p className="civic-card p-6 text-center text-sm">This tracking link is not valid.</p>}

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
              {c.photo_url && <img src={c.photo_url} alt="" className="w-full rounded-lg" />}
              <SlaBar
                createdAt={c.created_at}
                priority={c.priority}
                offsetHours={c.clock_offset_hours}
                tier={c.current_tier as Tier}
              />
            </article>

            {c.status === "verification" && (
              <section className="civic-card space-y-3 p-4">
                <h2 className="text-sm font-bold">Regional ward vote</h2>
                <p className="text-xs text-muted-foreground">
                  Nearby verified residents decide whether the physical work matches the uploaded proof. Your
                  identity never travels with the vote — only an anonymous ZKP ward token.
                </p>
                {c.resolution_photo_url && <img src={c.resolution_photo_url} alt="" className="w-full rounded-lg" />}
                <div className="flex gap-2">
                  <button onClick={() => vote(true)} className="flex-1 rounded-lg bg-success px-3 py-2 text-xs font-semibold text-success-foreground">
                    Work matches proof
                  </button>
                  <button onClick={() => vote(false)} className="flex-1 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground">
                    Does not match
                  </button>
                </div>
              </section>
            )}

            <section className="civic-card space-y-3 p-4">
              <h2 className="text-sm font-bold">Escalation audit trail</h2>
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
                {events.length === 0 && <p className="text-xs text-muted-foreground">No events recorded yet.</p>}
              </ol>
            </section>

            <section className="civic-card space-y-3 p-4">
              <h2 className="text-sm font-bold">Ward discussion</h2>
              {comments.map((m) => (
                <div key={m.id} className="rounded-lg border border-border p-3">
                  <p className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs font-semibold">
                    <span className="truncate text-primary">{m.pseudonym}</span>
                    {m.ward_verified && (
                      <span className="shrink-0 rounded-full border border-success/50 bg-success/10 px-2 py-0.5 text-[10px] text-success">
                        ZKP ward resident
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
                  placeholder="Add a comment"
                  className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button onClick={addComment} className="shrink-0 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground">
                  Post
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
