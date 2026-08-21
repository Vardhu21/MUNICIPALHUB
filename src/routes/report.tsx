import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, MapPin, ShieldAlert } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { GeoCamera, type Capture } from "@/components/GeoCamera";
import { VoiceAssistant } from "@/components/VoiceAssistantLazy";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useGeolocation } from "@/lib/useGeolocation";
import { CATEGORIES, slaHoursFor, slaRow } from "@/lib/sla";
import { BAND_LABEL, BAND_TONE, triage } from "@/lib/triage";
import { fetchWards, logEvent, officerForTier, resolveWard, ULB_LABEL, type Ward } from "@/lib/data";
import { WardAuthorityCard } from "@/components/WardAuthorityCard";
import { GpsMap } from "@/components/GpsMap";
import { reverseGeocode } from "@/lib/geocode.functions";
import {
  fetchCouncillorForWard,
  fetchDirectoryWards,
  fetchZones,
  type DirectoryWard,
  type Zone,
} from "@/lib/directory";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a Civic Issue — TN SmartMunicipality" },
      {
        name: "description",
        content:
          "Submit a grievance with a live anti-spoofing geotagged camera capture, auto-resolved ward routing and an SLA-bound officer assignment.",
      },
      { property: "og:title", content: "Report a Civic Issue — TN SmartMunicipality" },
      {
        property: "og:description",
        content: "Live hardware capture only — gallery uploads and mock locations are rejected.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const { user } = useSession();
  const { fix } = useGeolocation(true);
  const [wards, setWards] = useState<Ward[]>([]);
  const [dirWards, setDirWards] = useState<DirectoryWard[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [manualWardId, setManualWardId] = useState("");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [categoryId, setCategoryId] = useState(CATEGORIES[4].id);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [street, setStreet] = useState("");
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const point = capture ?? fix;

  useEffect(() => {
    fetchWards().then(setWards).catch(() => undefined);
    fetchDirectoryWards().then(setDirWards).catch(() => undefined);
    fetchZones().then(setZones).catch(() => undefined);
  }, []);

  const geoWard = useMemo(() => resolveWard(wards, capture ?? fix), [wards, capture, fix]);
  const ward = useMemo(
    () => (manualWardId ? (wards.find((w) => w.id === manualWardId) ?? geoWard) : geoWard),
    [manualWardId, wards, geoWard],
  );
  /** Official directory record behind the routed ward (zone, councillor, source). */
  const directoryWard = useMemo(
    () => dirWards.find((w) => w.id === ward?.id) ?? null,
    [dirWards, ward],
  );
  const zoneName = useMemo(
    () => zones.find((z) => z.zone_id === directoryWard?.zone_id)?.zone_name ?? null,
    [zones, directoryWard],
  );
  
  // Priority is never chosen by the citizen — it is derived from a health-impact score.
  const assessment = useMemo(
    () => triage({ category: categoryId, title, description }),
    [categoryId, title, description],
  );
  const sla = slaRow(assessment.priority);
  // Escalation window comes from the complaint category (garbage 4h, water 2h, ...),
  // not a flat 24h clock.
  const slaHours = slaHoursFor(categoryId, assessment.priority);

  /** Auto-fill the street address from the captured/live GPS point. */
  useEffect(() => {
    if (!capture || street.trim()) return;
    let cancelled = false;
    setGeoBusy(true);
    reverseGeocode({ data: { lat: capture.lat, lng: capture.lng } })
      .then((r) => {
        if (!cancelled && r.address) setStreet(r.address);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setGeoBusy(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture]);


  const submit = async () => {
    if (!user) return toast.error(t("report.error.signInRequired"));
    if (!capture) return toast.error(t("report.error.captureRequired"));
    if (title.trim().length < 6) return toast.error(t("report.error.titleMin"));
    if (description.trim().length < 12) return toast.error(t("report.error.descriptionMin"));

    setBusy(true);
    try {
      let { data: profile } = await supabase
        .from("profiles")
        .select("pseudonym, digilocker_verified, frozen")
        .eq("id", user.id)
        .maybeSingle();

      // Self-heal: an authenticated account without a profile row (e.g. created
      // before profiles existed) gets one here instead of being blocked.
      if (!profile) {
        const fallbackPseudonym = `@${(user.email ?? "citizen").split("@")[0]}`.slice(0, 40);
        const { data: created, error: createError } = await supabase
          .from("profiles")
          .insert({ id: user.id, pseudonym: fallbackPseudonym, digilocker_verified: true })
          .select("pseudonym, digilocker_verified, frozen")
          .maybeSingle();
        if (createError) throw new Error(createError.message);
        profile = created;
      }

      if (!profile) throw new Error(t("report.error.digilockerRequired"));
      if (profile.frozen) throw new Error(t("report.error.accountFrozen"));


      const { data, error } = await supabase
        .from("complaints")
        .insert({
          author_id: user.id,
          author_pseudonym: profile.pseudonym,
          title: title.trim(),
          description: description.trim(),
          category: categoryId,
          priority: assessment.priority,
          status: "assigned",
          current_tier: "field",
          sla_hours: slaHours,
          assigned_officer: officerForTier("field"),
          ward_id: ward?.id ?? null,
          lat: capture.lat,
          lng: capture.lng,
          street_address: street.trim() || null,
          photo_url: capture.dataUrl,
          captured_at: capture.capturedAt,
          geo_verified: capture.geoVerified,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const councillor = await fetchCouncillorForWard(directoryWard?.ward_ref ?? null).catch(() => null);
        await logEvent(
          data.id,
          "assignment",
          "Dynamic Spatial Router",
          `Reverse-geocoded to ${ward ? `Ward ${ward.ward_number}, ${ward.ulb_name_en}` : "nearest ULB"} · assigned to ${sla.fieldTier.en} with a ${slaHours}h SLA.`,
        );
        if (directoryWard) {
          await logEvent(
            data.id,
            "routing",
            "Authority Directory",
            `Routed to ${directoryWard.ward_ref}${zoneName ? ` · ${zoneName}` : ""} · councillor ${
              councillor?.name?.trim() || "not on record"
            }${councillor?.official_contact_email ? ` (${councillor.official_contact_email})` : ""}.`,
          );
        }
      }
      toast.success(t("report.toast.published"));
      navigate({ to: "/feed" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("report.error.submissionFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <div>
          <h1 className="text-xl font-bold">{t("report.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("report.subtitle")}</p>
        </div>

        <section className="civic-card space-y-3 p-4">
          {capture ? (
            <div className="space-y-3">
              <img
                src={capture.dataUrl}
                alt="Geotagged evidence"
                className="w-full rounded-lg border border-success/50"
              />
              <p className="flex items-center gap-2 text-xs font-semibold text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                {t("report.captureAccepted")} · {capture.lat.toFixed(6)}, {capture.lng.toFixed(6)}
              </p>
              <button
                onClick={() => setCapture(null)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold"
              >
                {t("report.retakeCapture")}
              </button>
            </div>
          ) : (
            <GeoCamera
              wardLabel={
                ward ? `Ward ${ward.ward_number} · ${ward.ward_name_en}` : t("report.wardResolvingGps")
              }
              zoneLabel={ward ? `${ward.ulb_name_en} · ${ward.zone}` : t("report.zoneResolving")}
              onCapture={setCapture}
            />
          )}
        </section>

        <section className="civic-card space-y-3 p-4">
          <div className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <strong className="block">{t("report.autoRouting")}</strong>
              {ward ? (
                <>
                  {lang === "ta" ? ward.ulb_name_ta : ward.ulb_name_en} ·{" "}
                  {ULB_LABEL[ward.ulb_type][lang]} · Ward {ward.ward_number} (
                  {lang === "ta" ? ward.ward_name_ta : ward.ward_name_en}) · {ward.zone}
                </>
              ) : (
                t("report.waitingGpsFix")
              )}
            </span>
          </div>

          <GpsMap
            lat={point?.lat ?? null}
            lng={point?.lng ?? null}
            accuracy={capture ? 15 : (fix?.accuracy ?? null)}
            label={ward ? `Ward ${ward.ward_number}` : "Complaint location"}
          />

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              {lang === "ta" ? "வார்டு (தேவைப்பட்டால் மாற்றவும்)" : "Ward (override if wrong)"}
            </span>
            <select
              value={manualWardId || (ward?.id ?? "")}
              onChange={(e) => setManualWardId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">{lang === "ta" ? "GPS தானியங்கி வழிமாற்று" : "Automatic GPS routing"}</option>
              {dirWards.map((w) => (
                <option key={w.id} value={w.id} className="bg-card">
                  {`Ward ${w.ward_number} · ${lang === "ta" ? w.ward_name_ta : w.ward_name_en}`}
                </option>
              ))}
            </select>
          </label>

          {directoryWard && <WardAuthorityCard ward={directoryWard} showLeadership={false} />}

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{t("report.category")}</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id} className="bg-card">
                  {lang === "ta" ? c.ta : c.en}
                </option>
              ))}
            </select>
          </label>

          <div className={`space-y-1.5 rounded-lg border p-3 text-xs ${BAND_TONE[assessment.band]}`}>
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-4 shrink-0" />
              {t("report.aiTriage")} · {BAND_LABEL[assessment.band][lang]} ({assessment.score}/100)
            </p>
            <ul className="ml-6 list-disc space-y-0.5 opacity-90">
              {assessment.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="opacity-80">
              {t("report.autoAssignedSla")} {slaHours}h SLA · {t("report.firstResponder")} {sla.fieldTier[lang]} · {t("report.escalatesTo")}{" "}
              {sla.escalateTo[lang]}. {t("report.autoAssignedNote")}
            </p>
          </div>


          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{t("report.titleLabel")}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{t("report.descriptionLabel")}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              {t("report.streetLabel")}
              {geoBusy ? " · locating…" : ""}
            </span>
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              maxLength={160}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <button
            onClick={submit}
            disabled={busy || !capture}
            className="w-full rounded-xl bg-success px-4 py-3 text-sm font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? t("report.publishing") : t("report.publishButton")}
          </button>
        </section>
      </main>
      <VoiceAssistant />
    </div>
  );
}
