#!/bin/bash
set -euo pipefail

# One-command startup for the entire CloudIT Platform stack.
# Usage: ./start.sh
# Set START_APPS=true to also start platform/hospitality apps (default: false).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
START_APPS="${START_APPS:-false}"

log() {
  echo "[start] $1"
}

log "CloudIT Platform — starting services..."

# 1. Ensure .env files exist
for service in traefik postgres redis n8n uptime-kuma; do
    ENV_FILE="${PROJECT_ROOT}/infra/${service}/.env"
    EXAMPLE_FILE="${PROJECT_ROOT}/infra/${service}/.env.example"
    if [[ ! -f "$ENV_FILE" && -f "$EXAMPLE_FILE" ]]; then
        log "WARNING: ${service}/.env missing — copying from .env.example"
        cp "$EXAMPLE_FILE" "$ENV_FILE"
    fi
done

# 2. Create shared network
log "Creating shared Docker network 'cloudit'..."
docker-compose -f "${PROJECT_ROOT}/infra/docker-compose.network.yml" up -d

# 3. Start core infrastructure first
log "Starting PostgreSQL + Redis..."
docker-compose -f "${PROJECT_ROOT}/infra/postgres/docker-compose.yml" up -d
docker-compose -f "${PROJECT_ROOT}/infra/redis/docker-compose.yml" up -d

log "Waiting 10s for databases to initialize..."
sleep 10

# 4. Start Traefik (reverse proxy)
log "Starting Traefik..."
docker-compose -f "${PROJECT_ROOT}/infra/traefik/docker-compose.yml" up -d

# 5. Start applications
log "Starting n8n + Uptime Kuma..."
docker-compose -f "${PROJECT_ROOT}/infra/n8n/docker-compose.yml" up -d
docker-compose -f "${PROJECT_ROOT}/infra/uptime-kuma/docker-compose.yml" up -d

# 6. Optionally start platform/hospitality/orbitone/touchorbit apps
if [[ "$START_APPS" == "true" ]]; then
    log "Starting application services..."
    docker-compose -f "${PROJECT_ROOT}/infra/platform-api/docker-compose.yml" up -d
    docker-compose -f "${PROJECT_ROOT}/infra/hospitality-api/docker-compose.yml" up -d
    docker-compose -f "${PROJECT_ROOT}/infra/orbitone-api/docker-compose.yml" up -d
    docker-compose -f "${PROJECT_ROOT}/infra/touchorbit-api/docker-compose.yml" up -d
    docker-compose -f "${PROJECT_ROOT}/infra/platform-web/docker-compose.yml" up -d
    docker-compose -f "${PROJECT_ROOT}/infra/hospitality-web/docker-compose.yml" up -d
    docker-compose -f "${PROJECT_ROOT}/infra/orbitone-web/docker-compose.yml" up -d
    docker-compose -f "${PROJECT_ROOT}/infra/touchorbit-web/docker-compose.yml" up -d
fi

log ""
log "All requested services started! Checking status..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

log ""
echo "=========================================="
echo "  CloudIT Platform is running!"
echo "=========================================="
echo ""
echo "Services (add hosts entries for local dev):"
echo "  Traefik Dashboard : http://traefik.localhost:8080  (or https://traefik.<your-domain>)"
echo "  n8n               : https://n8n.<your-domain>"
echo "  Uptime Kuma       : https://status.<your-domain>"
if [[ "$START_APPS" == "true" ]]; then
    echo "  Platform Web      : https://app.<your-domain>"
    echo "  Platform API      : https://api-platform.<your-domain>"
    echo "  Hospitality Web   : https://hospitality.<your-domain>"
    echo "  Hospitality API   : https://api-hospitality.<your-domain>"
    echo "  OrbitOne Web      : https://orbitone.<your-domain>"
    echo "  OrbitOne API      : https://api-orbitone.<your-domain>"
    echo "  TouchOrbit HR Web : https://touchorbit.<your-domain>"
    echo "  TouchOrbit HR API : https://api-touchorbit.<your-domain>"
fi
echo ""
echo "Run './stop.sh' to stop all services."
