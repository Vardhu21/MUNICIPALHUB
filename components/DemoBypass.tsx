import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FlaskConical, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchComplaints, fetchWards } from "@/lib/data";
import { writeActiveRole, type AppRole } from "@/lib/session";

const DEMO_PASSWORD = "TnSmDemo!2026";

type DemoPersona = {
  role: AppRole;
  label: string;
  ifhrms?: string;
  aadhaarTag: string;
  to: "/feed" | "/officer" | "/analytics" | "/dashboard";
};

const PERSONAS: DemoPersona[] = [
  { role: "citizen", label: "Citizen", aadhaarTag: "@CivicGuard_42", to: "/feed" },
  { role: "field_officer", label: "Field Officer", ifhrms: "20241203045", aadhaarTag: "@CivicGuard_11", to: "/officer" },
  {
    role: "zonal_commissioner",
    label: "Zonal AC",
    ifhrms: "20241203046",
    aadhaarTag: "@CivicGuard_12",
    to: "/officer",
  },
  { role: "commissioner", label: "Commissioner", ifhrms: "20241203047", aadhaarTag: "@CivicGuard_13", to: "/analytics" },
  { role: "councillor", label: "Ward Councillor", ifhrms: "20241203048", aadhaarTag: "@CivicGuard_14", to: "/dashboard" },
];

function demoEmail(role: AppRole) {
  return `demo-${role.replace(/_/g, "-")}@tnsm.local`;
}

export function DemoBypass({ returnTo }: { returnTo?: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<AppRole | null>(null);

  const enter = async (p: DemoPersona) => {
    setBusy(p.role);
    try {
      const email = demoEmail(p.role);
      let signIn = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD });

      if (signIn.error) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password: DEMO_PASSWORD,
          options: {
            emailRedirectTo:
              returnTo?.startsWith("/") && !returnTo.startsWith("//")
                ? `${window.location.origin}${returnTo}`
                : window.location.origin,
          },
        });
        if (signUpError && !/already registered/i.test(signUpError.message)) throw signUpError;
        signIn = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
        if (signIn.error) throw signIn.error;
      }

      const uid = signIn.data.user?.id;
      if (!uid) throw new Error("Demo session could not be created.");

      // Put demo officers in a ward that actually has live tickets to work on.
      const [wards, complaints] = await Promise.all([
        fetchWards().catch(() => []),
        fetchComplaints().catch(() => []),
      ]);
      const liveWard = complaints.find((c) => c.status !== "resolved" && c.ward_id)?.ward_id ?? null;
      const wardId = liveWard ?? wards[0]?.id ?? null;



      await supabase.from("profiles").upsert({
        id: uid,
        pseudonym: p.aadhaarTag,
        ward_id: wardId,
        digilocker_verified: true,
      });
      await supabase.from("user_roles").upsert({ user_id: uid, role: p.role, ward_id: wardId });
      if (p.role !== "citizen") {
        await supabase.from("user_roles").upsert({ user_id: uid, role: "citizen", ward_id: wardId });
      }

      writeActiveRole(p.role);
      toast.success(`Test mode — signed in as ${p.label}`, {
        description: p.ifhrms ? `Simulated IFHRMS ${p.ifhrms}` : "Simulated Aadhaar citizen persona",
      });
      if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) window.location.assign(returnTo);
      else navigate({ to: p.to });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Demo sign-in failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="civic-card space-y-3 border-warning/40 p-4">
      <div className="flex items-start gap-2">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0">
          <h2 className="text-sm font-bold">Test mode — skip DigiLocker</h2>
          <p className="text-[11px] text-muted-foreground">
            One-tap demo sign-in. Bypasses Aadhaar / IFHRMS OTP binding for evaluation only.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PERSONAS.map((p) => (
          <button
            key={p.role}
            onClick={() => enter(p)}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs font-semibold transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-50"
          >
            {busy === p.role ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : p.role === "citizen" ? (
              <UserRound className="size-4 shrink-0 text-primary" />
            ) : (
              <ShieldCheck className="size-4 shrink-0 text-primary" />
            )}
            <span className="min-w-0">
              <span className="block truncate">{p.label}</span>
              <span className="block truncate text-[10px] font-normal text-muted-foreground">
                {p.ifhrms ? `IFHRMS ${p.ifhrms}` : p.aadhaarTag}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
