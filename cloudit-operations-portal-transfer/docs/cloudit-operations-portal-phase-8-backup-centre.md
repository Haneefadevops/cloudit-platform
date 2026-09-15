# CloudIT Operations Portal — Phase 8 design: Backup centre (Cloudflare R2)

Date: 15 September 2026
Status: **PROPOSED — awaiting owner review before any code is written**

## Purpose

Phase 8 adds the backup centre from the approved plan: daily/monthly encrypted
backup evidence and restore-test history, collected by one new scheduled n8n
collector and shown on a new read-only portal page. Evidence flows through the
proven Phase 4–7 pipeline only: the collector calls the GitHub Actions API and
the Cloudflare R2 S3-compatible list API (credentials inside n8n), normalizes
to the Phase 0 section 7 contract (`backup_evidence` / `restore_test_evidence`),
publishes through the existing `CloudIT - Publish Operations Evidence v2`
sub-workflow → `operations-ingest` → `operations` database, and one new
read-only portal page consumes the evidence. Metadata only — never download,
never decrypt. No existing workflow, table, migration or ingest code is
modified (only additive migration 0008).

## Provider change semantics (owner-confirmed 14 September 2026)

Backups no longer go to Google Drive. The `Database backup` GitHub Actions
workflow now uploads the AES-256-encrypted archive and its SHA-256 checksum to
a Cloudflare R2 bucket, keeping the same file naming
(`cavetta-db-YYYY-MM-DDTHHMMSSZ.tar.gz.gpg` + `.sha256`), the same
daily/monthly layout and the same retention (30 days daily, 366 days monthly).
A live R2 object was observed: `cavetta-db-2026-09-14T075617Z.tar.gz.gpg`
(6.01 MB) + `.sha256` (107 B).

**Column/key names keep their Drive-era spelling.** The existing columns
`drive_round_trip_passed` / `drive_object_key` and payload keys
`driveRoundTripPassed` / `driveObjectKey` are part of the proven ingest
contract (0002/0005) and are NOT renamed. From Phase 8 onward they mean
"remote object store":

