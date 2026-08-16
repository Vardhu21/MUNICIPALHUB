import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { AssignmentRow } from "./workflow";

const Coords = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** Config + the caller's worker profile (if any). */
export const getWorkflowBootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const config = await h.loadConfig(sb);
    const { data: worker } = await sb
      .from("workers")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { config, worker: worker ?? null, isOfficer: await h.isOfficer(sb, context.userId) };
  });

/** Registers the signed-in user as a field worker (self-enrolment for the ward crew). */
export const registerWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        displayName: z.string().min(2).max(80),
        department: z.string().min(2).max(40),
        wardId: z.string().uuid().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    // Authorization: only accounts already granted the `worker` role (or an
    // officer/admin) may create a worker profile. Citizens cannot self-promote.
    const { data: roleRows } = await sb.from("user_roles").select("role").eq("user_id", context.userId);
    const held = (roleRows ?? []).map((r: { role: string }) => r.role);
    if (!held.includes("worker") && !(await h.isOfficer(sb, context.userId))) {
      throw new Error("Worker access required. Ask your ward officer to enrol you.");
    }
    const { data: row, error } = await sb
      .from("workers")
      .upsert(
        {
          user_id: context.userId,
          display_name: data.displayName,
          department: data.department,
          ward_id: data.wardId ?? null,
          active: true,
        },
        { onConflict: "user_id" },
      )
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    await sb.from("user_roles").upsert(
      { user_id: context.userId, role: "worker" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
    return row;
  });

export const listWorkers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    if (!(await h.isOfficer(sb, context.userId))) throw new Error("Officer access required.");
    const { data } = await sb
      .from("workers")
      .select("id,user_id,display_name,department,ward_id,active")
      .eq("active", true)
      .order("display_name");
    return data ?? [];
  });

/** Officer assigns an authorised worker; starts the SLA timer for the visit. */
export const assignWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        complaintId: z.string().uuid(),
        workerId: z.string().uuid(),
        slaHours: z.number().min(0.5).max(240).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    if (!(await h.isOfficer(sb, context.userId))) throw new Error("Officer access required.");

    const { data: complaint } = await sb
      .from("complaints")
      .select("id,title,author_id,lat,lng,sla_hours,status")
      .eq("id", data.complaintId)
      .maybeSingle();
    if (!complaint) throw new Error("Complaint not found.");

    const { data: worker } = await sb
      .from("workers")
      .select("id,user_id,display_name")
      .eq("id", data.workerId)
      .maybeSingle();
    if (!worker) throw new Error("Worker not found.");

    const hours = data.slaHours ?? complaint.sla_hours ?? 24;
    const deadline = new Date(Date.now() + hours * 3_600_000).toISOString();

    await sb.from("complaint_assignments").update({ active: false }).eq("complaint_id", complaint.id);
    const { data: assignment, error } = await sb
      .from("complaint_assignments")
      .insert({
        complaint_id: complaint.id,
        worker_id: worker.id,
        officer_id: context.userId,
        sla_deadline: deadline,
        dest_lat: complaint.lat,
        dest_lng: complaint.lng,
        stage: "assigned",
      })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);

    await h.moveComplaint(sb, complaint.id, "assigned", { assigned_officer: worker.display_name });
    await h.logEvent(sb, complaint.id, "assigned", "Officer", `Assigned to worker ${worker.display_name}. Visit SLA ${hours}h.`);
    await h.notify(sb, [worker.user_id], "assignment", "New assignment", `You have been assigned: ${complaint.title}`);
    await h.notify(sb, [complaint.author_id], "workflow", "Worker assigned", `A municipal worker has been assigned to "${complaint.title}".`);
    return assignment;
  });

/** Assignments for the signed-in worker, newest first. */
export const myAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const { data: worker } = await sb.from("workers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!worker) return { worker: null, items: [] };
    const { data: assignments } = await sb
      .from("complaint_assignments")
      .select("*")
      .eq("worker_id", worker.id)
      .order("assigned_at", { ascending: false })
      .limit(40);
    const rows = (assignments ?? []) as AssignmentRow[];
    const ids = rows.map((a) => a.complaint_id);
    const { data: complaints } = ids.length
      ? await sb
          .from("complaints")
          .select("id,title,description,category,priority,status,lat,lng,street_address,photo_url,ward_id,created_at")
          .in("id", ids)
      : { data: [] };
    return {
      worker,
      items: rows.map((a) => ({
        assignment: a,
        complaint: (complaints ?? []).find((c: { id: string }) => c.id === a.complaint_id) ?? null,
      })),
    };
  });

