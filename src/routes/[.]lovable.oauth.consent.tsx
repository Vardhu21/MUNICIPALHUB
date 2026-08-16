import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Bot, Check, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import emblem from "@/assets/tn-emblem.png";

type OAuthClient = { name?: string };
type AuthorizationDetails = { client?: OAuthClient; redirect_url?: string; redirect_to?: string };
type OAuthResult = { data?: { redirect_url?: string; redirect_to?: string } | null; error?: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data?: AuthorizationDetails | null; error?: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

export const oauthApi: OAuthApi = (supabase.auth as typeof supabase.auth & { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id: typeof search.authorization_id === "string" ? search.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization request.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = `${location.pathname}${location.searchStr}`;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data ?? null;
  },
  head: () => ({
    meta: [
      { title: "Authorize Agent — Community Hub Connect" },
      { name: "description", content: "Review and authorize an AI agent connection to TN SmartMunicipality." },
      { property: "og:title", content: "Authorize Agent — Community Hub Connect" },
      { property: "og:description", content: "Securely connect an external AI assistant to municipal complaint tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="civic-card w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-bold">Authorization unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{String(error instanceof Error ? error.message : error)}</p>
        <Button asChild variant="outline" className="mt-5"><a href="/auth">Return to sign in</a></Button>
      </section>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id: authorizationId } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "AI assistant";

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const result = approve
      ? await oauthApi().approveAuthorization(authorizationId)
      : await oauthApi().denyAuthorization(authorizationId);
    if (result.error) {
      setBusy(null);
      setError(result.error.message);
      return;
    }
    const target = result.data?.redirect_url ?? result.data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("The authorization server did not return a client redirect.");
      return;
    }
    window.location.assign(target);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src={emblem} alt="Tamil Nadu state emblem" className="size-12" />
          <div><p className="font-display text-base font-bold">Community Hub Connect</p><p className="text-xs text-muted-foreground">TN SmartMunicipality agent authorization</p></div>
        </div>
        <div className="civic-card overflow-hidden shadow-[var(--shadow-elevated)]">
          <div className="border-b border-border bg-surface-2 p-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15 text-primary"><Bot className="size-6" /></span>
            <h1 className="mt-4 text-xl font-bold">Connect {clientName}?</h1>
            <p className="mt-2 text-sm text-muted-foreground">The agent will act with your municipal account permissions.</p>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex gap-3 rounded-lg border border-border bg-background p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" /><div><h2 className="text-sm font-semibold">What it can access</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Complaint search and audit history; officer health-risk queues and status updates only for officer accounts; SLA analytics only for authorized oversight roles.</p></div></div>
            <p className="text-xs leading-5 text-muted-foreground">Sealed Aadhaar, phone, and legal identity records are not exposed. Existing database permissions remain enforced for every tool call.</p>
            {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" disabled={busy !== null} onClick={() => decide(false)}><X />Deny</Button>
              <Button disabled={busy !== null} onClick={() => decide(true)}><Check />{busy === "approve" ? "Connecting…" : "Approve"}</Button>
            </div>
          </div>
        </div>
        <a href="/" className="mx-auto mt-5 flex w-fit items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Back to portal</a>
      </section>
    </main>
  );
}