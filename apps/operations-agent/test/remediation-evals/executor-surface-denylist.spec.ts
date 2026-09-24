/**
 * Phase H eval: executor-surface denylist (TEXT-BASED; no value imports from
 * Worker B's modules — files under src/remediation/executor/** are read with
 * fs and asserted textually).
 *
 * The Tier A executor is the only execution path, so its surface is pinned
 * to: the coordinator-owned executor contract, the TierARemediationExecutor
 * class, the readonly-recheck runbook contract constants, and the attempt
 * audit-event builder. No exported symbol may carry an execution-capable
 * name (denylist extended with repair|remediate), no implementation code
 * may contain the dangerous verbs (comments exempt — note the contract-
 * mandated `execute` method itself is the single allowed carrier of that
 * verb and is therefore only denied as an EXTRA exported symbol name), and
 * no banned import source may appear: child_process, fs, net, http/https
 * request clients, fetch/undici/node-fetch, or pg (the attempts module owns
 * the only legitimate pg usage).
 *
 * Contract-shape drift is a loud failure. While only executor-contract.ts
 * exists (Worker B still building), the contract assertions run and the
 * implementation assertions report PENDING-INTEGRATION loudly.
 */

import * as fs from 'fs';
import * as path from 'path';

const EXECUTOR_DIR = path.join(__dirname, '..', '..', 'src', 'remediation', 'executor');
const CONTRACT_FILE = path.join(EXECUTOR_DIR, 'executor-contract.ts');
const RUNBOOK_CONTRACT_FILE = path.join(EXECUTOR_DIR, 'readonly-recheck-runbook.ts');

/** Pinned export set of the coordinator-owned executor contract. */
const CONTRACT_EXPORTS = [
  'REMEDIATION_EXECUTION_OUTCOMES',
  'RemediationExecutionOutcome',
  'RemediationExecutionRequest',
  'RemediationExecutionResult',
  'RemediationExecutor',
  'REMEDIATION_EXECUTOR',
] as const;

/** Denylist applied to exported symbol names (beyond the pinned allowlist). */
const SYMBOL_DENYLIST =
  /\b(execute|run|apply|dispatch|invoke|shell|restart|restore|deploy|credential|decrypt|notify|ticket|delete|drop|repair|remediate)\b/i;

/**
 * Denylist applied to implementation code (comments stripped). `execute` is
 * deliberately absent here: RemediationExecutor.execute is the pinned
 * contract method, so the verb is unavoidable in code; it is instead denied
 * as any additional EXPORTED symbol (SYMBOL_DENYLIST above).
 */
const CODE_DENYLIST =
  /\b(run|apply|dispatch|invoke|shell|restart|restore|deploy|credential|decrypt|notify|ticket|delete|drop|repair|remediate)\b/i;

/** Import sources that must never appear under executor/. */
const BANNED_IMPORT =
  /^(node:)?child_process$|^(node:)?fs$|^(node:)?fs\/promises$|^(node:)?net$|^(node:)?http$|^(node:)?https$|^(node:)?fetch$|^undici$|^node-fetch$|^pg$|^(node:)?dns$|^(node:)?tls$/;

/** Pinned runbook contract facts (operator plan, Tier A allowlist). */
const RUNBOOK_KEY = 'RB-READONLY-RECHECK-001';
const RUNBOOK_ACCEPTED_ISSUE_CODES = ['STATUS_UNKNOWN', 'EVIDENCE_STALE'] as const;
const RUNBOOK_ALLOWED_TARGETS = ['vercel-analytics', 'imagekit-delivery'] as const;

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
const implementationFiles = allFiles.filter((file) => file !== CONTRACT_FILE);
const implementationsPresent = implementationFiles.length > 0;

if (!implementationsPresent) {
  // eslint-disable-next-line no-console
  console.warn(
    'executor-surface-denylist: only executor-contract.ts is present under ' +
      'src/remediation/executor/; implementation assertions are ' +
      'PENDING-INTEGRATION (Worker B Tier A executor).',
  );
}

