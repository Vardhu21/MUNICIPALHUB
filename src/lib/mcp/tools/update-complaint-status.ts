import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const OFFICER_ROLES = new Set(["field_officer", "zonal_commissioner", "commissioner", "admin"]);

export default defineTool({
  name: "update_complaint_status",
  title: "Update complaint status",
  description: "Update a complaint workflow status as the signed-in municipal officer and append an immutable audit event.",
  inputSchema: {
    complaintId: z.string().uuid(),
    status: z.enum(["assigned", "in_progress", "verification", "resolved", "escalated", "joint_task_force", "rejected"]),
    note: z.string().trim().min(3).max(500).describe("Reason or work note recorded in the audit timeline."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ complaintId, status, note }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in is required.");
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("The signed-in user identity is unavailable.");
    const supabase = supabaseForUser(ctx);
    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleError) throw new ToolError(`Role lookup failed: ${roleError.message}`);
    const role = (roles ?? []).map((row) => row.role).find((candidate) => OFFICER_ROLES.has(candidate));
    if (!role) throw new ToolError("An officer role is required to update complaint status.");

    const { data: complaint, error: updateError } = await supabase
      .from("complaints")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", complaintId)
      .select("id,title,status,current_tier,updated_at,assigned_officer")
      .maybeSingle();
    if (updateError) throw new ToolError(`Status update failed: ${updateError.message}`);
    if (!complaint) throw new ToolError("Complaint not found or not available to this officer.");

    const { error: eventError } = await supabase.from("complaint_events").insert({
      complaint_id: complaintId,
      event_type: "status_update",
      actor_label: `MCP · ${role}`,
      note,
    });
    if (eventError) throw new ToolError(`Status changed, but the audit event failed: ${eventError.message}`);
    return {
      content: [{ type: "text", text: `Complaint ${complaint.id} is now ${complaint.status}. Audit note recorded.` }],
      structuredContent: { complaint },
    };
  },
});