const StageInput = z.object({ assignmentId: z.string().uuid() });

async function ownedAssignment(h: typeof import("./workflow.server"), sb: any, userId: string, assignmentId: string) {
  const { data: worker } = await sb.from("workers").select("id,user_id,display_name").eq("user_id", userId).maybeSingle();
  if (!worker) throw new Error("Worker profile required.");
  const { data: assignment } = await sb
    .from("complaint_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment || assignment.worker_id !== worker.id) throw new Error("Assignment not found for this worker.");
  const { data: complaint } = await sb
    .from("complaints")
    .select("id,title,author_id,lat,lng,category,description,status,ward_id")
    .eq("id", assignment.complaint_id)
    .maybeSingle();
  if (!complaint) throw new Error("Complaint not found.");
  return { worker, assignment, complaint };
}

export const acceptAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => StageInput.parse(raw))
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const { worker, assignment, complaint } = await ownedAssignment(h, sb, context.userId, data.assignmentId);
    await sb
      .from("complaint_assignments")
      .update({ stage: "worker_accepted", accepted_at: new Date().toISOString() })
      .eq("id", assignment.id);
    await h.moveComplaint(sb, complaint.id, "worker_accepted");
    await h.logEvent(sb, complaint.id, "worker_accepted", worker.display_name, "Worker accepted the assignment.");
    await h.notify(sb, [complaint.author_id, assignment.officer_id], "workflow", "Worker accepted", `Work accepted for "${complaint.title}".`);
    return { ok: true };
  });

export const startTravel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => StageInput.parse(raw))
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const { worker, assignment, complaint } = await ownedAssignment(h, sb, context.userId, data.assignmentId);
    await sb
      .from("complaint_assignments")
      .update({ stage: "travelling", travel_started_at: new Date().toISOString() })
      .eq("id", assignment.id);
    await h.moveComplaint(sb, complaint.id, "travelling");
    await h.logEvent(sb, complaint.id, "travelling", worker.display_name, "Worker started travelling to the location.");
    await h.notify(sb, [complaint.author_id, assignment.officer_id], "workflow", "Worker travelling", `A worker is on the way for "${complaint.title}".`);
    return { ok: true };
  });

/**
 * Location ping for an ACTIVE assignment only. The distance and the arrival
 * decision are computed here, server-side; the browser only supplies a raw fix.
 */
export const pingWorkerLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => StageInput.extend(Coords.shape).parse(raw))
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const { worker, assignment, complaint } = await ownedAssignment(h, sb, context.userId, data.assignmentId);
    if (!assignment.active) throw new Error("Assignment is no longer active.");
    if (!["worker_accepted", "travelling", "approaching", "arrived"].includes(assignment.stage)) {
      return { tracked: false, stage: assignment.stage, distance_m: null as number | null };
    }
    const dest =
      assignment.dest_lat != null && assignment.dest_lng != null
        ? { lat: assignment.dest_lat, lng: assignment.dest_lng }
        : complaint.lat != null && complaint.lng != null
          ? { lat: complaint.lat, lng: complaint.lng }
          : null;
    if (!dest) throw new Error("Complaint has no recorded location.");

    const cfg = await h.loadConfig(sb);
    const distance = h.distanceM({ lat: data.lat, lng: data.lng }, dest);

    let stage = assignment.stage;
    if (distance <= cfg.arrival_radius_m) stage = "arrived";
    else if (distance <= cfg.approach_radius_m) stage = "approaching";
    else if (assignment.stage !== "arrived") stage = "travelling";

    const patch: Record<string, unknown> = {
      stage,
      last_distance_m: distance,
      last_ping_at: new Date().toISOString(),
    };
    if (stage === "arrived" && !assignment.arrived_at) patch.arrived_at = new Date().toISOString();
    await sb.from("complaint_assignments").update(patch).eq("id", assignment.id);

    if (stage !== assignment.stage) {
      if (stage === "arrived") {
        await h.moveComplaint(sb, complaint.id, "arrived");
        await h.logEvent(sb, complaint.id, "arrived", worker.display_name, `Worker arrived (${Math.round(distance)} m from the complaint point).`);
        await h.notify(sb, [complaint.author_id, assignment.officer_id], "workflow", "Worker has arrived", `Worker has arrived at the complaint location for "${complaint.title}".`);
        // Ward councillor is resolved dynamically from the complaint's ward.
        await h.notifyWardCouncillor(
          sb,
          complaint,
          "Worker arrived in your ward",
          `A municipal worker has arrived at the complaint location for "${complaint.title}".`,
        );
      } else if (stage === "approaching") {
        await h.notify(sb, [complaint.author_id], "workflow", "Worker approaching", `The worker is approaching the location for "${complaint.title}".`);
      }
    }
    return { tracked: true, stage, distance_m: distance, arrival_radius_m: cfg.arrival_radius_m };
  });

