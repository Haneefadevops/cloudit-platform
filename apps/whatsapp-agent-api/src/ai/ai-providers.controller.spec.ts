import { ForbiddenException } from '@nestjs/common';
import { AiProvidersController } from './ai-providers.controller';

const ENV = {
  AI_API_KEY: 'sk-openai',
  AI_API_URL: 'https://api.openai.com/v1/chat/completions',
  AI_MODEL: 'gpt-5.6-luna',
  KIMI_API_KEY: 'kimi-key',
  KIMI_MODEL: 'kimi-latest',
  AI_MODEL_PRICES: '{"gpt-5.6-luna":{"in":1,"out":6}}',
  AI_INPUT_PRICE_PER_1M_TOKENS: '0.5',
  AI_OUTPUT_PRICE_PER_1M_TOKENS: '1.5',
};

function setup(options: { lastFailoverMinutesAgo?: number | null } = {}) {
  const lastEvent =
    options.lastFailoverMinutesAgo != null
      ? {
          id: 'evt-1',
          source: 'reply',
          fromModel: 'gpt-5.6-luna',
          toModel: 'kimi-latest',
          error: 'Chat API error: 500',
          createdAt: new Date(
            Date.now() - options.lastFailoverMinutesAgo * 60 * 1000,
          ),
        }
      : null;

  const prisma = {
    aiFailoverEvent: {
      findFirst: jest.fn().mockResolvedValue(lastEvent),
      findMany: jest
        .fn()
        .mockResolvedValue(lastEvent ? [lastEvent] : []),
    },
    $queryRaw: jest.fn().mockResolvedValue([
      {
        clientId: 'client-1',
        clientName: 'CloudIT',
        model: 'gpt-5.6-luna',
        conversations: 10n,
        requests: 40n,
        prompt: 2_000_000,
        completion: 500_000,
      },
    ]),
  };
  const config = { get: (key: string) => ENV[key] };
  const controller = new AiProvidersController(
    prisma as never,
    config as never,
  );
  return { prisma, controller };
}

describe('AiProvidersController.status', () => {
  it('returns the provider map with failover configured and healthy primary', async () => {
    const { controller } = setup({ lastFailoverMinutesAgo: null });
    const result = await controller.status({ role: 'supervisor' });

    expect(result.chat.primary.model).toBe('gpt-5.6-luna');
    expect(result.chat.primary.provider).toBe('api.openai.com');
    expect(result.chat.fallback?.model).toBe('kimi-latest');
    expect(result.chat.failoverConfigured).toBe(true);
    expect(result.chat.serving).toBe('primary');
    expect(result.whisper.model).toBe('whisper-1');
    expect(result.embeddings.provider).toBe('api.moonshot.ai');
  });

  it('reports serving=fallback when a failover happened within 15 minutes', async () => {
    const { controller } = setup({ lastFailoverMinutesAgo: 5 });
    const result = await controller.status({ role: 'admin' });
    expect(result.chat.serving).toBe('fallback');
    expect(result.lastFailover?.toModel).toBe('kimi-latest');
  });

  it('reports serving=primary again after the degraded window', async () => {
    const { controller } = setup({ lastFailoverMinutesAgo: 60 });
    const result = await controller.status({ role: 'admin' });
    expect(result.chat.serving).toBe('primary');
  });

  it('rejects portal users', async () => {
    const { controller } = setup();
    await expect(
      controller.status({ role: 'client_admin' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AiProvidersController.margins', () => {
  it('rejects supervisors (owner-only financial data)', async () => {
    const { controller } = setup();
    await expect(
      controller.margins({ role: 'supervisor' }, '30d'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects portal users', async () => {
    const { controller } = setup();
    await expect(
      controller.margins({ role: 'client_staff' }, '30d'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns per-client cost priced per model for the owner', async () => {
    const { controller } = setup();
    const result = await controller.margins({ role: 'admin' }, '30d');

    expect(result).toHaveLength(1);
    expect(result[0].clientName).toBe('CloudIT');
    expect(result[0].conversations).toBe(10);
    // 2M prompt @ $1 + 0.5M completion @ $6 = $5
    expect(result[0].estimatedCostUsd).toBe(5);
  });
});
