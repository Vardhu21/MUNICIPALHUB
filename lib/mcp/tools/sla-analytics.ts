import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { byDepartment, byOfficer, byWard, overallStats } from "@/lib/analytics";
import type { Complaint, Ward } from "@/lib/data";

const ANALYTICS_ROLES = new Set(["zonal_commissioner", "commissioner", "admin"]);

export default defineTool({
  name: "get_sla_analytics",
  title: "Get SLA analytics",
  description: "Summarize complaint volume, SLA compliance, breaches, escalations, and resolution performance for commissioner oversight.",
  inputSchema: { groupBy: z.enum(["ward", "department", "officer"]).default("ward") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ groupBy }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in is required.");
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("The signed-in user identity is unavailable.");
    const supabase = supabaseForUser(ctx);
    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleError) throw new ToolError(`Role lookup failed: ${roleError.message}`);
    if (!(roles ?? []).some((row) => ANALYTICS_ROLES.has(row.role))) {
      throw new ToolError("Commissioner or zonal commissioner access is required for SLA analytics.");
    }

    const [complaintsResult, wardsResult] = await Promise.all([
      supabase.from("complaints").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("wards").select("*").order("ward_number").limit(500),
    ]);
    if (complaintsResult.error) throw new ToolError(`Analytics lookup failed: ${complaintsResult.error.message}`);
    if (wardsResult.error) throw new ToolError(`Ward lookup failed: ${wardsResult.error.message}`);
    const complaints = (complaintsResult.data ?? []) as Complaint[];
    const wards = (wardsResult.data ?? []) as Ward[];
    const groups = groupBy === "department" ? byDepartment(complaints) : groupBy === "officer" ? byOfficer(complaints) : byWard(complaints, wards);
    const result = { overall: overallStats(complaints), groupBy, groups };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});