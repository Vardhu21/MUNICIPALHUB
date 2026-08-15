import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { haversineMeters } from "@/lib/sla";
import { useLang } from "@/lib/i18n";
import { AlertTriangle, X } from "lucide-react";

type Alert = {
  id: string;
  title_en: string;
  title_ta: string;
  lat: number;
  lng: number;
  radius_m: number;
  severity: string;
};

export function EmergencyBanner({ position }: { position: { lat: number; lng: number } | null }) {
  const { lang } = useLang();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("emergency_alerts")
      .select("id,title_en,title_ta,lat,lng,radius_m,severity")
      .gt("expires_at", new Date().toISOString())
      .then(({ data }) => setAlerts((data as Alert[]) ?? []));
  }, []);

  const nearby = useMemo(() => {
    if (!position) return [];
    return alerts.filter(
      (a) => !dismissed.includes(a.id) && haversineMeters(position, { lat: a.lat, lng: a.lng }) <= a.radius_m,
    );
  }, [alerts, position, dismissed]);

  if (nearby.length === 0) return null;

  return (
    <div className="space-y-2">
      {nearby.map((a) => (
        <div
          key={a.id}
          role="alert"
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-destructive/60 bg-destructive/15 px-3 py-2.5"
        >
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-destructive">
              {lang === "ta" ? a.title_ta : a.title_en}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Geofenced push · within {a.radius_m} m of your position
            </p>
          </div>
          <button
            onClick={() => setDismissed((d) => [...d, a.id])}
            aria-label="Dismiss alert"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
