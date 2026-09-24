/**
 * Real binding for the Telegram chat responder port (chat-bind phase,
 * coordinator integration).
 *
 * Maps the read-only command-layer evidence port onto the small sanitized
 * grounding snapshot {@link ChatService} answers from, so free-text operator
 * questions are grounded ONLY in what the observer already sanctions for
 * Telegram rendering: status counts, incident identifier lines and the
 * enforced budget line. The binding itself adds no unsanitized source: every
 * string it places into the context is either fixed coordinator text or
 * already-sanitized evidence-view text, and the prompt builder re-wraps all
 * of it as untrusted data anyway.
 *
 * The conversation key is `${chatId}:${userId}` — the same identity the
 * allowlist already validated — so memory is per operator conversation and
 * can never cross users. Read-only: it never mutates evidence or budget
 * state; recording spend stays inside ChatService's budget gate.
 */

import { ChatService, ChatVerdict } from '../ai';
import { chatServiceRegistry } from './chat-service-registry';
import type { ReadOnlyEvidencePort } from '../telegram/commands/evidence-views';
import type { ChatResponder } from '../telegram/commands/chat-responder';

const OPEN_FINDINGS_HINT = 'Open findings are not listed here; ask with /explain <findingKey> for sanitized detail.';
const CHAT_UNAVAILABLE = 'AI chat is not available right now. Use /status, /incidents or /help for deterministic answers.';

function toChatVerdict(overall: string): ChatVerdict {
  switch (overall.toUpperCase()) {
    case 'GREEN':
    case 'AMBER':
    case 'RED':
    case 'NO_DATA':
    case 'UNKNOWN':
      return overall.toUpperCase() as ChatVerdict;
    default:
      return 'UNKNOWN';
  }
}

export function chatResponderBinding(
  evidence: ReadOnlyEvidencePort,
  service: () => ChatService | null = () => chatServiceRegistry.get(),
): ChatResponder {
  return {
    answer: async (input: { userId: number; chatId: number; question: string }) => {
      const chat = service();
      if (!chat) {
        return { text: CHAT_UNAVAILABLE };
      }
      const status = evidence.getStatus();
      const budget = evidence.getBudgetSummary();
      const incidents = evidence.listIncidents();
      const context = {
        overallVerdict: toChatVerdict(status.overall),
        sourcesTotal: status.sourcesTotal,
        sourcesRed: status.sourcesRed,
        sourcesAmber: status.sourcesAmber,
        openIncidents: status.openIncidents,
        incidentLines: incidents.map(
          (incident) =>
            `[${incident.severity}] ${incident.serviceKey} ${incident.incidentKey} (${incident.state})`,
        ),
        findingLines: [OPEN_FINDINGS_HINT],
        budgetLine: `calls ${budget.dayCallsUsed}/${budget.dayCallsMax} today; month EUR ${budget.monthEurUsed} of ${budget.monthEurCeiling.toFixed(2)}`,
      };
      const result = await chat.ask({
        userKey: `${input.chatId}:${input.userId}`,
        question: input.question,
        context,
      });
      return { text: result.text };
    },
  };
}
