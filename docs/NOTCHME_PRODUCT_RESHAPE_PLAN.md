# NotchMe Product Reshape Plan

> Status: Phase 1 accepted for progression with deferred rendered QA; Phase 2A activation and My Page foundation implemented (2026-08-18)
> Strategy: International product, Europe-first launch, Sri Lanka localization later
> Initial market: Malta pilot, followed by broader European expansion
> Product category: Professional identity and relationship follow-up workspace

> **Mandatory prerequisite:** Complete `docs/NOTCHME_REBRAND_MIGRATION_PLAN.md` before beginning any product or UI reshape phase. NotchMe has been replaced by the legally cleared name **NotchMe**. This document will be renamed and its active brand references updated as part of that migration; historical NotchMe migration records will remain unchanged.

---

## 1. Executive Summary

NotchMe will be reshaped from a broad digital-card, scheduling, and CRM suite into a focused relationship workspace for professionals whose business grows through introductions.

The product promise is:

> **NotchMe helps professionals turn every introduction into a valuable next step.**

The core product loop is:

```text
Create presence -> Share -> Capture -> Remember -> Follow up -> Meet -> Convert
```

NotchMe will launch first in Malta as an English-language, euro-priced, GDPR-ready product. The underlying product will remain country-neutral so it can expand throughout Europe and later launch in Sri Lanka with local pricing, languages, payments, and WhatsApp-oriented workflows.

The existing NestJS API and Next.js application will be retained as the technical foundation. The work is primarily a product, information-architecture, UX, trust, and launch-readiness reset. Existing advanced functionality will be reused selectively or hidden behind plan and feature controls.

---

## 2. Product Vision

### Vision

Become the professional relationship workspace people trust to remember who they met, preserve the context, and guide the next action.

### Mission

Help professionals ensure that valuable introductions do not become forgotten contacts.

### Primary value proposition

NotchMe connects four activities that are normally fragmented across separate tools:

1. Professional identity and digital presence
2. Contact exchange and contextual capture
3. Meeting scheduling
4. Relationship follow-up

### Product principles

- The recipient never needs to install an app.
- Every captured person should have context, not only contact details.
- Every important relationship should have a visible next action.
- The product should reduce administration rather than create more data entry.
- AI suggests and structures; the user reviews and remains in control.
- Advanced CRM capability must not make the core individual experience feel like enterprise software.
- Trust, privacy, speed, and accessibility are part of the premium experience.

---

## 3. Market Gap

Existing products generally specialize in one category:

| Category | Typical strength | Typical weakness |
|---|---|---|
| Digital/NFC cards | Identity sharing, QR, wallet and branding | Limited reason to return after sharing |
| Scheduling tools | Calendar availability and booking | Weak relationship continuity after the meeting |
| Personal CRM | Notes, reminders and contact history | Weak public identity, reciprocal capture and booking |
| Sales CRM | Pipelines, reporting and automation | Too complex for many independent professionals |
| NotchMe | Connects introduction, context, meeting and next action | Must deliver the combined workflow with exceptional simplicity |

NotchMe will not compete on QR codes or feature count. Its wedge is the post-introduction workflow:

> **Meet someone, capture why they matter, and always know what to do next.**

### Defensible product value

Over time, NotchMe should become the user's trusted relationship memory:

- Who the user met
- Where and how they met
- What was discussed
- What happened afterward
- What the next action is
- Which relationships are becoming active opportunities

---

## 4. Initial Customer Profile

### Primary launch audience

Independent professionals and small professional-service teams whose revenue depends on relationships:

- Consultants
- Recruiters
- Real-estate advisors
- Financial and insurance advisors
- Agency owners
- Business-development professionals
- Event-active founders

### Initial job to be done

> When I meet a potentially valuable person, help me preserve the context and follow through at the right time without maintaining a complicated CRM.

### Not the initial audience

- Large enterprise sales departments
- High-volume call centers
- Retail inventory businesses
- Companies seeking full ERP functionality
- Event organizers seeking only badge-scanning infrastructure

---

## 5. International Rollout Strategy

### Stage 1: Malta pilot

Launch to a controlled group of approximately 25-50 professionals.

Requirements:

- English interface
- Euro pricing
- Europe-friendly billing and invoicing
- GDPR-ready consent, export, deletion, and privacy controls
- Google and Microsoft calendar support
- Email and WhatsApp sharing actions
- Responsive mobile-first experience

Pilot success is determined by recurring use and payment, not registration volume.

### Stage 2: Broader European expansion

- Expand to English-speaking professionals across Europe
- Add prioritized European languages based on demand
- Add country-aware tax and invoice handling
- Add professional-association and referral partnerships
- Introduce stronger calendar, contact, and communication integrations
- Offer small-team administration and branding

### Stage 3: Sri Lanka localization

- LKR pricing
- English, Sinhala, and Tamil readiness
- Local payment options
- WhatsApp-first follow-up actions
- Lower-bandwidth performance optimization
- NFC and printed-card partnerships
- Individual and SME-focused packages
- Assisted onboarding for business teams

