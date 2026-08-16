import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { TopBar } from "@/components/TopBar";
import { EmblemLoader } from "@/components/EmblemLoader";
import { useLang } from "@/lib/i18n";
import { useAuthorizedRole, type AppRole } from "@/lib/session";

/**
 * Client-side role gate. Authorization is read from Supabase `user_roles`
 * (never from the UI role selector). Server functions re-check the caller's
 * role independently — this only keeps unauthorised UI off the screen.
 */
export function RoleGate({ allow, children }: { allow: AppRole[]; children: React.ReactNode }) {
  const { roles, loading, user } = useAuthorizedRole();
  const { lang } = useLang();
  const navigate = useNavigate();
  const permitted = roles.some((r) => allow.includes(r));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (!permitted) navigate({ to: "/dashboard", replace: true });
  }, [loading, permitted, user, navigate]);

  if (loading || !permitted) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <EmblemLoader
            label={
              loading
                ? lang === "ta"
                  ? "அணுகல் சரிபார்க்கப்படுகிறது"
                  : "Checking your access"
                : lang === "ta"
                  ? "அனுமதி இல்லை — முகப்புக்கு திருப்பப்படுகிறது"
                  : "Not authorised — returning to your dashboard"
            }
          />
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
