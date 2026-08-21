import { supabase } from "@/integrations/supabase/client";
import {
  haversineMeters,
  isGreaterChennai,
  resolveEscalation,
  type Priority,
  type Status,
  type Tier,
} from "@/lib/sla";

export type Ward = {
  id: string;
  ward_number: number;
  ward_name_en: string;
  ward_name_ta: string;
  ulb_name_en: string;
  ulb_name_ta: string;
  ulb_type: "corporation" | "municipality" | "town_panchayat";
  zone: string;
  lat: number;
  lng: number;
};

export type Complaint = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: Status;
  current_tier: Tier;
  created_at: string;
  updated_at: string;
  clock_offset_hours: number;
  author_id: string;
  author_pseudonym: string;
  assigned_officer: string | null;
  ward_id: string | null;
  lat: number | null;
  lng: number | null;
  street_address: string | null;
  photo_url: string | null;
  resolution_photo_url: string | null;
  resolution_note: string | null;
  work_summary: string | null;
  materials_used: string | null;
  work_started_at: string | null;
  work_completed_at: string | null;
  proof_caption: string | null;
  geo_verified: boolean;
  frozen_fake: boolean;
  complainant_approved: boolean | null;
  sla_hours: number;
};

export const ULB_LABEL: Record<Ward["ulb_type"], { en: string; ta: string }> = {
  corporation: { en: "Municipal Corporation", ta: "மாநகராட்சி" },
  municipality: { en: "Municipality", ta: "நகராட்சி" },
  town_panchayat: { en: "Town Panchayat", ta: "பேரூராட்சி" },
};

export async function fetchWards(): Promise<Ward[]> {
  const { data, error } = await supabase.from("wards").select("*").order("ward_number");
  if (error) throw error;
  return (data ?? []) as Ward[];
}

/** Reverse-geocode a GPS fix onto the nearest TN ULB ward boundary centroid. */
export function resolveWard(wards: Ward[], point: { lat: number; lng: number } | null) {
  // Official directory wards may have no published centroid; only geo-located
  // wards can be matched against a GPS fix.
  const located = wards.filter((w) => w.lat != null && w.lng != null);
  if (!located.length) return null;
  if (!point) return located[0];
  return located.reduce((best, w) =>
    haversineMeters(point, { lat: w.lat, lng: w.lng }) < haversineMeters(point, { lat: best.lat, lng: best.lng })
      ? w
      : best,
  );
}

export function wardLabel(w: Ward | null | undefined, lang: "en" | "ta") {
  if (!w) return lang === "ta" ? "வார்டு தீர்மானிக்கப்படவில்லை" : "Ward unresolved";
  const name = lang === "ta" ? w.ward_name_ta : w.ward_name_en;
  const ulb = lang === "ta" ? w.ulb_name_ta : w.ulb_name_en;
  return `Ward ${w.ward_number} · ${name} · ${ulb} (${ULB_LABEL[w.ulb_type][lang]})`;
}

