import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedDatabase = /^notchme_migration_test(?:_|$)/;
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);

function getClient(): Client {
  if (process.env.NOTCHME_MIGRATION_TEST !== '1') {
    throw new Error('Set NOTCHME_MIGRATION_TEST=1 to run this disposable database test.');
  }

  const databaseUrl = process.env.NOTCHME_MIGRATION_TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Set NOTCHME_MIGRATION_TEST_DATABASE_URL to an explicit test-only database URL.');
  }

  const parsed = new URL(databaseUrl);
  const database = parsed.pathname.replace(/^\//, '');
  if (!localHosts.has(parsed.hostname) || !expectedDatabase.test(database)) {
    throw new Error('The migration test only permits a local notchme_migration_test database.');
  }

  return new Client({ connectionString: databaseUrl });
}

async function seed(client: Client): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(`
      INSERT INTO organizations (id, name, slug, created_at, updated_at)
      VALUES
        ('org-1', 'Migration Test One', 'migration-test-one', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
        ('org-2', 'Migration Test Two', 'migration-test-two', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
        ('org-3', 'Unrelated Product Org', 'unrelated-product-org', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

      INSERT INTO organization_product_modules (id, org_id, product, module_key, enabled, created_at, updated_at)
      VALUES
        ('module-old-only', 'org-1', 'orbitone', 'scheduling', false, '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'),
        ('module-old-duplicate', 'org-1', 'orbitone', 'crm', true, '2026-01-03T00:00:00Z', '2026-01-05T00:00:00Z'),
        ('module-new-duplicate', 'org-1', 'notchme', 'crm', false, '2026-01-04T00:00:00Z', '2026-01-04T00:00:00Z'),
        ('module-new-only', 'org-2', 'notchme', 'analytics', true, '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'),
        ('module-unrelated', 'org-3', 'touchorbit', 'employees', true, '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z');

      INSERT INTO organization_provisioning (id, org_id, product, tenant_id, user_id, status, invited_email, invite_token, set_password_url, invited_at, activated_at, revoked_at, failure_reason, retry_count, created_at, updated_at)
      VALUES
        ('provision-old-only', 'org-2', 'orbitone', 'tenant-old-only', NULL, 'pending', 'old-only@example.test', 'old-only-token', NULL, '2026-01-02T00:00:00Z', NULL, NULL, NULL, 1, '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'),
        ('provision-old-duplicate', 'org-1', 'orbitone', 'tenant-from-old', NULL, 'pending', 'duplicate@example.test', 'token-from-old', NULL, '2026-01-02T00:00:00Z', NULL, NULL, 'old failure', 5, '2026-01-02T00:00:00Z', '2026-01-05T00:00:00Z'),
        ('provision-new-duplicate', 'org-1', 'notchme', NULL, 'user-from-new', 'active', 'duplicate@example.test', NULL, 'https://notchme.test/accept', NULL, '2026-01-04T00:00:00Z', NULL, NULL, 2, '2026-01-03T00:00:00Z', '2026-01-04T00:00:00Z'),
        ('provision-unrelated', 'org-3', 'touchorbit', 'touch-tenant', 'touch-user', 'active', 'touch@example.test', NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z');

      INSERT INTO organization_custom_fields (id, org_id, product, module, entity, field_key, field_label, field_type, options, required, "order", is_active, created_at, updated_at)
      VALUES
        ('field-old-only', 'org-2', 'orbitone', 'crm', 'person', 'source', 'Source', 'text', NULL, false, 1, true, '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'),
        ('field-old-duplicate', 'org-1', 'orbitone', 'crm', 'person', 'priority', 'Priority', 'single_select', '["high"]', true, 2, true, '2026-01-02T00:00:00Z', '2026-01-05T00:00:00Z'),
        ('field-new-duplicate', 'org-1', 'notchme', 'crm', 'person', 'priority', 'Priority', 'single_select', NULL, false, 2, false, '2026-01-03T00:00:00Z', '2026-01-04T00:00:00Z'),
        ('field-unrelated', 'org-3', 'touchorbit', 'employees', 'employee', 'department', 'Department', 'text', NULL, false, 1, true, '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z');

      INSERT INTO organization_feature_flags (id, org_id, product, feature_key, enabled, created_at, updated_at)
      VALUES
        ('flag-old-only', 'org-2', 'orbitone', 'booking', false, '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'),
        ('flag-old-duplicate', 'org-1', 'orbitone', 'ai', true, '2026-01-02T00:00:00Z', '2026-01-05T00:00:00Z'),
        ('flag-new-duplicate', 'org-1', 'notchme', 'ai', false, '2026-01-03T00:00:00Z', '2026-01-04T00:00:00Z'),
        ('flag-unrelated', 'org-3', 'touchorbit', 'payroll', true, '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z');
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function assertMigration(client: Client): Promise<void> {
  const orbitoneRows = await client.query(`
    SELECT COUNT(*)::int AS count FROM (
      SELECT product FROM organization_product_modules
      UNION ALL SELECT product FROM organization_provisioning
      UNION ALL SELECT product FROM organization_custom_fields
      UNION ALL SELECT product FROM organization_feature_flags
    ) products WHERE product = 'orbitone';
  `);
  if (orbitoneRows.rows[0].count !== 0) throw new Error('OrbitOne product rows remain after migration.');

  const modules = await client.query(`SELECT id, product, enabled, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at FROM organization_product_modules WHERE id IN ('module-old-only', 'module-new-duplicate', 'module-unrelated') ORDER BY id`);
  const moduleById = new Map(modules.rows.map((row) => [row.id as string, row]));
  if (moduleById.get('module-old-only')?.product !== 'notchme') throw new Error('OrbitOne-only module did not update in place.');
  if (moduleById.get('module-new-duplicate')?.enabled !== true || moduleById.has('module-old-duplicate') || moduleById.get('module-new-duplicate')?.updated_at !== '2026-01-05 00:00:00') throw new Error('Module duplicate merge did not preserve the NotchMe ID, enabled OR, or latest timestamp.');
  if (moduleById.get('module-unrelated')?.product !== 'touchorbit') throw new Error('Unrelated module changed.');

  const provisioning = await client.query(`SELECT *, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at FROM organization_provisioning WHERE id IN ('provision-old-only', 'provision-new-duplicate', 'provision-unrelated') ORDER BY id`);
  const provisioningById = new Map(provisioning.rows.map((row) => [row.id as string, row]));
  const mergedProvisioning = provisioningById.get('provision-new-duplicate');
  if (provisioningById.get('provision-old-only')?.product !== 'notchme') throw new Error('OrbitOne-only provisioning did not update in place.');
  if (!mergedProvisioning || mergedProvisioning.tenant_id !== 'tenant-from-old' || mergedProvisioning.user_id !== 'user-from-new' || mergedProvisioning.invite_token !== 'token-from-old' || mergedProvisioning.set_password_url !== 'https://notchme.test/accept' || mergedProvisioning.status !== 'active' || mergedProvisioning.retry_count !== 5 || mergedProvisioning.created_at !== '2026-01-02 00:00:00' || mergedProvisioning.updated_at !== '2026-01-05 00:00:00') throw new Error('Provisioning duplicate merge lost split fields, status, retry count, or timestamps.');
  if (provisioningById.get('provision-unrelated')?.product !== 'touchorbit') throw new Error('Unrelated provisioning changed.');

  const fields = await client.query(`SELECT id, product, required, is_active, options, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at FROM organization_custom_fields WHERE id IN ('field-old-only', 'field-new-duplicate', 'field-unrelated') ORDER BY id`);
  const fieldById = new Map(fields.rows.map((row) => [row.id as string, row]));
  if (fieldById.get('field-old-only')?.product !== 'notchme') throw new Error('OrbitOne-only custom field did not update in place.');
  if (fieldById.get('field-new-duplicate')?.required !== true || fieldById.get('field-new-duplicate')?.is_active !== true || !fieldById.get('field-new-duplicate')?.options || fieldById.has('field-old-duplicate') || fieldById.get('field-new-duplicate')?.created_at !== '2026-01-02 00:00:00' || fieldById.get('field-new-duplicate')?.updated_at !== '2026-01-05 00:00:00') throw new Error('Custom-field duplicate merge failed.');
  if (fieldById.get('field-unrelated')?.product !== 'touchorbit') throw new Error('Unrelated custom field changed.');

  const flags = await client.query(`SELECT id, product, enabled, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at FROM organization_feature_flags WHERE id IN ('flag-old-only', 'flag-new-duplicate', 'flag-unrelated') ORDER BY id`);
  const flagById = new Map(flags.rows.map((row) => [row.id as string, row]));
  if (flagById.get('flag-old-only')?.product !== 'notchme') throw new Error('OrbitOne-only feature flag did not update in place.');
  if (flagById.get('flag-new-duplicate')?.enabled !== true || flagById.has('flag-old-duplicate') || flagById.get('flag-new-duplicate')?.created_at !== '2026-01-02 00:00:00' || flagById.get('flag-new-duplicate')?.updated_at !== '2026-01-05 00:00:00') throw new Error('Feature-flag duplicate merge failed.');
  if (flagById.get('flag-unrelated')?.product !== 'touchorbit') throw new Error('Unrelated feature flag changed.');
}

async function assertRollback(client: Client): Promise<void> {
  const migrationPath = resolve(
    process.cwd(),
    'apps/platform-api/prisma/migrations/20260818000000_notchme_product_key/migration.sql',
  );
  const failingMigration = readFileSync(migrationPath, 'utf8').replace(
    /COMMIT;\s*$/,
    'SELECT 1 / 0;\nCOMMIT;\n',
  );
  let failed = false;
  try {
    await client.query(failingMigration);
  } catch {
    failed = true;
  }
  await client.query('ROLLBACK');
  if (!failed) throw new Error('The intentional migration failure did not fail.');

  const oldRows = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM organization_product_modules
    WHERE product = 'orbitone';
  `);
  if (oldRows.rows[0].count !== 2) {
    throw new Error('Forced migration failure did not roll back product-key updates.');
  }
}

async function main(): Promise<void> {
  const action = process.argv[2];
  if (action !== 'seed' && action !== 'assert' && action !== 'rollback') {
    throw new Error('Usage: ts-node scripts/verify-notchme-product-key-migration.ts <seed|assert|rollback>');
  }
  const client = getClient();
  await client.connect();
  try {
    if (action === 'seed') await seed(client);
    else if (action === 'assert') await assertMigration(client);
    else await assertRollback(client);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
