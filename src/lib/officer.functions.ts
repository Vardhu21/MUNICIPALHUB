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
