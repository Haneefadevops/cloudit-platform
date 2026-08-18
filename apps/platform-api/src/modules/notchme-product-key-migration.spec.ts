import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../prisma/migrations/20260818000000_notchme_product_key/migration.sql',
);

type ProductRow = { id: string; product: 'orbitone' | 'notchme' };

function modelMigration<T extends ProductRow>(
  rows: T[],
  businessKey: (row: T) => string,
  merge: (notchme: T, orbitone: T) => T,
): T[] {
  const oldRows = rows.filter((row) => row.product === 'orbitone');
  const newRows = rows.filter((row) => row.product === 'notchme');
  const newByKey = new Map(newRows.map((row) => [businessKey(row), row]));
  const duplicateOldIds = new Set<string>();

  for (const oldRow of oldRows) {
    const existing = newByKey.get(businessKey(oldRow));
    if (existing) {
      newByKey.set(businessKey(oldRow), merge(existing, oldRow));
      duplicateOldIds.add(oldRow.id);
    }
  }

  return rows
    .filter((row) => !duplicateOldIds.has(row.id))
    .map((row) =>
      row.product === 'orbitone'
        ? { ...row, product: 'notchme' }
        : (newByKey.get(businessKey(row)) ?? row),
    );
}

describe('NotchMe product-key migration safety', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  const tables = [
    'organization_product_modules',
    'organization_provisioning',
    'organization_custom_fields',
    'organization_feature_flags',
  ];

  it('is transactional and does not copy source primary keys with INSERT ... SELECT', () => {
    expect(migration).toContain('BEGIN;');
    expect(migration).toContain('COMMIT;');
    expect(migration).not.toMatch(/INSERT\s+INTO/i);
  });

  it.each(tables)(
    '%s merges duplicates, deletes the old duplicate, then updates remaining rows in place',
    (table) => {
      const section = migration.slice(migration.indexOf(`-- ${table}`));
      const mergeIndex = section.indexOf(`UPDATE "${table}" AS notchme`);
      const deleteIndex = section.indexOf(`DELETE FROM "${table}" AS orbitone`);
      const updateIndex = section.indexOf(
        `UPDATE "${table}"\nSET "product" = 'notchme'`,
      );

      expect(mergeIndex).toBeGreaterThanOrEqual(0);
      expect(deleteIndex).toBeGreaterThan(mergeIndex);
      expect(updateIndex).toBeGreaterThan(deleteIndex);
      expect(section).toContain('WHERE "product" = \'orbitone\';');
    },
  );

  it('merges enabled flags and split provisioning fields without replacing the NotchMe row ID', () => {
    expect(migration).toContain('notchme."enabled" OR orbitone."enabled"');
    expect(migration).toContain(
      'COALESCE(notchme."tenant_id", orbitone."tenant_id")',
    );
    expect(migration).toContain(
      'COALESCE(notchme."set_password_url", orbitone."set_password_url")',
    );
    expect(migration).toContain(
      'GREATEST(notchme."retry_count", orbitone."retry_count")',
    );
  });

  it('models only-old, only-new, duplicate, enabled-conflict, and empty-table outcomes', () => {
    type ModuleRow = ProductRow & {
      orgId: string;
      moduleKey: string;
      enabled: boolean;
    };
    const moduleKey = (row: ModuleRow) => `${row.orgId}:${row.moduleKey}`;
    const mergeModule = (
      notchme: ModuleRow,
      orbitone: ModuleRow,
    ): ModuleRow => ({
      ...notchme,
      enabled: notchme.enabled || orbitone.enabled,
    });

    expect(modelMigration([], moduleKey, mergeModule)).toEqual([]);
    expect(
      modelMigration(
        [
          {
            id: 'old-only',
            product: 'orbitone',
            orgId: 'org-1',
            moduleKey: 'crm',
            enabled: false,
          },
        ],
        moduleKey,
        mergeModule,
      ),
    ).toEqual([
      {
        id: 'old-only',
        product: 'notchme',
        orgId: 'org-1',
        moduleKey: 'crm',
        enabled: false,
      },
    ]);
    expect(
      modelMigration(
        [
          {
            id: 'new-only',
            product: 'notchme',
            orgId: 'org-1',
            moduleKey: 'crm',
            enabled: false,
          },
        ],
        moduleKey,
        mergeModule,
      ),
    ).toEqual([
      {
        id: 'new-only',
        product: 'notchme',
        orgId: 'org-1',
        moduleKey: 'crm',
        enabled: false,
      },
    ]);
    expect(
      modelMigration(
        [
          {
            id: 'old-duplicate',
            product: 'orbitone',
            orgId: 'org-1',
            moduleKey: 'crm',
            enabled: true,
          },
          {
            id: 'new-duplicate',
            product: 'notchme',
            orgId: 'org-1',
            moduleKey: 'crm',
            enabled: false,
          },
        ],
        moduleKey,
        mergeModule,
      ),
    ).toEqual([
      {
        id: 'new-duplicate',
        product: 'notchme',
        orgId: 'org-1',
        moduleKey: 'crm',
        enabled: true,
      },
    ]);
  });

  it('models provisioning fields split across duplicate OrbitOne and NotchMe rows', () => {
    type ProvisioningRow = ProductRow & {
      orgId: string;
      tenantId: string | null;
      userId: string | null;
      inviteToken: string | null;
      setPasswordUrl: string | null;
      retryCount: number;
    };
    const result = modelMigration<ProvisioningRow>(
      [
        {
          id: 'old',
          product: 'orbitone',
          orgId: 'org-1',
          tenantId: 'tenant-1',
          userId: null,
          inviteToken: 'old-token',
          setPasswordUrl: null,
          retryCount: 2,
        },
        {
          id: 'new',
          product: 'notchme',
          orgId: 'org-1',
          tenantId: null,
          userId: 'user-1',
          inviteToken: null,
          setPasswordUrl: 'https://notchme.test/invite',
          retryCount: 1,
        },
      ],
      (row) => row.orgId,
      (notchme, orbitone) => ({
        ...notchme,
        tenantId: notchme.tenantId ?? orbitone.tenantId,
        userId: notchme.userId ?? orbitone.userId,
        inviteToken: notchme.inviteToken ?? orbitone.inviteToken,
        setPasswordUrl: notchme.setPasswordUrl ?? orbitone.setPasswordUrl,
        retryCount: Math.max(notchme.retryCount, orbitone.retryCount),
      }),
    );

    expect(result).toEqual([
      {
        id: 'new',
        product: 'notchme',
        orgId: 'org-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        inviteToken: 'old-token',
        setPasswordUrl: 'https://notchme.test/invite',
        retryCount: 2,
      },
    ]);
  });
});
