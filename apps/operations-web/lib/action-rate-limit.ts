import "server-only";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 10;
const MAX_TRACKED_KEYS = 10_000;

type Bucket = { failures: number; windowStartedAt: number };

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt >= WINDOW_MS) buckets.delete(key);
  }
  if (buckets.size > MAX_TRACKED_KEYS) buckets.clear();
}

export function isActionRateLimited(key: string, now = Date.now()): boolean {
  prune(now);
  const bucket = buckets.get(key);
  return bucket !== undefined && bucket.failures >= MAX_ATTEMPTS_PER_WINDOW;
}

export function recordActionFailure(key: string, now = Date.now()): void {
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket) {
    buckets.set(key, { failures: 1, windowStartedAt: now });
    return;
  }
  bucket.failures += 1;
}

export function recordActionSuccess(key: string): void {
  buckets.delete(key);
}
