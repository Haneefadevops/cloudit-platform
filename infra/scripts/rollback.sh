#!/bin/bash
set -euo pipefail

# CloudIT Platform — rollback to previously deployed app images.
# Must be run on the server after a failed deployment.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
export DOMAIN="${DOMAIN:-cloudit.lk}"

log() {
  echo "[rollback] $(date -Iseconds) $1"
}

cd "$PROJECT_ROOT"

log "Stopping maintenance page if active..."
docker compose -f infra/maintenance/docker-compose.yml down 2>/dev/null || true

app_services=(platform-api hospitality-api orbitone-api touchorbit-api platform-web hospitality-web orbitone-web touchorbit-web)

log "Restoring previous app images..."
for svc in "${app_services[@]}"; do
  current="cloudit/${svc}:latest"
  previous="cloudit/${svc}:previous"
  if docker image inspect "$previous" >/dev/null 2>&1; then
    docker image tag "$previous" "$current"
    log "Restored ${svc}"
  else
    log "WARNING: no previous image found for ${svc}"
  fi
done

log "Recreating app containers from previous images..."
for svc in "${app_services[@]}"; do
  docker compose -f "infra/${svc}/docker-compose.yml" up -d --no-build --force-recreate
done

log "Rollback complete at $(date -Iseconds)"
