import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Gavel, KeyRound, ScrollText } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { judicialOverride } from "@/lib/civic.functions";
import { fetchComplaints, type Complaint } from "@/lib/data";
import { SLA_MATRIX } from "@/lib/sla";

export const Route = createFileRoute("/oversight")({
  head: () => ({
    meta: [
      { title: "Judicial Oversight Console — TN SmartMunicipality" },
      {
        name: "description",
        content:
          "Dual-key court subpoena decryption of sealed citizen identities, with an immutable audit ledger of every override attempt.",
      },
      { property: "og:title", content: "Judicial Oversight Console — TN SmartMunicipality" },
      { property: "og:description", content: "Two custodians, one audit trail, zero silent identity access." },
    ],
  }),
  component: Oversight,
});

type AuditRow = {
  id: string;
  case_reference: string;
  granted: boolean;
  reason: string | null;
  created_at: string;
};

function Oversight() {
  const { lang } = useLang();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [complaintId, setComplaintId] = useState("");
  const [caseRef, setCaseRef] = useState("");
  const [keyA, setKeyA] = useState("");
  const [keyB, setKeyB] = useState("");
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<Record<string, string | null> | null>(null);

  const loadAudit = async () => {
    const { data } = await supabase
      .from("judicial_overrides")
      .select("id,case_reference,granted,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setAudit((data ?? []) as AuditRow[]);
  };

  useEffect(() => {
    fetchComplaints()
      .then((list) => {
        setComplaints(list);
        setComplaintId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => undefined);
    loadAudit();
  }, []);

  const run = async () => {
    if (!complaintId) return toast.error("Select the grievance under subpoena.");
    setBusy(true);
    setIdentity(null);
    try {
      const res = await judicialOverride({
        data: { complaintId, caseReference: caseRef.trim(), keyA, keyB },
      });
      if (!res.granted) {
        toast.error("Decryption denied — custody key mismatch", {
          description: "The denial has been written to the immutable audit ledger.",
        });
      } else {
        setIdentity(res.identity as Record<string, string | null> | null);
        toast.success("Identity unsealed under court order");
      }
      loadAudit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Override failed — administrator role required.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        <section className="civic-card space-y-3 p-4">
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Gavel className="size-5 text-primary" /> Judicial Court Subpoena Decryption
          </h1>
          <p className="text-xs text-muted-foreground">
            Requires both custody keys — one held by the court registrar, one by the MAWS legal cell. Every
            attempt, successful or not, writes an immutable audit entry.
          </p>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Grievance under subpoena</span>
            <select
              value={complaintId}
              onChange={(e) => setComplaintId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {complaints.map((c) => (
                <option key={c.id} value={c.id} className="bg-card">
                  {c.author_pseudonym} · {c.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Case reference</span>
            <input
              value={caseRef}
              onChange={(e) => setCaseRef(e.target.value)}
              placeholder="W.P. No. 14522 / 2026"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Custody key A (Registrar)", value: keyA, set: setKeyA },
              { label: "Custody key B (MAWS legal cell)", value: keyB, set: setKeyB },
            ].map((f) => (
              <label key={f.label} className="block space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">{f.label}</span>
                <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:border-primary">
                  <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    type="password"
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className="min-w-0 bg-transparent py-2 text-sm outline-none"
                  />
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={run}
            disabled={busy}
            className="w-full rounded-xl bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          >
            {busy ? "Validating custody keys…" : "Unseal identity under court order"}
          </button>

          {identity && (
            <div className="space-y-1 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs">
              <p className="font-bold text-destructive">Sealed identity disclosed</p>
              {Object.entries(identity).map(([k, v]) => (
                <p key={k} className="truncate">
                  <span className="text-muted-foreground">{k}:</span> {v ?? "—"}
                </p>
              ))}
            </div>
          )}
        </section>

        <section className="civic-card overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-bold">
            <ScrollText className="size-4 text-primary" /> Immutable override audit ledger
          </h2>
          <div className="divide-y divide-border">
            {audit.map((a) => (
              <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-xs">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{a.case_reference}</span>
                  <span className="block truncate text-muted-foreground">{a.reason}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("en-IN")}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 font-semibold ${
                    a.granted
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {a.granted ? "GRANTED" : "DENIED"}
                </span>
              </div>
            ))}
            {audit.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">No override attempts logged.</p>
            )}
          </div>
        </section>

        <section className="civic-card overflow-hidden">
          <h2 className="border-b border-border px-4 py-3 text-sm font-bold">SLA escalation matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Priority</th>
                  <th className="px-4 py-2">Window</th>
                  <th className="px-4 py-2">First responder</th>
                  <th className="px-4 py-2">Escalates to</th>
                </tr>
              </thead>
              <tbody>
                {SLA_MATRIX.map((r) => (
                  <tr key={r.priority} className="border-t border-border">
                    <td className="px-4 py-2.5 font-bold uppercase">{r.priority}</td>
                    <td className="px-4 py-2.5">{r.hours}h</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.fieldTier[lang]}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.escalateTo[lang]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