Sri Lanka will use the same core product rather than a separate fork.

### International architecture requirements

- Locale and language per user
- IANA timezone storage
- Multi-currency catalog and billing display
- International telephone-number format
- Locale-aware dates, times, and addresses
- Country-aware tax configuration
- Translatable product and transactional-email copy
- Country-aware privacy and consent text
- Regional subscription pricing
- Future option for regional data residency
- No Malta-, Europe-, or Sri Lanka-specific assumptions in the core domain model

---

## 6. Product Information Architecture

The main navigation will be reduced to five product areas:

```text
Today
People
Calendar
My Page
Insights
```

Secondary navigation:

```text
Workspace
Settings
Help
```

Advanced capabilities such as companies, pipelines, documents, feedback, custom fields, automation, webhooks, and team administration will live inside their relevant areas or behind feature and plan controls.

### Terminology

| Current or ambiguous term | Preferred product term |
|---|---|
| Customer / Contact / Connection | Person / People |
| Account | Company |
| Task | Next action |
| Lifecycle | Relationship stage |
| Profile | My Page |
| CRM dashboard | People workspace |

"Opportunity" is used only when the user is tracking a real commercial outcome.

---

## 7. Core Product Experiences

### 7.1 Onboarding

The first-run journey should achieve a useful account within approximately ten minutes:

1. Create and verify the account
2. Select the main professional goal
3. Create the professional page
4. Select a page style
5. Create the first meeting type
6. Add or capture the first person
7. Create the first next action
8. Share the page

An activation checklist remains visible until the essential setup is complete.

### 7.2 Today

Today becomes the operational home and primary retention surface.

It includes:

- Overdue next actions
- Actions due today
- Upcoming meetings
- Recent introductions without a next action
- Relationships becoming inactive
- Quick capture
- One-click email and WhatsApp actions
- Small weekly progress summary

The dashboard should answer: **What should I do today?**

### 7.3 People

People replaces the CRM-heavy customer presentation.

Default smart views:

- Recently added
- Needs follow-up
- Met recently
- No next action
- Active opportunities
- Archived

Each person record contains:

- Identity and company
- Source and introduction context
- Relationship stage
- Last interaction
- Next action
- Notes and activity timeline
- Meetings
- Opportunity information when applicable
- Documents and feedback only when enabled

The primary action is **Set next action**.

### 7.4 My Page

My Page becomes a visual professional-page builder instead of a settings form.

Capabilities:

- Live mobile preview
- Click-to-edit content sections
- Profile completion status
- Premium themes
- Contact-button ordering
- Featured links
- Services and expertise
- Booking call to action
- Testimonials or credentials
- Social links
- QR, link, wallet, NFC, and print sharing assets
- Custom domain and branding for eligible plans

This should be NotchMe's signature visual experience.

### 7.5 Reciprocal contact exchange

The exchange flow should benefit both people:

1. A visitor scans or opens the NotchMe page.
2. The visitor can save the owner's contact details.
3. The visitor can optionally share their details with clear consent.
4. The owner receives a new person record with source context.
5. NotchMe asks the owner to add a note or next action.

No recipient account or application installation is required.

### 7.6 Calendar and booking

Calendar combines:

- Agenda
- Calendar view
- Meeting types
- Availability
- Calendar connections
- Booking settings

When someone books, NotchMe should:

- Create or update the person record
- Record the booking source
- Add the meeting to the timeline
- Schedule a preparation reminder
- Prompt for a post-meeting recap
- Create or recommend a next action

The public booking experience must support confirmation, timezone clarity, calendar files or integrations, rescheduling, and cancellation.

### 7.7 Insights

Insights should explain outcomes rather than only display counters.

Examples:

- Introductions that became meetings
- Meetings that received follow-ups
- Profile visitors who did not take action
- Highest-converting sharing sources
- Relationships becoming inactive
- Weekly relationship momentum

---

## 8. AI Strategy

AI will be an assistive layer inside the workflow, not the product's primary identity.

### Initial AI capability: post-meeting recap

The user records a private voice recap after a meeting. NotchMe transcribes and proposes:

- Meeting summary
- Important details
- Relationship stage
- Opportunity information
- Suggested next action
- Suggested due date
- Draft follow-up message

The user must review and confirm all proposed changes before they are saved.

### Additional initial AI uses

- Convert written notes into structured context
- Draft a follow-up email or message
- Summarize a person's timeline
- Suggest which relationships need attention

### Deferred AI capabilities

- Recording full conversations
- Automatic outbound messages
- Autonomous CRM changes without confirmation
- Large-scale contact enrichment
- Relationship scoring presented as objective fact
- AI matchmaking

### Privacy rules

- Start with the user's private post-meeting recap, not full meeting recording.
- Clearly identify when AI processes personal data.
- Allow users to edit and delete source audio and generated content.
- Define retention and subprocessors before launch.
- Require explicit participant consent before any future full-meeting recording.
- Never send an AI-generated message without user approval.

