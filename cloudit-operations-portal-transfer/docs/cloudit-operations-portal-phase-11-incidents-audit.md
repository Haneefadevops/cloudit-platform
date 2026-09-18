# CloudIT Operations Portal — Phase 11 design: incidents and audit history

Date: 16 September 2026
Status: **DESIGN ONLY — awaiting owner approval; no implementation or production mutation**

## Purpose and boundary

Phase 11 is the read-only investigation and proof layer. It adds:

- an **Incidents view**: active and resolved findings with severity, client,
  domain and source filters, repeated-failure buckets, and a per-incident
  recovery timeline;
- **safe investigation links** from an incident to related sanitized evidence
  (registered endpoint, and — only where a real database link exists — related
  report or backup/restore evidence) without exposing raw provider errors,
  credentials, n8n payloads or any customer/landlord/booking data;
- an **Audit history viewer**: report-action and administrative audit events
  from `operations.audit_events` (who approved/sent/rejected what, when, with
  which safe result code), filterable by category and date.

Phase 11 adds **no actions and no state changes anywhere**. Every new surface
is a read-only, GET-only, owner-session-gated view of data that already
exists. No new tables, no new migration, no new n8n workflow or credential,
no new environment variable. If implementation discovers a genuine data gap,
work stops and the gap is presented for approval before anything changes.

## Preflight record

### Repository / worktree state

- Worktree: `C:\Project\cloudit-platform\.worktrees\master-portal` on `master`,
  clean working tree. Latest commits: `626f170` (Phase 10 gate deferred to
  October cycle), `e53c9cb` (TOTP removal), `0afccde` (Phase 10 build).
- The unrelated main checkout and all user changes are untouched.

### n8n live/export comparison status

Phase 11 needs **no n8n change by design**, so no workflow mutation is
proposed. However the preflight inspection found:

- The checked-in exports under `infra/n8n/workflows/` cover the collectors,
  the evidence publisher, the PDF relay and the Phase 10 command workflow.
- **No export of the incident publisher** (`Cavetta - Incident Monitor` or a
  dedicated incident-evidence publisher that posts `incident` records to
  `operations_ingest.submit_batch`) exists in the repository. The incident
  ingest path (`operations_ingest.insert_incident`, migration
  `0005_ingest_records.sql`) and the seed registration for
  `cavetta.incident_monitor` exist, but the live workflow that exercises them
  has never been exported here.
- The Phase 0 record already warns that export/live drift is always possible
  after later workflow edits.

Consequence: before production acceptance the owner must authorize a
**read-only** live n8n export comparison of the incident/evidence publisher
workflows (or confirm on the server that incident rows are actually flowing
into `operations.incidents`). This is verification only — no mutation.

### Existing pieces to reuse and gaps to close

