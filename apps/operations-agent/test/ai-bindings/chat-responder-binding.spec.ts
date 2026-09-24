import { ChatService } from '../../src/ai';
import { chatResponderBinding } from '../../src/ai-bindings/chat-responder.binding';
import { chatServiceRegistry } from '../../src/ai-bindings/chat-service-registry';
import type { ReadOnlyEvidencePort } from '../../src/telegram/commands/evidence-views';

function stubEvidence(overrides: Partial<ReadOnlyEvidencePort> = {}): ReadOnlyEvidencePort {
  return {
    getStatus: () => ({
      overall: 'AMBER',
      sourcesTotal: 13,
      sourcesRed: 0,
      sourcesAmber: 1,
      openIncidents: 0,
      generatedAt: '2026-09-23T12:00:00.000Z',
    }),
    listIncidents: () => [
      {
        incidentKey: 'INCIDENTS-UNEVIDENCED',
        severity: 'UNKNOWN',
        serviceKey: 'incidents',
        state: 'UNEVIDENCED',
        startedAt: '2026-09-23T12:00:00.000Z',
      },
    ],
    getSyncSummary: () => ({ state: 'UNBOUND', driftCount: 0, staleCount: 0, scannedAt: 'never' }),
    getBudgetSummary: () => ({
      dayCallsUsed: 2,
      dayCallsMax: 10,
      monthEurUsed: '0.01',
      monthEurCeiling: 7,
    }),
    getFinding: () => undefined,
    ...overrides,
  };
}

describe('chatResponderBinding (coordinator integration)', () => {
  afterEach(() => {
    chatServiceRegistry.bind(null);
  });

  it('maps the evidence port onto the chat context and returns the engine answer', async () => {
    const asked: unknown[] = [];
    const fakeChat = {
      ask: async (input: { userKey: string; question: string; context: unknown }) => {
        asked.push(input);
        return { text: 'All clear.', model: 'luna', fallback: false, costEur: 0.001, tokensIn: 10, tokensOut: 5 };
      },
    } as unknown as ChatService;
    const responder = chatResponderBinding(stubEvidence(), () => fakeChat);

    const result = await responder.answer({ userId: 7, chatId: 42, question: 'how are things?' });

    expect(result.text).toBe('All clear.');
    expect(asked).toHaveLength(1);
    const input = asked[0] as {
      userKey: string;
      question: string;
      context: Record<string, unknown>;
    };
    expect(input.userKey).toBe('42:7');
    expect(input.question).toBe('how are things?');
    expect(input.context.overallVerdict).toBe('AMBER');
    expect(input.context.sourcesTotal).toBe(13);
    expect(input.context.sourcesAmber).toBe(1);
    expect(input.context.incidentLines).toEqual([
      '[UNKNOWN] incidents INCIDENTS-UNEVIDENCED (UNEVIDENCED)',
    ]);
    expect(String(input.context.budgetLine)).toContain('calls 2/10 today');
  });

  it('maps unexpected verdict strings to UNKNOWN instead of leaking them into the prompt', async () => {
    const asked: unknown[] = [];
    const fakeChat = {
      ask: async (input: { context: unknown }) => {
        asked.push(input);
        return { text: 'x', model: 'luna', fallback: false, costEur: 0, tokensIn: 1, tokensOut: 1 };
      },
    } as unknown as ChatService;
    const evidence = stubEvidence({
      getStatus: () => ({
        overall: 'something-weird',
        sourcesTotal: 0,
        sourcesRed: 0,
        sourcesAmber: 0,
        openIncidents: 0,
        generatedAt: '',
      }),
    });
    const responder = chatResponderBinding(evidence, () => fakeChat);

    await responder.answer({ userId: 7, chatId: 42, question: 'q' });

    expect((asked[0] as { context: { overallVerdict: string } }).context.overallVerdict).toBe('UNKNOWN');
  });

  it('fails closed with a fixed notice when no chat service is bound', async () => {
    chatServiceRegistry.bind(null);
    const responder = chatResponderBinding(stubEvidence());

    const result = await responder.answer({ userId: 7, chatId: 42, question: 'q' });

    expect(result.text).toContain('not available');
  });
});
