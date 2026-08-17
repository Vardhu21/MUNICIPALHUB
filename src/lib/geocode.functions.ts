import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Reverse-geocodes a GPS fix to a street address through the Google Maps gateway. */
export const reverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const lovableKey = process.env['LOVABLE_API_KEY'];
    const mapsKey = process.env['GOOGLE_MAPS_API_KEY'];
    if (!lovableKey || !mapsKey) throw new Error("Google Maps connector is not configured.");

    const res = await fetch(
      `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?latlng=${data.lat},${data.lng}`,
      {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": mapsKey,
        },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Geocoding failed [${res.status}]: ${body}`);
    }

    const payload = (await res.json()) as {
      status?: string;
      results?: Array<{ formatted_address?: string }>;
    };
    if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
      throw new Error(`Geocoding failed: ${payload.status}`);
    }

    return { address: payload.results?.[0]?.formatted_address ?? null };
  });