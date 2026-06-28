#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTAINER_NAME="postgres-platform-event-test"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-cloudit}"

cleanup() {
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

cleanup

echo "Starting temporary Postgres for event test..."
docker run -d --name "${CONTAINER_NAME}" \
  -p "5435:5432" \
  -e POSTGRES_USER=cloudit \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  -e POSTGRES_DB=platform \
  postgres:16-alpine >/dev/null

until docker exec "${CONTAINER_NAME}" pg_isready -U cloudit -d platform >/dev/null 2>&1; do
  sleep 1
done

cd "${PROJECT_DIR}"
export DATABASE_URL="postgresql://cloudit:${POSTGRES_PASSWORD}@localhost:5435/platform?schema=public"
export N8N_WEBHOOK_URL=""
export JWT_SECRET="test-jwt-secret"

npx prisma migrate deploy
npx ts-node scripts/emit-test-event.ts

echo "Event test complete."
