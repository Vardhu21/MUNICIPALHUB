import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { ComplaintCard } from "@/components/ComplaintCard";
import { EmergencyBanner } from "@/components/EmergencyBanner";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import {
  TicketFilters,
  applyTicketFilters,
  EMPTY_FILTERS,
  type TicketFilterState,
} from "@/components/TicketFilters";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useGeolocation } from "@/lib/useGeolocation";
import {
  applyEscalation,
  fastForward,
  fetchComplaints,
  fetchEngagement,
  fetchWards,
  type Complaint,
  type Ward,
} from "@/lib/data";
import { EmblemLoader } from "@/components/EmblemLoader";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Public Grievance Feed — TN SmartMunicipality" },
      {
        name: "description",
        content:
          "Live regional feed of geotagged civic grievances across Tamil Nadu wards with likes, comments, reposts and shareable real-time status tracking.",
      },
      { property: "og:title", content: "Public Grievance Feed — TN SmartMunicipality" },
      {
        property: "og:description",
        content: "See what your ward reported today and follow each ticket's SLA countdown live.",
      },
    ],
  }),
  component: Feed,
});

function Feed() {
  const { lang, t } = useLang();
  const { user } = useSession();
  const { fix } = useGeolocation(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [engagement, setEngagement] = useState<Awaited<ReturnType<typeof fetchEngagement>> | null>(null);
  const [filters, setFilters] = useState<TicketFilterState>(EMPTY_FILTERS);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [list, w] = await Promise.all([fetchComplaints(), fetchWards()]);
    const escalated = await Promise.all(list.map((c) => applyEscalation(c).catch(() => c)));
    setComplaints(escalated);
    setWards(w);
    setEngagement(await fetchEngagement(escalated.map((c) => c.id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((e) => {
      setLoading(false);
      toast.error(e instanceof Error ? e.message : "Could not load the feed");
    });
  }, [load]);

  const wardMap = useMemo(() => new Map(wards.map((w) => [w.id, w])), [wards]);
  const departments = useMemo(
    () => Array.from(new Set(complaints.map((c) => c.category).filter(Boolean))).sort(),
    [complaints],
  );
  const visible = useMemo(() => applyTicketFilters(complaints, filters), [complaints, filters]);

  const requireAuth = () => {
    if (!user) {
      toast.error(lang === "ta" ? "முதலில் உள்நுழையவும்" : "Sign in to interact with the feed");
      return false;
    }
    return true;
  };

  const toggleLike = async (c: Complaint) => {
    if (!requireAuth() || !user) return;
    const liked = engagement?.likedBy?.some((l) => l.complaint_id === c.id && l.user_id === user.id);
    if (liked) await supabase.from("complaint_likes").delete().eq("complaint_id", c.id).eq("user_id", user.id);
    else await supabase.from("complaint_likes").insert({ complaint_id: c.id, user_id: user.id });
    setEngagement(await fetchEngagement(complaints.map((x) => x.id)));
  };

  const toggleRepost = async (c: Complaint) => {
    if (!requireAuth() || !user) return;
    const done = engagement?.repostedBy?.some((l) => l.complaint_id === c.id && l.user_id === user.id);
    if (done) await supabase.from("complaint_reposts").delete().eq("complaint_id", c.id).eq("user_id", user.id);
    else await supabase.from("complaint_reposts").insert({ complaint_id: c.id, user_id: user.id });
    setEngagement(await fetchEngagement(complaints.map((x) => x.id)));
  };

  const flagFake = async (c: Complaint) => {
    if (!requireAuth() || !user) return;
    const { error } = await supabase.from("fraud_flags").insert({
      complaint_id: c.id,
      flagged_by: user.id,
      reason: "Citizen-reported fake incident — routed to AI inspection queue",
    });
    if (error) return toast.error(error.message);
    toast.warning("Fake incident report filed", {
      description:
        "The AI inspection queue will re-score this submission. Confirmed fraud freezes the account and generates a legal disclosure packet.",
    });
  };

  const onFastForward = async (c: Complaint) => {
    setBusyId(c.id);
    try {
      const updated = await fastForward(c, 1);
      setComplaints((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      if (updated.status !== c.status) {
        toast.error(`Ticket ${updated.status.replace("_", " ").toUpperCase()}`, {
          description: `Reassigned to ${updated.assigned_officer ?? "next tier"}.`,
        });
      } else {
        toast.info("SLA clock advanced by 1 hour");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <EmergencyBanner position={fix} />

        <h1 className="text-xl font-bold">{t("feed")}</h1>

        <TicketFilters
          filters={filters}
          onChange={setFilters}
          wards={wards}
          departments={departments}
          lang={lang}
          resultCount={visible.length}
          totalCount={complaints.length}
        />

        {loading && <EmblemLoader label="Loading grievances…" />}
        {!loading && visible.length === 0 && (
          <p className="civic-card p-6 text-center text-sm text-muted-foreground">
            {lang === "ta"
              ? "வடிப்பானுக்கு பொருந்தும் புகார்கள் இல்லை."
              : "No grievances match these filters. Try broadening your search."}
          </p>
        )}

        {visible.map((c) => (
          <ComplaintCard
            key={c.id}
            complaint={c}
            ward={c.ward_id ? wardMap.get(c.ward_id) : undefined}
            liked={!!(user && engagement?.likedBy?.some((l) => l.complaint_id === c.id && l.user_id === user.id))}
            reposted={
              !!(user && engagement?.repostedBy?.some((l) => l.complaint_id === c.id && l.user_id === user.id))
            }
            counts={{
              likes: engagement?.likes?.[c.id] ?? 0,
              comments: engagement?.comments?.[c.id] ?? 0,
              reposts: engagement?.reposts?.[c.id] ?? 0,
            }}
            onLike={() => toggleLike(c)}
            onRepost={() => toggleRepost(c)}
            onFlagFake={() => flagFake(c)}
            onFastForward={() => onFastForward(c)}
            busy={busyId === c.id}
          />
        ))}
      </main>
      <VoiceAssistant />
    </div>
  );
}
