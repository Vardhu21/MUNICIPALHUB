import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listComplaintsTool from "./tools/list-complaints";
import getComplaintTool from "./tools/get-complaint";
import officerQueueTool from "./tools/officer-queue";
import slaAnalyticsTool from "./tools/sla-analytics";
import updateComplaintStatusTool from "./tools/update-complaint-status";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "community-hub-connect",
  title: "Community Hub Connect",
  version: "0.1.0",
  instructions:
    "Tools for TN SmartMunicipality complaint search, public audit details, health-risk officer queues, commissioner SLA oversight, and authorized workflow updates. Never infer or request sealed citizen identity data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listComplaintsTool, getComplaintTool, officerQueueTool, slaAnalyticsTool, updateComplaintStatusTool],
});