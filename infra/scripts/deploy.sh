#!/bin/bash
set -euo pipefail

# CloudIT Platform — full server-side deployment script.
# Usage: ./infra/scripts/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
export DOMAIN="${DOMAIN:-cloudit.lk}"

log() {
  echo "[deploy] $(date -Iseconds) $1"
}

cd "$PROJECT_ROOT"

log "Pulling latest code..."
git pull origin master

log "Running pre-deployment checks and migrations..."
"$PROJECT_ROOT/infra/scripts/predeploy.sh"

log "Tagging current app images for rollback..."
app_services=(platform-api hospitality-api orbitone-api touchorbit-api platform-web hospitality-web orbitone-web touchorbit-web touchorbit-admin-web touchorbit-employee-web)
for svc in "${app_services[@]}"; do
  image="cloudit/${svc}:latest"
  if docker image inspect "$image" >/dev/null 2>&1; then
    docker image tag "$image" "cloudit/${svc}:previous"
    log "Tagged ${svc} image as previous"
  fi
done

log "Ensuring shared network exists..."
docker compose -f infra/docker-compose.network.yml up -d

log "Starting core infrastructure..."
docker compose -f infra/postgres/docker-compose.yml up -d
docker compose -f infra/redis/docker-compose.yml up -d

log "Waiting for database and cache to become healthy..."
sleep 10

docker compose -f infra/traefik/docker-compose.yml up -d
docker compose -f infra/n8n/docker-compose.yml up -d
docker compose -f infra/uptime-kuma/docker-compose.yml up -d

log "Building and starting applications..."
for svc in "${app_services[@]}"; do
  docker compose -f "infra/${svc}/docker-compose.yml" up -d --build
done

log "Pruning old Docker resources..."
docker system prune -af --filter "until=168h" || true

log "Deployment complete at $(date -Iseconds)"
