import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { useLang } from "@/lib/i18n";
import emblem from "@/assets/tn-emblem.png";
import heroAsset from "@/assets/gcc-ripon.png.asset.json";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portal,
});

function Portal() {
  const { t, toggle } = useLang();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const enter = (to: string) => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => navigate({ to }), 600);
  };

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-background transition-opacity duration-[600ms] ease-out motion-reduce:transition-none ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroAsset.url})` }}
        role="img"
        aria-label="Ripon Building, Greater Chennai Corporation headquarters"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/25" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,#6C4CE855,transparent_60%)]" />

      <div
        className={`relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 transition-all duration-[700ms] ease-out motion-reduce:transition-none ${
          ready ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <div className="flex justify-end">
          <button
            onClick={toggle}
            className="shrink-0 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            {t("language")}
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-14 text-center">
          <div className="flex size-24 items-center justify-center p-3">
            <img
              src={emblem}
              alt="TN SmartMunicipality emblem"
              width={512}
              height={512}
              className="size-full object-contain drop-shadow-2xl"
            />
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold leading-tight text-white drop-shadow-lg sm:text-6xl">
              {t("appName")}
            </h1>
            <p className="text-lg font-semibold text-white/90 sm:text-2xl">
              Your City. Your Voice. Your Solution.
            </p>
            <p lang="ta" className="text-base text-white/75 sm:text-lg">
              உங்கள் நகரம். உங்கள் குரல். உங்கள் தீர்வு.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <button
              onClick={() => enter("/auth")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-[1.03] hover:bg-[#5635C9] motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              {t("enterPortal")} <ArrowRight className="size-4" />
            </button>
            <Link
              to="/feed"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white/85 transition-colors hover:bg-white/15"
            >
              {t("viewFeed")}
            </Link>
          </div>

          <button
            onClick={() => enter("/auth")}
            className="text-xs uppercase tracking-[0.2em] text-white/60 underline-offset-4 transition-colors hover:text-white"
          >
            Skip
          </button>
        </div>
      </div>

      <VoiceAssistant />
    </main>
  );
}