| Reuse | Verified role | Phase 11 gap |
| --- | --- | --- |
| `operations.incidents` (`0002_schema.sql:783`) | deduplicated incident: `incident_key`, `service_key`, `state` (`open`/`recovered`/`resolved`), `severity`, `failure_category` (15-value closed list), `started/confirmed/recovered/resolved_at`, `occurrence_count`, `safe_summary` (≤500), `safe_action` (≤300), nullable FKs to environments/endpoints | no `domain_id` or `provider` column — domain is derived via `endpoint_id → endpoints.domain_id`; "provider" can only be honest as `source_system` |
| `operations.incident_events` (`0002_schema.sql:834`) | append-only timeline (`detected`/`confirmed`/`recovered`/`resolved`/`rejected`/`updated`) with `occurred_at`, severity, status color | events carry no free-text message; timeline UI renders from type + severity only. `confirmed`/`rejected` types exist in the CHECK but the current ingest writer never emits them |
| `operations.audit_events` (`0002_schema.sql:871`) | append-only audit: opaque `actor_key`, namespaced `action`, `target_type/key`, `result`, `occurred_at`, `command_key`, `safe_reason_code`; nullable `client_id` = global (owner-only) events | no `category` column — category is derived from the `action` prefix at read time |
| RLS/grants (`0003_security.sql`) | `operations_owner` SELECT-only; tenant isolation via `has_client_access`; `audit_events` additionally exposes `client_id IS NULL` rows to owner; append-only enforced by `deny_mutation()` trigger on `incident_events`/`audit_events` | none — retained exactly |
| `OperationsDataService` GUC pattern (`operations-data.service.ts`) | `BEGIN; SET LOCAL operations.global_role='cloud_owner'; ... COMMIT` per query | reused unchanged |
| platform-api conventions | `OperationsInternalAuthGuard`, `OperationsExceptionFilter` (`{statusCode, message}` with four generic messages), snake_case row interfaces + camelCase projections, `generatedAt` stamp, `@Throttle({default:{limit:20,ttl:60000}})` on Phase 10 GET command routes | new endpoints follow these conventions; no new config (`operations.config.ts` needs nothing) |
| operations-web conventions | catch-all section router already registers `incidents` and `audit-log`; nav already contains both entries; `requireOperationsSession`, `fetchOperations` (no-store), `HealthPill`, `.ops-table`/`.table-scroll`, `.window-links` filter idiom, `formatMaltaTime`/`formatAge`, `OperationsErrorState`, 404-as-empty pattern | no timeline component exists — timeline reuses `.ops-command-history` row style; no pagination convention exists — keyset cursor is new (see decisions) |

**Indexes:** `ix_incidents_client (client_id, state, started_at DESC)`,
`ix_incident_events_incident (client_id, incident_id, occurred_at)`,
`ix_audit_events_occurred (occurred_at DESC)`,
`ix_audit_events_client (client_id, occurred_at DESC)`. There is no index on
incident severity/failure_category/endpoint_id or on audit action/result.
At current data volumes this is acceptable; Phase 11 adds no migration. If
filtering ever becomes slow, a small optional migration adding
`(client_id, severity)` and `(client_id, failure_category)` indexes can be
proposed later — it is not part of this design.

**Correction to the kickoff wording:** there is no `idents` table. Identity
is the per-table natural-key pattern: every evidence row carries a
caller-supplied `*_key` unique per client (`incident_key`, `event_key`, …).
API projections expose those keys, never row uuids.

## Trust boundary

```text
Browser --GET, owner session only--> operations-web (server component)
  --internal token, container network--> platform-api GET /api/operations/...
  --RLS + cloud_owner GUC--> operations DB (SELECT only)
```

The browser supplies only filter query parameters from closed allowlists. It
never supplies tenant identity, actor, keys for joins, or any payload. All
joins, derivations and link construction happen server-side. Responses contain
only allowlisted, already-sanitized columns; raw internals never cross the
boundary (these tables contain no payload columns by construction, and the
service tests assert the SQL never selects forbidden names).

## Platform API design (read-only GET only)

All routes live in the existing `operations.controller.ts` under the existing
controller guard and exception filter. `@Get` only — no `@Post`, no body,
no DTO write path. Each read route carries
`@Throttle({ default: { limit: 20, ttl: 60000 } })` matching the Phase 10
command-history GET. Responses include `generatedAt`.

### 1. `GET /api/operations/incidents`

Query params (all optional, all closed-allowlist validated; any invalid value
→ `400 'Invalid request'` following the Phase 10 style):

| Param | Values | Semantics |
| --- | --- | --- |
| `state` | `open` \| `recovered` \| `resolved` \| `all` (default `all`) | incident state |
| `severity` | `info` \| `warning` \| `critical` | exact severity |
| `client` | client key pattern | exact client |
| `domain` | domain key pattern | incidents whose endpoint belongs to the domain (join `endpoints`) |
| `source` | `n8n` \| `uptime_kuma` \| `github_actions` \| `vercel` \| `supabase` \| `imagekit` | the incident's `source_system` |

