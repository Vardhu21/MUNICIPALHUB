import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { queueRank, triage } from "@/lib/triage";

const OFFICER_ROLES = new Set(["field_officer", "zonal_commissioner", "commissioner", "admin"]);

export default defineTool({
  name: "get_officer_queue",
  title: "Get officer health-risk queue",
  description: "Return active complaints for the signed-in officer, ranked by health hazards such as sewage, odour, stagnant water, and disease exposure.",
  inputSchema: { limit: z.number().int().min(1).max(50).default(20) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in is required.");
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("The signed-in user identity is unavailable.");
    const supabase = supabaseForUser(ctx);
    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role,ward_id")
      .eq("user_id", userId);
    if (roleError) throw new ToolError(`Role lookup failed: ${roleError.message}`);
    const officerRole = (roles ?? []).find((row) => OFFICER_ROLES.has(row.role));
    if (!officerRole) throw new ToolError("An officer role is required to view the officer queue.");

    let query = supabase
      .from("complaints")
      .select("id,title,description,category,priority,status,current_tier,created_at,clock_offset_hours,assigned_officer,ward_id,street_address,sla_hours")
      .not("status", "in", '("resolved","rejected")')
      .limit(100);
    if (officerRole.role === "field_officer" && officerRole.ward_id) query = query.eq("ward_id", officerRole.ward_id);
    const { data, error } = await query;
    if (error) throw new ToolError(`Officer queue lookup failed: ${error.message}`);

    const items = (data ?? [])
      .map((complaint) => {
        const health = triage(complaint);
        return { ...complaint, healthScore: health.score, healthBand: health.band, rankReasons: health.reasons, queueRank: queueRank(complaint) };
      })
      .sort((a, b) => b.queueRank - a.queueRank)
      .slice(0, limit);
    return {
      content: [{ type: "text", text: items.length ? JSON.stringify(items) : "No active complaints are assigned to this queue." }],
      structuredContent: { items, count: items.length },
    };
  },
});