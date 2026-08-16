import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { complaintWorkflow } from "@/lib/workflow.functions";
import { DeliveryTracker } from "@/components/DeliveryTracker";
import { formatMetres } from "@/lib/workflow";
import { useLang } from "@/lib/i18n";

/** Citizen-facing delivery-style progress for a complaint that has a worker assigned. */
export function LiveComplaintProgress({ complaintId }: { complaintId: string }) {
  const { lang } = useLang();
  const load = useServerFn(complaintWorkflow);
  const [data, setData] = useState<Awaited<ReturnType<typeof complaintWorkflow>> | null>(null);

  useEffect(() => {
    let alive = true;
    const run = () =>
      load({ data: { complaintId } })
        .then((d) => alive && setData(d))
        .catch(() => undefined);
    run();
    const id = window.setInterval(run, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [load, complaintId]);

  if (!data?.assignment) return null;
  const { assignment, worker } = data;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
      <p className="text-[11px] font-semibold">
        {lang === "ta" ? "பணியாளர்" : "Assigned worker"}: {worker?.display_name ?? "—"}
        {worker?.department ? ` · ${worker.department}` : ""}
      </p>
      <DeliveryTracker stage={assignment.stage} distanceM={assignment.last_distance_m} compact />
      {assignment.last_distance_m != null && assignment.stage !== "arrived" && (
        <p className="text-[11px] text-muted-foreground">
          {lang === "ta" ? "தூரம்" : "Distance away"}: {formatMetres(assignment.last_distance_m)}
        </p>
      )}
    </div>
  );
}
