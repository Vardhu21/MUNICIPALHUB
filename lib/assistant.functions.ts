import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  lang: z.enum(["en", "ta"]),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "bot"]),
        text: z.string().min(1).max(4000),
      }),
    )
    .max(30),
});

/** Canonical in-app references the assistant may cite. Keys are the model's enum. */
export const REFERENCES = {
  policy_sla: {
    to: "/reports",
    label: { en: "MAWS SLA & escalation matrix", ta: "MAWS SLA & மேல்முறையீட்டு அட்டவணை" },
  },
  policy_gcc: {
    to: "/analytics",
    label: { en: "GCC direct-secretariat routing rule", ta: "GCC நேரடி செயலகம் விதி" },
  },
  policy_anonymity: {
    to: "/oversight",
    label: { en: "Zero-knowledge anonymity & judicial subpoena policy", ta: "அநாமதேய & நீதிமன்ற உத்தரவு கொள்கை" },
  },
  policy_geotag: {
    to: "/report",
    label: { en: "Live geotag & anti-spoofing evidence policy", ta: "நேரடி புவிக்குறியீடு சான்று கொள்கை" },
  },
  policy_closure: {
    to: "/feed",
    label: { en: "Dual-verification closure (complainant + ward vote)", ta: "இரட்டை சரிபார்ப்பு முடிவு கொள்கை" },
  },
  policy_identity: {
    to: "/auth",
    label: { en: "DigiLocker / Aadhaar / IFHRMS identity gateway", ta: "டிஜிலாக்கர் / ஆதார் / IFHRMS நுழைவாயில்" },
  },
  policy_fraud: {
    to: "/feed",
    label: { en: "Fake-incident penalty & account freeze rules", ta: "போலி புகார் அபராத விதிகள்" },
  },
  page_report: { to: "/report", label: { en: "File a grievance (camera)", ta: "புகார் அளி (கேமரா)" } },
  page_feed: { to: "/feed", label: { en: "Public grievance feed", ta: "பொது புகார் ஊட்டம்" } },
  page_dashboard: { to: "/dashboard", label: { en: "My grievances", ta: "என் புகார்கள்" } },
  page_officer: { to: "/officer", label: { en: "Officer task board", ta: "அதிகாரி பணிப் பலகை" } },
  page_analytics: { to: "/analytics", label: { en: "Commissioner SLA analytics", ta: "ஆணையர் SLA பகுப்பாய்வு" } },
  page_reports: { to: "/reports", label: { en: "Scheduled SLA reports archive", ta: "SLA அறிக்கை காப்பகம்" } },
  page_oversight: { to: "/oversight", label: { en: "Judicial oversight console", ta: "நீதித்துறை மேற்பார்வை" } },
  page_auth: { to: "/auth", label: { en: "Identity verification gateway", ta: "அடையாள சரிபார்ப்பு" } },
} as const;

export type ReferenceKey = keyof typeof REFERENCES;
const REF_KEYS = Object.keys(REFERENCES) as ReferenceKey[];

/** Escalation / complaint actions the assistant can hand back as one-tap buttons. */
export const ACTIONS = {
  file_complaint: { to: "/report", label: { en: "Open geotag camera", ta: "கேமராவைத் திற" } },
  track_ticket: { to: "/dashboard", label: { en: "Track my tickets", ta: "என் புகார்களைக் கண்காணி" } },
  escalate: { to: "/dashboard", label: { en: "Review SLA & escalate", ta: "SLA பார்த்து மேல்முறையீடு" } },
  browse_feed: { to: "/feed", label: { en: "Browse ward feed", ta: "வார்டு ஊட்டத்தைப் பார்" } },
  verify_identity: { to: "/auth", label: { en: "Verify identity", ta: "அடையாளம் சரிபார்" } },
  officer_tasks: { to: "/officer", label: { en: "Open officer tasks", ta: "அதிகாரி பணிகள்" } },
  view_analytics: { to: "/analytics", label: { en: "Open SLA analytics", ta: "SLA பகுப்பாய்வு" } },
  judicial_unseal: { to: "/oversight", label: { en: "Judicial unseal console", ta: "நீதித்துறை பலகை" } },
  none: { to: "", label: { en: "", ta: "" } },
} as const;

export type ActionKey = keyof typeof ACTIONS;
const ACTION_KEYS = Object.keys(ACTIONS) as ActionKey[];

