import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_complaints",
  title: "Search complaints",
  description: "Search municipal complaints by text, ward, status, or category and return the newest matching records.",
  inputSchema: {
    search: z.string().trim().optional().describe("Optional words from the complaint title or description."),
    wardId: z.string().uuid().optional().describe("Optional ward UUID."),
    status: z.enum(["submitted", "assigned", "in_progress", "verification", "resolved", "escalated", "joint_task_force", "rejected"]).optional(),
    category: z.string().trim().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, wardId, status, category, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in is required.");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("complaints")
      .select("id,title,description,category,status,current_tier,created_at,updated_at,author_pseudonym,assigned_officer,ward_id,street_address,geo_verified,sla_hours")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (wardId) query = query.eq("ward_id", wardId);
    if (status) query = query.eq("status", status);
    if (category) query = query.ilike("category", `%${category}%`);
    if (search) {
      const safe = search.replace(/[,%()]/g, " ").trim();
      if (safe) query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
    }
    const { data, error } = await query;
    if (error) throw new ToolError(`Complaint search failed: ${error.message}`);
    const items = data ?? [];
    return {
      content: [{ type: "text", text: items.length ? JSON.stringify(items) : "No matching complaints were found." }],
      structuredContent: { items, count: items.length },
    };
  },
});