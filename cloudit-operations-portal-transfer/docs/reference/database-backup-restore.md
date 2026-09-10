# Cavetta database backup, verification, and disaster recovery

## Operating policy

- Backups are automatic; production disaster recovery is always manually authorized.
- Never restore over the live Supabase project.
- Always restore into a new, empty Supabase project and validate it before changing Vercel.
- Never place database URLs, passwords, encryption passwords, rclone configuration, service-role keys, or decrypted backups in repository files, issues, logs, or chat.
- A backup is considered verified only after an isolated restore test passes.

## What is protected

The `Database backup` GitHub Actions workflow creates a logical Supabase backup every day at 02:17 UTC. It uploads only an AES-256-encrypted archive and its SHA-256 checksum to the dedicated Google Drive account.

Each archive contains:

- `roles.sql`
- `schema.sql`
- `data.sql`
- `manifest.txt`

The logical data dump excludes the Supabase-managed `storage` schema. Cavetta
stores property media in ImageKit, and Supabase Storage object binaries are not
part of a database dump. Excluding version-coupled Storage metadata keeps the
application backup portable across replacement projects whose managed Storage
schema may be newer or older.

Daily files are retained for 30 days. On the first day of each month, the workflow also retains a monthly copy for 366 days.

The backup contains application database records, including properties, landlords, bookings, inquiries, settings, and audit history. It does not contain:

- ImageKit photo binaries
- Supabase-managed Storage metadata or object binaries
- Vercel or Supabase environment secrets
- Recoverable Supabase Auth passwords
- Google Drive or GitHub credentials

## Automatic verification

### Daily Google Drive round trip

After every upload, the backup workflow downloads the stored Google Drive copy into a clean temporary directory and then:

1. Verifies its SHA-256 checksum.
2. Decrypts the downloaded copy.
3. Extracts the archive.
4. Confirms all four required files exist and are non-empty.
5. Deletes the downloaded and decrypted temporary files.

The run fails if any check fails.

### Monthly isolated restore test

The `Backup restore test` workflow runs on the second day of every month at 03:37 UTC. It can also be started manually from GitHub Actions.

The workflow receives the Google Drive configuration and backup encryption password only. It deliberately does not receive the production database URL, Supabase service-role key, or Vercel credentials.

It performs the following checks inside an ephemeral local Supabase database:

1. Downloads the newest encrypted backup and checksum.
2. Verifies, decrypts, and extracts the archive.
3. Starts an isolated Supabase database in Docker.
4. Verifies Supabase's standard platform roles, removes managed Storage table
   data from legacy retained dumps, then restores the application schema and data.
5. Confirms all expected Cavetta tables and the `public_properties` view exist.
6. Confirms localities, properties, and owners contain records.
7. Confirms RLS is enabled on every private base table.
8. Confirms the `anon` role can read `public_properties` but cannot read the `properties` base table.
9. Confirms private/internal columns are absent from `public_properties`.
10. Confirms hidden and recycled properties do not appear in the public view.
11. Deletes the decrypted files and destroys the local database.

Only safe table counts are written to the GitHub summary. Names, contact details, messages, landlord data, and other record contents are never printed.

## Monitoring

1. Open GitHub, then `Cavetta/Cavetta` > **Actions**.
2. Select **Database backup** for daily runs.
3. Select **Backup restore test** for monthly restore tests.
4. A green check means every step passed. A red cross requires investigation.
5. Open a run to view its safe summary and the failed step.

To receive failure emails, open GitHub profile **Settings** > **Notifications** > **System** > **Actions**, enable email, and select failed workflows only.

To run an additional restore test:

1. Open **Actions** > **Backup restore test**.
2. Select **Run workflow**.
3. Choose `Monthly` for the retained monthly checkpoint or `Daily` for the newest daily backup.
4. Select **Run workflow** and wait for a green result.

## Required GitHub Actions secrets

