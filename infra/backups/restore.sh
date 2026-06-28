#!/usr/bin/env bash
set -euo pipefail

# CloudIT Restore Script
# Restores PostgreSQL, Redis, n8n, and Uptime Kuma from a backup archive.
# Usage: ./restore.sh <backup-file>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [ -f "$ENV_FILE" ]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

LOG_FILE="${LOG_FILE:-/var/log/cloudit-restore.log}"
TMP_DIR="$(mktemp -d)"

trap 'rm -rf "$TMP_DIR"' EXIT

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"
}

die() {
  log "ERROR: $*"
  exit 1
}

if [ $# -lt 1 ]; then
  die "Usage: $0 <backup-file>"
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  die "Backup file not found: $BACKUP_FILE"
fi

POSTGRES_USER="${POSTGRES_USER:-cloudit}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

log "Starting restore from: $BACKUP_FILE"

# --- Decrypt if needed ---
if [[ "$BACKUP_FILE" == *.gpg ]]; then
  if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
    die "BACKUP_ENCRYPTION_KEY is required to decrypt .gpg backups"
  fi
  log "Decrypting archive..."
  gpg --batch --yes --decrypt \
    --passphrase "$BACKUP_ENCRYPTION_KEY" \
    --output "${TMP_DIR}/backup.tar.gz" \
    "$BACKUP_FILE" || die "Decryption failed"
  BACKUP_FILE="${TMP_DIR}/backup.tar.gz"
fi

# --- Extract archive ---
log "Extracting archive..."
tar xzf "$BACKUP_FILE" -C "$TMP_DIR" || die "Archive extraction failed"

# --- Restore PostgreSQL ---
log "Restoring PostgreSQL databases..."
if [ -f "${TMP_DIR}/postgres.sql" ]; then
  docker exec -i postgres psql -U "$POSTGRES_USER" < "${TMP_DIR}/postgres.sql" \
    || die "PostgreSQL restore failed"
else
  log "WARNING: postgres.sql not found in backup"
fi

# --- Restore Redis ---
if [ -f "${TMP_DIR}/redis.rdb" ]; then
  log "Restoring Redis snapshot..."
  docker stop redis >/dev/null 2>&1 || true
  docker cp "${TMP_DIR}/redis.rdb" "redis:/data/dump.rdb" || die "Failed to copy Redis RDB"
  docker start redis >/dev/null 2>&1 || die "Failed to start Redis"
else
  log "WARNING: redis.rdb not found in backup (Redis is cache-only; skipping)"
fi

# --- Restore n8n volume ---
if [ -f "${TMP_DIR}/n8n-data.tar.gz" ]; then
  log "Restoring n8n volume..."
  docker stop n8n >/dev/null 2>&1 || true
  docker run --rm --volumes-from n8n \
    -v "${TMP_DIR}:/backup-in" \
    alpine:3.19 \
    tar xzf /backup-in/n8n-data.tar.gz -C /home/node/.n8n \
    || die "n8n volume restore failed"
  docker start n8n >/dev/null 2>&1 || true
else
  log "WARNING: n8n-data.tar.gz not found in backup"
fi

# --- Restore Uptime Kuma volume ---
if [ -f "${TMP_DIR}/uptime-kuma-data.tar.gz" ]; then
  log "Restoring Uptime Kuma volume..."
  docker stop uptime-kuma >/dev/null 2>&1 || true
  docker run --rm --volumes-from uptime-kuma \
    -v "${TMP_DIR}:/backup-in" \
    alpine:3.19 \
    tar xzf /backup-in/uptime-kuma-data.tar.gz -C /app/data \
    || die "Uptime Kuma volume restore failed"
  docker start uptime-kuma >/dev/null 2>&1 || true
else
  log "WARNING: uptime-kuma-data.tar.gz not found in backup"
fi

# --- Verify PostgreSQL connectivity ---
log "Verifying PostgreSQL connectivity..."
if docker exec postgres pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
  log "PostgreSQL is reachable"
else
  die "PostgreSQL connectivity check failed"
fi

log "Restore completed successfully"
