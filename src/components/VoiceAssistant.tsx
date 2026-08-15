import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, X, Radio, Volume2, VolumeX, BookOpen, BookX, AlertTriangle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  askAssistant,
  ACTIONS,
  REFERENCES,
  type ActionKey,
  type ReferenceKey,
} from "@/lib/assistant.functions";

type Msg = {
  role: "user" | "bot";
  text: string;
  refs?: ReferenceKey[];
  action?: ActionKey;
  /** True when no policy reference could be matched to this reply. */
  uncited?: boolean;
};


/** Offline fallback: keyword → reply + references + next action. */
const SCRIPT: {
  match: RegExp;
  reply: { en: string; ta: string };
  refs: ReferenceKey[];
  action: ActionKey;
}[] = [
  {
    match: /(report|complaint|புகார்|issue|pothole|garbage|water)/i,
    reply: {
      en: "I can start a grievance for you. The portal needs a live geotagged photo — gallery uploads are rejected by the anti-spoofing inspector.",
      ta: "நான் உங்களுக்காக புகார் தொடங்கலாம். நேரடி புவிக்குறியிட்ட படம் தேவை — கேலரி படங்கள் நிராகரிக்கப்படும்.",
    },
    refs: ["policy_geotag", "page_report"],
    action: "file_complaint",
  },
  {
    match: /(track|status|நிலை|escalat)/i,
    reply: {
      en: "Every grievance has a shareable tracking link with live status pills, and breaches auto-escalate one tier under the MAWS SLA matrix.",
      ta: "ஒவ்வொரு புகாருக்கும் நேரடி நிலையுடன் பகிரக்கூடிய இணைப்பு உள்ளது; SLA மீறினால் தானாக மேல்முறையீடு.",
    },
    refs: ["policy_sla", "page_dashboard"],
    action: "track_ticket",
  },
  {
    match: /(sign|register|digilocker|aadhaar|ஆதார்|ifhrms|account)/i,
    reply: {
      en: "Registration runs through the unified DigiLocker gateway: 12-digit Aadhaar for citizens, 11-digit IFHRMS for officers, plus email and mobile OTP.",
      ta: "பதிவு டிஜிலாக்கர் வழியாக: குடிமக்களுக்கு 12 இலக்க ஆதார், அதிகாரிகளுக்கு 11 இலக்க IFHRMS, உடன் OTP.",
    },
    refs: ["policy_identity", "page_auth"],
    action: "verify_identity",
  },
  {
    match: /(anonym|privacy|pseudonym|subpoena|name|தனியுரிமை)/i,
    reply: {
      en: "Your legal identity is sealed — field engineers only see your pseudonym. Only a court subpoena with dual custody keys can unseal it, and every unseal is audit-logged.",
      ta: "உங்கள் உண்மையான அடையாளம் மறைக்கப்பட்டுள்ளது. இரட்டை பாதுகாப்பு சாவிகளுடன் நீதிமன்ற உத்தரவால் மட்டுமே திறக்க முடியும்.",
    },
    refs: ["policy_anonymity", "page_oversight"],
    action: "none",
  },
  {
    match: /(sla|time|deadline|jtf|task force|எவ்வளவு)/i,
    reply: {
      en: "SLA windows: Emergency 2h, High 12h, Medium 24h, Low 48h. Stuck at Commissioner beyond 48h (24h for GCC) triggers a Joint Task Force request.",
      ta: "SLA காலம்: அவசரம் 2 மணி, உயர் 12, நடுத்தர 24, குறைவு 48. ஆணையர் நிலையில் 48 மணிக்கு மேல் இருந்தால் கூட்டு பணிக்குழு.",
    },
    refs: ["policy_sla", "policy_gcc", "page_analytics"],
    action: "escalate",
  },
];

const GREETING = {
  en: "Vanakkam. I'm the civic voice assistant, trained on the full TN SmartMunicipality portal — identity gateway, geotag camera, SLA escalation matrix, GCC routing, anonymity and closure voting. Ask me anything, in English or Tamil.",
  ta: "வணக்கம். நான் TN SmartMunicipality போர்ட்டல் முழுவதும் பயிற்சி பெற்ற குடிமை குரல் உதவியாளர். ஆங்கிலம் அல்லது தமிழில் எதையும் கேளுங்கள்.",
};

