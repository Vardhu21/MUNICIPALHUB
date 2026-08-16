import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { citizenDecision, myVerificationRequests } from "@/lib/workflow.functions";
import { useLang } from "@/lib/i18n";

type Item = Awaited<ReturnType<typeof myVerificationRequests>>[number];

/** "Has your issue been resolved?" card shown inside the citizen dashboard. */
export function CitizenVerificationPanel() {
  const { lang } = useLang();
  const load = useServerFn(myVerificationRequests);
  const decide = useServerFn(citizenDecision);
  const [items, setItems] = useState<Item[]>([]);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  const refresh = useCallback(() => {
    load({ data: undefined } as never)
      .then((rows) => setItems(rows as Item[]))
      .catch(() => setItems([]));
  }, [load]);

  useEffect(refresh, [refresh]);

  if (!items.length) return null;

  const answer = async (verificationId: string, satisfied: boolean) => {
    if (!satisfied && (!reason.trim() || !photo)) {
      setReasonFor(verificationId);
      if (reason.trim() && !photo) {
        toast.error(
          lang === "ta"
            ? "தயவுசெய்து தற்போதைய நிலையின் புகைப்படத்தை இணைக்கவும்."
            : "Please attach an evidence photo of the current condition.",
        );
      }
      return;
    }
    setBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition | null>((resolve) =>
        navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 8000 })
          : resolve(null),
      );
      if (!satisfied && !pos && !locationDenied) {
        setLocationDenied(true);
        setBusy(false);
        toast.error(
          lang === "ta"
            ? "இந்தச் சான்றை சரிபார்க்க இருப்பிட அனுமதி தேவை."
            : "Location permission is required to verify this evidence.",
        );
        return;
      }
      const res = await decide({
        data: {
          verificationId,
          satisfied,
          reason: satisfied ? undefined : reason,
          photoDataUrl: satisfied ? undefined : (photo ?? undefined),
          lat: pos?.coords.latitude,
          lng: pos?.coords.longitude,
          accuracyM: pos?.coords.accuracy,
          locationUnavailable: !satisfied && !pos,
        },
      });
      const state = (res as { gpsState?: string } | undefined)?.gpsState;
      if (satisfied) {
        toast.success(
          lang === "ta"
            ? "நன்றி — புகார் தீர்க்கப்பட்டதாக பதிவு செய்யப்பட்டது."
            : "Thank you — the complaint is marked resolved.",
        );
      } else if (state === "CITIZEN_GPS_FLAGGED") {
        toast.warning(
          lang === "ta"
            ? "சான்றின் இருப்பிடம் அசல் புகார் இருப்பிடத்துடன் பொருந்தவில்லை. அலுவலர் மறுஆய்வுக்காக குறிக்கப்பட்டது."
            : "The evidence location does not match the original complaint location. It has been flagged for officer review.",
        );
      } else if (state === "LOCATION_UNAVAILABLE") {
        toast.warning(
          lang === "ta"
            ? "இருப்பிடம் கிடைக்கவில்லை — அலுவலர் மறுஆய்வுடன் சமர்ப்பிக்கப்பட்டது."
            : "Location unavailable — submitted for officer review without GPS verification.",
        );
      } else {
        toast.success(
          lang === "ta"
            ? "புகார் மீண்டும் திறக்கப்பட்டது."
            : "The complaint has been reopened for officer review.",
        );
      }
      setReason("");
      setPhoto(null);
      setReasonFor(null);
      setLocationDenied(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit your response.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      {items.map(({ verification, complaint, imageUrl, evidence }) => (
        <article key={verification.id} className="civic-card space-y-3 border-primary/40 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="size-4 text-primary" />
            {lang === "ta" ? "உங்கள் பிரச்சினை தீர்க்கப்பட்டதா?" : "Has your issue been resolved?"}
          </h3>
          <p className="text-xs text-muted-foreground">{complaint?.title}</p>
          {imageUrl && <img src={imageUrl} alt="" className="max-h-56 w-full rounded-xl object-cover" />}
          {evidence?.description && <p className="text-xs text-muted-foreground">{evidence.description}</p>}
          <p className="text-[11px] text-muted-foreground">
            {lang === "ta" ? "பதில் காலக்கெடு" : "Respond before"}: {new Date(verification.deadline_at).toLocaleString()}
          </p>

          {reasonFor === verification.id && (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={lang === "ta" ? "என்ன இன்னும் சரி செய்யப்படவில்லை?" : "What is still unresolved?"}
                className="w-full rounded-xl border border-input bg-background p-2 text-xs outline-none focus:border-primary"
                rows={3}
              />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => setPhoto(String(reader.result));
                  reader.readAsDataURL(f);
                }}
                className="w-full text-[11px]"
              />
              <p className="text-[11px] text-muted-foreground">
                {lang === "ta"
                  ? "தேவை: தற்போதைய நிலையைக் காட்டும் புகைப்படம் மற்றும் இருப்பிட அனுமதி."
                  : "Required: a photo of the current condition and location permission."}
              </p>
              {locationDenied && (
                <p className="text-[11px] font-semibold text-destructive">
                  {lang === "ta"
                    ? "இருப்பிடம் கிடைக்கவில்லை. மீண்டும் அழுத்தினால், அலுவலர் மறுஆய்வுக்காக இருப்பிடம் இல்லாமல் சமர்ப்பிக்கப்படும்."
                    : "Location permission is required to verify this evidence. Press again to submit without GPS — it will require officer review."}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() => answer(verification.id, true)}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <ThumbsUp className="size-3.5" /> {lang === "ta" ? "திருப்தி" : "Satisfied"}
            </button>
            <button
              disabled={busy}
              onClick={() => answer(verification.id, false)}
              className="flex items-center gap-1.5 rounded-full border border-destructive/50 px-4 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50"
            >
              <ThumbsDown className="size-3.5" /> {lang === "ta" ? "திருப்தி இல்லை" : "Not satisfied"}
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
