# TouchOrbit Supabase to Platform Postgres Migration

This directory contains a repeatable migration script for moving TouchOrbit data
from the old Supabase project into the platform Postgres database.

## Prerequisites

Provide one source:

- Supabase REST source:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Restored Supabase dump source:
  - Restore the dump into a temporary Postgres database.
  - Set `SOURCE_DATABASE_URL` or `SUPABASE_DB_URL` to that temporary database.

Always provide the target:

- `DATABASE_URL` or `TARGET_DATABASE_URL` for the platform TouchOrbit Postgres
  database.

Run this first against a fresh or empty TouchOrbit database. The script does not
delete or truncate target data.

## Dry Run

```bash
npx ts-node apps/touchorbit-api/scripts/migrate-supabase-to-platform.ts --dry-run
```

For a restored dump:

```bash
npx ts-node apps/touchorbit-api/scripts/migrate-supabase-to-platform.ts --source postgres --dry-run
```

The dry run lists source public tables, skipped system schemas, mapped tables,
sample rows, and expected row counts without writing data.

## Full Run

```bash
npx ts-node apps/touchorbit-api/scripts/migrate-supabase-to-platform.ts --full-run
```

For a restored dump:

```bash
npx ts-node apps/touchorbit-api/scripts/migrate-supabase-to-platform.ts --source postgres --full-run
```

Useful options:

```bash
--only organizations,users,employees
--batch-size 1000
--source-schema-sql-dir _incoming/touchorbit-old/supabase/migrations
```

## Migration Order

The script migrates core tables in this order:

1. organizations
2. users
3. branches, departments
4. employees
5. employee_history, employee_salary_components, employee_salary_structure
6. clock_events, break_events
7. leave_records, leave_balances
8. payroll_runs, payroll_items
9. roster_assignments, employee_shifts, shifts, shift_swap_requests
10. notifications
11. employee_documents, document_templates, sent_documents
12. assets, asset_assignments, asset_categories

Additional matching TouchOrbit tables are migrated afterward when present in both
the source and target schemas.

## Auth and Users

Supabase `auth.users` is not migrated directly.

The script migrates the TouchOrbit public `users` table and maps any old text user
IDs to deterministic UUIDs for the platform `users.id` column. Related user
references such as `employees.user_id`, `created_by`, `approved_by`, and
`terminated_by` are transformed using the same mapping.

Passwords are not migrated. Users must reset passwords in the platform auth
system after migration.

## Output

Each run logs:

- Source public tables.
- System schemas/tables skipped.
- Source-to-target mapped tables.
- Unmapped source tables.
- Missing target tables.
- Per-table source, inserted, skipped, and failed row counts.
- Target row counts after the migration attempt.

Rows are inserted with `ON CONFLICT DO NOTHING`, so existing rows are skipped
rather than overwritten.

## Build Verification

After changing the migration script, verify the API still builds:

```bash
npm.cmd run build --workspace=@cloudit/touchorbit-api
```