> "Provider filter" from the phase plan is presented honestly as **source**
> filter: incidents have no provider column and the portal never invents one.
> Where the endpoint's service implies a provider, the source system is still
> the only publisher-attested value.

Response shape:

```ts
interface IncidentsResponse {
  generatedAt: string;
  filters: { state: string; severity: string | null; client: string | null; domain: string | null; source: string | null };
  clients: Array<{
    clientKey: string;
    clientName: string;
    incidents: IncidentListItem[];
  }>;
  buckets: RepeatedFailureBucket[];
}
```

```ts
interface IncidentListItem {
  incidentKey: string;
  serviceKey: string;
  endpointKey: string | null;      // only when the incident is endpoint-linked
  endpointDisplayName: string | null;
  domainKey: string | null;        // derived via endpoint
  state: 'open' | 'recovered' | 'resolved';
  severity: 'info' | 'warning' | 'critical' | 'none';
  statusColor: 'GREEN' | 'AMBER' | 'RED' | 'NO_DATA' | 'UNKNOWN' | null;
  failureCategory: string | null;  // closed 15-value list
  occurrenceCount: number;
  safeSummary: string | null;
  safeAction: string | null;
  startedAt: string;
  confirmedAt: string | null;
  recoveredAt: string | null;
  resolvedAt: string | null;
  lastObservedAt: string;          // observed_at
  correlationKey: string | null;
}

interface RepeatedFailureBucket {
  failureCategory: string;
  serviceKey: string;
  endpointKey: string | null;
  openCount: number;               // open incidents in the bucket
  totalOccurrences: number;        // sum of occurrence_count
  lastOccurredAt: string;          // max started_at
}
```

**Bucket semantics:** one bucket per `(failure_category, service_key,
endpoint_key)` over the **filtered** incident set, including only buckets
with `totalOccurrences >= 2` (a single occurrence is a list row, not a
repeated-failure finding). Buckets are derived server-side in the same query
response — no separate endpoint, no extra round trip.

### 2. `GET /api/operations/incidents/:incidentKey`

`incidentKey` must match the existing `^[a-z0-9][a-z0-9_.-]{1,120}$` pattern;
no match or unknown key → `404 'Not found'`. Resolves the key per client
under RLS (owner sees all clients; grouped response like the reports detail
convention is unnecessary — a single incident belongs to one client).

```ts
interface IncidentDetailResponse {
  generatedAt: string;
  incident: IncidentListItem;      // same projection as the list
  events: Array<{
    eventType: 'detected' | 'confirmed' | 'recovered' | 'resolved' | 'rejected' | 'updated';
    occurredAt: string;
    severity: 'info' | 'warning' | 'critical' | 'none' | null;
    statusColor: string | null;
    correlationKey: string | null;
  }>;                             // ordered by occurred_at ASC (recovery timeline)
  links: InvestigationLink[];     // server-derived, FK-backed only
}

interface InvestigationLink {
  kind: 'endpoint' | 'report' | 'backup';
  label: string;                  // display-only safe text, e.g. endpoint display name
  refKey: string;                 // endpoint key, report key or backup key
  // rendered by the web app as a link to an existing sanitized read route
}
```

**Recovery-timeline derivation:** the incident row's four lifecycle
timestamps are displayed as the summary header; `events` is the authoritative
timeline. Because the current ingest writer emits `detected` on first insert
and `recovered`/`resolved`/`updated` on state changes, the timeline reflects
exactly what was published — the UI never invents `confirmed` entries even
though the enum allows them.

**Investigation-link policy:** a link is emitted only when a real database
relationship exists, derived server-side:

- `endpoint`: always when `endpoint_id` is set → link to the Infrastructure
  section (`/infrastructure`), carrying the endpoint identity for display.
- `report` / `backup`: only when a deterministic join exists (none today:
  incidents have no report or backup FK). **No fuzzy correlation-key
  matching, no free-text mining.** These link kinds are defined in the type
  for future use but are never fabricated in Phase 11.

