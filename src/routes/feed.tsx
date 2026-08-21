import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { ComplaintCard } from "@/components/ComplaintCard";
import { EmergencyBanner } from "@/components/EmergencyBanner";
import { VoiceAssistant } from "@/components/VoiceAssistantLazy";
import {
  TicketFilters,
  applyTicketFilters,
  EMPTY_FILTERS,
  type TicketFilterState,
} from "@/components/TicketFilters";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useAuthorizedRole, useSession } from "@/lib/session";
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
      { title: "Chennai Corporation Complaints — Live GCC Grievance Feed" },
      {
        name: "description",
        content:
          "Track Chennai Corporation complaints live. Browse geotagged GCC grievances by ward, follow SLA countdowns and check real-time complaint status.",
      },
      { property: "og:title", content: "Chennai Corporation Complaints — Live GCC Grievance Feed" },
      {
        property: "og:description",
        content: "Browse Chennai Corporation complaints by ward and follow each ticket's SLA countdown live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://page-maker-magic-438.lovable.app/feed" },
    ],
    links: [{ rel: "canonical", href: "https://page-maker-magic-438.lovable.app/feed" }],
  }),
  component: Feed,
});

function Feed() {
  const { lang, t } = useLang();
  const { user } = useSession();
  const { roles } = useAuthorizedRole();
  // Escalation is an officer power only.
  const isOfficer = roles.some((r) =>
    ["field_officer", "zonal_commissioner", "commissioner", "admin"].includes(r),
  );
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
      toast.error(e instanceof Error ? e.message : t("feed.couldNotLoad"));
    });
    // Officer proofs and status changes should surface in the feed quickly.
    const quiet = () => load().catch(() => undefined);
    const id = window.setInterval(quiet, 15_000);
    window.addEventListener("focus", quiet);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", quiet);
    };
  }, [load]);

  const wardMap = useMemo(() => new Map(wards.map((w) => [w.id, w])), [wards]);
  const departments = useMemo(
    () => Array.from(new Set(complaints.map((c) => c.category).filter(Boolean))).sort(),
    [complaints],
  );
  const visible = useMemo(() => applyTicketFilters(complaints, filters), [complaints, filters]);

  const requireAuth = () => {
    if (!user) {
      toast.error(t("feed.signInInteract"));
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
    toast.warning(t("feed.fakeReportFiled"), {
      description: t("feed.fakeReportDesc"),
    });
  };

  const deleteComplaint = async (c: Complaint) => {
    if (!user || c.author_id !== user.id) return;
    const confirmed = window.confirm(
      lang === "ta"
        ? "இந்தப் புகாரை நிரந்தரமாக நீக்க வேண்டுமா? இதை மீட்டெடுக்க முடியாது."
        : "Delete this complaint permanently? This cannot be undone.",
    );
    if (!confirmed) return;

    setBusyId(c.id);
    const { error } = await supabase.from("complaints").delete().eq("id", c.id).eq("author_id", user.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComplaints((current) => current.filter((item) => item.id !== c.id));
    toast.success(lang === "ta" ? "புகார் நீக்கப்பட்டது" : "Complaint deleted");
  };

  const onFastForward = async (c: Complaint) => {
    setBusyId(c.id);
    try {
      const updated = await fastForward(c, 1);
      setComplaints((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      if (updated.status !== c.status) {
        toast.error(`${t("feed.ticketStatusUpdated", "Ticket {status}").replace("{status}", updated.status.replace("_", " ").toUpperCase())}`, {
          description: `${t("feed.reassignedTo", "Reassigned to {officer}.").replace("{officer}", updated.assigned_officer ?? t("feed.nextTier"))}`,
        });
      } else {
        toast.info(t("feed.slaAdvanced"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("feed.simulationFailed"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <EmergencyBanner position={fix} />

        <h1 className="text-xl font-bold">{t("feed.heading")}</h1>

        <TicketFilters
          filters={filters}
          onChange={setFilters}
          wards={wards}
          departments={departments}
          lang={lang}
          resultCount={visible.length}
          totalCount={complaints.length}
        />

        {loading && <EmblemLoader label={t("feed.loadingGrievances")} />}
        {!loading && visible.length === 0 && (
          <p className="civic-card p-6 text-center text-sm text-muted-foreground">
            {t("feed.noMatchFilters")}
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
            canEscalate={isOfficer}
            canDelete={user?.id === c.author_id}
            onDelete={() => deleteComplaint(c)}
            busy={busyId === c.id}
          />
        ))}
      </main>
      <VoiceAssistant />
    </div>
  );
}
