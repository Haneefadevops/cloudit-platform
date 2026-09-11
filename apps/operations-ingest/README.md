# CloudIT Operations Ingest

Private evidence ingestion endpoint for the CloudIT Operations Portal
(Phase 4, Phase 0 specification section 7).

n8n publishes normalized, sanitized operational evidence to this service over
the private Docker network. The service has **no published port and no
reverse-proxy route**, so it can never be reached from the browser or the
internet. Only containers on the `cloudit` network (n8n) can call it.

## Request contract

`POST /v1/batches` with the raw JSON array of envelopes as the body.

Headers (all required):

| Header | Value |
| --- | --- |
| `x-publisher-key` | Registered publisher key, e.g. `cavetta-production-n8n` |
| `x-timestamp` | Unix seconds at signing |
| `x-nonce` | 8–160 chars `[A-Za-z0-9_-]`, unique per request attempt |
| `x-signature` | Lowercase hex HMAC-SHA256 |

Signing (HMAC key = the publisher secret):

```
digest    = sha256hex(rawBody)
signature = hmac_sha256_hex(secret, timestamp + "." + nonce + "." + digest)
```

Rules enforced before the database is called: body ≤ 1 MiB, timestamp within
±5 minutes, known publisher and a valid signature over
`timestamp.nonce.sha256(body)` with the publisher secret. The service then
calls `operations_ingest.submit_batch` as the `operations_ingest` database
role, which re-authenticates the publisher, rejects reused batch nonces by
returning the original receipt, validates every record, rejects the whole
batch on any validation error and writes one append-only receipt. An
idempotent retry of the exact same request is therefore a success
(`duplicate_batch`), never an error; record-level `idempotencyKey` replays
are counted as duplicates without writing rows again. Clients must still use
a fresh nonce per request attempt.

Responses carry only `result`, `receiptId`, safe machine `code`s and counts —
never the submitted payload, a secret, or a stack trace.

## Configuration

All values come from the container environment (production: the protected
server file `infra/postgres/.env`).

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3020` | |
| `OPERATIONS_DB_HOST` / `OPERATIONS_DB_PORT` | `postgres` / `5432` | |
| `OPERATIONS_DB_NAME` / `OPERATIONS_DB_USER` | `operations` / `operations_ingest` | |
| `OPERATIONS_DB_PASSWORD` | — | Falls back to `OPERATIONS_DB_INGEST_PASSWORD` |
| `OPERATIONS_PUBLISHER_SECRET_<KEY>` | — | One per publisher; see convention below |

Publisher secret convention: upper-case the publisher key and map every
non-alphanumeric run to `_`, e.g. `cavetta-production-n8n` →
`OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N`. The same value must be
present in `infra/postgres/.env` so the seed hashes it into the publisher
row.

## Endpoints

- `GET /health` — non-sensitive liveness probe.
- `POST /v1/batches` — the only ingest route.

## Development

```
npm ci
npm run typecheck --workspace=@cloudit/operations-ingest
npm run build --workspace=@cloudit/operations-ingest
```

End-to-end smoke test against throwaway containers:
see `../../infra/operations-ingest/tests/smoke.mjs`.