- `driveRoundTripPassed` = the backup workflow downloaded the stored R2
  object, verified its checksum, decrypted and validated the archive, and
  cleaned up (the workflow's own round-trip step).
- `driveObjectKey` = the R2 object key (e.g. `daily/cavetta-db-2026-09-14T075617Z.tar.gz.gpg`).
  **Server-only**: stored in `operations.backup_evidence.drive_object_key`,
  never selected into any portal API response, never rendered to a browser.

The portal page renders this as **"R2 round trip"**. There is no
"Open in Drive" action: the object key stays server-only and the GitHub run
link provides traceability.

## Source process (as of 14 September 2026)

- `Database backup` (GitHub Actions, Cavetta/Cavetta): daily. **Schedule to
  confirm with the owner** — the Phase 0 spec documented `17 2 * * *`
  (02:17 UTC), but the 14 Sep run was observed at ~05:56 UTC
  (`cavetta-db-2026-09-14T075617Z`). The collector schedule and the
  expected-next-run display both depend on the real cron time.
- It uploads archive + checksum to R2, then downloads the stored copy,
  verifies checksum, decrypts/extracts in temporary storage, validates the
  four required files, and cleans up. The run fails if any check fails.
- Daily retained 30 days; monthly copy retained 366 days.
- `Backup restore test`: monthly isolated, non-production restore test
  (documented day 2, 03:37 UTC, manual Daily/Monthly dispatch possible).
  **Owner to confirm names/inputs are unchanged after the R2 move.**

## Migration 0008 (additive, idempotent)

`infra/postgres/operations/migrations/0008_backup_source_systems.sql`,
mirroring 0007's style (natural-key/idempotent statements, header comment).
Two changes, both required:

1. **Envelope `sourceSystem` allowlist** — re-create
   `operations_ingest.allowed_source_systems()` (0004 defines it with
   `CREATE OR REPLACE FUNCTION`, so re-creating with the extended array is
   the established pattern) appending `'cloudflare_r2'` to the existing
   `n8n, uptime_kuma, github_actions, vercel, supabase, imagekit,
   google_drive, ga4, smtp`.
2. **`provider_connections.provider` CHECK widening** — the 0002 table CHECK
   allows `('vercel','imagekit','supabase','github','google_drive','smtp',
   'ga4','uptime_kuma','n8n')`; the collector must publish R2 connectivity,
   so the constraint is re-created (idempotent `DROP CONSTRAINT IF EXISTS` /
   `ADD CONSTRAINT IF NOT EXISTS` pattern) adding `'cloudflare_r2'`.
   Widening a CHECK is backward compatible: all previously valid rows stay
   valid. (The old `'google_drive'` value remains for the historical enum
   value; nothing publishes it anymore.)

Nothing else changes: the publisher row (0006) already allows
`backup_evidence` + `restore_test_evidence`, and the `backup.*` / `restore.*`
metric definitions are already seeded (0006). The writers
`operations_ingest.insert_backup_evidence` / `insert_restore_test_evidence`
(0005) already exist with the exact Phase 0 §7.3 payload allowlists —
including the upsert-on-natural-key behavior (`backup_key` /
`restore_test_key`) that makes scheduled re-runs reconcile rather than
duplicate, and the rule that `drive_object_key` is never updated through
reconciliation.

**Why `sourceSystem: "cloudflare_r2"`** for the evidence envelopes even
though run metadata comes from GitHub: the record's subject is the R2 object
inventory; GitHub is the verification authority for it. The connectivity
records use `provider: "github"` (connection key `github-actions`) and
`provider: "cloudflare_r2"` (connection key `r2-list`) separately.

Verification (same rigor as 0007): fresh apply 0001→0008 and idempotent
re-run against a throwaway `pgvector/pgvector:pg16` container; prove a
`backup_evidence` envelope with `sourceSystem: "cloudflare_r2"` and a
`provider_connection` with `provider: "cloudflare_r2"` are accepted inside a
rolled-back transaction (they would fail with `invalid_source_system` /
CHECK violation on a 0001–0007 baseline); run the isolation suite.

## Collector workflow (template: `infra/n8n/workflows/cloudit-backup-evidence-collector.json`)

**`CloudIT - Backup Evidence Collector`** — one run per day, scheduled ~1 hour
after the confirmed backup window (exact time pending owner confirmation of
the daily cron). Flat sequential chain only (Phase 6/7 v2 lessons: no loop,
switch or merge nodes; single straight line; Execute Workflow inputs
mustache-only; Attempt To Convert Types ON; HTTP node Options empty except
timeouts; Ctrl+S after edits).

1. **Load Config** — non-secret constants only: repo owner/name
   (`Cavetta`/`Cavetta`), workflow names (`Database backup`,
   `Backup restore test`), bucket name, daily/monthly prefix strings
   (`Cavetta Backups/Daily/` / `Cavetta Backups/Monthly/` — **exact strings
   to confirm with the owner**; RAW form, the S3 SDK URL-encodes the space),
   publisher key `cavetta-production-n8n`. **No secrets.** (The R2 account
   id lives in the S3 credential's Endpoint field, not in the workflow.)
2. **Get GitHub Workflow IDs** — `GET /repos/Cavetta/Cavetta/actions/workflows`
   with the fine-grained GitHub token (Header Auth credential, Cavetta repo
   only, Actions: read); resolve the two workflow ids by name.
3. **Get Backup Runs** — `GET .../actions/workflows/{backupId}/runs?per_page=30`
   (recent `Database backup` runs: conclusion, created_at, updated_at, run
   number/id, html_url).
4. **Get Restore Runs** — same for the restore-test workflow id.
5. **List R2 Daily** — n8n **S3 node** (NOT the AWS S3 node): File → Get
   Many, Return All ON, Bucket Name and Prefix from Load Config, wired to
   the `Cloudflare R2 S3 Read Only` **S3 credential** (Access Key ID +
   Secret Access Key from the bucket-scoped Object Read & List R2 token,
   Endpoint `https://<account id>.r2.cloudflarestorage.com`, Region `auto`,
   Force Path Style ON). R2 requires AWS4-HMAC-SHA256 SigV4 signing — plain
   `Authorization: Bearer` is rejected (live finding, see the activation
   record below). **Metadata only: key, size, last-modified. Never GET an
   object.**
6. **List R2 Monthly** — same with the monthly prefix.
7. **Normalize Backups** (Code node; harness-verified, see below) — join +
   omit-never-guess + diagnostics output for first-run VERIFY.
8. **Build Records** — strict envelope/payload allowlists.
9. **Publish Evidence** — wired exactly like Phase 6/7 to
   `CloudIT - Publish Operations Evidence v2` (name-mode selector From list).

**Pagination decision (revised 15 Sep 2026):** the two listings use the
S3 node's **Return All** mode, which auto-paginates — a truncated listing
cannot occur, so the original `max-keys=1000` cap and the
`truncated_listing` handling are superseded (the diagnostics key stays in
the contract, always 0). The inventory is bounded by retention (~30 daily
+ ~12 monthly objects ≈ 45). The Load Config comment records this; the
owner confirms the object count at activation.

### Normalize join rules

**backupKey** — the R2 filename lowercased, extension stripped:
`daily/cavetta-db-2026-09-14T075617Z.tar.gz.gpg` →
`cavetta-db-2026-09-14t075617z` (matches the table CHECK
`^[a-z0-9][a-z0-9_.-]{1,120}$`). Filename timestamps are parsed with the
literal `YYYY-MM-DDTHHMMSSZ` pattern; anything else is ignored (diagnostics).

**Pairing** — an archive object and its `<key>.sha256` sibling. Only
`*.tar.gz.gpg` objects produce records; a lone `.sha256` produces none
(counted in diagnostics). `checksumFilePresent` = sibling exists in the same
listing.

**Run matching** — each object pairs with the newest `Database backup` run
whose `[created_at, updated_at + 10 min]` window contains the filename
timestamp (the archive is written near the end of the run). Fields from the
run: `runStartedAt`, `runCompletedAt`, `durationMs`, `githubRunKey`
(`<owner>/<repo>/actions/runs/<id>`), `githubRunUrl` (html_url).

**Verification booleans** (contract requires all five, `req_bool`):

- `encryptedArchivePresent` = the archive object exists (true for any record).
- `checksumFilePresent` = the `.sha256` sibling exists.
- Run conclusion `success` → `checksumVerified`, `driveRoundTripPassed`,
  `archiveStructureValidated` = true.
- Run conclusion `failure` with the object present → the workflow's linear
  upload-then-verify chain means the failure is attributable to the
  verification stage → those three booleans = false (status RED). Presence
  booleans still reflect the actual listing.
- **No matching run** (collector gap) → the three verification booleans
  cannot be determined and the contract forbids nulls → **omit the backup
  record entirely** (omit-never-guess) and count it in diagnostics.
- **Failed run with no object at all** → nothing observable to key a record
  on → omit + diagnostics; the portal's missing-day / 28 h-no-success rules
  surface the RED.

**Restore tests** — each completed restore-test run produces one
`restore_test_evidence` record:

- `restoreTestKey` = `restore-<run id>`; `backupKey` = the newest backup of
  the tested retention class whose `backup_timestamp` is at or before the
  restore start. If no such backup is published yet → omit + diagnostics
  (the next scheduled run reconciles).
- `sourceRetentionClass`: (1) `display_title` containing `daily`/`monthly`
  (case-insensitive, manual dispatches), else (2) `event == "schedule"` →
  `monthly` (the documented day-2 test of the monthly copy), else (3)
  undeterminable → omit + diagnostics.
- `result` from conclusion (`success` → `passed`, `failure` → `failed`).
  On success the eight `*Passed` booleans = true. On failure the eight
  booleans are **omitted** (the columns and payload keys are nullable;
  publishing `result: "failed"` with no per-step claims surfaces RED without
  guessing which step failed).
- If the linked backup row doesn't exist in the DB yet, the ingest writer
  fails the batch with `unknown_backup` — so Build Records orders backup
  records before restore records within the same batch and the Normalize
  match rule above makes a same-batch link possible; still, a restore whose
  backup cannot be linked is omitted rather than risk a whole-batch
  rejection.

**Idempotency keys** — `backup-<backupKey>`, `restore-<restoreTestKey>`,
`backup-conn-github-<YYYY-MM-DD>`, `backup-conn-r2-<YYYY-MM-DD>`. The tables
upsert on natural keys, so scheduled re-runs reconcile changed conclusions
instead of duplicating.

**Envelope** — `status`: GREEN when the run succeeded and the pair is
complete; RED on failed run / missing sibling / missing archive;
`severity` `critical` for RED else `info`. `freshUntil`: backup records
observedAt + 28 h (Phase 0 §11.1 backup freshness); restore records
observedAt + 35 days; connectivity observedAt + 28 h. `correlationKey`: the
`backupKey` links a restore record to its backup.

**Failure path** — if either provider call fails, the run publishes only the
unreachable `provider_connection`(s) with a closed-allowlist
`failureCategory` (e.g. `authentication`, `authorization`,
`provider_unavailable`), exactly like the Phase 7 collectors.

**Harness verification** (before the template ships): the Normalize code is
executed locally against mocked GitHub/R2 responses — success, failed run,
missing `.sha256` sibling, unmatched run, undeterminable retention class,
truncated listing, R2 401/403/500 — asserting envelope/payload allowlists,
idempotency stability, key formats, omit-never-guess and the diagnostics
output. The paste file `normalize-backups-code.js` is written to
`cloudit-operations-portal-transfer/docs/n8n-collectors/` (untracked local
working copy in the MAIN checkout — the owner pastes from local files only,
never from chat).

## Portal read path (additive, mirrors Phase 7 conventions)

### platform-api

- `GET /api/operations/backups` → `BackupsResponse` (interface in
  `operations.service.ts`):
  - rollup status + reasons;
  - calendar for the current month: one entry per day (state `ok` /
    `failed` / `missing` / `future`), daily retention class only;
  - latest backup card: timestamp, age, duration, GitHub run link, the five
    booleans (rendered as Encrypted / Checksum present / Checksum verified /
    R2 round trip / Archive structure), size, retention class;
  - size trend points (recent daily backups, newest last);
  - latest restore test: result, age, run link, the eight booleans;
  - expected next run + overdue state;
  - `generatedAt`.
  - **`drive_object_key` is never selected.** Query is SELECT-only on
    `operations.backup_evidence` + `operations.restore_tests` joined to
    active clients, as `operations_owner` (RLS `cloud_owner`).
- `computeBackupsRollupStatus` in `health.util.ts` with unit tests. Per
  Phase 0 §11.1/§11.2 (spec ~lines 453–455, 481–484):
  - **RED** — the latest backup failed (failed run / failed verification /
    missing pair), or no successful backup within 28 h;
  - **AMBER** — the latest backup is overdue more than 30 minutes past the
    expected run time, or the restore test is older than 32 days, or the
    current month's copy is missing after the reconciliation grace window;
  - **NO_DATA** — no backup evidence at all;
  - **GREEN** — everything else. A failed restore test (`result: "failed"`)
    is RED per spec line 484.

### operations-web

- `OperationsBackups` interface + `getOperationsBackups()` in
  `lib/operations-api.ts`.
- `components/backups-page.tsx` following `components/vercel-page.tsx`
  (async server component, HealthPill header, ops-card / ops-def-list /
  ops-table markup, `formatMaltaTime` / `formatAge` / `formatDuration` from
  `lib/operations-time.ts`, local `formatBytes` copy as `imagekit-page.tsx`
  does, hand-rolled SVG calendar + size sparkline).
- Dispatch line in `app/(portal)/[section]/[[...detail]]/page.tsx` for
  `section === "backups"` (nav entry and allowlist already exist; the
  placeholder is removed).
- Labels read "R2 round trip", never Drive.

## Local verification (before owner activation)

1. Migration 0008: fresh apply 0001→0008 + idempotent re-run in a throwaway
   pg16 container; ingest proof in a rolled-back transaction; isolation suite
   (the known pre-existing `owner_sees_all_clients` baseline failure, if still
   present, is documented as such).
2. Collector template: valid JSON; no Phase 6/7 UUID reuse; every Code node
   harness-executed (see above).
3. platform-api: `tsc` clean; eslint clean; jest all green including new
   `computeBackupsRollupStatus` tests.
4. operations-web: typecheck clean; eslint clean; production build green.
5. End-to-end against a throwaway database with synthetic backup/restore
   evidence: page renders calendar, latest card, restore card; object key
   absent from the API response (asserted in the test).

## Gate verification (pending owner, mirrors Phase 7)

1. Owner provisions two n8n credentials: fine-grained **GitHub** token
   (Cavetta repo only, Actions: read) as a Header Auth credential
   (`Authorization: Bearer <token>`), and **Cloudflare R2** API token
   (bucket-scoped, Object Read & List) as a Header Auth credential
   (`Authorization: Bearer <token>`). Owner fills R2 account id, bucket name
   and the exact prefix strings in Load Config.
2. Owner imports the workflow **inactive**, runs it manually once (full
   Execute Workflow run, never a step re-run), checks the Normalize
   diagnostics against the VERIFY notes, confirms the `accepted` receipt in
   `operations.ingestion_receipts` with the expected counts, then replays one
   run to confirm `duplicates` with no new rows. Then activate.
3. **Gate:** match one displayed backup to its encrypted R2 object
   (metadata: key, size, last-modified), its `.sha256` sibling, the GitHub
   Actions run and the n8n receipt — without opening or decrypting the
   archive. Record results here and stop for explicit owner approval.
   No Phase 9 until approved.

## Rollback

The collector is new and independent: deactivate + delete restores the
pre-Phase-8 state; portal page removal is one dispatch line + one component;
no existing data or workflow is modified. (Deployed rollback of the portal
code is a separately approved action.)

## Open questions for the owner

1. R2 account id, bucket name, exact daily/monthly prefix strings (the
   screenshot showed objects but not prefixes).
2. Current daily backup schedule time (old spec 02:17 UTC; the 14 Sep run
   was ~05:56 UTC) — sets the collector schedule and the expected-next-run
   display.
3. GitHub token: does a fine-grained token with Cavetta-repo Actions read
   already exist, or create one?
4. Did the restore-test workflow names/inputs change with the R2 move?
5. Approve the two 0008 changes (sourceSystem allowlist + provider CHECK
   widening) and the truncation-over-pagination decision.

## Live activation record (15 September 2026)

First manual run of the imported collector (owner-executed, full run):

- **Defect found — `invalid_provider` (fixed, migration 0009).** 0008 widened
  the `operations.provider_connections` table CHECK and the envelope
  `sourceSystem` allowlist, but the 0005 writer
  `operations_ingest.insert_provider_connection` validates `payload.provider`
  against its OWN hardcoded enum — which still rejected `cloudflare_r2`. The
  first run's failure-path record (R2 unreachable, see below) was rejected
  with `invalid_provider` / `rejected_validation`. The 0008 verification had
  exercised the table CHECK via a direct INSERT but not the writer path;
  lesson recorded: provider-enum changes must always be proven through
  `submit_batch`, never around it. Fix: `0009_provider_connection_writer.sql`
  re-creates the writer with `'cloudflare_r2'` added (body otherwise
  byte-identical to 0005; `CREATE OR REPLACE`, idempotent). Verified in a
  throwaway pg16 container: fresh apply 0001→0009, 0009 re-run, and the exact
  live envelope accepted through `submit_batch` (`accepted: 1`), replay
  returning `duplicates: 1` with no new row.
- **R2 listing unreachable from n8n — `write EPROTO … SSL alert number 40`
  (handshake failure) on both `List R2` nodes.** GitHub API calls succeeded
  from the same run, so outbound HTTPS works generally; the failure is
  specific to the TLS handshake with `*.r2.cloudflarestorage.com` from the
  n8n host (old Node/OpenSSL, or egress TLS inspection). The collector's
  failure path behaved as designed: only an unreachable
  `provider_connection` was built and `diagnostics.r2Failed: true` was set.
  **Root cause found (same day):** the workflow had been imported BEFORE the
  config-values push landed, so `account_REPLACE_ME` was still in Load
  Config — the SNI `account_REPLACE_ME.r2.cloudflarestorage.com` does not
  exist, which is what produced TLS alert 40. TLS was never truly broken;
  filling the real config values and re-importing resolved the handshake.
- **R2 rejects Bearer tokens — AWS4-HMAC-SHA256 required (template
  revision).** Once TLS was fixed, the plain `Authorization: Bearer` Header
  Auth calls failed again: R2 first demanded `x-amz-content-sha256`, and
  with that header added it responded `InvalidRequest: Please use
  AWS4-HMAC-SHA256`. Full SigV4 signing with the Access Key ID + Secret
  Access Key is mandatory — Header Auth can never work against R2. Revision:
  the two `List R2` HTTP nodes were replaced by n8n **S3 nodes** (File → Get
  Many, Return All ON, prefix via the node's options; credential referenced
  by name `Cloudflare R2 S3 Read Only`, account endpoint
  `https://676d602d0fd48ae086a188f1ee69b857.r2.cloudflarestorage.com`,
  Region `auto`, Force Path Style ON). Load Config now holds the prefixes
  in RAW form (`Cavetta Backups/Daily/`, `Cavetta Backups/Monthly/` — the
  SDK URL-encodes), and the dead `r2AccountId`/`maxKeys` constants were
  removed (the account id moved into the credential Endpoint). The Normalize
  node reads the S3 output via $('List R2 ...').all() — one item per object,
  error items shaped `{ error: "<string>" }` — and every
  join/omit/diagnostics rule is unchanged; the full local harness (12
  scenarios, 119 assertions) re-passed against the revised code. Template
  re-committed: `fix(n8n): Phase 8 collector uses S3 node for R2 (SigV4
  required)`.
- Migration 0008 note: applied automatically by the production deploy
  pipeline (`ensure-operations-database.sh`) on 15 Sep 2026 07:05 UTC,
  confirmed in the deploy log.

### First fully GREEN run (15 Sep 2026 12:25 UTC, receipt `3de2792d-0f3c-4149-b0b3-2a88ab355f05`)

After the S3-node revision and config fixes above, a full manual run published
the first real evidence: **7 `backup_evidence` records accepted, 0 rejected,
2 duplicates** (the two `provider_connection` records already accepted under
the same daily idempotency keys that morning — first-write-wins per key,
reconciliation without double rows proven end-to-end).

- **Two config paste defects found and fixed by the owner (traps for future
  collectors):** (1) a dropped opening quote in `restoreWorkflowName`
  (`SyntaxError: Unexpected identifier 'restore'`) — a Code node must be
  re-pasted as a WHOLE block, never line-edited; (2) after fixing the quote,
  `Get Restore Runs` still 404'd because the name no longer matched the
  GitHub workflow name exactly → `workflows.find(...)` returned `undefined`
  → URL `.../workflows/undefined/runs` → GitHub answers 404 "Not Found",
  which reads like a missing repo, not a config typo. A workflow-name lookup
  failure should be surfaced as its own diagnostics counter, not surfaced as
  a provider 404 (deferred: cosmetic, the omit-never-guess behaviour was
  still correct).
- **Zero-object listing stops the chain silently:** `List R2 Monthly`
  matched nothing (no monthly archive exists yet — the folder is not even
  created) and n8n then passes zero items downstream, so Normalize never
  ran and the execution ended green with no publish. Fix: both S3 nodes get
  **Execute Once ON** (otherwise a multi-item input re-runs the listing per
  item — 14× here — and would duplicate objects in `.all()`) and **Always
  Output Data ON** (so an empty listing still emits one item and the chain
  continues; the Normalize code treats it as a healthy empty branch).
- **Evidence quality:** 14 R2 objects = 7 archive + 7 `.sha256` siblings
  (`pairs: 7`, every archive checksummed); all 7 records GREEN with correct
  run join (`created_at`..`updated_at + 10 min` window), sizes 5.98–6.03 MB,
  retentionClass daily, `driveObjectKey` kept server-side; 25 GitHub backup
  runs in history, older/unmatched runs omitted (`omittedNoRun`), the two
  pre-R2-era failure runs correctly never matched.
- **Restore-test runs omitted as designed:** all 8 historical runs are
  `workflow_dispatch` with display title "Backup restore test" (no
  daily/monthly marker) → retention class indeterminable →
  `omittedUnknownClass`, no records. Restore evidence will start landing
  with the first SCHEDULED restore test (`event == "schedule"` implies
  monthly per the contract).
- **Known cosmetic lag:** the morning's RED `backup-conn-github-2026-09-15`
  failure record stays stored (the GREEN re-publish same-day hit the same
  idempotency key → duplicate, skipped). The tile flips GREEN on the next
  day's run under a new date key. Backup records are unaffected.
- **Schedule correction pending:** the observed daily backup lands ~07:48
  UTC (runs 12–15 Sep all start 07:48/07:55/07:29/07:11 UTC — the old
  "02:17 UTC" spec value is wrong); the collector trigger must run ~1h
  AFTER the backup, i.e. ~09:00 UTC, not 07:00.
- Portal `/backups` verification against the live API and the Phase 8 gate
  (match one displayed backup to R2 object + checksum + GitHub run + n8n
  receipt, owner sign-off) remain open at the time of writing.

## Explicitly not done in Phase 8

- No backup download, decryption or restore, ever, through the portal.
- No `drive_object_key` in any browser payload; no "Open in Drive" / "Open
  in R2" action.
- No changes to existing migrations, workflows, databases or the n8n
  database; no report actions; ticketing and client notifications remain
  disabled.
- No `backup.*`/`restore.*` metric samples in this phase — the evidence
  tables are the source of truth and the 0006 metric definitions stay
  unused until a later phase needs them.
