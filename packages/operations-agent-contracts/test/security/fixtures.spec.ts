import {
  MALFORMED_INPUT_FIXTURES,
  OVER_BUDGET_FIXTURES,
  PROMPT_INJECTION_FIXTURES,
  REPLAY_FIXTURES,
  SECRET_CANARY_CATEGORIES,
  SECRET_CANARY_FIXTURES,
} from '../../src/security/fixtures';

const FAKE_MARKERS = ['FAKECANARY', 'fake-canary', 'example-canary', 'canary.invalid'];

function assertObviouslyFake(value: string): void {
  expect(FAKE_MARKERS.some((marker) => value.includes(marker))).toBe(true);
}

describe('fixture integrity', () => {
  it('every secret canary is obviously fake (no real credential values)', () => {
    for (const canary of SECRET_CANARY_FIXTURES) {
      assertObviouslyFake(canary.value);
      expect(canary.value.length).toBeGreaterThan(0);
      expect(SECRET_CANARY_CATEGORIES).toContain(canary.category);
    }
  });

  it('canary fixture ids and values are unique', () => {
    const ids = SECRET_CANARY_FIXTURES.map((c) => c.id);
    const values = SECRET_CANARY_FIXTURES.map((c) => c.value);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(values).size).toBe(values.length);
  });

  it('every prompt-injection fixture has a unique id and non-empty evidence text', () => {
    const ids = PROMPT_INJECTION_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const fixture of PROMPT_INJECTION_FIXTURES) {
      expect(fixture.text.trim().length).toBeGreaterThan(0);
      expect(fixture.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('injection fixtures cover plain, roleplay, delimiter, markup and obfuscated channels', () => {
    const channels = new Set(PROMPT_INJECTION_FIXTURES.map((f) => f.channel));
    for (const expected of ['plain', 'roleplay', 'delimiter', 'markup', 'obfuscated'] as const) {
      expect(channels.has(expected)).toBe(true);
    }
  });

  it('malformed, replay and over-budget fixtures are non-empty with unique ids', () => {
    for (const set of [MALFORMED_INPUT_FIXTURES, REPLAY_FIXTURES, OVER_BUDGET_FIXTURES]) {
      expect(set.length).toBeGreaterThan(0);
      const ids = set.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('replay fixtures include exactly one valid control', () => {
    expect(REPLAY_FIXTURES.filter((f) => f.expectedDuplicate === null)).toHaveLength(1);
  });

  it('over-budget fixtures include exactly one within-budget control', () => {
    expect(OVER_BUDGET_FIXTURES.filter((f) => f.expected === 'within-budget')).toHaveLength(1);
  });
});