### 3. `GET /api/operations/audit-events`

Paged and filterable. Query params:

| Param | Values | Semantics |
| --- | --- | --- |
| `category` | `report_actions` \| `authentication` \| `administrative` \| `all` (default `all`) | derived from the `action` prefix |
| `from` / `to` | `YYYY-MM-DD` | `occurred_at >= from` and `< to + 1 day` (Europe/Malta interpretation is **not** assumed; dates are plain UTC calendar days) |
| `cursor` | opaque server-issued string | keyset continuation |
| `limit` | 1–100, default 50 | page size |

**Category mapping (closed, server-side):**

| Category | `action` prefix | Meaning |
| --- | --- | --- |
| `report_actions` | `report.command.` | Phase 10 command request/dispatch/claim/acknowledge/complete/expire/deny |
| `authentication` | `auth.` | sign-in and auth denials |
| `administrative` | everything else | ingestion receipts, future admin actions |

Invalid category/date/limit → `400 'Invalid request'`. Dates are validated as
real calendar dates. The cursor is an opaque base64url of
`(occurred_at, id)` — never carries row content.

```ts
interface AuditEventsResponse {
  generatedAt: string;
  filters: { category: string; from: string | null; to: string | null };
  events: Array<{
    eventKey: string;
    occurredAt: string;
    actorType: 'portal_user' | 'publisher' | 'system' | 'n8n';
    actorKey: string;            // opaque
    action: string;              // namespaced action, e.g. report.command.request
    targetType: string | null;
    targetKey: string | null;
    result: 'success' | 'denied' | 'error' | 'allowed';
    safeReasonCode: string | null; // closed safe codes only (never raw internals)
    commandKey: string | null;
    clientKey: string | null;    // null = global event (owner-only rows)
  }>;
  nextCursor: string | null;
}
```

The viewer reflects the append-only store exactly: no edit, delete,
acknowledge or resolve control exists, and the projection adds nothing the
store does not contain (no joined payloads, no before/after values).

### Safe-code mapping

Nothing new needs mapping: `severity`, `state`, `failure_category`,
`result`, `actor_type`, `event_type` and `safe_reason_code` are already
constrained to closed lists by the database CHECKs and the Phase 10 writer
allowlists. The service validates against TypeScript mirrors of those lists
and passes values through unchanged — the closed list **is** the mapping.
Any value outside the mirror → row excluded from projection (defensive;
cannot happen given the CHECKs).

## Caching and headers

- platform-api sets no cache headers (existing behavior); the global
  throttler applies.
- operations-web: portal layout is `force-dynamic`, fetches use
  `cache: "no-store"`, middleware already sets CSP/no-referrer/nosniff/frame
  DENY on every response. Phase 11 pages and BFF behaviour inherit all of
  this with zero new header code.
- Incident/audit data is operational evidence, not personal data, but the
  same no-store posture is kept: every page render is fresh.

## Operations-web UI design

### `/incidents` — `components/incidents-page.tsx`

Follows the reports-page skeleton: `requireOperationsSession()` → try
`getOperationsIncidents(filters)` → 404-as-empty → `OperationsErrorState`.

- Header eyebrow `OPERATIONS · INCIDENTS`, description, `ops-updated` line.
- Stat tiles (`.ops-stat-grid`): Open now, Critical open, Recovered (in
  filtered set), Repeated-failure buckets count — all derived from the
  response.
- Filters: `.window-links` pill groups for **state** (Open / Recovered /
  Resolved / All) and **severity** (All / Info / Warning / Critical), plus
  compact `<select>`-free source/domain/client filter via searchParams —
  reusing the existing searchParams-driven idiom, server-rendered, `GET`
  only, `aria-current` on active pills.
- Repeated-failure buckets card: category + service/endpoint, occurrence
  totals, last occurrence, open count, `HealthPill` by worst severity.
