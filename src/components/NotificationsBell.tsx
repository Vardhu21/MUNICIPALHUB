import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, FileSpreadsheet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useLang } from "@/lib/i18n";

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string;
  report_id: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useSession();
  const { lang, t } = useLang();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    load();
    // Realtime: new notifications for this user.
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setItems((prev) => [payload.new as Notif, ...prev].slice(0, 20)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = useMemo(() => items.filter((i) => !i.read_at).length, [items]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read_at: new Date().toISOString() } : i)));
  };

  const markAll = async () => {
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: new Date().toISOString() })));
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("nav.notifications")}
        className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[16px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-sm font-bold">
                {t("nav.notifications")}
                {unread > 0 && <span className="ml-1 text-muted-foreground">({unread})</span>}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={markAll}
                  disabled={unread === 0}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
                >
                  {t("notif.markAllRead")}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label={t("action.close")}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {items.length === 0 && (
                <p className="p-6 text-center text-xs text-muted-foreground">
                  {t("notif.empty")}
                </p>
              )}
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0 ${
                    n.read_at ? "opacity-70" : "bg-primary/5"
                  }`}
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                    <FileSpreadsheet className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{n.title}</p>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">{n.body}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                      {n.report_id && (
                        <Link
                          to="/reports"
                          onClick={() => {
                            markRead(n.id);
                            setOpen(false);
                          }}
                          className="font-semibold text-primary hover:underline"
                        >
                          {t("notif.download")}
                        </Link>
                      )}
                      {!n.read_at && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="font-semibold text-primary hover:underline"
                        >
                          {t("notif.markRead")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
