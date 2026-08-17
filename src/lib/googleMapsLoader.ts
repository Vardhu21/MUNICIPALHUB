/** Loads the Google Maps JS API once per page (browser only). */
let loader: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if (loader) return loader;

  const key = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'] as string | undefined;
  const channel = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID'] as string | undefined;
  if (!key) return Promise.reject(new Error("Google Maps key unavailable"));

  loader = new Promise((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    if ((w['google'] as { maps?: unknown } | undefined)?.maps) {
      resolve(google.maps);
      return;
    }
    const cbName = "__tnInitGoogleMaps";
    w[cbName] = () => resolve(google.maps);
    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&loading=async&callback=${cbName}` +
      (channel ? `&channel=${encodeURIComponent(channel)}` : "");
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return loader;
}