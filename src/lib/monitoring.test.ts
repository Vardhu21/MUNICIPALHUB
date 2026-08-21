import { describe, expect, it, vi } from "vitest";
import { assertNoSupabaseError, monitorError, recentMonitorEvents } from "./monitoring";

describe("monitoring", () => {
  it("records failures in the ring buffer", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    monitorError("manual", new Error("boom"), { where: "test" });
    const last = recentMonitorEvents().at(-1);
    expect(last?.message).toBe("boom");
    expect(last?.area).toBe("manual");
  });

  it("throws on supabase errors and passes data through", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(assertNoSupabaseError({ data: 42, error: null }, "ok")).toBe(42);
    expect(() => assertNoSupabaseError({ data: null, error: { message: "rls" } }, "bad")).toThrow("rls");
  });
});
