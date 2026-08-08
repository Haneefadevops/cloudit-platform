# FixifAI Landing Page — Build Plan & Prompts (Phased)

This document is the complete brief for building the FixifAI validation landing page.
It is executed in a fresh Kimi session, **phase by phase**. After EVERY phase the
session must stop and report — the user reviews the result (and may verify with
another session) before the next phase begins. **Never continue to the next phase
without explicit user approval. Never deploy or push git without explicit approval.**

## 1. Goal

Convert visiting maintenance contractors (and in-house maintenance teams) into
**free-pilot signups**. The page is a validation instrument: we measure demand by
signups before building the full product.

## 2. Locked Decisions (from product discussions)

| Item | Decision |
|---|---|
| Headline | "Run your maintenance business from one screen" |
| Demo format | Hybrid: guided tour (4 steps) → "explore yourself" free mode |
| Demo company | CityFix Maintenance Services (Pvt) Ltd — **multi-trade** (AC, generators, lifts, fire systems) so no trade feels excluded |
| Contact | WhatsApp button → `https://chat.cloudit.lk`, email `info@cloudit.lk` |
| Temporary domain | `fixifai.cloudit.lk` (own domain later; brand stays "FixifAI") |
| About block | "About CloudIT" credibility section included |
| Palette | Teal `#008080` + Orange `#FF6100` |
| Audience | Both service contractors AND in-house teams — page speaks to both |

## 3. Brand Assets

| Asset | Path (repo root) | Use |
|---|---|---|
| FixifAI logo (color) | `Fixif.svg` | Header, footer, hero — **always on white/light surfaces** |
| CloudIT logo | `logo.svg` / `logo.png` | About CloudIT block (light bg) |
| CloudIT logo white | `logo-white.svg` / `logo-white.png` | Dark/teal backgrounds |
| CloudIT logo black | `logo-black.svg` / `logo-black.png` | Spare |

Copy these into `apps/fixifai-web/public/brand/` during Phase 1 (keep root files untouched).

**Logo visibility rule (agreed with user):** the colored FixifAI logo must always
remain visible — place it on white surfaces, or inside a white rounded badge when
it appears over teal/dark sections. Never recolor it.

## 4. Design Direction — "modernized, not a usual website"

Reference style: modern SaaS (Linear / Stripe / Framer style), not template-looking.

- **Dark-first hero**: deep teal-tinted dark background (`#013c3c`→`#008080` gradient), big bold typography (use `Poppins` or `Space Grotesk` via next/font), logo in white badge, orange CTA glow.
- **Bento-grid feature section** instead of uniform cards — mixed-size tiles, subtle borders, hover lift.
- **Scroll animations**: fade/slide-in per section (framer-motion — already used in `apps/thereplyte-landing`, reuse that dependency version).
- **Floating mockups**: dashboard mockup tilted in 3D perspective in hero, soft shadows; phone mockups for customer/technician views.
- **Micro-interactions**: animated counters (jobs completed, uptime), marquee strip of trades ("AC · Lifts · Generators · Fire & Security · Facilities · CCTV · Elevators…").
- **Glassmorphism** sparingly on nav (sticky, blur backdrop).
- Pain cards: 6 cards with orange icon + problem + one-line FixifAI answer.
- Mobile-first, generous whitespace, max width ~1200px container.
- Section rhythm: dark hero → white problems → teal-tinted how-it-works → white demo → dark industries/pricing accent → white form → dark footer.

## 5. Page Sections (in order)

1. **Header** — sticky glass nav; FixifAI logo (white badge), links: How it works / Demo / Industries / Pricing / FAQ; orange CTA "Join Free Pilot".
2. **Hero (dark)** — H1 "Run your maintenance business from one screen"; sub: "QR-tagged assets, AI job intake, GPS-verified technicians — built for every maintenance trade in Sri Lanka." CTAs: "Join the Free Pilot" (orange) + "See it in action" (scroll to demo). Trust line: "Free for 3 months · No card required · 50% off Year 1 for founding customers". Tilted dashboard mockup. Trade marquee strip below.
3. **Problems (6 cards, research-validated)** — heading "Sound familiar?":
   1. Jobs get lost in WhatsApp and phone calls → every request becomes a tracked job
   2. You can't prove your technician showed up → GPS check-in + photos prove every visit
   3. Invoices go out weeks late → invoice on job completion, paid online
   4. AMC renewals and service visits slip → automatic reminders and recurring job scheduling
   5. Equipment history lives in someone's head → scan the QR, see the full service story
   6. Quotes sit in a truck while the customer hires your competitor → on-site quotations, one-tap customer approval
