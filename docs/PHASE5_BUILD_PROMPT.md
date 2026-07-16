# Phase 5 Build Prompt — TheReplyte Go Live

## Context

TheReplyte is a WhatsApp AI Agent product for CloudIT.

- **Backend:** `apps/whatsapp-agent-api` — NestJS, Meta WhatsApp webhook, Kimi AI, Chatwoot integration
- **Frontend:** `apps/whatsapp-agent-web` — Next.js supervisor dashboard
- **Agent inbox:** Chatwoot (web + native iOS/Android apps)

Previous phases are complete:
- Phase 1: Chatwoot infrastructure
- Phase 2: Backend integration with Chatwoot
- Phase 3: Client onboarding automation
- Phase 4: Mobile apps, analytics, supervisor alerts

Full plan: `docs/WHATSAPP_AGENT_HYBRID_PLAN.md`

## Goal of Phase 5

Make TheReplyte production-ready and test with a real WhatsApp number.

## Domains

| Service | Production domain |
|---|---|
| API | `https://api.thereplyte.com` |
| Dashboard | `https://app.thereplyte.com` |
| Chatwoot | `https://inbox.thereplyte.com` |

## Important

- Build Phase 5 **only**. Do not go back and change Phase 1-4 code unless necessary.
- Stop and ask for approval before considering the phase complete.
- Do not commit real credentials to Git. Use `.env` files only.

## Phase 5 Tasks

### 5.1 Update deployment files

Update these files so TheReplyte deploys automatically when pushing to GitHub:

1. `infra/whatsapp-agent-api/docker-compose.yml`
   - Hardcode `api.thereplyte.com` in Traefik labels
   - Remove dependency on `${DOMAIN}` variable for host rules

2. `infra/whatsapp-agent-web/docker-compose.yml`
   - Hardcode `app.thereplyte.com` in Traefik labels
   - Set `NEXT_PUBLIC_API_URL=https://api.thereplyte.com/api`
   - Set `API_URL=https://api.thereplyte.com/api`

3. `infra/chatwoot/docker-compose.yml`
   - Hardcode `inbox.thereplyte.com` in Traefik labels
   - Set `FRONTEND_URL=https://inbox.thereplyte.com`

4. `infra/chatwoot/.env.example`
   - Set `CHATWOOT_FRONTEND_URL=https://inbox.thereplyte.com`
   - Set `DOMAIN=thereplyte.com`
   - Set sender email to `noreply@thereplyte.com`

5. `infra/scripts/deploy.sh`
   - Add `whatsapp-agent-api` to build/start sequence
   - Add `whatsapp-agent-web` to build/start sequence
   - Add `chatwoot` (rails + sidekiq) to start sequence
   - Wait for these services to become healthy

6. `infra/scripts/health-check.sh`
   - Add `https://api.thereplyte.com/api/health`
   - Add `https://app.thereplyte.com`
   - Add `https://inbox.thereplyte.com`

7. `apps/whatsapp-agent-api/.env.example`
   - Add Chatwoot env vars:
     - `CHATWOOT_PLATFORM_API_URL=http://chatwoot-rails:3000`
     - `CHATWOOT_PLATFORM_API_KEY=...`
     - `CHATWOOT_ADMIN_API_KEY=...`
     - `CHATWOOT_ADMIN_USER_ID=1`
   - Update `CORS_ORIGIN` to include `https://app.thereplyte.com`

8. `apps/whatsapp-agent-web/.env.example`
   - Set `NEXT_PUBLIC_API_URL=https://api.thereplyte.com/api`
   - Set `API_URL=https://api.thereplyte.com/api`

**Important:** Do not change any existing CloudIT service deployment. Only add TheReplyte services.

### 5.2 Prepare production environment

1. Ensure `.env` files are ready for production:
   - `apps/whatsapp-agent-api/.env`
   - `apps/whatsapp-agent-web/.env`
   - `infra/chatwoot/.env`

