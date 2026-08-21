import { computeClock, TIER_LABEL, type Priority, type Tier } from "@/lib/sla";
import { useLang } from "@/lib/i18n";

export function SlaBar({
  createdAt,
  priority,
  offsetHours,
  tier,
  slaHours,
}: {
  createdAt: string;
  priority: Priority;
  offsetHours: number;
  tier: Tier;
  /** Category-specific window stored on the ticket. */
  slaHours?: number | null;
}) {
  const { lang, t } = useLang();
  const clock = computeClock(createdAt, priority, offsetHours, { slaHours });
  const pct = Math.round(clock.ratio * 100);
  const tone = clock.breached ? "bg-destructive" : clock.ratio > 0.7 ? "bg-warning" : "bg-success";

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
        <span className="min-w-0 truncate text-muted-foreground">
          {clock.totalHours}h SLA · {TIER_LABEL[tier]?.[lang]}
        </span>
        <span className={`shrink-0 font-semibold ${clock.breached ? "text-destructive" : "text-foreground"}`}>
          {clock.breached ? `${t("breached")} +${clock.remainingLabel}` : `${clock.remainingLabel} ${t("slaRemaining")}`}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
