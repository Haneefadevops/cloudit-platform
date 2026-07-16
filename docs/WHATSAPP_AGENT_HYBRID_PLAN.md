# TheReplyte — WhatsApp AI Agent Hybrid Solution Plan

## Date
2026-07-16

## Goal
Build a market-ready WhatsApp AI automation product with human handoff, using:
- **Custom backend** for AI orchestration, Meta WhatsApp API, and data
- **Chatwoot** as the agent inbox (web + native iOS/Android apps)

This gives us a professional, convincing product for client demos and sales.

## Approved Decisions

| Decision | Approved Choice |
|---|---|
| Chatwoot database | Same Postgres server, separate database |
| Agent login | Separate Chatwoot login for MVP |
| Chatwoot account | One account per client |
| Our web dashboard | Supervisor/admin only; agents use Chatwoot |

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CUSTOMER                              │
│              (Sends WhatsApp message)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              META WHATSAPP BUSINESS API                      │
│         (Receives message, forwards to webhook)            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                CLOUDIT AI BACKEND                            │
│    apps/whatsapp-agent-api                                   │
│    - Webhook endpoint for Meta API                            │
│    - Client/business context lookup                           │
│    - Kimi AI reply generation                                 │
│    - Handoff decision engine                                  │
│    - Sends bot replies back to Meta                           │
│    - Pushes human chats to Chatwoot                           │
│    - Receives Chatwoot agent replies                          │
└────────────────────────┬────────────────────────────────────┘
                         │
            ├────────────┴────────────┐
            ▼                         ▼
    ┌──────────────┐          ┌──────────────┐
    │   KIMI API   │          │  CHATWOOT    │
    │  (AI brain)  │          │  (Agent      │
    │              │          │   inbox)     │
    └──────────────┘          └──────┬───────┘
                                     │
                         ┌───────────┴───────────┐
                         ▼                       ▼
                 ┌──────────────┐       ┌──────────────┐
                 │ Chatwoot Web │       │  Chatwoot    │
                 │   Dashboard  │       │  Mobile App  │
                 └──────────────┘       └──────────────┘
```

---

## 2. What We Already Have

| Component | Status | Notes |
|---|---|---|
| `apps/whatsapp-agent-api` | ✅ Built | Webhook, AI, DB, auth, conversations |
| `apps/whatsapp-agent-web` | ✅ Built | Basic dashboard |
| PostgreSQL database | ✅ Built | Clients, customers, conversations, messages |
| Kimi integration | ✅ Built | `ai.service.ts` |
| Meta WhatsApp send/receive | ✅ Built | `whatsapp-sender.service.ts`, `whatsapp.controller.ts` |
| n8n | ✅ Running | Can be used for side-effects |
| Chatwoot | ❌ Not installed | Need to add to infra |

---

## 3. What Chatwoot Provides

| Feature | Benefit |
|---|---|
| Web dashboard | Agents reply from browser |
| Native iOS app | Agents reply from iPhone |
| Native Android app | Agents reply from Android |
| Push notifications | Reliable mobile alerts |
| Team assignment | Route chats to teams/agents |
| Labels & automation | Categorize and auto-assign |
| Conversation history | Full chat thread view |
| Canned responses | Quick reply templates |
| CSAT | Customer satisfaction ratings |
| Multi-inbox | One Chatwoot, multiple WhatsApp numbers |

---

## 4. Required Changes

### 4.1 Install Chatwoot

Add Chatwoot to `infra/chatwoot/docker-compose.yml`.

Stack:
- `chatwoot-rails` — main app
- `chatwoot-sidekiq` — background jobs
- `postgres` — reuse existing or separate DB
- `redis` — reuse existing

### 4.2 Database Schema Changes

Add Chatwoot mapping fields to our schema:

```prisma
model Client {
  // existing fields...
  chatwootAccountId   Int?     // Chatwoot account ID for this client
  chatwootInboxId     Int?     // Chatwoot WhatsApp inbox ID
  chatwootApiKey      String?  // Chatwoot platform API key
}

model Conversation {
  // existing fields...
  chatwootConversationId Int?  // Maps our conversation to Chatwoot
  chatwootContactId      Int?  // Maps our customer to Chatwoot contact
}

