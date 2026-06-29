#!/bin/bash
set -euo pipefail

# CloudIT Platform — disk-usage monitor.
# Logs a warning when usage crosses thresholds and optionally triggers cleanup.
# Run via cron every 15 minutes:
#   */15 * * * * /opt/cloudit/infra/scripts/disk-check.sh >> /var/log/cloudit-disk-check.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLEANUP_SCRIPT="${SCRIPT_DIR}/cleanup.sh"

# Defaults (override via environment)
WARN_THRESHOLD="${DISK_WARN_THRESHOLD:-80}"
CRITICAL_THRESHOLD="${DISK_CRITICAL_THRESHOLD:-90}"
AUTO_CLEANUP="${DISK_AUTO_CLEANUP:-true}"
CHECK_PATHS="${DISK_CHECK_PATHS:-/ /opt/backups /var/log /var/lib/docker}"

log() {
  echo "[disk-check] $(date -Iseconds) $1"
}

max_usage=0
max_path=""

for path in ${CHECK_PATHS}; do
  if [[ ! -d "$path" ]]; then
    continue
  fi

  usage=$(df -P "$path" | awk 'NR==2 {print $5}' | tr -d '%')
  if [[ -z "$usage" ]]; then
    continue
  fi

  log "Usage for ${path}: ${usage}%"

  if (( usage > max_usage )); then
    max_usage=$usage
    max_path=$path
  fi
done

if (( max_usage == 0 )); then
  log "Could not determine disk usage"
  exit 0
fi

if (( max_usage >= CRITICAL_THRESHOLD )); then
  log "CRITICAL: ${max_path} is ${max_usage}% full (threshold ${CRITICAL_THRESHOLD}%)"

  if [[ "$AUTO_CLEANUP" == "true" && -x "$CLEANUP_SCRIPT" ]]; then
    log "Triggering automatic cleanup"
    "$CLEANUP_SCRIPT" || log "Cleanup script exited with code $?"

    # Recheck after cleanup
    usage_after=$(df -P "$max_path" | awk 'NR==2 {print $5}' | tr -d '%')
    log "Usage after cleanup for ${max_path}: ${usage_after}%"
  fi

  exit 2
elif (( max_usage >= WARN_THRESHOLD )); then
  log "WARNING: ${max_path} is ${max_usage}% full (threshold ${WARN_THRESHOLD}%)"
  exit 1
else
  log "OK: maximum usage is ${max_usage}% on ${max_path}"
  exit 0
fi
