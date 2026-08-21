import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OFFICER_ROLES = [
  "field_officer",
  "zonal_commissioner",
  "commissioner",
  "councillor",
] as const;

/**
 * Grants the officer role for the signed-in account.
 *
 * `user_roles` INSERT policy only allows self-assigning `citizen`, so the
 * officer grant must happen server-side. Authorization gate: the caller's own
 * auth email must be the IFHRMS-derived officer address, i.e. the caller can
 * only enrol the officer identity they authenticated as.
 */
export const enrolOfficer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        ifhrms: z.string().regex(/^\d{11}$/),
        role: z.enum(OFFICER_ROLES),
        wardId: z.string().uuid().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    if (email !== `ifhrms-${data.ifhrms}@officer.tnsm.local`) {
      throw new Error("This IFHRMS code does not match the signed-in officer account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = [
      { user_id: context.userId, role: data.role, ward_id: data.wardId ?? null },
      { user_id: context.userId, role: "citizen", ward_id: data.wardId ?? null },
    ];
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert(rows as never, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { roles: [data.role, "citizen"] };
  });

const ESCALATION_ROLES = ["field_officer", "zonal_commissioner", "commissioner", "admin"] as const;
const TIER_ORDER = ["field", "zonal", "commissioner", "jtf"] as const;
const TIER_STATUS: Record<string, string> = {
  zonal: "escalated",
  commissioner: "escalated",
  jtf: "joint_task_force",
};

/**
 * Officer-only escalation control. Officers can shorten the SLA clock
 * (fast-forward) and push a ticket straight to a higher authority tier.
 * Citizens and workers have no path to change escalation state — the
 * `complaints_protect_escalation` trigger blocks it at the database.
 */
export const officerEscalate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        complaintId: z.string().uuid(),
        /** Jump straight to this tier. Omit (with escalate) to advance one tier. */
        targetTier: z.enum(TIER_ORDER).optional(),
        /** Move the ticket up the authority chain. False = SLA clock only. */
        escalate: z.boolean().default(false),
        /** Hours to shave off the remaining SLA window. */
        fastForwardHours: z.number().int().min(0).max(240).default(0),
        reason: z.string().max(500).default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const allowed = await Promise.all(
      ESCALATION_ROLES.map((role) => context.supabase.rpc("has_role", { _user_id: context.userId, _role: role })),
    );
    if (!allowed.some((r) => r.data === true)) {
      throw new Error("Only municipal officers can change a complaint's escalation.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: complaint, error } = await supabaseAdmin
      .from("complaints")
      .select("id,title,author_id,current_tier,status,clock_offset_hours")
      .eq("id", data.complaintId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!complaint) throw new Error("Complaint not found.");

    const currentIndex = TIER_ORDER.indexOf(complaint.current_tier as (typeof TIER_ORDER)[number]);
    const nextIndex = data.targetTier
      ? TIER_ORDER.indexOf(data.targetTier)
      : data.escalate
        ? Math.min(currentIndex + 1, TIER_ORDER.length - 1)
        : currentIndex;
    if (nextIndex < currentIndex) throw new Error("A complaint cannot be de-escalated to a lower tier.");

    const tier = TIER_ORDER[nextIndex];
    const { officerForTier } = await import("./data.server");
    const patch: Record<string, unknown> = {
      clock_offset_hours: complaint.clock_offset_hours + data.fastForwardHours,
    };
    if (nextIndex > currentIndex) {
      patch["current_tier"] = tier;
      patch["status"] = TIER_STATUS[tier] ?? complaint.status;
      patch["escalated_at"] = new Date().toISOString();
      patch["assigned_officer"] = officerForTier(tier);
    }

    const { error: upErr } = await supabaseAdmin.from("complaints").update(patch as never).eq("id", complaint.id);
    if (upErr) throw new Error(upErr.message);

    const note =
      nextIndex > currentIndex
        ? `Officer escalated the ticket to ${tier.toUpperCase()} tier.${data.reason ? ` Reason: ${data.reason}` : ""}`
        : `Officer shortened the SLA clock by ${data.fastForwardHours}h.${data.reason ? ` Reason: ${data.reason}` : ""}`;
    await supabaseAdmin.from("complaint_events").insert({
      complaint_id: complaint.id,
      event_type: nextIndex > currentIndex ? "escalation" : "sla_adjust",
      actor_label: "Municipal Officer",
      note,
    } as never);
    await supabaseAdmin.from("notifications").insert({
      user_id: complaint.author_id,
      kind: "workflow",
      title: nextIndex > currentIndex ? "Complaint escalated" : "SLA clock updated",
      body: `"${complaint.title}": ${note}`,
    } as never);

    return { tier, escalated: nextIndex > currentIndex };
  });
