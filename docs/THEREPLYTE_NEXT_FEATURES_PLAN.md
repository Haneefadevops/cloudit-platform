# TheReplyte Next Features Plan

## Goal

Complete the customer → AI → staff loop, make the AI learn from agent replies with human approval, add Sri Lanka commerce capabilities, and ship the first vertical pack (Clinic). This builds on `THEREPLYTE_PRODUCTION_PLAN.md` (Phases 1–4, complete).

---

## Design Principles

1. **Staff never operate the AI.** It briefs them, drafts for them, goes silent when they type, and learns from what they fix. Everything happens inside Chatwoot or plain WhatsApp.
2. **Nothing enters the knowledge base without human approval.** Auto-learning produces drafts; a human approves with one tap.
3. **Owners live in WhatsApp, agents live in Chatwoot.** The dashboard is for onboarding and configuration only.
4. **Sri Lanka first.** Sinhala/Tamil quality, COD, bank-slip payments, number-based appointments are features, not afterthoughts.

---

## Current State (already built)

- No-code client onboarding with Chatwoot account/inbox/webhook automation.
- Per-client AI settings (prompt, temperature, max tokens, confidence threshold, operating hours, welcome/fallback/outside-hours messages, CSAT).
- Knowledge base with pgvector RAG, file upload, and website crawl.
- Handoff to Chatwoot with full history, AI summary note, rule-based + AI labels.
- CSAT collection with ratings stored and synced.
- Analytics overview with token/cost tracking.
- Media understanding (voice transcription, image description, document extraction).
- Canned responses with `/shortcut` expansion.
- AI testing playground.

---

## Phase A — Finish the Core Loop (~1 week)

### A1. Pre-handoff information capture

Before handing off, the AI collects the essentials so staff never ask "what is this about?"

- Add `intakeFields Json?` to `Client` (e.g. `["name", "what they need", "preferred date/time", "items + quantity"]`), seeded per industry later.
- The AI asks these conversationally before triggering handoff (configurable; skip if the customer already provided them).
- On handoff, post a structured **summary card** to Chatwoot (private note): customer name, phone, need, items, preferred time, conversation summary.

### A2. AI silence during human handling

- Add `aiPausedUntil DateTime?` to `Conversation` and `aiPauseHours Int @default(24)` to `Client`.
- When the Chatwoot webhook sees an **outgoing agent message** in a conversation, set `aiPausedUntil = now + aiPauseHours`.
- `whatsapp.service` checks `aiPausedUntil` before generating an AI reply; while paused, customer messages are forwarded to Chatwoot without AI involvement.
- On Chatwoot `conversation_resolved`, clear the pause immediately and run the normal CSAT flow.

### A3. Quick-reply menu

- Add `menuEnabled Boolean @default(false)` and `menuOptions Json?` to `Client` (e.g. `[{"key": 1, "label": "Prices", "action": "kb"}, {"key": 2, "label": "Talk to human", "action": "handoff"}]`).
- Sent as part of the welcome message for new customers.
- Numeric replies route: `kb` actions answer from the KB; `handoff` actions go straight to Chatwoot.
- CSAT pending state takes precedence over menu parsing (a 1–5 reply after a rating request is a rating, not a menu choice).

### A4. Knowledge gap page

- New `KnowledgeGap` model: `id, clientId, question, source ('fallback' | 'low-confidence' | 'low-csat'), status ('open' | 'approved' | 'dismissed'), draftAnswer String?, createdAt, resolvedAt`.
- Created automatically when the fallback path fires (and later from B1/B5).
- Endpoints: `GET /knowledge-gaps/:clientId`, `POST /knowledge-gaps/:id/approve`, `POST /knowledge-gaps/:id/dismiss`.
- Approve writes the Q&A into the `documents` table via the existing KB create path.
- Dashboard page `/dashboard/knowledge-gaps` with per-client list, draft preview, approve/dismiss buttons, and a count badge.

---

## Phase B — Learning Loop + Owner Experience (~1.5 weeks)

### B1. Auto-learn from agent replies (Level 1: draft + approve)

- When an agent sends a message in Chatwoot on a conversation that has an **open knowledge gap** (or that was handed off), pair the customer's unanswered question with the agent's reply.
- Kimi rewrites the pair into a clean KB entry: strips names, order numbers, phone numbers, small talk; generalizes customer-specific details.
- Stored as `draftAnswer` on the `KnowledgeGap` record; gap surfaces on the dashboard and in the owner's teach-me message (B2).
- **Approval is always human** — one tap in the dashboard or a WhatsApp reply. No auto-write to the KB.

