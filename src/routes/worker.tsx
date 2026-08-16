import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, HardHat, MapPin, Navigation, PlayCircle, Radar } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { EmblemLoader } from "@/components/EmblemLoader";
import { RoleGate } from "@/components/RoleGate";
import { DeliveryTracker } from "@/components/DeliveryTracker";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { readExifGps } from "@/lib/exif";
import { formatMetres } from "@/lib/workflow";
import {
  acceptAssignment,
  acceptNearbyComplaint,
  myAssignments,
  nearbyComplaints,
  pingWorkerLocation,
  registerWorker,
  startTravel,
  startWork,
  submitEvidence,
} from "@/lib/workflow.functions";
import { CATEGORIES } from "@/lib/sla";

export const Route = createFileRoute("/worker")({
  head: () => ({
    meta: [
      { title: "Worker Field Console — TN SmartMunicipality" },
      {
        name: "description",
        content:
          "Municipal worker console with delivery-style task tracking, geofenced arrival detection, completion evidence upload and nearby unresolved complaints.",
      },
      { property: "og:title", content: "Worker Field Console — TN SmartMunicipality" },
      {
        property: "og:description",
        content: "Accept assignments, travel, arrive inside the geofence and upload verified completion evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkerRoute,
});

function WorkerRoute() {
  return (
    <RoleGate allow={["worker", "admin"]}>
      <WorkerConsole />
    </RoleGate>
  );
}

type Item = Awaited<ReturnType<typeof myAssignments>>["items"][number];
const ACTIVE_STAGES = ["assigned", "worker_accepted", "travelling", "approaching", "arrived", "in_progress"];

function WorkerConsole() {
  const { lang } = useLang();
  const { user, loading: sessionLoading } = useSession();
  const load = useServerFn(myAssignments);
  const enrol = useServerFn(registerWorker);
  const accept = useServerFn(acceptAssignment);
  const travel = useServerFn(startTravel);
  const ping = useServerFn(pingWorkerLocation);
  const begin = useServerFn(startWork);
  const upload = useServerFn(submitEvidence);
  const findNearby = useServerFn(nearbyComplaints);
  const pickup = useServerFn(acceptNearbyComplaint);

  const [items, setItems] = useState<Item[]>([]);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [distances, setDistances] = useState<Record<string, number>>({});
  const [nearby, setNearby] = useState<{ id: string; title: string; category: string; distance_m: number }[]>([]);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("general");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await load({ data: undefined } as never);
      setHasProfile(!!res.worker);
      setItems(res.items as Item[]);
    } catch {
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    if (!sessionLoading && user) refresh();
    if (!sessionLoading && !user) setLoading(false);
  }, [sessionLoading, user, refresh]);

  const active = useMemo(
    () => items.find((i) => ACTIVE_STAGES.includes(i.assignment.stage) && i.assignment.active),
    [items],
  );

  /** Location is only sampled while an assignment is actively being worked. */
  useEffect(() => {
    if (!active || !navigator.geolocation) return;
    if (!["worker_accepted", "travelling", "approaching", "arrived"].includes(active.assignment.stage)) return;
    let stop = false;
    const sample = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (stop) return;
          try {
            const res = await ping({
              data: {
                assignmentId: active.assignment.id,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              },
            });
            if (res.distance_m != null) setDistances((p) => ({ ...p, [active.assignment.id]: res.distance_m! }));
            if (res.stage && res.stage !== active.assignment.stage) refresh();
          } catch {
            /* transient */
          }
        },
        () => undefined,
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
      );
    };
    sample();
    const id = window.setInterval(sample, 20_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [active, ping, refresh]);

  const currentPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation
        ? navigator.geolocation.getCurrentPosition(
            resolve,
            () =>
              reject(
                new Error(
                  lang === "ta"
                    ? "இருப்பிட அனுமதி தேவை — சான்று புகார் இடத்தில் எடுக்கப்பட்டதா என்பதை சரிபார்க்க GPS அவசியம்."
                    : "Location permission is required — GPS proves the evidence was captured at the complaint location.",
                ),
              ),
            { enableHighAccuracy: true, timeout: 12_000 },
          )
        : reject(new Error("Geolocation is unavailable on this device.")),
    );

  const runNearby = async () => {
    try {
      const pos = await currentPosition();
      const rows = await findNearby({
        data: { lat: pos.coords.latitude, lng: pos.coords.longitude, excludeId: active?.complaint?.id ?? null },
      });
      setNearby(rows as typeof nearby);
      if (!(rows as unknown[]).length) toast.info(lang === "ta" ? "அருகில் புகார்கள் இல்லை." : "No nearby unresolved complaints.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Location permission is required.");
    }
  };

  const doEnrol = async () => {
    if (name.trim().length < 2) return;
    setBusy("enrol");
    try {
      await enrol({ data: { displayName: name.trim(), department } });
      toast.success(lang === "ta" ? "பணியாளராக பதிவு செய்யப்பட்டது." : "Enrolled as a municipal worker.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enrolment failed.");
    } finally {
      setBusy(null);
    }
  };

  const act = async (id: string, fn: (a: { data: { assignmentId: string } }) => Promise<unknown>, msg: string) => {
    setBusy(id);
    try {
      await fn({ data: { assignmentId: id } });
      toast.success(msg);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const onEvidenceFile = async (assignmentId: string, file: File) => {
    setBusy(assignmentId);
    try {
      const [pos, exif, dataUrl] = await Promise.all([
        currentPosition(),
        readExifGps(file),
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read the image."));
          reader.readAsDataURL(file);
        }),
      ]);
      await upload({
        data: {
          assignmentId,
          imageDataUrl: dataUrl,
          description: note,
          workerLat: pos.coords.latitude,
          workerLng: pos.coords.longitude,
          exifLat: exif?.lat ?? null,
          exifLng: exif?.lng ?? null,
        },
      });
      toast.success(
        exif
          ? lang === "ta"
            ? "சான்று சமர்ப்பிக்கப்பட்டது (EXIF GPS உடன்)."
            : "Evidence submitted with photo GPS."
          : lang === "ta"
            ? "சான்று சமர்ப்பிக்கப்பட்டது — EXIF GPS இல்லை, நேரடி GPS பயன்படுத்தப்பட்டது."
            : "Evidence submitted — EXIF GPS unavailable, live worker GPS used.",
      );
      setNote("");
      setUploadFor(null);
      refresh();
    } catch (e) {
      // GPS_FAILED and permission errors keep the capture panel open so the
      // worker can simply retry on site; nothing is stored as evidence.
      toast.error(e instanceof Error ? e.message : "Evidence submission failed. Please retry.");
    } finally {
      setBusy(null);
    }
  };

  if (loading || sessionLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <EmblemLoader label={lang === "ta" ? "பணிகள் ஏற்றப்படுகிறது" : "Loading your tasks"} />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <p className="civic-card p-6 text-center text-sm text-muted-foreground">
            {lang === "ta" ? "பணியாளர் பலகைக்கு உள்நுழையவும்." : "Sign in to open the worker console."}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <header className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <HardHat className="size-5 text-primary" />
            {lang === "ta" ? "பணியாளர் கள பலகை" : "Worker field console"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {lang === "ta"
              ? "செயலில் உள்ள பணியின் போது மட்டுமே இருப்பிடம் பகிரப்படும்."
              : "Your location is shared only while an assignment is active."}
          </p>
        </header>

        {hasProfile === false && (
          <section className="civic-card space-y-3 p-4">
            <h2 className="text-sm font-bold">{lang === "ta" ? "பணியாளர் பதிவு" : "Worker enrolment"}</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === "ta" ? "பெயர்" : "Full name"}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="general">{lang === "ta" ? "பொது பணிக்குழு" : "General crew"}</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === "ta" ? c.ta : c.en}
                </option>
              ))}
            </select>
            <button
              onClick={doEnrol}
              disabled={busy === "enrol"}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {lang === "ta" ? "பதிவு செய்" : "Enrol as worker"}
            </button>
          </section>
        )}

        {hasProfile && !items.length && (
          <p className="civic-card p-6 text-center text-sm text-muted-foreground">
            {lang === "ta" ? "தற்போது ஒதுக்கப்பட்ட பணிகள் இல்லை." : "No assignments yet. An officer will assign work to you."}
          </p>
        )}

        {items.map(({ assignment, complaint }) => {
          const dist = distances[assignment.id] ?? assignment.last_distance_m ?? null;
          return (
            <article key={assignment.id} className="civic-card space-y-3 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold">{complaint?.title}</h3>
                  <p className="truncate text-xs text-muted-foreground">{complaint?.description}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="size-3" />
                    {complaint?.street_address ??
                      (complaint?.lat != null ? `${complaint.lat.toFixed(5)}, ${complaint.lng?.toFixed(5)}` : "—")}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold">
                  SLA {new Date(assignment.sla_deadline).toLocaleString()}
                </span>
              </div>

              {complaint?.photo_url && (
                <img src={complaint.photo_url} alt="" className="max-h-48 w-full rounded-xl object-cover" />
              )}

              <DeliveryTracker stage={assignment.stage} distanceM={dist} compact />

              {dist != null && assignment.stage !== "arrived" && (
                <p className="rounded-xl border border-border bg-secondary/40 p-2 text-[11px] text-muted-foreground">
                  {lang === "ta" ? "இலக்கிலிருந்து தூரம்" : "Distance to destination"}: {formatMetres(dist)}
                </p>
              )}
              {assignment.stage === "arrived" && (
                <p className="rounded-xl border border-primary/40 bg-primary/10 p-2 text-[11px] font-semibold text-primary">
                  {lang === "ta"
                    ? "நீங்கள் புகார் இடத்தை அடைந்துவிட்டீர்கள்."
                    : "Worker has arrived at the complaint location."}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {assignment.stage === "assigned" && (
                  <button
                    disabled={busy === assignment.id}
                    onClick={() => act(assignment.id, accept as never, "Assignment accepted.")}
                    className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {lang === "ta" ? "ஏற்றுக்கொள்" : "Accept task"}
                  </button>
                )}
                {assignment.stage === "worker_accepted" && (
                  <button
                    disabled={busy === assignment.id}
                    onClick={() => act(assignment.id, travel as never, "Travelling — live tracking started.")}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <Navigation className="size-3.5" /> {lang === "ta" ? "பயணத்தைத் தொடங்கு" : "Start travelling"}
                  </button>
                )}
                {assignment.stage === "arrived" && (
                  <button
                    disabled={busy === assignment.id}
                    onClick={() => act(assignment.id, begin as never, "Work started.")}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <PlayCircle className="size-3.5" /> {lang === "ta" ? "பணியைத் தொடங்கு" : "Start work"}
                  </button>
                )}
                {assignment.stage === "in_progress" && (
                  <button
                    onClick={() => setUploadFor(uploadFor === assignment.id ? null : assignment.id)}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    <Camera className="size-3.5" /> {lang === "ta" ? "சான்று பதிவேற்று" : "Upload completion evidence"}
                  </button>
                )}
                {["arrived", "in_progress"].includes(assignment.stage) && (
                  <button
                    onClick={runNearby}
                    className="flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs font-semibold"
                  >
                    <Radar className="size-3.5" /> {lang === "ta" ? "அருகிலுள்ள புகார்கள்" : "Nearby complaints"}
                  </button>
                )}
              </div>

              {uploadFor === assignment.id && (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder={lang === "ta" ? "பணி விவரம்" : "What work was completed?"}
                    className="w-full rounded-xl border border-input bg-background p-2 text-xs outline-none focus:border-primary"
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onEvidenceFile(assignment.id, f);
                      e.target.value = "";
                    }}
                    className="w-full text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {lang === "ta"
                      ? "புகைப்படத்தில் EXIF GPS இருந்தால் படிக்கப்படும்; இல்லையெனில் நேரடி GPS பயன்படுத்தப்படும்."
                      : "Photo EXIF GPS is read when present; otherwise your live GPS is recorded instead."}
                  </p>
                </div>
              )}
            </article>
          );
        })}

        {nearby.length > 0 && (
          <section className="civic-card space-y-2 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Radar className="size-4 text-primary" />
              {lang === "ta" ? "அருகில் தீர்க்கப்படாத புகார்கள்" : "Nearby unresolved complaints"}
            </h2>
            {nearby.map((n) => (
              <div key={n.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border py-2 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {n.category} · {formatMetres(n.distance_m)}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const pos = await currentPosition().catch(() => null);
                      await pickup({
                        data: {
                          complaintId: n.id,
                          lat: pos?.coords.latitude,
                          lng: pos?.coords.longitude,
                        },
                      });
                      toast.success(lang === "ta" ? "பணி ஏற்கப்பட்டது." : "Task accepted.");
                      setNearby((p) => p.filter((x) => x.id !== n.id));
                      refresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not accept this task.");
                    }
                  }}
                  className="shrink-0 rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary"
                >
                  {lang === "ta" ? "ஏற்றுக்கொள்" : "Accept task"}
                </button>
              </div>
            ))}
          </section>
        )}
      </main>
      <VoiceAssistant />
    </div>
  );
}