4. **How it works (3 steps)** — ① Customer scans QR / uses your service link ② AI creates a triaged job with full asset history ③ Technician completes it on the mobile app — GPS-verified, photos, signature.
5. **Two audience cards** — "For Service Companies" (quotations, invoices, branded client portal) / "For In-House Teams" (downtime tracking, PM schedules, cost per asset). Each CTA pre-selects type in the signup form.
6. **Interactive Demo** — see §6.
7. **Industries** — heading "If you maintain it, FixifAI manages it"; cards: AC & Refrigeration, Lifts & Elevators, Generators & Power, Fire & Security, Facilities Management, CCTV & Electronics; note: "Your trade not listed? FixifAI adapts — custom asset types and checklists."
8. **Pricing teaser** — 3 LKR tiers (Starter 7,500 / Pro 15,000 / Business 30,000 per month), pilot banner: "Pilot customers: FREE for 3 months"; WhatsApp Automation add-on note.
9. **About CloudIT** — CloudIT logo, short credibility text: FixifAI is built by CloudIT Solutions (Pvt) Ltd, the team behind TouchOrbit HR, OrbitOne and the CloudIT platform.
10. **Pilot Signup Form** — fields: Company name, Your name, Phone (WhatsApp), Email, Trade (dropdown: AC & Refrigeration / Lifts / Fire & Security / Generators / Facilities / CCTV / Other), Team size (1–5 / 6–15 / 16+), Current method (Paper / WhatsApp / Excel / Other software), Business type (Service contractor / In-house team / Both). Submit → success state ("We'll contact you within 24 hours on WhatsApp").
11. **FAQ** — Is it really free for 3 months? / Do technicians need training? / What happens after the pilot? / Do my customers need to install an app? / Does it work in Sinhala/Tamil?
12. **Footer (dark)** — FixifAI logo on white badge, WhatsApp (chat.cloudit.lk) + email (info@cloudit.lk), CloudIT credit line, © 2026.

## 6. Interactive Demo Spec (hybrid)

Embedded at `#demo`, no backend — static JSON seed data, client-side state.

**Demo company:** CityFix Maintenance Services (Pvt) Ltd — 6 technicians, mixed
client sites (hotel, garment factory, apartment complex, office tower) with AC
units, generators, lifts, fire panels.

**Guided tour (4 steps, "Next" button + narration overlay):**
1. **Customer phone mockup** — scan QR on a hotel AC → report form → AI chat asks "Is the unit leaking water or not cooling?" → job `#1042` created with tracking number.
2. **Manager dashboard** — job #1042 arrives live on the kanban (New column, highlighted); visitor assigns "Kasun" via drag or click; mini map shows technician pins.
3. **Technician phone mockup** — job appears with Navigate button, GPS check-in, checklist, before/after photo placeholders, "Voice report" button.
4. **Completion** — customer view shows service report + "Approve & Pay" button; dashboard kanban moves the card to Done; animated counter ticks.

**Free-explore mode** — after the tour (or via "Skip tour, explore"): a
clickable mini-dashboard with the seeded jobs, assets (each with QR + history
timeline), technicians list. Read-only-ish, playful.

Demo data: ~8 jobs across statuses, 6 technicians (Sri Lankan names), 12 assets
across 4 sites, all in a single `demo-data.ts`.

## 7. Phased Execution — STOP AND REPORT AFTER EACH PHASE

> **Rule for the build session:** complete exactly ONE phase, run its verification,
> present results (with how to view/test), then STOP and wait for the user's
> explicit approval before starting the next phase.

---

### PHASE 1 — Scaffold & page shell

**Objective:** app running locally, all 12 sections present with final copy, rough layout.

**Prompt to paste:**
> Read docs/FIXIFAI_LANDING_BUILD_PROMPT.md and follow it exactly — especially the phased rule in §7: complete only Phase 1, then stop. Scaffold `apps/fixifai-web` (Next.js 14, dev port 3013, package name `@cloudit/fixifai-web`), matching the stack patterns of `apps/thereplyte-landing` (framer-motion etc.). Copy the brand assets per §3 into `public/brand/`. Build the page shell with all 12 sections from §5 using real final copy (demo section can be a placeholder block this phase). Basic clean layout only — full design treatment comes in Phase 2. Run it locally and tell me how to view it. Then STOP.

**Verify before approving:**
- [ ] `http://localhost:3013` loads
- [ ] All 12 sections visible in order with real copy
- [ ] FixifAI + CloudIT logos load correctly
- [ ] No console errors

---

### PHASE 2 — Full modern design treatment

**Objective:** the page looks premium — this is the phase to be picky about.

**Prompt to paste:**
> Phase 2 per docs/FIXIFAI_LANDING_BUILD_PROMPT.md §4 and §7. Apply the full modern design treatment: dark teal gradient hero with tilted 3D dashboard mockup and orange CTA glow, bento-grid features, scroll animations (framer-motion), trades marquee, glass sticky nav, the section rhythm from §4. Palette #008080 / #FF6100, FixifAI logo only on white surfaces/badges. Fonts: Poppins or Space Grotesk via next/font. Mobile-first and responsive. Show me the result locally, then STOP.

