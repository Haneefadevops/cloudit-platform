#!/bin/bash
set -euo pipefail

# One-command startup for the entire CloudIT Platform stack.
# Usage: ./start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "[start] CloudIT Platform — starting all services..."

# 1. Ensure .env files exist
for service in traefik postgres redis n8n uptime-kuma; do
    ENV_FILE="${PROJECT_ROOT}/infra/${service}/.env"
    EXAMPLE_FILE="${PROJECT_ROOT}/infra/${service}/.env.example"
    if [[ ! -f "$ENV_FILE" && -f "$EXAMPLE_FILE" ]]; then
        echo "[start] WARNING: ${service}/.env missing — copying from .env.example"
        cp "$EXAMPLE_FILE" "$ENV_FILE"
    fi
done

# 2. Create shared network
echo "[start] Creating shared Docker network 'cloudit'..."
docker-compose -f "${PROJECT_ROOT}/infra/docker-compose.network.yml" up -d

# 3. Start core infrastructure first
echo "[start] Starting PostgreSQL + Redis..."
docker-compose -f "${PROJECT_ROOT}/infra/postgres/docker-compose.yml" up -d
docker-compose -f "${PROJECT_ROOT}/infra/redis/docker-compose.yml" up -d

echo "[start] Waiting 10s for databases to initialize..."
sleep 10

# 4. Start Traefik (reverse proxy)
echo "[start] Starting Traefik..."
docker-compose -f "${PROJECT_ROOT}/infra/traefik/docker-compose.yml" up -d

# 5. Start applications
echo "[start] Starting n8n + Uptime Kuma..."
docker-compose -f "${PROJECT_ROOT}/infra/n8n/docker-compose.yml" up -d
docker-compose -f "${PROJECT_ROOT}/infra/uptime-kuma/docker-compose.yml" up -d

echo ""
echo "[start] All services started! Checking status..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=========================================="
echo "  CloudIT Platform is running!"
echo "=========================================="
echo ""
echo "Services (add hosts entries for local dev):"
echo "  Traefik Dashboard : http://traefik.localhost:8080  (or https://traefik.<your-domain>)"
echo "  n8n               : https://n8n.<your-domain>"
echo "  Uptime Kuma       : https://status.<your-domain>"
echo ""
echo "Run './stop.sh' to stop all services."
echo "Run './scripts/backup.sh' to create a backup."
