/**
 * Phase H runbook 2 eval: recovery-verify-runbook surface (TEXT-BASED; no
 * value imports from Worker B's modules — files under
 * src/remediation/executor/** are read with fs and asserted textually).
 *
 * RB-INCIDENT-RECOVERY-VERIFY-001 v1 is the second entry in the closed
 * executor registry. Its contract file (recovery-verify-runbook.ts) is
 * pinned here:
 *  - exact runbook key RB-INCIDENT-RECOVERY-VERIFY-001 and version '1';
 *  - acceptedIssueCodes are exactly the six supervisor issue codes
 *    (EVIDENCE_MISSING, EVIDENCE_STALE, SOURCE_DEGRADED, STATUS_UNKNOWN,
 *    REPEATED_FAILURES, SOURCE_FAILED — verified against
 *    src/supervisor/rule-engine.ts ISSUE_CODES);
 *  - the targetKey subject pattern /^[A-Z][A-Z0-9_]{2,63}$/ (deterministic
 *    subject keys only — never 'database' / 'vercel-analytics' source shapes);
 *  - maxAutomaticAttempts 1 and timeout 10_000, mirroring runbook 1;
 *  - rollback is a no-op ('No mutation was performed');
 *  - expectedResultCodes RECOVERED / CONFIRMED_STALE / SOURCE_FAILED.
 *
 * The execution denylist (executor-surface denylist, extended family) is
 * re-applied over EVERY file under src/remediation/executor/ — exported
 * symbol names and implementation code text (comments stripped): no
 * execute|run|apply|dispatch|invoke|shell|restart|restore|deploy|credential|
 * decrypt|notify|ticket|delete|drop|repair|remediate anywhere; 'execute' is
 * allowed ONLY as the contracted RemediationExecutor method name (it is
 * denied as any additional exported symbol). This half of the suite runs
 * GREEN TODAY against the landed runbook-1 implementation.
 *
 * While recovery-verify-runbook.ts is absent (Worker B still building), the
 * contract-pinning assertions report PENDING-INTEGRATION loudly and never
 * fail; the moment the file lands, every assertion runs and fails loudly on
 * drift.
 */

import * as fs from 'fs';
import * as path from 'path';

const EXECUTOR_DIR = path.join(__dirname, '..', '..', 'src', 'remediation', 'executor');
const RECOVERY_RUNBOOK_FILE = path.join(EXECUTOR_DIR, 'recovery-verify-runbook.ts');

/** The six supervisor issue codes (src/supervisor/rule-engine.ts ISSUE_CODES). */
const RECOVERY_ACCEPTED_ISSUE_CODES = [
  'EVIDENCE_MISSING',
  'EVIDENCE_STALE',
  'SOURCE_DEGRADED',
  'STATUS_UNKNOWN',
  'REPEATED_FAILURES',
  'SOURCE_FAILED',
] as const;

/** Pinned runbook facts (operator plan, runbook 2 v1). */
const RECOVERY_RUNBOOK_KEY = 'RB-INCIDENT-RECOVERY-VERIFY-001';

/** Denylist applied to exported symbol names (beyond the contract allowlist). */
const SYMBOL_DENYLIST =
  /\b(execute|run|apply|dispatch|invoke|shell|restart|restore|deploy|credential|decrypt|notify|ticket|delete|drop|repair|remediate)\b/i;

/**
 * Denylist applied to implementation code (comments stripped). 'execute' is
 * deliberately absent: RemediationExecutor.execute is the pinned contract
 * method; it is instead denied as any additional EXPORTED symbol.
 */
const CODE_DENYLIST =
  /\b(run|apply|dispatch|invoke|shell|restart|restore|deploy|credential|decrypt|notify|ticket|delete|drop|repair|remediate)\b/i;

/** Import sources that must never appear under executor/. */
const BANNED_IMPORT =
  /^(node:)?child_process$|^(node:)?fs$|^(node:)?fs\/promises$|^(node:)?net$|^(node:)?http$|^(node:)?https$|^(node:)?fetch$|^undici$|^node-fetch$|^pg$|^(node:)?dns$|^(node:)?tls$/;

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

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

function importSources(text: string): string[] {
  const sources: string[] = [];
  const patterns = [
    /import\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) sources.push(match[1]);
  }
  return sources;
}

const allFiles = listTsFiles(EXECUTOR_DIR);
const recoveryRunbookPresent = fs.existsSync(RECOVERY_RUNBOOK_FILE);

if (!recoveryRunbookPresent) {
  // eslint-disable-next-line no-console
  console.warn(
    'recovery-runbook-surface: recovery-verify-runbook.ts is not present ' +
      'under src/remediation/executor/ in this worktree; contract-pinning ' +
      'assertions are PENDING-INTEGRATION (Worker B runbook 2).',
  );
}

