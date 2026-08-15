import { useEffect, useState } from "react";

const SESSION_KEY = "tnsm-intro-played";

/** India outline (stylised) in a 600x700 space. */
const INDIA_D = `M298 34 L332 46 L352 34 L372 52 L404 56 L426 74 L470 78 L508 96 L528 122
  L512 146 L520 176 L500 196 L470 190 L452 214 L430 246 L404 300 L392 352 L378 404
  L366 456 L352 508 L344 560 L334 612 L322 654 L308 620 L300 566 L288 520 L272 470
  L250 430 L226 400 L200 372 L176 340 L152 314 L142 286 L160 268 L186 274 L206 258
  L200 226 L214 198 L238 186 L252 158 L246 128 L262 100 L272 66 Z`;

/** Tamil Nadu (stylised) inside the same space. */
const TN_D = `M312 500 L338 494 L358 508 L366 532 L358 560 L368 586 L350 618 L332 650
  L318 626 L310 592 L302 556 L300 526 Z`;

const TN_CX = 334;
const TN_CY = 570;

type Stage = "wide" | "zoom" | "highlight" | "out";

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
      setTimeout(() => setStage("highlight"), 3500),
      setTimeout(() => setStage("out"), 5400),
      setTimeout(() => finish(), 6200),
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

  return (
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-background transition-opacity duration-700 ${
        stage === "out" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      role="presentation"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,#2563EB33,transparent_62%),radial-gradient(circle_at_50%_95%,#15803D2e,transparent_55%)]" />
      <div className="grid-noise pointer-events-none absolute inset-0 opacity-[0.14]" />

      <svg
        viewBox="0 0 600 700"
        className="relative h-[86vh] max-h-[860px] w-auto max-w-[92vw]"
        aria-label="Zooming from India to Tamil Nadu"
      >
        <defs>
          <linearGradient id="ci-india" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#15803D" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id="ci-tn" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0.9" />
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
            stroke="#93C5FD"
            strokeWidth={zooming ? 0.9 : 2}
            strokeLinejoin="round"
            style={{ transition: "stroke-width 2.6s ease" }}
          />
          <path
            d={TN_D}
            filter="url(#ci-glow)"
            fill={stage === "wide" ? "transparent" : "url(#ci-tn)"}
            stroke="#F8FAFC"
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
              stroke="#F8FAFC"
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
          <h2 className="bg-gradient-to-r from-primary to-success bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
            TAMIL NADU
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            11.13° N · 78.66° E — Urban Local Bodies
          </p>
        </div>
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