**Verify before approving:**
- [ ] Hero looks striking on desktop AND mobile
- [ ] Scroll animations smooth, not excessive
- [ ] Logo crisp everywhere, never on clashing backgrounds
- [ ] Colors match palette exactly (#008080 / #FF6100)
- [ ] Text readable, spacing generous

---

### PHASE 3 — Interactive demo

**Objective:** the hybrid guided tour + explore mode works end-to-end.

**Prompt to paste:**
> Phase 3 per docs/FIXIFAI_LANDING_BUILD_PROMPT.md §6 and §7. Build the interactive demo: seeded `demo-data.ts` (CityFix Maintenance Services — 6 technicians, ~8 jobs, 12 assets across 4 sites, mixed trades), the 4-step guided tour with phone + dashboard mockups and narration, then free-explore mode with skip option. All client-side, no backend. Keep it consistent with the Phase 2 design. Show me locally, then STOP.

**Verify before approving:**
- [ ] Tour completes all 4 steps without dead ends
- [ ] Skip → explore mode works; kanban/assets/technicians clickable
- [ ] Demo looks like the same product family as the page design
- [ ] Works on mobile width

---

### PHASE 4 — Signup form & final polish

**Objective:** form stores leads, page is complete.

**Prompt to paste:**
> Phase 4 per docs/FIXIFAI_LANDING_BUILD_PROMPT.md §5.10 and §7. Wire the pilot signup form: client-side validation, a Next.js API route that stores submissions (simple self-contained storage — JSON file or SQLite is fine) and returns success; success state message. Also final polish pass: FAQ accordion, footer links, WhatsApp button linking to https://chat.cloudit.lk and email info@cloudit.lk, page title/meta/OG tags ("FixifAI — Run your maintenance business from one screen"). Then run a full local review and STOP.

**Verify before approving:**
- [ ] Form validates bad input, submits good input, shows success state
- [ ] Submission is actually stored (check the storage file/db)
- [ ] All links correct (WhatsApp, email, anchors)
- [ ] `npm run build -w @cloudit/fixifai-web` passes clean

---

### PHASE 5 — Deploy prep (ONLY after explicit approval of the full site)

**Prompt to paste:**
> Phase 5 per docs/FIXIFAI_LANDING_BUILD_PROMPT.md §9. The site is approved. Create `apps/fixifai-web/Dockerfile` (follow the pattern of another Next.js app in this repo, e.g. apps/thereplyte-landing) and `infra/fixifai-web/docker-compose.yml` with Traefik labels for `fixifai.cloudit.lk` — pattern: `infra/orbitone-web/docker-compose.yml` (websecure entrypoint, cloudflare certresolver, wildcard cert already exists, container port 3013). Verify the production Docker build runs locally if possible. Do NOT push git and do NOT deploy — report the files for review, then STOP.

**Verify before approving:**
- [ ] Dockerfile builds (`docker build` succeeds or local `npm run build && npm start` works)
- [ ] Compose labels match the orbitone-web pattern with correct host/port
- [ ] User does the Cloudflare DNS step (§9) — only then deploy

## 8. Deployment (after all phases approved)

- App port: **3013** (web). Traefik router: `Host(\`fixifai.cloudit.lk\`)`, entrypoint `websecure`, certresolver `cloudflare` (wildcard `*.cloudit.lk` cert already exists — no new cert work).
- Deploy path follows repo convention: GitHub Actions on push to `master` (extend deploy workflow to include fixifai-web), or manual `docker compose up -d` from `infra/fixifai-web` on the server.
- **Git push is done by the user**, not the session.

## 9. Cloudflare DNS Setup (user action)

Traefik already holds a **wildcard certificate** for `*.cloudit.lk`, so only a DNS
record is needed:

1. Log into Cloudflare dashboard → select the **cloudit.lk** zone.
2. Go to **DNS → Records → Add record**.
3. Enter:
   - **Type:** `A`
   - **Name:** `fixifai` (Cloudflare expands it to `fixifai.cloudit.lk`)
   - **IPv4 address:** the Hetzner server IP (same IP your other `*.cloudit.lk` records use — copy it from an existing record like `api-orbitone`)
   - **Proxy status:** match your existing app records (orange = proxied recommended; Traefik handles the real TLS cert)
   - **TTL:** Auto
4. Save. DNS propagates in minutes.
5. After deploy, browse `https://fixifai.cloudit.lk` — SSL works immediately via the existing wildcard cert.

## 10. Out of Scope (this page)

No backend product, no real login, no payments, no Sinhala/Tamil (phase 2 of page),
no WhatsApp API integration (the button is a plain link to chat.cloudit.lk).
