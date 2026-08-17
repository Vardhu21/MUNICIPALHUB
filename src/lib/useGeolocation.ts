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
    if (!enabled || typeof navigator === "undefined") return;
    if (!navigator.geolocation) {
      setError("This browser does not expose location services.");
      return;
    }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setError("Location needs a secure (https) connection.");
      return;
    }

    let cancelled = false;
    const watchIds: number[] = [];

    const accept = (p: GeolocationPosition) => {
      if (cancelled) return;
      setError(null);
      setFix({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
        timestamp: p.timestamp,
      });
    };

    const describe = (e: GeolocationPositionError) => {
      if (e.code === e.PERMISSION_DENIED)
        return "Location permission is blocked. Allow location for this site in the browser address bar, then retry.";
      if (e.code === e.POSITION_UNAVAILABLE)
        return "No location signal available. Turn on device location services and retry.";
      return "Location request timed out. Move near a window or enable Wi-Fi/GPS and retry.";
    };

    // 1) Fast, cached/low-accuracy shot so the UI gets a fix quickly.
    navigator.geolocation.getCurrentPosition(accept, () => undefined, {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 8_000,
    });

    // 2) High-accuracy watch; if it fails, fall back to a low-accuracy watch.
    watchIds.push(
      navigator.geolocation.watchPosition(
        accept,
        (e) => {
          if (cancelled) return;
          setError(describe(e));
          if (e.code === e.PERMISSION_DENIED) return;
          watchIds.push(
            navigator.geolocation.watchPosition(accept, (e2) => !cancelled && setError(describe(e2)), {
              enableHighAccuracy: false,
              maximumAge: 30_000,
              timeout: 30_000,
            }),
          );
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
      ),
    );

    return () => {
      cancelled = true;
      watchIds.forEach((id) => navigator.geolocation.clearWatch(id));
    };
  }, [enabled]);

  return { fix, error };
}