- Incident table per client (`.ops-client` grouping like reports): Incident
  (key + safe summary), Service/Endpoint, Severity (`HealthPill`), State,
  Failures (occurrence count), Started, Recovered/Resolved. Rows link via
  `.ops-link` to `/incidents/<key>`. Mobile: `.table-scroll` horizontal
  scroll (existing pattern).
- Empty state: `ops-empty-note` ("No incidents have been published yet.").

### `/incidents/[key]` — `components/incident-detail-page.tsx`

Convention: `params.detail?.[0]` (workflows detail pattern); unknown key →
`notFound()` on API 404.

- `ops-def-list` of: state, severity, failure category, service, endpoint,
  domain, occurrence count, started/confirmed/recovered/resolved times
  (`formatMaltaTime`, explicit Europe/Malta label), last observed, safe
  summary, safe action, correlation key.
- **Recovery timeline**: ordered list styled like `.ops-command-history`
  rows — event type label (never colour alone; icon + text), severity pill,
  `<time>` with `formatMaltaTime`, correlation key when present. Section
  labelled "Recovery timeline" with an explicit note that the timeline is
  append-only published evidence.
- **Investigation links** card: only the links the API returned (endpoint
  link to `/infrastructure` in Phase 11). If none: "No linked evidence."
  Never a dead or guessed link.
- Back link to `/incidents`.

### `/audit-log` — `components/audit-log-page.tsx`

- Header eyebrow `OPERATIONS · AUDIT LOG`; a short explicit statement that
  the log is append-only and read-only.
- Filters: `.window-links` pill groups for **category** (All / Report actions
  / Authentication / Administrative) and **date range** (24h / 7d / 30d /
  All — preset ranges matching the existing window idiom; no free date
  pickers).
- Table: When (`<time>`), Actor (type + opaque key), Action, Target, Result
  (`HealthPill`-style pill: success/denied/error/allowed with text labels),
  Reason code. `commandKey` shown as opaque text (safe correlation).
- Pagination: "Newer / Older" `.window-links` driven by the opaque cursor in
  searchParams; `nextCursor: null` hides Older. No page numbers (keyset).
- Empty state + error state per convention. **No row actions of any kind.**

### Accessibility and mobile

Everything server-rendered (no new client components, no hydration weight):
keyboard-operable filter links with visible `:focus-visible` ring, `aria-current`
on active pills, semantic tables with `th scope="col"`, timeline as an ordered
list with text labels plus pills (never colour alone), 44 px touch targets,
390 px mobile bottom-nav already covers Incidents/Audit log, `prefers-reduced-motion`
respected via existing CSS.

## Test plan

### platform-api (Jest)

- New suites `operations.incidents.spec.ts` and `operations.audit-events.spec.ts`
  following the existing rows-fake pattern (`query.mockResolvedValueOnce`,
  snake_case fixtures, `new OperationsService({ query } as never)`).
- Cases: projection mapping (every field, null handling, ISO conversion);
  filter validation (each invalid param → `BadRequestException`); SQL hygiene
  assertion on every mock call (no uuid PKs, no publisher/internal columns,
  allowlisted SELECT names only); bucket derivation (>=2 occurrence cutoff,
  grouping, filtered set); detail 404 on unknown key and invalid key pattern;
  timeline ordering ASC; audit category mapping; date window arithmetic;
  cursor encode/decode round trip; limit bounds; global (client_id NULL) rows
  included for owner.
- Existing suites stay green; `nest build` passes.

### operations-web

- `tsc --noEmit`, `next lint`, production build (existing convention — the app
  has no JS test runner).
- New pages added as branches in the catch-all section router; nav unchanged
  (entries already exist and currently render the FoundationPage placeholder,
  which Phase 11 replaces).

### Database / isolation

- **No migration is added**, so the isolation suite and migration verification
  are unchanged (rerun to prove no drift). New optional read assertions
  (owner can SELECT incidents/incident_events/audit_events projections) may be
  added to the suite only if the owner wants explicit coverage; the grants
  already exist since Phase 3.

### Mutation-free proof

