import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Manual "run now" trigger — restricted to commissioners / admins. */
export const runSlaReportNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error("Authorization check failed");

    const allowed = new Set(["admin", "commissioner", "zonal_commissioner"]);
    if (!(roles ?? []).some((r) => allowed.has(r.role))) {
      throw new Error("Not authorized to generate SLA reports.");
    }

    const { generateSlaReport } = await import("@/lib/sla-report.server");
    return generateSlaReport("manual");
  });
