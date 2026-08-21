import { describe, expect, it } from "vitest";
import { canTransition, ALLOWED_TRANSITIONS, formatMetres } from "./workflow";

describe("grievance state machine", () => {
  it("walks the full happy path from submission to citizen closure", () => {
    const path = [
      "submitted",
      "assigned",
      "worker_accepted",
      "travelling",
      "arrived",
      "in_progress",
      "evidence_submitted",
      "officer_review",
      "officer_approved",
      "citizen_verification",
      "resolved_by_citizen",
    ] as const;

    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1] as never), `${path[i]} -> ${path[i + 1]}`).toBe(true);
    }
  });

  it("rejects skipping evidence review", () => {
    expect(canTransition("in_progress", "officer_approved")).toBe(false);
    expect(canTransition("assigned", "resolved_by_citizen" as never)).toBe(false);
  });

  it("allows reopen and auto-close from citizen verification", () => {
    expect(canTransition("citizen_verification", "reopened")).toBe(true);
    expect(canTransition("citizen_verification", "auto_closed_no_response")).toBe(true);
  });

  it("keeps terminal states terminal", () => {
    expect(ALLOWED_TRANSITIONS["resolved_by_citizen"]).toBeUndefined();
    expect(canTransition("auto_closed_no_response", "assigned")).toBe(false);
  });

  it("formats distances for the tracker", () => {
    expect(formatMetres(0)).toBeTypeOf("string");
    expect(formatMetres(null)).toBeTypeOf("string");
  });
});
