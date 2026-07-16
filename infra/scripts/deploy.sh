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
    docker image rm -f "$previous" >/dev/null 2>&1 || true
    if docker image tag "$image" "$previous"; then
      log "Tagged existing ${svc} image as previous"
    else
      log "WARNING: unable to tag existing ${svc} image as previous; continuing"
    fi
  fi
}

load_env_file() {
  local env_file="$1"
  local line key value

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"

    if [ -z "$line" ] || [[ "$line" == \#* ]]; then
      continue
    fi

    if [[ "$line" == export[[:space:]]* ]]; then
      line="${line#export}"
      line="${line#"${line%%[![:space:]]*}"}"
    fi

    key="${line%%=*}"
    value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"

    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] && [ "$line" != "$key" ]; then
      export "${key}=${value}"
    fi
  done < "$env_file"
}

build_service() {
  local svc="$1"
  local env_file="$PROJECT_ROOT/apps/${svc}/.env"

  if [ -f "$env_file" ]; then
    (
      load_env_file "$env_file"
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

sync_whatsapp_agent_db_credentials() {
  local api_env="$PROJECT_ROOT/apps/whatsapp-agent-api/.env"
  local pg_env="$PROJECT_ROOT/infra/postgres/.env"

  if [ ! -f "$api_env" ] || [ ! -f "$pg_env" ]; then
    return 0
  fi

  # Load shared Postgres credentials into the current shell
  load_env_file "$pg_env"

  if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ]; then
    log "WARNING: POSTGRES_USER or POSTGRES_PASSWORD not set in infra/postgres/.env; skipping TheReplyte DB credential sync"
    return 0
  fi

  local expected_url="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/whatsapp_agent?schema=public"
  local tmp_env="${api_env}.tmp"

  awk -v url="$expected_url" '
    BEGIN { FS=OFS="=" }
    /^DATABASE_URL=/ { print "DATABASE_URL=" url; replaced=1; next }
    { print }
    END { if (!replaced) print "DATABASE_URL=" url }
  ' "$api_env" > "$tmp_env" && mv "$tmp_env" "$api_env"

  log "Synced whatsapp-agent-api/.env DATABASE_URL with shared Postgres credentials"
}

ensure_chatwoot_env() {
  local cw_env="$PROJECT_ROOT/infra/chatwoot/.env"
  local cw_example="$PROJECT_ROOT/infra/chatwoot/.env.example"
  local pg_env="$PROJECT_ROOT/infra/postgres/.env"
  local redis_env="$PROJECT_ROOT/infra/redis/.env"

  if [ ! -f "$cw_env" ] && [ -f "$cw_example" ]; then
    cp "$cw_example" "$cw_env"
    log "Created infra/chatwoot/.env from .env.example"
  fi

  if [ ! -f "$cw_env" ]; then
    log "WARNING: infra/chatwoot/.env not found; Chatwoot will use default/example values"
    return 0
  fi

  # Sync shared Postgres credentials
  local pg_user pg_pass
  if [ -f "$pg_env" ]; then
    pg_user=$(grep '^POSTGRES_USER=' "$pg_env" | cut -d= -f2-)
    pg_pass=$(grep '^POSTGRES_PASSWORD=' "$pg_env" | cut -d= -f2-)
  fi

  if [ -n "${pg_user:-}" ]; then
    sed -i "/^POSTGRES_USER=/c\\POSTGRES_USER=$pg_user" "$cw_env" || true
  fi
  if [ -n "${pg_pass:-}" ]; then
    sed -i "/^POSTGRES_PASSWORD=/c\\POSTGRES_PASSWORD=$pg_pass" "$cw_env" || true
  fi

  # Sync Redis password
  local redis_pass
  if [ -f "$redis_env" ]; then
    redis_pass=$(grep '^REDIS_PASSWORD=' "$redis_env" | cut -d= -f2-)
  fi
  if [ -n "${redis_pass:-}" ]; then
    sed -i "/^REDIS_PASSWORD=/c\\REDIS_PASSWORD=$redis_pass" "$cw_env" || true
  fi

  # Generate a persistent SECRET_KEY_BASE if it is missing or still the placeholder
  local secret
  secret=$(grep '^CHATWOOT_SECRET_KEY_BASE=' "$cw_env" | cut -d= -f2- || true)
  if [ -z "${secret:-}" ] || [ "$secret" = "change_this_to_a_long_random_string" ]; then
    secret=$(openssl rand -hex 64 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')
    if grep -q '^CHATWOOT_SECRET_KEY_BASE=' "$cw_env"; then
      sed -i "/^CHATWOOT_SECRET_KEY_BASE=/c\\CHATWOOT_SECRET_KEY_BASE=$secret" "$cw_env"
    else
      echo "CHATWOOT_SECRET_KEY_BASE=$secret" >> "$cw_env"
    fi
    log "Generated CHATWOOT_SECRET_KEY_BASE"
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

# One-time migration: older TheReplyte .env files pointed DATABASE_URL to localhost
# Inside Docker the API container must reach the shared 'postgres' service.
if [ -f "$PROJECT_ROOT/apps/whatsapp-agent-api/.env" ]; then
  if grep -q 'localhost:5432/whatsapp_agent' "$PROJECT_ROOT/apps/whatsapp-agent-api/.env"; then
    sed -i 's|localhost:5432/whatsapp_agent|postgres:5432/whatsapp_agent|g' "$PROJECT_ROOT/apps/whatsapp-agent-api/.env"
    log "Patched whatsapp-agent-api/.env to use postgres:5432"
  fi
fi

# Keep TheReplyte DB credentials in sync with the shared Postgres server.
sync_whatsapp_agent_db_credentials

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

log "Building TheReplyte API..."
tag_previous_image "whatsapp-agent-api"
build_service "whatsapp-agent-api"
docker compose -f infra/whatsapp-agent-api/docker-compose.yml up -d
wait_for_service "whatsapp-agent-api"

log "Building TheReplyte web..."
tag_previous_image "whatsapp-agent-web"
build_service "whatsapp-agent-web"
docker compose -f infra/whatsapp-agent-web/docker-compose.yml up -d
wait_for_service "whatsapp-agent-web"

ensure_chatwoot_env

log "Starting Chatwoot..."
docker compose -f infra/chatwoot/docker-compose.yml up -d
wait_for_service "chatwoot-rails"

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
