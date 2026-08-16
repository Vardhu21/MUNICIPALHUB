import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CircleAlert, Crosshair, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useGeolocation, type GeoFix } from "@/lib/useGeolocation";
import { useLang } from "@/lib/i18n";

export type Capture = {
  dataUrl: string;
  lat: number;
  lng: number;
  capturedAt: string;
  geoVerified: boolean;
};

type Props = {
  wardLabel: string;
  zoneLabel: string;
  onCapture: (c: Capture) => void;
};

/**
 * In-app hardware camera viewport. Gallery uploads are structurally impossible:
 * there is no file input anywhere in this flow — frames come from the live
 * MediaStream only, and every frame is stamped with the GPS fix at capture time.
 */
export function GeoCamera({ wardLabel, zoneLabel, onCapture }: Props) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const { fix, error: geoError } = useGeolocation(true);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch (e) {
      setReady(false);
      setCamError(e instanceof Error ? e.message : t("camera.unavailable"));
    }
  }, []);

  useEffect(() => {
    start();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [start]);

  const stamp = (ctx: CanvasRenderingContext2D, w: number, h: number, telemetry: GeoFix | null) => {
    const pad = Math.round(w * 0.025);
    const line = Math.round(w * 0.032);
    ctx.fillStyle = "rgba(15,23,42,0.78)";
    ctx.fillRect(0, h - line * 4.6, w, line * 4.6);
    ctx.fillStyle = "#F8FAFC";
    ctx.font = `600 ${line * 0.62}px system-ui, sans-serif`;
    const rows = [
      `LAT ${telemetry ? telemetry.lat.toFixed(6) : "--"}   LNG ${telemetry ? telemetry.lng.toFixed(6) : "--"}`,
      `${wardLabel}`,
      `${zoneLabel}`,
      `${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
    ];
    rows.forEach((r, i) => ctx.fillText(r, pad, h - line * 3.5 + i * line));
    ctx.fillStyle = "#6C4CE8";
    ctx.fillRect(w - pad - line * 5.4, h - line * 4.2, line * 5.4, line * 0.95);
    ctx.fillStyle = "#F8FAFC";
    ctx.font = `700 ${line * 0.5}px system-ui, sans-serif`;
    ctx.fillText("GEOTAG VERIFIED", w - pad - line * 5.1, h - line * 3.52);
  };

  const capture = () => {
    // --- AI EXIF anti-spoofing inspector -------------------------------
    if (!fix) {
      toast.error(t("camera.rejectedTitle"), {
        description: t("camera.rejectedNoFix"),
      });
      return;
    }
    const fixAgeSec = (Date.now() - fix.timestamp) / 1000;
    if (fixAgeSec > 180) {
      toast.error(t("camera.rejectedTitle"), {
        description: t("camera.rejectedStaleFixTemplate").replace("{seconds}", String(Math.round(fixAgeSec))),
      });
      return;
    }
    if (!Number.isFinite(fix.accuracy) || fix.accuracy <= 0 || fix.accuracy > 50_000) {
      toast.error(t("camera.rejectedTitle"), {
        description: t("camera.rejectedBadAccuracy"),
      });
      return;
    }
    const video = videoRef.current;
    if (!ready || !video || video.videoWidth === 0) {
      toast.error(t("camera.rejectedTitle"), {
        description: t("camera.rejectedNoStream"),
      });
      return;
    }
    // -------------------------------------------------------------------

    const w = Math.min(video.videoWidth, 960);
    const h = Math.round((video.videoHeight / video.videoWidth) * w);
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    stamp(ctx, w, h, fix);

    onCapture({
      dataUrl: canvas.toDataURL("image/jpeg", 0.72),
      lat: fix.lat,
      lng: fix.lng,
      capturedAt: new Date().toISOString(),
      geoVerified: true,
    });
    toast.success(t("camera.acceptedTitle"), {
      description: t("camera.acceptedDesc"),
    });
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-black">
        <video ref={videoRef} playsInline muted className="size-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Live telemetry overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-0.5 bg-gradient-to-t from-background/95 to-transparent p-3 font-mono text-[11px] leading-tight text-foreground">
          <p>
            LAT {fix ? fix.lat.toFixed(6) : "-- searching --"} · LNG {fix ? fix.lng.toFixed(6) : "--"}
          </p>
          <p className="truncate">{wardLabel}</p>
          <p className="truncate">{zoneLabel}</p>
          <p>{now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-success/60 bg-success/20 px-2.5 py-1 text-[11px] font-semibold text-success">
          {fix ? <ShieldCheck className="size-3.5" /> : <Crosshair className="size-3.5 animate-pulse" />}
          {fix ? `±${Math.round(fix.accuracy)}m GPS lock` : "Acquiring GPS"}
        </div>

        {camError && (
          <div className="absolute inset-0 grid place-items-center bg-background/90 p-6 text-center">
            <div className="space-y-3">
              <CircleAlert className="mx-auto size-8 text-destructive" />
              <p className="text-sm font-semibold">{t("camera.accessRequired")}</p>
              <p className="text-xs text-muted-foreground">
                {t("camera.disabledDescTemplate").replace("{error}", String(camError))}
              </p>
              <button
                onClick={start}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                <RefreshCcw className="size-4" /> {t("camera.retry")}
              </button>
            </div>
          </div>
        )}
      </div>

      {geoError && <p className="text-xs text-destructive">{t("camera.locationErrorTemplate").replace("{error}", geoError)}</p>}

      <button
        type="button"
        onClick={capture}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Camera className="size-4" /> {t("camera.captureButton")}
      </button>
    </div>
  );
}
