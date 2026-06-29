#!/bin/bash
set -euo pipefail

# One-command shutdown for the entire CloudIT Platform stack.
# Usage: ./stop.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

log() {
  echo "[stop] $1"
}

log "Stopping all CloudIT services..."

docker-compose -f "${PROJECT_ROOT}/infra/maintenance/docker-compose.yml" down 2>/dev/null || true
docker-compose -f "${PROJECT_ROOT}/infra/platform-web/docker-compose.yml" down 2>/dev/null || true
docker-compose -f "${PROJECT_ROOT}/infra/hospitality-web/docker-compose.yml" down 2>/dev/null || true
docker-compose -f "${PROJECT_ROOT}/infra/orbitone-web/docker-compose.yml" down 2>/dev/null || true
docker-compose -f "${PROJECT_ROOT}/infra/touchorbit-web/docker-compose.yml" down 2>/dev/null || true
docker-compose -f "${PROJECT_ROOT}/infra/platform-api/docker-compose.yml" down 2>/dev/null || true
docker-compose -f "${PROJECT_ROOT}/infra/hospitality-api/docker-compose.yml" down 2>/dev/null || true
docker-compose -f "${PROJECT_ROOT}/infra/orbitone-api/docker-compose.yml" down 2>/dev/null || true
docker-compose -f "${PROJECT_ROOT}/infra/touchorbit-api/docker-compose.yml" down 2>/dev/null || true
docker-compose -f "${PROJECT_ROOT}/infra/traefik/docker-compose.yml" down
docker-compose -f "${PROJECT_ROOT}/infra/n8n/docker-compose.yml" down
docker-compose -f "${PROJECT_ROOT}/infra/uptime-kuma/docker-compose.yml" down
docker-compose -f "${PROJECT_ROOT}/infra/postgres/docker-compose.yml" down
docker-compose -f "${PROJECT_ROOT}/infra/redis/docker-compose.yml" down
docker-compose -f "${PROJECT_ROOT}/infra/docker-compose.network.yml" down

log "All services stopped."
