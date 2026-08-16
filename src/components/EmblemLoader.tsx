import emblem from "@/assets/tn-emblem.png";

/** Small static Tamil Nadu emblem used as the app-wide loading indicator. */
export function EmblemLoader({
  label,
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`} role="status">
      <img
        src={emblem}
        alt=""
        aria-hidden="true"
        className="size-5 shrink-0 object-contain"
      />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
