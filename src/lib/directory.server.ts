import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Retrieval layer for the civic assistant: pulls only the handful of official
 * directory rows a question actually needs, so the model is grounded in the
 * database instead of a giant prompt dump of the whole dataset.
 */
function client() {
  return createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

const DIRECTORY_INTENT =
  /(ward|வார்டு|councillor|counciler|கவுன்சிலர்|zone|மண்டல|mayor|மேயர்|commissioner|ஆணையர்|corporation|மாநகராட்சி|municipality|நகராட்சி|office|contact|தொடர்பு|email|phone)/i;

export async function lookupDirectory(question: string): Promise<string | null> {
  if (!DIRECTORY_INTENT.test(question)) return null;
  const sb = client();
  const lines: string[] = [];

  const numMatch = question.match(/(?:ward|வார்டு)\s*(?:no\.?|number|#)?\s*(\d{1,3})/i) ?? question.match(/\b(\d{1,3})\b/);
  const wardNumber = numMatch ? Number(numMatch[1]) : null;

  if (wardNumber && wardNumber >= 1 && wardNumber <= 200) {
    const { data: ward } = await sb
      .from("wards")
      .select("ward_ref,ward_number,ward_name_en,ward_name_ta,zone_id,ulb_id,official_ward_email,ward_status,official_source")
      .eq("ward_number", wardNumber)
      .not("ward_ref", "is", null)
      .maybeSingle();
    if (ward) {
      const [{ data: zone }, { data: ulb }, { data: councillor }] = await Promise.all([
        sb.from("zones").select("zone_number,zone_name").eq("zone_id", ward.zone_id ?? "").maybeSingle(),
        sb.from("ulbs").select("ulb_name,ulb_name_tamil,district,state").eq("ulb_id", ward.ulb_id ?? "").maybeSingle(),
        sb
          .from("councillors")
          .select("name,designation,official_contact_phone,official_contact_email,status")
          .eq("ward_ref", ward.ward_ref!)
          .maybeSingle(),
      ]);
      lines.push(
        `WARD ${ward.ward_number} (${ward.ward_ref}): ${ward.ward_name_en} / ${ward.ward_name_ta}; status ${ward.ward_status}; ward email ${ward.official_ward_email ?? "not on record"}`,
        `ZONE: ${zone ? `Zone ${zone.zone_number} — ${zone.zone_name}` : "not on record"}`,
        `ULB: ${ulb ? `${ulb.ulb_name} (${ulb.ulb_name_tamil}), ${ulb.district}, ${ulb.state}` : "not on record"}`,
        `COUNCILLOR: ${
          councillor
            ? `${councillor.name?.trim() || "name not on record"} — ${councillor.designation}; phone ${councillor.official_contact_phone ?? "not on record"}; email ${councillor.official_contact_email ?? "not on record"}; status ${councillor.status}`
            : "no councillor record for this ward"
        }`,
        `SOURCE: ${ward.official_source ?? "official GCC dataset"}`,
      );
    } else {
      lines.push(`No ward numbered ${wardNumber} exists in the directory.`);
    }
  }

  if (/zone|மண்டல/i.test(question) && !wardNumber) {
    const { data: zones } = await sb.from("zones").select("zone_number,zone_name").order("zone_number");
    if (zones?.length)
      lines.push(`ZONES (${zones.length}): ${zones.map((z) => `${z.zone_number}=${z.zone_name}`).join(", ")}`);
  }

  if (/mayor|மேயர்|commissioner|ஆணையர்|leadership/i.test(question)) {
    // Only official office contacts are shared; personal mobile numbers stay private.
    const { data: leaders } = await sb.from("ulb_leadership").select("role,name,office_phone,email");
    if (leaders?.length)
      lines.push(
        `LEADERSHIP: ${leaders
          .map((l) => `${l.role} — ${l.name}${l.office_phone ? `, ${l.office_phone}` : ""}${l.email ? `, ${l.email}` : ""}`)
          .join(" | ")}`,
      );
  }

  if (/corporation|மாநகராட்சி|municipality|நகராட்சி|ulb/i.test(question) && !wardNumber) {
    const { data: ulbs } = await sb.from("ulbs").select("ulb_name,ulb_name_tamil,ulb_type,district,state");
    if (ulbs?.length)
      lines.push(`ULBS: ${ulbs.map((u) => `${u.ulb_name} (${u.ulb_name_tamil}), ${u.ulb_type}, ${u.district}`).join(" | ")}`);
  }

  return lines.length ? lines.join("\n") : null;
}
