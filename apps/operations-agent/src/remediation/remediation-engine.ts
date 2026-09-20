/**
 * Simulated remediation engine (operator-plan Phase G).
 *
 * Generates remediation proposals from a fixed issue/runbook mapping and
 * executes NOTHING: no execute/run/apply/dispatch method exists. Proposals
 * display the registry's exact preconditions, expected impact, verification
 * and rollback text. Concurrency is out of scope (single-threaded synchronous
 * API); replay idempotency, lazy expiry, terminal rules and a failure-fed
 * circuit breaker are enforced offline.
 *
 * Audit: exactly one closed event per propose()/approve()/reject() call, even
 * when the audit sink itself throws. Never throws: every failure path returns
 * a ProposalDecision.
 */

import { buildRemediationAuditEvent, RemediationProposalAuditEvent } from './proposal-audit';
import { DEFAULT_TIER_A_RUNBOOKS, RemediationRunbook } from './runbooks';

export type ProposalAction =
  | 'PROPOSED'
  | 'REPLAY_IGNORED'
  | 'EXPIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CIRCUIT_OPEN';

export type ProposalStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface RemediationProposal {
  proposalId: string;
  environmentKey: string;
  subjectKey: string;
  runbookKey: string;
  status: ProposalStatus;
  createdAt: string;
  expiresAt: string;
  preconditions: readonly string[];
  expectedImpact: string;
  verification: readonly string[];
  rollback: readonly string[];
}

export interface ProposalDecision {
  action: ProposalAction;
  proposal?: RemediationProposal;
}

export interface RemediationEngineOptions {
  /** Default: DEFAULT_TIER_A_RUNBOOKS. */
  registry?: readonly RemediationRunbook[];
  audit?: { record(event: unknown): unknown };
  /** Circuit opens after this many recorded failures. Default 3. */
  maxFailures?: number;
  /** OPEN duration before half-open. Default 3_600_000. */
  cooldownMs?: number;
  /** ms epoch; default Date.now */
  now?: () => number;
}

const TERMINAL: readonly ProposalStatus[] = ['APPROVED', 'REJECTED', 'EXPIRED'];

function copyOf(proposal: RemediationProposal): RemediationProposal {
  return {
    ...proposal,
    preconditions: [...proposal.preconditions],
    verification: [...proposal.verification],
    rollback: [...proposal.rollback],
  };
}

export class RemediationEngine {
  private readonly registry: readonly RemediationRunbook[];
  private readonly now: () => number;
  private readonly maxFailures: number;
  private readonly cooldownMs: number;
  private readonly proposals = new Map<string, RemediationProposal>();
  private seq = 0;
  private failures = 0;
  private openedAt: number | null = null;

  constructor(private readonly options: RemediationEngineOptions = {}) {
    this.registry = options.registry ?? DEFAULT_TIER_A_RUNBOOKS;
    this.now = options.now ?? (() => Date.now());
    this.maxFailures = options.maxFailures ?? 3;
    this.cooldownMs = options.cooldownMs ?? 3_600_000;
  }

  /**
   * Create (or replay) a proposal. Unknown issueCode -> { action: 'EXPIRED' }
   * with no proposal ("no runbook"). Idempotent per
   * (environmentKey, issueCode) while a non-terminal, unexpired proposal
   * exists. Synchronous; never throws.
   */
  propose(environmentKey: string, issueCode: string): ProposalDecision {
    try {
      if (this.circuitOpen()) {
        return this.finish('CIRCUIT_OPEN', issueCode, undefined);
      }
      const runbook = this.findRunbook(issueCode);
      if (!runbook) {
        return this.finish('EXPIRED', issueCode, undefined);
      }
      const existing = this.findLiveProposal(environmentKey, issueCode);
      if (existing) {
        return this.finish('REPLAY_IGNORED', issueCode, copyOf(existing));
      }
      const createdMs = this.now();
      this.seq += 1;
      const proposal: RemediationProposal = {
        proposalId: `rem-${issueCode}-${environmentKey}-${createdMs}-${this.seq}`,
        environmentKey,
        subjectKey: issueCode,
        runbookKey: runbook.runbookKey,
        status: 'PROPOSED',
        createdAt: new Date(createdMs).toISOString(),
        expiresAt: new Date(createdMs + runbook.ttlMs).toISOString(),
        preconditions: [...runbook.preconditions],
        expectedImpact: runbook.expectedImpact,
        verification: [...runbook.verification],
        rollback: [...runbook.rollback],
      };
      this.proposals.set(proposal.proposalId, proposal);
      return this.finish('PROPOSED', issueCode, copyOf(proposal));
    } catch {
      return this.finish('EXPIRED', issueCode, undefined);
    }
  }

