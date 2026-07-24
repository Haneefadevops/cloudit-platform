# TheReplyte Bookings & Orders Plan

## Purpose of this document

This plan was designed in a prior session (2026-07-23) and is written so a fresh
session can implement it without re-discussing the design. Read this file fully
before writing any code. The design decisions below are settled — implement them
as described unless the user explicitly changes them.

## Context

- TheReplyte is a no-code WhatsApp AI agent product. `docs/THEREPLYTE_PRODUCTION_PLAN.md`
  Phases 1–4 are complete in code: client onboarding, Chatwoot integration, AI settings,
  knowledge base/RAG, operating hours, CSAT, analytics, media handling, canned responses,
  playground, auto-labeling, conversation summaries.
- The marketing landing page (apps/thereplyte-landing) already promises
  "takes bookings and orders" — this plan delivers that promise.
- Everything in TheReplyte is multi-tenant, keyed off the `Client` record. Each client
  has its own AI settings, knowledge base, canned responses, Chatwoot account, timezone,
  and language. Bookings and orders must follow the same per-client isolation.

## Core design principle

**The AI talks; the backend owns the truth.**

The AI must never invent a booking, price, availability, total, or order status.
All facts (slots, prices, stock, statuses, totals) come from backend code and the
database. The AI only decides *when* to act and *how* to phrase things.

## Architecture overview

```
Customer (WhatsApp)
   ↓
whatsapp.service.ts handleIncomingMessage()
   ↓
AiService.generateReply()  →  returns { reply, action? }
   ↓
If action present → backend executes it (check availability, create booking,
add order items, check order status...) → result fed back into the next AI turn
   ↓
Confirmation message sent via WhatsAppSenderService
   ↓
Staff notified (Chatwoot conversation + dashboard)
```

### AI "actions" mechanism

Today `AiService.generateReply()` returns `{ reply, handoff, handoffReason }` parsed
from a JSON-mode Kimi response (see `apps/whatsapp-agent-api/src/ai/ai.service.ts`).
Extend the JSON contract with an optional `action` field:

```json
{
  "reply": "Friday 7:30pm with Dr. Perera is free — shall I book it?",
  "handoff": false,
  "action": { "type": "check_availability", "service": "consultation", "date": "2026-07-24" }
}
```

Planned action types (names may be refined during implementation, keep them consistent):

- Bookings: `check_availability`, `create_booking`, `cancel_booking`, `reschedule_booking`
- Orders: `add_items`, `remove_items`, `set_order_details` (delivery/pickup, address, name), `confirm_order`, `check_order_status`, `cancel_order`

Execution loop (in `whatsapp.service.ts` or a dedicated orchestrator service):

1. AI response contains an action → backend executes it against the database.
2. The action result (e.g. real available slots, order draft with real total) is
   injected into the next AI call as context so the AI can phrase the reply.
3. Only after customer confirmation does the backend persist the final state.

Deliberately NOT using native tool/function calling in v1: extending the existing
JSON contract is a smaller, more testable change on top of the current JSON-mode flow.

## Data model (Prisma, per client)

New models in `apps/whatsapp-agent-api/prisma/schema.prisma` (all with `clientId`
relation and cascade delete, following existing conventions):

- `Service` — name, description, durationMinutes, price, requiresConfirmation (bool),
  intakeQuestions (Json array of strings), active flag. For bookings.
- `Staff` — name, weeklyHours (Json: per-day start/end), daysOff/exceptions (Json),
  active flag. Optional per client; if a client has no staff rows, availability is
  computed at the business level using the client's existing operating hours.
- `Booking` — customerId, serviceId, staffId (nullable), startAt, endAt,
  status (`pending` → `confirmed` → `completed` / `cancelled` / `no_show`),
  intakeAnswers (Json), notes.
- `Product` — name, description, price, category (nullable), available (bool),
  options (Json array of {name, priceDelta} variants, e.g. chicken/beef/veg),
  active flag. Replaces the legacy `products` Json field on `Client`
  (keep the legacy field for backwards compatibility; stop feeding it to the AI
  once the client has Product rows).
- `Order` — customerId, conversationId, type (`delivery` | `pickup`),
  status (`draft` → `pending` → `confirmed` → `preparing` → `out_for_delivery` → `completed`, plus `cancelled`),
  customerName, address, phone, total (computed by backend), notes.
