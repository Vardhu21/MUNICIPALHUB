import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_complaint",
  title: "Get complaint details",
  description: "Read one complaint and its chronological public audit events without exposing sealed citizen identity data.",
  inputSchema: { complaintId: z.string().uuid().describe("Complaint UUID.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ complaintId }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in is required.");
    const supabase = supabaseForUser(ctx);
    const [complaintResult, eventsResult] = await Promise.all([
      supabase
        .from("complaints")
        .select("id,title,description,category,priority,status,current_tier,created_at,updated_at,author_pseudonym,assigned_officer,ward_id,lat,lng,street_address,photo_url,resolution_photo_url,geo_verified,frozen_fake,complainant_approved,sla_hours")
        .eq("id", complaintId)
        .maybeSingle(),
      supabase
        .from("complaint_events")
        .select("id,event_type,actor_label,note,created_at")
        .eq("complaint_id", complaintId)
        .order("created_at", { ascending: true }),
    ]);
    if (complaintResult.error) throw new ToolError(`Complaint lookup failed: ${complaintResult.error.message}`);
    if (!complaintResult.data) throw new ToolError("Complaint not found.");
    if (eventsResult.error) throw new ToolError(`Audit event lookup failed: ${eventsResult.error.message}`);
    const result = { complaint: complaintResult.data, events: eventsResult.data ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});