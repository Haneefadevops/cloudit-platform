/**
 * Security spec 11: audit trail completeness (operator-plan 11.3).
 *
 * Every request — benign or attack — produces exactly one audit event; every
 * event validates against the shared AuditEvent contract; replay/attack
 * attempts are recorded with denial (non-success) result codes.
 */

import {
  SAFE_CODE_PATTERN,
  validateAuditEvent,
} from '@cloudit/operations-agent-contracts';
import { TelegramWebhookService } from '../../src/telegram/webhook';
import {
  authedHeaders,
  buildBody,
  buildUpdate,
  buildWebhookOptions,
  FOREIGN_USER_ID,
  ManualClock,
  noSecretHeaders,
  RecordingAuditSink,
  RecordingCommandHandler,
} from './fixtures';

const MAX_BODY_BYTES = 512;

function expectValidAuditEvent(event: unknown): void {
  const result = validateAuditEvent(event);
  if (!result.ok) {
    throw new Error(`audit event failed validation: ${result.errors.join('; ')}`);
  }
}

describe('TelegramWebhookService — audit trail', () => {
  it('records exactly one audit event for a benign request and it validates', async () => {
    const audit = new RecordingAuditSink();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ commandHandler: new RecordingCommandHandler(), audit }),
    );

    const outcome = await service.handle(buildBody(buildUpdate({ text: '/status' })), authedHeaders());

    expect(outcome.status).toBe('handled');
    expect(audit.events).toHaveLength(1);
    expectValidAuditEvent(audit.events[0]);
  });

  it('records exactly one audit event for a malformed (non-JSON) body', async () => {
    const audit = new RecordingAuditSink();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ commandHandler: new RecordingCommandHandler(), audit }),
    );

    const outcome = await service.handle('this is not json{', authedHeaders());

    expect(outcome.statusCode).toBe(400);
    expect(audit.events).toHaveLength(1);
    expectValidAuditEvent(audit.events[0]);
  });

  it('records one validating event per request across a mixed attack batch', async () => {
    const clock = new ManualClock();
    const audit = new RecordingAuditSink();
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(
      buildWebhookOptions({
        commandHandler: handler,
        audit,
        now: clock.now,
        maxBodyBytes: MAX_BODY_BYTES,
        rateLimitPerMinute: 3,
      }),
    );

    const requestCount = 11;
    const replayBody = buildBody(buildUpdate({ text: '/status replay-me' }));

    await service.handle(buildBody(buildUpdate({ text: '/status' })), authedHeaders()); // 1 handled
    await service.handle(buildBody(buildUpdate({ text: '/incidents' })), authedHeaders('test-webhook-secret-999999')); // 2 401
    await service.handle(
      buildBody(buildUpdate({ userId: FOREIGN_USER_ID, text: '/status' })),
      authedHeaders(),
    ); // 3 403
    await service.handle(buildBody(buildUpdate({ raw: { message: { chat: { id: 1 }, from: { id: 1 } } } })), authedHeaders()); // 4 400 (missing update_id)
    let pad = MAX_BODY_BYTES + 1;
    for (;;) {
      const body = buildBody(buildUpdate({ text: `/status ${'a'.repeat(pad)}` }));
      if (Buffer.byteLength(body, 'utf8') === MAX_BODY_BYTES + 1) {
        await service.handle(body, authedHeaders()); // 5 413
        break;
      }
      pad += MAX_BODY_BYTES + 1 - Buffer.byteLength(body, 'utf8');
    }
    await service.handle(replayBody, authedHeaders()); // 6 handled
    await service.handle(replayBody, authedHeaders()); // 7 409
    for (let i = 0; i < 4; i += 1) {
      await service.handle(buildBody(buildUpdate({ text: '/cost' })), authedHeaders()); // 8,9,10 handled, 11 429
    }

    expect(audit.events).toHaveLength(requestCount);
    for (const event of audit.events) {
      expectValidAuditEvent(event);
    }
  });

  it('marks replay and attack attempts with denial result codes, not success', async () => {
    const audit = new RecordingAuditSink();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ commandHandler: new RecordingCommandHandler(), audit }),
    );

    const benignBody = buildBody(buildUpdate({ text: '/status' }));
    await service.handle(benignBody, authedHeaders());
    const successResult = (validateAuditEvent(audit.events[0]) as { ok: true; value: { resultCode: string } }).value.resultCode;
    expect(successResult).toMatch(SAFE_CODE_PATTERN);

    const denialAttempts: Array<() => Promise<unknown>> = [
      () => service.handle(buildBody(buildUpdate({ text: '/status' })), authedHeaders('test-webhook-secret-999999')),
      () =>
        service.handle(
          buildBody(buildUpdate({ userId: FOREIGN_USER_ID, text: '/status' })),
          authedHeaders(),
        ),
      () => service.handle(benignBody, authedHeaders()),
    ];

    for (const attempt of denialAttempts) {
      await attempt();
    }

    expect(audit.events).toHaveLength(1 + denialAttempts.length);
    for (const event of audit.events.slice(1)) {
      const result = validateAuditEvent(event);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.resultCode).toMatch(SAFE_CODE_PATTERN);
        expect(result.value.resultCode).not.toBe(successResult);
      }
    }
  });

  it('uses safe machine-readable codes and bounded summaries in every event', async () => {
    const audit = new RecordingAuditSink();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ commandHandler: new RecordingCommandHandler(), audit }),
    );

    await service.handle(buildBody(buildUpdate({ text: '/status' })), authedHeaders());
    await service.handle(buildBody(buildUpdate({ text: '/status' })), noSecretHeaders());

    for (const event of audit.events) {
      const result = validateAuditEvent(event);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.reasonCode).toMatch(SAFE_CODE_PATTERN);
        expect(result.value.resultCode).toMatch(SAFE_CODE_PATTERN);
        expect(result.value.summary.length).toBeLessThanOrEqual(1000);
        expect(result.value.evidenceKeys.length).toBeLessThanOrEqual(50);
      }
    }
  });
});
