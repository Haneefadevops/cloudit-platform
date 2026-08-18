# NotchMe Rebrand Migration Plan

> Status: Local rebrand verification complete; production cutover items deferred
> Previous product name: OrbitOne
> New product name: NotchMe
> Execution order: Complete before the NotchMe product and UI reshape
> Related strategy: `docs/NOTCHME_PRODUCT_RESHAPE_PLAN.md`

> Implementation record (2026-08-18): Local verification is complete. The product-key migration now merges duplicate OrbitOne/NotchMe rows, deletes only merged duplicates, then updates remaining OrbitOne rows in place without copying primary keys. It was executed through Prisma against disposable local PostgreSQL databases `notchme_migration_test` and `notchme_migration_test_rollback` on `127.0.0.1:55432`; all data assertions and a forced-failure rollback passed. The NotchMe registry matches active API guards, and invitation fallback uses `http://localhost:3005`. Cookie, theme, URL-variable, and webhook compatibility remain temporarily until production/session and consumer audits are complete. The PostgreSQL database remains `orbitone`, and all existing SQL migration filenames/comments remain historical by design. Production domains, DNS, TLS, redirects, branded email, and live-consumer audits remain pre-launch tasks.

---

## 1. Purpose

This plan governs the controlled rename of the existing OrbitOne product to **NotchMe** across the user experience, source tree, packages, platform registry, infrastructure, domains, runtime identifiers, tests, and active documentation.

The rebrand is a mandatory prerequisite for the product reshape. Completing it first prevents new UI, onboarding, pricing, AI, and marketing work from being created with obsolete product names, assets, URLs, cookies, and deployment identifiers.

This is a rename and compatibility project. It must not include unrelated feature development or broad UI redesign.

---

## 2. Objectives

- Make NotchMe the only active public product identity.
- Rename active application and infrastructure identifiers coherently.
- Preserve database and migration integrity.
- Preserve tenant entitlements and provisioning behavior.
- Provide compatibility where persisted or external identifiers may still use OrbitOne.
- Move deployments to NotchMe domains without breaking old links.
- Establish a clean baseline for the subsequent premium UI and product reshape.

---

## 3. Non-Goals

The following are outside this migration:

- Redesigning the dashboard or navigation
- Implementing the Quiet Orbit palette beyond any minimum logo/brand token wiring required for the rename
- Rebuilding onboarding
- Renaming Customers to People
- Adding Today or My Page
- Adding AI transcription or summaries
- Implementing new pricing or billing behavior
- Refactoring unrelated backend domains
- Rewriting historical Git commits or applied SQL migration history
- Renaming the PostgreSQL database unless separately approved

Those changes belong to the product reshape after this migration is complete.

---

## 4. Approved Naming Standard

### Public brand

Always write the product name as:

> **NotchMe**

Do not use `Notchme`, `Notch Me`, `NOTCHME`, or OrbitOne in active customer-facing copy.

### Technical naming

Use lowercase kebab-case for services, folders, packages, and deployment identifiers:

```text
notchme-web
notchme-api
```

Use lowercase underscore form only where required for cookie, database, or similar identifiers:

```text
notchme_session
notchme-theme
```

Use uppercase underscore form for environment variables:

```text
NOTCHME_WEB_URL
```

---

## 5. Rename Matrix

| Area | Current | Target | Strategy |
|---|---|---|---|
| Public product | OrbitOne | NotchMe | Replace |
| Web folder | `apps/orbitone-web` | `apps/notchme-web` | Move |
| API folder | `apps/orbitone-api` | `apps/notchme-api` | Move |
| Web workspace | `@cloudit/orbitone-web` | `@cloudit/notchme-web` | Replace and regenerate lockfile |
| API workspace | `@cloudit/orbitone-api` | `@cloudit/notchme-api` | Replace and regenerate lockfile |
| Web infrastructure | `infra/orbitone-web` | `infra/notchme-web` | Move |
| API infrastructure | `infra/orbitone-api` | `infra/notchme-api` | Move |
| Web service | `orbitone-web` | `notchme-web` | Replace |
| API service | `orbitone-api` | `notchme-api` | Replace |
| Docker images | `cloudit/orbitone-*` | `cloudit/notchme-*` | Replace |
| Platform product key | `orbitone` | `notchme` | Data-aware migration |
| Session cookie | `orbitone_session` | `notchme_session` | Compatibility or planned logout |
| Theme storage | `orbitone-theme` | `notchme-theme` | One-time client migration |
| Web URL variable | `ORBITONE_WEB_URL` | `NOTCHME_WEB_URL` | Temporary fallback |
| API contracts | `orbitone.v2.ts` | `notchme.v2.ts` | Rename and update imports |
| Prisma client | `@prisma/client-orbitone` | `@prisma/client-notchme` | Regenerate |
| Webhook header | `X-OrbitOne-Secret` | `X-NotchMe-Secret` | Compatibility if externally used |
| API identity | `CloudIT OrbitOne API` | `NotchMe API` | Replace |
| Database | `orbitone` | Keep initially | Historical internal identifier |
| Applied migrations | OrbitOne filenames/comments | Keep | Historical integrity |

