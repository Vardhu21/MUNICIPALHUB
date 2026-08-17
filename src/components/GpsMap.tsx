import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";

type Props = {
  lat: number | null;
  lng: number | null;
  accuracy?: number | null;
  label?: string;
  className?: string;
};

/** Live Google Map pin for the current GPS fix / captured evidence location. */
export function GpsMap({ lat, lng, accuracy, label, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (lat == null || lng == null) return;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !hostRef.current) return;
        const center = { lat, lng };
        if (!mapRef.current) {
          mapRef.current = new maps.Map(hostRef.current, {
            center,
            zoom: 17,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
          });
          markerRef.current = new maps.Marker({ map: mapRef.current, position: center, title: label });
          circleRef.current = new maps.Circle({
            map: mapRef.current,
            center,
            radius: accuracy && accuracy > 0 ? accuracy : 25,
            strokeColor: "#6C4CE8",
            strokeOpacity: 0.7,
            strokeWeight: 1,
            fillColor: "#6C4CE8",
            fillOpacity: 0.15,
          });
        } else {
          mapRef.current.setCenter(center);
          markerRef.current?.setPosition(center);
          circleRef.current?.setCenter(center);
          circleRef.current?.setRadius(accuracy && accuracy > 0 ? accuracy : 25);
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Map unavailable"));

    return () => {
      cancelled = true;
    };
  }, [lat, lng, accuracy, label]);

  if (lat == null || lng == null) {
    return (
      <div className={`grid h-44 place-items-center rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground ${className ?? ""}`}>
        Acquiring GPS fix…
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <div ref={hostRef} className="h-44 w-full overflow-hidden rounded-xl border border-border" />
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : (
        <p className="font-mono text-[11px] text-muted-foreground">
          {lat.toFixed(6)}, {lng.toFixed(6)}
          {accuracy ? ` · ±${Math.round(accuracy)}m` : ""}
        </p>
      )}
    </div>
  );
}