const FALLBACK = {
  en: "I can help with filing a geotagged grievance, tracking and escalation, DigiLocker/IFHRMS registration, SLA and GCC routing rules, anonymity, or closure voting.",
  ta: "புகார் அளித்தல், கண்காணிப்பு, டிஜிலாக்கர்/IFHRMS பதிவு, SLA & GCC விதிகள், அநாமதேயம், முடிவு வாக்கெடுப்பு — உதவ முடியும்.",
};

const UNCITED = {
  en: "No matching municipality policy reference was found for this answer — treat it as general guidance and confirm with the SLA report archive or your ward office before acting.",
  ta: "இந்த பதிலுக்கு பொருந்தும் நகராட்சி கொள்கை ஆதாரம் கிடைக்கவில்லை — இதை பொதுவான வழிகாட்டுதலாகக் கருதி, SLA அறிக்கை காப்பகம் அல்லது வார்டு அலுவலகத்தில் உறுதிப்படுத்தவும்.",
};

/**
 * Citation coverage check: keeps only references the reply can actually be
 * grounded in, and flags the reply as uncited when nothing survives so the UI
 * can fall back to an explicit "no policy reference" notice.
 */
function checkCoverage(
  reply: string,
  refs: ReferenceKey[] | undefined,
  fallbackRefs: ReferenceKey[],
): { refs: ReferenceKey[]; uncited: boolean } {
  const valid = (refs ?? []).filter((r) => r in REFERENCES);
  const deduped = Array.from(new Set(valid)).slice(0, 3);
  if (deduped.length) return { refs: deduped, uncited: false };

  // Second pass: reuse the scripted policy refs when the reply clearly covers
  // a known policy topic but the model returned no citations.
  const scripted = fallbackRefs.filter((r) => r in REFERENCES);
  if (scripted.length && reply.trim().length > 0) {
    return { refs: Array.from(new Set(scripted)).slice(0, 3), uncited: false };
  }

  return { refs: [], uncited: true };
}

