#!/bin/bash
set -euo pipefail

# CloudIT Platform — post-deployment health checks.
# Exits non-zero if any public endpoint is unhealthy.

DOMAIN="${DOMAIN:-cloudit.lk}"
TIMEOUT_SECONDS="${HEALTH_TIMEOUT:-120}"

log() {
  echo "[health] $(date -Iseconds) $1"
}

endpoints=(
  "https://api-platform.${DOMAIN}/api/health"
  "https://api-hospitality.${DOMAIN}/api/health"
  "https://api-orbitone.${DOMAIN}/api/health"
  "https://api-touchorbit.${DOMAIN}/api/health"
  "https://app.${DOMAIN}"
  "https://hospitality.${DOMAIN}"
  "https://orbitone.${DOMAIN}"
  "https://touchorbit.${DOMAIN}"
)

log "Starting health checks (timeout ${TIMEOUT_SECONDS}s)..."

for url in "${endpoints[@]}"; do
  log "Checking ${url}"
  if ! curl -fsS --max-time "${TIMEOUT_SECONDS}" --retry 3 --retry-delay 5 "${url}"; then
    log "ERROR: ${url} is unhealthy"
    exit 1
  fi
done

log "All health checks passed"
