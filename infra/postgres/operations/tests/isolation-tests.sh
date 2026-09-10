#!/bin/bash
set -euo pipefail

# CloudIT Operations Portal — Phase 3 gate runner.
#
# Runs the isolation/security suite in infra/postgres/operations/tests/
# against the operations database in a dedicated PostgreSQL container.
# The suite runs in a single transaction and rolls back, leaving no rows.
#
# Usage:
#   OPERATIONS_PG_CONTAINER=<container> bash infra/postgres/operations/tests/isolation-tests.sh
#
# The container must already have the migrations applied
# (infra/scripts/ensure-operations-database.sh). Do not point this at any
# database that serves other applications.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"

POSTGRES_ENV_FILE="${PROJECT_ROOT}/infra/postgres/.env"
PG_CONTAINER="${OPERATIONS_PG_CONTAINER:-postgres}"
OPERATIONS_DB="operations"

if [ ! -f "$POSTGRES_ENV_FILE" ]; then
  echo "[isolation-tests] ERROR: ${POSTGRES_ENV_FILE} not found"
  exit 1
fi

# shellcheck source=/dev/null
set -a
source "$POSTGRES_ENV_FILE"
set +a

POSTGRES_USER="${POSTGRES_USER:-cloudit}"

if ! docker exec "$PG_CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$OPERATIONS_DB" >/dev/null 2>&1; then
  echo "[isolation-tests] ERROR: PostgreSQL container '${PG_CONTAINER}' or database '${OPERATIONS_DB}' not ready"
  exit 1
fi

echo "[isolation-tests] Running Phase 3 isolation suite against '${PG_CONTAINER}/${OPERATIONS_DB}'..."
echo "[isolation-tests] Everything runs in one transaction and is rolled back."

output="$(docker exec -i "$PG_CONTAINER" psql -U "$POSTGRES_USER" -d "$OPERATIONS_DB" \
  -v ON_ERROR_STOP=1 -f - < "${SCRIPT_DIR}/isolation-tests.sql" 2>&1)" || {
    echo "$output"
    echo "[isolation-tests] SUITE ABORTED (see output above)"
    exit 1
  }

echo "$output"

if echo "$output" | grep -q '| FAIL |'; then
  echo "[isolation-tests] RESULT: FAILED — failing assertions above"
  exit 1
fi

if ! echo "$output" | awk -F'|' 'NF == 3 && ($1 + 0) > 0 && ($1 + 0) == ($2 + 0) && ($3 + 0) == 0 { found = 1 } END { exit found ? 0 : 1 }'; then
  echo "[isolation-tests] RESULT: FAILED — summary row missing or unexpected"
  exit 1
fi

echo "[isolation-tests] RESULT: ALL TESTS PASSED"
