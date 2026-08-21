import type { Complaint, Ward } from "@/lib/data";
import { computeClock, SLA_MATRIX } from "@/lib/sla";

export type BucketMetrics = {
  key: string;
  label: string;
  total: number;
  resolved: number;
  escalated: number;
  breached: number;
  avgResolutionHours: number | null;
  slaCompliancePct: number;
  escalationRatePct: number;
};

const RESOLVED_STATUSES = new Set(["resolved", "verification"]);
const ESCALATED_STATUSES = new Set(["escalated", "joint_task_force"]);

function makeBucket(key: string, label: string): BucketMetrics & { _res: number[] } {
  return {
    key,
    label,
    total: 0,
    resolved: 0,
    escalated: 0,
    breached: 0,
    avgResolutionHours: null,
    slaCompliancePct: 0,
    escalationRatePct: 0,
    _res: [],
  } as BucketMetrics & { _res: number[] };
}

function finalize(b: BucketMetrics & { _res: number[] }): BucketMetrics {
  const { _res, ...rest } = b;
  const avg = _res.length ? _res.reduce((a, n) => a + n, 0) / _res.length : null;
  return {
    ...rest,
    avgResolutionHours: avg,
    slaCompliancePct: rest.total ? Math.round(((rest.total - rest.breached) / rest.total) * 100) : 0,
    escalationRatePct: rest.total ? Math.round((rest.escalated / rest.total) * 100) : 0,
  };
}

function accumulate(bucket: BucketMetrics & { _res: number[] }, c: Complaint) {
  bucket.total += 1;
  if (RESOLVED_STATUSES.has(c.status)) {
    bucket.resolved += 1;
    const hours = (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / 3_600_000;
    if (Number.isFinite(hours) && hours >= 0) bucket._res.push(hours);
  }
  if (ESCALATED_STATUSES.has(c.status)) bucket.escalated += 1;
  if (computeClock(c.created_at, c.priority, c.clock_offset_hours, { slaHours: c.sla_hours }).breached) bucket.breached += 1;
}

export function byWard(complaints: Complaint[], wards: Ward[]): BucketMetrics[] {
  const wardMap = new Map(wards.map((w) => [w.id, w]));
  const buckets = new Map<string, BucketMetrics & { _res: number[] }>();
  for (const c of complaints) {
    const key = c.ward_id ?? "unassigned";
    const w = c.ward_id ? wardMap.get(c.ward_id) : undefined;
    const label = w ? `W${w.ward_number} · ${w.ward_name_en}` : "Unassigned";
    if (!buckets.has(key)) buckets.set(key, makeBucket(key, label));
    accumulate(buckets.get(key)!, c);
  }
  return [...buckets.values()].map(finalize).sort((a, b) => b.total - a.total);
}

export function byDepartment(complaints: Complaint[]): BucketMetrics[] {
  const buckets = new Map<string, BucketMetrics & { _res: number[] }>();
  for (const c of complaints) {
    const key = c.category || "Uncategorised";
    if (!buckets.has(key)) buckets.set(key, makeBucket(key, key));
    accumulate(buckets.get(key)!, c);
  }
  return [...buckets.values()].map(finalize).sort((a, b) => b.total - a.total);
}

export function byOfficer(complaints: Complaint[]): BucketMetrics[] {
  const buckets = new Map<string, BucketMetrics & { _res: number[] }>();
  for (const c of complaints) {
    const key = c.assigned_officer || "Unassigned";
    if (!buckets.has(key)) buckets.set(key, makeBucket(key, key));
    accumulate(buckets.get(key)!, c);
  }
  return [...buckets.values()].map(finalize).sort((a, b) => b.total - a.total);
}

export function overallStats(complaints: Complaint[]) {
  const total = complaints.length;
  const resolved = complaints.filter((c) => RESOLVED_STATUSES.has(c.status)).length;
  const escalated = complaints.filter((c) => ESCALATED_STATUSES.has(c.status)).length;
  const breached = complaints.filter((c) =>
    computeClock(c.created_at, c.priority, c.clock_offset_hours, { slaHours: c.sla_hours }).breached,
  ).length;
  const resTimes = complaints
    .filter((c) => RESOLVED_STATUSES.has(c.status))
    .map((c) => (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / 3_600_000)
    .filter((n) => Number.isFinite(n) && n >= 0);
  return {
    total,
    resolved,
    escalated,
    breached,
    slaCompliancePct: total ? Math.round(((total - breached) / total) * 100) : 0,
    resolutionRatePct: total ? Math.round((resolved / total) * 100) : 0,
    avgResolutionHours: resTimes.length ? resTimes.reduce((a, n) => a + n, 0) / resTimes.length : null,
  };
}

export function slaMatrixSummary() {
  return SLA_MATRIX;
}

export function toCSV(rows: BucketMetrics[]) {
  const header = [
    "label",
    "total",
    "resolved",
    "escalated",
    "breached",
    "sla_compliance_pct",
    "escalation_rate_pct",
    "avg_resolution_hours",
  ];
  const body = rows.map((r) => [
    r.label,
    r.total,
    r.resolved,
    r.escalated,
    r.breached,
    r.slaCompliancePct,
    r.escalationRatePct,
    r.avgResolutionHours == null ? "" : r.avgResolutionHours.toFixed(2),
  ]);
  return [header, ...body]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
