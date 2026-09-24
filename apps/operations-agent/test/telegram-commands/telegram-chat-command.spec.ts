import { TelegramCommandService } from '../../src/telegram/commands';
import type { ChatResponder } from '../../src/telegram/commands';
import { createFixtureEvidencePort, makeRequest } from './fixtures';

const MAX_RESPONSE_CHARS = 4000;

function makeResponder(impl?: jest.Mock): ChatResponder & { answer: jest.Mock } {
  return {
    answer:
      impl ??
      jest.fn(async () => ({
        text: 'synthetic ai answer: backups are GREEN',
      })),
  };
}

describe('TelegramCommandService - chat command', () => {
  it('delegates the verbatim rawText (never the args) to the responder', async () => {
    let received: { userId: number; chatId: number; question: string } | undefined;
    const answer = jest.fn(async (input: { userId: number; chatId: number; question: string }) => {
      received = input;
      return { text: 'ai says ok' };
    });
    const service = new TelegramCommandService(createFixtureEvidencePort(), makeResponder(answer));

    const reply = await service.execute({
      ...makeRequest('chat'),
      args: ['must', 'not', 'be', 'used'],
      rawText: 'how are the backups doing?',
    });

    expect(reply.text).toBe('ai says ok');
    expect(answer).toHaveBeenCalledTimes(1);
    expect(received).toEqual({
      userId: 424242,
      chatId: 242424,
      question: 'how are the backups doing?',
    });
    // The args array must never leak into the question.
    expect(received!.question).not.toContain('must');
  });

  it('passes emoji/unicode and long questions through verbatim', async () => {
    let received: { userId: number; chatId: number; question: string } | undefined;
    const answer = jest.fn(async (input: { userId: number; chatId: number; question: string }) => {
      received = input;
      return { text: 'ai says ok' };
    });
    const service = new TelegramCommandService(createFixtureEvidencePort(), makeResponder(answer));
    const question = `backups 🚀 héllo wörld — status? ${'x'.repeat(2000)}`;

    await service.execute({ ...makeRequest('chat'), rawText: question });

    expect(received?.question).toBe(question);
  });

  it('renders the help text when rawText is undefined, without calling the responder', async () => {
    const answer = jest.fn(async () => ({ text: 'should not be used' }));
    const service = new TelegramCommandService(createFixtureEvidencePort(), makeResponder(answer));

    const reply = await service.execute(makeRequest('chat'));

    expect(answer).not.toHaveBeenCalled();
    expect(reply.text).toContain('/status');
    expect(reply.text).toContain('Any other message - AI chat (when enabled)');
  });

  it('renders the help text when no responder is bound (degraded, still handled)', async () => {
    const service = new TelegramCommandService(createFixtureEvidencePort());

    const reply = await service.execute({ ...makeRequest('chat'), rawText: 'hello there' });

    expect(reply.text).toContain('/status');
    expect(reply.text).toContain('Any other message - AI chat (when enabled)');
  });

  it('propagates a rejecting responder instead of swallowing the error', async () => {
    const answer = jest.fn(async () => {
      throw new Error('synthetic ai outage');
    });
    const service = new TelegramCommandService(createFixtureEvidencePort(), makeResponder(answer));

    await expect(
      service.execute({ ...makeRequest('chat'), rawText: 'any question' }),
    ).rejects.toThrow('synthetic ai outage');
  });

  it('sanitizes and caps the responder text before returning it', async () => {
    const answer = jest.fn(async () => ({
      text: `prefix https://leak.example.com/internal <script>alert(1)</script> ${'y'.repeat(10_000)}`,
    }));
    const service = new TelegramCommandService(createFixtureEvidencePort(), makeResponder(answer));

    const reply = await service.execute({ ...makeRequest('chat'), rawText: 'question' });

    expect(reply.text.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    expect(reply.text).not.toContain('<script>');
    expect(reply.text).not.toContain('https://leak.example.com/internal');
    expect(reply.text).toContain('[redacted]');
  });
});
