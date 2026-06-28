# AI & Automation Setup Guide

This guide explains how to connect the CloudIT event system, AI module, and WhatsApp integration once you are ready to move from placeholders to live providers.

## Table of Contents

1. [n8n Workflows](#n8n-workflows)
2. [AI Provider](#ai-provider)
3. [WhatsApp Business API](#whatsapp-business-api)
4. [Security Notes](#security-notes)

---

## n8n Workflows

Example workflows are stored in `infra/n8n/workflows/`.

### Available Workflows

- `booking-notification.json` — triggered by `booking.created` events.
- `checkin-reminder.json` — daily cron that queries today's check-ins and sends reminders.

### Importing Workflows

1. Open your n8n instance (e.g. `https://n8n.cloudit.lk`).
2. Navigate to **Workflows** → **Import from File**.
3. Select a workflow JSON file from `infra/n8n/workflows/`.
4. Configure the required node credentials (Email, Google Sheets, HTTP Request).
5. Save and activate the workflow.

### Configuring CloudIT to Send Events

Set the webhook URL and secret in `apps/platform-api/.env`:

```bash
N8N_WEBHOOK_URL=https://n8n.cloudit.lk/webhook/cloudit-events
N8N_WEBHOOK_SECRET=your-secure-random-secret
```

CloudIT will sign every webhook payload with HMAC-SHA256 and include the digest in the `X-CloudIT-Signature` header. Verify it in n8n before processing the event.

### Webhook Payload Shape

```json
{
  "event": "booking.created",
  "timestamp": "2026-06-28T09:00:00.000Z",
  "data": {
    "reservationId": "...",
    "reservationNumber": "...",
    "guestName": "...",
    "propertyId": "...",
    "totalAmount": 15000
  }
}
```

---

## AI Provider

The AI module lives in `apps/platform-api/src/ai/`. It currently returns placeholder responses so the API contract can be built before a real provider is connected.

### Supported Providers

Set `AI_PROVIDER` in `.env`:

- `openai`
- `anthropic`
- `local` (for self-hosted models)

```bash
AI_PROVIDER=openai
AI_API_KEY=sk-...
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/generate` | Generate a response from a prompt |
| POST | `/api/ai/summarize` | Summarize provided text |
| POST | `/api/ai/sentiment` | Analyze sentiment of provided text |

### Replacing Placeholders

Open `apps/platform-api/src/ai/ai.service.ts` and replace the placeholder return values with real calls to the chosen provider's SDK (e.g. `openai` or `@anthropic-ai/sdk`). Keep the same method signatures so controllers do not need to change.

---

## WhatsApp Business API

The WhatsApp integration lives in `apps/platform-api/src/integrations/`. It currently logs actions to the console.

### Configuration

Add to `apps/platform-api/.env`:

```bash
WHATSAPP_API_KEY=your-whatsapp-api-key
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-webhook-verify-token
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/whatsapp/webhook` | Meta webhook verification endpoint |
| POST | `/api/whatsapp/webhook` | Receives inbound WhatsApp events |
| POST | `/api/whatsapp/send-message` | Send a free-form message placeholder |
| POST | `/api/whatsapp/send-template` | Send a template message placeholder |

### Meta Webhook Setup

1. In the Meta Developer dashboard, set the webhook URL to `https://api.cloudit.lk/api/whatsapp/webhook`.
2. Set the verify token to the value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
3. Meta will call `GET /api/whatsapp/webhook` with `hub.mode=subscribe`, `hub.verify_token`, and `hub.challenge`.
4. The CloudIT controller validates the token and returns the challenge.
5. Subscribe to `messages` webhook fields.

### Replacing Placeholders

Open `apps/platform-api/src/integrations/whatsapp.service.ts` and replace the `logger.log` calls with HTTP requests to the WhatsApp Business API:

```
POST https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages
Authorization: Bearer {WHATSAPP_API_KEY}
```

Use the official Meta endpoints and message templates for production.

---

## Security Notes

- Keep `N8N_WEBHOOK_SECRET`, `AI_API_KEY`, and `WHATSAPP_API_KEY` out of source control.
- Use the `.env.example` files as templates; never commit real secrets.
- Verify webhook signatures before acting on n8n or WhatsApp payloads.
- Restrict the AI and WhatsApp endpoints with authentication in production if they are exposed publicly.