  approve(proposalId: string): ProposalDecision {
    return this.decide(proposalId, 'APPROVED');
  }

  reject(proposalId: string): ProposalDecision {
    return this.decide(proposalId, 'REJECTED');
  }

  /** Lazy-expiry read; flips expired proposals to EXPIRED (persisted). */
  getProposal(proposalId: string): RemediationProposal | undefined {
    try {
      const proposal = this.proposals.get(proposalId);
      if (!proposal) return undefined;
      this.touch(proposal);
      return copyOf(proposal);
    } catch {
      return undefined;
    }
  }

  /** Lazy-expiry listing, optionally filtered per environmentKey. */
  listProposals(environmentKey?: string): readonly RemediationProposal[] {
    try {
      const result: RemediationProposal[] = [];
      for (const proposal of this.proposals.values()) {
        this.touch(proposal);
        if (environmentKey !== undefined && proposal.environmentKey !== environmentKey) continue;
        result.push(copyOf(proposal));
      }
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Circuit-breaker feed only: records one execution failure. At
   * >= maxFailures the breaker OPENS; it half-opens once now() advances past
   * openedAt + cooldownMs, and a subsequent successful transition closes it.
   * NO execution exists in this phase.
   */
  recordExecutionFailure(proposalId: string): void {
    try {
      void proposalId;
      this.failures += 1;
      if (this.failures >= this.maxFailures) {
        this.openedAt = this.now();
      }
    } catch {
      // Never throws.
    }
  }

  private decide(proposalId: string, target: 'APPROVED' | 'REJECTED'): ProposalDecision {
    try {
      if (this.circuitOpen()) {
        return this.finish('CIRCUIT_OPEN', proposalId, undefined);
      }
      const proposal = this.proposals.get(proposalId);
      if (!proposal) {
        return this.finish('EXPIRED', proposalId, undefined);
      }
      this.touch(proposal);
      if (proposal.status === 'EXPIRED') {
        return this.finish('EXPIRED', proposal.subjectKey, copyOf(proposal));
      }
      if (proposal.status === target) {
        // Idempotent re-application of the same terminal decision.
        return this.finish(target, proposal.subjectKey, copyOf(proposal));
      }
      if (proposal.status !== 'PROPOSED') {
        // Mismatched terminal state: no transition (documented as EXPIRED).
        return this.finish('EXPIRED', proposal.subjectKey, copyOf(proposal));
      }
      proposal.status = target;
      return this.finish(target, proposal.subjectKey, copyOf(proposal));
    } catch {
      return this.finish('EXPIRED', proposalId, undefined);
    }
  }

  private findRunbook(issueCode: string): RemediationRunbook | undefined {
    for (const runbook of this.registry) {
      if (runbook.issueCode === issueCode) return runbook;
    }
    return undefined;
  }

  private findLiveProposal(
    environmentKey: string,
    issueCode: string,
  ): RemediationProposal | undefined {
    for (const proposal of this.proposals.values()) {
      if (proposal.environmentKey !== environmentKey) continue;
      if (proposal.subjectKey !== issueCode) continue;
      if (TERMINAL.includes(proposal.status)) continue;
      this.touch(proposal);
      if (proposal.status === 'PROPOSED') return proposal;
    }
    return undefined;
  }

  private touch(proposal: RemediationProposal): void {
    if (proposal.status !== 'PROPOSED') return;
    if (this.now() >= Date.parse(proposal.expiresAt)) {
      proposal.status = 'EXPIRED';
    }
  }

  private circuitOpen(): boolean {
    if (this.openedAt === null) return false;
    // Half-open once the cooldown elapsed; the next mutating call is allowed
    // through and closes the breaker on a successful transition.
    return !(this.now() > this.openedAt + this.cooldownMs);
  }

  private closeCircuit(): void {
    this.openedAt = null;
    this.failures = 0;
  }

  private finish(
    action: ProposalAction,
    subjectKey: string,
    proposal: RemediationProposal | undefined,
  ): ProposalDecision {
    // A successful transition closes an OPEN/half-open breaker. While the
    // breaker is CLOSED, successes do NOT reset the accumulated failure
    // count (failures feed toward opening).
    if (
      (action === 'PROPOSED' || action === 'APPROVED' || action === 'REJECTED') &&
      this.openedAt !== null
    ) {
      this.closeCircuit();
    }
    if (this.options.audit) {
      const event: RemediationProposalAuditEvent = buildRemediationAuditEvent(
        action,
        subjectKey,
        new Date(this.now()).toISOString(),
      );
      try {
        this.options.audit.record(event);
      } catch {
        // Audit sinks must never break proposal flow.
      }
    }
    const decision: ProposalDecision = { action };
    if (proposal) decision.proposal = proposal;
    return decision;
  }
}
