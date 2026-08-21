export type Priority = "emergency" | "high" | "medium" | "low";
export type Status =
  | "submitted"
  | "assigned"
  | "in_progress"
  | "verification"
  | "resolved"
  | "escalated"
  | "joint_task_force"
  | "rejected"
  | "reopened";

export type EscalationRow = {
  priority: Priority;
  hours: number;
  fieldTier: { en: string; ta: string };
  escalateTo: { en: string; ta: string };
};

export const SLA_MATRIX: EscalationRow[] = [
  {
    priority: "emergency",
    hours: 2,
    fieldTier: { en: "Junior / Assistant Engineer (AE/JE)", ta: "இளநிலை / உதவி பொறியாளர் (AE/JE)" },
    escalateTo: { en: "Zonal Assistant Commissioner", ta: "மண்டல உதவி ஆணையர்" },
  },
  {
    priority: "high",
    hours: 12,
    fieldTier: { en: "Sanitary Inspector (SI)", ta: "சுகாதார ஆய்வாளர் (SI)" },
    escalateTo: { en: "City Health Officer (HQ)", ta: "நகர சுகாதார அலுவலர் (தலைமையகம்)" },
  },
  {
    priority: "medium",
    hours: 24,
    fieldTier: { en: "Technical / Road Overseer", ta: "தொழில்நுட்ப / சாலை மேற்பார்வையாளர்" },
    escalateTo: { en: "City Engineer (HQ)", ta: "நகர பொறியாளர் (தலைமையகம்)" },
  },
  {
    priority: "low",
    hours: 48,
    fieldTier: { en: "Town Planning Inspector", ta: "நகர அமைப்பு ஆய்வாளர்" },
    escalateTo: { en: "Corporation Commissioner (IAS)", ta: "மாநகராட்சி ஆணையர் (IAS)" },
  },
];

export function slaRow(priority: Priority): EscalationRow {
  return SLA_MATRIX.find((r) => r.priority === priority) ?? SLA_MATRIX[2];
}

/**
 * Category-specific resolution windows (hours). Escalation is NOT a flat 24h:
 * each civic category carries its own statutory response time.
 */
export const CATEGORY_SLA_HOURS: Record<string, number> = {
  electrical: 1,
  water: 2,
  sanitation: 4,
  drainage: 6,
  streetlight: 12,
  roads: 24,
  encroachment: 48,
  parks: 72,
};

export const CATEGORY_SLA_LABEL: Record<string, { en: string; ta: string }> = {
  electrical: { en: "Hazardous electrical line", ta: "ஆபத்தான மின் கம்பி" },
  water: { en: "Water supply / pipeline burst", ta: "குடிநீர் / குழாய் உடைப்பு" },
  sanitation: { en: "Garbage / sanitation", ta: "குப்பை / துப்புரவு" },
  drainage: { en: "Sewage & storm drain", ta: "கழிவுநீர் & வடிகால்" },
  streetlight: { en: "Street light", ta: "தெரு விளக்கு" },
  roads: { en: "Road / pothole", ta: "சாலை / பள்ளம்" },
  encroachment: { en: "Encroachment / town planning", ta: "ஆக்கிரமிப்பு / நகர அமைப்பு" },
  parks: { en: "Parks & public spaces", ta: "பூங்காக்கள் & பொது இடங்கள்" },
};

/** Resolution window for a ticket: category window first, priority band as fallback. */
export function slaHoursFor(category?: string | null, priority: Priority = "medium"): number {
  const byCategory = category ? CATEGORY_SLA_HOURS[category] : undefined;
  return byCategory ?? slaRow(priority).hours;
}

export type ClockState = {
  elapsedHours: number;
  totalHours: number;
  ratio: number;
  breached: boolean;
  remainingLabel: string;
  deadlockHours: number;
};

/** Effective elapsed hours = real elapsed + the demo fast-forward offset. */
export function computeClock(
  createdAt: string,
  priority: Priority,
  offsetHours: number,
  opts: number | { now?: number; slaHours?: number | null } = {},
): ClockState {
  const o = typeof opts === "number" ? { now: opts } : opts;
  const now = o.now ?? Date.now();
  const total = o.slaHours && o.slaHours > 0 ? o.slaHours : slaRow(priority).hours;
  const realElapsed = (now - new Date(createdAt).getTime()) / 3_600_000;
  const elapsed = Math.max(0, realElapsed) + offsetHours;
  const ratio = Math.min(elapsed / total, 1);
  const remaining = total - elapsed;
  const breached = remaining <= 0;
  const abs = Math.abs(remaining);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return {
    elapsedHours: elapsed,
    totalHours: total,
    ratio,
    breached,
    remainingLabel: `${h}h ${String(m).padStart(2, "0")}m`,
    deadlockHours: Math.max(0, elapsed - total),
  };
}


export type Tier = "field" | "zonal" | "commissioner" | "jtf";

export const TIER_LABEL: Record<Tier, { en: string; ta: string }> = {
  field: { en: "Field Tier", ta: "கள நிலை" },
  zonal: { en: "Zonal Assistant Commissioner", ta: "மண்டல உதவி ஆணையர்" },
  commissioner: { en: "Corporation Commissioner (IAS)", ta: "மாநகராட்சி ஆணையர் (IAS)" },
  jtf: { en: "Joint Task Force (TWAD / Highways)", ta: "கூட்டுப் பணிக்குழு (TWAD / நெடுஞ்சாலை)" },
};