### B2. Teach-me WhatsApp messages

- Daily (configurable) message to the client's `adminPhone`: "I couldn't answer 3 questions today. Reply with the answer, or YES 1 to use my draft."
- Owner replies teach the AI directly: free-text answer or draft approval → enters KB (same approve path as A4/B1).
- Requires outbound WhatsApp send to the owner (template message outside the 24h window; session message inside it).

### B3. AI growth dashboard

- Extend `/analytics/overview`: `aiResolutionRate` (bot-resolved without handoff / total resolved), weekly trend, `gapsClosed` count, `gapsOpen` count.
- Dashboard Analytics page: "Your AI handled 41% this month (↑ from 28%)" card + trend. This is the lock-in story.

### B4. Owner morning digest

- Add `digestEnabled Boolean @default(false)` and `digestTime String @default("08:00")` to `Client`.
- Daily cron aggregates yesterday: conversations, AI-resolved %, handoffs + reasons, leads/orders, top questions, low-CSAT flags.
- Sent as a WhatsApp message to `adminPhone`.

### B5. CSAT-based quality flagging

- `csatRating <= 2` on a bot-resolved conversation creates a `KnowledgeGap` with source `low-csat` and the weak Q&A attached.
- Surfaces in the gap page for review/retraining — the AI learns which of its *own* answers are weak.

---

## Phase C — Sri Lanka Commerce + Staff Power-ups (~2 weeks)

### C1. Lead / order capture

- New `Order` model: `id, clientId, customerId, conversationId, type ('order' | 'lead' | 'booking-request'), items Json, customerName, phone, address, preferredTime, paymentMethod ('cod' | 'bank-transfer' | null), paymentStatus ('pending' | 'confirmed' | null), status ('new' | 'confirmed' | 'completed' | 'cancelled'), notes`.
- The AI extracts structured details conversationally (it already collects intake info; this formalizes it into a record).
- On creation: summary card to Chatwoot + WhatsApp alert to owner (`adminPhone`).
- Dashboard `/dashboard/orders`: per-client list with status updates (status changes can notify the customer).

### C2. Bank-slip reading

- Extend the media pipeline: when an image arrives on a conversation with a `pending` bank-transfer order, run the vision model with a slip-extraction prompt (amount, reference, date, bank).
- If the amount matches the order total → `paymentStatus = 'confirmed'`, customer gets confirmation, owner gets notified.
- On mismatch/unreadable → hand off with the extracted details for staff to verify.

### C3. Agent-assist drafts

- On handoff (and on customer messages while AI is paused), generate a suggested reply via `AiService` (KB + last customer message) and post it as a **private note** in the Chatwoot conversation.
- Agent edits/copies/sends — or ignores it. No behavior change required.

### C4. Language bridge

- When the customer's language differs from the client's business language, add a private-note translation of incoming customer messages for the agent.
- Outgoing agent replies are translated back to the customer's language before forwarding to WhatsApp (toggleable per client: `translationEnabled`).

### C5. Review nudge

- Add `googleReviewUrl String?` to `Client`.
- CSAT 4–5 → customer receives a thank-you + review link. CSAT ≤ 3 → private alert to owner (WhatsApp) with the conversation link.

### C6. Simple broadcast

- New `Broadcast` model: `id, clientId, name, templateName, audience ('all' | 'tags'), status, sentCount, createdAt`.
- Dashboard `/dashboard/broadcasts`: pick audience (all past customers), pick an approved Meta template, fill parameters, send.
- Delivery via Meta template messages; per-message status tracked. Note Meta per-conversation pricing — show an estimate before sending.

---

## Phase D — Vertical Pack #1: Clinic (~2 weeks)

### D1. Industry templates at onboarding

- `industry` selection drives seeding: system prompt, KB starter entries, menu options, canned responses, blocked topics (e.g. clinics: never give medical advice → handoff), intake fields.
- First packs: `clinic`, `salon`, `shop`. Same engine; configuration only.

### D2. Number-based appointments (channeling style)

- New models:
  - `Doctor`: `id, clientId, name, specialty, active`.
  - `Session`: `id, doctorId, weekday, startTime, endTime, maxSlots, feeLkr, active`.
  - `Appointment`: `id, sessionId, date, slotNumber, customerId, conversationId, status ('booked' | 'confirmed' | 'cancelled' | 'completed' | 'no-show'), createdAt`.
