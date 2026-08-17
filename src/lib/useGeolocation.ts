import { useCallback, useEffect, useRef, useState } from "react";

export type GeoFix = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};

export type GeoStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable" | "timeout";

/** Live GPS watcher used by the camera telemetry overlay and geofenced alerts. */
export function useGeolocation(enabled = true) {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<GeoStatus>(enabled ? "requesting" : "idle");
  const [requestVersion, setRequestVersion] = useState(0);
  const hasFixRef = useRef(false);

  const retry = useCallback(() => {
    hasFixRef.current = false;
    setFix(null);
    setError(null);
    setStatus("requesting");
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined") {
      setStatus("idle");
      return;
    }
    if (!navigator.geolocation) {
      setError("This browser does not expose location services.");
      setStatus("unavailable");
      return;
    }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setError("Location needs a secure (https) connection.");
      setStatus("unavailable");
      return;
    }

    let cancelled = false;
    const watchIds: number[] = [];
    let permissionStatus: PermissionStatus | null = null;
    hasFixRef.current = false;
    setStatus("requesting");

    const accept = (p: GeolocationPosition) => {
      if (cancelled) return;
      hasFixRef.current = true;
      setError(null);
      setStatus("ready");
      setFix({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
        timestamp: p.timestamp,
      });
    };

    const reject = (e: GeolocationPositionError) => {
      if (cancelled || hasFixRef.current) return;
      if (e.code === e.PERMISSION_DENIED) {
        setStatus("denied");
        setError("Location permission is blocked. Allow location for this site in the browser address bar, then tap Retry GPS.");
        return;
      }
      if (e.code === e.POSITION_UNAVAILABLE) {
        setStatus("unavailable");
        setError("No device location is available. Turn on Location Services and Wi-Fi, then tap Retry GPS.");
        return;
      }
      setStatus("timeout");
      setError("The device did not return a location. Turn on Location Services and tap Retry GPS.");
    };

    // Ask for a fast network/Wi-Fi fix and a precise device fix in parallel.
    // This avoids waiting for a high-accuracy timeout before trying the fallback.
    navigator.geolocation.getCurrentPosition(accept, reject, {
      enableHighAccuracy: false,
      maximumAge: 300_000,
      timeout: 15_000,
    });
    navigator.geolocation.getCurrentPosition(accept, reject, {
      enableHighAccuracy: true,
      maximumAge: 30_000,
      timeout: 25_000,
    });

    // Keep one low-power watch alive so later fixes and movement update the UI.
    watchIds.push(
      navigator.geolocation.watchPosition(
        accept,
        reject,
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 },
      ),
    );

    // React immediately when location permission changes in browser settings.
    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "geolocation" })
        .then((permission) => {
          if (cancelled) return;
          permissionStatus = permission;
          permission.onchange = () => {
            if (permission.state === "granted") retry();
            if (permission.state === "denied" && !hasFixRef.current) {
              setStatus("denied");
              setError("Location permission is blocked. Allow it in the browser address bar, then tap Retry GPS.");
            }
          };
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
      if (permissionStatus) permissionStatus.onchange = null;
      watchIds.forEach((id) => navigator.geolocation.clearWatch(id));
    };
  }, [enabled, requestVersion, retry]);

  return { fix, error, status, retry };
}
