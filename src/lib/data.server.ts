import type { Tier } from "@/lib/sla";

/** Authority label for a tier — server-safe copy used by escalation handlers. */
export function officerForTier(tier: Tier, isGCC = false) {
  switch (tier) {
    case "zonal":
      return "Thiru. R. Balamurugan — Zonal Assistant Commissioner";
    case "commissioner":
      return isGCC
        ? "MAWS State Secretariat — Principal Secretary (Municipal Administration)"
        : "Dr. S. Meenakshi IAS — Corporation Commissioner";
    case "jtf":
      return isGCC
        ? "Joint Task Force — MAWS Secretariat · TWAD Board · Highways Dept."
        : "Joint Task Force Cell — TWAD Board & Highways Dept.";
    default:
      return "Thiru. K. Arumugam — Assistant Engineer (Field)";
  }
}