---

## 6. Required Decisions Before Implementation

Record these values before changing code:

| Decision | Required value |
|---|---|
| Primary marketing domain | To be confirmed from legally cleared/owned domains |
| Application domain | For example `app.<domain>` or the root domain |
| API domain | For example `api.<domain>` |
| Support email | To be confirmed |
| Billing email | To be confirmed |
| Transactional email sender | To be confirmed |
| Old URL retention period | To be confirmed |
| Existing external webhook consumers | Audit required |
| Existing production users/sessions | Audit required |
| Existing `orbitone` platform entitlements | Audit required |

Do not guess production domain or email values in code.

---

## 7. Persistence and Compatibility Rules

### 7.1 SQL migrations

Do not rename applied migration files, including examples such as:

```text
0001_orbitone_v1_schema.sql
0007_scheduling_orbitone_integration.sql
```

The custom migration runner may identify applied migrations by filename. Renaming them can make an applied migration appear new and create duplicate execution risk.

Historical comments inside applied migrations can remain unchanged.

All new migrations created after the rebrand use NotchMe naming where a product name is needed.

### 7.2 Database name

Keep the existing `orbitone` PostgreSQL database name during the rebrand. It is an internal identifier and changing it increases deployment, backup, restore, and connection risk without changing the customer experience.

A database rename may be considered later as a separate maintenance operation.

### 7.3 Platform product key

The platform currently registers and authorizes the product using `orbitone`. The migration must:

1. Add or rename the registry entry to `notchme`.
2. Identify every persisted organization/product entitlement using `orbitone`.
3. Migrate those records transactionally to `notchme`.
4. Update API module guards and provisioning payloads.
5. Verify existing tenants retain exactly the same module access.
6. Remove old-key compatibility only after verification.

This is a data migration, not a search-and-replace operation.

### 7.4 Authentication cookie

Changing the cookie name invalidates existing browser sessions unless compatibility is implemented.

Choose one documented approach after auditing live users:

- **Pre-launch hard cutover:** change to `notchme_session` and intentionally require login again.
- **Compatibility cutover:** temporarily accept the old cookie, issue the new cookie after successful authentication, and remove compatibility after a defined period.

Cookie domain, path, security, SameSite, expiration, logout, and revocation behavior must remain correct.

### 7.5 Browser storage

For theme preference:

1. Read `notchme-theme` first.
2. If missing, read `orbitone-theme`.
3. Validate and copy the value to `notchme-theme`.
4. Stop writing to the old key.
5. Remove the old fallback after the compatibility period.

### 7.6 Environment variables

Introduce `NOTCHME_WEB_URL`. If needed during a rolling deployment, read it first and temporarily fall back to `ORBITONE_WEB_URL`.

Update environment templates, secrets, compose configuration, deployment documentation, and production environments before removing the fallback.

Never print secret values during verification.

### 7.7 Webhooks

Audit webhook consumers before changing `X-OrbitOne-Secret`.

- With no external consumers, replace it directly with `X-NotchMe-Secret`.
- With existing consumers, temporarily send both headers or introduce a versioned migration with a published removal date.

### 7.8 URLs and redirects

Add the new domains before retiring the old domains.

Browser-facing old URLs should use permanent redirects after verification:

```text
old path + query -> equivalent new path + query
```

Do not assume API clients will safely follow redirects. API consumers require a documented endpoint migration or an intentional compatibility router.

---

## 8. Public Brand Replacement Scope

Replace active customer-facing OrbitOne references in:

