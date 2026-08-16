# TN Smart Municipality — Civic Escalation Portal

A full-stack, role-based digital governance platform for Tamil Nadu urban local bodies. Citizens can report civic grievances with live, tamper-resistant geotagged evidence; municipal officers, field workers, zonal commissioners and ward councillors can triage, assign, track and resolve tickets against an SLA-driven escalation matrix. The application is bilingual (English + Tamil, with Tanglish support in the AI assistant), mobile-first and designed for production deployment on the Lovable Cloud / Supabase stack.

---

## Table of Contents

1. [What this project does](#what-this-project-does)
2. [Live URLs](#live-urls)
3. [Tech stack](#tech-stack)
4. [Key features](#key-features)
5. [User roles & access control](#user-roles--access-control)
6. [Grievance workflow](#grievance-workflow)
7. [Project structure](#project-structure)
8. [Database schema overview](#database-schema-overview)
9. [Security & RLS](#security--rls)
10. [Internationalization (i18n)](#internationalization-i18n)
11. [AI assistant / Gemini](#ai-assistant--gemini)
12. [Environment variables](#environment-variables)
13. [Development setup](#development-setup)
14. [Build & deploy](#build--deploy)
15. [Cron hooks & public API](#cron-hooks--public-api)
16. [MCP integration](#mcp-integration)
17. [Scripts reference](#scripts-reference)
18. [Troubleshooting](#troubleshooting)
19. [License & ownership](#license--ownership)

---

## What this project does

TN Smart Municipality replaces the traditional paper/phone complaint loop with a closed-loop, transparent, location-aware system:

- **Citizens** file complaints by taking a live photo with their phone camera. GPS coordinates, reverse-geocoded ward/zone and a timestamp are captured automatically; gallery uploads and mocked locations are rejected.
- **Field workers** see delivery-style tracking: accept the job, travel to the site, arrive inside a geofence, complete the work, and submit before/after photo evidence with EXIF GPS verification.
- **Officers** review evidence, approve or reject it, and send the complaint to citizen verification.
- **Citizens verify** the fix within a 6-hour window. If they are not satisfied, they can reopen the ticket with a new photo and live GPS proof.
- **Auto-escalation** moves the complaint up the SLA ladder when deadlines are missed; a built-in “+1 Hour” fast-forward button demonstrates this for demos and testing.
- **Public feed** lets residents browse, like, comment, repost and share live tracking links for any complaint, increasing accountability.
- **Ward & councillor directory** is sourced from the official Greater Chennai Corporation dataset.
- **Analytics dashboard** gives commissioners SLA compliance charts, resolution-time breakdowns, ward heatmaps and exportable reports.
- **Voice assistant** answers civic questions in English, Tamil or Tanglish, grounded in live database records and official directory data.

The entire design is built around a white + purple (#6C4CE8) theme, with the Government of Tamil Nadu emblem as the app brand and the Ripon Building (Greater Chennai Corporation headquarters) as the landing-page hero.

---

## Live URLs

- **Preview:** `https://id-preview--5dbf7f0c-ee00-48b7-a4f2-166457b3a49a.lovable.app`
- **Published:** `https://muncipalhub.lovable.app`

> These URLs are managed by the Lovable platform. If you clone the project and connect it to a different Lovable project or Supabase backend, the URLs will change.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start v1 (React 19 + Vite 7) |
| Routing | TanStack Router (file-based) |
| Styling | Tailwind CSS v4 + shadcn/ui primitives |
| State / Data | TanStack Query, React hooks |
| Backend | Lovable Cloud (Supabase): Postgres + Auth + Storage + Realtime |
| Server functions | `createServerFn` from `@tanstack/react-start` |
| Public HTTP routes | TanStack file routes under `src/routes/api/public/*` |
| AI | Lovable AI Gateway (`google/gemini-3.6-flash`) with fallback to direct Gemini API |
| Maps / Location | Browser Geolocation API + reverse geocoding helpers |
| Charts | Recharts |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |
| Internationalization | Custom i18n context + locale dictionaries (`src/lib/locales/`) |
| Package manager | Bun |
| Edge runtime | Cloudflare Worker-compatible via Lovable build |

---

## Key features

### Landing page
- Ripon Building background with a dark overlay for readability.
- Top-left Tamil Nadu emblem, top-right language toggle (English / தமிழ்).
- Centered title: **TN Smart Municipality**.
- “Enter the Portal” call-to-action with a safe fallback to full-page navigation.
- Pure CSS entrance animations so content is visible immediately even if hydration is delayed.

### Authentication gateway (`/auth`)
- Unified DigiLocker-style identity input:
  - 12-digit number → Citizen (Aadhaar).
  - 11-digit number → Officer (IFHRMS employee ID).
- Email and mobile OTP verification (simulated OTP flow for demo convenience).
- Anonymous citizen pseudonyms (`@CivicGuard_XX`) — real name and Aadhaar are sealed and never shown to officers.
- Officer onboarding creates a digital badge and adds the officer to the ward roster.
- Officers can toggle between Officer and Citizen persona via the top bar.
- Dev-only `DemoBypass` component for local testing.

### Public feed (`/feed`)
- Live list of complaints with ward filters, status filters, priority filters and department filters.
- Like, comment, repost and “report fake incident” actions.
- Geofenced emergency banner based on the user’s current location.
- Shareable tracking links (`/track/:id`).

### Complaint filing (`/report`)
- Hardware camera only (`getUserMedia`). No gallery uploads.
- Live GPS overlay on the camera preview.
- Anti-spoofing checks (accuracy, freshness, mock-location detection).
- AI triage derives priority from the title + description.
- Auto-routing to the correct ULB → Zone → Ward.
- Manual ward override if the GPS fix is wrong.

### Dashboard (`/dashboard`)
Role-specific views:
- **Citizen** — My grievances, resolution verification, masked officer calls, fast-forward SLA demo.
- **Field Officer** — Ward-scoped task queue, proof upload, masked calls.
- **Zonal Commissioner** — Zone-level breach summary, escalation queue.
- **Corporation Commissioner** — City-wide stats, bulk actions.
- **Ward Councillor** — Read-only audit of all ward complaints.
- **Admin** — Analytics link.

### Officer workspace (`/officer`)
- Verification queue for submitted evidence.
- Officer approval/rejection with reason.
- Masked calls to complainants.

### Worker field console (`/worker`)
- Delivery-style tracking: accept → travel → arrive → work → evidence → done.
- GPS geofencing for arrival and evidence capture.
- Offline-tolerant UI with retry on reconnect.

### Tracking page (`/track/:id`)
- Public, read-only progress timeline for a single complaint.
- Shareable URL for social media / WhatsApp.

### Analytics (`/analytics`)
- SLA compliance, resolution times, ward volume, department performance.
- CSV and PNG export.

### Reports (`/reports`)
- Archive of scheduled SLA reports generated daily by a cron hook.

### Directory (`/directory`)
- Official Greater Chennai Corporation hierarchy: ULB → Zone → Ward → Councillor.
- Search by ward number or name, filter by zone.

### Voice assistant
- Floating chat button on every page.
- Lazy-loaded for performance.
- Supports English, Tamil and Tanglish.
- Grounded in database records (directory, SLA policy, complaint status) and returns one-tap action buttons.

---

## User roles & access control

Roles are stored in a dedicated `public.user_roles` table, **never** on the profile table. The role check uses a `SECURITY DEFINER` helper `public.has_role(user_id, role)` to avoid recursive RLS.

| Role | Role key | What they can do |
|------|----------|------------------|
| Citizen | `citizen` | File complaints, verify resolutions, browse the public feed, like/comment/repost, mask-call officers. |
| Field Officer | `field_officer` | View ward queue, start work, upload proof, mask-call complainants. |
| Zonal Commissioner | `zonal_commissioner` | View zone queues, escalate breaches, reassign. |
| Corporation Commissioner | `commissioner` | City-wide analytics, bulk assignment, deadlock breaker. |
| Ward Councillor | `councillor` | Read-only audit of ward complaints. |
| Field Worker | `worker` | Accept jobs, delivery-style tracking, submit evidence. |
| Admin | `admin` | Full analytics, role management, evidence deletion. |

> Role-based redirects are enforced in both the UI (`useAuthorizedRole`, `RoleGate`) and at the route level. Workers are redirected to `/worker`, citizens to `/feed`, officers to `/officer`.

---

## Grievance workflow

The complaint state machine is implemented in `src/lib/workflow.ts` and enforced server-side in `src/lib/workflow.functions.ts` / `src/lib/workflow.server.ts`.

```
Submitted
   ↓
Assigned → Worker accepted
   ↓
Travelling (GPS tracking)
   ↓
Approaching / Arrived (geofence)
   ↓
In progress
   ↓
Evidence submitted (photo + EXIF + live GPS + AI check)
   ↓
Officer review
   ↓
Officer approved
   ↓
Citizen verification (6-hour window)
   ↓
Resolved — or — Reopened — or — Auto-closed (no response)
```

### Evidence verification dimensions
- **GPS verification** — live worker GPS vs. complaint location (default 50 m radius).
- **EXIF verification** — embedded photo GPS vs. complaint location.
- **AI verification** — Gemini checks the image is relevant to the reported category and explains its confidence.
- **Officer review** — human final approval.

### Citizen “not satisfied” reopening
If a citizen rejects the resolution, the app requires:
- A description of why the fix is inadequate.
- A new photo taken with the hardware camera.
- Live GPS within the configured radius.
The complaint then reopens and returns to officer review.

### Location permission failure
If the user denies GPS access, the app uses a `LOCATION_UNAVAILABLE` status instead of fabricating coordinates.

### Auto-escalation rules
| Priority | SLA | First responder | Escalates to |
|----------|-----|-----------------|--------------|
| Emergency | 2h | Assistant Engineer | Zonal Assistant Commissioner |
| High | 12h | Sanitary Inspector | Health Officer |
| Medium | 24h | Overseer | City Engineer |
| Low | 48h | Inspector | Commissioner |
| GCC deadlock | 24h | Commissioner | Joint Task Force request (TWAD, Highways) |

---

## Project structure

```
/dev-server
├── src
│   ├── assets/                  # Static images (TN emblem, Ripon Building hero)
│   ├── components/              # Reusable UI components
│   │   ├── ui/                  # shadcn/ui primitives
│   │   ├── GeoCamera.tsx        # Live GPS camera with anti-spoofing
│   │   ├── TopBar.tsx           # Navigation + role switcher
│   │   ├── ComplaintCard.tsx    # Feed card
│   │   ├── DeliveryTracker.tsx  # Delivery-style progress
│   │   ├── VoiceAssistantLazy.tsx # Lazy-loaded AI chat
│   │   └── ...
│   ├── lib/                     # Business logic, server functions, helpers
│   │   ├── locales/             # English + Tamil dictionaries
│   │   ├── i18n.tsx             # i18n context & hook
│   │   ├── assistant.functions.ts # Gemini AI server function
│   │   ├── workflow.ts          # Workflow types & state machine
│   │   ├── workflow.functions.ts  # Server functions for workflow actions
│   │   ├── workflow.server.ts   # Server-side DB mutations for workflow
│   │   ├── data.ts              # Data fetching helpers
│   │   ├── sla.ts               # SLA matrix & clock logic
│   │   ├── triage.ts            # AI triage scoring
│   │   ├── session.ts           # Role & session helpers
│   │   ├── directory.ts         # Directory client functions
│   │   ├── directory.server.ts  # Directory server lookup
│   │   └── mcp/                 # Lovable MCP tools
│   ├── routes/                  # TanStack Router file routes
│   │   ├── index.tsx            # Landing page
│   │   ├── auth.tsx             # Sign-in / sign-up
│   │   ├── feed.tsx             # Public feed
│   │   ├── report.tsx           # File complaint
│   │   ├── dashboard.tsx        # Role dashboards
│   │   ├── officer.index.tsx    # Officer task board
│   │   ├── worker.tsx           # Worker field console
│   │   ├── track.$id.tsx        # Public tracking page
│   │   ├── directory.tsx        # Ward/councillor directory
│   │   ├── analytics.tsx        # Commissioner analytics
│   │   ├── reports.tsx          # Report archive
│   │   ├── api/public/hooks/    # Public cron/webhook endpoints
│   │   └── __root.tsx           # Root layout
│   ├── hooks/                   # Custom React hooks
│   ├── integrations/supabase/   # Auto-generated Supabase clients
│   ├── styles.css               # Tailwind v4 + theme tokens
│   └── router.tsx               # TanStack Router setup
├── supabase/
│   └── migrations/              # Database migrations (apply in order)
├── public/                      # Static public assets
├── package.json
├── vite.config.ts
├── tsconfig.json
├── styles.css
└── README.md
```

> Note: The project also has a legacy `/components`, `/lib` and `/routes` directory at the repository root. These are not the active source; the authoritative source is under `src/`.

---

## Database schema overview

The main Supabase tables are:

- `profiles` — user pseudonym, ward, language, DigiLocker verification status, frozen flag.
- `user_roles` — role assignments (citizen, field_officer, zonal_commissioner, commissioner, councillor, worker, admin).
- `complaints` — the core grievance record (title, description, category, priority, status, SLA, GPS, photo, assigned officer, etc.).
- `complaint_events` — audit log of every state change and assignment.
- `complaint_likes`, `complaint_reposts`, `complaint_comments` — public feed engagement.
- `fraud_flags` — citizen-reported fake incidents routed to AI inspection.
- `workers` — field worker roster (department, ward, active flag).
- `assignments` — worker-to-complaint assignments with SLA deadlines and tracking timestamps.
- `complaint_evidence` — before/after evidence with GPS, EXIF and AI review states.
- `citizen_verifications` — citizen feedback window with deadline, decision, photo, reason.
- `resolution_votes` — ward resident ZKP-token votes for dual-verification closure.
- `ward_officials` / `official_directory` / `zones` / `ulbs` — official GCC directory data.
- `storage.objects` — evidence images in the `evidence` bucket.
- `migrations` — schema history managed by Supabase.

All tables have Row-Level Security (RLS) enabled, with GRANT statements and policies per role. See the migration files in `supabase/migrations/` for the exact definitions.

---

## Security & RLS

Security is implemented at multiple layers:

- **RLS policies** restrict every table to the minimum access required by each role.
- **Role check helper** `public.has_role(uuid, app_role)` is `SECURITY DEFINER` and reads the sealed `user_roles` table.
- **No public read of sensitive data** — profiles, resolution votes, fraud flags and evidence are all scoped to owners or officials.
- **Admin-only mutations** — deleting evidence or updating roles requires the `admin` role.
- **Account freeze** — fake-incident reports can freeze a citizen account; a database trigger prevents users from unfreezing themselves or self-verifying.
- **Anti-spoofing** — evidence photos must come from the live camera; mocked GPS or stale fixes are rejected.
- **Masked calls** — citizen and officer phone numbers are never exchanged; calls are relayed through an alias modal.
- **Secrets** — API keys (Gemini, Lovable, cron secret) are stored as environment variables and never exposed in the client bundle.

Recent security fixes include:
- HIBP-style password protection.
- Sealed role-check helper isolation.
- Restricted storage/object policies.
- Admin-only evidence deletion and role updates.
- Scoped read access for `profiles` and `resolution_votes`.
- Cron hooks secured by `CRON_SECRET`.
- Self-role-assignment limited to the `citizen` role.

---

## Internationalization (i18n)

The app supports **English** and **Tamil** (தமிழ்), with full dictionaries in `src/lib/locales/`:

- `common.ts` — shared phrases.
- `pages.ts` — page-specific labels.
- `group-a.ts`, `group-b.ts`, `group-c.ts`, `group-d.ts` — split dictionaries for easier maintenance.

Use `useLang()` from `@/lib/i18n` to get the current language, `t(key)` translator and `setLang()` / `toggle()` switcher. New keys must be added to all locale dictionaries.

The AI assistant also understands **Tanglish** (Tamil-English mixed input) and replies in the detected language.

---

## AI assistant / Gemini

The assistant is a `createServerFn` in `src/lib/assistant.functions.ts`. It:

1. Receives the chat history and current app language.
2. Looks up relevant official directory records from the database (no hallucination).
3. Calls the **Lovable AI Gateway** (`google/gemini-3.6-flash`) if `LOVABLE_API_KEY` is set.
4. Falls back to the direct **Gemini API** using `GEMINI_API_KEY` if needed.
5. Returns a JSON object with `text`, `refs` (help links) and `action` (one-tap button).

The system prompt is strict: concise, no markdown, no invented officer names or ticket numbers, and answers only about the TN Smart Municipality product.

---

## Environment variables

The project uses two layers of environment variables. **Server-only** keys are read inside `createServerFn` handlers. **Browser** keys use the `VITE_` prefix.

### Required for local development

```bash
# Supabase project (browser + server)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id

# Supabase server-side (used by server functions, optional if you only use VITE_* keys)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_PROJECT_ID=your-project-id

# AI (optional but recommended)
LOVABLE_API_KEY=your-lovable-api-key      # preferred
GEMINI_API_KEY=your-gemini-api-key        # fallback

# Public cron/webhook endpoint (optional)
CRON_SECRET=your-random-secret
```

> **Important:** Do not commit real keys to Git. Use `.env` locally and Lovable Secrets / Supabase Vault in production. The keys shown in the project’s `.env` are Lovable-managed and should be rotated if you share the repository.

---

## Development setup

### Prerequisites

- Bun 1.x (or Node.js 20+ with `npm` / `pnpm`)
- A Supabase project (Lovable Cloud or self-hosted)

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd <repo-name>

# 2. Install dependencies
bun install

# 3. Set up environment variables
cp .env.example .env   # or edit the existing .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, etc.

# 4. Apply database migrations
# If using Lovable Cloud, migrations are applied through the Lovable backend UI.
# If using Supabase CLI locally:
supabase db reset

# 5. Create the storage bucket
# Create a public bucket named "evidence" in Supabase Storage and set its RLS policies.

# 6. Seed directory data (optional)
# Import the official GCC ward/councillor/zone CSV into the relevant directory tables.

# 7. Start the dev server
bun run dev
```

The app runs by default at `http://localhost:8080`.

---

## Build & deploy

```bash
# Development build
bun run build:dev

# Production build
bun run build

# Preview the production build locally
bun run preview

# Lint and format
bun run lint
bun run format
```

The project is built for a Cloudflare Worker edge runtime. Do not use Node-only packages (e.g., `sharp`, `child_process`, `fs.watch`) in server functions or SSR. Stick to Web standard APIs, `fetch`-based clients and pure JavaScript.

---

## Cron hooks & public API

Public routes under `src/routes/api/public/*` are reachable without authentication:

- `POST /api/public/hooks/generate-sla-report` — Generates the daily SLA report archive. Must be called with `X-Cron-Secret: <CRON_SECRET>`.
- `POST /api/public/hooks/workflow-sweep` — Runs the workflow state-machine sweep (cron endpoint).

Configure your scheduler (e.g., pg_cron, GitHub Actions, Cloudflare Cron) to hit these URLs with the `CRON_SECRET` header.

---

## MCP integration

The project exposes Lovable MCP tools under `.mcp/` for external agent integration:

- `list-tools.ts` — Lists available tools.
- `get-complaint.ts` — Fetch a single complaint.
- `list-complaints.ts` — List complaints with filters.
- `officer-queue.ts` — Officer task queue.
- `sla-analytics.ts` — SLA analytics.
- `update-complaint-status.ts` — Update complaint status.

These tools are used by the Lovable editor and compatible MCP clients.

---

## Scripts reference

From `package.json`:

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite dev` | Start local dev server |
| `build` | `vite build` | Production build |
| `build:dev` | `vite build --mode development` | Development build |
| `preview` | `vite preview` | Preview production build |
| `lint` | `eslint .` | Run ESLint |
| `format` | `prettier --write .` | Format all files |

---

## Troubleshooting

### Sign-in page bounces back / looks “stuck”
If you already have an active Supabase session, the auth page no longer auto-redirects. It shows your current account with options to go to the Feed or Sign out. If you see the old bounce, clear `localStorage` / cookies for the domain and reload.

### “Enter the Portal” button not navigating
The landing page uses a TanStack `Link` with a fallback to `window.location.href`. If the published build still fails, a full hard refresh usually resolves it.

### GPS accuracy rejected
Evidence capture requires a live GPS fix. Desktop browsers may report poor accuracy via Wi-Fi triangulation. The app now accepts accuracy up to 50 km for evidence capture and tests, but real production submissions should still come from a phone with GPS enabled.

### Slow first load
The landing page hero and TN emblem are preloaded. The Voice Assistant is lazy-loaded. If you experience slowness, check that the hero image is compressed and that the Supabase connection is healthy.

### 500 on assistant endpoint
The assistant endpoint requires either `LOVABLE_API_KEY` or `GEMINI_API_KEY`. If both are missing, it returns a `missing_key` error. Check your environment variables.

---

## License & ownership

This project was built with Lovable. The code is owned by the project creator and is free to fork, host, modify or publish independently. When moving the project to a new Supabase backend, remember to:

1. Re-create the environment variables.
2. Apply all migrations in order.
3. Re-create the `evidence` storage bucket and its policies.
4. Re-add the AI secrets (`LOVABLE_API_KEY` or `GEMINI_API_KEY`).
5. Re-configure OAuth providers (Google) in the new backend if you use social auth.
6. Re-import the GCC directory dataset if you need the ward/councillor directory.

---

**Maintained by:** Vardhu21 / Sarvesh
**Last updated:** August 2026
