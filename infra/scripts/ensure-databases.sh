#!/bin/bash
set -euo pipefail

# Ensure all application databases exist.
# Reads credentials from infra/postgres/.env and creates any missing DBs.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

POSTGRES_ENV_FILE="${PROJECT_ROOT}/infra/postgres/.env"

if [ ! -f "$POSTGRES_ENV_FILE" ]; then
  echo "[ensure-databases] ERROR: ${POSTGRES_ENV_FILE} not found"
  exit 1
fi

# shellcheck source=/dev/null
set -a
source "$POSTGRES_ENV_FILE"
set +a

POSTGRES_USER="${POSTGRES_USER:-cloudit}"
POSTGRES_DB="${POSTGRES_DB:-cloudit}"

# Databases required by the application .env.example files
DATABASES=(
  platform
  hospitality
  touchorbit
  orbitone
  chatwoot
  whatsapp_agent
)

wait_for_postgres() {
  echo "[ensure-databases] Waiting for PostgreSQL to be ready..."
  for i in {1..60}; do
    if docker exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1" >/dev/null 2>&1; then
      echo "[ensure-databases] PostgreSQL is ready"
      return 0
    fi
    sleep 2
  done
  echo "[ensure-databases] ERROR: PostgreSQL did not become ready"
  return 1
}

create_database_if_missing() {
  local db="$1"
  if docker exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" | grep -q 1; then
    echo "[ensure-databases] Database '${db}' already exists"
  else
    echo "[ensure-databases] Creating database '${db}'..."
    docker exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE ${db};"
    docker exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${POSTGRES_USER};"
    echo "[ensure-databases] Database '${db}' created"
  fi
}

wait_for_postgres

for db in "${DATABASES[@]}"; do
  create_database_if_missing "$db"
done

echo "[ensure-databases] All application databases verified"