- Slot time estimate = session duration / maxSlots (displayed as "No. 9, approx 7:30 pm").
- Flows: availability check → offer lowest open numbers → book → confirm/reschedule/cancel via WhatsApp → number released on cancel.
- Reminders via n8n (or built-in cron): 24h + 2h before; confirmation requested; non-confirmation can auto-release.
- Dashboard `/dashboard/appointments`: doctors, sessions, daily number list; staff can block/cancel numbers.

---

## Files to Modify / Create

### Backend (`apps/whatsapp-agent-api`)

- `prisma/schema.prisma` + migrations:
  - `Client`: `intakeFields`, `aiPauseHours`, `menuEnabled`, `menuOptions`, `digestEnabled`, `digestTime`, `googleReviewUrl`, `translationEnabled`.
  - `Conversation`: `aiPausedUntil`.
  - New: `KnowledgeGap`, `Order`, `Broadcast`, `Doctor`, `Session`, `Appointment`.
- `src/whatsapp/whatsapp.service.ts` — intake capture, menu routing, pause check, order/appointment flows, digest/teach replies from owners.
- `src/chatwoot/chatwoot.controller.ts` — agent-message detection (pause + auto-learn capture), resolve → unpause, translation bridge.
- `src/conversations/conversations.service.ts` — summary card posting, agent-assist drafts.
- `src/knowledge-gaps/` (new module) — CRUD, draft generation, approve → KB write.
- `src/orders/` (new module) — order capture, slip confirmation, status notifications.
- `src/broadcasts/` (new module) — audience + template send.
- `src/appointments/` (new module) — doctors, sessions, booking logic, reminders.
- `src/ai/ai.service.ts` — KB-entry drafting (sanitize/generalize), draft-reply generation, translation, slip extraction prompt.
- `src/analytics/analytics.controller.ts` — AI resolution rate, gap stats.
- Cron/scheduler module for digest, teach-me messages, appointment reminders.

### Frontend (`apps/whatsapp-agent-web`)

- New pages: `/dashboard/knowledge-gaps`, `/dashboard/orders`, `/dashboard/broadcasts`, `/dashboard/appointments`.
- `ai-settings` page: intake fields, menu editor, pause hours, digest toggle/time, review URL, translation toggle.
- `analytics` page: AI resolution % + trend, gaps open/closed.
- `clients` onboarding: industry selector driving template seeding.
- `layout.tsx` navigation updates.

---

## Access & Visibility Model

| Who | Where they work | What they see |
|---|---|---|
| Platform staff (you) | TheReplyte dashboard | Client onboarding, AI configuration, KB management, monitoring, gap drafts, order statuses. **No live conversation transcripts or message bodies.** |
| Client's staff (agents) | Their own Chatwoot account | Only their own customers' conversations, AI summary cards, drafts, labels. They never see the TheReplyte dashboard. |
| Client's owner | WhatsApp + optionally Chatwoot | Digests, teach-me prompts, order alerts. |

Dashboard rule: gap entries show only the question snippet needed for teaching; orders show fulfillment details (name, phone, items) but not chat history. If stricter isolation is needed later, add a per-client `dataVisibility` setting to hide even snippets from platform staff.

---

## Staff–AI Interaction Model (build rule)

This table describes the **client's staff** (agents) inside **Chatwoot** — not platform staff, who only use the dashboard and never see these conversations.

| Moment | What staff experience |
|---|---|
| Handoff arrives | Summary card + AI summary + labels + suggested reply draft (private note) |
| Agent types a reply | AI goes silent on that conversation automatically |
| Agent resolves | AI resumes, CSAT fires automatically |
| Agent answered something the AI couldn't | A KB draft appears for owner approval — agent does nothing extra |
| Customer writes another language | Agent sees translation as private note; replies in their own language |
| Repetitive replies | `/shortcut` canned responses with variables |

---

## Success Criteria

- Staff handle a handed-off conversation without asking the customer to repeat anything.
- AI never replies while a human is handling a conversation.
- Every unanswered question becomes a gap; approved agent answers enter the KB with one tap; AI resolution % visibly trends up month over month.
- An owner can teach the AI, see the daily digest, and get order alerts entirely from WhatsApp.
- A clinic can go from signup to taking number-based bookings with reminders, with no command-line or prompt-writing.