### AI usage controls

The Pro plan may include a limited number of recaps or transcription minutes. Higher usage can use credit packs or a future add-on. Usage limits must protect product margins without making the core workflow confusing.

---

## 9. Premium Design Direction

### Brand character

- Calm
- Precise
- Professional
- Warm
- Trustworthy
- International
- Distinctive without visual noise

### Visual foundation: Quiet Orbit

NotchMe will use a mild, pastel-led visual system called **Quiet Orbit**. The intended character is calm, optimistic, premium, and international. Pastels are used for surfaces, grouping, and semantic context. Important text and primary actions use deeper colors to maintain clarity and accessibility.

#### Light palette

| Role | Token name | Value | Intended use |
|---|---|---:|---|
| Main background | Porcelain Mist | `#F8F7FB` | Application and marketing background |
| Elevated surface | Pure White | `#FFFFFF` | Cards, dialogs and menus |
| Primary text | Cosmic Ink | `#272536` | Headings and body text |
| Secondary text | Muted Slate | `#777386` | Metadata and supporting copy |
| Border | Lavender Grey | `#E7E4ED` | Dividers and component borders |
| Primary action | Deep Lavender | `#6F63A8` | Primary buttons, links and focus states |
| Primary hover | Dark Lavender | `#5D528F` | Hover and pressed states |
| Lavender pastel | Soft Orbit | `#EFEDFA` | Selected navigation and brand highlights |
| Sage pastel | Calm Connection | `#E7F2EC` | Success and completed actions |
| Peach pastel | Warm Opportunity | `#FAEAE3` | New introductions and opportunities |
| Sky pastel | Meeting Blue | `#E8F1F7` | Meetings, bookings and calendar context |
| Butter pastel | Reminder Yellow | `#FAF1D8` | Reminders and actions due soon |
| Rose pastel | Gentle Alert | `#F8E7E9` | Overdue and non-destructive warning surfaces |

Semantic foreground colors must be defined separately from pastel backgrounds so that status text and icons meet WCAG contrast requirements. Pastel colors must not be used directly for important text.

#### Usage balance

Use the palette approximately as follows:

- 70% neutral backgrounds and white surfaces
- 20% mild pastel surfaces and contextual sections
- 10% strong brand, text, and action colors

Lavender is the primary brand family. Sage, peach, sky, butter, and rose communicate meaning and provide variety; they must not compete equally for brand ownership.

#### Semantic application

| Product context | Surface family |
|---|---|
| Selected navigation and primary brand moments | Lavender |
| Completed follow-ups and healthy states | Sage |
| New introductions and opportunities | Peach |
| Meetings, bookings and calendar | Sky |
| Actions due soon and reminders | Butter |
| Overdue actions and warnings | Rose |

#### Dark mode

Dark mode remains supported, but it should be derived from the same Quiet Orbit identity rather than switching to an unrelated neon or futuristic theme. It should use deep plum-charcoal surfaces, softened lavender actions, restrained pastel-tinted status surfaces, and accessible high-contrast text.

Exact dark-mode tokens will be finalized during the design-system phase after contrast testing.

#### Gradient and illustration use

- Use subtle atmospheric pastel gradients only in selected marketing and onboarding moments.
- Avoid gradients on every button, heading, and card.
- Prefer real product visuals, restrained illustrations, and meaningful data states over decorative glowing orbs.
- Motion should be soft and purposeful, with no continuous animation competing with the user's work.

### Interface rules

- One clear primary action per page
- Fewer nested cards
- More breathing room and stronger hierarchy
- Consistent spacing, radius, focus, and elevation tokens
- Tables and structured lists for dense information
- Purposeful motion for state changes
- Layout-matched loading states
- Branded toasts and confirmation dialogs
- Strong empty states with a useful next action
- Complete keyboard, screen-reader, contrast, and mobile support
- Never communicate status through color alone
- Verify all text, icon, focus, and control combinations against WCAG contrast requirements

### Marketing direction

Replace generic visual effects and unsupported credibility claims with:

- Real product screenshots or interactive demonstrations
- Clear workflow storytelling
- Verified customer evidence
- Role-specific use cases
- Privacy and security information
- Transparent pricing
- Clear comparison with cards, scheduling tools, and traditional CRM

Recommended headline:

> **Every introduction deserves a next step.**

Recommended supporting statement:

> NotchMe combines your professional page, bookings, contacts, and follow-ups in one beautifully simple workspace.

---

## 10. Pricing and Packaging

### Free - EUR 0

Purpose: allow users to experience the exchange workflow.

- One professional page
- NotchMe branding
- Unlimited page sharing
- QR and vCard
- One meeting type
- Up to 50 people
- Manual notes and next actions
- Basic page and booking statistics

### Founding Pro - EUR 10/month

Initial offer for the first 100-200 paying users.

- Unlimited people
- Unlimited meeting types and bookings
- Today workspace and follow-up reminders
- Premium page themes
- Remove NotchMe branding
- Calendar integration
- Relationship timeline
- Contact export
- Conversion insights
- Limited monthly AI recap allowance
- Priority support

