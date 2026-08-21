import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Heart,
  MessageSquare,
  Repeat2,
  Link2,
  PhoneCall,
  Flag,
  MapPin,
  FastForward,
  Lock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { StatusPill, PriorityPill } from "@/components/StatusPill";
import { SlaBar } from "@/components/SlaBar";
import { MaskedCallModal } from "@/components/MaskedCallModal";
import { useLang } from "@/lib/i18n";
import { officerForTier, wardLabel, type Complaint, type Ward } from "@/lib/data";
import type { Tier } from "@/lib/sla";
import { Button } from "@/components/ui/button";

type Props = {
  complaint: Complaint;
  ward?: Ward;
  liked: boolean;
  reposted: boolean;
  counts: { likes: number; comments: number; reposts: number };
  onLike: () => void;
  onRepost: () => void;
  onFlagFake: () => void;
  onFastForward: () => void;
  /** Only municipal officers may change escalation / the SLA clock. */
  canEscalate?: boolean;
  canDelete?: boolean;
  onDelete?: () => void;
  busy?: boolean;
};

export function ComplaintCard({
  complaint: c,
  ward,
  liked,
  reposted,
  counts,
  onLike,
  onRepost,
  onFlagFake,
  onFastForward,
  canEscalate = false,
  canDelete,
  onDelete,
  busy,
}: Props) {
  const { lang, t } = useLang();
  const [calling, setCalling] = useState(false);

  const copyLink = async () => {
    const url = `${window.location.origin}/track/${c.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("card.linkCopied"), {
        description: url,
      });
    } catch {
      toast.info(url);
    }
  };

  return (
    <article className="civic-card overflow-hidden">
      {c.frozen_fake && (
        <div className="flex items-center gap-2 border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-xs font-semibold text-destructive">
          <Lock className="size-3.5 shrink-0" />
          {t("card.frozenFake")}
        </div>
      )}

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-primary">{c.author_pseudonym}</p>
            <h3 className="mt-0.5 line-clamp-2 text-base font-bold leading-snug">{c.title}</h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusPill status={c.status} />
            <PriorityPill priority={c.priority} />
          </div>
        </div>

        <p className="line-clamp-3 text-sm text-muted-foreground">{c.description}</p>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0">
            {wardLabel(ward, lang)}
            {c.street_address ? ` · ${c.street_address}` : ""}
            {c.lat != null && (
              <span className="font-mono"> · {c.lat.toFixed(4)}, {c.lng?.toFixed(4)}</span>
            )}
          </span>
        </p>

        {c.photo_url && (
          <img
            src={c.photo_url}
            alt={c.title}
            loading="lazy"
            className="max-h-72 w-full rounded-lg border border-border object-cover"
          />
        )}

        <SlaBar
          createdAt={c.created_at}
          priority={c.priority}
          offsetHours={c.clock_offset_hours}
          tier={c.current_tier as Tier}
          slaHours={c.sla_hours}
        />

        {(c.resolution_photo_url || c.resolution_note) && (
          <div className="space-y-2 rounded-lg border border-success/40 bg-success/5 p-3">
            <p className="text-xs font-semibold text-success">
              {lang === "ta" ? "பணி முடிக்கப்பட்ட சான்று" : "Work completion proof"}
            </p>
            {c.resolution_note && <p className="text-xs text-muted-foreground">{c.resolution_note}</p>}
            {c.resolution_photo_url && (
              <img
                src={c.resolution_photo_url}
                alt={lang === "ta" ? "பணி முடிவு புகைப்படம்" : "Resolution proof photo"}
                loading="lazy"
                className="max-h-64 w-full rounded-lg border border-border object-cover"
              />
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{t("card.assigned")}</span>{" "}
          {c.assigned_officer ?? officerForTier(c.current_tier as Tier)}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
          <button
            onClick={onLike}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              liked ? "bg-destructive/15 text-destructive" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Heart className={`size-4 ${liked ? "fill-current" : ""}`} /> {counts.likes}
          </button>
          <Link
            to="/track/$id"
            params={{ id: c.id }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary"
          >
            <MessageSquare className="size-4" /> {counts.comments}
          </Link>
          <button
            onClick={onRepost}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              reposted ? "bg-success/15 text-success" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Repeat2 className="size-4" /> {counts.reposts}
          </button>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary"
          >
            <Link2 className="size-4" />
            <span className="hidden sm:inline">{t("share")}</span>
          </button>
          <button
            onClick={() => setCalling(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <PhoneCall className="size-4" />
            <span className="hidden sm:inline">{t("callOfficer")}</span>
          </button>
          <button
            onClick={onFlagFake}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Flag className="size-4" />
            <span className="hidden md:inline">{t("reportFake")}</span>
          </button>
          {canDelete && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={busy}
              className="h-auto rounded-lg px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              title={lang === "ta" ? "புகாரை நீக்கு" : "Delete complaint"}
            >
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">{lang === "ta" ? "நீக்கு" : "Delete"}</span>
            </Button>
          ) : null}
          {canEscalate && (
          <button
            onClick={onFastForward}
            disabled={busy}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-warning/50 bg-warning/10 px-2.5 py-1.5 text-xs font-semibold text-warning transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            <FastForward className="size-4" />
            <span className="hidden sm:inline">{t("card.plusOneHour")}</span>
          </button>
          )}
        </div>
      </div>

      <MaskedCallModal
        open={calling}
        onClose={() => setCalling(false)}
        officer={c.assigned_officer ?? officerForTier(c.current_tier as Tier)}
        citizenAlias={c.author_pseudonym}
      />
    </article>
  );
}
