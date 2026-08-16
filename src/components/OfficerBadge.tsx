import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, IdCard, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, type AppRole } from "@/lib/session";
import { wardLabel, fetchWards, type Ward } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import emblem from "@/assets/tn-emblem.png";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  role: AppRole;
};

/**
 * Pseudo-QR renderer. Produces a stable 21x21 grid from a hash of the payload —
 * enough for a realistic-looking demo badge without pulling a QR library.
 */
function PseudoQR({ payload, size = 168 }: { payload: string; size?: number }) {
  const cells = 21;
  const cell = size / cells;
  const bits = useMemo(() => {
    let h = 2166136261 >>> 0;
    const out: boolean[] = [];
    for (let i = 0; i < cells * cells; i++) {
      h ^= payload.charCodeAt(i % payload.length) + i;
      h = Math.imul(h, 16777619) >>> 0;
      out.push((h & 1) === 1);
    }
    return out;
  }, [payload]);

  const finder = (cx: number, cy: number) => (
    <>
      <rect x={cx * cell} y={cy * cell} width={cell * 7} height={cell * 7} fill="#0F172A" />
      <rect x={(cx + 1) * cell} y={(cy + 1) * cell} width={cell * 5} height={cell * 5} fill="#FFFFFF" />
      <rect x={(cx + 2) * cell} y={(cy + 2) * cell} width={cell * 3} height={cell * 3} fill="#0F172A" />
    </>
  );

  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= cells - 7 && y < 7) || (x < 7 && y >= cells - 7);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded bg-white p-1">
      <rect width={size} height={size} fill="#FFFFFF" />
      {bits.map((b, i) => {
        const x = i % cells;
        const y = Math.floor(i / cells);
        if (!b || inFinder(x, y)) return null;
        return <rect key={i} x={x * cell} y={y * cell} width={cell} height={cell} fill="#0F172A" />;
      })}
      {finder(0, 0)}
      {finder(cells - 7, 0)}
      {finder(0, cells - 7)}
    </svg>
  );
}

export function OfficerBadge({ open, onClose, userId, role }: Props) {
  const { lang, t } = useLang();
  const [profile, setProfile] = useState<{
    pseudonym: string;
    ward_id: string | null;
  } | null>(null);
  const [meta, setMeta] = useState<{
    ifhrms?: string;
    officer_name?: string;
    department?: string;
    designation?: string;
  }>({});
  const [wards, setWards] = useState<Ward[]>([]);

  useEffect(() => {
    if (!open || !userId) return;
    supabase
      .from("profiles")
      .select("pseudonym, ward_id")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
    supabase.auth.getUser().then(({ data }) => {
      const m = (data.user?.user_metadata ?? {}) as Record<string, string>;
      setMeta({
        ifhrms: m.ifhrms,
        officer_name: m.officer_name,
        department: m.department,
        designation: m.designation,
      });
    });
    fetchWards().then(setWards).catch(() => undefined);
  }, [open, userId]);

  if (!open) return null;

  const ward = wards.find((w) => w.id === profile?.ward_id) ?? null;
  const inferredIfhrms =
    meta.ifhrms ?? (profile?.pseudonym?.match(/IFHRMS_(\d{11})/)?.[1] ?? "———————————");
  const officerName = meta.officer_name ?? t("badge.officerFallback");
  const department = meta.department ?? t("badge.deptFallback");
  const payload = [
    "TN-MAWS/OFFICER-BADGE",
    `IFHRMS:${inferredIfhrms}`,
    `ROLE:${role}`,
    `WARD:${ward?.ward_number ?? "-"}`,
    `TS:${new Date().toISOString()}`,
  ].join("|");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label={t("action.close")}
          className="absolute right-3 top-3 rounded-lg border border-border bg-background/80 p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        {/* State seal header */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-gradient-to-r from-primary/20 to-success/15 p-4">
          <img src={emblem} alt={t("badge.emblemAlt")} className="size-14 rounded-lg" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {t("badge.govTn")}
            </p>
            <p className="truncate text-sm font-bold">{t("badge.maws")}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {t("badge.subtitle")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 p-4">
          {/* Officer photo placeholder */}
          <div className="grid place-items-center rounded-lg border border-border bg-secondary text-muted-foreground">
            <div className="grid size-24 place-items-center rounded-full bg-primary/15 text-2xl font-bold text-primary">
              {officerName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0]?.toUpperCase() ?? "")
                .join("")}
            </div>
          </div>

          <dl className="space-y-1.5 text-xs">
            <Row label={t("badge.name")} value={officerName} />
            <Row label={t("badge.designation")} value={ROLE_LABEL[role][lang]} />
            <Row label={t("badge.department")} value={department} />
            <Row label={t("badge.ifhrmsId")} value={inferredIfhrms} mono />
            <Row label={t("badge.jurisdiction")} value={ward ? wardLabel(ward, lang) : t("badge.unassigned")} />
          </dl>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-t border-border bg-background/40 p-4">
          <PseudoQR payload={payload} />
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-semibold text-success">
              <BadgeCheck className="size-4" /> {t("badge.rosterActive")}
            </p>
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-primary" /> {t("badge.digilocker")}
            </p>
            <p className="flex items-center gap-1.5">
              <IdCard className="size-3.5 text-primary" /> {t("badge.scanVerify")}
            </p>
            <p className="text-[10px] leading-tight">
              {t("badge.disclaimerPrefix")}{" "}
              <span className="font-mono">verify.maws.tn.gov.in</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 truncate font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