Pro billing options:

- EUR 10 monthly
- EUR 96 annually
- 14-day trial without requiring a payment card

The founding price should be guaranteed for a defined period, recommended as two years. Avoid lifetime plans.

### Future standard Pro price

- EUR 14 monthly
- EUR 120 annually

Raise the price only after activation, retention, and payment behavior validate the value. Existing founding users retain their promised price.

### Teams - EUR 39/month

Includes three users:

- Everything in Pro
- Shared workspace
- Company branding
- Shared people and companies
- Ownership and assignment
- Team templates
- Admin permissions
- Team insights

Recommended additional seat: EUR 9/month.

### Enterprise - later, custom pricing

Only introduce after verified demand for:

- SSO and directory provisioning
- Audit logs
- Data residency
- Custom retention
- Dedicated onboarding
- SLA and priority support
- CRM integrations
- Custom contracts and invoicing

### Variable-cost controls

Do not provide unlimited high-cost capabilities inside the EUR 10 plan:

- SMS
- Large-scale AI transcription
- Contact enrichment
- Large file storage
- Mass email
- High-volume event scanning

These should use allowances, credits, or add-ons.

### Tax presentation

Before accepting payments, confirm with a qualified European/Maltese adviser:

- Whether displayed prices include VAT
- Customer-location evidence requirements
- VAT ID handling
- Invoice requirements
- Consumer cancellation and refund requirements

---

## 11. Existing Product Capability Decisions

### Keep and reshape

- Authentication
- Profiles and public pages
- QR and vCard generation
- Scheduling and booking
- People/customer records
- Activities and follow-ups
- Organizations and roles
- Analytics event infrastructure
- Plans and module gating
- Company/account records

### Hide from primary navigation

- Pipeline
- Duplicate management
- Bulk import and actions
- Documents
- Feedback and ratings
- Custom fields
- CRM templates
- Automation rules
- Webhooks
- Advanced organization administration

These features can remain available behind plan, role, and feature controls while the core experience is rebuilt.

### Defer

- Full conversation recording
- Autonomous AI actions
- Event-platform functionality
- Marketplace or professional directory expansion
- Invoicing and payments between NotchMe users and their clients
- Complex enterprise provisioning
- Native mobile applications unless validated by usage

### Remove or replace before launch

- Unsupported customer/company logos or claims
- Development billing placeholders
- Broken or incomplete public links
- Conflicting terminology
- Country-specific assumptions in shared workflows
- Navigation items that do not support the core loop

---

## 12. Production Foundations

The following are required for a credible paid European launch:

- Email verification
- Password reset and account recovery
- Secure session lifecycle
- Transactional email delivery
- Booking confirmation, cancellation, and rescheduling
- Durable image and file storage
- Subscription checkout, renewals, cancellations, and failed-payment handling
- Data export and account deletion
- Consent and privacy controls
- Terms, privacy policy, cookie handling, and subprocessor disclosure
- Error monitoring and actionable logs
- Backups and restore verification
- Rate limiting and abuse controls
- Accessibility testing
- Performance testing on mobile networks
- End-to-end tests for activation, sharing, capture, booking, follow-up, and billing

---

## 13. Delivery Phases

### Phase R: NotchMe rebrand migration - mandatory prerequisite

Complete `docs/NOTCHME_REBRAND_MIGRATION_PLAN.md` before Phase 0.

This phase covers the public identity, active application/package names, platform product key, compatible persisted identifiers, infrastructure, domains, tests, and documentation. Product features and the premium UI redesign must not begin until the rebrand definition of done has passed.

Exit criteria:

- NotchMe is the only active customer-facing identity.
- Renamed web/API workspaces and deployment services pass verification.
- Tenant access, authentication, provisioning, URLs, and migration history remain safe.
- The active reshape plan is renamed to NotchMe and is ready for Phase 0.

### Phase 0: Product decisions and baseline

- Approve this product direction
- Select the first customer segment
- Confirm terminology and pricing hypothesis
- Audit the rendered application on desktop and mobile
- Establish baseline build, test, accessibility, and performance results
- Map every existing screen and endpoint to keep, reshape, hide, defer, or remove

Exit criteria:

- Approved product scope
- Approved route map
- Approved initial pricing
- No undocumented legacy surface

#### Implementation audit — 2026-08-18

The rendered-route audit was completed from the current Next.js route tree and shared components. Browser-based inspection could not run because the local in-app browser was unavailable; desktop/mobile visual QA remains an explicit Phase 1 follow-up.

