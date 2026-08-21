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
import { enrolOfficer } from "@/lib/officer.functions";
import { fetchWards, type Ward } from "@/lib/data";
import { VoiceAssistant } from "@/components/VoiceAssistantLazy";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Persona = "citizen" | "officer";
type Step = 0 | 1 | 2 | 3;

const OFFICER_ROLE_KEYS: { value: AppRole; key: string }[] = [
  { value: "field_officer", key: "auth.roleFieldOfficer" },
  { value: "zonal_commissioner", key: "auth.roleZonal" },
  { value: "commissioner", key: "auth.roleCommissioner" },
  { value: "councillor", key: "auth.roleCouncillor" },
];

const DEPARTMENT_KEYS = [
  "auth.deptSanitation",
  "auth.deptEngineering",
  "auth.deptTownPlanning",
  "auth.deptRevenue",
  "auth.deptWaterSupply",
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
  const [department, setDepartment] = useState(DEPARTMENT_KEYS[0]);

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

  const switchAccount = async () => {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setMode("signin");
      setStep(0);
      setDetected(null);
      setSignInId("");
      setSignInPassword("");
      toast.success(t("signOut"));
    } finally {
      setBusy(false);
    }
  };

  const digilockerVerify = () => {
    const raw = digilockerId.trim();
    if (/^\d{11}$/.test(raw)) {
      setDetected("officer");
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        toast.success(t("auth.toast.digilockerOfficerVerified"), {
          description: `${t("auth.toast.ifhrmsVerifiedDesc")} (${raw})`,
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
        toast.success(t("auth.toast.digilockerCitizenVerified"), {
          description: t("auth.toast.aadhaarVerifiedDesc"),
        });
        setStep(1);
      }, 1200);
      return;
    }
    toast.error(t("auth.toast.unrecognisedCredential"), {
      description: t("auth.toast.unrecognisedCredentialDesc"),
    });
  };

  const completeCitizen = async () => {
    if (legalName.trim().length < 2) return toast.error(t("auth.error.legalName"));
    if (!/^\d{10}$/.test(phone.trim())) return toast.error(t("auth.error.mobile10"));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast.error(t("auth.error.validEmail"));
    if (password.length < 8) return toast.error(t("auth.error.password8"));
    if (!/^@[A-Za-z0-9_]{3,24}$/.test(pseudonym))
      return toast.error(t("auth.error.pseudonymFormat"));

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: next ? `${window.location.origin}${next}` : window.location.origin },
      });
      if (error) {
        if (error.code === "user_already_exists") {
          setMode("signin");
          setSignInId(email.trim());
          throw new Error("This account already exists. Sign in with the password used during registration.");
        }
        throw error;
      }
      const uid = data.user?.id;
      if (!uid) throw new Error(t("auth.error.noSession"));

      if (!data.session) {
        toast.success("Check your email to confirm your account", {
          description: "After confirming, return here and sign in to finish registration.",
        });
        setMode("signin");
        setSignInId(email.trim());
        return;
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: uid,
        pseudonym,
        ward_id: wardId || null,
        language: lang,
        digilocker_verified: true,
      });
      if (profileError) throw profileError;
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({ user_id: uid, role: "citizen", ward_id: wardId || null });
      if (roleError) throw roleError;
      await sealIdentity({
        data: { legalName: legalName.trim(), aadhaar: digilockerId.trim(), phone: phone.trim() },
      });

      writeActiveRole("citizen");
      toast.success(t("auth.toast.identitySealed"), {
        description: `${t("auth.toast.identitySealedDesc")} ${pseudonym}.`,
      });
      if (next) window.location.assign(next);
      else navigate({ to: "/feed" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("auth.error.registrationFailed"));
    } finally {
      setBusy(false);
    }
  };

  const completeOfficer = async () => {
    if (officerName.trim().length < 2) return toast.error(t("auth.error.officerName"));
    if (password.length < 8) return toast.error(t("auth.error.password8"));
    if (!wardId) return toast.error(t("auth.error.selectWard"));

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
      if (error) {
        if (error.code === "user_already_exists") {
          setMode("signin");
          setSignInId(emailAddr);
          throw new Error("This officer account already exists. Sign in with the password used during registration.");
        }
        throw error;
      }
      const uid = data.user?.id;
      if (!uid) throw new Error(t("auth.error.accountNotCreated"));
      if (!data.session) {
        toast.success("Check your email to confirm your officer account", {
          description: "After confirming, return here and sign in with your IFHRMS number.",
        });
        setMode("signin");
        setSignInId(digilockerId.trim());
        return;
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: uid,
        pseudonym: `@IFHRMS_${digilockerId.trim()}`,
        ward_id: wardId,
        language: lang,
        digilocker_verified: true,
      });
      if (profileError) throw profileError;
      // Officer grants are server-side: the `user_roles` policy only lets an
      // account self-assign `citizen`. The server fn verifies the signed-in
      // account is the IFHRMS identity before granting.
      // Officers can still act as citizens too — persona toggle in TopBar reads that row.
      await enrolOfficer({
        data: {
          ifhrms: digilockerId.trim(),
          role: officerRole as "field_officer" | "zonal_commissioner" | "commissioner" | "councillor",
          wardId,
        },
      });

      writeActiveRole(officerRole);
      toast.success(t("auth.toast.officerRosterCreated"), {
        description: `${officerName} · IFHRMS ${digilockerId} · ${t(department)}`,
      });
      if (next) window.location.assign(next);
      else navigate({ to: "/officer" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("auth.error.signupFailed"));
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    const raw = signInId.trim();
    if (!raw || signInPassword.length < 6) return toast.error(t("auth.error.enterIdPassword"));
    setBusy(true);
    const email = /^\d{11}$/.test(raw) ? ifhrmsToEmail(raw) : raw;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: signInPassword });
    if (error) {
      setBusy(false);
      return toast.error(
        error.code === "invalid_credentials"
          ? "The email or password is incorrect. Use the same details entered during registration."
          : error.message,
      );
    }

    const uid = data.user?.id;
    if (uid) {
      const isOfficerId = /^\d{11}$/.test(raw);
      const { data: existingProfile, error: profileReadError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", uid)
        .maybeSingle();
      if (profileReadError) {
        setBusy(false);
        return toast.error(profileReadError.message);
      }
      if (!existingProfile) {
        const fallbackPseudonym = isOfficerId
          ? `@IFHRMS_${raw}`
          : `@CivicGuard_${uid.replace(/-/g, "").slice(0, 8)}`;
        const { error: profileCreateError } = await supabase.from("profiles").insert({
          id: uid,
          pseudonym: fallbackPseudonym,
          language: lang,
          digilocker_verified: true,
        });
        if (profileCreateError) {
          setBusy(false);
          return toast.error(profileCreateError.message);
        }
      }

      let { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const officerRoles = ["commissioner", "zonal_commissioner", "field_officer", "councillor"] as const;
      let officer = roles?.map((r) => r.role as AppRole).find((r) => officerRoles.includes(r as typeof officerRoles[number]));
      // Backfill: officer accounts registered before server-side grants exist
      // in auth but hold no officer row. Re-grant from the IFHRMS identity.
      if (!officer && isOfficerId) {
        try {
          await enrolOfficer({ data: { ifhrms: raw, role: "field_officer", wardId: null } });
          const refreshed = await supabase.from("user_roles").select("role").eq("user_id", uid);
          roles = refreshed.data;
          officer = "field_officer";
        } catch {
          /* fall through as citizen */
        }
      }
      if (!roles?.some((entry) => entry.role === "citizen")) {
        const { error: citizenRoleError } = await supabase
          .from("user_roles")
          .insert({ user_id: uid, role: "citizen", ward_id: null });
        if (citizenRoleError) {
          setBusy(false);
          return toast.error(citizenRoleError.message);
        }
      }
      writeActiveRole((officer as AppRole) ?? "citizen");
      toast.success(officer ? t("auth.toast.welcomeOfficer") : t("auth.toast.welcomeBack"));
      if (next) window.location.assign(next);
      else navigate({ to: officer ? "/officer" : "/feed" });
      setBusy(false);
      return;
    }
    if (next) window.location.assign(next);
    else navigate({ to: "/feed" });
    setBusy(false);
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
            <p className="truncate text-xs text-muted-foreground">{t("auth.gatewaySubtitle")}</p>
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
          <span className="min-w-0">{t("auth.gatewayInfo")}</span>
        </div>

        {user ? (
          <section className="civic-card space-y-3 p-4">
            <p className="text-sm font-semibold">{user.email}</p>
            <p className="text-xs text-muted-foreground">{t("auth.gatewaySubtitle")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate({ to: "/feed" })}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
              >
                {t("feed")}
              </button>
              <button
                onClick={switchAccount}
                disabled={busy}
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {t("signOut")}
              </button>
            </div>
          </section>
        ) : null}

        {!user && import.meta.env.DEV ? <DemoBypass returnTo={next} /> : null}

        {!user ? <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
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
              {m === "signup" ? t("auth.registerViaDigilocker") : t("signIn")}
            </button>
          ))}
        </div> : null}

        {!user && mode === "signin" ? (
          <section className="civic-card space-y-3 p-4">
            <Field
              icon={IdCard}
              label={t("auth.emailOrIfhrms")}
              value={signInId}
              onChange={setSignInId}
              placeholder={t("auth.emailOrIfhrmsPlaceholder")}
            />
            <Field icon={Lock} label={t("password")} value={signInPassword} onChange={setSignInPassword} type="password" />
            <button
              onClick={signIn}
              disabled={busy}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "…" : t("signIn")}
            </button>
            <p className="text-[11px] text-muted-foreground">{t("auth.officerIfhrmsNote")}</p>
          </section>
        ) : !user ? (
          <>
            <ol className="grid grid-cols-4 gap-1.5">
              {(detected === "officer"
                ? [t("auth.stepDigilocker"), "—", "—", t("auth.stepOfficerRoster")]
                : [t("auth.stepDigilocker"), t("auth.stepEmailOtp"), t("auth.stepMobileOtp"), t("auth.stepPseudonym")]
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
                  {t("auth.digilockerInstruction")}
                </p>
                <Field
                  icon={Fingerprint}
                  label={t("auth.digilockerIdLabel")}
                  value={digilockerId}
                  onChange={setDigilockerId}
                  inputMode="numeric"
                  placeholder={t("auth.digilockerIdPlaceholder")}
                />
                <button
                  onClick={digilockerVerify}
                  disabled={busy}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? t("auth.contactingDigilocker") : t("auth.signInWithDigilocker")}
                </button>
              </section>
            )}

            {detected === "citizen" && step === 1 && (
              <OtpStep
                title={t("auth.emailOtpTitle")}
                target={email || t("auth.yourEmail")}
                code={emailOtp}
                value={emailOtpInput}
                onChange={setEmailOtpInput}
                onVerify={() => {
                  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
                    return toast.error(t("auth.error.emailOtpFirst"));
                  if (emailOtpInput.trim() !== emailOtp) return toast.error(t("auth.error.incorrectEmailOtp"));
                  toast.success(t("auth.toast.emailVerified"));
                  setStep(2);
                }}
                extra={
                  <Field icon={Mail} label={t("email")} value={email} onChange={setEmail} type="email" />
                }
              />
            )}

            {detected === "citizen" && step === 2 && (
              <OtpStep
                title={t("auth.mobileOtpTitle")}
                target={phone ? `+91 ${phone}` : t("auth.yourMobile")}
                code={phoneOtp}
                value={phoneOtpInput}
                onChange={setPhoneOtpInput}
                onVerify={() => {
                  if (!/^\d{10}$/.test(phone.trim())) return toast.error(t("auth.error.validMobile"));
                  if (phoneOtpInput.trim() !== phoneOtp) return toast.error(t("auth.error.incorrectMobileOtp"));
                  toast.success(t("auth.toast.mobileVerified"));
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
                  {t("auth.identitySealedInfo")}
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
                      {t("auth.shuffle")}
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
                  placeholder={t("auth.minEightChars")}
                />
                <button
                  onClick={completeCitizen}
                  disabled={busy}
                  className="w-full rounded-xl bg-success px-4 py-3 text-sm font-semibold text-success-foreground disabled:opacity-50"
                >
                  {busy ? t("auth.sealingIdentity") : t("signUp")}
                </button>
              </section>
            )}

            {detected === "officer" && step === 3 && (
              <section className="civic-card space-y-3 p-4">
                <p className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs text-primary">
                  <HardHat className="mt-0.5 size-4 shrink-0" />
                  IFHRMS <b>{digilockerId}</b> — {t("auth.ifhrmsAccepted")}
                </p>
                <Field icon={UserRound} label={t("auth.officerNameLabel")} value={officerName} onChange={setOfficerName} />
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">{t("auth.designation")}</label>
                  <select
                    value={officerRole}
                    onChange={(e) => setOfficerRole(e.target.value as AppRole)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {OFFICER_ROLE_KEYS.map((r) => (
                      <option key={r.value} value={r.value} className="bg-card">
                        {t(r.key)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">{t("auth.department")}</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {DEPARTMENT_KEYS.map((d) => (
                      <option key={d} value={d} className="bg-card">
                        {t(d)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">{t("auth.assignedWardZone")}</label>
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
                  placeholder={t("auth.minEightChars")}
                />
                <button
                  onClick={completeOfficer}
                  disabled={busy}
                  className="w-full rounded-xl bg-success px-4 py-3 text-sm font-semibold text-success-foreground disabled:opacity-50"
                >
                  {busy ? t("auth.addingToRoster") : t("auth.issueBadge")}
                </button>
              </section>
            )}
          </>
        ) : null}
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
  const { t } = useLang();
  return (
    <section className="civic-card space-y-3 p-4">
      <div>
        <h2 className="text-sm font-bold">{title}</h2>
        <p className="truncate text-xs text-muted-foreground">{t("auth.sentTo")} {target}</p>
      </div>
      {extra}
      <p className="rounded-lg border border-border bg-secondary p-3 text-center font-mono text-lg font-bold tracking-[0.4em]">
        {code}
      </p>
      <p className="text-[11px] text-muted-foreground">{t("auth.otpSimulationNote")}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder={t("auth.enterOtpPlaceholder")}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-center text-sm tracking-widest outline-none focus:border-primary"
      />
      <button
        onClick={onVerify}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
      >
        {t("auth.verifyOtp")}
      </button>
    </section>
  );
}