export const startWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => StageInput.parse(raw))
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const { worker, assignment, complaint } = await ownedAssignment(h, sb, context.userId, data.assignmentId);
    if (assignment.stage !== "arrived") throw new Error("You must be marked as arrived before starting work.");
    await sb
      .from("complaint_assignments")
      .update({ stage: "in_progress", work_started_at: new Date().toISOString() })
      .eq("id", assignment.id);
    await h.moveComplaint(sb, complaint.id, "in_progress");
    await h.logEvent(sb, complaint.id, "work_started", worker.display_name, "Work started on site.");
    return { ok: true };
  });

/** Uploads completion evidence, runs deterministic GPS checks and AI relevance. */
export const submitEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        assignmentId: z.string().uuid(),
        imageDataUrl: z.string().min(64).max(9_000_000),
        description: z.string().max(1000).default(""),
        workerLat: z.number().min(-90).max(90),
        workerLng: z.number().min(-180).max(180),
        exifLat: z.number().min(-90).max(90).nullable().optional(),
        exifLng: z.number().min(-180).max(180).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const { worker, assignment, complaint } = await ownedAssignment(h, sb, context.userId, data.assignmentId);
    const cfg = await h.loadConfig(sb);

    const dest =
      assignment.dest_lat != null && assignment.dest_lng != null
        ? { lat: assignment.dest_lat, lng: assignment.dest_lng }
        : complaint.lat != null && complaint.lng != null
          ? { lat: complaint.lat, lng: complaint.lng }
          : null;

    const gpsDistance = dest ? h.distanceM({ lat: data.workerLat, lng: data.workerLng }, dest) : null;
    const exifPresent = data.exifLat != null && data.exifLng != null;
    const exifDistance =
      dest && exifPresent ? h.distanceM({ lat: data.exifLat!, lng: data.exifLng! }, dest) : null;

    const gpsState =
      gpsDistance == null ? "PENDING" : gpsDistance <= cfg.evidence_gps_radius_m ? "GPS_VERIFIED" : "GPS_FAILED";
    const exifState = !exifPresent
      ? "EXIF_UNAVAILABLE"
      : exifDistance != null && exifDistance <= cfg.evidence_gps_radius_m
        ? "EXIF_VERIFIED"
        : "EXIF_MISMATCH";

    // Hard rule: live worker GPS outside the configured evidence radius is NOT
    // accepted as completion evidence. Nothing is uploaded or recorded as
    // evidence; the worker must recapture at the complaint location.
    if (gpsState === "GPS_FAILED") {
      await h.logEvent(
        sb,
        complaint.id,
        "gps_failed",
        worker.display_name,
        `Evidence capture rejected: worker GPS was ${Math.round(gpsDistance!)} m from the complaint point (allowed ${cfg.evidence_gps_radius_m} m).`,
      );
      throw new Error(
        `Evidence must be captured at the complaint location. You are ${Math.round(gpsDistance!)} m away (allowed ${cfg.evidence_gps_radius_m} m). Please recapture on site.`,
      );
    }
    if (gpsState === "PENDING") {
      throw new Error("This complaint has no recorded location, so evidence cannot be geo-verified. Contact your officer.");
    }

    const { bytes, mime } = h.decodeDataUrl(data.imageDataUrl);
    const ext = mime.includes("png") ? "png" : "jpg";
    const path = `${complaint.id}/${assignment.id}-${Date.now()}.${ext}`;
    const upload = await sb.storage.from("evidence").upload(path, bytes, { contentType: mime, upsert: false });
    if (upload.error) throw new Error(`Evidence upload failed: ${upload.error.message}`);

    const verdict = await h.analyseEvidenceImage({
      dataUrl: data.imageDataUrl,
      title: complaint.title,
      description: complaint.description ?? "",
      category: complaint.category ?? "",
    });
    // A Gemini outage must never reject otherwise valid evidence — it falls
    // through to plain officer review instead.
    const aiState = !verdict
      ? "AI_REVIEW_UNAVAILABLE"
      : verdict.relevance === "relevant"
        ? "AI_VERIFIED"
        : "AI_FLAGGED";

    const { data: evidence, error } = await sb
      .from("complaint_evidence")
      .insert({
        complaint_id: complaint.id,
        assignment_id: assignment.id,
        worker_id: worker.id,
        image_path: path,
        description: data.description,
        worker_lat: data.workerLat,
        worker_lng: data.workerLng,
        exif_lat: data.exifLat ?? null,
        exif_lng: data.exifLng ?? null,
        gps_distance_m: gpsDistance,
        exif_distance_m: exifDistance,
        gps_state: gpsState,
        exif_state: exifState,
        ai_state: aiState,
        ai_relevance: verdict?.relevance ?? null,
        ai_confidence: verdict?.confidence ?? null,
        ai_observed_issue: verdict?.observed_issue ?? null,
        ai_explanation: verdict?.explanation ?? null,
      })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);

    await sb
      .from("complaint_assignments")
      .update({ stage: "evidence_submitted", completed_at: new Date().toISOString() })
      .eq("id", assignment.id);
    await h.moveComplaint(sb, complaint.id, "evidence_submitted");
    await h.moveComplaint(sb, complaint.id, "officer_review");
    await h.logEvent(
      sb,
      complaint.id,
      "evidence_uploaded",
      worker.display_name,
      `Evidence uploaded. GPS ${gpsState}${gpsDistance != null ? ` (${Math.round(gpsDistance)} m)` : ""}, EXIF ${exifState}, AI ${aiState}.`,
    );
    await h.notify(sb, [assignment.officer_id], "workflow", "Evidence awaiting verification", `Completion evidence submitted for "${complaint.title}".`);
    if (exifState === "EXIF_MISMATCH") {
      await h.notify(sb, [assignment.officer_id], "workflow", "Photo GPS mismatch", `Photo EXIF GPS for "${complaint.title}" is outside the allowed radius although live worker GPS passed.`);
    }
    if (aiState === "AI_FLAGGED") {
      await h.notify(sb, [assignment.officer_id], "workflow", "AI flagged evidence", `AI could not match the photo to "${complaint.title}". Manual review required.`);
    }
    await h.notify(sb, [complaint.author_id], "workflow", "Work completed", `A worker submitted completion evidence for "${complaint.title}".`);
    return evidence;
  });

