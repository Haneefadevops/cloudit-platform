# CloudIT Operations Ingest — tests

`smoke.mjs` is the Phase 4 endpoint gate suite. It runs signed HTTP requests
against the private ingestion service and verifies the full Phase 0 section
7.1 behaviour end to end: HMAC authentication, timestamp and nonce replay
rejection, batch retry returning the original receipt, record-level
idempotent replay, atomic mixed-batch rejection and body-size limits.

Run it against throwaway containers only (a fresh PostgreSQL container with
the operations migrations and a Redis instance). The database rows it writes
are disposable; never point `PG_CONTAINER` at a shared database.

```bash
# 1. fresh throwaway postgres container with the operations schema
docker run -d --name operations-phase4-test \
  -p 55432:5432 \
  -e POSTGRES_USER=cloudit -e POSTGRES_PASSWORD=testpw -e POSTGRES_DB=cloudit \
  pgvector/pgvector:pg16

# 2. apply migrations (from the repository root)
OPERATIONS_PG_CONTAINER=operations-phase4-test \
OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N=test-only-publisher-secret-0123456789abcdef \
  bash infra/scripts/ensure-operations-database.sh

# 3. set a throwaway password on the ingest role, then start the service
docker exec operations-phase4-test psql -U cloudit -d operations \
  -c "ALTER ROLE operations_ingest WITH LOGIN PASSWORD 'test-ingest-pw'"
cd apps/operations-ingest
npm run build
OPERATIONS_DB_HOST=localhost OPERATIONS_DB_PORT=55432 OPERATIONS_DB_PASSWORD=test-ingest-pw \
OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N=test-only-publisher-secret-0123456789abcdef \
  node dist/server.js &
cd ../..

# 4. run the suite
PUBLISHER_SECRET=test-only-publisher-secret-0123456789abcdef \
  node infra/operations-ingest/tests/smoke.mjs
```

Expected result: every check prints `PASS` and the final line is
`SMOKE TESTS PASSED`.