model Customer {
  // existing fields...
  chatwootContactId Int?      // Chatwoot contact ID
}
```

### 4.3 Chatwoot Connector Module

Create `src/chatwoot/chatwoot.service.ts`:

Functions needed:
- `createAccount(name)` — create Chatwoot account per client
- `createInbox(accountId, name, phoneNumber)` — create WhatsApp inbox
- `createContact(accountId, phone, name)` — create customer contact
- `createConversation(accountId, inboxId, contactId, content)` — start conversation
- `sendMessage(conversationId, content)` — add message to conversation
- `createAgent(accountId, name, email)` — create agent user

### 4.4 WhatsApp Service Changes

Modify `src/whatsapp/whatsapp.service.ts`:

Current flow:
```
Customer message → find client → AI reply or handoff → send WhatsApp
```

New flow:
```
Customer message → find client → AI reply or handoff
                                  ├─ bot reply → send WhatsApp
                                  └─ human handoff → create/update Chatwoot conversation
```

On handoff:
1. Update our `Conversation.status = 'human'`
2. Create Chatwoot contact (if new)
3. Create Chatwoot conversation
4. Send initial message to Chatwoot with context:
   - Customer info
   - AI conversation history
   - Handoff reason

### 4.5 Chatwoot Webhook Handler

Create `src/chatwoot/chatwoot.controller.ts`:

Endpoint: `POST /api/webhooks/chatwoot`

Listen for events:
- `message_created` with `message_type: "outgoing"` → agent replied

On agent reply:
1. Find our conversation by `chatwootConversationId`
2. Store message in our DB as `senderType: 'agent'`
3. Send message to customer via Meta WhatsApp API
4. If agent resolves conversation, update our DB status to `resolved`

### 4.6 Meta WhatsApp Channel in Chatwoot

Chatwoot supports WhatsApp Cloud API directly. Two approaches:

**Option A: Chatwoot connects directly to Meta**
- Pros: Simpler, Chatwoot handles message sync
- Cons: Our backend doesn't see all messages for AI training

**Option B: Our backend connects to Meta, forwards to Chatwoot**
- Pros: Full control, all data flows through us
- Cons: More integration work

**Recommended: Option B** — keep our backend as the central hub.

### 4.7 Agent Authentication

Two options:

**Option A: Separate Chatwoot login**
- Agents login to Chatwoot directly
- Easier to implement
- Agents have two logins (our dashboard + Chatwoot)

**Option B: SSO between our dashboard and Chatwoot**
- Single login via our platform
- More complex
- Better user experience

**Recommended: Option A for MVP**, Option B later.

### 4.8 Web Dashboard Role

Our `apps/whatsapp-agent-web` becomes:
- Supervisor/admin dashboard
- Client onboarding
- AI prompt configuration
- Analytics (conversation volume, AI vs human ratio)
- Not the primary agent reply screen

---

## 5. Data Flow Examples

### 5.1 Bot handles message

```
Customer: "What are your opening hours?"
  ↓
Meta → our backend
  ↓
Find client (Sunrise Grocery)
Find/create customer
  ↓
Kimi AI generates reply
  ↓
Store bot message in our DB
  ↓
Send WhatsApp reply to customer
```

### 5.2 Human handoff

```
Customer: "I want a refund"
  ↓
Meta → our backend
  ↓
Detect handoff keyword "refund"
  ↓
Update conversation status = 'human'
Create Chatwoot contact (if new)
Create Chatwoot conversation
Send context message to Chatwoot:
  "Handoff from AI. Customer: Amal (+9477...). Reason: refund request."
  ↓
Agent gets push notification in Chatwoot mobile app
  ↓
Agent opens Chatwoot, sees full history, replies
  ↓
Chatwoot webhook → our backend
  ↓
Our backend sends WhatsApp message to customer
  ↓
Store agent message in our DB
```

### 5.3 Agent resolves chat

```
Agent clicks "Resolve" in Chatwoot
  ↓
Chatwoot webhook → our backend
  ↓
Update our conversation status = 'resolved'
  ↓
Next customer message starts new AI conversation
```

---

## 6. API Endpoints to Add/Modify

### New endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/webhooks/chatwoot` | Receive Chatwoot events |
| POST | `/api/clients/:id/chatwoot-setup` | Setup Chatwoot account + inbox for client |
| POST | `/api/clients/:id/chatwoot-agents` | Sync agents to Chatwoot |
| GET | `/api/clients/:id/chatwoot-status` | Check Chatwoot connection |

### Modified endpoints

| Endpoint | Change |
|---|---|
| `POST /api/webhooks/whatsapp` | On handoff, push to Chatwoot |
| `POST /api/conversations/:id/handoff` | Also create Chatwoot conversation |
| `PUT /api/conversations/:id/resolve` | Optional if Chatwoot handles resolve |

---

## 7. Chatwoot Configuration

### Per client setup

