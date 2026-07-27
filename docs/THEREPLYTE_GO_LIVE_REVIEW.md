# TheReplyte Go-Live Review (2026-07-25)

Final readiness review before go-live. Two real flaws found (fix plan
below), plus an ops checklist that must be verified on the server —
no code change needed for those.

## Verdict

The product works end-to-end (all phases verified in production). Two
gaps should be addressed — one security, one functional. Neither blocks
a soft go-live with friendly first clients, but both should be fixed
before wider rollout.

---

## FLAW 1 (security) — WhatsApp webhook accepts unsigned payloads

**Evidence:** `apps/whatsapp-agent-api/src/whatsapp/whatsapp.controller.ts:59-60`
— Meta signature verification is commented out:

```ts
// Optional: verify Meta signature for security
// this.whatsappService.verifySignature(rawBody, signature);
```

**Risk:** anyone who discovers `https://api.thereplyte.com/api/webhooks/whatsapp`
can POST fabricated WhatsApp messages — fake customer conversations that
consume AI credits, spam client Chatwoot inboxes, or inject content into
the AI pipeline. The endpoint also updates client webhook status, so
attackers could manipulate status indicators.

**Fix (small, do first):**
1. Implement `verifySignature` in WhatsAppService: compute
   `crypto.createHmac('sha256', META_APP_SECRET).update(rawBody)` and
   compare (timing-safe) with the `x-hub-signature-256` header
   (`sha256=...` format).
2. Reject with 401 when missing/invalid. `RawBody` is already injected in
   the controller — the wiring exists.
3. Add `META_APP_SECRET` to `.env.example` and the server `.env`
   (Meta App → Settings → Basic → App Secret).
4. Unit test: valid signature passes, invalid/missing rejected.
5. Note: the POST handler must keep returning 200 quickly to Meta for
   valid payloads (Meta retries otherwise) — only reject on bad
   signature.

## FLAW 2 (functional) — business-initiated messages fail outside the 24-hour window

**Evidence:** `whatsapp-sender.service.ts` sends only free-form session
messages (no template support — grep confirms no template handling).

**Risk:** Meta only allows free-form messages within 24h of the
customer's last message. Outside that window the send is REJECTED
(Meta error 131047). Affected features:
- **Booking reminders** (Phase 3) — the classic case: customer books
  today, reminder fires tomorrow → window closed → reminder never
  arrives. This is a headline feature silently failing.
- **Order status notifications** ("on the way") when the conversation
  has gone quiet >24h.
- **Booking confirmations** for bookings approved >24h after the chat.
- **CSAT requests** after late resolves.
- **Staff top-up alerts** to staff numbers that haven't messaged the bot
  recently (already observed during Phase 7.5 testing).

**Fix (medium — Phase 8: Template Messages):**
1. In Meta WhatsApp Manager, create and get approved 3–4 utility
   templates (per WABA), e.g.:
   - `booking_reminder`: "Reminder: your {{1}} with {{2}} is on {{3}}.
     Reply R to reschedule or C to cancel."
   - `order_update`: "Update on your order {{1}}: {{2}}"
   - `booking_confirmed`: "Confirmed: {{1}} on {{2}}. See you then!"
   - `general_followup`: "Hello {{1}}, this is {{2}}. Update on your
     recent request: {{3}}. If you have any questions, just reply to this
     message and our team will help you."
     (Meta category rules: Utility must reference an existing order or
     account — generic "we're here to help" bodies get forced to
     Marketing. Also: no short bodies with many variables, and never end
     the body with a variable.)
   Template approval typically takes minutes–48h.
2. Add `sendTemplate()` to WhatsAppSenderService (Meta `type: "template"`
   payload with language + components/parameters).
3. Add a per-client/per-type template-name mapping (env or client fields,
   e.g. `TEMPLATE_BOOKING_REMINDER`).
4. Sender logic: try free-form first; on Meta 24h-window error (or when
   the message is scheduled/business-initiated like reminders), fall back
   to the template. Keep free-form for in-window (cheaper: service
   conversations vs utility template pricing).
5. Unit test the fallback selection logic.

---

## OPS CHECKLIST (verify on the server before go-live — no code changes)

- [ ] **JWT_SECRET** on the server `.env` is a long random string, not the
      `.env.example` placeholder (`change_this_to_a_long_random_string`).
- [ ] **Seed admin password** — the seed creates `admin@thereplyte.com /
      admin123` unless SEED_ADMIN_EMAIL/PASSWORD were set at first boot.
      Log in and CHANGE the admin password now (or set the seed envs and
      rotate). This is the master key to the whole dashboard.
- [ ] **Database backups** — Postgres runs in a container; verify
      `infra/backups` (or a cron/pg_dump job) is actually producing dumps
      and where they are stored. Test that a dump file exists from the
      last 24h.
- [ ] **Uptime monitoring** — Uptime Kuma is running; confirm it watches
      `api.thereplyte.com/api/health`, `app.thereplyte.com`,
      `inbox.thereplyte.com`, and `thereplyte.com`, with alerts to
      WhatsApp/email.
- [ ] **META_VERIFY_TOKEN / TOPUP_BANK_DETAILS / STAFF_ALERT_WHATSAPP /
      CHATWOOT_DATABASE_URL / API_PUBLIC_URL** — all present in the server
      `.env` (some confirmed during Phase 7.5; re-verify after the
      webhook-signature fix adds META_APP_SECRET).
- [ ] **Container restart policy** — all containers `restart:
      unless-stopped` (confirmed in compose) so a server reboot doesn't
      take the product down.
- [ ] **Disk space** — `df -h` on the server; Docker images + logs grow
      (log rotation is configured in compose; verify free space > 20%).

## MEDIUM (schedule soon after go-live — not blockers)

1. **Rate limiting on `/auth/login`** — no throttling exists (grep
   confirms). Add @nestjs/throttler (note: npm install is broken on this
   monorepo — implement a small in-memory limiter middleware instead, or
   fix the lockfile first).
2. **Frontend 401 handling** — expired JWT shows empty pages instead of
   redirecting to /login (hit during Phase 6 testing). Add a fetch
   wrapper: on 401 → clear token → redirect to login.
3. **npm lockfile repair** — `npm install` crashes (npm 11 arborist).
   Regenerate `package-lock.json` cleanly when convenient; future
   features (payments, etc.) will need new packages.

## Fix order for the session

1. Flaw 1 (webhook signature) — small, do first, deploy.
2. Ops checklist — user verifies on server (no code).
3. Flaw 2 (templates) — start Meta template approval (takes time), then
   implement sender fallback; deploy.
4. Medium items in order 3 → 1 → 2 as time allows.
