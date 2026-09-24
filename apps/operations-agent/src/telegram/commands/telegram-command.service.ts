import { sanitizeSafeText } from '@cloudit/operations-agent-contracts';
import type { CommandRequest, CommandResponse } from '../telegram.types';
import type { ChatResponder } from './chat-responder';
import type { ReadOnlyEvidencePort } from './evidence-views';

/** Telegram sendMessage text limit; every reply is capped defensively. */
const MAX_RESPONSE_CHARS = 4000;
/** `/explain` summaries are bounded before assembly, independent of the cap. */
const MAX_SUMMARY_CHARS = 500;
/** `/incidents` never renders more than this many entries. */
const MAX_INCIDENTS = 10;

const HELP_TEXT = [
  'CloudIT operations bot (read-only).',
  'Commands:',
  '/status - overall verdict and source counts',
  '/incidents - open incidents (max 10, identifiers only)',
  '/sync - workflow-portal sync summary',
  '/budget (alias /cost) - AI call and budget usage',
  '/explain [findingKey] - sanitized finding detail',
  '/help - this command list',
  '',
  'Any other message - AI chat (when enabled)',
  'Evidence is sanitized; never send secrets or personal data.',
].join('\n');

const EXPLAIN_USAGE = 'Usage: /explain [findingKey]';
const FINDING_NOT_FOUND = 'Finding not found.';
const NO_OPEN_INCIDENTS = 'No open incidents.';

/**
 * Assemble a reply from fixed deterministic templates, then sanitize the
 * final text (no URL allowlist) and cap it. Sanitization runs over the
 * assembled string so canary-shaped values from the evidence port can never
 * reach Telegram raw, whatever template they pass through.
 */
function finalize(text: string): CommandResponse {
  const sanitized = sanitizeSafeText(text);
  return { text: sanitized.slice(0, MAX_RESPONSE_CHARS) };
}

/**
 * Deterministic, read-only Telegram command handler. Renders fixed templates
 * from a {@link ReadOnlyEvidencePort}: no network, no mutation. Free-text
 * messages (command 'chat') are delegated verbatim to the optional
 * {@link ChatResponder} (the AI chat engine); without a responder bound they
 * degrade to the help text, like unknown commands today. Arguments beyond
 * what a command uses are ignored and are never interpreted as instructions.
 */
export class TelegramCommandService {
  constructor(
    private readonly evidence: ReadOnlyEvidencePort,
    private readonly chat?: ChatResponder,
  ) {}

  async execute(request: CommandRequest): Promise<CommandResponse> {
    switch (request.command.toLowerCase()) {
      case 'status':
        return this.renderStatus();
      case 'incidents':
        return this.renderIncidents();
      case 'sync':
        return this.renderSync();
      case 'budget':
      case 'cost':
        return this.renderBudget();
      case 'explain':
        return this.renderExplain(request);
      case 'chat':
        return this.renderChat(request);
      case 'help':
      case 'start':
      default:
        return finalize(HELP_TEXT);
    }
  }

  private renderStatus(): CommandResponse {
    const status = this.evidence.getStatus();
    return finalize(
      `Status: ${status.overall} | sources ${status.sourcesTotal} | open incidents ${status.openIncidents}`,
    );
  }

  private renderIncidents(): CommandResponse {
    const incidents = this.evidence.listIncidents();
    if (incidents.length === 0) {
      return finalize(NO_OPEN_INCIDENTS);
    }
    const shown = incidents.slice(0, MAX_INCIDENTS);
    const lines = shown.map(
      (incident) => `- [${incident.severity}] ${incident.serviceKey} ${incident.incidentKey}`,
    );
    const header =
      incidents.length > MAX_INCIDENTS
        ? `Open incidents (${incidents.length}, showing ${shown.length}):`
        : `Open incidents (${incidents.length}):`;
    return finalize([header, ...lines].join('\n'));
  }

  private renderSync(): CommandResponse {
    const sync = this.evidence.getSyncSummary();
    return finalize(
      `Sync: ${sync.state} | drift ${sync.driftCount} | stale ${sync.staleCount} | scanned ${sync.scannedAt}`,
    );
  }

  private renderBudget(): CommandResponse {
    const budget = this.evidence.getBudgetSummary();
    return finalize(
      `Budget: calls ${budget.dayCallsUsed}/${budget.dayCallsMax} today | month EUR ${budget.monthEurUsed} of ${budget.monthEurCeiling.toFixed(2)}`,
    );
  }

  private renderChat(request: CommandRequest): Promise<CommandResponse> {
    // The question handed to the AI is the verbatim rawText, never the args
    // array. Without text or a bound responder, degrade to help (fail-closed,
    // same as unknown commands).
    if (!request.rawText || !this.chat) {
      return Promise.resolve(finalize(HELP_TEXT));
    }
    return this.chat
      .answer({ userId: request.userId, chatId: request.chatId, question: request.rawText })
      .then((answer) => finalize(answer.text));
  }

  private renderExplain(request: CommandRequest): CommandResponse {
    if (request.args.length !== 1) {
      return finalize(EXPLAIN_USAGE);
    }
    const finding = this.evidence.getFinding(request.args[0]);
    if (!finding) {
      return finalize(FINDING_NOT_FOUND);
    }
    const summary = finding.safeSummary.slice(0, MAX_SUMMARY_CHARS);
    return finalize(
      [
        `Finding: ${finding.findingKey}`,
        `Severity: ${finding.severity}`,
        `Title: ${finding.safeTitle}`,
        `Summary: ${summary}`,
        `Runbook: ${finding.recommendedRunbook}`,
      ].join('\n'),
    );
  }
}
