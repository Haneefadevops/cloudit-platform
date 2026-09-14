// Configuration for the read-only operations database access module.
//
// Mirrors the conventions of apps/operations-ingest/src/config.ts. Every
// value comes from the container environment; nothing secret is committed.
// Never put a `$` character in a default value or example — the server
// Docker Compose env_file interpolation would corrupt it.

function requireEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.length > 0) {
      return value;
    }
  }
  // Safe generic error: never include secret values or attempted values.
  throw new Error(
    `missing required environment variable (tried: ${names.join(', ')})`,
  );
}

export const operationsConfig = {
  db: {
    host: process.env.OPERATIONS_DB_HOST ?? 'postgres',
    port: Number(process.env.OPERATIONS_DB_PORT ?? 5432),
    database: process.env.OPERATIONS_DB_NAME ?? 'operations',
    user: process.env.OPERATIONS_DB_USER ?? 'operations_owner',
    // Accept the dedicated name first, then fall back to the shared role
    // password name from infra/postgres/.env.
    password: requireEnv([
      'OPERATIONS_DB_PASSWORD',
      'OPERATIONS_DB_OWNER_PASSWORD',
    ]),
  },
  // Token required on the x-operations-internal-token header for every
  // operations endpoint. Undefined when not configured; the guard then
  // fails closed with 401.
  internalApiToken: process.env.OPERATIONS_INTERNAL_API_TOKEN || undefined,
  // Statement timeout for every query against the operations database.
  statementTimeoutMs: 15_000,
  // Watchdog cadence freshness threshold used by the environment health
  // rollup (Phase 0 rules): evidence older than this makes an environment
  // AMBER.
  staleEvidenceMs: 45 * 60 * 1_000,
  // Phase 7 analytics (Vercel/ImageKit) rollup freshness threshold: those
  // providers publish daily/6-hourly evidence, so staleness is judged
  // against 24 hours rather than the 45-minute infrastructure window.
  analyticsStaleEvidenceMs: 24 * 60 * 60 * 1_000,
};

export type OperationsConfig = typeof operationsConfig;
