import { AiService } from './ai.service';

function makeAiService(fetchImpl: jest.Mock) {
  (global as any).fetch = fetchImpl;
  const config = { get: (_key: string, def?: unknown) => def };
  const prisma = { aiFailoverEvent: { create: jest.fn() } };
  return new AiService(config as never, prisma as never);
}

function makeAiServiceWithEnv(env: Record<string, string>, fetchImpl: jest.Mock) {
  (global as any).fetch = fetchImpl;
  const config = { get: (key: string, def?: unknown) => env[key] ?? def };
  const prisma = { aiFailoverEvent: { create: jest.fn() } };
  return new AiService(config as never, prisma as never);
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

  it('instructs strict single-language replies matched to the latest message', async () => {
    const fetchMock = jest.fn().mockResolvedValue(chatResponse('{"reply":"hi"}'));
    const ai = makeAiService(fetchMock);

    await ai.generateReply({ client: BASE_CLIENT, customer: {}, message: 'hi' });

    const prompt = systemPromptOf(fetchMock);
    expect(prompt).toContain("match the customer's LATEST message only");
    expect(prompt).toContain('Singlish');
    expect(prompt).toContain('Thanglish');
    expect(prompt).toContain('NEVER mix two languages in one reply');
    expect(prompt).toContain('simple everyday spoken words');
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

describe('AiService provider failover', () => {
  beforeEach(() => jest.restoreAllMocks());

  const OPENAI_ENV = {
    AI_API_KEY: 'sk-openai',
    AI_API_URL: 'https://api.openai.com/v1/chat/completions',
    AI_MODEL: 'gpt-4o-mini',
    KIMI_API_KEY: 'kimi-key',
  };

  it('retries on Kimi when the primary (AI_*) provider fails', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'openai down',
      })
      .mockResolvedValueOnce(chatResponse('{"reply":"from kimi"}'));
    const ai = makeAiServiceWithEnv(OPENAI_ENV, fetchMock);

    const result = await ai.generateReply({
      client: BASE_CLIENT,
      customer: {},
      message: 'hi',
    });

    expect(result.reply).toBe('from kimi');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.moonshot.cn/v1/chat/completions',
    );
    const fallbackBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(fallbackBody.model).toBe('kimi-latest');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
      'Bearer kimi-key',
    );
  });

  it('fails over on network errors too, not just HTTP errors', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(chatResponse('{"reply":"recovered"}'));
    const ai = makeAiServiceWithEnv(OPENAI_ENV, fetchMock);

    const result = await ai.generateReply({
      client: BASE_CLIENT,
      customer: {},
      message: 'hi',
    });

    expect(result.reply).toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry when no fallback is configured', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'kimi down',
    });
    const ai = makeAiServiceWithEnv({ KIMI_API_KEY: 'kimi-key' }, fetchMock);

    const result = await ai.generateReply({
      client: BASE_CLIENT,
      customer: {},
      message: 'hi',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.reply).toBeTruthy(); // graceful fallback message, no crash
  });

  it('uses the primary provider only when it succeeds', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(chatResponse('{"reply":"from openai"}'));
    const ai = makeAiServiceWithEnv(OPENAI_ENV, fetchMock);

    const result = await ai.generateReply({
      client: BASE_CLIENT,
      customer: {},
      message: 'hi',
    });

    expect(result.reply).toBe('from openai');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
  });

  it('records a failover event and flags metadata when failing over', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'openai down',
      })
      .mockResolvedValueOnce(chatResponse('{"reply":"from kimi"}'));
    const config = { get: (key: string, def?: unknown) => OPENAI_ENV[key] ?? def };
    const prisma = { aiFailoverEvent: { create: jest.fn() } };
    (global as any).fetch = fetchMock;
    const ai = new AiService(config as never, prisma as never);

    const result = await ai.generateReply({
      client: BASE_CLIENT,
      customer: {},
      message: 'hi',
    });

    expect(prisma.aiFailoverEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'reply',
        fromModel: 'gpt-4o-mini',
        toModel: 'kimi-latest',
      }),
    });
    expect(result.metadata.failover).toEqual(
      expect.objectContaining({ fromModel: 'gpt-4o-mini', toModel: 'kimi-latest' }),
    );
  });

  it('uses the client aiModel override for the primary provider only', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'bad model',
      })
      .mockResolvedValueOnce(chatResponse('{"reply":"fallback"}'));
    const ai = makeAiServiceWithEnv(OPENAI_ENV, fetchMock);

    await ai.generateReply({
      client: { ...BASE_CLIENT, aiModel: 'gpt-5.6-terra' },
      customer: {},
      message: 'hi',
    });

    const primaryBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(primaryBody.model).toBe('gpt-5.6-terra'); // override on primary
    const fallbackBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(fallbackBody.model).toBe('kimi-latest'); // never on fallback
  });

  it('sends max_completion_tokens (not max_tokens) to api.openai.com', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(chatResponse('{"reply":"hi"}'));
    const ai = makeAiServiceWithEnv(OPENAI_ENV, fetchMock);

    await ai.generateReply({
      client: { ...BASE_CLIENT, maxTokens: 250 },
      customer: {},
      message: 'hi',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.max_completion_tokens).toBe(250);
    expect('max_tokens' in body).toBe(false);
  });

  it('sends max_tokens to non-OpenAI providers', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(chatResponse('{"reply":"hi"}'));
    const ai = makeAiServiceWithEnv({ KIMI_API_KEY: 'kimi-key' }, fetchMock);

    await ai.generateReply({
      client: { ...BASE_CLIENT, maxTokens: 250 },
      customer: {},
      message: 'hi',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.max_tokens).toBe(250);
    expect('max_completion_tokens' in body).toBe(false);
  });

  it('omits temperature unless the client set it explicitly', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(chatResponse('{"reply":"hi"}'));
    const ai = makeAiServiceWithEnv({ KIMI_API_KEY: 'kimi-key' }, fetchMock);

    await ai.generateReply({ client: BASE_CLIENT, customer: {}, message: 'hi' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect('temperature' in body).toBe(false);

    await ai.generateReply({
      client: { ...BASE_CLIENT, aiTemperature: 0.3 },
      customer: {},
      message: 'hi',
    });
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body2.temperature).toBe(0.3);
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

  it('omits temperature when not specified (thinking models reject != 1)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(chatResponse('ok'));
    const ai = makeAiService(fetchMock);

    await ai.summarizeConversation([{ role: 'customer', content: 'hello' }]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect('temperature' in body).toBe(false);
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

describe('AiService reply parsing robustness', () => {
  beforeEach(() => jest.restoreAllMocks());

  function truncatedResponse(content: string) {
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content }, finish_reason: 'length' }],
        model: 'kimi-latest',
        usage: {},
      }),
    };
  }

  it('salvages the reply from truncated JSON without leaking raw output', async () => {
    // Token limit cut the JSON inside the action object — reply is complete
    const truncated =
      '{"reply":"Let me check if 3:00 PM is available for you.","handoff":false,"handoffReason":"","action":{"type":"check_availability","service":"DevOps","date":"2029-12-';
    const fetchMock = jest.fn().mockResolvedValue(chatResponse(truncated));
    const ai = makeAiService(fetchMock);

    const result = await ai.generateReply({
      client: { ...BASE_CLIENT, bookingsEnabled: true, services: [] },
      customer: {},
      message: '3 pm yes',
    });

    expect(result.reply).toBe(
      'Let me check if 3:00 PM is available for you.',
    );
    expect(result.reply).not.toContain('{');
    expect(result.handoff).toBe(false);
    // partial JSON cannot be trusted — no action may leak through
    expect(result.action).toBeUndefined();
  });

  it('never sends raw model output when it is unparseable — falls back + hands off', async () => {
    const garbage = '{"reply": "oops, cut mid-string...';
    const fetchMock = jest.fn().mockResolvedValue(chatResponse(garbage));
    const ai = makeAiService(fetchMock);

    const result = await ai.generateReply({
      client: { ...BASE_CLIENT, fallbackMessage: 'Custom fallback text' },
      customer: {},
      message: 'hello',
    });

    expect(result.reply).toBe('Custom fallback text');
    expect(result.reply).not.toContain('"reply"');
    expect(result.handoff).toBe(true);
    expect(result.handoffReason).toBe('AI response parse error');
  });

  it('retries once with a doubled token budget when finish_reason is length', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(truncatedResponse('{"reply":"cut off'))
      .mockResolvedValue(chatResponse('{"reply":"All good!"}'));
    const ai = makeAiService(fetchMock);

    const result = await ai.generateReply({
      client: BASE_CLIENT,
      customer: {},
      message: 'hi',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body1 = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const limit1 = body1.max_tokens ?? body1.max_completion_tokens;
    const limit2 = body2.max_tokens ?? body2.max_completion_tokens;
    expect(limit1).toBe(2048); // raised default
    expect(limit2).toBe(4096); // doubled on retry
    expect(result.reply).toBe('All good!');
  });

  it('does not retry when the reply finishes normally', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(chatResponse('{"reply":"All good!"}'));
    const ai = makeAiService(fetchMock);

    await ai.generateReply({ client: BASE_CLIENT, customer: {}, message: 'hi' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
