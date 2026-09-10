# CloudIT Operations Portal — Phase 2 Foundation

Status: **LOCAL ACCEPTANCE COMPLETE — awaiting owner approval of Phase 2**  
Date: 10 September 2026

## Delivered

- New `@cloudit/operations-web` Next.js workspace with standalone server output.
- Approved desktop sidebar and 390 px mobile bottom navigation/More menu.
- Server-rendered protected routes for every approved portal area.
- Environment-backed single-owner sign-in with scrypt password verification.
- Login rate limiting: five failed attempts per client address within ten
  minutes blocks further attempts from that address until the window expires;
  a successful sign-in clears the counter. Required because the initial
  rollout is password-only.
- TOTP MFA implemented with a ±30-second verification window. **TOTP is
  deferred by owner decision** and is disabled for the initial rollout with
  `OPERATIONS_MFA_REQUIRED=false`. TOTP must be enabled no later than before
  the Phase 10 report actions are exposed.
- HMAC-SHA-256 signed session token in an HTTP-only, Secure, SameSite=Strict,
  host-only cookie in production.
- Eight-hour session (28800 seconds); runtime validation constrains the TTL
  between 15 minutes and 12 hours.
- Generic authentication failures, safe same-origin return paths and a trusted
  `OPERATIONS_PUBLIC_ORIGIN` for successful redirects.
- POST logout with explicit cookie invalidation.
- Protected-route enforcement in middleware and again in the server layout.
- CSP, clickjacking, MIME sniffing, referrer, permissions, opener and HSTS
  headers.
- Non-sensitive `/api/health` readiness endpoint that returns 503 for invalid
  secure runtime configuration.
- Docker Compose service behind the existing Traefik router on
  `operations.cloudit.lk`, attached only to the private `cloudit` network.
- Read-only container root filesystem, non-root runtime, no-new-privileges and
  a restricted temporary filesystem.
- Build context excludes every `.env` at any depth, and the image build
  removes any traced `.env` from the standalone output so secrets can only
  come from the protected runtime environment.
- Existing build, deploy, health-check, rollback, start, stop and maintenance
  scripts extended for `operations-web`.
- PR checks extended with portal type checking, lint and production build.

## Explicitly not delivered in Phase 2

- No PostgreSQL connection, database, role, schema, migration, table or RLS.
- No n8n, provider, Google Drive, GitHub API or report integration.
- No DNS change, TLS issuance, deployment, push or production secret creation.
- No operational evidence or production data in the portal.
- No report approve, reject, send, regenerate, upload or delivery action.

The approved later-phase database direction is the existing private PostgreSQL
container with a separate `operations` database and dedicated least-privilege
role. That work begins only in Phase 3.

## Security review outcome (10 September 2026)

Reviewed all authentication, session, middleware, route, header, Docker and
Compose code. Findings and resolutions:

- Missing brute-force protection on password-only sign-in: resolved with the
  per-address login rate limit described above.
- Expensive scrypt verification ran before input-length validation: reordered
  so oversized inputs are rejected first.
- Build-time `.env` was traced into the standalone output and Next.js expanded
  `$` sequences in the password hash at runtime, corrupting it and baking the
  file into the image: resolved by excluding `**/.env` from the Docker build
  context and removing any traced `.env` during the image build.
- CSP retains `'unsafe-inline'` for scripts because Next.js 14 requires it
  without a nonce deployment; nonce-based CSP is a Phase 12 hardening item.
- Failed-attempt audit logging is deferred to the Phase 11 audit work; the
  rate limiter is the Phase 2 mitigation.

## Local verification

- TypeScript: passed.
- ESLint: passed without warnings.
- Next.js production build: passed and emitted standalone output.
- Health with valid runtime configuration: HTTP 200 with only status, service
  and checked-at fields.
- Health with invalid runtime configuration: HTTP 503 with the same safe
  fields; no indication of which value is missing.
- Protected route without session: 307 redirect to login with a safe
  `returnTo`.
- Invalid password or email: generic `error=invalid` redirect; no session
  created; cookie explicitly cleared.
