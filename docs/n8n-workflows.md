# n8n Workflows

This document describes the example n8n workflows provided for CloudIT event-driven automation.

## Workflow Files

Workflow exports are stored in `infra/n8n/workflows/`.

### 1. Booking Notification (`booking-notification.json`)

**Trigger:** Webhook node listening on `POST /webhook/cloudit-events` for `booking.created` events.

**Actions:**
- **Send Email** — sends a booking confirmation email placeholder to the guest.
- **Log to Google Sheets** — appends a placeholder row to a configured Google Sheet.

**Required environment variables in n8n:**
- `GOOGLE_SHEET_ID` — Google Sheet ID for booking logs.

**Setup steps:**
1. Import `booking-notification.json` into n8n.
2. Open the **CloudIT Webhook** node and copy the production webhook URL.
3. Paste the URL into CloudIT **Integrations** settings as the n8n webhook URL.
4. Configure email and Google Sheets credentials.
5. Activate the workflow.

---

### 2. Check-in Reminder (`checkin-reminder.json`)

**Trigger:** Schedule Trigger that runs daily at 9:00 AM.

**Actions:**
- **Get Today's Check-ins** — calls the hospitality API for reservations checking in today.
- **Send WhatsApp Reminder** — sends a placeholder WhatsApp message via an HTTP Request node.

**Required environment variables in n8n:**
- `HOSPITALITY_API_URL` — base URL of the hospitality API.
- `WHATSAPP_API_URL` — URL of the WhatsApp Business API gateway.
- `WHATSAPP_API_KEY` — API key for the gateway.

**Setup steps:**
1. Import `checkin-reminder.json` into n8n.
2. Configure the HTTP Request node credentials.
3. Activate the workflow.

---

## Webhook Security

CloudIT signs outbound webhooks with HMAC-SHA256. The signature is sent in the `X-CloudIT-Signature` header. To verify in n8n:

1. Add a Function node after the Webhook node.
2. Compare the header value with an HMAC-SHA256 digest of the request body, using the secret configured in CloudIT.
3. Abort the workflow if the signature does not match.

Example pseudo-code:

```js
const crypto = require('crypto');
const secret = $env.N8N_WEBHOOK_SECRET;
const signature = $headers['x-cloudit-signature'];
const expected = crypto.createHmac('sha256', secret).update(JSON.stringify($json)).digest('hex');
return { verified: signature === expected };
```

## Payload Reference

All CloudIT webhook payloads share the same envelope:

```json
{
  "event": "booking.created",
  "timestamp": "2026-06-28T09:00:00.000Z",
  "data": { ... }
}
```

See `docs/ai-automation-setup.md` for AI and WhatsApp configuration details.