- Application header, sidebar, mobile navigation, and footer
- Landing page and marketing metadata
- Login, registration, invitation, recovery, and verification flows
- Dashboard welcome and empty states
- Public professional pages
- Booking and confirmation pages
- Pricing and upgrade surfaces
- Settings, support, and billing copy
- `Powered by` attribution
- Share-sheet titles
- Transactional emails and links
- vCard metadata where applicable
- Generated documents where applicable
- Swagger title and public API descriptions
- Health/service display labels exposed to operators
- Social previews, favicon, manifest, and structured metadata

Do not perform the premium UI redesign during this pass. Use the existing layouts with the new identity so functional changes remain isolated.

---

## 9. Active Technical Rename Scope

### 9.1 Application folders and workspaces

Move:

```text
apps/orbitone-web -> apps/notchme-web
apps/orbitone-api -> apps/notchme-api
```

Update:

- Workspace package names
- Root package lockfile
- TypeScript project references if present
- Shared UI content paths
- Docker build contexts
- Prisma schema paths
- Test and coverage paths
- CI commands

Regenerate the lockfile using the package manager. Do not manually patch every generated lockfile path if regeneration can produce the correct result.

### 9.2 Contracts and generated clients

Rename active contract modules to NotchMe and update all imports.

Update the Prisma generator output from `@prisma/client-orbitone` to `@prisma/client-notchme`, regenerate the client, and update imports.

Do not edit generated client output by hand.

### 9.3 Infrastructure folders and services

Move:

```text
infra/orbitone-web -> infra/notchme-web
infra/orbitone-api -> infra/notchme-api
```

Update:

- Compose service names
- Image names
- Container names
- Build contexts
- Dockerfile paths and standalone output paths
- Traefik router and service labels
- Health-check URLs
- Resource labels and log references

### 9.4 Platform integration

Update:

- Product registry key and label
- Module guards
- Provisioning payloads
- Invitation URLs
- Product selection UI
- Internal product documentation
- Relevant platform API tests

### 9.5 Operational scripts

Update active references in:

- Deployment scripts
- Predeploy and migration scripts
- Start and stop scripts
- Health checks
- Rollback scripts
- Maintenance scripts
- Database creation only if the database decision changes; default is to retain `orbitone`
- Monitoring and backup configuration

---

## 10. Documentation Strategy

### Active documentation

Rename active product references to NotchMe in:

- Product reshape plan
- Root README service catalog
- Architecture documentation
- Environment setup
- Routing examples
- Client onboarding documentation
- Shared package documentation
- Current deployment and operations guides

Rename `docs/ORBITONE_PRODUCT_RESHAPE_PLAN.md` to a NotchMe filename during the migration and update links.

### Historical documentation

Do not rewrite completed historical migration records as if NotchMe was always the name.

Add a notice to the completed OrbitOne migration plan:

> OrbitOne was renamed to NotchMe. Historical identifiers in this document are intentionally preserved.

Old sprint prompts and archived instructions may retain historical names when they describe work completed under OrbitOne. They should not be used as current implementation guidance.

---

## 11. Implementation Phases

### R0: Discovery and baseline

- Confirm production domains and email identities.
- Audit live users and active sessions.
- Audit platform entitlements using `orbitone`.
- Audit external webhooks and API consumers.
- Inventory all active and historical name occurrences.
- Record current build, lint, unit-test, and end-to-end status.
- Back up applicable databases and production configuration.
- Create a dedicated rebrand branch.

Exit criteria:

- All required decisions are recorded.
- Compatibility requirements are known.
- A clean technical baseline exists.

### R1: Public identity

- Add approved NotchMe logo assets when available.
- Replace active customer-facing product copy.
- Update metadata, share titles, API descriptions, and operational labels.
- Update transactional templates and support references.
- Keep layouts functionally unchanged.

Exit criteria:

- No active customer surface displays OrbitOne.
- Existing user flows continue to behave the same.

### R2: Application and package rename

- Move web and API application folders.
- Rename npm workspaces.
- Rename active contracts.
- Rename/regenerate the Prisma client.
- Update imports, paths, shared configuration, CI, and tests.
- Regenerate the lockfile.

Exit criteria:

- NotchMe workspaces build, lint, and test under their new names.
- No active build depends on an `apps/orbitone-*` path.

