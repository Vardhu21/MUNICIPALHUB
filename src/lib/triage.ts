import type { Priority } from "@/lib/sla";
import { computeClock } from "@/lib/sla";

/**
 * Health-impact triage engine.
 *
 * Officers no longer see a citizen-chosen priority. Instead every grievance is
 * scored by an algorithm that weighs public-health and sanitation risk highest:
 * odour/smell, sewage, stagnant water, mosquito breeding and garbage rot rise to
 * the top of the officer queue even when the reported "thing" is small, because
 * they are the issues that silently damage residents' health.
 */

export type HealthBand = "critical" | "severe" | "moderate" | "routine";

export type Triage = {
  score: number; // 0-100
  band: HealthBand;
  priority: Priority;
  reasons: string[];
};

/** Baseline health-risk weight per category (0-100). */
const CATEGORY_WEIGHT: Record<string, number> = {
  drainage: 82, // sewage overflow — direct disease vector
  sanitation: 78, // rotting garbage, odour, flies
  publichealth: 80,
  environment: 66,
  water: 74, // contaminated / burst supply line
  watersupply: 74,
  electrical: 70, // acute physical hazard
  publicsafety: 62,
  roads: 40,
  streetlight: 34,
  encroachment: 24,
  parks: 20,
};

/** DB rows store human labels ("Water Supply"), the form stores ids ("water"). */
function categoryKey(raw: string) {
  return raw.toLowerCase().replace(/[^a-z]/g, "");
}


/** Odour / disease-vector signals. Weighted far above cosmetic complaints. */
const SIGNALS: { weight: number; label: string; words: string[] }[] = [
  {
    weight: 26,
    label: "Foul smell / odour reported",
    words: ["smell", "smelly", "stink", "stinking", "odour", "odor", "foul", "stench", "நாற்றம்", "துர்நாற்றம்"],
  },
  {
    weight: 24,
    label: "Sewage or faecal exposure",
    words: ["sewage", "sewer", "faecal", "fecal", "toilet", "septic", "human waste", "கழிவுநீர்", "மலம்"],
  },
  {
    weight: 20,
    label: "Stagnant water — mosquito breeding",
    words: ["stagnant", "stagnate", "mosquito", "dengue", "malaria", "breeding", "தேங்கிய", "கொசு", "டெங்கு"],
  },
  {
    weight: 20,
    label: "Rotting waste / dead animal",
    words: ["rotting", "rotten", "decay", "dead animal", "carcass", "maggot", "flies", "அழுகிய", "இறந்த"],
  },
  {
    weight: 18,
    label: "Contaminated drinking water",
    words: ["contaminat", "dirty water", "muddy water", "mixing", "unsafe water", "அசுத்த", "கலப்பு"],
  },
  {
    weight: 16,
    label: "Illness already reported nearby",
    words: ["vomit", "fever", "diarrh", "illness", "sick", "hospital", "rash", "காய்ச்சல்", "நோய்"],
  },
  {
    weight: 14,
    label: "Vulnerable population exposed (school / hospital / children)",
    words: ["school", "children", "child", "hospital", "clinic", "anganwadi", "elderly", "பள்ளி", "குழந்தை", "மருத்துவமனை"],
  },
  {
    weight: 12,
    label: "Overflow spreading into public space",
    words: ["overflow", "spilling", "flooded", "leak", "burst", "வழிகிறது", "கசிவு"],
  },
];

function bandOf(score: number): HealthBand {
  if (score >= 80) return "critical";
  if (score >= 60) return "severe";
  if (score >= 40) return "moderate";
  return "routine";
}

function priorityOf(score: number): Priority {
  if (score >= 80) return "emergency";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export const BAND_LABEL: Record<HealthBand, { en: string; ta: string }> = {
  critical: { en: "Critical health risk", ta: "மிக ஆபத்தான சுகாதார அபாயம்" },
  severe: { en: "Severe health risk", ta: "கடுமையான சுகாதார அபாயம்" },
  moderate: { en: "Moderate impact", ta: "மிதமான தாக்கம்" },
  routine: { en: "Routine civic work", ta: "வழக்கமான பணி" },
};

export const BAND_TONE: Record<HealthBand, string> = {
  critical: "border-destructive/50 bg-destructive/15 text-destructive",
  severe: "border-warning/50 bg-warning/15 text-warning",
  moderate: "border-primary/40 bg-primary/10 text-primary",
  routine: "border-border bg-secondary text-muted-foreground",
};

/** Core scorer — pure text + category analysis, no network needed. */
export function triage(input: { category: string; title?: string; description?: string }): Triage {
  const text = `${input.title ?? ""} ${input.description ?? ""}`.toLowerCase();
  const base = CATEGORY_WEIGHT[categoryKey(input.category)] ?? 35;
  const reasons: string[] = [];
  let bonus = 0;

  for (const s of SIGNALS) {
    if (s.words.some((w) => text.includes(w))) {
      bonus += s.weight;
      reasons.push(s.label);
    }
  }

  // Diminishing returns so one keyword-stuffed report cannot dominate the queue.
  const scaled = base + 22 * (1 - Math.exp(-bonus / 30));
  const score = Math.max(0, Math.min(100, Math.round(scaled)));

  if (!reasons.length) reasons.push("No health-hazard signals detected in the report text");

  return { score, band: bandOf(score), priority: priorityOf(score), reasons };
}

/**
 * Officer queue ranking: health score first, then SLA urgency, so the smallest
 * smell/sanitation complaint outranks a large cosmetic one.
 */
export function queueRank(c: {
  category: string;
  title: string;
  description: string;
  created_at: string;
  priority: Priority;
  clock_offset_hours: number;
  sla_hours?: number | null;
}): number {

  const t = triage(c);
  const clock = computeClock(c.created_at, c.priority, c.clock_offset_hours, { slaHours: c.sla_hours });
  const urgency = clock.breached ? 18 : 18 * clock.ratio;
  return t.score * 2 + urgency;
}
