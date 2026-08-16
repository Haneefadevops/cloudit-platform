# Task: Landing page multi-channel rewrite (spec 7)

Phase: 7 | App: `apps/thereplyte-landing`

## Goal

Reposition the landing page from "AI employee for WhatsApp" to multi-channel
(WhatsApp + Messenger + Instagram), showcase the features built this cycle
(AI workflows, self-qualifying CRM, comment moderation, transactional API),
and upgrade the hero demo to show channels + a comment→DM scenario.

**IMPORTANT — copy ownership:** all user-facing text in this spec is DEFAULT
copy. The owner will finalize wording afterwards. Keep every text string easy
to find and edit (inline strings as today — do not introduce a copy config
system; just keep the existing structure). Do not "improve" the default copy.

## Context (read these, nothing else)

- `docs/CODEX_PLAYBOOK.md` — workflow and rules (read first, always)
- `apps/thereplyte-landing/src/components/` — Hero.tsx, ChatMockup.tsx,
  TrustStrip.tsx, Features.tsx, HowItWorks.tsx, Verticals.tsx, Pricing.tsx,
  FinalCTA.tsx
- `apps/thereplyte-landing/src/app/layout.tsx` and `manifest.ts` — SEO meta

## Verification (owner runs the page locally afterwards)

- `npm run build` must pass in `apps/thereplyte-landing` — paste real output.
- Also run `npm run dev` briefly and confirm `/` renders without runtime
  errors (report the local URL output). Do not deploy anything.

---

## 1. Hero demo — `ChatMockup.tsx`

### 1a. Channel per scenario (Option A)
- Add `channel: 'whatsapp' | 'messenger' | 'instagram'` to each Scenario.
  Mapping: City Clinic → whatsapp; Sweet Layers Bakery → messenger;
  Spice Route Kitchen → whatsapp; QuickMart Stores → whatsapp;
  Style Hub Clothing → instagram.
- Phone header: background becomes channel-dependent —
  whatsapp: existing `#008069`; messenger: blue gradient
  (`linear-gradient(90deg,#0084ff,#00c6ff)`); instagram: gradient
  (`linear-gradient(90deg,#833AB4,#FD1D1D,#F77737)`).
- Add a small channel chip (icon + label: WhatsApp / Messenger / Instagram)
  in the header before the scenario chip, animating with the same
  AnimatePresence pattern as the existing chips. Simple inline SVG icons —
  no new dependencies, no brand asset downloads.

### 1b. Comment → DM scenario (Option B)
- New step type `'comment'`: renders an Instagram-style post card (gradient
  image placeholder + a comment row: author handle + comment text + the AI's
  nested public reply). Rendered where messages render, same motion pattern.
- New result view `'leadtag'`: a small centered card — "🏷️ Tagged: <label>"
  plus sub-line "Added to this week's leads" — same style family as
  CalendarView/OrderBookView.
- Add ONE new scenario: business 'Style Hub Clothing' already exists — keep
  it for chat; create a NEW scenario (e.g. 'Ceylon Tours', avatar 'C',
  channel 'instagram', chip 'Comment → DM') whose steps are:
  `comment` (commenter: "@nimal_t" asks about a tour package price; nested AI
  public reply inviting to DM) → `c` DM message continuing the inquiry →
  `ai` reply collecting travel month + travellers → `c` answer →
  `ai` confirmation → `result` with view `leadtag` text "Tour package lead".
- All 5 language variants for the new scenario, following the existing
  per-language structure (translate naturally; keep it short).

## 2. Hero.tsx
- Headline → "Hire an AI Employee for every customer conversation"
  (keep the existing span/gradient markup style).
- Sub-copy → "On WhatsApp, Messenger and Instagram. Answers instantly in your
  customer's language, takes bookings and orders, qualifies your leads, and
  hands off to your team when it matters — 24/7."

## 3. TrustStrip.tsx
- Line → "Built for businesses that live in their customers' inboxes".
  Stats unchanged.

## 4. Features.tsx — 8 cards
- Intro line → "...across WhatsApp, Messenger and Instagram." (keep the rest
  of the heading).
