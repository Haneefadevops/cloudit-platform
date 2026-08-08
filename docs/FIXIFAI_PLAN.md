# FixifAI — AI Maintenance SaaS Plan

## 1. Vision

FixifAI is an AI-powered **service operating system for maintenance & field-service
contractors** — launching in Sri Lanka, designed for global expansion.

**Positioning:** "The service operating system that gives every asset its own
digital service identity." Every maintained item (AC unit, lift, generator, CCTV,
coffee machine) gets a QR code and a permanent service record. Customers scan to
report a problem; AI reads the asset's history, asks relevant questions, and
creates the right job.

**Not positioned as:** "AI maintenance software with WhatsApp." WhatsApp is an
optional channel (~20% of the experience), never the foundation.

## 2. Primary Market: Outsourcing / Service Contractors

The first customer is the **field-service company** — AC service firms, lift
maintenance, CCTV/security installers, fire-safety contractors, generator service,
FM companies — businesses that maintain *other companies'* assets under contract.

This shapes the product: quotations, invoices, branded customer portal, technician
dispatch with location tracking, SLA tracking.

In-house maintenance teams (factories, hotels managing their own assets) remain a
supported secondary segment via Industry Packs — but invoicing/quotation features
are built for contractors first.

### Why contractors first (Sri Lanka)
- Thousands of small service firms run on paper, phone calls and personal WhatsApp.
- No per-seat USD tool fits them; flat LKR pricing does.
- The branded customer portal + QR service identity is a visible differentiator
  they can sell *to their own clients* — viral pull-through.

## 3. Architecture Principle: Standalone SaaS, Channels Optional

```
                    FixifAI Core Platform
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
 Customer Portal      Manager Dashboard    Technician PWA
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                      FixifAI Backend
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
    WhatsApp             Email/SMS          Web Notifications
     optional             optional              built-in
```

- **All data lives in FixifAI's own database**: customers, assets, service
  requests, technicians, schedules, photos, voice notes, quotations, service
  reports, invoices, maintenance history.
- WhatsApp only *feeds* requests in and *delivers* updates out. If Meta disables
  a number or changes API rules (e.g. Embedded Signup v2 deprecation scheduled
  for 2026-10-15), the business keeps operating.
- Meta messaging rules respected: free-form replies only inside the 24-hour
  customer-service window; business-initiated reminders need approved templates —
  so reminders always have SMS/email/portal fallbacks.

### Two onboarding packages
| | Simple package | Automation package |
|---|---|---|
| WhatsApp | None required — manual wa.me share buttons (prefilled messages, zero API) | WhatsApp Cloud API connected |
| Includes | Dashboard, service link, QR codes, technician PWA, email notifications | + AI chat intake, auto ticket creation, template reminders, conversation history |

WhatsApp automation is an **upgrade/add-on**, not a requirement.

## 4. Multi-Industry Design (Industry Packs)

During onboarding the customer selects their industry (multi-select allowed); an
**Industry Pack** then seeds the workspace:

| Industry Pack | Pre-loaded asset types | Sample PM templates | Extras |
|---|---|---|---|
| AC / Refrigeration service | Split/VRF units, chillers, cold rooms | Gas check, coil clean, filter cycles | Refrigerant logs |
| Lift / Elevator maintenance | Lifts, escalators | Monthly statutory checks | Compliance certs |
| Fire & security | Extinguishers, alarms, CCTV, access control | Statutory inspections | Cert expiry alerts |
| Generator / power | Generators, UPS, solar inverters | Runtime-hour service | Meter readings |
| Facilities / FM contracts | Mixed building assets | Contract-driven schedules | Multi-site SLA |
| In-house manufacturing | Production machines, compressors, boilers | Runtime/calendar PM | Downtime cost focus |
| In-house hospitality | Rooms, HVAC, pools, kitchens | Room checks, pool chemistry | Guest SLA |

**Pack mechanics:** workspace has `industries: string[]`; each pack = data-driven
JSON seed (asset types, PM templates, checklists, dashboards, terminology via
i18n keys). New industries added without code changes — key for global expansion.

## 5. Feature Set

### 5.1 Core (MVP)
- **Manager dashboard** — jobs board, scheduling & dispatch, technician map,
  overdue monitoring, quotation/invoice management, reports.
- **Customer portal + branded service link** — `fixifai.com/service/<company>`:
  submit issue (asset, description, photos/video, urgency, preferred time),
  get tracking reference, approve quotations, view service history.
- **QR per asset (digital service identity)** — scan → asset context
  (customer, branch, serial, warranty, contract, repair history) → report flow.
- **Technician PWA** — today's jobs, Google Maps navigation, asset history,
  checklists, required parts, before/after photos, voice notes, customer
  signature, job completion report.
