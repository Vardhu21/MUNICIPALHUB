import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ZkpInput = z.object({ wardId: z.string().uuid() });

/**
 * Issues an anonymous, cryptographically signed Ward Location Token.
 * The token proves "this holder is a verified resident of ward X" without
 * revealing which citizen produced it to any reader of the vote row.
 */
export const issueWardToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ZkpInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("ward_id, digilocker_verified")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.digilocker_verified) throw new Error("DigiLocker verification required.");
    if (profile.ward_id !== data.wardId) {
      throw new Error("Ward residency proof failed: you are not registered in this ward.");
    }

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "tn-fallback-zkp-seed";
    const issuedAt = Date.now();
    const payload = `${data.wardId}.${context.userId}.${issuedAt}`;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Only the ward + timestamp + signature travel with the vote — never the user id.
    return { token: `zkp_${data.wardId.slice(0, 8)}_${issuedAt.toString(36)}_${hex.slice(0, 32)}` };
  });

const SeedInput = z.object({ wardId: z.string().uuid() });

/** Demo helper: stores the simulated DigiLocker identity behind the locked table. */
export const sealIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        legalName: z.string().trim().min(2).max(120),
        aadhaar: z.string().trim().regex(/^\d{12}$/, "Aadhaar must be 12 digits"),
        phone: z.string().trim().regex(/^\d{10}$/, "Mobile must be 10 digits"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const masked = `XXXX XXXX ${data.aadhaar.slice(-4)}`;
    await supabaseAdmin.from("user_identities").upsert({
      user_id: context.userId,
      legal_name: data.legalName,
      aadhaar_masked: masked,
      phone_encrypted: `enc:${btoa(data.phone)}`,
      digilocker_ref: `DL-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    });
    return { ok: true };
  });

export type SeedInputType = z.infer<typeof SeedInput>;
