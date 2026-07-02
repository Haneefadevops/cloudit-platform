#!/bin/bash
set -euo pipefail

# CloudIT Platform — pre-deployment migration checks and apply.
# Run this before deploying new app versions.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
export DOMAIN="${DOMAIN:-cloudit.lk}"

log() {
  echo "[predeploy] $(date -Iseconds) $1"
}

cd "$PROJECT_ROOT"

log "Applying migrations for touchorbit-api..."
docker compose -f infra/touchorbit-api/docker-compose.yml run --rm --build touchorbit-api npm run migrate

log "Applying pending migrations for platform-api..."
docker compose -f infra/platform-api/docker-compose.yml run --rm --build platform-api npx prisma migrate deploy

log "Applying pending migrations for hospitality-api..."
docker compose -f infra/hospitality-api/docker-compose.yml run --rm --build hospitality-api npx prisma migrate deploy

log "Applying pending migrations for orbitone-api..."
docker compose -f infra/orbitone-api/docker-compose.yml run --rm --build orbitone-api npx prisma migrate deploy



log "Pre-deployment checks complete"
