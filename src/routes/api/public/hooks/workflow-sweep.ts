import { createFileRoute } from "@tanstack/react-router";

/**
 * Backend-only sweep (called by the scheduler):
 *  - closes citizen verification windows that expired without a response,
 *  - sends SLA reminders and escalates assignments past their deadline.
 * Deterministic logic only — no AI is involved in SLA or GPS decisions.
 */
export const Route = createFileRoute("/api/public/hooks/workflow-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Server-only shared secret. The public anon/publishable key is NOT
        // acceptable here — it ships in every client bundle.
        const provided =
          request.headers.get("x-cron-secret") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const expected = process.env["CRON_SECRET"] ?? "";
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const h = await import("@/lib/workflow.server");
        const sb = await h.admin();
        const cfg = await h.loadConfig(sb);
        const now = Date.now();
        let autoClosed = 0;
        let reminded = 0;
        let escalated = 0;

        const { data: expired } = await sb
          .from("citizen_verifications")
          .select("id,complaint_id,citizen_id")
          .eq("decision", "pending")
          .lt("deadline_at", new Date(now).toISOString())
          .limit(100);

        for (const v of expired ?? []) {
          await sb
            .from("citizen_verifications")
            .update({ decision: "auto_closed", decided_at: new Date().toISOString() })
            .eq("id", v.id);
          await h.moveComplaint(sb, v.complaint_id, "auto_closed_no_response");
          await h.logEvent(
            sb,
            v.complaint_id,
            "auto_closed",
            "SLA Daemon",
            "Citizen verification window elapsed with no response — AUTO_CLOSED_NO_RESPONSE (not citizen-confirmed).",
          );
          await h.notify(sb, [v.citizen_id], "workflow", "Complaint auto-closed", "Your verification window elapsed. The complaint was auto-closed without citizen confirmation.");
          autoClosed++;
        }

        const { data: open } = await sb
          .from("complaint_assignments")
          .select("id,complaint_id,officer_id,worker_id,assigned_at,sla_deadline,stage,active")
          .eq("active", true)
          .in("stage", ["assigned", "worker_accepted", "travelling", "approaching", "arrived", "in_progress"])
          .limit(200);

        for (const a of open ?? []) {
          const start = new Date(a.assigned_at).getTime();
          const end = new Date(a.sla_deadline).getTime();
          const span = Math.max(1, end - start);
          const { data: worker } = await sb.from("workers").select("user_id").eq("id", a.worker_id).maybeSingle();
          const { data: complaint } = await sb.from("complaints").select("id,title,author_id,status,current_tier").eq("id", a.complaint_id).maybeSingle();
          if (!complaint) continue;

          if (now >= end) {
            await sb.from("complaints").update({ status: "escalated", escalated_at: new Date().toISOString() }).eq("id", complaint.id);
            await h.logEvent(sb, complaint.id, "sla_expired", "SLA Daemon", "Visit SLA expired — escalated to the next authority tier.");
            await h.notify(sb, [a.officer_id, worker?.user_id, complaint.author_id], "workflow", "SLA expired — escalated", `"${complaint.title}" breached its SLA and was escalated.`);
            escalated++;
          } else if (now - start >= span * cfg.sla_reminder_ratio) {
            const { count } = await sb
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("title", "SLA approaching")
              .eq("user_id", a.officer_id)
              .ilike("body", `%${complaint.title}%`);
            if (!count) {
              await h.notify(sb, [a.officer_id, worker?.user_id], "workflow", "SLA approaching", `"${complaint.title}" is approaching its SLA deadline.`);
              reminded++;
            }
          }
        }

        return Response.json({ ok: true, autoClosed, reminded, escalated });
      },
    },
  },
});