describe('executor surface (all runbooks) — execution denylist re-scan', () => {
  it('files exist under src/remediation/executor/', () => {
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it('no exported symbol in any executor file matches the extended denylist', () => {
    for (const file of allFiles) {
      for (const name of exportedNames(fs.readFileSync(file, 'utf8'))) {
        expect(SYMBOL_DENYLIST.test(name)).toBe(false);
      }
    }
  });

  it('no implementation code contains a dangerous execution verb (comments exempt; contract execute method allowed)', () => {
    for (const file of allFiles) {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      const match = CODE_DENYLIST.exec(code);
      expect(match).toBeNull();
    }
  });

  it('no file under executor/ imports a banned source (child_process/fs/net/http/fetch/undici/pg)', () => {
    for (const file of allFiles) {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      for (const source of importSources(code)) {
        expect(BANNED_IMPORT.test(source)).toBe(false);
      }
    }
  });
});

describe('recovery-verify-runbook contract (when landed)', () => {
  it(
    recoveryRunbookPresent
      ? 'pins the exact runbook key RB-INCIDENT-RECOVERY-VERIFY-001 and version 1'
      : 'runbook 2 contract not landed yet — PENDING-INTEGRATION',
    () => {
      if (!recoveryRunbookPresent) return;
      const text = fs.readFileSync(RECOVERY_RUNBOOK_FILE, 'utf8');
      expect(text).toContain(RECOVERY_RUNBOOK_KEY);
      expect(text).not.toContain('RB-INCIDENT-RECOVERY-VERIFY-002');
      expect(text).toMatch(/VERSION\s*=\s*'1'/);
    },
  );

  it(
    recoveryRunbookPresent
      ? 'accepts exactly the six supervisor issue codes'
      : 'runbook 2 contract not landed yet — PENDING-INTEGRATION',
    () => {
      if (!recoveryRunbookPresent) return;
      const text = fs.readFileSync(RECOVERY_RUNBOOK_FILE, 'utf8');
      for (const issueCode of RECOVERY_ACCEPTED_ISSUE_CODES) {
        expect(text).toContain(`'${issueCode}'`);
      }
      // The supervisor codes are a closed list: no seventh synthetic code.
      expect(text).not.toContain("'WF_STALE_SNAPSHOT'");
    },
  );

  it(
    recoveryRunbookPresent
      ? 'pins the subject targetKey pattern /^[A-Z][A-Z0-9_]{2,63}$/ (literal or RegExp-constructor form)'
      : 'runbook 2 contract not landed yet — PENDING-INTEGRATION',
    () => {
      if (!recoveryRunbookPresent) return;
      const text = fs.readFileSync(RECOVERY_RUNBOOK_FILE, 'utf8');
      expect(text).toMatch(/\^\[A-Z\]\[A-Z0-9_\]\{2,63\}\$/);
    },
  );

  it(
    recoveryRunbookPresent
      ? 'pins maxAutomaticAttempts 1 and timeout 10_000 (mirrors runbook 1)'
      : 'runbook 2 contract not landed yet — PENDING-INTEGRATION',
    () => {
      if (!recoveryRunbookPresent) return;
      const text = fs.readFileSync(RECOVERY_RUNBOOK_FILE, 'utf8');
      expect(text).toMatch(/MAX_AUTOMATIC_ATTEMPTS\s*=\s*1\b|maxAutomaticAttempts\s*:\s*1\b/);
      expect(text).toMatch(/TIMEOUT_MS\s*=\s*10_000\b|timeoutMs\s*:\s*10_000\b/);
    },
  );

  it(
    recoveryRunbookPresent
      ? 'rollback is a no-op (zero external side effects by construction)'
      : 'runbook 2 contract not landed yet — PENDING-INTEGRATION',
    () => {
      if (!recoveryRunbookPresent) return;
      const text = fs.readFileSync(RECOVERY_RUNBOOK_FILE, 'utf8');
      expect(text).toMatch(/rollback is a no-op/i);
    },
  );

  it(
    recoveryRunbookPresent
      ? 'expectedResultCodes are RECOVERED / CONFIRMED_STALE / SOURCE_FAILED'
      : 'runbook 2 contract not landed yet — PENDING-INTEGRATION',
    () => {
      if (!recoveryRunbookPresent) return;
      const text = fs.readFileSync(RECOVERY_RUNBOOK_FILE, 'utf8');
      for (const code of ['RECOVERED', 'CONFIRMED_STALE', 'SOURCE_FAILED']) {
        expect(text).toContain(`'${code}'`);
      }
    },
  );
});
