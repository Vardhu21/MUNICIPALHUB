import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { RESOURCES } from "./locales";

export type Lang = "en" | "ta";

type Dict = Record<string, { en: string; ta: string }>;

export const DICT: Dict = {
  appName: { en: "TN SmartMunicipality", ta: "தமிழ்நாடு ஸ்மார்ட் நகராட்சி" },
  appTagline: { en: "Civic Escalation Portal", ta: "குடிமை மேல்முறையீட்டு தளம்" },
  maws: {
    en: "Department of Municipal Administration & Water Supply",
    ta: "நகராட்சி நிர்வாகம் மற்றும் குடிநீர் வழங்கல் துறை",
  },
  enterPortal: { en: "Enter the Portal", ta: "தளத்திற்குள் நுழையவும்" },
  viewFeed: { en: "View Public Feed", ta: "பொது ஊட்டத்தைப் பார்" },
  signIn: { en: "Sign in", ta: "உள்நுழை" },
  signUp: { en: "Create account", ta: "கணக்கை உருவாக்கு" },
  signOut: { en: "Sign out", ta: "வெளியேறு" },
  email: { en: "Email", ta: "மின்னஞ்சல்" },
  password: { en: "Password", ta: "கடவுச்சொல்" },
  phone: { en: "Mobile number", ta: "கைபேசி எண்" },
  pseudonym: { en: "Display pseudonym", ta: "பொதுப் புனைப்பெயர்" },
  legalName: { en: "Legal name (as per DigiLocker)", ta: "சட்டப்பூர்வ பெயர் (டிஜிலாக்கர் படி)" },
  aadhaar: { en: "Aadhaar number", ta: "ஆதார் எண்" },
  otp: { en: "OTP", ta: "ஒருமுறை கடவுஎண்" },
  dashboard: { en: "Dashboard", ta: "கட்டுப்பாட்டு பலகை" },
  feed: { en: "Public Feed", ta: "பொது ஊட்டம்" },
  report: { en: "Report Issue", ta: "புகார் அளி" },
  myGrievances: { en: "My Grievances", ta: "என் புகார்கள்" },
  role: { en: "Role", ta: "பங்கு" },
  ward: { en: "Ward", ta: "வார்டு" },
  zone: { en: "Zone", ta: "மண்டலம்" },
  status: { en: "Status", ta: "நிலை" },
  priority: { en: "Priority", ta: "முன்னுரிமை" },
  slaRemaining: { en: "SLA remaining", ta: "SLA மீதம்" },
  breached: { en: "SLA breached", ta: "SLA மீறல்" },
  fastForward: { en: "Fast-Forward SLA Clock (+1 Hour)", ta: "SLA கடிகாரத்தை முன்னகர்த்து (+1 மணி)" },
  like: { en: "Like", ta: "விருப்பம்" },
  comment: { en: "Comment", ta: "கருத்து" },
  repost: { en: "Repost", ta: "மறுபகிர்வு" },
  share: { en: "Copy tracking link", ta: "கண்காணிப்பு இணைப்பை நகலெடு" },
  reportFake: { en: "Report Fake Incident", ta: "போலி புகாரைத் தெரிவி" },
  callOfficer: { en: "Call Assigned Officer", ta: "பொறுப்பு அலுவலரை அழை" },
  language: { en: "தமிழ்", ta: "English" },
  submit: { en: "Submit", ta: "சமர்ப்பி" },
  cancel: { en: "Cancel", ta: "ரத்து" },
  capture: { en: "Capture geotagged photo", ta: "புவிக்குறியிட்ட படம் எடு" },
  emergencyBanner: { en: "Emergency hazard near you", ta: "உங்கள் அருகில் அவசர அபாயம்" },
  verifiedResident: { en: "ZKP Ward Resident Token", ta: "ZKP வார்டு குடியிருப்பாளர் அடையாளம்" },
  voiceAssist: { en: "Civic Voice Assistant", ta: "குடிமை குரல் உதவியாளர்" },
};

export const STATUS_LABEL: Record<string, { en: string; ta: string }> = {
  submitted: { en: "Submitted", ta: "சமர்ப்பிக்கப்பட்டது" },
  assigned: { en: "Assigned", ta: "ஒதுக்கப்பட்டது" },
  in_progress: { en: "In Progress", ta: "பணி நடைபெறுகிறது" },
  verification: { en: "Verification Phase", ta: "சரிபார்ப்பு கட்டம்" },
  resolved: { en: "Resolved", ta: "தீர்க்கப்பட்டது" },
  escalated: { en: "Escalated", ta: "மேல்முறையீடு" },
  joint_task_force: { en: "Joint Task Force Request", ta: "கூட்டுப் பணிக்குழு கோரிக்கை" },
  rejected: { en: "Rejected", ta: "நிராகரிக்கப்பட்டது" },
};

export const PRIORITY_LABEL: Record<string, { en: string; ta: string }> = {
  emergency: { en: "Emergency", ta: "அவசரம்" },
  high: { en: "High", ta: "உயர்" },
  medium: { en: "Medium", ta: "நடுத்தர" },
  low: { en: "Low", ta: "குறைவு" },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** Translate a key from DICT or the centralized locale resources. */
  t: (key: keyof typeof DICT | (string & {}), fallback?: string) => string;
  pick: (pair: { en: string; ta: string } | undefined) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("tnsm-lang");
    if (stored === "ta" || stored === "en") setLangState(stored);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("tnsm-lang", l);
    document.documentElement.lang = l === "ta" ? "ta" : "en";
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      toggle: () => setLang(lang === "en" ? "ta" : "en"),
      t: (key, fallback) =>
        DICT[key as string]?.[lang] ?? RESOURCES[key as string]?.[lang] ?? fallback ?? String(key),
      pick: (pair) => (pair ? pair[lang] : ""),
    }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
