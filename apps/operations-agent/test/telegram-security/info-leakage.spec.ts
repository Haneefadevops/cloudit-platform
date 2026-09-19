/**
 * Security spec 10: information leakage across all denial paths
 * (operator-plan 6.3 and 11.x). 401/403/409/413/429 outcomes and every audit
 * event must not contain the webhook secret, the bot token, allowlist
 * internals, or inbound message bodies.
 */

import { TelegramWebhookService } from '../../src/telegram/webhook';
import {
  ALLOWED_CHAT_ID,
  ALLOWED_USER_ID,
  authedHeaders,
  buildBody,
  buildUpdate,
  buildWebhookOptions,
  FOREIGN_USER_ID,
  ManualClock,
  RecordingAuditSink,
  RecordingCommandHandler,
  TEST_BOT_TOKEN,
  TEST_WEBHOOK_SECRET,
} from './fixtures';

// Local re-declaration to avoid exporting test-only helpers from fixtures.
const MAX_BODY_BYTES = 512;
function oversizedBody(): string {
  let pad = MAX_BODY_BYTES + 1;
  for (;;) {
    const body = buildBody(buildUpdate({ text: `/status ${'a'.repeat(pad)}` }));
    const length = Buffer.byteLength(body, 'utf8');
    if (length === MAX_BODY_BYTES + 1) return body;
    pad += MAX_BODY_BYTES + 1 - length;
  }
}

interface MinimalOutcome {
  status: string;
  statusCode: number;
  reply?: { text: string };
}

interface LeakProbe {
  name: string;
  statusCode: number;
  run(service: TelegramWebhookService): Promise<MinimalOutcome>;
}

function assertNoSecrets(serialized: string, inboundText: string): void {
  expect(serialized).not.toContain(TEST_WEBHOOK_SECRET);
  expect(serialized).not.toContain(TEST_BOT_TOKEN);
  expect(serialized).not.toContain(String(ALLOWED_USER_ID));
  expect(serialized).not.toContain(String(ALLOWED_CHAT_ID));
  expect(serialized).not.toContain(inboundText);
}

describe('TelegramWebhookService — denial-path information leakage', () => {
  const probes: LeakProbe[] = [
    {
      name: '401 unauthorized',
      statusCode: 401,
      run: (service) =>
        service.handle(
          buildBody(buildUpdate({ text: '/status top-secret-inbound-body' })),
          authedHeaders('test-webhook-secret-999999'),
        ),
    },
    {
      name: '403 forbidden',
      statusCode: 403,
      run: (service) =>
        service.handle(
          buildBody(buildUpdate({ userId: FOREIGN_USER_ID, text: '/status top-secret-inbound-body' })),
          authedHeaders(),
        ),
    },
    {
      name: '409 replay',
      statusCode: 409,
      run: async (service) => {
        const body = buildBody(buildUpdate({ text: '/status top-secret-inbound-body' }));
        await service.handle(body, authedHeaders());
        return service.handle(body, authedHeaders());
      },
    },
    {
      name: '413 payload too large',
      statusCode: 413,
      run: (service) => service.handle(oversizedBody(), authedHeaders()),
    },
    {
      name: '429 rate limited',
      statusCode: 429,
      run: async (service) => {
        let last;
        for (let i = 0; i < 4; i += 1) {
          last = await service.handle(
            buildBody(buildUpdate({ text: '/status top-secret-inbound-body' })),
            authedHeaders(),
          );
        }
        return last;
      },
    },
  ];

  it.each(probes.map((p) => [p.name, p] as const))(
    'leaks nothing in the %s outcome',
    async (_name, probe) => {
      const clock = new ManualClock();
      const service = new TelegramWebhookService(
        buildWebhookOptions({
          commandHandler: new RecordingCommandHandler(),
          now: clock.now,
          maxBodyBytes: MAX_BODY_BYTES,
          rateLimitPerMinute: 3,
        }),
      );

      const outcome = await probe.run(service);
      expect(outcome.statusCode).toBe(probe.statusCode);

      assertNoSecrets(JSON.stringify(outcome), 'top-secret-inbound-body');
    },
  );

  it.each(probes.map((p) => [p.name, p] as const))(
    'leaks nothing in the audit events recorded for %s',
    async (_name, probe) => {
      const clock = new ManualClock();
      const audit = new RecordingAuditSink();
      const service = new TelegramWebhookService(
        buildWebhookOptions({
          commandHandler: new RecordingCommandHandler(),
          audit,
          now: clock.now,
          maxBodyBytes: MAX_BODY_BYTES,
          rateLimitPerMinute: 3,
        }),
      );

      await probe.run(service);

      expect(audit.events.length).toBeGreaterThan(0);
      assertNoSecrets(JSON.stringify(audit.events), 'top-secret-inbound-body');
    },
  );
});
