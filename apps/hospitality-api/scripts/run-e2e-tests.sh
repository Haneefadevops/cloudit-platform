#!/usr/bin/env bash
set -euo pipefail

# Run hospitality-api E2E tests against temporary Postgres and Redis containers.
# This script is intended for local development and CI environments.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
NETWORK_NAME="hospitality-e2e"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-cloudit}"
POSTGRES_USER="${POSTGRES_USER:-cloudit}"
POSTGRES_DB="${POSTGRES_DB:-hospitality}"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"
REDIS_PORT="${REDIS_PORT:-6380}"

cleanup() {
  echo "Cleaning up test containers..."
  docker rm -f postgres-e2e redis-e2e >/dev/null 2>&1 || true
  docker network rm "${NETWORK_NAME}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

cleanup

echo "Creating test network..."
docker network create "${NETWORK_NAME}" >/dev/null

echo "Starting test Postgres on port ${POSTGRES_PORT}..."
docker run -d --name postgres-e2e \
  --network "${NETWORK_NAME}" \
  -p "${POSTGRES_PORT}:5432" \
  -e POSTGRES_USER="${POSTGRES_USER}" \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  -e POSTGRES_DB="${POSTGRES_DB}" \
  postgres:16-alpine >/dev/null

echo "Starting test Redis on port ${REDIS_PORT}..."
docker run -d --name redis-e2e \
  --network "${NETWORK_NAME}" \
  -p "${REDIS_PORT}:6379" \
  redis:7-alpine >/dev/null

echo "Waiting for Postgres to be ready..."
until docker exec postgres-e2e pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; do
  sleep 1
done

echo "Running migrations and E2E tests..."
cd "${PROJECT_DIR}"

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"
export REDIS_HOST=localhost
export REDIS_PORT="${REDIS_PORT}"
export JWT_SECRET="${JWT_SECRET:-test-jwt-secret}"
export CORS_ORIGIN="*"

npx prisma migrate deploy
npm run test:e2e

echo "E2E tests complete."
