// Configuration for the private operations ingestion endpoint.
//
// Every value comes from the container environment. The production container
// receives its environment from the protected server files
// infra/postgres/.env and infra/redis/.env via docker-compose env_file
// entries; nothing secret is committed or baked into the image.
//
// Publisher HMAC secrets use a fixed convention so the server env file, the
// database seed and this service all agree:
//   OPERATIONS_PUBLISHER_SECRET_<NORMALIZED_PUBLISHER_KEY>
// where NORMALIZED upper-cases the publisher key and maps every non-alphanumeric
// run to one underscore, e.g. publisher key `cavetta-production-n8n` ->
// `OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N`.

const PUBLISHER_SECRET_PREFIX = 'OPERATIONS_PUBLISHER_SECRET_';

export function normalizePublisherKey(publisherKey: string): string {
  return publisherKey.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

export function publisherSecretEnvName(publisherKey: string): string {
  return `${PUBLISHER_SECRET_PREFIX}${normalizePublisherKey(publisherKey)}`;
}

export function publisherSecretFor(publisherKey: string): string | undefined {
  const value = process.env[publisherSecretEnvName(publisherKey)];
  return value && value.length > 0 ? value : undefined;
}

export function knownPublisherKeys(): string[] {
  return Object.keys(process.env)
    .filter((name) => name.startsWith(PUBLISHER_SECRET_PREFIX))
    .map((name) =>
      name
        .slice(PUBLISHER_SECRET_PREFIX.length)
        .toLowerCase()
        .replace(/_/g, '-'),
    );
}

function requireEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.length > 0) {
      return value;
    }
  }
  throw new Error(
    `missing required environment variable (tried: ${names.join(', ')})`,
  );
}

export const config = {
  port: Number(process.env.PORT ?? 3020),
  maxBodyBytes: 1_048_576, // 1 MiB; mirrors the database batch limit
  timestampToleranceSeconds: 300, // ±5 minutes, per Phase 0 section 7.1
  db: {
    host: process.env.OPERATIONS_DB_HOST ?? 'postgres',
    port: Number(process.env.OPERATIONS_DB_PORT ?? 5432),
    database: process.env.OPERATIONS_DB_NAME ?? 'operations',
    user: process.env.OPERATIONS_DB_USER ?? 'operations_ingest',
    // Accept the dedicated name first, then fall back to the shared role
    // password name from infra/postgres/.env.
    password: requireEnv(['OPERATIONS_DB_PASSWORD', 'OPERATIONS_DB_INGEST_PASSWORD']),
  },
};
