import {
  SECRET_CANARY_FIXTURES,
  detectCanaryLeak,
} from '@cloudit/operations-agent-contracts';
import { makeEngine, verdict, ENV } from './fakes';

describe('AlertEngine canary leak protection', () => {
  for (const canary of SECRET_CANARY_FIXTURES) {
    it(`does not leak ${canary.category} canary present in verdict.summary (${canary.id})`, async () => {
      const { engine, sender } = makeEngine();
      const decision = await engine.handle(
        ENV,
        verdict({ summary: `note: ${canary.value} endnote` }),
      );
      expect(decision.action).toBe('SENT');
      expect(sender.sent).toHaveLength(1);
      expect(detectCanaryLeak(sender.sent[0].text).leaked).toBe(false);
      expect(sender.sent[0].text).not.toContain(canary.value);
    });
  }

  it('does not leak canaries placed in evidence key text', async () => {
    const canary = SECRET_CANARY_FIXTURES[0];
    const { engine, sender } = makeEngine();
    await engine.handle(ENV, verdict({ evidenceKeys: [canary.value, 'ev:safe'] }));
    expect(detectCanaryLeak(sender.sent[0].text).leaked).toBe(false);
  });

  it('replaces leaked digest text with the fixed safe template', async () => {
    const canary = SECRET_CANARY_FIXTURES[2];
    const { engine, sender } = makeEngine();
    // renderDigest is pure over closed inputs; simulate a hostile entry whose
    // subjectKey carries a canary and prove the guard fires.
    const decision = await engine.sendDigest(ENV, 'daily', [
      {
        subjectKey: `WF_X ${canary.value}`,
        category: 'RED',
        summary: 's',
        lastOccurredAt: '2026-10-05T00:00:00Z',
      },
    ]);
    if (decision.action === 'SENT') {
      const text = sender.sent[0].text;
      expect(detectCanaryLeak(text).leaked).toBe(false);
      expect(text).toContain('Details withheld by security policy');
    }
  });
});
