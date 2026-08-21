import { describe, expect, it } from "vitest";
import { computeClock, resolveEscalation, slaRow, isGreaterChennai, haversineMeters } from "./sla";
import { triage, queueRank } from "./triage";

const HOUR = 3_600_000;

describe("SLA clock", () => {
  it("uses the priority matrix hours", () => {
    expect(slaRow("emergency").hours).toBe(2);
    expect(slaRow("medium").hours).toBe(24);
  });

  it("marks a breach once the window elapses", () => {
    const now = Date.now();
    const created = new Date(now - 3 * HOUR).toISOString();
    expect(computeClock(created, "emergency", 0, now).breached).toBe(true);
    expect(computeClock(created, "medium", 0, now).breached).toBe(false);
  });
});

describe("escalation", () => {
  it("escalates field -> zonal -> commissioner", () => {
    const field = resolveEscalation({
      status: "assigned",
      tier: "field",
      priority: "medium",
      elapsedHours: 25,
    });
    expect(field.tier).toBe("zonal");

    const zonal = resolveEscalation({
      status: "escalated",
      tier: "zonal",
      priority: "medium",
      elapsedHours: 49,
    });
    expect(zonal.tier).toBe("commissioner");
  });

  it("fires the GCC deadlock breaker earlier", () => {
    const gcc = resolveEscalation({
      status: "escalated",
      tier: "commissioner",
      priority: "medium",
      elapsedHours: 24 + 24,
      isGCC: true,
    });
    expect(gcc.tier).toBe("jtf");
  });

  it("never escalates terminal tickets", () => {
    const done = resolveEscalation({
      status: "resolved",
      tier: "field",
      priority: "emergency",
      elapsedHours: 500,
    });
    expect(done.changed).toBe(false);
  });

  it("detects Greater Chennai Corporation", () => {
    expect(isGreaterChennai("Greater Chennai Corporation")).toBe(true);
    expect(isGreaterChennai("Coimbatore Corporation")).toBe(false);
  });
});

describe("geo + triage", () => {
  it("measures short distances sanely", () => {
    const a = { lat: 13.0827, lng: 80.2707 };
    const b = { lat: 13.0827, lng: 80.2717 };
    const d = haversineMeters(a, b);
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(200);
  });

  it("ranks odour/sewage above cosmetic complaints", () => {
    const sewage = triage({
      category: "drainage",
      title: "Sewage overflow",
      description: "Foul smell and stagnant water near the school",
    });
    const paint = triage({ category: "parks", title: "Bench paint peeling", description: "Looks old" });
    expect(sewage.score).toBeGreaterThan(paint.score);
    expect(queueRank({ ...sewage, category: "drainage", title: "Sewage overflow", description: "smell", created_at: new Date().toISOString(), priority: sewage.priority, clock_offset_hours: 0 })).toBeGreaterThan(0);
  });
});
