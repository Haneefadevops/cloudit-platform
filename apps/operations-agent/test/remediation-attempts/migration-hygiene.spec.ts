/**
 * Migration hygiene for 0015_remediation_attempts.sql (Worker A, Phase H).
 * The spec reads the migration from the repository so drift between the
 * durable-ledger code and the deployed schema can never go unnoticed.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'infra',
  'postgres',
  'operations',
  'migrations',
  '0015_remediation_attempts.sql',
);

const RESULT_CODES = [
  'RECOVERED',
  'CONFIRMED_STALE',
  'SOURCE_FAILED',
  'PRECONDITION_FAILED',
  'BLOCKED_KILL_SWITCH',
  'TIMED_OUT',
  'INTERNAL_ERROR',
] as const;
const STATUSES = ['RUNNING', 'SUCCEEDED', 'FAILED'] as const;

describe('0015_remediation_attempts.sql migration hygiene', () => {
  const exists = existsSync(MIGRATION_PATH);
  const sql = exists ? readFileSync(MIGRATION_PATH, 'utf8') : '';

  it('exists in infra/postgres/operations/migrations', () => {
    expect(exists).toBe(true);
  });

  it('creates operations.remediation_attempts idempotently', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS operations.remediation_attempts');
  });

  it('makes idempotency_key unique (the exactly-once anchor)', () => {
    expect(sql).toMatch(/UNIQUE\s*\(\s*idempotency_key\s*\)/i);
  });

  it('contains no destructive statements against any object', () => {
    expect(sql).not.toMatch(/^\s*ALTER\s+TABLE\b/im);
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    // No DELETE statement anywhere; the migration's own comment documents
    // the append-only design ("no DELETE by design").
    expect(sql).not.toMatch(/^\s*DELETE\b/im);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('grants privileges scoped to the new table only', () => {
    const grantLines = sql
      .split('\n')
      .filter((line) => /^\s*GRANT\b/i.test(line) && !line.trim().startsWith('--'));
    expect(grantLines.length).toBeGreaterThan(0);
    for (const line of grantLines) {
      expect(line).toContain('operations.remediation_attempts');
      // No other operations.* table may appear on a grant line.
      const otherTables = line.match(/operations\.[a-z_]+/g) ?? [];
      for (const table of otherTables) {
        expect(table).toBe('operations.remediation_attempts');
      }
    }
    // The reader role gains INSERT/UPDATE on this table only; no DELETE.
    const grantText = grantLines.join('\n');
    expect(grantText).toMatch(/GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\b/i);
    expect(grantText).toContain('operations_reader');
    expect(grantText).not.toMatch(/\bDELETE\b/i);
  });

  it('closes the status and result-code enums in CHECK constraints', () => {
    for (const status of STATUSES) {
      expect(sql).toContain(`'${status}'`);
    }
    expect(sql).toMatch(/status\s+IN\s*\(\s*'RUNNING'/i);
    for (const code of RESULT_CODES) {
      expect(sql).toContain(`'${code}'`);
    }
    expect(sql).toMatch(/result_code\s+IS\s+NULL\s+OR\s+result_code\s+IN/i);
  });

  it('documents append-only / exactly-once semantics in a comment', () => {
    const comments = sql
      .split('\n')
      .filter((line) => line.trim().startsWith('--'))
      .join('\n');
    expect(comments).toMatch(/exactly.?once/i);
    expect(comments).toMatch(/append.?only/i);
    expect(comments).toMatch(/idempotency_key unique constraint/i);
  });

  it('carries the lifecycle invariant (finished_at null exactly when RUNNING)', () => {
    expect(sql).toMatch(
      /\(status\s*=\s*'RUNNING'\)\s*=\s*\(finished_at\s+IS\s+NULL\)/i,
    );
  });
});
