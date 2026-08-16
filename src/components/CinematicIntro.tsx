import { useEffect, useState } from "react";

const SESSION_KEY = "tnsm-intro-played";

/** India outline (simplified from real lon/lat) in a 600x700 space. */
const INDIA_D = `M4.1 300.6 L31.0 332.2 L95.2 345.8 L99.4 404.5 L113.8 476.9 L140.8 531.1
  L161.5 574.0 L196.7 653.1 L211.1 619.2 L246.3 603.4 L254.6 540.1 L252.5 476.9 L296.0 454.3
  L347.8 400.0 L391.2 366.1 L403.6 348.0 L432.6 345.8 L418.1 311.9 L436.8 264.4 L451.3 248.6
  L496.8 228.3 L552.7 214.7 L589.9 196.6 L538.2 212.4 L496.8 214.7 L451.3 219.2 L416.1 205.7
  L368.5 196.6 L310.5 174.0 L250.5 151.4 L207.0 126.6 L165.6 99.4 L130.4 54.2 L124.2 101.7
  L82.8 169.5 L51.8 203.4 L41.4 259.9 Z`;

/** Tamil Nadu (simplified from real lon/lat) inside the same space. */
const TN_D = `M184.2 574.0 L196.7 569.5 L211.1 544.7 L219.4 533.4 L248.4 531.1 L254.6 542.4
  L244.3 567.3 L246.3 603.4 L231.8 623.8 L225.6 628.3 L209.1 646.4 L196.7 653.1 L190.4 644.1
  L184.2 621.5 L182.2 592.1 Z`;

const TN_CX = 215;
const TN_CY = 592;

type Stage = "wide" | "zoom" | "highlight" | "brand" | "out";

export function CinematicIntro() {
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState<Stage>("wide");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      sessionStorage.setItem(SESSION_KEY, "1");
      return;
    }
    setVisible(true);
    document.body.style.overflow = "hidden";
    const timers = [
      setTimeout(() => setStage("zoom"), 900),
      setTimeout(() => setStage("highlight"), 3300),
      setTimeout(() => setStage("brand"), 5100),
      setTimeout(() => setStage("out"), 6600),
      setTimeout(() => finish(), 7200),
    ];
    return () => {
      timers.forEach(clearTimeout);
      document.body.style.overflow = "";
    };
  }, []);

  const finish = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    document.body.style.overflow = "";
    setVisible(false);
  };

  if (!visible) return null;

  const zooming = stage !== "wide";
  const scale = stage === "wide" ? 1 : stage === "zoom" ? 4.2 : 5.4;
  const branding = stage === "brand" || stage === "out";

  return (
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-background transition-opacity duration-700 ${
        stage === "out" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      role="presentation"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,#3A3A3A18,transparent_62%),radial-gradient(circle_at_50%_95%,#3A3A3A10,transparent_55%)]" />
      <div className="grid-noise pointer-events-none absolute inset-0 opacity-[0.14]" />

      <svg
        viewBox="0 0 600 700"
        className="relative h-[86vh] max-h-[860px] w-auto max-w-[92vw]"
        aria-label="Zooming from India to Tamil Nadu"
      >
        <defs>
          <linearGradient id="ci-india" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3F3F3F" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#9A9A9A" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id="ci-tn" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2B2B2B" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#6E6E6E" stopOpacity="0.9" />
          </linearGradient>
          <filter id="ci-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          style={{
            transform: `scale(${scale}) translate(${((300 - TN_CX) * (scale - 1)) / scale}px, ${
              ((350 - TN_CY) * (scale - 1)) / scale
            }px)`,
            transformOrigin: "300px 350px",
            transition: "transform 2.6s cubic-bezier(0.65, 0, 0.2, 1)",
          }}
        >
          <path
            d={INDIA_D}
            fill="url(#ci-india)"
            stroke="#8A8A8A"
            strokeWidth={zooming ? 0.9 : 2}
            strokeLinejoin="round"
            style={{ transition: "stroke-width 2.6s ease" }}
          />
          <path
            d={TN_D}
            filter="url(#ci-glow)"
            fill={stage === "wide" ? "transparent" : "url(#ci-tn)"}
            stroke="#1F1F1F"
            strokeWidth={zooming ? 0.7 : 1.4}
            strokeLinejoin="round"
            style={{ transition: "fill 1.2s ease, stroke-width 2.6s ease" }}
          />
          {stage === "highlight" && (
            <circle
              cx={TN_CX}
              cy={TN_CY}
              r="26"
              fill="none"
              stroke="#1F1F1F"
              strokeWidth="0.8"
              className="animate-pulse-ring"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          )}
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-[14%] text-center">
        <p
          className={`text-[10px] uppercase tracking-[0.42em] text-muted-foreground transition-opacity duration-700 ${
            stage === "wide" || stage === "zoom" ? "opacity-100" : "opacity-0"
          }`}
        >
          {stage === "wide" ? "Republic of India" : "Locating southern region"}
        </p>
        <div
          className={`transition-all duration-700 ${
            stage === "highlight" ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            TAMIL NADU
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            11.13° N · 78.66° E — Urban Local Bodies
          </p>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm transition-opacity duration-700 ${
          branding ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-[10px] uppercase tracking-[0.42em] text-muted-foreground">Tamil Nadu · MAWS</p>
        <h1 className="text-center text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
          Smart Municipality
        </h1>
        <p className="max-w-md px-6 text-center text-sm text-muted-foreground">
          Geotagged grievances · SLA-driven escalation · transparent ward accountability
        </p>
      </div>

      <button
        onClick={finish}
        className="absolute right-4 top-4 rounded-lg border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur transition-colors hover:bg-accent sm:right-6 sm:top-6"
      >
        Skip intro
      </button>
    </div>
  );
}
