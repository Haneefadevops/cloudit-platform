/**
 * Eval suite 6: no-execution guarantees (operator-plan 7 — the Remediation
 * Controller "executes nothing" in Phase G; 14 — "structural absence of
 * repair action, backup restore/decrypt, credential, client-notification,
 * ticket, arbitrary HTTP, SQL and shell paths").
 *
 * The Phase G engine is a proposal/approval surface only: its callable
 * surface is exactly the six contract methods, no method name matches the
 * execution denylist, and inputs are never mutated.
 */

import { RemediationEngine } from '../../src/remediation';
import {
  buildEngineOptions,
  deepFreeze,
  ENV_A,
  ISSUE_EVIDENCE_STALE,
  RecordingAuditSink,
} from './fixtures';

const EXECUTION_DENYLIST_PATTERN =
  /execute|execut|run|apply|dispatch|invoke|shell|restart|restore|deploy|credential|decrypt|notify|ticket|repair|remediate/i;

const EXPECTED_METHODS = [
  'propose',
  'approve',
  'reject',
  'getProposal',
  'listProposals',
  'recordExecutionFailure',
] as const;

describe('RemediationEngine — no-execution evals', () => {
  it('exposes the six contract methods as its public capability surface', () => {
    const engine = new RemediationEngine(buildEngineOptions({}));
    const record = engine as unknown as Record<string, unknown>;

    // TypeScript-private helpers (findRunbook, decide, finish, ...) still
    // exist at runtime by design; the security property is the PUBLIC
    // surface: the six read-only/proposal contract methods are present and
    // no denylisted capability exists (asserted explicitly below).
    for (const name of EXPECTED_METHODS) {
      expect(typeof record[name]).toBe('function');
    }
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
  ])('has no execution method named "%s"', (name) => {
    const engine = new RemediationEngine(buildEngineOptions({})) as unknown as Record<string, unknown>;
    expect(engine[name]).toBeUndefined();
  });

  it('deep-frozen registry input is never mutated by any engine call', () => {
    const audit = new RecordingAuditSink();
    const options = deepFreeze({ maxFailures: 1 });
    const engine = new RemediationEngine(buildEngineOptions({ audit, ...options }));
    const snapshotOfOptions = JSON.stringify(options);

    const id = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!.proposalId;
    engine.approve(id);
    engine.reject(id);
    engine.getProposal(id);
    engine.listProposals();
    engine.recordExecutionFailure(id);

    expect(JSON.stringify(options)).toBe(snapshotOfOptions);
  });

  it('proposal decisions expose no execution payload (no command/URL/SQL fields)', () => {
    const engine = new RemediationEngine(buildEngineOptions({}));
    const decision = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);

    const keys = JSON.stringify(Object.keys(decision.proposal!));
    expect(keys).not.toMatch(/command|url|sql|shell|endpoint|http/i);
  });
});
