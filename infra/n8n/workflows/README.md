# n8n Workflows

This folder contains example n8n workflows for CloudIT event-driven automation.

## Workflows

### `booking-notification.json`

Triggered by the CloudIT webhook whenever a `booking.created` event is emitted.

**Flow:**
1. **Webhook node** listens on `POST /webhook/cloudit-events`.
2. **Send Email** node sends a booking confirmation email placeholder.
3. **Google Sheets** node appends a placeholder log row.

**Required environment variables in n8n:**
- `GOOGLE_SHEET_ID` — ID of the Google Sheet to log bookings.

### `checkin-reminder.json`

Runs daily at 9:00 AM to remind guests checking in today.

**Flow:**
1. **Schedule Trigger** fires every day at 9 AM.
2. **HTTP Request** queries the hospitality API for today's confirmed reservations.
3. **HTTP Request** sends a WhatsApp message placeholder for each guest.

**Required environment variables in n8n:**
- `HOSPITALITY_API_URL` — e.g. `https://hospitality.cloudit.lk`
- `WHATSAPP_API_URL` — URL of your WhatsApp Business API gateway
- `WHATSAPP_API_KEY` — API key for the WhatsApp gateway

## Importing into n8n

1. Open your n8n instance.
2. Go to **Workflows** → **Import from File** (or **Import from URL**).
3. Select the `.json` file you want to import.
4. Configure credentials for the email, Google Sheets, and HTTP Request nodes.
5. Activate the workflow and copy the webhook URL into `N8N_WEBHOOK_URL` in CloudIT.

## Webhook Security

CloudIT signs outbound webhooks with HMAC-SHA256 using `N8N_WEBHOOK_SECRET`. You can verify the signature in n8n using the `X-CloudIT-Signature` header.
