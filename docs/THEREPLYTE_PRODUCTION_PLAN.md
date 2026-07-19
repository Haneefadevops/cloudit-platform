# TheReplyte Production Plan

## Goal

Transform TheReplyte from a partially manual deployment into a fully automated, no-code WhatsApp AI Agent product that non-technical staff can operate. TheReplyte dashboard is used only for client onboarding and AI configuration; Chatwoot remains the agent workspace.

---

## Current Problems

1. **Manual Chatwoot webhook configuration** — agent replies do not reach WhatsApp without a curl/API step.
2. **Agent management in TheReplyte dashboard** — clients’ agents should be managed inside Chatwoot, not in TheReplyte dashboard.
3. **Agent email verification blocked by SMTP** — Chatwoot sends verification emails that may not arrive.
4. **Duplicate Chatwoot accounts** — two `CloudIT` accounts exist; the manually created account is unused.
5. **AI settings are backend-only** — no UI to control prompts, knowledge base, or handoff behavior.
6. **Meta webhook setup is manual** — users must copy values into Meta Developers with no in-app guidance.

---

## Target Architecture

```
End Customer (WhatsApp)
        ↓
Meta WhatsApp Cloud API
        ↓
TheReplyte API (api.thereplyte.com)
  ├─ AI replies from knowledge base
  ├─ Human handoff to Chatwoot
  └─ Forward agent replies to WhatsApp
        ↓
Chatwoot (inbox.thereplyte.com)
        ↓
Client's agents reply
```

```
TheReplyte Staff
        ↓
TheReplyte Dashboard (app.thereplyte.com)
  ├─ Clients (onboarding)
  ├─ AI Settings (per client)
  ├─ Knowledge Base (per client)
  └─ Analytics / Monitoring
```

---

## Proposed Changes

### 1. Simplified Client Onboarding (no-code)

When a staff member creates a client in the dashboard, the system automatically:

- Creates a dedicated Chatwoot account.
- Creates a WhatsApp/API inbox inside that account.
- Configures the Chatwoot webhook (`/api/webhooks/chatwoot`).
- Creates a default **client admin** user in Chatwoot and auto-confirms the email.
- Stores the client’s Meta credentials and phone number ID.
- Applies default AI settings.

The onboarding form is split into clear sections. For launch, the staff member fills the **essential fields**; advanced fields can be configured later in AI Settings.

#### Onboarding form sections

```text
1. Business Information
   - Company / brand name
   - Industry / business type
   - Website
   - Timezone
   - Default language

2. Contact & Access
   - Primary admin email (used for Chatwoot admin login)
   - Primary admin phone

3. WhatsApp Configuration
   - WhatsApp Business number
   - WhatsApp Phone Number ID
   - Meta access token

4. AI Behavior (defaults, editable later)
   - Business description
   - Welcome message
   - Fallback message
   - Handoff keywords
   - Operating hours
```

#### Field priority mapping

| Priority | Field | Purpose |
|---|---|---|
| Essential | Company / brand name | Chatwoot account name and AI identity |
| Essential | Industry / business type | Default tone and prompt template |
| Essential | Website | Knowledge base crawl source |
| Essential | Timezone | Operating hours and handoff logic |
| Essential | Default language | AI reply language |
| Essential | Primary admin email | Chatwoot admin login |
| Essential | Primary admin phone | Recovery and alerts |
| Essential | WhatsApp Business number | Customer-facing number |
| Essential | WhatsApp Phone Number ID | Meta API identifier |
| Essential | Meta access token | Send WhatsApp messages |
| Standard | Business description | Feeds default system prompt |
| Standard | Welcome message | First message to new customers |
| Standard | Fallback message | Reply when AI cannot answer |
| Standard | Handoff keywords | Trigger human transfer |
| Standard | Operating hours | Auto-handoff when closed |
| Advanced | Custom AI model | Per-client model selection |
| Advanced | Tone preset | Friendly, formal, persuasive |
| Advanced | Confidence threshold | When to say “I don’t know” |
| Advanced | Prohibited topics | Blocked subjects |
| Advanced | Notification channels | Email / Slack / n8n for urgent handoffs |

### 2. Remove Agent Management from TheReplyte Dashboard

- Delete or hide the **Agents** page.
- Remove the **Sync Agents** button from the client card.
- Clients add and manage their own agents inside Chatwoot.
- TheReplyte only needs to know the client record; agent identity is handled by Chatwoot.

### 3. Auto-Confirm Chatwoot Users

- When the system creates a Chatwoot user during onboarding, set `confirmed_at` immediately via the Chatwoot API or database seed step.
- This removes dependency on SMTP for agent login.
- SMTP remains useful for password resets and notifications, but is not required to get started.

