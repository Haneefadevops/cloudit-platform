#!/usr/bin/env bash
set -euo pipefail

# CloudIT → Hetzner Storage Box Sync (optional / future)
# Syncs local backups to a Hetzner Storage Box using rclone or rsync+ssh.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [ -f "$ENV_FILE" ]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

BACKUP_DIR="${BACKUP_DIR:-/opt/backups/local}"
LOG_FILE="${LOG_FILE:-/var/log/cloudit-backup-sync.log}"

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"
}

die() {
  log "ERROR: $*"
  exit 1
}

if [ -z "${HETZNER_STORAGE_BOX:-}" ]; then
  log "HETZNER_STORAGE_BOX not configured. Skipping off-site sync."
  log "See docs/backup-restore.md for setup instructions."
  exit 0
fi

log "Starting sync to Hetzner Storage Box: $HETZNER_STORAGE_BOX"

# --- Option A: rclone (recommended) ---
if command -v rclone >/dev/null 2>&1 && [ -f "${SCRIPT_DIR}/rclone.conf" ]; then
  rclone sync "$BACKUP_DIR" "hetzner:${HETZNER_STORAGE_BOX}/backups" \
    --config "${SCRIPT_DIR}/rclone.conf" \
    --log-file="$LOG_FILE" \
    || die "rclone sync failed"
  log "rclone sync completed"
  exit 0
fi

# --- Option B: rsync over SSH ---
if command -v rsync >/dev/null 2>&1; then
  RSYNC_URL="${HETZNER_RSYNC_URL:-}"
  if [ -z "$RSYNC_URL" ]; then
    die "HETZNER_RSYNC_URL not set (e.g. u12345@u12345.your-storagebox.de:backups)"
  fi
  rsync -avz --delete "$BACKUP_DIR/" "$RSYNC_URL/" || die "rsync failed"
  log "rsync sync completed"
  exit 0
fi

die "Neither rclone nor rsync is available"
