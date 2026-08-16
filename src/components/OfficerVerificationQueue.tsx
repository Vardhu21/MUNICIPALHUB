import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, MapPin, ShieldCheck } from "lucide-react";
import { officerDecision, officerEvidenceQueue } from "@/lib/workflow.functions";
import { EVIDENCE_STATE_LABEL, formatMetres, type EvidenceState } from "@/lib/workflow";
import { useLang } from "@/lib/i18n";

type Item = Awaited<ReturnType<typeof officerEvidenceQueue>>[number];

function StateChip({ state }: { state: string }) {
  const { lang } = useLang();
  const label = EVIDENCE_STATE_LABEL[state as EvidenceState]?.[lang] ?? state;
  const bad =
    state.endsWith("FAILED") || state === "AI_FLAGGED" || state === "OFFICER_REJECTED" || state === "EXIF_MISMATCH";
  const soft = state === "PENDING" || state === "EXIF_UNAVAILABLE" || state === "AI_REVIEW_UNAVAILABLE";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
        bad
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : soft
            ? "border-border bg-secondary text-muted-foreground"
            : "border-primary/40 bg-primary/10 text-primary"
      }`}
    >
      {label}
    </span>
  );
}

/** Officer evidence verification queue: photo, GPS maths, AI recommendation. */
export function OfficerVerificationQueue() {
  const { lang } = useLang();
  const loadQueue = useServerFn(officerEvidenceQueue);
  const decide = useServerFn(officerDecision);
  const [items, setItems] = useState<Item[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadQueue({ data: undefined } as never)
      .then((rows) => setItems(rows as Item[]))
      .catch(() => setItems([]));
  }, [loadQueue]);

  useEffect(refresh, [refresh]);

  const act = async (evidenceId: string, approve: boolean) => {
    const reason = reasons[evidenceId] ?? "";
    if (!approve && !reason.trim()) {
      toast.error(lang === "ta" ? "நிராகரிப்புக்கு காரணம் தேவை." : "A rejection reason is required.");
      return;
    }
    setBusy(evidenceId);
    try {
      await decide({ data: { evidenceId, approve, reason: approve ? undefined : reason } });
      toast.success(approve ? "Evidence approved — citizen verification opened." : "Evidence rejected — sent back for rework.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Decision failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="size-4 text-primary" />
        {lang === "ta" ? "சான்று சரிபார்ப்பு வரிசை" : "Evidence verification queue"}
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{items.length}</span>
      </h2>

      {!items.length && (
        <p className="civic-card p-4 text-center text-xs text-muted-foreground">
          {lang === "ta" ? "சரிபார்க்க சான்று எதுவும் இல்லை." : "No evidence is awaiting verification."}
        </p>
      )}

      {items.map(({ evidence, complaint, worker, imageUrl }) => (
        <article key={evidence.id} className="civic-card space-y-3 p-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold">{complaint?.title}</h3>
            <p className="text-xs text-muted-foreground">{complaint?.description}</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="size-3" />
              {complaint?.street_address ?? `${complaint?.lat?.toFixed(5)}, ${complaint?.lng?.toFixed(5)}`}
            </p>
          </div>

          {imageUrl && <img src={imageUrl} alt="" className="max-h-72 w-full rounded-xl object-cover" />}
          {evidence.description && <p className="text-xs">{evidence.description}</p>}

          <div className="grid gap-1.5 rounded-xl border border-border bg-secondary/40 p-3 text-[11px]">
            <p>
              <strong>Worker:</strong> {worker?.display_name} · {worker?.department}
            </p>
            <p>
              <strong>Worker GPS:</strong> {evidence.worker_lat?.toFixed(5)}, {evidence.worker_lng?.toFixed(5)} ·{" "}
              {formatMetres(evidence.gps_distance_m)} from complaint
            </p>
            <p>
              <strong>Photo GPS:</strong>{" "}
              {evidence.exif_lat != null
                ? `${evidence.exif_lat.toFixed(5)}, ${evidence.exif_lng?.toFixed(5)} · ${formatMetres(evidence.exif_distance_m)}`
                : lang === "ta"
                  ? "EXIF GPS இல்லை"
                  : "EXIF GPS unavailable"}
            </p>
            <p>
              <strong>Submitted:</strong> {new Date(evidence.created_at).toLocaleString()}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <StateChip state={evidence.gps_state} />
            <StateChip state={evidence.exif_state} />
            <StateChip state={evidence.ai_state} />
          </div>

          {evidence.ai_explanation && (
            <p className="flex items-start gap-2 rounded-xl border border-border p-3 text-[11px] text-muted-foreground">
              <Bot className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground">AI recommendation ({evidence.ai_relevance}, {Math.round((evidence.ai_confidence ?? 0) * 100)}%):</strong>{" "}
                {evidence.ai_observed_issue ? `${evidence.ai_observed_issue}. ` : ""}
                {evidence.ai_explanation}
                <em className="block opacity-80">AI advises on image relevance only — GPS is verified by the backend.</em>
              </span>
            </p>
          )}

          <textarea
            value={reasons[evidence.id] ?? ""}
            onChange={(e) => setReasons((p) => ({ ...p, [evidence.id]: e.target.value }))}
            placeholder={lang === "ta" ? "நிராகரிப்பு காரணம்" : "Rejection reason (required to reject)"}
            rows={2}
            className="w-full rounded-xl border border-input bg-background p-2 text-xs outline-none focus:border-primary"
          />

          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy === evidence.id}
              onClick={() => act(evidence.id, true)}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {lang === "ta" ? "ஒப்புதல்" : "Approve"}
            </button>
            <button
              disabled={busy === evidence.id}
              onClick={() => act(evidence.id, false)}
              className="rounded-full border border-destructive/50 px-4 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50"
            >
              {lang === "ta" ? "நிராகரி" : "Reject"}
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
