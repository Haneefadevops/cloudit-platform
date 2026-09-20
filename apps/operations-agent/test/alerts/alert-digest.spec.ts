import { DigestEntry } from '../../src/alerts';
import { makeEngine, verdict, ENV, StubGate } from './fakes';

const ENTRIES: DigestEntry[] = [
  { subjectKey: 'WF_A', category: 'RED', summary: 'ignored summary A', lastOccurredAt: '2026-10-05T01:00:00Z' },
  { subjectKey: 'WF_B', category: 'AMBER', summary: 'ignored summary B', lastOccurredAt: '2026-10-05T02:00:00Z' },
  { subjectKey: 'WF_C', category: 'GREEN', summary: 'ignored summary C', lastOccurredAt: '2026-10-05T03:00:00Z' },
  { subjectKey: 'WF_D', category: 'NO_DATA', summary: 'ignored summary D', lastOccurredAt: '2026-10-05T04:00:00Z' },
];

describe('AlertEngine digest composer', () => {
  it('sends a digest with period header, entry count, per-category counts and subject lines', async () => {
    const { engine, sender } = makeEngine();
    const decision = await engine.sendDigest(ENV, 'daily', ENTRIES);

    expect(decision.action).toBe('SENT');
    const message = decision.message!;
    expect(message.kind).toBe('digest');
    expect(message.subjectKey).toBe('digest');
    expect(message.environmentKey).toBe(ENV);
    expect(message.occurredAt).toBe(new Date(Date.UTC(2026, 9, 5, 12)).toISOString());

    const [header, ...lines] = message.text.split('\n');
    expect(header).toContain('CloudIT daily digest');
    expect(header).toContain(`environment=${ENV}`);
    expect(header).toContain('entries=4');
    expect(header).toContain('RED=1');
    expect(header).toContain('AMBER=1');
    expect(header).toContain('GREEN=1');
    expect(header).toContain('NO_DATA=1');
    expect(header).toContain('UNKNOWN=0');
    expect(lines).toEqual(['WF_A: RED', 'WF_B: AMBER', 'WF_C: GREEN', 'WF_D: NO_DATA']);
  });

  it('never includes entry summaries or timestamps in the digest text', async () => {
    const { engine } = makeEngine();
    const decision = await engine.sendDigest(ENV, 'weekly', ENTRIES);
    expect(decision.message!.text).not.toContain('ignored summary');
    expect(decision.message!.text).not.toContain('2026-10-05T0');
  });

  it('supports weekly and monthly periods', async () => {
    const { engine } = makeEngine();
    const weekly = await engine.sendDigest(ENV, 'weekly', []);
    expect(weekly.message!.text).toContain('CloudIT weekly digest');
    expect(weekly.message!.text).toContain('entries=0');
    const monthly = await engine.sendDigest(ENV, 'monthly', []);
    expect(monthly.message!.text).toContain('CloudIT monthly digest');
  });

  it('applies the rate limit to digests', async () => {
    const { engine } = makeEngine({ maxAlertsPerHour: 1 });
    await engine.handle(ENV, verdict({ issueCode: 'WF_A' })); // uses the single budget slot
    const decision = await engine.sendDigest(ENV, 'daily', ENTRIES);
    expect(decision.action).toBe('SUPPRESSED_RATE_LIMITED');
  });

  it('applies the kill switch to digests', async () => {
    const { engine } = makeEngine({ gate: new StubGate(false) });
    expect((await engine.sendDigest(ENV, 'daily', ENTRIES)).action).toBe('BLOCKED_KILL_SWITCH');
  });
});