- Restructure to exactly 8 cards (default copy below — keep each card's
  existing icon/visual style where a card already exists; new cards reuse
  the same card component style):
  1. Multilingual AI — existing text + append "Even voice notes and photos
     are understood."
  2. Instant AI answers — existing text + append "It learns your tone, never
     invents prices, and says so when it doesn't know."
  3. AI Workflows (NEW) — "Tell it your playbooks in plain language — visa
     services, tour packages, air tickets, quotes — and it guides every
     conversation through the right one, collecting exactly the details your
     team needs. No flowcharts, no code."
  4. Self-qualifying CRM (NEW) — "Every customer is automatically tagged
     into your own categories — visa lead, tour lead, air-ticket lead — based
     on what they actually asked, with the collected details attached. See
     this week's leads at a glance. Zero data entry."
  5. Orders & bookings — existing card (unchanged).
  6. Smart human handoff — existing text + append "Your team answers from
     one inbox, on every channel."
  7. Comment moderation (NEW) — "Comments on your Facebook and Instagram
     posts get AI-drafted public replies — you approve with one tap. It
     invites commenters to DM, and when they do, the AI qualifies them as
     leads automatically."
  8. Analytics & CSAT — existing card (unchanged).
- The old standalone "Voice notes & images" card is REMOVED (folded into
  card 1) — keep its little voice/photo visual inside card 1 if the layout
  allows without surgery; otherwise drop the visual.

## 5. HowItWorks.tsx
- Step 1 title → "Connect your channels"; body → "Link your WhatsApp number,
  Facebook page or Instagram account in minutes. No code, no new hardware,
  no SIM swaps."
- Steps 2–4 unchanged.

## 6. Verticals.tsx
- Sub-line → "Turn every conversation into an opportunity — on any channel."
- Add "Travel & Tours" to the vertical list.
- Add a small channel icon badge on each vertical's chat preview:
  Clinics → whatsapp; Salons & Spas → instagram; Online Shops → instagram;
  Restaurants → whatsapp; Travel & Tours → messenger; Education → whatsapp;
  Real Estate → whatsapp. One icon per preview, top-right corner of the
  preview card; reuse the same inline SVG icon set as the hero chip.

## 7. Pricing.tsx
- Starter: "1 WhatsApp number" → "1 connected channel".
- Business: blurb "...sell and book on WhatsApp daily." → "...sell and book
  on every channel, daily."; ADD lines: "Multiple channels — WhatsApp,
  Messenger & Instagram" and "AI workflows & lead categories".
- Enterprise: REMOVE "Broadcast campaigns"; ADD "Comment moderation with AI
  public replies". Keep "Custom integrations & API access".
- Overage footnote: "Extra WhatsApp number" → "Extra channel".

## 8. FinalCTA.tsx
- Unchanged.

## 9. SEO — layout.tsx + manifest.ts
- Title → "TheReplyte — AI Employee for WhatsApp, Messenger & Instagram |
  24/7 Multilingual Replies"
- Description → multi-channel wording matching the hero sub-copy.
- Keywords: keep existing WhatsApp terms, add "Messenger AI",
  "Instagram DM automation", "AI chatbot for Messenger",
  "Instagram comment automation".

## Do NOT

- Do not change the design system, Tailwind config, or component APIs.
- No new npm dependencies.
- Do not touch FinalCTA, Footer, Nav beyond what's listed (Footer unchanged).
- Do not deploy, commit, or push — the owner reviews locally first.

## Acceptance criteria

- [ ] Demo shows channel chip + tinted header per scenario; the new
      comment→DM→lead-tag scenario cycles in all 5 languages.
- [ ] Exactly 8 feature cards; new cards match the existing card style.
- [ ] Pricing changes exact (Broadcast campaigns removed).
- [ ] `npm run build` passes and the page renders locally without errors —
      paste real output.

## Report back

- Files created/modified (full list)
- Verbatim build output + local render confirmation
- Any deviation from this spec, with the reason