- Controller review + grep: new routes are `@Get` only; no `@Post`/`@Put`/
  `@Delete`/body parser is introduced anywhere in Phase 11 code.
- Service test asserts SQL of every new query is a single `SELECT`.
- Bundle/payload hygiene: no new env vars, no secrets, no raw internal
  fields; the response types above are the complete browser-visible contract.

## Acceptance and rollback

- **Local acceptance**: full platform-api Jest + build; operations-web
  typecheck/lint/build; isolation suite rerun unchanged; all green before any
  deployment discussion.
- **Production acceptance (separately approved)**: after owner-approved
  deployment, review against real sanitized data: filter incidents by each
  dimension; open a resolved incident and follow its recovery timeline;
  follow the endpoint investigation link; view the complete Phase 10 action
  audit. The read-only nature of the phase means no client impact is
  possible. Prerequisite: the owner confirms incident evidence is actually
  flowing (read-only live n8n export comparison or a server-side row count),
  since no incident-publishing export exists in the repository.
- **Rollback**: revert the deployed commit; no database or n8n change exists,
  so rollback is pure code. Controls fail closed (pages simply do not exist).

## Decisions required from the owner

1. Approve the read-only scope: three new GET endpoints, no new tables,
   migration, config or n8n change.
2. Approve presenting the "provider" filter honestly as **source-system**
   filter (`n8n`, `uptime_kuma`, …) rather than inventing a provider column.
3. Approve the investigation-link policy: FK-backed links only (endpoint in
   Phase 11); no correlation-key guessing to reports/backups.
4. Approve audit date filtering as preset ranges (24h/7d/30d/all) matching
   the existing window idiom, plus keyset cursor pagination — or ask for free
   date inputs / numbered pages instead.
5. Approve the repeated-failure bucket definition (`failure_category` ×
   `service_key` × `endpoint_key`, occurrences ≥ 2, computed on the filtered
   set).
6. Authorize the read-only live n8n export comparison of the incident /
   evidence publisher workflows (or a server-side check that incident rows
   flow) before production acceptance.
7. Confirm production deployment and push timing follow the same
   owner-directed pattern as Phases 9/10 (separate explicit approval; the
   October 1 snapshot/draft operational tracks are untouched by this phase).

---

## Implementation record

- Implemented exactly as designed, with one type correction:
  `RepeatedFailureBucket.failureCategory` is emitted as `string | null`
  (the bucket grouping is defined over `failure_category` NULL, so
  uncategorized incidents form buckets with a null category; the design's
  `string` type would have been dishonest for them). Everything else —
  endpoints, filters, bucket semantics, keyset cursor, category mapping and
  error shapes — matches the design as approved.
