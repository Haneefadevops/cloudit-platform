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

cd "$PROJECT_ROOT"

api_services=(touchorbit-api platform-api hospitality-api orbitone-api)

for svc in "${api_services[@]}"; do
  tag_previous_image "$svc"

  log "Building ${svc} image..."
  docker compose -f "infra/${svc}/docker-compose.yml" build "${svc}"

  log "Running predeploy for ${svc}..."
  docker compose -f "infra/${svc}/docker-compose.yml" run --rm "${svc}" npm run predeploy
done


log "Pre-deployment checks complete"