| Area | Existing routes | Disposition | Findings and follow-up |
|---|---|---|---|
| Marketing and authentication | `/`, `/login`, `/register`, `/accept-invite` | Retain and reshape | Landing page still presents digital-card-first copy, LKR pricing, gradients, and generic networking language. Registration remains a basic account flow; activation/verification/recovery are Phase 2. |
| Today | `/dashboard` | Retain and redesign | It has profile, QR, booking, analytics, and CRM summaries, but does not yet answer “what should I do today?” with overdue/due/missing-next-action states. |
| People | `/dashboard/customers`, `/dashboard/customers/[id]` | Retain and redesign | Existing customer records, activity, documents, feedback, import, duplicates, and pipeline are functional foundations. Rename and smart views belong in Phase 3; pipeline, duplicates, documents, feedback, import, and CRM administration should stay out of primary navigation. |
| Calendar | `/dashboard/scheduling/*`, `/book/[slug]` | Retain and redesign | Meeting types, availability, bookings, calendar view, and public booking exist. Booking continuity, clear timezone/reschedule/cancel/add-to-calendar states, and the person/next-action handoff are Phase 4. |
| My Page and public profile | `/dashboard/profile`, `/p/[slug]`, `/a/[slug]` | Retain and redesign | Profile editing, public profile, QR/vCard/share foundations exist. The editor is a form rather than a visual builder and reciprocal contact capture/context consent is incomplete; both are Phase 2/4. |
| Insights | `/dashboard/analytics` | Retain and redesign | Existing counters and plan gate exist, but outcome metrics are not yet present. Defer substantive work to Phase 6. |
| Workspace and settings | `/dashboard/accounts/*`, `/dashboard/organization*`, `/dashboard/settings*`, `/dashboard/upgrade` | Retain but de-emphasize | Companies, teams, plan controls, and advanced CRM configuration are valid secondary surfaces. Development billing placeholders must not be presented as launch billing; payment integration remains deferred. |
| Deferred public/advanced surfaces | `/directory`, `/feedback/[token]`, `/rate/[slug]`, customers pipeline/duplicates, CRM settings | Defer or hide from primary navigation | Directory/event expansion, ratings, feedback, automation, webhooks, templates, custom fields, and bulk/duplicate flows do not support the initial core loop. Keep functional routes; do not remove them in Phase 1. |

Usability gaps observed from code and route review: the primary navigation previously exposed CRM-heavy terminology and advanced routes; the dashboard emphasizes counters rather than next actions; marketing and pricing do not match the Malta-first hypothesis; page and booking flows need stronger mobile-first state design; and no consistent page-header or empty-state primitive existed. The initial foundation corrects navigation hierarchy and shared presentation only, preserving route behavior.

### Phase 1: Premium foundation

- Refine brand and design tokens
- Build the new application shell
- Implement the reduced navigation
- Standardize page headers, buttons, forms, lists, tables, dialogs, toasts, empty states, and loading states
- Establish responsive layouts and accessibility rules
- Add feature controls for hidden advanced modules

Exit criteria:

- Consistent application shell across desktop and mobile
- Core UI primitives pass accessibility review
- Advanced modules no longer distract from the primary experience

#### Completed foundation work — 2026-08-18

- Established Quiet Orbit light and dark semantic tokens, spacing/radius/elevation rules, focus treatment, and reduced-motion behavior.
- Added reusable premium `PageHeader` and `EmptyState` components; refined card, dialog, and button presentation.
- Reworked the authenticated shell to use the reduced primary navigation: Today, People, Calendar, My Page, Insights. Existing secondary routes remain accessible in the Workspace section.
- Added a skip link, navigation state/labels, responsive mobile menu state, and a premium Today header without changing API contracts or existing page routes.
- Passed NotchMe Web lint, TypeScript check, and production build. Desktop/mobile visual inspection remains pending because the local in-app browser was unavailable.

#### Visual QA attempt — 2026-08-18

- Confirmed the locally running NotchMe Web endpoint at `http://localhost:3005`. HTTP smoke checks returned `200` for login, registration, and the authenticated route entry points for Today, People, Calendar, My Page, Insights, and Workspace.
- The required in-app browser had no available browser instance after bootstrap/troubleshooting. Per the browser-control procedure, no alternate browser automation surface was used.
- Consequently, rendered desktop (`>=1280px`), tablet (`768px`), and mobile (`375px`) inspection could not be performed. No screenshots were captured, and dark-theme, keyboard/focus, skip-link, reduced-motion, touch-target, dialog, loading, empty-state, error-state, overflow, clipping, or active-navigation results are claimed.
- No implementation fixes were made because no rendered defect could be verified. Phase 1 cannot close until this QA matrix and representative desktop/mobile screenshots are completed in an available in-app browser.

#### Responsive and accessibility follow-up — 2026-08-18

- Reviewed the supplied desktop light-theme screenshots for the refreshed marketing page. Header, hero, workflow, capabilities, pricing, final CTA, and footer render with the intended Quiet Orbit hierarchy; the previously reported missing-CSS/chunk runtime fault was repaired separately and the regenerated homepage/CSS assets return `200` on `localhost:3015`.
- Corrected two verified public-shell accessibility defects: added a keyboard-visible skip link that targets `#main-content`, and increased marketing-header logo/navigation/action targets to at least `44px` high.
- Corrected the final CTA supporting-copy foreground, which had rendered as dark text on the lavender surface when using a variable colour opacity modifier.
- NotchMe Web lint, TypeScript no-emit, and production build pass. The development cache was cleared and the local server restarted after the build to prevent `.next` output conflicts.
- The in-app browser still has no available instance. Tablet (`768px`), mobile (`375px`), dark-theme, keyboard traversal/focus, reduced-motion, horizontal-overflow, and screenshot checks remain unverified in a rendered browser. The owner accepted this as a **deferred visual-QA follow-up** and authorized progression to Phase 2; these checks remain required before launch and must not be treated as completed.