export function VoiceAssistant() {
  const { lang, t } = useLang();

  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakBack, setSpeakBack] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [handsFree, setHandsFree] = useState(false);

  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const recRef = useRef<any>(null);
  const handsFreeRef = useRef(false);
  const speakBackRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [thinking, setThinking] = useState(false);
  const ask = useServerFn(askAssistant);

  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);
  useEffect(() => {
    speakBackRef.current = speakBack;
  }, [speakBack]);

  useEffect(() => {
    setMsgs([{ role: "bot", text: GREETING[lang] }]);
  }, [lang]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open, thinking]);

  useEffect(() => {
    return () => {
      recRef.current?.stop?.();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = (text: string) => {
    if (!speakBackRef.current || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "ta" ? "ta-IN" : "en-IN";
    u.rate = 1;
    u.onend = () => {
      if (handsFreeRef.current) startListening();
    };
    window.speechSynthesis.speak(u);
  };

  const respond = async (text: string) => {
    const hit = SCRIPT.find((s) => s.match.test(text));
    const history: Msg[] = [...msgs, { role: "user", text }];
    setMsgs(history);
    setThinking(true);
    try {
      const res = await ask({
        data: {
          lang,
          messages: history.slice(-12).map((m) => ({ role: m.role, text: m.text })),
        },
      });
      const reply = res.text || (hit ? hit.reply[lang] : FALLBACK[lang]);
      const rawRefs = res.text ? res.refs : (hit?.refs ?? []);
      const action = res.text ? res.action : (hit?.action ?? "none");
      const { refs, uncited } = checkCoverage(reply, rawRefs, hit?.refs ?? []);
      setMsgs((m) => [...m, { role: "bot", text: reply, refs, action, uncited }]);

      speak(reply);
    } catch {
      const reply = hit ? hit.reply[lang] : FALLBACK[lang];
      const { refs, uncited } = checkCoverage(reply, hit?.refs ?? [], hit?.refs ?? []);
      setMsgs((m) => [
        ...m,
        { role: "bot", text: reply, refs, action: hit?.action ?? "none", uncited },
      ]);
      speak(reply);

    } finally {
      setThinking(false);
    }
  };

  const send = () => {
    const v = input.trim();
    if (!v || thinking) return;
    setInput("");
    void respond(v);
  };

  const getRecognizer = () => {
    const SR =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    return SR || null;
  };

  const startListening = () => {
    const SR = getRecognizer();
    if (!SR) return;
    try {
      recRef.current?.stop?.();
    } catch {
      /* noop */
    }
    const rec = new SR();
    rec.lang = lang === "ta" ? "ta-IN" : "en-IN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => void respond(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const toggleMic = () => {
    if (!getRecognizer()) {
      setMsgs((m) => [
        ...m,
        {
          role: "bot",
          text:
            lang === "ta"
              ? "இந்த உலாவியில் பேச்சு அங்கீகாரம் இல்லை. தட்டச்சு செய்யவும்."
              : "Speech recognition isn't available in this browser — please type instead.",
        },
      ]);
      return;
    }
    if (listening) {
      recRef.current?.stop?.();
      setListening(false);
      setHandsFree(false);
      return;
    }
    startListening();
  };

  const toggleHandsFree = () => {
    const next = !handsFree;
    setHandsFree(next);
    if (next && !listening) startListening();
    if (!next) {
      recRef.current?.stop?.();
      setListening(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] transition-transform hover:scale-105"
          aria-label={t("voiceAssist")}
        >
          <Radio className="size-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-40 flex h-[30rem] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-elevated)]">
          <header className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/20 text-primary">
              <Radio className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{t("voiceAssist")}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {lang === "ta" ? "தமிழ் / English" : "English / தமிழ்"} · Gemini AI
                {handsFree ? (lang === "ta" ? " · கை-இல்லா" : " · hands-free") : ""}
              </p>
            </div>
            <button
              onClick={() => setShowSources((s) => !s)}
              aria-pressed={showSources}
              aria-label={showSources ? "Hide sources" : "Show sources"}
              title={lang === "ta" ? "ஆதாரங்களைக் காட்டு" : "Show sources"}
              className={`shrink-0 rounded-lg p-1.5 ${showSources ? "text-primary" : "text-muted-foreground"}`}
            >
              {showSources ? <BookOpen className="size-4" /> : <BookX className="size-4" />}
            </button>
            <button
              onClick={() => {
                if (speakBack && typeof window !== "undefined") window.speechSynthesis?.cancel();
                setSpeakBack((s) => !s);
              }}
              aria-label={speakBack ? "Mute voice replies" : "Unmute voice replies"}
              className={`shrink-0 rounded-lg p-1.5 ${speakBack ? "text-primary" : "text-muted-foreground"}`}
            >
              {speakBack ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>

            <button onClick={() => setOpen(false)} aria-label="Close" className="shrink-0 p-1 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {msgs.map((m, i) => {
              const action = m.action && m.action !== "none" ? ACTIONS[m.action] : null;
              return (
                <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "max-w-[92%] text-sm text-foreground"
                    }
                  >
                    <p>{m.text}</p>

                    {showSources && m.role === "bot" && !!m.refs?.length && (
                      <div className="mt-2 rounded-lg border border-border bg-secondary/40 p-2">
                        <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <BookOpen className="size-3" />
                          {lang === "ta" ? "மேற்கோள்கள்" : "References"}
                        </p>
                        <ul className="space-y-1">
                          {m.refs.map((r) => (
                            <li key={r}>
                              <Link
                                to={REFERENCES[r].to}
                                onClick={() => setOpen(false)}
                                className="text-xs text-primary underline underline-offset-2"
                              >
                                {REFERENCES[r].label[lang]}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {showSources && m.role === "bot" && m.uncited && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-dashed border-border bg-secondary/30 p-2 text-[11px] text-muted-foreground">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-500" />
                        <span>{UNCITED[lang]}</span>
                      </div>
                    )}


                    {action && (
                      <Link
                        to={action.to}
                        onClick={() => setOpen(false)}
                        className="mt-2 inline-block rounded-lg border border-primary/50 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                      >
                        {action.label[lang]}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
            {thinking && (
              <p className="text-sm text-muted-foreground">
                {lang === "ta" ? "யோசிக்கிறேன்…" : "Thinking…"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-border p-2">
            <button
              onClick={toggleMic}
              aria-label="Toggle microphone"
              className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors ${
                listening ? "bg-destructive text-destructive-foreground" : "bg-secondary text-foreground"
              }`}
            >
              {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>
            <button
              onClick={toggleHandsFree}
              aria-label="Toggle hands-free conversation"
              title={lang === "ta" ? "கை-இல்லா உரையாடல்" : "Hands-free conversation"}
              className={`grid size-9 shrink-0 place-items-center rounded-lg text-[10px] font-bold transition-colors ${
                handsFree ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              A/V
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={lang === "ta" ? "கேளுங்கள்…" : "Ask anything…"}
              className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={send}
              aria-label="Send"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
