import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { IdCard, Languages, LogOut, Menu, ShieldCheck, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { ALL_ROLES, ROLE_LABEL, useActiveRole, useSession, type AppRole } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsBell } from "@/components/NotificationsBell";
import { OfficerBadge } from "@/components/OfficerBadge";
import emblem from "@/assets/tn-emblem.png";

const NAV: { to: string; key: "feed" | "report" | "dashboard" | "judicial" | "analytics" | "officer" | "reports" }[] = [
  { to: "/feed", key: "feed" },
  { to: "/report", key: "report" },
  { to: "/dashboard", key: "dashboard" },
  { to: "/analytics", key: "analytics" },
  { to: "/reports", key: "reports" },
  { to: "/officer", key: "officer" },
  { to: "/oversight", key: "judicial" },
];

type NavKey = "feed" | "report" | "dashboard" | "judicial" | "analytics" | "officer" | "reports";
function navLabel(key: NavKey, lang: "en" | "ta", t: (k: "feed" | "report" | "dashboard") => string) {
  if (key === "judicial") return lang === "ta" ? "மேற்பார்வை" : "Oversight";
  if (key === "analytics") return lang === "ta" ? "பகுப்பாய்வு" : "Analytics";
  if (key === "reports") return lang === "ta" ? "அறிக்கைகள்" : "Reports";
  if (key === "officer") return lang === "ta" ? "அலுவலர்" : "Officer";
  return t(key);
}

const OFFICER_ROLES: AppRole[] = ["field_officer", "zonal_commissioner", "commissioner", "councillor", "admin"];

export function TopBar() {
  const { t, lang, toggle } = useLang();
  const [role, setRole] = useActiveRole();
  const { user } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [trueOfficerRole, setTrueOfficerRole] = useState<AppRole | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Discover whether the signed-in user actually has an officer role on record.
  // This drives the persona toggle + digital badge availability.
  useEffect(() => {
    if (!user) {
      setTrueOfficerRole(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const officer = data
          ?.map((r) => r.role as AppRole)
          .find((r) => OFFICER_ROLES.includes(r));
        setTrueOfficerRole(officer ?? null);
      });
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const inCitizenPersona = role === "citizen";
  const togglePersona = () => {
    if (!trueOfficerRole) return;
    setRole(inCitizenPersona ? trueOfficerRole : "citizen");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <img src={emblem} alt="" className="size-9 shrink-0 rounded-lg" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold leading-tight">{t("appName")}</span>
            <span className="block truncate text-[11px] leading-tight text-muted-foreground">
              {t("appTagline")}
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname.startsWith(n.to)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {navLabel(n.key, lang, t)}
              </Link>
            ))}
          </nav>

          {/* Persona toggle — only for verified officers. Swaps between their true
              officer role and a citizen persona (@CivicGuard_XX). */}
          {trueOfficerRole && (
            <div
              className="hidden overflow-hidden rounded-lg border border-primary/40 bg-primary/5 text-[11px] font-semibold sm:flex"
              role="group"
              aria-label="Persona"
            >
              <button
                onClick={() => setRole(trueOfficerRole)}
                className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                  !inCitizenPersona ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary/10"
                }`}
              >
                <ShieldCheck className="size-3.5" /> Officer
              </button>
              <button
                onClick={() => setRole("citizen")}
                className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                  inCitizenPersona ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary/10"
                }`}
              >
                <UserRound className="size-3.5" /> Citizen
              </button>
            </div>
          )}

          {/* Fallback role selector for demo mode when the account has no officer role. */}
          {!trueOfficerRole && (
            <label className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 sm:flex">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" />
              <span className="sr-only">{t("role")}</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                className="max-w-[13rem] bg-transparent text-xs font-semibold outline-none"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r} className="bg-card text-foreground">
                    {ROLE_LABEL[r][lang]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Digital Officer ID Badge — visible only to real officers. */}
          {trueOfficerRole && (
            <button
              onClick={() => setBadgeOpen(true)}
              aria-label="View Officer ID Badge"
              className="hidden items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/15 sm:flex"
            >
              <IdCard className="size-3.5" /> ID Badge
            </button>
          )}

          <button
            onClick={toggle}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
          >
            <Languages className="size-3.5" />
            {t("language")}
          </button>

          <NotificationsBell />

          {user && (
            <button
              onClick={signOut}
              aria-label={t("signOut")}
              className="hidden rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              <LogOut className="size-4" />
            </button>
          )}

          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            className="rounded-lg border border-border bg-card p-2 lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border px-4 py-3 lg:hidden">
          <nav className="grid gap-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {navLabel(n.key, lang, t)}
              </Link>
            ))}
          </nav>
          {trueOfficerRole && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={togglePersona}
                className="flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
              >
                {inCitizenPersona ? <ShieldCheck className="size-3.5" /> : <UserRound className="size-3.5" />}
                Switch to {inCitizenPersona ? "Officer" : "Citizen"} persona
              </button>
              <button
                onClick={() => {
                  setBadgeOpen(true);
                  setOpen(false);
                }}
                className="flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
              >
                <IdCard className="size-3.5" /> ID Badge
              </button>
            </div>
          )}
          {!trueOfficerRole && (
            <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r} className="bg-card text-foreground">
                    {ROLE_LABEL[r][lang]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {user && (
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold"
            >
              <LogOut className="size-4" /> {t("signOut")}
            </button>
          )}
        </div>
      )}

      <OfficerBadge
        open={badgeOpen}
        onClose={() => setBadgeOpen(false)}
        userId={user?.id ?? null}
        role={trueOfficerRole ?? "field_officer"}
      />
    </header>
  );
}