- `SUPABASE_BACKUP_DB_URL`: production Supabase session-pooler URL on port 5432; available only to the backup workflow.
- `BACKUP_ENCRYPTION_PASSWORD`: long random password stored separately in the project password manager.
- `RCLONE_CONFIG_BASE64`: Base64-encoded rclone configuration for the dedicated Google Drive account.

## Manual disaster recovery

This procedure is for a genuine loss, corruption, or unrecoverable failure of the production Supabase project. The production cutover is never scheduled or automatic.

### Phase 1: Declare and contain the incident

1. Confirm that the problem is a database incident rather than an application deployment issue.
2. Record the UTC time the problem was first observed.
3. Tell the owner and agents to stop creating or editing records temporarily.
4. Do not delete, reset, pause, or overwrite the existing Supabase project.
5. Record the current Vercel Supabase environment-variable names and values in the private password manager so they remain available for rollback.
6. In Google Drive, identify the newest backup from before the incident.
7. Check GitHub Actions and prefer a backup whose daily round trip and monthly restore test passed.

### Phase 2: Prepare a replacement Supabase project

1. Create a new Supabase project in the appropriate organization and region.
2. Use a new strong database password and store it in the password manager.
3. Wait until the project reports healthy.
4. Open **Connect** and copy these values privately:
   - Session Pooler hostname and username on port 5432
   - Transaction Pooler URL on port 6543 with `?pgbouncer=true`
   - Project URL
   - Anon key
   - Service-role key
5. Do not add the replacement values to Vercel yet.

### Phase 3: Restore with the guarded Windows assistant

The recovery computer requires:

- The Cavetta repository
- rclone with the `cavetta-drive` remote
- GnuPG (`gpg`)
- PostgreSQL client (`psql`)
- Windows PowerShell

From the repository root, run:

```powershell
powershell -ExecutionPolicy Bypass -File `
  .\scripts\backup\start-disaster-recovery.ps1 `
  -SourceFolder Daily
```

The assistant will:

1. List available backups and ask which one to use.
2. Download and checksum the selected Google Drive copy.
3. Ask GnuPG for the backup encryption password.
4. Extract and validate the logical files.
5. Ask for the replacement Session Pooler hostname, username, and password.
6. Confirm the target is reachable and does not already contain Cavetta tables.
7. Refuse to continue if the target contains Cavetta tables.
8. Require the exact confirmation `RESTORE TO NEW PROJECT`.
9. Verify the replacement project's standard Supabase roles, omit managed
   Storage table data from legacy retained dumps, and restore the Cavetta schema
   and data.
10. Run the shared table, data, RLS, anonymous-access, and privacy checks.
11. Delete decrypted temporary files and clear the database password from the process environment.

The hostname must not include `postgresql://` or the password. The username is normally `postgres.PROJECT_REF`. The password is entered using a hidden prompt.

If the script fails, do not connect Vercel to the replacement project. Preserve the original encrypted backup, review the error, and retry with a fresh project or an earlier verified backup.

### Phase 4: Recreate Supabase Auth access

Logical database backups do not provide reusable Supabase Auth passwords.

1. In the replacement project, open **Authentication** > **Users**.
2. Create the owner account using the approved owner email.
3. Set a strong temporary password and require a secure handover.
4. Copy the new Auth user UUID.
5. In the replacement project's SQL editor, inspect the restored owner row:

```sql
select id, email, auth_user_id, is_active
from owners;
```

6. Link the correct owner row to the new Auth UUID:

```sql
update owners
set auth_user_id = 'NEW_AUTH_USER_UUID'
where email = 'admin@cavetta.mt';
```

7. Confirm exactly one active owner is linked to that Auth UUID.
8. Do not reuse or copy password hashes from the failed project.

### Phase 5: Validate the replacement before cutover

Keep production pointed to the old project while performing these checks.

