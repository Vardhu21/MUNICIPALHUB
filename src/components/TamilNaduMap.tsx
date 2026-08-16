/** Stylised Tamil Nadu boundary — the "local" end of the macro-to-micro zoom. */
export function TamilNaduMap({
  className = "",
  pulse = true,
}: {
  className?: string;
  pulse?: boolean;
}) {
  return (
    <svg viewBox="0 0 300 420" className={className} role="img" aria-label="Map of Tamil Nadu">
      <defs>
        <linearGradient id="tn-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3F3F3F" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#909090" stopOpacity="0.55" />
        </linearGradient>
        <filter id="tn-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        filter="url(#tn-glow)"
        fill="url(#tn-fill)"
        stroke="#B5B5B5"
        strokeWidth="2.5"
        strokeLinejoin="round"
        d="M120 18 L152 26 L171 48 L196 52 L214 74 L228 108 L221 138 L236 160 L244 196 L232 232
           L241 262 L226 296 L206 330 L188 366 L166 396 L146 410 L131 398 L124 368 L108 340
           L96 306 L82 276 L72 240 L62 206 L56 170 L64 136 L74 106 L86 74 L98 42 Z"
      />
      {[
        { cx: 96, cy: 214, label: "Coimbatore" },
        { cx: 200, cy: 176, label: "Chennai" },
        { cx: 138, cy: 320, label: "Madurai" },
      ].map((c) => (
        <g key={c.label}>
          {pulse && (
            <circle
              cx={c.cx}
              cy={c.cy}
              r="7"
              fill="none"
              stroke="#F8FAFC"
              strokeWidth="1.5"
              className="animate-pulse-ring origin-center"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          )}
          <circle cx={c.cx} cy={c.cy} r="4.5" fill="#F8FAFC" />
        </g>
      ))}
    </svg>
  );
}
