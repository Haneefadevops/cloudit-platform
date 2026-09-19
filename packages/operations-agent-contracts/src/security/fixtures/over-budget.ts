/**
 * Over-budget fixtures: token/cost counts exceeding per-item or aggregate
 * caps. `expected` indicates which cap is violated.
 */
export interface EvidenceBudgetCap {
  readonly maxItemCostMicros: number;
  readonly maxItemTokens: number;
  readonly maxTotalCostMicros: number;
  readonly maxTotalTokens: number;
}

export const DEFAULT_BUDGET_CAP: EvidenceBudgetCap = {
  maxItemCostMicros: 1_000_000,
  maxItemTokens: 4_000,
  maxTotalCostMicros: 5_000_000,
  maxTotalTokens: 20_000,
};

export interface OverBudgetFixture {
  readonly id: string;
  readonly description: string;
  readonly items: readonly Record<string, unknown>[];
  readonly cap: EvidenceBudgetCap;
  readonly expected: 'item-cost' | 'item-tokens' | 'total-cost' | 'total-tokens' | 'within-budget';
}

export const OVER_BUDGET_FIXTURES: readonly OverBudgetFixture[] = [
  {
    id: 'budget-item-tokens-exceeded',
    description: 'A single item exceeds the per-item token cap.',
    items: [{ id: 'ev-301', nonce: 'n-301', timestamp: 1700000000000, costMicros: 100, tokenCount: DEFAULT_BUDGET_CAP.maxItemTokens + 1 }],
    cap: DEFAULT_BUDGET_CAP,
    expected: 'item-tokens',
  },
  {
    id: 'budget-item-cost-exceeded',
    description: 'A single item exceeds the per-item cost cap.',
    items: [{ id: 'ev-302', nonce: 'n-302', timestamp: 1700000000000, costMicros: DEFAULT_BUDGET_CAP.maxItemCostMicros + 1, tokenCount: 100 }],
    cap: DEFAULT_BUDGET_CAP,
    expected: 'item-cost',
  },
  {
    id: 'budget-total-tokens-exceeded',
    description: 'Aggregate token count exceeds the total cap although each item is within its cap.',
    items: [
      { id: 'ev-303', nonce: 'n-303', timestamp: 1700000000000, costMicros: 100, tokenCount: DEFAULT_BUDGET_CAP.maxItemTokens },
      { id: 'ev-304', nonce: 'n-304', timestamp: 1700000001000, costMicros: 100, tokenCount: DEFAULT_BUDGET_CAP.maxItemTokens },
      { id: 'ev-305', nonce: 'n-305', timestamp: 1700000002000, costMicros: 100, tokenCount: DEFAULT_BUDGET_CAP.maxItemTokens },
      { id: 'ev-309', nonce: 'n-309', timestamp: 1700000003000, costMicros: 100, tokenCount: DEFAULT_BUDGET_CAP.maxItemTokens },
      { id: 'ev-310', nonce: 'n-310', timestamp: 1700000004000, costMicros: 100, tokenCount: DEFAULT_BUDGET_CAP.maxItemTokens },
      { id: 'ev-311', nonce: 'n-311', timestamp: 1700000005000, costMicros: 100, tokenCount: DEFAULT_BUDGET_CAP.maxItemTokens },
    ],
    cap: DEFAULT_BUDGET_CAP,
    expected: 'total-tokens',
  },
  {
    id: 'budget-total-cost-exceeded',
    description: 'Aggregate cost exceeds the total cap although each item is within its cap.',
    items: [
      { id: 'ev-306', nonce: 'n-306', timestamp: 1700000000000, costMicros: DEFAULT_BUDGET_CAP.maxItemCostMicros, tokenCount: 100 },
      { id: 'ev-307', nonce: 'n-307', timestamp: 1700000001000, costMicros: DEFAULT_BUDGET_CAP.maxItemCostMicros, tokenCount: 100 },
      { id: 'ev-308', nonce: 'n-308', timestamp: 1700000002000, costMicros: DEFAULT_BUDGET_CAP.maxItemCostMicros, tokenCount: 100 },
      { id: 'ev-312', nonce: 'n-312', timestamp: 1700000003000, costMicros: DEFAULT_BUDGET_CAP.maxItemCostMicros, tokenCount: 100 },
      { id: 'ev-313', nonce: 'n-313', timestamp: 1700000004000, costMicros: DEFAULT_BUDGET_CAP.maxItemCostMicros, tokenCount: 100 },
      { id: 'ev-314', nonce: 'n-314', timestamp: 1700000005000, costMicros: DEFAULT_BUDGET_CAP.maxItemCostMicros, tokenCount: 100 },
    ],
    cap: DEFAULT_BUDGET_CAP,
    expected: 'total-cost',
  },
  {
    id: 'budget-within-control',
    description: 'All items and totals within the caps; must pass.',
    items: [
      { id: 'ev-401', nonce: 'n-401', timestamp: 1700000000000, costMicros: 100, tokenCount: 500 },
      { id: 'ev-402', nonce: 'n-402', timestamp: 1700000001000, costMicros: 200, tokenCount: 800 },
    ],
    cap: DEFAULT_BUDGET_CAP,
    expected: 'within-budget',
  },
];
