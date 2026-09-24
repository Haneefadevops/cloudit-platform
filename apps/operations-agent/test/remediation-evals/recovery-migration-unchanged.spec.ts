/**
 * Phase H runbook 2 eval: recovery-migration-unchanged (standalone; runs
 * GREEN TODAY).
 *
 * RB-INCIDENT-RECOVERY-VERIFY-001 must REUSE the durable attempt ledger
 * (operations.remediation_attempts, migration 0015) — the approved design
 * forbids a runbook-2-specific table. Therefore:
 *  - NO migration file beyond 0015 may exist under
 *    infra/postgres/operations/migrations/ (a 0016_* would violate the
 *    approved design and is a loud failure, not a skip);
 *  - 0015_remediation_attempts.sql must be BYTE-UNCHANGED (SHA-256 pinned
 *    below, computed from the landed file in this worktree).
 *
 * These assertions never skip: runbook 2 must not buy itself new persistence.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'infra', 'postgres', 'operations', 'migrations');
const LEDGER_MIGRATION = path.join(MIGRATIONS_DIR, '0015_remediation_attempts.sql');

/** SHA-256 of the landed 0015_remediation_attempts.sql (bytes as committed). */
const LEDGER_MIGRATION_SHA256 = 'e9c4483defe142220bcbd05a5f02464a578597682e5d58ee38421ceab01d3f42';

function migrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

/** Numeric prefix of a NNNN_name.sql migration file. */
function migrationNumber(fileName: string): number {
  const match = /^(\d{4})_/.exec(fileName);
  return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

describe('recovery runbook — migration reuse (no new persistence)', () => {
  it('the migrations directory exists and contains migration files', () => {
    expect(fs.existsSync(MIGRATIONS_DIR)).toBe(true);
    expect(migrationFiles().length).toBeGreaterThan(0);
  });

  it('0015_remediation_attempts.sql exists (the reusable durable ledger)', () => {
    expect(fs.existsSync(LEDGER_MIGRATION)).toBe(true);
  });

  it('NO migration beyond 0015 exists (runbook 2 must reuse the ledger)', () => {
    const files = migrationFiles();
    const beyond = files.filter((file) => {
      const number = migrationNumber(file);
      return Number.isNaN(number) || number > 15;
    });
    expect(beyond).toEqual([]);
  });

  it('migration sequence has no gaps below the ledger (0001..0015 all present)', () => {
    const numbers = migrationFiles().map(migrationNumber);
    for (let n = 1; n <= 15; n += 1) {
      expect(numbers).toContain(n);
    }
  });

  it('0015_remediation_attempts.sql is byte-unchanged (SHA-256 pinned)', () => {
    const digest = crypto
      .createHash('sha256')
      .update(fs.readFileSync(LEDGER_MIGRATION))
      .digest('hex');
    expect(digest).toBe(LEDGER_MIGRATION_SHA256);
  });
});