2. Document required values in a checklist file `docs/PHASE5_ENV_CHECKLIST.md`:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `KIMI_API_KEY`
   - `META_VERIFY_TOKEN`
   - `CHATWOOT_PLATFORM_API_KEY`
   - `CHATWOOT_ADMIN_API_KEY`
   - `CHATWOOT_SECRET_KEY_BASE`
   - Postgres password
   - Redis password
   - SMTP credentials

### 5.3 Meta WhatsApp webhook setup guide

Create `docs/META_WEBHOOK_SETUP.md` with exact steps:

1. Go to `https://developers.facebook.com/apps`
2. Select the `cloudit` app
3. Go to **WhatsApp → Configuration**
4. Click **Edit** next to Webhook
5. Callback URL: `https://api.thereplyte.com/api/webhooks/whatsapp`
6. Verify token: same as `META_VERIFY_TOKEN`
7. Click **Verify and Save**
8. Subscribe to `messages` field
9. Click **Save**

### 5.4 Go-live testing steps

Create `docs/PHASE5_TESTING.md` with this test flow:

1. Deploy to server via Git push
2. Verify health endpoints:
   - `https://api.thereplyte.com/api/health`
   - `https://app.thereplyte.com`
   - `https://inbox.thereplyte.com`
3. Login to dashboard at `https://app.thereplyte.com`
4. Create first client with real Meta credentials
5. Click **Setup Chatwoot** for the client
6. Add first agent and sync to Chatwoot
7. Configure Meta webhook
8. Send WhatsApp message to client number
9. Verify AI replies
10. Send handoff keyword like "human" or "complaint"
11. Verify conversation appears in Chatwoot
12. Agent replies in Chatwoot
13. Verify reply reaches WhatsApp customer
14. Agent resolves conversation
15. Verify status becomes `resolved`

### 5.5 First client creation guide

Create `docs/FIRST_CLIENT_SETUP.md` showing exact JSON/API call or dashboard steps to create a client with:

```json
{
  "name": "Sunrise Grocery",
  "whatsappNumber": "+94751234567",
  "whatsappPhoneNumberId": "YOUR_PHONE_NUMBER_ID",
  "metaAccessToken": "YOUR_PERMANENT_ACCESS_TOKEN",
  "businessProfile": {
    "address": "Colombo",
    "hours": "8AM-6PM",
    "phone": "+94751234567"
  },
  "products": [
    { "name": "Rice 5kg", "price": 450, "stock": 10 }
  ],
  "systemPrompt": "You are the AI assistant for Sunrise Grocery."
}
```

### 5.6 Build and type-check

Before finishing:
- Run `npm run build` for `whatsapp-agent-api`
- Run `npm run build` for `whatsapp-agent-web`
- Ensure no TypeScript errors
- Ensure no broken imports

## Deliverables

By the end of Phase 5, these files should exist or be updated:

- Updated `infra/whatsapp-agent-api/docker-compose.yml`
- Updated `infra/whatsapp-agent-web/docker-compose.yml`
- Updated `infra/chatwoot/docker-compose.yml`
- Updated `infra/chatwoot/.env.example`
- Updated `infra/scripts/deploy.sh`
- Updated `infra/scripts/health-check.sh`
- Updated `apps/whatsapp-agent-api/.env.example`
- Updated `apps/whatsapp-agent-web/.env.example`
- New `docs/PHASE5_ENV_CHECKLIST.md`
- New `docs/META_WEBHOOK_SETUP.md`
- New `docs/PHASE5_TESTING.md`
- New `docs/FIRST_CLIENT_SETUP.md`

## What to tell the user when done

When Phase 5 is complete, stop and say:

> "Phase 5 is ready. Deployment files are updated. To go live, please:
> 1. Add real values to the server .env files
> 2. Push to GitHub to deploy
> 3. Configure the Meta webhook
> 4. Create your first client in the dashboard
> 5. Run the end-to-end test
>
> Do you want me to proceed with any fixes after testing?"

## First action

Start with **5.1 Update deployment files**. Read the existing `infra/scripts/deploy.sh` and `infra/scripts/health-check.sh` carefully before modifying.
