import { validateHealthAssessment } from '@cloudit/operations-agent-contracts';
import { LlmError, LlmRequest } from '../../src/ai';
import { OpenAiResponsesLlmClient } from '../../src/ai/provider';

const API_KEY = 'sk-test-dummy-key-000000';
const MODEL = 'gpt-5.6-luna';

const REQUEST: LlmRequest = {
  model: MODEL,
  system: 'You are the CloudIT operations maintenance explainer.',
  input: '[UNTRUSTED-DATA-BEGIN]\nevidence\n[UNTRUSTED-DATA-END]',
  maxOutputTokens: 1_000,
};

const ASSESSMENT_JSON = JSON.stringify({
  assessment: 'RED',
  summary: 'Stale workflow snapshot confirmed.',
  evidenceKeys: ['ev:workflow:backup-stale'],
  confidence: 'HIGH',
  issueCode: 'WF_STALE_SNAPSHOT',
  recommendedRunbook: 'none',
  automationEligibility: 'OWNER_REQUIRED',
});

interface RecordedRequest {
  url: string;
  init?: RequestInit;
}

function responsesPayload(text = ASSESSMENT_JSON, inputTokens = 120, outputTokens = 40): unknown {
  return {
    id: 'resp_test_1',
    status: 'completed',
    output: [
      { type: 'reasoning', summary: [] },
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text, annotations: [] }],
      },
    ],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function stubFetch(respond: (request: RecordedRequest) => Response | Promise<Response>) {
  const requests: RecordedRequest[] = [];
  const fetchImpl = jest.fn((url: unknown, init?: RequestInit) => {
    const request: RecordedRequest = { url: String(url), init };
    requests.push(request);
    return Promise.resolve().then(() => respond(request)) as Promise<Response>;
  }) as unknown as typeof fetch;
  return { fetchImpl, requests };
}

function makeClient(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return new OpenAiResponsesLlmClient({ apiKey: API_KEY, fetchImpl, ...overrides });
}

function capturedBody(requests: RecordedRequest[]): Record<string, unknown> {
  return JSON.parse(String(requests[0].init?.body));
}

describe('OpenAiResponsesLlmClient happy path', () => {
  it('returns parsed output text and exact usage token counts', async () => {
    const { fetchImpl } = stubFetch(() => jsonResponse(200, responsesPayload()));
    const client = makeClient(fetchImpl);

    const result = await client.complete(REQUEST);

    expect(result.text).toBe(ASSESSMENT_JSON);
    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(40);
    // The extracted text must be usable by the adapter's own pipeline.
    expect(validateHealthAssessment(JSON.parse(result.text)).ok).toBe(true);
  });

  it('propagates reasoning-inclusive output tokens as-is', async () => {
    // On this generation output_tokens already includes reasoning tokens;
    // the client must not recompute or split them.
    const { fetchImpl } = stubFetch(() => jsonResponse(200, responsesPayload(ASSESSMENT_JSON, 512, 137)));
    const result = await makeClient(fetchImpl).complete(REQUEST);
    expect(result).toEqual({ text: ASSESSMENT_JSON, inputTokens: 512, outputTokens: 137 });
  });

  it('joins multiple output_text parts across message items', async () => {
    const payload = {
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'output_text', text: '{"assessment":"RED",' },
            { type: 'output_text', text: '"summary":"x"}' },
          ],
        },
      ],
      usage: { input_tokens: 5, output_tokens: 2 },
    };
    const { fetchImpl } = stubFetch(() => jsonResponse(200, payload));
    const result = await makeClient(fetchImpl).complete(REQUEST);
    expect(result.text).toBe('{"assessment":"RED","summary":"x"}');
  });

  it('trims trailing slashes from the base URL', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, responsesPayload()));
    await makeClient(fetchImpl, { baseUrl: 'https://proxy.internal.example/' }).complete(REQUEST);
    expect(requests[0].url).toBe('https://proxy.internal.example/v1/responses');
  });
});

