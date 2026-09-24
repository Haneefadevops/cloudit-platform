import { Test } from '@nestjs/testing';
import {
  InMemoryReadOnlyEvidence,
  TELEGRAM_CHAT_RESPONDER,
  TELEGRAM_COMMAND_HANDLER,
  TELEGRAM_EVIDENCE_PORT,
  TelegramCommandService,
  TelegramCommandsModule,
} from '../../src/telegram/commands';
import { makeRequest } from './fixtures';

describe('TelegramCommandsModule', () => {
  it('binds TELEGRAM_COMMAND_HANDLER to TelegramCommandService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TelegramCommandsModule],
    }).compile();

    const handler = moduleRef.get<TelegramCommandService>(TELEGRAM_COMMAND_HANDLER);
    expect(handler).toBeInstanceOf(TelegramCommandService);

    const evidence = moduleRef.get(TELEGRAM_EVIDENCE_PORT);
    expect(evidence).toBeInstanceOf(InMemoryReadOnlyEvidence);

    const reply = await handler.execute(makeRequest('status'));
    expect(reply.text).toBe('Status: GREEN | sources 7 | open incidents 2');

    await moduleRef.close();
  });

  it('without a chat binding, free text degrades to the help text (fail-closed)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TelegramCommandsModule],
    }).compile();

    const handler = moduleRef.get<TelegramCommandService>(TELEGRAM_COMMAND_HANDLER);
    const reply = await handler.execute({ ...makeRequest('chat'), rawText: 'hello there' });

    expect(reply.text).toContain('/status');
    expect(reply.text).toContain('Any other message - AI chat (when enabled)');

    await moduleRef.close();
  });

  it('register({ chat }) binds the responder to TELEGRAM_CHAT_RESPONDER', async () => {
    const answer = jest.fn(async () => ({ text: 'ai: synthetic answer' }));
    const moduleRef = await Test.createTestingModule({
      imports: [
        TelegramCommandsModule.register({
          chat: { provide: TELEGRAM_CHAT_RESPONDER, useValue: { answer } },
        }),
      ],
    }).compile();

    const handler = moduleRef.get<TelegramCommandService>(TELEGRAM_COMMAND_HANDLER);
    const reply = await handler.execute({
      ...makeRequest('chat'),
      rawText: 'how are the backups doing?',
    });

    expect(answer).toHaveBeenCalledWith({ userId: 424242, chatId: 242424, question: 'how are the backups doing?' });
    expect(reply.text).toBe('ai: synthetic answer');

    await moduleRef.close();
  });
});
