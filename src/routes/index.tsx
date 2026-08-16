import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Globe, ShieldCheck, Settings2, BarChart3, Leaf, Users } from "lucide-react";
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
  const { t, lang, setLang } = useLang();
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
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={emblem}
              alt="Government of Tamil Nadu emblem"
              width={512}
              height={512}
              className="size-11 shrink-0 object-contain drop-shadow-lg"
            />
            <p className="max-w-[16rem] text-[11px] font-semibold uppercase leading-snug tracking-[0.16em] text-white/85">
              {t("maws")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm backdrop-blur-md">
            <Globe className="size-4 text-white/80" />
            <button
              onClick={() => setLang("en")}
              className={`transition-colors ${lang === "en" ? "font-semibold text-white" : "text-white/60 hover:text-white"}`}
            >
              English
            </button>
            <span className="text-white/30">|</span>
            <button
              lang="ta"
              onClick={() => setLang("ta")}
              className={`transition-colors ${lang === "ta" ? "font-semibold text-white" : "text-white/60 hover:text-white"}`}
            >
              தமிழ்
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
          <div className="flex size-20 items-center justify-center rounded-full border border-white/25 bg-white/15 p-3 backdrop-blur-md">
            <img
              src={emblem}
              alt="TN SmartMunicipality emblem"
              width={512}
              height={512}
              className="size-full object-contain drop-shadow-2xl"
            />
          </div>

          <div className="space-y-3">
            <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-white drop-shadow-lg sm:text-7xl">
              {t("appName")}
            </h1>
            <p className="text-lg font-semibold text-white/90 sm:text-2xl">
              Your City. Your Voice. Your Solution.
            </p>
            <p lang="ta" className="text-base text-white/75 sm:text-lg">
              உங்கள் நகரம். உங்கள் குரல். உங்கள் தீர்வு.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 pt-2 sm:flex-row">
            <button
              onClick={() => enter("/auth")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-[1.03] hover:bg-[#5635C9] motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              {t("enterPortal")} <ArrowRight className="size-4" />
            </button>
            <Link
              to="/feed"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/15"
            >
              <Users className="size-4" /> {t("viewFeed")}
            </Link>
          </div>

          <button
            onClick={() => enter("/auth")}
            className="text-sm text-white/70 underline decoration-primary decoration-2 underline-offset-8 transition-colors hover:text-white"
          >
            Skip
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 rounded-2xl border border-white/15 bg-black/30 p-5 backdrop-blur-md sm:grid-cols-4 sm:divide-x sm:divide-white/15">
          {[
            { Icon: ShieldCheck, title: "Citizen Centric", sub: "People First" },
            { Icon: Settings2, title: "Smart Solutions", sub: "Technology Led" },
            { Icon: BarChart3, title: "Transparent", sub: "Open & Accountable" },
            { Icon: Leaf, title: "Sustainable", sub: "Better Tomorrow" },
          ].map(({ Icon, title, sub }) => (
            <div key={title} className="flex items-center gap-3 px-2 sm:justify-center">
              <Icon className="size-6 shrink-0 text-primary" />
              <div className="text-left">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-white/65">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <VoiceAssistant />
    </main>
  );
}
