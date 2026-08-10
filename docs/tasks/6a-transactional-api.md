# Task: Transactional API — API keys + template send endpoint (spec 6a)

Phase: 6 | App: `apps/whatsapp-agent-api`

## Goal

Let a client's own software send WhatsApp template messages (OTP, receipts,
delivery updates) through their connected number:

```
POST /api/v1/messages
Authorization: Bearer trk_<key>
{ "to": "+94771234567", "templateName": "order_update", "parameters": ["#1042", "shipped"], "languageCode": "en" }
```

Plus admin endpoints to create/list/revoke per-client API keys.

This task: keys + guard + send endpoint + logging + tests. Dashboard UI for
key management is a later task (not yours).

## Context (read these, nothing else)

- `docs/CODEX_PLAYBOOK.md` — workflow and rules (read first, always)
- `apps/whatsapp-agent-api/src/whatsapp-sender/whatsapp-sender.service.ts` —
  `sendTemplate({ client, to, templateName, parameters?, languageCode? })`
  already exists — use it, do not reimplement Graph calls
- `apps/whatsapp-agent-api/src/auth/guards/jwt-auth.guard.ts` and
  `src/common/guards/admin.guard.ts` — guard patterns
- `apps/whatsapp-agent-api/src/canned-responses/` — module/controller shape
- `apps/whatsapp-agent-api/src/main.ts` — confirm the global route prefix
- `apps/whatsapp-agent-api/prisma/schema.prisma` — `Client` model
- Existing hand-written migrations for format (`migrate dev` is blocked by the
  pgvector shadow-DB issue — hand-write, as before)

## Design contracts

### Schema
- MODIFY: `Client` — add relation `apiKeys ApiKey[]` and
  `transactionalMessages TransactionalMessage[]`
- CREATE models:
  ```prisma
  model ApiKey {
    id         String    @id @default(uuid())
    name       String
    prefix     String    // first 12 chars of the key, for display/identification
    keyHash    String    @unique // sha256 hex of the full key — never store plaintext
    lastUsedAt DateTime?
    revokedAt  DateTime?
    clientId   String
    client     Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
    createdAt  DateTime  @default(now())
    @@map("api_keys")
  }

  model TransactionalMessage {
    id           String   @id @default(uuid())
    to           String
    templateName String
    languageCode String   @default("en")
    status       String   // sent | failed
    error        String?
    clientId     String
    client       Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
    apiKeyId     String?
    createdAt    DateTime @default(now())
    @@index([clientId, createdAt])
    @@map("transactional_messages")
  }
  ```
- CREATE: hand-written migration `<timestamp>_add_transactional_api/migration.sql`
  + `npm run db:generate`.

### Module `src/transactional/`
- `transactional.module.ts` (register in `app.module.ts`; imports
  `WhatsAppSenderModule`, `PrismaModule`, `ConfigModule`)
- `api-key.guard.ts` — `ApiKeyGuard`:
  - reads `Authorization: Bearer <key>`; missing/malformed → 401
  - only keys starting with `trk_` are considered
  - sha256-hash the presented key, look up `ApiKey` by `keyHash` where
    `revokedAt: null`; not found → 401
  - on match: attach `req.apiKey = { id, clientId }`; fire-and-forget update
    of `lastUsedAt` (never block the request on it)
- `transactional.controller.ts`:
  - `POST v1/messages` guarded by `ApiKeyGuard` (NOT JwtAuthGuard):
    - DTO: `to` (string, must match /^\+?[0-9]{8,15}$/), `templateName`
      (string, non-empty), `parameters?` (string array, max 10),
      `languageCode?` (string, default 'en') — class-validator
    - load client by `req.apiKey.clientId`; missing or `status !== 'active'`
      → 403
    - call `whatsappSenderService.sendTemplate`
    - always write a `TransactionalMessage` row: `sent` on success; on Meta
      error write `failed` with the error message and return 502 with the
      Meta message
    - success response: `{ id, status: 'sent' }`
- Key management (admin dashboard side), in the same controller file or a
  `api-keys.controller.ts` — judge by codebase shape:
  - `POST clients/:clientId/api-keys` (JwtAuthGuard + AdminGuard), body
    `{ name: string }` → generate `trk_` + 32 random hex chars (node crypto),
    store `{ name, prefix: key.slice(0, 12), keyHash }`, respond
    `{ id, name, prefix, key }` — the full key is returned ONLY here, never
    stored or shown again
  - `GET clients/:clientId/api-keys` → list `{ id, name, prefix, lastUsedAt,
    revokedAt, createdAt }` (never the hash)
  - `DELETE clients/:clientId/api-keys/:id` → set `revokedAt` (scoped by
    clientId; wrong client → 404)

### Tests
- `transactional.service.spec.ts` or controller-level specs:
  - guard: no header / garbage key / revoked key → 401; valid key passes and
    attaches clientId
  - send: success → `sendTemplate` called with the client's Meta credentials,
    row logged `sent`, response shape correct
  - send: Meta failure → row logged `failed`, 502 with the Meta message
  - send: inactive client → 403
  - keys: creation returns the full key once and stores only the hash;
    list never exposes `keyHash`; revoke is client-scoped

## Do NOT

- No rate limiting, no usage-wallet integration (log rows only; billing
  integration is a later decision).
- No UI. No new dependencies (node `crypto` only).
- Do not modify `whatsapp-sender.service.ts` — `sendTemplate` is sufficient.
- Do not change any existing controller or guard.

## Acceptance criteria

- [ ] Schema + hand-written migration match this spec; `db:generate` passes.
- [ ] All guard and endpoint behaviors above verified by specs.
- [ ] Plaintext keys never stored; full key visible only at creation.
- [ ] `npm run build` exit code 0, `npm run test` passes — paste real output.

## Report back

- Files created/modified (full list)
- Migration: hand-written confirmation
- Verbatim build / test output
- Any deviation from this spec, with the reason
