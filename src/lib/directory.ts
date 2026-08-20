import { supabase } from "@/integrations/supabase/client";

/**
 * Official ULB authority directory
 * Source of truth: uploaded Greater Chennai Corporation dataset.
 * Hierarchy: ULB -> Zone -> Ward -> Councillor.
 *
 * Zone names are currently read from wards.zone because the
 * zones table does not contain records yet.
 */

export type Ulb = {
  ulb_id: string;
  ulb_name: string;
  ulb_name_tamil: string;
  ulb_type: string;
  district: string;
  state: string;
  official_source: string;
  source_checked_at: string;
};

export type Zone = {
  zone_id: string;
  ulb_id: string;
  zone_number: number;
  zone_name: string;
  official_source: string;
  source_checked_at: string;
};

export type DirectoryWard = {
  id: string;
  ward_ref: string | null;
  ward_number: number;
  ward_name_en: string;
  ward_name_ta: string;

  // Zone name stored directly in the wards table
  zone: string | null;

  zone_id: string | null;
  ulb_id: string | null;
  ward_status: string;
  official_ward_email: string | null;
  official_source: string | null;
  source_checked_at: string | null;
  lat: number | null;
  lng: number | null;
};

export type Councillor = {
  councillor_id: string;
  ward_ref: string;
  ward_uuid: string | null;
  name: string | null;
  designation: string;
  official_contact_phone: string | null;
  official_contact_email: string | null;
  status: string;
  official_source: string;
  source_checked_at: string;
};

export type UlbLeader = {
  authority_id: string;
  ulb_id: string;
  role: string;
  name: string;
  phone: string | null;
  office_phone: string | null;
  email: string | null;
  official_source: string;
  source_checked_at: string;
};

/**
 * Fetch all ULBs.
 */
export async function fetchUlbs(): Promise<Ulb[]> {
  const { data, error } = await supabase
    .from("ulbs")
    .select("*")
    .order("ulb_name");

  if (error) {
    console.error("Error fetching ULBs:", error);
    return [];
  }

  return (data ?? []) as Ulb[];
}

/**
 * Fetch zones from the zones table.
 *
 * NOTE:
 * The zones table is currently empty in your database,
 * so this function may return an empty array until that
 * table is populated.
 */
export async function fetchZones(ulbId?: string): Promise<Zone[]> {
  let q = supabase
    .from("zones")
    .select("*")
    .order("zone_number");

  if (ulbId) {
    q = q.eq("ulb_id", ulbId);
  }

  const { data, error } = await q;

  if (error) {
    console.error("Error fetching zones:", error);
    return [];
  }

  return (data ?? []) as Zone[];
}

/**
 * Fetch unique zone names directly from wards.zone.
 *
 * This is currently used for the Zone dropdown because
 * your wards table contains the actual zone names.
 */
export async function fetchZoneNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from("wards")
    .select("zone")
    .not("zone", "is", null)
    .order("zone");

  if (error) {
    console.error("Error fetching zone names:", error);
    return [];
  }

  return [
    ...new Set(
      (data ?? [])
        .map((row) => row.zone)
        .filter(
          (zone): zone is string =>
            typeof zone === "string" && zone.trim().length > 0,
        ),
    ),
  ];
}

/**
 * Fetch wards.
 *
 * Zone filtering uses wards.zone because that column
 * contains the actual zone names in your database.
 */
export async function fetchDirectoryWards(
  filter?: {
    ulbId?: string;
    zone?: string;
  },
): Promise<DirectoryWard[]> {
  let q = supabase
    .from("wards")
    .select(
      "id,ward_ref,ward_number,ward_name_en,ward_name_ta,zone,zone_id,ulb_id,ward_status,official_ward_email,official_source,source_checked_at,lat,lng",
    )
    .not("ward_ref", "is", null)
    .order("ward_number");

  if (filter?.ulbId) {
    q = q.eq("ulb_id", filter.ulbId);
  }

  if (filter?.zone) {
    q = q.eq("zone", filter.zone);
  }

  const { data, error } = await q;

  if (error) {
    console.error("Error fetching wards:", error);
    return [];
  }

  return (data ?? []) as DirectoryWard[];
}

/**
 * Councillor for a ward.
 * Returns null when there is no official record.
 */
export async function fetchCouncillorForWard(
  wardRef: string | null,
): Promise<Councillor | null> {
  if (!wardRef) return null;

  const { data, error } = await supabase
    .from("councillors")
    .select("*")
    .eq("ward_ref", wardRef)
    .maybeSingle();

  if (error) {
    console.error("Error fetching councillor:", error);
    return null;
  }

  return (data ?? null) as Councillor | null;
}

/**
 * Fetch ULB leadership.
 */
export async function fetchLeadership(
  ulbId: string,
): Promise<UlbLeader[]> {
  const { data, error } = await supabase
    .from("ulb_leadership")
    .select("*")
    .eq("ulb_id", ulbId)
    .order("role");

  if (error) {
    console.error("Error fetching leadership:", error);
    return [];
  }

  return (data ?? []) as UlbLeader[];
}

/**
 * Fetch ULB for a ward.
 */
export async function fetchUlbForWard(
  ulbId: string | null,
): Promise<Ulb | null> {
  if (!ulbId) return null;

  const { data, error } = await supabase
    .from("ulbs")
    .select("*")
    .eq("ulb_id", ulbId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching ULB:", error);
    return null;
  }

  return (data ?? null) as Ulb | null;
}

/**
 * Fetch zone by ID.
 *
 * This works when the zones table is populated.
 */
export async function fetchZoneById(
  zoneId: string | null,
): Promise<Zone | null> {
  if (!zoneId) return null;

  const { data, error } = await supabase
    .from("zones")
    .select("*")
    .eq("zone_id", zoneId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching zone:", error);
    return null;
  }

  return (data ?? null) as Zone | null;
}

/**
 * Create an official source note.
 */
export function sourceNote(
  source: string | null,
  checkedAt: string | null,
  lang: "en" | "ta",
) {
  if (!source) return null;

  const when = checkedAt
    ? new Date(checkedAt).toLocaleDateString(
        lang === "ta" ? "ta-IN" : "en-IN",
      )
    : null;

  return {
    href: source,
    label:
      lang === "ta"
        ? `அதிகாரப்பூர்வ ஆதாரம்${
            when ? ` · சரிபார்க்கப்பட்டது ${when}` : ""
          }`
        : `Official source${when ? ` · checked ${when}` : ""}`,
  };
}
