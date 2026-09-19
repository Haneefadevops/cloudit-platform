import { Test } from '@nestjs/testing';
import {
  InMemoryReadOnlyEvidence,
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
});