### Phase 2: Activation and My Page

- Rebuild registration and onboarding
- Add verification and recovery
- Build the visual My Page editor with live preview
- Improve themes and sharing assets
- Add activation checklist and onboarding analytics

Exit criteria:

- A new user can publish and share a credible page within ten minutes
- Activation funnel is measurable

#### Phase 2A audit and implementation — 2026-08-18

**Route and API audit**

- Registration at `/register` calls `POST /v2/auth/register`; the existing API transaction already creates an authenticated user and a real draft profile with a unique slug.
- My Page at `/dashboard/profile` uses `GET` and `PUT /v2/profiles/me`; published pages, vCards, and public-page previews use existing `/p/[slug]`, `GET /v2/profiles/:slug`, and `GET /v2/profiles/:slug/vcard` behaviour.
- Booking setup uses the existing `GET`/`POST /v2/scheduling/meeting-types` APIs and remains available at `/dashboard/scheduling/meeting-types`; public booking uses the existing `/book/[slug]` route.
- Authentication and organization state remain supplied by the existing `GET /v2/auth/me` flow and `AuthProvider`. No new endpoint, data model, migration, or backend workaround was required.

**Implemented**

- Registration now leads to `/dashboard/get-started`, a focused guided activation route rather than the general dashboard.
- Added a persistent activation checklist on Today and My Page, plus the expanded first-run route. Completion is derived live from saved API data: professional details require a name and headline; a useful public page requires a slug, headline, and contact method or website; booking requires an active meeting type; share-ready requires a published page. No local completion flags are stored.
- Reshaped My Page into a purpose-led editor with grouped presence, contact/link, and publish/share sections; save/error/unsaved state; clear preview/publish/copy-link actions; an updating mobile-shaped preview; and a generated QR sharing preview after publication.
- Preserved all existing profile fields, profile validation, public profile, vCard, meeting-type, booking, and advanced settings routes. The only neutral placeholder change is `City, Country`.

**Backend gaps and remaining Phase 2 work**

- There is no persisted event for “page previewed” or “page shared”; the checklist therefore reports the truthful saved state “published and ready to share,” not a fabricated completion event.
- Email verification, recovery, onboarding analytics, broader visual page-builder controls, sharing asset management, and the complete activation funnel remain Phase 2B work.
- Technical verification passed: lint, TypeScript no-emit, production build, and HTTP smoke checks for `/register`, `/dashboard/get-started`, `/dashboard/profile`, and `/dashboard/scheduling/meeting-types`. The local development cache was cleared and port `3015` restarted after the production build.

#### Phase 2A functional hardening — 2026-08-18

- Reviewed registration, activation, My Page, profile, meeting-type, public-profile, booking, and vCard integration paths. Registration has no redirect parameter and always uses the fixed internal `/dashboard/get-started` destination; existing authenticated users are not redirected into onboarding by the application shell.
- Extracted checklist state derivation into `src/lib/activation.ts`. The component continues to derive all outcomes solely from query-backed profile and meeting-type data; unsaved My Page form changes do not alter checklist completion.
- Corrected a publication-state defect: unsaved `isPublished` or slug edits could expose preview, copy-link, and QR controls before the saved public page existed. Those controls now use only the saved, query-backed published profile and URL.
- Added an explicit safe error state for failed profile or meeting-type checklist queries; loading, partial-completion, and completed states remain distinct. Long name/headline/company/bio input is constrained inside the live preview, and malformed URLs are never rendered as clickable preview links.
- Corrected an existing public-profile rendering defect: `/p/[slug]` read `window.location` during server rendering, which returned HTTP 500 for an unavailable profile. The canonical public URL is now derived after client mount, and share/copy/QR controls remain safely unavailable until that URL exists. The unavailable-profile route now returns its intended safe state with HTTP 200.
- No frontend unit-test runner exists in `@cloudit/notchme-web` (no `test` script or Vitest/Jest dependency), and existing Playwright coverage targets other products. No test framework was introduced during this bounded hardening gate. The extracted pure derivation function is ready for coverage when a web test runner is adopted.
- Hardening verification passed: NotchMe Web lint, TypeScript no-emit, and production build; the existing API `auth.controller.spec.ts` also passed. HTTP smoke checks passed for `/`, `/register`, `/dashboard/get-started`, `/dashboard/profile`, `/p/notchme-qa-missing`, and `/book/notchme-qa-missing`; homepage CSS and JavaScript chunk URLs also returned HTTP 200 after the development runtime was restored on port `3015`. `git diff --check` passed.

