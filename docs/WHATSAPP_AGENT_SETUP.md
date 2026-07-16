# TheReplyte — WhatsApp AI Agent Setup Guide

TheReplyte is a white-label WhatsApp AI automation product with human handoff.

## What was built

- `apps/whatsapp-agent-api` — NestJS backend
- `apps/whatsapp-agent-web` — Next.js agent dashboard
- `infra/whatsapp-agent-api` — Docker Compose for API
- `infra/whatsapp-agent-web` — Docker Compose for web

## Features

- Receive WhatsApp messages via Meta webhook
- AI replies via Kimi API
- Automatic human handoff on keywords, AI uncertainty, or errors
- Agent dashboard to view/supervise/reply to conversations
- Multi-client support (one WhatsApp number per client)

## Local development

### 1. Start PostgreSQL

```bash
cd apps/whatsapp-agent-api
docker-compose up -d
```

### 2. Install dependencies

From project root:

```bash
npm install
```

### 3. Configure environment

```bash
cp apps/whatsapp-agent-api/.env.example apps/whatsapp-agent-api/.env
cp apps/whatsapp-agent-web/.env.example apps/whatsapp-agent-web/.env
```

Edit `.env` files with your real credentials:

- `KIMI_API_KEY` — your Moonshot API key
- `META_VERIFY_TOKEN` — your Meta webhook verify token
- Meta tokens are per-client, stored in the database

### 4. Run migrations and seed

```bash
cd apps/whatsapp-agent-api
npx prisma migrate dev
npx prisma db seed
```

Default admin: `admin@thereplyte.com` / `admin123`

### 5. Start API

```bash
cd apps/whatsapp-agent-api
npm run start:dev
```

API: http://localhost:3010/api
Swagger: http://localhost:3010/api/docs

### 6. Start Web

```bash
cd apps/whatsapp-agent-web
npm run dev
```

Web: http://localhost:3011

## Adding your first client

Login at http://localhost:3011 with default admin.

Or via API:

```bash
# Login
curl -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@thereplyte.com","password":"admin123"}'

# Create client
curl -X POST http://localhost:3010/api/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Sunrise Grocery",
    "whatsappNumber": "+94751234567",
    "whatsappPhoneNumberId": "YOUR_META_PHONE_NUMBER_ID",
    "metaAccessToken": "YOUR_META_PERMANENT_TOKEN",
    "businessProfile": {
      "address": "Colombo",
      "hours": "8AM-6PM",
      "phone": "+94751234567"
    },
    "products": [
      {"name": "Rice 5kg", "price": 450, "stock": 10}
    ],
    "systemPrompt": "You are the AI assistant for Sunrise Grocery."
  }'
```

## Meta WhatsApp webhook setup

In your Meta app dashboard:

1. Go to WhatsApp → Configuration
2. Set webhook URL: `https://api.thereplyte.com/api/webhooks/whatsapp`
3. Set verify token: same as `META_VERIFY_TOKEN`
4. Subscribe to `messages`

## Deployment

Use the existing deployment pattern:

```bash
cd infra/whatsapp-agent-api
docker-compose -f docker-compose.yml up -d --build

cd infra/whatsapp-agent-web
docker-compose -f docker-compose.yml up -d --build

cd infra/chatwoot
docker-compose -f docker-compose.yml up -d --build
```

Make sure the `cloudit` Docker network exists:

```bash
docker network create cloudit
```

## Chatwoot mobile app & supervisor alerts

Agents and supervisors can use the official Chatwoot mobile apps to receive push notifications when a conversation is handed off from the AI.

### 1. Agent login

- Install the Chatwoot app from the [App Store](https://apps.apple.com/us/app/chatwoot/id1495796682) or [Google Play](https://play.google.com/store/apps/details?id=com.chatwoot.app).
- Log in with your self-hosted Chatwoot URL: `https://inbox.thereplyte.com`.
- Use the agent email and password created by the dashboard **Agents** page or the `POST /api/agents` endpoint.

### 2. Push notifications

Push notifications require a Firebase Cloud Messaging (FCM) or Apple Push Notification Service (APNS) configuration in Chatwoot:

1. Open Chatwoot as an admin: `https://inbox.thereplyte.com/app/accounts/{account_id}/settings/integrations/mobile_apps`.
2. Add your FCM server key (Android) or upload APNS certificates (iOS).
3. Restart the Chatwoot Rails worker to pick up the new credentials.

> **Local dev limitation:** Push notifications cannot be tested from `localhost`. Use a real domain, SSL, and a mobile device for end-to-end notification verification.

### 3. Automation rules

Create rules in Chatwoot so human agents are alerted automatically:

1. Go to **Settings → Automation** in the Chatwoot account.
2. Create a rule:
   - **Event:** Conversation created
   - **Condition:** Label contains `ai-handoff`
   - **Action:** Assign to team / Send email / Send push notification
3. Add a second rule for urgent handoffs:
   - **Condition:** Label contains `urgent`
   - **Action:** Assign to senior agent or send Slack/webhook alert

The AI applies the `ai-handoff` label on every human handoff and adds `urgent` when the reason contains keywords such as *complaint*, *refund*, *missing*, *wrong*, *cancel*, or *not received*.

### 4. Supervisor dashboard

The TheReplyte dashboard at `http://localhost:3011/dashboard/analytics` (or `/dashboard/analytics` in production) shows:

- Total, active, and resolved conversations
- Human handoff count and today’s volume
- Top handoff reasons
- Daily conversation volume

Use this page to spot trends and tune handoff keywords or AI prompts.

## Next steps to go live

1. Replace `KIMI_API_KEY` with real key
2. Add real Meta phone number ID and token for each client
3. Test with one client
4. Set up agent accounts
5. Add custom domain in Traefik labels
6. Add n8n workflows for Slack/email alerts (optional)
