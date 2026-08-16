import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Complaint, Ward } from "@/lib/data";
import { byDepartment, byOfficer, byWard, overallStats, toCSV } from "@/lib/analytics";

/** Generates a 24h SLA snapshot row and notifies commissioners/admins. */
export async function generateSlaReport(generatedBy: string) {
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!serviceKey || !url) throw new Error("Server misconfigured");

  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

  const [{ data: complaintsRaw, error: cErr }, { data: wardsRaw, error: wErr }] = await Promise.all([
    admin.from("complaints").select("*"),
    admin.from("wards").select("*"),
  ]);
  if (cErr) throw new Error(`complaints: ${cErr.message}`);
  if (wErr) throw new Error(`wards: ${wErr.message}`);

  const complaints = (complaintsRaw ?? []) as unknown as Complaint[];
  const wards = (wardsRaw ?? []) as unknown as Ward[];

  const stats = overallStats(complaints);
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
      ward_csv: toCSV(byWard(complaints, wards)),
      department_csv: toCSV(byDepartment(complaints)),
      officer_csv: toCSV(byOfficer(complaints)),
      generated_by: generatedBy,
    })
    .select()
    .single();
  if (rErr || !report) throw new Error(`report: ${rErr?.message}`);

  const { data: recipients, error: rolesErr } = await admin
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["commissioner", "zonal_commissioner", "admin"]);
  if (rolesErr) throw new Error(`roles: ${rolesErr.message}`);

  const uniqueUserIds = Array.from(new Set((recipients ?? []).map((r) => r.user_id)));
  if (uniqueUserIds.length > 0) {
    const { error: nErr } = await admin.from("notifications").insert(
      uniqueUserIds.map((uid) => ({
        user_id: uid,
        kind: "sla_report",
        title: `SLA report ready · ${periodLabel}`,
        body: `Compliance ${stats.slaCompliancePct}% · ${stats.total} tickets · ${stats.breached} SLA breaches. Download the ward, department and officer CSVs.`,
        report_id: report.id,
      })),
    );
    if (nErr) throw new Error(`notify: ${nErr.message}`);
  }

  return { ok: true, report_id: report.id, period: periodLabel, notified: uniqueUserIds.length };
}
