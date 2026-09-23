import type { TelegramBotApiClient } from '../../src/telegram';
import {
  BOT_API_DESCRIPTION_MAX_CHARS,
  BOT_API_ERROR_MAX_CHARS,
  createTelegramBotApiClient,
  DEFAULT_BOT_API_TIMEOUT_MS,
  DEFAULT_MAX_UPDATES_PER_POLL,
  SEND_MESSAGE_TEXT_MAX_CHARS,
  SEND_MESSAGE_TEXT_TRUNCATION_SUFFIX,
} from '../../src/telegram/bot-api';

const TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
const CANARY = `canary bot${TOKEN} https://api.telegram.org/bot${TOKEN}/sendMessage`;
const API_BASE_URL = 'https://api.telegram.org';

function getUpdatesUrl(offset: number): string {
  const url = new URL(`/bot${TOKEN}/getUpdates`, `${API_BASE_URL}/`);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('timeout', '0');
  url.searchParams.set('allowed_updates', JSON.stringify(['message']));
  return url.toString();
}

const SEND_MESSAGE_URL = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

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

function stubFetch(respond: (request: RecordedRequest) => Response | Promise<Response>) {
  const requests: RecordedRequest[] = [];
  const fetchImpl = jest.fn((url: unknown, init?: RequestInit) => {
    const request: RecordedRequest = { url: String(url), init };
    requests.push(request);
    return Promise.resolve().then(() => respond(request)) as Promise<Response>;
  }) as unknown as typeof fetch;
  return { fetchImpl, requests };
}

function makeClient(fetchImpl: typeof fetch, overrides = {}): TelegramBotApiClient {
  return createTelegramBotApiClient({ token: TOKEN, fetchImpl, ...overrides });
}

describe('createTelegramBotApiClient getUpdates happy path', () => {
  it('returns the result array from an ok response', async () => {
    const updates = [{ update_id: 1 }, { update_id: 2, message: { text: '/status' } }];
    const { fetchImpl } = stubFetch(() => jsonResponse(200, { ok: true, result: updates }));
    const client = makeClient(fetchImpl);

    await expect(client.getUpdates(0)).resolves.toEqual(updates);
  });

  it('GETs the token-scoped URL with offset, timeout=0 and message-only allowed_updates', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, { ok: true, result: [] }));
    await makeClient(fetchImpl).getUpdates(41);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(getUpdatesUrl(41));
    expect(requests[0].init?.method).toBe('GET');
    expect(requests[0].url).not.toContain('token=');
  });

  it('passes a large offset through unmodified', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, { ok: true, result: [] }));
    await makeClient(fetchImpl).getUpdates(9_223_372_036_854_775_000);

    expect(requests[0].url).toBe(getUpdatesUrl(9_223_372_036_854_775_000));
  });

  it('returns an empty array when there is nothing new', async () => {
    const { fetchImpl } = stubFetch(() => jsonResponse(200, { ok: true, result: [] }));
    await expect(makeClient(fetchImpl).getUpdates(0)).resolves.toEqual([]);
  });

  it('caps the result array at maxUpdatesPerPoll', async () => {
    const updates = Array.from({ length: 5 }, (_, i) => ({ update_id: i + 1 }));
    const { fetchImpl } = stubFetch(() => jsonResponse(200, { ok: true, result: updates }));
    const client = makeClient(fetchImpl, { maxUpdatesPerPoll: 2 });

    await expect(client.getUpdates(0)).resolves.toEqual([
      { update_id: 1 },
      { update_id: 2 },
    ]);
  });

  it('accepts a result smaller than the cap untouched', async () => {
    const updates = [{ update_id: 7 }];
    const { fetchImpl } = stubFetch(() => jsonResponse(200, { ok: true, result: updates }));
    const client = makeClient(fetchImpl, { maxUpdatesPerPoll: 100 });

    await expect(client.getUpdates(0)).resolves.toEqual(updates);
  });
});