/** Officer verification queue with signed, short-lived evidence image links. */
export const officerEvidenceQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    if (!(await h.isOfficer(sb, context.userId))) throw new Error("Officer access required.");
    const { data: rows } = await sb
      .from("complaint_evidence")
      .select("*")
      .eq("officer_state", "PENDING")
      .order("created_at", { ascending: false })
      .limit(30);
    const items = [];
    for (const e of rows ?? []) {
      const [{ data: complaint }, { data: worker }, signed] = await Promise.all([
        sb.from("complaints").select("id,title,description,category,priority,lat,lng,street_address,ward_id,author_pseudonym,created_at").eq("id", e.complaint_id).maybeSingle(),
        sb.from("workers").select("id,display_name,department").eq("id", e.worker_id).maybeSingle(),
        sb.storage.from("evidence").createSignedUrl(e.image_path, 900),
      ]);
      items.push({ evidence: e, complaint, worker, imageUrl: signed.data?.signedUrl ?? null });
    }
    return items;
  });

export const officerDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        evidenceId: z.string().uuid(),
        approve: z.boolean(),
        reason: z.string().max(600).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    if (!(await h.isOfficer(sb, context.userId))) throw new Error("Officer access required.");
    if (!data.approve && !data.reason?.trim()) throw new Error("A rejection reason is required.");

    const { data: evidence } = await sb.from("complaint_evidence").select("*").eq("id", data.evidenceId).maybeSingle();
    if (!evidence) throw new Error("Evidence not found.");
    const { data: complaint } = await sb
      .from("complaints")
      .select("id,title,author_id")
      .eq("id", evidence.complaint_id)
      .maybeSingle();
    if (!complaint) throw new Error("Complaint not found.");
    const { data: worker } = await sb.from("workers").select("user_id,display_name").eq("id", evidence.worker_id).maybeSingle();

    await sb
      .from("complaint_evidence")
      .update({
        officer_state: data.approve ? "OFFICER_APPROVED" : "OFFICER_REJECTED",
        officer_id: context.userId,
        officer_reason: data.reason ?? null,
        officer_decided_at: new Date().toISOString(),
      })
      .eq("id", evidence.id);

    if (data.approve) {
      const cfg = await h.loadConfig(sb);
      const deadline = new Date(Date.now() + cfg.citizen_window_hours * 3_600_000).toISOString();
      await h.moveComplaint(sb, complaint.id, "officer_approved");
      await h.moveComplaint(sb, complaint.id, "citizen_verification");
      await sb.from("citizen_verifications").insert({
        complaint_id: complaint.id,
        evidence_id: evidence.id,
        citizen_id: complaint.author_id,
        deadline_at: deadline,
      });
      await h.logEvent(sb, complaint.id, "officer_approved", "Officer", "Evidence approved. Citizen verification window opened.");
      await h.notify(sb, [complaint.author_id], "workflow", "Please confirm resolution", `Has your issue "${complaint.title}" been resolved? Please respond within ${cfg.citizen_window_hours} hours.`);
      await h.notify(sb, [worker?.user_id], "workflow", "Evidence approved", `Your evidence for "${complaint.title}" was approved.`);
    } else {
      await h.moveComplaint(sb, complaint.id, "in_progress");
      if (evidence.assignment_id) {
        await sb.from("complaint_assignments").update({ stage: "in_progress" }).eq("id", evidence.assignment_id);
      }
      await h.logEvent(sb, complaint.id, "officer_rejected", "Officer", `Evidence rejected: ${data.reason}`);
      await h.notify(sb, [worker?.user_id], "workflow", "Evidence rejected", `Rework required for "${complaint.title}": ${data.reason}`);
    }
    return { ok: true };
  });