- `OrderItem` — orderId, productId, quantity, unitPrice (copied at order time so
  later price changes never rewrite history), selectedOptions (Json).

Client-level additions (feature flags and module settings on the `Client` model):

- `ordersEnabled` (bool, default false)
- `bookingsEnabled` (bool, default false)
- `deliveryEnabled` / `pickupEnabled` (bools)
- `bookingApprovalMode` (`auto` | `approval`) — global per client; individual
  services can also set `requiresConfirmation`
- `orderConfirmationTemplate`, `bookingConfirmationTemplate` (nullable strings)
- `paymentInstructions` (nullable string, e.g. bank transfer details, "pay at counter")
- `bookingReminderHours` (int, nullable — e.g. 24 for clinics, 2 for salons;
  null/0 disables reminders)

Status pipelines are GLOBAL, not per-client (decided): custom per-client statuses
make the AI's job and analytics messy. Per-client wording around the fixed statuses
is the customization surface instead.

## Per-client customization (settled design)

Everything is per client; cross-client leaks must be impossible by design (the AI
only ever sees the catalog/services of the client whose WhatsApp number received
the message — enforce in the prompt builder, never merge catalogs).

- **Feature switches**: clinic → bookings only; restaurant → orders only; salon
  with retail → both. When a module is off, the AI does not mention it and the
  dashboard hides its pages.
- **Own data**: catalog for orders; services/durations/staff/hours for bookings.
- **Flow wording**: confirmation templates, payment instructions, reminder timing,
  language/tone (existing AI settings).
- **Notifications**: new booking/order alerts go to the client's Chatwoot account
  (existing pattern) and appear in the dashboard.
- **Dashboard views**: client sees only the pages for enabled modules.

## Three tiers of complexity (settled design)

1. **Simple — fully automatic (v1 target).**
   "Book Friday 7:30 with Dr. Perera", "2 chicken kottu, deliver here."
   AI closes end-to-end, no staff involvement.

2. **Medium — configurable, still automatic.**
   Do NOT build custom flows per client; add configurable structure:
   - Service variants/options with different durations/prices; product options
     with price deltas. Staff define them in the dashboard; the AI asks
     "which one?" naturally in chat.
   - Intake questions per service/product (`intakeQuestions` Json): "Party size?",
     "Any allergies?", "Cake message?". Answers stored as structured
     `intakeAnswers`/notes on the booking/order.
   - Multi-item orders with modifiers across messages (draft order persists on
     the conversation).
   - Duration-driven slots: different service durations produce different slot
     grids from the same availability engine.
   This tier is expected to cover 80–90% of real SMB needs with no per-client code.

3. **Genuinely complex — AI collects, human closes.**
   Quotes, multi-day events, negotiated packages, deposits, B2B bulk orders.
   Pattern: structured handoff using the existing handoff plumbing.
   - Service flagged `requiresConfirmation` (or client in `approval` mode):
     AI collects all details conversationally into a structured request, tells the
     customer a team member will confirm shortly, posts the structured summary to
     Chatwoot + dashboard. Staff review, edit if needed, hit confirm → customer
     gets the confirmation on WhatsApp automatically.
   - Never build a fragile rules engine for unique business logic.

## Order flow (reference conversation)

```
Customer: Do you have chicken kottu?
AI:       Yes — Chicken Kottu is Rs. 850. Would you like to order?
Customer: 2 of those and a lime juice
          → action add_items → backend creates DRAFT order on this conversation,
            computes real total
AI:       Got it — 2× Chicken Kottu + 1× Lime Juice = Rs. 1,950. Delivery or pickup?
Customer: Delivery, 45 Galle Road, Colombo 3
          → action set_order_details → order becomes pending
AI:       Order confirmed! ... Rs. 1,950, delivering to 45 Galle Road.
          We'll message you when it's on the way.
          → staff notified in Chatwoot + dashboard Orders page
```

- Draft order lives on the conversation, so items can be added/changed across
  messages ("actually make it 3").
- Staff move the order through statuses in the dashboard; each status change can
  optionally auto-message the customer ("Your order is on the way").
- "Where's my order?" → `check_order_status` → AI replies with the real status.
- Unavailable items: the `available` flag is in the prompt, so the AI offers
  alternatives instead of promising sold-out items.
- Payment v1: cash on delivery / bank transfer (total stated in the confirmation
  message, `paymentInstructions` shown where relevant). Payment links are a
  later phase, not this plan.