describe('createTelegramBotApiClient getUpdates failure paths', () => {
  it('rejects on ok:false with the description, bounded and token-free', async () => {
    const { fetchImpl } = stubFetch(() =>
      jsonResponse(200, { ok: false, description: 'Conflict: terminated by other getUpdates' }),
    );
    await expect(makeClient(fetchImpl).getUpdates(0)).rejects.toThrow(
      'telegram getUpdates failed: Conflict: terminated by other getUpdates',
    );
  });

  it('rejects on a missing or non-array result as a malformed response', async () => {
    const missing = stubFetch(() => jsonResponse(200, { ok: true }));
    await expect(makeClient(missing.fetchImpl).getUpdates(0)).rejects.toThrow(
      'telegram getUpdates failed: malformed getUpdates response',
    );

    const nonArray = stubFetch(() => jsonResponse(200, { ok: true, result: { not: 'an array' } }));
    await expect(makeClient(nonArray.fetchImpl).getUpdates(0)).rejects.toThrow(
      'telegram getUpdates failed: malformed getUpdates response',
    );
  });

  it('rejects on an unreadable response body with a fixed message', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('x')) }),
    ) as unknown as typeof fetch;
    await expect(makeClient(fetchImpl).getUpdates(0)).rejects.toThrow(
      'telegram bot api returned an unreadable response body',
    );
  });

  it('rejects on a network error without echoing the fetch error text', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.reject(new Error(`getaddrinfo ENOTFOUND bot${TOKEN}.api.telegram.org`)),
    ) as unknown as typeof fetch;
    await expect(makeClient(fetchImpl).getUpdates(0)).rejects.toThrow(
      'telegram bot api request failed: network error',
    );
  });

  it('never leaks the token even when a hostile description echoes it (canary)', async () => {
    const { fetchImpl } = stubFetch(() => jsonResponse(200, { ok: false, description: CANARY }));
    let caught: unknown;
    try {
      await makeClient(fetchImpl).getUpdates(0);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain(TOKEN);
    expect(message).toContain('[redacted]');
    expect(message.length).toBeLessThanOrEqual(BOT_API_ERROR_MAX_CHARS);
  });

  it('bounds a hostile description to the description cap', async () => {
    const description = `d`.repeat(500);
    const { fetchImpl } = stubFetch(() => jsonResponse(200, { ok: false, description }));
    let caught: unknown;
    try {
      await makeClient(fetchImpl).getUpdates(0);
    } catch (error) {
      caught = error;
    }
    const message = (caught as Error).message;
    expect(message.length).toBeLessThanOrEqual(
      'telegram getUpdates failed: '.length + BOT_API_DESCRIPTION_MAX_CHARS + 1,
    );
    expect(message.endsWith('…')).toBe(true);
  });
});

describe('createTelegramBotApiClient getUpdates timeout', () => {
  it('aborts and rejects with a bounded message when fetch never settles', async () => {
    const requests: RecordedRequest[] = [];
    const fetchImpl = jest.fn((url: unknown, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return new Promise<Response>(() => undefined);
    }) as unknown as typeof fetch;
    const client = createTelegramBotApiClient({
      token: TOKEN,
      fetchImpl,
      timeoutMs: 25,
    });

    await expect(client.getUpdates(0)).rejects.toThrow(
      'telegram bot api request timed out after 25ms',
    );
    const signal = requests[0].init?.signal as AbortSignal;
    expect(signal.aborted).toBe(true);
  });

  it('maps a fetch-side AbortError to a bounded message without raw text', async () => {
    const fetchImpl = jest.fn(() => {
      const error = new Error('The operation was aborted.');
      error.name = 'AbortError';
      return Promise.reject(error);
    }) as unknown as typeof fetch;
    await expect(makeClient(fetchImpl).getUpdates(0)).rejects.toThrow(
      'telegram bot api request aborted',
    );
  });
});

describe('createTelegramBotApiClient sendMessage happy path', () => {
  it('POSTs {chat_id, text} JSON to the token-scoped URL', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, { ok: true, result: {} }));
    await makeClient(fetchImpl).sendMessage(42, 'hello operator');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(SEND_MESSAGE_URL);
    expect(requests[0].init?.method).toBe('POST');
    expect(requests[0].init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(requests[0].init?.body as string)).toEqual({
      chat_id: 42,
      text: 'hello operator',
    });
  });

  it('truncates text beyond the 4096-char cap with a single fixed suffix', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, { ok: true, result: {} }));
    const longText = 'x'.repeat(SEND_MESSAGE_TEXT_MAX_CHARS + 1000);
    await makeClient(fetchImpl).sendMessage(42, longText);

    const sent = JSON.parse(requests[0].init?.body as string) as { text: string };
    expect(sent.text).toBe('x'.repeat(SEND_MESSAGE_TEXT_MAX_CHARS) + SEND_MESSAGE_TEXT_TRUNCATION_SUFFIX);
    expect(sent.text.split(SEND_MESSAGE_TEXT_TRUNCATION_SUFFIX)).toHaveLength(2);
  });

  it('passes text at exactly the cap through untouched', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, { ok: true, result: {} }));
    const exactText = 'y'.repeat(SEND_MESSAGE_TEXT_MAX_CHARS);
    await makeClient(fetchImpl).sendMessage(42, exactText);

    const sent = JSON.parse(requests[0].init?.body as string) as { text: string };
    expect(sent.text).toBe(exactText);
  });
});