/** Pending citizen verification requests for the signed-in citizen. */
export const myVerificationRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const { data: rows } = await sb
      .from("citizen_verifications")
      .select("*")
      .eq("citizen_id", context.userId)
      .eq("decision", "pending")
      .order("opened_at", { ascending: false })
      .limit(10);
    const items = [];
    for (const v of rows ?? []) {
      const [{ data: complaint }, evidence] = await Promise.all([
        sb.from("complaints").select("id,title,description,category").eq("id", v.complaint_id).maybeSingle(),
        v.evidence_id
          ? sb.from("complaint_evidence").select("id,image_path,description,created_at").eq("id", v.evidence_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const signed = evidence.data?.image_path
        ? await sb.storage.from("evidence").createSignedUrl(evidence.data.image_path, 900)
        : null;
      items.push({ verification: v, complaint, evidence: evidence.data ?? null, imageUrl: signed?.data?.signedUrl ?? null });
    }
    return items;
  });

export const citizenDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        verificationId: z.string().uuid(),
        satisfied: z.boolean(),
        reason: z.string().max(800).optional(),
        photoDataUrl: z.string().max(9_000_000).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        accuracyM: z.number().min(0).max(100_000).optional(),
        locationUnavailable: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const cfg = await h.loadConfig(sb);
    const { data: verification } = await sb
      .from("citizen_verifications")
      .select("*")
      .eq("id", data.verificationId)
      .maybeSingle();
    if (!verification || verification.citizen_id !== context.userId) throw new Error("Verification request not found.");
    if (verification.decision !== "pending") throw new Error("This verification has already been answered.");
    if (!data.satisfied && !data.reason?.trim()) throw new Error("Please describe what is still unresolved.");

    const { data: complaint } = await sb
      .from("complaints")
      .select("id,title,lat,lng")
      .eq("id", verification.complaint_id)
      .maybeSingle();

    // ---- Citizen GPS verification (deterministic, never AI) ----
    const hasFix = typeof data.lat === "number" && typeof data.lng === "number";
    const complaintHasFix = typeof complaint?.lat === "number" && typeof complaint?.lng === "number";
    let gpsState: "PENDING" | "CITIZEN_GPS_VERIFIED" | "CITIZEN_GPS_FLAGGED" | "LOCATION_UNAVAILABLE" = "PENDING";
    let distance: number | null = null;
    const radius = (cfg as Record<string, number>)["citizen_evidence_radius_m"] ?? 150;

    if (!data.satisfied) {
      if (!hasFix) {
        if (!data.locationUnavailable) {
          throw new Error("Location permission is required to verify this evidence.");
        }
        gpsState = "LOCATION_UNAVAILABLE";
      } else if (!complaintHasFix) {
        gpsState = "LOCATION_UNAVAILABLE";
      } else {
        distance = h.distanceM(
          { lat: data.lat as number, lng: data.lng as number },
          { lat: complaint!.lat as number, lng: complaint!.lng as number },
        );
        gpsState = distance <= radius ? "CITIZEN_GPS_VERIFIED" : "CITIZEN_GPS_FLAGGED";
      }
    }

    let photoPath: string | null = null;
    if (!data.satisfied && data.photoDataUrl) {
      const { bytes, mime } = h.decodeDataUrl(data.photoDataUrl);
      photoPath = `${verification.complaint_id}/citizen-${Date.now()}.${mime.includes("png") ? "png" : "jpg"}`;
      const up = await sb.storage.from("evidence").upload(photoPath, bytes, { contentType: mime });
      if (up.error) photoPath = null;
    }

    await sb
      .from("citizen_verifications")
      .update({
        decision: data.satisfied ? "satisfied" : "not_satisfied",
        reason: data.reason ?? null,
        photo_path: photoPath,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        accuracy_m: data.accuracyM ?? null,
        complaint_lat: complaint?.lat ?? null,
        complaint_lng: complaint?.lng ?? null,
        distance_m: distance,
        gps_state: gpsState,
        decided_at: new Date().toISOString(),
      })
      .eq("id", verification.id);

    const { data: assignment } = await sb
      .from("complaint_assignments")
      .select("officer_id")
      .eq("complaint_id", verification.complaint_id)
      .eq("active", true)
      .maybeSingle();

    if (data.satisfied) {
      await h.moveComplaint(sb, verification.complaint_id, "resolved_by_citizen", { complainant_approved: true });
      await h.logEvent(sb, verification.complaint_id, "citizen_satisfied", "Citizen", "Citizen confirmed the issue is resolved.");
      await h.notify(sb, [assignment?.officer_id], "workflow", "Complaint resolved", `Citizen confirmed resolution of "${complaint?.title ?? "complaint"}".`);
    } else {
      await h.moveComplaint(sb, verification.complaint_id, "reopened", { complainant_approved: false });
      await h.moveComplaint(sb, verification.complaint_id, "officer_review");
      await h.logEvent(sb, verification.complaint_id, "citizen_rejected", "Citizen", `Citizen not satisfied: ${data.reason}`);
      // Audit the location outcome without publishing raw coordinates.
      if (gpsState === "CITIZEN_GPS_VERIFIED") {
        await h.logEvent(sb, verification.complaint_id, "citizen_gps_verified", "System", `Citizen evidence location verified (${Math.round(distance ?? 0)} m from the complaint location, radius ${radius} m).`);
      } else if (gpsState === "CITIZEN_GPS_FLAGGED") {
        await h.logEvent(sb, verification.complaint_id, "citizen_gps_flagged", "System", `Citizen evidence location outside the configured radius (${Math.round(distance ?? 0)} m vs ${radius} m). Flagged for officer review.`);
      } else {
        await h.logEvent(sb, verification.complaint_id, "citizen_location_unavailable", "System", "Citizen location was unavailable. Submission accepted as LOCATION_UNAVAILABLE and requires officer review.");
      }
      await h.logEvent(sb, verification.complaint_id, "complaint_reopened", "Citizen", "Complaint reopened for officer review after citizen rejection.");
      await h.notify(
        sb,
        [assignment?.officer_id],
        "workflow",
        gpsState === "CITIZEN_GPS_VERIFIED" ? "Complaint reopened" : "Complaint reopened — location review needed",
        `Citizen rejected resolution of "${complaint?.title ?? "complaint"}": ${data.reason} (location check: ${gpsState})`,
      );
    }
    return { ok: true, gpsState, distanceM: distance, radiusM: radius };
  });