- `GET /incidents/:incidentKey` returns **404** for both an unknown key and
  an invalid key pattern (per this design's test plan), while query-param
  validation on the list and audit endpoints returns 400 `'Invalid request'`
  in the Phase 10 style.
- Bucket ordering: `totalOccurrences` DESC, then `lastOccurredAt` DESC,
  then category/service/endpoint ASC (design fixed only the primary sort).

## Production acceptance record (2026-09-18)

- **Deployed commits**: `ad42f2c` (Phase 11 build), `2ea8b55` (doc date fix),
  `f795501` (audit pagination cosmetic fix), `7e3ad1b` (incident evidence
  publisher export), `a38dc99` (publisher occurrenceCount fix, found during
  the controlled gate run: recoveries must send `occurrenceCount` 1, not 0 —
  the DB CHECK range is 1..100000 and the whole batch was correctly rejected
  with `field_out_of_range`).
- **Incident evidence publisher**: imported, bound
  (`cavetta_maintenance_events` table + `CloudIT - Publish Operations
  Evidence` sub-workflow) and **activated** by the owner. The live
  `Cavetta - Incident Monitor` workflow was never modified.
- **Controlled gate test (separately authorized, non-real)**: two
  unmistakable `phase11-gate-test` Data Table rows (CONFIRMED_DOWN then
  RECOVERED for monitor 1) published through the real pipeline and verified
  in production: list with stats/buckets/filters (state, severity, source,
  domain), incident detail with **detected → recovered timeline**, and the
  endpoint **investigation link** to the Infrastructure section. Phase 10
  action audit reviewed in `/audit-log` (report.command lifecycle with
  closed safe codes, plus ingestion denial evidence).
- **Complete cleanup verified 2026-09-18**: both test Data Table rows
  deleted; `operations.incident_events` test rows deleted (2) and
  `operations.incidents` test row deleted (1); append-only triggers
  re-enabled on both tables; final `SELECT count(*) FROM
  operations.incidents` = **0**; permanent audit note recorded via
  `operations_private.record_audit_event`
  (`incident.test_cleanup`, event `ca38cf80-fd56-48ec-ba9f-70411e4751fc`).
  No pins, mocks, fixed clocks or temporary rows remain.
- **Status**: awaiting the owner's explicit gate approval.

## Local acceptance (2026-09-16, all green)

- **platform-api**: full Jest **9 suites / 148 tests, all passing** (2 new
  suites: `operations.incidents.spec.ts` 7 tests, `operations.audit-events.spec.ts`
  8 tests; projection mapping, filter/cursor/limit 400s, SQL-hygiene
  assertions on every query, bucket derivation, timeline ordering, category
  mapping, UTC date arithmetic, cursor round trip); `nest build` clean.
- **operations-web**: `tsc --noEmit` clean, `next lint` clean, production
  build passes with `/incidents`, `/incidents/[key]` (detail) and
  `/audit-log` server-rendered through the catch-all section router; no new
  client components, route handlers, env vars or dependencies.
- **Mutation-free proof**: the only new controller routes are three
  `@Get`s; no `@Post`/`@Body` was added anywhere (the two pre-existing
  Phase 9/10 POSTs are unchanged); service tests assert every new query is a
  single `SELECT` over allowlisted columns (no row uuids, `publisher_id`,
  `idempotency_key`, `source_record_type`, `severity_echo` or payload
  columns).
- **Hygiene**: no secrets, tokens, raw internal fields or payload columns
  in the new browser-visible code; new pages reuse existing server-only
  fetch helpers; `.env.example` unchanged (no new env vars).
- **Database**: migrations 0001–0011 applied fresh into a disposable
  PostgreSQL 16 container (default `postgres` untouched); operations
  isolation suite **123/123**; disposable container and volume removed.
  No new migration exists, as designed.

## Incident evidence publisher (2026-09-17, owner-approved n8n addition)

Production acceptance review found `operations.incidents` empty: the live
`Cavetta - Incident Monitor` (owner-supplied read-only export) records to
its Data Table but never published portal evidence, and the publisher
`cavetta-production-n8n` was already allowed to ingest `incident`. Fix, per
the approved option A: a **new, separate, inactive** workflow
`infra/n8n/workflows/cloudit-incident-evidence-publisher.json` — the live
Incident Monitor is **not modified**. Every 15 minutes it reads recent
`cavetta_maintenance_events` rows, maps `CONFIRMED_DOWN` /
`RECOVERED` / `RECOVERED_DURING_CONFIRMATION` to sanitized `incident`
records (monitor 4 has no registered endpoint and is published without
`endpointKey`; `REJECTED_MONITOR_EVENT` rows are skipped), validates loudly,
and publishes through the existing `CloudIT - Publish Operations Evidence`
sub-workflow as `cavetta-production-n8n`. Stable per-event idempotency keys
make replays dedupe without inflating `occurrence_count`; records are
applied chronologically. Harness
`infra/n8n/workflows/tests/incident-publisher-harness.mjs`: **34/34**.
Production activation (import, bind the `cavetta_maintenance_events` table
and the publisher sub-workflow, activate) is an owner-executed step, after
which the Phase 11 gate walkthrough follows.
