import { makeEngine, verdict, ENV } from './fakes';

describe('AlertEngine message templates', () => {
  it('renders fixed bounded red_alert text with env, subject, category and evidence count', async () => {
    const { engine } = makeEngine();
    const decision = await engine.handle(ENV, verdict({ evidenceKeys: ['a', 'b', 'c'] }));
    const text = decision.message!.text;
    expect(text).toContain(`environment=${ENV}`);
    expect(text).toContain('subject=WF_STALE');
    expect(text).toContain('category=RED');
    expect(text).toContain('evidence=3');
    expect(text.length).toBeLessThanOrEqual(400);
  });

  it('never includes verdict.summary or evidence key text', async () => {
    const { engine } = makeEngine();
    const decision = await engine.handle(
      ENV,
      verdict({
        summary: 'SECRET SUMMARY TEXT THAT MUST NOT LEAK 998877',
        evidenceKeys: ['ev:secret-key-name'],
      }),
    );
    const text = decision.message!.text;
    expect(text).not.toContain('SECRET SUMMARY TEXT');
    expect(text).not.toContain('ev:secret-key-name');
    expect(text).not.toContain('Deterministic scan');
  });

  it('renders recovery with the new (non-RED) category', async () => {
    const { engine } = makeEngine();
    await engine.handle(ENV, verdict());
    const recovery = await engine.handle(ENV, verdict({ assessment: 'AMBER' }));
    const text = recovery.message!.text;
    expect(recovery.message!.kind).toBe('recovery');
    expect(text).toContain('category=AMBER');
    expect(text).toContain('subject=WF_STALE');
    expect(text.length).toBeLessThanOrEqual(400);
  });

  it('texts are deterministic for identical inputs', async () => {
    const { engine } = makeEngine();
    const a = await engine.handle(ENV, verdict({ issueCode: 'WF_X' }));
    const b = await engine.handle('env-other', verdict({ issueCode: 'WF_X' }));
    expect(a.message!.text.replace(ENV, 'env-other')).toBe(b.message!.text);
  });
});
