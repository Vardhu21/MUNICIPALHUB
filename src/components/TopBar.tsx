import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { IdCard, Languages, LogOut, Menu, ShieldCheck, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { OFFICER_ROLES, ROLE_LABEL, useAuthorizedRole, type AppRole } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsBell } from "@/components/NotificationsBell";
import { OfficerBadge } from "@/components/OfficerBadge";
import emblem from "@/assets/tn-emblem.png";

const NAV: {
  to: string;
  key: "feed" | "report" | "dashboard" | "analytics" | "officer" | "reports" | "worker" | "directory";
  allow: AppRole[];
}[] = [
  { to: "/feed", key: "feed", allow: ["citizen", "worker", ...OFFICER_ROLES] },
  { to: "/report", key: "report", allow: ["citizen", ...OFFICER_ROLES] },
  { to: "/dashboard", key: "dashboard", allow: ["citizen", "worker", ...OFFICER_ROLES] },
  { to: "/directory", key: "directory", allow: ["citizen", "worker", ...OFFICER_ROLES] },
  { to: "/analytics", key: "analytics", allow: ["citizen", ...OFFICER_ROLES] },
  { to: "/reports", key: "reports", allow: ["citizen", ...OFFICER_ROLES] },
  { to: "/officer", key: "officer", allow: OFFICER_ROLES },
  { to: "/worker", key: "worker", allow: ["worker", "admin"] },
];

type NavKey = "feed" | "report" | "dashboard" | "analytics" | "officer" | "reports" | "worker" | "directory";
function navLabel(key: NavKey, t: (k: string) => string) {
  if (key === "analytics") return t("nav.analytics");
  if (key === "reports") return t("nav.reports");
  if (key === "officer") return t("nav.officer");
  if (key === "worker") return t("nav.worker");
  if (key === "directory") return t("nav.directory");
  return t(key);
}

export function TopBar() {
  const { t, lang, toggle } = useLang();
  const { role, setRole, roles, user } = useAuthorizedRole();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const trueOfficerRole = roles.find((r) => OFFICER_ROLES.includes(r)) ?? null;
  const visibleNav = NAV.filter((n) => n.allow.some((a) => roles.includes(a)));

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
            {visibleNav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname.startsWith(n.to)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {navLabel(n.key, t)}
              </Link>
            ))}
          </nav>

          {/* Persona toggle — only for verified officers. Swaps between their true
              officer role and a citizen persona (@CivicGuard_XX). */}
          {trueOfficerRole && (
            <div
              className="hidden overflow-hidden rounded-lg border border-primary/40 bg-primary/5 text-[11px] font-semibold sm:flex"
              role="group"
              aria-label={t("nav.persona")}
            >
              <button
                onClick={() => setRole(trueOfficerRole)}
                className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                  !inCitizenPersona ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary/10"
                }`}
              >
                <ShieldCheck className="size-3.5" /> {t("nav.officerPersona")}
              </button>
              <button
                onClick={() => setRole("citizen")}
                className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                  inCitizenPersona ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary/10"
                }`}
              >
                <UserRound className="size-3.5" /> {t("nav.citizenPersona")}
              </button>
            </div>
          )}

          {/* Role selector — restricted to the roles this account actually holds. */}
          {!trueOfficerRole && roles.length > 1 && (
            <label className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 sm:flex">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" />
              <span className="sr-only">{t("role")}</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                className="max-w-[13rem] bg-transparent text-xs font-semibold outline-none"
              >
                {roles.map((r) => (
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
              aria-label={t("nav.viewBadge")}
              className="hidden items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/15 sm:flex"
            >
              <IdCard className="size-3.5" /> {t("nav.idBadge")}
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
            aria-label={t("nav.menu")}
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
                {navLabel(n.key, t)}
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
                {t("nav.switchPersona")} · {inCitizenPersona ? t("nav.officerPersona") : t("nav.citizenPersona")}
              </button>
              <button
                onClick={() => {
                  setBadgeOpen(true);
                  setOpen(false);
                }}
                className="flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
              >
                <IdCard className="size-3.5" /> {t("nav.idBadge")}
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
