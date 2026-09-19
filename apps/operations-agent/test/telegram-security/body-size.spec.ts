/**
 * Security spec 6: body-size limits (operator-plan 6.2). A body of
 * maxBodyBytes+1 is rejected with 413; a body exactly at the limit is
 * processed normally. Sizes are measured in bytes, not characters.
 */

import { TelegramWebhookService } from '../../src/telegram/webhook';
import {
  authedHeaders,
  buildBody,
  buildUpdate,
  buildWebhookOptions,
  RecordingCommandHandler,
} from './fixtures';

const MAX_BODY_BYTES = 512;

/** Pads a /status command with trailing filler to an exact UTF-8 byte size. */
function buildPaddedBody(targetBytes: number): string {
  let pad = targetBytes;
  for (;;) {
    const body = buildBody(buildUpdate({ text: `/status ${'a'.repeat(pad)}` }));
    const length = Buffer.byteLength(body, 'utf8');
    if (length === targetBytes) return body;
    pad += targetBytes - length;
    if (pad < 0) throw new Error('cannot synthesize exact body size');
  }
}

describe('TelegramWebhookService — request body size limit', () => {
  it('rejects a body of maxBodyBytes+1 with 413 and never invokes the command layer', async () => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ commandHandler: handler, maxBodyBytes: MAX_BODY_BYTES }),
    );

    const outcome = await service.handle(buildPaddedBody(MAX_BODY_BYTES + 1), authedHeaders());

    expect(outcome.statusCode).toBe(413);
    expect(['rejected', 'ignored']).toContain(outcome.status);
    expect(handler.invocations).toHaveLength(0);
  });

  it('accepts a body exactly at maxBodyBytes', async () => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ commandHandler: handler, maxBodyBytes: MAX_BODY_BYTES }),
    );

    const outcome = await service.handle(buildPaddedBody(MAX_BODY_BYTES), authedHeaders());

    expect(outcome.statusCode).toBe(200);
    expect(handler.invocations).toHaveLength(1);
    expect(handler.invocations[0].command).toBe('status');
  });

  it('measures the limit in bytes, not characters', async () => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ commandHandler: handler, maxBodyBytes: MAX_BODY_BYTES }),
    );

    // 200 four-byte emoji are 800 bytes but only 200 characters; the
    // webhook must enforce the byte limit.
    const emojiBody = buildBody(buildUpdate({ text: `/status ${'🤖'.repeat(200)}` }));
    expect(Buffer.byteLength(emojiBody, 'utf8')).toBeGreaterThan(MAX_BODY_BYTES);

    const outcome = await service.handle(emojiBody, authedHeaders());
    expect(outcome.statusCode).toBe(413);
    expect(handler.invocations).toHaveLength(0);
  });
});