### 4. AI Settings Page (per client)

Add `/dashboard/ai-settings` with a client selector and the following controls:

| Setting | Purpose |
|---|---|
| System prompt | Defines AI personality, tone, and business rules |
| Temperature | Controls creativity vs consistency |
| Max tokens | Limits response length |
| Welcome message | First message sent to new customers |
| Fallback message | Reply when AI cannot answer |
| Handoff keywords | Words that trigger human transfer |
| Operating hours | Auto-handoff outside business hours |

These values are stored on the `Client` record and read by the WhatsApp service.

### 5. Knowledge Base / RAG (per client)

Add `/dashboard/knowledge-base` where staff can upload or paste business content:

- Plain text / FAQ entries
- PDF / TXT / DOCX uploads
- Website crawl (optional advanced feature)

Implementation:

- Store documents per client.
- Use `pgvector` extension in Postgres to store embeddings.
- On each customer message, search the knowledge base for relevant chunks.
- Inject top results into the Kimi prompt as context.
- AI answers only from the provided context + system prompt.

This keeps the AI within the client’s business nature without model fine-tuning.

### 6. Meta Webhook Setup Guide

Add a **Meta Setup** section in the client card or a dedicated page that shows:

- Callback URL: `https://api.thereplyte.com/api/webhooks/whatsapp`
- Verify token value
- Step-by-step instructions
- Status indicator (green if recent webhook was received)

Full automation of Meta webhook requires Meta API permissions, so this remains a guided copy-paste flow.

### 7. Dashboard Monitoring

Update the client card to show:

- Chatwoot account connection status
- Webhook status (last successful callback)
- AI status (enabled/disabled)
- Quick actions: **Open Chatwoot**, **Edit AI Settings**, **Edit Knowledge Base**

### 8. Clean Up Duplicate Chatwoot Accounts

