import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { GeoCamera, type Capture } from "@/components/GeoCamera";
import { useLang } from "@/lib/i18n";

export type WorkReport = {
  work_summary: string | null;
  materials_used: string | null;
  work_started_at: string | null;
  work_completed_at: string;
  proof_caption: string | null;
  resolution_note: string | null;
};

type Props = {
  wardLabel: string;
  zoneLabel: string;
  onSubmit: (report: WorkReport, capture: Capture) => void;
  onCancel: () => void;
};

/**
 * Officer/worker completion report: what work was performed, materials used,
 * time window, plus a caption describing the geotagged proof photo.
 */
export function WorkReportForm({ wardLabel, zoneLabel, onSubmit, onCancel }: Props) {
  const { t, lang } = useLang();
  const ta = lang === "ta";
  const [summary, setSummary] = useState("");
  const [materials, setMaterials] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [caption, setCaption] = useState("");

  const label = (en: string, tam: string) => (ta ? tam : en);

  const handleCapture = (cap: Capture) => {
    onSubmit(
      {
        work_summary: summary.trim() || null,
        materials_used: materials.trim() || null,
        work_started_at: startedAt ? new Date(startedAt).toISOString() : null,
        work_completed_at: cap.capturedAt,
        proof_caption: caption.trim() || null,
        resolution_note: summary.trim() || null,
      },
      cap,
    );
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold">
        <ClipboardList className="size-3.5 text-primary" />
        {label("Work completion report", "பணி நிறைவு அறிக்கை")}
      </p>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-muted-foreground">
          {label("Work performed *", "செய்யப்பட்ட பணி *")}
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          placeholder={label(
            "Describe the work done — the citizen sees this on the feed and tracking page",
            "செய்யப்பட்ட பணியின் விவரம் — புகார்தாரர் இதைப் பார்ப்பார்",
          )}
          className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-primary"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">
            {label("Materials / equipment used", "பயன்படுத்திய பொருட்கள்")}
          </label>
          <input
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
            placeholder={label("e.g. 2 bags cement, jet-rodding unit", "எ.கா. 2 மூட்டை சிமெண்ட்")}
            className="w-full rounded-lg border border-input bg-background px-2 py-2 text-xs outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">
            {label("Work started at", "பணி தொடங்கிய நேரம்")}
          </label>
          <input
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-2 py-2 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-muted-foreground">
          {label("Description of the uploaded proof", "பதிவேற்றிய சான்றின் விளக்கம்")}
        </label>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={label("What the photo shows", "புகைப்படம் காட்டுவது என்ன")}
          className="w-full rounded-lg border border-input bg-background px-2 py-2 text-xs outline-none focus:border-primary"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">{t("officer.geotaggedProof")}</p>
      <GeoCamera wardLabel={wardLabel} zoneLabel={zoneLabel} onCapture={handleCapture} />

      <button
        onClick={onCancel}
        className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
      >
        {t("action.cancel")}
      </button>
    </div>
  );
}
