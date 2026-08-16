import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Globe, ShieldCheck, Settings2, BarChart3, Users } from "lucide-react";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { useLang } from "@/lib/i18n";
import emblem from "@/assets/tn-emblem.png";
import heroAsset from "@/assets/gcc-ripon.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TN Smart Municipality — Civic Escalation Portal" },
      {
        name: "description",
        content:
          "Geotagged grievance reporting with anonymous citizen identity, SLA-driven auto-escalation and transparent ward accountability for Tamil Nadu urban local bodies.",
      },
      { property: "og:title", content: "TN Smart Municipality — Civic Escalation Portal" },
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

  const fadeUp = (delayMs: number) => ({
    transitionProperty: "opacity, transform",
    transitionDuration: "700ms",
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    transitionDelay: `${delayMs}ms`,
    opacity: ready ? 1 : 0,
    transform: ready ? "translateY(0)" : "translateY(12px)",
  });

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-background transition-opacity duration-700 ease-out motion-reduce:transition-none ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroAsset.url})` }}
        role="img"
        aria-label="Ripon Building, Greater Chennai Corporation headquarters"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/40" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
        <header
          className="flex items-start justify-between gap-4 motion-reduce:transition-none"
          style={fadeUp(0)}
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img
              src={emblem}
              alt="Government of Tamil Nadu emblem"
              width={512}
              height={512}
              className="size-8 object-contain drop-shadow-md sm:size-10"
            />
            <p className="text-[11px] font-medium uppercase leading-tight tracking-[0.11em] text-white sm:text-[13px] sm:leading-snug">
              <span className="block">Department of Municipal</span>
              <span className="block">Administration & Water Supply</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm backdrop-blur-md sm:px-4 sm:py-2">
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
          <div className="space-y-4" style={fadeUp(120)}>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white drop-shadow-sm sm:text-6xl">
              TN Smart Municipality
            </h1>
            <p className="text-lg font-normal text-white/90 sm:text-2xl">
              Your City. Your Voice. Your Solution.
            </p>
          </div>

          <div
            className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:gap-4"
            style={fadeUp(240)}
          >
            <button
              onClick={() => enter("/auth")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-[1.02] hover:bg-[#5635C9] motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              {t("enterPortal")} <ArrowRight className="size-4" />
            </button>
            <Link
              to="/feed"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
            >
              <Users className="size-4" /> {t("viewFeed")}
            </Link>
          </div>

          <button
            onClick={() => enter("/auth")}
            className="text-sm text-white/65 underline decoration-white/40 decoration-1 underline-offset-6 transition-colors hover:text-white"
            style={fadeUp(320)}
          >
            Skip
          </button>
        </div>

        <div
          className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur-md sm:grid-cols-3 sm:divide-x sm:divide-white/15 sm:p-5"
          style={fadeUp(400)}
        >
          {[
            { Icon: ShieldCheck, title: "Citizen Centric", sub: "People First" },
            { Icon: Settings2, title: "Smart Solutions", sub: "Technology Led" },
            { Icon: BarChart3, title: "Transparent", sub: "Open & Accountable" },
          ].map(({ Icon, title, sub }) => (
            <div key={title} className="flex items-center justify-center gap-3 px-2">
              <Icon className="size-5 shrink-0 text-primary" />
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