## Booking flow (reference conversation)

```
Customer: Can I get Friday 7:30 with Dr. Perera?
          → action check_availability → backend computes real slots
AI:       Friday 7:30pm with Dr. Perera is free — shall I book it?
Customer: Yes please
          → action create_booking → booking created (pending or confirmed
            depending on approval mode)
AI:       Booked! Friday 7:30pm with Dr. Perera. See you then.
          → staff notified; reminder job scheduled
```

- Availability = staff weekly hours (or client operating hours when no staff rows)
  minus existing bookings, sliced into slots by service duration. Pure backend
  logic, computed in the client's timezone (existing `Client.timezone` field).
- Cancel/reschedule through the same action mechanism.
- Reminders: scheduled job sends a WhatsApp message `bookingReminderHours` before
  the appointment ("Tomorrow 7:30 with Dr. Perera — reply R to reschedule").

## Dashboard additions (apps/whatsapp-agent-web)

New pages, visible only when the module is enabled for the selected client:

- **Services & Availability** (`/dashboard/services`) — manage services, variants,
  intake questions, staff and their weekly hours. No-code setup like the rest of
  the product.
- **Bookings** (`/dashboard/bookings`) — list/calendar view, confirm/cancel,
  mark completed/no-show, approve pending-approval bookings.
- **Catalog** (`/dashboard/catalog`) — manage products, options, prices,
  availability flags.
- **Orders** (`/dashboard/orders`) — pipeline view by status, advance statuses,
  see intake answers and customer details.

Onboarding form: add a small "Modules" section (orders on/off, bookings on/off,
delivery/pickup, approval mode) so staff enable these without code.

Update `dashboard/layout.tsx` nav accordingly (gated by module flags).

## What is deliberately OUT of scope (do not build in this plan)

- Google Calendar / Cal.com / Calendly sync — adds per-client OAuth setup and
  breaks the no-code onboarding goal. Later optional integration.
- Reusing apps/hospitality-api reservations module — hotel-specific (rooms,
  invoices, housekeeping). Concepts yes, code no.
- Native LLM tool/function calling — stick to the extended JSON contract for v1.
- Payments/payment links — v1 is COD/bank transfer only.
- Per-client custom status pipelines — fixed global statuses, customizable wording.
- Product photos sent as WhatsApp images — v1 catalog is text-only; photos are a
  later enhancement (WhatsApp image sending via Meta API).

## Implementation phases (execute in this order)

Each phase should be a working, deployable increment. Follow existing code
conventions: NestJS modules with controller/service/module files, JwtAuthGuard +
AdminGuard on dashboard endpoints, Prisma migrations named
`YYYYMMDDHHMMSS_descriptive_name`, per-client `clientId` scoping everywhere.

### Phase 1 — Data model + availability engine + setup UI

1. Prisma: add `Service`, `Staff`, `Booking` models and the client module flags
   (`bookingsEnabled`, `bookingApprovalMode`, `bookingReminderHours`,
   `bookingConfirmationTemplate`). Migration + `prisma generate`.
2. New `bookings` NestJS module: CRUD for services/staff (admin endpoints),
   and the availability engine: given client + service + date, return bookable
   slots (staff hours or client operating hours, minus existing bookings, sliced
   by service duration, in the client's timezone). Unit-test the slot math,
   including overnight hours (the codebase already supports overnight operating
   hours in whatsapp.service.ts `isWithinOperatingHours` — mirror that logic).
3. Dashboard: `/dashboard/services` page (services, variants, intake questions,
   staff hours) and the Modules section in client onboarding. Gate nav items by
   `bookingsEnabled`.

### Phase 2 — AI booking conversation

1. Extend the AI JSON contract with `action` (see above). Update
   `AiService.buildSystemPrompt` to describe available actions, the client's
   services, and approval-mode behavior. Only inject booking instructions when
   `bookingsEnabled`.
2. Orchestrator in the WhatsApp flow: execute booking actions
   (`check_availability`, `create_booking`, `cancel_booking`,
   `reschedule_booking`), feed results back, persist bookings only on explicit
   customer confirmation.
3. Respect `bookingApprovalMode` and per-service `requiresConfirmation`:
   auto-confirm or create as `pending` + structured handoff to Chatwoot
   (reuse the existing handoff/summary plumbing in conversations.service.ts).
4. Notify staff on new booking (Chatwoot message into the client's account,
   following existing chatwoot.service.ts patterns).
5. Playground support: booking actions must also work from
   `/dashboard/playground` so staff can test flows without WhatsApp.

### Phase 3 — Reminders + bookings dashboard

1. Scheduled job (check for an existing scheduler/cron pattern in the repo first;
   otherwise use @nestjs/schedule) that finds bookings starting within
   `bookingReminderHours`, sends the WhatsApp reminder via
   WhatsAppSenderService, and marks the booking as reminded (add a
   `reminderSentAt` timestamp to avoid duplicates).
2. Dashboard `/dashboard/bookings`: list/calendar, status actions
   (confirm, cancel, completed, no-show), approve pending bookings.
3. Optional per-status customer notifications on booking status changes.

### Phase 4 — Orders end-to-end

1. Prisma: `Product`, `Order`, `OrderItem` models + client flags
   (`ordersEnabled`, `deliveryEnabled`, `pickupEnabled`,
   `orderConfirmationTemplate`, `paymentInstructions`). Migration.
2. New `orders`/`catalog` NestJS module: catalog CRUD (admin), draft order
   management keyed on the conversation, total calculation.
3. Prompt builder: inject the client's catalog (with availability flags and
   option price deltas) when `ordersEnabled`; remove reliance on the legacy
   `products` Json for those clients.