- Valid password (MFA deferred): session created with `__Host-` cookie,
  HttpOnly, Secure, SameSite=Strict, Path=/, Max-Age=28800; session payload
  `exp - iat = 28800` with the expected subject and role.
- Valid session on protected route: HTTP 200.
- Tampered or forged-signature session: rejected and redirected to login.
- Logout: 303 redirect to the signed-out login state with cookie deletion.
- Rate limiting: sixth failure from one address throttled; throttled address
  refused even with valid credentials; a different address unaffected.
- Security headers verified on protected responses: CSP, HSTS, nosniff,
  frame denial, no-referrer, permissions policy and opener policy.
- TOTP field is hidden while `OPERATIONS_MFA_REQUIRED=false`.
- Unknown protected route: 404 with no sensitive content.
- Docker image built locally; Compose service started and reported healthy;
  container runs as the non-root `nextjs` user; root filesystem read-only;
  `/tmp` writable tmpfs; in-container health and unauthenticated redirect
  verified.
- Browser payload, response, bundle and error-page secret scan: no
  environment names, hashes or session secrets present; the owner email
  appears only in authenticated responses.
- Desktop 1440 px, 390 px mobile and 900 px implementation screenshots
  produced from the running application and matched against the approved
  Phase 1 design.
- Keyboard-only login, visible focus indicators, sidebar navigation focus,
  mobile bottom navigation, the eight-item More menu, More-menu navigation,
  44 px touch targets and absence of horizontal overflow at 390 px verified
  interactively in a real browser.

All local acceptance credentials were throwaway test values; no real password,
hash, session secret or TOTP secret was placed in source control, logs or
browser output.

## Protected environment values the owner must provision

Provision these in the server's protected environment file
(`apps/operations-web/.env` on the server, which is excluded from source
control and from the Docker build context). Real values must never be
committed, logged or shown in the browser.

- `OPERATIONS_PUBLIC_ORIGIN=https://operations.cloudit.lk`
- `OPERATIONS_OWNER_EMAIL` — the owner's sign-in email.
- `OPERATIONS_OWNER_PASSWORD_HASH` — format
  `scrypt.<salt hex>.<64-byte derived key hex>` with Node.js scrypt
  N=16384, r=8, p=1 (dot separators because `$` is mangled by some Docker
  Compose env_file versions). Generate through an approved secret-management
  channel; never type the plain password into a command, file or ticket.
- `OPERATIONS_SESSION_SECRET` — at least 32 random characters.
- `OPERATIONS_SESSION_TTL_SECONDS=28800`
- `OPERATIONS_MFA_REQUIRED=false` — TOTP deferred by owner decision; must be
  changed to `true` with a provisioned `OPERATIONS_OWNER_TOTP_SECRET` no later
  than before Phase 10 report actions are enabled.

## Production acceptance still required

- [ ] Owner provisions the production email, password hash and 32+ character
      session secret in the protected server `.env` file (TOTP secret deferred;
      see above).
- [ ] Owner confirms the eight-hour session and the deferred-TOTP policy with
      password-only login plus rate limiting for the initial rollout.
- [ ] DNS for `operations.cloudit.lk` is created or confirmed.
- [ ] Portal is deployed through the approved workflow without printing secrets.
- [ ] Traefik obtains HTTPS and HTTP redirects to HTTPS.
- [ ] Health check passes through the public HTTPS route.
- [ ] Login, logout, expiry, rate limiting and unauthorized-route behavior are
      verified in the deployed browser.
- [ ] Owner explicitly approves Phase 2 before Phase 3 begins.

Completed locally on 10 September 2026: typecheck, lint, production build,
authentication/session behavior, rate limiting, Docker image and Compose
health, desktop and 390 px screenshots, keyboard focus, mobile More
navigation, responsive behavior, and the browser/bundle/error-page secret
scan.

## Gate

Do not begin Phase 3, provision the `operations` database, or create a database
role until the production acceptance items above are completed and the owner
explicitly approves Phase 2.
