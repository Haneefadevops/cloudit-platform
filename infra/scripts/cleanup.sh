#!/bin/bash
set -euo pipefail

# CloudIT Platform — system cleanup script.
# Safe defaults: only removes unused Docker objects and old logs.
# Run via cron: 0 4 * * 0 /opt/cloudit/infra/scripts/cleanup.sh >> /var/log/cloudit-cleanup.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Defaults (override via environment)
DOCKER_PRUNE_UNTIL="${DOCKER_PRUNE_UNTIL:-168h}"   # 7 days
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-14}"
JOURNAL_VACUUM="${JOURNAL_VACUUM:-7d}"
CLEAN_NPM_CACHE="${CLEAN_NPM_CACHE:-false}"
CLEAN_CORE_DUMPS="${CLEAN_CORE_DUMPS:-true}"
CLEAN_TMP_FILES="${CLEAN_TMP_FILES:-true}"
DRY_RUN="${DRY_RUN:-false}"

log() {
  echo "[cleanup] $(date -Iseconds) $1"
}

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: $*"
  else
    log "Running: $*"
    "$@"
  fi
}

log "Starting CloudIT cleanup (DRY_RUN=${DRY_RUN})"

# 1. Docker: remove unused networks, images, build cache older than DOCKER_PRUNE_UNTIL.
# Do NOT prune volumes here — backup/restore volumes must stay intact.
if command -v docker >/dev/null 2>&1; then
  log "Pruning Docker objects older than ${DOCKER_PRUNE_UNTIL} (volumes excluded)"
  run docker system prune -af --filter "until=${DOCKER_PRUNE_UNTIL}"
else
  log "docker not found, skipping Docker cleanup"
fi

# 2. CloudIT application logs
log "Removing CloudIT logs older than ${LOG_RETENTION_DAYS} days"
if [[ -d /var/log ]]; then
  find /var/log -maxdepth 1 -type f \( -name 'cloudit*.log' -o -name 'cloudit-backup*.log' \) -mtime +"${LOG_RETENTION_DAYS}" -print -delete || true
fi

# 3. systemd journal (if available)
if command -v journalctl >/dev/null 2>&1; then
  log "Vacuuming journal logs to ${JOURNAL_VACUUM}"
  run journalctl --vacuum-time="${JOURNAL_VACUUM}"
fi

# 4. Core dumps
if [[ "$CLEAN_CORE_DUMPS" == "true" ]]; then
  log "Removing old core dumps"
  find /var/lib/systemd/coredump /var/crash -type f -mtime +7 -print -delete 2>/dev/null || true
fi

# 5. Temporary files
if [[ "$CLEAN_TMP_FILES" == "true" ]]; then
  log "Cleaning temporary files older than 7 days"
  find /tmp -type f -atime +7 -print -delete 2>/dev/null || true
fi

# 6. npm cache (optional, mainly for build agents)
if [[ "$CLEAN_NPM_CACHE" == "true" ]] && command -v npm >/dev/null 2>&1; then
  log "Cleaning npm cache"
  run npm cache clean --force
fi

log "Cleanup complete"
