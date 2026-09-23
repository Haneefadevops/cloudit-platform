import { LlmError, LlmErrorCode, LlmRequest } from '../../src/ai';
import { OpenAiResponsesLlmClient } from '../../src/ai/provider';

const API_KEY = 'sk-test-dummy-key-000000';

const REQUEST: LlmRequest = {
  model: 'gpt-5.6-luna',
  system: 'system instructions',
  input: 'user input',
  maxOutputTokens: 1_000,
};

const OK_PAYLOAD = {
  output: [
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"assessment":"RED"}' }] },
  ],
  usage: { input_tokens: 10, output_tokens: 5 },
};

interface RecordedRequest {
  url: string;
  init?: RequestInit;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** Fake fetch with scripted responses; records every call. */
function scriptFetch(responses: Array<Response | (() => Response)>) {
  const calls: RecordedRequest[] = [];
  let index = 0;
  const fetchImpl = jest.fn((url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const step = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return Promise.resolve().then(() => (typeof step === 'function' ? step() : step)) as Promise<Response>;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function makeClient(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return new OpenAiResponsesLlmClient({ apiKey: API_KEY, fetchImpl, ...overrides });
}

async function expectLlmError(promise: Promise<unknown>, code: LlmErrorCode): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(LlmError);
  expect((caught as LlmError).code).toBe(code);
}

describe('OpenAiResponsesLlmClient error mapping', () => {
  const cases: Array<{
    name: string;
    respond: () => Response;
    code: LlmErrorCode;
  }> = [
    { name: 'HTTP 429', respond: () => jsonResponse(429, {}), code: 'rate_limited' },
    { name: 'HTTP 500', respond: () => jsonResponse(500, {}), code: 'server' },
    { name: 'HTTP 503', respond: () => jsonResponse(503, {}), code: 'server' },
    { name: 'HTTP 599', respond: () => jsonResponse(599, {}), code: 'server' },
    { name: 'HTTP 401', respond: () => jsonResponse(401, {}), code: 'refused' },
    { name: 'HTTP 403', respond: () => jsonResponse(403, {}), code: 'refused' },
    { name: 'HTTP 400', respond: () => jsonResponse(400, {}), code: 'refused' },
    { name: 'HTTP 404', respond: () => jsonResponse(404, {}), code: 'refused' },
    {
      name: 'garbage JSON body',
      respond: () => jsonResponse(200, 'this is not an object'),
      code: 'invalid_response',
    },
    {
      name: 'missing usage',
      respond: () =>
        jsonResponse(200, {
          output: [{ type: 'message', content: [{ type: 'output_text', text: 'x' }] }],
        }),
      code: 'invalid_response',
    },
    {
      name: 'non-integer usage counts',
      respond: () =>
        jsonResponse(200, {
          output: [{ type: 'message', content: [{ type: 'output_text', text: 'x' }] }],
          usage: { input_tokens: 1.5, output_tokens: 2 },
        }),
      code: 'invalid_response',
    },
    {
      name: 'missing output text',
      respond: () => jsonResponse(200, { output: [], usage: { input_tokens: 1, output_tokens: 1 } }),
      code: 'invalid_response',
    },
    {
      name: 'missing output array',
      respond: () => jsonResponse(200, { usage: { input_tokens: 1, output_tokens: 1 } }),
      code: 'invalid_response',
    },
  ];

  for (const testCase of cases) {
    it(`maps ${testCase.name} to '${testCase.code}'`, async () => {
      const { fetchImpl, calls } = scriptFetch([testCase.respond()]);
      await expectLlmError(makeClient(fetchImpl).complete(REQUEST), testCase.code);
      expect(calls).toHaveLength(1); // nothing is retried by default
    });
  }

  it("maps a fetch rejection to 'network' with a token-free message", async () => {
    const calls: unknown[] = [];
    const fetchImpl = jest.fn(() => {
      calls.push(1);
      return Promise.reject(new Error(`dial tcp: connection refused (key=${API_KEY})`));
    }) as unknown as typeof fetch;
    let caught: unknown;
    try {
      await makeClient(fetchImpl).complete(REQUEST);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LlmError);
    expect((caught as LlmError).code).toBe('network');
    expect((caught as Error).message).toBe('LLM network error');
    expect(String((caught as Error).message)).not.toContain(API_KEY);
    expect(calls).toHaveLength(1);
  });

  it("maps a never-settling fetch to 'timeout' via the bounded AbortController", async () => {
    const fetchImpl = jest.fn(
      () =>
        new Promise<Response>(() => {
          /* never settles */
        }),
    ) as unknown as typeof fetch;
    await expectLlmError(
      makeClient(fetchImpl, { requestTimeoutMs: 25 }).complete(REQUEST),
      'timeout',
    );
  }, 5_000);

  it("maps a fetch that rejects with an AbortError to 'timeout'", async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    const fetchImpl = jest.fn(() => Promise.reject(abortError)) as unknown as typeof fetch;
    await expectLlmError(makeClient(fetchImpl).complete(REQUEST), 'timeout');
  });
});

describe('OpenAiResponsesLlmClient retries', () => {
  it('retries a 500 flake then succeeds with exactly maxRetries + 1 calls', async () => {
    const { fetchImpl, calls } = scriptFetch([
      () => jsonResponse(500, {}),
      () => jsonResponse(503, {}),
      () => jsonResponse(200, OK_PAYLOAD),
    ]);
    const result = await makeClient(fetchImpl, { maxRetries: 2 }).complete(REQUEST);
    expect(result).toEqual({ text: '{"assessment":"RED"}', inputTokens: 10, outputTokens: 5 });
    expect(calls).toHaveLength(3);
  });

  it('exhausts retries on persistent 500s and fails with server after maxRetries + 1 calls', async () => {
    const { fetchImpl, calls } = scriptFetch([() => jsonResponse(500, {})]);
    await expectLlmError(makeClient(fetchImpl, { maxRetries: 2 }).complete(REQUEST), 'server');
    expect(calls).toHaveLength(3);
  });

  it('retries transport failures then succeeds', async () => {
    let attempt = 0;
    const fetchImpl = jest.fn(() => {
      attempt += 1;
      if (attempt <= 2) return Promise.reject(new Error('ECONNRESET'));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(OK_PAYLOAD),
      } as unknown as Response);
    }) as unknown as typeof fetch;
    const result = await makeClient(fetchImpl, { maxRetries: 2 }).complete(REQUEST);
    expect(result.outputTokens).toBe(5);
    expect(attempt).toBe(3);
  });

  it.each([
    ['429 rate_limited', () => jsonResponse(429, {}), 'rate_limited'],
    ['401 refused', () => jsonResponse(401, {}), 'refused'],
    ['garbage JSON invalid_response', () => jsonResponse(200, 'garbage'), 'invalid_response'],
  ] as Array<[string, () => Response, LlmErrorCode]>)(
    'never retries non-retryable %s (exactly one call even with maxRetries 3)',
    async (_name, respond, code) => {
      const { fetchImpl, calls } = scriptFetch([respond]);
      await expectLlmError(makeClient(fetchImpl, { maxRetries: 3 }).complete(REQUEST), code);
      expect(calls).toHaveLength(1);
    },
  );

  it('makes exactly one call by default (maxRetries 0) on a server error', async () => {
    const { fetchImpl, calls } = scriptFetch([() => jsonResponse(500, {})]);
    await expectLlmError(makeClient(fetchImpl).complete(REQUEST), 'server');
    expect(calls).toHaveLength(1);
  });
});