describe('executor surface — contract shape (pinned, must never drift)', () => {
  it('executor-contract.ts exists', () => {
    expect(fs.existsSync(CONTRACT_FILE)).toBe(true);
  });

  it('executor-contract.ts exports exactly the pinned identifiers', () => {
    const text = fs.readFileSync(CONTRACT_FILE, 'utf8');
    expect(exportedNames(text)).toEqual([...CONTRACT_EXPORTS].sort());
  });

  it('contract declares the six execution outcomes', () => {
    const text = fs.readFileSync(CONTRACT_FILE, 'utf8');
    for (const outcome of [
      'EXECUTED',
      'ALREADY_CLAIMED',
      'BLOCKED_KILL_SWITCH',
      'PRECONDITION_FAILED',
      'CIRCUIT_OPEN',
      'INTERNAL_ERROR',
    ]) {
      expect(text).toContain(outcome);
    }
  });

  it('no contract export name matches the extended execution denylist', () => {
    const text = fs.readFileSync(CONTRACT_FILE, 'utf8');
    for (const name of exportedNames(text)) {
      expect(SYMBOL_DENYLIST.test(name)).toBe(false);
    }
  });
});

describe('executor surface — Worker B implementation (when landed)', () => {
  it(
    implementationsPresent
      ? 'TierARemediationExecutor is exported from tier-a-executor.ts'
      : 'implementation not landed yet — PENDING-INTEGRATION',
    () => {
      if (!implementationsPresent) return;
      const file = implementationFiles.find((f) => f.endsWith('tier-a-executor.ts'));
      expect(file).toBeDefined();
      expect(exportedNames(fs.readFileSync(file!, 'utf8'))).toContain('TierARemediationExecutor');
    },
  );

  it(
    implementationsPresent
      ? 'the readonly-recheck runbook contract pins the allowlisted key/version/issueCodes/targets'
      : 'implementation not landed yet — PENDING-INTEGRATION',
    () => {
      if (!implementationsPresent) return;
      expect(fs.existsSync(RUNBOOK_CONTRACT_FILE)).toBe(true);
      const text = fs.readFileSync(RUNBOOK_CONTRACT_FILE, 'utf8');
      expect(text).toContain(RUNBOOK_KEY);
      expect(text).toContain(`'1'`);
      for (const issueCode of RUNBOOK_ACCEPTED_ISSUE_CODES) {
        expect(text).toContain(issueCode);
      }
      for (const target of RUNBOOK_ALLOWED_TARGETS) {
        expect(text).toContain(target);
      }
      expect(text).toMatch(/RECHECK_MAX_AUTOMATIC_ATTEMPTS\s*=\s*1\b/i);
      expect(text).toMatch(/\bmaxAutomaticAttempts\b/i);
    },
  );

  it(
    implementationsPresent
      ? 'no exported symbol outside the contract matches the extended denylist'
      : 'implementation not landed yet — PENDING-INTEGRATION',
    () => {
      if (!implementationsPresent) return;
      for (const file of implementationFiles) {
        for (const name of exportedNames(fs.readFileSync(file, 'utf8'))) {
          expect(SYMBOL_DENYLIST.test(name)).toBe(false);
        }
      }
    },
  );

  it(
    implementationsPresent
      ? 'no implementation code contains a dangerous execution verb (comments exempt; contract execute method allowed)'
      : 'implementation not landed yet — PENDING-INTEGRATION',
    () => {
      if (!implementationsPresent) return;
      for (const file of implementationFiles) {
        const code = stripComments(fs.readFileSync(file, 'utf8'));
        const match = CODE_DENYLIST.exec(code);
        expect(match).toBeNull();
      }
    },
  );

  it(
    implementationsPresent
      ? 'no file under executor/ imports a banned source (child_process/fs/net/http/fetch/undici/pg)'
      : 'implementation not landed yet — PENDING-INTEGRATION',
    () => {
      if (!implementationsPresent) return;
      for (const file of implementationFiles) {
        const code = stripComments(fs.readFileSync(file, 'utf8'));
        for (const source of importSources(code)) {
          expect(BANNED_IMPORT.test(source)).toBe(false);
        }
      }
    },
  );
});