1. Create Chatwoot account for client
2. Create WhatsApp inbox in that account
3. Add agents to account
4. Configure automation rules:
   - Auto-assign new conversations round-robin
   - Label urgent complaints
   - Business hours auto-responder

### Webhook URL in Chatwoot

Set in Chatwoot Settings → Integrations → Webhooks:

```
https://api.thereplyte.com/api/webhooks/chatwoot
```

Subscribe to:
- `message_created`
- `conversation_status_changed`
- `conversation_resolved`

---

## 8. Security Considerations

| Item | Solution |
|---|---|
| Chatwoot API key | Store encrypted in our DB or env |
| Webhook verification | Verify Chatwoot signature if available |
| Meta webhook | Already verify token, optionally verify signature |
| Agent access | Chatwoot roles + our auth |
| Data privacy | Keep conversation copy in our DB |

---

## 9. Deployment Plan

### Services to run

| Service | Container | Port |
|---|---|---|
| whatsapp-agent-api | `cloudit/whatsapp-agent-api` | 3010 |
| whatsapp-agent-web | `cloudit/whatsapp-agent-web` | 3011 |
| chatwoot-rails | `chatwoot/chatwoot:latest` | 3000 |
| chatwoot-sidekiq | `chatwoot/chatwoot:latest` | — |
| postgres | existing | 5432 |
| redis | existing | 6379 |

### Domains

| Service | Domain |
|---|---|
| API | `api.thereplyte.com` |
| Web dashboard | `app.thereplyte.com` |
| Chatwoot | `inbox.thereplyte.com` |

---

## 10. Development Phases

### Phase 1: Chatwoot Infrastructure (2-3 days)
- Add Chatwoot to Docker Compose
- Connect to existing Postgres and Redis
- Setup SMTP for Chatwoot emails
- Configure domain and SSL via Traefik
- Test Chatwoot web + mobile login

### Phase 2: Backend Integration (3-4 days)
- Add Chatwoot mapping fields to Prisma schema
- Create Chatwoot connector service
- Modify WhatsApp service to push handoffs to Chatwoot
- Create Chatwoot webhook handler
- Test full handoff and agent reply flow

### Phase 3: Client Onboarding (2-3 days)
- Build API to auto-create Chatwoot account + inbox per client
- Add client setup UI in web dashboard
- Sync agents from our DB to Chatwoot
- Add Chatwoot connection status check

### Phase 4: Polish & Mobile (2-3 days)
- Test Chatwoot iOS/Android apps
- Configure push notifications
- Add labels/automation in Chatwoot
- Supervisor dashboard analytics
- n8n alerts for urgent handoffs (optional)

### Phase 5: Go Live (1-2 days)
- Add real Meta credentials for first client
- Add real Kimi API key
- End-to-end test with real WhatsApp number
- Train first agent

**Total estimated time: 2-3 weeks**

---

## 11. Files to Create/Modify

### New files

```
apps/whatsapp-agent-api/
  src/chatwoot/
    chatwoot.module.ts
    chatwoot.service.ts
    chatwoot.controller.ts
    dto/
      create-account.dto.ts
      create-inbox.dto.ts
      create-contact.dto.ts
      webhook-payload.dto.ts

infra/chatwoot/
  docker-compose.yml
  .env.example

docs/
  WHATSAPP_AGENT_HYBRID_PLAN.md (this file)
  CHATWOOT_SETUP_GUIDE.md (to be created during build)
```

### Files to modify

```
apps/whatsapp-agent-api/prisma/schema.prisma
apps/whatsapp-agent-api/src/whatsapp/whatsapp.service.ts
apps/whatsapp-agent-api/src/whatsapp/whatsapp.module.ts
apps/whatsapp-agent-api/src/conversations/conversations.service.ts
apps/whatsapp-agent-api/src/app.module.ts
infra/postgres/init/01-create-databases.sql (add chatwoot DB if separate)
```

---

## 12. Open Decisions

| Decision | Options | Recommendation |
|---|---|---|
| Separate DB for Chatwoot? | Yes / No | Use same Postgres server, separate database |
| Agent auth | Chatwoot separate / SSO | Separate for MVP |
| Chatwoot account per client? | Yes / One account with multiple inboxes | One account per client for isolation |
| Our dashboard role | Full inbox / Supervisor only | Supervisor only |
| n8n alerts | Yes / No | Yes for urgent notifications |

---

## 13. Next Steps

1. Review and approve this plan
2. In next chat: install Chatwoot in `infra/chatwoot`
3. Add Prisma schema changes
4. Build Chatwoot connector service
5. Wire handoff flow
6. Test with real Meta/Kimi credentials
7. Demo to first client
