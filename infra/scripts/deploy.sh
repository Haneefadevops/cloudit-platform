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

wait_for_service() {
  local container="$1"
  local timeout="${2:-180}"
  local elapsed=0

  log "Waiting for ${container} to become healthy..."
  while [ "$elapsed" -lt "$timeout" ]; do
    status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      log "${container} is ${status}"
      return 0
    fi

    sleep 5
    elapsed=$((elapsed + 5))
  done

  log "${container} did not become healthy within ${timeout}s"
  docker logs --tail 100 "$container" || true
  return 1
}

tag_previous_image() {
  local svc="$1"
  local image="cloudit/${svc}:latest"
  local previous="cloudit/${svc}:previous"

  if docker image inspect "$image" >/dev/null 2>&1; then
    docker image tag "$image" "$previous"
    log "Tagged existing ${svc} image as previous"
  fi
}

build_service() {
  local svc="$1"
  local env_file="$PROJECT_ROOT/apps/${svc}/.env"

  if [ -f "$env_file" ]; then
    (
      set -a
      # shellcheck source=/dev/null
      source "$env_file"
      set +a
      docker compose -f "infra/${svc}/docker-compose.yml" build "$svc"
    )
  else
    docker compose -f "infra/${svc}/docker-compose.yml" build "$svc"
  fi
}

escape_traefik_dashboard_auth() {
  local env_file="$PROJECT_ROOT/infra/traefik/.env"

  if [ -f "$env_file" ]; then
    if grep -Eq '^DASHBOARD_AUTH=.*(^|[^$])\$[A-Za-z0-9_]' "$env_file"; then
      log "Escaping Traefik dashboard auth dollars for Docker Compose..."
      sed -i -E '/^DASHBOARD_AUTH=/ s/\$/$$/g' "$env_file"
    fi
  fi
}

cd "$PROJECT_ROOT"

log "Pulling latest code..."
git pull origin master

log "Ensuring app .env files exist..."
for app_dir in apps/*; do
  if [ -f "${app_dir}/.env.example" ] && [ ! -f "${app_dir}/.env" ]; then
    cp "${app_dir}/.env.example" "${app_dir}/.env"
    log "Created ${app_dir}/.env from .env.example"
  fi
done

log "Ensuring shared network exists..."
docker network inspect cloudit >/dev/null 2>&1 || docker network create cloudit --driver bridge --attachable

escape_traefik_dashboard_auth

log "Starting core infrastructure..."
docker compose -f infra/postgres/docker-compose.yml up -d
docker compose -f infra/redis/docker-compose.yml up -d

wait_for_service postgres
wait_for_service redis

log "Ensuring application databases exist..."
"$PROJECT_ROOT/infra/scripts/ensure-databases.sh"

log "Running pre-deployment checks and migrations..."
"$PROJECT_ROOT/infra/scripts/predeploy.sh"

frontend_services=(platform-web hospitality-web orbitone-web touchorbit-web touchorbit-admin-web touchorbit-employee-web)

docker compose -f infra/traefik/docker-compose.yml up -d
wait_for_service traefik

docker compose -f infra/n8n/docker-compose.yml up -d
wait_for_service n8n

docker compose -f infra/uptime-kuma/docker-compose.yml up -d
wait_for_service uptime-kuma

log "Building frontend images..."
for svc in "${frontend_services[@]}"; do
  tag_previous_image "$svc"
  build_service "$svc"
done

log "Starting platform-api..."
docker compose -f infra/platform-api/docker-compose.yml up -d platform-api
wait_for_service platform-api

log "Starting product APIs..."
for svc in hospitality-api orbitone-api touchorbit-api; do
  docker compose -f "infra/${svc}/docker-compose.yml" up -d "$svc"
done
for svc in hospitality-api orbitone-api touchorbit-api; do
  wait_for_service "$svc"
done

log "Starting web frontends..."
for svc in "${frontend_services[@]}"; do
  docker compose -f "infra/${svc}/docker-compose.yml" up -d "$svc"
done
for svc in "${frontend_services[@]}"; do
  wait_for_service "$svc"
done

log "Pruning old Docker resources..."
docker system prune -af --filter "until=168h" || true

log "Deployment complete at $(date -Iseconds)"