### R3: Platform and persisted identifiers

- Migrate the platform product key and entitlements.
- Update module guards and provisioning.
- Apply the selected cookie transition.
- Apply browser-storage migration.
- Introduce new environment variables with controlled fallback.
- Apply webhook compatibility where required.

Exit criteria:

- Existing tenants retain correct access.
- Authentication, provisioning, invitations, and webhooks pass compatibility tests.

### R4: Infrastructure and domains

- Move infrastructure folders.
- Rename services, images, containers, and Traefik identifiers.
- Add new DNS records and TLS routing.
- Update deployment, rollback, maintenance, and health scripts.
- Deploy new NotchMe services.
- Verify new web and API endpoints.
- Add old-domain redirects or compatibility routes.

Exit criteria:

- Production deploys only active NotchMe services.
- New domains are healthy over HTTPS.
- Approved old links resolve safely.

### R5: Documentation and cleanup

- Rename the active product strategy document.
- Update active architecture and operations documentation.
- Mark historical documents.
- Search the active repository for old-name variants.
- Classify every remaining occurrence as historical, compatibility, or defect.
- Remove temporary compatibility only if its exit conditions are met.

Exit criteria:

- No unexplained OrbitOne occurrence remains in active code or documentation.
- Historical and temporary exceptions are documented.

### R6: Release verification

- Run API build, lint, and unit tests.
- Run web build and lint.
- Run provisioning and module-entitlement tests.
- Test login, logout, recovery, invitations, and session behavior.
- Test public page, sharing, vCard, booking, confirmation, rescheduling, and cancellation.
- Test webhooks when applicable.
- Build production Docker images.
- Test deployment, health checks, monitoring, backup, and rollback paths.
- Test old-domain behavior.
- Perform desktop and mobile smoke tests.

Exit criteria:

- All rebrand acceptance criteria pass.
- The repository is ready to begin the product/UI reshape.

---

## 12. Verification Matrix

| Area | Required verification |
|---|---|
| Web workspace | Build and lint pass under `@cloudit/notchme-web` |
| API workspace | Build, lint, and unit tests pass under `@cloudit/notchme-api` |
| Package installation | Clean install resolves renamed workspaces and Prisma client |
| Platform gating | Existing tenants receive unchanged module access through `notchme` |
| Provisioning | Tenant creation and invite acceptance use NotchMe URLs and product key |
| Authentication | Cookie transition, login, logout, expiry, and revocation work |
| Public experience | No active customer-facing OrbitOne text or metadata remains |
| Webhooks | New header works and compatibility behavior matches the decision |
| Infrastructure | Compose, Traefik, DNS, TLS, health checks, logs, and rollback work |
| Redirects | Old web paths and queries reach correct new locations |
| Database | Applied migrations are not re-executed; existing data remains readable |
| Documentation | Active docs use NotchMe; historical docs are marked |

### Local database verification — 2026-08-18

The real SQL migration `20260818000000_notchme_product_key` was executed with `prisma migrate deploy` against the disposable local PostgreSQL 16 database `notchme_migration_test` at `127.0.0.1:55432`. This was not production and not the normal development database. The Platform schema was created with `prisma db push`, and the four migrations immediately preceding the data migration were explicitly baselined with `prisma migrate resolve` before the actual NotchMe migration was deployed.

Seeded scenarios covered multiple organizations, OrbitOne-only rows, NotchMe-only rows, duplicate business keys, enabled conflicts, split provisioning fields/statuses/retry counts, custom fields, feature flags, and unrelated TouchOrbit rows. The assertions confirmed no primary or composite-key conflict; in-place IDs for OrbitOne-only rows; retained NotchMe IDs for merged duplicates; logical-OR enabled values; provisioning field/status/retry/timestamp merge behavior; no remaining OrbitOne product rows in the four migrated tables; and unchanged unrelated product rows.

`scripts/verify-notchme-product-key-migration.ts` is the repeatable safety-gated helper. It requires both `NOTCHME_MIGRATION_TEST=1` and `NOTCHME_MIGRATION_TEST_DATABASE_URL`, rejects non-local hosts and database names not beginning with `notchme_migration_test`, and supports `seed`, `assert`, and `rollback` actions. The rollback action runs the actual migration statements with an intentional failure before commit and confirms the transaction leaves the original OrbitOne rows untouched.

