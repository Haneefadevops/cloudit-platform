#!/bin/bash
set -euo pipefail

# One-command shutdown for the entire CloudIT Platform stack.
# Usage: ./stop.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "[stop] Stopping all CloudIT services..."

docker-compose -f "${PROJECT_ROOT}/infra/traefik/docker-compose.yml" down
docker-compose -f "${PROJECT_ROOT}/infra/n8n/docker-compose.yml" down
docker-compose -f "${PROJECT_ROOT}/infra/uptime-kuma/docker-compose.yml" down
docker-compose -f "${PROJECT_ROOT}/infra/postgres/docker-compose.yml" down
docker-compose -f "${PROJECT_ROOT}/infra/redis/docker-compose.yml" down
docker-compose -f "${PROJECT_ROOT}/infra/docker-compose.network.yml" down

echo "[stop] All services stopped."
