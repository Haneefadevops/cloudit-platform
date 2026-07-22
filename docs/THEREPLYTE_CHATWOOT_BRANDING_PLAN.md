# TheReplyte — Chatwoot Branding Plan

Status: **implemented locally — not committed to git yet (waiting for user confirmation; landing-page work in progress in another session)**

## Goal

Make every client who logs into `inbox.thereplyte.com` see **"TheReplyte"** instead of "Chatwoot" — set automatically from our backend, with no manual super-admin work and no per-client setup.

## What we are going to build

One small feature in the API (`apps/whatsapp-agent-api`):

1. When the API starts, it connects to the Chatwoot Postgres database (using the existing `CHATWOOT_DATABASE_URL`, same as the user auto-confirm code in `chatwoot.service.ts`).
2. It writes TheReplyte branding into Chatwoot's `installation_configs` table:
   - `INSTALLATION_NAME` → `TheReplyte`
   - `BRAND_NAME` → `TheReplyte`
   - `BRAND_URL` → `https://thereplyte.com`
   - `LOGO` / `LOGO_DARK` → URL of our logo image (only if we provide one via env var)
3. It is **idempotent** — safe to run on every API start/redeploy; it just upserts the same values.
4. If `CHATWOOT_DATABASE_URL` is not set, it logs a warning and skips (same behaviour as the auto-confirm feature).

## Why this approach

- We already write directly to the Chatwoot DB for user auto-confirmation — this is the same, proven pattern.
- Branding is **instance-wide**, not per client. Set once at startup, it applies to every current and future client account automatically. Clients cannot change it (only super admins can).
- No Chatwoot code changes, no forks, no enterprise license needed for the name change.

## Files we will touch

| File | Change |
|---|---|
| `apps/whatsapp-agent-api/src/chatwoot/chatwoot.service.ts` | Add `ensureInstallationBranding()` method + run it on module init |
| `apps/whatsapp-agent-api/.env.example` | Add optional `CHATWOOT_BRAND_NAME`, `CHATWOOT_BRAND_URL`, `CHATWOOT_BRAND_LOGO_URL` with defaults documented |
| `docs/THEREPLYTE_README.md` | One line in the env list + a short "Chatwoot branding" note |

Nothing else. No landing-page files, no other apps.

## Technical detail (the one tricky part)

`installation_configs` stores values in a `serialized_value` column as Ruby YAML, e.g. `---\n:value: TheReplyte\n`. During implementation we will:

1. First **read** an existing row (e.g. `INSTALLATION_NAME` if present, or `INSTALLATION_IDENTIFIER`) to confirm the exact YAML format used by our Chatwoot version.
2. Write rows in that exact format via upsert (`INSERT ... ON CONFLICT (name) DO UPDATE`).
3. Keep the `locked` flag `false` so the values can still be edited from the super-admin console later if ever needed.

## Deployment steps (after code is merged)

1. `cd infra/whatsapp-agent-api && docker compose up -d --build --force-recreate` (env changes require force-recreate).
2. Check API logs for `Applied TheReplyte branding to Chatwoot installation config`.
3. Restart Chatwoot once so it drops its cached config: `docker restart chatwoot-rails chatwoot-sidekiq` (only needed the first time; values are cached by Chatwoot's `GlobalConfig`).
4. Verify: open `https://inbox.thereplyte.com` in an incognito window — browser tab title and app name should say **TheReplyte**.

## Known limitations (accepted)

- The small **"Powered by Chatwoot"** footer in the agent UI is an Enterprise-license feature to remove — we keep it (license-safe).
- The custom **logo in the Chatwoot dashboard UI** may only render on Enterprise plans in some versions; we set the config anyway (it is harmless), and verification step 4 will show us whether it displays. The **name change is not gated** and is the main goal.
- The page favicon is a static Chatwoot asset — out of scope for now.

## Verification checklist

- [ ] API starts without errors; branding log line appears.
- [ ] `SELECT name, serialized_value FROM installation_configs WHERE name IN ('INSTALLATION_NAME','BRAND_NAME','BRAND_URL');` shows TheReplyte values.
- [ ] Browser tab on `inbox.thereplyte.com` shows "TheReplyte".
- [ ] Existing client accounts still work (login, inboxes, webhooks unaffected).
