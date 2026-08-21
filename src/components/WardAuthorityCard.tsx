import { useEffect, useState } from "react";
import { Building2, ExternalLink, Mail, MapPinned, Phone, UserRound } from "lucide-react";
import {
  fetchCouncillorForWard,
  fetchLeadership,
  fetchUlbForWard,
  fetchZoneById,
  sourceNote,
  type Councillor,
  type DirectoryWard,
  type Ulb,
  type UlbLeader,
  type Zone,
} from "@/lib/directory";
import { useLang } from "@/lib/i18n";

/**
 * Ward → Zone → Municipality → Councillor authority card. All values come from
 * the official directory records; missing records are shown as "not on record"
 * rather than being filled in with guesses.
 */
export function WardAuthorityCard({ ward, showLeadership = true }: { ward: DirectoryWard | null; showLeadership?: boolean }) {
  const { lang } = useLang();
  const [zone, setZone] = useState<Zone | null>(null);
  const [ulb, setUlb] = useState<Ulb | null>(null);
  const [councillor, setCouncillor] = useState<Councillor | null>(null);
  const [leaders, setLeaders] = useState<UlbLeader[]>([]);

  useEffect(() => {
    if (!ward) return;
    fetchZoneById(ward.zone_id).then(setZone).catch(() => undefined);
    fetchUlbForWard(ward.ulb_id).then(setUlb).catch(() => undefined);
    fetchCouncillorForWard(ward.ward_ref).then(setCouncillor).catch(() => undefined);
    if (showLeadership && ward.ulb_id) fetchLeadership(ward.ulb_id).then(setLeaders).catch(() => undefined);
  }, [ward, showLeadership]);

  if (!ward) return null;
  const missing = lang === "ta" ? "பதிவில் இல்லை" : "Not on record";
  const src = sourceNote(ward.official_source, ward.source_checked_at, lang);

  return (
    <section className="civic-card space-y-3 p-4">
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Building2 className="size-3.5" />
          {ulb ? (lang === "ta" ? ulb.ulb_name_tamil : ulb.ulb_name) : missing}
        </p>
        <h3 className="text-sm font-bold">
          {lang === "ta" ? `வார்டு ${ward.ward_number}` : `Ward ${ward.ward_number}`} ·{" "}
          {lang === "ta" ? ward.ward_name_ta : ward.ward_name_en}
        </h3>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MapPinned className="size-3" />
          {zone?.zone_name ?? missing}
          {ulb ? ` · ${ulb.district}, ${ulb.state}` : ""}
          {ward.ward_status !== "active" ? ` · ${ward.ward_status}` : ""}
        </p>
      </header>

      <div className="space-y-1.5 rounded-xl border border-border bg-secondary/40 p-3 text-[11px]">
        <p className="flex items-center gap-1.5 font-semibold">
          <UserRound className="size-3.5 text-primary" />
          {lang === "ta" ? "வார்டு கவுன்சிலர்" : "Ward councillor"}
        </p>
        <p>{councillor?.name?.trim() ? `${councillor.name} · ${councillor.designation}` : `${missing}${councillor ? ` (${councillor.designation})` : ""}`}</p>
        {councillor?.official_contact_phone && (
          <p className="flex items-center gap-1.5">
            <Phone className="size-3" />
            <a href={`tel:${councillor.official_contact_phone}`} className="text-primary underline">
              {councillor.official_contact_phone}
            </a>
          </p>
        )}
        <p className="flex items-center gap-1.5">
          <Mail className="size-3" />
          {councillor?.official_contact_email ?? ward.official_ward_email ? (
            <a
              href={`mailto:${councillor?.official_contact_email ?? ward.official_ward_email}`}
              className="text-primary underline"
            >
              {councillor?.official_contact_email ?? ward.official_ward_email}
            </a>
          ) : (
            missing
          )}
        </p>
      </div>

      {showLeadership && leaders.length > 0 && (
        <div className="space-y-1 rounded-xl border border-border p-3 text-[11px]">
          <p className="font-semibold">{lang === "ta" ? "மாநகராட்சி தலைமை" : "Corporation leadership"}</p>
          {leaders.map((l) => (
            <p key={l.authority_id}>
              <strong>{l.role}:</strong> {l.name}
              {l.office_phone ? ` · ${l.office_phone}` : ""}
              {l.email ? ` · ${l.email}` : ""}
            </p>
          ))}
        </div>
      )}

      {src && (
        <a
          href={src.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline"
        >
          <ExternalLink className="size-3" /> {src.label}
        </a>
      )}
    </section>
  );
}
