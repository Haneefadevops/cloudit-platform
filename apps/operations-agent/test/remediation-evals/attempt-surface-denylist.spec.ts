/**
 * Phase H eval: attempt-surface denylist (TEXT-BASED; no value imports from
 * the worker modules — the files are read with fs and asserted textually).
 *
 * The durable attempt store is the exactly-once mechanism for Tier A
 * remediation, so its public surface must stay minimal and free of any
 * execution-capable symbol: no execute/run/apply/dispatch/invoke/shell/
 * restart/restore/deploy/credential/decrypt/notify/ticket/delete/drop name
 * may be exported, and no implementation file may contain those verbs in
 * code (comments are exempt — they are how the intent is documented).
 *
 * Contract-shape drift is a loud failure, not a skip: the pinned export set
 * of attempt-contract.ts must match exactly. Worker A's attempts/**
 * implementation is additionally required to export PgAttemptStore plus a
 * create-prefixed factory; while the directory is absent (worker still
 * building) this suite asserts the contract file only and says so loudly.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_REMEDIATION = path.join(__dirname, '..', '..', 'src', 'remediation');
const CONTRACT_FILE = path.join(SRC_REMEDIATION, 'attempt-contract.ts');
const ATTEMPTS_DIR = path.join(SRC_REMEDIATION, 'attempts');

/** Pinned export set of the coordinator-owned attempt contract. */
const CONTRACT_EXPORTS = [
  'REMEDIATION_ATTEMPT_RESULT_CODES',
  'AttemptResultCode',
  'AttemptStatus',
  'RemediationAttemptRecord',
  'ClaimAttemptInput',
  'FinishAttemptStatus',
  'FinishAttemptInput',
  'AttemptStore',
  'ATTEMPT_STORE',
] as const;

/** Dangerous-verb denylist applied to exported symbol names. */
const SYMBOL_DENYLIST =
  /\b(execute|run|apply|dispatch|invoke|shell|restart|restore|deploy|credential|decrypt|notify|ticket|delete|drop)\b/i;

/** Dangerous-verb denylist applied to implementation code (comments stripped). */
const CODE_DENYLIST =
  /\b(execute|run|apply|dispatch|invoke|shell|restart|restore|deploy|credential|decrypt|notify|ticket|delete|drop)\b/i;

/** Strip block and line comments so intent prose cannot trip the code denylist. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Recursively list .ts files under a directory (empty when absent). */
function listTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full);
  }
  return out.sort();
}

/** Extract every exported identifier from TypeScript source text. */
function exportedNames(text: string): string[] {
  const names = new Set<string>();
  const decl = /export\s+(?:declare\s+)?(?:const|let|var|class|function|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  let match: RegExpExecArray | null;
  while ((match = decl.exec(text)) !== null) names.add(match[1]);
  const brace = /export\s*\{([^}]+)\}/g;
  while ((match = brace.exec(text)) !== null) {
    for (const part of match[1].split(',')) {
      const trimmed = part.trim();
      if (trimmed === '') continue;
      const alias = trimmed.split(/\s+as\s+/);
      names.add((alias[1] ?? alias[0]).trim());
    }
  }
  return [...names].sort();
}

const attemptsFiles = listTsFiles(ATTEMPTS_DIR);
const attemptsPresent = attemptsFiles.length > 0;

if (!attemptsPresent) {
  // eslint-disable-next-line no-console
  console.warn(
    'attempt-surface-denylist: src/remediation/attempts/ is not present in ' +
      'this worktree; asserting the coordinator-owned attempt contract only. ' +
      'PENDING-INTEGRATION (Worker A attempt store).',
  );
}

describe('attempt surface — contract shape (pinned, must never drift)', () => {
  it('attempt-contract.ts exists', () => {
    expect(fs.existsSync(CONTRACT_FILE)).toBe(true);
  });

  it('attempt-contract.ts exports exactly the pinned identifiers', () => {
    const text = fs.readFileSync(CONTRACT_FILE, 'utf8');
    expect(exportedNames(text)).toEqual([...CONTRACT_EXPORTS].sort());
  });

  it('contract exposes the five AttemptStore methods (claim/finish/finalizeStaleRunning/get/findByIdempotencyKey)', () => {
    const text = fs.readFileSync(CONTRACT_FILE, 'utf8');
    for (const method of [
      'claim',
      'finish',
      'finalizeStaleRunning',
      'get',
      'findByIdempotencyKey',
    ]) {
      expect(text).toMatch(new RegExp(`\\b${method}\\s*\\(`));
    }
  });

  it('no contract export name matches the execution denylist', () => {
    const text = fs.readFileSync(CONTRACT_FILE, 'utf8');
    for (const name of exportedNames(text)) {
      expect(SYMBOL_DENYLIST.test(name)).toBe(false);
    }
  });
});

describe('attempt surface — attempts module (Worker A)', () => {
  it(
    attemptsPresent
      ? 'attempts/** exists and exports PgAttemptStore plus a create-prefixed factory'
      : 'attempts/** not landed yet — PENDING-INTEGRATION (contract-only assertion above)',
    () => {
      if (!attemptsPresent) return; // pending: Worker A has not landed the store yet
      const allNames = attemptsFiles.flatMap((file) =>
        exportedNames(fs.readFileSync(file, 'utf8')),
      );
      expect(allNames).toContain('PgAttemptStore');
      expect(allNames.some((name) => /^createPgAttempt/i.test(name))).toBe(true);
    },
  );

  it(
    attemptsPresent
      ? 'no exported symbol in attempts/** matches the execution denylist'
      : 'attempts/** not landed yet — PENDING-INTEGRATION',
    () => {
      if (!attemptsPresent) return;
      for (const file of attemptsFiles) {
        for (const name of exportedNames(fs.readFileSync(file, 'utf8'))) {
          expect(SYMBOL_DENYLIST.test(name)).toBe(false);
        }
      }
    },
  );

  it(
    attemptsPresent
      ? 'no implementation code in attempts/** contains a dangerous execution verb (comments exempt)'
      : 'attempts/** not landed yet — PENDING-INTEGRATION',
    () => {
      if (!attemptsPresent) return;
      for (const file of attemptsFiles) {
        const code = stripComments(fs.readFileSync(file, 'utf8'));
        const match = CODE_DENYLIST.exec(code);
        expect(match).toBeNull();
      }
    },
  );
});