/** Nearby unresolved complaints around the worker's live position (never auto-assigned). */
export const nearbyComplaints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    Coords.extend({
      excludeId: z.string().uuid().nullable().optional(),
      radiusM: z.number().min(50).max(5000).optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const { data: worker } = await sb
      .from("workers")
      .select("id,department")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!worker) throw new Error("Worker profile required.");
    const cfg = await h.loadConfig(sb);
    const { data: rows, error } = await sb.rpc("nearby_unresolved_complaints", {
      _lat: data.lat,
      _lng: data.lng,
      _radius_m: data.radiusM ?? cfg.nearby_radius_m,
      _exclude: data.excludeId ?? null,
      _category: null,
    });
    if (error) throw new Error(error.message);
    // Department scoping: general-purpose crews see everything, specialists see their own category.
    const scoped =
      worker.department && worker.department !== "general"
        ? (rows ?? []).filter((r: { category: string }) => r.category === worker.department)
        : (rows ?? []);
    return scoped;
  });

/** Worker opts in to a nearby complaint — explicit, never automatic. */
export const acceptNearbyComplaint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ complaintId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const { data: worker } = await sb.from("workers").select("id,display_name").eq("user_id", context.userId).maybeSingle();
    if (!worker) throw new Error("Worker profile required.");
    const { data: complaint } = await sb
      .from("complaints")
      .select("id,title,author_id,lat,lng,sla_hours,status")
      .eq("id", data.complaintId)
      .maybeSingle();
    if (!complaint) throw new Error("Complaint not found.");
    const { data: existing } = await sb
      .from("complaint_assignments")
      .select("id")
      .eq("complaint_id", complaint.id)
      .eq("active", true)
      .maybeSingle();
    if (existing) throw new Error("This complaint already has an active assignment.");

    const { data: assignment, error } = await sb
      .from("complaint_assignments")
      .insert({
        complaint_id: complaint.id,
        worker_id: worker.id,
        officer_id: context.userId,
        sla_deadline: new Date(Date.now() + (complaint.sla_hours ?? 24) * 3_600_000).toISOString(),
        dest_lat: complaint.lat,
        dest_lng: complaint.lng,
        stage: "worker_accepted",
        accepted_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    await h.moveComplaint(sb, complaint.id, "assigned", { assigned_officer: worker.display_name });
    await h.moveComplaint(sb, complaint.id, "worker_accepted");
    await h.logEvent(sb, complaint.id, "worker_accepted", worker.display_name, "Worker picked up this nearby task voluntarily.");
    await h.notify(sb, [complaint.author_id], "workflow", "Worker assigned", `A nearby worker picked up "${complaint.title}".`);
    return assignment;
  });

/** Read-only workflow snapshot for a complaint (tracking page / dashboard). */
export const complaintWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ complaintId: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const { data: assignment } = await sb
      .from("complaint_assignments")
      .select("id,stage,assigned_at,sla_deadline,accepted_at,travel_started_at,arrived_at,work_started_at,completed_at,last_distance_m,last_ping_at,worker_id")
      .eq("complaint_id", data.complaintId)
      .eq("active", true)
      .maybeSingle();
    const { data: worker } = assignment
      ? await sb.from("workers").select("display_name,department").eq("id", assignment.worker_id).maybeSingle()
      : { data: null };
    const { data: evidence } = await sb
      .from("complaint_evidence")
      .select("id,gps_state,exif_state,ai_state,officer_state,ai_relevance,ai_explanation,gps_distance_m,created_at")
      .eq("complaint_id", data.complaintId)
      .order("created_at", { ascending: false })
      .limit(5);
    // Worker identity is limited to name + department; no live coordinates are exposed.
    return {
      assignment: assignment ? { ...assignment, worker_id: undefined } : null,
      worker: worker ?? null,
      evidence: evidence ?? [],
    };
  });
