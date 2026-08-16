import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Complaint, Ward } from "@/lib/data";
import { byDepartment, byOfficer, byWard, overallStats, toCSV } from "@/lib/analytics";

/**
 * Scheduled SLA report generator.
 *
 * Called by pg_cron. Aggregates the last 24h of complaint activity into a
 * snapshot row in `sla_reports` and fans out in-app notifications to every
 * commissioner / zonal commissioner / admin.
 *
 * Auth: the scheduler must present the server-only `CRON_SECRET` in the
 * `x-cron-secret` header (or as a bearer token). The public publishable key
 * is never accepted — it ships in the browser bundle. All writes then go
 * through a service-role client so RLS is bypassed for the scheduler-owned
 * tables (`sla_reports`, `notifications`).
 */
export const Route = createFileRoute("/api/public/hooks/generate-sla-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const providedKey =
          request.headers.get("x-cron-secret") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const expectedKey = process.env["CRON_SECRET"] ?? "";
        if (!expectedKey || providedKey !== expectedKey) {
          return json({ error: "Unauthorized" }, 401);
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const url = process.env.SUPABASE_URL;
        if (!serviceKey || !url) {
          return json({ error: "Server misconfigured" }, 500);
        }

        const admin = createClient<Database>(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const periodEnd = new Date();
        const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

        // Pull complaint + ward context. We report on the current global
        // dataset — the "period" describes the digest window, not a hard
        // created_at filter (SLA breaches on older tickets still count).
        const [{ data: complaintsRaw, error: cErr }, { data: wardsRaw, error: wErr }] =
          await Promise.all([admin.from("complaints").select("*"), admin.from("wards").select("*")]);
        if (cErr) return json({ error: `complaints: ${cErr.message}` }, 500);
        if (wErr) return json({ error: `wards: ${wErr.message}` }, 500);

        const complaints = (complaintsRaw ?? []) as unknown as Complaint[];
        const wards = (wardsRaw ?? []) as unknown as Ward[];

        const stats = overallStats(complaints);
        const wardRows = byWard(complaints, wards);
        const deptRows = byDepartment(complaints);
        const officerRows = byOfficer(complaints);

        const periodLabel = `24h · ${periodStart.toISOString().slice(0, 10)} → ${periodEnd
          .toISOString()
          .slice(0, 10)}`;

        const { data: report, error: rErr } = await admin
          .from("sla_reports")
          .insert({
            period_label: periodLabel,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            total_tickets: stats.total,
            resolved_tickets: stats.resolved,
            escalated_tickets: stats.escalated,
            breached_tickets: stats.breached,
            sla_compliance_pct: stats.slaCompliancePct,
            avg_resolution_hours:
              stats.avgResolutionHours == null ? null : Number(stats.avgResolutionHours.toFixed(2)),
            ward_csv: toCSV(wardRows),
            department_csv: toCSV(deptRows),
            officer_csv: toCSV(officerRows),
            generated_by: "pg_cron",
          })
          .select()
          .single();
        if (rErr || !report) return json({ error: `report: ${rErr?.message}` }, 500);

        // Fan out to commissioners + admins.
        const { data: recipients, error: rolesErr } = await admin
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["commissioner", "zonal_commissioner", "admin"]);
        if (rolesErr) return json({ error: `roles: ${rolesErr.message}` }, 500);

        const uniqueUserIds = Array.from(new Set((recipients ?? []).map((r) => r.user_id)));
        if (uniqueUserIds.length > 0) {
          const rows = uniqueUserIds.map((uid) => ({
            user_id: uid,
            kind: "sla_report",
            title: `SLA report ready · ${periodLabel}`,
            body: `Compliance ${stats.slaCompliancePct}% · ${stats.total} tickets · ${stats.breached} SLA breaches. Download the ward, department and officer CSVs.`,
            report_id: report.id,
          }));
          const { error: nErr } = await admin.from("notifications").insert(rows);
          if (nErr) return json({ error: `notify: ${nErr.message}` }, 500);
        }

        return json({
          ok: true,
          report_id: report.id,
          period: periodLabel,
          notified: uniqueUserIds.length,
        });
      },
    },
  },
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
