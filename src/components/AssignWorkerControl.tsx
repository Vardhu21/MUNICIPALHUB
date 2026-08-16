import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { HardHat } from "lucide-react";
import { assignWorker, listWorkers } from "@/lib/workflow.functions";
import { useLang } from "@/lib/i18n";

type Worker = { id: string; display_name: string; department: string };

/** Officer-side control that assigns an authorised worker to a complaint. */
export function AssignWorkerControl({ complaintId, onAssigned }: { complaintId: string; onAssigned?: () => void }) {
  const { lang } = useLang();
  const load = useServerFn(listWorkers);
  const assign = useServerFn(assignWorker);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [open, setOpen] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    load({ data: undefined } as never)
      .then((rows) => setWorkers(rows as Worker[]))
      .catch(() => setWorkers([]));
  }, [open, load]);

  const submit = async () => {
    if (!workerId) return;
    setBusy(true);
    try {
      await assign({ data: { complaintId, workerId, slaHours: hours ? Number(hours) : undefined } });
      toast.success(lang === "ta" ? "பணியாளர் ஒதுக்கப்பட்டார்." : "Worker assigned.");
      setOpen(false);
      onAssigned?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assignment failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
      >
        <HardHat className="size-3.5" /> {lang === "ta" ? "பணியாளரை ஒதுக்கு" : "Assign worker"}
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-xl border border-border p-3">
      <select
        value={workerId}
        onChange={(e) => setWorkerId(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
      >
        <option value="">{lang === "ta" ? "பணியாளரைத் தேர்ந்தெடு" : "Select a worker"}</option>
        {workers.map((w) => (
          <option key={w.id} value={w.id}>
            {w.display_name} · {w.department}
          </option>
        ))}
      </select>
      <input
        value={hours}
        onChange={(e) => setHours(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder={lang === "ta" ? "SLA மணிநேரம் (விருப்பம்)" : "Visit SLA hours (optional)"}
        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
      />
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !workerId}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {lang === "ta" ? "ஒதுக்கு" : "Assign"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold">
          {lang === "ta" ? "ரத்து" : "Cancel"}
        </button>
      </div>
      {!workers.length && (
        <p className="text-[11px] text-muted-foreground">
          {lang === "ta" ? "பணியாளர் யாரும் பதிவு செய்யவில்லை." : "No workers enrolled yet — they can enrol at /worker."}
        </p>
      )}
    </div>
  );
}
