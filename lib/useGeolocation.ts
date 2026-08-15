import { useEffect, useState } from "react";

export type GeoFix = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};

/** Live GPS watcher used by the camera telemetry overlay and geofenced alerts. */
export function useGeolocation(enabled = true) {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setFix({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          timestamp: p.timestamp,
        }),
      (e) => setError(e.message),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { fix, error };
}