- Use only the Chatwoot account created by TheReplyte (Account #3 for CloudIT).
- The older manual account (Account #2) can be renamed, ignored, or removed to avoid confusion.

---

## Implementation Phases

### Phase 1 — Foundation (must-have for launch)

1. Auto-configure Chatwoot webhook on client creation.
2. Auto-confirm the default client admin user in Chatwoot.
3. Remove agent management from TheReplyte dashboard.
4. Add AI Settings page with system prompt and temperature.
5. Add Meta webhook setup guide in dashboard.
6. Clean up duplicate accounts view / documentation.

### Phase 2 — Knowledge Base

1. Add `documents` table per client with pgvector embeddings.
2. Build knowledge base upload UI (text + files).
3. Integrate RAG into the WhatsApp message handler.
4. Add fallback message when no relevant context is found.

### Phase 3 — Advanced AI Controls

1. Handoff keywords
2. Operating hours
3. Welcome message
4. Max tokens
5. Confidence threshold / answer refusal
6. Multi-language auto-detect

### Phase 4 — Analytics & Polish

1. AI usage analytics (token count, cost estimate)
2. Conversation summarization
3. Auto-labeling
4. AI testing playground

---

## Files to Modify / Create

### Backend

- `apps/whatsapp-agent-api/src/clients/clients.controller.ts`
  - Trigger Chatwoot webhook setup after account creation.
- `apps/whatsapp-agent-api/src/chatwoot/chatwoot.service.ts`
  - Add `createWebhook`, `confirmUser`, `createAccountAdmin` methods.
- `apps/whatsapp-agent-api/src/whatsapp/whatsapp.service.ts`
  - Read AI settings from `Client`.
  - Integrate knowledge base search.
- `apps/whatsapp-agent-api/src/knowledge-base/` (new module)
  - Upload, embed, search documents.
- `apps/whatsapp-agent-api/prisma/schema.prisma`
  - Extend `Client` with onboarding and AI fields:
    - `industry`, `website`, `timezone`, `language`
    - `adminEmail`, `adminPhone`
    - `welcomeMessage`, `fallbackMessage`, `handoffKeywords`
    - `operatingHoursStart`, `operatingHoursEnd`, `closedDays`
    - `aiEnabled`, `aiModel`, `maxTokens`, `confidenceThreshold`
  - Add `Document` model for knowledge base.

### Frontend

- `apps/whatsapp-agent-web/src/app/dashboard/ai-settings/page.tsx` (new)
- `apps/whatsapp-agent-web/src/app/dashboard/knowledge-base/page.tsx` (new)
- `apps/whatsapp-agent-web/src/app/dashboard/clients/page.tsx`
  - Simplify UI, remove agent sync, add quick actions.
- `apps/whatsapp-agent-web/src/app/dashboard/layout.tsx`
  - Update navigation.
- Remove or hide `apps/whatsapp-agent-web/src/app/dashboard/agents/page.tsx`.

### Infrastructure

- `infra/chatwoot/.env.example`
  - Keep SMTP optional for notifications, not required for onboarding.

### Docs

- `docs/THEREPLYTE_PRODUCTION_PLAN.md` (this file)
- Update `docs/THEREPLYTE_USER_GUIDE.md` when built.

---

## Implementation Notes

### Environment variables added for Phase 1

- `API_PUBLIC_URL` — public URL of the TheReplyte API, used when registering the Chatwoot webhook.
- `CHATWOOT_DATABASE_URL` — read-only/admin connection to the Chatwoot Postgres database so that newly created client admin users can be auto-confirmed (sets `confirmed_at`) without relying on SMTP.

### Auto-confirming Chatwoot users

Chatwoot does not expose a public API to confirm a user email. The whatsapp-agent-api therefore connects directly to the Chatwoot `users` table and sets `confirmed_at = NOW()` for the email created during onboarding. This requires `CHATWOOT_DATABASE_URL` to be configured. If it is missing, the user is still created but SMTP verification is required.

### Webhook verification

The WhatsApp webhook verification endpoint accepts either the global `META_VERIFY_TOKEN` or any client's `verifyToken`. This keeps the existing global flow working while allowing per-client tokens in the future.

### Agents page

The TheReplyte dashboard **Agents** page has been removed. Agents are now created and managed inside each client's Chatwoot account.

### Phase 4 — Media Handling & Canned Responses

- **Media messages**: incoming WhatsApp images, voice notes, and documents are downloaded from the Meta Graph API and converted to text for the normal AI pipeline (`MediaService`):
  - Voice notes → Whisper transcription (`WHISPER_API_URL`/`WHISPER_API_KEY`/`WHISPER_MODEL`, falls back to `EMBEDDING_API_KEY`).
  - Images → description + visible-text extraction via Kimi vision (`KIMI_VISION_MODEL`, default `kimi-latest`). Captions are included.
  - Documents (pdf/docx/txt) → extracted text (truncated at 2000 chars).
  - Unprocessable media becomes a placeholder note so the AI/handoff flow still works.
- **Canned responses**: per-client templates (`canned_responses` table, CRUD at `/api/canned-responses/:clientId`, admin-only). Dashboard page at `/dashboard/canned-responses`. Agents type `/shortcut` in Chatwoot; the webhook expands it to the template with `{{customer_name}}`, `{{business_name}}`, `{{agent_name}}` variables before forwarding to WhatsApp.
- Migration: `20260719160000_add_canned_responses`.

### Phase 3 — Operating Hours, Welcome Message, Analytics & CSAT

- **Operating hours enforced at runtime**: incoming messages outside the client's `operatingHoursStart`/`operatingHoursEnd` (evaluated in the client's `timezone`) or on a `closedDays` weekday receive the new `outsideHoursMessage`, and the conversation is handed off (`triggeredBy: 'system'`) so it is queued in Chatwoot for the next business day. Overnight ranges (e.g. 22:00–02:00) are supported.
- **Welcome message**: sent on a customer's first-ever conversation, before the AI reply.
- **CSAT**: when a conversation is resolved in Chatwoot, the customer receives a 1–5 rating request (`csatMessage`, toggleable per client via `csatEnabled`). The next numeric reply is stored on the conversation (`csatRating`/`csatFeedback`) and copied to `HandoffLog.customerSatisfaction`; any non-rating reply expires the request and starts a normal conversation.
- **Analytics**: `GET /api/analytics/overview` now accepts an optional `clientId` filter and additionally returns `avgResolutionTimeMinutes`, `avgHandoffResponseSeconds` (from `HandoffLog.responseTimeSeconds`, now populated at handoff time), and `csat` (average + response count). The dashboard Analytics page has a client selector and the new metric cards.
- Migration: `20260719150000_add_phase3_operating_hours_csat`.

### Phase 2 — Knowledge Base / RAG

- Added `documents` table with `pgvector` embeddings per client.
- Knowledge base upload UI supports plain text, `.txt`, `.pdf`, and `.docx` files.
- Incoming WhatsApp messages trigger a vector search; top matching chunks are injected into the Kimi prompt as context.
- If no relevant context is found, the AI uses the client's fallback message and triggers handoff.
- When a conversation is handed off to a human agent, the full bot/customer message history is pushed to the Chatwoot conversation so the agent has full context.

## Success Criteria

- A non-technical staff member can create a client in TheReplyte dashboard without touching the server.
- The client can log into Chatwoot immediately without email verification issues.
- Agent replies in Chatwoot reach WhatsApp automatically.
- TheReplyte dashboard has a working AI settings and knowledge base page.
- No command-line steps are required for normal onboarding.
