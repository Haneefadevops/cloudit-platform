# Task: Messenger/Instagram channel model + outbound routing (spec 4a)

Phase: 3 | App: `apps/whatsapp-agent-api`

## Goal

Prepare the API for non-WhatsApp channels bridged through Chatwoot:

1. Schema: conversations and customers gain a `channel` ('whatsapp' default,
   'messenger', 'instagram'); customers gain `channelSourceId` (Meta PSID/IGSID)
   and `phoneNumber` becomes optional (Messenger/IG contacts have no phone).
2. Outbound: when a human agent replies in Chatwoot to a Messenger/IG
   conversation, the reply goes back **through Chatwoot** (which delivers it via
   the Facebook page token) instead of the WhatsApp sender.
3. Echo guard: messages the API itself posts into Chatwoot must not be
   re-processed as agent replies.

This task is model + plumbing only. The inbound pipeline (Chatwoot webhook → AI)
is a separate task (4b, not yours).

## Context (read these, nothing else)

- `docs/CODEX_PLAYBOOK.md` — workflow and rules (read first, always)
- `apps/whatsapp-agent-api/prisma/schema.prisma` — `Customer`, `Conversation`
- `apps/whatsapp-agent-api/src/customers/customers.service.ts` — `findOrCreate`
- `apps/whatsapp-agent-api/src/chatwoot/chatwoot.controller.ts` — `handleAgentReply`,
  `ChatwootMessagePayload` (~lines 6-15, 68-121)
- `apps/whatsapp-agent-api/src/chatwoot/chatwoot.service.ts` — `sendMessage`
  (posts a message into a Chatwoot conversation)
- `apps/whatsapp-agent-api/src/conversations/conversations.service.ts` — `create`
- Existing migration folders for hand-written migration format
- The `whatsapp-referral.spec.ts` / `workflow-runtime.service.spec.ts` for test style

## Files to create / modify

### Schema
- MODIFY: `prisma/schema.prisma`
  - `Customer`:
    - `phoneNumber String?` (was required — relax it)
    - add `channel String @default("whatsapp")`
    - add `channelSourceId String?`
    - keep `@@unique([clientId, phoneNumber])` unchanged (Postgres allows
      multiple NULLs); add `@@index([clientId, channel, channelSourceId])`
  - `Conversation`: add `channel String @default("whatsapp")`
- CREATE: hand-written migration
  `prisma/migrations/<timestamp>_add_channel_fields/migration.sql`
  (the pgvector shadow-DB issue blocks `migrate dev` — write the SQL by hand:
  ALTERs with defaults, the new index; follow the existing hand-written
  migration style, `IF NOT EXISTS` where sensible). Run `npm run db:generate`.

### Customer identity
- MODIFY: `src/customers/customers.service.ts` — `findOrCreate` accepts optional
  `channel?: string` and `channelSourceId?: string`:
  - `channel` absent or `'whatsapp'` → existing phone-based lookup, behavior
    byte-identical (pass `channel`/`channelSourceId` through on create)
  - any other channel → match by `{ clientId, channel, channelSourceId }`
    (findFirst); create with `phoneNumber: null` when unknown
  - never overwrite `channel`/`channelSourceId` on an existing customer
- MODIFY: `src/conversations/conversations.service.ts` — `create` accepts
  optional `channel?: string`, stored on the row (default whatsapp)

### Outbound through Chatwoot + echo guard
- MODIFY: `src/chatwoot/chatwoot.controller.ts`
  - `ChatwootMessagePayload`: add optional `sender?: { id?: number; type?: string }`
    if not already typed (keep it loose, webhook payloads vary)
  - Echo guard at the TOP of `handleAgentReply`: if the outgoing message's
    sender id equals the configured `CHATWOOT_ADMIN_USER_ID` env value
    (the identity our API posts as), log + return without processing. Read the
    env via ConfigService the same way other services do.
  - In `handleAgentReply`, after the local conversation is found:
    - `conversation.channel` is `'whatsapp'` (or null/absent) → current
      WhatsApp send path, unchanged
    - otherwise → send via `chatwootService.sendMessage` into the SAME Chatwoot
      conversation (account id from `client.chatwootAccountId`, conversation id
      from `conversation.chatwootConversationId`); do NOT call
      `WhatsAppSenderService`, do NOT append ticket refs differently — same
      stored message content
- If `chatwoot.service.ts` `sendMessage` doesn't support posting to an existing
  conversation by id with `message_type: 'outgoing'`, extend it minimally
  (check its current signature first — reuse, don't duplicate).

### Compile-error sweep
Relaxing `Customer.phoneNumber` to optional will surface TS errors at existing
call sites. Fix each with the narrowest null-guard. Rules:
- WhatsApp-only code paths (sender calls, Chatwoot contact creation in
  `forwardToChatwoot`) may assume phone exists — guard with an early
  log+return/skip, never change WhatsApp behavior.
- No behavior changes beyond that.

## Tests
- CREATE: `src/customers/customers-identity.spec.ts` (or extend the existing
  customers spec):
  - whatsapp path unchanged (phone lookup)
  - messenger path: find-or-create by `channelSourceId`, second message reuses
    the customer, no phone required
  - existing customer's `channel`/`channelSourceId` never overwritten
- CREATE/EXTEND a chatwoot controller spec:
  - agent reply in a whatsapp conversation → WhatsApp sender called (mock), Chatwoot send NOT called
  - agent reply in a messenger conversation → Chatwoot send called, WhatsApp sender NOT called
  - outgoing message whose sender id == CHATWOOT_ADMIN_USER_ID → ignored (neither sender called)

## Do NOT

- No inbound routing (that is task 4b). Do not touch `message_created` incoming handling.
- Do not touch `whatsapp.service.ts` EXCEPT compile-error null-guards from the
  `phoneNumber` relaxation.
- No infra/env file changes except reading `CHATWOOT_ADMIN_USER_ID` (already
  used by `chatwoot.service.ts`).
- No new dependencies.

## Acceptance criteria

- [ ] Schema + hand-written migration match this spec; `npm run db:generate` passes.
- [ ] `npm run build` passes with zero TS errors (the phoneNumber sweep is done).
- [ ] `npm run test` passes, including the new specs — paste real output.
- [ ] WhatsApp behavior is provably unchanged: existing test suite green and no
      whatsapp-path logic edits beyond null-guards.

## Report back

- Files created/modified (full list)
- Every call site touched for the phoneNumber relaxation, one line each
- Migration: hand-written confirmation
- Verbatim build / test output
- Any deviation from this spec, with the reason