#### Marketing and pricing reshape — 2026-08-18

- Replaced the legacy Sri Lanka/LKR, digital-card-first landing page with a Quiet Orbit international marketing presentation at `/`.
- Removed unverified customer-logo/trust claims, decorative glow-heavy sections, and contrast-poor gradient text and labels.
- Added the approved positioning and a clear structure: navigation, hero, relationship workflow, capabilities, activation prompt, pricing, final CTA, and existing public-shell footer.
- Reframed QR, vCard, public pages, bookings, people records, and workspace activity as supporting capabilities in the relationship workflow. No unsupported AI, automated messaging, payment, or production-billing capability is claimed.
- Added Free (`€0`), Founding Pro (`€10/month`), and Teams (`€39/month`) presentation cards. Their CTAs only open registration; the page explicitly identifies checkout as inactive. Feature lists are limited to currently exposed application/plan capabilities.
- Used solid Quiet Orbit surfaces and high-contrast foreground colours for headings, body text, icons, labels, buttons, and pricing cards. The layout uses responsive one-, two-, and three-column breakpoints and avoids large decorative gaps.
- NotchMe Web lint, TypeScript no-emit, and production build pass after the marketing update.
- The required in-app browser still has no available instance. Screenshot capture and rendered validation at `1280px`, `768px`, and `375px` remain manual-review work before marketing approval; no rendered visual result is claimed.

#### Phase 2B activation refinement and sharing — 2026-08-18

- Audited authentication and account-recovery support. The current API provides registration, login, logout, invite acceptance, and secure sessions, but has no verification-token, password-reset, recovery-token, or transactional-email capability. No unsupported recovery UI or production email identity was invented; these remain a backend/operational prerequisite for launch.
- Added an authenticated, allow-listed activation-milestone endpoint backed by the existing analytics event store. The server derives the profile from the authenticated user, accepts only activation-started, profile-complete, booking-configured, page-published, and share-opened events, and stores no profile fields, contact content, URLs, referrers, user agents, or visitor identifiers. Milestones are deduplicated per profile and event type.
- Connected activation events to the first-run route, saved-data-derived checklist milestones, and explicit public-link/booking-link/public-page sharing actions. The activation checklist itself remains entirely data-derived and does not use analytics or local completion flags.
- Refined My Page sharing feedback: unpublished pages clearly explain why sharing controls are unavailable; published pages offer safe public-link, QR, vCard, and active-booking-link actions. Empty contact fields remain hidden from public visitors, and booking sharing remains unavailable until an active meeting type exists.
- Appearance persistence is not present in the current profile contract. The editor retains its safe live preview and existing profile-driven presentation rather than adding a non-persistent theme or layout control. Persisted themes, contact ordering, and featured links require a future approved profile contract and are not implied by this phase.
- Deferred Phase 1 rendered tablet/mobile/dark-theme/keyboard/reduced-motion/overflow QA remains required before launch and does not block this functional phase.

### Phase 3: People and Today

- Rename and reshape Customers into People
- Build smart views and person detail
- Make next actions first-class
- Build Today with overdue, due, upcoming, and missing-action states
- Add email reminders and one-click communication actions

#### Phase 3A1 People workspace backend â€” 2026-08-18

- Added authenticated `GET /v2/customers/people`. It preserves the existing customer-list endpoint and is registered before the dynamic `/:id` route.
- The endpoint returns `{ items, page, pageSize, total, totalPages, counts }`. Each item includes the customer ID, display name, company, permitted email and phone, lifecycle stage, last interaction, next incomplete follow-up, and nearest future non-cancelled booking.
- Supported `view` values are `all`, `needs_attention`, `due_today`, `overdue`, `upcoming`, and `recent`; `search` is optional, `page` defaults to 1, and `pageSize` defaults to 20 with a maximum of 100.
- The API accepts a validated IANA `timezone` query parameter and uses UTC when it is absent. Invalid timezone, view, paging, page-size, or search input receives a safe HTTP 400 response. No user, organization, or timezone profile field was added.
- Smart-view definitions are database predicates over the same authorized, search-filtered dataset: `overdue` has an incomplete follow-up before the selected local day; `due_today` falls within that day; `needs_attention` is their union; `upcoming` has an incomplete follow-up from the next local day onward or a future non-cancelled booking, ordered by its nearest qualifying future action; `recent` means **Recently added** (created within the prior 30 days), not recently met.
- Counts are calculated across the complete authorized dataset, never from a page. Rows are paginated in PostgreSQL, completed follow-ups and cancelled bookings are excluded, queries are set-based (no per-person queries), and deterministic customer-ID secondary sorting is applied.
- Focused unit coverage includes organization isolation, an empty organization, validation and UTC fallback, complete-dataset counts, pagination, search, selected-timezone boundaries, overdue/due-today/needs-attention predicates, completed/cancelled exclusions, future follow-ups, the 30-day boundary, and deterministic ordering.

