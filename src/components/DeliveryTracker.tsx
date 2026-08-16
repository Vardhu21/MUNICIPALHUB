import { Check, Circle, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { STAGE_LABEL, TRACKER_STEPS, formatMetres, type WorkflowStage } from "@/lib/workflow";

/** Delivery-style vertical progress for a grievance. Light, CSS-only motion. */
export function DeliveryTracker({
  stage,
  distanceM,
  compact = false,
}: {
  stage: WorkflowStage | string;
  distanceM?: number | null;
  compact?: boolean;
}) {
  const { lang } = useLang();
  const normalized: WorkflowStage =
    stage === "approaching" ? "travelling" : stage === "officer_approved" ? "citizen_verification" : (stage as WorkflowStage);
  const current = TRACKER_STEPS.indexOf(normalized);

  return (
    <ol className={`space-y-0 ${compact ? "text-[11px]" : "text-xs"}`}>
      {TRACKER_STEPS.map((step, i) => {
        const done = current > i;
        const active = current === i;
        return (
          <li key={step} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5">
            <div className="flex flex-col items-center">
              <span
                className={`grid size-5 place-items-center rounded-full border transition-colors duration-300 ${
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                {done ? (
                  <Check className="size-3" />
                ) : active ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Circle className="size-2" />
                )}
              </span>
              {i < TRACKER_STEPS.length - 1 && (
                <span className={`w-px flex-1 ${done ? "bg-primary" : "bg-border"}`} style={{ minHeight: 16 }} />
              )}
            </div>
            <div className="pb-3">
              <p className={`font-semibold ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                {STAGE_LABEL[step][lang]}
              </p>
              {active && stage === "approaching" && (
                <p className="text-[11px] text-muted-foreground">
                  {STAGE_LABEL.approaching[lang]} · {formatMetres(distanceM)}
                </p>
              )}
              {active && stage === "travelling" && distanceM != null && (
                <p className="text-[11px] text-muted-foreground">{formatMetres(distanceM)}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
