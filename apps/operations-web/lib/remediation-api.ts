import "server-only";
import type { RemediationProjection, RemediationProposalView } from "./remediation-types";

/**
 * Read-only client for the operations agent's remediation proposals
 * projection (Phase G, execute-nothing).
 *
 * Fail-closed: any failure (unreachable agent, timeout, non-200 response,
 * malformed JSON or a payload that does not match the mirror types) yields
 * { available: false, projection: null }. This module never throws, never
 * retries and never logs payload content. Proposals are display-only; no
 * execution surface is exposed here.
 */
const DEFAULT_AI_AGENT_URL = "http://127.0.0.1:3090";
const REMEDIATION_PROPOSALS_PATH = "/remediation-proposals";
const TIMEOUT_MS = 3000;

const PROPOSAL_STATUSES = ["PROPOSED", "APPROVED", "REJECTED", "EXPIRED"] as const;

export type RemediationProposalsView = {
  available: boolean;
  projection: RemediationProjection | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isProposal(value: unknown): value is RemediationProposalView {
  return (
    isRecord(value) &&
    isString(value.proposalId) &&
    isString(value.environmentKey) &&
    isString(value.subjectKey) &&
    isString(value.runbookKey) &&
    isString(value.status) &&
    (PROPOSAL_STATUSES as readonly string[]).includes(value.status) &&
    isString(value.createdAt) &&
    isString(value.expiresAt) &&
    isStringArray(value.preconditions) &&
    isString(value.expectedImpact) &&
    isStringArray(value.verification) &&
    isStringArray(value.rollback)
  );
}

function isProjection(value: unknown): value is RemediationProjection {
  return (
    isRecord(value) &&
    isString(value.generatedAt) &&
    isString(value.environmentKey) &&
    Array.isArray(value.proposals) &&
    value.proposals.every(isProposal)
  );
}

const unavailableView: RemediationProposalsView = { available: false, projection: null };

export async function getRemediationProposals(): Promise<RemediationProposalsView> {
  const baseUrl = (process.env.AI_AGENT_INTERNAL_URL ?? DEFAULT_AI_AGENT_URL).replace(/\/+$/, "");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${REMEDIATION_PROPOSALS_PATH}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return unavailableView;
  }
  if (!response.ok) return unavailableView;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return unavailableView;
  }
  if (!isProjection(body)) return unavailableView;
  return { available: true, projection: body };
}
