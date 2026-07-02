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

api_services=(touchorbit-api platform-api hospitality-api orbitone-api)

for svc in "${api_services[@]}"; do
  log "Building ${svc} image..."
  docker compose -f "infra/${svc}/docker-compose.yml" build "${svc}"

  log "Running predeploy for ${svc}..."
  docker compose -f "infra/${svc}/docker-compose.yml" run --rm --no-build "${svc}" npm run predeploy
done


log "Pre-deployment checks complete"