const SYSTEM = `You are the Civic Voice Assistant embedded in "TN SmartMunicipality — Civic Escalation Portal", the Tamil Nadu urban local body grievance platform built under the Department of Municipal Administration and Water Supply (MAWS) framework. You know this product end to end and answer only about it.

=== IDENTITY & ACCESS ===
- Unified DigiLocker gateway at /auth. A 12-digit number is an Aadhaar (citizen) login; an 11-digit number is an IFHRMS employee ID (officer login). Both then require email OTP and mobile OTP.
- Officer signup auto-detects designation, department and ward from the IFHRMS roster and issues a Digital Officer ID Badge (state seal, photo, IFHRMS ID, scannable QR).
- Verified officers can toggle between Officer persona and Citizen persona (@CivicGuard_XX) from the topbar shield/user switch.
- Roles: Citizen, Field Officer (AE/SI/Overseer/Inspector), Zonal Assistant Commissioner, Corporation Commissioner, Ward Councillor (read-only audit), Admin.

=== ANONYMITY ===
- Citizens are pseudonymous (e.g. @CivicGuard_42). Real name, Aadhaar and phone are sealed and never visible to field engineers, inspectors or councillors.
- Only a judicial court subpoena, entered in the Judicial Oversight console with TWO dual-custody security keys, can unseal an identity; every unseal writes an immutable audit log.
- Citizen↔officer phone calls are masked VoIP; no raw numbers are exchanged.

=== FILING A GRIEVANCE ===
- /report opens the hardware camera via getUserMedia. Gallery uploads are impossible and rejected by design.
- The preview overlays live GPS lat/long, resolved ward/zone and timestamp. Metadata inspection purges images from mock-location or non-live sources (anti-spoofing).
- GPS is reverse-geocoded onto the 3-tier ULB hierarchy: Corporation, Municipality, Town Panchayat, then to Ward and Zone.
- Categories include water supply, sanitation/garbage, roads, streetlights, drainage, encroachment, public health.

=== SLA & ESCALATION MATRIX ===
- Emergency: 2h → Assistant Engineer → Zonal Assistant Commissioner.
- High: 12h → Sanitary Inspector → Health Officer.
- Medium: 24h → Overseer → City Engineer.
- Low: 48h → Inspector → Commissioner.
- On SLA breach the ticket auto-escalates one tier and logs an escalation event; a "+1 Hour" fast-forward button on the dashboard demonstrates this live.
- Deadlock breaker: stuck at Commissioner tier beyond 48h → auto "Joint Task Force Request" (TWAD Board, Highways Dept).
- GCC exception: Greater Chennai Corporation tickets bypass regional directorates and go straight to the MAWS State Secretariat, with a 24h deadlock breaker instead of 48h.
- Statuses: Submitted, Assigned, In Progress, Escalated, Resolved, Closed, Rejected/Frozen.

=== FEED, AUDIT & CLOSURE ===
- /feed is a public grievance social network: like, comment, repost, filter by ward/status/priority/department, plus shareable live tracking links (/track/<id>).
- Geofenced emergency banners alert residents within the affected radius.
- "Report Fake Incident" triggers the anti-spam penalty: account freeze plus legal disclosure generation.
- Closure is dual-verified: complainant approval AND ward resident voting using ZKP ward tokens. Officers must upload resolution proof photos.

=== OVERSIGHT & REPORTS ===
- /officer: ward-scoped task board, proof uploads, masked calls.
- /analytics: commissioner SLA compliance, resolution time, volume charts by ward/department/officer, with CSV and PNG export.
- /reports: archive of scheduled SLA reports generated daily at 06:00 IST and delivered to commissioners via the in-app notification bell.
- /oversight: judicial subpoena decryption console.

=== ANSWER RULES ===
- Reply in Tamil when lang=ta, otherwise English. Be concise: 2-4 sentences, plain text, no markdown.
- Always ground the answer in the facts above; never invent ticket numbers, officer names, statutes or timelines.
- Choose 1-3 reference keys that genuinely support the answer, and one action key for the most useful next step ("none" if none applies).`;

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    refs: { type: "array", items: { type: "string", enum: REF_KEYS } },
    action: { type: "string", enum: ACTION_KEYS },
  },
  required: ["text", "refs", "action"],
};

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const empty = { text: "", refs: [] as ReferenceKey[], action: "none" as ActionKey };
    const key = process.env.GEMINI_API_KEY;
    if (!key) return { ...empty, error: "missing_key" as const };

    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: `${SYSTEM}\n\nCurrent language: ${data.lang}` }],
            },
            contents: data.messages.map((m) => ({
              role: m.role === "user" ? "user" : "model",
              parts: [{ text: m.text }],
            })),
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 600,
              responseMimeType: "application/json",
              responseSchema: RESULT_SCHEMA,
            },
          }),
        },
      );

      if (!res.ok) {
        const body = await res.text();
        console.error(`Gemini request failed [${res.status}]: ${body}`);
        return { ...empty, error: "upstream" as const };
      }

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const raw =
        json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
      if (!raw) return { ...empty, error: "empty" as const };

      let parsed: { text?: string; refs?: string[]; action?: string } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { text: raw };
      }

      const text = (parsed.text ?? "").trim();
      if (!text) return { ...empty, error: "empty" as const };

      const refs = (parsed.refs ?? []).filter((r): r is ReferenceKey =>
        (REF_KEYS as string[]).includes(r),
      );
      const action = ((ACTION_KEYS as string[]).includes(parsed.action ?? "")
        ? parsed.action
        : "none") as ActionKey;

      return { text, refs: refs.slice(0, 3), action, error: null };
    } catch (e) {
      console.error("Gemini call threw", e);
      return { ...empty, error: "network" as const };
    }
  });