To repeat the successful-path check, create a disposable local database named `notchme_migration_test`, set the explicit test-only URL, apply the current Platform schema, baseline the four pre-NotchMe migrations, then run:

```text
NOTCHME_MIGRATION_TEST=1
NOTCHME_MIGRATION_TEST_DATABASE_URL=postgresql://<test-user>:<test-password>@127.0.0.1:55432/notchme_migration_test?schema=public
ts-node scripts/verify-notchme-product-key-migration.ts seed
prisma migrate deploy --schema=apps/platform-api/prisma/schema.prisma
ts-node scripts/verify-notchme-product-key-migration.ts assert
```

Run `rollback` against a separately prepared `notchme_migration_test_rollback` database to verify the intentional-failure transaction path. Never supply a production or normal development URL.

Platform API lint currently reports 213 pre-existing type-safety errors outside the NotchMe rebrand. This technical debt is waived for the rebrand only; no new lint failures were introduced by the NotchMe registry or migration-test files, and lint was not used to fix unrelated code.

---

## 13. Search and Cleanup Rules

Final repository searches must include at least:

```text
OrbitOne
orbitone
orbit-one
orbit_one
api-orbitone
ORBITONE_
X-OrbitOne
```

Each remaining match must be one of:

- Historical SQL migration name or comment
- Marked historical documentation
- Temporary compatibility code with an owner and removal condition
- Existing database identifier explicitly retained by decision

All other matches are defects.

Do not perform blind repository-wide replacement because it can corrupt historical migrations, generated files, package paths, secrets documentation, and compatibility behavior.

---

## 14. Rollback Strategy

Before production cutover:

- Preserve the prior deployable image tags.
- Back up relevant databases and configuration.
- Keep old DNS and routing until new services pass verification.
- Ensure rollback scripts reference the correct old and new service identifiers during transition.
- Record the product-key migration reversal procedure.

If cutover fails:

1. Restore traffic to the previous web and API services.
2. Revert the platform product-key migration if it blocks authorization.
3. Preserve data created during the attempted cutover.
4. Do not roll back applied data changes blindly.
5. Diagnose before attempting a second cutover.

---

## 15. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Applied migrations run again | Never rename historical migration files; verify migration status before deploy |
| Tenants lose module access | Transactionally migrate product keys and test existing organizations |
| Users are logged out unexpectedly | Audit users and select a documented cookie transition |
| Invitations point to old host | Update provisioning URL and test full invite acceptance |
| CI or Docker paths break after folder move | Rename paths in one focused phase and verify clean builds |
| Old links stop working | Add and test redirect/compatibility routing before retirement |
| API integrations break on redirect | Use explicit API compatibility rather than relying on browser redirects |
| Webhook consumers reject new header | Audit usage and provide a transition when needed |
| Generated files are edited incorrectly | Regenerate package lock and Prisma client from source configuration |
| Historical records become misleading | Preserve history and add a rebrand notice |
| UI redesign mixes with rename defects | Complete and verify rebrand before reshape work starts |

---

## 16. Definition of Done

The NotchMe rebrand is complete when:

- NotchMe is the only active public product identity.
- Web and API applications use NotchMe folders and workspace names.
- CI builds and tests the renamed workspaces.
- Docker and deployment infrastructure use NotchMe service identifiers.
- New production web and API domains work over HTTPS.
- Platform entitlements use the NotchMe product key without access regression.
- New sessions and browser preferences use NotchMe identifiers.
- Provisioning, invitations, public pages, bookings, and webhooks work.
- Old web URLs follow the approved redirect policy.
- Database contents and migration history remain intact.
- Active documentation uses NotchMe.
- Historical OrbitOne documents and migrations are clearly classified.
- All remaining OrbitOne search results are documented exceptions.
- The API, web, Docker, integration, and smoke-test suites pass.
- The product reshape plan can begin without relying on obsolete OrbitOne identity or paths.

---

## 17. Handoff to Product Reshape

After this plan is complete:

1. Rename the active reshape document to `docs/NOTCHME_PRODUCT_RESHAPE_PLAN.md`.
2. Confirm every route and feature disposition against the renamed codebase.
3. Start the premium design-system phase using Quiet Orbit.
4. Create new UI assets only with the approved NotchMe name and logo.
5. Treat the completed rebrand baseline as the starting point for all subsequent product work.
