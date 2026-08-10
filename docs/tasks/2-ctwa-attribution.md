# Task: CTWA (click-to-WhatsApp) ad attribution

Phase: 2 | App: `apps/whatsapp-agent-api`

## Goal

When a customer's message arrives because they clicked a click-to-WhatsApp ad, Meta
includes a `referral` object in the webhook message payload. Today we discard it.
After this task, we store it: the customer is marked as ad-sourced, and the raw
referral payload is saved on the conversation it started — giving clients
"lead source tracking" without any manual work.

## Context (read these, nothing else)

- `docs/CODEX_PLAYBOOK.md` — workflow and rules (read first, always)
- `apps/whatsapp-agent-api/prisma/schema.prisma` — models `Customer` (~line 104) and
  `Conversation` (~line 143)
- `apps/whatsapp-agent-api/src/whatsapp/whatsapp.service.ts` — `MetaMessage`
  interface (~line 34), `handleIncomingWebhook` (~line 120), `handleIncomingMessage`
  (~line 184). Note: `handleIncomingMessage` currently receives no referral data.
- `apps/whatsapp-agent-api/src/customers/customers.service.ts` — `findOrCreate`
- `apps/whatsapp-agent-api/src/conversations/conversations.service.ts` — `create`
- An existing `*.spec.ts` file for test style

## Background: the Meta payload

For CTWA ad clicks, each webhook message contains:

```json
"referral": {
  "source_url": "...",
  "source_id": "<ad id>",
  "source_type": "ad",
  "headline": "...",
  "body": "...",
  "media_type": "image|video",
  "image_url": "...", "video_url": "...", "thumbnail_url": "...",
  "ctwa_clid": "..."
}
```

Non-ad messages simply have no `referral` field.

## Files to create / modify

- MODIFY: `prisma/schema.prisma`
  - `Customer`: add `leadSource String?` (null = unknown/organic; `'ctwa_ad'` = came via ad)
  - `Conversation`: add `referral Json?` (raw referral payload, stored verbatim)
- MODIFY: `src/whatsapp/whatsapp.service.ts`
  - `MetaMessage`: add optional `referral?: Record<string, unknown>`
  - `handleIncomingWebhook`: pass `message.referral` through both the text and media
    branches into `handleIncomingMessage`
  - `handleIncomingMessage`: accept `referral?: Record<string, unknown>` in `input`;
    forward it to customer creation and conversation creation (see Contracts)
- MODIFY: `src/customers/customers.service.ts`
  - `findOrCreate`: accept optional `leadSource?: string`; apply it ONLY when creating
    a new customer. Never overwrite `leadSource` on an existing customer.
- MODIFY: `src/conversations/conversations.service.ts`
  - `create`: accept optional `referral?: Prisma.InputJsonValue`; store it on the
    new conversation row.
- CREATE: `src/whatsapp/whatsapp-referral.spec.ts`
  - unit tests for the referral handling (see Acceptance criteria)
- CREATE: migration via `npm run db:migrate -- --name add-lead-source-attribution`
  followed by `npm run db:generate`

## Contracts

- In `handleIncomingMessage`, when `input.referral` is present:
  - pass `leadSource: 'ctwa_ad'` into `customersService.findOrCreate`
    (it takes effect only if the customer is newly created)
  - when a NEW conversation is created in that call, pass the referral object as
    `referral`. Do not update existing conversations.
- Behavior with no `referral` must be byte-for-byte identical to today.
- The referral must not interfere with CSAT handling, media handling, or welcome
  message logic — it is stored, nothing else.

## Do NOT

- Do not touch `handleCsatResponse`, media handling, the AI flow, or the sender.
- Do not add any analytics endpoint or UI — capture only; surfacing comes later.
- Do not add dependencies or env vars.
- Do not reformat or refactor any existing code beyond the listed changes.

## Acceptance criteria

- [ ] Schema has `Customer.leadSource` and `Conversation.referral`; migration created
      with the exact name above; `npm run db:generate` succeeds.
- [ ] A webhook message WITH `referral` for a NEW phone number creates the customer
      with `leadSource = 'ctwa_ad'` and the conversation with `referral` stored.
- [ ] A webhook message WITH `referral` for an EXISTING customer leaves
      `leadSource` unchanged (test with an existing organic customer).
- [ ] A webhook message WITHOUT `referral` behaves exactly as before (customer and
      conversation created with null source/referral).
- [ ] `npm run build` passes, `npm run test` passes, `npm run lint` passes —
      paste real output.

## Report back

- Files created/modified (full list)
- Migration name actually created
- Verbatim output of build / test / lint
- Any deviation from this spec, with the reason
