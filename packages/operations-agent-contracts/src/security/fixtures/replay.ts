/**
 * Replay fixtures: batches containing duplicate ids, duplicate nonces, or
 * duplicate (id, timestamp) pairs. `expectedDuplicate` names the value that
 * replay detection must flag.
 */
export interface ReplayFixture {
  readonly id: string;
  readonly description: string;
  readonly items: readonly Record<string, unknown>[];
  /** The duplicated value replay detection must flag; null for the valid control. */
  readonly expectedDuplicate: string | null;
}

export const REPLAY_FIXTURES: readonly ReplayFixture[] = [
  {
    id: 'replay-duplicate-id',
    description: 'Two distinct nonces share the same evidence id.',
    items: [
      { id: 'ev-100', nonce: 'nonce-aaa', timestamp: 1700000000000, costMicros: 5, tokenCount: 10 },
      { id: 'ev-100', nonce: 'nonce-bbb', timestamp: 1700000001000, costMicros: 6, tokenCount: 12 },
    ],
    expectedDuplicate: 'ev-100',
  },
  {
    id: 'replay-duplicate-nonce',
    description: 'Two distinct ids share the same nonce.',
    items: [
      { id: 'ev-101', nonce: 'nonce-shared', timestamp: 1700000000000, costMicros: 5, tokenCount: 10 },
      { id: 'ev-102', nonce: 'nonce-shared', timestamp: 1700000001000, costMicros: 6, tokenCount: 12 },
    ],
    expectedDuplicate: 'nonce-shared',
  },
  {
    id: 'replay-duplicate-id-timestamp',
    description: 'Same id and timestamp submitted twice (exact replay).',
    items: [
      { id: 'ev-103', nonce: 'nonce-ccc', timestamp: 1700000000000, costMicros: 5, tokenCount: 10 },
      { id: 'ev-103', nonce: 'nonce-ddd', timestamp: 1700000000000, costMicros: 5, tokenCount: 10 },
    ],
    expectedDuplicate: 'ev-103@1700000000000',
  },
  {
    id: 'replay-valid-control',
    description: 'All ids, nonces and (id, timestamp) pairs unique; must pass.',
    items: [
      { id: 'ev-201', nonce: 'nonce-201', timestamp: 1700000000000, costMicros: 5, tokenCount: 10 },
      { id: 'ev-202', nonce: 'nonce-202', timestamp: 1700000001000, costMicros: 6, tokenCount: 12 },
    ],
    expectedDuplicate: null,
  },
];
