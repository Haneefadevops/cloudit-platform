# Task: Social comments — ingestion + moderation API (spec 5a)

Phase: 5 | App: `apps/whatsapp-agent-api`

## Goal

First slice of the comment → DM → lead pipeline: capture Facebook Page and
Instagram comments from Meta webhooks, store them as a moderation queue, and
expose dashboard APIs to reply publicly or dismiss/hide.

Meta delivers comment webhooks to the SAME callback URL as WhatsApp
(`/api/webhooks/whatsapp`), but with `object: "page"` (Facebook) or
`object: "instagram"` instead of `"whatsapp_business_account"`. The POST
handler branches on `payload.object`.

This task: schema + ingestion + moderation API + tests. AI draft generation is
task 5b (not yours). Dashboard UI is task 5c (not yours).

## Context (read these, nothing else)

- `docs/CODEX_PLAYBOOK.md` — workflow and rules (read first, always)
- `apps/whatsapp-agent-api/src/whatsapp/whatsapp.controller.ts` — the webhook
  entry you'll branch in (POST receives `payload.object`)
- `apps/whatsapp-agent-api/src/canned-responses/` — module shape to copy
  (guards, `:clientId` scoping)
- `apps/whatsapp-agent-api/src/chatwoot/chatwoot.service.ts` — see how plain
  `fetch` HTTP calls are done in this codebase (`request` helper style)
- `apps/whatsapp-agent-api/prisma/schema.prisma` — `Client` model
- Existing hand-written migrations for format (`migrate dev` is blocked by the
  pgvector shadow-DB issue — hand-write, as before)

## Webhook payload shapes (Meta)

Facebook Page (`object: "page"`), change `field: "feed"`:
```json
{ "entry": [{ "id": "<PAGE_ID>", "changes": [{
  "field": "feed",
  "value": { "item": "comment", "verb": "add", "comment_id": "...", "post_id": "...",
             "from": { "id": "...", "name": "..." }, "message": "..." } }] }] }
```
Instagram (`object: "instagram"`), change `field: "comments"`:
```json
{ "entry": [{ "id": "<IG_ACCOUNT_ID>", "changes": [{
  "field": "comments",
  "value": { "id": "<COMMENT_ID>", "text": "...",
             "from": { "id": "...", "username": "..." }, "media": { "id": "..." } } }] }] }
```
Parse defensively: missing fields → skip that change, never throw.

## Files to create / modify

### Schema
- MODIFY: `prisma/schema.prisma`
  - `Client`: add `facebookPageId String?`, `facebookPageAccessToken String?`,
    `instagramAccountId String?`
  - New model:
    ```prisma
    model SocialComment {
      id          String    @id @default(uuid())
      channel     String    // facebook | instagram
      externalId  String    // Meta comment id
      postId      String?
      authorName  String?
      authorId    String?
      text        String
      status      String    @default("pending") // pending | replied | dismissed | hidden
      aiDraft     String?
      replyText   String?
      repliedAt   DateTime?
      clientId    String
      client      Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
      createdAt   DateTime  @default(now())
      updatedAt   DateTime  @updatedAt
      @@unique([clientId, externalId])
      @@map("social_comments")
    }
    ```
- CREATE: hand-written migration `<timestamp>_add_social_comments/migration.sql`
  + `npm run db:generate`.

### Module `src/social-comments/` (copy canned-responses shape)
- `social-comments.module.ts` (register in `app.module.ts`)
- `social-comments.service.ts`:
  - `ingest(payload)` — handle `object: "page"` and `object: "instagram"`:
    - resolve client: `facebookPageId === entry.id` → channel facebook;
      `instagramAccountId === entry.id` → channel instagram; no match → skip
    - Facebook: only `value.item === "comment"` and `value.verb === "add"`;
      skip comments authored by the page itself (`from.id === entry.id`)
    - Instagram: skip comments authored by the account itself
      (`from.id === entry.id`)
    - dedupe: `@@unique([clientId, externalId])` — use upsert/create-ignore so
      Meta's retries never create duplicates; existing row → leave untouched
    - store `postId` from `post_id` / `media.id`
  - `findAll(clientId, status?)` — newest first, include nothing extra
  - `reply(clientId, id, text)` — post the public reply via Graph API, then
    mark `status: 'replied'`, `replyText`, `repliedAt`:
    - facebook: `POST https://graph.facebook.com/v18.0/{externalId}/comments`
      body `{ message: text }`, auth with `client.facebookPageAccessToken`
    - instagram: `POST https://graph.facebook.com/v18.0/{externalId}/replies`
      body `{ message: text }`, auth with `client.facebookPageAccessToken`
      (the page token of the linked page)
    - Graph error → throw BadRequest with Meta's error message; do NOT mark replied
  - `dismiss(clientId, id)` — local only, `status: 'dismissed'`
  - `hide(clientId, id)` — facebook only:
    `POST /v18.0/{externalId}?is_hidden=true`, then `status: 'hidden'`;
    instagram → BadRequest('not supported')
  - all methods scoped by clientId; wrong-client id → NotFound
- `social-comments.controller.ts` — `@Controller('social-comments')`,
  `@UseGuards(JwtAuthGuard, AdminGuard)`:
  - `GET :clientId?status=`
  - `POST :clientId/:id/reply` — body `{ text: string }` (DTO, IsString, not empty)
  - `POST :clientId/:id/dismiss`
  - `POST :clientId/:id/hide`
- `social-comments.service.spec.ts`:
  - page payload → stored with channel facebook, correct client resolution
  - instagram payload → channel instagram
  - page's own comment ignored; non-comment feed items ignored
  - duplicate delivery → single row, untouched
  - unknown page id → nothing stored
  - reply marks replied on Graph success; Graph failure → error + still pending
    (mock fetch)

### Webhook wiring
- MODIFY: `src/whatsapp/whatsapp.controller.ts` — in `receiveWebhook`, BEFORE the
  WhatsApp handling: if `payload?.object === 'page' || payload?.object === 'instagram'`
  → `await this.socialCommentsService.ingest(payload)` and return `{ status: 'ok' }`.
  Signature verification stays as-is (same app secret).
  Inject via the module system: import `SocialCommentsModule` into
  `WhatsAppModule` (no circularity — social-comments must NOT import whatsapp).

## Do NOT

- No AI draft generation (5b). `aiDraft` stays null for now.
- No UI (5c). No changes to the dashboard app.
- Do not touch `whatsapp.service.ts` or the WhatsApp message flow.
- No new dependencies (use global `fetch`, as the codebase already does).
- No private-reply (DM) API in this task.

## Acceptance criteria

- [ ] Schema + hand-written migration match this spec; `db:generate` passes.
- [ ] Both payload shapes ingest correctly with dedupe and self-comment guards.
- [ ] Reply/hide/dismiss endpoints work and are client-scoped.
- [ ] `npm run build` passes, `npm run test` passes — paste real output.

## Report back

- Files created/modified (full list)
- Migration: hand-written confirmation
- Verbatim build / test output
- Any deviation from this spec, with the reason