/**
 * Pure escalation resolver, run lazily on every read and on fast-forward.
 * Returns the tier/status the ticket SHOULD be at for the given effective clock.
 */
export function resolveEscalation(input: {
  status: Status;
  tier: Tier;
  priority: Priority;
  elapsedHours: number;
  /**
   * Greater Chennai Corporation exception. GCC top-tier escalations bypass
   * regional directorates and land straight on the MAWS State Secretariat
   * dashboard, and the Joint Task Force deadlock breaker fires at 24h instead
   * of 48h to reflect the shortened metro chain of command.
   */
  isGCC?: boolean;
  /** Category-specific SLA window; falls back to the priority band when absent. */
  slaHours?: number | null;
}): { tier: Tier; status: Status; changed: boolean; note: string | null } {
  const terminal: Status[] = ["resolved", "verification", "rejected"];
  if (terminal.includes(input.status)) {
    return { tier: input.tier, status: input.status, changed: false, note: null };
  }

  const limit = input.slaHours && input.slaHours > 0 ? input.slaHours : slaRow(input.priority).hours;
  const over = input.elapsedHours - limit;
  // Deadlock breaker scales with the ticket window: 2x the SLA (1x for GCC),
  // clamped so fast categories still get a sane human window.
  const deadlockThreshold = Math.max(2, Math.min(input.isGCC ? limit : limit * 2, input.isGCC ? 24 : 48));


  // Deadlock breaker: >threshold hours sitting at Commissioner tier.
  if (input.tier === "commissioner" && over >= deadlockThreshold) {
    return {
      tier: "jtf",
      status: "joint_task_force",
      changed: input.status !== "joint_task_force",
      note: input.isGCC
        ? "GCC deadlock breaker fired (24h): Joint Task Force convened by MAWS State Secretariat. TWAD Board & Highways Dept pinged."
        : "Deadlock breaker fired (48h): escalated to Joint Task Force. TWAD Board & Highways Department pinged.",
    };
  }

  if (over >= limit && input.tier === "zonal") {
    return {
      tier: "commissioner",
      status: "escalated",
      changed: true,
      note: input.isGCC
        ? `GCC exception: second SLA window breached — bypassing regional directorates, ticket routed straight to MAWS State Secretariat (via ${TIER_LABEL.commissioner.en}).`
        : `Second SLA window breached. Reassigned to ${TIER_LABEL.commissioner.en}.`,
    };
  }

  if (over >= 0 && input.tier === "field") {
    return {
      tier: "zonal",
      status: "escalated",
      changed: true,
      note: `SLA of ${limit}h breached at field tier. Auto-reassigned to ${slaRow(input.priority).escalateTo.en}.`,
    };
  }

  return { tier: input.tier, status: input.status, changed: false, note: null };
}

/** GCC (Greater Chennai Corporation) detection from an ULB name string. */
export function isGreaterChennai(ulbNameEn?: string | null) {
  if (!ulbNameEn) return false;
  const n = ulbNameEn.toLowerCase();
  return n.includes("greater chennai") || n.includes("chennai corporation") || n === "gcc";
}

export const STATUS_TONE: Record<Status, string> = {
  submitted: "bg-muted text-muted-foreground border-border",
  assigned: "bg-primary/15 text-primary border-primary/40",
  in_progress: "bg-warning/15 text-warning border-warning/40",
  verification: "bg-chart-5/15 text-chart-5 border-chart-5/40",
  resolved: "bg-success/20 text-success border-success/50",
  escalated: "bg-destructive/15 text-destructive border-destructive/50",
  joint_task_force: "bg-destructive/25 text-destructive border-destructive/70",
  rejected: "bg-muted text-muted-foreground border-border",
  reopened: "bg-warning/20 text-warning border-warning/50",
};

export const PRIORITY_TONE: Record<Priority, string> = {
  emergency: "bg-destructive/20 text-destructive border-destructive/50",
  high: "bg-warning/20 text-warning border-warning/50",
  medium: "bg-primary/15 text-primary border-primary/40",
  low: "bg-muted text-muted-foreground border-border",
};

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const CATEGORIES = [
  { id: "water", en: "Water Supply / Pipeline Burst", ta: "குடிநீர் / குழாய் உடைப்பு", priority: "emergency" as Priority },
  { id: "electrical", en: "Hazardous Electrical Line", ta: "ஆபத்தான மின் கம்பி", priority: "emergency" as Priority },
  { id: "sanitation", en: "Garbage / Sanitation", ta: "குப்பை / துப்புரவு", priority: "high" as Priority },
  { id: "drainage", en: "Sewage & Storm Drain", ta: "கழிவுநீர் & மழைநீர் வடிகால்", priority: "high" as Priority },
  { id: "roads", en: "Road / Pothole", ta: "சாலை / பள்ளம்", priority: "medium" as Priority },
  { id: "streetlight", en: "Street Light", ta: "தெரு விளக்கு", priority: "medium" as Priority },
  { id: "encroachment", en: "Encroachment / Town Planning", ta: "ஆக்கிரமிப்பு / நகர அமைப்பு", priority: "low" as Priority },
  { id: "parks", en: "Parks & Public Spaces", ta: "பூங்காக்கள் & பொது இடங்கள்", priority: "low" as Priority },
];
