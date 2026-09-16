# CloudIT Operations Web

Phase 2 foundation for the private portal at `operations.cloudit.lk`.

This workspace provides the private responsive operations portal,
single-owner authentication, protected server-rendered evidence pages, secure
session/logout behavior, login rate limiting, security headers, and a
non-sensitive health endpoint. All operations data is loaded server-to-server
from `platform-api`; provider credentials and private object references never
enter browser bundles or JSON responses.

Sign-in is rate limited: after five failed attempts from one client address
within ten minutes, further attempts from that address are refused until the
window expires. Successful sign-in clears the counter.

TOTP MFA is implemented but deferred by owner decision: the portal initially
runs password-only with `OPERATIONS_MFA_REQUIRED=false`. TOTP must be enabled
no later than before the Phase 10 report actions are exposed.

## Required environment

Copy `.env.example` to `.env` and replace all placeholders. Real values must not
be committed. The health endpoint returns 503 while secure runtime configuration
is invalid.

`OPERATIONS_PUBLIC_ORIGIN` is the trusted absolute redirect origin. Production
uses `https://operations.cloudit.lk`; arbitrary request Host headers are never
used for successful authentication redirects.

The password hash format is `scrypt.<salt hex>.<64-byte key hex>` using Node.js
scrypt parameters N=16384, r=8 and p=1. Dot separators are used because `$` is
mangled by the env_file interpolation of some Docker Compose versions.
Provision the hash through an approved secret-management workflow; never place
the plain password in a command, source file or GitHub variable.

Production requires a base32 TOTP secret when `OPERATIONS_MFA_REQUIRED=true`.
The owner has deferred TOTP for the initial Phase 2 rollout, so production
initially runs with `OPERATIONS_MFA_REQUIRED=false` and no TOTP secret. TOTP
must be enabled no later than before Phase 10 report actions are enabled.
Session TTL must be between 15 minutes and 12 hours; the approved initial value
is 8 hours (28800 seconds).

Phase 9 PDF preview/download additionally requires the three server-only
`OPERATIONS_REPORT_PDF_RELAY_*` values in `.env.example`. Production accepts
HTTPS or the private `http://n8n:5678` Docker-network endpoint. The token authenticates the n8n webhook and the HMAC secret must
match the protected value in n8n and `platform-api`. When any value is absent or
invalid, the Report Centre fails closed and renders no PDF links.

## Report actions (Phase 10)

Guarded report actions (approve & send, reject, retry send) render only when
`OPERATIONS_MFA_REQUIRED=true`; while it is `false` the action routes fail
closed with `rejected_mfa` and the portal shows a lock notice. Actions are
same-origin POST-only: the command route enforces, in order, session auth, the
MFA config gate, a per-session+IP rate limit (10 attempts per 10 minutes), a
strict `Origin` check against `OPERATIONS_PUBLIC_ORIGIN`, a per-render HMAC
CSRF token, and step-up TOTP on every action. The request body is bounded to
8 KB and accepts only `commandType`, `requestKey`, `actionNonce`, `csrfToken`,
`totpCode` and an optional 300-character reject reason — never row versions,
states, recipients or actor identity. Idempotency: each render precomputes
HMAC-derived `requestKey` values, so a double-click submits an identical key
and the API answers `alreadyRecorded` instead of creating a second command.
The UI and all responses expose safe states only.

## Local checks

```bash
npm run typecheck --workspace=@cloudit/operations-web
npm run lint --workspace=@cloudit/operations-web
npm run build --workspace=@cloudit/operations-web
```

Phase 3 will separately provision the `operations` database and a dedicated
least-privilege role in the existing private PostgreSQL service.
