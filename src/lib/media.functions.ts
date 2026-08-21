import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Uploads a citizen's geotagged complaint photo into the private `evidence`
 * bucket and returns a long-lived signed URL. Photos are never stored as
 * base64 in the database row.
 */
export const uploadComplaintPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ imageDataUrl: z.string().min(64).max(9_000_000) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const h = await import("./workflow.server");
    const sb = await h.admin();
    const { bytes, mime } = h.decodeDataUrl(data.imageDataUrl);
    const ext = mime.includes("png") ? "png" : "jpg";
    const path = `complaints/${context.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await sb.storage.from("evidence").upload(path, bytes, { contentType: mime, upsert: false });
    if (up.error) throw new Error(`Photo upload failed: ${up.error.message}`);
    const signed = await sb.storage.from("evidence").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signed.error || !signed.data) throw new Error("Could not create a link for the uploaded photo.");
    return { path, url: signed.data.signedUrl };
  });
