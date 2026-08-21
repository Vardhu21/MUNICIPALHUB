import { Check, Circle, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

/** Amazon-style delivery journey for a grievance, driven purely by complaint status. */
const STEPS = [
  {
    key: "placed",
    en: "Complaint received",
    ta: "புகார் பெறப்பட்டது",
    enSub: "Your report is registered and queued for a ward officer.",
    taSub: "உங்கள் புகார் பதிவு செய்யப்பட்டது.",
    match: ["submitted", "rejected"],
  },
  {
    key: "assigned",
    en: "Assigned to field team",
    ta: "களக் குழுவிடம் ஒப்படைக்கப்பட்டது",
    enSub: "An officer or worker is responsible for this ticket.",
    taSub: "அலுவலர்/பணியாளர் பொறுப்பேற்றுள்ளார்.",
    match: ["assigned", "worker_accepted", "escalated", "joint_task_force", "reopened"],
  },
  {
    key: "onway",
    en: "Team on the way",
    ta: "குழு வழியில்",
    enSub: "The worker is travelling to the complaint location.",
    taSub: "பணியாளர் இடத்திற்கு வந்து கொண்டிருக்கிறார்.",
    match: ["travelling", "arrived"],
  },
  {
    key: "working",
    en: "Work in progress",
    ta: "பணி நடைபெறுகிறது",
    enSub: "Repair or clean-up work has started on site.",
    taSub: "இடத்தில் பணி தொடங்கியுள்ளது.",
    match: ["in_progress"],
  },
  {
    key: "proof",
    en: "Proof uploaded",
    ta: "சான்று பதிவேற்றப்பட்டது",
    enSub: "A geotagged completion photo has been submitted.",
    taSub: "இடம் குறிக்கப்பட்ட புகைப்படம் சமர்ப்பிக்கப்பட்டது.",
    match: ["evidence_submitted", "officer_review", "officer_approved"],
  },
  {
    key: "verify",
    en: "Your confirmation",
    ta: "உங்கள் உறுதிப்படுத்தல்",
    enSub: "Confirm the fix, or reopen if the issue is still there.",
    taSub: "சரிசெய்யப்பட்டதா என உறுதிப்படுத்தவும்.",
    match: ["verification", "citizen_verification"],
  },
  {
    key: "done",
    en: "Resolved & closed",
    ta: "தீர்க்கப்பட்டு மூடப்பட்டது",
    enSub: "This grievance is closed.",
    taSub: "இந்தப் புகார் மூடப்பட்டது.",
    match: ["resolved", "resolved_by_citizen", "auto_closed_no_response"],
  },
] as const;

function stepIndex(status: string) {
  const i = STEPS.findIndex((s) => (s.match as readonly string[]).includes(status));
  return i === -1 ? 0 : i;
}

export function ComplaintJourney({
  status,
  escalations = 0,
  compact = false,
}: {
  status: string;
  escalations?: number;
  compact?: boolean;
}) {
  const { lang } = useLang();
  const ta = lang === "ta";
  const current = stepIndex(status);
  const closed = status === "resolved" || status === "resolved_by_citizen" || status === "auto_closed_no_response";

  return (
    <div className="space-y-3">
      <ol className={compact ? "text-[11px]" : "text-xs"}>
        {STEPS.map((step, i) => {
          const done = current > i || (closed && i === STEPS.length - 1);
          const active = current === i && !done;
          return (
            <li key={step.key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5">
              <div className="flex flex-col items-center">
                <span
                  className={`grid size-5 place-items-center rounded-full border transition-colors duration-300 ${
                    done
                      ? "border-success bg-success text-success-foreground"
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
                {i < STEPS.length - 1 && (
                  <span className={`w-px flex-1 ${done ? "bg-success" : "bg-border"}`} style={{ minHeight: 18 }} />
                )}
              </div>
              <div className="pb-3">
                <p
                  className={`font-semibold ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {ta ? step.ta : step.en}
                </p>
                {active && <p className="text-[11px] text-muted-foreground">{ta ? step.taSub : step.enSub}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {escalations > 0 && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning">
          {ta
            ? `அலுவலர் ${escalations} முறை நேரத்தை முன்னகர்த்தினார் — காலக்கெடு ${escalations} மணி நேரம் குறைந்தது.`
            : `Officer fast-forwarded the clock ${escalations} time${escalations > 1 ? "s" : ""} — deadline shortened by ${escalations}h.`}
        </p>
      )}
    </div>
  );
}
