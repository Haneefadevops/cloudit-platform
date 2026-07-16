# Next Kimi Code Session Prompt

## Context

We are building **TheReplyte**, a WhatsApp AI Agent product for CloudIT. This is a hybrid solution:

- **Custom backend**: `apps/whatsapp-agent-api` — handles Meta WhatsApp webhook, Kimi AI replies, database, and human handoff logic (branded as TheReplyte)
- **Chatwoot**: Used as the agent inbox (web + native iOS/Android apps)

The full plan is documented here:
**`docs/WHATSAPP_AGENT_HYBRID_PLAN.md`**

## What is already built

Read these before starting:

- `apps/whatsapp-agent-api/` — NestJS backend with webhook, AI, auth, conversations, Prisma schema
- `apps/whatsapp-agent-web/` — Next.js supervisor dashboard
- `docs/WHATSAPP_AGENT_HYBRID_PLAN.md` — complete build plan
- `infra/postgres/init/01-create-databases.sql` — Postgres init (Chatwoot DB added)

## Approved decisions

| Decision | Approved Choice |
|---|---|
| Chatwoot database | Same Postgres server, separate database |
| Agent login | Separate Chatwoot login for MVP |
| Chatwoot account | One account per client |
| Our web dashboard | Supervisor/admin only; agents use Chatwoot |

## Important instruction: build phase by phase

You must build the product in the following phases. **After completing each phase, STOP and ask the user for approval before starting the next phase.**

Do not skip phases. Do not combine phases. Do not proceed without user confirmation.

## Build phases

### Phase 1: Chatwoot Infrastructure
- Add `infra/chatwoot/docker-compose.yml`
- Configure Chatwoot to use existing Postgres and Redis
- Add SMTP configuration for Chatwoot emails
- Add Chatwoot to Traefik routing
- Create `.env.example` for Chatwoot
- Start Chatwoot locally and verify it runs
- Create first admin account and test login

**Stop here and ask for approval.**

### Phase 2: Backend Integration
- Add Chatwoot mapping fields to `apps/whatsapp-agent-api/prisma/schema.prisma`
- Create `src/chatwoot/` module with service and controller
- Add functions to create Chatwoot account, inbox, contact, conversation, and agent
- Modify `src/whatsapp/whatsapp.service.ts` to push handoffs to Chatwoot
- Create `POST /api/webhooks/chatwoot` to receive agent replies
- On agent reply from Chatwoot, send message back to customer via Meta WhatsApp API
- Run migrations and test the handoff flow

**Stop here and ask for approval.**

### Phase 3: Client Onboarding Automation
- Build API endpoint to auto-create Chatwoot account + inbox for a client
- Build API endpoint to sync our agents to Chatwoot
- Add Chatwoot connection status check
- Update `apps/whatsapp-agent-web` client management UI to include Chatwoot setup
- Test creating a full client with Chatwoot from our dashboard

**Stop here and ask for approval.**

### Phase 4: Mobile Apps & Polish
- Test Chatwoot iOS and Android apps with sample conversation
- Configure push notifications
- Add labels and automation rules in Chatwoot (urgent, complaint, etc.)
- Enhance supervisor dashboard with basic analytics
- Add n8n webhook alert for urgent handoffs (optional)

**Stop here and ask for approval.**

### Phase 5: Go Live
- Add real Kimi API key to `apps/whatsapp-agent-api/.env`
- Add real Meta credentials for first client
- End-to-end test with a real WhatsApp number
- Create a simple go-live checklist
- Verify agent can reply from Chatwoot mobile app

**Stop here and ask for approval.**

## Conventions to follow

- Use the existing project stack: NestJS, Next.js, Prisma, PostgreSQL, Docker, Traefik
- Follow the code style in `apps/platform-api` and existing `apps/whatsapp-agent-api`
- Use the existing `cloudit` Docker network
- Keep changes minimal and focused on the current phase
- Test what you build before stopping
- Update this prompt or the plan document if decisions change

## First action

Start with **Phase 1: Chatwoot Infrastructure**. Read the plan document first, then implement.

After Phase 1 is complete, summarize what was done and ask the user:
> "Phase 1 is complete. Chatwoot is running at [URL]. Do you want me to proceed to Phase 2: Backend Integration?"
