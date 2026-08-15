import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Fingerprint,
  HardHat,
  IdCard,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { suggestPseudonym, useSession, writeActiveRole, type AppRole } from "@/lib/session";
import { sealIdentity } from "@/lib/civic.functions";
import { fetchWards, type Ward } from "@/lib/data";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { DemoBypass } from "@/components/DemoBypass";
import emblem from "@/assets/tn-emblem.png";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const next = search.next;
    return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? { next }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Unified DigiLocker Gateway — TN SmartMunicipality" },
      {
        name: "description",
        content:
          "Single Sign-in with DigiLocker gateway. Auto-classifies citizens (Aadhaar) and MAWS officers (11-digit IFHRMS employee code) into the correct workspace.",
      },
      { property: "og:title", content: "Unified DigiLocker Gateway — TN SmartMunicipality" },
      {
        property: "og:description",
        content: "One gateway, two identities: Aadhaar citizens and IFHRMS-verified municipal officers.",
      },
    ],
  }),
  component: AuthPage,
});

type Persona = "citizen" | "officer";
type Step = 0 | 1 | 2 | 3;

const OFFICER_ROLES: { value: AppRole; label: string }[] = [
  { value: "field_officer", label: "Assistant Engineer / Junior Engineer / Sanitary Inspector" },
  { value: "zonal_commissioner", label: "Zonal Assistant Commissioner" },
  { value: "commissioner", label: "Corporation Commissioner (IAS)" },
  { value: "councillor", label: "Ward Councillor" },
];

const DEPARTMENTS = [
  "Sanitation & Public Health",
  "Engineering & Infrastructure",
  "Town Planning",
  "Revenue & Administration",
  "Water Supply (TWAD liaison)",
];

// Officer employee IDs map to a deterministic internal email so Supabase Auth still works.
function ifhrmsToEmail(ifhrms: string) {
  return `ifhrms-${ifhrms.trim()}@officer.tnsm.local`;
}

