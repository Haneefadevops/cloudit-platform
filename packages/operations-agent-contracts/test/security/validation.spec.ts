import { SecurityError } from '../../src/security/errors';
import { checkBudget, checkReplay, validateEvidenceBatch } from '../../src/security/validate';
import { MALFORMED_INPUT_FIXTURES } from '../../src/security/fixtures/malformed-input';
import { OVER_BUDGET_FIXTURES } from '../../src/security/fixtures/over-budget';
import { REPLAY_FIXTURES } from '../../src/security/fixtures/replay';

describe('validateEvidenceBatch (malformed input)', () => {
  it('rejects every malformed fixture fail-closed with its expected issue code', () => {
    for (const fixture of MALFORMED_INPUT_FIXTURES) {
      const result = validateEvidenceBatch(fixture.input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(SecurityError);
        const codes = result.error.issues.map((issue) => issue.code);
        expect(codes).toContain(fixture.expectedIssue);
      }
    }
  });

  it('never throws and never returns partial output (no unhandled rejection path)', () => {
    for (const fixture of MALFORMED_INPUT_FIXTURES) {
      const run = () => validateEvidenceBatch(fixture.input);
      expect(run).not.toThrow();
      const result = run();
      expect(result.ok).toBe(false);
    }
  });

  it('rejects circular structures without throwing', () => {
    const circular: Record<string, unknown> = { id: 'ev-1' };
    circular.self = circular;
    const result = validateEvidenceBatch([circular]);
    expect(result.ok).toBe(false);
  });

  it('accepts a valid minimal batch and computes totals', () => {
    const result = validateEvidenceBatch([
      { id: 'ev-1', nonce: 'n-1', timestamp: 1700000000000, costMicros: 100, tokenCount: 500 },
      { id: 'ev-2', costMicros: 250, tokenCount: 750 },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toHaveLength(2);
      expect(result.value.totals.costMicros).toBe(350);
      expect(result.value.totals.tokenCount).toBe(1250);
      expect(result.value.items[1]?.nonce).toBeNull();
    }
  });
});

describe('checkReplay', () => {
  it('rejects every replay fixture and names the duplicated value', () => {
    for (const fixture of REPLAY_FIXTURES) {
      const validated = validateEvidenceBatch(fixture.items);
      expect(validated.ok).toBe(true);
      if (!validated.ok) continue;
      const result = checkReplay(validated.value);
      if (fixture.expectedDuplicate === null) {
        expect(result.ok).toBe(true);
      } else {
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('SECURITY_ERR_REPLAY');
          const text = result.error.issues.map((issue) => issue.message).join('\n');
          expect(text).toContain(fixture.expectedDuplicate);
        }
      }
    }
  });

  it('returns the batch unchanged when clean (no partial transformation)', () => {
    const validated = validateEvidenceBatch([{ id: 'ev-1', nonce: 'n-1' }, { id: 'ev-2', nonce: 'n-2' }]);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      const result = checkReplay(validated.value);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(validated.value);
    }
  });
});

describe('checkBudget', () => {
  it('rejects over-budget fixtures fail-closed and accepts the within-budget control', () => {
    for (const fixture of OVER_BUDGET_FIXTURES) {
      const validated = validateEvidenceBatch(fixture.items);
      expect(validated.ok).toBe(true);
      if (!validated.ok) continue;
      const result = checkBudget(validated.value, fixture.cap);
      if (fixture.expected === 'within-budget') {
        expect(result.ok).toBe(true);
      } else {
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('SECURITY_ERR_BUDGET');
          const text = result.error.issues.map((issue) => issue.path).join('\n');
          if (fixture.expected.startsWith('item')) {
            expect(text).toMatch(/\$\[\d+\]\./);
          } else {
            expect(text).toContain('$.totals');
          }
        }
      }
    }
  });

  it('never throws on extreme numeric values (validation already gated them)', () => {
    const validated = validateEvidenceBatch([{ id: 'ev-1', costMicros: Number.MAX_SAFE_INTEGER, tokenCount: Number.MAX_SAFE_INTEGER }]);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(() => checkBudget(validated.value, {
        maxItemCostMicros: 1,
        maxItemTokens: 1,
        maxTotalCostMicros: 1,
        maxTotalTokens: 1,
      })).not.toThrow();
      const result = checkBudget(validated.value, {
        maxItemCostMicros: 1,
        maxItemTokens: 1,
        maxTotalCostMicros: 1,
        maxTotalTokens: 1,
      });
      expect(result.ok).toBe(false);
    }
  });
});