- **Technician location tracking** (reuse TouchOrbit geofence pattern,
  `apps/touchorbit-api/src/attendance/attendance.service.ts`):
  - GPS check-in / check-out at the job site.
  - Geofence validation (lat/long + radius per customer site) — job can only be
    started on-site.
  - Attendance-style day start/end for field staff.
  - Manager map view of technician locations & job status.
- **Customers, assets, contracts (AMC)** — records with expiry alerts.
- **Quotations & invoices** — approval link for customers, payment status.
- **Service-history timeline** per asset.
- **Email notifications** built-in.

### 5.2 AI (in MVP — all Meta-independent)
1. **AI intake on the service link/portal** — free-text + photo → categorized,
   prioritized job with suggested asset match. No WhatsApp dependency.
2. **Voice-to-service-report** — technician speaks (Sinhala/Tamil/English) →
   structured service report drafted by AI.
3. **AI triage & dispatch suggestion** — priority scoring + best-technician
   suggestion from skill, location (uses GPS data), and current load.

### 5.3 Phase 2
- WhatsApp Cloud API package (AI chat intake, auto tickets, template reminders,
  conversation history).
- SMS channel.
- Maintenance-contract reminder automation.
- Spare parts & inventory (lead-time aware).
- Troubleshooting copilot (manuals + asset history chat).
- Accounting integration (e.g. QuickBooks/local exports).
- PayHere payments for invoices.

### 5.4 Phase 3
- WhatsApp Embedded Signup for customers (self-serve automation onboarding).
- Failure-pattern prediction from accumulated history (no IoT required).
- PM-plan generator from uploaded manual PDFs.
- Multi-company vendor network; white-label customer portal.
- IoT/sensor ingestion; advanced analytics.

## 6. Pricing (Sri Lanka launch)

Flat per-company monthly tiers (LKR), generous user counts:

| Tier | Price (indicative) | Includes |
|---|---|---|
| Starter | LKR 7,500/mo | 15 users, core jobs/assets/QR, service link, email |
| Pro | LKR 15,000/mo | 40 users, + AI intake & voice reports, location tracking, quotations/invoices |
| Business | LKR 30,000/mo | Unlimited users, + multi-branch, API, priority support |

- WhatsApp Automation package: add-on per tier (covers Meta conversation costs).
- Payments: PayHere + bank transfer (LKR); Stripe for global later.

## 7. Technical Architecture (cloudit-platform monorepo)

- `apps/fixifai-api` — NestJS + Prisma (pattern: orbitone-api/touchorbit-api).
  Dedicated Postgres database `fixifai` in the shared instance.
- `apps/fixifai-web` — Next.js 14 manager dashboard + customer portal
  (pattern: touchorbit-admin-web).
- `apps/fixifai-tech-web` — technician mobile-first PWA (pattern:
  touchorbit-employee-web). Geolocation APIs + offline-capable job execution.
- Geofencing/location: port the geofence + GPS attendance model from
  `apps/touchorbit-api` (geofences table: lat/long/radius; events with lat/long).
- `infra/fixifai-*/` — docker-compose with Traefik labels
  (`api-fixifai.<domain>`, `fixifai.<domain>`, `tech.fixifai.<domain>` or path-based).
- Ports: API 3012, web 3013, tech PWA 3014 (verify free before use).
- AI via external LLM APIs (OpenAI/Claude/Gemini) — same approach as
  whatsapp-agent-api. No GPU/self-hosted models in Phase 1.
- WhatsApp (Phase 2): reuse Meta setup (docs/META_WHATSAPP_SETUP_CHECKLIST.md).
- Auth/tenancy: follow platform-api orgs/users model.
- i18n from day one: English / Sinhala / Tamil.

### Deployment note
Current Hetzner CX33 RAM budget is nearly full; FixifAI likely deploys to a
**separate server** (purchase under consideration). Compose files are designed
standalone with the same network pattern.

## 8. Roadmap

| Phase | Scope | Outcome |
|---|---|---|
| 1 — MVP | §5.1 + §5.2 | 2–3 pilot service contractors in Sri Lanka |
| 2 — Channels & depth | §5.3 | WhatsApp automation add-on live, inventory, copilot |
| 3 — Intelligence & scale | §5.4 | Prediction, white-label, USD pricing, global GTM |

## 9. Success Metrics (pilots)

- Technician adoption: % of jobs updated via PWA (>80% target).
- Location compliance: % of jobs with verified on-site check-in.
- Time-to-report: customer issue → job created (<2 min via service link).
- Quotation approval cycle time; invoice payment time.
- PM/contract compliance rate; repeat-fault rate per asset.

## 10. Open Decisions

- Final brand domain (fixifai.com / fixifai.lk?).
- Separate server specs & timing.
- Which LLM provider for Sinhala/Tamil voice transcription (test in Phase 1).
- Live technician tracking vs check-in-only (privacy/battery trade-off — MVP is
  check-in + on-demand, continuous tracking opt-in later).
- WhatsApp Business number strategy for the automation add-on (shared vs
  per-customer via Embedded Signup in Phase 3).
