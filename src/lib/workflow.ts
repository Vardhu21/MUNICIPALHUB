/**
 * Delivery-style grievance resolution workflow.
 * Shared, client-safe constants: stages, labels and legal transitions.
 * All authoritative GPS / SLA / permission checks live server-side in
 * `workflow.functions.ts` — nothing here is a security boundary.
 */

export type WorkflowStage =
  | "submitted"
  | "assigned"
  | "worker_accepted"
  | "travelling"
  | "approaching"
  | "arrived"
  | "in_progress"
  | "evidence_submitted"
  | "officer_review"
  | "officer_approved"
  | "citizen_verification"
  | "resolved_by_citizen"
  | "auto_closed_no_response"
  | "reopened"
  | "escalated";

/** Ordered tracker steps shown to citizens, workers and officers. */
export const TRACKER_STEPS: WorkflowStage[] = [
  "submitted",
  "assigned",
  "travelling",
  "arrived",
  "in_progress",
  "evidence_submitted",
  "officer_review",
  "citizen_verification",
  "resolved_by_citizen",
];

export const STAGE_LABEL: Record<WorkflowStage, { en: string; ta: string }> = {
  submitted: { en: "Complaint received", ta: "புகார் பெறப்பட்டது" },
  assigned: { en: "Worker assigned", ta: "பணியாளர் ஒதுக்கப்பட்டார்" },
  worker_accepted: { en: "Worker accepted", ta: "பணியாளர் ஏற்றுக்கொண்டார்" },
  travelling: { en: "Worker travelling", ta: "பணியாளர் பயணத்தில்" },
  approaching: { en: "Approaching location", ta: "இடத்தை நெருங்குகிறார்" },
  arrived: { en: "Arrived", ta: "வந்துவிட்டார்" },
  in_progress: { en: "Work in progress", ta: "பணி நடைபெறுகிறது" },
  evidence_submitted: { en: "Evidence submitted", ta: "சான்று சமர்ப்பிக்கப்பட்டது" },
  officer_review: { en: "Officer verification", ta: "அலுவலர் சரிபார்ப்பு" },
  officer_approved: { en: "Officer approved", ta: "அலுவலர் ஒப்புதல்" },
  citizen_verification: { en: "Citizen verification", ta: "குடிமகன் சரிபார்ப்பு" },
  resolved_by_citizen: { en: "Resolved", ta: "தீர்க்கப்பட்டது" },
  auto_closed_no_response: { en: "Auto-closed (no response)", ta: "தானாக மூடப்பட்டது (பதில் இல்லை)" },
  reopened: { en: "Reopened", ta: "மீண்டும் திறக்கப்பட்டது" },
  escalated: { en: "Escalated", ta: "மேல்முறையீடு" },
};

/** Legal complaint-status transitions. Anything else is rejected server-side. */
export const ALLOWED_TRANSITIONS: Record<string, WorkflowStage[]> = {
  submitted: ["assigned", "escalated"],
  assigned: ["worker_accepted", "assigned", "escalated"],
  worker_accepted: ["travelling", "escalated"],
  travelling: ["arrived", "escalated"],
  arrived: ["in_progress", "escalated"],
  in_progress: ["evidence_submitted", "escalated"],
  evidence_submitted: ["officer_review", "escalated"],
  officer_review: ["officer_approved", "in_progress", "escalated"],
  officer_approved: ["citizen_verification"],
  citizen_verification: ["resolved_by_citizen", "reopened", "auto_closed_no_response"],
  reopened: ["officer_review", "assigned", "escalated"],
  escalated: ["assigned", "worker_accepted", "travelling", "arrived", "in_progress"],
};

export function canTransition(from: string, to: WorkflowStage) {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/** Evidence verification states (independent axes, all recorded). */
export const EVIDENCE_STATES = [
  "PENDING",
  "GPS_VERIFIED",
  "GPS_FAILED",
  "EXIF_VERIFIED",
  "EXIF_UNAVAILABLE",
  "AI_VERIFIED",
  "AI_FLAGGED",
  "OFFICER_APPROVED",
  "OFFICER_REJECTED",
] as const;
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export const EVIDENCE_STATE_LABEL: Record<EvidenceState, { en: string; ta: string }> = {
  PENDING: { en: "Pending", ta: "நிலுவையில்" },
  GPS_VERIFIED: { en: "GPS verified", ta: "GPS சரிபார்க்கப்பட்டது" },
  GPS_FAILED: { en: "GPS mismatch", ta: "GPS பொருந்தவில்லை" },
  EXIF_VERIFIED: { en: "Photo GPS verified", ta: "புகைப்பட GPS சரி" },
  EXIF_UNAVAILABLE: { en: "EXIF GPS unavailable", ta: "EXIF GPS இல்லை" },
  AI_VERIFIED: { en: "AI: relevant", ta: "AI: பொருத்தமானது" },
  AI_FLAGGED: { en: "AI: flagged for review", ta: "AI: மறுஆய்வுக்கு" },
  OFFICER_APPROVED: { en: "Officer approved", ta: "அலுவலர் ஒப்புதல்" },
  OFFICER_REJECTED: { en: "Officer rejected", ta: "அலுவலர் நிராகரிப்பு" },
};

export const DEFAULT_CONFIG = {
  arrival_radius_m: 40,
  approach_radius_m: 250,
  nearby_radius_m: 300,
  evidence_gps_radius_m: 75,
  citizen_window_hours: 6,
  sla_reminder_ratio: 0.8,
};
export type WorkflowConfig = typeof DEFAULT_CONFIG;

export type WorkerRow = {
  id: string;
  user_id: string;
  display_name: string;
  department: string;
  ward_id: string | null;
  active: boolean;
};

export type AssignmentRow = {
  id: string;
  complaint_id: string;
  worker_id: string;
  officer_id: string;
  assigned_at: string;
  sla_deadline: string;
  dest_lat: number | null;
  dest_lng: number | null;
  stage: WorkflowStage;
  accepted_at: string | null;
  travel_started_at: string | null;
  arrived_at: string | null;
  work_started_at: string | null;
  completed_at: string | null;
  last_distance_m: number | null;
  last_ping_at: string | null;
  active: boolean;
};

export type EvidenceRow = {
  id: string;
  complaint_id: string;
  assignment_id: string | null;
  worker_id: string;
  image_path: string;
  description: string;
  worker_lat: number | null;
  worker_lng: number | null;
  exif_lat: number | null;
  exif_lng: number | null;
  gps_distance_m: number | null;
  exif_distance_m: number | null;
  gps_state: EvidenceState;
  exif_state: EvidenceState;
  ai_state: EvidenceState;
  ai_relevance: string | null;
  ai_confidence: number | null;
  ai_observed_issue: string | null;
  ai_explanation: string | null;
  officer_state: EvidenceState;
  officer_reason: string | null;
  officer_decided_at: string | null;
  created_at: string;
};

export type CitizenVerificationRow = {
  id: string;
  complaint_id: string;
  evidence_id: string | null;
  citizen_id: string;
  opened_at: string;
  deadline_at: string;
  decision: "pending" | "satisfied" | "not_satisfied" | "auto_closed";
  reason: string | null;
  photo_path: string | null;
  decided_at: string | null;
};

export function formatMetres(m: number | null | undefined) {
  if (m == null || Number.isNaN(m)) return "—";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
