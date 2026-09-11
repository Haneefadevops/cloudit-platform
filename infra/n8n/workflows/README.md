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

### `cloudit-publish-operations-evidence.json`

Reusable sub-workflow for the CloudIT Operations Portal (Phase 4). Existing
workflows call it with normalized, sanitized evidence records; it signs and
publishes them to the private operations ingestion endpoint
(`operations-ingest:3020` on the Docker network — no public route).

**Flow:**
1. **When Executed by Another Workflow** receives `records` (array of Phase 0
   section 7 envelopes) and optionally `publisherKey`.
2. **Prepare Request** validates batch limits (500 records / 1 MiB) and
   builds the canonical request pieces (body, timestamp, nonce, SHA-256 body
   digest).
3. **Sign Request** computes the HMAC-SHA256 transport signature
   (`timestamp.nonce.digest`) via n8n's Crypto node. The secret comes from
   the **Operations Publisher Signing** n8n credential — never from `$env`,
   because task-runner sandboxes and workflow expressions cannot reliably
   read container env vars on all n8n builds.
4. **Publish To Operations Ingest** POSTs the raw JSON body (exact bytes —
   the signature covers them) with the signed headers.
5. **Assert Accepted** throws on any rejection so the caller's error handling
   fires.

**Required n8n credential:**
- Create a **Crypto** credential named exactly `Operations Publisher Signing`
  whose **Hmac Secret** equals `OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N`
  from the protected server env file. If the credential field offers
  "Take from environment variable", select that variable so the secret is
  never typed or stored in the workflow.

**Caller wiring (the Execute Workflow node in the calling workflow):**
- `records` = `={{ $json.records }}` (from the caller's Build Evidence node)
- `publisherKey` = `={{ $json.publisherKey }}` (optional)

**Required environment variables in n8n (protected server env file):**
- `OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N` — must equal the value
  provisioned in `infra/postgres/.env` (stored salted-hashed in the
  operations database and used by the operations-ingest service).
- `OPERATIONS_INGEST_URL` — optional; defaults to `http://operations-ingest:3020`.

**Required n8n service configuration:**
- `NODE_FUNCTION_ALLOW_BUILTIN=crypto` — the "Build Signed Request" Code node
  uses Node's built-in `crypto` module, which n8n disallows by default.
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` — the calling workflow's Execute
  Workflow node resolves the `publisherSecret` input via `$env`, which n8n
  blocks by default.
Both are set in `infra/n8n/docker-compose.yml`; after changing them the n8n
container must be recreated (`docker compose up -d` recreates it).

The endpoint never receives secrets in the body; forbidden fields (tokens,
stack traces, request/response bodies, customer data) must be stripped by the
caller before invoking this sub-workflow, per Phase 0 section 7.5.

## Importing into n8n

1. Open your n8n instance.
2. Go to **Workflows** → **Import from File** (or **Import from URL**).
3. Select the `.json` file you want to import.
4. Configure credentials for the email, Google Sheets, and HTTP Request nodes.
5. Activate the workflow and copy the webhook URL into `N8N_WEBHOOK_URL` in CloudIT.

## Webhook Security

CloudIT signs outbound webhooks with HMAC-SHA256 using `N8N_WEBHOOK_SECRET`. You can verify the signature in n8n using the `X-CloudIT-Signature` header.
