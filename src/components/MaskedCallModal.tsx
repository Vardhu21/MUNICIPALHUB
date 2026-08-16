import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { PhoneOff, Phone, ShieldCheck, MicOff, Mic } from "lucide-react";

/**
 * Masked VoIP relay. Neither side ever sees the other's cellular number —
 * the call is bridged through a rotating relay identity.
 */
export function MaskedCallModal({
  open,
  onClose,
  officer,
  citizenAlias,
}: {
  open: boolean;
  onClose: () => void;
  officer: string;
  citizenAlias: string;
}) {
  const { t } = useLang();
  const [seconds, setSeconds] = useState(0);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const relay = useRef(`+91 44 4000 ${Math.floor(1000 + Math.random() * 8999)}`);

  useEffect(() => {
    if (!open) {
      setSeconds(0);
      setConnected(false);
      return;
    }
    const connectTimer = setTimeout(() => setConnected(true), 1600);
    return () => clearTimeout(connectTimer);
  }, [open]);

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [connected]);

  if (!open) return null;

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-elevated)]">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("call.maskedRelay")}</p>
          <h2 className="text-xl font-bold">{officer}</h2>
          <p className="text-sm text-muted-foreground">
            {connected ? t("call.connectedTemplate").replace("{time}", `${mm}:${ss}`) : t("call.bridging")}
          </p>
        </div>

        <div className="relative mx-auto grid size-24 place-items-center rounded-full bg-primary/15">
          {!connected && (
            <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-primary" />
          )}
          <Phone className="size-9 text-primary" />
        </div>

        <div className="space-y-2 rounded-xl border border-success/40 bg-success/10 p-3 text-left text-xs">
          <p className="flex items-center gap-2 font-semibold text-success">
            <ShieldCheck className="size-4" /> {t("call.numberMaskingActive")}
          </p>
          <p className="text-muted-foreground">
            {t("call.maskingDescTemplate")
              .split(/\{alias\}|\{relay\}/)
              .reduce<ReactNode[]>((acc, part, i, arr) => {
                acc.push(part);
                if (i === 0) acc.push(<span key="alias" className="font-mono text-foreground">{citizenAlias}</span>);
                if (i === 1) acc.push(<span key="relay" className="font-mono text-foreground">{relay.current}</span>);
                return acc;
              }, [])}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setMuted((m) => !m)}
            className="grid size-12 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-accent"
            aria-label={muted ? t("call.unmute") : t("call.mute")}
          >
            {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </button>
          <button
            onClick={onClose}
            className="grid size-14 place-items-center rounded-full bg-destructive text-destructive-foreground transition-opacity hover:opacity-90"
            aria-label={t("call.endCall")}
          >
            <PhoneOff className="size-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