describe('createTelegramBotApiClient sendMessage failure paths', () => {
  it('rejects on { ok: false } with the description, bounded and token-free', async () => {
    const { fetchImpl } = stubFetch(() =>
      jsonResponse(200, { ok: false, description: 'Bad Request: chat not found' }),
    );
    await expect(makeClient(fetchImpl).sendMessage(42, 'hi')).rejects.toThrow(
      'telegram sendMessage failed: Bad Request: chat not found',
    );
  });

  it('never leaks the token even when a hostile description echoes it (canary)', async () => {
    const { fetchImpl } = stubFetch(() => jsonResponse(200, { ok: false, description: CANARY }));
    let caught: unknown;
    try {
      await makeClient(fetchImpl).sendMessage(42, 'hi');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain(TOKEN);
    expect(message).toContain('[redacted]');
    expect(message.length).toBeLessThanOrEqual(BOT_API_ERROR_MAX_CHARS);
  });

  it('rejects on a network error without echoing the fetch error text', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.reject(new Error(`socket hang up bot${TOKEN}`)),
    ) as unknown as typeof fetch;
    await expect(makeClient(fetchImpl).sendMessage(42, 'hi')).rejects.toThrow(
      'telegram bot api request failed: network error',
    );
  });

  it('rejects invalid chatId or text inputs without calling fetch', async () => {
    const { fetchImpl } = stubFetch(() => jsonResponse(200, { ok: true, result: {} }));
    const client = makeClient(fetchImpl);

    for (const chatId of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(client.sendMessage(chatId, 'hi')).rejects.toThrow('chatId');
    }
    for (const text of ['', 42 as unknown as string, null as unknown as string]) {
      await expect(client.sendMessage(1, text)).rejects.toThrow('text');
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('createTelegramBotApiClient factory validation', () => {
  const okFetch = stubFetch(() => jsonResponse(200, { ok: true, result: [] })).fetchImpl;

  it('rejects an empty or non-string token', () => {
    expect(() => createTelegramBotApiClient({ token: '', fetchImpl: okFetch })).toThrow('token');
    expect(() =>
      createTelegramBotApiClient({ token: 42 as unknown as string, fetchImpl: okFetch }),
    ).toThrow('token');
  });

  it('rejects a non-positive timeoutMs', () => {
    for (const timeoutMs of [0, -5, Number.NaN]) {
      expect(() => createTelegramBotApiClient({ token: TOKEN, timeoutMs, fetchImpl: okFetch })).toThrow(
        'timeoutMs',
      );
    }
  });

  it('rejects a non-positive or non-integer maxUpdatesPerPoll', () => {
    for (const maxUpdatesPerPoll of [0, -1, 1.5, 2.5]) {
      expect(() =>
        createTelegramBotApiClient({ token: TOKEN, maxUpdatesPerPoll, fetchImpl: okFetch }),
      ).toThrow('maxUpdatesPerPoll');
    }
  });

  it('rejects an unparseable apiBaseUrl', () => {
    expect(() =>
      createTelegramBotApiClient({ token: TOKEN, apiBaseUrl: 'not a url', fetchImpl: okFetch }),
    ).toThrow('apiBaseUrl');
  });

  it('defaults timeout and maxUpdatesPerPoll to the documented constants', () => {
    expect(DEFAULT_BOT_API_TIMEOUT_MS).toBe(10_000);
    expect(DEFAULT_MAX_UPDATES_PER_POLL).toBe(100);
    expect(() => createTelegramBotApiClient({ token: TOKEN, fetchImpl: okFetch })).not.toThrow();
  });

  it('honours a custom apiBaseUrl', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, { ok: true, result: [] }));
    const client = createTelegramBotApiClient({
      token: TOKEN,
      fetchImpl,
      apiBaseUrl: 'https://tg.test.local/',
    });
    await client.getUpdates(3);

    expect(requests[0].url.startsWith('https://tg.test.local/bot')).toBe(true);
  });
});

describe('token placement contract', () => {
  it('places the token in the request URL but never in any thrown error', async () => {
    const { fetchImpl, requests } = stubFetch(() =>
      jsonResponse(200, { ok: false, description: CANARY }),
    );
    const client = makeClient(fetchImpl);

    let getCaught: unknown;
    try {
      await client.getUpdates(0);
    } catch (error) {
      getCaught = error;
    }
    let sendCaught: unknown;
    try {
      await client.sendMessage(1, 'hi');
    } catch (error) {
      sendCaught = error;
    }

    // The token belongs in the URL of both requests...
    expect(requests[0].url).toContain(`/bot${TOKEN}/`);
    expect(requests[1].url).toContain(`/bot${TOKEN}/`);
    // ...and in neither thrown error.
    expect((getCaught as Error).message).not.toContain(TOKEN);
    expect((sendCaught as Error).message).not.toContain(TOKEN);
  });
});

// Compile-time guard: the factory must satisfy the coordinator-owned contract.
const _contractCheck = createTelegramBotApiClient({
  token: TOKEN,
  fetchImpl: stubFetch(() => jsonResponse(200, { ok: true, result: [] })).fetchImpl,
}) satisfies TelegramBotApiClient;
void _contractCheck;