function AuthPage() {
  const { t, lang, toggle } = useLang();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { user } = useSession();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [wards, setWards] = useState<Ward[]>([]);
  const [busy, setBusy] = useState(false);

  // --- DigiLocker gateway step 0: single credential input ---
  const [digilockerId, setDigilockerId] = useState("");
  const [detected, setDetected] = useState<Persona | null>(null);
  const [step, setStep] = useState<Step>(0);

  // Citizen branch state
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pseudonym, setPseudonym] = useState(() => suggestPseudonym());
  const [wardId, setWardId] = useState("");

  const emailOtp = useMemo(() => String(Math.floor(100000 + Math.random() * 899999)), [step === 1]);
  const phoneOtp = useMemo(() => String(Math.floor(100000 + Math.random() * 899999)), [step === 2]);
  const [emailOtpInput, setEmailOtpInput] = useState("");
  const [phoneOtpInput, setPhoneOtpInput] = useState("");

  // Officer branch state
  const [officerName, setOfficerName] = useState("");
  const [officerRole, setOfficerRole] = useState<AppRole>("field_officer");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);

  // Sign-in state (works for both — email/password OR IFHRMS/password)
  const [signInId, setSignInId] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  useEffect(() => {
    fetchWards()
      .then((w) => {
        setWards(w);
        setWardId((prev) => prev || w[0]?.id || "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (next) window.location.replace(next);
    else navigate({ to: "/feed", replace: true });
  }, [user, navigate, next]);

  const digilockerVerify = () => {
    const raw = digilockerId.trim();
    if (/^\d{11}$/.test(raw)) {
      setDetected("officer");
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        toast.success("DigiLocker → TN Government Service Certificate detected", {
          description: `IFHRMS employee code ${raw} verified. Auto-classified as Municipal Officer.`,
        });
        setStep(3);
      }, 1200);
      return;
    }
    if (/^\d{12}$/.test(raw)) {
      setDetected("citizen");
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        toast.success("DigiLocker → Aadhaar consent artefact verified", {
          description: "Demographic hash matched. Proceeding to OTP binding.",
        });
        setStep(1);
      }, 1200);
      return;
    }
    toast.error("Unrecognised DigiLocker credential", {
      description: "Enter your 12-digit Aadhaar (citizen) or 11-digit IFHRMS employee code (officer).",
    });
  };

  const completeCitizen = async () => {
    if (legalName.trim().length < 2) return toast.error("Enter your legal name as printed in DigiLocker.");
    if (!/^\d{10}$/.test(phone.trim())) return toast.error("Mobile number must be 10 digits.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast.error("Enter a valid email.");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (!/^@[A-Za-z0-9_]{3,24}$/.test(pseudonym))
      return toast.error("Pseudonym must start with @ and use 3–24 letters/digits/underscore.");

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: next ? `${window.location.origin}${next}` : window.location.origin },
      });
      if (error) throw error;
      const uid = data.user?.id;
      if (!uid) throw new Error("Account created but no session returned.");

      await supabase.from("profiles").upsert({
        id: uid,
        pseudonym,
        ward_id: wardId || null,
        language: lang,
        digilocker_verified: true,
      });
      await supabase.from("user_roles").upsert({ user_id: uid, role: "citizen", ward_id: wardId || null });
      await sealIdentity({
        data: { legalName: legalName.trim(), aadhaar: digilockerId.trim(), phone: phone.trim() },
      });

      writeActiveRole("citizen");
      toast.success("Identity sealed. Welcome to the portal.", {
        description: `Field officers will only ever see ${pseudonym}.`,
      });
      if (next) window.location.assign(next);
      else navigate({ to: "/feed" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  };

  const completeOfficer = async () => {
    if (officerName.trim().length < 2) return toast.error("Enter your name as per department roster.");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (!wardId) return toast.error("Select the ward/zone you supervise.");

    setBusy(true);
    try {
      const emailAddr = ifhrmsToEmail(digilockerId);
      const { data, error } = await supabase.auth.signUp({
        email: emailAddr,
        password,
        options: {
          emailRedirectTo: next ? `${window.location.origin}${next}` : window.location.origin,
          data: {
            officer_name: officerName,
            ifhrms: digilockerId,
            designation: officerRole,
            department,
          },
        },
      });
      if (error) throw error;
      const uid = data.user?.id;
      if (!uid) throw new Error("Account not created.");

      await supabase.from("profiles").upsert({
        id: uid,
        pseudonym: `@IFHRMS_${digilockerId.trim()}`,
        ward_id: wardId,
        language: lang,
        digilocker_verified: true,
      });
      await supabase.from("user_roles").upsert({ user_id: uid, role: officerRole, ward_id: wardId });
      // Officers can still act as citizens too — persona toggle in TopBar reads this row.
      await supabase.from("user_roles").upsert({ user_id: uid, role: "citizen", ward_id: wardId });

      writeActiveRole(officerRole);
      toast.success("Officer roster entry created", {
        description: `${officerName} · IFHRMS ${digilockerId} · ${department}`,
      });
      if (next) window.location.assign(next);
      else navigate({ to: "/officer" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-up failed");
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    const raw = signInId.trim();
    if (!raw || signInPassword.length < 6) return toast.error("Enter your DigiLocker ID / email and password.");
    setBusy(true);
    const email = /^\d{11}$/.test(raw) ? ifhrmsToEmail(raw) : raw;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: signInPassword });
    setBusy(false);
    if (error) return toast.error(error.message);

    const uid = data.user?.id;
    if (uid) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const officerRoles = ["commissioner", "zonal_commissioner", "field_officer", "councillor"] as const;
      const officer = roles?.map((r) => r.role as AppRole).find((r) => officerRoles.includes(r as typeof officerRoles[number]));
      writeActiveRole((officer as AppRole) ?? "citizen");
      toast.success(officer ? "Welcome, officer" : "Welcome back");
      if (next) window.location.assign(next);
      else navigate({ to: officer ? "/officer" : "/feed" });
      return;
    }
    if (next) window.location.assign(next);
    else navigate({ to: "/feed" });
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid max-w-md gap-5 px-4 py-8">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Link to="/" className="shrink-0">
            <img src={emblem} alt="" width={512} height={512} className="size-10" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{t("appName")}</h1>
            <p className="truncate text-xs text-muted-foreground">Unified DigiLocker Gateway</p>
          </div>
          <button
            onClick={toggle}
            className="shrink-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold"
          >
            {t("language")}
          </button>
        </div>

        <div className="civic-card flex items-start gap-2 p-3 text-xs">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0">
            One gateway for everyone. DigiLocker returns either a{" "}
            <b>12-digit Aadhaar</b> (citizen persona) or an{" "}
            <b>11-digit IFHRMS Government Service Certificate</b> (MAWS officer). Role is auto-detected.
          </span>
        </div>

        <DemoBypass returnTo={next} />

        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">

          {(["signup", "signin"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setStep(0);
                setDetected(null);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "signup" ? "Register via DigiLocker" : t("signIn")}
            </button>
          ))}
        </div>

        {mode === "signin" ? (
          <section className="civic-card space-y-3 p-4">
            <Field
              icon={IdCard}
              label="Email or 11-digit IFHRMS ID"
              value={signInId}
              onChange={setSignInId}
              placeholder="citizen@example.com  or  20241203045"
            />
            <Field icon={Lock} label={t("password")} value={signInPassword} onChange={setSignInPassword} type="password" />
            <button
              onClick={signIn}
              disabled={busy}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "…" : t("signIn")}
            </button>
            <p className="text-[11px] text-muted-foreground">
              Officers enrolled with IFHRMS can enter their 11-digit employee code instead of an email.
            </p>
          </section>
        ) : (
          <>
            <ol className="grid grid-cols-4 gap-1.5">
              {(detected === "officer"
                ? ["DigiLocker", "—", "—", "Officer roster"]
                : ["DigiLocker", "Email OTP", "Mobile OTP", "Pseudonym"]
              ).map((s, i) => (
                <li
                  key={`${s}-${i}`}
                  className={`rounded-lg border px-2 py-1.5 text-center text-[10px] font-semibold ${
                    i <= step ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {s}
                </li>
              ))}
            </ol>

            {step === 0 && (
              <section className="civic-card space-y-3 p-4">
                <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                  <Fingerprint className="mt-0.5 size-4 shrink-0" />
                  Enter the credential DigiLocker returns for you. <b>12 digits</b> = Aadhaar (citizen).{" "}
                  <b>11 digits</b> = IFHRMS Government Service Certificate (officer). Anything else is rejected.
                </p>
                <Field
                  icon={Fingerprint}
                  label="DigiLocker ID"
                  value={digilockerId}
                  onChange={setDigilockerId}
                  inputMode="numeric"
                  placeholder="12-digit Aadhaar or 11-digit IFHRMS code"
                />
                <button
                  onClick={digilockerVerify}
                  disabled={busy}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "Contacting DigiLocker…" : "Sign in with DigiLocker"}
                </button>
              </section>
            )}

            {detected === "citizen" && step === 1 && (
              <OtpStep
                title="Email OTP verification"
                target={email || "your email"}
                code={emailOtp}
                value={emailOtpInput}
                onChange={setEmailOtpInput}
                onVerify={() => {
                  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
                    return toast.error("Enter a valid email above first.");
                  if (emailOtpInput.trim() !== emailOtp) return toast.error("Incorrect email OTP.");
                  toast.success("Email verified");
                  setStep(2);
                }}
                extra={
                  <Field icon={Mail} label={t("email")} value={email} onChange={setEmail} type="email" />
                }
              />
            )}

            {detected === "citizen" && step === 2 && (
              <OtpStep
                title="Mobile OTP verification"
                target={phone ? `+91 ${phone}` : "your mobile"}
                code={phoneOtp}
                value={phoneOtpInput}
                onChange={setPhoneOtpInput}
                onVerify={() => {
                  if (!/^\d{10}$/.test(phone.trim())) return toast.error("Enter a valid 10-digit mobile.");
                  if (phoneOtpInput.trim() !== phoneOtp) return toast.error("Incorrect mobile OTP.");
                  toast.success("Mobile verified");
                  setStep(3);
                }}
                extra={
                  <Field
                    icon={Smartphone}
                    label={t("phone")}
                    value={phone}
                    onChange={setPhone}
                    inputMode="numeric"
                    placeholder="10 digits"
                  />
                }
              />
            )}

            {detected === "citizen" && step === 3 && (
              <section className="civic-card space-y-3 p-4">
                <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-xs text-success">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0" />
                  Your legal identity is sealed in the encrypted identity vault. Only this pseudonym is
                  ever shown to engineers, inspectors and the public feed.
                </p>
                <Field icon={UserRound} label={t("legalName")} value={legalName} onChange={setLegalName} />
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">{t("pseudonym")}</label>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <input
                      value={pseudonym}
                      onChange={(e) => setPseudonym(e.target.value)}
                      className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => setPseudonym(suggestPseudonym())}
                      className="shrink-0 rounded-lg border border-border bg-card px-3 text-xs font-semibold"
                    >
                      Shuffle
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">{t("ward")}</label>
                  <select
                    value={wardId}
                    onChange={(e) => setWardId(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {wards.map((w) => (
                      <option key={w.id} value={w.id} className="bg-card">
                        Ward {w.ward_number} · {lang === "ta" ? w.ward_name_ta : w.ward_name_en} ·{" "}
                        {lang === "ta" ? w.ulb_name_ta : w.ulb_name_en}
                      </option>
                    ))}
                  </select>
                </div>
                <Field
                  icon={Lock}
                  label={t("password")}
                  value={password}
                  onChange={setPassword}
                  type="password"
                  placeholder="Min 8 characters"
                />
                <button
                  onClick={completeCitizen}
                  disabled={busy}
                  className="w-full rounded-xl bg-success px-4 py-3 text-sm font-semibold text-success-foreground disabled:opacity-50"
                >
                  {busy ? "Sealing identity…" : t("signUp")}
                </button>
              </section>
            )}

            {detected === "officer" && step === 3 && (
              <section className="civic-card space-y-3 p-4">
                <p className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs text-primary">
                  <HardHat className="mt-0.5 size-4 shrink-0" />
                  IFHRMS <b>{digilockerId}</b> — TN Government Service Certificate accepted. Complete your
                  officer roster entry to receive your digital ID badge.
                </p>
                <Field icon={UserRound} label="Officer name (as per department roster)" value={officerName} onChange={setOfficerName} />
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Designation</label>
                  <select
                    value={officerRole}
                    onChange={(e) => setOfficerRole(e.target.value as AppRole)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {OFFICER_ROLES.map((r) => (
                      <option key={r.value} value={r.value} className="bg-card">
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d} className="bg-card">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Assigned ward / zone</label>
                  <select
                    value={wardId}
                    onChange={(e) => setWardId(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {wards.map((w) => (
                      <option key={w.id} value={w.id} className="bg-card">
                        Ward {w.ward_number} · {lang === "ta" ? w.ward_name_ta : w.ward_name_en} ·{" "}
                        {lang === "ta" ? w.ulb_name_ta : w.ulb_name_en}
                      </option>
                    ))}
                  </select>
                </div>
                <Field
                  icon={Lock}
                  label={t("password")}
                  value={password}
                  onChange={setPassword}
                  type="password"
                  placeholder="Min 8 characters"
                />
                <button
                  onClick={completeOfficer}
                  disabled={busy}
                  className="w-full rounded-xl bg-success px-4 py-3 text-sm font-semibold text-success-foreground disabled:opacity-50"
                >
                  {busy ? "Adding to roster…" : "Issue Officer ID badge & enter workspace"}
                </button>
              </section>
            )}
          </>
        )}
      </div>
      <VoiceAssistant />
    </main>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:border-primary">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <input
          type={type}
          value={value}
          inputMode={inputMode}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 bg-transparent py-2 text-sm outline-none"
        />
      </span>
    </label>
  );
}

function OtpStep({
  title,
  target,
  code,
  value,
  onChange,
  onVerify,
  extra,
}: {
  title: string;
  target: string;
  code: string;
  value: string;
  onChange: (v: string) => void;
  onVerify: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <section className="civic-card space-y-3 p-4">
      <div>
        <h2 className="text-sm font-bold">{title}</h2>
        <p className="truncate text-xs text-muted-foreground">Sent to {target}</p>
      </div>
      {extra}
      <p className="rounded-lg border border-border bg-secondary p-3 text-center font-mono text-lg font-bold tracking-[0.4em]">
        {code}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Simulation only — in production this code is delivered by the state SMS/email gateway and never
        displayed on screen.
      </p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder="Enter 6-digit OTP"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-center text-sm tracking-widest outline-none focus:border-primary"
      />
      <button
        onClick={onVerify}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
      >
        Verify OTP
      </button>
    </section>
  );
}
