/**
 * Security spec 9: canary leakage (operator-plan 6.3/11.2 and acceptance
 * matrix "secret, token, email, URL, private-ID and PII canary leakage").
 *
 * A command handler that tries to emit canary text must be sanitized before
 * the reply reaches the operator, and evidence-port values laced with
 * canaries (including via /explain) must never appear in command outputs.
 * Leak detection uses the shared contract helper `detectCanaryLeak`.
 */

import {
  detectCanaryLeak,
  SECRET_CANARY_FIXTURES,
} from '@cloudit/operations-agent-contracts';
import { TelegramCommandService } from '../../src/telegram/commands';
import type { CommandRequest } from '../../src/telegram';
import { TelegramWebhookService } from '../../src/telegram/webhook';
import {
  ALLOWED_CHAT_ID,
  ALLOWED_USER_ID,
  authedHeaders,
  buildBody,
  buildStubEvidencePort,
  buildUpdate,
  buildWebhookOptions,
  CANARY_AWS_KEY_ID,
  CANARY_EMAIL,
  CANARY_FINDING_KEY,
  CANARY_TEXT,
  CANARY_URL,
  CLEAN_FINDING_KEY,
  RecordingCommandHandler,
} from './fixtures';

const CANARY_VALUES = [CANARY_AWS_KEY_ID, CANARY_EMAIL, CANARY_URL];

function baseRequest(overrides: Partial<CommandRequest>): CommandRequest {
  return {
    command: 'status',
    args: [],
    userId: ALLOWED_USER_ID,
    chatId: ALLOWED_CHAT_ID,
    correlationId: 'corr-synthetic-canary',
    ...overrides,
  };
}

function expectNoCanary(text: string): void {
  for (const value of CANARY_VALUES) {
    expect(text).not.toContain(value);
  }
  const report = detectCanaryLeak(text);
  expect(report.leaked).toBe(false);
}

describe('canary leakage — shared detector sanity', () => {
  it('detects every contract canary fixture', () => {
    const all = SECRET_CANARY_FIXTURES.map((c) => c.value).join(' ');
    const report = detectCanaryLeak(all);
    expect(report.leaked).toBe(true);
    expect(report.matches).toHaveLength(SECRET_CANARY_FIXTURES.length);
  });
});

describe('canary leakage — webhook outbound sanitization', () => {
  it('sanitizes a command handler reply that contains canary text', async () => {
    const handler = new RecordingCommandHandler({ text: `ok ${CANARY_TEXT}` });
    const service = new TelegramWebhookService(buildWebhookOptions({ commandHandler: handler }));

    const outcome = await service.handle(
      buildBody(buildUpdate({ text: '/status' })),
      authedHeaders(),
    );

    expect(outcome.status).toBe('handled');
    expect(outcome.reply).toBeDefined();
    expectNoCanary(outcome.reply?.text ?? '');
  });

  it('sanitizes a fully canary reply rather than passing it through', async () => {
    const handler = new RecordingCommandHandler({ text: CANARY_TEXT });
    const service = new TelegramWebhookService(buildWebhookOptions({ commandHandler: handler }));

    const outcome = await service.handle(
      buildBody(buildUpdate({ text: '/status' })),
      authedHeaders(),
    );

    expect(outcome.status).toBe('handled');
    expectNoCanary(outcome.reply?.text ?? '');
  });
});

describe('canary leakage — command layer evidence views', () => {
  it('keeps canaries in evidence-port views out of /status and /incidents replies', async () => {
    const service = new TelegramCommandService(buildStubEvidencePort({ poisoned: true }));

    const status = await service.execute(baseRequest({ command: 'status' }));
    const incidents = await service.execute(baseRequest({ command: 'incidents' }));
    const sync = await service.execute(baseRequest({ command: 'sync' }));
    const budget = await service.execute(baseRequest({ command: 'budget' }));

    for (const reply of [status, incidents, sync, budget]) {
      expectNoCanary(reply.text);
    }
  });

  it('keeps canaries out of /explain output for a poisoned finding', async () => {
    const service = new TelegramCommandService(buildStubEvidencePort({ poisoned: true }));

    const explained = await service.execute(
      baseRequest({ command: 'explain', args: [CANARY_FINDING_KEY] }),
    );
    expect(explained.text.length).toBeGreaterThan(0);
    expectNoCanary(explained.text);
  });

  it('still renders clean evidence normally (sanitizer does not blank replies)', async () => {
    const clean = new TelegramCommandService(buildStubEvidencePort());
    const poisoned = new TelegramCommandService(buildStubEvidencePort({ poisoned: true }));

    const cleanStatus = await clean.execute(baseRequest({ command: 'status' }));
    expect(cleanStatus.text.length).toBeGreaterThan(0);
    expect(detectCanaryLeak(cleanStatus.text).leaked).toBe(false);

    const cleanExplain = await clean.execute(
      baseRequest({ command: 'explain', args: [CLEAN_FINDING_KEY] }),
    );
    expect(cleanExplain.text).toContain(CLEAN_FINDING_KEY);
  });
});
