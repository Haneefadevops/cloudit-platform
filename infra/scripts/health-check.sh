#!/bin/bash
set -euo pipefail

# CloudIT Platform — post-deployment health checks.
# Exits non-zero if any public endpoint is unhealthy.

NOTCHME_WEB_URL="${NOTCHME_WEB_URL:-}"
NOTCHME_API_URL="${NOTCHME_API_URL:-}"
TIMEOUT_SECONDS="${HEALTH_TIMEOUT:-120}"

log() {
  echo "[health] $(date -Iseconds) $1"
}

endpoints=(
  "https://api-platform.${DOMAIN}/api/health/live"
  "https://api-hospitality.${DOMAIN}/api/health/live"
  "https://api-touchorbit.${DOMAIN}/api/health/live"
  "https://platform.${DOMAIN}"
  "https://hospitality.${DOMAIN}"
  "https://touchorbit.${DOMAIN}"
  "https://to-admin.${DOMAIN}"
  "https://to-employee.${DOMAIN}"
  "https://to-kiosk.${DOMAIN}"
  "https://fixifai.${DOMAIN}"
  "https://api.thereplyte.com/api/health"
  "https://app.thereplyte.com"
  "https://inbox.thereplyte.com"
)

if [ -n "$NOTCHME_API_URL" ]; then
  endpoints+=("${NOTCHME_API_URL%/}/api/health/live")
fi
if [ -n "$NOTCHME_WEB_URL" ]; then
  endpoints+=("${NOTCHME_WEB_URL%/}")
fi

log "Starting health checks (timeout ${TIMEOUT_SECONDS}s)..."

for url in "${endpoints[@]}"; do
  log "Checking ${url}"
  if ! curl -fsS --max-time "${TIMEOUT_SECONDS}" --retry 3 --retry-delay 5 "${url}"; then
    log "ERROR: ${url} is unhealthy"
    exit 1
  fi
done

log "All health checks passed"