describe('OpenAiResponsesLlmClient request shape', () => {
  it('POSTs {baseUrl}/v1/responses with Bearer auth and JSON content type', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, responsesPayload()));
    await makeClient(fetchImpl).complete(REQUEST);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://api.openai.com/v1/responses');
    expect(requests[0].init?.method).toBe('POST');
    const headers = requests[0].init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${API_KEY}`);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('sends store:false, both input roles and max_output_tokens', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, responsesPayload()));
    await makeClient(fetchImpl).complete(REQUEST);

    const body = capturedBody(requests);
    expect(body.store).toBe(false);
    expect(body.model).toBe(MODEL);
    expect(body.max_output_tokens).toBe(1_000);
    const input = body.input as Array<{ role: string; content: Array<{ type: string; text: string }> }>;
    expect(input.map((m) => m.role)).toEqual(['system', 'user']);
    expect(input[0].content[0]).toEqual({ type: 'input_text', text: REQUEST.system });
    expect(input[1].content[0]).toEqual({ type: 'input_text', text: REQUEST.input });
  });

  it('requests strict json_schema structured output named health_assessment', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, responsesPayload()));
    await makeClient(fetchImpl).complete(REQUEST);

    const format = (capturedBody(requests).text as { format: Record<string, unknown> }).format;
    expect(format.type).toBe('json_schema');
    expect(format.name).toBe('health_assessment');
    expect(format.strict).toBe(true);
    const schema = format.schema as {
      type: string;
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual([
      'assessment',
      'summary',
      'evidenceKeys',
      'confidence',
      'issueCode',
      'recommendedRunbook',
      'automationEligibility',
    ]);
    expect(Object.keys(schema.properties)).toEqual([
      'assessment',
      'summary',
      'evidenceKeys',
      'confidence',
      'issueCode',
      'recommendedRunbook',
      'automationEligibility',
    ]);
  });
});

describe('OpenAiResponsesLlmClient key hygiene', () => {
  const cases: Array<{ name: string; respond: () => Response | Promise<Response> }> = [
    {
      name: 'a 401 whose body echoes the key back',
      respond: () =>
        jsonResponse(401, {
          error: { message: `invalid api key: ${API_KEY} rejected by provider` },
        }),
    },
    { name: 'a 500 server error', respond: () => jsonResponse(500, {}) },
    { name: 'garbage JSON', respond: () => jsonResponse(200, { not: 'responses shape' }) },
  ];

  for (const testCase of cases) {
    it(`never leaks the API key into thrown errors for ${testCase.name}`, async () => {
      const { fetchImpl } = stubFetch(testCase.respond);
      let caught: unknown;
      try {
        await makeClient(fetchImpl).complete(REQUEST);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(LlmError);
      const serialized = String((caught as Error).message) + (caught as Error).stack;
      expect(serialized).not.toContain(API_KEY);
      // Token-free means the fixed default messages only.
      expect((caught as LlmError).message).toMatch(
        /^LLM (request refused by provider|provider server error|response failed structural validation)$/,
      );
    });
  }

  it('rejects construction with a short or missing key (fail closed)', () => {
    const { fetchImpl } = stubFetch(() => jsonResponse(200, responsesPayload()));
    expect(() => new OpenAiResponsesLlmClient({ apiKey: '', fetchImpl })).toThrow(LlmError);
    expect(() => new OpenAiResponsesLlmClient({ apiKey: 'short', fetchImpl })).toThrow(LlmError);
  });
});

describe('no real network', () => {
  it('constructing without fetchImpl never calls global fetch', () => {
    const globalFetch = jest.fn(() => {
      throw new Error('global fetch must never be called in tests');
    });
    const original = globalThis.fetch;
    globalThis.fetch = globalFetch as unknown as typeof fetch;
    try {
      const client = new OpenAiResponsesLlmClient({ apiKey: API_KEY });
      expect(client).toBeInstanceOf(OpenAiResponsesLlmClient);
      expect(globalFetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });
});
