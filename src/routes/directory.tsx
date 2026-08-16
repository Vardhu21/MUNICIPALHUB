import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { VoiceAssistant } from "@/components/VoiceAssistantLazy";
import { WardAuthorityCard } from "@/components/WardAuthorityCard";
import { EmblemLoader } from "@/components/EmblemLoader";
import { useLang } from "@/lib/i18n";
import { fetchDirectoryWards, fetchUlbs, fetchZones, type DirectoryWard, type Ulb, type Zone } from "@/lib/directory";

export const Route = createFileRoute("/directory")({
  head: () => ({
    meta: [
      { title: "Ward & Councillor Directory — TN SmartMunicipality" },
      {
        name: "description",
        content:
          "Browse the official Greater Chennai Corporation hierarchy: corporation, zones, all 200 wards and their ward councillors with official contacts.",
      },
      { property: "og:title", content: "Ward & Councillor Directory — TN SmartMunicipality" },
      {
        property: "og:description",
        content: "Official ULB → Zone → Ward → Councillor directory sourced from the GCC dataset.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DirectoryPage,
});

function DirectoryPage() {
  const { lang } = useLang();
  const [ulbs, setUlbs] = useState<Ulb[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [wards, setWards] = useState<DirectoryWard[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<DirectoryWard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchUlbs(), fetchZones(), fetchDirectoryWards()])
      .then(([u, z, w]) => {
        setUlbs(u);
        setZones(z);
        setWards(w);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return wards.filter(
      (w) =>
        (!zoneId || w.zone_id === zoneId) &&
        (!needle ||
          String(w.ward_number) === needle ||
          w.ward_name_en.toLowerCase().includes(needle) ||
          w.ward_name_ta.includes(q.trim())),
    );
  }, [wards, zoneId, q]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <div>
          <h1 className="text-xl font-bold">
            {lang === "ta" ? "வார்டு & கவுன்சிலர் அடைவு" : "Ward & councillor directory"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ta"
              ? "மாநகராட்சி → மண்டலம் → வார்டு → கவுன்சிலர் — அதிகாரப்பூர்வ பதிவுகள்."
              : "Corporation → Zone → Ward → Councillor, from the official records."}
          </p>
          {ulbs[0] && (
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "ta" ? ulbs[0].ulb_name_tamil : ulbs[0].ulb_name} · {zones.length}{" "}
              {lang === "ta" ? "மண்டலங்கள்" : "zones"} · {wards.length} {lang === "ta" ? "வார்டுகள்" : "wards"}
            </p>
          )}
        </div>

        <section className="civic-card space-y-3 p-4">
          <label className="flex items-center gap-2 rounded-full border border-input bg-background px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={lang === "ta" ? "வார்டு எண் அல்லது பெயர்" : "Ward number or name"}
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">{lang === "ta" ? "எல்லா மண்டலங்களும்" : "All zones"}</option>
            {zones.map((z) => (
              <option key={z.zone_id} value={z.zone_id} className="bg-card">
                {z.zone_number} · {z.zone_name}
              </option>
            ))}
          </select>
        </section>

        {loading ? (
          <EmblemLoader />
        ) : (
          <>
            {selected && <WardAuthorityCard ward={selected} />}
            <section className="civic-card divide-y divide-border overflow-hidden">
              {filtered.slice(0, 60).map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelected(w)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-secondary/60 ${
                    selected?.id === w.id ? "bg-secondary/60" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <strong>{lang === "ta" ? `வார்டு ${w.ward_number}` : `Ward ${w.ward_number}`}</strong>{" "}
                    <span className="text-muted-foreground">{lang === "ta" ? w.ward_name_ta : w.ward_name_en}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{w.ward_ref}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {lang === "ta" ? "பொருந்தும் வார்டு இல்லை." : "No matching ward."}
                </p>
              )}
            </section>
            {filtered.length > 60 && (
              <p className="text-center text-xs text-muted-foreground">
                {lang === "ta"
                  ? `${filtered.length} இல் 60 காட்டப்படுகிறது — தேடலைக் குறுக்குங்கள்.`
                  : `Showing 60 of ${filtered.length} — refine the search.`}
              </p>
            )}
          </>
        )}
      </main>
      <VoiceAssistant />
    </div>
  );
}
