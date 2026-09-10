#!/bin/bash
set -euo pipefail

# Ensure the dedicated `operations` database, roles and schema exist for the
# CloudIT Operations Portal (Phase 3).
#
# Reads the PostgreSQL admin credentials from infra/postgres/.env (same
# pattern as ensure-databases.sh) and applies the idempotent migrations under
# infra/postgres/operations/migrations/ in order.
#
# Optional protected environment values (provisioned only in the server's
# gitignored infra/postgres/.env; never committed):
#   OPERATIONS_DB_OWNER_PASSWORD   password for the operations_owner login
#   OPERATIONS_DB_INGEST_PASSWORD  password for the operations_ingest login
# Without them the roles are still created/updated but keep unusable
# passwords, and this script prints a provisioning warning instead of failing
# the deployment. Nothing here touches any database other than `operations`.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

POSTGRES_ENV_FILE="${PROJECT_ROOT}/infra/postgres/.env"
OPERATIONS_DIR="${PROJECT_ROOT}/infra/postgres/operations"
MIGRATIONS_DIR="${OPERATIONS_DIR}/migrations"
OPERATIONS_DB="operations"
PG_CONTAINER="${OPERATIONS_PG_CONTAINER:-postgres}"

if [ ! -f "$POSTGRES_ENV_FILE" ]; then
  echo "[ensure-operations-database] ERROR: ${POSTGRES_ENV_FILE} not found"
  exit 1
fi

# shellcheck source=/dev/null
set -a
source "$POSTGRES_ENV_FILE"
set +a

POSTGRES_USER="${POSTGRES_USER:-cloudit}"
POSTGRES_DB="${POSTGRES_DB:-cloudit}"

psql_admin() {
  docker exec -i "$PG_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q "$@"
}

wait_for_postgres() {
  echo "[ensure-operations-database] Waiting for PostgreSQL to be ready..."
  for i in {1..60}; do
    if docker exec "$PG_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1" >/dev/null 2>&1; then
      echo "[ensure-operations-database] PostgreSQL is ready"
      return 0
    fi
    sleep 2
  done
  echo "[ensure-operations-database] ERROR: PostgreSQL did not become ready"
  return 1
}

echo "[ensure-operations-database] Using container '${PG_CONTAINER}'"

wait_for_postgres

if docker exec "$PG_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${OPERATIONS_DB}'" | grep -q 1; then
  echo "[ensure-operations-database] Database '${OPERATIONS_DB}' already exists"
else
  echo "[ensure-operations-database] Creating database '${OPERATIONS_DB}'..."
  docker exec "$PG_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "CREATE DATABASE ${OPERATIONS_DB};"
  echo "[ensure-operations-database] Database '${OPERATIONS_DB}' created"
fi

for migration in "${MIGRATIONS_DIR}"/*.sql; do
  name="$(basename "$migration")"
  echo "[ensure-operations-database] Applying ${name}..."
  docker exec -i "$PG_CONTAINER" psql -U "$POSTGRES_USER" -d "$OPERATIONS_DB" \
    -v ON_ERROR_STOP=1 -q -f - < "$migration"
done

if [ -n "${OPERATIONS_DB_OWNER_PASSWORD:-}" ]; then
  docker exec -i "$PG_CONTAINER" psql -U "$POSTGRES_USER" -d "$OPERATIONS_DB" \
    -v ON_ERROR_STOP=1 -q -v role_password="$OPERATIONS_DB_OWNER_PASSWORD" <<'SQL'
ALTER ROLE operations_owner WITH LOGIN PASSWORD :'role_password';
SQL
  echo "[ensure-operations-database] operations_owner password applied"
else
  echo "[ensure-operations-database] WARNING: OPERATIONS_DB_OWNER_PASSWORD not set;"
  echo "[ensure-operations-database]          the portal login stays without a password."
  echo "[ensure-operations-database]          Provision it in ${POSTGRES_ENV_FILE} (server-side, gitignored)."
fi

if [ -n "${OPERATIONS_DB_INGEST_PASSWORD:-}" ]; then
  docker exec -i "$PG_CONTAINER" psql -U "$POSTGRES_USER" -d "$OPERATIONS_DB" \
    -v ON_ERROR_STOP=1 -q -v role_password="$OPERATIONS_DB_INGEST_PASSWORD" <<'SQL'
ALTER ROLE operations_ingest WITH LOGIN PASSWORD :'role_password';
SQL
  echo "[ensure-operations-database] operations_ingest password applied"
else
  echo "[ensure-operations-database] WARNING: OPERATIONS_DB_INGEST_PASSWORD not set;"
  echo "[ensure-operations-database]          the ingestion login stays without a password."
  echo "[ensure-operations-database]          Provision it before Phase 4 publishing."
fi

# Smoke check: roles exist, schema present, no data seeded.
roles_ok="$(docker exec "$PG_CONTAINER" psql -U "$POSTGRES_USER" -d "$OPERATIONS_DB" -tAc \
  "SELECT count(*) FROM pg_roles WHERE rolname IN ('operations_anon','operations_owner','operations_ingest','operations_maintenance')")"
tables_ok="$(docker exec "$PG_CONTAINER" psql -U "$POSTGRES_USER" -d "$OPERATIONS_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='operations' AND table_type='BASE TABLE'")"

if [ "$roles_ok" != "4" ]; then
  echo "[ensure-operations-database] ERROR: expected 4 operations roles, found ${roles_ok}"
  exit 1
fi
if [ "$tables_ok" -lt 20 ]; then
  echo "[ensure-operations-database] ERROR: expected at least 20 operations tables, found ${tables_ok}"
  exit 1
fi

echo "[ensure-operations-database] OK: ${roles_ok} roles, ${tables_ok} tables, migrations applied"
