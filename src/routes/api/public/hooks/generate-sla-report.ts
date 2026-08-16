import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled SLA report generator (called by the scheduler).
 *
 * Auth: the caller must present the server-only `CRON_SECRET` in the
 * `x-cron-secret` header (or as a bearer token). The Supabase publishable /
 * anon key is never accepted here — it ships inside every client bundle and
 * therefore authenticates nobody.
 */
export const Route = createFileRoute("/api/public/hooks/generate-sla-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-cron-secret") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const expected = process.env["CRON_SECRET"] ?? "";
        if (!expected || provided !== expected) {
          return json({ error: "Unauthorized" }, 401);
        }

        try {
          const { generateSlaReport } = await import("@/lib/sla-report.server");
          return json(await generateSlaReport("pg_cron"));
        } catch {
          return json({ error: "Report generation failed" }, 500);
        }
      },
    },
  },
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
