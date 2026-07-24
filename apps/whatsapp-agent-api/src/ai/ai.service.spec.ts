import { AiService } from './ai.service';

function makeAiService(fetchImpl: jest.Mock) {
  (global as any).fetch = fetchImpl;
  const config = { get: (_key: string, def?: unknown) => def };
  return new AiService(config as never);
}

function chatResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content }, finish_reason: 'stop' }],
      model: 'kimi-latest',
      usage: {},
    }),
  };
}

function systemPromptOf(fetchMock: jest.Mock): string {
  const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
  return body.messages[0].content as string;
}

const BASE_CLIENT = {
  name: 'Test Clinic',
  timezone: 'Asia/Colombo',
  language: 'en',
};

describe('AiService prompt context', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('injects the current date & time in the client timezone', async () => {
    const fetchMock = jest.fn().mockResolvedValue(chatResponse('{"reply":"hi"}'));
    const ai = makeAiService(fetchMock);

    await ai.generateReply({ client: BASE_CLIENT, customer: {}, message: 'hi' });

    const prompt = systemPromptOf(fetchMock);
    expect(prompt).toContain('CURRENT DATE & TIME');
    expect(prompt).toContain('Asia/Colombo');
    expect(prompt).toMatch(/\d{4}-\d{2}-\d{2}/); // ISO date
    expect(prompt).toMatch(
      /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/,
    );
    expect(prompt).toMatch(/\d{2}:\d{2}/); // time
  });

  it('tells the AI to convert relative dates itself', async () => {
    const fetchMock = jest.fn().mockResolvedValue(chatResponse('{"reply":"hi"}'));
    const ai = makeAiService(fetchMock);

    await ai.generateReply({ client: BASE_CLIENT, customer: {}, message: 'tomorrow 11am' });

    const prompt = systemPromptOf(fetchMock);
    expect(prompt).toContain('Convert relative dates');
    expect(prompt).toContain(
      'Never ask the customer for a date in a specific format',
    );
  });

  it('includes the conversation-style rules for every client', async () => {
    const fetchMock = jest.fn().mockResolvedValue(chatResponse('{"reply":"hi"}'));
    const ai = makeAiService(fetchMock);

    await ai.generateReply({ client: BASE_CLIENT, customer: {}, message: 'hi' });

    const prompt = systemPromptOf(fetchMock);
    expect(prompt).toContain('ONE question per message');
    expect(prompt).toContain('Answer a direct question directly');
    expect(prompt).toContain('backstage stays backstage');
    expect(prompt).toContain('Acknowledge what the customer said first');
    expect(prompt).not.toContain('"action"'); // no actions without modules
  });

  it('instructs offering 2-3 nearest alternatives on the action-result turn', async () => {
    const fetchMock = jest.fn().mockResolvedValue(chatResponse('{"reply":"hi"}'));
    const ai = makeAiService(fetchMock);

    await ai.generateReply({
      client: { ...BASE_CLIENT, bookingsEnabled: true, services: [] },
      customer: {},
      message: 'ok',
      actionResult:
        'The requested time Fri, Jul 24, 11:00 AM is NOT available. Actually available: Fri, Jul 24, 2:00 PM; Fri, Jul 24, 4:00 PM.',
    });

    const prompt = systemPromptOf(fetchMock);
    expect(prompt).toContain('ACTION RESULT');
    expect(prompt).toContain('2-3 nearest available alternatives');
    expect(prompt).toContain('never just apologize');
  });

  it('omits the date section gracefully when the timezone is invalid', async () => {
    const fetchMock = jest.fn().mockResolvedValue(chatResponse('{"reply":"hi"}'));
    const ai = makeAiService(fetchMock);

    await ai.generateReply({
      client: { ...BASE_CLIENT, timezone: 'Not/AZone' },
      customer: {},
      message: 'hi',
    });

    // Invalid tz must not crash the whole prompt.
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe('AiService.summarizeConversation', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('sends the conversation as a user message (not system-only)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(chatResponse('- Point one\n- Point two'));
    const ai = makeAiService(fetchMock);

    const summary = await ai.summarizeConversation([
      { role: 'customer', content: 'hello' },
      { role: 'bot', content: 'hi there' },
    ]);

    expect(summary).toBe('- Point one\n- Point two');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const roles = body.messages.map((m: { role: string }) => m.role);
    expect(roles).toContain('user');
    const userMsg = body.messages.find(
      (m: { role: string }) => m.role === 'user',
    );
    expect(userMsg.content).toContain('customer: hello');
    expect(userMsg.content).toContain('bot: hi there');
  });

  it('returns the fallback text when the API fails', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'invalid messages',
    });
    const ai = makeAiService(fetchMock);

    const summary = await ai.summarizeConversation([
      { role: 'customer', content: 'hello' },
    ]);
    expect(summary).toBe('Summary could not be generated.');
  });
});
