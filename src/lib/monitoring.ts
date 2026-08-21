/**
 * Lightweight client-side error monitoring.
 *
 * Catches the three failure classes that silently broke flows before:
 *  - failed data queries (React Query errors, Supabase errors)
 *  - failed navigations / redirects
 *  - uncaught UI errors and unhandled promise rejections
 *
 * Everything is logged to the console with a stable `[monitor]` prefix and
 * forwarded to Lovable error reporting so it surfaces in runtime errors.
 */
import type { QueryClient } from "@tanstack/react-query";
import { reportLovableError } from "./lovable-error-reporting";

export type MonitorArea = "query" | "mutation" | "navigation" | "auth" | "window" | "manual";

export type MonitorEvent = {
  area: MonitorArea;
  message: string;
  detail?: Record<string, unknown>;
  at: string;
};

const RING_SIZE = 50;
const ring: MonitorEvent[] = [];

/** Recent monitored failures, newest last. Useful when debugging in the console. */
export function recentMonitorEvents(): MonitorEvent[] {
  return [...ring];
}

export function monitorError(
  area: MonitorArea,
  error: unknown,
  detail: Record<string, unknown> = {},
) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);

  const event: MonitorEvent = { area, message, detail, at: new Date().toISOString() };
  ring.push(event);
  if (ring.length > RING_SIZE) ring.shift();

  console.error(`[monitor:${area}]`, message, detail);
  reportLovableError(error instanceof Error ? error : new Error(message), { area, ...detail });
}

let installed = false;

/** Install global listeners + React Query cache subscriptions. Idempotent. */
export function installMonitoring(queryClient: QueryClient) {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    if (!event.error) return;
    monitorError("window", event.error, { filename: event.filename, line: event.lineno });
  });

  window.addEventListener("unhandledrejection", (event) => {
    monitorError("window", event.reason, { kind: "unhandledrejection" });
  });

  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    const state = event.query.state;
    if (state.status === "error" && state.error) {
      monitorError("query", state.error, { queryKey: event.query.queryKey });
    }
  });

  queryClient.getMutationCache().subscribe((event) => {
    if (event.type !== "updated") return;
    const state = event.mutation?.state;
    if (state?.status === "error" && state.error) {
      monitorError("mutation", state.error, { mutationKey: event.mutation?.options.mutationKey });
    }
  });

  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__civicMonitor = recentMonitorEvents;
  }
}

/**
 * Wrap a Supabase-style `{ data, error }` result so failed queries never pass
 * silently through a UI flow.
 */
export function assertNoSupabaseError<T>(
  result: { data: T; error: { message: string } | null },
  context: string,
): T {
  if (result.error) {
    monitorError("query", new Error(result.error.message), { context });
    throw new Error(result.error.message);
  }
  return result.data;
}
