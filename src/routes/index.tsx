import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Radar, ShieldCheck, Timer } from "lucide-react";
import { Starfield } from "@/components/Starfield";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { useLang } from "@/lib/i18n";
import emblem from "@/assets/tn-emblem.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TN SmartMunicipality — Civic Escalation Portal" },
      {
        name: "description",
        content:
          "Geotagged grievance reporting with anonymous citizen identity, SLA-driven auto-escalation and transparent ward accountability for Tamil Nadu urban local bodies.",
      },
      { property: "og:title", content: "TN SmartMunicipality — Civic Escalation Portal" },
      {
        property: "og:description",
        content:
          "Report civic issues with tamper-proof geotagged evidence and watch the SLA escalation ladder work in real time.",
      },
    ],
  }),
  component: Portal,
});

function Portal() {
  const { t, lang, toggle } = useLang();
  const [zoomKey, setZoomKey] = useState(0);

  const replay = () => setZoomKey((k) => k + 1);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <Starfield className="pointer-events-none absolute inset-0 size-full" />
      <div
        key={`atmos-${zoomKey}`}
        className="animate-atmos-fade pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#6C4CE822,transparent_60%),radial-gradient(circle_at_50%_90%,#6C4CE814,transparent_55%)]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="min-w-0 truncate text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {t("maws")}
          </p>
          <button
            onClick={toggle}
            className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
          >
            {t("language")}
          </button>
        </div>

        <div className="grid flex-1 items-center gap-10 py-10">
          <div key={`copy-${zoomKey}`} className="animate-portal-zoom space-y-6 text-center lg:text-left">
            <button
              onClick={replay}
              className="mx-auto flex size-20 items-center justify-center rounded-2xl border border-border bg-card p-2 transition-transform hover:scale-105 lg:mx-0"
              aria-label="Replay portal animation"
            >
              <img src={emblem} alt="TN SmartMunicipality emblem" width={512} height={512} className="size-full object-contain" />
            </button>

            <div className="space-y-3">
              <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
                {t("appName")}
                <span className="mt-1 block bg-gradient-to-r from-primary to-success bg-clip-text text-2xl text-transparent sm:text-3xl">
                  {t("appTagline")}
                </span>
              </h1>
              <p className="mx-auto max-w-md text-sm text-muted-foreground lg:mx-0">
                {lang === "ta"
                  ? "செயற்கைக்கோள் பார்வையிலிருந்து உங்கள் தெரு வரை — புவிக்குறியிட்ட புகார்கள், அநாமதேய அடையாளம், தானியங்கி SLA மேல்முறையீடு."
                  : "From satellite view down to your street — tamper-proof geotagged grievances, pseudonymous citizen identity, and an SLA daemon that escalates on its own."}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {t("enterPortal")} <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/feed"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-accent"
              >
                {t("viewFeed")}
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, en: "Zero-knowledge identity", ta: "அடையாள மறைப்பு" },
                { icon: Radar, en: "Anti-spoof geotag camera", ta: "போலி எதிர்ப்பு கேமரா" },
                { icon: Timer, en: "Automatic SLA escalation", ta: "தானியங்கி SLA" },
              ].map((f) => (
                <div key={f.en} className="civic-card flex items-center gap-2 p-3 text-left">
                  <f.icon className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 text-xs font-semibold">{lang === "ta" ? f.ta : f.en}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      <VoiceAssistant />
    </main>
  );
}
