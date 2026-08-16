import { useEffect, useRef } from "react";

/** Canvas starfield that drifts toward the viewer — the "cosmic" layer. */
export function Starfield({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;

    const stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random(),
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (!reduce) {
          s.z -= 0.0022;
          if (s.z <= 0.02) {
            s.z = 1;
            s.x = Math.random() * 2 - 1;
            s.y = Math.random() * 2 - 1;
          }
        }
        const px = w / 2 + (s.x / s.z) * (w / 3);
        const py = h / 2 + (s.y / s.z) * (h / 3);
        if (px < 0 || px > w || py < 0 || py > h) continue;
        const r = Math.max(0.3, (1 - s.z) * 2.1);
        ctx.globalAlpha = Math.min(1, (1 - s.z) * 1.4);
        ctx.fillStyle = s.z < 0.35 ? "#D6CCF9" : "#9B85F0";
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
