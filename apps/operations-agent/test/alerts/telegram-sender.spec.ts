import {
  createTelegramSender,
  DEFAULT_TELEGRAM_TIMEOUT_MS,
  TELEGRAM_TEXT_MAX_CHARS,
  TELEGRAM_TEXT_TRUNCATION_SUFFIX,
  TelegramSender,
} from '../../src/alerts/telegram-sender';
import { AlertMessage } from '../../src/alerts';

const TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
const CHAT_ID = 42;
const SEND_MESSAGE_URL = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

function makeMessage(overrides: Partial<AlertMessage> = {}): AlertMessage {
  return {
    kind: 'red_alert',
    environmentKey: 'env-test',
    subjectKey: 'WF_STALE',
    text: 'CloudIT RED alert [environment=env-test subject=WF_STALE] category=RED evidence=2.',
    occurredAt: '2026-10-05T12:00:00.000Z',
    ...overrides,
  };
}

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

function makeSender(fetchImpl: typeof fetch): TelegramSender {
  return createTelegramSender({ token: TOKEN, chatId: CHAT_ID, fetchImpl });
}

describe('createTelegramSender happy path', () => {
  it('POSTs JSON to the fixed host with the token in the path only', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, { ok: true }));
    const message = makeMessage();
    await makeSender(fetchImpl).send(message);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(SEND_MESSAGE_URL);
    expect(requests[0].init?.method).toBe('POST');
    expect(requests[0].init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(requests[0].init?.body as string)).toEqual({
      chat_id: CHAT_ID,
      text: message.text,
      disable_web_page_preview: true,
    });
  });
});

describe('createTelegramSender text bound', () => {
  it('truncates text beyond 4000 chars with a single truncation suffix', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, { ok: true }));
    const longText = 'x'.repeat(TELEGRAM_TEXT_MAX_CHARS + 1000);
    await makeSender(fetchImpl).send(makeMessage({ text: longText }));

    const sent = JSON.parse(requests[0].init?.body as string) as { text: string };
    expect(sent.text).toBe('x'.repeat(TELEGRAM_TEXT_MAX_CHARS) + TELEGRAM_TEXT_TRUNCATION_SUFFIX);
    expect(sent.text.split(TELEGRAM_TEXT_TRUNCATION_SUFFIX)).toHaveLength(2);
  });

  it('passes text at exactly the bound through untouched', async () => {
    const { fetchImpl, requests } = stubFetch(() => jsonResponse(200, { ok: true }));
    const exactText = 'y'.repeat(TELEGRAM_TEXT_MAX_CHARS);
    await makeSender(fetchImpl).send(makeMessage({ text: exactText }));

    const sent = JSON.parse(requests[0].init?.body as string) as { text: string };
    expect(sent.text).toBe(exactText);
    expect(sent.text).not.toContain(TELEGRAM_TEXT_TRUNCATION_SUFFIX);
  });
});

describe('createTelegramSender timeout', () => {
  it('aborts and rejects with a bounded message when fetch never settles', async () => {
    const requests: RecordedRequest[] = [];
    const fetchImpl = jest.fn((url: unknown, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return new Promise<Response>(() => undefined);
    }) as unknown as typeof fetch;
    const sender = createTelegramSender({ token: TOKEN, chatId: CHAT_ID, fetchImpl, timeoutMs: 25 });

    await expect(sender.send(makeMessage())).rejects.toThrow('telegram send timed out after 25ms');
    const signal = requests[0].init?.signal as AbortSignal;
    expect(signal.aborted).toBe(true);
  });
});

describe('createTelegramSender failure paths', () => {
  it('rejects on a non-2xx status with a bounded, token-free message', async () => {
    const { fetchImpl } = stubFetch(() => jsonResponse(502, { ok: false, description: 'Bad gateway' }));
    await expect(makeSender(fetchImpl).send(makeMessage())).rejects.toThrow(
      'telegram send rejected with status 502',
    );
  });

  it('rejects on { ok: false } with the description capped at 120 chars', async () => {
    const description = 'd'.repeat(500);
    const { fetchImpl } = stubFetch(() => jsonResponse(200, { ok: false, description }));
    await expect(makeSender(fetchImpl).send(makeMessage())).rejects.toThrow(
      /telegram send failed: d{120}…$/,
    );
  });

  it('rejects on a network error without echoing the fetch error text', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.reject(new Error(`getaddrinfo ENOTFOUND bot${TOKEN}`)),
    ) as unknown as typeof fetch;
    await expect(makeSender(fetchImpl).send(makeMessage())).rejects.toThrow(
      'telegram send failed: network error',
    );
  });
});

describe('createTelegramSender token canary', () => {
  it('never leaks the token via rejection messages even when the description echoes it', async () => {
    const { fetchImpl } = stubFetch(() =>
      jsonResponse(200, { ok: false, description: `Unauthorized: bot token ${TOKEN} is invalid` }),
    );
    let caught: unknown;
    try {
      await makeSender(fetchImpl).send(makeMessage());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain(TOKEN);
    expect(message).toContain('[redacted]');
    expect(message.length).toBeLessThanOrEqual('telegram send failed: '.length + 120);
  });
});

describe('createTelegramSender factory validation', () => {
  const okFetch = stubFetch(() => jsonResponse(200, { ok: true })).fetchImpl;

  it('rejects a token shorter than 8 characters', () => {
    expect(() => createTelegramSender({ token: 'short', chatId: CHAT_ID, fetchImpl: okFetch })).toThrow(
      'token',
    );
  });

  it('rejects a zero, negative or non-integer chatId', () => {
    for (const chatId of [0, -1, 1.5, Number.NaN]) {
      expect(() =>
        createTelegramSender({ token: TOKEN, chatId, fetchImpl: okFetch }),
      ).toThrow('chatId');
    }
  });

  it('rejects a non-positive timeout', () => {
    for (const timeoutMs of [0, -5]) {
      expect(() =>
        createTelegramSender({ token: TOKEN, chatId: CHAT_ID, timeoutMs, fetchImpl: okFetch }),
      ).toThrow('timeoutMs');
    }
  });

  it('defaults the timeout to 10 seconds', () => {
    expect(DEFAULT_TELEGRAM_TIMEOUT_MS).toBe(10_000);
    expect(() => createTelegramSender({ token: TOKEN, chatId: CHAT_ID, fetchImpl: okFetch })).not.toThrow();
  });
});