1. Review the recovery assistant's successful result.
2. Confirm representative totals for properties, landlords, bookings, inquiries, agents, settings, and audit logs.
3. Confirm the owner can authenticate against the replacement project.
4. Confirm RLS is enabled on private tables.
5. Confirm `anon` cannot select from `properties`, `landlords`, `customers`, or other private base tables.
6. Confirm `public_properties` contains no landlord/internal fields.
7. Confirm hidden and recycled listings are absent from `public_properties`.
8. Confirm ImageKit URLs in restored property records still load.
9. Confirm Telegram, ImageKit, and other external-service secrets remain stored safely; these are not supplied by the database backup.
10. Record the selected backup filename and the replacement project reference.

### Phase 6: Manual Vercel cutover

Only perform this phase after Phase 5 passes and the owner authorizes cutover.

1. Open the Cavetta project in Vercel.
2. Update these production environment variables with replacement-project values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` using the transaction pooler on port 6543 with `?pgbouncer=true`
   - `DIRECT_URL` using the session pooler on port 5432
3. Do not alter ImageKit, Telegram, analytics, or unrelated secrets.
4. Trigger one production redeployment.
5. Keep the previous Vercel values in the password manager for rollback.

### Phase 7: Post-cutover acceptance checks

At both desktop and mobile widths:

1. Open the public home page and listings.
2. Open several property detail pages.
3. Confirm hidden listings remain inaccessible.
4. Submit one controlled test inquiry or booking and verify it appears in admin.
5. Log in to `/admin` with the recreated owner account.
6. Create and edit a controlled test record, then remove or archive it through the normal application flow.
7. Confirm public HTML and API responses contain no landlord names, phones, internal streets, internal notes, share tokens, or ImageKit file IDs.
8. Confirm Google Analytics, Search Console resources, ImageKit images, and Telegram notifications still operate.
9. Monitor Vercel and Supabase logs for errors.

### Phase 8: Rollback if cutover validation fails

1. Stop administrative writes and public test submissions.
2. Restore the previous five Supabase-related Vercel values from the password manager.
3. Redeploy production once.
4. Confirm the website is again using the previous project.
5. Do not delete either Supabase project.
6. Diagnose the replacement project privately, or create a fresh replacement and repeat the restore.

Rollback is possible only while the old project and its credentials remain available, which is why the old project must never be deleted during recovery.

### Phase 9: Close the incident

1. After stable operation is confirmed, record:
   - Incident and recovery UTC times
   - Backup filename used
   - Lost-data window, if any
   - Replacement project reference
   - Validation and cutover result
2. Remove all decrypted SQL and archive files from recovery computers.
3. Keep the encrypted `.gpg` file and checksum in Google Drive.
4. Rotate any credential that may have been exposed during the incident.
5. Keep the old project isolated until the owner approves its later retirement.
6. Run a fresh backup and isolated restore test against the recovered production database.

## Manual checksum and decryption fallback

If the recovery assistant is unavailable, download one matching `.tar.gz.gpg` and `.sha256` pair into an empty directory.

Verify in PowerShell:

```powershell
$expected = (Get-Content .\cavetta-db-*.sha256).Split(" ")[0].Trim()
$actual = (Get-FileHash .\cavetta-db-*.tar.gz.gpg -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "Backup checksum does not match." }
```

Decrypt and extract:

```powershell
gpg --output cavetta-restore.tar.gz --decrypt .\cavetta-db-*.tar.gz.gpg
tar -xzf .\cavetta-restore.tar.gz
```

Supabase creates Cavetta's required standard roles (`anon`, `authenticated`, `service_role`, and `postgres`) in every new project. The guarded assistant verifies those roles but does not replay `roles.sql`, because reserved platform-role settings cannot safely be overwritten. Cavetta currently has no custom database roles.

Current backups already exclude managed Storage table data. For a retained
backup created before this exclusion was introduced, use the guarded recovery
assistant above; it safely separates those COPY blocks without displaying their
contents. Do not replay legacy `storage.*` table data into the replacement
project's independently managed Storage schema.

The Cavetta fallback restore sequence for a current backup is:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$NEW_SUPABASE_SESSION_POOLER_URL"
```

Never run this command against the live production connection string.