export async function fetchComplaints(filter?: { authorId?: string; wardId?: string }) {
  let q = supabase.from("complaints").select("*").order("created_at", { ascending: false }).limit(60);
  if (filter?.authorId) q = q.eq("author_id", filter.authorId);
  if (filter?.wardId) q = q.eq("ward_id", filter.wardId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Complaint[];
}

export async function fetchComplaint(id: string) {
  const { data, error } = await supabase.from("complaints").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Complaint | null;
}

export async function fetchEvents(complaintId: string) {
  const { data } = await supabase
    .from("complaint_events")
    .select("*")
    .eq("complaint_id", complaintId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function logEvent(complaintId: string, eventType: string, actorLabel: string, note?: string) {
  await supabase.from("complaint_events").insert({
    complaint_id: complaintId,
    event_type: eventType,
    actor_label: actorLabel,
    note: note ?? null,
  });
}

/**
 * Applies the escalation matrix for a ticket at its current effective clock and
 * persists any tier/status transition, writing an immutable audit event.
 */
export async function applyEscalation(c: Complaint) {
  const elapsed =
    (Date.now() - new Date(c.created_at).getTime()) / 3_600_000 + c.clock_offset_hours;

  // GCC exception: look up the ward's ULB to know if this ticket lives inside
  // Greater Chennai Corporation, whose escalations bypass regional directorates.
  let isGCC = false;
  if (c.ward_id) {
    const { data: w } = await supabase
      .from("wards")
      .select("ulb_name_en")
      .eq("id", c.ward_id)
      .maybeSingle();
    isGCC = isGreaterChennai(w?.ulb_name_en);
  }

  const next = resolveEscalation({
    status: c.status,
    tier: c.current_tier,
    priority: c.priority,
    elapsedHours: elapsed,
    isGCC,
  });
  if (!next.changed) return c;

  const { data, error } = await supabase
    .from("complaints")
    .update({
      status: next.status,
      current_tier: next.tier,
      escalated_at: new Date().toISOString(),
      assigned_officer: next.tier === "field" ? c.assigned_officer : officerForTier(next.tier, isGCC),
    })
    .eq("id", c.id)
    .select()
    .maybeSingle();

  if (error) throw error;
  await logEvent(c.id, "escalation", "SLA Daemon", next.note ?? "Escalated");
  return (data ?? c) as Complaint;
}

export function officerForTier(tier: Tier, isGCC = false) {
  switch (tier) {
    case "zonal":
      return "Thiru. R. Balamurugan — Zonal Assistant Commissioner";
    case "commissioner":
      return isGCC
        ? "MAWS State Secretariat — Principal Secretary (Municipal Administration)"
        : "Dr. S. Meenakshi IAS — Corporation Commissioner";
    case "jtf":
      return isGCC
        ? "Joint Task Force — MAWS Secretariat · TWAD Board · Highways Dept."
        : "Joint Task Force Cell — TWAD Board & Highways Dept.";
    default:
      return "Thiru. K. Arumugam — Assistant Engineer (Field)";
  }
}

export async function fastForward(c: Complaint, hours = 1) {
  const { data, error } = await supabase
    .from("complaints")
    .update({ clock_offset_hours: c.clock_offset_hours + hours })
    .eq("id", c.id)
    .select()
    .maybeSingle();
  if (error) throw error;
  const updated = (data ?? c) as Complaint;
  await logEvent(c.id, "simulation", "Demo Console", `SLA clock fast-forwarded by ${hours}h`);
  return applyEscalation(updated);
}

type Tally = Record<string, number>;
export type Engagement = {
  likes: Tally;
  reposts: Tally;
  comments: Tally;
  likedBy: { complaint_id: string; user_id: string }[];
  repostedBy: { complaint_id: string; user_id: string }[];
};

export async function fetchEngagement(ids: string[]): Promise<Engagement> {
  if (!ids.length) return { likes: {}, reposts: {}, comments: {}, likedBy: [], repostedBy: [] };
  const [likes, reposts, comments] = await Promise.all([
    supabase.from("complaint_likes").select("complaint_id,user_id").in("complaint_id", ids),
    supabase.from("complaint_reposts").select("complaint_id,user_id").in("complaint_id", ids),
    supabase.from("complaint_comments").select("complaint_id").in("complaint_id", ids),
  ]);
  const tally = (rows: { complaint_id: string }[] | null) =>
    (rows ?? []).reduce<Tally>((acc, r) => {
      acc[r.complaint_id] = (acc[r.complaint_id] ?? 0) + 1;
      return acc;
    }, {});
  return {
    likes: tally(likes.data),
    reposts: tally(reposts.data),
    comments: tally(comments.data),
    likedBy: (likes.data ?? []) as { complaint_id: string; user_id: string }[],
    repostedBy: (reposts.data ?? []) as { complaint_id: string; user_id: string }[],
  };
}
