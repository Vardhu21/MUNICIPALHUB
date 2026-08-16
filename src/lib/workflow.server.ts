/**
 * Server-only helpers for the grievance resolution workflow.
 * Never imported by components — only by server function handlers.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CONFIG, canTransition, type WorkflowConfig, type WorkflowStage } from "./workflow";

type AnyClient = SupabaseClient<any, any, any>;

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyClient;
}

export async function loadConfig(sb: AnyClient): Promise<WorkflowConfig> {
  const { data } = await sb.from("workflow_config").select("key,value");
  const cfg = { ...DEFAULT_CONFIG };
  for (const row of data ?? []) {
    if (row.key in cfg) (cfg as Record<string, number>)[row.key] = Number(row.value);
  }
  return cfg;
}

export function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function notify(
  sb: AnyClient,
  userIds: (string | null | undefined)[],
  kind: string,
  title: string,
  body: string,
) {
  const ids = Array.from(new Set(userIds.filter(Boolean) as string[]));
  if (!ids.length) return;
  await sb.from("notifications").insert(ids.map((user_id) => ({ user_id, kind, title, body })));
}

export async function logEvent(
  sb: AnyClient,
  complaintId: string,
  eventType: string,
  actorLabel: string,
  note?: string | null,
) {
  await sb.from("complaint_events").insert({
    complaint_id: complaintId,
    event_type: eventType,
    actor_label: actorLabel,
    note: note ?? null,
  });
}

/** Guarded complaint status change. Throws on an illegal transition. */
export async function moveComplaint(
  sb: AnyClient,
  complaintId: string,
  to: WorkflowStage,
  extra: Record<string, unknown> = {},
) {
  const { data: current } = await sb
    .from("complaints")
    .select("status")
    .eq("id", complaintId)
    .maybeSingle();
  if (!current) throw new Error("Complaint not found.");
  if (current.status !== to && !canTransition(current.status, to)) {
    throw new Error(`Illegal status transition: ${current.status} → ${to}`);
  }
  const { error } = await sb.from("complaints").update({ status: to, ...extra }).eq("id", complaintId);
  if (error) throw new Error(error.message);
}

export async function isOfficer(sb: AnyClient, userId: string) {
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: { role: string }) =>
    ["field_officer", "zonal_commissioner", "commissioner", "admin"].includes(r.role),
  );
}

/**
 * Resolves the officer who stays accountable for a complaint.
 * Order: officer on a previous assignment → ward-scoped officer role →
 * any officer account. Never a worker, never a hardcoded name/ID.
 */
export async function resolveResponsibleOfficer(
  sb: AnyClient,
  complaint: { id: string; ward_id?: string | null },
): Promise<string | null> {
  const { data: prior } = await sb
    .from("complaint_assignments")
    .select("officer_id,assigned_at")
    .eq("complaint_id", complaint.id)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prior?.officer_id) return prior.officer_id as string;

  const officerRoles = ["field_officer", "zonal_commissioner", "commissioner"];
  if (complaint.ward_id) {
    const { data: wardOfficers } = await sb
      .from("user_roles")
      .select("user_id,role")
      .eq("ward_id", complaint.ward_id)
      .in("role", officerRoles);
    if (wardOfficers?.length) return wardOfficers[0].user_id as string;
  }
  const { data: anyOfficer } = await sb
    .from("user_roles")
    .select("user_id,role")
    .in("role", officerRoles)
    .limit(1);
  return (anyOfficer?.[0]?.user_id as string | undefined) ?? null;
}

/**
 * Resolves the ward councillor for a complaint dynamically (complaint → ward_id
 * → councillors row) and notifies any authenticated councillor accounts that
 * hold the councillor role for that ward. Names are never hardcoded.
 */
export async function notifyWardCouncillor(
  sb: AnyClient,
  complaint: { id: string; title?: string | null; ward_id?: string | null },
  title: string,
  body: string,
) {
  if (!complaint.ward_id) return null;
  const { data: councillor } = await sb
    .from("councillors")
    .select("councillor_id,name,designation,ward_ref")
    .eq("ward_uuid", complaint.ward_id)
    .maybeSingle();

  const { data: accounts } = await sb
    .from("user_roles")
    .select("user_id")
    .eq("role", "councillor")
    .eq("ward_id", complaint.ward_id);
  const ids = (accounts ?? []).map((r: { user_id: string }) => r.user_id);
  if (ids.length) await notify(sb, ids, "workflow", title, body);

  await logEvent(
    sb,
    complaint.id,
    "councillor_notified",
    councillor?.name ? `${councillor.designation ?? "Ward Councillor"} — ${councillor.name}` : "Ward Councillor",
    councillor
      ? `Ward councillor (${councillor.ward_ref}) notified: ${body}`
      : `No councillor on record for this ward; notification skipped.`,
  );
  return councillor ?? null;
}

export type AiVerdict = {
  relevance: "relevant" | "unrelated" | "unclear";
  confidence: number;
  observed_issue: string;
  explanation: string;
};

/**
 * Gemini image-relevance recommendation (via the existing Lovable AI gateway).
 * NEVER used for GPS decisions — those are deterministic backend maths.
 */
export async function analyseEvidenceImage(input: {
  dataUrl: string;
  title: string;
  description: string;
  category: string;
}): Promise<AiVerdict | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You audit municipal work-completion photographs. Judge ONLY whether the photo plausibly shows the reported civic issue or its repair. Never judge GPS, coordinates or location correctness. Reply as JSON: {"relevance":"relevant|unrelated|unclear","confidence":0-1,"observed_issue":string,"explanation":string}.',
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Complaint category: ${input.category}\nTitle: ${input.title}\nDescription: ${input.description}\n\nDoes this completion photo appear relevant to that complaint?`,
              },
              { type: "image_url", image_url: { url: input.dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`Evidence AI failed [${res.status}]: ${await res.text()}`);
      return null;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = (json.choices?.[0]?.message?.content ?? "").trim();
    const parsed = JSON.parse(raw) as Partial<AiVerdict>;
    const relevance =
      parsed.relevance === "relevant" || parsed.relevance === "unrelated" ? parsed.relevance : "unclear";
    return {
      relevance,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0))),
      observed_issue: String(parsed.observed_issue ?? "").slice(0, 400),
      explanation: String(parsed.explanation ?? "").slice(0, 800),
    };
  } catch (e) {
    console.error("Evidence AI threw", e);
    return null;
  }
}

/** Decodes a data URL into raw bytes for Supabase Storage. */
export function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error("Unsupported image payload.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mime: match[1] };
}
