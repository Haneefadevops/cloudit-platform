/**
 * Phase H eval: migration hygiene for infra/postgres/operations/migrations/
 * 0015_remediation_attempts.sql (TEXT-BASED; the SQL file is read with fs).
 *
 * The remediation_attempts table is the durable exactly-once mechanism, so
 * its migration must be: idempotent (IF NOT EXISTS), unique on
 * idempotency_key, strictly additive (no ALTER TABLE / DROP / DELETE), free
 * of secret-shaped column names, GRANT-scoped to remediation_attempts only,
 * seeded with the seven closed result codes and three statuses from the
 * attempt contract, and commented with the append-only/exactly-once intent.
 *
 * If the migration file has not landed yet (Worker A builds it in
 * parallel), this suite SKIPS with a loud PENDING-INTEGRATION message —
 * never fails, never passes silently. Once the file exists, every
 * assertion below runs and fails loudly on drift.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');
const MIGRATION_PATH = path.join(
  REPO_ROOT,
  'infra',
  'postgres',
  'operations',
  'migrations',
  '0015_remediation_attempts.sql',
);

const migrationPresent = fs.existsSync(MIGRATION_PATH);

if (!migrationPresent) {
  // eslint-disable-next-line no-console
  console.warn(
    `migration-hygiene: ${path.relative(REPO_ROOT, MIGRATION_PATH)} is not ` +
      'present in this worktree; entire suite PENDING-INTEGRATION (Worker A).',
  );
}

const describeMigration = migrationPresent ? describe : describe.skip;

/** Strip SQL line comments (-- ...) and block comments (/* ... *\/). */
function stripSqlComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

describeMigration('migration 0015_remediation_attempts — hygiene', () => {
  let raw: string;
  let sql: string;

  beforeAll(() => {
    raw = fs.readFileSync(MIGRATION_PATH, 'utf8');
    sql = stripSqlComments(raw);
  });

  it('creates operations.remediation_attempts idempotently (IF NOT EXISTS)', () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+operations\.remediation_attempts\b/i);
  });

  it('enforces a UNIQUE constraint on idempotency_key', () => {
    expect(sql).toMatch(/UNIQUE\s*\(\s*idempotency_key\s*\)/i);
  });

  it('is strictly additive: no ALTER TABLE, DROP, or DELETE statements', () => {
    expect(sql).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('defines no secret-shaped column names', () => {
    // Column-definition lines look like: `  <name> <type> [,]`. Collect the
    // identifier at the start of each indented line inside the CREATE TABLE.
    const identifiers: string[] = [];
    const columnLine = /^\s{2,}([a-z_][a-z0-9_]*)\s+[A-Za-z]/gm;
    let match: RegExpExecArray | null;
    while ((match = columnLine.exec(sql)) !== null) identifiers.push(match[1]);
    expect(identifiers.length).toBeGreaterThan(0);
    for (const name of identifiers) {
      expect(name).not.toMatch(/\b(password|token|secret|key_material|credential)s?\b/i);
    }
  });

  it('GRANTs reference only remediation_attempts', () => {
    const grants = sql.match(/\bGRANT\b[\s\S]*?;/gi) ?? [];
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) {
      expect(grant).toMatch(/\bON\s+operations\.remediation_attempts\b/i);
      expect(grant).not.toMatch(/\bON\s+(?!operations\.remediation_attempts\b)\w/i);
    }
  });

  it('names all seven closed result codes from the attempt contract', () => {
    for (const code of [
      'RECOVERED',
      'CONFIRMED_STALE',
      'SOURCE_FAILED',
      'PRECONDITION_FAILED',
      'BLOCKED_KILL_SWITCH',
      'TIMED_OUT',
      'INTERNAL_ERROR',
    ]) {
      expect(sql).toContain(code);
    }
  });

  it('names all three attempt statuses from the attempt contract', () => {
    for (const status of ['RUNNING', 'SUCCEEDED', 'FAILED']) {
      expect(sql).toContain(status);
    }
  });

  it('carries a comment evidencing append-only / exactly-once intent', () => {
    expect(raw).toMatch(/append[- ]only/i);
    expect(raw).toMatch(/exactly[- ]once/i);
  });
});