4. Order actions in the AI contract: `add_items`, `remove_items`,
   `set_order_details`, `confirm_order`, `check_order_status`, `cancel_order`.
   Same orchestrator pattern as bookings.
5. Staff notification on confirmed orders (Chatwoot) + dashboard
   `/dashboard/orders` pipeline page with status advancement and optional
   per-status customer WhatsApp notifications.
6. Dashboard `/dashboard/catalog` page.
7. Playground support for order actions.

### Phase 5 (optional, only if user asks) — Polish

- Booking/order metrics on the existing analytics endpoint
  (bookings count, no-show rate, orders count, revenue sum).
- Canned-response-style templates for common order updates.
- `site:`-level docs update: README/user guide sections for staff onboarding
  with the new modules.

## Deferred: Travel module (do NOT build now)

Discussed 2026-07-23 for a prospective travel-agent client (flight ticketing +
outbound tours from Sri Lanka). Deferred until the client confirms. When revived:

- **Stage 1 (no flight API):** AI collects ticket requirements conversationally
  (route, dates, passengers, passport names, class, budget) → structured
  "ticket request" via the pending-approval/handoff machinery → staff price in
  their existing GDS/consolidator → quote and e-ticket PDF delivered over
  WhatsApp (Meta API supports outbound documents). Tours = per-client catalog
  + knowledge base, no external API.
- **Stage 2:** live flight search/pricing via an API — Duffel (no IATA needed,
  pay-as-you-go) or the client's consolidator (TBO/Mystifly are common in
  South Asia) as new AI action types on the same actions skeleton.
- **Stage 3:** auto-ticketing after payment, only if volume justifies it.
- Payments: bank transfer / PayHere (Sri Lankan gateway) in v1.

## Open decisions to confirm with the user before/while implementing

1. First real clients: appointments-first or orders-first? If orders are more
   urgent, run Phase 4 before Phase 3.
2. Booking approval mode default for new clients: recommend defaulting to
   `approval` (cautious) and letting clients flip to `auto` once they trust the AI.
3. Reminder default hours when unset: recommend 24h for bookings, none for orders.

## Reference files (current codebase)

- AI contract + prompt: `apps/whatsapp-agent-api/src/ai/ai.service.ts`
- WhatsApp message flow: `apps/whatsapp-agent-api/src/whatsapp/whatsapp.service.ts`
- Handoff/summary/labels plumbing: `apps/whatsapp-agent-api/src/conversations/conversations.service.ts`
- Chatwoot integration: `apps/whatsapp-agent-api/src/chatwoot/chatwoot.service.ts`
- Sending WhatsApp messages: `apps/whatsapp-agent-api/src/whatsapp-sender/whatsapp-sender.service.ts`
- Prisma schema: `apps/whatsapp-agent-api/prisma/schema.prisma`
- Dashboard pages pattern: `apps/whatsapp-agent-web/src/app/dashboard/*/page.tsx`
- Dashboard nav: `apps/whatsapp-agent-web/src/app/dashboard/layout.tsx`
- Production plan (completed phases): `docs/THEREPLYTE_PRODUCTION_PLAN.md`
