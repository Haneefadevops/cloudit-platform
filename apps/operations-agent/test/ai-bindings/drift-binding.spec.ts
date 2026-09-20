import { driftBinding } from '../../src/ai-bindings';
import { defaultDriftSource } from '../../src/ai/read-model';

describe('driftBinding', () => {
  it('passes the given drift source through unchanged', () => {
    const source = {
      summary: () => ({ state: 'drift_detected', driftCount: 2, staleCount: 1, scannedAt: '2026-09-21T12:00:00.000Z' }),
    };
    expect(driftBinding(source)).toBe(source);
    expect(driftBinding(source).summary()).toEqual({
      state: 'drift_detected',
      driftCount: 2,
      staleCount: 1,
      scannedAt: '2026-09-21T12:00:00.000Z',
    });
  });

  it('falls back to the fail-closed default when no source is bound', () => {
    const bound = driftBinding(undefined);
    expect(bound).not.toBeUndefined();
    expect(bound.summary()).toEqual({ state: 'unknown', driftCount: 0, staleCount: 0, scannedAt: null });
    expect(bound.summary()).toEqual(defaultDriftSource().summary());
  });
});
