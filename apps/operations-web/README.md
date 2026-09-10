# CloudIT Operations Web

Phase 2 foundation for the private portal at `operations.cloudit.lk`.

This workspace currently provides the approved responsive shell, single-owner
authentication, protected server-rendered routes, secure session/logout
behavior, login rate limiting, security headers and a non-sensitive health
endpoint. It does not connect to PostgreSQL, n8n, provider APIs, Google Drive,
reports or production evidence.

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

The password hash format is `scrypt$<salt hex>$<64-byte key hex>` using Node.js
scrypt parameters N=16384, r=8 and p=1. Provision the hash through an approved
secret-management workflow; never place the plain password in a command, source
file or GitHub variable.

Production requires a base32 TOTP secret when `OPERATIONS_MFA_REQUIRED=true`.
The owner has deferred TOTP for the initial Phase 2 rollout, so production
initially runs with `OPERATIONS_MFA_REQUIRED=false` and no TOTP secret. TOTP
must be enabled no later than before Phase 10 report actions are enabled.
Session TTL must be between 15 minutes and 12 hours; the approved initial value
is 8 hours (28800 seconds).

## Local checks

```bash
npm run typecheck --workspace=@cloudit/operations-web
npm run lint --workspace=@cloudit/operations-web
npm run build --workspace=@cloudit/operations-web
```

Phase 3 will separately provision the `operations` database and a dedicated
least-privilege role in the existing private PostgreSQL service.
