import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AgentConfigService } from '../src/config/agent-config.service';

describe('AppModule bootstrap (coordinator)', () => {
  it('compiles with safe defaults and every capability disabled', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const config = moduleRef.get(AgentConfigService);
    const c = config.get();
    expect(c.aiEnabled).toBe(false);
    expect(c.telegramCommandsEnabled).toBe(false);
    expect(c.autoRemediationEnabled).toBe(false);
    expect(c.repairMasterEnabled).toBe(false);
    expect(c.aiMonthlyEurCeiling).toBeLessThanOrEqual(15);

    await moduleRef.close();
  });

  it('rejects an AI ceiling above the owner budget', () => {
    const original = process.env.AI_MONTHLY_EUR_CEILING;
    process.env.AI_MONTHLY_EUR_CEILING = '20';
    expect(() => new AgentConfigService()).toThrow(/EUR 15/);
    if (original === undefined) delete process.env.AI_MONTHLY_EUR_CEILING;
    else process.env.AI_MONTHLY_EUR_CEILING = original;
  });
});
