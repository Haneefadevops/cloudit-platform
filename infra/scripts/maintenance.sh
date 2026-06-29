#!/bin/bash
set -euo pipefail

# CloudIT Platform — maintenance mode toggle.
# Usage: ./infra/scripts/maintenance.sh on|off

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
export DOMAIN="${DOMAIN:-cloudit.lk}"

log() {
  echo "[maintenance] $(date -Iseconds) $1"
}

mode="${1:-}"
if [[ "$mode" != "on" && "$mode" != "off" ]]; then
  echo "Usage: $0 on|off"
  exit 1
fi

app_services=(platform-api hospitality-api orbitone-api touchorbit-api platform-web hospitality-web orbitone-web touchorbit-web)

if [[ "$mode" == "on" ]]; then
  log "Stopping app services..."
  for svc in "${app_services[@]}"; do
    docker compose -f "${PROJECT_ROOT}/infra/${svc}/docker-compose.yml" down || true
  done

  log "Starting maintenance page..."
  docker compose -f "${PROJECT_ROOT}/infra/maintenance/docker-compose.yml" up -d

  log "Maintenance mode ON"
else
  log "Stopping maintenance page..."
  docker compose -f "${PROJECT_ROOT}/infra/maintenance/docker-compose.yml" down || true

  log "Redeploying app services..."
  "$PROJECT_ROOT/infra/scripts/deploy.sh"

  log "Maintenance mode OFF"
fi