**Phase 3A2 remaining:** build the People workspace UI on `/dashboard/customers` and `/dashboard/customers/[id]`, use the People endpoint and its `Recently added` label, present smart-view counts and pagination, and complete the requested person-detail/Today frontend work. No frontend route or behavior changed in Phase 3A1.

Exit criteria:

- A user can capture a person and set a next action in under one minute
- Today provides a meaningful daily workflow

### Phase 4: Exchange and booking continuity

- Build reciprocal contact capture
- Record introduction source and context
- Redesign public booking
- Complete confirmation, reschedule, cancellation, timezone, and add-to-calendar behavior
- Connect every booking to the person timeline and next-action workflow

Exit criteria:

- The complete share-to-follow-up journey works without manual duplicate entry
- Recipients do not require an NotchMe account

### Phase 5: AI assistance

- Add private post-meeting voice recap
- Add transcription and structured extraction
- Add review-before-save workflow
- Add follow-up drafting
- Add retention, deletion, consent, and usage controls
- Instrument cost and acceptance metrics

Exit criteria:

- AI never writes or sends unreviewed changes
- Processing costs and retention behavior are observable
- Privacy documentation reflects actual processing

### Phase 6: Insights, billing, and European launch

- Build actionable Insights
- Implement Free, Founding Pro, and Teams plans
- Complete VAT-aware subscription and invoice flows
- Add account export and deletion
- Complete legal, privacy, cookie, and trust pages
- Run launch security, accessibility, performance, and end-to-end reviews
- Onboard the Malta pilot cohort

Exit criteria:

- Real payment and cancellation work end to end
- Core workflows pass mobile and desktop verification
- Pilot users can be supported and their behavior measured

### Phase 7: Validate and expand

- Run the Malta pilot
- Interview active, inactive, converted, and churned users
- Improve activation and weekly retention
- Validate the standard Pro price
- Prepare the wider European go-to-market
- Prioritize languages and integrations from observed demand

---

## 14. Success Metrics

### Activation

- Account verified
- My Page published
- First meeting type created
- First person captured or added
- First next action created
- First page share completed

### Core value

- Percentage of captured people with context
- Percentage of captured people with a next action
- Introductions converted to meetings
- Meetings receiving a post-meeting note
- Due follow-ups completed on time

### Retention

- Week 1 and Week 4 active retention
- Users opening Today at least weekly
- Users completing at least one follow-up weekly
- Users returning after their first booking

### Commercial

- Trial-to-paid conversion
- Free-to-paid conversion
- Monthly and annual plan mix
- Revenue per paying user
- AI and messaging cost per paying user
- Monthly churn
- Team expansion revenue

### Initial pilot targets

Targets should be finalized after baseline observation. The pilot should prioritize evidence that users repeatedly complete follow-ups and are willing to pay, rather than vanity metrics such as total registrations or page views.

---

## 15. Key Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Competing as another digital card | Position and design around relationship follow-through |
| Too many existing features | Hide advanced modules and enforce the reduced navigation |
| Users do not return after creating a page | Make Today and next actions the recurring value loop |
| Manual data entry is burdensome | Automate booking history and add structured post-meeting recap |
| AI creates privacy or trust problems | Start with private recaps, require review, document processing and allow deletion |
| EUR 10 cannot support heavy usage | Limit variable-cost features and monitor unit economics |
| Europe-first implementation becomes Malta-specific | Keep the core domain locale-, currency-, and country-neutral |
| Premium redesign becomes cosmetic | Prioritize activation, workflow continuity, trust, speed, and states alongside visuals |
| Existing backend complexity slows delivery | Reuse stable domains and change contracts only where the new experience requires it |

---

## 16. Definition of Done for the Reshaped Launch

NotchMe is ready for the Malta pilot when:

- A new professional can understand the product promise immediately.
- Registration, verification, onboarding, and recovery work end to end.
- The user can publish and share a premium professional page.
- A recipient can save details, share their own details, or book without installing an app.
- Captured people retain their source and relationship context.
- The user can set and complete next actions from Today.
- Bookings update the person timeline automatically.
- AI recap is optional, private, reviewable, and deletable.
- Free, Founding Pro, and Teams entitlements are enforced consistently.
- Subscription purchase, invoice, cancellation, and failed-payment flows work.
- Privacy, export, deletion, and consent controls are available.
- Core workflows pass desktop, mobile, accessibility, performance, and end-to-end verification.
- Product analytics can measure activation, core value, retention, conversion, and AI cost.

---

## 17. Immediate Next Actions

1. Approve or revise this product strategy.
2. Choose the first Malta pilot segment; recommended starting point: independent consultants and boutique professional-service firms.
3. Perform a rendered desktop/mobile UX audit using representative user accounts and data.
4. Produce the route and feature disposition matrix.
5. Create the premium design system and key-screen wireframes.
6. Convert the delivery phases into implementation sprints with backend contracts, frontend tasks, tests, and acceptance criteria.
7. Begin Phase 0 before making broad visual changes.
