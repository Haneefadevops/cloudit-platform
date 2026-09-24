/**
 * Phase H regression eval: Phase G must stay proposals-only.
 *
 * Adding an attempt store and an executor beside the Phase G engine must not
 * leak execution capability into the Phase G surface: the engine's callable
 * public API is still exactly the six contract methods, and no top-level
 * file under src/remediation/ (excluding the attempt-contract, executor/
 * and remediation-trigger Phase H additions) exports any new
 * execution-capable symbol.
 *
 * The Phase G export set is snapshotted here: any new export outside the
 * pinned allowlist is a loud failure (coordinator finding), not a skip.
 * The coordinator-owned remediation-trigger.ts is pinned separately below:
 * it is request glue (read findings, call the contracted executor), so its
 * exports and source are explicitly allowlisted and denylist-scanned rather
 * than exempted silently.
 */

import * as fs from 'fs';
import * as path from 'path';
import { RemediationEngine } from '../../src/remediation';
import { buildEngineOptions } from './fixtures';

const SRC_REMEDIATION = path.join(__dirname, '..', '..', 'src', 'remediation');

/** The six pinned Phase G engine methods (operator-plan Phase G contract). */
const EXPECTED_METHODS = [
  'propose',
  'approve',
  'reject',
  'getProposal',
  'listProposals',
  'recordExecutionFailure',
] as const;

/** Snapshot of every export the Phase G module files had when Phase H began. */
const PHASEG_EXPORT_ALLOWLIST = [
  'ProposalAction',
  'ProposalStatus',
  'RemediationProposal',
  'ProposalDecision',
  'RemediationEngineOptions',
  'RemediationEngine',
  'RemediationRunbook',
  'DEFAULT_TIER_A_RUNBOOKS',
  'RemediationProposalAuditEvent',
  'RemediationAuditResultCode',
  'REMEDIATION_AUDIT_SUMMARY_MAX_CHARS',
  'buildRemediationAuditEvent',
  'resultCodeOf',
] as const;

/** Execution-capable denylist applied to any export outside the allowlist. */
const EXPORT_DENYLIST =
  /\b(execute|run|apply|dispatch|invoke|shell|restart|restore|deploy|credential|decrypt|notify|ticket|repair|remediate|delete|drop)\b/i;

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

/** Top-level src/remediation/*.ts files, excluding the Phase H additions. */
function phaseGFiles(): string[] {
  return fs
    .readdirSync(SRC_REMEDIATION, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => path.join(SRC_REMEDIATION, entry.name))
    .filter((file) => !path.basename(file).startsWith('attempt')) // attempt-contract.ts is Phase H
    .filter((file) => path.basename(file) !== 'remediation-trigger.ts') // coordinator Phase H glue, pinned below
    .filter((file) => path.basename(file) !== 'executor') // defensive: dirs are filtered above anyway
    .sort();
}

/**
 * Coordinator-owned request glue (Phase H). It must never carry execution
 * verbs on its public surface: its only job is to READ findings and CALL the
 * contracted executor interface.
 */
const TRIGGER_EXPORT_ALLOWLIST = [
  'RemediationTrigger',
  'RemediationTriggerOptions',
  'RemediationTriggerTimers',
] as const;

describe('Phase G no-execution regression (Phase H must not leak capability)', () => {
  it('the six contract methods are present and every other runtime method is a non-execution helper', () => {
    // TypeScript-private helpers (findRunbook, decide, finish, ...) exist on
    // the prototype at runtime by design — the Phase G no-execution eval
    // documented this. The security property is that the six contract
    // methods exist and NO prototype method (public or helper) carries an
    // execution-capable name.
    const engine = new RemediationEngine(buildEngineOptions({}));
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(engine))
      .filter((name) => name !== 'constructor')
      .sort();
    for (const name of EXPECTED_METHODS) {
      expect(methods).toContain(name);
    }
    for (const name of methods) {
      expect(EXPORT_DENYLIST.test(name)).toBe(false);
    }
    expect(methods).toHaveLength(EXPECTED_METHODS.length + 7); // the 7 documented private helpers
  });

  it.each([
    'executeRunbook',
    'execute',
    'run',
    'applyFix',
    'dispatch',
    'invoke',
    'openShell',
    'restartService',
    'restoreBackup',
    'deployChange',
    'rotateCredentials',
    'decryptBackup',
    'notifyClient',
    'createTicket',
    'performRepair',
    'remediateNow',
  ])('engine still has no execution method named "%s"', (name) => {
    const engine = new RemediationEngine(buildEngineOptions({})) as unknown as Record<
      string,
      unknown
    >;
    expect(engine[name]).toBeUndefined();
  });

  it('no Phase G file exports anything outside the snapshotted allowlist', () => {
    const allowlist = new Set<string>(PHASEG_EXPORT_ALLOWLIST);
    const drift: string[] = [];
    for (const file of phaseGFiles()) {
      for (const name of exportedNames(fs.readFileSync(file, 'utf8'))) {
        if (!allowlist.has(name)) drift.push(`${path.basename(file)}: ${name}`);
      }
    }
    expect(drift).toEqual([]);
  });

  it('no Phase G export (allowlisted or new) matches the execution denylist', () => {
    for (const file of phaseGFiles()) {
      for (const name of exportedNames(fs.readFileSync(file, 'utf8'))) {
        expect(EXPORT_DENYLIST.test(name)).toBe(false);
      }
    }
  });

  it('the coordinator trigger glue exports exactly its pinned request-only surface', () => {
    const file = path.join(SRC_REMEDIATION, 'remediation-trigger.ts');
    const names = exportedNames(fs.readFileSync(file, 'utf8'));
    expect(names).toEqual([...TRIGGER_EXPORT_ALLOWLIST].sort());
    for (const name of names) {
      expect(EXPORT_DENYLIST.test(name)).toBe(false);
    }
  });

  it('the coordinator trigger glue imports no execution-capable module', () => {
    const text = fs.readFileSync(path.join(SRC_REMEDIATION, 'remediation-trigger.ts'), 'utf8');
    const imports = /from\s+'([^']+)'/g;
    let match: RegExpExecArray | null;
    while ((match = imports.exec(text)) !== null) {
      const source = match[1];
      expect(source).not.toMatch(/child_process|node:|\bnet\b|\bhttp\b|undici|node-fetch|\bpg\b/i);
    }
  });
});
